from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import uuid

from app.core.database import get_db
from app.models.domain import Profile, FocusSession, DeveloperBadge, Task
from app.schemas.pydantic_models import FocusSessionCreate, FocusSessionResponse, DeveloperBadgeResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/developer-features", tags=["Developer Features"])

@router.post("/focus-sessions")
def create_focus_session(req: FocusSessionCreate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    session = FocusSession(
        developer_id=current_user.id,
        task_id=req.task_id,
        duration_minutes=req.duration_minutes,
        status="COMPLETED",
        notes=req.notes or "Pomodoro focus sprint",
        started_at=datetime.utcnow() - timedelta(minutes=req.duration_minutes),
        ended_at=datetime.utcnow()
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.get("/focus-sessions")
def get_focus_sessions(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    sessions = db.query(FocusSession).filter(FocusSession.developer_id == current_user.id).order_by(FocusSession.started_at.desc()).all()
    return sessions

@router.get("/badges")
def get_developer_badges(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    badges = db.query(DeveloperBadge).filter(DeveloperBadge.developer_id == current_user.id).all()
    if not badges:
        # Seed default badges if not present
        default_badges = [
            DeveloperBadge(developer_id=current_user.id, badge_type="Sprint Hero", badge_title="Sprint Hero", description="Completed all assigned sprint stories on time", icon_name="Zap"),
            DeveloperBadge(developer_id=current_user.id, badge_type="Bug Hunter", badge_title="Bug Hunter", description="Resolved 5+ high-priority bug tasks", icon_name="Bug"),
            DeveloperBadge(developer_id=current_user.id, badge_type="AI Explorer", badge_title="AI Explorer", description="Used Gemini Copilot to generate 10+ code solutions", icon_name="Sparkles")
        ]
        db.add_all(default_badges)
        db.commit()
        badges = default_badges
    return badges
