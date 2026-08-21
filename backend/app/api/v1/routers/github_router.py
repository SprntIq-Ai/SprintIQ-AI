import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List

from app.core.database import get_db
from app.api.deps import get_current_user, require_roles
from app.models.domain import (
    Profile, Project, ProjectMember, GitHubRepository, GitHubBranch, GitHubCommit
)
from app.services.github_service import (
    get_project_github_analytics,
    get_central_github_analytics,
    sync_github_repository,
    initialize_github_repository,
    connect_github_repository,
    check_repository_on_github,
    parse_github_url,
    get_server_headers,
    server_credentials_available,
    create_branch_on_github,
    commit_file_on_github,
    create_pull_request_on_github,
    get_access_token,
    resolve_date_range,
    update_engineering_metrics,
    live_repository,
    live_commits,
    live_branches,
    live_pull_requests,
    live_issues,
    live_activity,
    GITHUB_UNAVAILABLE_MESSAGE,
    PERMISSION_MESSAGE,
    NOT_CONFIGURED_MESSAGE,
    INVALID_URL_MESSAGE,
    REPOSITORY_NOT_FOUND_MESSAGE,
    PRIVATE_REPOSITORY_MESSAGE,
    RATE_LIMIT_MESSAGE,
)

router = APIRouter(prefix="/github", tags=["GitHub Engineering Analytics"])

github_access = require_roles(["admin", "manager", "developer"])
repo_manage = require_roles(["developer"])

REPO_NAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def accessible_projects(db: Session, user: Profile) -> List[Project]:
    """Returns the projects the current user is allowed to access, based on role."""
    role_name = user.role.name.lower() if user.role else "developer"
    if role_name == "admin":
        return db.query(Project).all()
    if role_name == "manager":
        ids = set()
        for p in db.query(Project).filter(Project.manager_id == user.id).all():
            ids.add(p.id)
        for m in db.query(ProjectMember).filter(
            ProjectMember.user_id == user.id,
            ProjectMember.role_in_project == "MANAGER"
        ).all():
            ids.add(m.project_id)
        if not ids:
            return []
        return db.query(Project).filter(Project.id.in_(ids)).all()
    # developer
    ids = {m.project_id for m in db.query(ProjectMember).filter(ProjectMember.user_id == user.id).all()}
    if not ids:
        return []
    return db.query(Project).filter(Project.id.in_(ids)).all()


def get_repo_or_404(db: Session, repo_id: str, user: Profile) -> GitHubRepository:
    projects = accessible_projects(db, user)
    project_ids = [p.id for p in projects]
    if not project_ids:
        raise HTTPException(status_code=403, detail="You do not have access to any repositories.")
    repo = db.query(GitHubRepository).filter(
        GitHubRepository.id == repo_id,
        GitHubRepository.project_id.in_(project_ids)
    ).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found or you do not have access to it.")
    return repo


def filter_project_ids(projects: List[Project], requested: Optional[str]) -> List[str]:
    """Validates the requested project_ids filter against the user's accessible projects."""
    if not requested:
        return [p.id for p in projects]
    wanted = set(x.strip() for x in requested.split(",") if x.strip())
    allowed = {p.id for p in projects}
    if not wanted:
        return [p.id for p in projects]
    if not wanted.issubset(allowed):
        raise HTTPException(status_code=403, detail="You do not have access to one of the requested projects.")
    return list(wanted)


@router.get("/projects")
def list_accessible_projects(db: Session = Depends(get_db), current_user: Profile = Depends(github_access)):
    """Lists projects the current user can access, with their connected repositories."""
    projects = accessible_projects(db, current_user)
    repos = db.query(GitHubRepository).filter(
        GitHubRepository.project_id.in_([p.id for p in projects])
    ).all() if projects else []
    repo_map = {}
    for r in repos:
        repo_map.setdefault(r.project_id, []).append({
            "id": r.id,
            "repo_name": r.repo_name,
            "owner": r.owner,
            "html_url": r.html_url,
            "sync_status": r.sync_status,
            "last_synced_at": r.last_synced_at,
        })
    return [
        {
            "id": p.id,
            "name": p.name,
            "key": p.key,
            "status": p.status,
            "repositories": repo_map.get(p.id, []),
        }
        for p in projects
    ]


