import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  GitPullRequest, GitCommit, GitBranch, ExternalLink, Plus, RefreshCw,
  AlertTriangle, FolderKanban, Users, Star, GitFork, CircleAlert, Clock4,
  Link2, Lock, Radio, Search, FileCode2, ShieldCheck
} from 'lucide-react';

import { GlassCard } from '../../components/common/GlassCard';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { githubService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { InitialsAvatar } from '../../components/common/InitialsAvatar';
import {
  GitHubProjectInfo, GitHubLiveActivity, GitHubLiveCommitsPage,
  GitHubLiveCommit, GitHubLivePullRequest, GitHubLiveIssue, GitHubLiveRepository
} from '../../types';

const POLL_INTERVAL_MS = 30000; // live refresh every 30 seconds

const fmtNum = (n: number | undefined | null) => (n ?? 0).toLocaleString();

const fmtRelative = (iso?: string): string => {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
};

const fmtClock = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const fmtDateTime = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const LiveStatCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  color?: string;
}> = ({ label, value, hint, icon, color }) => (
  <GlassCard className="!p-5" hoverEffect>
    <div className="flex items-center justify-between mb-2">
      <p className="role-label">{label}</p>
      <span
        className="p-2 rounded-xl border"
        style={{
          color: color || 'var(--role-primary)',
          borderColor: 'rgba(var(--role-primary-rgb), 0.20)',
          background: 'rgba(var(--role-primary-rgb), 0.08)',
        }}
      >
        {icon}
      </span>
    </div>
    <h3 className="role-metric-value !text-2xl">{value}</h3>
    {hint && <p className="role-muted mt-1">{hint}</p>}
  </GlassCard>
);

const SectionCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, action, children }) => (
  <GlassCard className="!p-6">
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <span className="role-icon-chip p-2 rounded-xl">{icon}</span>
        <h3 className="text-base font-bold" style={{ color: 'var(--role-text-heading)' }}>{title}</h3>
      </div>
      {action}
    </div>
    {children}
  </GlassCard>
);

