import base64
import os
import re
import time
import httpx
from collections import defaultdict
from datetime import datetime, date, time as dt_time, timedelta, timezone
from typing import List, Optional
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.models.domain import (
    GitHubRepository, GitHubCommit, GitHubPullRequest, GitHubReview,
    GitHubIssue, GitHubContributor, GitHubBranch, GitHubConnection, EngineeringMetrics
)
from app.core.config import settings

SYNC_UNAVAILABLE_MESSAGE = "GitHub is temporarily unavailable. Please try again."
GITHUB_UNAVAILABLE_MESSAGE = "Unable to reach GitHub. Please try again."
INVALID_URL_MESSAGE = "Please enter a valid GitHub repository URL."
REPOSITORY_NOT_FOUND_MESSAGE = "GitHub repository not found."
PRIVATE_REPOSITORY_MESSAGE = "This repository is private and requires GitHub authorization."
RATE_LIMIT_MESSAGE = "GitHub API rate limit reached. Please try again later."
PERMISSION_MESSAGE = "SprintIQ could not create or modify this repository because the server-side GitHub integration does not have sufficient permission."
NOT_CONFIGURED_MESSAGE = "The server-side GitHub integration is not configured. Contact your administrator."
GITHUB_API = "https://api.github.com"
MAX_COMMIT_PAGES = 2
MAX_PR_PAGES = 2
MAX_ISSUE_PAGES = 2
MAX_BRANCH_DETAILS = 10

_GITHUB_OWNER_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$")
# GitHub allows repo names with leading/trailing/consecutive hyphens, underscores and dots
# (e.g. "Ai-Comic-Strip-"). Only "." and ".." are invalid.
_GITHUB_REPO_RE = re.compile(r"^[A-Za-z0-9._-]+$")

_install_token_cache = {"token": None, "expires_at": 0.0}


# ---------------------------------------------------------------------------
# Server-side GitHub authentication (GitHub App / token) — never exposed to UI
# ---------------------------------------------------------------------------

def _load_private_key() -> Optional[str]:
    raw = (settings.GITHUB_APP_PRIVATE_KEY or "").strip()
    if not raw:
        return None
    candidate = raw.replace("\\n", "\n")
    if "PRIVATE KEY" in candidate:
        return candidate
    if os.path.exists(candidate):
        try:
            with open(candidate, "r", encoding="utf-8") as f:
                content = f.read()
            if "PRIVATE KEY" in content:
                return content
        except Exception:
            pass
    try:
        decoded = base64.b64decode(raw).decode("utf-8")
        if "PRIVATE KEY" in decoded:
            return decoded
    except Exception:
        pass
    return None


def _github_app_jwt() -> Optional[str]:
    import jwt as pyjwt
    key = _load_private_key()
    app_id = (settings.GITHUB_APP_ID or "").strip()
    if not key or not app_id:
        return None
    now = int(time.time())
    return pyjwt.encode(
        {"iat": now - 60, "exp": now + 540, "iss": app_id},
        key, algorithm="RS256"
    )


def _github_installation_token() -> Optional[str]:
    global _install_token_cache
    now = time.time()
    if _install_token_cache["token"] and _install_token_cache["expires_at"] > now + 60:
        return _install_token_cache["token"]
    installation_id = (settings.GITHUB_APP_INSTALLATION_ID or "").strip()
    jwt_token = _github_app_jwt()
    if not installation_id or not jwt_token:
        print(f"[GitHub App Auth] Missing installation_id or jwt_token (installation_id={bool(installation_id)}, jwt_token={bool(jwt_token)})")
        return None
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "SprintIQ-AI",
    }
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                f"{GITHUB_API}/app/installations/{installation_id}/access_tokens",
                headers=headers,
            )
            if resp.status_code == 201:
                data = resp.json()
                _install_token_cache["token"] = data.get("token")
                expires = data.get("expires_at")
                if expires:
                    try:
                        _install_token_cache["expires_at"] = \
                            datetime.fromisoformat(expires.replace("Z", "+00:00")).timestamp()
                    except Exception:
                        _install_token_cache["expires_at"] = 0
                return _install_token_cache["token"]
            else:
                print(f"[GitHub App Auth Failed] Status: {resp.status_code}. Response: {resp.text}")
    except Exception as e:
        import traceback
        print(f"[GitHub App Auth Exception] Failed: {e}\n{traceback.format_exc()}")
        return None
    return None



def get_server_headers() -> dict:
    """Returns headers authenticated with the server-side GitHub credential
    (prefers GITHUB_TOKEN, falls back to a GitHub App installation token).
    Read-only public operations work without a token; write operations require it."""
    token = (settings.GITHUB_TOKEN or "").strip()
    if not token:
        token = _github_installation_token()
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "SprintIQ-AI",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def server_credentials_available() -> bool:
    headers = get_server_headers()
    return bool(headers.get("Authorization"))


# ---------------------------------------------------------------------------
# GitHub URL parsing / repository helpers
# ---------------------------------------------------------------------------

def parse_github_url(url: str):
    """Parses OWNER/REPOSITORY from a GitHub URL, normalizing common forms.

    Supports: https://github.com/OWNER/REPO[.git], http://..., git@github.com:OWNER/REPO.git,
    ssh://git@github.com/OWNER/REPO.git, github.com/OWNER/REPO, api.github.com/repos/OWNER/REPO.
    Raises ValueError with a friendly message for invalid input.
    """
    if not url or not url.strip():
        raise ValueError(INVALID_URL_MESSAGE)
    s = url.strip().rstrip("/").replace("\\", "/")
    s = s.replace("git@", "").replace("github.com:", "github.com/")
    for scheme in ("https://", "http://", "ssh://", "git://"):
        if s.startswith(scheme):
            s = s[len(scheme):]
            break
    if s.startswith("api.github.com/repos/"):
        s = s[len("api.github.com/repos/"):]
    elif s.startswith("github.com/") or s.startswith("www.github.com/"):
        idx = s.index("github.com/")
        s = s[idx + len("github.com/"):]
    else:
        # bare "owner/repo" shorthand
        bare = s.split("/")
        if len(bare) == 2 and bare[0] and bare[1] and " " not in s:
            s = s
        else:
            raise ValueError(INVALID_URL_MESSAGE)
    parts = [p for p in s.split("/") if p]
    if len(parts) < 2:
        raise ValueError(INVALID_URL_MESSAGE)
    owner, repo = parts[0], parts[1].rstrip(".git")
    if not _GITHUB_OWNER_RE.fullmatch(owner) or not _GITHUB_REPO_RE.fullmatch(repo) or repo in (".", ".."):
        raise ValueError(INVALID_URL_MESSAGE)
    return owner, repo


def _repo_payload(data: dict) -> dict:
    owner_obj = data.get("owner") or {}
    return {
        "github_repository_id": data.get("id"),
        "repo_name": data.get("name"),
        "owner": owner_obj.get("login"),
        "full_name": data.get("full_name"),
        "html_url": data.get("html_url"),
        "clone_url": data.get("clone_url"),
        "default_branch": data.get("default_branch") or "main",
        "visibility": data.get("visibility") or ("public" if not data.get("private") else "private"),
        "description": data.get("description"),
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
        "status": "ACTIVE",
    }


def check_repository_on_github(headers: dict, owner: str, repo: str) -> dict:
    """Checks whether the repository exists on GitHub. Real API call."""
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers)
        if resp.status_code == 200:
            return {"status": "FOUND", "exists": True, "repository": _repo_payload(resp.json())}
        if resp.status_code == 404:
            return {"status": "NOT_FOUND", "exists": False, "repository": None}
        if resp.status_code == 403:
            body = {}
            try:
                body = resp.json() or {}
            except Exception:
                pass
            msg = (body.get("message") or "").lower()
            if "rate limit" in msg:
                return {"status": "RATE_LIMIT", "exists": False, "repository": None}
            if "blocked" in msg or "private" in msg or "not accessible" in msg:
                return {"status": "PRIVATE", "exists": False, "repository": None}
        print(f"[GitHub API Error] check_repository_on_github failed for {owner}/{repo}: Status {resp.status_code}, Response: {resp.text}")
        return {"status": "UNAVAILABLE", "exists": False, "repository": None, "error": f"GitHub API error: {resp.status_code}"}
    except Exception as e:
        import traceback
        print(f"[GitHub API Exception] check_repository_on_github raised for {owner}/{repo}: {e}\n{traceback.format_exc()}")
        return {"status": "UNAVAILABLE", "exists": False, "repository": None, "error": str(e)}


