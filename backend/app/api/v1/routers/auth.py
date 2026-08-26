import re
import string
import secrets
import time
import json
import os
import httpx
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import EmailStr

from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.models.domain import Profile, Role, ProjectInvitation, ProjectMember, ActivityLog, SystemSetting
from app.schemas.pydantic_models import LoginRequest, TokenResponse, InviteAcceptRequest, RefreshTokenRequest, ProfileResponse
from app.api.deps import get_current_user
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/auth", tags=["Authentication"])


# =============================================================================
# Helpers
# =============================================================================

def _user_dict(user: Profile) -> Dict[str, Any]:
    """Build the user payload consumed by the frontend (lowercase role)."""
    role_name = user.role.name.lower() if user.role else ""
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": role_name,
        "avatar_url": user.avatar_url,
        "phone": user.phone,
        "status": user.status,
        "bio": user.bio,
    }


def _issue_tokens(user: Profile) -> Dict[str, Any]:
    """Create access + refresh tokens and the user payload for a logged-in profile."""
    role_name = user.role.name.lower() if user.role else ""
    return {
        "access_token": create_access_token(subject=user.id, role=role_name),
        "refresh_token": create_refresh_token(subject=user.id, role=role_name),
        "token_type": "bearer",
        "user": _user_dict(user),
    }


