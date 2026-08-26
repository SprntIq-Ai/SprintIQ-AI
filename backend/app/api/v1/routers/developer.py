from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import uuid
import os

from app.core.database import get_db
from app.models.domain import Profile, Role, Project, Sprint, Task, TaskProgress, TaskAttachment, Comment, Notification, ProjectMember
from app.schemas.pydantic_models import TaskProgressUpdate, CommentCreate, CommentResponse, AIChatRequest
from app.api.deps import require_roles
from app.services.notification_service import NotificationService
from app.services.ai_service import AIService
from app.services.copilot_service import query_project_aware_copilot

router = APIRouter(prefix="/developer", tags=["Developer Portal"])

# Dependency guard requiring developer role
dev_guard = require_roles(["developer"])

@router.get("/dashboard")
def get_developer_dashboard(db: Session = Depends(get_db), current_user: Profile = Depends(dev_guard)):
    assigned_tasks = db.query(Task).filter(Task.assigned_developer_id == current_user.id).all()
    
    total = len(assigned_tasks)
    completed = sum(1 for t in assigned_tasks if t.status == "COMPLETED")
    active = total - completed
    pending = sum(1 for t in assigned_tasks if t.status in ["NOT_STARTED", "IN_PROGRESS", "TESTING"])
    review_pending = sum(1 for t in assigned_tasks if t.status == "REVIEW_PENDING")
    
    today = datetime.utcnow().date()
    todays_tasks = [t for t in assigned_tasks if t.due_date == today or t.status == "IN_PROGRESS"]
    upcoming_deadlines = [
        {"id": t.id, "title": t.title, "due_date": t.due_date, "priority": t.priority, "progress": t.progress}
        for t in assigned_tasks if t.due_date and t.due_date >= today and t.status != "COMPLETED"
    ]
    
    overall_progress = (completed / max(total, 1)) * 100

    # Assigned projects (developer project isolation)
    # Primary source: project_members membership (manager team-assignment).
    # Fallback: projects containing tasks assigned to this developer, so a
    # developer who owns tasks in a project always sees that project.
    memberships = db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()
    project_ids = {m.project_id for m in memberships}
    task_proj_ids = {t.project_id for t in assigned_tasks if t.project_id}
    project_ids |= task_proj_ids
    assigned_projects = db.query(Project).filter(Project.id.in_(project_ids)).all() if project_ids else []
    # Safe development logging - never log passwords/tokens
    print(f"[DeveloperDashboard] authenticated_user_id={current_user.id} number_of_projects={len(assigned_projects)} project_ids={sorted(project_ids)}")
    projects_res = []
    for p in assigned_projects:
        manager = db.query(Profile).filter(Profile.id == p.manager_id).first() if p.manager_id else None
        proj_tasks = db.query(Task).filter(Task.project_id == p.id, Task.assigned_developer_id == current_user.id).count()
        proj_done = db.query(Task).filter(
            Task.project_id == p.id,
            Task.assigned_developer_id == current_user.id,
            Task.status == "COMPLETED"
        ).count()
        projects_res.append({
            "id": p.id,
            "name": p.name,
            "key": p.key,
            "status": p.status,
            "description": p.description,
            "manager_name": manager.full_name if manager else "Unassigned",
            "total_tasks": proj_tasks,
            "completed_tasks": proj_done
        })

    # Chart datasets
    weekly_perf = [
        {"day": "Mon", "completed": 2, "in_progress": 1},
        {"day": "Tue", "completed": 3, "in_progress": 2},
        {"day": "Wed", "completed": 1, "in_progress": 3},
        {"day": "Thu", "completed": 4, "in_progress": 1},
        {"day": "Fri", "completed": 2, "in_progress": 2},
    ]

    return {
        "metrics": {
            "assigned_tasks_count": total,
            "active_tasks_count": active,
            "todays_tasks_count": len(todays_tasks),
            "completed_tasks_count": completed,
            "pending_tasks_count": pending,
            "review_pending_count": review_pending,
            "overall_progress_rate": round(overall_progress, 1)
        },
        "upcoming_deadlines": upcoming_deadlines[:5],
        "projects": projects_res,
        "charts": {
            "weekly_performance": weekly_perf
        }
    }

