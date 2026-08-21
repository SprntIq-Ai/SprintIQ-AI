import React from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  badge,
  actions,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="role-label mb-1.5 flex items-center gap-2">
            {eyebrow}
            <span className="w-6 h-px" style={{ background: 'var(--role-primary)' }} />
          </p>
        )}
        <h1 className="role-page-title flex items-center gap-3 flex-wrap">
          {title}
          {badge}
        </h1>
        {subtitle && <p className="role-muted mt-1.5 leading-relaxed max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
};