const PRStateBadge: React.FC<{ state: string }> = ({ state }) => {
  const map: Record<string, string> = {
    OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    MERGED: 'bg-violet-50 text-violet-700 border-violet-200',
    CLOSED: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${map[state] || map.CLOSED}`}>
      {state}
    </span>
  );
};

const LiveDot: React.FC<{ active: boolean; stale?: boolean }> = ({ active, stale }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
    <span className="relative flex h-2.5 w-2.5">
      {active && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ background: stale ? '#F59E0B' : '#10B981' }}
        />
      )}
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full"
        style={{ background: stale ? '#F59E0B' : active ? '#10B981' : '#94A3B8' }}
      />
    </span>
    {stale ? 'Stale' : active ? 'Live' : 'Offline'}
  </span>
);

const StatusMessage: React.FC<{
  status: string;
  message?: string;
  viewOnly: boolean;
  canManage: boolean;
  onConnect: () => void;
  onRetry: () => void;
}> = ({ status, message, viewOnly, canManage, onConnect, onRetry }) => {
  if (status === 'NO_REPOSITORY') {
    return (
      <GlassCard className="!p-12">
        <div className="flex flex-col items-center text-center">
          <div className="p-4 rounded-2xl mb-4" style={{ background: 'var(--role-bg-subtle)', color: 'var(--role-primary)' }}>
            <FolderKanban className="w-8 h-8" />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--role-text-heading)' }}>
            This project has no GitHub repository connected.
          </p>
          <p className="text-xs mt-1 mb-5" style={{ color: 'var(--role-text-muted)' }}>
            {viewOnly ? 'Contact a developer to connect a repository.' : 'Connect a repository to see live GitHub engineering data.'}
          </p>
          {canManage && <Button icon={<Plus className="w-4 h-4" />} onClick={onConnect}>Connect Repository</Button>}
        </div>
      </GlassCard>
    );
  }
  return (
    <GlassCard className="!p-10">
      <div className="flex flex-col items-center text-center">
        <div className="p-4 rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
          <AlertTriangle className="w-8 h-8" />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--role-text-heading)' }}>{message || 'GitHub data temporarily unavailable.'}</p>
        {status === 'UNAVAILABLE' && (
          <Button className="mt-4" variant="outline" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </GlassCard>
  );
};

const CommitRow: React.FC<{ commit: GitHubLiveCommit }> = ({ commit }) => (
  <div className="px-4 py-3 flex items-center gap-3">
    <InitialsAvatar name={commit.author_name || commit.author_login || 'author'} size={32} className="border shrink-0" style={{ borderColor: 'var(--role-border-subtle)' }} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold truncate" style={{ color: 'var(--role-text-heading)' }}>
        {commit.message_first_line || commit.message || 'Commit'}
      </p>
      <p className="text-[11px] truncate" style={{ color: 'var(--role-text-muted)' }}>
        {commit.author_name} · {fmtRelative(commit.committed_at || commit.authored_at)}
      </p>
    </div>
    <code className="text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0" style={{ color: 'var(--role-text-muted)', borderColor: 'var(--role-border-subtle)' }}>
      {commit.short_sha}
    </code>
    {commit.url && (
      <a href={commit.url} target="_blank" rel="noreferrer" className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100" style={{ color: 'var(--role-text-muted)' }} title="Open on GitHub">
        <ExternalLink className="w-4 h-4" />
      </a>
    )}
  </div>
);

const PullRequestRow: React.FC<{ pr: GitHubLivePullRequest }> = ({ pr }) => (
  <div className="px-4 py-3 flex items-center gap-3">
    <span className="shrink-0 p-2 rounded-xl" style={{ background: 'var(--role-bg-subtle)', color: 'var(--role-primary)' }}>
      <GitPullRequest className="w-4 h-4" />
    </span>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold truncate" style={{ color: 'var(--role-text-heading)' }}>
        <span className="role-muted font-normal">#{pr.number}</span> {pr.title}
      </p>
      <p className="text-[11px] truncate" style={{ color: 'var(--role-text-muted)' }}>
        {pr.user_login} · {pr.head_branch || '?'} → {pr.base_branch || '?'} · {fmtRelative(pr.updated_at)}
      </p>
    </div>
    <PRStateBadge state={pr.state} />
    {pr.html_url && (
      <a href={pr.html_url} target="_blank" rel="noreferrer" className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100" style={{ color: 'var(--role-text-muted)' }} title="Open on GitHub">
        <ExternalLink className="w-4 h-4" />
      </a>
    )}
  </div>
);

const IssueRow: React.FC<{ issue: GitHubLiveIssue }> = ({ issue }) => (
  <div className="px-4 py-3 flex items-center gap-3">
    <span className="shrink-0 p-2 rounded-xl" style={{ background: 'var(--role-bg-subtle)', color: 'var(--role-primary)' }}>
      <CircleAlert className="w-4 h-4" />
    </span>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold truncate" style={{ color: 'var(--role-text-heading)' }}>
        <span className="role-muted font-normal">#{issue.number}</span> {issue.title}
      </p>
      <p className="text-[11px] truncate" style={{ color: 'var(--role-text-muted)' }}>
        {issue.user_login} · {fmtRelative(issue.updated_at)}
      </p>
    </div>
    <div className="flex items-center gap-1 flex-wrap shrink-0 max-w-[40%]">
      {issue.labels.slice(0, 2).map((l) => (
        <span key={l.name} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border" style={{ background: `#${l.color}20`, borderColor: `#${l.color}55`, color: '#475569' }}>
          {l.name}
        </span>
      ))}
      {issue.labels.length > 2 && <span className="text-[10px] role-muted">+{issue.labels.length - 2}</span>}
    </div>
    {issue.html_url && (
      <a href={issue.html_url} target="_blank" rel="noreferrer" className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100" style={{ color: 'var(--role-text-muted)' }} title="Open on GitHub">
        <ExternalLink className="w-4 h-4" />
      </a>
    )}
  </div>
);

