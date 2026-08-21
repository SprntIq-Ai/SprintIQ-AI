from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.domain import Sprint, Profile, Task
from app.schemas.pydantic_models import SprintCreate, SprintUpdate, SprintResponse
from app.api.deps import get_current_user
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/sprints", tags=["Sprints"])

from datetime import date

def _enrich_sprint(sprint: Sprint, db: Session) -> dict:
    sprint_dict = {
        "id": sprint.id,
        "project_id": sprint.project_id,
        "name": sprint.name,
        "goal": sprint.goal,
        "start_date": sprint.start_date,
        "end_date": sprint.end_date,
        "status": sprint.status,
        "created_at": sprint.created_at
    }

    tasks = db.query(Task).filter(Task.sprint_id == sprint.id).all()
    t_total = len(tasks)
    t_comp = sum(1 for t in tasks if t.status == "COMPLETED" and t.reviewed_at is not None)
    t_rej = sum(1 for t in tasks if t.status == "REJECTED")

    sprint_dict["total_tasks"] = t_total
    sprint_dict["completed_tasks"] = t_comp
    sprint_dict["rejected_tasks"] = t_rej
    sprint_dict["progress_percentage"] = int((t_comp / t_total) * 100) if t_total > 0 else 0

    current_d = date.today()
    if sprint.status.upper() == "CANCELLED":
        derived = "CANCELLED"
    elif t_total > 0 and t_comp == t_total:
        derived = "COMPLETED"
    elif current_d < sprint.start_date:
        derived = "PLANNED"
    elif current_d > sprint.end_date:
        derived = "OVERDUE"
    else:
        derived = "ACTIVE"
        
    sprint_dict["derived_status"] = derived
    return sprint_dict

@router.get("", response_model=List[SprintResponse])
def get_sprints(project_id: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    query = db.query(Sprint)
    if project_id:
        query = query.filter(Sprint.project_id == project_id)
    
    sprints = query.order_by(Sprint.created_at.desc()).all()
    return [_enrich_sprint(s, db) for s in sprints]

@router.post("", response_model=SprintResponse)
def create_sprint(req: SprintCreate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    sprint = Sprint(
        project_id=req.project_id,
        name=req.name,
        goal=req.goal,
        start_date=req.start_date,
        end_date=req.end_date,
        status="PLANNED"
    )
    db.add(sprint)
    db.commit()
    db.refresh(sprint)

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action="CREATE_SPRINT",
        entity_type="SPRINT",
        entity_id=sprint.id,
        details={"name": sprint.name}
    )
    return _enrich_sprint(sprint, db)

@router.put("/{sprint_id}", response_model=SprintResponse)
def update_sprint(sprint_id: str, req: SprintUpdate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    if req.name is not None: sprint.name = req.name
    if req.goal is not None: sprint.goal = req.goal
    if req.start_date is not None: sprint.start_date = req.start_date
    if req.end_date is not None: sprint.end_date = req.end_date
    if req.status is not None: sprint.status = req.status.upper()

    db.commit()
    db.refresh(sprint)
    return _enrich_sprint(sprint, db)
