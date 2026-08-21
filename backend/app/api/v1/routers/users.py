"""
User account management endpoints.

Admin  → create / list / edit / status-toggle PROJECT MANAGERS
Manager → create / list / edit / status-toggle DEVELOPERS

All accounts persist in the existing `profiles` table, use bcrypt password
hashing, and are immediately available in every selector that queries the
database (task assignment, project assignment, etc.).
"""

import re
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.domain import Profile, Role
from app.api.deps import require_roles
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/users", tags=["User Account Management"])

admin_guard = require_roles(["admin"])
manager_guard = require_roles(["manager"])


# ---------------------------------------------------------------------------
# Pydantic schemas (local to this router; keeps pydantic_models.py tidy)
# ---------------------------------------------------------------------------

class CreateUserRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    bio: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    new_password: str
    confirm_password: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_password(pw: str) -> None:
    if len(pw) < 8:
        raise HTTPException(400, detail="Password must be at least 8 characters.")
    if not re.search(r"[A-Z]", pw):
        raise HTTPException(400, detail="Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", pw):
        raise HTTPException(400, detail="Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", pw):
        raise HTTPException(400, detail="Password must contain at least one number.")


def _serialize_user(u: Profile) -> Dict[str, Any]:
    return {
        "id": u.id,
        "full_name": u.full_name,
        "email": u.email,
        "phone": u.phone,
        "role": u.role.name.lower() if u.role else "",
        "status": u.status,
        "bio": u.bio,
        "avatar_url": u.avatar_url,
        "created_at": u.created_at,
    }


def _create_user(
    db: Session,
    req: CreateUserRequest,
    target_role_name: str,
    current_user: Profile,
) -> Dict[str, Any]:
    # Validation
    if not req.full_name or not req.full_name.strip():
        raise HTTPException(400, detail="Full name is required.")
    if req.password != req.confirm_password:
        raise HTTPException(400, detail="Password confirmation does not match.")
    _validate_password(req.password)

    # Uniqueness
    existing = db.query(Profile).filter(Profile.email == req.email).first()
    if existing:
        raise HTTPException(400, detail="Email already exists.")

    role = db.query(Role).filter(Role.name == target_role_name).first()
    if not role:
        raise HTTPException(500, detail=f"Role '{target_role_name}' is not configured in the system.")

    user = Profile(
        email=req.email.strip().lower(),
        password_hash=get_password_hash(req.password),
        full_name=req.full_name.strip(),
        role_id=role.id,
        status="ACTIVE",
    )
    db.add(user)
    db.flush()

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action=f"CREATE_{target_role_name.upper()}",
        entity_type="USER",
        entity_id=user.id,
        details={"email": user.email, "role": target_role_name, "created_by": current_user.email},
    )
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


def _list_users(db: Session, target_role_name: str, search: Optional[str] = None, status_filter: Optional[str] = None):
    role = db.query(Role).filter(Role.name == target_role_name).first()
    if not role:
        return []
    q = db.query(Profile).filter(Profile.role_id == role.id)
    if status_filter and status_filter.upper() in ("ACTIVE", "INACTIVE"):
        q = q.filter(Profile.status == status_filter.upper())
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        q = q.filter(
            (Profile.full_name.ilike(term)) | (Profile.email.ilike(term))
        )
    users = q.order_by(Profile.created_at.desc()).all()
    return [_serialize_user(u) for u in users]


def _update_user(db: Session, user_id: str, req: UpdateUserRequest, target_role_name: str, current_user: Profile):
    role = db.query(Role).filter(Role.name == target_role_name).first()
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found.")
    if role and user.role_id != role.id:
        raise HTTPException(403, detail=f"User is not a {target_role_name}.")

    if req.full_name is not None:
        user.full_name = req.full_name.strip()
    if req.email is not None:
        dup = db.query(Profile).filter(Profile.email == req.email, Profile.id != user_id).first()
        if dup:
            raise HTTPException(400, detail="Email already exists.")
        user.email = req.email.strip().lower()
    if req.phone is not None:
        user.phone = req.phone
    if req.bio is not None:
        user.bio = req.bio

    db.commit()
    db.refresh(user)

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action=f"UPDATE_{target_role_name.upper()}",
        entity_type="USER",
        entity_id=user.id,
        details={"email": user.email, "role": target_role_name},
    )
    return _serialize_user(user)


