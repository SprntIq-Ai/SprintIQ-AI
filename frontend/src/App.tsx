import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Components
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { AIChatDrawer } from './components/ai/AIChatDrawer';

// Pages
import { LandingPage } from './pages/LandingPage';
import { AdminLogin } from './pages/auth/AdminLogin';
import { ManagerLogin } from './pages/auth/ManagerLogin';
import { DeveloperLogin } from './pages/auth/DeveloperLogin';
import { AcceptInvite } from './pages/auth/AcceptInvite';
import { GoogleAuthCallback } from './pages/auth/GoogleAuthCallback';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ProjectsManager } from './pages/admin/ProjectsManager';
import { UserManager } from './pages/admin/UserManager';
import { ActivityLogs } from './pages/admin/ActivityLogs';
import { GlobalAIInsights } from './pages/admin/GlobalAIInsights';
import { ReportsPage } from './pages/admin/ReportsPage';
import { SystemSettings } from './pages/admin/SystemSettings';
import { ManagerAccounts } from './pages/admin/ManagerAccounts';

// Manager Pages
import { ManagerDashboard } from './pages/manager/ManagerDashboard';
import { ManagerProjects } from './pages/manager/ManagerProjects';
import { ManagerProjectTeam } from './pages/manager/ManagerProjectTeam';
import { SprintPlanner } from './pages/manager/SprintPlanner';
import { TaskManager } from './pages/manager/TaskManager';
import { TeamWorkload } from './pages/manager/TeamWorkload';
import { TeamVelocityPage } from './pages/manager/TeamVelocityPage';
import { ProjectTimeline } from './pages/manager/ProjectTimeline';
import { ProjectCalendar } from './pages/manager/ProjectCalendar';
import { ReviewQueue } from './pages/manager/ReviewQueue';
import { ManagerReports } from './pages/manager/ManagerReports';
import { ManagerAIHub } from './pages/manager/ManagerAIHub';
import { DeveloperAccounts } from './pages/manager/DeveloperAccounts';

// Intelligence Pages
import { ProjectIntelligence } from './pages/projects/ProjectIntelligence';
import { AIInsightsPage } from './pages/projects/AIInsightsPage';
import { GitHubAnalyticsPage } from './pages/projects/GitHubAnalyticsPage';
import { GitHubEngineeringAnalytics } from './pages/projects/GitHubEngineeringAnalytics';
import { ReleaseReadinessPage } from './pages/projects/ReleaseReadinessPage';
import { SprintRetrospectivePage } from './pages/projects/SprintRetrospectivePage';
import { WhatIfSimulatorPage } from './pages/projects/WhatIfSimulatorPage';

// Developer Pages
import { DeveloperDashboard } from './pages/developer/DeveloperDashboard';
import { MyTasks } from './pages/developer/MyTasks';
import { FocusMode } from './pages/developer/FocusMode';
import { LeaderboardPage } from './pages/developer/LeaderboardPage';
import { DeveloperSprints } from './pages/developer/DeveloperSprints';
import { DeveloperAIAssistant } from './pages/developer/DeveloperAIAssistant';
import { NotificationsPage } from './pages/developer/NotificationsPage';


import { ErrorBoundary } from './components/common/ErrorBoundary';

