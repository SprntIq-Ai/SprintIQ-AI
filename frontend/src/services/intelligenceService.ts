import axios from 'axios';

const API_BASE = '/api';

export const getAuthHeaders = () => {
  const token = localStorage.getItem('sprintiq_access_token') || localStorage.getItem('sprintiq_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const intelligenceService = {
  getHealthScore: async (projectId: string) => {
    const response = await axios.get(`${API_BASE}/health/${projectId}`, { headers: getAuthHeaders() });
    return response.data;
  },

  getMLProjectDelay: async (projectId: string) => {
    const response = await axios.get(`${API_BASE}/ml/delay/${projectId}`, { headers: getAuthHeaders() });
    return response.data;
  },

  getDeveloperRecommendations: async (projectId: string, taskTitle: string, hours: number = 4) => {
    const response = await axios.post(`${API_BASE}/ai/recommend-developer`, {
      project_id: projectId,
      task_title: taskTitle,
      estimated_hours: hours
    }, { headers: getAuthHeaders() });
    return response.data;
  },

  getSprintCapacity: async (projectId: string, points: number = 40) => {
    const response = await axios.post(`${API_BASE}/sprint-capacity`, {
      project_id: projectId,
      proposed_story_points: points
    }, { headers: getAuthHeaders() });
    return response.data;
  },

  getBottlenecks: async (projectId: string) => {
    const response = await axios.get(`${API_BASE}/bottlenecks/${projectId}`, { headers: getAuthHeaders() });
    return response.data;
  },

  getWorkloadIntelligence: async (projectId: string) => {
    const response = await axios.get(`${API_BASE}/workload/${projectId}`, { headers: getAuthHeaders() });
    return response.data;
  },

  getGitHubAnalytics: async (projectId: string) => {
    const response = await axios.get(`${API_BASE}/github/${projectId}`, { headers: getAuthHeaders() });
    return response.data;
  },

  getReleaseReadiness: async (projectId: string) => {
    const response = await axios.get(`${API_BASE}/release-readiness/${projectId}`, { headers: getAuthHeaders() });
    return response.data;
  },

  getSimulationData: async (projectIdentifier: string) => {
    const response = await axios.get(`${API_BASE}/projects/${projectIdentifier}/simulation-data`, { headers: getAuthHeaders() });
    return response.data;
  },

  runProjectSimulation: async (projectIdentifier: string, scenarioType: string, parameters: Record<string, any>) => {
    const response = await axios.post(`${API_BASE}/projects/${projectIdentifier}/simulate`, {
      project_id: projectIdentifier,
      scenario_type: scenarioType,
      parameters
    }, { headers: getAuthHeaders() });
    return response.data;
  },

  runWhatIfSimulation: async (projectId: string, scenarioType: string, parameters: Record<string, any>) => {
    const response = await axios.post(`${API_BASE}/simulations`, {
      project_id: projectId,
      scenario_type: scenarioType,
      parameters
    }, { headers: getAuthHeaders() });
    return response.data;
  },

  queryAICopilot: async (question: string, projectId?: string, mode: string = 'FULL_WORKSPACE') => {
    const response = await axios.post(`${API_BASE}/ai/copilot`, {
      question,
      project_id: projectId,
      mode
    }, { headers: getAuthHeaders() });
    return response.data;
  },

  generateRetrospective: async (projectId: string, sprintId: string) => {
    const response = await axios.post(`${API_BASE}/ai/retrospective`, {
      project_id: projectId,
      sprint_id: sprintId
    }, { headers: getAuthHeaders() });
    return response.data;
  }
};