@router.get("/tasks")
def get_developer_tasks(db: Session = Depends(get_db), current_user: Profile = Depends(dev_guard)):
    # Active task list: tasks stay visible until the Project Manager approves (COMPLETED).
    active_statuses = ["NOT_STARTED", "IN_PROGRESS", "TESTING", "REVIEW_PENDING", "REJECTED"]
    tasks = db.query(Task).filter(
        Task.assigned_developer_id == current_user.id,
        Task.status.in_(active_statuses)
    ).order_by(Task.updated_at.desc()).all()
    res = []
    for t in tasks:
        proj = db.query(Project).filter(Project.id == t.project_id).first()
        sprint = db.query(Sprint).filter(Sprint.id == t.sprint_id).first() if t.sprint_id else None
        attachments = db.query(TaskAttachment).filter(TaskAttachment.task_id == t.id).all()
        comments_cnt = db.query(Comment).filter(Comment.task_id == t.id).count()
        reviewer = db.query(Profile).filter(Profile.id == t.reviewed_by).first() if t.reviewed_by else None

        res.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "priority": t.priority,
            "status": t.status,
            "progress": t.progress,
            "project_id": t.project_id,
            "project_name": proj.name if proj else "N/A",
            "sprint_name": sprint.name if sprint else "No Sprint",
            "estimated_hours": t.estimated_hours,
            "story_points": t.story_points,
            "start_date": t.start_date,
            "due_date": t.due_date,
            "created_at": t.created_at,
            "attachments_count": len(attachments),
            "comments_count": comments_cnt,
            "submitted_at": t.submitted_at,
            "reviewed_at": t.reviewed_at,
            "reviewed_by_name": reviewer.full_name if reviewer else None,
            "review_comment": t.review_comment
        })
    return res

@router.get("/tasks/completed")
def get_developer_completed_tasks(db: Session = Depends(get_db), current_user: Profile = Depends(dev_guard)):
    # Approved tasks (manager-approved) are archived to the Completed Tasks history.
    tasks = db.query(Task).filter(
        Task.assigned_developer_id == current_user.id,
        Task.status == "COMPLETED"
    ).order_by(Task.reviewed_at.desc()).all()
    res = []
    for t in tasks:
        proj = db.query(Project).filter(Project.id == t.project_id).first()
        sprint = db.query(Sprint).filter(Sprint.id == t.sprint_id).first() if t.sprint_id else None
        reviewer = db.query(Profile).filter(Profile.id == t.reviewed_by).first() if t.reviewed_by else None

        res.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "priority": t.priority,
            "status": t.status,
            "progress": t.progress,
            "project_id": t.project_id,
            "project_name": proj.name if proj else "N/A",
            "sprint_name": sprint.name if sprint else "No Sprint",
            "estimated_hours": t.estimated_hours,
            "story_points": t.story_points,
            "start_date": t.start_date,
            "due_date": t.due_date,
            "created_at": t.created_at,
            "submitted_at": t.submitted_at,
            "reviewed_at": t.reviewed_at,
            "reviewed_by_name": reviewer.full_name if reviewer else None,
            "review_comment": t.review_comment
        })
    return res

@router.put("/tasks/{task_id}/progress")
def update_task_progress(task_id: str, req: TaskProgressUpdate, db: Session = Depends(get_db), current_user: Profile = Depends(dev_guard)):
    task = db.query(Task).filter(Task.id == task_id, Task.assigned_developer_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to you")

    if task.status == "REVIEW_PENDING":
        raise HTTPException(status_code=400, detail="This task is awaiting manager review. You cannot update progress until it is reviewed.")
    if task.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="This task was already approved and completed.")

    # Lifecycle: developers may only set working statuses. REVIEW_PENDING / COMPLETED
    # are manager-controlled. A REJECTED task returns to the active list for rework.
    allowed_statuses = ["NOT_STARTED", "IN_PROGRESS", "TESTING"]
    if req.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status '{req.status}' for a working task. Allowed: {', '.join(allowed_statuses)}.")

    task.progress = req.progress
    task.status = req.status
    task.updated_at = datetime.utcnow()

    # Create progress log entry
    prog_log = TaskProgress(
        task_id=task.id,
        progress_percentage=req.progress,
        status=req.status,
        notes=req.notes,
        updated_by=current_user.id
    )
    db.add(prog_log)
    db.commit()

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action="UPDATE_TASK_PROGRESS",
        entity_type="TASK",
        entity_id=task.id,
        details={"progress": req.progress, "status": req.status}
    )

    return {"message": "Progress updated successfully", "progress": task.progress, "status": task.status}

