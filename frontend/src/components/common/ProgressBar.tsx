import React from 'react';

type ProgressTone = 'role' | 'success' | 'warning' | 'danger' | 'info';

interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: ProgressTone;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  tone = 'role',
  label,
  showValue = false,
  size = 'md',
  className = '',
}) => {
  const pct = clamp((value / max) * 100);
  const height = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="role-muted text-[11px] font-medium">{label}</span>}
          {showValue && (
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--role-text-heading)' }}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div className={`role-progress-track w-full ${height}`}>
        <div className={`role-progress-bar ${tone !== 'role' ? `is-${tone}` : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};