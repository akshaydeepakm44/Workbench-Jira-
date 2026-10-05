export enum RoleCode {
  ROLE_MANAGER = 'ROLE_MANAGER',
  ROLE_LEAD = 'ROLE_LEAD',
  ROLE_EMPLOYEE = 'ROLE_EMPLOYEE',
}

/** Legacy role code recognized ONLY for one-time database migration */
export const LEGACY_ROLE_SUPER_ADMIN = 'ROLE_SUPER_ADMIN';

export enum WorkItemHierarchyLevel {
  INITIATIVE = 'INITIATIVE',
  EPIC = 'EPIC',
  STANDARD = 'STANDARD',
  SUBTASK = 'SUBTASK',
}

export enum WorkItemType {
  INITIATIVE = 'INITIATIVE',
  EPIC = 'EPIC',
  STORY = 'STORY',
  TASK = 'TASK',
  BUG = 'BUG',
  REQUEST = 'REQUEST',
  IMPROVEMENT = 'IMPROVEMENT',
  ACTION_ITEM = 'ACTION_ITEM',
  SUBTASK = 'SUBTASK',
  MILESTONE = 'MILESTONE',
}

export enum WorkItemStatus {
  DRAFT = 'DRAFT',
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  IN_REVIEW = 'IN_REVIEW',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  APPROVED = 'APPROVED',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
  REOPENED = 'REOPENED',
}

/** Canonical backward-compatible alias pointing to single status authority */
export const TaskStatus = WorkItemStatus;
export type TaskStatus = WorkItemStatus;

export enum WorkItemPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical',
}

export enum WorkItemHealth {
  ON_TRACK = 'ON_TRACK',
  AT_RISK = 'AT_RISK',
  OFF_TRACK = 'OFF_TRACK',
}

export enum DependencyType {
  BLOCKS = 'BLOCKS',
  RELATES_TO = 'RELATES_TO',
  DUPLICATES = 'DUPLICATES',
}

export enum SprintStatus {
  PLANNED = 'PLANNED',
  FUTURE = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum BoardType {
  KANBAN = 'KANBAN',
  SCRUM = 'SCRUM',
}

export enum WipLimitType {
  WARNING = 'WARNING',
  HARD_LIMIT = 'HARD_LIMIT',
}

export enum EvidenceType {
  DOCUMENT = 'DOCUMENT',
  PULL_REQUEST = 'PULL_REQUEST',
  COMMUNICATION = 'COMMUNICATION',
  TEST_RUN = 'TEST_RUN',
  DEPLOYMENT = 'DEPLOYMENT',
}

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical',
}

export enum TaskUrgency {
  GREEN = 'Green',
  YELLOW = 'Yellow',
  RED = 'Red',
  OVERDUE = 'Overdue',
}

