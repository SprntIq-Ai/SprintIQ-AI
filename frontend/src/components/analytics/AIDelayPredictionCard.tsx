import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { aiService } from '../../services/api';

interface AIDelayPredictionCardProps {
  projectId?: string;
  className?: string;
}

interface RiskData {
  project_name?: string;
  sprint_delay_probability: number;
  project_delay_risk?: string;
  overloaded_developers?: Array<Record<string, any>>;
  high_risk_tasks?: Array<Record<string, any>>;
  critical_bugs?: number;
  ai_recommendations?: string[];
}

const riskVariant = (risk?: string) => {
  const r = (risk || '').toUpperCase();
  if (r === 'LOW') return 'healthy' as const;
  if (r === 'MODERATE' || r === 'MEDIUM') return 'at_risk' as const;
  return 'critical' as const;
};

const riskTone = (prob: number) => {
  if (prob < 30) return 'role' as const;
  if (prob < 60) return 'warning' as const;
  return 'danger' as const;
};

export const AIDelayPredictionCard: React.FC<AIDelayPredictionCardProps> = ({ projectId, className = '' }) => {
  const [data, setData] = useState<RiskData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    aiService.getRiskPrediction(projectId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  if (isLoading || !data) {
    return (
      <Card title="ML Project Delay Prediction" icon={<ShieldAlert className="w-4 h-4" />} className={className}>
        <div className="space-y-3">
          <div className="h-14 role-skeleton rounded-xl" />
          <div className="h-20 role-skeleton rounded-xl" />
        </div>
      </Card>
    );
  }

  const prob = data.sprint_delay_probability ?? 0;
  const riskLabel = data.project_delay_risk || 'LOW';
  const tone = riskTone(prob);
  const highRisk = data.high_risk_tasks || [];

  return (
    <Card
      title="ML Project Delay Prediction"
      icon={<ShieldAlert className="w-4 h-4" />}
      action={<Badge variant={riskVariant(riskLabel)} className="px-2.5 py-1">{riskLabel} Risk</Badge>}
      className={className}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl shrink-0 border"
          style={{
            background: 'var(--role-bg-subtle)',
            borderColor: 'var(--role-border-subtle)',
          }}
        >
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--role-ai)' }}>
            {prob}%
          </span>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--role-text-muted)' }}>
            Delay Risk
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="role-progress-track h-2.5 w-full mb-1.5">
            <div
              className={`role-progress-bar ${tone !== 'role' ? `is-${tone}` : ''}`}
              style={{ width: `${Math.min(100, prob)}%` }}
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--role-text-body)' }}>
            Predicted probability of sprint delivery delay for{' '}
            <span className="font-semibold" style={{ color: 'var(--role-text-heading)' }}>
              {data.project_name || 'current project'}
            </span>.
          </p>
        </div>
      </div>

      {highRisk.length > 0 && (
        <div className="mt-4">
          <p className="role-label mb-2">High Risk Tasks</p>
          <div className="space-y-2">
            {highRisk.slice(0, 3).map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'var(--role-bg-muted)', border: '1px solid var(--role-border-subtle)' }}
              >
                <span className="text-xs font-medium truncate" style={{ color: 'var(--role-text-heading)' }}>
                  {t.task_title || t.title}
                </span>
                <span className="text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  {t.priority || t.risk_factor || 'HIGH'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.ai_recommendations || []).length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--role-border-subtle)' }}>
          <p className="role-label mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" style={{ color: 'var(--role-ai)' }} /> AI Recommendations
          </p>
          <ul className="space-y-1.5">
            {data.ai_recommendations!.slice(0, 3).map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--role-text-body)' }}>
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--role-success, #22C55E)' }} />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};