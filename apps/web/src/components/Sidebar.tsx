import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleCode } from '@workdesk/shared';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Video,
  BarChart3,
  FileText,
  Settings,
  Shield,
  Columns,
  ListOrdered,
  CalendarDays,
  Activity,
} from 'lucide-react';


export const Sidebar: React.FC = () => {
  const { user } = useAuth();

  const isManager = user?.roleCode === RoleCode.ROLE_MANAGER;
  const isLeadOrAbove = isManager || user?.roleCode === RoleCode.ROLE_LEAD;

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
    }`;

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/40 backdrop-blur-sm p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-6">
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Execution
          </div>
          <nav className="space-y-1">
            <NavLink to="/dashboard" className={navItemClass}>
              <LayoutDashboard className="w-4 h-4" />
              <span>My Dashboard</span>
            </NavLink>
            <NavLink to="/tasks" className={navItemClass}>
              <CheckSquare className="w-4 h-4" />
              <span>Tasks & Cockpit</span>
            </NavLink>
            <NavLink to="/projects/default/backlog" className={navItemClass}>
              <ListOrdered className="w-4 h-4" />
              <span>Backlog & Sprints</span>
            </NavLink>
            <NavLink to="/projects/default/boards" className={navItemClass}>
              <Columns className="w-4 h-4" />
              <span>Agile Kanban</span>
            </NavLink>
            <NavLink to="/calendar" className={navItemClass}>
              <CalendarDays className="w-4 h-4 text-indigo-400" />
              <span>Work Calendar</span>
            </NavLink>

            <NavLink to="/standup" className={navItemClass}>
              <Calendar className="w-4 h-4" />
              <span>Daily Stand-up</span>
            </NavLink>
            <NavLink to="/meetings" className={navItemClass}>
              <Video className="w-4 h-4" />
              <span>Meetings & Meet</span>
            </NavLink>
            <NavLink to="/decisions" className={navItemClass}>
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Decision Log</span>
            </NavLink>
          </nav>
        </div>

        {isLeadOrAbove && (
          <div>
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
              <span>Supervision (Lead)</span>
            </div>
            <nav className="space-y-1">
              <NavLink to="/control-tower" className={navItemClass}>
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Control Tower</span>
              </NavLink>
              <NavLink to="/team/progress" className={navItemClass}>
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span>Team Progress</span>
              </NavLink>
              <NavLink to="/reports" className={navItemClass}>
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Reports Center</span>
              </NavLink>
            </nav>

          </div>
        )}

        {isManager && (
          <div>
            <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
              <span>Governance (Manager)</span>
            </div>
            <nav className="space-y-1">
              <NavLink to="/admin/super" className={navItemClass}>
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Manager Governance</span>
              </NavLink>
              <NavLink to="/admin/audit" className={navItemClass}>
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Audit Logs</span>
              </NavLink>
              <NavLink to="/admin/settings" className={navItemClass}>
                <Settings className="w-4 h-4 text-purple-400" />
                <span>System Settings</span>
              </NavLink>
            </nav>
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 pt-4 px-3 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span>Connected DB</span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
        <div className="mt-1 text-slate-400 truncate">SQLite / dev.db</div>
      </div>
    </aside>
  );
};
