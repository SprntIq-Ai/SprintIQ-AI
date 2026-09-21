from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date

from app.core.database import get_db
from app.models.domain import Sprint, Profile, Task, Project, ProjectMember
from app.schemas.pydantic_models import SprintCreate, SprintUpdate, SprintResponse
from app.api.deps import get_current_user
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/sprints", tags=["Sprints"])


def _parse_date(d):
    if d is None:
        return None
    if isinstance(d, date):
        return d
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, str):
        d_clean = d.strip().split("T")[0]
        # Format 1: YYYY-MM-DD
        try:
            return datetime.strptime(d_clean, "%Y-%m-%d").date()
        except Exception:
            pass
        # Format 2: DD-MM-YYYY
        try:
            return datetime.strptime(d_clean, "%d-%m-%Y").date()
        except Exception:
            pass
        # Format 3: MM/DD/YYYY, DD/MM/YYYY, YYYY/MM/DD
        for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(d_clean, fmt).date()
            except Exception:
                pass
    return None


def _enrich_sprint(sprint: Sprint, db: Session) -> dict:
    sprint_dict = {
        "id": str(sprint.id),
        "project_id": str(sprint.project_id) if sprint.project_id else None,
        "name": sprint.name,
        "goal": sprint.goal,
        "start_date": _parse_date(sprint.start_date) or sprint.start_date,
        "end_date": _parse_date(sprint.end_date) or sprint.end_date,
        "status": sprint.status,
        "created_at": sprint.created_at
    }

    tasks = db.query(Task).filter(Task.sprint_id == sprint.id).all()
    t_total = len(tasks)
    t_comp = sum(1 for t in tasks if t.status == "COMPLETED")
    t_rej = sum(1 for t in tasks if t.status == "REJECTED")

    # Weighted task progress percentage
    if t_total > 0:
        total_progress = sum(t.progress or 0 for t in tasks)
        avg_progress = round(total_progress / t_total, 1)
        progress_percentage = int(avg_progress)
    else:
        progress_percentage = 0

    sprint_dict["total_tasks"] = t_total
    sprint_dict["completed_tasks"] = t_comp
    sprint_dict["rejected_tasks"] = t_rej
    sprint_dict["progress_percentage"] = progress_percentage

    current_d = date.today()
    s_start = _parse_date(sprint.start_date)
    s_end = _parse_date(sprint.end_date)

    if sprint.status and sprint.status.upper() == "CANCELLED":
        derived = "CANCELLED"
    elif sprint.status and sprint.status.upper() == "COMPLETED":
        derived = "COMPLETED"
    elif t_total > 0 and t_comp == t_total:
        derived = "COMPLETED"
    elif s_start and current_d < s_start:
        derived = "PLANNED"
    elif s_end and current_d > s_end:
        derived = "OVERDUE"
    else:
        derived = "ACTIVE"
        
    sprint_dict["derived_status"] = derived
    return sprint_dict


def get_accessible_project_ids(db: Session, user: Profile) -> List[str]:
    role_name = user.role.name.lower() if user.role else "developer"
    if role_name == "admin":
        return [p.id for p in db.query(Project.id).all()]
    if role_name == "manager":
        managed = {p.id for p in db.query(Project.id).filter(Project.manager_id == user.id).all()}
        memberships = {
            m.project_id for m in db.query(ProjectMember.project_id).filter(
                ProjectMember.user_id == user.id,
                ProjectMember.role_in_project.in_(["MANAGER", "manager"])
            ).all()
        }
        return list(managed | memberships)
    # developer
    member_projects = {
        m.project_id for m in db.query(ProjectMember.project_id).filter(ProjectMember.user_id == user.id).all()
    }
    task_projects = {
        t.project_id for t in db.query(Task.project_id).filter(Task.assigned_developer_id == user.id).all() if t.project_id
    }
    return list(member_projects | task_projects)


@router.get("", response_model=List[SprintResponse])
def get_sprints(project_id: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    accessible_ids = get_accessible_project_ids(db, current_user)
    
    query = db.query(Sprint)
    if project_id:
        if project_id not in accessible_ids:
            role_name = current_user.role.name.lower() if current_user.role else ""
            if role_name != "admin":
                raise HTTPException(status_code=403, detail="You do not have access to sprints for this project.")
        query = query.filter(Sprint.project_id == project_id)
    else:
        query = query.filter(Sprint.project_id.in_(accessible_ids))
    
    sprints = query.order_by(Sprint.created_at.desc()).all()
    return [_enrich_sprint(s, db) for s in sprints]


@router.post("", response_model=SprintResponse, status_code=status.HTTP_201_CREATED)
def create_sprint(req: SprintCreate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    role_name = current_user.role.name.lower() if current_user.role else ""
    if role_name not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only Admins and Project Managers can create sprints.")

    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Target Project not found.")

    if role_name == "manager":
        accessible_ids = get_accessible_project_ids(db, current_user)
        if req.project_id not in accessible_ids:
            raise HTTPException(status_code=403, detail="You do not have management permission for the selected project.")

    s_start = _parse_date(req.start_date)
    s_end = _parse_date(req.end_date)
    if not s_start:
        raise HTTPException(status_code=400, detail="Start date is required and must be a valid date format (e.g. YYYY-MM-DD or DD-MM-YYYY).")
    if not s_end:
        raise HTTPException(status_code=400, detail="End date is required and must be a valid date format (e.g. YYYY-MM-DD or DD-MM-YYYY).")
    if s_end < s_start:
        raise HTTPException(status_code=400, detail="End date must be on or after start date.")

    sprint = Sprint(
        project_id=req.project_id,
        name=req.name.strip(),
        goal=req.goal.strip() if req.goal else None,
        start_date=s_start,
        end_date=s_end,
        status="ACTIVE" if (s_start and s_start <= date.today()) else "PLANNED"
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

    role_name = current_user.role.name.lower() if current_user.role else ""
    if role_name not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only Admins and Project Managers can modify sprints.")

    if req.name is not None: sprint.name = req.name.strip()
    if req.goal is not None: sprint.goal = req.goal.strip()
    if req.start_date is not None: sprint.start_date = _parse_date(req.start_date)
    if req.end_date is not None: sprint.end_date = _parse_date(req.end_date)
    if req.status is not None: sprint.status = req.status.upper()

    db.commit()
    db.refresh(sprint)
    return _enrich_sprint(sprint, db)
