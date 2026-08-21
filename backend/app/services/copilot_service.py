import json
from collections import defaultdict
from sqlalchemy.orm import Session
from datetime import datetime, date
from app.models.domain import (
    Project, Task, Profile, Sprint, ProjectMember, AIHistory,
    GitHubRepository, EngineeringMetrics, AIInsight, SystemSetting
)
from app.services.ai_service import gemini_generate

FULL_WORKSPACE = "FULL_WORKSPACE"
PROJECT_AWARE = "PROJECT_AWARE"

SYSTEM_PROMPT_FULL_WORKSPACE = (
    "You are SprintIQ AI Copilot. You are analyzing the authenticated user's "
    "accessible SprintIQ workspace. The following context contains ALL projects "
    "and related engineering data that this user is authorized to access. "
    "Answer questions using only this provided context. Do not claim that only "
    "one project exists unless the context actually contains one project."
)

SYSTEM_PROMPT_PROJECT_AWARE = (    "You are SprintIQ AI Copilot operating in Project-Aware mode. Analyze only "
    "the selected project and its provided related data."
)


def _get_accessible_projects(db: Session, user: Profile, user_role: str) -> list:
    """Returns the projects the authenticated user is allowed to access.

    - admin: every project
    - manager: projects where projects.manager_id == user.id OR the user holds a
      MANAGER project_members row
    - developer: projects via the existing project_members assignment relationship
    Filtering happens here, BEFORE any AI context is built.
    """
    if user_role == "admin":
        return db.query(Project).order_by(Project.created_at.desc()).all()

    if user_role == "manager":
        managed = db.query(Project).filter(Project.manager_id == user.id).all()
        memberships = db.query(ProjectMember).filter(
            ProjectMember.user_id == user.id,
            ProjectMember.role_in_project == "MANAGER"
        ).all()
        ids = {p.id for p in managed} | {m.project_id for m in memberships}
        if not ids:
            return []
        return db.query(Project).filter(Project.id.in_(ids)).order_by(Project.created_at.desc()).all()

    # developer — project_members is the existing developer-project assignment
    memberships = db.query(ProjectMember).filter(ProjectMember.user_id == user.id).all()
    ids = {m.project_id for m in memberships}
    if not ids:
        return []
    return db.query(Project).filter(Project.id.in_(ids)).order_by(Project.created_at.desc()).all()


