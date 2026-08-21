import React from 'react';
import { ShieldCheck, Briefcase, Code, User } from 'lucide-react';

interface InitialsAvatarProps {
  name?: string | null;
  role?: 'admin' | 'manager' | 'developer' | string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const ROLE_ICON: Record<string, React.ReactNode> = {
  admin: <ShieldCheck className="w-1/2 h-1/2" />,
  manager: <Briefcase className="w-1/2 h-1/2" />,
  developer: <Code className="w-1/2 h-1/2" />,
};

const getInitials = (name?: string | null): string => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const InitialsAvatar: React.FC<InitialsAvatarProps> = ({
  name,
  role,
  size = 36,
  className = '',
  style,
}) => {
  const initials = getInitials(name);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.36)),
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: '#ffffff',
        background: 'linear-gradient(135deg, var(--role-primary), var(--role-accent))',
        boxShadow: '0 0 0 1.5px rgba(var(--role-primary-rgb), 0.35)',
        ...style,
      }}
    >
      {initials || (role && ROLE_ICON[role]) || <User className="w-1/2 h-1/2" />}
    </span>
  );
};