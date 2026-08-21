import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { adminService } from '../../services/api';
import { Project, User } from '../../types';
import { Plus, Trash2, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

export const ProjectsManager: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Feedback banner state
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Create Project Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');

  // Delete Project Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg('');
    setTimeout(() => setErrorMsg(''), 7000);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [projList, userList] = await Promise.all([
        adminService.getProjects(),
        adminService.getUsers('manager'),
      ]);
      setProjects(projList);
      setManagers(userList);
    } catch (e: any) {
      showError(e?.response?.data?.detail || 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminService.createProject({
        name,
        key: key.toUpperCase(),
        description,
        manager_id: managerId || null,
      });
      setIsCreateOpen(false);
      setName('');
      setKey('');
      setDescription('');
      setManagerId('');
      if (managerId) {
        showSuccess('Project assigned to manager successfully.');
      } else {
        showSuccess('Project created successfully.');
      }
      loadData();
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'Failed to create project');
    }
  };

  const openDeleteModal = (p: Project) => {
    setProjectToDelete(p);
    setIsDeleteOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await adminService.deleteProject(projectToDelete.id);
      setIsDeleteOpen(false);
      setProjectToDelete(null);
      showSuccess('Project deleted successfully.');
      loadData();
    } catch (e: any) {
      showError(e?.response?.data?.detail || 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  const progressOf = (p: Project): number => {
    if (!p.total_tasks) return 0;
    return Math.round(((p.completed_tasks || 0) / p.total_tasks) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Projects</h1>
          <p className="text-xs text-slate-500 mt-1">Create projects, assign project managers, and monitor progress</p>
        </div>
        <Button variant="admin" icon={<Plus className="w-4 h-4" />} onClick={() => setIsCreateOpen(true)}>
          Create New Project
        </Button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4" /> {errorMsg}
        </div>
      )}

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50/60">
                <th className="px-4 py-3 font-semibold">Project Name</th>
                <th className="px-4 py-3 font-semibold">Project ID</th>
                <th className="px-4 py-3 font-semibold">Manager</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Progress</th>
                <th className="px-4 py-3 font-semibold">Developers</th>
                <th className="px-4 py-3 font-semibold">Created Date</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">Loading projects...</td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">No projects created yet.</td>
                </tr>
              ) : (
                projects.map((p) => {
                  const progress = progressOf(p);
                  return (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.key}</div>
                        {p.description && (
                          <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 max-w-[240px]">{p.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{p.id}</td>
                      <td className="px-4 py-3 text-slate-700">{p.manager_name || 'Unassigned'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status.toLowerCase() as any}>{p.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${progress}%`, backgroundColor: 'var(--role-primary)' }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-600 w-8 text-right">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.developers_count ?? 0}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openDeleteModal(p)}
                          className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Create Project Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Enterprise Project">
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Project Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI Comic Strip"
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Project Key (Unique prefix)</label>
            <input
              type="text"
              required
              maxLength={10}
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="e.g. ACS"
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-mono uppercase focus:outline-none focus:border-[var(--role-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Assign Project Manager</label>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
            >
              <option value="">Unassigned</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Project Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline project goal and scope..."
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="admin">Create Project</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Project Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={() => !isDeleting && setIsDeleteOpen(false)} title="Delete Project?" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{' '}
                <span className="font-bold text-slate-900">{projectToDelete?.name}</span>?
              </p>
              <p className="text-xs text-slate-500 mt-1">
                This action will remove the project and its project-related records. User accounts and the connected
                GitHub repository will remain intact.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteProject}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};