def _build_project_context(db: Session, user: Profile, projects: list,
                           accessible_ids: list, mode: str,
                           selected_project_id: str) -> dict:
    """Builds a structured multi-project context efficiently (no N+1 loops).

    Related data (tasks, sprints, members, GitHub repos, engineering metrics,
    AI insights, manager profiles) is bulk-loaded once and grouped in memory.
    """
    project_ids = [p.id for p in projects]
    today = date.today()

    # --- Bulk load related data for ALL target projects ---
    tasks_by_proj = defaultdict(list)
    if project_ids:
        for t in db.query(Task).filter(Task.project_id.in_(project_ids)).all():
            tasks_by_proj[t.project_id].append(t)

    sprints_by_proj = defaultdict(list)
    if project_ids:
        for s in db.query(Sprint).filter(Sprint.project_id.in_(project_ids)).all():
            sprints_by_proj[s.project_id].append(s)

    members_by_proj = defaultdict(list)
    if project_ids:
        for m in db.query(ProjectMember).filter(ProjectMember.project_id.in_(project_ids)).all():
            members_by_proj[m.project_id].append(m)

    repos_by_proj = defaultdict(list)
    if project_ids:
        for r in db.query(GitHubRepository).filter(GitHubRepository.project_id.in_(project_ids)).all():
            repos_by_proj[r.project_id].append(r)

    metrics_by_proj = {}
    if project_ids:
        for e in db.query(EngineeringMetrics).filter(EngineeringMetrics.project_id.in_(project_ids)).all():
            metrics_by_proj[e.project_id] = e

    insights_by_proj = defaultdict(list)
    if project_ids:
        for i in db.query(AIInsight).filter(AIInsight.project_id.in_(project_ids))\
                .order_by(AIInsight.created_at.desc()).all():
            insights_by_proj[i.project_id].append(i)

    manager_ids = {p.manager_id for p in projects if p.manager_id}
    manager_names = {}
    if manager_ids:
        for prof in db.query(Profile).filter(Profile.id.in_(manager_ids)).all():
            manager_names[prof.id] = prof.full_name

    context_projects = []
    for p in projects:
        p_tasks = tasks_by_proj.get(p.id, [])
        p_sprints = sprints_by_proj.get(p.id, [])
        p_members = members_by_proj.get(p.id, [])
        p_repos = repos_by_proj.get(p.id, [])
        p_metrics = metrics_by_proj.get(p.id)
        p_insights = insights_by_proj.get(p.id, [])

        total_tasks = len(p_tasks)
        completed_tasks = sum(1 for t in p_tasks if t.status == "COMPLETED")
        pending_tasks = sum(1 for t in p_tasks if t.status not in ("COMPLETED", "REJECTED"))
        in_progress_tasks = sum(1 for t in p_tasks if t.status in ("IN_PROGRESS", "TESTING", "REVIEW_PENDING"))
        overdue_tasks = [t for t in p_tasks if t.due_date and t.due_date < today and t.status != "COMPLETED"]
        progress = round((completed_tasks / max(total_tasks, 1)) * 100, 1)

        active_sprints = [s for s in p_sprints if s.status == "ACTIVE"]
        current_sprint = None
        if active_sprints:
            s = active_sprints[0]
            s_tasks = [t for t in p_tasks if t.sprint_id == s.id]
            current_sprint = {
                "name": s.name,
                "goal": s.goal,
                "start_date": s.start_date.isoformat() if s.start_date else None,
                "end_date": s.end_date.isoformat() if s.end_date else None,
                "total_tasks": len(s_tasks),
                "completed_tasks": sum(1 for t in s_tasks if t.status == "COMPLETED"),
                "in_progress_tasks": sum(1 for t in s_tasks if t.status in ("IN_PROGRESS", "TESTING", "REVIEW_PENDING")),
                "not_started_tasks": sum(1 for t in s_tasks if t.status == "NOT_STARTED"),
            }

        developers_count = sum(1 for m in p_members if m.role_in_project.upper() == "DEVELOPER")

        repo = p_repos[0] if p_repos else None
        gh_connected = repo is not None and repo.sync_status == "SYNCED"
        gh_context = {
            "repo_connected": gh_connected,
            "repo_name": repo.repo_name if repo else None,
            "html_url": repo.html_url if repo else None,
            "sync_status": repo.sync_status if repo else "NOT_CONNECTED",
            "open_prs_count": (p_metrics.open_prs_count if p_metrics else (repo.open_prs_count if repo else 0)),
            "merged_prs_count": (p_metrics.merged_prs_count if p_metrics else 0),
            "commit_frequency_weekly": (p_metrics.commit_frequency_weekly if p_metrics else 0.0),
            "pr_cycle_time_avg_hours": (p_metrics.pr_cycle_time_avg_hours if p_metrics else 0.0),
            "testing_bottleneck_score": (p_metrics.testing_bottleneck_score if p_metrics else 0.0),
            "review_bottleneck_score": (p_metrics.review_bottleneck_score if p_metrics else 0.0),
        }

        latest_insight = p_insights[0] if p_insights else None

        context_projects.append({
            "project_id": p.id,
            "project_key": p.key,
            "project_name": p.name,
            "description": p.description,
            "status": p.status,
            "manager_id": p.manager_id,
            "manager_name": manager_names.get(p.manager_id, "Unassigned"),
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "progress_percentage": progress,
            "health_status": p.health_status,
            "risk_score": p.ai_risk_score,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "in_progress_tasks": in_progress_tasks,
            "overdue_tasks_count": len(overdue_tasks),
            "overdue_tasks_sample": [t.title for t in overdue_tasks[:3]],
            "developers_count": developers_count,
            "current_sprint": current_sprint,
            "github": gh_context,
            "latest_ai_insight": latest_insight.summary if latest_insight else None,
            "active_bottlenecks": [
                b for b in (
                    ["Testing Backlog"] if sum(1 for t in p_tasks if t.status == "TESTING") >= 3 else [],
                    ["Code Review Backlog"] if sum(1 for t in p_tasks if t.status == "REVIEW_PENDING") >= 2 else [],
                    ["Overdue Tasks"] if overdue_tasks else [],
                ) for b in b
            ],
        })

    context_data = {
        "mode": mode,
        "accessible_project_count": len(accessible_ids),
        "accessible_project_ids": accessible_ids,
        "selected_project_id": selected_project_id if mode == PROJECT_AWARE else None,
        "user_role": user.role.name if user.role else "developer",
        "projects": context_projects,
    }
    return context_data


