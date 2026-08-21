from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid

from app.core.database import get_db
from app.models.domain import (
    Profile, Role, Project, Task, ProjectMember, ProjectInvitation, ActivityLog, AIHistory,
    ProjectHealth, MeetingMinutes, RiskPrediction, AIReport, TeamVelocity, ActivityTimeline,
    MLPrediction, AIInsight, AIRecommendation, GitHubRepository, EngineeringMetrics,
    DeveloperMetrics, SprintRetrospective, ProjectSimulation, ReleaseReadiness, FocusSession
)
from app.schemas.pydantic_models import (
    ProjectCreate, ProjectUpdate, ProjectResponse, InviteManagerRequest, ProjectInvitationResponse, ProfileResponse
)
from app.api.deps import require_roles
from app.services.notification_service import NotificationService
from app.services.ai_service import AIService

router = APIRouter(prefix="/admin", tags=["Admin Portal"])

# Dependency guard requiring admin role
admin_guard = require_roles(["admin"])

def sync_project_manager_membership(db: Session, project: Project) -> None:
    """Keeps projects.manager_id and the project_members MANAGER row in sync.

    Ensures exactly one MANAGER membership exists for the current manager and
    removes stale MANAGER memberships so a replaced manager loses project
    visibility (strict project isolation).
    """
    if project.manager_id:
        db.query(ProjectMember).filter(
            ProjectMember.project_id == project.id,
            ProjectMember.role_in_project == "MANAGER",
            ProjectMember.user_id != project.manager_id
        ).delete(synchronize_session=False)
        existing = db.query(ProjectMember).filter(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == project.manager_id,
            ProjectMember.role_in_project == "MANAGER"
        ).first()
        if not existing:
            db.add(ProjectMember(
                project_id=project.id,
                user_id=project.manager_id,
                role_in_project="MANAGER",
                team="Engineering Management"
            ))
    else:
        db.query(ProjectMember).filter(
            ProjectMember.project_id == project.id,
            ProjectMember.role_in_project == "MANAGER"
        ).delete(synchronize_session=False)

@router.get("/dashboard")
def get_admin_dashboard(db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    total_projects = db.query(Project).count()
    
    manager_role = db.query(Role).filter(Role.name == "manager").first()
    dev_role = db.query(Role).filter(Role.name == "developer").first()
    
    total_managers = db.query(Profile).filter(Profile.role_id == manager_role.id).count() if manager_role else 0
    total_devs = db.query(Profile).filter(Profile.role_id == dev_role.id).count() if dev_role else 0
    
    total_tasks = db.query(Task).count()
    completed_tasks = db.query(Task).filter(Task.status == "COMPLETED").count()
    pending_tasks = db.query(Task).filter(Task.status.in_(["NOT_STARTED", "IN_PROGRESS", "TESTING", "REVIEW_PENDING"])).count()
    delayed_tasks = db.query(Task).filter(Task.due_date < datetime.utcnow().date(), Task.status != "COMPLETED").count()
    
    avg_completion = (completed_tasks / max(total_tasks, 1)) * 100
    
    projects = db.query(Project).all()
    avg_risk = sum(p.ai_risk_score for p in projects) / max(len(projects), 1) if projects else 15.4

    # Chart datasets
    project_status_chart = [
        {"name": "Planning", "value": db.query(Project).filter(Project.status == "PLANNING").count()},
        {"name": "Active", "value": db.query(Project).filter(Project.status == "ACTIVE").count()},
        {"name": "Completed", "value": db.query(Project).filter(Project.status == "COMPLETED").count()},
        {"name": "Archived", "value": db.query(Project).filter(Project.status == "ARCHIVED").count()},
    ]

    task_dist_chart = [
        {"name": "Not Started", "count": db.query(Task).filter(Task.status == "NOT_STARTED").count()},
        {"name": "In Progress", "count": db.query(Task).filter(Task.status == "IN_PROGRESS").count()},
        {"name": "Testing", "count": db.query(Task).filter(Task.status == "TESTING").count()},
        {"name": "Review Pending", "count": db.query(Task).filter(Task.status == "REVIEW_PENDING").count()},
        {"name": "Completed", "count": db.query(Task).filter(Task.status == "COMPLETED").count()},
    ]

    recent_activities = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(10).all()
    
    activity_items = []
    for act in recent_activities:
        user = db.query(Profile).filter(Profile.id == act.user_id).first() if act.user_id else None
        activity_items.append({
            "id": act.id,
            "user_name": user.full_name if user else "System",
            "action": act.action,
            "entity_type": act.entity_type,
            "created_at": act.created_at
        })

    return {
        "metrics": {
            "total_projects": total_projects,
            "total_managers": total_managers,
            "total_developers": total_devs,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "delayed_tasks": delayed_tasks,
            "project_completion_rate": round(avg_completion, 1),
            "ai_risk_score": round(avg_risk, 1)
        },
        "charts": {
            "project_status": project_status_chart,
            "task_distribution": task_dist_chart,
        },
        "recent_activities": activity_items
    }

@router.get("/projects", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    res = []
    for p in projects:
        manager = db.query(Profile).filter(Profile.id == p.manager_id).first() if p.manager_id else None
        total = db.query(Task).filter(Task.project_id == p.id).count()
        comp = db.query(Task).filter(Task.project_id == p.id, Task.status == "COMPLETED").count()
        dev_count = db.query(ProjectMember).filter(
            ProjectMember.project_id == p.id,
            ProjectMember.role_in_project.in_(["DEVELOPER", "developer"])
        ).count()

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
            completed_tasks=comp,
            developers_count=dev_count
        ))
    return res

