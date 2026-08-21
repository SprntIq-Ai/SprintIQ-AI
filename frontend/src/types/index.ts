export type RoleType = 'admin' | 'manager' | 'developer';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: RoleType;
  phone?: string;
  status: string;
  bio?: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string;
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  start_date?: string;
  target_date?: string;
  manager_id?: string;
  manager_name?: string;
  ai_risk_score: number;
  health_status: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  created_at: string;
  updated_at: string;
  total_tasks?: number;
  completed_tasks?: number;
  developers_count?: number;
}

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal?: string;
  start_date: string;
  end_date: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  derived_status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
  created_at: string;
  total_tasks?: number;
  completed_tasks?: number;
  rejected_tasks?: number;
  progress_percentage?: number;
}

export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'TESTING' | 'COMPLETED' | 'REVIEW_PENDING' | 'REJECTED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  uploaded_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  project_id: string;
  project_name?: string;
  sprint_id?: string;
  sprint_name?: string;
  estimated_hours: number;
  story_points: number;
  start_date?: string;
  due_date?: string;
  assigned_developer_id?: string;
  assigned_developer_name?: string;
  created_by: string;
  created_at: string;
  attachments?: TaskAttachment[];
  comments_count?: number;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by_name?: string;
  review_comment?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'TASK_ASSIGNED' | 'TASK_SUBMITTED' | 'TASK_APPROVED' | 'TASK_REJECTED';
  is_read: boolean;
  link?: string;
  created_at: string;
}

export interface AIAnalysis {
  summary: string;
  risk_score: number;
  health_status: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  recommendations: string[];
  insights: Record<string, any>;
}

export interface ProjectInvitation {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  project_id?: string;
  team?: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  full_name: string;
  email: string;
  role_in_project: string;
  status: string;
  joined_at?: string;
  assigned_tasks: number;
}

export interface AvailableDeveloper {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  status: string;
  assigned?: boolean;
}

export interface ProjectHealthData {
  health_score: number; // 0-100
  health_status: 'Excellent' | 'Good' | 'Needs Attention' | 'Critical';
  completed_tasks: number;
  delayed_tasks: number;
  bug_count: number;
  sprint_progress: number;
  team_productivity: number;
  deadline_status: string;
  ai_explanation: string;
}

export interface AISprintPlan {
  goal: string;
  duration_weeks: number;
  recommended_tasks: Array<{
    title: string;
    story_points: number;
    estimated_hours: number;
    priority: string;
  }>;
  total_story_points: number;
  estimated_completion_date: string;
  recommended_developers: string[];
  workload_distribution: Record<string, number>;
}

export interface AITaskDetails {
  title: string;
  description: string;
  acceptance_criteria: string[];
  priority: TaskPriority;
  story_points: number;
  estimated_hours: number;
  dependencies: string[];
  technical_notes: string;
}

export interface AIDailyStandup {
  yesterday_work: string[];
  today_plan: string[];
  current_blockers: string[];
  pending_reviews: string[];
  upcoming_deadlines: string[];
  summary_text: string;
}

export interface AIWeeklyReport {
  completed_tasks_count: number;
  pending_tasks_count: number;
  sprint_progress_percentage: number;
  developer_productivity_score: number;
  project_health: string;
  bug_summary: Record<string, number>;
  ai_recommendations: string[];
  detailed_summary: string;
}

export interface AIRiskPrediction {
  sprint_delay_probability: number;
  project_delay_risk: string;
  overloaded_developers: Array<Record<string, any>>;
  high_risk_tasks: Array<Record<string, any>>;
  critical_bugs: number;
  ai_recommendations: string[];
}

export interface AIMeetingMinutes {
  id: string;
  title: string;
  summary: string;
  discussion_points: string[];
  action_items: Array<{
    task_title: string;
    owner: string;
    deadline: string;
    priority: string;
  }>;
  created_at: string;
}

export interface FocusSession {
  id: string;
  developer_id: string;
  task_id?: string;
  duration_minutes: number;
  status: string;
  notes?: string;
  started_at: string;
  ended_at: string;
}

