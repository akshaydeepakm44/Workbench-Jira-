import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  RoleCode,
  SprintDto,
  TaskDto,
} from '@workdesk/shared';
import {
  Plus,
  Play,
  CheckCircle2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Target,
  Layers,
  X,
} from 'lucide-react';

export const BacklogPage: React.FC = () => {
  const { projectId = 'default' } = useParams<{ projectId: string }>();
  const { user } = useAuth();

  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [projectKey, setProjectKey] = useState<string>('DESK');
  const [sprints, setSprints] = useState<SprintDto[]>([]);
  const [backlogTasks, setBacklogTasks] = useState<TaskDto[]>([]);
  const [sprintTasks, setSprintTasks] = useState<Record<string, TaskDto[]>>({});
  const [loading, setLoading] = useState(true);
  const [collapsedSprints, setCollapsedSprints] = useState<Record<string, boolean>>({});

  // Modals
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [capacityPoints, setCapacityPoints] = useState<number>(40);

  const [isStartSprintOpen, setIsStartSprintOpen] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState<SprintDto | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Drag and drop state
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [dragSourceSprintId, setDragSourceSprintId] = useState<string | null>(null);

  const isLeadOrManager =
    user?.roleCode === RoleCode.ROLE_MANAGER || user?.roleCode === RoleCode.ROLE_LEAD;

  const loadData = async () => {
    try {
      setLoading(true);
      // Resolve project ID (default to first active project if "default")
      let targetProjId = projectId;
      if (projectId === 'default') {
        const pRes = await fetch('/api/v1/tasks', { credentials: 'include' });
        const pData = await pRes.json();
        const items: TaskDto[] = pData.items || [];
        if (items.length > 0 && items[0].projectId) {
          targetProjId = items[0].projectId;
          setProjectKey(items[0].ticketId.split('-')[0] || 'DESK');
        }
      }
      setActiveProjectId(targetProjId);

      // Fetch sprints
      const sprintRes = await fetch(`/api/v1/sprints/projects/${targetProjId}`, {
        credentials: 'include',
      });
      if (sprintRes.ok) {
        const sprintData = await sprintRes.json();
        setSprints(sprintData);

        // Fetch tasks for each sprint
        const sTasks: Record<string, TaskDto[]> = {};
        for (const s of sprintData) {
          const detailRes = await fetch(`/api/v1/sprints/${s.id}`, { credentials: 'include' });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            sTasks[s.id] = detail.tasks || [];
          }
        }
        setSprintTasks(sTasks);
      }

      // Fetch product backlog
      const backlogRes = await fetch(`/api/v1/tasks/projects/${targetProjId}/backlog?limit=100`, {
        credentials: 'include',
      });
      if (backlogRes.ok) {
        const backlogData = await backlogRes.json();
        setBacklogTasks(backlogData.items || []);
      }
    } catch (err) {
      console.error('Failed to load backlog data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim()) return;

    try {
      const res = await fetch('/api/v1/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: activeProjectId,
          name: sprintName,
          goal: sprintGoal,
          capacityPoints: Number(capacityPoints) || 40,
        }),
      });

      if (res.ok) {
        setIsCreateSprintOpen(false);
        setSprintName('');
        setSprintGoal('');
        loadData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to create sprint');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSprint || !startDate || !endDate) return;

    try {
      const res = await fetch(`/api/v1/sprints/${selectedSprint.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ startDate, endDate }),
      });

      if (res.ok) {
        setIsStartSprintOpen(false);
        setSelectedSprint(null);
        loadData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to start sprint');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteSprint = async (sprintId: string) => {
    if (!confirm('Are you sure you want to complete this sprint? Incomplete tasks will return to the backlog.')) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/sprints/${sprintId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ incompleteTaskAction: 'MOVE_TO_BACKLOG' }),
      });

      if (res.ok) {
        loadData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to complete sprint');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (ticketId: string, fromSprintId: string | null) => {
    setDraggedTicketId(ticketId);
    setDragSourceSprintId(fromSprintId);
  };

  const handleDropToSprint = async (targetSprintId: string) => {
    if (!draggedTicketId) return;

    try {
      const res = await fetch(`/api/v1/sprints/${targetSprintId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticketIds: [draggedTicketId] }),
      });

      if (res.ok) {
        loadData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to move task to sprint');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDraggedTicketId(null);
      setDragSourceSprintId(null);
    }
  };

  const handleDropToBacklog = async () => {
    if (!draggedTicketId || !dragSourceSprintId) return;

    try {
      const res = await fetch(`/api/v1/sprints/${dragSourceSprintId}/tasks/${draggedTicketId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        loadData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to return task to backlog');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDraggedTicketId(null);
      setDragSourceSprintId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Layers className="w-6 h-6 text-indigo-400" />
              <span>Project Backlog & Sprints</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {projectKey}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Prioritize backlog items, plan sprint capacity, and commit tasks to active execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isLeadOrManager && (
            <button
              onClick={() => setIsCreateSprintOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create Sprint</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 font-mono text-sm animate-pulse">
          Loading Sprints & Product Backlog...
        </div>
      ) : (
        <div className="space-y-8">
          {/* Sprints Section */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 px-1">
              Sprints ({sprints.length})
            </h2>

            {sprints.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-sm">
                No sprints created yet. Create a sprint to organize tasks into timeboxed delivery cycles.
              </div>
            ) : (
              sprints.map((sprint) => {
                const tasks = sprintTasks[sprint.id] || [];
                const isActive = sprint.status === 'ACTIVE';
                const isCompleted = sprint.status === 'COMPLETED';
                const isCollapsed = collapsedSprints[sprint.id];
                const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
                const capacity = sprint.capacityPoints || 40;

                return (
                  <div
                    key={sprint.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropToSprint(sprint.id)}
                    className={`border rounded-xl transition-all ${
                      isActive
                        ? 'border-indigo-500/40 bg-slate-900/60 shadow-lg shadow-indigo-950/20'
                        : isCompleted
                        ? 'border-slate-800 bg-slate-950/40 opacity-75'
                        : 'border-slate-800 bg-slate-900/40'
                    }`}
                  >
                    {/* Sprint Header */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            setCollapsedSprints((prev) => ({
                              ...prev,
                              [sprint.id]: !prev[sprint.id],
                            }))
                          }
                          className="text-slate-400 hover:text-white"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{sprint.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                                isActive
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : isCompleted
                                  ? 'bg-slate-800 text-slate-400'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {sprint.status}
                            </span>
                          </div>
                          {sprint.goal && (
                            <p className="text-xs text-slate-400 mt-0.5">{sprint.goal}</p>
                          )}
                        </div>
                      </div>

                      {/* Metrics & Actions */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1 font-mono">
                            <Target className="w-3.5 h-3.5 text-indigo-400" />
                            {totalPoints} / {capacity} pts
                          </span>
                          <span>•</span>
                          <span>{tasks.length} tasks</span>
                        </div>

                        {isLeadOrManager && (
                          <div className="flex items-center gap-2">
                            {sprint.status === 'PLANNED' && (
                              <button
                                onClick={() => {
                                  setSelectedSprint(sprint);
                                  setIsStartSprintOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
                              >
                                <Play className="w-3 h-3" />
                                <span>Start Sprint</span>
                              </button>
                            )}

                            {isActive && (
                              <button
                                onClick={() => handleCompleteSprint(sprint.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Complete Sprint</span>
                              </button>
                            )}

                            <Link
                              to={`/projects/${activeProjectId}/sprints/${sprint.id}/planning`}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700"
                            >
                              Planning
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Task Rows inside Sprint */}
                    {!isCollapsed && (
                      <div className="border-t border-slate-800/80 divide-y divide-slate-800/50">
                        {tasks.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-500 font-mono">
                            Drag tasks here from the Product Backlog to commit them to this sprint.
                          </div>
                        ) : (
                          tasks.map((task) => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={() => handleDragStart(task.ticketId, sprint.id)}
                              className="p-3.5 px-4 flex items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors group cursor-grab active:cursor-grabbing"
                            >
                              <div className="flex items-center gap-3">
                                <GripVertical className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                                <span className="font-mono text-xs font-semibold text-indigo-400">
                                  {task.ticketId}
                                </span>
                                <Link
                                  to={`/tasks/${task.ticketId}`}
                                  className="text-sm text-slate-200 hover:text-white transition-colors"
                                >
                                  {task.title}
                                </Link>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {task.storyPoints !== null && task.storyPoints !== undefined && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    {task.storyPoints} pts
                                  </span>
                                )}
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    task.status === 'DONE'
                                      ? 'bg-emerald-500/10 text-emerald-400'
                                      : task.status === 'IN_PROGRESS'
                                      ? 'bg-blue-500/10 text-blue-400'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {task.status}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {task.assigneeName || 'Unassigned'}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Product Backlog Section */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropToBacklog}
            className="space-y-4 pt-4 border-t border-slate-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Product Backlog ({backlogTasks.length} unassigned tasks)
                </h2>
                <p className="text-xs text-slate-500">
                  Items ready for prioritization. Drag items into a sprint above to plan upcoming work.
                </p>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl bg-slate-900/30 overflow-hidden divide-y divide-slate-800/60">
              {backlogTasks.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  Backlog is empty! Create new tasks or complete existing sprints.
                </div>
              ) : (
                backlogTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.ticketId, null)}
                    className="p-3.5 px-4 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors group cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                      <span className="font-mono text-xs font-semibold text-indigo-400">
                        {task.ticketId}
                      </span>
                      <Link
                        to={`/tasks/${task.ticketId}`}
                        className="text-sm text-slate-200 hover:text-white transition-colors"
                      >
                        {task.title}
                      </Link>
                      {task.parentTicketId && (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {task.parentTicketId}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {task.storyPoints !== null && task.storyPoints !== undefined ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {task.storyPoints} pts
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600 font-mono">Unestimated</span>
                      )}
                      <span className="text-xs text-slate-400">
                        {task.assigneeName || 'Unassigned'}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          task.priority === 'Critical'
                            ? 'text-red-400 bg-red-500/10'
                            : task.priority === 'High'
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-slate-400 bg-slate-800'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Sprint Modal */}
      {isCreateSprintOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-lg">Create Sprint</h3>
              <button onClick={() => setIsCreateSprintOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleCreateSprint} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Sprint Name *
                </label>
                <input
                  type="text"
                  required
                  value={sprintName}
                  onChange={(e) => setSprintName(e.target.value)}
                  placeholder={`e.g. ${projectKey} Sprint 1`}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Sprint Goal
                </label>
                <textarea
                  value={sprintGoal}
                  onChange={(e) => setSprintGoal(e.target.value)}
                  placeholder="What is the objective of this delivery cycle?"
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Capacity Commitment (Story Points)
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={capacityPoints}
                  onChange={(e) => setCapacityPoints(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateSprintOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
                >
                  Create Sprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start Sprint Modal */}
      {isStartSprintOpen && selectedSprint && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-lg">Start {selectedSprint.name}</h3>
              <button onClick={() => setIsStartSprintOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleStartSprint} className="space-y-4">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs text-indigo-300">
                Starting this sprint locks committed tasks into the historical Sprint Commitment
                ledger. Any tasks added later will be audited as unplanned additions.
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Start Date *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  End Date *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsStartSprintOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
                >
                  Confirm & Start
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