export enum Permission {
  VIEW_OWN_TASKS = 'view_own_tasks',
  VIEW_TEAM_TASKS = 'view_team_tasks',
  VIEW_ORG_TASKS = 'view_org_tasks',
  CREATE_TASK = 'create_task',
  UPDATE_TASK = 'update_task',
  TRANSITION_TASK = 'transition_task',
  MANAGE_ACCEPTANCE_CRITERIA = 'manage_acceptance_criteria',
  ADD_WORK_EVIDENCE = 'add_work_evidence',
  MANAGE_DEPENDENCIES = 'manage_dependencies',
  REPARENT_TASK = 'reparent_task',
  ASSIGN_TASK = 'assign_task',
  REVIEW_TASK = 'review_task',
  ADD_TASK_POINT = 'add_task_point',
  TOGGLE_TASK_POINT = 'toggle_task_point',
  VIEW_OWN_STANDUPS = 'view_own_standups',
  VIEW_TEAM_STANDUPS = 'view_team_standups',
  VIEW_ORG_STANDUPS = 'view_org_standups',
  CONVERT_BLOCKER_TASK = 'convert_blocker_task',
  CREATE_MEETING = 'create_meeting',
  CONVERT_ACTION_TASK = 'convert_action_task',
  VIEW_OWN_KPIS = 'view_own_kpis',
  VIEW_TEAM_KPIS = 'view_team_kpis',
  VIEW_ORG_KPIS = 'view_org_kpis',
  EXPORT_TEAM_REPORTS = 'export_team_reports',
  EXPORT_ORG_REPORTS = 'export_org_reports',
  MANAGE_USERS = 'manage_users',
  MANAGE_TEAMS = 'manage_teams',
  MANAGE_PROJECTS = 'manage_projects',
  MANAGE_WORKFLOWS = 'manage_workflows',
  MANAGE_INTEGRATIONS = 'manage_integrations',
  MANAGE_AUTOMATION = 'manage_automation',
  MANAGE_SYSTEM_SETTINGS = 'manage_system_settings',
  MANAGE_REPORTS = 'manage_reports',
  APPROVE_EMPLOYEES = 'approve_employees',
  PROMOTE_LEADS = 'promote_leads',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_SPRINTS = 'manage_sprints',
  MANAGE_BACKLOG = 'manage_backlog',
  MANAGE_BOARDS = 'manage_boards',
  MANAGE_CAPACITY = 'manage_capacity',
  MANAGE_ALL = 'manage_all',
}

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  [RoleCode.ROLE_MANAGER]: [
    Permission.VIEW_OWN_TASKS,
    Permission.VIEW_TEAM_TASKS,
    Permission.VIEW_ORG_TASKS,
    Permission.CREATE_TASK,
    Permission.UPDATE_TASK,
    Permission.TRANSITION_TASK,
    Permission.MANAGE_ACCEPTANCE_CRITERIA,
    Permission.ADD_WORK_EVIDENCE,
    Permission.MANAGE_DEPENDENCIES,
    Permission.REPARENT_TASK,
    Permission.ASSIGN_TASK,
    Permission.REVIEW_TASK,
    Permission.ADD_TASK_POINT,
    Permission.TOGGLE_TASK_POINT,
    Permission.VIEW_OWN_STANDUPS,
    Permission.VIEW_TEAM_STANDUPS,
    Permission.VIEW_ORG_STANDUPS,
    Permission.CONVERT_BLOCKER_TASK,
    Permission.CREATE_MEETING,
    Permission.CONVERT_ACTION_TASK,
    Permission.VIEW_OWN_KPIS,
    Permission.VIEW_TEAM_KPIS,
    Permission.VIEW_ORG_KPIS,
    Permission.EXPORT_TEAM_REPORTS,
    Permission.EXPORT_ORG_REPORTS,
    Permission.MANAGE_USERS,
    Permission.MANAGE_TEAMS,
    Permission.MANAGE_PROJECTS,
    Permission.MANAGE_WORKFLOWS,
    Permission.MANAGE_INTEGRATIONS,
    Permission.MANAGE_AUTOMATION,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_SYSTEM_SETTINGS,
    Permission.MANAGE_REPORTS,
    Permission.APPROVE_EMPLOYEES,
    Permission.PROMOTE_LEADS,
    Permission.MANAGE_SPRINTS,
    Permission.MANAGE_BACKLOG,
    Permission.MANAGE_BOARDS,
    Permission.MANAGE_CAPACITY,
    Permission.MANAGE_ALL,
  ],
  [RoleCode.ROLE_LEAD]: [
    Permission.VIEW_OWN_TASKS,
    Permission.VIEW_TEAM_TASKS,
    Permission.CREATE_TASK,
    Permission.UPDATE_TASK,
    Permission.TRANSITION_TASK,
    Permission.MANAGE_ACCEPTANCE_CRITERIA,
    Permission.ADD_WORK_EVIDENCE,
    Permission.MANAGE_DEPENDENCIES,
    Permission.REPARENT_TASK,
    Permission.ASSIGN_TASK,
    Permission.REVIEW_TASK,
    Permission.ADD_TASK_POINT,
    Permission.TOGGLE_TASK_POINT,
    Permission.VIEW_OWN_STANDUPS,
    Permission.VIEW_TEAM_STANDUPS,
    Permission.CONVERT_BLOCKER_TASK,
    Permission.CREATE_MEETING,
    Permission.CONVERT_ACTION_TASK,
    Permission.VIEW_OWN_KPIS,
    Permission.VIEW_TEAM_KPIS,
    Permission.EXPORT_TEAM_REPORTS,
    Permission.MANAGE_SPRINTS,
    Permission.MANAGE_BACKLOG,
    Permission.MANAGE_BOARDS,
    Permission.MANAGE_CAPACITY,
  ],
  [RoleCode.ROLE_EMPLOYEE]: [
    Permission.VIEW_OWN_TASKS,
    Permission.CREATE_TASK,
    Permission.UPDATE_TASK,
    Permission.TRANSITION_TASK,
    Permission.MANAGE_ACCEPTANCE_CRITERIA,
    Permission.ADD_WORK_EVIDENCE,
    Permission.MANAGE_DEPENDENCIES,
    Permission.ASSIGN_TASK,
    Permission.TOGGLE_TASK_POINT,
    Permission.VIEW_OWN_STANDUPS,
    Permission.CREATE_MEETING,
    Permission.VIEW_OWN_KPIS,
  ],
};

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  employeeId?: string | null;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedById?: string | null;
  approvedAt?: string | null;
  roleCode: RoleCode;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionResponse {
  user: UserDto;
  permissions: Permission[];
}

