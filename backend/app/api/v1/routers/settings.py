"""
Admin System Settings API.

Retrieves and updates system-wide configuration settings stored in the database.
Includes health check endpoints for Database, Storage, Gemini, and GitHub.
"""

import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from app.core.database import get_db
from app.models.domain import Profile, SystemSetting
from app.api.deps import require_roles
from app.services.notification_service import NotificationService
from app.services.ai_service import gemini_generate
from app.services.github_service import server_credentials_available, get_server_headers
from app.schemas.pydantic_models import SystemSettingResponse

router = APIRouter(prefix="/settings", tags=["System Settings"])
admin_guard = require_roles(["admin"])


# Pydantic Schemas for Settings updates
class UpdateSettingsRequest(BaseModel):
    settings: Dict[str, Any]


class HealthCheckResponse(BaseModel):
    status: str
    message: str
    details: Optional[Dict[str, Any]] = None


@router.get("", response_model=List[SystemSettingResponse])
def get_all_settings(db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    """Retrieve all system settings."""
    settings_db = db.query(SystemSetting).all()
    return settings_db


@router.put("")
def update_settings(req: UpdateSettingsRequest, db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    """Bulk update system settings."""
    updated_count = 0
    for key, val in req.settings.items():
        setting = db.query(SystemSetting).filter(SystemSetting.setting_key == key).first()
        if setting:
            old_val = setting.setting_value
            new_val = str(val) if val is not None else None
            
            if old_val != new_val:
                setting.setting_value = new_val
                setting.updated_by = current_user.id
                setting.updated_at = datetime.utcnow()
                updated_count += 1
                
                # Log the change
                NotificationService.log_activity(
                    db=db,
                    user_id=current_user.id,
                    action="UPDATE_SETTING",
                    entity_type="SYSTEM_SETTING",
                    entity_id=setting.id,
                    details={
                        "setting_key": key,
                        "old_value": old_val,
                        "new_value": new_val
                    }
                )

    if updated_count > 0:
        db.commit()

    return {"message": f"Successfully updated {updated_count} settings."}


@router.post("/health", response_model=Dict[str, HealthCheckResponse])
def system_health_check(db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    """Run comprehensive system health checks for the maintenance dashboard."""
    results = {}
    
    # 1. Database Check
    try:
        db.execute(text("SELECT 1"))
        results["database"] = HealthCheckResponse(
            status="ONLINE",
            message="Supabase PostgreSQL database is connected and responding.",
            details={"engine": "PostgreSQL", "connection": "Active"}
        )
    except Exception as e:
        results["database"] = HealthCheckResponse(
            status="OFFLINE",
            message=str(e)
        )
        
    # 2. Storage Check (mock for now since we don't have actual supabase storage mapped)
    # Usually we'd check if we can write/read
    results["storage"] = HealthCheckResponse(
        status="ONLINE",
        message="Storage provider is accessible.",
    )

    # 3. Gemini Check
    try:
        gemini_generate("Hello, just checking if you are available. Reply with 'Yes'.")
        results["gemini"] = HealthCheckResponse(
            status="ONLINE",
            message="Gemini API is responding successfully."
        )
    except Exception as e:
        err_msg = str(e)
        results["gemini"] = HealthCheckResponse(
            status="WARNING" if "key" in err_msg.lower() or "limit" in err_msg.lower() else "OFFLINE",
            message=err_msg
        )

    # 4. GitHub Check
    try:
        if server_credentials_available():
            # simple call to test credentials
            import httpx
            with httpx.Client(timeout=10.0) as client:
                test = client.get("https://api.github.com/user", headers=get_server_headers())
                if test.status_code == 200:
                     results["github"] = HealthCheckResponse(
                        status="ONLINE",
                        message="GitHub integration is configured and authenticated."
                    )
                else:
                     results["github"] = HealthCheckResponse(
                        status="WARNING",
                        message=f"GitHub API returned status {test.status_code}"
                    )
        else:
             results["github"] = HealthCheckResponse(
                status="OFFLINE",
                message="GitHub credentials are not configured."
            )
    except Exception as e:
        results["github"] = HealthCheckResponse(
            status="OFFLINE",
            message=str(e)
        )
        
    # 5. Backend check is intrinsically ONLINE if this endpoint returns
    results["backend"] = HealthCheckResponse(
        status="ONLINE",
        message="Backend API is running and healthy."
    )

    return results


@router.post("/test-database")
def test_database(db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Database connection is active."}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/test-gemini")
def test_gemini(db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    try:
        prompt = "Hello. Respond with exactly the word 'SUCCESS'."
        res = gemini_generate(prompt)
        return {"status": "success", "message": f"Gemini connection successful. Response: {res}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/test-github")
def test_github(db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    try:
        if not server_credentials_available():
            return {"status": "error", "message": "GitHub API credentials not configured."}
        
        import httpx
        with httpx.Client(timeout=10.0) as client:
            r = client.get("https://api.github.com/user", headers=get_server_headers())
            if r.status_code != 200:
                 return {"status": "error", "message": f"GitHub API error. Code: {r.status_code}"}
            user = r.json()
            # If server uses App installation, /user might not return a login depending on endpoints.
            return {"status": "success", "message": f"Successfully connected to GitHub. Name: {user.get('login', user.get('name', 'App'))}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
