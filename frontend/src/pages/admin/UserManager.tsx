import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { adminService } from '../../services/api';
import { User, Project } from '../../types';
import { UserPlus, Mail, Phone, ShieldCheck, Power, Search, Check, ChevronDown } from 'lucide-react';
import { InitialsAvatar } from '../../components/common/InitialsAvatar';

export const UserManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRoleFilter, setActiveRoleFilter] = useState<string>('all');

  // Modal State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [managers, setManagers] = useState<User[]>([]);
  const [isLoadingManagers, setIsLoadingManagers] = useState(false);
  const [selectedManager, setSelectedManager] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [uList, pList] = await Promise.all([
        adminService.getUsers(),
        adminService.getProjects(),
      ]);
      setUsers(uList);
      setProjects(pList);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredManagers = managers.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.full_name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
  });

  const loadManagers = async () => {
    setIsLoadingManagers(true);
    try {
      const res = await adminService.getUsers('manager');
      setManagers(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingManagers(false);
    }
  };

  const openInviteModal = () => {
    setSelectedManager(null);
    setSearchQuery('');
    setSelectedProjectId('');
    setIsInviteOpen(true);
    loadManagers();
  };

  const handleInviteManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManager) return;
    setIsInviting(true);
    try {
      const res = await adminService.inviteManager({
        manager_id: selectedManager.id,
        project_id: selectedProjectId || null,
        team: "Engineering Management"
      });
      alert(`${selectedManager.full_name} has been assigned successfully.`);
      setIsInviteOpen(false);
      setSelectedManager(null);
      setSearchQuery('');
      setSelectedProjectId('');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to assign project manager");
    } finally {
      setIsInviting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await adminService.toggleUserStatus(id, newStatus);
      loadData();
    } catch (e) {
      alert("Failed to update status");
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  const filteredUsers = users.filter(u => activeRoleFilter === 'all' || u.role === activeRoleFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Project Managers</h1>
          <p className="text-xs text-slate-500 mt-1">Govern project managers and developer accounts across the platform</p>
        </div>
        <Button variant="admin" icon={<UserPlus className="w-4 h-4" />} onClick={openInviteModal}>
          Invite Project Manager
        </Button>
      </div>

      {/* Role Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['all', 'admin', 'manager', 'developer'].map((r) => (
          <button
            key={r}
            onClick={() => setActiveRoleFilter(r)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${activeRoleFilter === r
                ? 'bg-[rgba(var(--role-primary-rgb),0.20)] text-[var(--role-primary)] border border-[rgba(var(--role-primary-rgb),0.30)]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            {r} accounts
          </button>
        ))}
      </div>

      {/* Users Table */}
      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <th className="py-3.5 px-4">User Details</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-100/40 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={u.full_name} role={u.role} size={32} className="ring-2 ring-slate-200" />
                      <div>
                        <p className="font-semibold text-slate-900">{u.full_name}</p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <Badge variant={u.role as any}>{u.role.toUpperCase()}</Badge>
                  </td>
                  <td className="py-4 px-4 text-slate-600 font-mono">{u.phone || "N/A"}</td>
                  <td className="py-4 px-4">
                    <Badge variant={u.status === 'ACTIVE' ? 'healthy' : 'critical'}>{u.status}</Badge>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => handleToggleStatus(u.id, u.status)}
                      className={`p-2 rounded-lg text-xs font-semibold transition-colors ${u.status === 'ACTIVE'
                          ? 'text-rose-400 hover:bg-rose-500/10'
                          : 'text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      title={u.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                    >
                      <Power className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Invite / Assign Manager Modal */}
      <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Assign Project Manager" maxWidth="max-w-lg" footer={
        <>
          <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)} disabled={isInviting}>
            Cancel
          </Button>
          <Button type="button" disabled={!selectedProjectId || !selectedManager || isInviting} isLoading={isInviting} onClick={handleInviteManager}>
            Assign Manager
          </Button>
        </>
      }>
        <form onSubmit={handleInviteManager} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedManager(null);
                setSearchQuery('');
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
            >
              <option value="">Choose a project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key}) — {p.manager_name || 'Unassigned'}
                </option>
              ))}
            </select>
            {projects.length === 0 && (
              <p className="text-[11px] text-slate-500 mt-1">No projects available. Create a project before assigning a manager.</p>
            )}
          </div>

          {selectedProject && (
            <div className="space-y-4">
              {selectedProject.manager_name && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    Current Manager: <span className="font-semibold">{selectedProject.manager_name}</span>. Assigning a new manager will replace the current one.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Project Manager</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('manager-search-input');
                      el?.focus();
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm focus:outline-none role-input"
                    style={{ color: 'var(--role-text-heading)' }}
                  >
                    {selectedManager ? (
                      <span className="flex items-center gap-2 min-w-0">
                        <InitialsAvatar name={selectedManager.full_name} role="manager" size={24} />
                        <span className="min-w-0">
                          {selectedManager.full_name}
                          <span className="block text-[11px] truncate" style={{ color: 'var(--role-text-muted)' }}>{selectedManager.email}</span>
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--role-text-muted)' }}>Choose a manager...</span>
                    )}
                    <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--role-text-muted)' }} />
                  </button>

                  <div
                    id="manager-dropdown"
                    className="absolute z-20 w-full mt-2 rounded-xl overflow-hidden"
                    style={{ background: 'var(--role-surface)', border: '1px solid var(--role-border)', boxShadow: 'var(--role-shadow-lg)' }}
                  >
                    <div className="p-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--role-border-subtle)' }}>
                      <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--role-text-muted)' }} />
                      <input
                        id="manager-search-input"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search managers..."
                        className="w-full bg-transparent text-sm focus:outline-none"
                        style={{ color: 'var(--role-text-heading)' }}
                      />
                    </div>

                    <div className="max-h-[220px] overflow-y-auto" role="listbox">
                      {isLoadingManagers ? (
                        <div className="p-4 text-center text-xs" style={{ color: 'var(--role-text-muted)' }}>
                          Loading Project Managers...
                        </div>
                      ) : filteredManagers.length === 0 ? (
                        <div className="p-4 text-center text-xs" style={{ color: 'var(--role-text-muted)' }}>
                          No Project Managers Available
                          <p className="mt-1">Invite or create a Project Manager before assigning one.</p>
                        </div>
                      ) : (
                        filteredManagers.map((m) => {
                          const isSelected = selectedManager?.id === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setSelectedManager(m);
                                setSearchQuery('');
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150"
                              style={{
                                backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.10)' : 'var(--role-surface)',
                                borderLeft: isSelected ? '3px solid #38BDF8' : '3px solid transparent',
                              }}
                            >
<InitialsAvatar name={m.full_name} role="manager" size={32} className="border shrink-0" style={{ borderColor: 'var(--role-border-subtle)' }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--role-text-heading)' }}>
                                  {m.full_name}
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                    <ShieldCheck className="w-2.5 h-2.5" /> Manager
                                  </span>
                                </p>
                                <p className="text-[11px] truncate" style={{ color: 'var(--role-text-muted)' }}>{m.email}</p>
                              </div>
                              {isSelected && <Check className="w-4 h-4 shrink-0" style={{ color: '#38BDF8' }} />}
                            </button>
                          );
                        })
                      )}
                      {filteredManagers.length > 6 && (
                        <div className="p-2 text-center text-[10px]" style={{ color: 'var(--role-text-muted)', borderTop: '1px solid var(--role-border-subtle)' }}>
                          ↕ Scroll for more
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};