export interface AcceptanceCriterionDto {
  id: string;
  taskId: string;
  description: string;
  isMandatory: boolean;
  isCompleted: boolean;
  createdById: string;
  createdByName?: string;
  completedById?: string | null;
  completedByName?: string | null;
  completedAt?: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPointDto {
  id: string;
  taskId: string;
  authorId: string;
  authorName?: string;
  content: string;
  isRequired: boolean;
  isCompleted: boolean;
  completedById?: string | null;
  completedByName?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface TaskEvidenceDto {
  id: string;
  taskId: string;
  uploaderId: string;
  uploaderName?: string;
  type: EvidenceType;
  title: string;
  uri: string;
  notes?: string | null;
  createdAt: string;
}

export interface TaskDependencyDto {
  id: string;
  taskId: string;
  taskTicketId?: string;
  taskTitle?: string;
  taskStatus?: WorkItemStatus;
  targetTaskId: string;
  targetTicketId?: string;
  targetTitle?: string;
  targetStatus?: WorkItemStatus;
  type: DependencyType;
  createdAt: string;
}

export interface DoneGateResultDto {
  canComplete: boolean;
  outstandingErrors: string[];
  metrics: {
    totalCriteria: number;
    completedCriteria: number;
    mandatoryIncomplete: number;
    totalGuidancePoints: number;
    completedGuidancePoints: number;
    requiredGuidanceIncomplete: number;
    evidenceCount: number;
    isReviewPending: boolean;
    blockingDependenciesCount: number;
  };
}

export interface TaskCommentDto {
  id: string;
  taskId: string;
  authorId: string;
  authorName?: string;
  content: string;
  createdAt: string;
}

export interface TaskDto {
  id: string;
  ticketId: string;
  title: string;
  description?: string | null;
  type: string;
  status: WorkItemStatus;
  priority: TaskPriority;
  urgency: TaskUrgency;
  progressPercent: number;
  creatorId: string;
  creatorName?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  parentTaskId?: string | null;
  parentTicketId?: string | null;
  parentTitle?: string | null;
  parentType?: string | null;
  subTasks?: TaskDto[];
  requiresReview: boolean;
  reviewPending?: boolean;
  blockerReason?: string | null;
  startDate?: string | null;
  deadline?: string | null;
  completedAt?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  sprintId?: string | null;
  sprintName?: string | null;
  rank?: string;
  storyPoints?: number | null;
  acceptanceCriteria?: AcceptanceCriterionDto[];
  points?: TaskPointDto[];
  evidence?: TaskEvidenceDto[];
  dependencies?: TaskDependencyDto[];
  inverseDependencies?: TaskDependencyDto[];
  comments?: TaskCommentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface StandupBlockerDto {
  id: string;
  standupId: string;
  blockerText: string;
  convertedTaskId?: string | null;
  isResolved: boolean;
}

export interface StandupDto {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  teamId?: string | null;
  teamName?: string | null;
  standupDate: string;
  yesterday: string;
  today: string;
  hasBlockers: boolean;
  blockers: StandupBlockerDto[];
  submittedAt: string;
}

export interface MeetingAgendaItemDto {
  id: string;
  meetingId: string;
  topic: string;
  orderIndex: number;
}

export interface MeetingDecisionDto {
  id: string;
  meetingId: string;
  description: string;
  recordedAt: string;
}

export interface MeetingActionItemDto {
  id: string;
  meetingId: string;
  description: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueDate?: string | null;
  convertedTaskId?: string | null;
}

export interface MeetingDto {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  timezone: string;
  googleMeetUrl?: string | null;
  organizerId: string;
  organizerName?: string;
  isInstant: boolean;
  participants: { userId: string; userName?: string; responseStatus: string }[];
  agendaItems: MeetingAgendaItemDto[];
  decisions: MeetingDecisionDto[];
  actionItems: MeetingActionItemDto[];
  createdAt: string;
}

export interface KpiSummaryDto {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  reviewPendingTasks: number;
  overdueTasks: number;
  completionRate: number;
  onTimeRate: number;
  overdueRate: number;
  blockedRate: number;
  standupSubmittedToday: boolean;
  totalTeamMembers?: number;
  teamStandupParticipationRate?: number;
}

export interface NotificationDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  linkUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface SprintCommitmentDto {
  id: string;
  sprintId: string;
  taskId: string;
  ticketId?: string;
  title?: string;
  wasPlanned: boolean;
  storyPoints?: number | null;
  statusAtStart?: string | null;
  statusAtEnd?: string | null;
  addedAt: string;
  removedAt?: string | null;
  completedAt?: string | null;
  carriedOverToSprintId?: string | null;
}

export interface SprintDto {
  id: string;
  projectId: string;
  projectName?: string;
  teamId?: string | null;
  teamName?: string | null;
  name: string;
  goal?: string | null;
  status: SprintStatus;
  startDate?: string | null;
  endDate?: string | null;
  completedAt?: string | null;
  capacityPoints?: number | null;
  createdById: string;
  taskCount?: number;
  completedTaskCount?: number;
  totalStoryPoints?: number;
  completedStoryPoints?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SprintDetailDto extends SprintDto {
  tasks: TaskDto[];
  commitments: SprintCommitmentDto[];
}

export interface CreateSprintDto {
  projectId: string;
  teamId?: string | null;
  name: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  capacityPoints?: number | null;
}

export interface UpdateSprintDto {
  name?: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  capacityPoints?: number | null;
}

export interface StartSprintDto {
  startDate: string;
  endDate: string;
}

export interface CompleteSprintDto {
  incompleteTaskAction: 'MOVE_TO_BACKLOG' | 'MOVE_TO_SPRINT';
  targetSprintId?: string;
}

export interface BoardColumnDto {
  id: string;
  boardId: string;
  name: string;
  orderIndex: number;
  wipLimit: number;
  wipLimitType: WipLimitType;
  mappedStatuses: WorkItemStatus[];
  tasks?: TaskDto[];
  taskCount?: number;
}

export interface BoardDto {
  id: string;
  projectId: string;
  projectName?: string;
  name: string;
  type: BoardType;
  filterQuery?: string | null;
  columns: BoardColumnDto[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBoardColumnDto {
  name: string;
  orderIndex: number;
  wipLimit?: number;
  wipLimitType?: WipLimitType;
  mappedStatuses: WorkItemStatus[];
}

export interface CreateBoardDto {
  projectId: string;
  name: string;
  type?: BoardType;
  filterQuery?: string | null;
  columns?: CreateBoardColumnDto[];
}

export interface MoveBoardCardDto {
  targetColumnId: string;
  targetStatus?: WorkItemStatus;
  targetRankAbove?: string;
  targetRankBelow?: string;
  overrideWipLimit?: boolean;
  overrideReason?: string;
}

export interface ReorderBacklogDto {
  ticketId: string;
  targetRankAbove?: string;
  targetRankBelow?: string;
}

export interface TaskFilterDto {
  projectId?: string;
  teamId?: string;
  sprintId?: string | 'NONE';
  types?: WorkItemType[];
  statuses?: WorkItemStatus[];
  priorities?: TaskPriority[];
  assigneeIds?: string[];
  creatorIds?: string[];
  hasBlockers?: boolean;
  searchQuery?: string;
  cursor?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// PHASE 4A: WORKLOAD, TIMELINE & CALENDAR DTOS
// ---------------------------------------------------------------------------

export type WorkloadStatus = 'UNDER_ALLOCATED' | 'OPTIMAL' | 'OVER_ALLOCATED' | 'CRITICAL';

export interface UserCapacityDto {
  id: string;
  userId: string;
  weeklyCapacity: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
}

export interface SetUserCapacityDto {
  weeklyCapacity: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
}

export interface UserWorkloadDto {
  userId: string;
  userName: string;
  userEmail: string;
  roleCode: RoleCode;
  weeklyCapacityHours: number;
  allocatedEstimatedHours: number;
  allocatedActualHours: number;
  openTaskCount: number;
  utilizationRatio: number; // e.g. 0.85
  status: WorkloadStatus;
}

export interface TeamWorkloadDto {
  teamId: string;
  teamName: string;
  totalCapacityHours: number;
  totalAllocatedHours: number;
  utilizationRatio: number;
  status: WorkloadStatus;
  members: UserWorkloadDto[];
}

export interface ProjectWorkloadDto {
  projectId: string;
  projectName: string;
  totalEstimatedHours: number;
  totalActualHours: number;
  assignees: UserWorkloadDto[];
}

export interface TimelineTaskDto {
  id: string;
  ticketId: string;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: TaskPriority;
  urgency: TaskUrgency;
  startDate: string | null;
  deadline: string | null;
  completedAt: string | null;
  durationDays: number;
  parentTicketId?: string | null;
  level: number; // 1: Initiative, 2: Epic, 3: Standard, 4: Subtask, 0: Milestone
  assigneeId?: string | null;
  assigneeName?: string | null;
  dependencies: {
    targetTaskId: string;
    targetTicketId: string;
    type: string;
  }[];
  isCriticalPath: boolean;
  totalSlackDays: number;
}

export interface TimelineResponseDto {
  projectId: string;
  projectName: string;
  tasks: TimelineTaskDto[];
  criticalPathTicketIds: string[];
}

export interface RescheduleTaskDto {
  startDate?: string | null;
  deadline?: string | null;
}

export type CalendarEventType =
  | 'TASK_DEADLINE'
  | 'SPRINT'
  | 'MEETING'
  | 'STANDUP'
  | 'MILESTONE';

export interface CalendarEventDto {
  id: string;
  sourceType: CalendarEventType;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  urgency?: TaskUrgency | string | null;
  linkUrl: string;
  metadata?: Record<string, any>;
}

export interface CalendarQueryDto {
  start: string;
  end: string;
  projectId?: string;
  teamId?: string;
}

// =========================================================================
// PHASE 4B: ACCOUNTABILITY, HEALTH & MANAGEMENT TYPES
// =========================================================================

export interface DueDateAdherenceDto {
  completedWithDeadline: number;
  onTimeCount: number;
  lateCount: number;
  adherenceRate: number; // e.g. 0.85
}

export interface SprintSayDoDto {
  sprintId: string;
  sprintName: string;
  plannedPoints: number;
  completedPlannedPoints: number;
  sayDoRatio: number; // e.g. 0.90
}

export interface ScopeCreepDto {
  sprintId: string;
  sprintName: string;
  initialPlannedPoints: number;
  midSprintAddedPoints: number;
  scopeCreepRate: number; // e.g. 0.15
}

export interface BlockerAgingDto {
  totalBlockers: number;
  activeBlockersCount: number;
  avgResolutionHours: number;
  longestActiveHours: number;
  activeBlockers: {
    taskId: string;
    ticketId: string;
    title: string;
    blockedSince: string;
    hoursBlocked: number;
    reason?: string;
  }[];
}

export interface ReworkRateDto {
  totalCompletedTasks: number;
  reworkedTasksCount: number;
  reworkRate: number; // e.g. 0.12
  reworkItems: {
    taskId: string;
    ticketId: string;
    title: string;
    reworkCount: number;
  }[];
}

export interface AccountabilityMetricsDto {
  dueDateAdherence: DueDateAdherenceDto;
  sprintSayDo: SprintSayDoDto[];
  scopeCreep: ScopeCreepDto[];
  blockerAging: BlockerAgingDto;
  reworkRate: ReworkRateDto;
  timeWindowDays: number;
}

export type HealthState = 'HEALTHY' | 'AT_RISK' | 'CRITICAL';

export interface HealthSignalDto {
  signalName: string;
  observedEvidence: string;
  rule: string;
  threshold: string;
  healthState: HealthState;
  explanation: string;
  operationalAction: string;
}

export interface DeliveryHealthDto {
  scopeType: 'PROJECT' | 'SPRINT' | 'TEAM';
  scopeId: string;
  scopeName: string;
  overallState: HealthState;
  summary: string;
  signals: HealthSignalDto[];
  evaluatedAt: string;
}

export interface ControlTowerSummaryDto {
  projectHealth: {
    totalProjects: number;
    healthy: number;
    atRisk: number;
    critical: number;
    items: DeliveryHealthDto[];
  };
  blockers: {
    activeCount: number;
    criticalPathCount: number;
    stagnantCount: number;
  };
  workload: {
    overAllocatedUsersCount: number;
    criticalUsersCount: number;
  };
  risks: {
    ticketId: string;
    title: string;
    projectName: string;
    issue: string;
    severity: 'WARNING' | 'CRITICAL';
    operationalAction: string;
  }[];
  evaluatedAt: string;
}

export interface AdvancedAnalyticsDto {
  leadTimeDays: {
    avg: number;
    median: number;
    p85: number;
  };
  cycleTimeDays: {
    avg: number;
    median: number;
    p85: number;
  };
  cumulativeFlow: {
    date: string;
    countsByStatus: Record<string, number>;
  }[];
  velocityHistory: {
    sprintId: string;
    sprintName: string;
    committedPoints: number;
    completedPoints: number;
  }[];
  velocityPredictability: number;
  backlogAging: {
    under30d: number;
    d30to60: number;
    d60to90: number;
    over90d: number;
  };
}

// =========================================================================
// PHASE 4C: PRODUCTIVITY & TRACEABILITY TYPES
// =========================================================================

export interface GlobalSearchItemDto {
  id: string;
  entityType: 'TASK' | 'PROJECT' | 'SPRINT' | 'BOARD' | 'MEETING' | 'STANDUP' | 'DECISION';
  ticketId?: string;
  title: string;
  subtitle?: string;
  status?: string;
  linkUrl: string;
  snippet?: string;
}

export interface GlobalSearchResponseDto {
  query: string;
  totalResults: number;
  results: GlobalSearchItemDto[];
}

export interface BulkOperationDto {
  action: 'ASSIGN' | 'UPDATE_PRIORITY' | 'MOVE_SPRINT' | 'TRANSITION';
  taskIds: string[];
  payload: {
    assigneeId?: string | null;
    priority?: TaskPriority;
    sprintId?: string | null;
    targetStatus?: WorkItemStatus;
    reviewComment?: string;
  };
}

export interface BulkItemResultDto {
  taskId: string;
  ticketId: string;
  success: boolean;
  status?: WorkItemStatus;
  reason?: string;
}

export interface BulkOperationResponseDto {
  totalRequested: number;
  succeededCount: number;
  failedCount: number;
  results: BulkItemResultDto[];
}

export type DecisionVisibility = 'MYSELF' | 'TEAM' | 'CORE';

export interface ProjectDecisionDto {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  summary: string;
  rationale?: string | null;
  status: string;
  visibility?: 'MYSELF' | 'TEAM' | 'CORE' | string;
  decidedById: string;
  decidedByName?: string;
  meetingId?: string | null;
  meetingTitle?: string | null;
  taskId?: string | null;
  taskTicketId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDecisionDto {
  projectId: string;
  title: string;
  summary: string;
  rationale?: string;
  status?: string;
  visibility?: 'MYSELF' | 'TEAM' | 'CORE' | string;
  meetingId?: string;
  taskId?: string;
}

// =========================================================================
// PHASE 4D: AUTOMATION & INTELLIGENCE TYPES
// =========================================================================

export interface AutomationRuleDto {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  eventType: string;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  isEnabled: boolean;
  creatorId: string;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationRuleDto {
  projectId: string;
  name: string;
  description?: string;
  eventType: string;
  conditions: Record<string, any>;
  actions: Record<string, any>;
}

export interface UpdateAutomationRuleDto {
  name?: string;
  description?: string;
  conditions?: Record<string, any>;
  actions?: Record<string, any>;
  isEnabled?: boolean;
}

export interface NotificationDigestDto {
  recipientId: string;
  recipientEmail: string;
  generatedAt: string;
  overdueTasks: { ticketId: string; title: string; deadline: string }[];
  activeBlockers: { ticketId: string; title: string; hoursBlocked: number }[];
  pendingReviews: { ticketId: string; title: string; submittedAt: string }[];
  sprintUpdates: { sprintName: string; remainingDays: number; progressPercent: number }[];
  totalActionableItems: number;
}

export interface AskWorkdeskQueryDto {
  query: string;
  projectId?: string;
}

export interface AskWorkdeskCitationDto {
  ticketId: string;
  title: string;
  type: string;
  status: string;
  linkUrl: string;
}

export interface AskWorkdeskResponseDto {
  answer: string;
  citations: AskWorkdeskCitationDto[];
  confidence: number;
  isDeterministicFallback: boolean;
}