def _toggle_status(db: Session, user_id: str, new_status: str, target_role_name: str, current_user: Profile):
    role = db.query(Role).filter(Role.name == target_role_name).first()
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found.")
    if role and user.role_id != role.id:
        raise HTTPException(403, detail=f"User is not a {target_role_name}.")
    if new_status.upper() not in ("ACTIVE", "INACTIVE"):
        raise HTTPException(400, detail="Status must be ACTIVE or INACTIVE.")

    user.status = new_status.upper()
    db.commit()

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action=f"TOGGLE_{target_role_name.upper()}_STATUS",
        entity_type="USER",
        entity_id=user.id,
        details={"new_status": user.status, "email": user.email},
    )
    return {"message": f"Account status updated to {user.status}."}


def _reset_password(db: Session, user_id: str, req: ResetPasswordRequest, target_role_name: str, current_user: Profile):
    role = db.query(Role).filter(Role.name == target_role_name).first()
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found.")
    if role and user.role_id != role.id:
        raise HTTPException(403, detail=f"User is not a {target_role_name}.")
    if req.new_password != req.confirm_password:
        raise HTTPException(400, detail="Password confirmation does not match.")
    _validate_password(req.new_password)

    user.password_hash = get_password_hash(req.new_password)
    db.commit()

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action=f"RESET_{target_role_name.upper()}_PASSWORD",
        entity_type="USER",
        entity_id=user.id,
        details={"email": user.email},
    )
    return {"message": "Password has been reset successfully."}


# =========================================================================
# MANAGER ACCOUNTS (Admin only)
# =========================================================================

@router.post("/managers")
def create_manager(req: CreateUserRequest, db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    """Create a new Project Manager account (Admin only)."""
    return _create_user(db, req, "manager", current_user)


@router.get("/managers")
def list_managers(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(admin_guard),
):
    """List all Project Manager accounts (Admin only)."""
    return _list_users(db, "manager", search, status)


@router.put("/managers/{user_id}")
def update_manager(user_id: str, req: UpdateUserRequest, db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    """Edit a Project Manager account (Admin only)."""
    return _update_user(db, user_id, req, "manager", current_user)


@router.patch("/managers/{user_id}/status")
def toggle_manager_status(user_id: str, status_val: str = Query(...), db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    """Enable / disable a Project Manager account (Admin only)."""
    return _toggle_status(db, user_id, status_val, "manager", current_user)


@router.post("/managers/{user_id}/reset-password")
def reset_manager_password(user_id: str, req: ResetPasswordRequest, db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    """Reset a Project Manager's password (Admin only)."""
    return _reset_password(db, user_id, req, "manager", current_user)


# =========================================================================
# DEVELOPER ACCOUNTS (Manager only)
# =========================================================================

@router.post("/developers")
def create_developer(req: CreateUserRequest, db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    """Create a new Developer account (Manager only)."""
    return _create_user(db, req, "developer", current_user)


@router.get("/developers")
def list_developers(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(manager_guard),
):
    """List all Developer accounts (Manager only)."""
    return _list_users(db, "developer", search, status)


@router.put("/developers/{user_id}")
def update_developer(user_id: str, req: UpdateUserRequest, db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    """Edit a Developer account (Manager only)."""
    return _update_user(db, user_id, req, "developer", current_user)


@router.patch("/developers/{user_id}/status")
def toggle_developer_status(user_id: str, status_val: str = Query(...), db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    """Enable / disable a Developer account (Manager only)."""
    return _toggle_status(db, user_id, status_val, "developer", current_user)


@router.post("/developers/{user_id}/reset-password")
def reset_developer_password(user_id: str, req: ResetPasswordRequest, db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    """Reset a Developer's password (Manager only)."""
    return _reset_password(db, user_id, req, "developer", current_user)
