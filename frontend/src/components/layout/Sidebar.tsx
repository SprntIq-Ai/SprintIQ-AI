import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, UserCheck, Activity,
  FileText, Sparkles, Settings, GitPullRequest, ListTodo, Layers, Bell, LogOut, Bot,
  Timer, Award, LineChart, Flame, Cpu, X, ShieldCheck, UsersRound
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { InitialsAvatar } from '../common/InitialsAvatar';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const ROLE_BADGE_LABEL: Record<string, string> = {
  admin: 'ADMIN',
  manager: 'PROJECT MANAGER',
  developer: 'DEVELOPER',
};

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onMobileClose }) => {
  const { user, role, logout } = useAuth();
  const activeRole = role || 'developer';

  const sections = role === 'admin'
    ? [
      {
        label: 'Overview',
        links: [
          { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ],
      },
      {
        label: 'Intelligence',
        links: [
          { to: '/projects/SIQ/intelligence', label: 'Project Intelligence', icon: Cpu },
          { to: '/projects/github-analytics', label: 'GitHub Engineering', icon: GitPullRequest },
          { to: '/admin/ai-insights', label: 'AI Risk Engine', icon: Sparkles },
        ],
      },
      {
        label: 'Governance',
        links: [
          { to: '/admin/projects', label: 'Projects', icon: FolderKanban },
          { to: '/admin/managers', label: 'Project Managers', icon: UserCheck },
          { to: '/admin/logs', label: 'Activity Timeline', icon: Activity },
          { to: '/admin/reports', label: 'Executive Reports', icon: FileText },
          { to: '/admin/settings', label: 'System Settings', icon: Settings },
        ],
      },
      {
        label: 'Team Management',
        links: [
          { to: '/admin/manager-accounts', label: 'Manager Accounts', icon: UsersRound },
        ],
      },
    ]
    : role === 'manager'
      ? [
        {
          label: 'Overview',
          links: [
            { to: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          ],
        },
        {
          label: 'Intelligence',
          links: [
            { to: '/projects/SIQ/intelligence', label: 'Project Intelligence', icon: Cpu },
            { to: '/projects/github-analytics', label: 'GitHub Engineering', icon: GitPullRequest },
            { to: '/manager/ai-hub', label: 'AI Intelligence Hub', icon: Sparkles },
          ],
        },
        {
          label: 'Management',
          links: [
            { to: '/manager/projects', label: 'Assigned Projects', icon: FolderKanban },
            { to: '/manager/sprints', label: 'AI Sprint Planner', icon: Layers },
            { to: '/manager/tasks', label: 'Task Management', icon: ListTodo },
            { to: '/manager/workload', label: 'Workload Heatmap', icon: Flame },
            { to: '/manager/reviews', label: 'Review Submissions', icon: GitPullRequest },
            { to: '/manager/reports', label: 'Sprint Reports', icon: FileText },
          ],
        },
        {
          label: 'Team Management',
          links: [
            { to: '/manager/developers', label: 'Developer Accounts', icon: UsersRound },
          ],
        },
      ]
      : [
        {
          label: 'Overview',
          links: [
            { to: '/developer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          ],
        },
        {
          label: 'Intelligence',
          links: [
            { to: '/projects/SIQ/intelligence', label: 'Project Intelligence', icon: Cpu },
            { to: '/projects/github-analytics', label: 'GitHub Engineering', icon: GitPullRequest },
            { to: '/developer/ai-assistant', label: 'Gemini AI Copilot', icon: Bot },
          ],
        },
        {
          label: 'My Work',
          links: [
            { to: '/developer/tasks', label: 'Assigned Tasks', icon: ListTodo },
            { to: '/developer/sprints', label: 'Active Sprint', icon: Layers },
          ],
        },
        {
          label: 'Engagement',
          links: [
            { to: '/developer/focus-mode', label: 'Focus Mode', icon: Timer },
            { to: '/developer/leaderboard', label: 'Leaderboard', icon: Award },
            { to: '/developer/notifications', label: 'Notifications', icon: Bell },
          ],
        },
      ];

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          w-64 h-screen fixed left-0 top-0 z-50 flex flex-col
          transition-transform duration-300 ease-out
          lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background: 'var(--role-sidebar-bg)',
          borderRight: '1px solid var(--role-sidebar-border)',
        }}
        aria-label="Sidebar navigation"
      >
        {/* Brand Header */}
        <div
          className="px-5 py-5 flex items-center gap-3"
          style={{ borderBottom: '1px solid var(--role-sidebar-border)' }}
        >
          <div
            className="p-2.5 rounded-xl shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--role-primary), var(--role-action))',
              boxShadow: '0 4px 12px var(--role-glow)',
            }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-1.5" style={{ color: 'var(--role-sidebar-heading)' }}>
              SprintIQ
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{
                  backgroundColor: 'var(--role-badge-bg)',
                  border: '1px solid var(--role-badge-border)',
                  color: 'var(--role-badge-text)',
                }}
              >
                AI
              </span>
            </h1>
            <p className="text-[10px] font-semibold tracking-widest uppercase mt-1" style={{ color: 'var(--role-primary)' }}>
              {ROLE_BADGE_LABEL[activeRole] || 'PORTAL'}
            </p>
          </div>
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--role-text-muted)' }}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5" aria-label="Main navigation">
          {sections.map((section) => (
            <div key={section.label}>
              <p
                className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--role-text-muted)' }}
              >
                {section.label}
              </p>
              <div className="space-y-1">
                {section.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.to.endsWith('/dashboard')}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${isActive ? 'role-sidebar-item-active' : 'role-sidebar-item'
                        }`
                      }
                      style={({ isActive }) =>
                        isActive
                          ? {
                            backgroundColor: 'var(--role-sidebar-active-bg)',
                            boxShadow: '0 1px 3px var(--role-glow-lg)',
                            color: 'var(--role-sidebar-active-text)',
                          }
                          : { color: 'var(--role-sidebar-text)' }
                      }
                    >
                      <Icon
                        className="w-[18px] h-[18px] shrink-0 transition-colors duration-200"
                        style={{
                          color: 'var(--role-primary)',
                          opacity: 0.9,
                        }}
                      />
                      <span className="truncate">{link.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Profile Footer */}
        <div
          className="px-4 py-4"
          style={{ borderTop: '1px solid var(--role-sidebar-border)', background: 'var(--role-bg-muted)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <InitialsAvatar
                  name={user?.full_name}
                  role={activeRole}
                  size={36}
                  style={{ boxShadow: '0 0 0 2px var(--role-primary)' }}
                />
                <span
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                  style={{ backgroundColor: 'var(--role-success, #22C55E)', borderColor: 'var(--role-sidebar-bg)' }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--role-sidebar-heading)' }}>
                  {user?.full_name || 'User'}
                </p>
                <p className="text-[11px] capitalize truncate flex items-center gap-1" style={{ color: 'var(--role-text-muted)' }}>
                  <ShieldCheck className="w-3 h-3" />
                  {activeRole}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-2 rounded-lg transition-colors duration-200 hover:bg-[var(--role-bg-subtle)]"
              style={{ color: 'var(--role-text-muted)' }}
              aria-label="Logout"
            >
              <LogOut className="w-4.5 h-4.5 w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};