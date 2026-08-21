from datetime import date, timedelta, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.domain import (
    Project, Task, Profile, ProjectMember, Sprint,
    ProjectSimulation, SimulationResult, ReleaseReadiness, ReleaseCheck
)


def _resolve_project(db: Session, project_identifier: str) -> Project:
    """Resolve a project by UUID or by key (e.g. 'SIQ')."""
    project = db.query(Project).filter(Project.id == project_identifier).first()
    if not project:
        project = db.query(Project).filter(Project.key == project_identifier).first()
    return project


def get_simulation_data(db: Session, project_identifier: str) -> dict:
    """
    Load all project data needed by the simulator frontend.
    Returns baseline metrics, developer count, task stats, sprint info, etc.
    """
    project = _resolve_project(db, project_identifier)
    if not project:
        return {"error": "Project not found"}

    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    sprints = db.query(Sprint).filter(Sprint.project_id == project.id).all()
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project.id).all()

    dev_members = [m for m in members if m.role_in_project in ("DEVELOPER", "developer")]
    dev_count = len(dev_members)

    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == "COMPLETED")
    in_progress_tasks = sum(1 for t in tasks if t.status == "IN_PROGRESS")
    remaining_tasks = total_tasks - completed_tasks

    total_estimated_hours = sum(t.estimated_hours or 0.0 for t in tasks)
    completed_hours = sum(t.estimated_hours or 0.0 for t in tasks if t.status == "COMPLETED")
    remaining_hours = total_estimated_hours - completed_hours

    total_story_points = sum(t.story_points or 1 for t in tasks)

    # Calculate baseline target in days
    today = date.today()
    if project.start_date and project.target_date:
        baseline_target_days = max((project.target_date - project.start_date).days, 1)
        days_elapsed = max((today - project.start_date).days, 0)
        days_remaining = max((project.target_date - today).days, 0)
    elif project.target_date:
        baseline_target_days = max((project.target_date - today).days, 1)
        days_elapsed = 0
        days_remaining = baseline_target_days
    else:
        # Estimate from sprints
        if sprints:
            earliest = min(s.start_date for s in sprints)
            latest = max(s.end_date for s in sprints)
            baseline_target_days = max((latest - earliest).days, 1)
            days_elapsed = max((today - earliest).days, 0)
            days_remaining = max((latest - today).days, 0)
        else:
            baseline_target_days = 30
            days_elapsed = 0
            days_remaining = 30

    # Sprint info
    active_sprints = [s for s in sprints if s.status == "ACTIVE"]
    sprint_count = len(sprints)

    # Average hours per task
    tasks_with_hours = [t for t in tasks if (t.estimated_hours or 0) > 0]
    avg_hours_per_task = (
        sum(t.estimated_hours for t in tasks_with_hours) / len(tasks_with_hours)
        if tasks_with_hours else 4.0
    )

    # Developer workload (hours per dev per day, assuming 8 hrs/day)
    hours_per_dev_per_day = 8.0

    return {
        "project_id": project.id,
        "project_key": project.key,
        "project_name": project.name,
        "project_status": project.status,
        "start_date": project.start_date.isoformat() if project.start_date else None,
        "target_date": project.target_date.isoformat() if project.target_date else None,
        "baseline_target_days": baseline_target_days,
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "developer_count": dev_count,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "in_progress_tasks": in_progress_tasks,
        "remaining_tasks": remaining_tasks,
        "total_estimated_hours": round(total_estimated_hours, 1),
        "completed_hours": round(completed_hours, 1),
        "remaining_hours": round(remaining_hours, 1),
        "total_story_points": total_story_points,
        "sprint_count": sprint_count,
        "active_sprint_count": len(active_sprints),
        "avg_hours_per_task": round(avg_hours_per_task, 1),
        "hours_per_dev_per_day": hours_per_dev_per_day,
    }


