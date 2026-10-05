import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleCode, TaskStatus, TaskUrgency, KpiSummaryDto } from '@workdesk/shared';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  Calendar,
  ArrowRight,
  PlusCircle,
  Video,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KpiSummaryDto | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpiRes, tasksRes] = await Promise.all([
          fetch('/api/v1/kpis/summary', { credentials: 'include' }),
          fetch('/api/v1/tasks', { credentials: 'include' }),
        ]);

        if (kpiRes.ok) {
          const kpiData = await kpiRes.json();
          setKpis(kpiData);
        }

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(Array.isArray(tasksData) ? tasksData : (tasksData?.items || []));
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const urgentTasks = tasks
    .filter((t) => t.status !== TaskStatus.DONE && (t.urgency === TaskUrgency.RED || t.urgency === TaskUrgency.OVERDUE || t.urgency === TaskUrgency.YELLOW))
    .slice(0, 5);

  const reviewPendingTasks = tasks.filter((t) => t.reviewPending);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome, {user?.fullName}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {user?.roleCode === RoleCode.ROLE_MANAGER && 'Organization Oversight & Administrative Governance'}
            {user?.roleCode === RoleCode.ROLE_LEAD && 'Team Operational Supervision & Review Queue'}
            {user?.roleCode === RoleCode.ROLE_EMPLOYEE && 'Personal Workstation & Daily Execution Rhythm'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/tasks"
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Task</span>
          </Link>
          <Link
            to="/meetings"
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 border border-slate-700 transition-all"
          >
            <Video className="w-4 h-4 text-emerald-400" />
            <span>Meet</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards (Loaded Dynamically from Backend) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Total Active Tasks</div>
          <div className="text-3xl font-bold text-white mt-1">
            {loading ? '...' : kpis?.totalTasks ?? 0}
          </div>
          <div className="text-xs text-indigo-400 mt-2">
            {kpis?.inProgressTasks ?? 0} In Progress • {kpis?.completedTasks ?? 0} Done
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Completion Rate</div>
          <div className="text-3xl font-bold text-emerald-400 mt-1">
            {loading ? '...' : `${kpis?.completionRate ?? 0}%`}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            On-Time Delivery: {kpis?.onTimeRate ?? 100}%
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Urgent / Overdue</div>
          <div className="text-3xl font-bold text-amber-400 mt-1">
            {loading ? '...' : kpis?.overdueTasks ?? 0}
          </div>
          <div className="text-xs text-amber-400/80 mt-2">
            Blocked Rate: {kpis?.blockedRate ?? 0}%
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Daily Stand-up</div>
          <div className="text-3xl font-bold text-white mt-1">
            {loading ? (
              '...'
            ) : kpis?.standupSubmittedToday ? (
              <span className="text-emerald-400">Submitted</span>
            ) : (
              <span className="text-amber-400">Pending</span>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center justify-between">
            <span>Cutoff: 11:00 AM</span>
            <Link to="/standup" className="text-indigo-400 hover:underline">
              Submit &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Review Queue Alert for Lead / Manager */}
      {(user?.roleCode === RoleCode.ROLE_LEAD || user?.roleCode === RoleCode.ROLE_MANAGER) &&
        reviewPendingTasks.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-sm font-semibold text-white">
                  {reviewPendingTasks.length} Employee Task(s) Awaiting Review
                </div>
                <div className="text-xs text-slate-400">
                  Review scope, priority, and assignees before activating tasks.
                </div>
              </div>
            </div>
            <Link
              to="/tasks"
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold"
            >
              Open Queue
            </Link>
          </div>
        )}

      {/* Main Grid: Urgent Tasks & Stand-up Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent Tasks Column */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Priority & Approaching Deadlines</span>
            </h2>
            <Link to="/tasks" className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {urgentTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <CheckSquare className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
              No overdue or critical tasks right now. All work is on track!
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {urgentTasks.map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-400">{t.ticketId}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          t.urgency === TaskUrgency.OVERDUE
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : t.urgency === TaskUrgency.RED
                            ? 'bg-rose-500/10 text-rose-300'
                            : 'bg-amber-500/10 text-amber-300'
                        }`}
                      >
                        {t.urgency}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-slate-200 truncate mt-0.5">{t.title}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-3 mt-1">
                      <span>Status: {t.status}</span>
                      <span>Assignee: {t.assigneeName || 'Unassigned'}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-400">
                      {t.deadline ? new Date(t.deadline).toLocaleDateString() : 'No Deadline'}
                    </div>
                    <Link
                      to="/tasks"
                      className="text-xs text-indigo-400 hover:underline mt-1 inline-block"
                    >
                      Inspect &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Action & Daily Rhythm Card */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-5">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Daily Operating Rhythm</span>
          </h2>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-300">Daily Stand-up Rule</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every employee submits one update per working day (Yesterday, Today, Blockers). Reported blockers can be converted to tickets by Leads.
            </p>
            <div className="pt-2">
              <Link
                to="/standup"
                className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold text-center block transition-all shadow-lg shadow-emerald-600/20"
              >
                Go to My Stand-up
              </Link>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-300">Instant Collaboration</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Provision real Google Meet rooms and convert meeting action items into bi-directionally linked tickets.
            </p>
            <div className="pt-2">
              <Link
                to="/meetings"
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold text-center block transition-all border border-slate-700"
              >
                Open Meetings Workspace
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