@router.get("/analytics")
def get_central_analytics(
    project_ids: Optional[str] = None,
    repo_ids: Optional[str] = None,
    period: str = "30d",
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(github_access),
):
    """Returns centralized GitHub engineering analytics for all accessible projects."""
    projects = accessible_projects(db, current_user)
    allowed_ids = filter_project_ids(projects, project_ids)
    if not allowed_ids:
        from_dt, to_dt = resolve_date_range(period, from_date, to_date)
        return {
            "projects": [],
            "summary": {
                "projects": 0, "repositories": 0, "commits": 0,
                "open_prs": 0, "merged_prs": 0, "closed_prs": 0,
                "open_issues": 0, "closed_issues": 0,
                "avg_pr_cycle_hours": 0.0, "avg_review_hours": 0.0,
                "avg_resolution_hours": 0.0, "commit_frequency_weekly": 0.0,
                "active_contributors": 0, "total_branches": 0, "active_branches": 0,
            },
            "repositories": {"items": [], "total": 0, "page": page, "page_size": page_size},
            "metrics": {},
            "comparison": [],
            "date_range": {
                "label": f"{from_dt.date().isoformat()} → {to_dt.date().isoformat()}",
                "from": from_dt.date().isoformat(),
                "to": to_dt.date().isoformat(),
            },
        }

    repo_filter = [x.strip() for x in repo_ids.split(",")] if repo_ids else None
    from_dt, to_dt = resolve_date_range(period, from_date, to_date)
    return get_central_github_analytics(
        db, allowed_ids, from_dt, to_dt,
        repo_ids=repo_filter, page=max(1, page), page_size=min(50, max(1, page_size))
    )


@router.get("/repositories")
def list_repositories(
    project_ids: Optional[str] = None,
    sync_status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(github_access),
):
    """Paginated list of repositories the user can access, with optional filters."""
    projects = accessible_projects(db, current_user)
    allowed_ids = filter_project_ids(projects, project_ids)

    query = db.query(GitHubRepository).filter(GitHubRepository.project_id.in_(allowed_ids)) if allowed_ids \
        else db.query(GitHubRepository).filter(GitHubRepository.project_id.in_([]))
    if sync_status:
        query = query.filter(GitHubRepository.sync_status == sync_status.upper())
    if search:
        like = f"%{search}%"
        query = query.filter(
            (GitHubRepository.repo_name.ilike(like)) | (GitHubRepository.owner.ilike(like))
        )

    total = query.count()
    rows = query.order_by(GitHubRepository.repo_name.asc())\
        .offset((max(1, page) - 1) * page_size).limit(page_size).all()

    project_map = {p.id: p for p in projects}
    items = []
    for r in rows:
        proj = project_map.get(r.project_id)
        items.append({
            "id": r.id,
            "project_id": r.project_id,
            "project_name": proj.name if proj else "N/A",
            "project_key": proj.key if proj else "",
            "repo_name": r.repo_name,
            "owner": r.owner,
            "full_name": r.full_name,
            "html_url": r.html_url,
            "clone_url": r.clone_url,
            "github_repository_id": r.github_repository_id,
            "description": r.description,
            "visibility": r.visibility,
            "repo_type": r.repo_type,
            "default_branch": r.default_branch,
            "open_prs_count": r.open_prs_count,
            "open_issues_count": r.open_issues_count,
            "sync_status": r.sync_status,
            "last_sync_error": r.last_sync_error,
            "last_synced_at": r.last_synced_at,
        })
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/repositories/{repo_id}")
def get_repository_detail(
    repo_id: str,
    period: str = "30d",
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(github_access),
):
    """Detailed analytics for a single repository the user can access."""
    repo = get_repo_or_404(db, repo_id, current_user)
    from_dt, to_dt = resolve_date_range(period, from_date, to_date)
    projects = accessible_projects(db, current_user)
    project_map = {p.id: p for p in projects}
    data = get_central_github_analytics(
        db, [repo.project_id], from_dt, to_dt,
        repo_ids=[repo.id], page=1, page_size=1
    )
    detail = data["repositories"]["items"][0] if data["repositories"]["items"] else None
    proj = project_map.get(repo.project_id)
    return {
        "repository": detail,
        "project": {
            "id": repo.project_id,
            "name": proj.name if proj else None,
            "key": proj.key if proj else None,
        },
        "metrics": data["metrics"],
        "summary": data["summary"],
        "date_range": data["date_range"],
    }


