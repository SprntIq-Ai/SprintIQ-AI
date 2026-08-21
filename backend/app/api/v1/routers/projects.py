from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.domain import Project, Profile, Task, Sprint, ProjectMember
from app.schemas.pydantic_models import ProjectResponse, ProjectCreate, ProjectUpdate
from app.api.deps import get_current_user

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("", response_model=List[ProjectResponse])
def get_user_projects(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    user_role = current_user.role.name.lower()
    if user_role == "admin":
        projects = db.query(Project).order_by(Project.created_at.desc()).all()
    elif user_role == "manager":
        managed_ids = {p.id for p in db.query(Project).filter(Project.manager_id == current_user.id).all()}
        membership_ids = {
            m.project_id for m in db.query(ProjectMember).filter(
                ProjectMember.user_id == current_user.id,
                ProjectMember.role_in_project == "MANAGER"
            ).all()
        }
        ids = managed_ids | membership_ids
        projects = db.query(Project).filter(Project.id.in_(ids)).order_by(Project.created_at.desc()).all() if ids else []
    else: # developer
        memberships = db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()
        p_ids = [m.project_id for m in memberships]
        projects = db.query(Project).filter(Project.id.in_(p_ids)).order_by(Project.created_at.desc()).all() if p_ids else []

    res = []
    for p in projects:
        manager = db.query(Profile).filter(Profile.id == p.manager_id).first() if p.manager_id else None
        total = db.query(Task).filter(Task.project_id == p.id).count()
        comp = db.query(Task).filter(Task.project_id == p.id, Task.status == "COMPLETED").count()

        res.append(ProjectResponse(
            id=p.id,
            name=p.name,
            key=p.key,
            description=p.description,
            status=p.status,
            start_date=p.start_date,
            target_date=p.target_date,
            manager_id=p.manager_id,
            manager_name=manager.full_name if manager else "Unassigned",
            ai_risk_score=p.ai_risk_score,
            health_status=p.health_status,
            created_at=p.created_at,
            updated_at=p.updated_at,
            total_tasks=total,
            completed_tasks=comp
        ))
    return res

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project_by_id(project_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_role = current_user.role.name.lower()
    if user_role == "admin":
        pass
    elif user_role == "manager":
        is_owner = project.manager_id == current_user.id
        membership = db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id,
            ProjectMember.role_in_project == "MANAGER"
        ).first()
        if not is_owner and not membership:
            raise HTTPException(status_code=403, detail="Access denied: You are not assigned to this project")
    else:  # developer
        membership = db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Access denied: You are not a member of this project")

    manager = db.query(Profile).filter(Profile.id == project.manager_id).first() if project.manager_id else None
    total = db.query(Task).filter(Task.project_id == project.id).count()
    comp = db.query(Task).filter(Task.project_id == project.id, Task.status == "COMPLETED").count()

    return ProjectResponse(
        id=project.id,
        name=project.name,
        key=project.key,
        description=project.description,
        status=project.status,
        start_date=project.start_date,
        target_date=project.target_date,
        manager_id=project.manager_id,
        manager_name=manager.full_name if manager else "Unassigned",
        ai_risk_score=project.ai_risk_score,
        health_status=project.health_status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        total_tasks=total,
        completed_tasks=comp
    )