def simulate_what_if_scenario(
    db: Session,
    project_identifier: str,
    scenario_type: str,
    parameters: dict,
    created_by: str = None,
) -> dict:
    """
    Simulates hypothetical project outcomes using real project data.
    Supports 8 scenario types with calculations based on actual workload.
    """
    project = _resolve_project(db, project_identifier)
    if not project:
        return {"error": "Project not found"}

    project_id = project.id
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    sprints = db.query(Sprint).filter(Sprint.project_id == project_id).all()
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()

    dev_members = [m for m in members if m.role_in_project in ("DEVELOPER", "developer")]
    dev_count = max(len(dev_members), 1)

    total_tasks = len(tasks)
    completed_tasks_count = sum(1 for t in tasks if t.status == "COMPLETED")
    remaining_tasks_count = total_tasks - completed_tasks_count
    in_progress_tasks = [t for t in tasks if t.status != "COMPLETED"]

    total_estimated_hours = sum(t.estimated_hours or 0.0 for t in tasks)
    remaining_hours = sum(t.estimated_hours or 0.0 for t in in_progress_tasks)

    total_story_points = sum(t.story_points or 1 for t in tasks)

    today = date.today()
    hours_per_dev_per_day = 8.0

    # Average hours per task for scope change estimates
    tasks_with_hours = [t for t in tasks if (t.estimated_hours or 0) > 0]
    avg_hours_per_task = (
        sum(t.estimated_hours for t in tasks_with_hours) / len(tasks_with_hours)
        if tasks_with_hours else 4.0
    )

    # Baseline target calculation
    if project.start_date and project.target_date:
        baseline_target_days = max((project.target_date - project.start_date).days, 1)
    elif project.target_date:
        baseline_target_days = max((project.target_date - today).days, 1)
    elif sprints:
        earliest = min(s.start_date for s in sprints)
        latest = max(s.end_date for s in sprints)
        baseline_target_days = max((latest - earliest).days, 1)
    else:
        baseline_target_days = 30

    # Daily throughput (team capacity)
    daily_team_capacity_hours = dev_count * hours_per_dev_per_day

    # Remaining work days (based on remaining hours)
    remaining_work_days = (
        remaining_hours / daily_team_capacity_hours
        if daily_team_capacity_hours > 0 else baseline_target_days
    )

    # ── Scenario Calculations ──

    simulated_delay_days = 0
    affected_tasks_count = 0
    affected_sprints_count = 0
    risk_level = "LOW"
    explanation = ""

    if scenario_type == "DEV_UNAVAILABLE":
        unavailable_days = float(parameters.get("unavailable_days", parameters.get("value", 3)))

        # Each unavailable dev day reduces team capacity
        lost_capacity_hours = unavailable_days * hours_per_dev_per_day
        # How much work (in days) needs redistributing
        if daily_team_capacity_hours > hours_per_dev_per_day:
            # Remaining devs absorb the load
            reduced_capacity = daily_team_capacity_hours - hours_per_dev_per_day
            new_remaining_days = remaining_hours / reduced_capacity if reduced_capacity > 0 else remaining_work_days * 2
            simulated_delay_days = round(max(new_remaining_days - remaining_work_days, 0))
        else:
            # Only one dev – full loss for that period
            simulated_delay_days = round(unavailable_days)

        # Count tasks that would be affected (in-progress tasks)
        affected_tasks_count = len([t for t in in_progress_tasks if t.assigned_developer_id])
        # Count sprints with active tasks
        active_sprint_ids = set(t.sprint_id for t in in_progress_tasks if t.sprint_id)
        affected_sprints_count = len(active_sprint_ids)

        explanation = (
            f"Developer unavailability for {int(unavailable_days)} day(s) reduces team capacity from "
            f"{dev_count} to {max(dev_count - 1, 0)} developer(s). "
            f"The remaining {round(remaining_hours, 1)} hours of work must be redistributed, "
            f"causing an estimated delay of {simulated_delay_days} day(s). "
            f"{affected_tasks_count} active task(s) across {affected_sprints_count} sprint(s) are impacted."
        )

    elif scenario_type == "ADD_DEV":
        added_devs = int(parameters.get("added_devs", parameters.get("value", 1)))
        new_dev_count = dev_count + added_devs
        new_daily_capacity = new_dev_count * hours_per_dev_per_day
        new_remaining_days = remaining_hours / new_daily_capacity if new_daily_capacity > 0 else remaining_work_days
        simulated_delay_days = round(min(new_remaining_days - remaining_work_days, 0))  # Negative = faster

        affected_tasks_count = remaining_tasks_count
        affected_sprints_count = len(set(t.sprint_id for t in in_progress_tasks if t.sprint_id))

        time_saved = abs(simulated_delay_days)
        explanation = (
            f"Adding {added_devs} developer(s) increases team capacity from {dev_count} to {new_dev_count}. "
            f"Daily capacity rises from {round(daily_team_capacity_hours, 1)}h to {round(new_daily_capacity, 1)}h. "
            f"The remaining {round(remaining_hours, 1)} hours of work can be completed ~{time_saved} day(s) faster. "
            f"{affected_tasks_count} remaining task(s) benefit from the increased capacity."
        )

    elif scenario_type == "REMOVE_DEV":
        removed_devs = int(parameters.get("removed_devs", parameters.get("value", 1)))
        new_dev_count = max(dev_count - removed_devs, 1)
        new_daily_capacity = new_dev_count * hours_per_dev_per_day
        new_remaining_days = remaining_hours / new_daily_capacity if new_daily_capacity > 0 else remaining_work_days * 2
        simulated_delay_days = round(max(new_remaining_days - remaining_work_days, 0))

        affected_tasks_count = remaining_tasks_count
        affected_sprints_count = len(set(t.sprint_id for t in in_progress_tasks if t.sprint_id))

        explanation = (
            f"Removing {removed_devs} developer(s) reduces team capacity from {dev_count} to {new_dev_count}. "
            f"Daily capacity drops from {round(daily_team_capacity_hours, 1)}h to {round(new_daily_capacity, 1)}h. "
            f"The remaining {round(remaining_hours, 1)} hours of work will take ~{simulated_delay_days} additional day(s). "
            f"{affected_tasks_count} remaining task(s) are affected."
        )

    elif scenario_type == "INCREASE_SCOPE":
        added_tasks = int(parameters.get("added_tasks", parameters.get("value", 2)))
        extra_hours = added_tasks * avg_hours_per_task
        new_remaining_hours = remaining_hours + extra_hours
        new_remaining_days = new_remaining_hours / daily_team_capacity_hours if daily_team_capacity_hours > 0 else remaining_work_days
        simulated_delay_days = round(max(new_remaining_days - remaining_work_days, 0))

        affected_tasks_count = added_tasks
        affected_sprints_count = len(set(t.sprint_id for t in in_progress_tasks if t.sprint_id)) or 1

        explanation = (
            f"Adding {added_tasks} task(s) adds ~{round(extra_hours, 1)} hours of work "
            f"(avg {round(avg_hours_per_task, 1)}h per task). "
            f"Total remaining work increases from {round(remaining_hours, 1)}h to {round(new_remaining_hours, 1)}h, "
            f"resulting in an estimated delay of {simulated_delay_days} day(s)."
        )

    elif scenario_type == "REDUCE_SCOPE":
        removed_tasks = int(parameters.get("removed_tasks", parameters.get("value", 2)))
        removed_tasks = min(removed_tasks, remaining_tasks_count)
        saved_hours = removed_tasks * avg_hours_per_task
        new_remaining_hours = max(remaining_hours - saved_hours, 0)
        new_remaining_days = new_remaining_hours / daily_team_capacity_hours if daily_team_capacity_hours > 0 else 0
        simulated_delay_days = round(min(new_remaining_days - remaining_work_days, 0))  # Negative = faster

        affected_tasks_count = removed_tasks
        affected_sprints_count = len(set(t.sprint_id for t in in_progress_tasks if t.sprint_id)) or 1

        time_saved = abs(simulated_delay_days)
        explanation = (
            f"Removing {removed_tasks} task(s) saves ~{round(saved_hours, 1)} hours of work. "
            f"Remaining work reduces from {round(remaining_hours, 1)}h to {round(new_remaining_hours, 1)}h, "
            f"accelerating the project by ~{time_saved} day(s)."
        )

    elif scenario_type == "ADD_DEADLINE_DAYS":
        shift_days = int(parameters.get("shift_days", parameters.get("value", 5)))
        # Adding days to deadline doesn't delay the project; it gives more buffer
        simulated_delay_days = -shift_days  # Negative = more time available

        affected_tasks_count = remaining_tasks_count
        affected_sprints_count = len(sprints)

        explanation = (
            f"Extending the deadline by {shift_days} day(s) increases the project timeline from "
            f"{baseline_target_days} to {baseline_target_days + shift_days} days. "
            f"This provides additional buffer for the {remaining_tasks_count} remaining task(s). "
            f"No additional development cost is incurred."
        )

    elif scenario_type == "REDUCE_WORKING_DAYS":
        reduced_days = int(parameters.get("reduced_days", parameters.get("value", 2)))
        # Reducing available working days means less time to complete work
        # This effectively increases the schedule pressure
        if remaining_work_days > 0 and baseline_target_days > 0:
            available_days = max(baseline_target_days - reduced_days, 1)
            available_capacity = available_days * daily_team_capacity_hours
            if remaining_hours > available_capacity:
                overflow_hours = remaining_hours - available_capacity
                simulated_delay_days = round(overflow_hours / daily_team_capacity_hours)
            else:
                simulated_delay_days = 0
        else:
            simulated_delay_days = reduced_days

        affected_tasks_count = remaining_tasks_count
        affected_sprints_count = len(set(t.sprint_id for t in in_progress_tasks if t.sprint_id)) or 1

        explanation = (
            f"Reducing available working days by {reduced_days} day(s) compresses the schedule "
            f"from {baseline_target_days} to {max(baseline_target_days - reduced_days, 1)} available days. "
            f"The team has {round(remaining_hours, 1)} hours of remaining work with reduced capacity, "
            f"resulting in an estimated delay of {simulated_delay_days} day(s)."
        )

    elif scenario_type == "DELAY_SPRINT":
        delay_days = int(parameters.get("delay_days", parameters.get("value", 3)))
        simulated_delay_days = delay_days

        # Count tasks in active/planned sprints
        active_sprint_tasks = [t for t in in_progress_tasks if t.sprint_id]
        affected_tasks_count = len(active_sprint_tasks)
        affected_sprints_count = len(set(t.sprint_id for t in active_sprint_tasks)) if active_sprint_tasks else 1

        explanation = (
            f"Delaying the sprint by {delay_days} day(s) pushes back all sprint deliverables. "
            f"{affected_tasks_count} task(s) in {affected_sprints_count} sprint(s) are affected. "
            f"The project completion date shifts by approximately {delay_days} day(s)."
        )

    # --- Legacy scenario names (backwards compatibility) ---
    elif scenario_type == "REMOVE_TASKS":
        task_count = int(parameters.get("removed_tasks_count", parameters.get("value", 2)))
        task_count = min(task_count, remaining_tasks_count)
        saved_hours = task_count * avg_hours_per_task
        new_remaining_hours = max(remaining_hours - saved_hours, 0)
        new_remaining_days = new_remaining_hours / daily_team_capacity_hours if daily_team_capacity_hours > 0 else 0
        simulated_delay_days = round(min(new_remaining_days - remaining_work_days, 0))

        affected_tasks_count = task_count
        affected_sprints_count = len(set(t.sprint_id for t in in_progress_tasks if t.sprint_id)) or 1

        time_saved = abs(simulated_delay_days)
        explanation = (
            f"Removing {task_count} task(s) saves ~{round(saved_hours, 1)} hours. "
            f"Completion accelerates by ~{time_saved} day(s)."
        )

    elif scenario_type == "MOVE_DEADLINE":
        shift_days = int(parameters.get("shift_days", parameters.get("value", -5)))
        if shift_days < 0:
            simulated_delay_days = abs(shift_days)
            explanation = (
                f"Moving the deadline earlier by {abs(shift_days)} day(s) increases schedule pressure. "
                f"The project timeline compresses from {baseline_target_days} to "
                f"{max(baseline_target_days - abs(shift_days), 1)} days."
            )
        else:
            simulated_delay_days = -shift_days
            explanation = (
                f"Extending the deadline by {shift_days} day(s) provides additional buffer. "
                f"Timeline extends from {baseline_target_days} to {baseline_target_days + shift_days} days."
            )

        affected_tasks_count = remaining_tasks_count
        affected_sprints_count = len(sprints)

    else:
        return {"error": f"Unknown scenario type: {scenario_type}"}

    # ── Calculate derived metrics ──

    simulated_target_days = baseline_target_days + simulated_delay_days
    impact_percentage = round(
        abs(simulated_delay_days) / baseline_target_days * 100, 1
    ) if baseline_target_days > 0 else 0.0

    # Risk level
    abs_delay = abs(simulated_delay_days)
    if abs_delay == 0:
        risk_level = "LOW"
    elif simulated_delay_days < 0:
        risk_level = "LOW"  # Improvement
    elif impact_percentage <= 10:
        risk_level = "LOW"
    elif impact_percentage <= 25:
        risk_level = "MEDIUM"
    elif impact_percentage <= 50:
        risk_level = "HIGH"
    else:
        risk_level = "CRITICAL"

    # Warning message
    warning_messages = {
        "LOW": "Minimal impact expected. The current project capacity can absorb the change.",
        "MEDIUM": "Moderate schedule impact detected. Consider reallocating workload.",
        "HIGH": "High schedule risk. The current team capacity may not meet the project target.",
        "CRITICAL": "Critical schedule risk. Immediate resource or scope adjustment is recommended.",
    }
    warning = warning_messages.get(risk_level, warning_messages["MEDIUM"])

    # ── Persist simulation record ──
    try:
        sim = ProjectSimulation(
            project_id=project_id,
            scenario_type=scenario_type,
            parameters=parameters,
            created_by=created_by,
            created_at=datetime.utcnow(),
        )
        db.add(sim)
        db.flush()

        res = SimulationResult(
            simulation_id=sim.id,
            baseline_completion_date=project.target_date or (today + timedelta(days=baseline_target_days)),
            simulated_completion_date=(project.target_date or (today + timedelta(days=baseline_target_days))) + timedelta(days=simulated_delay_days),
            expected_delay_days=simulated_delay_days,
            risk_level=risk_level,
            impact_summary=explanation,
            calculated_at=datetime.utcnow(),
        )
        db.add(res)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Simulator] Failed to persist simulation: {e}")

    return {
        "simulation_id": sim.id if 'sim' in dir() else None,
        "scenario_type": scenario_type,
        "baseline_target": baseline_target_days,
        "simulated_target": simulated_target_days,
        "expected_delay": simulated_delay_days,
        "impact_percentage": impact_percentage,
        "affected_tasks": affected_tasks_count,
        "affected_sprints": affected_sprints_count,
        "risk_level": risk_level,
        "explanation": explanation,
        "warning": warning,
        # Legacy fields for backward compatibility
        "baseline_completion_date": (
            project.target_date.isoformat()
            if project.target_date
            else (today + timedelta(days=baseline_target_days)).isoformat()
        ),
        "simulated_completion_date": (
            ((project.target_date or (today + timedelta(days=baseline_target_days)))
             + timedelta(days=simulated_delay_days)).isoformat()
        ),
        "expected_delay_days": simulated_delay_days,
        "impact_summary": explanation,
        "disclaimer": warning,
    }


