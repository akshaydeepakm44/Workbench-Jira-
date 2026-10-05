import React from 'react';
import { Layers, Clock } from 'lucide-react';

export const WorkflowsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Layers className="w-6 h-6 text-purple-400" />
          <span>Workflow Configuration & Urgency Engine</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Server-enforced status transition policies and deadline escalation thresholds.
        </p>
      </div>

      {/* Task Status State Machine */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white">Task Lifecycle State Machine</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Tasks transition through five canonical states. The platform enforces that no task with a pending review can enter the <strong>Done</strong> state without explicit Lead/Manager approval.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase">1. To Do</span>
            <div className="text-[11px] text-slate-500">Backlogged / Queue</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
            <span className="text-xs font-bold text-indigo-400 uppercase">2. In Progress</span>
            <div className="text-[11px] text-slate-500">Actively worked on</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
            <span className="text-xs font-bold text-rose-400 uppercase">3. Blocked</span>
            <div className="text-[11px] text-slate-500">Requires resolution</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
            <span className="text-xs font-bold text-amber-400 uppercase">4. Review</span>
            <div className="text-[11px] text-slate-500">Pending Lead Review</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
            <span className="text-xs font-bold text-emerald-400 uppercase">5. Done</span>
            <div className="text-[11px] text-slate-500">100% Progress verified</div>
          </div>
        </div>
      </div>

      {/* Urgency Thresholds */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          <span>Configured Urgency Timer Thresholds</span>
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          The background urgency engine evaluates remaining time until deadline every 5 minutes and flags risk automatically:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-1">
            <div className="text-xs font-bold text-emerald-400 uppercase">Green State</div>
            <div className="text-sm font-semibold text-white">&gt; 72 Hours</div>
            <div className="text-[11px] text-slate-400">Normal healthy buffer remaining.</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-1">
            <div className="text-xs font-bold text-amber-400 uppercase">Yellow State</div>
            <div className="text-sm font-semibold text-white">24 – 72 Hours</div>
            <div className="text-[11px] text-slate-400">Approaching deadline alert.</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/30 space-y-1">
            <div className="text-xs font-bold text-rose-400 uppercase">Red State</div>
            <div className="text-sm font-semibold text-white">&lt; 24 Hours</div>
            <div className="text-[11px] text-slate-400">Critical attention required.</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-rose-600/50 space-y-1">
            <div className="text-xs font-bold text-rose-500 uppercase">Overdue State</div>
            <div className="text-sm font-semibold text-white">Past Deadline</div>
            <div className="text-[11px] text-slate-400">Escalated to Team Lead.</div>
          </div>
        </div>
      </div>
    </div>
  );
};
