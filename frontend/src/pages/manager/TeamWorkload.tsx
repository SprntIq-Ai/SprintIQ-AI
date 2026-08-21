import React, { useEffect, useState, useMemo } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { managerService, projectService, analyticsService } from '../../services/api';
import { Project, WorkloadHeatmapItem, Task } from '../../types';
import { UserPlus, Flame, Search, CheckCircle2, ChevronDown, Calendar } from 'lucide-react';
import { InitialsAvatar } from '../../components/common/InitialsAvatar';

export const TeamWorkload: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [heatmap, setHeatmap] = useState<WorkloadHeatmapItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterWorkload, setFilterWorkload] = useState('All');
  const [filterProject, setFilterProject] = useState('All');
  const [sortBy, setSortBy] = useState('Workload'); // Workload | Developer Name | Task Count | Estimated Hours | Capacity %

  // Explore Modals
  const [activeDev, setActiveDev] = useState<WorkloadHeatmapItem | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [projectId, setProjectId] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pList, hm] = await Promise.all([
        projectService.getAll(),
        analyticsService.getWorkloadHeatmap()
      ]);
      setProjects(pList);
      setHeatmap(hm);
      if (pList.length > 0 && !projectId) setProjectId(pList[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInviteDeveloper = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await managerService.inviteDeveloper({
        email,
        full_name: fullName,
        project_id: projectId,
        team: 'Development',
      });
      if (res.status === 'ADDED_EXISTING') {
        alert(res.message);
      } else {
        alert(`Developer Invitation sent to ${email}!\nInvite Token: ${res.token}`);
      }
      setIsModalOpen(false);
      setEmail('');
      setFullName('');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to invite developer");
    }
  };

  const filteredHeatmap = useMemo(() => {
    return heatmap
      .filter((h) => {
        // Search
        if (search) {
          const s = search.toLowerCase();
          if (
            !h.developer_name.toLowerCase().includes(s) &&
            !(h.developer_email && h.developer_email.toLowerCase().includes(s)) &&
            !h.assigned_projects.some((p) => p.name.toLowerCase().includes(s))
          ) {
            return false;
          }
        }
        // Workload Filter
        if (filterWorkload !== 'All') {
          if (filterWorkload === 'Over Capacity') {
            if (h.workload_status !== 'OVER_CAPACITY') return false;
          } else if (h.workload_status.toUpperCase() !== filterWorkload.toUpperCase()) {
            return false;
          }
        }
        // Project Filter
        if (filterProject !== 'All') {
          if (!h.assigned_projects.some((p) => p.id === filterProject)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'Workload') {
          const wMap: Record<string, number> = { OVER_CAPACITY: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return wMap[b.workload_status] - wMap[a.workload_status];
        }
        if (sortBy === 'Developer Name') return a.developer_name.localeCompare(b.developer_name);
        if (sortBy === 'Task Count') return b.assigned_tasks - a.assigned_tasks;
        if (sortBy === 'Estimated Hours') return b.estimated_hours - a.estimated_hours;
        if (sortBy === 'Capacity %') return b.capacity_percentage - a.capacity_percentage;
        return 0;
      });
  }, [heatmap, search, filterWorkload, filterProject, sortBy]);

  const getHeatmapColor = (status: string) => {
    switch (status) {
      case 'LOW': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]';
      case 'MEDIUM': return 'bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px]';
      case 'HIGH': return 'bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold text-[10px]';
      case 'OVER_CAPACITY': return 'bg-rose-600/30 text-rose-500 border-rose-600 font-bold animate-pulse text-[10px]';
      default: return 'bg-slate-100 text-slate-600 text-[10px]';
    }
  };

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'LOW': return '#10B981'; // emerald-500
      case 'MEDIUM': return '#F59E0B'; // amber-500
      case 'HIGH':
      case 'OVER_CAPACITY': return '#F43F5E'; // rose-500
      default: return '#94A3B8'; // slate-400
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <Badge variant="healthy">COMPLETED</Badge>;
      case 'REJECTED': return <Badge variant="critical">CHANGES_REQUESTED</Badge>;
      case 'REVIEW_PENDING': return <Badge variant="pending">SUBMITTED</Badge>;
      case 'TESTING': return <Badge variant="in_progress">TESTING</Badge>;
      case 'IN_PROGRESS': return <Badge variant="in_progress">IN PROGRESS</Badge>;
      default: return <Badge variant="default">TODO</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Developer Workload Heatmap & Team
          </h1>
          <p className="text-xs text-slate-500 mt-1">Real-time team capacity planning powered by database verifications.</p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="relative w-full md:w-1/3">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search developers..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-[var(--role-primary)]"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-[var(--role-primary)] font-medium text-slate-700"
            value={filterWorkload}
            onChange={e => setFilterWorkload(e.target.value)}
          >
            <option value="All">Workload ▼</option>
            <option value="LOW">Low Workload</option>
            <option value="MEDIUM">Medium Workload</option>
            <option value="HIGH">High Workload</option>
            <option value="Over Capacity">Over Capacity</option>
          </select>
          <select
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-[var(--role-primary)] font-medium text-slate-700"
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
          >
            <option value="All">All Projects ▼</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-[var(--role-primary)] font-medium text-slate-700"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="Workload">Sort: Highest Workload First</option>
            <option value="Developer Name">Developer Name</option>
            <option value="Task Count">Task Count</option>
            <option value="Estimated Hours">Estimated Hours</option>
            <option value="Capacity %">Capacity %</option>
          </select>
        </div>
      </div>

      {/* HEATMAP GRID */}
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Developer Capacity & Workload Heatmap Grid
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold tracking-tight">LOW &lt;15h</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold tracking-tight">MEDIUM 15–30h</span>
            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold tracking-tight">HIGH &gt;30h</span>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-slate-400 py-10 font-bold">Loading Workloads...</div>
        ) : heatmap.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">No developers assigned</h3>
            <p className="text-sm text-slate-500 mb-4">Invite a developer to start tracking team capacity.</p>
            <Button variant="manager" icon={<UserPlus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
              Invite Developer
            </Button>
          </div>
        ) : filteredHeatmap.length === 0 ? (
          <div className="text-center text-slate-400 py-10 font-bold text-sm">No developers match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredHeatmap.map((h) => {
              const bgVariant = h.workload_status === 'OVER_CAPACITY' ? 'bg-rose-50/50 border-rose-200' : 'bg-white hover:bg-slate-50 border-slate-200';
              return (
                <div
                  key={h.developer_id}
                  className={`p-4 rounded-xl border flex flex-col space-y-3 cursor-pointer transition-shadow shadow-sm hover:shadow-md ${bgVariant}`}
                  onClick={() => setActiveDev(h)}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <InitialsAvatar name={h.developer_name} role="developer" size={40} className="ring-2 ring-slate-100" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{h.developer_name}</p>
                      <p className="text-[11px] text-slate-600 font-medium">{h.assigned_tasks} Tasks</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-end text-xs font-bold text-slate-800">
                      <span>{h.estimated_hours}h / 40h</span>
                      <span className={h.capacity_percentage > 100 ? 'text-rose-600' : ''}>{h.capacity_percentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgb(241 245 249)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(h.capacity_percentage, 100)}%`, backgroundColor: getProgressBarColor(h.workload_status) }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <span className={`px-2 py-0.5 rounded uppercase font-mono tracking-widest ${getHeatmapColor(h.workload_status)}`}>
                      {h.workload_status === 'OVER_CAPACITY' ? 'OVER CAPACITY' : h.workload_status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {heatmap.length > 0 && (
          <div className="pt-4 mt-6 border-t border-slate-100">
            <Button variant="outline" icon={<UserPlus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
              Invite Developer
            </Button>
          </div>
        )}
      </GlassCard>

      {/* Developer Details Modal */}
      <Modal
        isOpen={!!activeDev}
        onClose={() => setActiveDev(null)}
        title={`${activeDev?.developer_name} Details`}
        maxWidth="max-w-4xl"
      >
        {activeDev && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div>
                  <p className="text-xl font-bold text-slate-900">{activeDev.developer_name}</p>
                  <p className="text-xs text-slate-600 font-medium">{activeDev.developer_email || "N/A"}</p>
                </div>
                <div className="pt-2 border-t border-slate-200 text-xs text-slate-700">
                  <p className="font-bold mb-1">Current Project(s):</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {activeDev.assigned_projects.length > 0
                      ? activeDev.assigned_projects.map(p => <li key={p.id}>{p.name}</li>)
                      : <li>No projects</li>}
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
                <div>
                  <p className="text-slate-500 font-semibold mb-1">Total Tasks</p>
                  <p className="text-lg font-bold text-slate-900">{activeDev.assigned_tasks}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-semibold mb-1">Completed</p>
                  <p className="text-lg font-bold text-emerald-600 cursor-help" title="Manager Verified">{activeDev.completed_tasks}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between w-full max-w-[120px]">
                    <span className="text-slate-500">In Progress:</span>
                    <span className="font-bold">{activeDev.in_progress_tasks}</span>
                  </div>
                  <div className="flex justify-between w-full max-w-[120px]">
                    <span className="text-slate-500">Submitted:</span>
                    <span className="font-bold text-amber-600">{activeDev.submitted_tasks}</span>
                  </div>
                  <div className="flex justify-between w-full max-w-[120px]">
                    <span className="text-slate-500">Rejected:</span>
                    <span className="font-bold text-rose-600">{activeDev.rejected_tasks}</span>
                  </div>
                </div>

                <div className="space-y-1 pl-2 border-l border-slate-200">
                  <div className="flex justify-between w-full max-w-[120px]">
                    <span className="text-slate-500">Estimated:</span>
                    <span className="font-bold">{activeDev.estimated_hours}h</span>
                  </div>
                  <div className="flex justify-between w-full max-w-[120px]">
                    <span className="text-slate-500">Completed:</span>
                    <span className="font-bold text-emerald-600">{activeDev.completed_hours}h</span>
                  </div>
                  <div className="flex justify-between w-full max-w-[120px]">
                    <span className="text-slate-500">Remaining:</span>
                    <span className="font-bold text-amber-600">{activeDev.remaining_hours}h</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Expected Capacity</span>
                <span className="text-2xl font-black text-slate-900">{activeDev.estimated_hours} / 40 <span className="text-sm font-semibold text-slate-500">hours</span></span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Workload Level</span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black" style={{ color: getProgressBarColor(activeDev.workload_status) }}>{activeDev.capacity_percentage}%</span>
                  <span className={`px-3 py-1 rounded-md font-bold uppercase ${getHeatmapColor(activeDev.workload_status)}`}>
                    {activeDev.workload_status === 'OVER_CAPACITY' ? 'OVER CAPACITY' : activeDev.workload_status}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-3 text-sm">Assigned Tasks</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-1/3">Task Title</th>
                      <th className="px-4 py-3 font-semibold">Priority</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-center">Hours</th>
                      <th className="px-4 py-3 font-semibold">Project & Sprint</th>
                      <th className="px-4 py-3 font-semibold">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeDev.tasks_list.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-slate-400">No active tasks</td>
                      </tr>
                    ) : (
                      activeDev.tasks_list.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            <div className="max-w-[200px] truncate" title={t.title}>{t.title}</div>
                          </td>
                          <td className="px-4 py-3"><Badge variant={t.priority.toLowerCase() as any}>{t.priority}</Badge></td>
                          <td className="px-4 py-3">{renderStatusBadge(t.status)}</td>
                          <td className="px-4 py-3 text-center font-mono font-medium text-slate-700">{t.estimated_hours}h</td>
                          <td className="px-4 py-3 text-[11px]">
                            <div className="text-slate-800 font-bold">{t.project_name}</div>
                            <div className="text-slate-500">{t.sprint_name}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {t.due_date || 'N/A'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Invite Developer Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Invite Developer to Project">
        <form onSubmit={handleInviteDeveloper} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Developer Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Michael Chen"
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Developer Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. dev@sprintiq.ai"
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Assign to Project</label>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-3 top-3 text-slate-400" />
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs appearance-none focus:border-[var(--role-primary)]"
              >
                <option value="" disabled>Select a project instance...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 font-mono">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="manager">Send Invitation Token</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
