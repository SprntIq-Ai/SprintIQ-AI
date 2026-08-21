from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid

from app.core.database import get_db
from app.models.domain import (
    Profile, Role, Project, Sprint, Task, ProjectMember, ProjectInvitation, TaskProgress, Comment, ActivityLog, TaskAttachment
)
from app.schemas.pydantic_models import (
    SprintCreate, SprintUpdate, SprintResponse, TaskCreate, TaskUpdate, TaskResponse,
    InviteDeveloperRequest, DeveloperAssignRequest, ProjectInvitationResponse, TaskReviewRequest
)
from app.api.deps import require_roles
from app.services.notification_service import NotificationService
from app.services.ai_service import AIService

router = APIRouter(prefix="/manager", tags=["Project Manager Portal"])

# Dependency guard requiring manager role
manager_guard = require_roles(["manager"])

def get_manager_projects(db: Session, manager_id: str) -> List[Project]:
    # Projects where user is manager_id OR listed in project_members with MANAGER role
    managed = db.query(Project).filter(Project.manager_id == manager_id).all()
    memberships = db.query(ProjectMember).filter(
        ProjectMember.user_id == manager_id,
        ProjectMember.role_in_project == "MANAGER"
    ).all()
    project_ids = {p.id for p in managed} | {m.project_id for m in memberships}
    if not project_ids:
        return []
    return db.query(Project).filter(Project.id.in_(project_ids)).order_by(Project.created_at.desc()).all()

def is_project_manager(db: Session, user_id: str, project_id: str) -> bool:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return False
    if project.manager_id == user_id:
        return True
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
        ProjectMember.role_in_project == "MANAGER"
    ).first()
    return membership is not None

def serialize_project(db: Session, p: Project) -> Dict[str, Any]:
    manager = db.query(Profile).filter(Profile.id == p.manager_id).first() if p.manager_id else None
    total = db.query(Task).filter(Task.project_id == p.id).count()
    comp = db.query(Task).filter(Task.project_id == p.id, Task.status == "COMPLETED").count()
    dev_count = db.query(ProjectMember).filter(
        ProjectMember.project_id == p.id,
        ProjectMember.role_in_project.in_(["DEVELOPER", "developer"])
    ).count()
    return {
        "id": p.id,
        "name": p.name,
        "key": p.key,
        "description": p.description,
        "status": p.status,
        "start_date": p.start_date,
        "target_date": p.target_date,
        "manager_id": p.manager_id,
        "manager_name": manager.full_name if manager else "Unassigned",
        "ai_risk_score": p.ai_risk_score,
        "health_status": p.health_status,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "total_tasks": total,
        "completed_tasks": comp,
        "developers_count": dev_count
    }