def calculate_release_readiness(db: Session, project_id: str) -> dict:
    """Calculates Release Readiness Score (0-100) and multi-factor release audit checks."""
    project = _resolve_project(db, project_id)
    if not project:
        return {"error": "Project not found"}

    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    total_t = len(tasks)
    completed_t = sum(1 for t in tasks if t.status == "COMPLETED")
    testing_t = sum(1 for t in tasks if t.status == "TESTING")
    review_t = sum(1 for t in tasks if t.status == "REVIEW_PENDING")
    open_bugs = sum(1 for t in tasks if t.priority in ("HIGH", "URGENT") and t.status != "COMPLETED")

    task_comp_score = int((completed_t / total_t) * 100) if total_t > 0 else 100
    bug_score = max(100 - open_bugs * 25, 0)
    testing_score = max(100 - testing_t * 15, 20)
    review_score = max(100 - review_t * 20, 30)

    readiness_score = int(round(0.35 * task_comp_score + 0.25 * bug_score + 0.20 * testing_score + 0.20 * review_score))

    if readiness_score >= 90:
        status = "READY"
        ai_recommendation = "Project is ready for production deployment. All critical release checks passed."
    elif readiness_score >= 70:
        status = "READY_WITH_WARNINGS"
        ai_recommendation = "Release is possible, but two high-priority reviews and pending QA tests should be completed before deployment."
    else:
        status = "NOT_READY"
        ai_recommendation = "Release not recommended. Open high-priority bugs and incomplete tasks must be addressed first."

    # Store release_readiness record
    try:
        rr = ReleaseReadiness(
            project_id=project.id,
            readiness_score=readiness_score,
            status=status,
            code_health_status="GOOD" if bug_score >= 80 else "WARNING",
            task_completion_status="GOOD" if task_comp_score >= 80 else "WARNING",
            testing_status="GOOD" if testing_score >= 80 else "WARNING",
            bug_status="GOOD" if open_bugs == 0 else "WARNING",
            pr_review_status="GOOD" if review_t == 0 else "WARNING",
            documentation_status="GOOD",
            ai_recommendation=ai_recommendation,
            calculated_at=datetime.utcnow()
        )
        db.add(rr)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Release Readiness] Failed to persist: {e}")

    return {
        "project_id": project.id,
        "readiness_score": readiness_score,
        "status": status,
        "breakdown": {
            "code_health": "GOOD" if bug_score >= 80 else "WARNING",
            "task_completion": "GOOD" if task_comp_score >= 80 else "WARNING",
            "testing": "GOOD" if testing_score >= 80 else "WARNING",
            "bugs": "GOOD" if open_bugs == 0 else "WARNING",
            "pr_reviews": "GOOD" if review_t == 0 else "WARNING",
            "documentation": "GOOD"
        },
        "open_critical_bugs": open_bugs,
        "pending_reviews": review_t,
        "testing_tasks": testing_t,
        "ai_recommendation": ai_recommendation
    }
