import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Text, ForeignKey, Boolean, Integer, Float, Date, DateTime, JSON, TypeDecorator
)
from sqlalchemy.orm import relationship
from app.core.database import Base

class ForceString(TypeDecorator):
    """Custom String type that guarantees all parameter bindings and result values
    are Python string representations, avoiding type mismatches with driver UUIDs.
    """
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return str(value)

def generate_uuid():
    return str(uuid.uuid4())

class Role(Base):
    __tablename__ = "roles"

    id = Column(ForceString(36), primary_key=True, default=generate_uuid)
    name = Column(String(50), unique=True, nullable=False) # admin, manager, developer
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    profiles = relationship("Profile", back_populates="role")

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(ForceString(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    avatar_url = Column(Text, nullable=True)
    role_id = Column(ForceString(36), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="ACTIVE") # ACTIVE, INACTIVE, PENDING
    bio = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    role = relationship("Role", back_populates="profiles")
    managed_projects = relationship("Project", foreign_keys="Project.manager_id", back_populates="manager")
    created_projects = relationship("Project", foreign_keys="Project.created_by", back_populates="creator")
    assigned_tasks = relationship("Task", foreign_keys="Task.assigned_developer_id", back_populates="assigned_developer")
    project_memberships = relationship("ProjectMember", back_populates="user")

class Project(Base):
    __tablename__ = "projects"

    id = Column(ForceString(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    key = Column(String(20), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="PLANNING") # PLANNING, ACTIVE, COMPLETED, ARCHIVED
    start_date = Column(Date, nullable=True)
    target_date = Column(Date, nullable=True)
    created_by = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    manager_id = Column(ForceString(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    ai_risk_score = Column(Float, default=0.0)
    health_status = Column(String(50), default="HEALTHY") # HEALTHY, AT_RISK, CRITICAL
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("Profile", foreign_keys=[created_by], back_populates="created_projects")
    manager = relationship("Profile", foreign_keys=[manager_id], back_populates="managed_projects")
    sprints = relationship("Sprint", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")

class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(ForceString(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(ForceString(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    role_in_project = Column(String(50), nullable=False) # MANAGER, DEVELOPER
    team = Column(String(100), nullable=True)
    joined_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="members")
    user = relationship("Profile", back_populates="project_memberships")

class ProjectInvitation(Base):
    __tablename__ = "project_invitations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    role = Column(String(50), nullable=False) # manager, developer
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    team = Column(String(100), nullable=True)
    token = Column(String(255), unique=True, nullable=False)
    status = Column(String(50), default="PENDING") # PENDING, ACCEPTED, EXPIRED, CANCELLED
    invited_by = Column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Sprint(Base):
    __tablename__ = "sprints"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    goal = Column(Text, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(50), default="PLANNED") # PLANNED, ACTIVE, COMPLETED
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="sprints")
    tasks = relationship("Task", back_populates="sprint")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(50), default="MEDIUM") # LOW, MEDIUM, HIGH, URGENT
    status = Column(String(50), default="NOT_STARTED") # NOT_STARTED, IN_PROGRESS, TESTING, COMPLETED, REVIEW_PENDING, REJECTED
    progress = Column(Integer, default=0) # 0 - 100
    sprint_id = Column(String(36), ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    estimated_hours = Column(Float, default=0.0)
    story_points = Column(Integer, default=1)
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    assigned_developer_id = Column(ForceString(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Task review lifecycle (developer -> manager approval)
    submitted_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_comment = Column(Text, nullable=True)

    project = relationship("Project", back_populates="tasks")
    sprint = relationship("Sprint", back_populates="tasks")
    assigned_developer = relationship("Profile", foreign_keys=[assigned_developer_id], back_populates="assigned_tasks")
    reviewer = relationship("Profile", foreign_keys=[reviewed_by])
    attachments = relationship("TaskAttachment", back_populates="task", cascade="all, delete-orphan")
    progress_history = relationship("TaskProgress", back_populates="task", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="task", cascade="all, delete-orphan")

class TaskAttachment(Base):
    __tablename__ = "task_attachments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_url = Column(Text, nullable=False)
    file_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)
    uploaded_by = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="attachments")

class TaskProgress(Base):
    __tablename__ = "task_progress"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    progress_percentage = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    updated_by = Column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="progress_history")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = relationship("Task", back_populates="comments")
    author = relationship("Profile")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="INFO")
    is_read = Column(Boolean, default=False)
    link = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(255), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(36), nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    report_type = Column(String(100), nullable=False)
    format = Column(String(20), nullable=False)
    generated_by = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    file_url = Column(Text, nullable=True)
    meta_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AIHistory(Base):
    __tablename__ = "ai_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    prompt = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    feature_type = Column(String(100), nullable=False)
    context_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    recipient = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(50), default="SENT")
    sent_at = Column(DateTime, default=datetime.utcnow)

class ProjectHealth(Base):
    __tablename__ = "project_health"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    health_score = Column(Integer, nullable=False)
    health_status = Column(String(50), nullable=False) # Excellent, Good, Needs Attention, Critical
    completed_tasks = Column(Integer, default=0)
    delayed_tasks = Column(Integer, default=0)
    bug_count = Column(Integer, default=0)
    sprint_progress = Column(Float, default=0.0)
    team_productivity = Column(Float, default=0.0)
    deadline_status = Column(String(50), default="ON_TRACK")
    ai_explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DeveloperBadge(Base):
    __tablename__ = "developer_badges"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    developer_id = Column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    badge_type = Column(String(100), nullable=False)
    badge_title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon_name = Column(String(100), nullable=True)
    unlocked_at = Column(DateTime, default=datetime.utcnow)

class Leaderboard(Base):
    __tablename__ = "leaderboard"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    developer_id = Column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    period = Column(String(50), default="WEEKLY")
    completed_tasks = Column(Integer, default=0)
    story_points = Column(Integer, default=0)
    task_quality_score = Column(Float, default=100.0)
    on_time_delivery_rate = Column(Float, default=100.0)
    overall_productivity_score = Column(Float, default=0.0)
    rank_position = Column(Integer, default=1)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MeetingMinutes(Base):
    __tablename__ = "meeting_minutes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=False)
    discussion_points = Column(JSON, nullable=True)
    action_items = Column(JSON, nullable=True)
    created_by = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class FocusSession(Base):
    __tablename__ = "focus_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    developer_id = Column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    duration_minutes = Column(Integer, nullable=False)
    status = Column(String(50), default="COMPLETED")
    notes = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, default=datetime.utcnow)

class RiskPrediction(Base):
    __tablename__ = "risk_predictions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    sprint_delay_probability = Column(Float, default=0.0)
    project_delay_risk = Column(String(50), default="LOW")
    overloaded_developers = Column(JSON, nullable=True)
    high_risk_tasks = Column(JSON, nullable=True)
    critical_bugs = Column(Integer, default=0)
    ai_recommendations = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AIReport(Base):
    __tablename__ = "ai_reports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    report_type = Column(String(100), nullable=False) # DAILY_STANDUP, WEEKLY_REPORT
    content = Column(JSON, nullable=False)
    generated_by = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class TeamVelocity(Base):
    __tablename__ = "team_velocity"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    sprint_id = Column(String(36), ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True)
    sprint_velocity = Column(Integer, default=0)
    average_story_points = Column(Float, default=0.0)
    completed_story_points = Column(Integer, default=0)
    remaining_story_points = Column(Integer, default=0)
    recorded_at = Column(DateTime, default=datetime.utcnow)

class WorkloadHistory(Base):
    __tablename__ = "workload_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    developer_id = Column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    assigned_tasks = Column(Integer, default=0)
    estimated_hours = Column(Float, default=0.0)
    completed_hours = Column(Float, default=0.0)
    remaining_hours = Column(Float, default=0.0)
    workload_status = Column(String(50), default="MEDIUM")
    recorded_at = Column(DateTime, default=datetime.utcnow)

class ActivityTimeline(Base):
    __tablename__ = "activity_timeline"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Machine Learning Models Storage
class MLPrediction(Base):
    __tablename__ = "ml_predictions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    model_name = Column(String(100), nullable=False) # ProjectDelayClassifier, WorkloadRiskRegressor
    model_version = Column(String(50), nullable=False, default="v1.0.0")
    prediction_type = Column(String(100), nullable=False) # PROJECT_DELAY, SPRINT_COMPLETION, WORKLOAD_RISK
    input_feature_summary = Column(JSON, nullable=True)
    prediction_label = Column(String(100), nullable=False) # DELAYED, ON_TIME, HIGH_RISK
    probability = Column(Float, nullable=False, default=0.0) # 0.0 to 1.0
    risk_level = Column(String(50), nullable=False, default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class MLModelVersion(Base):
    __tablename__ = "ml_model_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    model_name = Column(String(100), nullable=False)
    version = Column(String(50), nullable=False)
    accuracy_score = Column(Float, default=0.85)
    f1_score = Column(Float, default=0.83)
    parameters = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    trained_at = Column(DateTime, default=datetime.utcnow)

class MLTrainingRun(Base):
    __tablename__ = "ml_training_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    model_name = Column(String(100), nullable=False)
    training_sample_count = Column(Integer, default=0)
    metrics_summary = Column(JSON, nullable=True)
    run_status = Column(String(50), default="COMPLETED")
    executed_at = Column(DateTime, default=datetime.utcnow)

# AI Generative Intelligence Models
class AIInsight(Base):
    __tablename__ = "ai_insights"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    insight_type = Column(String(100), nullable=False) # PROJECT_EXPLANATION, BOTTLENECK_ANALYSIS, HEALTH_SUMMARY
    summary = Column(Text, nullable=False)
    detailed_explanation = Column(Text, nullable=True)
    impact_level = Column(String(50), default="MEDIUM")
    suggested_actions = Column(JSON, nullable=True)
    created_by = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    recommendation_category = Column(String(100), nullable=False) # DEVELOPER_ASSIGNMENT, CAPACITY_PLANNING, BOTTLENECK
    title = Column(String(255), nullable=False)
    reason = Column(Text, nullable=False)
    relevant_data = Column(JSON, nullable=True)
    status = Column(String(50), default="PENDING") # PENDING, ACCEPTED, REJECTED
    generated_at = Column(DateTime, default=datetime.utcnow)

# GitHub Engineering Analytics Database Storage
class GitHubConnection(Base):
    __tablename__ = "github_connections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    github_username = Column(String(255), nullable=False)
    access_token_encrypted = Column(Text, nullable=False) # Never sent to frontend
    scope = Column(String(255), nullable=True)
    connected_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class GitHubRepository(Base):
    __tablename__ = "github_repositories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    github_repository_id = Column(String(100), nullable=True)  # Real GitHub API repository id
    repo_name = Column(String(255), nullable=False)
    owner = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)  # owner/repo
    html_url = Column(Text, nullable=False)
    clone_url = Column(Text, nullable=True)
    repository_url = Column(Text, nullable=True)   # raw URL provided by the user (may include .git)
    normalized_url = Column(Text, nullable=True)   # https://github.com/owner/repo (no .git)
    description = Column(Text, nullable=True)
    visibility = Column(String(50), default="private") # private, public
    repo_type = Column(String(50), default="source")   # source, docs, tooling
    default_branch = Column(String(100), default="main")
    open_prs_count = Column(Integer, default=0)
    open_issues_count = Column(Integer, default=0)
    sync_status = Column(String(50), default="NOT_CONNECTED") # NOT_CONNECTED, SYNCING, SYNCED, FAILED
    last_sync_error = Column(Text, nullable=True)
    added_by = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    last_synced_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    commits = relationship("GitHubCommit", back_populates="repository", cascade="all, delete-orphan")
    pull_requests = relationship("GitHubPullRequest", back_populates="repository", cascade="all, delete-orphan")
    issues = relationship("GitHubIssue", back_populates="repository", cascade="all, delete-orphan")
    contributors = relationship("GitHubContributor", back_populates="repository", cascade="all, delete-orphan")
    branches = relationship("GitHubBranch", back_populates="repository", cascade="all, delete-orphan")

class GitHubCommit(Base):
    __tablename__ = "github_commits"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("github_repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    commit_sha = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    author_name = Column(String(255), nullable=True)
    author_email = Column(String(255), nullable=True)
    committed_at = Column(DateTime, nullable=False)

    repository = relationship("GitHubRepository", back_populates="commits")

class GitHubPullRequest(Base):
    __tablename__ = "github_pull_requests"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("github_repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    pr_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    state = Column(String(50), nullable=False) # open, closed, merged
    author_username = Column(String(255), nullable=False)
    created_at_gh = Column(DateTime, nullable=False)
    merged_at_gh = Column(DateTime, nullable=True)
    closed_at_gh = Column(DateTime, nullable=True)
    cycle_time_hours = Column(Float, default=0.0)

    repository = relationship("GitHubRepository", back_populates="pull_requests")
    reviews = relationship("GitHubReview", back_populates="pull_request", cascade="all, delete-orphan")

class GitHubReview(Base):
    __tablename__ = "github_reviews"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    pr_id = Column(String(36), ForeignKey("github_pull_requests.id", ondelete="CASCADE"), nullable=False)
    reviewer_username = Column(String(255), nullable=False)
    state = Column(String(50), nullable=False) # APPROVED, CHANGES_REQUESTED, COMMENTED
    submitted_at = Column(DateTime, default=datetime.utcnow)

    pull_request = relationship("GitHubPullRequest", back_populates="reviews")

class GitHubIssue(Base):
    __tablename__ = "github_issues"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("github_repositories.id", ondelete="CASCADE"), nullable=False)
    issue_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    state = Column(String(50), nullable=False) # open, closed
    resolution_time_hours = Column(Float, default=0.0)
    created_at_gh = Column(DateTime, nullable=False)
    closed_at_gh = Column(DateTime, nullable=True)

    repository = relationship("GitHubRepository", back_populates="issues")

class GitHubContributor(Base):
    __tablename__ = "github_contributors"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("github_repositories.id", ondelete="CASCADE"), nullable=False)
    username = Column(String(255), nullable=False)
    commits_count = Column(Integer, default=0)
    prs_count = Column(Integer, default=0)
    reviews_count = Column(Integer, default=0)

    repository = relationship("GitHubRepository", back_populates="contributors")

class GitHubBranch(Base):
    __tablename__ = "github_branches"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("github_repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_name = Column(String(255), nullable=False)
    is_default = Column(Boolean, default=False)
    last_commit_at = Column(DateTime, nullable=True)
    commits_count = Column(Integer, default=0)

    repository = relationship("GitHubRepository", back_populates="branches")

# Aggregated Engineering Metrics
class EngineeringMetrics(Base):
    __tablename__ = "engineering_metrics"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    pr_cycle_time_avg_hours = Column(Float, default=0.0)
    pr_review_time_avg_hours = Column(Float, default=0.0)
    issue_resolution_avg_hours = Column(Float, default=0.0)
    commit_frequency_weekly = Column(Float, default=0.0)
    open_prs_count = Column(Integer, default=0)
    merged_prs_count = Column(Integer, default=0)
    testing_bottleneck_score = Column(Float, default=0.0)
    review_bottleneck_score = Column(Float, default=0.0)
    calculated_at = Column(DateTime, default=datetime.utcnow, index=True)

class DeveloperMetrics(Base):
    __tablename__ = "developer_metrics"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    developer_id = Column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    assigned_tasks_count = Column(Integer, default=0)
    completed_tasks_count = Column(Integer, default=0)
    estimated_hours_total = Column(Float, default=0.0)
    completed_hours_total = Column(Float, default=0.0)
    story_points_total = Column(Integer, default=0)
    workload_percentage = Column(Float, default=0.0)
    risk_level = Column(String(50), default="LOW") # LOW, MEDIUM, HIGH
    calculated_at = Column(DateTime, default=datetime.utcnow)

class SprintMetrics(Base):
    __tablename__ = "sprint_metrics"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    sprint_id = Column(String(36), ForeignKey("sprints.id", ondelete="CASCADE"), nullable=False, index=True)
    planned_story_points = Column(Integer, default=0)
    completed_story_points = Column(Integer, default=0)
    velocity_score = Column(Float, default=0.0)
    completion_rate_percentage = Column(Float, default=0.0)
    calculated_at = Column(DateTime, default=datetime.utcnow)

# Sprint Retrospective Models
class SprintRetrospective(Base):
    __tablename__ = "sprint_retrospectives"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    sprint_id = Column(String(36), ForeignKey("sprints.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    what_went_well = Column(JSON, nullable=True)
    what_did_not_go_well = Column(JSON, nullable=True)
    main_blockers = Column(JSON, nullable=True)
    performance_observations = Column(JSON, nullable=True)
    root_causes = Column(JSON, nullable=True)
    recommendations_next_sprint = Column(JSON, nullable=True)
    is_approved_by_manager = Column(Boolean, default=False)
    created_by = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class RetrospectiveActionItem(Base):
    __tablename__ = "retrospective_action_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    retrospective_id = Column(String(36), ForeignKey("sprint_retrospectives.id", ondelete="CASCADE"), nullable=False)
    action_text = Column(Text, nullable=False)
    assignee_id = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), default="PENDING") # PENDING, IN_PROGRESS, COMPLETED
    created_at = Column(DateTime, default=datetime.utcnow)

# What-If Project Simulator Models
class ProjectSimulation(Base):
    __tablename__ = "project_simulations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    scenario_type = Column(String(100), nullable=False) # DEV_UNAVAILABLE, ADD_DEV, REMOVE_TASKS, MOVE_DEADLINE
    parameters = Column(JSON, nullable=False)
    created_by = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class SimulationResult(Base):
    __tablename__ = "simulation_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    simulation_id = Column(String(36), ForeignKey("project_simulations.id", ondelete="CASCADE"), nullable=False)
    baseline_completion_date = Column(Date, nullable=True)
    simulated_completion_date = Column(Date, nullable=True)
    expected_delay_days = Column(Integer, default=0)
    risk_level = Column(String(50), default="MEDIUM")
    impact_summary = Column(Text, nullable=True)
    affected_tasks = Column(JSON, nullable=True)
    calculated_at = Column(DateTime, default=datetime.utcnow)

# AI Release Readiness Models
class ReleaseReadiness(Base):
    __tablename__ = "release_readiness"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    readiness_score = Column(Integer, nullable=False, default=0) # 0 - 100
    status = Column(String(50), nullable=False, default="NEEDS_REVIEW") # READY, READY_WITH_WARNINGS, NOT_READY
    code_health_status = Column(String(50), default="GOOD")
    task_completion_status = Column(String(50), default="GOOD")
    testing_status = Column(String(50), default="WARNING")
    bug_status = Column(String(50), default="GOOD")
    pr_review_status = Column(String(50), default="WARNING")
    documentation_status = Column(String(50), default="GOOD")
    ai_recommendation = Column(Text, nullable=True)
    calculated_at = Column(DateTime, default=datetime.utcnow)

class ReleaseCheck(Base):
    __tablename__ = "release_checks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    release_readiness_id = Column(String(36), ForeignKey("release_readiness.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(100), nullable=False) # TASKS, BUGS, REVIEWS, TESTING, DOCS
    check_name = Column(String(255), nullable=False)
    passed = Column(Boolean, default=True)
    details = Column(Text, nullable=True)

class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    setting_key = Column(String(100), unique=True, nullable=False, index=True)
    setting_value = Column(String(1000), nullable=True)
    setting_type = Column(String(50), nullable=False) # string, boolean, number
    category = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    updated_by = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

