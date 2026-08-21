from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date

# --- Auth Schemas ---
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False
    captcha_id: Optional[str] = None
    captcha_code: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class InviteAcceptRequest(BaseModel):
    token: str
    password: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None

# --- User & Profile Schemas ---
class ProfileBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    status: str = "ACTIVE"
    bio: Optional[str] = None

class ProfileCreate(ProfileBase):
    password: str
    role_name: str # admin, manager, developer

class ProfileResponse(ProfileBase):
    id: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Invitation Schemas ---
class InviteManagerRequest(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    manager_id: Optional[str] = None
    project_id: Optional[str] = None
    team: Optional[str] = "Engineering Management"

    @property
    def is_existing_manager(self) -> bool:
        return bool(self.manager_id)

class InviteDeveloperRequest(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    project_id: str
    team: Optional[str] = "Frontend Core"

class DeveloperAssignRequest(BaseModel):
    developer_id: Optional[str] = None
    developer_ids: Optional[List[str]] = None
    team: Optional[str] = None

class ProjectInvitationResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    project_id: Optional[str]
    team: Optional[str]
    token: str
    status: str
    expires_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True

# --- Project Schemas ---
class ProjectCreate(BaseModel):
    name: str
    key: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    manager_id: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    manager_id: Optional[str] = None
    ai_risk_score: Optional[float] = None
    health_status: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    key: str
    description: Optional[str]
    status: str
    start_date: Optional[date]
    target_date: Optional[date]
    manager_id: Optional[str]
    manager_name: Optional[str] = None
    ai_risk_score: float
    health_status: str
    created_at: datetime
    updated_at: datetime
    total_tasks: Optional[int] = 0
    completed_tasks: Optional[int] = 0
    developers_count: Optional[int] = 0

    class Config:
        from_attributes = True

# --- Sprint Schemas ---
class SprintCreate(BaseModel):
    project_id: str
    name: str
    goal: Optional[str] = None
    start_date: date
    end_date: date

class SprintUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None

class SprintResponse(BaseModel):
    id: str
    project_id: str
    name: str
    goal: Optional[str]
    start_date: date
    end_date: date
    status: str
    created_at: datetime
    total_tasks: Optional[int] = 0
    completed_tasks: Optional[int] = 0
    rejected_tasks: Optional[int] = 0
    progress_percentage: Optional[int] = 0
    derived_status: Optional[str] = "PLANNED"

    class Config:
        from_attributes = True

# --- Task Schemas ---
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "MEDIUM"
    project_id: str
    sprint_id: Optional[str] = None
    estimated_hours: float = 0.0
    story_points: int = 1
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    assigned_developer_id: Optional[str] = None
    use_active_sprint: bool = False

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    sprint_id: Optional[str] = None
    estimated_hours: Optional[float] = None
    story_points: Optional[int] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    assigned_developer_id: Optional[str] = None

class TaskProgressUpdate(BaseModel):
    progress: int = Field(ge=0, le=100)
    status: str
    notes: Optional[str] = None

class TaskReviewRequest(BaseModel):
    action: str # APPROVE, REJECT, REQUEST_CHANGES
    feedback: Optional[str] = None

class TaskAttachmentResponse(BaseModel):
    id: str
    file_name: str
    file_url: str
    file_type: Optional[str]
    file_size: Optional[int]
    uploaded_at: datetime

    class Config:
        from_attributes = True

class CommentCreate(BaseModel):
    content: str

class CommentResponse(BaseModel):
    id: str
    task_id: str
    author_id: str
    author_name: str
    author_avatar: Optional[str]
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    priority: str
    status: str
    progress: int
    project_id: str
    project_name: Optional[str] = None
    sprint_id: Optional[str]
    sprint_name: Optional[str] = None
    estimated_hours: float
    story_points: int
    start_date: Optional[date]
    due_date: Optional[date]
    assigned_developer_id: Optional[str]
    assigned_developer_name: Optional[str] = None
    assigned_developer_avatar: Optional[str] = None
    created_by: str
    created_at: datetime
    attachments: List[TaskAttachmentResponse] = []
    comments_count: Optional[int] = 0
    submitted_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None

    class Config:
        from_attributes = True

# --- AI Schemas ---
class AIChatRequest(BaseModel):
    prompt: str
    project_id: Optional[str] = None
    feature_context: Optional[str] = "general"
    mode: Optional[str] = "FULL_WORKSPACE"

class AIAnalysisResponse(BaseModel):
    summary: str
    risk_score: float
    health_status: str
    recommendations: List[str]
    insights: Dict[str, Any]

# --- Report Schemas ---
class ReportGenerateRequest(BaseModel):
    title: str
    report_type: str # WEEKLY, SPRINT, PROJECT, DEVELOPER
    format: str # PDF, CSV, EXCEL
    project_id: Optional[str] = None
    developer_id: Optional[str] = None

# --- Notification Schemas ---
class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    type: str
    is_read: bool
    link: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# --- Extended Enterprise Feature Schemas ---
class ProjectHealthResponse(BaseModel):
    health_score: int # 0 to 100
    health_status: str # Excellent, Good, Needs Attention, Critical
    completed_tasks: int
    delayed_tasks: int
    bug_count: int
    sprint_progress: float
    team_productivity: float
    deadline_status: str
    ai_explanation: str

class AISprintPlanRequest(BaseModel):
    project_id: str
    sprint_name: Optional[str] = None
    target_focus: Optional[str] = "Feature Delivery & Velocity"

class AISprintPlanResponse(BaseModel):
    goal: str
    duration_weeks: int
    recommended_tasks: List[Dict[str, Any]]
    total_story_points: int
    estimated_completion_date: str
    recommended_developers: List[str]
    workload_distribution: Dict[str, Any]

class AITaskGenerateRequest(BaseModel):
    title: str
    project_id: Optional[str] = None

class AITaskGenerateResponse(BaseModel):
    title: str
    description: str
    acceptance_criteria: List[str]
    priority: str
    story_points: int
    estimated_hours: float
    dependencies: List[str]
    technical_notes: str

class AIDailyStandupResponse(BaseModel):
    yesterday_work: List[str]
    today_plan: List[str]
    current_blockers: List[str]
    pending_reviews: List[str]
    upcoming_deadlines: List[str]
    summary_text: str

class AIWeeklyReportResponse(BaseModel):
    completed_tasks_count: int
    pending_tasks_count: int
    sprint_progress_percentage: float
    developer_productivity_score: float
    project_health: str
    bug_summary: Dict[str, int]
    ai_recommendations: List[str]
    detailed_summary: str

class AIRiskPredictionResponse(BaseModel):
    sprint_delay_probability: float
    project_delay_risk: str
    overloaded_developers: List[Dict[str, Any]]
    high_risk_tasks: List[Dict[str, Any]]
    critical_bugs: int
    ai_recommendations: List[str]

class AIMeetingMinutesRequest(BaseModel):
    project_id: Optional[str] = None
    title: str
    raw_notes: str

class AIMeetingMinutesResponse(BaseModel):
    id: str
    title: str
    summary: str
    discussion_points: List[str]
    action_items: List[Dict[str, Any]]
    created_at: datetime

class FocusSessionCreate(BaseModel):
    task_id: Optional[str] = None
    duration_minutes: int
    notes: Optional[str] = None

class FocusSessionResponse(BaseModel):
    id: str
    developer_id: str
    task_id: Optional[str]
    duration_minutes: int
    status: str
    notes: Optional[str]
    started_at: datetime
    ended_at: datetime

    class Config:
        from_attributes = True

class DeveloperBadgeResponse(BaseModel):
    id: str
    developer_id: str
    badge_type: str
    badge_title: str
    description: Optional[str]
    icon_name: Optional[str]
    unlocked_at: datetime

    class Config:
        from_attributes = True

class LeaderboardItemResponse(BaseModel):
    rank_position: int
    developer_id: str
    developer_name: str
    avatar_url: Optional[str]
    completed_tasks: int
    story_points: int
    task_quality_score: float
    on_time_delivery_rate: float
    overall_productivity_score: float
    badges: List[str] = []

class WorkloadHeatmapItem(BaseModel):
    developer_id: str
    developer_name: str
    avatar_url: Optional[str]
    assigned_tasks: int
    estimated_hours: float
    completed_hours: float
    remaining_hours: float
    workload_status: str # LOW, MEDIUM, HIGH

class TeamVelocityResponse(BaseModel):
    sprint_velocity: int
    average_story_points: float
    completed_story_points: int
    remaining_story_points: int
    historical_trends: List[Dict[str, Any]]

class ActivityTimelineResponse(BaseModel):
    id: str
    event_type: str
    description: str
    user_name: Optional[str]
    created_at: datetime
    metadata_json: Optional[Dict[str, Any]]

class SystemSettingResponse(BaseModel):
    id: str
    setting_key: str
    setting_value: Optional[str]
    setting_type: str
    category: str
    description: Optional[str]
    updated_by: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True

class SystemSettingUpdate(BaseModel):
    setting_value: Optional[str]
