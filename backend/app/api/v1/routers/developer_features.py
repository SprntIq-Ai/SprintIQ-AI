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
    from app.models.domain import AIHistory
    existing_badges = db.query(DeveloperBadge).filter(DeveloperBadge.developer_id == current_user.id).all()
    existing_types = {b.badge_type for b in existing_badges}

    user_tasks = db.query(Task).filter(Task.assigned_developer_id == current_user.id).all()
    comp_tasks = [t for t in user_tasks if t.status in ["COMPLETED", "REVIEW_PENDING"]]
    bug_tasks = [t for t in user_tasks if "bug" in (t.title or "").lower() or "fix" in (t.title or "").lower() or t.priority == "URGENT"]
    ai_count = db.query(AIHistory).filter(AIHistory.user_id == current_user.id).count()
    focus_count = db.query(FocusSession).filter(FocusSession.developer_id == current_user.id).count()
    
    new_badges = []
    if "Sprint Hero" not in existing_types and (len(comp_tasks) > 0 or len(user_tasks) > 0):
        new_badges.append(DeveloperBadge(developer_id=current_user.id, badge_type="Sprint Hero", badge_title="Sprint Hero", description="Actively delivered user stories in sprint backlog", icon_name="Zap"))
    if "Bug Hunter" not in existing_types and len(bug_tasks) > 0:
        new_badges.append(DeveloperBadge(developer_id=current_user.id, badge_type="Bug Hunter", badge_title="Bug Hunter", description="Tackled critical defect fixes and high-priority bugs", icon_name="Bug"))
    if "AI Explorer" not in existing_types and ai_count > 0:
        new_badges.append(DeveloperBadge(developer_id=current_user.id, badge_type="AI Explorer", badge_title="AI Explorer", description="Leveraged Gemini AI intelligence copilot for engineering tasks", icon_name="Sparkles"))
    if "Deep Focus" not in existing_types and focus_count > 0:
        new_badges.append(DeveloperBadge(developer_id=current_user.id, badge_type="Deep Focus", badge_title="Deep Focus", description="Completed focused engineering sessions", icon_name="Star"))
    if "Team Player" not in existing_types and len(user_tasks) > 0:
        new_badges.append(DeveloperBadge(developer_id=current_user.id, badge_type="Team Player", badge_title="Team Player", description="Active contributor across team development repositories", icon_name="Trophy"))

    if new_badges:
        db.add_all(new_badges)
        db.commit()
        existing_badges.extend(new_badges)

    if not existing_badges:
        # Default badge for newly registered developer
        default_b = DeveloperBadge(developer_id=current_user.id, badge_type="Sprint Hero", badge_title="Sprint Hero", description="Assigned and actively working in engineering sprint", icon_name="Zap")
        db.add(default_b)
        db.commit()
        existing_badges = [default_b]

    return [
        {
            "id": b.id,
            "developer_id": b.developer_id,
            "badge_type": b.badge_type,
            "badge_title": b.badge_title,
            "description": b.description,
            "icon_name": b.icon_name,
            "unlocked_at": b.unlocked_at.isoformat() if b.unlocked_at else None
        }
        for b in existing_badges
    ]
