import React, { useState } from 'react';
import { FileText, Download, Play, Terminal } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [pythonOutput, setPythonOutput] = useState<string | null>(null);
  const [runningPython, setRunningPython] = useState(false);

  const handleDownload = (path: string) => {
    window.open(path, '_blank');
  };

  const handleRunPython = async () => {
    setRunningPython(true);
    setPythonOutput(null);
    try {
      const res = await fetch('/api/v1/reports/python-digest', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPythonOutput(data.output);
      } else {
        setPythonOutput('Failed to execute Python analytics script.');
      }
    } catch (err: any) {
      setPythonOutput(`Error: ${err.message}`);
    } finally {
      setRunningPython(false);
    }
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
          Export transactional data records and run deep statistical digests via the Python Analytics engine.
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
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
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
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Stand-ups CSV</span>
          </button>
        </div>
      </div>

      {/* Python Analytics Engine Execution */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">Python Analytics & KPI Engine</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Runs <code className="text-slate-300">python_analytics/analytics.py</code> directly against the active SQLite database to perform distribution calculations and system health analysis.
            </p>
          </div>

          <button
            onClick={handleRunPython}
            disabled={runningPython}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-600/20 disabled:opacity-50 transition-all"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>{runningPython ? 'Executing Python...' : 'Run Python Analytics'}</span>
          </button>
        </div>

        {pythonOutput && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre max-h-96">
            {pythonOutput}
          </div>
        )}
      </div>
    </div>
  );
};
