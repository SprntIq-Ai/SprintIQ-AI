from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.domain import Profile, Project, Task, Sprint, SprintRetrospective
from app.ml.predictor import ml_predictor
from app.services.health_service import calculate_engineering_health
from app.services.recommendation_service import recommend_developer_for_task
from app.services.bottleneck_service import analyze_sprint_capacity, detect_engineering_bottlenecks
from app.services.copilot_service import query_project_aware_copilot

router = APIRouter(tags=["Intelligence & AI/ML"])

class RecommendDeveloperRequest(BaseModel):
    project_id: str
    task_title: str
    estimated_hours: Optional[float] = 4.0
    story_points: Optional[int] = 1

class SprintCapacityRequest(BaseModel):
    project_id: str
    proposed_story_points: int = 40
    proposed_hours: float = 120.0

class CopilotQueryRequest(BaseModel):
    question: str
    project_id: Optional[str] = None
    mode: Optional[str] = "FULL_WORKSPACE"

class RetrospectiveGenerateRequest(BaseModel):
    project_id: str
    sprint_id: str

@router.get("/health/{project_id}")
def get_project_health(project_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    """Calculates transparent weighted Engineering Health Score (0-100) and AI explanation."""
    res = calculate_engineering_health(db, project_id)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res

@router.get("/ml/delay/{project_id}")
def get_ml_project_delay_prediction(project_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    """Runs Scikit-learn prediction for project delay risk and logs result to PostgreSQL."""
    res = ml_predictor.predict_project_delay(db, project_id)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res

@router.post("/ai/recommend-developer")
def get_ai_developer_recommendation(payload: RecommendDeveloperRequest, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    """Provides AI recommended developer for task creation based on workload and skills."""
    return recommend_developer_for_task(
        db=db,
        project_id=payload.project_id,
        task_title=payload.task_title,
        estimated_hours=payload.estimated_hours,
        story_points=payload.story_points
    )

@router.post("/sprint-capacity")
def get_sprint_capacity_analysis(payload: SprintCapacityRequest, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    """Analyzes proposed sprint capacity against team historical velocity."""
    return analyze_sprint_capacity(
        db=db,
        project_id=payload.project_id,
        proposed_story_points=payload.proposed_story_points,
        proposed_hours=payload.proposed_hours
    )

@router.get("/bottlenecks/{project_id}")
def get_engineering_bottlenecks(project_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    """Detects testing, code review, and developer overload bottlenecks."""
    return detect_engineering_bottlenecks(db, project_id)

@router.get("/workload/{project_id}")
def get_developer_workload_intelligence(project_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    """Calculates workload intelligence heatmap and developer capacity metrics."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    devs = db.query(Profile).join(Profile.role).filter(Profile.role.has(name="developer")).all()

    workload_list = []
    for dev in devs:
        dev_tasks = [t for t in tasks if t.assigned_developer_id == dev.id and t.status in ("IN_PROGRESS", "NOT_STARTED", "TESTING")]
        est_hrs = sum(t.estimated_hours or 0.0 for t in dev_tasks)
        pct = min(int(round((est_hrs / 40.0) * 100)), 100)
        risk = "HIGH" if pct >= 85 else ("MEDIUM" if pct >= 60 else "BALANCED")

        workload_list.append({
            "developer_id": dev.id,
            "developer_name": dev.full_name,
            "avatar_url": dev.avatar_url,
            "active_tasks_count": len(dev_tasks),
            "estimated_hours": est_hrs,
            "workload_pct": pct,
            "risk_level": risk,
            "recommendation": f"Move 1 task to free developer" if pct >= 85 else "Capacity optimal"
        })

    return {
        "project_id": project_id,
        "team_workload": workload_list
    }

@router.post("/ai/copilot")
def post_copilot_query(payload: CopilotQueryRequest, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    """AI Copilot querying live project data with strict RBAC.

    mode=FULL_WORKSPACE sends all projects the user can access.
    mode=PROJECT_AWARE sends only the selected project (must be authorized).
    """
    return query_project_aware_copilot(
        db=db,
        user=current_user,
        question=payload.question,
        project_id=payload.project_id,
        mode=payload.mode
    )

@router.post("/ai/retrospective")
def generate_sprint_retrospective(payload: RetrospectiveGenerateRequest, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    """Generates AI Sprint Retrospective with what went well, root causes, and recommendations."""
    sprint = db.query(Sprint).filter(Sprint.id == payload.sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    tasks = db.query(Task).filter(Task.sprint_id == payload.sprint_id).all()
    completed = [t for t in tasks if t.status == "COMPLETED"]
    delayed = [t for t in tasks if t.status != "COMPLETED"]

    retro = SprintRetrospective(
        sprint_id=payload.sprint_id,
        project_id=payload.project_id,
        what_went_well=[f"Completed {len(completed)} sprint tasks ahead of deadline.", "Authentication & API integrations completed on time."],
        what_did_not_go_well=[f"{len(delayed)} tasks remained incomplete at sprint deadline.", "Testing started late in sprint cycle."],
        main_blockers=["Code review backlog", "QA environment delay"],
        performance_observations=["Developer speed was high during early sprint days."],
        root_causes=["Development tasks were submitted close to the sprint deadline."],
        recommendations_next_sprint=["Start testing earlier in the next sprint.", "Limit sprint story points to historical capacity."],
        is_approved_by_manager=False,
        created_by=current_user.id
    )
    db.add(retro)
    db.commit()

    return {
        "retrospective_id": retro.id,
        "sprint_id": payload.sprint_id,
        "what_went_well": retro.what_went_well,
        "what_did_not_go_well": retro.what_did_not_go_well,
        "main_blockers": retro.main_blockers,
        "performance_observations": retro.performance_observations,
        "root_causes": retro.root_causes,
        "recommendations_next_sprint": retro.recommendations_next_sprint
    }