def _validate_password(new_password: str) -> None:
    """Password policy: >=8 chars, upper, lower, digit."""
    if len(new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters.")
    if not re.search(r"[A-Z]", new_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", new_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", new_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must contain at least one number.")


# =============================================================================
# Original Login / Session Endpoints
# =============================================================================

def _login_impl(db: Session, email: str, password: str, captcha_id: Optional[str] = None, captcha_code: Optional[str] = None) -> Dict[str, Any]:
    captcha_enabled_setting = db.query(SystemSetting).filter(SystemSetting.setting_key == "captcha_enabled").first()
    if captcha_enabled_setting and captcha_enabled_setting.setting_value == "true":
        if not captcha_id or not captcha_code:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CAPTCHA is required.")
        _captcha_cleanup()
        captcha_data = _captcha_store.get(captcha_id)
        if not captcha_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CAPTCHA expired or invalid.")
        if captcha_data["attempts"] >= _CAPTCHA_MAX_ATTEMPTS:
            _captcha_store.pop(captcha_id, None)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Too many failed CAPTCHA attempts.")
        if captcha_data["code"] != captcha_code.strip():
            captcha_data["attempts"] += 1
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect CAPTCHA code.")
        _captcha_store.pop(captcha_id, None)

    user = db.query(Profile).filter(Profile.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact an administrator.",
        )

    NotificationService.log_activity(
        db=db,
        user_id=user.id,
        action="LOGIN",
        entity_type="USER",
        entity_id=user.id,
        details={"email": email},
    )
    return _issue_tokens(user)


@router.post("/login", response_model=TokenResponse)
def unified_login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate any user natively."""
    return _login_impl(db, req.email, req.password, req.captcha_id, req.captcha_code)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a fresh access + refresh token pair."""
    payload = decode_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    user_id = payload.get("sub")
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user or user.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive or does not exist")
    return _issue_tokens(user)


@router.post("/accept-invite", response_model=TokenResponse)
def accept_invite(req: InviteAcceptRequest, db: Session = Depends(get_db)):
    """Complete registration for an invited manager/developer using their invite token."""
    invitation = db.query(ProjectInvitation).filter(ProjectInvitation.token == req.token).first()
    if not invitation:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invitation token")
    if invitation.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation has already been used or cancelled")
    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation has expired")

    _validate_password(req.password)

    existing = db.query(Profile).filter(Profile.email == invitation.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists. Please log in instead.",
        )

    role = db.query(Role).filter(Role.name == invitation.role).first()
    if not role:
        role = db.query(Role).filter(Role.name == "developer").first()

    full_name = (req.full_name or invitation.full_name or invitation.email.split("@")[0]).strip()
    user = Profile(
        email=invitation.email,
        password_hash=get_password_hash(req.password),
        full_name=full_name,
        phone=req.phone,
        avatar_url=req.avatar_url,
        role_id=role.id,
        status="ACTIVE",
        bio=req.bio,
    )
    db.add(user)
    db.flush()

    if invitation.project_id:
        db.add(ProjectMember(
            project_id=invitation.project_id,
            user_id=user.id,
            role_in_project="MANAGER" if invitation.role == "manager" else "DEVELOPER",
            team=invitation.team,
        ))

    invitation.status = "ACCEPTED"
    db.commit()

    NotificationService.log_activity(
        db=db,
        user_id=user.id,
        action="INVITE_ACCEPTED",
        entity_type="USER",
        entity_id=user.id,
        details={"email": user.email, "role": invitation.role},
    )
    return _issue_tokens(user)


@router.get("/me", response_model=ProfileResponse)
def get_me(user: Profile = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "status": user.status,
        "bio": user.bio,
        "role": user.role.name.lower() if user.role else "",
        "created_at": user.created_at,
    }


# =============================================================================
# In-memory CAPTCHA store with expiration + attempt limiting
# Key: captcha_id (str), Value: {"code", "expires_at", "attempts"}
# =============================================================================
_captcha_store: Dict[str, dict] = {}
_CAPTCHA_TTL = 600  # 10 minutes
_CAPTCHA_MAX_ATTEMPTS = 5


def _captcha_cleanup():
    now = time.time()
    to_remove = [cid for cid, data in _captcha_store.items() if data["expires_at"] < now]
    for cid in to_remove:
        _captcha_store.pop(cid, None)


def _generate_captcha_code() -> str:
    """Random 4-6 digit number using the secure random generator."""
    length = secrets.choice([4, 5, 6])
    return ''.join(secrets.choice(string.digits) for _ in range(length))


def _new_captcha() -> Dict[str, str]:
    code = _generate_captcha_code()
    captcha_id = secrets.token_urlsafe(4)
    _captcha_store[captcha_id] = {
        "code": code,
        "expires_at": time.time() + _CAPTCHA_TTL,
        "attempts": 0,
    }
    return {"captcha_id": captcha_id, "code": code}


# =============================================================================
# CAPTCHA Endpoints
# =============================================================================

@router.get("/public-settings")
def get_public_settings(db: Session = Depends(get_db)):
    keys = ["captcha_enabled", "google_login_enabled"]
    res = {}
    try:
        for k in keys:
            s = db.query(SystemSetting).filter(SystemSetting.setting_key == k).first()
            if s:
                res[k] = s.setting_value == "true"
            else:
                if k == "google_login_enabled":
                    res[k] = bool(settings.GOOGLE_CLIENT_ID)
                else:
                    res[k] = False
    except Exception as e:
        print(f"[Auth Warning] Public settings load error (db issue): {e}")
        res["captcha_enabled"] = False
        res["google_login_enabled"] = bool(settings.GOOGLE_CLIENT_ID)
    return res


@router.get("/captcha", response_model=dict)
def get_captcha(_db: Session = Depends(get_db)):
    """Generate a new random CAPTCHA code (4-6 digits) shown to the user.

    The code is generated server-side per request; it is NEVER hardcoded in
    frontend source. Validation happens server-side (see /forgot-password).
    """
    _captcha_cleanup()
    return _new_captcha()


@router.post("/verify-captcha", response_model=dict)
def verify_captcha(req: dict, _db: Session = Depends(get_db)):
    """Validate a CAPTCHA attempt. Repeated failures invalidate the CAPTCHA."""
    _captcha_cleanup()
    captcha_id = req.get("captcha_id")
    entered_code = str(req.get("entered_code") or "").strip()

    if not captcha_id or not entered_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing CAPTCHA ID or code.")

    captcha = _captcha_store.get(captcha_id)
    if not captcha:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired CAPTCHA. Please refresh and try again.")

    captcha["attempts"] += 1
    if captcha["code"] != entered_code:
        if captcha["attempts"] >= _CAPTCHA_MAX_ATTEMPTS:
            _captcha_store.pop(captcha_id, None)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many incorrect attempts. A new verification code has been generated.",
                headers={"X-New-Captcha": _new_captcha()["captcha_id"]},
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect verification code. Please try again.",
            headers={"X-New-Captcha": _new_captcha()["captcha_id"]},
        )

    # Success: consume the CAPTCHA so it cannot be replayed.
    _captcha_store.pop(captcha_id, None)
    return {"success": True, "message": "Verification code is correct."}


# =============================================================================
# Reset Token Store (in-memory; production: Redis/DB)
# =============================================================================
_reset_store: Dict[str, dict] = {}
_RESET_TTL = 3600  # 1 hour


# =============================================================================
# Forgot / Reset Password Endpoints
# =============================================================================

@router.post("/forgot-password", response_model=dict)
def forgot_password(req: dict, _db: Session = Depends(get_db)):
    """Forgot password step 1: verify CAPTCHA + check email existence.

    Uses a generic response for unknown emails to avoid account enumeration.
    """
    captcha_id = req.get("captcha_id")
    entered_code = str(req.get("entered_code") or "").strip()
    email = str(req.get("email") or "").strip().lower()

    if not captcha_id or not entered_code or not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing CAPTCHA ID, code, or email.")

    # 1. Verify CAPTCHA (with attempt limiting)
    captcha = _captcha_store.get(captcha_id)
    if not captcha:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired CAPTCHA. Please refresh and try again.")
    captcha["attempts"] += 1
    if captcha["code"] != entered_code:
        if captcha["attempts"] >= _CAPTCHA_MAX_ATTEMPTS:
            _captcha_store.pop(captcha_id, None)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many incorrect attempts. A new verification code has been generated.",
                headers={"X-New-Captcha": _new_captcha()["captcha_id"]},
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect verification code. Please try again.",
            headers={"X-New-Captcha": _new_captcha()["captcha_id"]},
        )
    # consume CAPTCHA on success
    _captcha_store.pop(captcha_id, None)

    # 2. Generic response for unknown emails (no account enumeration)
    user = _db.query(Profile).filter(Profile.email == email).first()
    if not user:
        return {
            "status": "no_account",
            "message": "If an account exists for this email, you can continue with password recovery.",
        }

    # 3. One-time short-lived reset token
    reset_id = secrets.token_urlsafe(32)
    _reset_store[reset_id] = {
        "email": email,
        "used": False,
        "expires_at": time.time() + _RESET_TTL,
    }
    return {
        "status": "success",
        "message": "Verification successful. Please set a new password.",
        "reset_id": reset_id,
        "reset_expires": _RESET_TTL,
    }


