import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { SprintDetailDto, TaskDto } from '@workdesk/shared';
import {
  Target,
  ArrowLeft,
  Plus,
  Minus,
  AlertTriangle,
  Layers,
  Search,
} from 'lucide-react';

export const SprintPlanningPage: React.FC = () => {
  const { sprintId } = useParams<{ sprintId: string }>();
  const navigate = useNavigate();

  const [sprint, setSprint] = useState<SprintDetailDto | null>(null);
  const [backlogTasks, setBacklogTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    if (!sprintId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/sprints/${sprintId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSprint(data);

        // Load project backlog
        const bRes = await fetch(`/api/v1/tasks/projects/${data.projectId}/backlog?limit=100`, {
          credentials: 'include',
        });
        if (bRes.ok) {
          const bData = await bRes.json();
          setBacklogTasks(bData.items || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sprintId]);

  const handleAddTask = async (ticketId: string) => {
    if (!sprintId) return;
    try {
      const res = await fetch(`/api/v1/sprints/${sprintId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticketIds: [ticketId] }),
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTask = async (ticketId: string) => {
    if (!sprintId) return;
    try {
      const res = await fetch(`/api/v1/sprints/${sprintId}/tasks/${ticketId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !sprint) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-sm animate-pulse">
        Loading Sprint Planning Workspace...
      </div>
    );
  }

  const totalPoints = sprint.tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const capacity = sprint.capacityPoints || 40;
  const percentCapacity = Math.round((totalPoints / capacity) * 100);
  const isOvercommitted = totalPoints > capacity;

  const filteredBacklog = backlogTasks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.ticketId.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Sprint Planning: {sprint.name}</h1>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {sprint.status}
              </span>
            </div>
            {sprint.goal && <p className="text-xs text-slate-400 mt-0.5">{sprint.goal}</p>}
          </div>
        </div>

        <Link
          to={`/projects/${sprint.projectId}/backlog`}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700"
        >
          Return to Backlog
        </Link>
      </div>

      {/* Capacity & Commitment Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Total Committed Tasks</span>
          <div className="text-2xl font-bold text-white mt-1">{sprint.tasks.length}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Committed Story Points</span>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{totalPoints} pts</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Sprint Capacity</span>
          <div className="text-2xl font-bold text-slate-300 mt-1">{capacity} pts</div>
        </div>

        <div
          className={`border rounded-xl p-4 ${
            isOvercommitted
              ? 'bg-rose-950/20 border-rose-500/30'
              : percentCapacity > 85
              ? 'bg-amber-950/20 border-amber-500/30'
              : 'bg-emerald-950/20 border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Capacity Commitment</span>
            <span
              className={`text-xs font-bold ${
                isOvercommitted
                  ? 'text-rose-400'
                  : percentCapacity > 85
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {percentCapacity}%
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isOvercommitted
                  ? 'bg-rose-500'
                  : percentCapacity > 85
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(percentCapacity, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {isOvercommitted && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>
            <strong>Overcommitment Warning:</strong> Total committed story points ({totalPoints})
            exceed the planned sprint capacity ({capacity}). Consider moving tasks back to the
            backlog before starting the sprint.
          </span>
        </div>
      )}

      {/* Dual Pane Planning Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Pane: Product Backlog */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <span>Available Backlog ({filteredBacklog.length})</span>
            </h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search backlog..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48"
              />
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl bg-slate-900/40 divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto">
            {filteredBacklog.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No matching tasks in product backlog.
              </div>
            ) : (
              filteredBacklog.map((task) => (
                <div
                  key={task.id}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-indigo-400">
                        {task.ticketId}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {task.storyPoints ? `${task.storyPoints} pts` : '0 pts'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-200 truncate mt-0.5">{task.title}</div>
                  </div>

                  <button
                    onClick={() => handleAddTask(task.ticketId)}
                    className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors"
                    title="Add to sprint"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Pane: Sprint Bucket */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              <span>Sprint Commitment ({sprint.tasks.length} tasks)</span>
            </h2>
          </div>

          <div className="border border-indigo-500/30 rounded-xl bg-slate-900/60 divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto">
            {sprint.tasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No tasks committed yet. Click + on any backlog item on the left to add it to this
                sprint.
              </div>
            ) : (
              sprint.tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-indigo-400">
                        {task.ticketId}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                        {task.storyPoints ? `${task.storyPoints} pts` : '0 pts'}
                      </span>
                      <span className="text-xs text-slate-400">{task.assigneeName || 'Unassigned'}</span>
                    </div>
                    <div className="text-sm text-slate-200 truncate mt-0.5">{task.title}</div>
                  </div>

                  <button
                    onClick={() => handleRemoveTask(task.ticketId)}
                    className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white transition-colors"
                    title="Remove from sprint"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
