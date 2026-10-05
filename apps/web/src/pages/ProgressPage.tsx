import React, { useEffect, useState } from 'react';
import { KpiSummaryDto } from '@workdesk/shared';
import { BarChart3, TrendingUp, CheckCircle, Clock, ShieldCheck } from 'lucide-react';

export const ProgressPage: React.FC = () => {
  const [kpis, setKpis] = useState<KpiSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/kpis/summary', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setKpis)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-cyan-400" />
          <span>Progress & KPI Engine</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Server-calculated metrics derived from transactional task execution and daily stand-ups.
        </p>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Completion Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-white">
            {loading ? '...' : `${kpis?.completionRate ?? 0}%`}
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${kpis?.completionRate ?? 0}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 pt-1">
            {kpis?.completedTasks ?? 0} of {kpis?.totalTasks ?? 0} total tasks completed
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>On-Time Delivery</span>
            <CheckCircle className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-white">
            {loading ? '...' : `${kpis?.onTimeRate ?? 100}%`}
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all"
              style={{ width: `${kpis?.onTimeRate ?? 100}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 pt-1">
            Tasks completed on or before target deadline
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Overdue Exposure</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-white">
            {loading ? '...' : `${kpis?.overdueRate ?? 0}%`}
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className="bg-amber-500 h-full rounded-full transition-all"
              style={{ width: `${kpis?.overdueRate ?? 0}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 pt-1">
            {kpis?.overdueTasks ?? 0} open task(s) past deadline
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Stand-up Participation</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold text-white">
            {loading ? '...' : `${kpis?.teamStandupParticipationRate ?? 0}%`}
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className="bg-cyan-500 h-full rounded-full transition-all"
              style={{ width: `${kpis?.teamStandupParticipationRate ?? 0}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 pt-1">
            Cutoff enforced daily at 11:00 AM
          </div>
        </div>
      </div>

      {/* Breakdown Details */}
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white">Execution Status Distribution</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs text-slate-400">In Progress</div>
            <div className="text-2xl font-bold text-indigo-400 mt-1">{kpis?.inProgressTasks ?? 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs text-slate-400">Blocked</div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{kpis?.blockedTasks ?? 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs text-slate-400">Review Pending</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{kpis?.reviewPendingTasks ?? 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs text-slate-400">Completed (Done)</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{kpis?.completedTasks ?? 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