@router.post("/reset-password", response_model=dict)
def reset_password(req: dict, _db: Session = Depends(get_db)):
    """Forgot password step 2: set a new password using the one-time reset token.

    Only password_hash is updated; role, id, and all assignments are preserved.
    """
    reset_id = req.get("reset_id")
    new_password = req.get("new_password")
    confirm_password = req.get("confirm_password")

    if not reset_id or not new_password or not confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing required fields.")

    reset_data = _reset_store.get(reset_id)
    if not reset_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")
    if reset_data["used"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset token has already been used.")
    if reset_data["expires_at"] < time.time():
        _reset_store.pop(reset_id, None)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset token has expired.")

    if new_password != confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match.")

    _validate_password(new_password)

    user = _db.query(Profile).filter(Profile.email == reset_data["email"]).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Preserve role + all profile/assignment fields: only the hash changes.
    user.password_hash = get_password_hash(new_password)
    reset_data["used"] = True
    _db.commit()

    NotificationService.log_activity(
        db=_db,
        user_id=user.id,
        action="PASSWORD_RESET",
        entity_type="USER",
        entity_id=user.id,
        details={"email": user.email, "portal": user.role.name.lower() if user.role else ""},
    )

    result = _issue_tokens(user)
    result["status"] = "success"
    result["message"] = "Your password has been updated successfully."
    return result


# =============================================================================
# Google OAuth Endpoints
# =============================================================================

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


def _google_redirect_uri(override: Optional[str] = None) -> str:
    """Resolve the exact OAuth callback URI.

    Priority:
      1. The URI the browser actually used (override from the frontend), so the
         authorization request and the token exchange ALWAYS match.
      2. GOOGLE_REDIRECT_URI env override (production/custom setups).
      3. Derived from FRONTEND_URL env -> {FRONTEND_URL}/auth/google/callback.

    The resolved value MUST be registered verbatim in Google Cloud Console
    (Settings > Credentials > OAuth 2.0 Client > Authorized redirect URIs).
    """
    if override and override.strip():
        return override.strip()
    if settings.GOOGLE_REDIRECT_URI and settings.GOOGLE_REDIRECT_URI.strip():
        return settings.GOOGLE_REDIRECT_URI.strip()
    return f"{settings.FRONTEND_URL.rstrip('/')}/auth/google/callback"


@router.get("/google", response_model=dict)
def google_login(
    redirect_uri: Optional[str] = Query(None, description="Exact callback URI used by the browser. Must match Google Cloud console."),
    _db: Session = Depends(get_db),
):
    """Build the Google OAuth authorization URL using server-side env config.

    The redirect_uri is resolved from the browser (if supplied) or from
    GOOGLE_REDIRECT_URI / FRONTEND_URL environment variables. It is echoed back
    in the response so the exact URI to register in Google Cloud Console is never
    guessed.
    """
    if not settings.GOOGLE_CLIENT_ID:
        return {
            "configured": False,
            "message": "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend .env file.",
            "authorization_url": None,
            "redirect_uri": _google_redirect_uri(redirect_uri),
        }

    resolved_redirect_uri = _google_redirect_uri(redirect_uri)
    print(f"[GoogleOAuth] authorization URL requested | redirect_uri={resolved_redirect_uri}")

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": resolved_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "prompt": "select_account",
        "access_type": "online",
    }
    return {
        "configured": True,
        "authorization_url": f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}",
        "redirect_uri": resolved_redirect_uri,
    }


