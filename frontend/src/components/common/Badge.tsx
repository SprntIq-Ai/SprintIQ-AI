import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'healthy' | 'at_risk' | 'critical' | 'completed' | 'in_progress' | 'pending' | 'admin' | 'manager' | 'developer' | 'role' | 'ai' | 'excellent' | 'good' | 'needs_attention' | 'default';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '' }) => {
  // Semantic status badges — these keep fixed colors for accessibility (light surfaces)
  const staticVariants: Record<string, string> = {
    healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    excellent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    good: 'bg-teal-50 text-teal-700 border-teal-200',
    needs_attention: 'bg-amber-50 text-amber-700 border-amber-200',
    at_risk: 'bg-amber-50 text-amber-700 border-amber-200',
    critical: 'bg-rose-50 text-rose-700 border-rose-200',
    completed: 'bg-teal-50 text-teal-700 border-teal-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    pending: 'bg-slate-100 text-slate-600 border-slate-200',
    default: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  // Role-aware badges use CSS variables
  const isRoleBadge = variant === 'admin' || variant === 'manager' || variant === 'developer' || variant === 'role' || variant === 'ai';

  if (isRoleBadge) {
    const isAi = variant === 'ai';
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}
        style={
          isAi
            ? { backgroundColor: 'var(--role-ai-light)', borderColor: 'rgba(var(--role-ai-rgb), 0.30)', color: 'var(--role-ai)' }
            : { backgroundColor: 'var(--role-badge-bg)', borderColor: 'var(--role-badge-border)', color: 'var(--role-badge-text)' }
        }
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${staticVariants[variant] || staticVariants.default} ${className}`}
    >
      {children}
    </span>
  );
};