@router.post("/tasks/{task_id}/submit")
def submit_task_for_review(task_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(dev_guard)):
    task = db.query(Task).filter(Task.id == task_id, Task.assigned_developer_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to you")

    if task.status == "REVIEW_PENDING":
        raise HTTPException(status_code=400, detail="This task is already submitted and awaiting manager review.")
    if task.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="This task was already approved and completed.")

    if task.progress < 100:
        raise HTTPException(status_code=400, detail="Task must be 100% complete before submitting for review.")

    task.status = "REVIEW_PENDING"
    task.progress = 100
    task.submitted_at = datetime.utcnow()
    task.reviewed_by = None
    task.reviewed_at = None
    task.review_comment = None
    db.commit()

    # Notify Project Manager
    project = db.query(Project).filter(Project.id == task.project_id).first()
    if project and project.manager_id:
        NotificationService.create_notification(
            db=db,
            user_id=project.manager_id,
            title="Task Submitted for Review",
            message=f"Developer {current_user.full_name} submitted task '{task.title}' for manager review.",
            notification_type="TASK_SUBMITTED",
            link="/manager/reviews"
        )

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action="TASK_SUBMITTED_FOR_REVIEW",
        entity_type="TASK",
        entity_id=task.id,
        details={"title": task.title, "project_id": task.project_id}
    )

    return {"message": "Task submitted for manager review!", "status": task.status}