@router.post("/google/exchange", response_model=dict)
def google_exchange(req: dict, db: Session = Depends(get_db)):
    """Exchange the Google authorization code for tokens and log the user in.

    The verified Google email is matched against existing SprintIQ profiles.
    Known email -> login into the EXISTING account (role preserved, no duplicates).
    Unknown email -> explicit message, no auto-provisioning of any role.
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend .env file.",
        )

    code = req.get("code")
    redirect_uri = _google_redirect_uri(req.get("redirect_uri"))
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Google authorization code.")

    try:
        with httpx.Client(timeout=30.0) as client:
            token_resp = client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if token_resp.status_code != 200:
                # Log the real technical error for developers; never surface it to the user.
                print(f"[GoogleOAuth] token exchange failed | status={token_resp.status_code} | redirect_uri={redirect_uri} | body={token_resp.text[:400]}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google sign-in could not be completed. Please try again.",
                )
            tokens = token_resp.json()
            access_token = tokens.get("access_token")
            if not access_token:
                print(f"[GoogleOAuth] token response missing access_token | redirect_uri={redirect_uri}")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google sign-in could not be completed. Please try again.")

            userinfo_resp = client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if userinfo_resp.status_code != 200:
                print(f"[GoogleOAuth] userinfo request failed | status={userinfo_resp.status_code} | body={userinfo_resp.text[:300]}")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not verify your Google account.")
            userinfo = userinfo_resp.json()
    except HTTPException:
        raise
    except Exception as e:
        print(f"[GoogleOAuth] exchange exception | redirect_uri={redirect_uri} | error={e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Google sign-in service is temporarily unavailable.")

    google_email = (userinfo.get("email") or "").strip().lower()
    verified = userinfo.get("verified_email")
    if not google_email or verified is False:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your Google email could not be verified.")

    user = db.query(Profile).filter(Profile.email == google_email).first()
    if not user:
        return {
            "status": "no_account",
            "message": "Your Google account is authenticated, but no SprintIQ account is associated with this email. Please contact an administrator.",
        }
    if user.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your SprintIQ account is inactive. Please contact an administrator.")

    NotificationService.log_activity(
        db=db,
        user_id=user.id,
        action="GOOGLE_LOGIN",
        entity_type="USER",
        entity_id=user.id,
        details={"email": user.email, "portal": user.role.name.lower() if user.role else ""},
    )

    result = _issue_tokens(user)
    result["status"] = "success"
    result["message"] = "Google sign-in successful."
    return result