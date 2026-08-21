import numpy as np
import pandas as pd
from datetime import date, datetime
from sqlalchemy.orm import Session
from app.models.domain import Project, Task, Sprint, Profile, ProjectMember, GitHubPullRequest, GitHubIssue

def extract_project_features(db: Session, project_id: str) -> dict:
    """
    Extracts raw numerical engineering features for a given project ID
    from MySQL into a structured dictionary suitable for Pandas/Scikit-learn.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return {}

    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    sprints = db.query(Sprint).filter(Sprint.project_id == project_id).all()
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()

    today = date.today()

    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == "COMPLETED")
    remaining_tasks = total_tasks - completed_tasks
    overdue_tasks = sum(1 for t in tasks if t.due_date and t.due_date < today and t.status != "COMPLETED")

    total_estimated_hours = sum(t.estimated_hours or 0.0 for t in tasks)
    completed_estimated_hours = sum(t.estimated_hours or 0.0 for t in tasks if t.status == "COMPLETED")
    total_story_points = sum(t.story_points or 1 for t in tasks)
    completed_story_points = sum(t.story_points or 1 for t in tasks if t.status == "COMPLETED")

    completion_rate = (completed_tasks / total_tasks) if total_tasks > 0 else 0.0
    story_point_completion_rate = (completed_story_points / total_story_points) if total_story_points > 0 else 0.0

    # Calculate average task completion days
    completion_days_list = []
    for t in tasks:
        if t.status == "COMPLETED" and t.created_at and t.updated_at:
            delta = (t.updated_at - t.created_at).total_days if hasattr((t.updated_at - t.created_at), "total_days") else (t.updated_at - t.created_at).days
            completion_days_list.append(max(delta, 1))

    avg_completion_days = float(np.mean(completion_days_list)) if completion_days_list else 3.5

    # Sprint velocity
    completed_sprints = [s for s in sprints if s.status == "COMPLETED"]
    if completed_sprints:
        sprint_velocities = []
        for s in completed_sprints:
            s_pts = sum(t.story_points or 1 for t in s.tasks if t.status == "COMPLETED")
            sprint_velocities.append(s_pts)
        avg_sprint_velocity = float(np.mean(sprint_velocities))
    else:
        avg_sprint_velocity = float(completed_story_points) if completed_story_points > 0 else 10.0

    # Developer team capacity
    dev_members = [m for m in members if m.role_in_project in ("DEVELOPER", "developer")]
    dev_count = max(len(dev_members), 1)
    team_capacity_hours = dev_count * 40.0 # 40 hrs per week per dev

    workload_ratio = min(total_estimated_hours / max(team_capacity_hours, 1.0), 3.0)

    # Deadline adherence rate
    due_tasks = [t for t in tasks if t.due_date]
    if due_tasks:
        on_time_count = sum(1 for t in due_tasks if t.status == "COMPLETED" and (t.updated_at.date() <= t.due_date if t.updated_at else True))
        deadline_adherence = on_time_count / len(due_tasks)
    else:
        deadline_adherence = 0.85

    # High priority & bug counts
    high_priority_bugs = sum(1 for t in tasks if t.priority in ("HIGH", "URGENT") or "bug" in (t.title or "").lower())

    return {
        "total_tasks": float(total_tasks),
        "completed_tasks": float(completed_tasks),
        "remaining_tasks": float(remaining_tasks),
        "overdue_tasks": float(overdue_tasks),
        "completion_rate": float(completion_rate),
        "story_point_completion_rate": float(story_point_completion_rate),
        "avg_completion_days": float(avg_completion_days),
        "avg_sprint_velocity": float(avg_sprint_velocity),
        "dev_count": float(dev_count),
        "team_capacity_hours": float(team_capacity_hours),
        "workload_ratio": float(workload_ratio),
        "deadline_adherence": float(deadline_adherence),
        "high_priority_bugs": float(high_priority_bugs)
    }

def convert_features_to_dataframe(features_dict: dict) -> pd.DataFrame:
    """Converts a feature dict into a single-row Pandas DataFrame."""
    return pd.DataFrame([features_dict])
