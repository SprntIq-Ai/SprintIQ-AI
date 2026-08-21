import React from 'react';
import { ProgressBar } from './ProgressBar';

type MetricTone = 'role' | 'success' | 'warning' | 'danger' | 'info';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: MetricTone;
  hint?: React.ReactNode;
  footer?: React.ReactNode;
  progress?: number;
  progressLabel?: string;
  progressTone?: MetricTone;
  accentBorder?: boolean;
  onClick?: () => void;
  className?: string;
}

const toneColor = (tone: MetricTone): React.CSSProperties => {
  switch (tone) {
    case 'success': return { color: 'var(--role-success, #22C55E)' };
    case 'warning': return { color: 'var(--role-warning, #F59E0B)' };
    case 'danger': return { color: 'var(--role-danger, #EF4444)' };
    case 'info': return { color: '#0ea5e9' };
    default: return { color: 'var(--role-primary)' };
  }
};

const toneBg = (tone: MetricTone): React.CSSProperties => {
  switch (tone) {
    case 'success': return { backgroundColor: 'rgba(34,197,94,0.10)', color: '#22C55E', borderColor: 'rgba(34,197,94,0.20)' };
    case 'warning': return { backgroundColor: 'rgba(245,158,11,0.10)', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.20)' };
    case 'danger': return { backgroundColor: 'rgba(239,68,68,0.10)', color: '#EF4444', borderColor: 'rgba(239,68,68,0.20)' };
    case 'info': return { backgroundColor: 'rgba(14,165,233,0.10)', color: '#0ea5e9', borderColor: 'rgba(14,165,233,0.20)' };
    default: return { backgroundColor: 'var(--role-bg-subtle)', color: 'var(--role-primary)', borderColor: 'var(--role-border-subtle)' };
  }
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  tone = 'role',
  hint,
  footer,
  progress,
  progressLabel,
  progressTone,
  accentBorder = false,
  onClick,
  className = '',
}) => {
  return (
    <div
      onClick={onClick}
      className={`role-panel p-5 ${onClick ? 'cursor-pointer role-hover-lift' : ''} ${className}`}
      style={accentBorder ? { borderTop: `3px solid var(--role-primary)` } : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="role-label truncate">{label}</p>
        {icon && (
          <span
            className="p-2.5 rounded-xl border shrink-0"
            style={toneBg(tone)}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="role-metric-value" style={toneColor(tone)}>{value}</span>
        {hint && <span className="role-muted">{hint}</span>}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
      {progress !== undefined && (
        <div className="mt-4">
          <ProgressBar value={progress} tone={progressTone || tone} label={progressLabel} size="md" />
        </div>
      )}
    </div>
  );
};