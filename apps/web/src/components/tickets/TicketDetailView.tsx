import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  TaskDto,
  WorkItemStatus,
  RoleCode,
  WorkItemType,
} from '@workdesk/shared';
import { AcceptanceCriteriaList } from './AcceptanceCriteriaList';
import { GuidancePointsList } from './GuidancePointsList';
import { WorkEvidenceList } from './WorkEvidenceList';
import { DependencyWidget } from './DependencyWidget';
import {
  Calendar,
  User,
  Shield,
  AlertTriangle,
  GitBranch,
  ChevronRight,
  ArrowLeft,
  Send,
  Edit2,
  Save,
  X,
} from 'lucide-react';

export const TicketDetailView: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState<TaskDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [description, setDescription] = useState('');
  const [actualHours, setActualHours] = useState<number | ''>('');
  const [commentText, setCommentText] = useState('');

  // Status transition state
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [blockerInput, setBlockerInput] = useState('');
  const [showBlockerModal, setShowBlockerModal] = useState(false);

  const fetchTicket = async () => {
    if (!ticketId) return;
    try {
      const res = await fetch(`/api/v1/tasks/${ticketId}`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 404) {
          setError('Work item not found or you do not have permission to view it.');
        } else {
          setError('Failed to load work item.');
        }
        setIsLoading(false);
        return;
      }
      const data: TaskDto = await res.json();
      setTask(data);
      setTitle(data.title);
      setDescription(data.description || '');
      setActualHours(data.actualHours ?? '');
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || 'Error loading work item');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [ticketId]);

  const handleSaveTitle = async () => {
    if (!task || !title.trim()) return;
    try {
      const res = await fetch(`/api/v1/tasks/${task.ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: title.trim() }),
      });
      if (res.ok) {
        setIsEditingTitle(false);
        fetchTicket();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDesc = async () => {
    if (!task) return;
    try {
      const res = await fetch(`/api/v1/tasks/${task.ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ description: description.trim() || null }),
      });
      if (res.ok) {
        setIsEditingDesc(false);
        fetchTicket();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveHours = async () => {
    if (!task) return;
    const val = actualHours === '' ? undefined : Number(actualHours);
    try {
      const res = await fetch(`/api/v1/tasks/${task.ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ actualHours: val }),
      });
      if (res.ok) {
        fetchTicket();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusTransition = async (status: WorkItemStatus, blockerReason?: string) => {
    if (!task) return;
    setTransitionError(null);

    if (status === WorkItemStatus.BLOCKED && !blockerReason) {
      setShowBlockerModal(true);
      return;
    }

    try {
      const res = await fetch(`/api/v1/tasks/${task.ticketId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetStatus: status, blockerReason }),
      });

      if (!res.ok) {
        const data = await res.json();
        const msg =
          data.outstandingRequirements?.join('\n• ') || data.message || 'Transition rejected';
        setTransitionError(msg);
        return;
      }

      setShowBlockerModal(false);
      setBlockerInput('');
      fetchTicket();
    } catch (err: any) {
      setTransitionError(err.message || 'Failed to transition status');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !commentText.trim()) return;
    try {
      const res = await fetch(`/api/v1/tasks/${task.ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText('');
        fetchTicket();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono text-sm">
        Loading WorkDesk Ticket Cockpit...
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Access Restricted or Not Found</h2>
        <p className="text-slate-400 max-w-md mb-6 text-sm">{error}</p>
        <button
          onClick={() => navigate('/tasks')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Work Items
        </button>
      </div>
    );
  }

  const canEdit =
    task.assigneeId === user?.id ||
    task.creatorId === user?.id ||
    user?.roleCode !== RoleCode.ROLE_EMPLOYEE;

  // Permissible Next Transitions based on canonical state machine
  const getNextTransitions = (current: WorkItemStatus): WorkItemStatus[] => {
    switch (current) {
      case WorkItemStatus.DRAFT:
        return [WorkItemStatus.TODO, WorkItemStatus.CANCELLED];
      case WorkItemStatus.TODO:
        return [WorkItemStatus.IN_PROGRESS, WorkItemStatus.BLOCKED, WorkItemStatus.CANCELLED];
      case WorkItemStatus.IN_PROGRESS:
        return [
          WorkItemStatus.IN_REVIEW,
          WorkItemStatus.DONE,
          WorkItemStatus.BLOCKED,
          WorkItemStatus.TODO,
          WorkItemStatus.CANCELLED,
        ];
      case WorkItemStatus.BLOCKED:
        return [WorkItemStatus.TODO, WorkItemStatus.IN_PROGRESS, WorkItemStatus.CANCELLED];
      case WorkItemStatus.IN_REVIEW:
        return [WorkItemStatus.APPROVED, WorkItemStatus.CHANGES_REQUESTED, WorkItemStatus.BLOCKED];
      case WorkItemStatus.CHANGES_REQUESTED:
        return [WorkItemStatus.IN_PROGRESS, WorkItemStatus.BLOCKED, WorkItemStatus.CANCELLED];
      case WorkItemStatus.APPROVED:
        return [WorkItemStatus.DONE, WorkItemStatus.IN_PROGRESS, WorkItemStatus.CANCELLED];
      case WorkItemStatus.DONE:
      case WorkItemStatus.CANCELLED:
        return user?.roleCode !== RoleCode.ROLE_EMPLOYEE ? [WorkItemStatus.REOPENED] : [];
      case WorkItemStatus.REOPENED:
        return [WorkItemStatus.TODO, WorkItemStatus.IN_PROGRESS];
      default:
        return [];
    }
  };

  const nextTransitions = getNextTransitions(task.status);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Cockpit Header Bar */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-30 px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <button
              onClick={() => navigate('/tasks')}
              className="hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Tasks
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-slate-300 font-semibold">{task.projectName || 'Project'}</span>
            {task.parentTicketId && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                <button
                  onClick={() => navigate(`/tasks/${task.parentTicketId}`)}
                  className="text-indigo-400 hover:underline"
                >
                  {task.parentTicketId}
                </button>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-white font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {task.ticketId}
            </span>
          </div>

          {/* Quick Actions / Status Indicator */}
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider font-mono border ${
                task.status === WorkItemStatus.DONE
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : task.status === WorkItemStatus.BLOCKED
                  ? 'bg-rose-950 text-rose-400 border-rose-800'
                  : task.status === WorkItemStatus.IN_PROGRESS
                  ? 'bg-blue-950 text-blue-400 border-blue-800'
                  : task.status === WorkItemStatus.IN_REVIEW
                  ? 'bg-purple-950 text-purple-400 border-purple-800'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {task.status}
            </span>
          </div>
        </div>
      </div>

      {/* Done Gate / Transition Error Banner */}
      {transitionError && (
        <div className="bg-rose-950/80 border-b border-rose-800 px-6 py-3 flex items-start justify-between text-xs text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Transition Blocked:</span>
              <pre className="font-sans whitespace-pre-wrap">{transitionError}</pre>
            </div>
          </div>
          <button
            onClick={() => setTransitionError(null)}
            className="text-rose-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Blocker Alert Banner */}
      {task.status === WorkItemStatus.BLOCKED && task.blockerReason && (
        <div className="bg-rose-950/40 border-b border-rose-900/60 px-6 py-2.5 flex items-center gap-3 text-xs text-rose-300">
          <Shield className="w-4 h-4 text-rose-500 shrink-0" />
          <div>
            <span className="font-semibold text-rose-400">Active Blocker: </span>
            <span>{task.blockerReason}</span>
          </div>
        </div>
      )}

      {/* Main Dual-Rail Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Primary Content Rail (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Title Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/40">
                {task.type}
              </span>
              <span className="text-xs text-slate-500 font-mono">Created on {new Date(task.createdAt).toLocaleDateString()}</span>
            </div>

            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-lg font-bold text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSaveTitle}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="text-slate-400 hover:text-white p-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between group">
                <h1 className="text-2xl font-bold text-white tracking-tight leading-snug">
                  {task.title}
                </h1>
                {canEdit && (
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity p-1 ml-2"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Description Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm tracking-wide">Description</h3>
              {canEdit && !isEditingDesc && (
                <button
                  onClick={() => setIsEditingDesc(true)}
                  className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
            </div>

            {isEditingDesc ? (
              <div className="space-y-3">
                <textarea
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide comprehensive details, context, and operational requirements..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditingDesc(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDesc}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg"
                  >
                    Save Description
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {task.description || (
                  <span className="text-slate-500 italic">No description provided for this work item.</span>
                )}
              </div>
            )}
          </div>

          {/* Subtasks Hierarchy List (If not a subtask) */}
          {task.type !== WorkItemType.SUBTASK && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-semibold text-white text-sm tracking-wide">Child Subtasks</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {task.subTasks?.length || 0}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {(!task.subTasks || task.subTasks.length === 0) ? (
                  <p className="text-xs text-slate-500 italic py-1">No child subtasks linked.</p>
                ) : (
                  task.subTasks.map((st) => (
                    <div
                      key={st.id}
                      onClick={() => navigate(`/tasks/${st.ticketId}`)}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-indigo-400 font-semibold">
                          {st.ticketId}
                        </span>
                        <span className="text-sm text-white">{st.title}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {st.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Acceptance Criteria Checklist */}
          <AcceptanceCriteriaList
            ticketId={task.ticketId}
            criteria={task.acceptanceCriteria || []}
            onRefresh={fetchTicket}
            canEdit={canEdit}
          />

          {/* Lead & Manager Guidance Directives */}
          <GuidancePointsList
            ticketId={task.ticketId}
            points={task.points || []}
            userRole={user?.roleCode}
            onRefresh={fetchTicket}
          />

          {/* Work Evidence & Proof */}
          <WorkEvidenceList
            ticketId={task.ticketId}
            evidence={task.evidence || []}
            onRefresh={fetchTicket}
            canEdit={canEdit}
          />

          {/* Dependencies Widget */}
          <DependencyWidget
            ticketId={task.ticketId}
            dependencies={task.dependencies || []}
            inverseDependencies={task.inverseDependencies || []}
            onRefresh={fetchTicket}
            canEdit={canEdit}
          />

          {/* Comments & Activity Stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-white text-sm tracking-wide">Activity & Discussion</h3>

            {/* Comment List */}
            <div className="space-y-3">
              {(!task.comments || task.comments.length === 0) ? (
                <p className="text-xs text-slate-500 italic py-2">No comments or activity notes yet.</p>
              ) : (
                task.comments.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-indigo-400 font-semibold">{c.authorName || 'User'}</span>
                      <span className="text-slate-500">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Post a comment or update..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Post
              </button>
            </form>
          </div>
        </div>

        {/* Right Metadata & Controls Rail (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Status Transition Control Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Workflow Transition
            </h4>
            <div className="space-y-2">
              {nextTransitions.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No further status transitions permitted.</p>
              ) : (
                nextTransitions.map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusTransition(st)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-between border ${
                      st === WorkItemStatus.DONE
                        ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/60'
                        : st === WorkItemStatus.BLOCKED
                        ? 'bg-rose-950/60 border-rose-800/60 text-rose-400 hover:bg-rose-900/60'
                        : st === WorkItemStatus.IN_REVIEW
                        ? 'bg-purple-950/60 border-purple-800/60 text-purple-400 hover:bg-purple-900/60'
                        : st === WorkItemStatus.APPROVED
                        ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/50'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>Transition to {st}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* People & Accountability */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              People & Ownership
            </h4>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Assignee</span>
              <div className="flex items-center gap-1.5 font-medium text-white">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>{task.assigneeName || 'Unassigned'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Reporter / Creator</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>{task.creatorName || 'System'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Review Gate</span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                  task.requiresReview
                    ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {task.requiresReview ? 'Lead Approval Required' : 'Standard'}
              </span>
            </div>
          </div>

          {/* Time Tracking & Planning */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Planning & Time
            </h4>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Estimated Effort</span>
              <span className="font-mono text-white">
                {task.estimatedHours !== null && task.estimatedHours !== undefined
                  ? `${task.estimatedHours}h`
                  : 'Not estimated'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Actual Hours Logged</span>
              {canEdit ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={actualHours}
                    onChange={(e) => setActualHours(e.target.value === '' ? '' : Number(e.target.value))}
                    onBlur={handleSaveHours}
                    placeholder="0"
                    className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-right text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-slate-500">h</span>
                </div>
              ) : (
                <span className="font-mono text-white">{task.actualHours || 0}h</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Deadline</span>
              <div className="flex items-center gap-1.5 font-mono text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{task.deadline ? new Date(task.deadline).toLocaleDateString() : 'None'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Urgency Health</span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${
                  task.urgency === 'Red' || task.urgency === 'Overdue'
                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                    : task.urgency === 'Yellow'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                }`}
              >
                {task.urgency}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Blocker Reason Modal */}
      {showBlockerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base text-white">Transition to BLOCKED</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              To flag this work item as blocked, provide the exact operational impediment or dependency waiting for resolution.
            </p>
            <textarea
              rows={3}
              value={blockerInput}
              onChange={(e) => setBlockerInput(e.target.value)}
              placeholder="e.g. Waiting on third-party API keys from Client team..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowBlockerModal(false);
                  setBlockerInput('');
                }}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!blockerInput.trim()}
                onClick={() => handleStatusTransition(WorkItemStatus.BLOCKED, blockerInput.trim())}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg"
              >
                Confirm Blocked
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
