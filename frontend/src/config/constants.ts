import { RoleType } from '../types';

const rawApiUrl = (import.meta as any).env?.VITE_API_URL || '/api';
export const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`;

/* ============================================
   SprintIQ AI — single global identity for all roles.
   RBAC changes features/data, never colors.
   ============================================ */

const GLOBAL_THEME = {
  name: 'SprintIQ AI',
  themeClass: 'sprintiq-theme',
  badgeBg: 'bg-[rgba(var(--role-primary-rgb),0.10)] border-[rgba(var(--role-primary-rgb),0.22)]',
  badgeText: 'text-[var(--role-badge-text)]',
  sidebarBg: 'role-sidebar',
  sidebarActiveBg: 'role-sidebar-item-active',
  sidebarText: 'role-sidebar-item',
  primaryBg: 'role-btn-primary',
  primaryHover: 'hover:brightness-110',
  gradientText: 'from-[#38BDF8] via-[#0EA5E9] to-[#7C3AED]',
  accentColor: '#38BDF8',
  secondaryColor: '#0EA5E9',
  cardBorder: 'border-[var(--role-border)]',
  chartColors: ['#38BDF8', '#7C3AED', '#172033', '#0EA5E9', '#BAE6FD', '#C4B5FD'],
};

export const ROLE_THEMES: Record<RoleType, {
  name: string;
  themeClass: string;
  badgeBg: string;
  badgeText: string;
  sidebarBg: string;
  sidebarActiveBg: string;
  sidebarText: string;
  primaryBg: string;
  primaryHover: string;
  gradientText: string;
  accentColor: string;
  secondaryColor: string;
  cardBorder: string;
  chartColors: string[];
}> = {
  admin: { name: 'SprintIQ Admin Workspace', ...GLOBAL_THEME },
  manager: { name: 'SprintIQ Manager Workspace', ...GLOBAL_THEME },
  developer: { name: 'SprintIQ Developer Workspace', ...GLOBAL_THEME },
};
