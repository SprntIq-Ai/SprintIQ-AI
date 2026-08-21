import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { InitialsAvatar } from '../../components/common/InitialsAvatar';
import { taskService, managerService, sprintService } from '../../services/api';
import { Task } from '../../types';
import { Plus, ListTodo, Trash2, Sparkles, CheckCircle2, AlertTriangle, FolderKanban, CalendarClock } from 'lucide-react';

import { AITaskGeneratorModal } from '../../components/ai/AITaskGeneratorModal';

interface ManagerProject {
  id: string;
  name: string;
  key: string;
  description?: string;
  status: string;
  manager_id?: string;
  manager_name?: string;
}

interface ManagerDeveloper {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  status: string;
}

interface ManagerSprint {
  id: string;
  project_id: string;
  name: string;
  status: string;
  start_date?: string;
  end_date?: string;
}

type Toast = { type: 'success' | 'error'; msg: string } | null;

export const TaskManager: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ManagerProject[]>([]);
  const [sprints, setSprints] = useState<ManagerSprint[]>([]);
  const [developers, setDevelopers] = useState<ManagerDeveloper[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiTaskModalOpen, setIsAiTaskModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingSprints, setLoadingSprints] = useState(false);
  const [loadingDevelopers, setLoadingDevelopers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [projectId, setProjectId] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('8.0');
  const [storyPoints, setStoryPoints] = useState('3');
  const [dueDate, setDueDate] = useState('');
  const [assignedDevId, setAssignedDevId] = useState('');

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const pList = await managerService.getProjects();
      setProjects(pList);
      if (pList.length > 0 && !projectId) setProjectId(pList[0].id);
    } catch (e: any) {
      console.error(e);
      showToast('error', 'Failed to load projects: ' + (e.response?.data?.detail || e.message || 'Unknown error'));
    } finally {
      setLoadingProjects(false);
    }
  }, [projectId, showToast]);

  const loadSprints = useCallback(async (pid: string) => {
    setLoadingSprints(true);
    try {
      const sList = await sprintService.getAll(pid || undefined);
      setSprints(sList);
    } catch (e: any) {
      console.error(e);
      showToast('error', 'Failed to load sprints: ' + (e.response?.data?.detail || e.message || 'Unknown error'));
      setSprints([]);
    } finally {
      setLoadingSprints(false);
    }
  }, [showToast]);

  const loadDevelopers = useCallback(async () => {
    setLoadingDevelopers(true);
    try {
      const dList = await managerService.getDevelopers();
      setDevelopers(dList);
    } catch (e: any) {
      console.error(e);
      showToast('error', 'Failed to load developers: ' + (e.response?.data?.detail || e.message || 'Unknown error'));
    } finally {
      setLoadingDevelopers(false);
    }
  }, [showToast]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const tList = await taskService.getAll();
      setTasks(tList);
    } catch (e: any) {
      console.error(e);
      showToast('error', 'Failed to load tasks: ' + (e.response?.data?.detail || e.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProjects();
    loadSprints('');
    loadDevelopers();
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When project changes, clear the previously selected sprint and reload that project's sprints.
  const handleProjectChange = (value: string) => {
    setProjectId(value);
    setSprintId('');
    if (value) {
      loadSprints(value);
    } else {
      setSprints([]);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      showToast('error', 'Failed to create task: Project is required. Select a project first.');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await taskService.create({
        title,
        description,
        priority,
        project_id: projectId,
        sprint_id: sprintId || null,
        estimated_hours: parseFloat(estimatedHours) || 0,
        story_points: parseInt(storyPoints) || 1,
        due_date: dueDate || null,
        assigned_developer_id: assignedDevId || null,
        use_active_sprint: false,
      });
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setSprintId('');
      setAssignedDevId('');
      setDueDate('');
      setStoryPoints('3');
      setEstimatedHours('8.0');
      showToast('success', 'Task created and assigned successfully.');
      loadAll();
      if (projectId) loadSprints(projectId);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      const msg = detail || e.message || 'Unknown error';
      console.error(e);
      showToast('error', `Failed to create task: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Delete task permanently?')) return;
    try {
      await taskService.delete(id);
      showToast('success', 'Task deleted successfully.');
      loadAll();
    } catch (e: any) {
      showToast('error', 'Failed to delete task: ' + (e.response?.data?.detail || e.message || 'Unknown error'));
    }
  };

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: p.name,
    sublabel: p.key,
    meta: p.manager_name && p.manager_name !== 'Unassigned' ? p.manager_name : undefined,
    icon: <FolderKanban className="w-4 h-4" />,
  }));

  const sprintOptions = sprints.map((s) => ({
    value: s.id,
    label: s.name,
    meta: s.status,
    icon: <CalendarClock className="w-4 h-4" />,
  }));

  const developerOptions = developers.map((d) => ({
    value: d.id,
    label: d.full_name,
    sublabel: d.email,
    meta: 'DEVELOPER',
    icon: <InitialsAvatar name={d.full_name} role="developer" size={20} />,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Task Governance & Allocation <Badge variant="manager">Full Backlog</Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Create user stories, auto-generate tasks with Gemini AI, assign story points, and track developer progress</p>
        </div>
        <div className="flex gap-3">
          <Button variant="ai" icon={<Sparkles className="w-4 h-4" />} onClick={() => setIsAiTaskModalOpen(true)}>
            AI Task Generator
          </Button>
          <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
            Manual Task
          </Button>
        </div>
      </div>

      <AITaskGeneratorModal
        isOpen={isAiTaskModalOpen}
        onClose={() => setIsAiTaskModalOpen(false)}
        projectId={projectId}
        onTaskCreated={loadAll}
      />

      {isLoading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <ListTodo className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No tasks created yet. Use "Manual Task" or "AI Task Generator" to create your first sprint task.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((t) => (
            <GlassCard key={t.id} hoverEffect className="flex flex-col justify-between border-l-4 border-l-emerald-500">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant={t.priority.toLowerCase() as any}>{t.priority}</Badge>
                  <Badge variant={t.status === 'COMPLETED' ? 'healthy' : 'in_progress'}>{t.status}</Badge>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-2">{t.title}</h3>
                <p className="text-slate-500 text-xs line-clamp-2 mb-4">{t.description || 'No description provided.'}</p>

                <div className="space-y-2 text-xs border-t border-slate-200 pt-3">
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-500">Assigned Dev:</span>
                    <span className="font-semibold text-emerald-400">{t.assigned_developer_name || 'Unassigned'}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-500">Project / Sprint:</span>
                    <span className="font-semibold text-slate-700">{t.project_name || '—'} / {t.sprint_name || 'Backlog'}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-500">Story Points / Est. Hours:</span>
                    <span className="font-mono text-slate-600">{t.story_points} SP ({t.estimated_hours}h)</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-500">Progress:</span>
                    <span className="font-bold text-slate-900">{t.progress}%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-4">
                <button
                  onClick={() => handleDeleteTask(t.id)}
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="Delete Task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Sprint Task" maxWidth="max-w-2xl">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Task Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement OAuth2 Refresh Token Interceptor"
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableSelect
              label="Project"
              value={projectId}
              onChange={handleProjectChange}
              options={projectOptions}
              icon={<FolderKanban className="w-4 h-4" />}
              placeholder={loadingProjects ? 'Loading projects...' : 'Select project...'}
              loading={loadingProjects}
              loadingText="Loading projects..."
              emptyText={loadingProjects ? '' : 'No projects available.'}
              searchPlaceholder="Search projects..."
              disabled={loadingProjects}
            />

            <SearchableSelect
              label="Assign Sprint"
              value={sprintId}
              onChange={setSprintId}
              options={sprintOptions}
              placeholder={loadingSprints ? 'Loading sprints...' : 'Assign Sprint'}
              clearLabel="No Sprint (Backlog)"
              loading={loadingSprints}
              loadingText="Loading sprints..."
              emptyText={loadingSprints ? '' : 'No sprints available for this project.'}
              searchPlaceholder="Search sprints..."
              disabled={!projectId}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Story Points</label>
              <input
                type="number"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Estimated Hours</label>
              <input
                type="number"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableSelect
              label="Assign Developer"
              value={assignedDevId}
              onChange={setAssignedDevId}
              options={developerOptions}
              placeholder={loadingDevelopers ? 'Loading developers...' : 'Unassigned'}
              clearLabel="Unassigned"
              loading={loadingDevelopers}
              loadingText="Loading developers..."
              emptyText={loadingDevelopers ? '' : 'No developers available.'}
              searchPlaceholder="Search developers..."
              disabled={loadingDevelopers}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Task Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail technical requirements..."
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="manager" isLoading={isSubmitting}>Create & Assign Task</Button>
          </div>
        </form>
      </Modal>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] max-w-md px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium flex items-start gap-2.5 ${toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/90 border-rose-500/40 text-rose-300'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span className="break-words">{toast.msg}</span>
        </div>
      )}
    </div>
  );
};