@router.post("/tasks/{task_id}/attachments")
async def upload_task_attachment(task_id: str, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: Profile = Depends(dev_guard)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Upload handling simulation / local asset link
    file_name = file.filename
    file_type = file.content_type
    fake_url = f"/uploads/{uuid.uuid4()}_{file_name}"

    attachment = TaskAttachment(
        task_id=task.id,
        file_name=file_name,
        file_url=fake_url,
        file_type=file_type,
        uploaded_by=current_user.id
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return {"message": "File uploaded successfully", "attachment_id": attachment.id, "file_url": fake_url}

@router.get("/tasks/{task_id}/comments", response_model=List[CommentResponse])
def get_task_comments(task_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(dev_guard)):
    comments = db.query(Comment).filter(Comment.task_id == task_id).order_by(Comment.created_at.asc()).all()
    res = []
    for c in comments:
        author = db.query(Profile).filter(Profile.id == c.author_id).first()
        res.append(CommentResponse(
            id=c.id,
            task_id=c.task_id,
            author_id=c.author_id,
            author_name=author.full_name if author else "Unknown",
            author_avatar=author.avatar_url if author else None,
            content=c.content,
            created_at=c.created_at
        ))
    return res

@router.post("/tasks/{task_id}/comments", response_model=CommentResponse)
def add_task_comment(task_id: str, req: CommentCreate, db: Session = Depends(get_db), current_user: Profile = Depends(dev_guard)):
    comment = Comment(
        task_id=task_id,
        author_id=current_user.id,
        content=req.content
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentResponse(
        id=comment.id,
        task_id=comment.task_id,
        author_id=comment.author_id,
        author_name=current_user.full_name,
        author_avatar=current_user.avatar_url,
        content=comment.content,
        created_at=comment.created_at
    )

@router.post("/ai-chat")
def developer_ai_chat(req: AIChatRequest, db: Session = Depends(get_db), current_user: Profile = Depends(dev_guard)):
    result = query_project_aware_copilot(db, current_user, req.prompt, req.project_id, req.mode)
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=result["error"])
    return {"prompt": req.prompt, "response": result["answer"]}


@router.get("/projects")
def get_developer_projects(db: Session = Depends(get_db), current_user: Profile = Depends(dev_guard)):
    assigned_tasks = db.query(Task).filter(Task.assigned_developer_id == current_user.id).all()
    memberships = db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()
    project_ids = {m.project_id for m in memberships}
    task_proj_ids = {t.project_id for t in assigned_tasks if t.project_id}
    project_ids |= task_proj_ids
    
    assigned_projects = db.query(Project).filter(Project.id.in_(project_ids)).all() if project_ids else []
    
    projects_res = []
    for p in assigned_projects:
        manager = db.query(Profile).filter(Profile.id == p.manager_id).first() if p.manager_id else None
        
        # Count tasks assigned to THIS developer in THIS project
        total = db.query(Task).filter(Task.project_id == p.id, Task.assigned_developer_id == current_user.id).count()
        completed = db.query(Task).filter(Task.project_id == p.id, Task.assigned_developer_id == current_user.id, Task.status == "COMPLETED").count()
        in_progress = db.query(Task).filter(Task.project_id == p.id, Task.assigned_developer_id == current_user.id, Task.status == "IN_PROGRESS").count()
        review_pending = db.query(Task).filter(Task.project_id == p.id, Task.assigned_developer_id == current_user.id, Task.status == "REVIEW_PENDING").count()
        
        progress = (completed / max(total, 1)) * 100
        
        projects_res.append({
            "id": p.id,
            "key": p.key,
            "name": p.name,
            "description": p.description,
            "status": p.status,
            "manager_id": p.manager_id,
            "manager_name": manager.full_name if manager else "Unassigned",
            "created_at": p.created_at,
            "total_tasks": total,
            "completed_tasks": completed,
            "in_progress_tasks": in_progress,
            "review_pending_tasks": review_pending,
            "progress_percentage": round(progress, 1)
        })
        
    return projects_res


@router.get("/projects/{project_id}")
def get_developer_project_detail(project_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(dev_guard)):
    try:
        uuid_project_id = uuid.UUID(project_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=404, detail="Project not found.")

    project = db.query(Project).filter(Project.id == uuid_project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    # Check authority
    is_member = db.query(ProjectMember).filter(
        ProjectMember.project_id == uuid_project_id,
        ProjectMember.user_id == current_user.id
    ).first() is not None

    assigned_tasks = db.query(Task).filter(
        Task.project_id == uuid_project_id,
        Task.assigned_developer_id == current_user.id
    ).all()

    has_tasks = len(assigned_tasks) > 0

    if not (is_member or has_tasks):
        raise HTTPException(status_code=403, detail="You don't have access to this project.")

    # Calculate developer workload metrics for this project
    total = len(assigned_tasks)
    completed = sum(1 for t in assigned_tasks if t.status == "COMPLETED")
    in_progress = sum(1 for t in assigned_tasks if t.status == "IN_PROGRESS")
    review_pending = sum(1 for t in assigned_tasks if t.status == "REVIEW_PENDING")
    overall_progress = (completed / max(total, 1)) * 100

    # Project Manager
    manager = db.query(Profile).filter(Profile.id == project.manager_id).first() if project.manager_id else None

    # Tasks assigned to this developer in this project
    tasks_res = []
    for t in assigned_tasks:
        sprint = db.query(Sprint).filter(Sprint.id == t.sprint_id).first() if t.sprint_id else None
        tasks_res.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "priority": t.priority,
            "status": t.status,
            "progress": t.progress,
            "sprint_id": t.sprint_id,
            "sprint_name": sprint.name if sprint else "No Sprint",
            "story_points": t.story_points,
            "estimated_hours": t.estimated_hours,
            "start_date": t.start_date,
            "due_date": t.due_date,
            "submitted_at": t.submitted_at,
            "reviewed_at": t.reviewed_at,
            "review_comment": t.review_comment
        })

    # Sprints relevant to this project
    sprints = db.query(Sprint).filter(Sprint.project_id == uuid_project_id).all()
    sprints_res = [{
        "id": s.id,
        "name": s.name,
        "status": s.status,
        "start_date": s.start_date,
        "end_date": s.end_date,
        "goal": s.goal
    } for s in sprints]

    # Team members in project
    members = db.query(ProjectMember).filter(ProjectMember.project_id == uuid_project_id).all()
    team_res = []
    for m in members:
        member = db.query(Profile).filter(Profile.id == m.user_id).first()
        if not member:
            continue
        team_res.append({
            "id": member.id,
            "full_name": member.full_name,
            "email": member.email,
            "role_in_project": m.role_in_project
        })

    return {
        "project": {
            "id": project.id,
            "key": project.key,
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "manager_id": project.manager_id,
            "manager_name": manager.full_name if manager else "Unassigned",
            "start_date": project.start_date,
            "target_date": project.target_date,
            "created_at": project.created_at
        },
        "developer_summary": {
            "assigned_task_count": total,
            "completed_task_count": completed,
            "in_progress_task_count": in_progress,
            "review_pending_task_count": review_pending,
            "overall_progress": round(overall_progress, 1)
        },
        "tasks": tasks_res,
        "sprints": sprints_res,
        "team": team_res
    }