@router.post("/projects", response_model=ProjectResponse)
def create_project(req: ProjectCreate, db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    existing = db.query(Project).filter(Project.key == req.key.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project key already exists")

    if req.manager_id:
        manager = db.query(Profile).filter(Profile.id == req.manager_id).first()
        if not manager:
            raise HTTPException(status_code=404, detail="Selected project manager was not found.")
        mgr_role = db.query(Role).filter(Role.name == "manager").first()
        if not mgr_role or manager.role_id != mgr_role.id:
            raise HTTPException(status_code=400, detail="Selected user is not a Project Manager")

    project = Project(
        name=req.name,
        key=req.key.upper(),
        description=req.description,
        start_date=req.start_date,
        target_date=req.target_date,
        manager_id=req.manager_id,
        created_by=current_user.id,
        status="ACTIVE"
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    if req.manager_id:
        sync_project_manager_membership(db, project)

        NotificationService.create_notification(
            db=db,
            user_id=req.manager_id,
            title="New Project Assigned",
            message=f"{project.name} has been assigned to you.",
            notification_type="SUCCESS",
            link=f"/manager/projects"
        )

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action="CREATE_PROJECT",
        entity_type="PROJECT",
        entity_id=project.id,
        details={"name": project.name, "key": project.key, "manager_id": req.manager_id}
    )

    return ProjectResponse(
        id=project.id,
        name=project.name,
        key=project.key,
        description=project.description,
        status=project.status,
        start_date=project.start_date,
        target_date=project.target_date,
        manager_id=project.manager_id,
        manager_name=db.query(Profile).filter(Profile.id == project.manager_id).first().full_name if project.manager_id else None,
        ai_risk_score=project.ai_risk_score,
        health_status=project.health_status,
        created_at=project.created_at,
        updated_at=project.updated_at
    )

@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, req: ProjectUpdate, db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if req.name is not None: project.name = req.name
    if req.description is not None: project.description = req.description
    if req.status is not None: project.status = req.status
    if req.start_date is not None: project.start_date = req.start_date
    if req.target_date is not None: project.target_date = req.target_date
    if req.ai_risk_score is not None: project.ai_risk_score = req.ai_risk_score
    if req.health_status is not None: project.health_status = req.health_status

    manager_changed = False
    if req.manager_id is not None and req.manager_id != project.manager_id:
        manager = db.query(Profile).filter(Profile.id == req.manager_id).first()
        if not manager:
            raise HTTPException(status_code=404, detail="Selected project manager was not found.")
        mgr_role = db.query(Role).filter(Role.name == "manager").first()
        if not mgr_role or manager.role_id != mgr_role.id:
            raise HTTPException(status_code=400, detail="Selected user is not a Project Manager")
        project.manager_id = req.manager_id
        # Persist Manager <-> Project relationship in project_members and remove
        # the previous manager's MANAGER membership so the old manager no longer
        # sees this project (project isolation).
        sync_project_manager_membership(db, project)
        manager_changed = True

    db.commit()
    db.refresh(project)

    if manager_changed:
        NotificationService.create_notification(
            db=db,
            user_id=req.manager_id,
            title="New Project Assigned",
            message=f"{project.name} has been assigned to you.",
            notification_type="SUCCESS",
            link=f"/manager/projects"
        )
        NotificationService.log_activity(
            db=db,
            user_id=current_user.id,
            action="ASSIGN_PROJECT_MANAGER",
            entity_type="PROJECT",
            entity_id=project.id,
            details={"manager_id": req.manager_id, "project_name": project.name}
        )

    return ProjectResponse(
        id=project.id,
        name=project.name,
        key=project.key,
        description=project.description,
        status=project.status,
        start_date=project.start_date,
        target_date=project.target_date,
        manager_id=project.manager_id,
        ai_risk_score=project.ai_risk_score,
        health_status=project.health_status,
        created_at=project.created_at,
        updated_at=project.updated_at
    )

@router.delete("/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        # Null out FocusSession references to this project's tasks (task FK is SET NULL)
        task_ids = [t.id for t in project.tasks]
        if task_ids:
            db.query(FocusSession).filter(FocusSession.task_id.in_(task_ids)).update(
                {"task_id": None}, synchronize_session=False
            )

        # Remove project-related records explicitly (SQLite does not enforce DB-level
        # CASCADEs, so delete every table that references projects.id). Users and the
        # actual GitHub repositories are NOT touched - only the SprintIQ mapping row.
        for model in (
            GitHubRepository, EngineeringMetrics, DeveloperMetrics, ProjectHealth,
            RiskPrediction, MLPrediction, AIInsight, AIRecommendation, TeamVelocity,
            ActivityTimeline, MeetingMinutes, AIReport, SprintRetrospective,
            ProjectSimulation, ReleaseReadiness, ProjectInvitation,
        ):
            db.query(model).filter(model.project_id == project_id).delete(synchronize_session=False)

        # ORM cascade removes sprints, tasks (with attachments/progress/comments) and
        # project members.
        db.delete(project)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to delete project. Please resolve the related project records and try again.")

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action="DELETE_PROJECT",
        entity_type="PROJECT",
        entity_id=project_id,
        details={"name": project.name}
    )
    return {"message": "Project deleted successfully."}

@router.post("/invite-manager", response_model=ProjectInvitationResponse)
def invite_project_manager(req: InviteManagerRequest, db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    if req.is_existing_manager:
        manager = db.query(Profile).filter(Profile.id == req.manager_id).first()
        if not manager:
            raise HTTPException(status_code=404, detail="Selected project manager was not found.")
        mgr_role = db.query(Role).filter(Role.name == "manager").first()
        if not mgr_role or manager.role_id != mgr_role.id:
            raise HTTPException(status_code=400, detail="Selected user is not a Project Manager")

        target_project_id = req.project_id
        if target_project_id:
            project = db.query(Project).filter(Project.id == target_project_id).first()
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            project.manager_id = manager.id
            # Persist the manager relationship and remove any stale MANAGER
            # membership from a previously assigned manager (isolation).
            sync_project_manager_membership(db, project)
            db.commit()
            db.refresh(project)

        NotificationService.create_notification(
            db=db,
            user_id=manager.id,
            title="New Project Assigned",
            message=f"You have been assigned to project '{project.name}' as a Project Manager." if target_project_id else "You have been added as a Project Manager.",
            notification_type="SUCCESS",
            link=f"/manager/projects"
        )
        NotificationService.log_activity(
            db=db,
            user_id=current_user.id,
            action="ASSIGN_EXISTING_MANAGER",
            entity_type="USER",
            entity_id=manager.id,
            details={"manager_id": manager.id, "project_id": target_project_id}
        )
        return ProjectInvitationResponse(
            id=str(uuid.uuid4()),
            email=manager.email,
            full_name=manager.full_name,
            role="manager",
            project_id=target_project_id,
            team=req.team or "Engineering Management",
            token="",
            status="ASSIGNED",
            expires_at=datetime.utcnow() + timedelta(days=7),
            created_at=datetime.utcnow()
        )

    if not req.email or not req.full_name:
        raise HTTPException(status_code=400, detail="Either manager_id or both email and full_name must be provided.")

    token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=7)

    invite = ProjectInvitation(
        email=req.email,
        full_name=req.full_name,
        phone=req.phone,
        role="manager",
        project_id=req.project_id,
        team=req.team or "Engineering Management",
        token=token,
        status="PENDING",
        invited_by=current_user.id,
        expires_at=expires_at
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    invite_url = f"/register/accept-invite?token={token}"
    body = (
        f"Hello {req.full_name},\n\n"
        f"You have been invited by Admin to join SprintIQ AI as a Project Manager.\n"
        f"Click the link below to set up your account:\n{invite_url}\n\n"
        f"Token: {token}"
    )
    NotificationService.send_email_simulation(db, req.email, "SprintIQ AI — Project Manager Invitation", body)

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action="INVITE_MANAGER",
        entity_type="USER",
        entity_id=invite.id,
        details={"email": req.email, "project_id": req.project_id}
    )

    return invite

@router.get("/users")
def get_all_users(role: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    query = db.query(Profile)
    if role:
        r_obj = db.query(Role).filter(Role.name == role.lower()).first()
        if r_obj:
            query = query.filter(Profile.role_id == r_obj.id)
    
    users = query.order_by(Profile.created_at.desc()).all()
    res = []
    for u in users:
        res.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "phone": u.phone,
            "avatar_url": u.avatar_url,
            "role": u.role.name.lower() if u.role else "user",
            "status": u.status,
            "created_at": u.created_at
        })
    return res

@router.put("/users/{user_id}/status")
def toggle_user_status(user_id: str, status_val: str = Query(...), db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.status = status_val.upper()
    db.commit()
    return {"message": f"User status updated to {user.status}"}

@router.get("/activity-logs")
def get_activity_logs(db: Session = Depends(get_db), current_user: Profile = Depends(admin_guard)):
    logs = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(100).all()
    res = []
    for l in logs:
        u = db.query(Profile).filter(Profile.id == l.user_id).first() if l.user_id else None
        res.append({
            "id": l.id,
            "user_name": u.full_name if u else "System",
            "user_email": u.email if u else "N/A",
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "details": l.details,
            "created_at": l.created_at
        })
    return res
