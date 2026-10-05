import React from 'react';
import { FileText, Download } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const handleDownload = (path: string) => {
    window.open(path, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-400" />
          <span>Reports & Analytics Center</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Export transactional data records and activity summaries across your team.
        </p>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Tasks & Delivery Report (CSV)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export all tasks in your scope with sequential ticket IDs, assignees, creators, priorities, urgency timers, and completion timestamps.
            </p>
          </div>
          <button
            onClick={() => handleDownload('/api/v1/reports/tasks/csv')}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Tasks CSV</span>
          </button>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Team Stand-ups Summary (CSV)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export daily stand-up participation history, Yesterday/Today logs, and documented blocker descriptions across your team.
            </p>
          </div>
          <button
            onClick={() => handleDownload('/api/v1/reports/standups/csv')}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Stand-ups CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};

