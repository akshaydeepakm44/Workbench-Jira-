import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BoardDto,
  BoardColumnDto,
  TaskDto,
  RoleCode,
  WorkItemStatus,
  WipLimitType,
} from '@workdesk/shared';
import {
  Columns,
  Layers,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  X,
} from 'lucide-react';

export const KanbanBoardPage: React.FC = () => {
  const { projectId = 'default', boardId } = useParams<{ projectId: string; boardId?: string }>();
  const { user } = useAuth();

  const [activeBoard, setActiveBoard] = useState<BoardDto | null>(null);
  const [boardsList, setBoardsList] = useState<BoardDto[]>([]);
  const [columnsData, setColumnsData] = useState<
    (BoardColumnDto & { isWipExceeded: boolean; tasks: TaskDto[] })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [swimlaneMode, setSwimlaneMode] = useState<'none' | 'assignee' | 'priority'>('none');

  // Dragging state
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);

  // WIP Override Modal state
  const [isWipOverrideModalOpen, setIsWipOverrideModalOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    targetColumnId: string;
    ticketId: string;
    columnName: string;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  // Error alert
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLeadOrManager =
    user?.roleCode === RoleCode.ROLE_MANAGER || user?.roleCode === RoleCode.ROLE_LEAD;

  const loadBoards = async () => {
    try {
      setLoading(true);
      // Resolve project ID if default
      let targetProjId = projectId;
      if (projectId === 'default') {
        const pRes = await fetch('/api/v1/tasks', { credentials: 'include' });
        const pData = await pRes.json();
        const items: TaskDto[] = pData.items || [];
        if (items.length > 0 && items[0].projectId) {
          targetProjId = items[0].projectId;
        }
      }

      // Fetch boards
      const res = await fetch(`/api/v1/boards/projects/${targetProjId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const boards: BoardDto[] = await res.json();
        setBoardsList(boards);

        const current = boardId ? boards.find((b) => b.id === boardId) : boards[0];
        if (current) {
          setActiveBoard(current);
          loadBoardTasks(current.id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBoardTasks = async (bId: string) => {
    try {
      const res = await fetch(`/api/v1/boards/${bId}/tasks`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setColumnsData(data.columns || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadBoards();
  }, [projectId, boardId]);

  const handleCardDragStart = (ticketId: string) => {
    setDraggedTicketId(ticketId);
  };

  const handleDropToColumn = async (targetColumnId: string) => {
    if (!draggedTicketId || !activeBoard) return;

    const column = columnsData.find((c) => c.id === targetColumnId);
    if (!column) return;

    // Check if hard WIP limit is hit
    if (
      column.wipLimit > 0 &&
      (column.taskCount || 0) >= column.wipLimit &&
      column.wipLimitType === WipLimitType.HARD_LIMIT &&
      !column.mappedStatuses.includes(WorkItemStatus.DONE)
    ) {
      if (isLeadOrManager) {
        setPendingMove({
          targetColumnId,
          ticketId: draggedTicketId,
          columnName: column.name,
        });
        setIsWipOverrideModalOpen(true);
      } else {
        setErrorMessage(
          `Column WIP limit reached: "${column.name}" is capped at ${column.wipLimit} items. Only Leads and Managers can override hard WIP limits.`,
        );
      }
      setDraggedTicketId(null);
      return;
    }

    await executeCardMove(draggedTicketId, targetColumnId);
    setDraggedTicketId(null);
  };

  const executeCardMove = async (
    ticketId: string,
    targetColumnId: string,
    overrideWip = false,
    reason?: string,
  ) => {
    if (!activeBoard) return;

    try {
      const res = await fetch(
        `/api/v1/boards/${activeBoard.id}/tasks/${ticketId}/move`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            targetColumnId,
            overrideWipLimit: overrideWip,
            overrideReason: reason,
          }),
        },
      );

      if (res.ok) {
        setErrorMessage(null);
        loadBoardTasks(activeBoard.id);
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Transition blocked by workflow engine');
        loadBoardTasks(activeBoard.id); // Rollback visual position
      }
    } catch (err) {
      console.error(err);
      loadBoardTasks(activeBoard.id);
    }
  };

  const handleConfirmWipOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingMove || overrideReason.trim().length < 10) return;

    await executeCardMove(pendingMove.ticketId, pendingMove.targetColumnId, true, overrideReason);
    setIsWipOverrideModalOpen(false);
    setPendingMove(null);
    setOverrideReason('');
  };

  if (loading || !activeBoard) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-sm animate-pulse">
        Loading Agile Kanban Board...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Columns className="w-6 h-6 text-indigo-400" />
                <span>{activeBoard.name}</span>
              </h1>
              {boardsList.length > 1 && (
                <select
                  value={activeBoard.id}
                  onChange={(e) => {
                    const selected = boardsList.find((b) => b.id === e.target.value);
                    if (selected) {
                      setActiveBoard(selected);
                      loadBoardTasks(selected.id);
                    }
                  }}
                  className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
                >
                  {boardsList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.type})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {activeBoard.type}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Governed workflow transitions with server-side Done Gate enforcement and WIP management.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Swimlane selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <span className="text-slate-500 px-2 font-medium">Swimlanes:</span>
            <button
              onClick={() => setSwimlaneMode('none')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                swimlaneMode === 'none'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              None
            </button>
            <button
              onClick={() => setSwimlaneMode('priority')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                swimlaneMode === 'priority'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Priority
            </button>
            <button
              onClick={() => setSwimlaneMode('assignee')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                swimlaneMode === 'assignee'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Assignee
            </button>
          </div>

          <Link
            to={`/projects/${activeBoard.projectId}/backlog`}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors border border-slate-700"
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Backlog</span>
          </Link>
        </div>
      </div>

      {/* Error alert toast */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between text-sm text-rose-300">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Kanban Canvas Columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-start overflow-x-auto pb-6">
        {columnsData.map((column) => {
          const isDoneCol = column.mappedStatuses.includes(WorkItemStatus.DONE);
          const isExceeded = column.isWipExceeded && !isDoneCol;

          return (
            <div
              key={column.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropToColumn(column.id)}
              className="bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col min-w-[280px] max-h-[82vh]"
            >
              {/* Column Header */}
              <div
                className={`p-3.5 border-b flex items-center justify-between transition-colors ${
                  isExceeded
                    ? 'border-rose-500/40 bg-rose-950/20'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-200">{column.name}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold ${
                      isExceeded
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {column.tasks.length}
                    {column.wipLimit > 0 && ` / ${column.wipLimit}`}
                  </span>
                </div>

                {isExceeded && (
                  <span
                    title={
                      column.wipLimitType === WipLimitType.HARD_LIMIT
                        ? 'Hard WIP limit reached. Requires override.'
                        : 'WIP limit warning.'
                    }
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </span>
                )}
              </div>

              {/* Cards Container */}
              <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-[300px]">
                {column.tasks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-600 font-mono border border-dashed border-slate-800/80 rounded-lg">
                    No items in this column
                  </div>
                ) : (
                  column.tasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleCardDragStart(task.ticketId)}
                      className="p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl hover:border-indigo-500/40 transition-all shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing group space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/tasks/${task.ticketId}`}
                          className="font-mono text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
                        >
                          {task.ticketId}
                        </Link>
                        <div className="flex items-center gap-1.5">
                          {task.storyPoints !== null && task.storyPoints !== undefined && (
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {task.storyPoints}p
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                              task.priority === 'Critical'
                                ? 'bg-red-500/10 text-red-400'
                                : task.priority === 'High'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                      </div>

                      <div className="text-sm font-medium text-slate-200 line-clamp-2">
                        {task.title}
                      </div>

                      {task.blockerReason && (
                        <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded text-xs text-rose-300">
                          <strong>Blocker:</strong> {task.blockerReason}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                        <span className="truncate max-w-[140px]">
                          {task.assigneeName || 'Unassigned'}
                        </span>
                        {task.requiresReview && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px]">
                            Review Req
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* WIP Limit Override Modal */}
      {isWipOverrideModalOpen && pendingMove && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>Override Hard WIP Limit</span>
              </h3>
              <button onClick={() => setIsWipOverrideModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleConfirmWipOverride} className="space-y-4">
              <p className="text-sm text-slate-300">
                Column <strong>"{pendingMove.columnName}"</strong> has reached its configured hard
                WIP limit. As a Lead or Manager, you can override this limit by providing an
                auditable operational justification.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Override Justification * (Minimum 10 characters)
                </label>
                <textarea
                  required
                  minLength={10}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why this card must bypass the column capacity limit..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsWipOverrideModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideReason.trim().length < 10}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  Confirm Override & Move
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
