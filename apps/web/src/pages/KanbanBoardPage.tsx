import React, { useEffect, useState, useMemo } from 'react';
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
  Search,
  ArrowUpDown,
  CheckCircle2,
  Plus,
  Calendar,
  Flag,
  Tag,
  AlignLeft,
  SlidersHorizontal,
  User,
  Users,
} from 'lucide-react';

interface ExtendedUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  roleCode?: string;
}

export const KanbanBoardPage: React.FC = () => {
  const { projectId = 'default', boardId } = useParams<{ projectId: string; boardId?: string }>();
  const { user } = useAuth();

  const [activeBoard, setActiveBoard] = useState<BoardDto | null>(null);
  const [boardsList, setBoardsList] = useState<BoardDto[]>([]);
  const [columnsData, setColumnsData] = useState<
    (BoardColumnDto & { isWipExceeded: boolean; tasks: any[] })[]
  >([]);
  const [allUsers, setAllUsers] = useState<ExtendedUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [hideClosed, setHideClosed] = useState(false);
  const [sortBy, setSortBy] = useState<'rank' | 'date' | 'priority'>('rank');

  // Assignee Filter Modal state (Image 3)
  const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');

  // Quick "+ Add Task" Modal state
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskColumnId, setNewTaskColumnId] = useState('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<string>('Normal');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

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

  // Load users for assignee filter modal
  useEffect(() => {
    fetch('/api/v1/users', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAllUsers(data))
      .catch(console.error);
  }, []);

  const loadBoards = async () => {
    try {
      setLoading(true);
      let targetProjId = projectId;
      if (projectId === 'default') {
        const pRes = await fetch('/api/v1/tasks', { credentials: 'include' });
        const pData = await pRes.json();
        const items: TaskDto[] = pData.items || [];
        if (items.length > 0 && items[0].projectId) {
          targetProjId = items[0].projectId;
        } else {
          // fetch projects list if no tasks
          const projRes = await fetch('/api/v1/projects', { credentials: 'include' });
          if (projRes.ok) {
            const projects = await projRes.json();
            const list = Array.isArray(projects) ? projects : projects.items || [];
            if (list.length > 0) {
              targetProjId = list[0].id;
            }
          }
        }
      }

      // Fetch boards for project
      const res = await fetch(`/api/v1/boards/projects/${targetProjId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const boards: BoardDto[] = await res.json();
        setBoardsList(boards);

        const current = boardId ? boards.find((b) => b.id === boardId) : boards[0];
        if (current) {
          setActiveBoard(current);
          await loadBoardTasks(current.id);
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

  // All tasks on the board across all columns
  const allBoardTasks = useMemo(() => {
    const list: any[] = [];
    columnsData.forEach((col) => {
      if (col.tasks) list.push(...col.tasks);
    });
    return list;
  }, [columnsData]);

  // Calculate task counts per assignee for Image 3 modal
  const assigneeTaskCounts = useMemo(() => {
    const counts: Record<string, number> = { unassigned: 0 };
    allBoardTasks.forEach((t) => {
      if (t.assigneeId) {
        counts[t.assigneeId] = (counts[t.assigneeId] || 0) + 1;
      } else {
        counts.unassigned = (counts.unassigned || 0) + 1;
      }
    });
    return counts;
  }, [allBoardTasks]);

  // Filtered columns based on selected assignees and search query
  const displayColumns = useMemo(() => {
    return columnsData
      .filter((col) => {
        if (hideClosed && col.mappedStatuses.includes(WorkItemStatus.DONE)) {
          return false;
        }
        return true;
      })
      .map((col) => {
        let tasks = [...col.tasks];

        // 1. Assignee filtering
        if (selectedAssigneeIds.length > 0) {
          tasks = tasks.filter((t) => {
            if (selectedAssigneeIds.includes('unassigned') && !t.assigneeId) {
              return true;
            }
            return t.assigneeId && selectedAssigneeIds.includes(t.assigneeId);
          });
        }

        // 2. Search query filtering
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          tasks = tasks.filter(
            (t) =>
              t.title?.toLowerCase().includes(q) ||
              t.ticketId?.toLowerCase().includes(q) ||
              t.assigneeName?.toLowerCase().includes(q),
          );
        }

        // 3. Sorting
        if (sortBy === 'date') {
          tasks.sort((a, b) => {
            const dateA = a.deadline ? new Date(a.deadline).getTime() : 0;
            const dateB = b.deadline ? new Date(b.deadline).getTime() : 0;
            return dateA - dateB;
          });
        } else if (sortBy === 'priority') {
          const pOrder: Record<string, number> = { Critical: 0, High: 1, Normal: 2, Medium: 2, Low: 3 };
          tasks.sort((a, b) => (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4));
        }

        return {
          ...col,
          tasks,
        };
      });
  }, [columnsData, selectedAssigneeIds, searchQuery, hideClosed, sortBy]);

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
        loadBoardTasks(activeBoard.id);
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

  // Open Add Task Modal
  const openAddTaskModal = (colId?: string) => {
    setNewTaskTitle('');
    setNewTaskColumnId(colId || (columnsData.length > 0 ? columnsData[0].id : ''));
    setNewTaskAssigneeId('');
    setNewTaskPriority('Normal');
    setNewTaskDeadline('');
    setIsAddTaskModalOpen(true);
  };

  // Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeBoard) return;

    try {
      setCreatingTask(true);
      const col = columnsData.find((c) => c.id === newTaskColumnId);
      const initialStatus = col?.mappedStatuses?.[0] || 'TODO';

      const res = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          projectId: activeBoard.projectId,
          assigneeId: newTaskAssigneeId || undefined,
          priority: newTaskPriority,
          status: initialStatus,
          deadline: newTaskDeadline ? new Date(newTaskDeadline).toISOString() : undefined,
        }),
      });

      if (res.ok) {
        setIsAddTaskModalOpen(false);
        loadBoardTasks(activeBoard.id);
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Failed to create task');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create task');
    } finally {
      setCreatingTask(false);
    }
  };

  // Assignee selection toggle
  const toggleAssignee = (id: string) => {
    if (selectedAssigneeIds.includes(id)) {
      setSelectedAssigneeIds(selectedAssigneeIds.filter((item) => item !== id));
    } else {
      setSelectedAssigneeIds([...selectedAssigneeIds, id]);
    }
  };

  // Select a single particular employee (or toggle off)
  const selectSingleAssignee = (id: string) => {
    if (selectedAssigneeIds.length === 1 && selectedAssigneeIds[0] === id) {
      setSelectedAssigneeIds([]);
    } else {
      setSelectedAssigneeIds([id]);
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-600 text-white',
      'bg-amber-600 text-white',
      'bg-emerald-600 text-white',
      'bg-purple-600 text-white',
      'bg-cyan-600 text-white',
      'bg-rose-600 text-white',
      'bg-indigo-600 text-white',
      'bg-orange-600 text-white',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const formatDueDate = (deadline?: string | null) => {
    if (!deadline) return null;
    const d = new Date(deadline);
    if (isNaN(d.getTime())) return null;

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear();

    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

    if (isToday) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const getColumnPill = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('progress')) {
      return {
        pill: 'bg-indigo-600 text-white',
        dot: 'bg-indigo-400',
        badge: 'text-indigo-400',
      };
    }
    if (n.includes('review')) {
      return {
        pill: 'bg-amber-600 text-white',
        dot: 'bg-amber-400',
        badge: 'text-amber-400',
      };
    }
    if (n.includes('done') || n.includes('completed')) {
      return {
        pill: 'bg-slate-950 text-white border border-slate-700',
        dot: 'bg-emerald-400',
        badge: 'text-emerald-400',
      };
    }
    if (n.includes('block')) {
      return {
        pill: 'bg-purple-700 text-white',
        dot: 'bg-purple-300',
        badge: 'text-purple-300',
      };
    }
    return {
      pill: 'bg-blue-600 text-white',
      dot: 'bg-blue-400',
      badge: 'text-blue-400',
    };
  };

  // Filtered users in Image 3 modal search
  const filteredModalUsers = useMemo(() => {
    if (!assigneeSearchQuery.trim()) return allUsers;
    const q = assigneeSearchQuery.toLowerCase();
    return allUsers.filter(
      (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [allUsers, assigneeSearchQuery]);

  // Selected assignee display name for toolbar badge
  const selectedAssigneeSummary = useMemo(() => {
    if (selectedAssigneeIds.length === 0) return null;
    if (selectedAssigneeIds.length === 1) {
      if (selectedAssigneeIds[0] === 'unassigned') return 'Unassigned';
      const u = allUsers.find((x) => x.id === selectedAssigneeIds[0]);
      return u?.fullName || '1 Selected';
    }
    return `${selectedAssigneeIds.length} Assignees`;
  }, [selectedAssigneeIds, allUsers]);

  if (loading || !activeBoard) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-sm animate-pulse">
        Loading Agile Kanban Board...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ========================================================================= */}
      {/* AGILE KANBAN TOP TOOLBAR (IMAGE 2)                                         */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl backdrop-blur-md">
        {/* Left Side: Board / Group Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 mr-2">
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Columns className="w-5 h-5 text-indigo-400" />
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
                className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {boardsList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/40 text-indigo-300 border border-indigo-800/50 text-xs font-semibold select-none">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Group: Status</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 select-none">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Subtasks</span>
          </div>
        </div>

        {/* Right Side Toolbar Actions (Sort, Filter, Closed, Assignee, Search, + Add Task) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort Button */}
          <button
            onClick={() => {
              if (sortBy === 'rank') setSortBy('date');
              else if (sortBy === 'date') setSortBy('priority');
              else setSortBy('rank');
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title={`Current sort: ${sortBy}`}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Sort: {sortBy === 'rank' ? 'Default' : sortBy === 'date' ? 'Due Date' : 'Priority'}</span>
          </button>

          {/* Filter Closed Toggle */}
          <button
            onClick={() => setHideClosed(!hideClosed)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              hideClosed
                ? 'bg-indigo-950/50 border-indigo-700/60 text-indigo-300'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{hideClosed ? 'Closed Hidden' : 'Closed'}</span>
          </button>

          {/* Assignee Filter Button (Opens Image 3 Modal) */}
          <div className="relative">
            <button
              onClick={() => setIsAssigneeModalOpen(!isAssigneeModalOpen)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                selectedAssigneeIds.length > 0
                  ? 'bg-amber-950/50 border-amber-600/60 text-amber-200 shadow-sm shadow-amber-600/20'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Assignee</span>
              {selectedAssigneeSummary ? (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
                  {selectedAssigneeSummary}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">All</span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* + Add Task Button */}
          <button
            onClick={() => openAddTaskModal()}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Active Filter Chips Banner */}
      {selectedAssigneeIds.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/20 border border-amber-800/30 rounded-xl text-xs text-amber-300">
          <span className="font-semibold">Filtering by Assignee:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {selectedAssigneeIds.map((id) => {
              const label =
                id === 'unassigned' ? 'Unassigned' : allUsers.find((u) => u.id === id)?.fullName || id;
              return (
                <span
                  key={id}
                  className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[11px] flex items-center gap-1"
                >
                  <span>{label}</span>
                  <button onClick={() => toggleAssignee(id)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            <button
              onClick={() => setSelectedAssigneeIds([])}
              className="text-[11px] text-amber-400 hover:text-white underline ml-1 cursor-pointer"
            >
              Reset to All Employees
            </button>
          </div>
        </div>
      )}

      {/* Error alert toast */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* KANBAN CANVAS COLUMNS (IMAGE 2)                                           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-start overflow-x-auto pb-6">
        {displayColumns.map((column) => {
          const isDoneCol = column.mappedStatuses.includes(WorkItemStatus.DONE);
          const isExceeded = column.isWipExceeded && !isDoneCol;
          const style = getColumnPill(column.name);

          return (
            <div
              key={column.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropToColumn(column.id)}
              className="bg-slate-900/40 border border-slate-800/90 rounded-2xl flex flex-col min-w-[270px] max-h-[84vh] shadow-lg shadow-black/20"
            >
              {/* Column Header with Pill Badge (Image 2 style) */}
              <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm ${style.pill}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${style.dot} animate-pulse`} />
                    <span>{column.name}</span>
                    <span className="bg-black/30 px-1.5 py-0.2 rounded-full text-[11px]">
                      {column.tasks.length}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {column.wipLimit > 0 && (
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                        isExceeded
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      max {column.wipLimit}
                    </span>
                  )}
                  {isExceeded && (
                    <span title="WIP limit exceeded">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    </span>
                  )}
                </div>
              </div>

              {/* Cards Container */}
              <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-[350px]">
                {column.tasks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-600 font-mono border border-dashed border-slate-800/80 rounded-xl">
                    No tasks in this column
                  </div>
                ) : (
                  column.tasks.map((task: any) => {
                    const assigneeInitial = getInitials(task.assigneeName);
                    const avatarBg = task.assigneeName
                      ? getAvatarColor(task.assigneeName)
                      : 'bg-slate-800 text-slate-400';
                    const dueFormatted = formatDueDate(task.deadline);

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleCardDragStart(task.ticketId)}
                        className="p-3.5 bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl hover:shadow-lg transition-all cursor-grab active:cursor-grabbing group space-y-2.5 shadow-sm"
                      >
                        {/* Task Title (Image 1 style) */}
                        <div className="space-y-1">
                          <Link
                            to={`/tasks/${task.ticketId}`}
                            className="block text-sm font-semibold text-white hover:text-indigo-300 leading-snug line-clamp-2"
                          >
                            {task.title}
                          </Link>
                          {/* Description indicator (Image 1) */}
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <AlignLeft className="w-3 h-3" />
                            <span className="font-mono text-[10px] text-slate-400">
                              {task.ticketId}
                            </span>
                          </div>
                        </div>

                        {/* Blocker alert badge if blocked */}
                        {task.blockerReason && (
                          <div className="p-1.5 bg-rose-950/40 border border-rose-800/40 rounded-lg text-[11px] text-rose-300 flex items-center gap-1.5">
                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span className="truncate">{task.blockerReason}</span>
                          </div>
                        )}

                        {/* Metadata row (Image 1 style: Avatar + Due Date + Flag + Tag) */}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60 flex-wrap">
                          {/* Assignee Avatar (Image 1: KS circle) */}
                          <div
                            title={task.assigneeName || 'Unassigned'}
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shadow-sm shrink-0 ${avatarBg}`}
                          >
                            {assigneeInitial}
                          </div>

                          {/* Due Date Badge (Image 1: 📅 Today, 5:00 pm) */}
                          {dueFormatted && (
                            <div className="px-2 py-0.5 rounded-md border border-slate-700/60 bg-slate-800/50 text-[11px] text-amber-300/90 font-medium flex items-center gap-1.5 shadow-sm">
                              <Calendar className="w-3 h-3 text-amber-400" />
                              <span>{dueFormatted}</span>
                            </div>
                          )}

                          {/* Priority Flag Badge (Image 1: 🚩 Normal) */}
                          <div
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-medium flex items-center gap-1 shadow-sm ${
                              task.priority === 'Critical'
                                ? 'border-rose-500/40 bg-rose-950/30 text-rose-300'
                                : task.priority === 'High'
                                ? 'border-amber-500/40 bg-amber-950/30 text-amber-300'
                                : 'border-slate-700/60 bg-slate-800/50 text-slate-300'
                            }`}
                          >
                            <Flag
                              className={`w-3 h-3 ${
                                task.priority === 'Critical'
                                  ? 'text-rose-400'
                                  : task.priority === 'High'
                                  ? 'text-amber-400'
                                  : 'text-indigo-400'
                              }`}
                            />
                            <span>{task.priority || 'Normal'}</span>
                          </div>

                          {/* Tag Icon (Image 1) */}
                          <div
                            title={task.type || 'Task'}
                            className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <Tag className="w-3 h-3" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Column Footer: + Add Task button (Image 2 style) */}
              <div className="p-2.5 border-t border-slate-800/80">
                <button
                  onClick={() => openAddTaskModal(column.id)}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/70 border border-dashed border-slate-800 hover:border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* ASSIGNEES FILTER MODAL (IMAGE 3)                                          */}
      {/* ========================================================================= */}
      {isAssigneeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-base text-white">Assignees</h3>
              </div>
              <button
                onClick={() => setIsAssigneeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input (Image 3) */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by user or team"
                value={assigneeSearchQuery}
                onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* People List Section */}
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                <span>People ({filteredModalUsers.length + 1})</span>
                {selectedAssigneeIds.length > 0 && (
                  <button
                    onClick={() => setSelectedAssigneeIds([])}
                    className="text-amber-400 lowercase hover:underline font-normal text-[11px] cursor-pointer"
                  >
                    view all
                  </button>
                )}
              </div>

              {/* Unassigned Option (Image 3) */}
              <div
                className={`group flex items-center justify-between p-2.5 rounded-xl transition-colors cursor-pointer ${
                  selectedAssigneeIds.includes('unassigned')
                    ? 'bg-amber-950/40 border border-amber-600/40'
                    : 'hover:bg-slate-800/50'
                }`}
              >
                <div
                  onClick={() => toggleAssignee('unassigned')}
                  className="flex items-center gap-2.5 flex-1 min-w-0"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-xs">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-medium text-slate-200">Unassigned</span>
                  <span className="text-xs text-slate-500 font-mono">
                    {assigneeTaskCounts.unassigned || 0}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectSingleAssignee('unassigned');
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-amber-400 hover:text-amber-200 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 transition-opacity"
                    title="View only unassigned tasks"
                  >
                    only
                  </button>
                  <input
                    type="checkbox"
                    checked={selectedAssigneeIds.includes('unassigned')}
                    onChange={() => toggleAssignee('unassigned')}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Employees List (Image 3) */}
              {filteredModalUsers.map((person) => {
                const count = assigneeTaskCounts[person.id] || 0;
                const isSelected = selectedAssigneeIds.includes(person.id);
                const color = getAvatarColor(person.fullName);
                const initials = getInitials(person.fullName);

                return (
                  <div
                    key={person.id}
                    className={`group flex items-center justify-between p-2.5 rounded-xl transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-950/40 border border-amber-600/40'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div
                      onClick={() => toggleAssignee(person.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0"
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${color}`}
                      >
                        {initials}
                      </div>
                      <span className="text-xs font-medium text-white truncate max-w-[170px]">
                        {person.fullName}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">{count}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectSingleAssignee(person.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-amber-400 hover:text-amber-200 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 transition-opacity"
                        title="View only this employee"
                      >
                        only
                      </button>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAssignee(person.id)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Teams Section (Image 3) */}
            <div className="pt-2 border-t border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2">
                Teams 0
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedAssigneeIds([]);
                  setIsAssigneeModalOpen(false);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                View All
              </button>
              <button
                type="button"
                onClick={() => setIsAssigneeModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold shadow-md shadow-amber-600/20"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK "+ ADD TASK" MODAL                                                 */}
      {/* ========================================================================= */}
      {isAddTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTask}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">Create New Task</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTaskModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Task Title *</label>
              <input
                type="text"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. Design Digital Brochure"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Initial Column / Status</label>
                <select
                  value={newTaskColumnId}
                  onChange={(e) => setNewTaskColumnId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {columnsData.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Priority</label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Assignee</label>
                <select
                  value={newTaskAssigneeId}
                  onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Due Date</label>
                <input
                  type="datetime-local"
                  value={newTaskDeadline}
                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAddTaskModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingTask}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30"
              >
                {creatingTask ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HARD WIP LIMIT OVERRIDE MODAL                                             */}
      {/* ========================================================================= */}
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
                Column <strong>&quot;{pendingMove.columnName}&quot;</strong> has reached its configured hard
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