const EmptyList: React.FC<{ text: string }> = ({ text }) => (
  <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--role-text-muted)' }}>{text}</div>
);

export const GitHubEngineeringAnalytics: React.FC = () => {
  const { role } = useAuth();
  const viewOnly = role === 'admin' || role === 'manager';
  const canManage = role === 'developer';

  const [projects, setProjects] = useState<GitHubProjectInfo[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [initialAutoSelect, setInitialAutoSelect] = useState(false);

  const [liveActivity, setLiveActivity] = useState<GitHubLiveActivity | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveBranch, setLiveBranch] = useState('');

  const [commitsData, setCommitsData] = useState<GitHubLiveCommitsPage | null>(null);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsPage, setCommitsPage] = useState(1);
  const [pollTick, setPollTick] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [connectProjectId, setConnectProjectId] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const forceNextRef = useRef(false);

  const activeProjectId = selectedProjectIds.length === 1 ? selectedProjectIds[0] : undefined;

  const activeProject = useMemo(
    () => (activeProjectId ? projects.find((p) => p.id === activeProjectId) : undefined),
    [activeProjectId, projects]
  );

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchAndEnrichProjects = useCallback(async (isInitial = false) => {
    try {
      const projsResponse = await githubService.getProjects();
      let reposResponse: any = null;

      try {
        reposResponse = await githubService.getRepositories({ page_size: 100 });
      } catch {
        // Fallback to project.repositories if getRepositories fails
      }

      const repoMap = new Map();
      if (reposResponse?.items) {
        reposResponse.items.forEach((r: any) => {
          if (!repoMap.has(r.project_id)) repoMap.set(r.project_id, []);
          repoMap.get(r.project_id).push(r);
        });
      }

      const enrichedProjects = projsResponse.map((p: any) => ({
        ...p,
        repositories: repoMap.get(p.id) ?? p.repositories ?? []
      }));

      setProjects(enrichedProjects);

      if (isInitial && !initialAutoSelect) {
        setSelectedProjectIds([]);
        setInitialAutoSelect(true);
      }
    } catch {
      if (isInitial) {
        showToast('error', 'Failed to load projects.');
      }
    } finally {
      if (isInitial) {
        setProjectsLoading(false);
      }
    }
  }, [initialAutoSelect, showToast]);

  // Load projects and repositories on mount
  useEffect(() => {
    let cancelled = false;
    setProjectsLoading(true);
    fetchAndEnrichProjects(true).then(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAndEnrichProjects]);

  // Fetch live activity (repo overview + metrics + branches + PRs + issues).
  const fetchActivity = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    if (!activeProjectId) return;
    if (!opts?.silent) setLiveRefreshing(true);
    try {
      const data = await githubService.getLiveActivity(activeProjectId, {
        branch: liveBranch || undefined,
        force: opts?.force || false,
      });
      if (data.status === 'OK') {
        setLiveActivity(data);
        setLiveError(null);
      } else {
        setLiveError(data.message || 'GitHub data temporarily unavailable.');
        setLiveActivity((prev) => prev ?? data);
      }
    } catch {
      setLiveError('GitHub data temporarily unavailable.');
    } finally {
      setLiveRefreshing(false);
      setLiveLoading(false);
    }
  }, [activeProjectId, liveBranch]);

  // Project / branch change: reset state and fetch fresh data immediately.
  useEffect(() => {
    if (!activeProjectId) return;
    setLiveLoading(true);
    setLiveActivity(null);
    setCommitsData(null);
    setCommitsPage(1);
    fetchActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, liveBranch]);

  // Fetch paginated live commits for the selected branch.
  const fetchCommits = useCallback(async (opts?: { force?: boolean }) => {
    if (!activeProjectId) return;
    setCommitsLoading(true);
    try {
      const data = await githubService.getLiveCommits(activeProjectId, {
        branch: liveBranch || undefined,
        page: commitsPage,
        per_page: 20,
        force: opts?.force || false,
      });
      if (data.status === 'OK') setCommitsData(data);
    } catch {
      // keep last-good commits on transient errors
    } finally {
      setCommitsLoading(false);
    }
  }, [activeProjectId, liveBranch, commitsPage]);

  useEffect(() => {
    if (activeProjectId) fetchCommits();
  }, [fetchCommits, pollTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // 30-second live polling while the page is visible.
  useEffect(() => {
    if (!activeProjectId) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') setPollTick((t) => t + 1);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [activeProjectId]);

  // On each poll tick, silently refresh live activity + commits.
  useEffect(() => {
    if (!activeProjectId || pollTick === 0) return;
    const force = forceNextRef.current;
    forceNextRef.current = false;
    fetchActivity({ silent: true, force });
    fetchCommits({ force });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollTick]);

  const handleRefresh = useCallback(() => {
    forceNextRef.current = true;
    setLiveRefreshing(true);
    setPollTick((t) => t + 1);
  }, []);

  const handleSelectProject = useCallback((id: string) => {
    setSelectedProjectIds((prev) => {
      if (prev.length === 1 && prev[0] === id) return prev; // already active
      return [id];
    });
    setLiveBranch('');
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedProjectIds([]);
  }, []);

  const handleSelectBranch = useCallback((name: string) => {
    setLiveBranch(name);
    setCommitsPage(1);
  }, []);

  const loadMoreCommits = useCallback(() => {
    setCommitsPage((p) => p + 1);
  }, []);

  const openConnect = useCallback((projectId?: string) => {
    setConnectProjectId(projectId || projects[0]?.id);
    setFormOpen(true);
  }, [projects]);

  const refreshProjects = useCallback(async () => {
    await fetchAndEnrichProjects(false);
  }, [fetchAndEnrichProjects]);

  const status = liveActivity?.status;
  const repo = liveActivity?.repository as GitHubLiveRepository | undefined;
  const metrics = liveActivity?.metrics;
  const branches = liveActivity?.branches || [];
  const defaultBranch = liveActivity?.default_branch || repo?.default_branch || 'main';
  const effectiveBranch = liveBranch || defaultBranch;
  const prs = liveActivity?.pull_requests || [];
  const issues = liveActivity?.issues || [];
  const isStale = !!liveError && !!liveActivity && liveActivity.status === 'OK';

  return (
    <div className="role-page-bg min-h-screen p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="role-icon-chip p-3 rounded-2xl">
            <GitPullRequest className="w-7 h-7" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              GitHub Engineering
              <Badge variant="role">{role || 'developer'} Portal</Badge>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time repository intelligence — commits, branches, pull requests & issues from GitHub
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${viewOnly ? 'bg-slate-700/20 text-slate-600 border-slate-300' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'}`}>
            {viewOnly ? <Lock className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {viewOnly ? 'VIEW ONLY' : 'REPOSITORY MANAGEMENT'}
          </span>
          {activeProjectId && (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              Live · Last synced {fmtClock(liveActivity?.last_synced)}
            </span>
          )}
          <Button variant="outline" size="sm" icon={<RefreshCw className={`w-4 h-4 ${liveRefreshing ? 'animate-spin' : ''}`} />} onClick={handleRefresh} disabled={!activeProjectId || liveRefreshing}>
            Refresh
          </Button>
          {canManage && (
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => openConnect()}>
              Connect Repository
            </Button>
          )}
        </div>
      </div>

      {/* Project selector */}
      <GlassCard className="!p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <FolderKanban className="w-4 h-4 text-slate-500 shrink-0" />
          {projectsLoading ? (
            <span className="text-xs text-slate-500">Loading projects...</span>
          ) : projects.length === 0 ? (
            <span className="text-xs text-slate-500">No accessible projects</span>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedProjectIds.length === 0 ? 'role-tab-active' : 'role-tab-inactive'}`}
                onClick={handleSelectAll}
              >
                All {(() => {
                  const c = projects.reduce((acc, p) => acc + p.repositories.length, 0);
                  return c > 0 ? `(${c})` : '';
                })()}
              </button>
              {projects.map((p) => {
                const active = selectedProjectIds.length === 1 && selectedProjectIds[0] === p.id;
                return (
                  <button
                    key={p.id}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${active ? 'role-tab-active' : 'role-tab-inactive'}`}
                    onClick={() => handleSelectProject(p.id)}
                  >
                    {p.name}
                    <span className="ml-1 opacity-60">({p.repositories.length})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </GlassCard>

      {!activeProjectId && (
        <>
          {(() => {
            const allConnectedRepos = projects.flatMap(p => p.repositories.map(r => ({ ...r, projectId: p.id, projectName: p.name })));

            if (projectsLoading) {
              return (
                <GlassCard className="!p-12">
                  <div className="flex justify-center"><RefreshCw className="w-8 h-8 animate-spin text-slate-400" /></div>
                </GlassCard>
              );
            }

            if (allConnectedRepos.length === 0) {
              return (
                <GlassCard className="!p-12">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 rounded-2xl mb-4" style={{ background: 'var(--role-bg-subtle)', color: 'var(--role-primary)' }}>
                      <FolderKanban className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--role-text-heading)' }}>
                      No projects have a connected GitHub repository yet.
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--role-text-muted)' }}>
                      Click "Connect Repository" to integrate a GitHub repository with one of your projects.
                    </p>
                  </div>
                </GlassCard>
              );
            }

            return (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {allConnectedRepos.map((repo: any) => (
                  <SectionCard
                    key={repo.id}
                    title="Repository Overview"
                    icon={<FileCode2 className="w-4 h-4" />}
                    action={
                      <Button variant="outline" size="sm" onClick={() => handleSelectProject(repo.projectId)}>
                        View Live Analytics
                      </Button>
                    }
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-extrabold" style={{ color: 'var(--role-text-heading)' }}>{repo.repo_name}</h4>
                        <Badge variant={repo.visibility === 'private' ? 'critical' : 'healthy'}>{repo.visibility}</Badge>
                        <Badge variant="role">{repo.projectName}</Badge>
                      </div>
                      {repo.description && (
                        <p className="text-sm" style={{ color: 'var(--role-text-muted)' }}>{repo.description}</p>
                      )}
                      <p className="text-xs font-medium" style={{ color: 'var(--role-text-muted)' }}>
                        <span className="role-muted">Owner:</span> {repo.full_name || `${repo.owner}/${repo.repo_name}`} ·{' '}
                        <span className="role-muted">Default branch:</span> <code className="font-mono">{repo.default_branch || 'main'}</code>
                      </p>
                      <div className="flex items-center gap-4 mt-1 flex-wrap text-xs font-semibold" style={{ color: 'var(--role-text-muted)' }}>
                        <span className="inline-flex items-center gap-1"><CircleAlert className="w-3.5 h-3.5" /> {fmtNum(repo.open_issues_count)} issues</span>
                        <span className="inline-flex items-center gap-1"><GitPullRequest className="w-3.5 h-3.5" /> {fmtNum(repo.open_prs_count)} pull requests</span>
                        {repo.last_synced_at && <span className="inline-flex items-center gap-1"><Clock4 className="w-3.5 h-3.5" /> Synced {fmtRelative(repo.last_synced_at)}</span>}
                      </div>
                    </div>
                  </SectionCard>
                ))}
              </div>
            );
          })()}
        </>
      )}

      {activeProjectId && (
        <>
          {/* Live status bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-xl border" style={{ background: 'var(--role-surface)', borderColor: 'var(--role-border-subtle)' }}>
            <div className="flex items-center gap-3 flex-wrap">
              <LiveDot active={!!liveActivity && liveActivity.status === 'OK'} stale={isStale} />
              {liveActivity?.status === 'OK' && (
                <span className="text-xs" style={{ color: 'var(--role-text-muted)' }}>
                  Last synced: <span className="font-semibold" style={{ color: 'var(--role-text-heading)' }}>{fmtClock(liveActivity.last_synced)}</span>
                  {liveError && <span className="ml-2 text-amber-600 font-medium">— data may be stale ({fmtRelative(liveActivity.last_synced)})</span>}
                </span>
              )}
              {liveRefreshing && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--role-text-muted)' }}><RefreshCw className="w-3 h-3 animate-spin" /> Refreshing GitHub data...</span>}
            </div>
            {branches.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <GitBranch className="w-4 h-4 shrink-0" style={{ color: 'var(--role-text-muted)' }} />
                {branches.map((b) => {
                  const isDefault = b.name === defaultBranch;
                  const activeBranch = effectiveBranch === b.name;
                  return (
                    <button
                      key={b.name}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${activeBranch ? 'role-tab-active' : 'role-tab-inactive'}`}
                      onClick={() => handleSelectBranch(b.name)}
                      title={isDefault ? 'Default branch' : b.name}
                    >
                      {b.name}
                      {isDefault && <span className="ml-1 opacity-60">★</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {liveLoading && !liveActivity ? (
            <div className="space-y-6">
              <div className="h-40 bg-slate-50 rounded-2xl animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="h-28 bg-slate-50 rounded-2xl animate-pulse" />
                ))}
              </div>
              <div className="h-72 bg-slate-50 rounded-2xl animate-pulse" />
            </div>
          ) : liveActivity?.status !== 'OK' ? (
            <StatusMessage
              status={liveActivity?.status || 'UNAVAILABLE'}
              message={liveActivity?.message}
              viewOnly={viewOnly}
              canManage={canManage}
              onConnect={() => openConnect(activeProjectId)}
              onRetry={fetchActivity}
            />
          ) : (
            <>
              {/* Repository overview */}
              <SectionCard
                title="Repository Overview"
                icon={<FileCode2 className="w-4 h-4" />}
                action={
                  repo?.html_url ? (
                    <a href={repo.html_url} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" icon={<ExternalLink className="w-4 h-4" />}>Open on GitHub</Button>
                    </a>
                  ) : undefined
                }
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-lg font-extrabold" style={{ color: 'var(--role-text-heading)' }}>{repo?.name}</h4>
                      <Badge variant={repo?.private ? 'critical' : 'healthy'}>{repo?.visibility || (repo?.private ? 'private' : 'public')}</Badge>
                      {repo?.language && <Badge>{repo.language}</Badge>}
                      {repo?.archived && <Badge variant="pending">Archived</Badge>}
                    </div>
                    {repo?.description && (
                      <p className="text-sm mt-1" style={{ color: 'var(--role-text-muted)' }}>{repo.description}</p>
                    )}
                    <p className="text-xs mt-1 font-medium" style={{ color: 'var(--role-text-muted)' }}>
                      <span className="role-muted">Owner:</span> {repo?.full_name} ·{' '}
                      <span className="role-muted">Default branch:</span> <code className="font-mono">{repo?.default_branch}</code>
                    </p>
                    <div className="flex items-center gap-4 mt-3 flex-wrap text-xs font-semibold" style={{ color: 'var(--role-text-muted)' }}>
                      <span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5" /> {fmtNum(repo?.stars)}</span>
                      <span className="inline-flex items-center gap-1"><GitFork className="w-3.5 h-3.5" /> {fmtNum(repo?.forks)}</span>
                      <span className="inline-flex items-center gap-1"><CircleAlert className="w-3.5 h-3.5" /> {fmtNum(repo?.open_issues)} issues</span>
                      <span className="inline-flex items-center gap-1"><Clock4 className="w-3.5 h-3.5" /> Pushed {fmtRelative(repo?.pushed_at)}</span>
                    </div>
                  </div>
                  {liveActivity?.latest_commit && (
                    <div className="w-full lg:w-80 shrink-0 rounded-xl border p-4" style={{ background: 'var(--role-bg-subtle)', borderColor: 'var(--role-border-subtle)' }}>
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--role-text-muted)' }}>Latest Commit</p>
                      <CommitRow commit={liveActivity.latest_commit} />
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Engineering metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <LiveStatCard label="Total Commits" value={fmtNum(metrics?.total_commits)} hint="all branches default" icon={<GitCommit className="w-4 h-4" />} />
                <LiveStatCard label="Commits This Week" value={fmtNum(metrics?.commits_this_week)} hint={`${fmtNum(metrics?.commits_this_month)} this month`} icon={<GitCommit className="w-4 h-4" />} color="#44ACFF" />
                <LiveStatCard label="Contributors" value={fmtNum(metrics?.active_contributors)} hint="active authors" icon={<Users className="w-4 h-4" />} color="#8B5CF6" />
                <LiveStatCard label="Open PRs" value={fmtNum(metrics?.open_pull_requests)} hint={`${fmtNum(metrics?.merged_pull_requests)} merged`} icon={<GitPullRequest className="w-4 h-4" />} color="#10B981" />
                <LiveStatCard label="Open Issues" value={fmtNum(metrics?.open_issues)} hint="on default branch" icon={<CircleAlert className="w-4 h-4" />} color="#F59E0B" />
                <LiveStatCard label="Branches" value={fmtNum(metrics?.total_branches)} hint={effectiveBranch} icon={<GitBranch className="w-4 h-4" />} color="#6366F1" />
                <LiveStatCard label="Latest Commit" value={metrics?.latest_commit_sha || '—'} hint={fmtRelative(metrics?.latest_commit_at)} icon={<GitCommit className="w-4 h-4" />} color="#F97316" />
                <LiveStatCard label="Last Synced" value={fmtClock(liveActivity.last_synced)} hint="auto-refresh 30s" icon={<Radio className="w-4 h-4" />} color="#0EA5E9" />
              </div>

              {/* Recent commits */}
              <SectionCard
                title={`Recent Commits · ${effectiveBranch}`}
                icon={<GitCommit className="w-4 h-4" />}
                action={<span className="role-muted text-xs">{commitsData ? `${fmtNum(commitsData.total_commits)} total` : ''}</span>}
              >
                {commitsLoading && !commitsData ? (
                  <div className="h-40 flex items-center justify-center text-slate-500"><RefreshCw className="w-5 h-5 animate-spin" /></div>
                ) : !commitsData || commitsData.status !== 'OK' || commitsData.commits.length === 0 ? (
                  <EmptyList text="No commits found on this branch yet." />
                ) : (
                  <>
                    <div className="divide-y" style={{ borderColor: 'var(--role-border-subtle)' }}>
                      {commitsData.commits.map((c) => <CommitRow key={c.sha} commit={c} />)}
                    </div>
                    {commitsData.page < commitsData.last_page && (
                      <div className="pt-4 text-center">
                        <Button variant="outline" size="sm" icon={<GitCommit className="w-4 h-4" />} onClick={loadMoreCommits} isLoading={commitsLoading}>
                          Load More
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </SectionCard>

              {/* Branches */}
              <SectionCard
                title="Branches"
                icon={<GitBranch className="w-4 h-4" />}
                action={<span className="role-muted text-xs">{branches.length} branch(es)</span>}
              >
                {branches.length === 0 ? (
                  <EmptyList text="No branches available." />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {branches.map((b) => {
                      const isDefault = b.name === defaultBranch;
                      const active = effectiveBranch === b.name;
                      return (
                        <button
                          key={b.name}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${active ? 'role-tab-active' : 'role-tab-inactive'}`}
                          onClick={() => handleSelectBranch(b.name)}
                        >
                          <GitBranch className="w-3 h-3" />
                          {b.name}
                          {isDefault && <span className="opacity-60">(default)</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              {/* Pull requests */}
              <SectionCard
                title="Pull Requests"
                icon={<GitPullRequest className="w-4 h-4" />}
                action={
                  <span className="flex items-center gap-2">
                    <span className="role-muted text-xs">{prs.filter((p) => p.state === 'OPEN').length} open</span>
                    <span className="role-muted text-xs">{prs.filter((p) => p.state === 'MERGED').length} merged</span>
                  </span>
                }
              >
                {prs.length === 0 ? (
                  <EmptyList text="No pull requests yet." />
                ) : (
                  <div className="divide-y" style={{ borderColor: 'var(--role-border-subtle)' }}>
                    {prs.map((pr) => <PullRequestRow key={pr.number} pr={pr} />)}
                  </div>
                )}
              </SectionCard>

              {/* Issues */}
              <SectionCard
                title="Issues"
                icon={<CircleAlert className="w-4 h-4" />}
                action={<span className="role-muted text-xs">{issues.length} open</span>}
              >
                {issues.length === 0 ? (
                  <EmptyList text="No open issues." />
                ) : (
                  <div className="divide-y" style={{ borderColor: 'var(--role-border-subtle)' }}>
                    {issues.map((iss) => <IssueRow key={iss.number} issue={iss} />)}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </>
      )}

      {/* Connect repository modal (developer only) */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title="Connect GitHub Repository"
        maxWidth="max-w-xl"
      >
        <RepositoryForm
          projects={projects}
          initialProjectId={connectProjectId}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            await refreshProjects();
          }}
          onError={(msg) => showToast('error', msg)}
          onSuccess={(msg) => showToast('success', msg)}
        />
      </Modal>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/90 border-rose-500/40 text-rose-300'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

const isValidGithubUrl = (url: string) =>
  /^(https?:\/\/)?(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?\/?$/.test(url.trim());

const RepositoryForm: React.FC<{
  projects: GitHubProjectInfo[];
  initialProjectId?: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}> = ({ projects, initialProjectId, onClose, onSaved, onError, onSuccess }) => {
  const [projectId, setProjectId] = useState(initialProjectId || projects[0]?.id || '');
  const [url, setUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ exists: boolean; message: string; owner?: string; repo_name?: string } | null>(null);

  const check = async () => {
    if (!projectId) { onError('Select a project first.'); return; }
    if (!isValidGithubUrl(url)) { onError('Please enter a valid GitHub repository URL.'); return; }
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await githubService.checkRepository({ project_id: projectId, repository_url: url.trim() });
      setCheckResult({ exists: res.exists, message: res.message, owner: res.owner, repo_name: res.repo_name });
    } catch (e: any) {
      onError(e?.response?.data?.detail || 'Unable to check repository.');
    } finally {
      setChecking(false);
    }
  };

  const connect = async () => {
    if (!projectId) { onError('Select a project first.'); return; }
    if (!url.trim()) { onError('Enter a repository URL.'); return; }
    setConnecting(true);
    try {
      const res = await githubService.connectRepository({ project_id: projectId, repository_url: url.trim() });
      onSuccess(res.message || 'Repository connected successfully.');
      onSaved();
    } catch (e: any) {
      onError(e?.response?.data?.detail || 'Failed to connect repository.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-xs" style={{ color: 'var(--role-text-muted)' }}>
        Connect an existing GitHub repository to a project. The repository must be public, or accessible by the server-side GitHub integration.
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--role-text-body)' }}>Project</label>
        <select
          className="role-input w-full px-4 py-2.5 rounded-xl text-sm"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--role-text-body)' }}>Repository URL</label>
        <div className="relative">
          <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            className="role-input pl-9 pr-3 py-2.5 rounded-xl text-sm w-full"
            placeholder="https://github.com/owner/repository"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setCheckResult(null); }}
          />
        </div>
        <p className="text-[11px] mt-1" style={{ color: 'var(--role-text-muted)' }}>
          Supports github.com/owner/repo, with or without .git
        </p>
      </div>

      {checkResult && (
        <div
          className="p-3 rounded-xl text-sm flex items-center gap-2"
          style={{
            background: checkResult.exists ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${checkResult.exists ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
            color: checkResult.exists ? '#16A34A' : '#DC2626',
          }}
        >
          {checkResult.exists ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {checkResult.message}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" variant="outline" onClick={check} isLoading={checking} icon={<Search className="w-4 h-4" />}>Check</Button>
        <Button type="button" onClick={connect} isLoading={connecting} icon={<Plus className="w-4 h-4" />}>Connect</Button>
      </div>
    </div>
  );
};