def _create_github_repository(headers: dict, owner: str, repo_name: str,
                              visibility: str, default_branch: str,
                              description: Optional[str]) -> dict:
    """Creates a real GitHub repository under the given owner (user or org)."""
    try:
        with httpx.Client(timeout=30.0) as client:
            user_resp = client.get(f"{GITHUB_API}/users/{owner}", headers=headers)
            is_org = False
            if user_resp.status_code == 200:
                is_org = (user_resp.json().get("type") == "Organization")
            payload = {
                "name": repo_name,
                "private": visibility != "public",
                "auto_init": False,
                "default_branch": default_branch or "main",
            }
            if description:
                payload["description"] = description
            url = f"{GITHUB_API}/orgs/{owner}/repos" if is_org else f"{GITHUB_API}/user/repos"
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code == 201:
                return {"ok": True, "repository": _repo_payload(resp.json())}
            body = {}
            try:
                body = resp.json() or {}
            except Exception:
                pass
            msg = body.get("message") or ""
            if resp.status_code == 422 and "already exists" in msg.lower():
                return {"ok": False, "error": "exists", "message": msg}
            if resp.status_code in (401, 403):
                return {"ok": False, "error": "permission", "message": msg}
            return {"ok": False, "error": "unavailable", "message": msg or f"GitHub API error: {resp.status_code}"}
    except Exception as e:
        return {"ok": False, "error": "unavailable", "message": str(e)}


def _fetch_repository(headers: dict, owner: str, repo: str) -> Optional[dict]:
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers)
        if resp.status_code == 200:
            return _repo_payload(resp.json())
    except Exception:
        pass
    return None


