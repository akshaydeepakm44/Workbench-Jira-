import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  TimelineResponseDto,
  TimelineTaskDto,
} from '@workdesk/shared';
import {
  Calendar,
  AlertCircle,
  GitBranch,
  Edit2,
  ChevronRight,
} from 'lucide-react';

export const TimelinePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [timelineData, setTimelineData] = useState<TimelineResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  // Reschedule Modal
  const [rescheduleTask, setRescheduleTask] = useState<TimelineTaskDto | null>(null);
  const [newStartDate, setNewStartDate] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const fetchTimeline = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/timeline/projects/${projectId}`, { credentials: 'include' });
      if (res.ok) {
        setTimelineData(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [projectId]);

  const handleRescheduleSubmit = async () => {
    if (!rescheduleTask) return;
    setRescheduleError(null);
    setSavingReschedule(true);
    try {
      const res = await fetch(`/api/v1/timeline/tasks/${rescheduleTask.ticketId}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          startDate: newStartDate ? new Date(newStartDate).toISOString() : null,
          deadline: newDeadline ? new Date(newDeadline).toISOString() : null,
        }),
      });

      if (res.ok) {
        setRescheduleTask(null);
        fetchTimeline();
      } else {
        const errData = await res.json();
        setRescheduleError(errData.message || 'Reschedule failed');
      }
    } catch (err: any) {
      setRescheduleError(err.message || 'Network error');
    } finally {
      setSavingReschedule(false);
    }
  };

  const getLevelBadge = (level: number, type: string) => {
    switch (level) {
      case 1:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">INITIATIVE</span>;
      case 2:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">EPIC</span>;
      case 0:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">MILESTONE</span>;
      case 4:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">SUBTASK</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">{type}</span>;
    }
  };

  const filteredTasks = (timelineData?.tasks || []).filter((t) => {
    if (showCriticalOnly && !t.isCriticalPath) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Link to="/tasks" className="hover:text-white transition-colors">Projects</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-indigo-400">{timelineData?.projectName || 'Project'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 mt-1">
            <Calendar className="w-6 h-6 text-purple-400" />
            <span>Interactive Timeline & Critical Path</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Chronological work breakdown visualization with CPM critical path sequencing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCriticalOnly(!showCriticalOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
              showCriticalOnly
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <GitBranch className="w-4 h-4 text-rose-400" />
            <span>Critical Path Only ({timelineData?.criticalPathTicketIds.length || 0})</span>
          </button>
        </div>
      </div>

      {/* Critical Path Banner */}
      {timelineData && timelineData.criticalPathTicketIds.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            <strong>Critical Path Active:</strong> {timelineData.criticalPathTicketIds.join(' → ')}. Any delay on these {timelineData.criticalPathTicketIds.length} tickets directly impacts the final project delivery date.
          </span>
        </div>
      )}

      {/* Timeline Grid / Gantt List */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs font-semibold text-slate-400">
          <div className="flex-1">Work Item Hierarchy & Title</div>
          <div className="w-32 text-center">Start Date</div>
          <div className="w-32 text-center">Deadline</div>
          <div className="w-24 text-center">Duration</div>
          <div className="w-24 text-center">Slack</div>
          <div className="w-20 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading project timeline...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No scheduled tasks matching criteria</div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredTasks.map((t) => (
              <div
                key={t.id}
                className={`p-3.5 flex items-center justify-between gap-4 text-xs transition-colors hover:bg-slate-800/20 ${
                  t.isCriticalPath ? 'border-l-4 border-rose-500 bg-rose-500/5' : ''
                }`}
              >
                {/* Title & Hierarchy */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    {getLevelBadge(t.level, t.type)}
                    <Link
                      to={`/tasks/${t.ticketId}`}
                      className="font-bold text-white hover:text-indigo-400 transition-colors"
                    >
                      {t.ticketId}
                    </Link>
                    <span className="truncate text-slate-300">{t.title}</span>
                    {t.isCriticalPath && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500 text-white uppercase tracking-wider">
                        Critical
                      </span>
                    )}
                  </div>
                  {t.assigneeName && (
                    <div className="text-[11px] text-slate-500 mt-1">
                      Assigned to {t.assigneeName} | Status: {t.status}
                    </div>
                  )}
                </div>

                {/* Dates & Duration */}
                <div className="w-32 text-center text-slate-300">
                  {t.startDate ? new Date(t.startDate).toLocaleDateString() : '—'}
                </div>
                <div className="w-32 text-center font-medium text-slate-200">
                  {t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}
                </div>
                <div className="w-24 text-center text-slate-400">
                  {t.durationDays} {t.durationDays === 1 ? 'day' : 'days'}
                </div>
                <div className="w-24 text-center">
                  <span
                    className={`font-mono text-xs ${
                      t.totalSlackDays === 0 ? 'text-rose-400 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {t.totalSlackDays}d
                  </span>
                </div>

                {/* Reschedule Button */}
                <div className="w-20 text-right">
                  <button
                    onClick={() => {
                      setRescheduleTask(t);
                      setNewStartDate(t.startDate ? t.startDate.split('T')[0] : '');
                      setNewDeadline(t.deadline ? t.deadline.split('T')[0] : '');
                      setRescheduleError(null);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                    title="Reschedule Dates"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      {rescheduleTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <span>Reschedule {rescheduleTask.ticketId}</span>
            </h3>
            <p className="text-xs text-slate-400">{rescheduleTask.title}</p>

            {rescheduleError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {rescheduleError}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Start Date</label>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Deadline</label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRescheduleTask(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={savingReschedule}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition-all"
              >
                {savingReschedule ? 'Saving...' : 'Update Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
