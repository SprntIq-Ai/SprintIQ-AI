import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { MetricCard } from '../../components/common/MetricCard';
import { ProgressBar } from '../../components/common/ProgressBar';
import { PageHeader } from '../../components/common/PageHeader';
import { developerService, githubService, aiService } from '../../services/api';
import {
  ListTodo, Calendar, CheckCircle2, TrendingUp, Sparkles, ArrowRight, FolderKanban,
  GitCommit, GitPullRequest, GitBranch, CircleAlert, Clock, Timer, Award, Users
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { useChartColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const DeveloperDashboard: React.FC = () => {
  const COLORS = useChartColors();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [github, setGithub] = useState<any>(null);

  const firstName = user?.full_name?.split(' ')[0] || 'Developer';

  useEffect(() => {
    developerService.getDashboard().then((res) => {
      setData(res);
      setIsLoading(false);
    }).catch((err) => console.error(err));

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
          {[1, 2, 3].map((i) => <div key={i} className="h-64 role-skeleton rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const { metrics, upcoming_deadlines, charts, projects } = data;
  const gSummary = github?.summary;
  const gMetrics = github?.metrics;

  const ghStats = [
    { label: 'Commits', value: gSummary?.commits ?? '—', icon: <GitCommit className="w-4 h-4" /> },
    { label: 'Pull Requests', value: gSummary?.open_prs ?? '—', icon: <GitPullRequest className="w-4 h-4" /> },
    { label: 'Reviews', value: gMetrics?.reviews?.total ?? '—', icon: <Users className="w-4 h-4" /> },
    { label: 'Issues', value: gSummary?.open_issues ?? '—', icon: <CircleAlert className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        eyebrow="Developer Workspace"
        title={`${greeting()}, ${firstName}`}
        badge={<Badge variant="developer">Developer</Badge>}
        subtitle="Execute assigned user stories, update progress, track your sprint velocity, and let AI keep your workflow on track."
        actions={
          <>
            <Link to="/developer/leaderboard">
              <Button variant="outline" icon={<Award className="w-4 h-4" />}>Leaderboard</Button>
            </Link>
            <Link to="/developer/focus-mode">
              <Button icon={<Timer className="w-4 h-4" />}>Focus Mode</Button>
            </Link>
          </>
        }
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          label="Assigned Tasks"
          value={metrics.active_tasks_count ?? metrics.assigned_tasks_count}
          icon={<ListTodo className="w-5 h-5" />}
          hint="active (awaiting approval)"
        />
        <MetricCard
          label="Today's Tasks"
          value={metrics.todays_tasks_count}
          icon={<Calendar className="w-5 h-5" />}
          tone="info"
          hint="due / active"
        />
        <MetricCard
          label="Completed"
          value={metrics.completed_tasks_count}
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="success"
          hint="tasks"
        />
        <MetricCard
          label="Overall Progress"
          value={`${metrics.overall_progress_rate}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          hint="across sprints"
          progress={metrics.overall_progress_rate}
        />
      </div>

      {/* Sprint Progress + AI Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card
          className="lg:col-span-2"
          title="Sprint Progress"
          icon={<TrendingUp className="w-4 h-4" />}
          action={<span className="role-muted">{upcoming_deadlines.length} deadlines ahead</span>}
        >
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex flex-col items-center justify-center w-28 h-28 rounded-2xl shrink-0 border" style={{ background: 'var(--role-bg-subtle)', borderColor: 'var(--role-border-subtle)' }}>
              <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--role-primary)' }}>{metrics.overall_progress_rate}%</span>
              <span className="text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--role-text-muted)' }}>Complete</span>
            </div>
            <div className="flex-1 min-w-[220px] space-y-5">
              <ProgressBar value={metrics.overall_progress_rate} size="lg" showValue label="Sprint completion" />
              <ProgressBar value={metrics.completed_tasks_count} max={Math.max(metrics.assigned_tasks_count, 1)} size="md" label="Tasks completed" />
            </div>
          </div>

          <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--role-border-subtle)' }}>
            <p className="role-label mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" style={{ color: 'var(--role-primary)' }} /> Upcoming Deadlines
            </p>
            {upcoming_deadlines.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--role-text-muted)' }}>No upcoming deadlines. Enjoy the flow.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {upcoming_deadlines.map((t: any) => (
                  <Link
                    key={t.id}
                    to="/developer/tasks"
                    className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 hover:translate-x-0.5"
                    style={{ background: 'var(--role-bg-muted)', border: '1px solid var(--role-border-subtle)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--role-text-heading)' }}>{t.title}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--role-text-muted)' }}>
                        Due {t.due_date} · <span className="font-semibold" style={{ color: 'var(--role-primary)' }}>{t.progress}%</span>
                      </p>
                    </div>
                    <Badge variant={(t.priority || '').toLowerCase() as any}>{t.priority}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        <AIRecommendationsPanel />
      </div>

      {/* My Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="role-section-title flex items-center gap-2">
            <FolderKanban className="w-5 h-5" style={{ color: 'var(--role-primary)' }} /> My Projects
          </h2>
          <div className="flex items-center gap-4">
            <span className="role-muted">{projects?.length ?? 0} project(s)</span>
            <Link to="/developer/projects" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: 'var(--role-primary)' }}>
              View All Projects <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {!projects || projects.length === 0 ? (
          <Card>
            <p className="text-sm" style={{ color: 'var(--role-text-muted)' }}>
              No projects assigned yet. Projects you are added to will appear here.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p: any) => (
              <Link to={`/developer/projects/${p.id}`} key={p.id} className="block group">
                <Card hoverEffect className="!p-5 h-full transition-transform duration-200 group-hover:-translate-y-1">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="role-chip font-mono">{p.key}</span>
                    <Badge variant={(p.status || '').toLowerCase() as any}>{p.status}</Badge>
                  </div>
                  <h3 className="role-card-title truncate group-hover:text-[var(--role-primary)] transition-colors">{p.name}</h3>
                  <p className="role-muted mt-1 truncate">Manager: {p.manager_name || 'Unassigned'}</p>
                  <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--role-border-subtle)' }}>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span style={{ color: 'var(--role-text-muted)' }}>{p.total_tasks ?? 0} assigned tasks</span>
                      <span className="font-semibold" style={{ color: 'var(--role-success, #22C55E)' }}>
                        {p.completed_tasks ?? 0} completed
                      </span>
                    </div>
                    <ProgressBar value={(p.completed_tasks ?? 0)} max={Math.max(p.total_tasks ?? 0, 1)} size="sm" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* GitHub Engineering + Weekly Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card
          className="lg:col-span-1"
          title="GitHub Engineering"
          icon={<GitPullRequest className="w-4 h-4" />}
          action={
            <Link to="/projects/github-analytics" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: 'var(--role-primary)' }}>
              Details <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          {!github ? (
            <p className="text-xs" style={{ color: 'var(--role-text-muted)' }}>GitHub analytics unavailable.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {ghStats.map((s) => (
                <div key={s.label} className="px-3 py-3 rounded-xl" style={{ background: 'var(--role-bg-muted)', border: '1px solid var(--role-border-subtle)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span style={{ color: 'var(--role-primary)' }}>{s.icon}</span>
                    <p className="role-label !text-[9px]">{s.label}</p>
                  </div>
                  <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--role-text-heading)' }}>{s.value}</p>
                </div>
              ))}
              {gSummary?.active_contributors !== undefined && (
                <p className="col-span-2 text-[11px] mt-1" style={{ color: 'var(--role-text-muted)' }}>
                  <span className="font-semibold" style={{ color: 'var(--role-primary)' }}>{gSummary.active_contributors}</span> active contributors · {gSummary.total_branches ?? 0} branches
                </p>
              )}
            </div>
          )}
        </Card>

        <Card
          className="lg:col-span-2"
          title="Weekly Completion Performance"
          icon={<GitCommit className="w-4 h-4" />}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.weekly_performance} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--role-border-subtle)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--role-text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--role-text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(var(--role-primary-rgb), 0.06)' }}
                  contentStyle={{ background: 'var(--role-surface)', border: '1px solid var(--role-border)', borderRadius: '12px', color: 'var(--role-text-heading)' }}
                />
                <Bar dataKey="completed" fill={COLORS[0]} radius={[6, 6, 0, 0]} name="Tasks Completed" />
                <Bar dataKey="in_progress" fill={COLORS[3]} radius={[6, 6, 0, 0]} name="In Progress" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

/* Local AI recommendations panel driven by real risk-prediction data */
const AIRecommendationsPanel: React.FC = () => {
  const [recs, setRecs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiService.getRiskPrediction()
      .then((res) => setRecs(res.ai_recommendations || []))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card title="AI Recommendations" icon={<Sparkles className="w-4 h-4" />} className="!border-[rgba(var(--role-ai-rgb),0.25)]" action={<span className="role-ai-chip !text-[9px]"><Sparkles className="w-3 h-3" /> GEMINI</span>}>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 role-skeleton rounded-xl" />)}
        </div>
      ) : recs.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--role-text-muted)' }}>No AI recommendations right now.</p>
      ) : (
        <div className="space-y-3">
          {recs.slice(0, 4).map((rec, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-3.5 py-3 rounded-xl transition-colors duration-200"
              style={{ background: 'rgba(var(--role-ai-rgb), 0.05)', border: '1px solid rgba(var(--role-ai-rgb), 0.15)' }}
            >
              <span className="p-1.5 rounded-lg shrink-0" style={{ background: 'var(--role-ai-light)', color: 'var(--role-ai)' }}>
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--role-text-body)' }}>{rec}</p>
            </div>
          ))}
          <Link
            to="/developer/ai-assistant"
            className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl transition-colors duration-200"
            style={{ color: 'var(--role-ai)', background: 'rgba(var(--role-ai-rgb), 0.06)', border: '1px solid rgba(var(--role-ai-rgb), 0.20)' }}
          >
            Ask the AI Copilot <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </Card>
  );
};