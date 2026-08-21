from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.domain import Task, Profile, Project, Sprint, TaskAttachment, Comment
from app.schemas.pydantic_models import TaskCreate, TaskUpdate, TaskResponse, TaskAttachmentResponse
from app.api.deps import get_current_user
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.get("", response_model=List[TaskResponse])
def get_tasks(
    project_id: Optional[str] = None,
    sprint_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    assigned_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    query = db.query(Task)
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if sprint_id:
        query = query.filter(Task.sprint_id == sprint_id)
    if status_filter:
        query = query.filter(Task.status == status_filter.upper())
    if assigned_to:
        query = query.filter(Task.assigned_developer_id == assigned_to)

    tasks = query.order_by(Task.created_at.desc()).all()
    res = []
    for t in tasks:
        proj = db.query(Project).filter(Project.id == t.project_id).first()
        sprint = db.query(Sprint).filter(Sprint.id == t.sprint_id).first() if t.sprint_id else None
        dev = db.query(Profile).filter(Profile.id == t.assigned_developer_id).first() if t.assigned_developer_id else None
        attachments = db.query(TaskAttachment).filter(TaskAttachment.task_id == t.id).all()
        comments_cnt = db.query(Comment).filter(Comment.task_id == t.id).count()

        att_res = [
            TaskAttachmentResponse(
                id=a.id, file_name=a.file_name, file_url=a.file_url, file_type=a.file_type, file_size=a.file_size, uploaded_at=a.uploaded_at
            ) for a in attachments
        ]

        res.append(TaskResponse(
            id=t.id,
            title=t.title,
            description=t.description,
            priority=t.priority,
            status=t.status,
            progress=t.progress,
            project_id=t.project_id,
            project_name=proj.name if proj else None,
            sprint_id=t.sprint_id,
            sprint_name=sprint.name if sprint else None,
            estimated_hours=t.estimated_hours,
            story_points=t.story_points,
            start_date=t.start_date,
            due_date=t.due_date,
            assigned_developer_id=t.assigned_developer_id,
            assigned_developer_name=dev.full_name if dev else "Unassigned",
            assigned_developer_avatar=dev.avatar_url if dev else None,
        created_by=t.created_by,
        created_at=t.created_at,
        attachments=att_res,
        comments_count=comments_cnt,
        submitted_at=t.submitted_at,
        reviewed_by=t.reviewed_by,
        reviewed_at=t.reviewed_at,
        review_comment=t.review_comment
    ))
    return res

@router.post("", response_model=TaskResponse)
def create_task(req: TaskCreate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    user_role = current_user.role.name.lower()
    if user_role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only Admins and Project Managers can create tasks")

    # Validate project_id: never create an orphan task with a bogus FK.
    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(
            status_code=400,
            detail=f"Project not found for project_id='{req.project_id}'. Select a valid project before creating the task."
        )

    # Validate assigned developer if provided (avoid invalid FK values).
    assigned_dev = None
    if req.assigned_developer_id:
        assigned_dev = db.query(Profile).filter(Profile.id == req.assigned_developer_id).first()
        if not assigned_dev:
            raise HTTPException(
                status_code=400,
                detail=f"Assigned developer not found for developer_id='{req.assigned_developer_id}'. Select a valid developer."
            )
        if assigned_dev.status != "ACTIVE":
            raise HTTPException(
                status_code=400,
                detail=f"Assigned developer '{assigned_dev.full_name}' is not active. Select an active developer."
            )
        dev_role = assigned_dev.role.name.lower() if assigned_dev.role else ""
        if dev_role != "developer":
            raise HTTPException(
                status_code=400,
                detail=f"Selected user '{assigned_dev.full_name}' is not a Developer. Select a valid developer account."
            )

    # Resolve sprint: explicit sprint_id wins; otherwise use the project's active sprint.
    sprint_id = req.sprint_id
    if not sprint_id and req.use_active_sprint:
        active_sprint = db.query(Sprint).filter(
            Sprint.project_id == project.id,
            Sprint.status == "ACTIVE"
        ).order_by(Sprint.created_at.desc()).first()
        sprint_id = active_sprint.id if active_sprint else None

    # Validate sprint belongs to the selected project before inserting the FK.
    if sprint_id:
        sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
        if not sprint:
            raise HTTPException(
                status_code=400,
                detail=f"Sprint not found for sprint_id='{sprint_id}'. Select a valid sprint."
            )
        if sprint.project_id != project.id:
            raise HTTPException(
                status_code=400,
                detail=f"Selected sprint '{sprint.name}' does not belong to project '{project.name}'. Choose a sprint from this project or No Sprint (Backlog)."
            )

    task = Task(
        title=req.title,
        description=req.description,
        priority=req.priority.upper(),
        project_id=project.id,
        sprint_id=sprint_id,
        estimated_hours=req.estimated_hours,
        story_points=req.story_points,
        start_date=req.start_date,
        due_date=req.due_date,
        assigned_developer_id=assigned_dev.id if assigned_dev else None,
        created_by=current_user.id,
        status="NOT_STARTED",
        progress=0
    )
    try:
        db.add(task)
        db.commit()
        db.refresh(task)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error while creating task: {e}")

    if task.assigned_developer_id:
        NotificationService.create_notification(
            db=db,
            user_id=task.assigned_developer_id,
            title="New Task Assigned",
            message=f"You have been assigned to task '{task.title}'.",
            notification_type="TASK_ASSIGNED",
            link=f"/developer/tasks"
        )

    NotificationService.log_activity(
        db=db,
        user_id=current_user.id,
        action="CREATE_TASK",
        entity_type="TASK",
        entity_id=task.id,
        details={"title": task.title, "project_id": project.id}
    )

    sprint = db.query(Sprint).filter(Sprint.id == task.sprint_id).first() if task.sprint_id else None

    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        status=task.status,
        progress=task.progress,
        project_id=task.project_id,
        project_name=project.name,
        sprint_id=task.sprint_id,
        sprint_name=sprint.name if sprint else None,
        estimated_hours=task.estimated_hours,
        story_points=task.story_points,
        start_date=task.start_date,
        due_date=task.due_date,
        assigned_developer_id=task.assigned_developer_id,
        assigned_developer_name=assigned_dev.full_name if assigned_dev else None,
        assigned_developer_avatar=assigned_dev.avatar_url if assigned_dev else None,
        created_by=task.created_by,
        created_at=task.created_at,
        attachments=[],
        comments_count=0,
        submitted_at=task.submitted_at,
        reviewed_by=task.reviewed_by,
        reviewed_at=task.reviewed_at,
        review_comment=task.review_comment
    )

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: str, req: TaskUpdate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if req.title is not None: task.title = req.title
    if req.description is not None: task.description = req.description
    if req.priority is not None: task.priority = req.priority.upper()
    if req.status is not None:
        new_status = req.status.upper()
        if new_status in ["SUBMITTED", "REVIEW_PENDING"] and task.status not in ["SUBMITTED", "REVIEW_PENDING"]:
            task.submitted_at = datetime.utcnow()
            task.reviewed_at = None
            task.reviewed_by = None
            task.review_comment = None
            task.progress = 100
        
        # Guard: Developers cannot set status directly to COMPLETED to bypass manager verification
        if new_status == "COMPLETED" and not task.reviewed_at:
            if current_user.role.name.lower() == "developer":
                new_status = "REVIEW_PENDING"
                task.submitted_at = datetime.utcnow()
                task.progress = 100
        
        task.status = new_status
    if req.progress is not None: task.progress = req.progress
    if req.sprint_id is not None: task.sprint_id = req.sprint_id
    if req.estimated_hours is not None: task.estimated_hours = req.estimated_hours
    if req.story_points is not None: task.story_points = req.story_points
    if req.start_date is not None: task.start_date = req.start_date
    if req.due_date is not None: task.due_date = req.due_date
    
    if req.assigned_developer_id is not None and req.assigned_developer_id != task.assigned_developer_id:
        task.assigned_developer_id = req.assigned_developer_id
        if req.assigned_developer_id:
            NotificationService.create_notification(
                db=db,
                user_id=req.assigned_developer_id,
                title="Task Assignment Updated",
                message=f"Task '{task.title}' has been assigned to you.",
                notification_type="TASK_ASSIGNED",
                link="/developer/tasks"
            )

    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)

    proj = db.query(Project).filter(Project.id == task.project_id).first()
    sprint = db.query(Sprint).filter(Sprint.id == task.sprint_id).first() if task.sprint_id else None
    dev = db.query(Profile).filter(Profile.id == task.assigned_developer_id).first() if task.assigned_developer_id else None
    attachments = db.query(TaskAttachment).filter(TaskAttachment.task_id == task.id).all()
    comments_cnt = db.query(Comment).filter(Comment.task_id == task.id).count()

    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        status=task.status,
        progress=task.progress,
        project_id=task.project_id,
        project_name=proj.name if proj else None,
        sprint_id=task.sprint_id,
        sprint_name=sprint.name if sprint else None,
        estimated_hours=task.estimated_hours,
        story_points=task.story_points,
        start_date=task.start_date,
        due_date=task.due_date,
        assigned_developer_id=task.assigned_developer_id,
        assigned_developer_name=dev.full_name if dev else None,
        assigned_developer_avatar=dev.avatar_url if dev else None,
        created_by=task.created_by,
        created_at=task.created_at,
        attachments=[TaskAttachmentResponse(id=a.id, file_name=a.file_name, file_url=a.file_url, file_type=a.file_type, file_size=a.file_size, uploaded_at=a.uploaded_at) for a in attachments],
        comments_count=comments_cnt,
        submitted_at=task.submitted_at,
        reviewed_by=task.reviewed_by,
        reviewed_at=task.reviewed_at,
        review_comment=task.review_comment
    )

@router.delete("/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}
