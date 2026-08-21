import json
import os
from sqlalchemy.orm import Session
from datetime import datetime, date
from app.models.domain import Project, Task, Sprint, ProjectMember, ProjectHealth
from app.ml.features import extract_project_features
from app.core.config import settings

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

def calculate_engineering_health(db: Session, project_id: str) -> dict:
    """
    Calculates transparent weighted Engineering Health Score (0-100) from real MySQL project data.
    Generates AI explanations via Gemini API.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return {"error": "Project not found"}

    raw = extract_project_features(db, project_id)

    # Component Scores (0-100)
    tc_score = min(raw.get("completion_rate", 0.0) * 100.0, 100.0)
    sv_score = min((raw.get("avg_sprint_velocity", 10.0) / 40.0) * 100.0, 100.0)
    da_score = min(raw.get("deadline_adherence", 0.85) * 100.0, 100.0)
    
    # Workload score (Optimal around 70-85%, drops if >100% overloaded or <30% underutilized)
    w_ratio = raw.get("workload_ratio", 0.8)
    if w_ratio <= 1.0:
        dw_score = min(w_ratio * 100.0, 100.0)
    else:
        dw_score = max(100.0 - (w_ratio - 1.0) * 80.0, 20.0)

    # Bug / Quality Rate Score
    total_t = max(raw.get("total_tasks", 1.0), 1.0)
    bug_c = raw.get("high_priority_bugs", 0.0)
    bq_score = max(100.0 - (bug_c / total_t) * 150.0, 10.0)

    # Transparent Weighted Scoring Formula
    overall_health_score = int(round(
        0.25 * tc_score +
        0.20 * sv_score +
        0.20 * da_score +
        0.20 * dw_score +
        0.15 * bq_score
    ))
    overall_health_score = max(min(overall_health_score, 100), 0)

    # Categorize Health Status & Risk Level
    if overall_health_score >= 80:
        health_status = "HEALTHY"
        risk_level = "LOW"
    elif overall_health_score >= 60:
        health_status = "NEEDS_ATTENTION"
        risk_level = "MEDIUM"
    elif overall_health_score >= 40:
        health_status = "AT_RISK"
        risk_level = "HIGH"
    else:
        health_status = "CRITICAL"
        risk_level = "CRITICAL"

    factors = {
        "task_completion": f"{int(round(tc_score))}%",
        "sprint_velocity": f"{int(round(sv_score))}%",
        "deadline_adherence": f"{int(round(da_score))}%",
        "developer_workload": f"{int(round(dw_score))}%",
        "bug_rate": f"{int(round(bq_score))}%"
    }

    # Gemini Generative AI Explanation
    ai_explanation = generate_health_ai_explanation(
        project_name=project.name,
        health_score=overall_health_score,
        health_status=health_status,
        factors=factors
    )

    recommended_actions = generate_recommended_actions(overall_health_score, factors)

    # Save snapshot record in project_health table
    health_record = ProjectHealth(
        project_id=project_id,
        health_score=overall_health_score,
        health_status=health_status,
        completed_tasks=int(raw.get("completed_tasks", 0)),
        delayed_tasks=int(raw.get("overdue_tasks", 0)),
        bug_count=int(raw.get("high_priority_bugs", 0)),
        sprint_progress=round(tc_score, 1),
        team_productivity=round(sv_score, 1),
        deadline_status="ON_TRACK" if da_score >= 75 else "BEHIND",
        ai_explanation=ai_explanation,
        created_at=datetime.utcnow()
    )
    db.add(health_record)
    db.commit()

    return {
        "project_id": project_id,
        "project_name": project.name,
        "health_score": overall_health_score,
        "health_status": health_status,
        "risk_level": risk_level,
        "factors": factors,
        "ai_explanation": ai_explanation,
        "recommended_actions": recommended_actions,
        "calculated_at": datetime.utcnow().isoformat()
    }

def generate_health_ai_explanation(project_name: str, health_score: int, health_status: str, factors: dict) -> str:
    """Invokes Gemini API to produce human-readable explanation of health factors."""
    prompt = (
        f"Project: {project_name}\n"
        f"Health Score: {health_score}/100 ({health_status})\n"
        f"Factors Breakdown: Task Completion: {factors['task_completion']}, Sprint Velocity: {factors['sprint_velocity']}, "
        f"Deadline Adherence: {factors['deadline_adherence']}, Developer Workload: {factors['developer_workload']}, "
        f"Bug Quality Score: {factors['bug_rate']}.\n"
        f"Provide a concise, 2-sentence executive summary explaining what is going well and what specific risk area needs attention."
    )

    if genai and settings.GEMINI_API_KEY:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt
            )
            if response and response.text:
                return response.text.strip()
        except Exception:
            pass

    # Fallback explanation if Gemini is unavailable
    if health_score >= 80:
        return f"Project health is currently good, with strong task completion ({factors['task_completion']}) and balanced velocity."
    elif health_score >= 60:
        return f"Project health is stable, but deadline adherence ({factors['deadline_adherence']}) and developer workload require close monitoring."
    else:
        return f"Project health is at risk due to a backlog of overdue tasks and high workload tension ({factors['developer_workload']})."

def generate_recommended_actions(score: int, factors: dict) -> list:
    actions = []
    if int(factors['task_completion'].replace('%', '')) < 70:
        actions.append("Re-evaluate unassigned tasks and prioritize high-impact deliverables for the current sprint.")
    if int(factors['developer_workload'].replace('%', '')) < 65:
        actions.append("Rebalance workload across developers to prevent burnout on key team members.")
    if int(factors['deadline_adherence'].replace('%', '')) < 75:
        actions.append("Schedule a mini-sync to review blocked tasks and clear testing bottlenecks.")
    if not actions:
        actions.append("Maintain current sprint pacing and continue regular PR code reviews.")
    return actions