const ProtectedLayout: React.FC<{ allowedRole: 'admin' | 'manager' | 'developer' | 'shared' }> = ({ allowedRole }) => {
  const { isAuthenticated, role, isLoading } = useAuth();
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen role-page-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[var(--role-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono" style={{ color: 'var(--role-text-muted)' }}>Verifying Session Security...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Shared routes have no single role portal; send unauthenticated users to the landing page.
    return <Navigate to={allowedRole === 'shared' ? '/' : `/login/${allowedRole}`} replace />;
  }

  if (allowedRole !== 'shared' && role !== allowedRole) {
    return <Navigate to={`/login/${allowedRole}`} replace />;
  }

  return (
    <div className="min-h-screen role-page-bg flex">
      <Sidebar mobileOpen={isSidebarOpen} onMobileClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <Header
          onOpenAIChat={() => setIsAIChatOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <AIChatDrawer isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <Router>
            <Routes>
              {/* Public Landing & Login Portals */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login/admin" element={<AdminLogin />} />
              <Route path="/login/manager" element={<ManagerLogin />} />
              <Route path="/login/developer" element={<DeveloperLogin />} />
              <Route path="/register/accept-invite" element={<AcceptInvite />} />
              <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />

              {/* Admin Portal Protected Routes */}
              <Route element={<ProtectedLayout allowedRole="admin" />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/projects" element={<ProjectsManager />} />
                <Route path="/admin/managers" element={<UserManager />} />
                <Route path="/admin/logs" element={<ActivityLogs />} />
                <Route path="/admin/ai-insights" element={<GlobalAIInsights />} />
                <Route path="/admin/reports" element={<ReportsPage />} />
                <Route path="/admin/settings" element={<SystemSettings />} />
                <Route path="/admin/manager-accounts" element={<ManagerAccounts />} />
                <Route path="/projects/:id/sprints/:sprintId/retrospective" element={<SprintRetrospectivePage />} />
                <Route path="/projects/:id/simulator" element={<WhatIfSimulatorPage />} />
              </Route>

              {/* Manager Portal Protected Routes */}
              <Route element={<ProtectedLayout allowedRole="manager" />}>
                <Route path="/manager/dashboard" element={<ManagerDashboard />} />
                <Route path="/manager/projects" element={<ManagerProjects />} />
                <Route path="/manager/projects/:projectId/team" element={<ManagerProjectTeam />} />
                <Route path="/manager/sprints" element={<SprintPlanner />} />
                <Route path="/manager/tasks" element={<TaskManager />} />
                <Route path="/manager/workload" element={<TeamWorkload />} />
                <Route path="/manager/developers" element={<DeveloperAccounts />} />
                <Route path="/manager/velocity" element={<TeamVelocityPage />} />
                <Route path="/manager/timeline" element={<ProjectTimeline />} />
                <Route path="/manager/calendar" element={<ProjectCalendar />} />
                <Route path="/manager/reviews" element={<ReviewQueue />} />
                <Route path="/manager/reports" element={<ManagerReports />} />
                <Route path="/manager/ai-hub" element={<ManagerAIHub />} />
                <Route path="/projects/:id/sprints/:sprintId/retrospective" element={<SprintRetrospectivePage />} />
                <Route path="/projects/:id/simulator" element={<WhatIfSimulatorPage />} />
              </Route>

              {/* Developer Portal Protected Routes */}
              <Route element={<ProtectedLayout allowedRole="developer" />}>
                <Route path="/developer/dashboard" element={<DeveloperDashboard />} />
                <Route path="/developer/tasks" element={<MyTasks />} />
                <Route path="/developer/focus-mode" element={<FocusMode />} />
                <Route path="/developer/leaderboard" element={<LeaderboardPage />} />
                <Route path="/developer/sprints" element={<DeveloperSprints />} />
                <Route path="/developer/ai-assistant" element={<DeveloperAIAssistant />} />
                <Route path="/developer/notifications" element={<NotificationsPage />} />
              </Route>

              {/* Shared Project & Analytics Routes — accessible with ANY authenticated role (no role-based login redirect) */}
              <Route element={<ProtectedLayout allowedRole="shared" />}>
                <Route path="/projects/github-analytics" element={<GitHubEngineeringAnalytics />} />
                <Route path="/projects/:id/intelligence" element={<ProjectIntelligence />} />
                <Route path="/projects/:id/ai-insights" element={<AIInsightsPage />} />
                <Route path="/projects/:id/github" element={<GitHubAnalyticsPage />} />
                <Route path="/projects/:id/release-readiness" element={<ReleaseReadinessPage />} />
              </Route>


              {/* Fallback Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