class RepositoryCreate(BaseModel):
    project_id: str
    repo_name: str
    repo_owner: str = Field(default="", description="Defaults to the current user's GitHub username if blank")


class RepositoryCheckRequest(BaseModel):
    project_id: str
    repository_url: str


class RepositoryConnectRequest(BaseModel):
    project_id: str
    repository_url: str


class RepositoryInitialize(BaseModel):
    project_id: str
    repository_url: str
    repository_name: Optional[str] = None
    description: Optional[str] = None
    visibility: str = Field(default="private", description="private or public")
    default_branch: str = Field(default="main")
    create_initial_files: bool = True


class RepositoryBranchCreate(BaseModel):
    branch_name: str
    base_branch: Optional[str] = None


class RepositoryCommitCreate(BaseModel):
    path: str
    content: str
    message: str
    branch: Optional[str] = None


class RepositoryPullRequestCreate(BaseModel):
    title: str
    head: str
    base: str
    body: Optional[str] = None


def require_project_access(db: Session, user: Profile, project_id: str) -> Project:
    """Validates that the user is allowed to manage/access the given project."""
    projects = accessible_projects(db, user)
    for p in projects:
        if p.id == project_id:
            return p
    raise HTTPException(status_code=403, detail="You are not authorized to manage this project repository.")


def parse_repository_url_or_422(url: str):
    try:
        return parse_github_url(url)
    except ValueError:
        raise HTTPException(status_code=422, detail=INVALID_URL_MESSAGE)


def _find_connected(db: Session, project_id: str, owner: str, repo: str) -> Optional[GitHubRepository]:
    return db.query(GitHubRepository).filter(
        GitHubRepository.project_id == project_id,
        GitHubRepository.owner == owner,
        GitHubRepository.repo_name == repo,
    ).first()


def _require_server_credentials():
    if not server_credentials_available():
        raise HTTPException(status_code=403, detail=NOT_CONFIGURED_MESSAGE)


def _raise_initialize_error(result: dict):
    status = result.get("status")
    if status == "EXISTS":
        raise HTTPException(status_code=409, detail="This repository already exists. Connect it instead.")
    if status == "PERMISSION":
        raise HTTPException(status_code=403, detail=PERMISSION_MESSAGE)
    if status == "NO_CREDENTIALS":
        raise HTTPException(status_code=403, detail=NOT_CONFIGURED_MESSAGE)
    raise HTTPException(status_code=503, detail=result.get("message") or GITHUB_UNAVAILABLE_MESSAGE)


@router.post("/repositories", status_code=201)
def add_repository(
    payload: RepositoryCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(repo_manage),
):
    """Connects a new GitHub repository to an accessible project (legacy owner/name form)."""
    require_project_access(db, current_user, payload.project_id)

    existing = _find_connected(db, payload.project_id, payload.repo_owner.strip() or "", payload.repo_name.strip())
    if existing:
        raise HTTPException(status_code=409, detail="Repository already connected to this project.")

    owner = payload.repo_owner.strip() or get_access_token_username(db, current_user)
    result = sync_github_repository(
        db, payload.project_id, owner, payload.repo_name.strip(), added_by=current_user.id
    )
    if result.get("status") == "UNAVAILABLE":
        raise HTTPException(status_code=503, detail=result.get("message", GITHUB_UNAVAILABLE_MESSAGE))
    return result


@router.post("/repositories/check")
def check_repository(
    payload: RepositoryCheckRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(repo_manage),
):
    """Parses the GitHub URL, then checks the real repository on GitHub (Scenario A/B pre-check)."""
    require_project_access(db, current_user, payload.project_id)
    owner, repo = parse_repository_url_or_422(payload.repository_url)
    result = check_repository_on_github(get_server_headers(), owner, repo)
    if result.get("status") == "RATE_LIMIT":
        raise HTTPException(status_code=429, detail=RATE_LIMIT_MESSAGE)
    if result.get("status") == "PRIVATE":
        raise HTTPException(status_code=403, detail=PRIVATE_REPOSITORY_MESSAGE)
    if result.get("status") == "UNAVAILABLE":
        raise HTTPException(status_code=503, detail=GITHUB_UNAVAILABLE_MESSAGE)
    return {
        "status": result["status"],
        "exists": result["exists"],
        "owner": owner,
        "repo_name": repo,
        "repository": result.get("repository"),
        "message": "Repository found on GitHub." if result["exists"] else "Repository not found on GitHub.",
    }


