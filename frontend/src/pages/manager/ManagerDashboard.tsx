import React, { useEffect, useState } from 'react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { MetricCard } from '../../components/common/MetricCard';
import { ProgressBar } from '../../components/common/ProgressBar';
import { PageHeader } from '../../components/common/PageHeader';
import { AIInsightCard } from '../../components/common/AIInsightCard';
import { AIHealthScoreCard } from '../../components/analytics/AIHealthScoreCard';
import { AIDelayPredictionCard } from '../../components/analytics/AIDelayPredictionCard';
import { AIWorkloadCard } from '../../components/analytics/AIWorkloadCard';
import { InitialsAvatar } from '../../components/common/InitialsAvatar';
import { managerService, githubService } from '../../services/api';
import {
  FolderKanban, GitPullRequest, Sparkles, TrendingUp, ArrowRight, Users,
  ShieldAlert, GitCommit, GitBranch, CircleAlert
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Link, useNavigate } from 'react-router-dom';
import { useChartColors } from '../../contexts/ThemeContext';
import { AIMeetingMinutesModal } from '../../components/ai/AIMeetingMinutesModal';

export const ManagerDashboard: React.FC = () => {
  const COLORS = useChartColors();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [github, setGithub] = useState<any>(null);

  const fetchDashboard = async (projId?: string) => {
    setIsLoading(true);
    try {
      const res = await managerService.getDashboard(projId);
      setData(res);
      if (res.selected_project_id && !selectedProject) {
        setSelectedProject(res.selected_project_id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(selectedProject || undefined);
  }, [selectedProject]);

  useEffect(() => {
    githubService.getAnalytics({ period: '30d', page: 1, page_size: 1 })
      .then((res) => setGithub(res))
      .catch(() => setGithub(null));
  }, []);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-72 role-skeleton" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 role-skeleton rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => <div key={i} className="h-72 role-skeleton rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const { metrics, developer_productivity, charts, ai_suggestions, projects } = data;
  const gSummary = github?.summary;

  const healthVariant = (h: string) => {
    const s = (h || '').toLowerCase();
    if (s === 'healthy') return 'healthy' as const;
    if (s === 'at_risk') return 'at_risk' as const;
    return 'critical' as const;
  };

  const ghStats = [
    { label: 'Commits', value: gSummary?.commits ?? '—', icon: <GitCommit className="w-4 h-4" /> },
    { label: 'Open PRs', value: gSummary?.open_prs ?? '—', icon: <GitPullRequest className="w-4 h-4" /> },
    { label: 'Open Issues', value: gSummary?.open_issues ?? '—', icon: <CircleAlert className="w-4 h-4" /> },
    { label: 'Contributors', value: gSummary?.active_contributors ?? '—', icon: <Users className="w-4 h-4" /> },
  ];

  const primaryInsight = ai_suggestions?.[0] || 'All projects are trending toward healthy delivery.';

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        eyebrow="Project Manager · AI Command Center"
        title="Command Center"
        badge={<Badge variant="manager">Project Manager</Badge>}
        subtitle="Track project health, sprint velocity, developer workload and AI-predicted engineering risks across your portfolio."
        actions={
          <>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold focus:outline-none role-input cursor-pointer"
            >
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Button variant="outline" onClick={() => navigate('/manager/velocity')}>Velocity</Button>
            <Button icon={<Sparkles className="w-4 h-4" />} onClick={() => setIsMeetingModalOpen(true)}>AI Meeting Minutes</Button>
          </>
        }
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          label="Project Health"
          value={metrics.project_health}
          icon={<ShieldAlert className="w-5 h-5" />}
          hint="status"
          footer={<Badge variant={healthVariant(metrics.project_health)}>{metrics.project_health}</Badge>}
        />
        <MetricCard
          label="Sprint Progress"
          value={`${metrics.sprint_progress}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          progress={metrics.sprint_progress}
        />
        <MetricCard
          label="Review Queue"
          value={metrics.review_queue_count}
          icon={<GitPullRequest className="w-5 h-5" />}
          tone="warning"
          hint="pending"
          onClick={() => navigate('/manager/reviews')}
        />
        <MetricCard
          label="AI Risk Score"
          value={metrics.ai_risk_score}
          icon={<Sparkles className="w-5 h-5" />}
          tone={metrics.ai_risk_score < 30 ? 'success' : metrics.ai_risk_score < 60 ? 'warning' : 'danger'}
          hint="/ 100"
        />
      </div>

      {/* AI Health Score */}
      <AIHealthScoreCard projectId={selectedProject} />

      {/* AI Project Insights */}
      <AIInsightCard
        severity={metrics.ai_risk_score >= 60 ? 'danger' : metrics.ai_risk_score >= 30 ? 'warning' : 'info'}
        title={metrics.ai_risk_score >= 30 ? 'AI Project Insight' : 'AI Insight'}
        message={primaryInsight}
        reason={`AI risk engine currently rates this project ${metrics.ai_risk_score}/100 with ${metrics.pending_tasks} pending and ${metrics.delayed_tasks} delayed tasks.`}
        actionLabel="Investigate"
        onAction={() => navigate('/projects/SIQ/intelligence')}
      />

      {/* Burndown + AI Prediction */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card
          className="lg:col-span-2"
          title="Active Sprint Burndown"
          icon={<TrendingUp className="w-4 h-4" />}
          action={<span className="role-chip !text-[9px]">SPRINT {charts.sprint_burndown?.length || 7}D</span>}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.sprint_burndown}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--role-border-subtle)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--role-text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--role-text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--role-surface)', border: '1px solid var(--role-border)', borderRadius: '12px', color: 'var(--role-text-heading)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} name="Ideal" dot={false} />
                <Line type="monotone" dataKey="actual" stroke={COLORS[0]} strokeWidth={3} name="Actual" dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <AIDelayPredictionCard projectId={selectedProject} />
      </div>

      {/* Workload + Developer Productivity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <AIWorkloadCard projectId={selectedProject} />

        <Card
          className="lg:col-span-2"
          title="Developer Productivity"
          icon={<Users className="w-4 h-4" />}
          action={
            <Link to="/manager/workload" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: 'var(--role-primary)' }}>
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          {developer_productivity.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--role-text-muted)' }}>No developers assigned to this project yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {developer_productivity.map((dev: any) => (
                <div key={dev.id} className="px-4 py-3.5 rounded-xl" style={{ background: 'var(--role-bg-muted)', border: '1px solid var(--role-border-subtle)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <InitialsAvatar name={dev.name} role="developer" size={36} style={{ boxShadow: '0 0 0 2px rgba(var(--role-primary-rgb), 0.25)' }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--role-text-heading)' }}>{dev.name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--role-text-muted)' }}>
                        {dev.completed_tasks}/{dev.assigned_tasks} completed
                      </p>
                    </div>
                    <span className="ml-auto text-sm font-bold tabular-nums" style={{ color: 'var(--role-primary)' }}>
                      {dev.completion_rate}%
                    </span>
                  </div>
                  <ProgressBar value={dev.completion_rate} size="sm" tone="role" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Assigned Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="role-section-title flex items-center gap-2">
            <FolderKanban className="w-5 h-5" style={{ color: 'var(--role-primary)' }} /> Active Projects
          </h2>
          <Link to="/manager/projects" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: 'var(--role-primary)' }}>
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {projects.length === 0 ? (
          <Card><p className="text-sm" style={{ color: 'var(--role-text-muted)' }}>No projects assigned yet.</p></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p: any) => (
              <Card key={p.id} hoverEffect className="!p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="role-chip font-mono">{p.key}</span>
                  <Badge variant={healthVariant(p.health_status)}>{p.health_status}</Badge>
                </div>
                <h3 className="role-card-title truncate">{p.name}</h3>
                <div className="mt-4 pt-3 space-y-3" style={{ borderTop: '1px solid var(--role-border-subtle)' }}>
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span style={{ color: 'var(--role-text-muted)' }}>Sprint progress</span>
                      <span className="font-semibold" style={{ color: 'var(--role-primary)' }}>{p.total_tasks ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0}%</span>
                    </div>
                    <ProgressBar value={p.total_tasks ? (p.completed_tasks / p.total_tasks) * 100 : 0} size="sm" />
                  </div>
                  <Link to={`/manager/projects/${p.id}/team`}>
                    <Button size="sm" className="w-full" icon={<ArrowRight className="w-3.5 h-3.5" />}>Open Project</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* GitHub Engineering strip */}
      {github && gSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {ghStats.map((s) => (
            <MetricCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
          ))}
        </div>
      )}

      <AIMeetingMinutesModal
        isOpen={isMeetingModalOpen}
        onClose={() => setIsMeetingModalOpen(false)}
        projectId={selectedProject}
      />
    </div>
  );
};