export interface DeveloperBadge {
  id: string;
  developer_id: string;
  badge_type: string;
  badge_title: string;
  description?: string;
  icon_name?: string;
  unlocked_at: string;
}

export interface LeaderboardItem {
  rank_position: number;
  developer_id: string;
  developer_name: string;
  completed_tasks: number;
  story_points: number;
  task_quality_score: number;
  on_time_delivery_rate: number;
  overall_productivity_score: number;
  badges: string[];
}

export interface WorkloadHeatmapItem {
  developer_id: string;
  developer_name: string;
  developer_email?: string;
  assigned_projects: { id: string; name: string }[];
  assigned_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  submitted_tasks: number;
  rejected_tasks: number;
  estimated_hours: number;
  completed_hours: number;
  remaining_hours: number;
  capacity_percentage: number;
  workload_status: 'LOW' | 'MEDIUM' | 'HIGH' | 'OVER_CAPACITY';
  tasks_list: Task[];
}

export interface TeamVelocity {
  sprint_velocity: number;
  average_story_points: number;
  completed_story_points: number;
  remaining_story_points: number;
  historical_trends: Array<{
    sprint: string;
    planned: number;
    completed: number;
  }>;
  burndown_chart: Array<{
    day: string;
    ideal: number;
    actual: number;
  }>;
}

export interface GlobalSearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'PROJECT' | 'TASK' | 'DEVELOPER' | 'MANAGER' | 'REPORT';
  link: string;
}

// GitHub Engineering Analytics
export type GitHubSyncStatus = 'NOT_CONNECTED' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface GitHubRepoInfo {
  id: string;
  repo_name: string;
  owner: string;
  html_url: string;
  sync_status: GitHubSyncStatus;
  last_synced_at?: string;
}

export interface GitHubProjectInfo {
  id: string;
  name: string;
  key: string;
  status?: string;
  repositories: GitHubRepoInfo[];
}

export interface GitHubRepositoryRow {
  repo_id: string;
  project_id: string;
  project_name: string;
  project_key: string;
  repo_name: string;
  owner: string;
  html_url: string;
  description?: string;
  visibility: string;
  repo_type: string;
  default_branch: string;
  sync_status: GitHubSyncStatus;
  last_sync_error?: string;
  last_synced_at?: string;
  commits: number;
  open_prs: number;
  merged_prs: number;
  closed_prs: number;
  open_issues: number;
  closed_issues: number;
  avg_cycle_hours: number;
  avg_review_hours: number;
  avg_resolution_hours: number;
  active_contributors: number;
  total_branches: number;
  active_branches: number;
}

export interface GitHubActivityPoint {
  date: string;
  commits: number;
}

export interface GitHubContributorStat {
  username: string;
  commits: number;
  prs: number;
  reviews: number;
}

// ---- Live GitHub (source of truth = GitHub API) ----
export type GitHubLiveStatus = 'OK' | 'NO_REPOSITORY' | 'NOT_FOUND' | 'PRIVATE' | 'RATE_LIMIT' | 'UNAVAILABLE';

export interface GitHubLiveCommit {
  sha: string;
  short_sha: string;
  message: string;
  message_first_line: string;
  author_name?: string;
  author_email?: string;
  author_login?: string;
  authored_at?: string;
  committed_at?: string;
  url?: string;
}

export interface GitHubLiveRepository {
  github_repository_id?: number;
  name: string;
  owner?: string;
  full_name: string;
  description?: string;
  homepage?: string;
  default_branch: string;
  private: boolean;
  visibility: string;
  stars: number;
  forks: number;
  open_issues: number;
  watchers: number;
  language?: string;
  license?: string;
  html_url: string;
  clone_url?: string;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
  size?: number;
  archived: boolean;
}

export interface GitHubLiveBranch {
  name: string;
  sha?: string;
}

export interface GitHubLivePullRequest {
  number: number;
  title: string;
  body?: string;
  state: 'OPEN' | 'MERGED' | 'CLOSED';
  user_login?: string;
  created_at?: string;
  updated_at?: string;
  merged_at?: string;
  head_branch?: string;
  head_sha?: string;
  base_branch?: string;
  draft: boolean;
  html_url?: string;
  comments?: number;
}

