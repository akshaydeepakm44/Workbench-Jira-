import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleCode, TaskStatus, TaskPriority, TaskUrgency, TaskDto } from '@workdesk/shared';
import {
  CheckSquare,
  Plus,
  Columns,
  List as ListIcon,
  AlertCircle,
  CheckCircle2,
  X,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

export const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null);

  // Create Task Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  // Guidance Point Input
  const [newPointContent, setNewPointContent] = useState('');
  const [newCommentContent, setNewCommentContent] = useState('');

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/v1/tasks', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.items || [];
        setTasks(items);
        if (selectedTask) {
          const updated = items.find((t: any) => t.id === selectedTask.id);
          if (updated) setSelectedTask(updated);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTasks();
    // Load users list for Lead/Manager
    if (user?.roleCode !== RoleCode.ROLE_EMPLOYEE) {
      fetch('/api/v1/users', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setUsersList(data))
        .catch(console.error);
    }
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          priority: newPriority,
          assigneeId: newAssigneeId || undefined,
          deadline: newDeadline || undefined,
        }),
      });

      if (res.ok) {
        setIsCreateOpen(false);
        setNewTitle('');
        setNewDescription('');
        setNewDeadline('');
        setNewAssigneeId('');
        await fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewAction = async (taskId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePoint = async (pointId: string) => {
    try {
      const res = await fetch(`/api/v1/tasks/points/${pointId}/toggle`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) {
        await fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newPointContent.trim()) return;

    try {
      const res = await fetch(`/api/v1/tasks/${selectedTask.id}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newPointContent.trim() }),
      });
      if (res.ok) {
        setNewPointContent('');
        await fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newCommentContent.trim()) return;

    try {
      const res = await fetch(`/api/v1/tasks/${selectedTask.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newCommentContent.trim() }),
      });
      if (res.ok) {
        setNewCommentContent('');
        await fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'REVIEW') return t.status === TaskStatus.IN_REVIEW || t.requiresReview;
    return t.status === statusFilter;
  });

  const kanbanColumns = [
    { title: 'To Do', status: TaskStatus.TODO, color: 'text-slate-400' },
    { title: 'In Progress', status: TaskStatus.IN_PROGRESS, color: 'text-indigo-400' },
    { title: 'Blocked', status: TaskStatus.BLOCKED, color: 'text-rose-400' },
    { title: 'In Review', status: TaskStatus.IN_REVIEW, color: 'text-amber-400' },
    { title: 'Done', status: TaskStatus.DONE, color: 'text-emerald-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-500" />
            <span>Tasks & Kanban</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Server-authoritative task lifecycle, review queues, and manager guidance checklist.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="p-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListIcon className="w-4 h-4" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-4 h-4" />
              <span>Kanban</span>
            </button>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            statusFilter === 'ALL'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800'
          }`}
        >
          All ({tasks.length})
        </button>
        <button
          onClick={() => setStatusFilter(TaskStatus.IN_PROGRESS)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            statusFilter === TaskStatus.IN_PROGRESS
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800'
          }`}
        >
          In Progress ({tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length})
        </button>
        <button
          onClick={() => setStatusFilter(TaskStatus.BLOCKED)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            statusFilter === TaskStatus.BLOCKED
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800'
          }`}
        >
          Blocked ({tasks.filter((t) => t.status === TaskStatus.BLOCKED).length})
        </button>
        <button
          onClick={() => setStatusFilter('REVIEW')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            statusFilter === 'REVIEW'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800'
          }`}
        >
          In Review ({tasks.filter((t) => t.status === TaskStatus.IN_REVIEW || t.requiresReview).length})
        </button>
        <button
          onClick={() => setStatusFilter(TaskStatus.DONE)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            statusFilter === TaskStatus.DONE
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800'
          }`}
        >
          Done ({tasks.filter((t) => t.status === TaskStatus.DONE).length})
        </button>
      </div>

      {/* Content: List View or Kanban View */}
      {viewMode === 'list' ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Ticket</th>
                  <th className="px-5 py-3.5">Title</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Urgency</th>
                  <th className="px-5 py-3.5">Assignee</th>
                  <th className="px-5 py-3.5">Guidance</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                      No tasks found in this view.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/tasks/${t.ticketId}`)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4 font-mono font-bold text-xs text-indigo-400">
                        {t.ticketId}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-white flex items-center gap-2">
                          <span>{t.title}</span>
                          {(t.requiresReview || t.status === TaskStatus.IN_REVIEW) && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Review
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <div className="text-xs text-slate-400 truncate max-w-md mt-0.5">
                            {t.description}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200">
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            t.urgency === TaskUrgency.OVERDUE
                              ? 'bg-rose-500/20 text-rose-400'
                              : t.urgency === TaskUrgency.RED
                              ? 'bg-rose-500/10 text-rose-300'
                              : t.urgency === TaskUrgency.YELLOW
                              ? 'bg-amber-500/10 text-amber-300'
                              : 'bg-emerald-500/10 text-emerald-300'
                          }`}
                        >
                          {t.urgency}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-300">
                        {t.assigneeName || 'Unassigned'}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {t.points && t.points.length > 0 ? (
                          <span className="text-indigo-400 font-semibold">
                            {t.points.filter((p) => p.isCompleted).length}/{t.points.length} Points
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(t);
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          Inspect &rarr;
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {kanbanColumns.map((col) => {
            const colTasks = tasks.filter((t) => {
              if (col.status === TaskStatus.IN_REVIEW) return t.status === TaskStatus.IN_REVIEW || t.requiresReview;
              return t.status === col.status;
            });

            return (
              <div
                key={col.title}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 flex flex-col min-h-[500px]"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className={`text-xs font-bold uppercase ${col.color}`}>{col.title}</span>
                  <span className="text-xs text-slate-500 font-mono font-semibold">{colTasks.length}</span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => navigate(`/tasks/${t.ticketId}`)}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer space-y-2 transition-all shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-indigo-400">{t.ticketId}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            t.priority === TaskPriority.CRITICAL
                              ? 'bg-rose-500/20 text-rose-400'
                              : t.priority === TaskPriority.HIGH
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>

                      <div className="text-xs font-medium text-white line-clamp-2">{t.title}</div>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                        <span>{t.assigneeName || 'Unassigned'}</span>
                        <span
                          className={
                            t.urgency === TaskUrgency.OVERDUE
                              ? 'text-rose-400 font-bold'
                              : t.urgency === TaskUrgency.RED
                              ? 'text-rose-300 font-medium'
                              : 'text-slate-400'
                          }
                        >
                          {t.urgency}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Create New Task / Ticket</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {user?.roleCode === RoleCode.ROLE_EMPLOYEE && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  As an Employee, this task will be assigned to you and enter the <strong>Review Pending</strong> queue awaiting Lead approval.
                </span>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Implement user authentication endpoint"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Task details and acceptance criteria..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                    <option value={TaskPriority.CRITICAL}>Critical</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Deadline</label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  >
                  </input>
                </div>
              </div>

              {user?.roleCode !== RoleCode.ROLE_EMPLOYEE && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Assignee</label>
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Assign to myself</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.roleCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-indigo-400">
                    {selectedTask.ticketId}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      selectedTask.urgency === TaskUrgency.OVERDUE
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}
                  >
                    {selectedTask.urgency}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">{selectedTask.title}</h2>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Review Pending Banner & Actions */}
            {(selectedTask.requiresReview || selectedTask.status === TaskStatus.IN_REVIEW) && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Review Pending
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Created by {selectedTask.creatorName}. Awaiting review approval.
                  </div>
                </div>

                {user?.roleCode !== RoleCode.ROLE_EMPLOYEE && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReviewAction(selectedTask.id, 'APPROVE')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleReviewAction(selectedTask.id, 'REJECT')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Status & Priority Controls */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Status</label>
                <select
                  value={selectedTask.status}
                  onChange={(e) => handleStatusChange(selectedTask.id, e.target.value as TaskStatus)}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-white text-xs font-medium"
                >
                  <option value={TaskStatus.TODO}>To Do</option>
                  <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                  <option value={TaskStatus.BLOCKED}>Blocked</option>
                  <option value={TaskStatus.DONE}>Done</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Priority</label>
                <div className="text-xs font-bold text-white pt-1">{selectedTask.priority}</div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Assignee</label>
                <div className="text-xs font-medium text-slate-300 pt-1">
                  {selectedTask.assigneeName || 'Unassigned'}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Deadline</label>
                <div className="text-xs font-medium text-slate-300 pt-1">
                  {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString() : 'None'}
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                {selectedTask.description || 'No description provided.'}
              </p>
            </div>

            {/* Manager Guidance Points */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Manager Guidance Points</span>
                </h4>
                <span className="text-xs text-slate-500 font-mono">
                  {selectedTask.points?.filter((p) => p.isCompleted).length || 0}/
                  {selectedTask.points?.length || 0} Done
                </span>
              </div>

              <div className="space-y-2">
                {selectedTask.points && selectedTask.points.length > 0 ? (
                  selectedTask.points.map((pt) => (
                    <div
                      key={pt.id}
                      onClick={() => handleTogglePoint(pt.id)}
                      className={`p-3 rounded-lg border text-xs flex items-center gap-3 cursor-pointer transition-colors ${
                        pt.isCompleted
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-400 line-through'
                          : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={pt.isCompleted}
                        onChange={() => {}}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <span className="flex-1">{pt.content}</span>
                      <span className="text-[10px] text-slate-500">by {pt.authorName}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 p-3 bg-slate-950 rounded-lg border border-slate-800">
                    No manager guidance points added yet.
                  </div>
                )}
              </div>

              {user?.roleCode !== RoleCode.ROLE_EMPLOYEE && (
                <form onSubmit={handleAddPoint} className="flex gap-2">
                  <input
                    type="text"
                    value={newPointContent}
                    onChange={(e) => setNewPointContent(e.target.value)}
                    placeholder="Add guidance instruction for employee..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                  >
                    Add Point
                  </button>
                </form>
              )}
            </div>

            {/* Comments & Discussion */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                <span>Discussion ({selectedTask.comments?.length || 0})</span>
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedTask.comments && selectedTask.comments.length > 0 ? (
                  selectedTask.comments.map((c) => (
                    <div key={c.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-semibold text-slate-300">{c.authorName}</span>
                        <span className="text-[10px]">{new Date(c.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-slate-200">{c.content}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500">No comments yet.</div>
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newCommentContent}
                  onChange={(e) => setNewCommentContent(e.target.value)}
                  placeholder="Post a comment or update..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Comment
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
