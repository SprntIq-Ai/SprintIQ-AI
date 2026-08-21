import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'admin' | 'manager' | 'developer' | 'primary' | 'action' | 'ai' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  style,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-2xl font-semibold',
  };

  // Role-specific variants use CSS variables via inline styles
  // Generic variants use Tailwind classes
  const isRoleVariant = variant === 'admin' || variant === 'manager' || variant === 'developer' || variant === 'primary' || variant === 'action' || variant === 'ai';

  const staticVariantClasses: Record<string, string> = {
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900',
    ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25',
  };

  const getRoleStyle = (): React.CSSProperties => {
    if (!isRoleVariant) return {};

    if (variant === 'ai') {
      return {
        backgroundColor: 'var(--role-ai)',
        color: '#ffffff',
        boxShadow: '0 4px 14px rgba(var(--role-ai-rgb), 0.24)',
        border: '1px solid rgba(var(--role-ai-rgb), 0.30)',
        fontWeight: 700,
      };
    }

    if (variant === 'action') {
      return {
        backgroundColor: 'var(--role-action)',
        color: '#ffffff',
        boxShadow: '0 4px 14px rgba(var(--role-action-rgb), 0.22)',
        border: '1px solid rgba(var(--role-action-rgb), 0.30)',
        fontWeight: 600,
      };
    }

    if (variant === 'manager') {
      return {
        background: 'linear-gradient(to right, var(--role-primary), var(--role-action))',
        color: '#ffffff',
        boxShadow: '0 4px 14px rgba(var(--role-primary-rgb), 0.22)',
        border: '1px solid rgba(var(--role-action-rgb), 0.35)',
        fontWeight: 700,
      };
    }

    return {
      backgroundColor: 'var(--role-primary)',
      color: 'var(--role-btn-text, #ffffff)',
      boxShadow: '0 4px 14px rgba(var(--role-primary-rgb), 0.22)',
      border: '1px solid rgba(var(--role-primary-rgb), 0.30)',
      fontWeight: 600,
    };
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 ${sizeClasses[size]} ${isRoleVariant ? '' : staticVariantClasses[variant] || ''
        } ${className}`}
      style={{
        ...getRoleStyle(),
        ...style,
      }}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};