export interface GitHubLiveIssue {
  number: number;
  title: string;
  body?: string;
  state: string;
  user_login?: string;
  labels: { name: string; color: string }[];
  created_at?: string;
  updated_at?: string;
  comments?: number;
  assignees?: number;
  html_url?: string;
}

export interface GitHubLiveMetrics {
  total_commits: number;
  commits_this_week: number;
  commits_this_month: number;
  active_contributors: number;
  open_pull_requests: number;
  merged_pull_requests: number;
  open_issues: number;
  total_branches: number;
  latest_commit_sha?: string;
  latest_commit_at?: string;
}

export interface GitHubLiveActivity {
  status: GitHubLiveStatus;
  message?: string;
  repository?: GitHubLiveRepository;
  default_branch?: string;
  branch?: string;
  metrics?: GitHubLiveMetrics;
  latest_commit?: GitHubLiveCommit | null;
  commits?: GitHubLiveCommit[];
  branches?: GitHubLiveBranch[];
  pull_requests?: GitHubLivePullRequest[];
  issues?: GitHubLiveIssue[];
  last_synced?: string;
  fetched_at?: string;
}

export interface GitHubLiveCommitsPage {
  status: GitHubLiveStatus;
  message?: string;
  commits: GitHubLiveCommit[];
  page: number;
  per_page: number;
  last_page: number;
  total_commits: number;
  branch?: string;
  fetched_at?: string;
}

export interface GitHubPullRequestMetrics {
  open: number;
  closed: number;
  merged: number;
  avg_cycle_hours: number;
  avg_review_hours: number;
  merge_rate: number;
}

export interface GitHubReviewMetrics {
  total: number;
  approved: number;
  changes_requested: number;
  commented: number;
  pending: number;
  avg_time_hours: number;
}

export interface GitHubIssueMetrics {
  open: number;
  closed: number;
  avg_resolution_hours: number;
  resolution_rate: number;
}

export interface GitHubCommitMetrics {
  count: number;
  frequency_per_week: number;
  activity: GitHubActivityPoint[];
}

export interface GitHubContributorMetrics {
  active: number;
  top: GitHubContributorStat[];
}

export interface GitHubBranchMetrics {
  total: number;
  active: number;
}

export interface GitHubMetricSection {
  pull_requests: GitHubPullRequestMetrics;
  reviews: GitHubReviewMetrics;
  issues: GitHubIssueMetrics;
  commits: GitHubCommitMetrics;
  contributors: GitHubContributorMetrics;
  branches: GitHubBranchMetrics;
}

export interface GitHubComparisonItem {
  project_id: string;
  project_name: string;
  repositories: number;
  commits: number;
  open_prs: number;
  merged_prs: number;
  open_issues: number;
  closed_issues: number;
  avg_cycle_hours: number;
  avg_review_hours: number;
  avg_resolution_hours: number;
}

export interface GitHubSummary {
  projects: number;
  repositories: number;
  commits: number;
  open_prs: number;
  merged_prs: number;
  closed_prs: number;
  open_issues: number;
  closed_issues: number;
  avg_pr_cycle_hours: number;
  avg_review_hours: number;
  avg_resolution_hours: number;
  commit_frequency_weekly: number;
  active_contributors: number;
  total_branches: number;
  active_branches: number;
}

export interface GitHubDateRange {
  label: string;
  from: string;
  to: string;
}

export interface GitHubCentralAnalytics {
  projects: Array<{ id: string; name: string; key: string; repo_count: number }>;
  summary: GitHubSummary;
  repositories: {
    items: GitHubRepositoryRow[];
    total: number;
    page: number;
    page_size: number;
  };
  metrics: GitHubMetricSection;
  comparison: GitHubComparisonItem[];
  date_range: GitHubDateRange;
}

export interface GitHubRepositoryDetailResponse {
  repository: GitHubRepositoryRow;
  project: { id: string; name?: string; key?: string };
  metrics: GitHubMetricSection;
  summary: GitHubSummary;
  date_range: GitHubDateRange;
}

export interface GitHubPeriodFilter {
  label: string;
  value: string;
}
