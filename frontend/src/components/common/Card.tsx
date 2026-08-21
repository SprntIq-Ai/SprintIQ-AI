import React from 'react';

interface CardProps {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  hoverEffect?: boolean;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  icon,
  action,
  children,
  className = '',
  bodyClassName = '',
  hoverEffect = false,
  noPadding = false,
}) => {
  return (
    <div
      className={`role-panel ${hoverEffect ? 'role-hover-lift' : ''} ${className}`}
    >
      {title !== undefined && (
        <div className="role-panel-header">
          <h3 className="role-card-title flex items-center gap-2">
            {icon && <span style={{ color: 'var(--role-primary)' }}>{icon}</span>}
            {title}
          </h3>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? bodyClassName : `role-panel-body ${bodyClassName}`}>{children}</div>
    </div>
  );
};