@router.post("/repositories/connect")
def connect_repository(
    payload: RepositoryConnectRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(repo_manage),
):
    """Scenario A — connects a real existing GitHub repository to an assigned project."""
    require_project_access(db, current_user, payload.project_id)
    owner, repo = parse_repository_url_or_422(payload.repository_url)

    existing = _find_connected(db, payload.project_id, owner, repo)
    if existing:
        raise HTTPException(status_code=409, detail="This repository is already connected to this project.")

    result = connect_github_repository(db, payload.project_id, owner, repo,
                                       added_by=current_user.id,
                                       repository_url=payload.repository_url)
    status = result.get("status")
    if status == "NOT_FOUND":
        raise HTTPException(status_code=404, detail=result.get("message", REPOSITORY_NOT_FOUND_MESSAGE))
    if status == "RATE_LIMIT":
        raise HTTPException(status_code=429, detail=result.get("message", RATE_LIMIT_MESSAGE))
    if status == "PRIVATE":
        raise HTTPException(status_code=403, detail=result.get("message", PRIVATE_REPOSITORY_MESSAGE))
    if status == "UNAVAILABLE":
        raise HTTPException(status_code=503, detail=result.get("message", GITHUB_UNAVAILABLE_MESSAGE))
    return result


@router.post("/repositories/initialize", status_code=201)
def initialize_repository(
    payload: RepositoryInitialize,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(repo_manage),
):
    """Scenario B — creates a real repository on GitHub with the server-side integration,
    verifies it, adds initial files, stores the mapping and synchronizes analytics."""
    project = require_project_access(db, current_user, payload.project_id)
    owner, repo = parse_repository_url_or_422(payload.repository_url)
    if payload.repository_name and payload.repository_name.strip():
        repo = payload.repository_name.strip()
    if not repo or not REPO_NAME_RE.fullmatch(repo):
        raise HTTPException(status_code=422, detail="Repository name contains invalid characters.")

    existing = _find_connected(db, payload.project_id, owner, repo)
    if existing:
        raise HTTPException(status_code=409, detail="This repository is already connected to this project.")

    result = initialize_github_repository(
        db,
        payload.project_id,
        owner,
        repo,
        payload.visibility or "private",
        payload.default_branch or "main",
        payload.description,
        project_name=project.name,
        create_initial_files=payload.create_initial_files,
        added_by=current_user.id,
    )
    if result.get("status") != "SUCCESS":
        _raise_initialize_error(result)
    return result


@router.put("/repositories/{repo_id}")
def update_repository(
    repo_id: str,
    payload: RepositoryCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(repo_manage),
):
    """Updates repository configuration (moves it to another accessible project or re-syncs)."""
    repo = get_repo_or_404(db, repo_id, current_user)
    projects = accessible_projects(db, current_user)
    if payload.project_id not in [p.id for p in projects]:
        raise HTTPException(status_code=403, detail="You do not have access to this project.")
    if payload.repo_name.strip() and payload.repo_name.strip() != repo.repo_name:
        dup = db.query(GitHubRepository).filter(
            GitHubRepository.project_id == payload.project_id,
            GitHubRepository.repo_name == payload.repo_name.strip(),
            GitHubRepository.id != repo.id
        ).first()
        if dup:
            raise HTTPException(status_code=409, detail="A repository with this name is already connected to the project.")
    repo.project_id = payload.project_id
    if payload.repo_name.strip():
        repo.repo_name = payload.repo_name.strip()
    db.commit()
    return {"message": "Repository updated successfully.", "id": repo.id}


@router.delete("/repositories/{repo_id}")
def delete_repository(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(repo_manage),
):
    """Disconnects a repository (developer-only; admin/manager are view-only)."""
    repo = get_repo_or_404(db, repo_id, current_user)
    db.delete(repo)
    db.commit()
    return {"message": "Repository disconnected successfully."}


@router.post("/repositories/{repo_id}/sync")
def trigger_repository_sync(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(repo_manage),
):
    """Triggers a full sync for a repository the user can access (server-side credentials)."""
    repo = get_repo_or_404(db, repo_id, current_user)
    result = sync_github_repository(
        db, repo.project_id, repo.owner, repo.repo_name, added_by=current_user.id
    )
    return result


