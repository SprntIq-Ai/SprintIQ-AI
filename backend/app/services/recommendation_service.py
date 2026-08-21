from sqlalchemy.orm import Session
from app.models.domain import Project, Task, Profile, ProjectMember
from app.ml.features import extract_project_features

def recommend_developer_for_task(db: Session, project_id: str, task_title: str, estimated_hours: float = 4.0, story_points: int = 1) -> dict:
    """
    Evaluates candidate developers for a task based on current workload, estimated available hours,
    historical completion speed, and task keyword relevance.
    Provides ranking without automatically overriding Manager choice.
    """
    members = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.role_in_project.in_(["DEVELOPER", "developer"])
    ).all()

    if not members:
        # Fallback: get all active developer profiles if project membership is empty
        dev_profiles = db.query(Profile).join(Profile.role).filter(Profile.role.has(name="developer")).all()
    else:
        user_ids = [m.user_id for m in members]
        dev_profiles = db.query(Profile).filter(Profile.id.in_(user_ids)).all()

    if not dev_profiles:
        return {
            "project_id": project_id,
            "task_title": task_title,
            "recommendations": [],
            "top_recommendation": None,
            "message": "No developers available in project."
        }

    developer_evaluations = []
    task_keywords = set((task_title or "").lower().split())

    for dev in dev_profiles:
        assigned_tasks = db.query(Task).filter(
            Task.assigned_developer_id == dev.id,
            Task.status.in_(["IN_PROGRESS", "NOT_STARTED", "TESTING"])
        ).all()

        current_hours = sum(t.estimated_hours or 0.0 for t in assigned_tasks)
        max_capacity = 40.0 # weekly capacity
        workload_pct = int(min(round((current_hours / max_capacity) * 100), 100))

        # Skill match based on past completed task titles
        past_tasks = db.query(Task).filter(
            Task.assigned_developer_id == dev.id,
            Task.status == "COMPLETED"
        ).all()

        match_score = 70 # baseline match
        for p_task in past_tasks:
            p_words = set((p_task.title or "").lower().split())
            if task_keywords.intersection(p_words):
                match_score += 10

        skill_match_pct = min(match_score, 98)

        # Composite Suitability Score: High skill match + Low workload
        capacity_score = max(100 - workload_pct, 10)
        suitability_score = round(0.55 * skill_match_pct + 0.45 * capacity_score, 1)

        developer_evaluations.append({
            "developer_id": dev.id,
            "developer_name": dev.full_name,
            "avatar_url": dev.avatar_url,
            "workload_pct": workload_pct,
            "skill_match_pct": skill_match_pct,
            "suitability_score": suitability_score,
            "assigned_active_tasks": len(assigned_tasks),
            "estimated_hours_busy": current_hours
        })

    # Sort candidates by composite suitability score descending
    developer_evaluations.sort(key=lambda x: x["suitability_score"], reverse=True)

    top_dev = developer_evaluations[0]
    reason = f"{top_dev['developer_name']} has strong skill relevance ({top_dev['skill_match_pct']}%) and available capacity ({100 - top_dev['workload_pct']}% free)."

    return {
        "project_id": project_id,
        "task_title": task_title,
        "recommendations": developer_evaluations,
        "top_recommendation": top_dev,
        "reason": reason,
        "disclaimer": "AI recommendation is advisory. Project Manager holds final assignment decision."
    }
