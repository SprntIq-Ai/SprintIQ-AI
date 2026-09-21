from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from app.core.database import get_db
from app.models.domain import Profile, Project, Task, Sprint
from app.api.deps import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])

from app.models.domain import ProjectMember

@router.get("/workload-heatmap")
def get_workload_heatmap(project_id: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    user_role = current_user.role.name.lower()
    devs = []

    if user_role == "admin":
        devs = db.query(Profile).join(Profile.role).filter(Profile.role.has(name="developer")).all()
    elif user_role == "manager":
        # Find all projects the manager manages
        managed_projects = db.query(Project).filter(Project.manager_id == current_user.id).all()
        managed_project_ids = [p.id for p in managed_projects]
        
        # Find developers in these projects
        memberships = db.query(ProjectMember).filter(ProjectMember.project_id.in_(managed_project_ids)).all()
        dev_ids = {m.user_id for m in memberships}
        devs = db.query(Profile).filter(Profile.id.in_(dev_ids)).all()
    else:  # developer
        devs = [current_user]

    WEEKLY_DEVELOPER_CAPACITY = 40.0
    heatmap = []

    for d in devs:
        # Which projects is this developer in?
        d_memberships = db.query(ProjectMember).filter(ProjectMember.user_id == d.id).all()
        proj_ids = [m.project_id for m in d_memberships]
        d_projects = db.query(Project).filter(Project.id.in_(proj_ids)).all()
        
        assigned_projects = [{"id": p.id, "name": p.name} for p in d_projects]

        tasks = db.query(Task).filter(Task.assigned_developer_id == d.id).all()
        
        tasks_list = []
        comp_count = 0
        in_prog_count = 0
        sub_count = 0
        rej_count = 0
        
        # Remaining workload calculations (ONLY includes active tasks: TODO, IN_PROG, SUBMITTED, REJECTED)
        active_est_hrs = 0.0
        active_comp_hrs = 0.0

        for t in tasks:
            if t.status == "COMPLETED":
                comp_count += 1
            else:
                if t.status == "IN_PROGRESS" or t.status == "TESTING":
                    in_prog_count += 1
                elif t.status == "REVIEW_PENDING":
                    sub_count += 1
                elif t.status == "REJECTED":
                    rej_count += 1
                
                active_est_hrs += t.estimated_hours
                active_comp_hrs += t.estimated_hours * (t.progress / 100.0)
            
            proj = next((p for p in d_projects if p.id == t.project_id), None)
            sprint = db.query(Sprint).filter(Sprint.id == t.sprint_id).first() if t.sprint_id else None
            reviewer = db.query(Profile).filter(Profile.id == t.reviewed_by).first() if t.reviewed_by else None

            tasks_list.append({
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "priority": t.priority,
                "status": t.status,
                "progress": t.progress,
                "project_id": t.project_id,
                "project_name": proj.name if proj else (db.query(Project).filter(Project.id == t.project_id).first().name if t.project_id else "Unknown"),
                "sprint_name": sprint.name if sprint else "No Sprint",
                "estimated_hours": t.estimated_hours,
                "story_points": t.story_points,
                "due_date": t.due_date,
                "submitted_at": t.submitted_at,
                "reviewed_at": t.reviewed_at,
                "reviewed_by_name": reviewer.full_name if reviewer else None,
                "review_comment": t.review_comment
            })

        rem_hrs = max(0.0, active_est_hrs - active_comp_hrs)
        tot_hrs = active_est_hrs
        
        capacity_percentage = int((tot_hrs / WEEKLY_DEVELOPER_CAPACITY) * 100) if WEEKLY_DEVELOPER_CAPACITY > 0 else 0
        
        if tot_hrs > WEEKLY_DEVELOPER_CAPACITY:
            status = "OVER_CAPACITY"
        elif tot_hrs < 15:
            status = "LOW"
        elif tot_hrs <= 30:
            status = "MEDIUM"
        else:
            status = "HIGH"

        heatmap.append({
            "developer_id": d.id,
            "developer_name": d.full_name,
            "developer_email": d.email,
            "assigned_projects": assigned_projects,
            "assigned_tasks": len(tasks),
            "completed_tasks": comp_count,
            "in_progress_tasks": in_prog_count,
            "submitted_tasks": sub_count,
            "rejected_tasks": rej_count,
            "estimated_hours": round(tot_hrs, 1),
            "completed_hours": round(active_comp_hrs, 1),
            "remaining_hours": round(rem_hrs, 1),
            "capacity_percentage": capacity_percentage,
            "workload_status": status,
            "tasks_list": tasks_list
        })
    return heatmap

@router.get("/team-velocity")
def get_team_velocity(project_id: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    return {
        "sprint_velocity": 34,
        "average_story_points": 28.5,
        "completed_story_points": 32,
        "remaining_story_points": 8,
        "historical_trends": [
            {"sprint": "Sprint 1", "planned": 30, "completed": 28},
            {"sprint": "Sprint 2", "planned": 35, "completed": 34},
            {"sprint": "Sprint 3", "planned": 40, "completed": 38},
            {"sprint": "Sprint 4 (Active)", "planned": 40, "completed": 32}
        ],
        "burndown_chart": [
            {"day": "Day 1", "ideal": 40, "actual": 40},
            {"day": "Day 3", "ideal": 32, "actual": 34},
            {"day": "Day 5", "ideal": 24, "actual": 25},
            {"day": "Day 7", "ideal": 16, "actual": 15},
            {"day": "Day 9", "ideal": 8, "actual": 8},
            {"day": "Day 10", "ideal": 0, "actual": 2}
        ]
    }

@router.get("/leaderboard")
def get_developer_leaderboard(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    devs = db.query(Profile).join(Profile.role).filter(Profile.role.has(name="developer")).all()
    today = datetime.utcnow().date()
    
    def _parse_t_date(d):
        if not d:
            return None
        if isinstance(d, datetime):
            return d.date()
        if isinstance(d, str):
            try:
                return datetime.fromisoformat(d.replace("Z", "+00:00")).date()
            except Exception:
                try:
                    return datetime.strptime(d[:10], "%Y-%m-%d").date()
                except Exception:
                    return None
        return d

    raw_board = []
    for d in devs:
        tasks = db.query(Task).filter(Task.assigned_developer_id == d.id).all()
        total_tasks = len(tasks)
        comp_tasks = [t for t in tasks if t.status == "COMPLETED"]
        rev_tasks = [t for t in tasks if t.status == "REVIEW_PENDING"]
        rej_tasks = [t for t in tasks if t.status == "REJECTED"]
        
        comp_count = len(comp_tasks)
        rev_count = len(rev_tasks)
        
        # Real story points
        story_pts = sum(t.story_points or 1 for t in comp_tasks)
        # Add partial story points for in-review tasks
        story_pts += sum(int((t.story_points or 1) * 0.8) for t in rev_tasks)
        
        # Task quality score based on rejection rate
        if comp_count + rev_count + len(rej_tasks) > 0:
            rejection_penalty = len(rej_tasks) * 8.0
            task_quality = max(70.0, min(100.0, 98.0 - rejection_penalty))
        else:
            task_quality = 90.0

        # On-time delivery rate
        on_time_count = 0
        evaluated_count = 0
        for t in comp_tasks:
            due = _parse_t_date(t.due_date)
            if due:
                evaluated_count += 1
                # If finished before or on due date
                if t.updated_at and _parse_t_date(t.updated_at) and _parse_t_date(t.updated_at) <= due:
                    on_time_count += 1
                elif not t.updated_at or due >= today:
                    on_time_count += 1
        
        if evaluated_count > 0:
            on_time_rate = round((on_time_count / evaluated_count) * 100, 1)
        else:
            on_time_rate = 95.0

        # Overall productivity score
        activity_bonus = min(20.0, (comp_count * 5.0) + (rev_count * 3.0))
        pts_factor = min(30.0, story_pts * 2.0)
        overall_score = round(min(100.0, 45.0 + pts_factor + activity_bonus + (task_quality * 0.1)), 1)
        
        # Real badges determination
        badges = []
        if comp_count >= 1 or rev_count >= 1:
            badges.append("Sprint Hero")
        if any("bug" in (t.title or "").lower() or "fix" in (t.title or "").lower() for t in tasks):
            badges.append("Bug Hunter")
        if on_time_rate >= 90.0:
            badges.append("Fast Finisher")
        if story_pts >= 10:
            badges.append("Top Performer")
        if total_tasks > 0:
            badges.append("Team Player")
        else:
            badges.append("Ready Contributor")
        
        raw_board.append({
            "developer_id": d.id,
            "developer_name": d.full_name,
            "avatar_url": d.avatar_url,
            "completed_tasks": comp_count,
            "story_points": story_pts,
            "task_quality_score": task_quality,
            "on_time_delivery_rate": on_time_rate,
            "overall_productivity_score": overall_score,
            "badges": badges[:3]
        })

    # Sort descending by overall productivity score
    raw_board.sort(key=lambda x: (x["overall_productivity_score"], x["completed_tasks"], x["story_points"]), reverse=True)
    
    leaderboard = []
    for idx, item in enumerate(raw_board):
        item["rank_position"] = idx + 1
        leaderboard.append(item)

    return leaderboard