@router.post("/repositories/{repo_id}/branches")
def create_branch(
    repo_id: str,
    payload: RepositoryBranchCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(repo_manage),
):
    """Creates a real branch on GitHub for the repository."""
    repo = get_repo_or_404(db, repo_id, current_user)
    _require_server_credentials()
    branch_name = payload.branch_name.strip()
    if not branch_name or not re.fullmatch(r"[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*", branch_name):
        raise HTTPException(status_code=422, detail="Please enter a valid branch name.")
    base_branch = payload.base_branch or repo.default_branch or "main"
    result = create_branch_on_github(
        get_server_headers(), repo.owner, repo.repo_name, base_branch, branch_name
    )
    if not result.get("ok"):
        error = result.get("error")
        if error == "exists":
            raise HTTPException(status_code=409, detail=result.get("message", "This branch already exists."))
        if error == "permission":
            raise HTTPException(status_code=403, detail=PERMISSION_MESSAGE)
        raise HTTPException(status_code=503, detail=result.get("message") or GITHUB_UNAVAILABLE_MESSAGE)
    branch = result["branch"]
    existing = db.query(GitHubBranch).filter(
        GitHubBranch.repository_id == repo.id,
        GitHubBranch.branch_name == branch_name
    ).first()
    if not existing:
        db.add(GitHubBranch(
            repository_id=repo.id,
            branch_name=branch_name,
            is_default=False,
        ))
        db.commit()
    return {"status": "SUCCESS", "message": "Branch created on GitHub.", "branch": branch}


@router.post("/repositories/{repo_id}/commits")
def commit_file(
    repo_id: str,
    payload: RepositoryCommitCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(repo_manage),
):
    """Commits a file to the real GitHub repository (Contents API — creates a real commit)."""
    repo = get_repo_or_404(db, repo_id, current_user)
    _require_server_credentials()
    path = payload.path.strip()
    if not path or "\\" in path:
        raise HTTPException(status_code=422, detail="Please enter a valid file path (e.g. docs/notes.md).")
    if not payload.message.strip():
        raise HTTPException(status_code=422, detail="A commit message is required.")
    branch = payload.branch or repo.default_branch or "main"
    result = commit_file_on_github(
        get_server_headers(), repo.owner, repo.repo_name, path, payload.content, payload.message.strip(), branch
    )
    if not result.get("ok"):
        error = result.get("error")
        if error == "permission":
            raise HTTPException(status_code=403, detail=PERMISSION_MESSAGE)
        if error == "conflict":
            raise HTTPException(status_code=409, detail=result.get("message", "The file could not be committed on GitHub."))
        raise HTTPException(status_code=503, detail=result.get("message") or GITHUB_UNAVAILABLE_MESSAGE)
    commit = result["commit"]
    db.add(GitHubCommit(
        repository_id=repo.id,
        commit_sha=(commit.get("sha") or "")[:100],
        message=(commit.get("message") or payload.message.strip())[:2000],
        author_name=None,
        committed_at=datetime.utcnow(),
    ))
    db.commit()
    return {"status": "SUCCESS", "message": "File committed on GitHub.", "commit": commit}


@router.post("/repositories/{repo_id}/pull-requests")
def create_pull_request(
    repo_id: str,
    payload: RepositoryPullRequestCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(repo_manage),
):
    """Creates a real pull request on GitHub for the repository."""
    repo = get_repo_or_404(db, repo_id, current_user)
    _require_server_credentials()
    if not payload.title.strip():
        raise HTTPException(status_code=422, detail="A pull request title is required.")
    result = create_pull_request_on_github(
        get_server_headers(), repo.owner, repo.repo_name,
        payload.title.strip(), payload.body, payload.head.strip(), payload.base.strip()
    )
    if not result.get("ok"):
        error = result.get("error")
        if error == "permission":
            raise HTTPException(status_code=403, detail=PERMISSION_MESSAGE)
        if error == "conflict":
            raise HTTPException(status_code=409, detail=result.get("message", "A pull request could not be created."))
        raise HTTPException(status_code=503, detail=result.get("message") or GITHUB_UNAVAILABLE_MESSAGE)
    return {"status": "SUCCESS", "message": "Pull request created on GitHub.", "pull_request": result["pull_request"]}


