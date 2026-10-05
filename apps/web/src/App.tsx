import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { AcceptInvitationPage } from './pages/AcceptInvitationPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { ManagerGovernancePage } from './pages/ManagerGovernancePage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { TasksPage } from './pages/TasksPage';
import { TicketDetailView } from './components/tickets/TicketDetailView';
import { StandupPage } from './pages/StandupPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { MeetingWorkspacePage } from './pages/MeetingWorkspacePage';
import { ProgressPage } from './pages/ProgressPage';
import { ReportsPage } from './pages/ReportsPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { BacklogPage } from './pages/BacklogPage';
import { SprintPlanningPage } from './pages/SprintPlanningPage';
import { KanbanBoardPage } from './pages/KanbanBoardPage';
import { CalendarPage } from './pages/CalendarPage';

import { ControlTowerPage } from './pages/ControlTowerPage';
import { ProjectDecisionsPage } from './pages/ProjectDecisionsPage';
import { RoleCode } from '@workdesk/shared';


const ProtectedRoute: React.FC<{ children: React.ReactElement; requiredRole?: RoleCode }> = ({
  children,
  requiredRole,
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono text-sm">
        Loading WorkDesk...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user account is pending manager approval
  if (user.approvalStatus === 'PENDING') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Manager has full access to governance routes
  if (user.roleCode === RoleCode.ROLE_MANAGER) {
    return children;
  }

  if (requiredRole && user.roleCode !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
          <Route path="/pending-approval" element={<PendingApprovalPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="tasks/:ticketId" element={<TicketDetailView />} />
            <Route path="projects/:projectId/backlog" element={<BacklogPage />} />
            <Route path="projects/:projectId/sprints/:sprintId/planning" element={<SprintPlanningPage />} />
            <Route path="projects/:projectId/boards" element={<KanbanBoardPage />} />
            <Route path="projects/:projectId/boards/:boardId" element={<KanbanBoardPage />} />
            <Route path="standup" element={<StandupPage />} />
            <Route path="meetings" element={<MeetingsPage />} />
            <Route path="meetings/:id/workspace" element={<MeetingWorkspacePage />} />
            <Route path="team/progress" element={<ProgressPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="workload" element={<Navigate to="/dashboard" replace />} />
            <Route path="timeline" element={<Navigate to="/dashboard" replace />} />
            <Route path="projects/:projectId/timeline" element={<Navigate to="/dashboard" replace />} />
            <Route path="calendar" element={<CalendarPage />} />

            <Route path="control-tower" element={<ControlTowerPage />} />
            <Route path="decisions" element={<ProjectDecisionsPage />} />
            <Route path="automation" element={<Navigate to="/dashboard" replace />} />


            {/* Approvals & Provisioning Hub */}
            <Route
              path="admin/super"
              element={
                <ProtectedRoute requiredRole={RoleCode.ROLE_MANAGER}>
                  <ManagerGovernancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/approvals"
              element={
                <ProtectedRoute requiredRole={RoleCode.ROLE_MANAGER}>
                  <ManagerGovernancePage />
                </ProtectedRoute>
              }
            />

            {/* Manager Governance Routes */}
            <Route
              path="admin/users"
              element={
                <ProtectedRoute requiredRole={RoleCode.ROLE_MANAGER}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/workflows"
              element={
                <ProtectedRoute requiredRole={RoleCode.ROLE_MANAGER}>
                  <WorkflowsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/audit"
              element={
                <ProtectedRoute requiredRole={RoleCode.ROLE_MANAGER}>
                  <AuditPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/settings"
              element={
                <ProtectedRoute requiredRole={RoleCode.ROLE_MANAGER}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Fallbacks */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};