def add_initial_files(headers: dict, owner: str, repo: str, default_branch: str,
                      description: Optional[str], project_name: str) -> List[dict]:
    """Creates README.md and .gitignore on the real repository via the Contents API.
    Each file write creates a real GitHub commit. Returns the created commits."""
    files = {
        "README.md": (
            f"# {repo}\n\n"
            + (f"{description}\n\n" if description else "")
            + f"Initialized by SprintIQ AI for project **{project_name}**.\n"
        ),
        ".gitignore": (
            "# Python\n__pycache__/\n*.py[cod]\n.venv/\nvenv/\n\n"
            "# Node\nnode_modules/\ndist/\n\n"
            "# Env\n.env\n.env.*\n\n"
            "# OS\n.DS_Store\nThumbs.db\n"
        ),
    }
    commit_message = f"Initial commit\n\nInitialized by SprintIQ AI\nProject: {project_name}"
    commits: List[dict] = []
    with httpx.Client(timeout=30.0) as client:
        for path, content in files.items():
            try:
                resp = client.put(
                    f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
                    headers=headers,
                    json={
                        "message": commit_message,
                        "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
                        "branch": default_branch,
                    },
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    commit = data.get("commit") or {}
                    commits.append({
                        "path": path,
                        "sha": commit.get("sha"),
                        "message": commit.get("message"),
                        "branch": default_branch,
                    })
            except Exception:
                continue
    return commits


# ---------------------------------------------------------------------------
# Real git operations (create branch, commit file, create pull request)
# ---------------------------------------------------------------------------

def create_branch_on_github(headers: dict, owner: str, repo: str,
                            base_branch: str, branch_name: str) -> dict:
    try:
        with httpx.Client(timeout=30.0) as client:
            base = client.get(f"{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{base_branch}", headers=headers)
            if base.status_code != 200:
                return {"ok": False, "error": "not_found" if base.status_code == 404 else "unavailable",
                        "message": "Base branch not found." if base.status_code == 404 else GITHUB_UNAVAILABLE_MESSAGE}
            sha = (base.json().get("object") or {}).get("sha")
            resp = client.post(
                f"{GITHUB_API}/repos/{owner}/{repo}/git/refs",
                headers=headers,
                json={"ref": f"refs/heads/{branch_name}", "sha": sha},
            )
            if resp.status_code == 201:
                data = resp.json()
                return {
                    "ok": True,
                    "branch": {
                        "branch_name": branch_name,
                        "base_branch": base_branch,
                        "ref": data.get("ref"),
                        "sha": (data.get("object") or {}).get("sha"),
                    },
                }
            body = {}
            try:
                body = resp.json() or {}
            except Exception:
                pass
            msg = body.get("message") or ""
            if resp.status_code == 422 and "already exists" in msg.lower():
                return {"ok": False, "error": "exists", "message": "This branch already exists."}
            if resp.status_code in (401, 403):
                return {"ok": False, "error": "permission", "message": PERMISSION_MESSAGE}
            return {"ok": False, "error": "unavailable", "message": GITHUB_UNAVAILABLE_MESSAGE}
    except Exception:
        return {"ok": False, "error": "unavailable", "message": GITHUB_UNAVAILABLE_MESSAGE}


def commit_file_on_github(headers: dict, owner: str, repo: str,
                          path: str, content: str, message: str, branch: str) -> dict:
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.put(
                f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
                headers=headers,
                json={
                    "message": message or "Commit via SprintIQ AI",
                    "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
                    "branch": branch,
                },
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                commit = data.get("commit") or {}
                return {
                    "ok": True,
                    "commit": {
                        "sha": commit.get("sha"),
                        "message": commit.get("message"),
                        "path": path,
                        "branch": branch,
                    },
                }
            body = {}
            try:
                body = resp.json() or {}
            except Exception:
                pass
            msg = body.get("message") or ""
            if resp.status_code == 422:
                return {"ok": False, "error": "conflict", "message": "The file could not be committed on GitHub."}
            if resp.status_code in (401, 403):
                return {"ok": False, "error": "permission", "message": PERMISSION_MESSAGE}
            return {"ok": False, "error": "unavailable", "message": GITHUB_UNAVAILABLE_MESSAGE}
    except Exception:
        return {"ok": False, "error": "unavailable", "message": GITHUB_UNAVAILABLE_MESSAGE}


def create_pull_request_on_github(headers: dict, owner: str, repo: str,
                                  title: str, body: Optional[str], head: str, base: str) -> dict:
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                f"{GITHUB_API}/repos/{owner}/{repo}/pulls",
                headers=headers,
                json={"title": title, "head": head, "base": base, "body": body or ""},
            )
            if resp.status_code == 201:
                data = resp.json()
                return {
                    "ok": True,
                    "pull_request": {
                        "number": data.get("number"),
                        "title": data.get("title"),
                        "state": data.get("state"),
                        "html_url": data.get("html_url"),
                        "head": head,
                        "base": base,
                    },
                }
            body_resp = {}
            try:
                body_resp = resp.json() or {}
            except Exception:
                pass
            msg = body_resp.get("message") or ""
            if resp.status_code == 422:
                return {"ok": False, "error": "conflict",
                        "message": "A pull request could not be created between these branches."}
            if resp.status_code in (401, 403):
                return {"ok": False, "error": "permission", "message": PERMISSION_MESSAGE}
            return {"ok": False, "error": "unavailable", "message": GITHUB_UNAVAILABLE_MESSAGE}
    except Exception:
        return {"ok": False, "error": "unavailable", "message": GITHUB_UNAVAILABLE_MESSAGE}


def _to_naive_utc(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value
    if isinstance(value, date):
        return datetime.combine(value, dt_time.min)
    return None


def _parse_gh_datetime(value):
    if not value:
        return None
    s = str(value).replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        try:
            dt = datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S")
        except ValueError:
            return None
    return _to_naive_utc(dt)


def _avg(values):
    vals = [v for v in values if v is not None and v > 0]
    if not vals:
        return 0.0
    return round(sum(vals) / len(vals), 2)


def get_access_token(db: Session, user_id: str) -> Optional[str]:
    """Returns the user's stored GitHub token (server-side only) if one exists."""
    conn = db.query(GitHubConnection).filter(GitHubConnection.user_id == user_id)\
        .order_by(GitHubConnection.updated_at.desc()).first()
    if conn:
        return conn.access_token_encrypted
    return None


def _github_headers(token: Optional[str] = None) -> dict:
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "SprintIQ-AI"
    }
    if token:
        headers["Authorization"] = f"token {token}"
    return headers


def _unavailable(status_code: int, gh_message: Optional[str] = None) -> dict:
    reason = gh_message or f"GitHub API error: {status_code}"
    if status_code == 404:
        reason = "Repository not found or no access to it on GitHub."
    return {
        "status": "UNAVAILABLE",
        "error": reason,
        "message": SYNC_UNAVAILABLE_MESSAGE
    }


def _replace_repo_children(db: Session, client: httpx.Client, headers: dict,
                           repo_url: str, repo_id: str,
                           commits: list, prs: list, issues: list,
                           contributors: list, branch_names: list, default_branch: str):
    db.query(GitHubCommit).filter(GitHubCommit.repository_id == repo_id).delete(synchronize_session=False)
    db.query(GitHubPullRequest).filter(GitHubPullRequest.repository_id == repo_id).delete(synchronize_session=False)
    db.query(GitHubIssue).filter(GitHubIssue.repository_id == repo_id).delete(synchronize_session=False)
    db.query(GitHubContributor).filter(GitHubContributor.repository_id == repo_id).delete(synchronize_session=False)
    db.query(GitHubBranch).filter(GitHubBranch.repository_id == repo_id).delete(synchronize_session=False)

    for c in commits:
        commit_data = c.get("commit") or {}
        author = commit_data.get("author") or {}
        db.add(GitHubCommit(
            repository_id=repo_id,
            commit_sha=(c.get("sha") or "")[:100],
            message=(commit_data.get("message") or "")[:2000],
            author_name=author.get("name"),
            author_email=author.get("email"),
            committed_at=_parse_gh_datetime(author.get("date")) or datetime.utcnow(),
        ))

    for pr in prs:
        pr_number = pr.get("number")
        created = _parse_gh_datetime(pr.get("created_at")) or datetime.utcnow()
        merged = _parse_gh_datetime(pr.get("merged_at"))
        closed = _parse_gh_datetime(pr.get("closed_at"))
        state = "merged" if merged else (pr.get("state") or "closed")
        end = merged or closed
        cycle = 0.0
        if end:
            cycle = max(0.0, (end - created).total_seconds() / 3600)
        db_pr = GitHubPullRequest(
            repository_id=repo_id,
            pr_number=pr_number or 0,
            title=(pr.get("title") or "")[:255],
            state=state,
            author_username=((pr.get("user") or {}).get("login")) or "unknown",
            created_at_gh=created,
            merged_at_gh=merged,
            closed_at_gh=closed,
            cycle_time_hours=round(cycle, 2),
        )
        db.add(db_pr)
        db.flush()

        if pr_number:
            reviews_resp = client.get(f"{repo_url}/pulls/{pr_number}/reviews",
                                      headers=headers, params={"per_page": 100})
            if reviews_resp.status_code == 200:
                for rv in reviews_resp.json():
                    rv_user = rv.get("user")
                    if not rv_user:
                        continue
                    db.add(GitHubReview(
                        pr_id=db_pr.id,
                        reviewer_username=rv_user.get("login") or "unknown",
                        state=(rv.get("state") or "COMMENTED").upper(),
                        submitted_at=_parse_gh_datetime(rv.get("submitted_at")) or datetime.utcnow(),
                    ))

    for iss in issues:
        created = _parse_gh_datetime(iss.get("created_at")) or datetime.utcnow()
        closed = _parse_gh_datetime(iss.get("closed_at"))
        res_time = 0.0
        if closed:
            res_time = max(0.0, (closed - created).total_seconds() / 3600)
        db.add(GitHubIssue(
            repository_id=repo_id,
            issue_number=iss.get("number") or 0,
            title=(iss.get("title") or "")[:255],
            state=iss.get("state") or "open",
            resolution_time_hours=round(res_time, 2),
            created_at_gh=created,
            closed_at_gh=closed,
        ))

    for cb in contributors:
        db.add(GitHubContributor(
            repository_id=repo_id,
            username=(cb.get("login") or "unknown")[:255],
            commits_count=cb.get("contributions") or 0,
        ))

    # Enrich contributor PR/review counts from stored activity
    pr_counts = defaultdict(int)
    for pr_row in db.query(GitHubPullRequest).filter(GitHubPullRequest.repository_id == repo_id).all():
        pr_counts[pr_row.author_username] += 1
    rev_counts = defaultdict(int)
    rev_rows = db.query(GitHubReview).join(GitHubPullRequest, GitHubReview.pr_id == GitHubPullRequest.id)\
        .filter(GitHubPullRequest.repository_id == repo_id).all()
    for rev_row in rev_rows:
        rev_counts[rev_row.reviewer_username] += 1
    for cont in db.query(GitHubContributor).filter(GitHubContributor.repository_id == repo_id).all():
        cont.prs_count = pr_counts.get(cont.username, 0)
        cont.reviews_count = rev_counts.get(cont.username, 0)

    # Branch details (default branch always included)
    branch_names = list(dict.fromkeys(branch_names))
    detail_names = branch_names[:MAX_BRANCH_DETAILS]
    if default_branch and default_branch not in detail_names:
        detail_names = detail_names[: MAX_BRANCH_DETAILS - 1] + [default_branch]
    for bname in detail_names:
        last_commit_at = None
        try:
            bresp = client.get(f"{repo_url}/branches/{quote(bname)}", headers=headers)
            if bresp.status_code == 200:
                bdata = bresp.json()
                commit_info = (bdata.get("commit") or {}).get("commit") or {}
                committer = commit_info.get("committer") or {}
                author = commit_info.get("author") or {}
                last_commit_at = _parse_gh_datetime(committer.get("date")) or _parse_gh_datetime(author.get("date"))
        except Exception:
            last_commit_at = None
        db.add(GitHubBranch(
            repository_id=repo_id,
            branch_name=bname[:255],
            is_default=(bname == default_branch),
            last_commit_at=last_commit_at,
        ))


def initialize_github_repository(db: Session, project_id: str, owner: str, repo_name: str,
                                 visibility: str = "private", default_branch: str = "main",
                                 description: Optional[str] = None,
                                 project_name: str = "",
                                 create_initial_files: bool = True,
                                 added_by: str = None) -> dict:
    """
    Scenario B — the repository does NOT exist on GitHub yet. Creates a real repository
    on GitHub using the server-side GitHub credential, verifies it, adds initial files
    (real commits), stores the mapping and synchronizes analytics.

    Uses the server-side GitHub integration only — the developer is authenticated via
    SprintIQ JWT + RBAC and never needs a GitHub account.
    """
    if not server_credentials_available():
        return {"status": "NO_CREDENTIALS", "message": NOT_CONFIGURED_MESSAGE}

    created = _create_github_repository(
        get_server_headers(), owner, repo_name, visibility, default_branch, description
    )
    if not created.get("ok"):
        if created.get("error") == "exists":
            return {"status": "EXISTS", "message": "This repository already exists. Connect it instead."}
        if created.get("error") == "permission":
            return {"status": "PERMISSION", "message": PERMISSION_MESSAGE}
        return {"status": "UNAVAILABLE", "message": GITHUB_UNAVAILABLE_MESSAGE}

    repo_payload = created["repository"]
    # Real-time verification: immediately retrieve the repository from GitHub again.
    verified = _fetch_repository(get_server_headers(), owner, repo_name)
    if not verified or str(verified.get("github_repository_id")) != str(repo_payload.get("github_repository_id")):
        return {"status": "UNAVAILABLE", "message": GITHUB_UNAVAILABLE_MESSAGE}
    repo_payload = verified

    initial_commits: List[dict] = []
    if create_initial_files:
        initial_commits = add_initial_files(
            get_server_headers(), owner, repo_name,
            repo_payload.get("default_branch") or default_branch or "main",
            description, project_name or repo_name,
        )

    result = sync_github_repository(
        db, project_id, owner, repo_name, added_by=added_by
    )
    if result.get("status") == "UNAVAILABLE":
        # Repository was created on GitHub, but analytics sync failed — still return
        # the verified repository so the mapping can be retried via sync later.
        return {
            "status": "SUCCESS",
            "message": "Repository was created on GitHub but synchronization failed. Use Sync to retry.",
            "repository": repo_payload,
            "initial_commit": initial_commits[0] if initial_commits else None,
            "initial_commits": initial_commits,
        }

    return {
        "status": "SUCCESS",
        "message": "Repository initialized and connected successfully.",
        "repository": repo_payload,
        "initial_commit": initial_commits[0] if initial_commits else None,
        "initial_commits": initial_commits,
    }


def connect_github_repository(db: Session, project_id: str, owner: str, repo_name: str,
                              added_by: str = None, repository_url: str = None) -> dict:
    """
    Scenario A — the repository already exists on GitHub. Verifies it against the real
    GitHub API, stores the mapping and synchronizes analytics for the project.
    """
    headers = get_server_headers()
    check = check_repository_on_github(headers, owner, repo_name)
    status = check.get("status")
    if status == "RATE_LIMIT":
        return {"status": "RATE_LIMIT", "message": RATE_LIMIT_MESSAGE}
    if status == "PRIVATE":
        return {"status": "PRIVATE", "message": PRIVATE_REPOSITORY_MESSAGE}
    if status == "UNAVAILABLE":
        return {"status": "UNAVAILABLE", "message": GITHUB_UNAVAILABLE_MESSAGE}
    if not check.get("exists"):
        return {"status": "NOT_FOUND", "message": REPOSITORY_NOT_FOUND_MESSAGE}

    result = sync_github_repository(db, project_id, owner, repo_name,
                                    added_by=added_by, repository_url=repository_url)
    if result.get("status") == "UNAVAILABLE":
        return {"status": "UNAVAILABLE", "message": GITHUB_UNAVAILABLE_MESSAGE}

    return {
        "status": "SUCCESS",
        "message": "Repository connected successfully.",
        "repository": result.get("repository"),
    }


def sync_github_repository(db: Session, project_id: str, repo_owner: str, repo_name: str,
                           access_token: str = None, added_by: str = None,
                           repository_url: str = None) -> dict:
    """
    Synchronizes a GitHub repository's commits, PRs, reviews, issues, contributors,
    and branches into the database for offline analytics. Uses the server-side GitHub
    credential by default; a per-user token is only used when explicitly provided.
    """
    headers = get_server_headers()
    if access_token:
        headers["Authorization"] = f"token {access_token}"
    repo_url = f"{GITHUB_API}/repos/{repo_owner}/{repo_name}"
    db_repo = None
    try:
        with httpx.Client(timeout=20.0) as client:
            repo_resp = client.get(repo_url, headers=headers)
            if repo_resp.status_code in (401, 403, 404, 410):
                return _unavailable(repo_resp.status_code, (repo_resp.json() or {}).get("message"))
            if repo_resp.status_code != 200:
                return _unavailable(repo_resp.status_code, "Unexpected GitHub API error")
            repo_data = repo_resp.json()

            db_repo = db.query(GitHubRepository).filter(
                GitHubRepository.project_id == project_id,
                GitHubRepository.repo_name == repo_name
            ).first()
            if not db_repo:
                db_repo = GitHubRepository(
                    project_id=project_id,
                    repo_name=repo_name,
                    owner=repo_owner,
                    github_repository_id=str(repo_data.get("id")) if repo_data.get("id") else None,
                    full_name=repo_data.get("full_name"),
                    clone_url=repo_data.get("clone_url"),
                    html_url=repo_data.get("html_url", f"https://github.com/{repo_owner}/{repo_name}"),
                    description=repo_data.get("description"),
                    visibility=repo_data.get("visibility", "private"),
                    default_branch=repo_data.get("default_branch", "main"),
                    repository_url=repository_url or None,
                    normalized_url=f"https://github.com/{repo_owner}/{repo_name}",
                    added_by=added_by,
                )
                db.add(db_repo)
                db.flush()
            else:
                db_repo.github_repository_id = str(repo_data.get("id")) or db_repo.github_repository_id
                db_repo.full_name = repo_data.get("full_name") or db_repo.full_name
                db_repo.clone_url = repo_data.get("clone_url") or db_repo.clone_url
                db_repo.description = repo_data.get("description", db_repo.description)
                db_repo.visibility = repo_data.get("visibility", db_repo.visibility)
                db_repo.default_branch = repo_data.get("default_branch", db_repo.default_branch)
                db_repo.html_url = repo_data.get("html_url", db_repo.html_url)
                if repository_url:
                    db_repo.repository_url = repository_url
                db_repo.normalized_url = f"https://github.com/{repo_owner}/{repo_name}"

            db_repo.sync_status = "SYNCING"
            db.commit()

            # Commits (recent window, capped)
            commits: list = []
            page = 1
            until = datetime.utcnow().isoformat() + "Z"
            while page <= MAX_COMMIT_PAGES:
                resp = client.get(f"{repo_url}/commits", headers=headers,
                                  params={"per_page": 100, "page": page, "until": until})
                if resp.status_code != 200:
                    break
                batch = resp.json()
                if not batch:
                    break
                commits.extend(batch)
                page += 1
                if len(batch) < 100:
                    break

            # Branches
            branch_names: list = []
            resp = client.get(f"{repo_url}/branches", headers=headers, params={"per_page": 100})
            if resp.status_code == 200:
                branch_names = [b.get("name") for b in resp.json() if b.get("name")]

            # Pull requests
            prs: list = []
            page = 1
            while page <= MAX_PR_PAGES:
                resp = client.get(f"{repo_url}/pulls", headers=headers,
                                  params={"state": "all", "per_page": 100, "page": page,
                                          "sort": "updated", "direction": "desc"})
                if resp.status_code != 200:
                    break
                batch = resp.json()
                if not batch:
                    break
                prs.extend(batch)
                page += 1
                if len(batch) < 100:
                    break

            # Issues (exclude pull requests)
            issues: list = []
            page = 1
            while page <= MAX_ISSUE_PAGES:
                resp = client.get(f"{repo_url}/issues", headers=headers,
                                  params={"state": "all", "per_page": 100, "page": page,
                                          "sort": "updated", "direction": "desc"})
                if resp.status_code != 200:
                    break
                batch = resp.json()
                if not batch:
                    break
                issues.extend([i for i in batch if not i.get("pull_request")])
                page += 1
                if len(batch) < 100:
                    break

            # Contributors
            contributors: list = []
            resp = client.get(f"{repo_url}/contributors", headers=headers,
                              params={"per_page": 50, "anon": "false"})
            if resp.status_code == 200:
                contributors = resp.json()

            _replace_repo_children(db, client, headers, repo_url, db_repo.id,
                                   commits, prs, issues, contributors,
                                   branch_names, repo_data.get("default_branch", "main"))

            db_repo.open_prs_count = db.query(GitHubPullRequest)\
                .filter(GitHubPullRequest.repository_id == db_repo.id, GitHubPullRequest.state == "open").count()
            db_repo.open_issues_count = db.query(GitHubIssue)\
                .filter(GitHubIssue.repository_id == db_repo.id, GitHubIssue.state == "open").count()
            db_repo.sync_status = "SYNCED"
            db_repo.last_sync_error = None
            db_repo.last_synced_at = datetime.utcnow()
            db.commit()

            update_engineering_metrics(db, project_id)

            return {
                "status": "SUCCESS",
                "message": "Repository synchronized successfully.",
                "repository": {
                    "id": db_repo.id,
                    "github_repository_id": db_repo.github_repository_id,
                    "repo_name": db_repo.repo_name,
                    "owner": db_repo.owner,
                    "full_name": db_repo.full_name,
                    "html_url": db_repo.html_url,
                    "clone_url": db_repo.clone_url,
                    "description": db_repo.description,
                    "visibility": db_repo.visibility,
                    "default_branch": db_repo.default_branch,
                    "sync_status": db_repo.sync_status,
                    "last_synced_at": db_repo.last_synced_at,
                    "status": "ACTIVE",
                }
            }
    except Exception as e:
        db.rollback()
        import traceback
        tb = traceback.format_exc()
        print(f"[GitHub Sync Exception] Failed during synchronization: {e}\n{tb}")
        if db_repo:
            db_repo.sync_status = "FAILED"
            db_repo.last_sync_error = SYNC_UNAVAILABLE_MESSAGE
            db.commit()
        return {"status": "UNAVAILABLE", "error": str(e), "message": SYNC_UNAVAILABLE_MESSAGE}


def update_engineering_metrics(db: Session, project_id: str,
                               from_dt: Optional[datetime] = None,
                               to_dt: Optional[datetime] = None):
    """Calculates and stores real aggregated engineering metrics for a project."""
    now = datetime.utcnow()
    from_dt = from_dt or (now - timedelta(days=30))
    to_dt = to_dt or now

    repos = db.query(GitHubRepository).filter(GitHubRepository.project_id == project_id).all()
    repo_ids = [r.id for r in repos]

    metrics = db.query(EngineeringMetrics).filter(EngineeringMetrics.project_id == project_id).first()
    if not metrics:
        metrics = EngineeringMetrics(project_id=project_id)
        db.add(metrics)

    if not repo_ids:
        metrics.pr_cycle_time_avg_hours = 0.0
        metrics.pr_review_time_avg_hours = 0.0
        metrics.issue_resolution_avg_hours = 0.0
        metrics.commit_frequency_weekly = 0.0
        metrics.open_prs_count = 0
        metrics.merged_prs_count = 0
        metrics.testing_bottleneck_score = 0.0
        metrics.review_bottleneck_score = 0.0
        metrics.calculated_at = now
        db.commit()
        return metrics

    prs = db.query(GitHubPullRequest).filter(
        GitHubPullRequest.repository_id.in_(repo_ids),
        GitHubPullRequest.created_at_gh >= from_dt,
        GitHubPullRequest.created_at_gh <= to_dt
    ).all()
    issues = db.query(GitHubIssue).filter(
        GitHubIssue.repository_id.in_(repo_ids),
        GitHubIssue.created_at_gh >= from_dt,
        GitHubIssue.created_at_gh <= to_dt
    ).all()
    commits_count = db.query(GitHubCommit).filter(
        GitHubCommit.repository_id.in_(repo_ids),
        GitHubCommit.committed_at >= from_dt,
        GitHubCommit.committed_at <= to_dt
    ).count()

    cycles = [p.cycle_time_hours for p in prs if p.cycle_time_hours and p.cycle_time_hours > 0]
    merged_prs = sum(1 for p in prs if p.state == "merged")

    open_prs = db.query(GitHubPullRequest).filter(
        GitHubPullRequest.repository_id.in_(repo_ids), GitHubPullRequest.state == "open").count()

    resolutions = [i.resolution_time_hours for i in issues if i.resolution_time_hours and i.resolution_time_hours > 0]

    review_hours = []
    for pr in prs:
        for rv in pr.reviews:
            if rv.submitted_at:
                review_hours.append((rv.submitted_at - pr.created_at_gh).total_seconds() / 3600)

    days = max(1, (to_dt - from_dt).days)
    weekly = round((commits_count / days) * 7, 2)

    metrics.pr_cycle_time_avg_hours = _avg(cycles)
    metrics.pr_review_time_avg_hours = _avg(review_hours)
    metrics.issue_resolution_avg_hours = _avg(resolutions)
    metrics.commit_frequency_weekly = weekly
    metrics.open_prs_count = open_prs
    metrics.merged_prs_count = merged_prs
    metrics.review_bottleneck_score = round(min(100.0, _avg(review_hours) * 4), 1)
    metrics.testing_bottleneck_score = round(min(100.0, _avg(resolutions) * 1.5), 1)
    metrics.calculated_at = now
    db.commit()
    return metrics


def resolve_date_range(period: str = "30d",
                       from_date: Optional[str] = None,
                       to_date: Optional[str] = None,
                       now: Optional[datetime] = None) -> tuple:
    now = now or datetime.utcnow()
    if period == "today":
        from_dt = datetime.combine(now.date(), dt_time.min)
        to_dt = now
    elif period == "7d":
        from_dt = now - timedelta(days=7)
        to_dt = now
    elif period == "90d":
        from_dt = now - timedelta(days=90)
        to_dt = now
    elif period == "custom":
        from_dt = _parse_gh_datetime(from_date) or (now - timedelta(days=30))
        to_dt = _parse_gh_datetime(to_date) or now
        if to_dt < from_dt:
            from_dt, to_dt = to_dt, from_dt
    else:  # 30d
        from_dt = now - timedelta(days=30)
        to_dt = now
    return from_dt, to_dt


def compute_repo_analytics(db: Session, repo: GitHubRepository, from_dt: datetime, to_dt: datetime) -> dict:
    commits = db.query(GitHubCommit).filter(
        GitHubCommit.repository_id == repo.id,
        GitHubCommit.committed_at >= from_dt,
        GitHubCommit.committed_at <= to_dt
    ).all()
    prs = db.query(GitHubPullRequest).filter(
        GitHubPullRequest.repository_id == repo.id,
        GitHubPullRequest.created_at_gh >= from_dt,
        GitHubPullRequest.created_at_gh <= to_dt
    ).all()
    issues = db.query(GitHubIssue).filter(
        GitHubIssue.repository_id == repo.id,
        GitHubIssue.created_at_gh >= from_dt,
        GitHubIssue.created_at_gh <= to_dt
    ).all()

    open_prs = sum(1 for p in prs if p.state == "open")
    merged_prs = sum(1 for p in prs if p.state == "merged")
    closed_prs = sum(1 for p in prs if p.state == "closed")
    open_issues = sum(1 for i in issues if i.state == "open")
    closed_issues = sum(1 for i in issues if i.state == "closed")

    cycles = [p.cycle_time_hours for p in prs if p.cycle_time_hours and p.cycle_time_hours > 0]
    resolutions = [i.resolution_time_hours for i in issues if i.resolution_time_hours and i.resolution_time_hours > 0]

    review_hours = []
    for pr in prs:
        for rv in pr.reviews:
            if rv.submitted_at:
                review_hours.append((rv.submitted_at - pr.created_at_gh).total_seconds() / 3600)

    branches = db.query(GitHubBranch).filter(GitHubBranch.repository_id == repo.id).all()
    active_branches = sum(1 for b in branches if b.last_commit_at and from_dt <= b.last_commit_at <= to_dt)

    return {
        "repo_id": repo.id,
        "repo_name": repo.repo_name,
        "owner": repo.owner,
        "html_url": repo.html_url,
        "description": repo.description,
        "visibility": repo.visibility,
        "repo_type": repo.repo_type,
        "default_branch": repo.default_branch,
        "sync_status": repo.sync_status,
        "last_sync_error": repo.last_sync_error,
        "last_synced_at": repo.last_synced_at,
        "commits": len(commits),
        "open_prs": open_prs,
        "merged_prs": merged_prs,
        "closed_prs": closed_prs,
        "open_issues": open_issues,
        "closed_issues": closed_issues,
        "avg_cycle_hours": _avg(cycles),
        "avg_review_hours": _avg(review_hours),
        "avg_resolution_hours": _avg(resolutions),
        "active_contributors": len({c.author_name for c in commits if c.author_name}),
        "total_branches": len(branches),
        "active_branches": active_branches,
    }


def get_central_github_analytics(db: Session, project_ids: List[str],
                                 from_dt: datetime, to_dt: datetime,
                                 repo_ids: Optional[List[str]] = None,
                                 page: int = 1, page_size: int = 10) -> dict:
    projects = db.query(GitHubRepository).filter(GitHubRepository.project_id.in_(project_ids)).all()
    # Preserve project info
    from app.models.domain import Project
    project_objs = {p.id: p for p in db.query(Project).filter(Project.id.in_(project_ids)).all()}

    scope_repos = [r for r in projects if repo_ids is None or r.id in repo_ids]

    # Repo table (paginated)
    sorted_repos = sorted(scope_repos, key=lambda r: r.repo_name.lower())
    total = len(sorted_repos)
    start = (page - 1) * page_size
    page_repos = sorted_repos[start:start + page_size]

    def _attach(row: dict, repo: GitHubRepository) -> dict:
        proj = project_objs.get(repo.project_id)
        row["project_id"] = repo.project_id
        row["project_name"] = proj.name if proj else "N/A"
        row["project_key"] = proj.key if proj else ""
        return row

    repo_rows = [_attach(compute_repo_analytics(db, r, from_dt, to_dt), r) for r in page_repos]
    all_rows = [_attach(compute_repo_analytics(db, r, from_dt, to_dt), r) for r in scope_repos]

    # ---- Summary ----
    total_commits = sum(r["commits"] for r in all_rows)
    open_prs = sum(r["open_prs"] for r in all_rows)
    merged_prs = sum(r["merged_prs"] for r in all_rows)
    closed_prs = sum(r["closed_prs"] for r in all_rows)
    open_issues = sum(r["open_issues"] for r in all_rows)
    closed_issues = sum(r["closed_issues"] for r in all_rows)
    active_contributors = sum(r["active_contributors"] for r in all_rows)
    total_branches = sum(r["total_branches"] for r in all_rows)
    active_branches = sum(r["active_branches"] for r in all_rows)

    days = max(1, (to_dt - from_dt).days)
    weekly = round((total_commits / days) * 7, 2)

    summary = {
        "projects": len([p for p in project_ids if p in project_objs]),
        "repositories": len(scope_repos),
        "commits": total_commits,
        "open_prs": open_prs,
        "merged_prs": merged_prs,
        "closed_prs": closed_prs,
        "open_issues": open_issues,
        "closed_issues": closed_issues,
        "avg_pr_cycle_hours": _avg([r["avg_cycle_hours"] for r in all_rows]),
        "avg_review_hours": _avg([r["avg_review_hours"] for r in all_rows]),
        "avg_resolution_hours": _avg([r["avg_resolution_hours"] for r in all_rows]),
        "commit_frequency_weekly": weekly,
        "active_contributors": active_contributors,
        "total_branches": total_branches,
        "active_branches": active_branches,
    }

    # ---- Commit activity trend ----
    repo_id_list = [r.id for r in scope_repos]
    activity_map = defaultdict(int)
    if repo_id_list:
        all_commits = db.query(GitHubCommit).filter(
            GitHubCommit.repository_id.in_(repo_id_list),
            GitHubCommit.committed_at >= from_dt,
            GitHubCommit.committed_at <= to_dt
        ).all()
        for c in all_commits:
            activity_map[c.committed_at.date().isoformat()] += 1
    activity = [{"date": d, "commits": n} for d, n in sorted(activity_map.items())]

    # ---- Contributor ranking ----
    contrib_map = defaultdict(lambda: {"commits": 0, "prs": 0, "reviews": 0})
    if repo_id_list:
        all_prs = db.query(GitHubPullRequest).filter(
            GitHubPullRequest.repository_id.in_(repo_id_list),
            GitHubPullRequest.created_at_gh >= from_dt,
            GitHubPullRequest.created_at_gh <= to_dt
        ).all()
        all_reviews = db.query(GitHubReview).join(GitHubPullRequest, GitHubReview.pr_id == GitHubPullRequest.id)\
            .filter(GitHubPullRequest.repository_id.in_(repo_id_list)).all()
        for c in all_commits:
            if c.author_name:
                contrib_map[c.author_name]["commits"] += 1
        for p in all_prs:
            contrib_map[p.author_username]["prs"] += 1
        for rv in all_reviews:
            contrib_map[rv.reviewer_username]["reviews"] += 1
    top_contributors = sorted(
        [{"username": k, **v} for k, v in contrib_map.items()],
        key=lambda x: x["commits"] + x["prs"] + x["reviews"], reverse=True
    )[:10]

    # ---- Reviews aggregation ----
    review_states = defaultdict(int)
    review_rows = []
    if repo_id_list:
        review_rows = db.query(GitHubReview).join(GitHubPullRequest, GitHubReview.pr_id == GitHubPullRequest.id)\
            .filter(GitHubPullRequest.repository_id.in_(repo_id_list),
                    GitHubPullRequest.created_at_gh >= from_dt,
                    GitHubPullRequest.created_at_gh <= to_dt).all()
        for rv in review_rows:
            review_states[rv.state] += 1
    pending_reviews = max(0, open_prs - len(review_rows))

    metrics = {
        "pull_requests": {
            "open": open_prs,
            "closed": closed_prs,
            "merged": merged_prs,
            "avg_cycle_hours": summary["avg_pr_cycle_hours"],
            "avg_review_hours": summary["avg_review_hours"],
            "merge_rate": round((merged_prs / max(1, merged_prs + closed_prs)) * 100, 1),
        },
        "reviews": {
            "total": sum(review_states.values()),
            "approved": review_states.get("APPROVED", 0),
            "changes_requested": review_states.get("CHANGES_REQUESTED", 0),
            "commented": review_states.get("COMMENTED", 0),
            "pending": pending_reviews,
            "avg_time_hours": summary["avg_review_hours"],
        },
        "issues": {
            "open": open_issues,
            "closed": closed_issues,
            "avg_resolution_hours": summary["avg_resolution_hours"],
            "resolution_rate": round((closed_issues / max(1, open_issues + closed_issues)) * 100, 1),
        },
        "commits": {
            "count": total_commits,
            "frequency_per_week": weekly,
            "activity": activity,
        },
        "contributors": {
            "active": active_contributors,
            "top": top_contributors,
        },
        "branches": {
            "total": total_branches,
            "active": active_branches,
            "active_branches": active_branches,
        },
    }

    # ---- Per-project comparison ----
    comp_map = {}
    for r in all_rows:
        comp = comp_map.setdefault(r["project_id"], {
            "project_id": r["project_id"],
            "project_name": r["project_name"],
            "repositories": 0,
            "commits": 0, "open_prs": 0, "merged_prs": 0, "open_issues": 0,
            "closed_issues": 0,
            "avg_cycle_hours": [], "avg_review_hours": [], "avg_resolution_hours": [],
        })
        comp["repositories"] += 1
        comp["commits"] += r["commits"]
        comp["open_prs"] += r["open_prs"]
        comp["merged_prs"] += r["merged_prs"]
        comp["open_issues"] += r["open_issues"]
        comp["closed_issues"] += r["closed_issues"]
        if r["avg_cycle_hours"]:
            comp["avg_cycle_hours"].append(r["avg_cycle_hours"])
        if r["avg_review_hours"]:
            comp["avg_review_hours"].append(r["avg_review_hours"])
        if r["avg_resolution_hours"]:
            comp["avg_resolution_hours"].append(r["avg_resolution_hours"])
    comparison = []
    for c in comp_map.values():
        comparison.append({
            "project_id": c["project_id"],
            "project_name": c["project_name"],
            "repositories": c["repositories"],
            "commits": c["commits"],
            "open_prs": c["open_prs"],
            "merged_prs": c["merged_prs"],
            "open_issues": c["open_issues"],
            "closed_issues": c["closed_issues"],
            "avg_cycle_hours": _avg(c["avg_cycle_hours"]),
            "avg_review_hours": _avg(c["avg_review_hours"]),
            "avg_resolution_hours": _avg(c["avg_resolution_hours"]),
        })

    projects_out = []
    for pid in project_ids:
        p = project_objs.get(pid)
        if not p:
            continue
        repo_count = sum(1 for r in scope_repos if r.project_id == pid)
        projects_out.append({"id": pid, "name": p.name, "key": p.key, "repo_count": repo_count})

    return {
        "projects": projects_out,
        "summary": summary,
        "repositories": {
            "items": repo_rows,
            "total": total,
            "page": page,
            "page_size": page_size,
        },
        "metrics": metrics,
        "comparison": comparison,
        "date_range": {
            "label": f"{from_dt.date().isoformat()} → {to_dt.date().isoformat()}",
            "from": from_dt.date().isoformat(),
            "to": to_dt.date().isoformat(),
        },
    }


def get_project_github_analytics(db: Session, project_id: str) -> dict:
    """Backward-compatible endpoint: returns real aggregated analytics for one project."""
    from_dt, to_dt = resolve_date_range("30d")
    data = get_central_github_analytics(db, [project_id], from_dt, to_dt)
    repo = db.query(GitHubRepository).filter(GitHubRepository.project_id == project_id)\
        .order_by(GitHubRepository.last_synced_at.desc()).first()
    metrics = data["summary"]
    return {
        "project_id": project_id,
        "repo_connected": repo is not None and repo.sync_status == "SYNCED",
        "repo_name": repo.repo_name if repo else None,
        "html_url": repo.html_url if repo else None,
        "sync_status": repo.sync_status if repo else "NOT_CONNECTED",
        "metrics": {
            "pr_cycle_time_avg_hours": metrics["avg_pr_cycle_hours"],
            "pr_review_time_avg_hours": metrics["avg_review_hours"],
            "issue_resolution_avg_hours": metrics["avg_resolution_hours"],
            "commit_frequency_weekly": metrics["commit_frequency_weekly"],
            "open_prs_count": metrics["open_prs"],
            "merged_prs_count": metrics["merged_prs"],
            "open_issues_count": metrics["open_issues"],
        },
        "engineering_trends": data["metrics"]["commits"]["activity"] or _empty_trend(from_dt, to_dt),
    }


def _empty_trend(from_dt: datetime, to_dt: datetime) -> List[dict]:
    days = min(7, max(1, (to_dt - from_dt).days))
    out = []
    for i in range(days):
        day = (from_dt + timedelta(days=i)).date()
        out.append({"date": day.isoformat(), "commits": 0})
    return out


# ---------------------------------------------------------------------------
# LIVE GitHub reads — GitHub is the source of truth for engineering activity.
# These functions call the GitHub REST API directly (no DB snapshot), with a
# short-TTL in-memory cache so 30s UI polling does not hammer the API.
# ---------------------------------------------------------------------------

LIVE_CACHE_TTL = 25  # seconds — short TTL so polling always gets fresh GitHub data

_live_cache = {}


def _live_cache_get(key: str):
    entry = _live_cache.get(key)
    if entry and entry["expires"] > time.time():
        return entry["data"]
    if entry:
        _live_cache.pop(key, None)
    return None


def _live_cache_set(key: str, data: dict, ttl: Optional[float] = None):
    _live_cache[key] = {"data": data, "expires": time.time() + (ttl if ttl is not None else LIVE_CACHE_TTL)}


def _handle_live_error(cache_key: str, err: dict, fetched_at: str) -> dict:
    """Cache error results so we never hammer GitHub while rate limited or unavailable."""
    err["fetched_at"] = fetched_at
    if err["status"] == "RATE_LIMIT":
        reset = err.get("reset_at")
        if reset:
            ttl = max(5.0, min(3600.0, float(reset) - time.time()))
        else:
            ttl = 60.0
        _live_cache_set(cache_key, err, ttl=ttl)
    return err


def _classify_github_response(resp) -> Optional[dict]:
    """Maps a GitHub API response to a friendly live status, or None if OK."""
    if resp is None:
        return {"status": "UNAVAILABLE", "message": GITHUB_UNAVAILABLE_MESSAGE}
    if resp.status_code == 200:
        return None
    if resp.status_code in (403, 429):
        body = {}
        try:
            body = resp.json() or {}
        except Exception:
            pass
        msg = (body.get("message") or "").lower()
        remaining = resp.headers.get("x-ratelimit-remaining")
        if resp.status_code == 429 or "rate limit" in msg or remaining == "0":
            result = {"status": "RATE_LIMIT", "message": RATE_LIMIT_MESSAGE}
            reset = resp.headers.get("x-ratelimit-reset")
            if reset:
                try:
                    result["reset_at"] = int(reset)
                except Exception:
                    pass
            return result
        return {"status": "PRIVATE", "message": PRIVATE_REPOSITORY_MESSAGE}
    if resp.status_code == 404:
        return {"status": "NOT_FOUND", "message": REPOSITORY_NOT_FOUND_MESSAGE}
    if resp.status_code == 401:
        return {"status": "PRIVATE", "message": PRIVATE_REPOSITORY_MESSAGE}
    return {"status": "UNAVAILABLE", "message": GITHUB_UNAVAILABLE_MESSAGE}


def _github_get(client: httpx.Client, headers: dict, path: str, params: Optional[dict] = None):
    try:
        return client.get(f"{GITHUB_API}{path}", headers=headers, params=params)
    except Exception:
        return None


def _parse_link_last(link_header: Optional[str], current: int = 1) -> int:
    if not link_header:
        return current
    m = re.search(r"[?&]page=(\d+)>;\s*rel=\"last\"", link_header)
    if m:
        return int(m.group(1))
    return current


def get_connected_repository(db: Session, project_id: str, repo_id: Optional[str] = None) -> Optional[GitHubRepository]:
    """The GitHub repository mapped to a project (first connected by default)."""
    q = db.query(GitHubRepository).filter(GitHubRepository.project_id == project_id)
    if repo_id:
        q = q.filter(GitHubRepository.id == repo_id)
    return q.order_by(GitHubRepository.created_at.asc()).first()


def _live_repo_payload(data: dict) -> dict:
    owner_obj = data.get("owner") or {}
    license_obj = data.get("license") or {}
    return {
        "github_repository_id": data.get("id"),
        "name": data.get("name"),
        "owner": owner_obj.get("login"),
        "full_name": data.get("full_name"),
        "description": data.get("description"),
        "homepage": data.get("homepage"),
        "default_branch": data.get("default_branch") or "main",
        "private": bool(data.get("private")),
        "visibility": data.get("visibility") or ("public" if not data.get("private") else "private"),
        "stars": data.get("stargazers_count") or 0,
        "forks": data.get("forks_count") or 0,
        "open_issues": data.get("open_issues_count") or 0,
        "watchers": data.get("subscribers_count") or 0,
        "language": data.get("language"),
        "license": license_obj.get("spdx_id") or license_obj.get("name"),
        "html_url": data.get("html_url"),
        "clone_url": data.get("clone_url"),
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
        "pushed_at": data.get("pushed_at"),
        "size": data.get("size"),
        "archived": bool(data.get("archived")),
    }


def _commit_payload(c: dict) -> dict:
    sha = c.get("sha") or ""
    commit = c.get("commit") or {}
    author = commit.get("author") or {}
    committer = commit.get("committer") or {}
    author_user = c.get("author") or {}
    message = (commit.get("message") or "").strip()
    return {
        "sha": sha,
        "short_sha": sha[:7],
        "message": message,
        "message_first_line": message.splitlines()[0] if message else "",
        "author_name": author.get("name") or author_user.get("login") or "Unknown",
        "author_email": author.get("email"),
        "author_login": author_user.get("login"),
        "author_avatar": author_user.get("avatar_url"),
        "authored_at": author.get("date") or committer.get("date"),
        "committed_at": committer.get("date") or author.get("date"),
        "url": c.get("html_url"),
    }


def _pr_payload(p: dict) -> dict:
    user = p.get("user") or {}
    head = p.get("head") or {}
    base = p.get("base") or {}
    state = "OPEN" if p.get("state") == "open" else ("MERGED" if p.get("merged_at") else "CLOSED")
    return {
        "number": p.get("number"),
        "title": p.get("title"),
        "body": p.get("body"),
        "state": state,
        "user_login": user.get("login"),
        "user_avatar": user.get("avatar_url"),
        "created_at": p.get("created_at"),
        "updated_at": p.get("updated_at"),
        "merged_at": p.get("merged_at"),
        "head_branch": head.get("ref"),
        "head_sha": head.get("sha"),
        "base_branch": base.get("ref"),
        "draft": bool(p.get("draft")),
        "html_url": p.get("html_url"),
        "comments": p.get("comments"),
    }


def _issue_payload(i: dict) -> dict:
    user = i.get("user") or {}
    return {
        "number": i.get("number"),
        "title": i.get("title"),
        "body": i.get("body"),
        "state": i.get("state"),
        "user_login": user.get("login"),
        "user_avatar": user.get("avatar_url"),
        "labels": [{"name": l.get("name"), "color": l.get("color")} for l in (i.get("labels") or [])],
        "created_at": i.get("created_at"),
        "updated_at": i.get("updated_at"),
        "comments": i.get("comments"),
        "assignees": len(i.get("assignees") or []),
        "html_url": i.get("html_url"),
    }


def live_repository(db: Session, project_id: str, repo_id: Optional[str] = None,
                    force: bool = False) -> dict:
    """Live repository overview + latest commit straight from GitHub."""
    repo = get_connected_repository(db, project_id, repo_id)
    if not repo:
        return {"status": "NO_REPOSITORY", "message": "This project has no GitHub repository connected."}
    cache_key = f"repo:{project_id}:{repo.id}"
    cached = _live_cache_get(cache_key)
    if cached is not None and not force:
        return cached
    headers = get_server_headers()
    fetched_at = datetime.now(timezone.utc).isoformat()
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = _github_get(client, headers, f"/repos/{repo.owner}/{repo.repo_name}")
            err = _classify_github_response(resp)
            if err:
                return _handle_live_error(cache_key, err, fetched_at)
            data = resp.json()
            latest = None
            lresp = _github_get(
                client, headers, f"/repos/{repo.owner}/{repo.repo_name}/commits", {"per_page": 1}
            )
            if lresp and lresp.status_code == 200:
                arr = lresp.json() or []
                if arr:
                    latest = _commit_payload(arr[0])
        payload = {
            "status": "OK",
            "repository": _live_repo_payload(data),
            "latest_commit": latest,
            "fetched_at": fetched_at,
        }
        _live_cache_set(cache_key, payload)
        print(f"[GitHubLive] project={project_id} repo={repo.owner}/{repo.repo_name} status=OK latest_sha={(latest or {}).get('short_sha')} fetched_at={fetched_at}")
        return payload
    except Exception:
        return {"status": "UNAVAILABLE", "message": GITHUB_UNAVAILABLE_MESSAGE, "fetched_at": fetched_at}


def live_commits(db: Session, project_id: str, branch: Optional[str] = None,
                 page: int = 1, per_page: int = 20, repo_id: Optional[str] = None,
                 force: bool = False) -> dict:
    """Live paginated commits for a branch, straight from GitHub."""
    repo = get_connected_repository(db, project_id, repo_id)
    if not repo:
        return {"status": "NO_REPOSITORY", "message": "This project has no GitHub repository connected."}
    page = max(1, int(page))
    per_page = min(100, max(1, int(per_page)))
    cache_key = f"commits:{project_id}:{repo.id}:{branch or ''}:{page}:{per_page}"
    cached = _live_cache_get(cache_key)
    if cached is not None and not force:
        return cached
    headers = get_server_headers()
    fetched_at = datetime.now(timezone.utc).isoformat()
    params = {"per_page": per_page, "page": page}
    if branch:
        params["sha"] = branch
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = _github_get(client, headers, f"/repos/{repo.owner}/{repo.repo_name}/commits", params)
            err = _classify_github_response(resp)
            if err:
                return _handle_live_error(cache_key, err, fetched_at)
            arr = resp.json() or []
            last_page = _parse_link_last(resp.headers.get("Link"), page)
            commits = [_commit_payload(c) for c in arr]
            total_commits = last_page * per_page
            if page == 1:
                total = _github_get(
                    client, headers, f"/repos/{repo.owner}/{repo.repo_name}/commits",
                    {"per_page": 1, **({"sha": branch} if branch else {})}
                )
                if total and total.status_code == 200:
                    total_commits = _parse_link_last(total.headers.get("Link"), 1)
        payload = {
            "status": "OK",
            "commits": commits,
            "page": page,
            "per_page": per_page,
            "last_page": last_page,
            "total_commits": total_commits,
            "branch": branch,
            "fetched_at": fetched_at,
        }
        _live_cache_set(cache_key, payload)
        latest = commits[0]["short_sha"] if commits else None
        print(f"[GitHubLive] project={project_id} repo={repo.owner}/{repo.repo_name} branch={branch or 'default'} page={page} commits={len(commits)} latest_sha={latest} fetched_at={fetched_at}")
        return payload
    except Exception:
        return {"status": "UNAVAILABLE", "message": GITHUB_UNAVAILABLE_MESSAGE, "fetched_at": fetched_at}


def live_branches(db: Session, project_id: str, repo_id: Optional[str] = None,
                  force: bool = False) -> dict:
    """Live list of branches for the connected repository."""
    repo = get_connected_repository(db, project_id, repo_id)
    if not repo:
        return {"status": "NO_REPOSITORY", "message": "This project has no GitHub repository connected."}
    cache_key = f"branches:{project_id}:{repo.id}"
    cached = _live_cache_get(cache_key)
    if cached is not None and not force:
        return cached
    headers = get_server_headers()
    fetched_at = datetime.now(timezone.utc).isoformat()
    try:
        default_branch = None
        with httpx.Client(timeout=20.0) as client:
            info = _github_get(client, headers, f"/repos/{repo.owner}/{repo.repo_name}")
            err = _classify_github_response(info)
            if err:
                return _handle_live_error(cache_key, err, fetched_at)
            default_branch = (info.json() or {}).get("default_branch") or "main"
            branches = []
            page = 1
            while page <= 5:
                resp = _github_get(
                    client, headers, f"/repos/{repo.owner}/{repo.repo_name}/branches",
                    {"per_page": 100, "page": page}
                )
                if not resp or resp.status_code != 200:
                    break
                batch = resp.json() or []
                branches.extend({"name": b.get("name"), "sha": (b.get("commit") or {}).get("sha")} for b in batch)
                if len(batch) < 100:
                    break
                page += 1
        payload = {
            "status": "OK",
            "default_branch": default_branch,
            "branches": branches,
            "fetched_at": fetched_at,
        }
        _live_cache_set(cache_key, payload)
        print(f"[GitHubLive] project={project_id} repo={repo.owner}/{repo.repo_name} branches={len(branches)} fetched_at={fetched_at}")
        return payload
    except Exception:
        return {"status": "UNAVAILABLE", "message": GITHUB_UNAVAILABLE_MESSAGE, "fetched_at": fetched_at}


def live_pull_requests(db: Session, project_id: str, state: str = "all",
                       per_page: int = 50, repo_id: Optional[str] = None,
                       force: bool = False) -> dict:
    """Live pull requests from GitHub."""
    repo = get_connected_repository(db, project_id, repo_id)
    if not repo:
        return {"status": "NO_REPOSITORY", "message": "This project has no GitHub repository connected."}
    state = state if state in ("open", "closed", "all") else "all"
    per_page = min(100, max(1, int(per_page)))
    cache_key = f"prs:{project_id}:{repo.id}:{state}:{per_page}"
    cached = _live_cache_get(cache_key)
    if cached is not None and not force:
        return cached
    headers = get_server_headers()
    fetched_at = datetime.now(timezone.utc).isoformat()
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = _github_get(
                client, headers, f"/repos/{repo.owner}/{repo.repo_name}/pulls",
                {"state": state, "per_page": per_page, "sort": "updated", "direction": "desc"}
            )
            err = _classify_github_response(resp)
            if err:
                return _handle_live_error(cache_key, err, fetched_at)
            prs = [_pr_payload(p) for p in (resp.json() or [])]
        payload = {"status": "OK", "pull_requests": prs, "count": len(prs), "fetched_at": fetched_at}
        _live_cache_set(cache_key, payload)
        print(f"[GitHubLive] project={project_id} repo={repo.owner}/{repo.repo_name} prs={len(prs)} state={state} fetched_at={fetched_at}")
        return payload
    except Exception:
        return {"status": "UNAVAILABLE", "message": GITHUB_UNAVAILABLE_MESSAGE, "fetched_at": fetched_at}


def live_issues(db: Session, project_id: str, state: str = "open",
                per_page: int = 50, repo_id: Optional[str] = None,
                force: bool = False) -> dict:
    """Live issues from GitHub (pull requests excluded)."""
    repo = get_connected_repository(db, project_id, repo_id)
    if not repo:
        return {"status": "NO_REPOSITORY", "message": "This project has no GitHub repository connected."}
    state = state if state in ("open", "closed", "all") else "open"
    per_page = min(100, max(1, int(per_page)))
    cache_key = f"issues:{project_id}:{repo.id}:{state}:{per_page}"
    cached = _live_cache_get(cache_key)
    if cached is not None and not force:
        return cached
    headers = get_server_headers()
    fetched_at = datetime.now(timezone.utc).isoformat()
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = _github_get(
                client, headers, f"/repos/{repo.owner}/{repo.repo_name}/issues",
                {"state": state, "per_page": per_page, "sort": "updated", "direction": "desc"}
            )
            err = _classify_github_response(resp)
            if err:
                return _handle_live_error(cache_key, err, fetched_at)
            issues = [_issue_payload(i) for i in (resp.json() or []) if "pull_request" not in i]
        payload = {"status": "OK", "issues": issues, "count": len(issues), "fetched_at": fetched_at}
        _live_cache_set(cache_key, payload)
        print(f"[GitHubLive] project={project_id} repo={repo.owner}/{repo.repo_name} issues={len(issues)} state={state} fetched_at={fetched_at}")
        return payload
    except Exception:
        return {"status": "UNAVAILABLE", "message": GITHUB_UNAVAILABLE_MESSAGE, "fetched_at": fetched_at}


def live_activity(db: Session, project_id: str, branch: Optional[str] = None,
                  repo_id: Optional[str] = None, force: bool = False) -> dict:
    """Live aggregate snapshot for a project: repo overview + metrics + branches +
    recent commits + pull requests + issues. GitHub is the source of truth."""
    repo = get_connected_repository(db, project_id, repo_id)
    if not repo:
        return {"status": "NO_REPOSITORY", "message": "This project has no GitHub repository connected."}
    cache_key = f"activity:{project_id}:{repo.id}:{branch or ''}"
    cached = _live_cache_get(cache_key)
    if cached is not None and not force:
        return cached
    headers = get_server_headers()
    fetched_at = datetime.now(timezone.utc).isoformat()
    now = datetime.now(timezone.utc)
    try:
        with httpx.Client(timeout=25.0) as client:
            base = f"/repos/{repo.owner}/{repo.repo_name}"
            info = _github_get(client, headers, base)
            err = _classify_github_response(info)
            if err:
                return _handle_live_error(cache_key, err, fetched_at)
            data = info.json()
            default_branch = data.get("default_branch") or "main"
            effective = branch or default_branch

            branches = []
            br_page = 1
            while br_page <= 5:
                br = _github_get(client, headers, f"{base}/branches", {"per_page": 100, "page": br_page})
                if not br or br.status_code != 200:
                    break
                batch = br.json() or []
                branches.extend({"name": b.get("name"), "sha": (b.get("commit") or {}).get("sha")} for b in batch)
                if len(batch) < 100:
                    break
                br_page += 1

            total = _github_get(client, headers, f"{base}/commits", {"per_page": 1, "sha": effective})
            total_commits = _parse_link_last(total.headers.get("Link") if total else None, 1)
            latest_commit = None
            if total and total.status_code == 200:
                arr = total.json() or []
                if arr:
                    latest_commit = _commit_payload(arr[0])

            since = (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
            window_commits = []
            pg = 1
            while pg <= 3:
                c = _github_get(client, headers, f"{base}/commits",
                                {"per_page": 100, "page": pg, "sha": effective, "since": since})
                if not c or c.status_code != 200:
                    break
                batch = c.json() or []
                window_commits.extend(_commit_payload(x) for x in batch)
                if len(batch) < 100:
                    break
                pg += 1

            week_ago = now - timedelta(days=7)
            contributors = set()
            commits_week = 0
            for pc in window_commits:
                author = (pc.get("author_login") or pc.get("author_email") or pc.get("author_name") or "").lower()
                if author:
                    contributors.add(author)
                try:
                    d = datetime.fromisoformat((pc.get("authored_at") or "").replace("Z", "+00:00"))
                    if d >= week_ago:
                        commits_week += 1
                except Exception:
                    pass
            if not window_commits and latest_commit:
                author = (latest_commit.get("author_login") or latest_commit.get("author_email") or latest_commit.get("author_name") or "").lower()
                if author:
                    contributors.add(author)
            commits_month = len(window_commits)

            prs = []
            pr_page = 1
            while pr_page <= 2:
                pr = _github_get(client, headers, f"{base}/pulls",
                                 {"state": "all", "per_page": 100, "page": pr_page, "sort": "updated", "direction": "desc"})
                if not pr or pr.status_code != 200:
                    break
                batch = pr.json() or []
                prs.extend(_pr_payload(x) for x in batch)
                if len(batch) < 100:
                    break
                pr_page += 1
            open_prs = [p for p in prs if p["state"] == "OPEN"]
            merged_prs = [p for p in prs if p["state"] == "MERGED"]

            issues = []
            is_page = 1
            while is_page <= 2:
                iss = _github_get(client, headers, f"{base}/issues",
                                  {"state": "open", "per_page": 100, "page": is_page, "sort": "updated", "direction": "desc"})
                if not iss or iss.status_code != 200:
                    break
                batch = [x for x in (iss.json() or []) if "pull_request" not in x]
                issues.extend(_issue_payload(x) for x in batch)
                if len(batch) < 100:
                    break
                is_page += 1

        metrics = {
            "total_commits": total_commits,
            "commits_this_week": commits_week,
            "commits_this_month": commits_month,
            "active_contributors": len(contributors),
            "open_pull_requests": len(open_prs),
            "merged_pull_requests": len(merged_prs),
            "open_issues": len(issues),
            "total_branches": len(branches),
            "latest_commit_sha": latest_commit["short_sha"] if latest_commit else None,
            "latest_commit_at": latest_commit["committed_at"] if latest_commit else None,
        }
        payload = {
            "status": "OK",
            "repository": _live_repo_payload(data),
            "default_branch": default_branch,
            "branch": effective,
            "metrics": metrics,
            "latest_commit": latest_commit,
            "commits": (window_commits[:20] if window_commits else ([latest_commit] if latest_commit else [])),
            "branches": branches,
            "pull_requests": prs[:50],
            "issues": issues[:50],
            "last_synced": fetched_at,
        }
        _live_cache_set(cache_key, payload)
        print(f"[GitHubLive] project={project_id} repo={repo.owner}/{repo.repo_name} branch={effective} commits={len(window_commits)} latest_sha={metrics['latest_commit_sha']} status=OK last_sync={fetched_at}")
        return payload
    except Exception:
        return {"status": "UNAVAILABLE", "message": GITHUB_UNAVAILABLE_MESSAGE, "fetched_at": fetched_at}
