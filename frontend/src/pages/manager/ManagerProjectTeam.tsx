import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { PageHeader } from '../../components/common/PageHeader';
import { InitialsAvatar } from '../../components/common/InitialsAvatar';
import { managerService } from '../../services/api';
import { ProjectMember, AvailableDeveloper } from '../../types';
import {
  Users, Plus, UserPlus, CheckCircle2, ChevronDown, ArrowLeft, Search, AlertCircle, Check, Mail, ShieldCheck, X, Square, CheckSquare, Loader2
} from 'lucide-react';

const statusBadgeVariant = (status: string) => {
  const s = status.toLowerCase();
  if (s === 'active') return 'healthy' as const;
  if (s === 'pending') return 'pending' as const;
  if (s === 'inactive') return 'critical' as const;
  return 'default' as const;
};

export const ManagerProjectTeam: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [team, setTeam] = useState<ProjectMember[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assign Developer modal state
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [available, setAvailable] = useState<AvailableDeveloper[]>([]);
  const [isLoadingDevs, setIsLoadingDevs] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [isAssigning, setIsAssigning] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadTeam = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await managerService.getProjectTeam(projectId!);
      setTeam(res.team || []);
      setPending(res.pending_invitations || []);
      setProject(res.project || null);
    } catch (e: any) {
      console.error(e);
      setError(e.response?.data?.detail || 'Failed to load project team');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) loadTeam();
  }, [projectId]);

  const openAssignModal = async () => {
    setSuccessMsg(null);
    setIsAssignOpen(true);
    setSelectedIds([]);
    setSearch('');
    setHighlightIdx(0);
    await loadAvailable();
  };

  const loadAvailable = async () => {
    setIsLoadingDevs(true);
    setDevError(null);
    try {
      const devs = await managerService.getAvailableDevelopers(projectId!);
      setAvailable(devs || []);
    } catch (e) {
      console.error(e);
      setDevError('Unable to load developers.');
    } finally {
      setIsLoadingDevs(false);
    }
  };

  const filtered = available.filter(
    (d) =>
      !search ||
      d.full_name.toLowerCase().includes(search.toLowerCase()) ||
      d.email.toLowerCase().includes(search.toLowerCase())
  );

  const selectedSet = new Set(selectedIds);
  const selectedDevs = selectedIds
    .map((id) => available.find((d) => d.id === id))
    .filter(Boolean) as AvailableDeveloper[];

  const visibleUnassigned = filtered.filter((d) => !d.assigned);
  const allFilteredSelected = visibleUnassigned.length > 0 && visibleUnassigned.every((d) => selectedSet.has(d.id));

  const toggleDev = (dev: AvailableDeveloper) => {
    if (dev.assigned) return;
    setSelectedIds((prev) =>
      prev.includes(dev.id) ? prev.filter((id) => id !== dev.id) : [...prev, dev.id]
    );
  };

  const removeSelected = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const handleSelectAll = () => {
    if (visibleUnassigned.length === 0) return;
    const ids = new Set(visibleUnassigned.map((d) => d.id));
    setSelectedIds((prev) =>
      allFilteredSelected
        ? prev.filter((id) => !ids.has(id))
        : Array.from(new Set([...prev, ...visibleUnassigned.map((d) => d.id)]))
    );
  };

  useEffect(() => {
    setHighlightIdx(0);
  }, [search, isDropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAssign = async () => {
    if (selectedIds.length === 0) return;
    setIsAssigning(true);
    try {
      const res = await managerService.assignDevelopers(projectId!, selectedIds);
      setSuccessMsg(res.message || 'Developer(s) assigned successfully.');
      setIsAssignOpen(false);
      await loadTeam();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to assign developer(s)');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsDropdownOpen(true);
        setTimeout(() => searchRef.current?.focus(), 0);
      }
      return;
    }
    if (filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const dev = filtered[highlightIdx];
      if (dev) toggleDev(dev);
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 animate-spin border-4 rounded-full mb-4" style={{ borderColor: 'var(--role-border)', borderTopColor: 'var(--role-primary)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--role-text-muted)' }}>Loading project team...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="Project Team"
        title={project?.name || 'Project Team'}
        badge={<Badge variant="manager">Team / Developers</Badge>}
        subtitle={
          project
            ? `${project.key} Â· ${project.status} Â· Manager: ${project.manager_name || 'Unassigned'}`
            : undefined
        }
        actions={
          <>
            <Link to="/manager/projects">
              <Button variant="outline" icon={<ArrowLeft className="w-4 h-4" />}>Projects</Button>
            </Link>
            <Button icon={<UserPlus className="w-4 h-4" />} onClick={openAssignModal}>
              Assign Developers
            </Button>
          </>
        }
      />

      {error && (
        <div className="p-4 rounded-xl flex items-center gap-2 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl flex items-center gap-2 text-sm" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E' }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}
        </div>
      )}

      {/* Pending Invitations */}
      {pending.length > 0 && (
        <Card title="Pending Developer Invitations" icon={<Users className="w-4 h-4" />}>
          <div className="space-y-3">
            {pending.map((inv) => (
              <div
                key={inv.id}
                className="px-4 py-3 rounded-xl flex items-center justify-between gap-3"
                style={{ background: 'var(--role-bg-muted)', border: '1px solid var(--role-border-subtle)' }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--role-text-heading)' }}>{inv.full_name || inv.email}</p>
                  <p className="text-xs flex items-center gap-1 truncate" style={{ color: 'var(--role-text-muted)' }}>
                    <Mail className="w-3 h-3" /> {inv.email}
                  </p>
                </div>
                <Badge variant="pending">Pending</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Project Team Table */}
      <Card
        title="Project Team"
        icon={<Users className="w-4 h-4" />}
        action={<span className="role-muted">{team.length} member(s)</span>}
        noPadding
        bodyClassName=""
      >
        {team.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="p-4 rounded-2xl mb-4" style={{ background: 'var(--role-bg-subtle)', color: 'var(--role-primary)' }}>
              <Users className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--role-text-heading)' }}>No developers assigned yet.</p>
            <p className="text-xs mt-1 mb-5" style={{ color: 'var(--role-text-muted)' }}>
              Use the Assign Developer button to add team members.
            </p>
            <Button icon={<Plus className="w-4 h-4" />} onClick={openAssignModal}>Assign Developers</Button>
          </div>
        ) : (
          <div className="role-data-table-wrap !border-x-0 !border-b-0 !rounded-none">
            <table className="role-data-table">
              <thead>
                <tr>
                  <th>Developer</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Assigned Tasks</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={m.full_name} role="developer" size={36} style={{ boxShadow: '0 0 0 1.5px var(--role-border-subtle)' }} />
                        <span className="font-semibold" style={{ color: 'var(--role-text-heading)' }}>{m.full_name}</span>
                      </div>
                    </td>
                    <td className="role-muted">{m.email}</td>
                    <td>
                      <Badge variant={m.role_in_project.toLowerCase() as any}>{m.role_in_project}</Badge>
                    </td>
                    <td>
                      <Badge variant={statusBadgeVariant(m.status)}>{m.status}</Badge>
                    </td>
                    <td>
                      <span className="role-chip !text-[10px]">{m.assigned_tasks} tasks</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Assign Developer Modal */}
      <Modal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        title="Assign Developers"
        maxWidth="max-w-lg"
        footer={
          <div className="w-full flex items-center justify-between gap-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--role-text-muted)' }}>
              {selectedIds.length === 0
                ? 'No developers selected'
                : `${selectedIds.length} developer${selectedIds.length === 1 ? '' : 's'} selected`}
            </span>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => setIsAssignOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={selectedIds.length === 0 || isAssigning}
                isLoading={isAssigning}
                onClick={handleAssign}
              >
                Assign
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-xs" style={{ color: 'var(--role-text-muted)' }}>
            Assign developers to{' '}
            <span className="font-semibold" style={{ color: 'var(--role-text-heading)' }}>{project?.name || 'this project'}</span>.
            Select multiple developers and click Assign.
          </div>

          {/* Multi-select Developer Dropdown */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--role-text-body)' }}>Developer</label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen((o) => !o);
                  setTimeout(() => searchRef.current?.focus(), 0);
                }}
                onKeyDown={handleKeyDown}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-sm focus:outline-none role-input"
                style={{ color: 'var(--role-text-heading)' }}
              >
                {selectedDevs.length > 0 ? (
                  <span className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {selectedDevs.slice(0, 3).map((dev) => (
                      <span
                        key={dev.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: 'var(--role-bg-subtle)', color: 'var(--role-text-heading)', border: '1px solid var(--role-border-subtle)' }}
                      >
                        {dev.full_name}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSelected(dev.id);
                          }}
                          className="hover:opacity-70"
                          aria-label={`Remove ${dev.full_name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {selectedDevs.length > 3 && (
                      <span className="text-xs font-semibold" style={{ color: 'var(--role-text-muted)' }}>
                        +{selectedDevs.length - 3} more
                      </span>
                    )}
                  </span>
                ) : (
                  <span style={{ color: 'var(--role-text-muted)' }}>Choose developers...</span>
                )}
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--role-text-muted)' }} />
              </button>

              {isDropdownOpen && (
                <div
                  className="absolute z-20 w-full mt-2 rounded-xl overflow-hidden flex flex-col"
                  style={{ background: 'var(--role-surface)', border: '1px solid var(--role-border)', boxShadow: 'var(--role-shadow-lg)' }}
                >
                  {/* FIXED search bar */}
                  <div className="p-2 flex items-center gap-2 shrink-0" style={{ borderBottom: '1px solid var(--role-border-subtle)' }}>
                    <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--role-text-muted)' }} />
                    <input
                      ref={searchRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search developers..."
                      className="w-full bg-transparent text-sm focus:outline-none"
                      style={{ color: 'var(--role-text-heading)' }}
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="p-1 rounded-md hover:opacity-70 shrink-0"
                        style={{ color: 'var(--role-text-muted)' }}
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isLoadingDevs ? (
                    <div className="p-6 flex flex-col items-center gap-2 text-sm" style={{ color: 'var(--role-text-muted)' }}>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading developers...
                    </div>
                  ) : devError ? (
                    <div className="p-6 text-center">
                      <p className="text-sm mb-3" style={{ color: 'var(--role-text-muted)' }}>Unable to load developers.</p>
                      <Button type="button" variant="outline" size="sm" onClick={loadAvailable}>Retry</Button>
                    </div>
                  ) : available.length === 0 ? (
                    <div className="p-6 text-center text-sm" style={{ color: 'var(--role-text-muted)' }}>No developers available.</div>
                  ) : filtered.length === 0 ? (
                    <div className="p-6 text-center text-sm" style={{ color: 'var(--role-text-muted)' }}>No matching developers.</div>
                  ) : (
                    /* SCROLLABLE developer list only */
                    <div className="max-h-[300px] overflow-y-auto" role="listbox" aria-label="Available Developers">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold transition-colors"
                        style={{ color: 'var(--role-text-body)', borderBottom: '1px solid var(--role-border-subtle)' }}
                      >
                        {allFilteredSelected ? (
                          <CheckSquare className="w-4 h-4" style={{ color: 'var(--role-primary)' }} />
                        ) : (
                          <Square className="w-4 h-4" style={{ color: 'var(--role-text-muted)' }} />
                        )}
                        {allFilteredSelected ? `Deselect All (${visibleUnassigned.length})` : `Select All (${visibleUnassigned.length})`}
                      </button>

                      {filtered.map((dev, idx) => {
                        const isActive = idx === highlightIdx;
                        const isChecked = !!dev.assigned || selectedSet.has(dev.id);
                        return (
                          <button
                            key={dev.id}
                            type="button"
                            role="option"
                            aria-selected={isChecked}
                            onMouseEnter={() => setHighlightIdx(idx)}
                            onClick={() => toggleDev(dev)}
                            disabled={dev.assigned}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150"
                            style={{
                              backgroundColor: isActive ? 'var(--role-bg-subtle)' : 'var(--role-surface)',
                              cursor: dev.assigned ? 'default' : 'pointer',
                            }}
                          >
                            <span className="shrink-0 flex items-center justify-center">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4" style={{ color: dev.assigned ? 'var(--role-text-muted)' : 'var(--role-primary)' }} />
                              ) : (
                                <Square className="w-4 h-4" style={{ color: 'var(--role-text-muted)' }} />
                              )}
                            </span>
                            <InitialsAvatar name={dev.full_name} role="developer" size={32} className="border shrink-0" style={{ borderColor: 'var(--role-border-subtle)' }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--role-text-heading)' }}>
                                {dev.full_name}
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <ShieldCheck className="w-2.5 h-2.5" /> Developer
                                </span>
                              </p>
                              <p className="text-[11px] truncate" style={{ color: 'var(--role-text-muted)' }}>{dev.email}</p>
                            </div>
                            {dev.assigned ? (
                              <span className="text-[10px] font-semibold shrink-0" style={{ color: 'var(--role-text-muted)' }}>Assigned</span>
                            ) : (
                              isChecked && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--role-primary)' }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