def query_project_aware_copilot(db: Session, user: Profile, question: str,
                                project_id: str = None,
                                mode: str = FULL_WORKSPACE) -> dict:
    """Project-Aware / Full-Workspace AI Copilot.

    Determines the authenticated user's accessible projects by role, builds a
    structured multi-project context from the real database & GitHub, invokes
    the Gemini API, and enforces RBAC boundaries BEFORE any context is sent.

    mode:
      - FULL_WORKSPACE: context contains ALL projects accessible to the user
      - PROJECT_AWARE:  context contains only the selected project
    """
    user_role = user.role.name if user.role else "developer"

    ai_context_setting = db.query(SystemSetting).filter(SystemSetting.setting_key == "ai_project_context").first()
    context_scope = ai_context_setting.setting_value if ai_context_setting else "all_accessible"

    if context_scope == "all_accessible":
        mode = FULL_WORKSPACE
    elif context_scope == "assigned":
        mode = FULL_WORKSPACE  # In reality, this might differ if developers can view other things, but here devs only see assigned anyway
    else:
        # Default to whatever it was before, or override with system settings if present
        mode = (mode or FULL_WORKSPACE).upper()
        if mode not in (FULL_WORKSPACE, PROJECT_AWARE):
            mode = PROJECT_AWARE if project_id else FULL_WORKSPACE

    # RBAC: determine allowed projects BEFORE building any context
    accessible_projects = _get_accessible_projects(db, user, user_role)
    accessible_ids = [p.id for p in accessible_projects]

    # Safe development logging — never log passwords, tokens, or API keys
    print(f"[AICopilot] user_id={user.id} role={user_role} mode={mode} "
          f"accessible_project_count={len(accessible_ids)} "
          f"project_ids={accessible_ids} selected_project_id={project_id}")

    # PROJECT_AWARE: enforce that the selected project is authorized
    selected_project_id = project_id
    if mode == PROJECT_AWARE:
        if not selected_project_id and accessible_ids:
            selected_project_id = accessible_ids[0]
        if selected_project_id and selected_project_id not in accessible_ids:
            return {"error": "Unauthorized access to this project.",
                    "answer": "You are not authorized to view details for this project."}
        target_projects = [p for p in accessible_projects if p.id == selected_project_id]
    else:
        # FULL_WORKSPACE: ignore a stray project_id; send every accessible project
        selected_project_id = None
        target_projects = accessible_projects

    # Build structured multi-project context
    context_data = _build_project_context(
        db, user, target_projects, accessible_ids, mode, selected_project_id
    )

    # Metadata makes the scope explicit to Gemini
    metadata = {
        "mode": mode,
        "accessible_project_count": len(accessible_ids),
        "accessible_project_ids": accessible_ids,
        "selected_project_id": selected_project_id if mode == PROJECT_AWARE else None,
    }

    # Mode-specific system prompt
    if mode == PROJECT_AWARE:
        system_prompt = (
            f"{SYSTEM_PROMPT_PROJECT_AWARE}\n\n"
            f"Context Metadata:\n{json.dumps(metadata, indent=2)}\n\n"
            f"Context Data:\n{json.dumps(context_data, indent=2)}\n\n"
            f"User Question: {question}\n"
        )
    else:
        system_prompt = (
            f"{SYSTEM_PROMPT_FULL_WORKSPACE}\n\n"
            f"Context Metadata:\n{json.dumps(metadata, indent=2)}\n\n"
            f"Context Data:\n{json.dumps(context_data, indent=2)}\n\n"
            f"User Question: {question}\n"
        )

    answer = gemini_generate(system_prompt)

    # Store AI History
    history = AIHistory(
        user_id=user.id,
        prompt=question,
        response=answer,
        feature_type="COPLIOT_WORKSPACE" if mode == FULL_WORKSPACE else "PROJECT_AWARE_COPILOT",
        context_data=context_data,
        created_at=datetime.utcnow()
    )
    db.add(history)
    db.commit()

    return {
        "question": question,
        "answer": answer,
        "project_id": selected_project_id,
        "user_role": user_role,
        "mode": mode,
        "accessible_project_count": len(accessible_ids),
        "accessible_project_ids": accessible_ids,
        "context_used": context_data,
        "created_at": datetime.utcnow().isoformat()
    }