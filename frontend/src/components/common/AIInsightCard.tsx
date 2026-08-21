import React from 'react';
import { Sparkles, AlertTriangle, AlertOctagon, CheckCircle2, Info, ArrowRight } from 'lucide-react';

export type InsightSeverity = 'info' | 'warning' | 'danger' | 'success';

interface AIInsightCardProps {
  title?: string;
  severity?: InsightSeverity;
  message: React.ReactNode;
  reason?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

const severityConfig: Record<InsightSeverity, { color: string; bg: string; border: string; Icon: React.ElementType }> = {
  info: { color: 'var(--role-ai)', bg: 'rgba(var(--role-ai-rgb), 0.06)', border: 'rgba(var(--role-ai-rgb), 0.20)', Icon: Info },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', Icon: AlertTriangle },
  danger: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', Icon: AlertOctagon },
  success: { color: '#22C55E', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', Icon: CheckCircle2 },
};

export const AIInsightCard: React.FC<AIInsightCardProps> = ({
  title = 'AI Insight',
  severity = 'info',
  message,
  reason,
  actionLabel,
  onAction,
  icon,
  footer,
  className = '',
  compact = false,
}) => {
  const cfg = severityConfig[severity];

  return (
    <div
      className={`rounded-2xl ${compact ? 'p-4' : 'p-5'} ${className}`}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="p-2 rounded-xl shrink-0"
          style={{ background: 'var(--role-surface)', border: `1px solid ${cfg.border}`, color: cfg.color }}
        >
          {icon || <cfg.Icon className="w-4 h-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: cfg.color }}>
            <Sparkles className="w-3 h-3" />
            {title}
          </p>
          <div className="mt-1 text-sm font-semibold leading-snug" style={{ color: 'var(--role-text-heading)' }}>
            {message}
          </div>
          {reason && (
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--role-text-body)' }}>
              {reason}
            </p>
          )}
          {footer && <div className="mt-3">{footer}</div>}
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: 'var(--role-ai)',
                color: '#ffffff',
              }}
            >
              {actionLabel}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};