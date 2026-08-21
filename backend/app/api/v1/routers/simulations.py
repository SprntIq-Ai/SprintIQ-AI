from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.domain import Profile
from app.services.simulator_service import (
    simulate_what_if_scenario,
    calculate_release_readiness,
    get_simulation_data,
)

router = APIRouter(tags=["What-If Simulator & Release Readiness"])


class SimulationRequest(BaseModel):
    project_id: str
    scenario_type: str
    parameters: Dict[str, Any]


# ── GET simulation baseline data for a project ──
@router.get("/projects/{project_identifier}/simulation-data")
def get_project_simulation_data(
    project_identifier: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Returns baseline project metrics needed by the simulator frontend."""
    data = get_simulation_data(db, project_identifier)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return data


# ── POST run a simulation (by project key/id in URL) ──
@router.post("/projects/{project_identifier}/simulate")
def run_simulation_by_project(
    project_identifier: str,
    payload: SimulationRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Runs a What-If simulation for the given project."""
    result = simulate_what_if_scenario(
        db=db,
        project_identifier=project_identifier,
        scenario_type=payload.scenario_type,
        parameters=payload.parameters,
        created_by=current_user.id,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── Legacy POST /simulations (backward compat) ──
@router.post("/simulations")
def run_project_simulation(
    payload: SimulationRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Simulates hypothetical project outcomes (What-If Project Simulator)."""
    result = simulate_what_if_scenario(
        db=db,
        project_identifier=payload.project_id,
        scenario_type=payload.scenario_type,
        parameters=payload.parameters,
        created_by=current_user.id,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/release-readiness/{project_id}")
def get_release_readiness(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Calculates Release Readiness Score (0-100) and release audit checks."""
    return calculate_release_readiness(db, project_id)