@router.get("/projects")
def get_assigned_projects(db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    projects = get_manager_projects(db, current_user.id)
    # Safe development logging - never log passwords/tokens
    print(f"[ManagerProjects] authenticated_user_id={current_user.id} manager_id={current_user.id} number_of_projects={len(projects)}")
    return [serialize_project(db, p) for p in projects]

@router.get("/developers")
def get_manager_developers(db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    # All active developer accounts that a Project Manager may assign tasks to.
    dev_role = db.query(Role).filter(Role.name == "developer").first()
    if not dev_role:
        return []
    developers = db.query(Profile).filter(
        Profile.role_id == dev_role.id,
        Profile.status == "ACTIVE"
    ).order_by(Profile.full_name.asc()).all()
    return [
        {
            "id": d.id,
            "email": d.email,
            "full_name": d.full_name,
            "phone": d.phone,
            "role": "developer",
            "status": d.status,
            "created_at": d.created_at
        }
        for d in developers
    ]

@router.get("/dashboard")
def get_manager_dashboard(project_id: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    projects = get_manager_projects(db, current_user.id)
    print(f"[ManagerDashboard] authenticated_user_id={current_user.id} manager_id={current_user.id} number_of_projects={len(projects)}")
    project_ids = [p.id for p in projects]
    
    selected_project = None
    if project_id and project_id in project_ids:
        selected_project = db.query(Project).filter(Project.id == project_id).first()
    elif projects:
        selected_project = projects[0]

    if selected_project:
        target_project_ids = [selected_project.id]
    else:
        target_project_ids = project_ids

    total_tasks = db.query(Task).filter(Task.project_id.in_(target_project_ids)).count() if target_project_ids else 0
    completed_tasks = db.query(Task).filter(Task.project_id.in_(target_project_ids), Task.status == "COMPLETED").count() if target_project_ids else 0
    pending_tasks = db.query(Task).filter(Task.project_id.in_(target_project_ids), Task.status.in_(["NOT_STARTED", "IN_PROGRESS", "TESTING", "REVIEW_PENDING"])).count() if target_project_ids else 0
    delayed_tasks = db.query(Task).filter(Task.project_id.in_(target_project_ids), Task.due_date < datetime.utcnow().date(), Task.status != "COMPLETED").count() if target_project_ids else 0
    review_queue_count = db.query(Task).filter(Task.project_id.in_(target_project_ids), Task.status == "REVIEW_PENDING").count() if target_project_ids else 0

    sprint_progress = (completed_tasks / max(total_tasks, 1)) * 100

    # Developer productivity stats
    members = db.query(ProjectMember).filter(ProjectMember.project_id.in_(target_project_ids)).all() if target_project_ids else []
    dev_ids = list({m.user_id for m in members if m.role_in_project.upper() == "DEVELOPER"})
    
    dev_productivity = []
    for d_id in dev_ids[:5]:
        dev = db.query(Profile).filter(Profile.id == d_id).first()
        if dev:
            assigned = db.query(Task).filter(Task.assigned_developer_id == d_id).count()
            done = db.query(Task).filter(Task.assigned_developer_id == d_id, Task.status == "COMPLETED").count()
            dev_productivity.append({
                "id": dev.id,
                "name": dev.full_name,
                "avatar_url": dev.avatar_url,
                "assigned_tasks": assigned,
                "completed_tasks": done,
                "completion_rate": round((done / max(assigned, 1)) * 100, 1)
            })

    # Burndown Chart data simulation
    burndown_chart = [
        {"day": "Day 1", "ideal": 50, "actual": 50},
        {"day": "Day 2", "ideal": 42, "actual": 45},
        {"day": "Day 3", "ideal": 35, "actual": 38},
        {"day": "Day 4", "ideal": 28, "actual": 27},
        {"day": "Day 5", "ideal": 21, "actual": 22},
        {"day": "Day 6", "ideal": 14, "actual": 12},
        {"day": "Day 7", "ideal": 0, "actual": completed_tasks}
    ]

    # AI Suggestions
    ai_suggestions = [
        "Reassign 2 backend tasks from Alex Dev to Michael Tech to balance sprint workload.",
        "Sprint 2 deadline is in 3 days. Recommend code freeze for non-critical bug fixes.",
        "Risk score dropped by 12% following recent PR approvals."
    ]

    return {
        "projects": [serialize_project(db, p) for p in projects],
        "selected_project_id": selected_project.id if selected_project else None,
        "metrics": {
            "project_health": selected_project.health_status if selected_project else "HEALTHY",
            "sprint_progress": round(sprint_progress, 1),
            "pending_tasks": pending_tasks,
            "completed_tasks": completed_tasks,
            "delayed_tasks": delayed_tasks,
            "review_queue_count": review_queue_count,
            "ai_risk_score": selected_project.ai_risk_score if selected_project else 18.5
        },
        "developer_productivity": dev_productivity,
        "charts": {
            "sprint_burndown": burndown_chart
        },
        "ai_suggestions": ai_suggestions
    }

@router.post("/invite-developer")
def invite_developer(req: InviteDeveloperRequest, db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify current user is the project manager
    if not is_project_manager(db, current_user.id, req.project_id):
        raise HTTPException(status_code=403, detail="You are not the Project Manager of this project")

    # Check if developer already exists
    existing_dev = db.query(Profile).filter(Profile.email == req.email).first()
    if existing_dev:
        # Check if already in project
        existing_member = db.query(ProjectMember).filter(
            ProjectMember.project_id == req.project_id,
            ProjectMember.user_id == existing_dev.id
        ).first()
        
        if existing_member:
            raise HTTPException(status_code=400, detail="Developer is already a member of this project.")
            
        # Add to project
        pm = ProjectMember(
            project_id=req.project_id,
            user_id=existing_dev.id,
            role_in_project="DEVELOPER",
            team=req.team or "Software Engineering"
        )
        db.add(pm)
        db.commit()
        
        NotificationService.create_notification(
            db=db,
            user_id=existing_dev.id,
            title="New Project Assignment",
            message=f"You have been assigned to project '{project.name}' by Manager {current_user.full_name}.",
            notification_type="SUCCESS",
            link=f"/projects/{req.project_id}"
        )
        
        return {"message": "Developer added to project successfully.", "status": "ADDED_EXISTING"}

    token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=7)

    invite = ProjectInvitation(
        email=req.email,
        full_name=req.full_name,
        phone=req.phone,
        role="developer",
        project_id=req.project_id,
        team=req.team or "Software Engineering",
        token=token,
        status="PENDING",
        invited_by=current_user.id,
        expires_at=expires_at
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    # Send invitation email simulation
    invite_url = f"/register/accept-invite?token={token}"
    body = (
        f"Hello {req.full_name},\n\n"
        f"You have been invited by Project Manager {current_user.full_name} to join project '{project.name}' as a Developer.\n"
        f"Click the link below to accept and setup your developer profile:\n{invite_url}\n\n"
        f"Token: {token}"
    )
    NotificationService.send_email_simulation(db, req.email, f"SprintIQ AI — Invitation to join {project.name}", body)

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action="INVITE_DEVELOPER",
        entity_type="USER",
        entity_id=invite.id,
        details={"email": req.email, "project_name": project.name}
    )

    return invite

@router.get("/projects/{project_id}/team")
def get_project_team(project_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not is_project_manager(db, current_user.id, project_id):
        raise HTTPException(status_code=403, detail="You are not the Project Manager of this project")

    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    team = []
    for m in members:
        member = db.query(Profile).filter(Profile.id == m.user_id).first()
        if not member:
            continue
        assigned_tasks = db.query(Task).filter(
            Task.project_id == project_id,
            Task.assigned_developer_id == m.user_id
        ).count()
        team.append({
            "id": member.id,
            "full_name": member.full_name,
            "email": member.email,
            "avatar_url": member.avatar_url,
            "role_in_project": m.role_in_project,
            "status": member.status,
            "joined_at": m.joined_at,
            "assigned_tasks": assigned_tasks
        })

    pending_invites = db.query(ProjectInvitation).filter(
        ProjectInvitation.project_id == project_id,
        ProjectInvitation.status == "PENDING",
        ProjectInvitation.role == "developer"
    ).all()
    pending = [
        {
            "id": inv.id,
            "email": inv.email,
            "full_name": inv.full_name,
            "role": inv.role,
            "status": inv.status,
            "created_at": inv.created_at,
            "expires_at": inv.expires_at
        }
        for inv in pending_invites
    ]

    return {
        "project": serialize_project(db, project),
        "team": team,
        "pending_invitations": pending
    }

@router.get("/projects/{project_id}/available-developers")
def get_available_developers(project_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not is_project_manager(db, current_user.id, project_id):
        raise HTTPException(status_code=403, detail="You are not the Project Manager of this project")

    dev_role = db.query(Role).filter(Role.name == "developer").first()
    if not dev_role:
        return []

    existing_member_ids = {
        m.user_id for m in db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    }

    developers = db.query(Profile).filter(
        Profile.role_id == dev_role.id,
        Profile.status == "ACTIVE"
    ).order_by(Profile.full_name.asc()).all()

    res = []
    for dev in developers:
        res.append({
            "id": dev.id,
            "full_name": dev.full_name,
            "email": dev.email,
            "avatar_url": dev.avatar_url,
            "phone": dev.phone,
            "status": dev.status,
            "assigned": dev.id in existing_member_ids
        })
    return res

@router.post("/projects/{project_id}/developers/assign")
def assign_developer_to_project(project_id: str, req: DeveloperAssignRequest, db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not is_project_manager(db, current_user.id, project_id):
        raise HTTPException(status_code=403, detail="You are not the Project Manager of this project")

    dev_role = db.query(Role).filter(Role.name == "developer").first()
    if not dev_role:
        raise HTTPException(status_code=400, detail="Developer role is not configured")

    target_ids = list(dict.fromkeys(req.developer_ids or ([req.developer_id] if req.developer_id else [])))
    if not target_ids:
        raise HTTPException(status_code=400, detail="No developer(s) specified")

    developers = db.query(Profile).filter(Profile.id.in_(target_ids)).all()
    if len(developers) != len(target_ids):
        raise HTTPException(status_code=404, detail="One or more developers not found")

    for dev in developers:
        if dev.role_id != dev_role.id:
            raise HTTPException(status_code=400, detail=f"Selected user '{dev.full_name}' is not a Developer")
        if dev.status != "ACTIVE":
            raise HTTPException(status_code=400, detail=f"Developer account '{dev.full_name}' is not active")

    existing_member_ids = {
        m.user_id for m in db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    }

    assigned = []
    for dev in developers:
        if dev.id in existing_member_ids:
            continue
        pm = ProjectMember(
            project_id=project_id,
            user_id=dev.id,
            role_in_project="DEVELOPER",
            team=req.team or "Software Engineering"
        )
        db.add(pm)
        assigned.append(dev)

    db.commit()

    for dev in assigned:
        NotificationService.create_notification(
            db=db,
            user_id=dev.id,
            title="New Project Assignment",
            message=f"You have been assigned to project '{project.name}' as a Developer. Project Manager: {current_user.full_name}",
            notification_type="SUCCESS",
            link=f"/projects/{project_id}"
        )

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action="ASSIGN_DEVELOPER",
        entity_type="PROJECT",
        entity_id=project_id,
        details={
            "developer_ids": [d.id for d in assigned],
            "developer_emails": [d.email for d in assigned],
            "project_name": project.name,
            "assigned_count": len(assigned),
            "already_assigned_count": len(developers) - len(assigned)
        }
    )

    return {
        "message": (
            f"{len(assigned)} developer(s) assigned successfully."
            if assigned
            else "All selected developers are already assigned to this project."
        ),
        "assigned": [{"id": d.id, "full_name": d.full_name, "email": d.email} for d in assigned],
        "assigned_count": len(assigned),
        "already_assigned_count": len(developers) - len(assigned),
        "project_id": project_id,
        "project_name": project.name
    }

@router.get("/reviews")
def get_pending_task_reviews(db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    projects = get_manager_projects(db, current_user.id)
    project_ids = [p.id for p in projects]
    
    tasks = db.query(Task).filter(
        Task.project_id.in_(project_ids),
        Task.status == "REVIEW_PENDING"
    ).order_by(Task.submitted_at.desc()).all()

    res = []
    for t in tasks:
        dev = db.query(Profile).filter(Profile.id == t.assigned_developer_id).first() if t.assigned_developer_id else None
        proj = db.query(Project).filter(Project.id == t.project_id).first()
        sprint = db.query(Sprint).filter(Sprint.id == t.sprint_id).first() if t.sprint_id else None
        comments_cnt = db.query(Comment).filter(Comment.task_id == t.id).count()
        attachments_cnt = db.query(TaskAttachment).filter(TaskAttachment.task_id == t.id).count()
        res.append({
            "task_id": t.id,
            "title": t.title,
            "description": t.description,
            "priority": t.priority,
            "project_id": t.project_id,
            "project_name": proj.name if proj else "Unknown",
            "sprint_name": sprint.name if sprint else "No Sprint",
            "developer_name": dev.full_name if dev else "Unassigned",
            "developer_avatar": dev.avatar_url if dev else None,
            "progress": t.progress,
            "story_points": t.story_points,
            "comments_count": comments_cnt,
            "attachments_count": attachments_cnt,
            "submitted_at": t.submitted_at,
            "review_comment": t.review_comment
        })
    return res

@router.post("/reviews/{task_id}/decide")
def decide_task_review(task_id: str, req: TaskReviewRequest, db: Session = Depends(get_db), current_user: Profile = Depends(manager_guard)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not is_project_manager(db, current_user.id, task.project_id):
        raise HTTPException(status_code=403, detail="You are not the Project Manager of this project")

    action = req.action.upper()

    # Re-review guard: a task already reviewed cannot be decided again.
    if task.reviewed_at is not None:
        raise HTTPException(status_code=400, detail="This task has already been reviewed.")

    now = datetime.utcnow()
    task.reviewed_by = current_user.id
    task.reviewed_at = now
    task.review_comment = req.feedback

    if action == "APPROVE":
        task.status = "COMPLETED"
        task.progress = 100
        notif_msg = f"Your task '{task.title}' has been approved by {current_user.full_name} and moved to your Completed Tasks."
        notif_type = "TASK_APPROVED"
        activity_action = "TASK_APPROVED"
    elif action == "REJECT":
        task.status = "REJECTED"
        task.progress = min(task.progress, 100)
        notif_msg = f"Your task '{task.title}' was rejected. Reason: {req.feedback or 'Revision required'}. Please continue working on it."
        notif_type = "TASK_REJECTED"
        activity_action = "TASK_CHANGES_REQUESTED"
    else: # REQUEST_CHANGES
        task.status = "REJECTED"
        task.progress = min(task.progress, 100)
        notif_msg = f"Changes requested for task '{task.title}': {req.feedback or 'Please revise and resubmit'}."
        notif_type = "WARNING"
        activity_action = "TASK_CHANGES_REQUESTED"

    db.commit()

    if task.assigned_developer_id:
        NotificationService.create_notification(
            db=db,
            user_id=task.assigned_developer_id,
            title=f"Task Review: {action.title()}",
            message=notif_msg,
            notification_type=notif_type,
            link=f"/developer/tasks"
        )

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action=activity_action,
        entity_type="TASK",
        entity_id=task.id,
        details={"feedback": req.feedback, "task_title": task.title, "reviewer": current_user.full_name}
    )

    return {"message": f"Task review status updated to {action}", "status": task.status}
