from sqlalchemy.orm import Session
from datetime import date, datetime
from app.models.domain import Project, Task, Sprint, ProjectMember, GitHubPullRequest, GitHubReview

def analyze_sprint_capacity(db: Session, project_id: str, proposed_story_points: int = 40, proposed_hours: float = 120.0) -> dict:
    """
    Analyzes proposed sprint scope against team historical velocity and current workload capacity.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return {"error": "Project not found"}

    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    dev_count = max(sum(1 for m in members if m.role_in_project in ("DEVELOPER", "developer")), 1)

    # Historical sprint velocity
    completed_sprints = db.query(Sprint).filter(
        Sprint.project_id == project_id,
        Sprint.status == "COMPLETED"
    ).all()

    if completed_sprints:
        velocities = []
        for s in completed_sprints:
            pts = sum(t.story_points or 1 for t in s.tasks if t.status == "COMPLETED")
            velocities.append(pts)
        historical_velocity = int(round(float(sum(velocities) / len(velocities))))
    else:
        historical_velocity = dev_count * 15 # default 15 pts per dev

    available_hours = dev_count * 40.0 # weekly hours

    exceeds_capacity = (proposed_story_points > historical_velocity * 1.15) or (proposed_hours > available_hours * 1.1)

    if exceeds_capacity:
        status = "WARNING"
        result_message = "The proposed sprint exceeds the team's historical capacity."
        recommended_scope = f"Reduce scope from {proposed_story_points} to {historical_velocity} Story Points."
    else:
        status = "BALANCED"
        result_message = "Proposed sprint is within team's historical capacity."
        recommended_scope = f"Current scope of {proposed_story_points} Story Points is optimal."

    return {
        "project_id": project_id,
        "team_dev_count": dev_count,
        "available_hours": available_hours,
        "historical_velocity_points": historical_velocity,
        "proposed_story_points": proposed_story_points,
        "proposed_hours": proposed_hours,
        "status": status,
        "result_message": result_message,
        "recommended_scope": recommended_scope,
        "recommendations": [
            "Keep high-priority user stories in the sprint backlog.",
            f"Cap story points at {historical_velocity} points for sustainable velocity."
        ]
    }

def detect_engineering_bottlenecks(db: Session, project_id: str) -> dict:
    """
    Scans project tasks, PR reviews, and work states to identify delivery bottlenecks.
    """
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    bottlenecks = []

    # 1. Testing Bottleneck
    testing_tasks = [t for t in tasks if t.status == "TESTING"]
    if len(testing_tasks) >= 3:
        bottlenecks.append({
            "type": "TESTING_BACKLOG",
            "problem": "Testing Backlog",
            "cause": f"{len(testing_tasks)} tasks are currently waiting for testing & QA validation.",
            "impact": f"Estimated {min(len(testing_tasks), 5)}-day delivery delay.",
            "recommendation": "Move one available developer to review and run integration test suites."
        })

    # 2. Review Queue Bottleneck
    review_tasks = [t for t in tasks if t.status == "REVIEW_PENDING"]
    if len(review_tasks) >= 2:
        bottlenecks.append({
            "type": "REVIEW_BACKLOG",
            "problem": "Code Review Bottleneck",
            "cause": f"{len(review_tasks)} completed developer tasks awaiting Manager approval.",
            "impact": "Delays task completion status and sprint velocity metrics.",
            "recommendation": "Project Manager should review pending code submissions today."
        })

    # 3. Overdue Tasks Bottleneck
    today = date.today()
    overdue = [t for t in tasks if t.due_date and t.due_date < today and t.status != "COMPLETED"]
    if len(overdue) > 0:
        bottlenecks.append({
            "type": "OVERDUE_TASKS",
            "problem": "Overdue Schedule Bottleneck",
            "cause": f"{len(overdue)} tasks have exceeded their scheduled due date.",
            "impact": "Increases ML project delay risk probability score.",
            "recommendation": "Reassign tasks or adjust task due dates to align with sprint target."
        })

    if not bottlenecks:
        bottlenecks.append({
            "type": "NONE",
            "problem": "No Active Bottlenecks",
            "cause": "Tasks are moving smoothly through development and testing pipelines.",
            "impact": "Optimal delivery speed.",
            "recommendation": "Maintain current development momentum."
        })

    return {
        "project_id": project_id,
        "bottlenecks_count": len([b for b in bottlenecks if b["type"] != "NONE"]),
        "bottlenecks": bottlenecks
    }
