import React, { useEffect, useState } from 'react';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { MetricCard } from '../../components/common/MetricCard';
import { ProgressBar } from '../../components/common/ProgressBar';
import { PageHeader } from '../../components/common/PageHeader';
import { AIInsightCard } from '../../components/common/AIInsightCard';
import { adminService, githubService } from '../../services/api';
import {
  FolderKanban, UserCheck, Users, CheckCircle2, Clock, AlertTriangle,
  Activity, Sparkles, TrendingUp, ShieldCheck, ShieldAlert, ShieldX, GitCommit
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useChartColors } from '../../contexts/ThemeContext';

const healthVariant = (h: string) => {
  const s = (h || '').toLowerCase();
  if (s === 'healthy') return 'healthy' as const;
  if (s === 'at_risk') return 'at_risk' as const;
  return 'critical' as const;
};

export const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [github, setGithub] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const COLORS = useChartColors();

  useEffect(() => {
    adminService.getDashboard().then((res) => {
      setData(res);
      setIsLoading(false);
    }).catch((err) => {
      console.error(err);
      setIsLoading(false);
    });

    adminService.getProjects()
      .then((res) => setProjects(res || []))
      .catch(() => setProjects([]));

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2].map((i) => <div key={i} className="h-64 role-skeleton rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const { metrics, charts, recent_activities } = data;

  // Project health distribution from real project data
  const healthyCount = projects.filter((p) => (p.health_status || '').toUpperCase() === 'HEALTHY').length;
  const atRiskCount = projects.filter((p) => (p.health_status || '').toUpperCase() === 'AT_RISK').length;
  const criticalCount = projects.filter((p) => (p.health_status || '').toUpperCase() === 'CRITICAL').length;

  // Merge GitHub comparison activity into projects
  const comparison = (github?.comparison || []) as Array<{ project_id: string; commits: number }>;
  const commitsByProject = new Map(comparison.map((c) => [c.project_id, c.commits]));
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;

  const perfRows = projects.slice(0, 8).map((p) => ({
    ...p,
    progressPct: p.total_tasks ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0,
    githubCommits: commitsByProject.get(p.id) ?? null,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        eyebrow="Admin · Organization Governance"
        title="Organization Overview"
        badge={<Badge variant="admin">Admin</Badge>}
        subtitle="Enterprise-wide engineering governance, project health and AI-driven delivery intelligence."
        actions={
          <span className="role-chip"><ShieldCheck className="w-3.5 h-3.5" /> Enterprise Governance</span>
        }
      />

      {/* Organization Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard label="Total Projects" value={metrics.total_projects} icon={<FolderKanban className="w-5 h-5" />} hint="across org" />
        <MetricCard label="Project Managers" value={metrics.total_managers} icon={<UserCheck className="w-5 h-5" />} hint="active" />
        <MetricCard label="Developers" value={metrics.total_developers} icon={<Users className="w-5 h-5" />} hint="engineering" />
        <MetricCard
          label="AI Risk Score"
          value={metrics.ai_risk_score}
          icon={<Sparkles className="w-5 h-5" />}
          tone={metrics.ai_risk_score < 30 ? 'success' : metrics.ai_risk_score < 60 ? 'warning' : 'danger'}
          hint="/ 100"
        />
      </div>

      {/* Project Health Distribution */}
      <div>
        <h2 className="role-section-title mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" style={{ color: 'var(--role-primary)' }} /> Project Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <MetricCard
            label="Healthy"
            value={healthyCount}
            icon={<ShieldCheck className="w-5 h-5" />}
            tone="success"
            hint="on track"
            className="border-t-[3px] !border-t-emerald-400"
          />
          <MetricCard
            label="At Risk"
            value={atRiskCount}
            icon={<ShieldAlert className="w-5 h-5" />}
            tone="warning"
            hint="needs watch"
            className="border-t-[3px] !border-t-amber-400"
          />
          <MetricCard
            label="Critical"
            value={criticalCount}
            icon={<ShieldX className="w-5 h-5" />}
            tone="danger"
            hint="intervene"
            className="border-t-[3px] !border-t-rose-400"
          />
        </div>
      </div>

      {/* AI Governance Insight */}
      <AIInsightCard
        severity={criticalCount > 0 ? 'danger' : atRiskCount > 0 ? 'warning' : 'success'}
        title="AI Governance Insight"
        message={
          criticalCount > 0
            ? `${criticalCount} project(s) are in critical health and require immediate intervention.`
            : atRiskCount > 0
            ? `${atRiskCount} project(s) are showing early signs of delivery risk.`
            : 'Organization-wide engineering health is stable.'
        }
        reason={`${healthyCount} healthy · ${atRiskCount} at risk · ${criticalCount} critical across ${projects.length} tracked projects. Overall completion rate is ${metrics.project_completion_rate}%.`}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Project Status Distribution" icon={<FolderKanban className="w-4 h-4" />}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.project_status}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="var(--role-surface)"
                >
                  {charts.project_status.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--role-surface)', border: '1px solid var(--role-border)', borderRadius: '12px', color: 'var(--role-text-heading)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
            {charts.project_status.map((s: any, i: number) => (
              <span key={s.name} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--role-text-muted)' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {s.name} · <b style={{ color: 'var(--role-text-heading)' }}>{s.value}</b>
              </span>
            ))}
          </div>
        </Card>

        <Card title="Task Status Distribution" icon={<Activity className="w-4 h-4" />}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.task_distribution} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--role-border-subtle)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--role-text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--role-text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(var(--role-primary-rgb), 0.06)' }}
                  contentStyle={{ background: 'var(--role-surface)', border: '1px solid var(--role-border)', borderRadius: '12px', color: 'var(--role-text-heading)' }}
                />
                <Bar dataKey="count" fill={COLORS[0]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Engineering Performance Table */}
      <Card
        title="Engineering Performance"
        icon={<TrendingUp className="w-4 h-4" />}
        action={<span className="role-chip !text-[9px]">{activeProjects} active projects</span>}
        noPadding
        bodyClassName=""
      >
        <div className="role-data-table-wrap !border-x-0 !border-b-0 !rounded-none">
          <table className="role-data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Health</th>
                <th>Progress</th>
                <th>AI Risk</th>
                <th>GitHub Activity</th>
              </tr>
            </thead>
            <tbody>
              {perfRows.length === 0 && (
                <tr><td colSpan={5} className="!text-center" style={{ color: 'var(--role-text-muted)' }}>No projects found.</td></tr>
              )}
              {perfRows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="role-chip font-mono !text-[10px]">{p.key}</span>
                      <span className="font-semibold" style={{ color: 'var(--role-text-heading)' }}>{p.name}</span>
                    </div>
                  </td>
                  <td><Badge variant={healthVariant(p.health_status)}>{p.health_status}</Badge></td>
                  <td>
                    <div className="flex items-center gap-2.5 min-w-[140px]">
                      <ProgressBar value={p.progressPct} size="sm" className="flex-1" />
                      <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--role-text-heading)' }}>{p.progressPct}%</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className="text-[11px] font-bold tabular-nums px-2 py-1 rounded-lg"
                      style={{
                        backgroundColor: p.ai_risk_score < 30 ? 'rgba(34,197,94,0.10)' : p.ai_risk_score < 60 ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.10)',
                        color: p.ai_risk_score < 30 ? '#22C55E' : p.ai_risk_score < 60 ? '#F59E0B' : '#EF4444',
                      }}
                    >
                      {p.ai_risk_score}
                    </span>
                  </td>
                  <td>
                    {p.githubCommits !== null ? (
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--role-text-body)' }}>
                        <GitCommit className="w-3.5 h-3.5" style={{ color: 'var(--role-primary)' }} />
                        <b className="tabular-nums" style={{ color: 'var(--role-text-heading)' }}>{p.githubCommits.toLocaleString()}</b> commits
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: 'var(--role-text-muted)' }}>No repo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Completion + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <MetricCard
          label="Task Completion Rate"
          value={`${metrics.project_completion_rate}%`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="success"
          footer={
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--role-text-muted)' }}><Clock className="w-3 h-3 inline mr-1" />Pending</span>
                <b className="tabular-nums" style={{ color: 'var(--role-text-heading)' }}>{metrics.pending_tasks}</b>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--role-text-muted)' }}><AlertTriangle className="w-3 h-3 inline mr-1" />Delayed</span>
                <b className="tabular-nums" style={{ color: '#EF4444' }}>{metrics.delayed_tasks}</b>
              </div>
            </div>
          }
        />

        <Card
          className="lg:col-span-2"
          title="Recent System Audit Logs"
          icon={<Activity className="w-4 h-4" />}
        >
          <div className="space-y-2.5">
            {recent_activities.map((act: any) => (
              <div key={act.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl" style={{ background: 'var(--role-bg-muted)', border: '1px solid var(--role-border-subtle)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--role-primary)' }} />
                  <span className="text-xs font-semibold truncate" style={{ color: 'var(--role-text-heading)' }}>{act.user_name}</span>
                  <span className="text-xs font-mono truncate" style={{ color: 'var(--role-text-muted)' }}>{act.action}</span>
                </div>
                <span className="text-[11px] shrink-0" style={{ color: 'var(--role-text-muted)' }}>
                  {new Date(act.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};