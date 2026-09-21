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
    from datetime import datetime
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

    target_project = db.query(Project).filter(Project.id == project_id).first() if project_id else db.query(Project).first()
    
    if not target_project:
        project_count = db.query(Project).count()
        if project_count == 0:
            return {
                "summary_type": type,
                "project_name": "No Active Projects",
                "content": "No engineering projects or telemetry records exist in the workspace yet.",
                "risk_score": 0.0,
                "health_status": "HEALTHY",
                "recommendations": ["Create an engineering project to activate AI intelligence analytics."],
                "insights": {}
            }
        p_name = "Organization Engineering Portfolio"
        all_tasks = db.query(Task).all()
        total = len(all_tasks)
        comp = len([t for t in all_tasks if t.status == "COMPLETED"])
        delayed = len([t for t in all_tasks if _parse_t_date(t.due_date) and _parse_t_date(t.due_date) < today and t.status != "COMPLETED"])
        active_devs = db.query(Profile).join(Profile.role).filter(Profile.role.has(name="developer")).count()
    else:
        p_name = target_project.name
        p_tasks = db.query(Task).filter(Task.project_id == target_project.id).all()
        total = len(p_tasks)
        comp = len([t for t in p_tasks if t.status == "COMPLETED"])
        delayed = len([t for t in p_tasks if _parse_t_date(t.due_date) and _parse_t_date(t.due_date) < today and t.status != "COMPLETED"])
        dev_ids = {t.assigned_developer_id for t in p_tasks if t.assigned_developer_id}
        active_devs = max(len(dev_ids), 1) if total > 0 else 0

    analysis = AIService.generate_project_health_analysis(
        project_name=p_name,
        total_tasks=total,
        completed_tasks=comp,
        delayed_tasks=delayed,
        active_devs=max(active_devs, 1)
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
    p_name = target_project.name if target_project else "SprintIQ AI Platform"
    
    tasks = db.query(Task).filter(Task.project_id == target_project.id).all() if target_project else []
    total = len(tasks)
    comp = len([t for t in tasks if t.status == "COMPLETED"])
    in_review = len([t for t in tasks if t.status == "REVIEW_PENDING"])
    in_prog = len([t for t in tasks if t.status == "IN_PROGRESS"])
    
    from datetime import datetime
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

    delayed = len([t for t in tasks if _parse_t_date(t.due_date) and _parse_t_date(t.due_date) < today and t.status != "COMPLETED"])
    bug_count = len([t for t in tasks if "bug" in (t.title or "").lower() or "fix" in (t.title or "").lower() or t.priority == "URGENT" or t.status == "REJECTED"])

    if total == 0:
        sprint_progress = 0.0
        score = 85
    else:
        task_progresses = []
        for t in tasks:
            if t.status == "COMPLETED":
                task_progresses.append(100.0)
            elif t.status == "REVIEW_PENDING":
                task_progresses.append(max(float(t.progress or 0), 90.0))
            elif t.status == "TESTING":
                task_progresses.append(max(float(t.progress or 0), 75.0))
            elif t.status == "IN_PROGRESS":
                task_progresses.append(max(float(t.progress or 0), 50.0))
            else:
                task_progresses.append(float(t.progress or 0))
        sprint_progress = round(sum(task_progresses) / total, 1)
        
        # Health score calculation
        raw_score = sprint_progress - (delayed * 10) - (bug_count * 5)
        if delayed == 0 and total > 0:
            raw_score += 5
        score = int(max(15, min(100, raw_score)))

    if score >= 80:
        status = "Excellent"
    elif score >= 65:
        status = "Good"
    elif score >= 45:
        status = "Needs Attention"
    else:
        status = "Critical"

    deadline_status = "DELAYED" if delayed > 1 else ("AT_RISK" if delayed == 1 else "ON_TRACK")
    team_productivity = round(min(100.0, max(30.0, (comp * 100 + in_review * 90 + in_prog * 60) / max(total * 100, 1) * 100)), 1) if total > 0 else 85.0

    explanation = (
        f"Project '{p_name}' health score is {score}/100 ({status}). "
        f"The team has completed {comp} and has {in_review} in review out of {total} assigned tasks with {delayed} delayed items. "
        f"Overall sprint progress is tracking at {sprint_progress}%."
    )

    return {
        "health_score": score,
        "health_status": status,
        "completed_tasks": comp,
        "delayed_tasks": delayed,
        "bug_count": bug_count,
        "sprint_progress": sprint_progress,
        "team_productivity": team_productivity,
        "deadline_status": deadline_status,
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
    result["id"] = "mm-101"
    result["created_at"] = "2026-08-15T11:00:00Z"
    return result

@router.get("/risk-prediction")
def get_risk_prediction(project_id: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    target_project = db.query(Project).filter(Project.id == project_id).first() if project_id else db.query(Project).first()
    p_name = target_project.name if target_project else "Organization Intelligence"

    # ML Predictor
    delay_prob = 0.0
    risk_level = "LOW"
    recommendations = []
    
    if target_project:
        try:
            from app.ml.predictor import MLPredictor
            predictor = MLPredictor()
            prediction = predictor.predict_project_delay(db, target_project.id)
            if "probability" in prediction:
                delay_prob = round(float(prediction["probability"]) * 100, 1)
            if "risk_level" in prediction:
                risk_level = prediction["risk_level"]
            if "contributing_factors" in prediction:
                for factor in prediction.get("contributing_factors", []):
                    recommendations.append(f"Mitigate {factor.get('factor')}: currently at {factor.get('value')}")
        except Exception as e:
            print(f"[RiskPrediction] ML Predictor failed: {e}")
            if target_project.ai_risk_score is not None:
                delay_prob = float(target_project.ai_risk_score)
                risk_level = "LOW" if delay_prob < 30 else ("MODERATE" if delay_prob < 60 else "CRITICAL")

    # Real tasks & developers
    tasks = db.query(Task).filter(Task.project_id == target_project.id).all() if target_project else []
    
    from datetime import datetime
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

    # High risk tasks: past due date or priority HIGH/URGENT and not COMPLETED
    high_risk_tasks = []
    for t in tasks:
        if t.status == "COMPLETED":
            continue
        due = _parse_t_date(t.due_date)
        if due and due < today:
            high_risk_tasks.append({
                "task_title": t.title,
                "risk_factor": "Past due date",
                "priority": t.priority or "HIGH"
            })
        elif t.priority in ["HIGH", "URGENT"] and (t.progress or 0) < 50:
            high_risk_tasks.append({
                "task_title": t.title,
                "risk_factor": "High priority item with low progress",
                "priority": t.priority
            })
    
    # Real developer workload
    dev_task_map: Dict[str, List[Task]] = {}
    for t in tasks:
        if t.assigned_developer_id:
            dev_task_map.setdefault(t.assigned_developer_id, []).append(t)
    
    overloaded_developers = []
    for dev_id, dtasks in dev_task_map.items():
        dev_profile = db.query(Profile).filter(Profile.id == dev_id).first()
        dev_name = dev_profile.full_name if dev_profile else "Assigned Developer"
        total_hours = sum(t.estimated_hours or 0.0 for t in dtasks)
        status_flag = "HIGH" if (len(dtasks) >= 4 or total_hours >= 30) else "NORMAL"
        overloaded_developers.append({
            "developer_name": dev_name,
            "assigned_tasks": len(dtasks),
            "estimated_hours": total_hours,
            "status": status_flag
        })
    
    overloaded_developers.sort(key=lambda d: d["assigned_tasks"], reverse=True)
    critical_bugs = len([t for t in tasks if t.priority == "URGENT" or t.status == "REJECTED"])

    if not recommendations:
        if high_risk_tasks:
            recommendations.append(f"Fast-track progress on '{high_risk_tasks[0]['task_title']}' to prevent delivery slippage.")
        if overloaded_developers and overloaded_developers[0]["status"] == "HIGH":
            recommendations.append(f"Reallocate tasks from {overloaded_developers[0]['developer_name']} to balance developer capacity.")
        if not recommendations:
            recommendations.append("Sprint execution velocity aligns with milestone targets.")

    return {
        "project_name": p_name,
        "sprint_delay_probability": delay_prob,
        "project_delay_risk": risk_level,
        "overloaded_developers": overloaded_developers[:5],
        "high_risk_tasks": high_risk_tasks[:5],
        "critical_bugs": critical_bugs,
        "ai_recommendations": recommendations[:3]
    }

