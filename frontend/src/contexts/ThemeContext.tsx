import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { RoleType } from '../types';

/* ============================================
   ThemeContext — Global SprintIQ Theme
   SprintIQ has ONE visual identity for every
   role (Sky Blue + White + Dark Navy + Purple AI).
   RBAC controls features/data — NOT colors.
   ============================================ */

export const SPRINTIQ_THEME_CLASS = 'sprintiq-theme';

/* Single global palette used by all roles */
export const GLOBAL_CHART_COLORS = [
  '#38BDF8', // Sky Blue — primary
  '#7C3AED', // Purple — AI
  '#172033', // Dark Navy — structure
  '#0EA5E9', // Strong Sky Blue
  '#BAE6FD', // Light Sky Blue
  '#C4B5FD', // Light Purple
];

export interface RoleThemeTokens {
  name: string;
  themeClass: string;

  /* Tailwind-compatible utility strings */
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  actionColor: string;

  /* Badge */
  badgeBg: string;
  badgeText: string;

  /* Sidebar */
  sidebarBg: string;
  sidebarActiveBg: string;
  sidebarText: string;

  /* Buttons */
  primaryBg: string;
  primaryHover: string;

  /* Gradient text */
  gradientText: string;

  /* Card border */
  cardBorder: string;

  /* Chart colors array */
  chartColors: string[];

  /* Login page glow color (bg class) */
  loginGlowColor: string;
  loginBorderColor: string;
  loginGradientFrom: string;
  loginGradientTo: string;
  loginFocusColor: string;
  loginCheckboxColor: string;
  loginForgotColor: string;
  loginPortalLinkColors: { admin: string; manager: string; developer: string };
}

/* Every role resolves to the SAME global SprintIQ identity */
const GLOBAL_THEME_TOKENS: Omit<RoleThemeTokens, 'name'> = {
  themeClass: SPRINTIQ_THEME_CLASS,
  primaryColor: '#38BDF8',
  secondaryColor: '#0EA5E9',
  accentColor: '#38BDF8',
  actionColor: '#0EA5E9',
  badgeBg: 'bg-[rgba(var(--role-primary-rgb),0.10)] border-[rgba(var(--role-primary-rgb),0.22)]',
  badgeText: 'text-[var(--role-badge-text)]',
  sidebarBg: 'role-sidebar',
  sidebarActiveBg: 'role-sidebar-item-active',
  sidebarText: 'role-sidebar-item',
  primaryBg: 'role-btn-primary',
  primaryHover: 'hover:brightness-110',
  gradientText: 'from-[#38BDF8] via-[#0EA5E9] to-[#7C3AED]',
  cardBorder: 'border-[var(--role-border)]',
  chartColors: GLOBAL_CHART_COLORS,
  loginGlowColor: 'bg-[#38BDF8]/10',
  loginBorderColor: 'border-[#38BDF8]/30',
  loginGradientFrom: '#0EA5E9',
  loginGradientTo: '#38BDF8',
  loginFocusColor: 'focus:border-[#38BDF8]',
  loginCheckboxColor: 'text-[#38BDF8]',
  loginForgotColor: 'text-[#0EA5E9]',
  loginPortalLinkColors: { admin: 'text-[#334155]', manager: 'text-[#7C3AED]', developer: 'text-[#38BDF8]' },
};

export const ROLE_THEME_MAP: Record<RoleType, RoleThemeTokens> = {
  admin: { name: 'SprintIQ Admin Workspace', ...GLOBAL_THEME_TOKENS },
  manager: { name: 'SprintIQ Manager Workspace', ...GLOBAL_THEME_TOKENS },
  developer: { name: 'SprintIQ Developer Workspace', ...GLOBAL_THEME_TOKENS },
};

interface ThemeContextType {
  theme: RoleThemeTokens;
  themeClass: string;
  role: RoleType;
  chartColors: string[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useAuth();

  const activeRole: RoleType = role || 'developer';

  /* One theme for everyone — role never changes visuals */
  const theme = ROLE_THEME_MAP[activeRole];

  // Apply/remove the single global theme class on <body>
  useEffect(() => {
    const body = document.body;

    // Remove any legacy role theme classes
    body.classList.remove('admin-theme', 'manager-theme', 'developer-theme');

    // Add the unified SprintIQ theme class
    body.classList.add(SPRINTIQ_THEME_CLASS);

    // Cleanup on logout / unmount
    return () => {
      body.classList.remove(SPRINTIQ_THEME_CLASS);
    };
  }, []);

  const value = useMemo(
    () => ({
      theme,
      themeClass: theme.themeClass,
      role: activeRole,
      chartColors: theme.chartColors,
    }),
    [theme, activeRole],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Convenience hook for chart colors
export const useChartColors = (): string[] => {
  const { chartColors } = useTheme();
  return chartColors;
};

// Export the map for direct access where context isn't available (e.g., login pages)
