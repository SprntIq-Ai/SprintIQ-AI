import React, { useEffect, useState } from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { ProgressBar } from '../common/ProgressBar';
import { Sparkles, Activity, AlertTriangle, CheckCircle2, Clock, Bug, TrendingUp } from 'lucide-react';
import { aiService } from '../../services/api';
import { ProjectHealthData } from '../../types';

interface AIHealthScoreCardProps {
  projectId?: string;
  className?: string;
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Excellent': return 'excellent' as const;
    case 'Good': return 'good' as const;
    case 'Needs Attention': return 'needs_attention' as const;
    case 'Critical': return 'critical' as const;
    default: return 'healthy' as const;
  }
};

const getScoreTone = (score: number) => {
  if (score >= 85) return 'success' as const;
  if (score >= 70) return 'info' as const;
  if (score >= 50) return 'warning' as const;
  return 'danger' as const;
};

const getScoreColor = (score: number): React.CSSProperties => {
  if (score >= 85) return { color: '#22C55E', borderColor: 'rgba(34,197,94,0.30)', backgroundColor: 'rgba(34,197,94,0.08)' };
  if (score >= 70) return { color: '#0ea5e9', borderColor: 'rgba(14,165,233,0.30)', backgroundColor: 'rgba(14,165,233,0.08)' };
  if (score >= 50) return { color: '#f59e0b', borderColor: 'rgba(245,158,11,0.30)', backgroundColor: 'rgba(245,158,11,0.08)' };
  return { color: '#EF4444', borderColor: 'rgba(239,68,68,0.30)', backgroundColor: 'rgba(239,68,68,0.08)' };
};

export const AIHealthScoreCard: React.FC<AIHealthScoreCardProps> = ({ projectId, className = '' }) => {
  const [healthData, setHealthData] = useState<ProjectHealthData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchHealth = async () => {
      setIsLoading(true);
      try {
        const res = await aiService.getHealthScore(projectId);
        setHealthData(res);
      } catch (e) {
        console.error("Health score fetch failed:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHealth();
  }, [projectId]);

  if (isLoading || !healthData) {
    return (
      <Card className={className}>
        <div className="space-y-3">
          <div className="h-8 w-48 role-skeleton rounded-xl" />
          <div className="h-16 role-skeleton rounded-xl" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 role-skeleton rounded-xl" />)}
          </div>
        </div>
      </Card>
    );
  }

  const score = healthData.health_score;
  const tone = getScoreTone(score);

  const factors = [
    { label: 'Completed', value: `${healthData.completed_tasks} Tasks`, icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-emerald-600' },
    { label: 'Delayed', value: `${healthData.delayed_tasks} Tasks`, icon: <AlertTriangle className="w-3 h-3" />, color: 'text-rose-600' },
    { label: 'Bugs', value: `${healthData.bug_count} Open`, icon: <Bug className="w-3 h-3" />, color: 'text-amber-600' },
    { label: 'Sprint Progress', value: `${healthData.sprint_progress}%`, icon: <TrendingUp className="w-3 h-3" />, color: 'text-sky-600' },
    { label: 'Team Velocity', value: `${healthData.team_productivity}%`, icon: <Activity className="w-3 h-3" />, color: 'text-violet-600' },
    { label: 'Deadline Status', value: healthData.deadline_status, icon: <Clock className="w-3 h-3" />, color: 'text-slate-600' },
  ];

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--role-ai)' }} />
          Engineering Health
        </span>
      }
      icon={<Activity className="w-4 h-4" />}
      action={
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl border flex items-center gap-2" style={getScoreColor(score)}>
            <span className="text-xl font-black font-mono tabular-nums">{score}</span>
            <span className="text-[10px] font-medium">/ 100</span>
          </div>
          <Badge variant={getStatusVariant(healthData.health_status)} className="px-2.5 py-1">
            {healthData.health_status}
          </Badge>
        </div>
      }
      className={className}
    >
      {/* Score + progress */}
      <div className="flex items-center gap-5 flex-wrap">
        <ProgressBar value={score} tone={tone} size="lg" showValue className="flex-1 min-w-[220px]" />
      </div>
      <p className="role-muted mt-2">
        Calculated using completed/delayed tasks, bugs, sprint progress and team productivity.
      </p>

      {/* 6 Factor Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
        {factors.map((f) => (
          <div key={f.label} className="px-3 py-3 rounded-xl" style={{ background: 'var(--role-bg-muted)', border: '1px solid var(--role-border-subtle)' }}>
            <p className="role-label !text-[9px] flex items-center gap-1 mb-1">
              <span className={f.color}>{f.icon}</span> {f.label}
            </p>
            <p className="text-sm font-bold truncate" style={{ color: 'var(--role-text-heading)' }}>{f.value}</p>
          </div>
        ))}
      </div>

      {/* AI Explanation */}
      <div
        className="mt-4 px-4 py-3.5 rounded-xl flex items-start gap-3"
        style={{ background: 'rgba(var(--role-ai-rgb), 0.05)', border: '1px solid rgba(var(--role-ai-rgb), 0.18)' }}
      >
        <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--role-ai)' }} />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5" style={{ color: 'var(--role-ai)' }}>
            <span className="role-ai-chip !text-[9px] !px-2 !py-px">GEMINI AI</span> Executive Explanation
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--role-text-body)' }}>{healthData.ai_explanation}</p>
        </div>
      </div>
    </Card>
  );
};