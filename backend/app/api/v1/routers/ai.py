from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from app.core.database import get_db
from app.models.domain import Profile, Project, Task, AIHistory
from app.schemas.pydantic_models import AIChatRequest, AIAnalysisResponse
from app.api.deps import get_current_user
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["AI Module"])

@router.get("/summary")
def get_ai_summary(type: str = "daily", project_id: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    target_project = db.query(Project).filter(Project.id == project_id).first() if project_id else db.query(Project).first()
    p_name = target_project.name if target_project else "Engineering Portfolio"
    
    total = db.query(Task).filter(Task.project_id == target_project.id).count() if target_project else 24
    comp = db.query(Task).filter(Task.project_id == target_project.id, Task.status == "COMPLETED").count() if target_project else 16
    delayed = db.query(Task).filter(Task.project_id == target_project.id, Task.status != "COMPLETED").count() if target_project else 3

    analysis = AIService.generate_project_health_analysis(
        project_name=p_name,
        total_tasks=total,
        completed_tasks=comp,
        delayed_tasks=delayed,
        active_devs=4
    )

    # Record AI query history
    ai_record = AIHistory(
        user_id=current_user.id,
        prompt=f"Generate {type} summary for {p_name}",
        response=analysis["summary"],
        feature_type=f"{type.upper()}_SUMMARY",
        context_data=analysis
    )
    db.add(ai_record)
    db.commit()

    return {
        "summary_type": type,
        "project_name": p_name,
        "content": analysis["summary"],
        "risk_score": analysis["risk_score"],
        "health_status": analysis["health_status"],
        "recommendations": analysis["recommendations"],
        "insights": analysis.get("insights", {})
    }

@router.post("/chat")
def chat_with_gemini(req: AIChatRequest, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    user_role = current_user.role.name.lower() if current_user.role else "developer"
    context = {
        "user_name": current_user.full_name,
        "user_role": user_role,
        "project_id": req.project_id
    }
    
    answer = AIService.generate_chat_response(req.prompt, context)

    ai_record = AIHistory(
        user_id=current_user.id,
        prompt=req.prompt,
        response=answer,
        feature_type="CHAT",
        context_data=context
    )
    db.add(ai_record)
    db.commit()

    return {
        "prompt": req.prompt,
        "response": answer,
        "created_at": ai_record.created_at
    }

@router.get("/health-score")
def get_ai_health_score(project_id: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    target_project = db.query(Project).filter(Project.id == project_id).first() if project_id else db.query(Project).first()
    p_name = target_project.name if target_project else "SprintIQ AI SaaS"
    
    total = db.query(Task).filter(Task.project_id == target_project.id).count() if target_project else 10
    comp = db.query(Task).filter(Task.project_id == target_project.id, Task.status == "COMPLETED").count() if target_project else 7
    delayed = db.query(Task).filter(Task.project_id == target_project.id, Task.status == "REJECTED").count() if target_project else 1
    
    score = int(max(0, min(100, (comp / max(total, 1)) * 100 - delayed * 5)))
    if score >= 85:
        status = "Excellent"
    elif score >= 70:
        status = "Good"
    elif score >= 50:
        status = "Needs Attention"
    else:
        status = "Critical"

    explanation = (
        f"Project '{p_name}' health score is {score}/100 ({status}). "
        f"The team has completed {comp} out of {total} assigned tasks with {delayed} delayed items. "
        f"Sprint velocity and team productivity are maintaining strong alignment."
    )

    return {
        "health_score": score,
        "health_status": status,
        "completed_tasks": comp,
        "delayed_tasks": delayed,
        "bug_count": 2,
        "sprint_progress": round((comp / max(total, 1)) * 100, 1),
        "team_productivity": 94.2,
        "deadline_status": "ON_TRACK",
        "ai_explanation": explanation
    }

@router.post("/sprint-planner")
def plan_sprint_with_ai(req: Dict[str, Any], db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == req.get("project_id")).first() if req.get("project_id") else db.query(Project).first()
    p_name = project.name if project else "SprintIQ AI Platform"
    focus = req.get("target_focus", "Velocity")
    return AIService.generate_sprint_plan(project_name=p_name, target_focus=focus)

@router.post("/task-generator")
def generate_task_with_ai(req: Dict[str, Any], db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    title = req.get("title", "New Feature Task")
    return AIService.generate_task_details(title=title)

@router.get("/daily-standup")
def get_daily_standup_report(project_id: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first() if project_id else db.query(Project).first()
    p_name = project.name if project else "SprintIQ AI"
    return AIService.generate_daily_standup(project_name=p_name)

@router.get("/weekly-report")
def get_weekly_ai_report(project_id: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first() if project_id else db.query(Project).first()
    p_name = project.name if project else "SprintIQ AI"
    return AIService.generate_weekly_report(project_name=p_name)

@router.post("/meeting-minutes")
def create_meeting_minutes(req: Dict[str, Any], db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    title = req.get("title", "Sprint Sync Meeting")
    notes = req.get("raw_notes", "Discussed roadmap and pending PRs.")
    result = AIService.generate_meeting_minutes(title=title, raw_notes=notes)
    result["id"] = "mm-" + str(uuid_generate() if hasattr(db, 'uuid_generate') else "101")
    result["created_at"] = "2026-08-15T11:00:00Z"
    return result

@router.get("/risk-prediction")
def get_risk_prediction(project_id: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first() if project_id else db.query(Project).first()
    p_name = project.name if project else "SprintIQ Engine"
    
    return {
        "project_name": p_name,
        "sprint_delay_probability": 14.5,
        "project_delay_risk": "LOW" if (project and project.ai_risk_score < 30) else "MODERATE",
        "overloaded_developers": [
            {"developer_name": "Michael Chen (Dev)", "assigned_tasks": 5, "estimated_hours": 32.0, "status": "HIGH"}
        ],
        "high_risk_tasks": [
            {"task_title": "Integrate Google Gemini API", "risk_factor": "Near due date", "priority": "HIGH"}
        ],
        "critical_bugs": 0,
        "ai_recommendations": [
            "Shift 1 QA engineer to automated regression tests",
            "Fast-track code review for authentication PR"
        ]
    }