def get_access_token_username(db: Session, user: Profile) -> str:
    """Fallback owner name: GitHubConnection username or the user's email local part."""
    from app.models.domain import GitHubConnection
    conn = db.query(GitHubConnection).filter(GitHubConnection.user_id == user.id).first()
    if conn and conn.github_username:
        return conn.github_username
    return user.email.split("@")[0]


# ---------------- Live GitHub reads (source of truth = GitHub API) ----------------
# These endpoints fetch real, current GitHub data for a project's connected
# repository. They use a short-TTL backend cache and never expose credentials.

def _require_live_project(db: Session, user: Profile, project_id: str):
    projects = accessible_projects(db, user)
    if project_id not in [p.id for p in projects]:
        raise HTTPException(status_code=403, detail="You do not have access to this project.")
    return project_id


@router.get("/repository/{project_id}")
def get_live_repository(
    project_id: str,
    repo_id: Optional[str] = None,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(github_access),
):
    """Live repository overview + latest commit straight from GitHub."""
    _require_live_project(db, current_user, project_id)
    return live_repository(db, project_id, repo_id, force=force)


@router.get("/commits/{project_id}")
def get_live_commits(
    project_id: str,
    branch: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    repo_id: Optional[str] = None,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(github_access),
):
    """Live paginated commits for a branch from GitHub."""
    _require_live_project(db, current_user, project_id)
    return live_commits(db, project_id, branch, page, per_page, repo_id, force=force)


@router.get("/branches/{project_id}")
def get_live_branches(
    project_id: str,
    repo_id: Optional[str] = None,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(github_access),
):
    """Live branches for a project's connected repository."""
    _require_live_project(db, current_user, project_id)
    return live_branches(db, project_id, repo_id, force=force)


@router.get("/pull-requests/{project_id}")
def get_live_pull_requests(
    project_id: str,
    state: str = "all",
    per_page: int = 50,
    repo_id: Optional[str] = None,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(github_access),
):
    """Live pull requests from GitHub."""
    _require_live_project(db, current_user, project_id)
    return live_pull_requests(db, project_id, state, per_page, repo_id, force=force)


@router.get("/issues/{project_id}")
def get_live_issues(
    project_id: str,
    state: str = "open",
    per_page: int = 50,
    repo_id: Optional[str] = None,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(github_access),
):
    """Live issues from GitHub (pull requests excluded)."""
    _require_live_project(db, current_user, project_id)
    return live_issues(db, project_id, state, per_page, repo_id, force=force)


@router.get("/activity/{project_id}")
def get_live_activity(
    project_id: str,
    branch: Optional[str] = None,
    repo_id: Optional[str] = None,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(github_access),
):
    """Live aggregate snapshot for a project: overview + metrics + branches +
    commits + pull requests + issues from GitHub."""
    _require_live_project(db, current_user, project_id)
    return live_activity(db, project_id, branch, repo_id, force=force)


# ---------------- Backward-compatible endpoints ----------------

@router.get("/{project_id}")
def get_github_analytics(project_id: str, db: Session = Depends(get_db), current_user: Profile = Depends(github_access)):
    """Returns aggregated GitHub engineering analytics, PR cycle time, and review metrics."""
    projects = accessible_projects(db, current_user)
    if project_id not in [p.id for p in projects]:
        raise HTTPException(status_code=403, detail="You do not have access to this project.")
    return get_project_github_analytics(db, project_id)


class GitHubSyncRequest(BaseModel):
    project_id: str
    repo_owner: str
    repo_name: str
    access_token: Optional[str] = None


@router.post("/sync")
def sync_github_repo(payload: GitHubSyncRequest, db: Session = Depends(get_db), current_user: Profile = Depends(repo_manage)):
    """Synchronizes GitHub commits, PRs, issues into the database."""
    projects = accessible_projects(db, current_user)
    if payload.project_id not in [p.id for p in projects]:
        raise HTTPException(status_code=403, detail="You do not have access to this project.")
    token = payload.access_token or get_access_token(db, current_user.id)
    result = sync_github_repository(
        db=db,
        project_id=payload.project_id,
        repo_owner=payload.repo_owner,
        repo_name=payload.repo_name,
        access_token=token,
        added_by=current_user.id
    )
    if result.get("status") == "UNAVAILABLE":
        raise HTTPException(status_code=502, detail=result.get("message", "GitHub synchronization is temporarily unavailable."))
    return result
