import axios from 'axios';
import { API_BASE_URL } from '../config/constants';
import { User, Project, Task, Sprint, NotificationItem, AIAnalysis, ProjectInvitation, Comment, Comment as TaskComment, GitHubProjectInfo, GitHubCentralAnalytics, GitHubRepositoryRow, GitHubRepositoryDetailResponse, GitHubRepoInfo, GitHubLiveStatus, GitHubLiveBranch, GitHubLivePullRequest, GitHubLiveIssue, GitHubLiveActivity, GitHubLiveCommitsPage, DeveloperProject, DeveloperProjectDetail } from '../types';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor to add Bearer JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sprintiq_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor for refresh tokens or error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('sprintiq_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
          const newAccessToken = res.data.access_token;
          localStorage.setItem('sprintiq_access_token', newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshErr) {
          localStorage.removeItem('sprintiq_access_token');
          localStorage.removeItem('sprintiq_refresh_token');
          localStorage.removeItem('sprintiq_user');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// API Helper Modules
export const authService = {
  login: async (data: any) => (await api.post('/auth/login', data)).data,
  acceptInvite: async (data: any) => (await api.post('/auth/accept-invite', data)).data,
  getMe: async () => (await api.get<User>('/auth/me')).data,
};

export const adminService = {
  getDashboard: async () => (await api.get('/admin/dashboard')).data,
  getProjects: async () => (await api.get<Project[]>('/admin/projects')).data,
  createProject: async (data: any) => (await api.post<Project>('/admin/projects', data)).data,
  updateProject: async (id: string, data: any) => (await api.put<Project>(`/admin/projects/${id}`, data)).data,
  deleteProject: async (id: string) => (await api.delete(`/admin/projects/${id}`)).data,
  inviteManager: async (data: any) => (await api.post<ProjectInvitation>('/admin/invite-manager', data)).data,
  getUsers: async (role?: string) => (await api.get<User[]>(`/admin/users${role ? `?role=${role}` : ''}`)).data,
  toggleUserStatus: async (id: string, status: string) => (await api.put(`/admin/users/${id}/status?status_val=${status}`)).data,
  getActivityLogs: async () => (await api.get('/admin/activity-logs')).data,
};

export const managerService = {
  getDashboard: async (projectId?: string) => (await api.get(`/manager/dashboard${projectId ? `?project_id=${projectId}` : ''}`)).data,
  getProjects: async () => (await api.get('/manager/projects')).data,
  getDevelopers: async () => (await api.get('/manager/developers')).data,
  getProjectTeam: async (projectId: string) => (await api.get(`/manager/projects/${projectId}/team`)).data,
  getAvailableDevelopers: async (projectId: string) => (await api.get(`/manager/projects/${projectId}/available-developers`)).data,
  assignDevelopers: async (projectId: string, developerIds: string[], team?: string) =>
    (await api.post(`/manager/projects/${projectId}/developers/assign`, { developer_ids: developerIds, team })).data,
  inviteDeveloper: async (data: any) => (await api.post<any>('/manager/invite-developer', data)).data,
  getReviews: async () => (await api.get('/manager/reviews')).data,
  decideReview: async (taskId: string, action: string, feedback?: string) => (await api.post(`/manager/reviews/${taskId}/decide`, { action, feedback })).data,
};

export const developerService = {
  getDashboard: async () => (await api.get('/developer/dashboard')).data,
  getTasks: async () => (await api.get<Task[]>('/developer/tasks')).data,
  getCompletedTasks: async () => (await api.get<Task[]>('/developer/tasks/completed')).data,
  updateProgress: async (taskId: string, progress: number, status: string, notes?: string) =>
    (await api.put(`/developer/tasks/${taskId}/progress`, { progress, status, notes })).data,
  submitTask: async (taskId: string) => (await api.post(`/developer/tasks/${taskId}/submit`)).data,
  getComments: async (taskId: string) => (await api.get<TaskComment[]>(`/developer/tasks/${taskId}/comments`)).data,
  addComment: async (taskId: string, content: string) => (await api.post(`/developer/tasks/${taskId}/comments`, { content })).data,
  aiChat: async (prompt: string) => (await api.post('/developer/ai-chat', { prompt })).data,
  getProjects: async () => (await api.get<DeveloperProject[]>('/developer/projects')).data,
  getProject: async (projectId: string) => (await api.get<DeveloperProjectDetail>(`/developer/projects/${projectId}`)).data,
};

export const projectService = {
  getAll: async () => (await api.get<Project[]>('/projects')).data,
  getById: async (id: string) => (await api.get<Project>(`/projects/${id}`)).data,
};

export const taskService = {
  getAll: async (params?: any) => (await api.get<Task[]>('/tasks', { params })).data,
  create: async (data: any) => (await api.post<Task>('/tasks', data)).data,
  update: async (id: string, data: any) => (await api.put<Task>(`/tasks/${id}`, data)).data,
  delete: async (id: string) => (await api.delete(`/tasks/${id}`)).data,
};

export const sprintService = {
  getAll: async (projectId?: string) => (await api.get<Sprint[]>(`/sprints${projectId ? `?project_id=${projectId}` : ''}`)).data,
  create: async (data: any) => (await api.post<Sprint>('/sprints', data)).data,
  update: async (id: string, data: any) => (await api.put<Sprint>(`/sprints/${id}`, data)).data,
};

export const aiService = {
  getSummary: async (type: string = 'daily', projectId?: string) =>
    (await api.get(`/ai/summary?type=${type}${projectId ? `&project_id=${projectId}` : ''}`)).data,
  chat: async (prompt: string, projectId?: string) => (await api.post('/ai/chat', { prompt, project_id: projectId })).data,
  getRiskPrediction: async (projectId?: string) =>
    (await api.get(`/ai/risk-prediction${projectId ? `?project_id=${projectId}` : ''}`)).data,
  getHealthScore: async (projectId?: string) =>
    (await api.get(`/ai/health-score${projectId ? `?project_id=${projectId}` : ''}`)).data,
  planSprint: async (data: { project_id: string; target_focus?: string }) =>
    (await api.post('/ai/sprint-planner', data)).data,
  generateTask: async (title: string, projectId?: string) =>
    (await api.post('/ai/task-generator', { title, project_id: projectId })).data,
  getDailyStandup: async (projectId?: string) =>
    (await api.get(`/ai/daily-standup${projectId ? `?project_id=${projectId}` : ''}`)).data,
  getWeeklyReport: async (projectId?: string) =>
    (await api.get(`/ai/weekly-report${projectId ? `?project_id=${projectId}` : ''}`)).data,
  createMeetingMinutes: async (data: { title: string; raw_notes: string; project_id?: string }) =>
    (await api.post('/ai/meeting-minutes', data)).data,
};

export const analyticsService = {
  getWorkloadHeatmap: async (projectId?: string) =>
    (await api.get(`/analytics/workload-heatmap${projectId ? `?project_id=${projectId}` : ''}`)).data,
  getTeamVelocity: async (projectId?: string) =>
    (await api.get(`/analytics/team-velocity${projectId ? `?project_id=${projectId}` : ''}`)).data,
  getLeaderboard: async () => (await api.get('/analytics/leaderboard')).data,
};

export const developerFeatureService = {
  createFocusSession: async (data: { duration_minutes: number; task_id?: string; notes?: string }) =>
    (await api.post('/developer-features/focus-sessions', data)).data,
  getFocusSessions: async () => (await api.get('/developer-features/focus-sessions')).data,
  getBadges: async () => (await api.get('/developer-features/badges')).data,
};

export const searchService = {
  globalSearch: async (q: string) => (await api.get(`/search/global?q=${encodeURIComponent(q)}`)).data,
};

export const reportService = {
  list: async () => (await api.get('/reports')).data,
  download: async (data: { title: string; report_type: string; format: string }) => {
    const response = await api.post('/reports/generate', data, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const ext = data.format.toLowerCase() === 'excel' ? 'xlsx' : data.format.toLowerCase();
    link.setAttribute('download', `${data.title.replace(/\s+/g, '_')}.${ext}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};

export const notificationService = {
  getAll: async () => (await api.get<NotificationItem[]>('/notifications')).data,
  markAsRead: async (id: string) => (await api.put(`/notifications/${id}/read`)).data,
  markAllRead: async () => (await api.put('/notifications/read-all')).data,
};

export const publicService = {
  getSettings: async () => (await api.get('/auth/public-settings')).data,
};

export const adminSettingsService = {
  getSettings: async () => (await api.get('/settings')).data,
  updateSettings: async (settings: Record<string, string | boolean | number>) =>
    (await api.put('/settings', { settings })).data,
  testDatabase: async () => (await api.post('/settings/test-database')).data,
  testGemini: async () => (await api.post('/settings/test-gemini')).data,
  testGithub: async () => (await api.post('/settings/test-github')).data,
  getHealth: async () => (await api.post('/settings/health')).data,
};

export const userManagementService = {
  // Manager accounts (Admin only)
  createManager: async (data: { full_name: string; email: string; password: string; confirm_password: string }) =>
    (await api.post('/users/managers', data)).data,
  getManagers: async (params?: { search?: string; status?: string }) =>
    (await api.get('/users/managers', { params })).data,
  updateManager: async (id: string, data: { full_name?: string; email?: string; phone?: string; bio?: string }) =>
    (await api.put(`/users/managers/${id}`, data)).data,
  toggleManagerStatus: async (id: string, status: string) =>
    (await api.patch(`/users/managers/${id}/status?status_val=${status}`)).data,
  resetManagerPassword: async (id: string, data: { new_password: string; confirm_password: string }) =>
    (await api.post(`/users/managers/${id}/reset-password`, data)).data,

  // Developer accounts (Manager only)
  createDeveloper: async (data: { full_name: string; email: string; password: string; confirm_password: string }) =>
    (await api.post('/users/developers', data)).data,
  getDevelopers: async (params?: { search?: string; status?: string }) =>
    (await api.get('/users/developers', { params })).data,
  updateDeveloper: async (id: string, data: { full_name?: string; email?: string; phone?: string; bio?: string }) =>
    (await api.put(`/users/developers/${id}`, data)).data,
  toggleDeveloperStatus: async (id: string, status: string) =>
    (await api.patch(`/users/developers/${id}/status?status_val=${status}`)).data,
  resetDeveloperPassword: async (id: string, data: { new_password: string; confirm_password: string }) =>
    (await api.post(`/users/developers/${id}/reset-password`, data)).data,
};

export const githubService = {
  getProjects: async () => (await api.get<GitHubProjectInfo[]>('/github/projects')).data,
  getAnalytics: async (params: {
    project_ids?: string;
    repo_ids?: string;
    period?: string;
    from_date?: string;
    to_date?: string;
    page?: number;
    page_size?: number;
  }) => (await api.get<GitHubCentralAnalytics>('/github/analytics', { params })).data,
  getRepositories: async (params: {
    project_ids?: string;
    sync_status?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) => (await api.get<{ items: GitHubRepositoryRow[]; total: number; page: number; page_size: number }>('/github/repositories', { params })).data,
  getRepositoryDetail: async (repoId: string, params: { period?: string; from_date?: string; to_date?: string }) =>
    (await api.get<GitHubRepositoryDetailResponse>(`/github/repositories/${repoId}`, { params })).data,
  createRepository: async (data: { project_id: string; repo_name: string; repo_owner?: string }) =>
    (await api.post<{ status: string; message: string; repository?: GitHubRepoInfo }>('/github/repositories', data)).data,
  checkRepository: async (data: { project_id: string; repository_url: string }) =>
    (await api.post<{
      status: string; exists: boolean; owner: string; repo_name: string;
      repository?: Record<string, any>; message: string;
    }>('/github/repositories/check', data)).data,
  connectRepository: async (data: { project_id: string; repository_url: string }) =>
    (await api.post<{ status: string; message: string; repository?: Record<string, any> }>('/github/repositories/connect', data)).data,
  initializeRepository: async (data: {
    project_id: string; repository_url: string;
    repository_name?: string; visibility?: string; default_branch?: string;
    description?: string; create_initial_files?: boolean;
  }) =>
    (await api.post<{ status: string; message: string; repository?: GitHubRepoInfo }>('/github/repositories/initialize', data)).data,
  updateRepository: async (repoId: string, data: { project_id: string; repo_name: string; repo_owner?: string }) =>
    (await api.put(`/github/repositories/${repoId}`, data)).data,
  deleteRepository: async (repoId: string) => (await api.delete(`/github/repositories/${repoId}`)).data,
  syncRepository: async (repoId: string) =>
    (await api.post<{ status: string; message?: string }>(`/github/repositories/${repoId}/sync`)).data,
  getProjectAnalytics: async (projectId: string) => (await api.get(`/github/${projectId}`)).data,
  getLiveActivity: async (projectId: string, params?: { branch?: string; repo_id?: string; force?: boolean }) =>
    (await api.get<GitHubLiveActivity>(`/github/activity/${projectId}`, { params })).data,
  getLiveCommits: async (projectId: string, params?: { branch?: string; page?: number; per_page?: number; repo_id?: string; force?: boolean }) =>
    (await api.get<GitHubLiveCommitsPage>(`/github/commits/${projectId}`, { params })).data,
  getLiveBranches: async (projectId: string, params?: { repo_id?: string }) =>
    (await api.get<{ status: GitHubLiveStatus; message?: string; default_branch?: string; branches: GitHubLiveBranch[]; fetched_at?: string }>(`/github/branches/${projectId}`, { params })).data,
  getLiveRepository: async (projectId: string, params?: { repo_id?: string }) =>
    (await api.get<GitHubLiveActivity>(`/github/repository/${projectId}`, { params })).data,
  getLivePullRequests: async (projectId: string, params?: { state?: string; per_page?: number; repo_id?: string }) =>
    (await api.get<{ status: GitHubLiveStatus; message?: string; pull_requests: GitHubLivePullRequest[]; count: number; fetched_at?: string }>(`/github/pull-requests/${projectId}`, { params })).data,
  getLiveIssues: async (projectId: string, params?: { state?: string; per_page?: number; repo_id?: string }) =>
    (await api.get<{ status: GitHubLiveStatus; message?: string; issues: GitHubLiveIssue[]; count: number; fetched_at?: string }>(`/github/issues/${projectId}`, { params })).data,
};

