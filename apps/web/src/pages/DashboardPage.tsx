import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleCode, TaskStatus, TaskUrgency, KpiSummaryDto, ProjectDecisionDto } from '@workdesk/shared';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  Calendar,
  ArrowRight,
  PlusCircle,
  Video,
  FileText,
  Shield,
  Users,
  Lock,
  X,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KpiSummaryDto | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<ProjectDecisionDto[]>([]);
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | 'CORE' | 'TEAM'>('ALL');
  const [activeDecisionModal, setActiveDecisionModal] = useState<ProjectDecisionDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpiRes, tasksRes, decisionsRes] = await Promise.all([
          fetch('/api/v1/kpis/summary', { credentials: 'include' }),
          fetch('/api/v1/tasks', { credentials: 'include' }),
          fetch('/api/v1/decisions/dashboard', { credentials: 'include' }),
        ]);

        if (kpiRes.ok) {
          const kpiData = await kpiRes.json();
          setKpis(kpiData);
        }

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(Array.isArray(tasksData) ? tasksData : (tasksData?.items || []));
        }

        if (decisionsRes.ok) {
          const decisionsData = await decisionsRes.json();
          setDecisions(Array.isArray(decisionsData) ? decisionsData : []);
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

      {/* Team & Core Decisions Section */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                <span>Project Decision Log</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {decisions.length} active
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Organizational, architectural, and team decisions updated in real time for your role
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setDecisionFilter('ALL')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  decisionFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setDecisionFilter('CORE')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                  decisionFilter === 'CORE' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-3 h-3 text-purple-300" />
                <span>Core</span>
              </button>
              <button
                type="button"
                onClick={() => setDecisionFilter('TEAM')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                  decisionFilter === 'TEAM' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3 h-3 text-cyan-300" />
                <span>Team</span>
              </button>
            </div>

            <Link
              to="/decisions"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:underline flex items-center gap-1 shrink-0 ml-2"
            >
              <span>Full Archive</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Decisions Grid */}
        {decisions.filter((d) => {
          if (decisionFilter === 'ALL') return true;
          return (d.visibility || 'TEAM').toUpperCase() === decisionFilter;
        }).length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 p-6 space-y-2">
            <CheckSquare className="w-7 h-7 text-indigo-400 mx-auto opacity-70" />
            <div className="text-sm font-medium text-slate-300">
              No {decisionFilter !== 'ALL' ? decisionFilter.toLowerCase() : ''} decisions recorded yet
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              When Managers or Leads record decisions marked for your team or core group, they will appear dynamically here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {decisions
              .filter((d) => {
                if (decisionFilter === 'ALL') return true;
                return (d.visibility || 'TEAM').toUpperCase() === decisionFilter;
              })
              .map((d) => {
                const vis = (d.visibility || 'TEAM').toUpperCase();
                return (
                  <div
                    key={d.id}
                    onClick={() => setActiveDecisionModal(d)}
                    className="p-4 rounded-xl bg-slate-950/80 hover:bg-slate-950 border border-slate-800/90 hover:border-slate-700 transition-all cursor-pointer flex flex-col justify-between group space-y-3 shadow-sm hover:shadow-indigo-500/5"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono font-medium text-slate-400 truncate max-w-[120px]">
                          {d.projectName}
                        </span>
                        {vis === 'CORE' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center gap-1 shrink-0">
                            <Shield className="w-2.5 h-2.5 text-purple-400" />
                            <span>Core Scope</span>
                          </span>
                        )}
                        {vis === 'TEAM' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1 shrink-0">
                            <Users className="w-2.5 h-2.5 text-cyan-400" />
                            <span>Team Scope</span>
                          </span>
                        )}
                        {vis === 'MYSELF' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1 shrink-0">
                            <Lock className="w-2.5 h-2.5 text-amber-400" />
                            <span>Manager Private</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                        {d.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {d.summary}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                      <span>By {d.decidedByName}</span>
                      <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Decision Detail Modal */}
      {activeDecisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setActiveDecisionModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {activeDecisionModal.projectName}
                </span>
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {activeDecisionModal.status}
                </span>
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {activeDecisionModal.visibility} Scope
                </span>
              </div>
              <h3 className="text-lg font-bold text-white pt-1">
                {activeDecisionModal.title}
              </h3>
              <p className="text-xs text-slate-400">
                Decided by {activeDecisionModal.decidedByName} on{' '}
                {new Date(activeDecisionModal.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-300">Agreed Summary</div>
                <div className="text-slate-400 whitespace-pre-wrap">{activeDecisionModal.summary}</div>
              </div>

              {activeDecisionModal.rationale && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-semibold text-slate-300">Rationale & Context</div>
                  <div className="text-slate-400 whitespace-pre-wrap">{activeDecisionModal.rationale}</div>
                </div>
              )}

              {activeDecisionModal.meetingTitle && (
                <div className="text-slate-400">
                  <span className="text-slate-500">Related Meeting: </span>
                  <span className="text-indigo-400 font-medium">{activeDecisionModal.meetingTitle}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <Link
                to="/decisions"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 hover:underline"
              >
                <span>Open Project Decisions Page</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <button
                type="button"
                onClick={() => setActiveDecisionModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
