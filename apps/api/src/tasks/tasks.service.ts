import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  RoleCode,
  WorkItemStatus,
  TaskPriority,
  TaskUrgency,
  WorkItemType,
  EvidenceType,
  DependencyType,
  DoneGateResultDto,
} from '@workdesk/shared';
import { LexoRank } from '../common/lexorank';

export interface CreateTaskDto {
  title: string;
  description?: string;
  type?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  teamId?: string;
  projectId?: string;
  parentTaskId?: string;
  deadline?: string;
  startDate?: string;
  estimatedHours?: number;
  requiresReview?: boolean;
  storyPoints?: number;
  sprintId?: string;
  rank?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  type?: string;
  priority?: TaskPriority;
  progressPercent?: number;
  assigneeId?: string;
  teamId?: string;
  projectId?: string;
  deadline?: string;
  startDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  requiresReview?: boolean;
  storyPoints?: number;
  sprintId?: string;
  rank?: string;
  // Note: status, parentTaskId, criteria, guidance, evidence, dependencies
  // MUST NOT be updated through generic PATCH. They have dedicated command endpoints.
  status?: never;
  parentTaskId?: never;
}

export interface TransitionTaskDto {
  targetStatus: WorkItemStatus;
  blockerReason?: string;
  comment?: string;
}

export interface CreateCriterionDto {
  description: string;
  isMandatory?: boolean;
  orderIndex?: number;
}

export interface UpdateCriterionDto {
  description?: string;
  isMandatory?: boolean;
  orderIndex?: number;
}

export interface CreateEvidenceDto {
  type: EvidenceType;
  title: string;
  uri: string;
  notes?: string;
}

export interface CreateDependencyDto {
  targetTicketId: string;
  type: DependencyType;
}

export interface GetTasksQueryDto {
  cursor?: string;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  type?: string;
  status?: string;
  priority?: string;
  projectId?: string;
  teamId?: string;
  assigneeId?: string;
  parentTaskId?: string;
}

import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class TasksService {
  private writeMutex: Promise<any> = Promise.resolve();
  private readonly lockStorage = new AsyncLocalStorage<boolean>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async executeWithWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    if (this.lockStorage.getStore()) {
      return await fn();
    }

    let release: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prevLock = this.writeMutex;
    this.writeMutex = prevLock.then(() => nextLock);
    await prevLock;
    try {
      return await this.lockStorage.run(true, () => fn());
    } finally {
      release!();
    }
  }

  calculateUrgency(deadline?: Date | null, status?: string): TaskUrgency {
    if (status === WorkItemStatus.DONE || status === WorkItemStatus.CANCELLED || !deadline) {
      return TaskUrgency.GREEN;
    }
    const now = new Date().getTime();
    const target = new Date(deadline).getTime();
    const diffHours = (target - now) / (1000 * 60 * 60);

    if (diffHours < 0) {
      return TaskUrgency.OVERDUE;
    } else if (diffHours < 24) {
      return TaskUrgency.RED;
    } else if (diffHours <= 72) {
      return TaskUrgency.YELLOW;
    }
    return TaskUrgency.GREEN;
  }

  /**
   * Single Canonical Domain Hierarchy Validator
   * INITIATIVE (Level 1, root) -> EPIC (Level 2) -> Level-3 -> SUBTASK (Level 4)
   * MILESTONE (Special marker under INITIATIVE or EPIC)
   */
  validateHierarchy(childType: string, parentType?: string): void {
    const cType = (childType || 'TASK').toUpperCase();
    const level3Types = ['STORY', 'TASK', 'BUG', 'REQUEST', 'IMPROVEMENT', 'ACTION_ITEM'];

    if (cType === 'INITIATIVE') {
      if (parentType) {
        throw new BadRequestException('Invalid hierarchy: INITIATIVE is a root item and cannot have a parent');
      }
      return;
    }

    if (!parentType) {
      if (cType === 'SUBTASK') {
        throw new BadRequestException('Invalid hierarchy: A SUBTASK cannot exist without a parent Level-3 item');
      }
      if (cType === 'EPIC') {
        throw new BadRequestException('Invalid hierarchy: An EPIC must have an INITIATIVE as its parent');
      }
      return;
    }

    const pType = parentType.toUpperCase();

    if (cType === 'EPIC') {
      if (pType !== 'INITIATIVE') {
        throw new BadRequestException(`Invalid hierarchy: An EPIC can only have an INITIATIVE as parent, but got ${pType}`);
      }
    } else if (level3Types.includes(cType)) {
      if (pType !== 'EPIC') {
        throw new BadRequestException(`Invalid hierarchy: Level-3 operational work (${cType}) can only have an EPIC as parent, but got ${pType}`);
      }
    } else if (cType === 'SUBTASK') {
      if (!level3Types.includes(pType)) {
        throw new BadRequestException(`Invalid hierarchy: A SUBTASK can only have a Level-3 item (STORY, TASK, BUG, REQUEST, IMPROVEMENT, ACTION_ITEM) as parent, but got ${pType}`);
      }
    } else if (cType === 'MILESTONE') {
      if (pType !== 'INITIATIVE' && pType !== 'EPIC') {
        throw new BadRequestException(`Invalid hierarchy: A MILESTONE can only have an INITIATIVE or EPIC as parent, but got ${pType}`);
      }
    }
  }

  /**
   * Evaluates the Server-Side Done Gate for transitioning to DONE
   */
  async evaluateDoneGate(taskId: string, txClient?: any): Promise<DoneGateResultDto> {
    const db = txClient || this.prisma;

    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        acceptanceCriteria: true,
        points: true,
        evidence: true,
        inverseDependencies: {
          where: { type: DependencyType.BLOCKS },
          include: { task: { select: { ticketId: true, status: true, title: true } } },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found for Done Gate evaluation`);
    }

    const outstandingErrors: string[] = [];

    // 1. Mandatory Acceptance Criteria Check
    const totalCriteria = task.acceptanceCriteria.length;
    const completedCriteria = task.acceptanceCriteria.filter((c: any) => c.isCompleted).length;
    const mandatoryIncomplete = task.acceptanceCriteria.filter((c: any) => c.isMandatory && !c.isCompleted);
    if (mandatoryIncomplete.length > 0) {
      outstandingErrors.push(
        `${mandatoryIncomplete.length} mandatory acceptance criterion/criteria incomplete: ${mandatoryIncomplete.map((c: any) => `"${c.description}"`).join(', ')}`,
      );
    }

    // 2. Required Guidance Points Check
    const totalGuidancePoints = task.points.length;
    const completedGuidancePoints = task.points.filter((p: any) => p.isCompleted).length;
    const requiredGuidanceIncomplete = task.points.filter((p: any) => p.isRequired && !p.isCompleted);
    if (requiredGuidanceIncomplete.length > 0) {
      outstandingErrors.push(
        `${requiredGuidanceIncomplete.length} required guidance point(s) incomplete: ${requiredGuidanceIncomplete.map((p: any) => `"${p.content}"`).join(', ')}`,
      );
    }

    // 3. Review Clearance Check
    const isReviewPending = task.requiresReview && task.status !== WorkItemStatus.APPROVED;
    if (isReviewPending) {
      outstandingErrors.push('Review clearance required: Task must be in APPROVED status before completing.');
    }

    // 4. Blocking Dependencies Check (A BLOCKS B -> B is target, must wait until A is DONE)
    const activeBlockers = task.inverseDependencies.filter((d: any) => d.task.status !== WorkItemStatus.DONE);
    if (activeBlockers.length > 0) {
      outstandingErrors.push(
        `Blocked by incomplete dependency: ${activeBlockers.map((d: any) => `${d.task.ticketId} (${d.task.status})`).join(', ')}`,
      );
    }

    // 5. Completion Evidence Check (Option B: Valid Evidence Attached)
    const level3Types = ['TASK', 'BUG', 'IMPROVEMENT'];
    const evidenceCount = task.evidence.length;
    if (level3Types.includes(task.type.toUpperCase()) && evidenceCount === 0) {
      outstandingErrors.push('Completion evidence required: Attach at least one valid Pull Request, Document, or Test Run.');
    }

    return {
      canComplete: outstandingErrors.length === 0,
      outstandingErrors,
      metrics: {
        totalCriteria,
        completedCriteria,
        mandatoryIncomplete: mandatoryIncomplete.length,
        totalGuidancePoints,
        completedGuidancePoints,
        requiredGuidanceIncomplete: requiredGuidanceIncomplete.length,
        evidenceCount,
        isReviewPending,
        blockingDependenciesCount: activeBlockers.length,
      },
    };
  }

  async getTasksForUser(user: { id: string; roleCode: RoleCode }, query: GetTasksQueryDto = {}) {
    let whereClause: any = {};

    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      whereClause = {
        OR: [
          { assigneeId: user.id },
          { creatorId: user.id },
          { watchers: { some: { userId: user.id } } },
        ],
      };
    } else if (user.roleCode === RoleCode.ROLE_LEAD) {
      const ledTeams = await this.prisma.team.findMany({
        where: {
          OR: [
            { leadId: user.id },
            { members: { some: { userId: user.id, roleInTeam: 'LEAD' } } },
          ],
        },
        select: { id: true },
      });
      const ledTeamIds = ledTeams.map((t) => t.id);

      const ledProjects = await this.prisma.project.findMany({
        where: {
          OR: [
            { leadId: user.id },
            { members: { some: { userId: user.id, roleInProject: 'LEAD' } } },
          ],
        },
        select: { id: true },
      });
      const ledProjectIds = ledProjects.map((p) => p.id);

      whereClause = {
        OR: [
          { assigneeId: user.id },
          { creatorId: user.id },
          { teamId: { in: ledTeamIds } },
          { projectId: { in: ledProjectIds } },
        ],
      };
    } else {
      // ROLE_MANAGER: organization-wide scope
      whereClause = {};
    }

    // Apply query filters
    if (query.type) whereClause.type = query.type.toUpperCase();
    if (query.status) whereClause.status = query.status.toUpperCase();
    if (query.priority) whereClause.priority = query.priority;
    if (query.projectId) whereClause.projectId = query.projectId;
    if (query.teamId) whereClause.teamId = query.teamId;
    if (query.assigneeId) whereClause.assigneeId = query.assigneeId;
    if (query.parentTaskId !== undefined) whereClause.parentTaskId = query.parentTaskId;

    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const findOptions: any = {
      where: whereClause,
      include: {
        creator: { select: { id: true, fullName: true, email: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
        team: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, key: true } },
        parentTask: { select: { id: true, ticketId: true, title: true, type: true } },
        subTasks: {
          select: { id: true, ticketId: true, title: true, type: true, status: true, priority: true },
        },
        acceptanceCriteria: true,
        points: {
          include: {
            author: { select: { id: true, fullName: true } },
            completedBy: { select: { id: true, fullName: true } },
          },
        },
        evidence: true,
      },
      take: limit + 1,
      orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
    };

    if (query.cursor) {
      findOptions.cursor = { id: query.cursor };
      findOptions.skip = 1;
    }

    const tasks = await this.prisma.task.findMany(findOptions);

    let nextCursor: string | null = null;
    if (tasks.length > limit) {
      const nextItem = tasks.pop();
      nextCursor = nextItem!.id;
    }

    const items = tasks.map((t) => this.mapTaskAggregate(t));
    return { items, nextCursor, totalReturned: items.length };
  }

  async getTaskById(ticketIdOrId: string, user: { id: string; roleCode: RoleCode }) {
    let resolvedKey = ticketIdOrId;
    const alias = await this.prisma.legacyTicketAlias.findUnique({
      where: { legacyKey: ticketIdOrId },
    });
    if (alias) {
      resolvedKey = alias.newKey;
    }

    const task = await this.prisma.task.findFirst({
      where: {
        OR: [{ id: resolvedKey }, { ticketId: resolvedKey }, { id: ticketIdOrId }, { ticketId: ticketIdOrId }],
      },
      include: {
        creator: { select: { id: true, fullName: true, email: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
        team: { select: { id: true, name: true, leadId: true } },
        project: { select: { id: true, name: true, key: true, leadId: true } },
        sprint: { select: { id: true, name: true, status: true } },
        parentTask: { select: { id: true, ticketId: true, title: true, type: true } },
        subTasks: {
          select: { id: true, ticketId: true, title: true, type: true, status: true, priority: true },
        },
        watchers: { select: { userId: true } },
        acceptanceCriteria: {
          include: {
            createdBy: { select: { id: true, fullName: true } },
            completedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { orderIndex: 'asc' },
        },
        points: {
          include: {
            author: { select: { id: true, fullName: true } },
            completedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        evidence: {
          include: { uploader: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        dependencies: {
          include: {
            targetTask: { select: { id: true, ticketId: true, title: true, status: true, type: true } },
          },
        },
        inverseDependencies: {
          include: {
            task: { select: { id: true, ticketId: true, title: true, status: true, type: true } },
          },
        },
        comments: {
          include: { author: { select: { id: true, fullName: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task ${ticketIdOrId} not found`);
    }

    // Strict 404 resource hiding for unauthorized access
    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      const isOwner =
        task.assigneeId === user.id ||
        task.creatorId === user.id ||
        task.watchers.some((w) => w.userId === user.id);
      if (!isOwner) {
        throw new NotFoundException(`Task ${ticketIdOrId} not found`);
      }
    } else if (user.roleCode === RoleCode.ROLE_LEAD) {
      const isAssignedOrCreated = task.assigneeId === user.id || task.creatorId === user.id;
      const isTeamLead = task.team?.leadId === user.id;
      const isProjectLead = task.project?.leadId === user.id;
      if (!isAssignedOrCreated && !isTeamLead && !isProjectLead) {
        throw new NotFoundException(`Task ${ticketIdOrId} not found`);
      }
    }

    return this.mapTaskAggregate(task);
  }

  async createTask(dto: CreateTaskDto, user: { id: string; roleCode: RoleCode }, ipAddress?: string) {
    const rawType = (dto.type || 'TASK').toUpperCase();

    // 1. Domain hierarchy validation
    if (dto.parentTaskId) {
      const parentTask = await this.prisma.task.findUnique({
        where: { id: dto.parentTaskId },
      });
      if (!parentTask) {
        throw new NotFoundException(`Parent task ${dto.parentTaskId} not found`);
      }
      this.validateHierarchy(rawType, parentTask.type);
    } else {
      this.validateHierarchy(rawType, undefined);
    }

    // 2. Resolve target project
    let targetProjectId = dto.projectId;
    let targetProjectKey = 'DESK';

    if (targetProjectId) {
      const p = await this.prisma.project.findUnique({ where: { id: targetProjectId } });
      if (p) {
        targetProjectKey = p.key;
      } else {
        targetProjectId = undefined;
      }
    }

    if (!targetProjectId) {
      let defaultProj = await this.prisma.project.findUnique({ where: { key: 'DESK' } });
      if (!defaultProj) {
        defaultProj = await this.prisma.project.create({
          data: {
            key: 'DESK',
            name: 'Default Workspace',
            status: 'Active',
          },
        });
      }
      targetProjectId = defaultProj.id;
      targetProjectKey = defaultProj.key;
    }

    const isEmployee = user.roleCode === RoleCode.ROLE_EMPLOYEE;
    const assigneeId = isEmployee ? user.id : dto.assigneeId || user.id;
    const requiresReview = dto.requiresReview ?? isEmployee;

    const deadline = dto.deadline ? new Date(dto.deadline) : null;
    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const urgency = this.calculateUrgency(deadline, WorkItemStatus.TODO);

    // 3. ATOMIC SQLite-Safe Transaction: Sequence Allocation + Task Insertion inside SAME transaction
    return await this.executeWithWriteLock(async () => {
      const maxRetries = 10;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const task = await this.prisma.$transaction(
            async (tx) => {
              let seq = await tx.projectSequence.findUnique({
                where: { projectId: targetProjectId },
              });

              if (!seq) {
                seq = await tx.projectSequence.create({
                  data: {
                    projectId: targetProjectId!,
                    projectKey: targetProjectKey,
                    currentSeq: 1000,
                  },
                });
              }

              const updatedSeq = await tx.projectSequence.update({
                where: { projectId: targetProjectId },
                data: { currentSeq: { increment: 1 } },
              });

              const ticketId = `${targetProjectKey}-${updatedSeq.currentSeq}`;

              const lastTask = await tx.task.findFirst({
                where: { projectId: targetProjectId, sprintId: dto.sprintId ?? null },
                orderBy: { rank: 'desc' },
                select: { rank: true },
              });
              const calculatedRank = dto.rank || LexoRank.calculateBetween(lastTask?.rank, null);

              const created = await tx.task.create({
                data: {
                  ticketId,
                  title: dto.title,
                  description: dto.description,
                  type: rawType,
                  status: WorkItemStatus.TODO,
                  priority: dto.priority || TaskPriority.MEDIUM,
                  urgency,
                  progressPercent: 0,
                  creatorId: user.id,
                  assigneeId,
                  teamId: dto.teamId,
                  projectId: targetProjectId,
                  parentTaskId: dto.parentTaskId,
                  startDate,
                  deadline,
                  estimatedHours: dto.estimatedHours,
                  requiresReview,
                  sprintId: dto.sprintId,
                  rank: calculatedRank,
                  storyPoints: dto.storyPoints,
                },
                include: {
                  creator: { select: { fullName: true } },
                  assignee: { select: { fullName: true } },
                  sprint: { select: { id: true, name: true } },
                },
              });

              return created;
            },
            { timeout: 15000 },
          );

          await this.auditService.log({
            actorId: user.id,
            action: 'WORK_ITEM_CREATED',
            entityName: 'Task',
            entityId: task.id,
            metadata: { ticketId: task.ticketId, title: task.title, type: task.type, requiresReview },
            ipAddress,
          });

          if (assigneeId && assigneeId !== user.id) {
            await this.prisma.notification.create({
              data: {
                userId: assigneeId,
                type: 'WORK_ITEM_ASSIGNED',
                title: `New Work Item Assigned: ${task.ticketId}`,
                message: `${user.roleCode} assigned you "${task.title}"`,
                linkUrl: `/tasks/${task.ticketId}`,
              },
            });
          }

          return task;
        } catch (err: any) {
          const isTransient =
            err.message?.includes('busy') ||
            err.message?.includes('locked') ||
            err.message?.includes('timeout') ||
            err.code === 'P2034' ||
            err.code === 'P2024' ||
            err.code === 'P2028';

          if (isTransient) {
            if (attempt === maxRetries) throw err;
            const delay = Math.floor(Math.random() * 40) + 20 * Math.pow(1.3, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            throw err;
          }
        }
      }

      throw new Error('Failed to create task after concurrency retries');
    });
  }

  /**
   * Update task metadata. Strictly adheres to PATCH boundary.
   */
  async updateTask(
    ticketIdOrId: string,
    dto: UpdateTaskDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ) {
    // Explicit PATCH boundary enforcement
    if ((dto as any).status !== undefined) {
      throw new BadRequestException('Status mutation must be performed via /transition endpoint');
    }
    if ((dto as any).parentTaskId !== undefined) {
      throw new BadRequestException('Parent mutation must be performed via /reparent endpoint');
    }

    const existing = await this.getTaskById(ticketIdOrId, user);

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.teamId !== undefined) data.teamId = dto.teamId;
    if (dto.projectId !== undefined) data.projectId = dto.projectId;
    if (dto.estimatedHours !== undefined) data.estimatedHours = dto.estimatedHours;
    if (dto.requiresReview !== undefined) data.requiresReview = dto.requiresReview;
    if (dto.storyPoints !== undefined) data.storyPoints = dto.storyPoints;
    if (dto.sprintId !== undefined) data.sprintId = dto.sprintId;
    if (dto.rank !== undefined) data.rank = dto.rank;

    // Actual Hours Validation and Scoping
    if (dto.actualHours !== undefined) {
      if (dto.actualHours < 0 || dto.actualHours > 10000 || !Number.isInteger(dto.actualHours)) {
        throw new BadRequestException('actualHours must be a non-negative integer <= 10000');
      }
      const canUpdateHours =
        existing.assigneeId === user.id || user.roleCode !== RoleCode.ROLE_EMPLOYEE;
      if (!canUpdateHours) {
        throw new ForbiddenException('Only the assigned user, Lead, or Manager can update actual hours');
      }
      data.actualHours = dto.actualHours;
    }

    if (dto.progressPercent !== undefined) {
      data.progressPercent = Math.min(100, Math.max(0, dto.progressPercent));
    }

    if (dto.deadline !== undefined) {
      data.deadline = dto.deadline ? new Date(dto.deadline) : null;
      data.urgency = this.calculateUrgency(data.deadline, existing.status);
    }
    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }

    if (dto.assigneeId !== undefined) {
      if (user.roleCode === RoleCode.ROLE_EMPLOYEE && dto.assigneeId !== user.id) {
        throw new ForbiddenException('Employees cannot assign tasks to other users');
      }
      data.assigneeId = dto.assigneeId;
    }

    const updated = await this.prisma.task.update({
      where: { id: existing.id },
      data,
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'TASK_UPDATED',
      entityName: 'Task',
      entityId: updated.id,
      metadata: { ticketId: updated.ticketId, changes: dto },
      ipAddress,
    });

    return updated;
  }

  /**
   * Authoritative Canonical Workflow State Machine Transition
   */
  async transitionTask(
    ticketIdOrId: string,
    dto: TransitionTaskDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ) {
    const existing = await this.getTaskById(ticketIdOrId, user);
    const targetStatus = dto.targetStatus;
    const currentStatus = existing.status as WorkItemStatus;

    if (currentStatus === targetStatus) {
      throw new BadRequestException(`Task is already in ${targetStatus} status`);
    }

    // State machine permissible transition matrix
    const allowedTransitions: Record<WorkItemStatus, WorkItemStatus[]> = {
      [WorkItemStatus.DRAFT]: [WorkItemStatus.TODO, WorkItemStatus.CANCELLED],
      [WorkItemStatus.TODO]: [WorkItemStatus.IN_PROGRESS, WorkItemStatus.BLOCKED, WorkItemStatus.CANCELLED],
      [WorkItemStatus.IN_PROGRESS]: [
        WorkItemStatus.IN_REVIEW,
        WorkItemStatus.DONE,
        WorkItemStatus.BLOCKED,
        WorkItemStatus.TODO,
        WorkItemStatus.CANCELLED,
      ],
      [WorkItemStatus.BLOCKED]: [WorkItemStatus.TODO, WorkItemStatus.IN_PROGRESS, WorkItemStatus.CANCELLED],
      [WorkItemStatus.IN_REVIEW]: [WorkItemStatus.APPROVED, WorkItemStatus.CHANGES_REQUESTED, WorkItemStatus.BLOCKED],
      [WorkItemStatus.CHANGES_REQUESTED]: [WorkItemStatus.IN_PROGRESS, WorkItemStatus.BLOCKED, WorkItemStatus.CANCELLED],
      [WorkItemStatus.APPROVED]: [WorkItemStatus.DONE, WorkItemStatus.IN_PROGRESS, WorkItemStatus.CANCELLED],
      [WorkItemStatus.DONE]: [WorkItemStatus.REOPENED],
      [WorkItemStatus.CANCELLED]: [WorkItemStatus.REOPENED],
      [WorkItemStatus.REOPENED]: [WorkItemStatus.TODO, WorkItemStatus.IN_PROGRESS],
    };

    const permissible = allowedTransitions[currentStatus] || [];
    if (!permissible.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${targetStatus}. Permissible targets: ${permissible.join(', ')}`,
      );
    }

    // Role-specific transition rules
    if (targetStatus === WorkItemStatus.APPROVED || currentStatus === WorkItemStatus.IN_REVIEW) {
      if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
        throw new ForbiddenException('Only Leads and Managers can review and approve work items');
      }
    }

    if (targetStatus === WorkItemStatus.REOPENED && user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      throw new ForbiddenException('Only Leads and Managers can reopen completed or cancelled work items');
    }

    // If review is required, prevent skipping review straight to DONE
    if (targetStatus === WorkItemStatus.DONE && existing.requiresReview && currentStatus !== WorkItemStatus.APPROVED) {
      throw new BadRequestException('Cannot mark task DONE directly: This work item requires review and must be APPROVED first.');
    }

    // Require blocker reason if transitioning to BLOCKED
    if (targetStatus === WorkItemStatus.BLOCKED && !dto.blockerReason) {
      throw new BadRequestException('A blocker reason is required when transitioning to BLOCKED status');
    }

    // Concurrency-safe atomic transition execution
    return await this.executeWithWriteLock(async () => {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          // Re-fetch with lock to guarantee fresh status check
          const freshTask = await tx.task.findUnique({ where: { id: existing.id } });
          if (!freshTask) throw new NotFoundException('Task not found');
          if (freshTask.status === targetStatus) {
            throw new BadRequestException(`Task is already in ${targetStatus} status`);
          }

          // Evaluate Done Gate inside transaction if completing
          if (targetStatus === WorkItemStatus.DONE) {
            const gateResult = await this.evaluateDoneGate(freshTask.id, tx);
            if (!gateResult.canComplete) {
              throw new BadRequestException({
                statusCode: 400,
                error: 'Bad Request',
                message: 'Done Gate Rejected: Work Item requirements incomplete',
                outstandingRequirements: gateResult.outstandingErrors,
              });
            }
          }

          const updateData: any = {
            status: targetStatus,
            blockerReason: targetStatus === WorkItemStatus.BLOCKED ? dto.blockerReason : null,
          };

          if (targetStatus === WorkItemStatus.DONE) {
            updateData.completedAt = new Date();
            updateData.progressPercent = 100;
          } else if (currentStatus === WorkItemStatus.DONE) {
            updateData.completedAt = null;
          }

          const updatedTask = await tx.task.update({
            where: { id: freshTask.id },
            data: updateData,
          });

          // Post-transition comment if provided
          if (dto.comment) {
            await tx.taskComment.create({
              data: {
                taskId: freshTask.id,
                authorId: user.id,
                content: `[STATUS -> ${targetStatus}]: ${dto.comment}`,
              },
            });
          }

          return updatedTask;
        },
        { timeout: 15000 },
      );

      // Audit and notifications after transaction commits
      await this.auditService.log({
        actorId: user.id,
        action: 'STATUS_CHANGED',
        entityName: 'Task',
        entityId: updated.id,
        metadata: {
          ticketId: updated.ticketId,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          blockerReason: dto.blockerReason,
        },
        ipAddress,
      });

      if (existing.assigneeId && existing.assigneeId !== user.id) {
        await this.prisma.notification.create({
          data: {
            userId: existing.assigneeId,
            type: 'STATUS_CHANGED',
            title: `Status Updated: ${existing.ticketId}`,
            message: `${user.roleCode} changed status to ${targetStatus}`,
            linkUrl: `/tasks/${existing.ticketId}`,
          },
        });
      }

      return updated;
    });
  }

  /**
   * Reparent Work Item with Hierarchy and Cycle Validation
   */
  async reparentTask(
    ticketIdOrId: string,
    newParentTicketId: string | null,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ) {
    const task = await this.getTaskById(ticketIdOrId, user);

    if (newParentTicketId === null) {
      this.validateHierarchy(task.type, undefined);
      const updated = await this.prisma.task.update({
        where: { id: task.id },
        data: { parentTaskId: null },
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'RE_PARENTED',
        entityName: 'Task',
        entityId: task.id,
        metadata: { ticketId: task.ticketId, previousParentId: task.parentTaskId, newParentId: null },
        ipAddress,
      });

      return updated;
    }

    const newParent = await this.prisma.task.findFirst({
      where: {
        OR: [{ id: newParentTicketId }, { ticketId: newParentTicketId }],
      },
    });

    if (!newParent) {
      throw new NotFoundException(`New parent task ${newParentTicketId} not found`);
    }

    if (newParent.id === task.id) {
      throw new BadRequestException('A task cannot be its own parent');
    }

    // Hierarchy rule check
    this.validateHierarchy(task.type, newParent.type);

    // Circular ancestry check: verify newParent is not a descendant of task
    let curr: any = newParent;
    while (curr.parentTaskId) {
      if (curr.parentTaskId === task.id) {
        throw new BadRequestException('Circular hierarchy detected: Cannot set child as ancestor');
      }
      curr = await this.prisma.task.findUnique({ where: { id: curr.parentTaskId } });
      if (!curr) break;
    }

    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: { parentTaskId: newParent.id },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'RE_PARENTED',
      entityName: 'Task',
      entityId: task.id,
      metadata: {
        ticketId: task.ticketId,
        previousParentId: task.parentTaskId,
        newParentId: newParent.id,
        newParentTicketId: newParent.ticketId,
      },
      ipAddress,
    });

    return updated;
  }

  // =========================================================================
  // ACCEPTANCE CRITERIA OPERATIONS
  // =========================================================================
  async addCriterion(
    ticketIdOrId: string,
    dto: CreateCriterionDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ) {
    const task = await this.getTaskById(ticketIdOrId, user);

    const count = await this.prisma.acceptanceCriterion.count({ where: { taskId: task.id } });
    const criterion = await this.prisma.acceptanceCriterion.create({
      data: {
        taskId: task.id,
        description: dto.description.trim(),
        isMandatory: dto.isMandatory !== undefined ? dto.isMandatory : true,
        orderIndex: dto.orderIndex !== undefined ? dto.orderIndex : count,
        createdById: user.id,
      },
      include: {
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'CRITERION_CREATED',
      entityName: 'AcceptanceCriterion',
      entityId: criterion.id,
      metadata: { taskId: task.id, ticketId: task.ticketId, description: criterion.description },
      ipAddress,
    });

    return criterion;
  }

  async updateCriterion(
    criterionId: string,
    dto: UpdateCriterionDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ) {
    const criterion = await this.prisma.acceptanceCriterion.findUnique({
      where: { id: criterionId },
      include: { task: true },
    });
    if (!criterion) throw new NotFoundException('Acceptance criterion not found');

    const canEdit =
      criterion.createdById === user.id ||
      criterion.task.creatorId === user.id ||
      criterion.task.assigneeId === user.id ||
      user.roleCode !== RoleCode.ROLE_EMPLOYEE;

    if (!canEdit) {
      throw new ForbiddenException('Not authorized to edit this criterion');
    }

    const updated = await this.prisma.acceptanceCriterion.update({
      where: { id: criterionId },
      data: {
        description: dto.description !== undefined ? dto.description.trim() : undefined,
        isMandatory: dto.isMandatory !== undefined ? dto.isMandatory : undefined,
        orderIndex: dto.orderIndex !== undefined ? dto.orderIndex : undefined,
      },
    });

    return updated;
  }

  async toggleCriterion(criterionId: string, user: { id: string; roleCode: RoleCode }, ipAddress?: string) {
    const criterion = await this.prisma.acceptanceCriterion.findUnique({
      where: { id: criterionId },
      include: { task: true },
    });
    if (!criterion) throw new NotFoundException('Acceptance criterion not found');

    const nowCompleted = !criterion.isCompleted;
    const updated = await this.prisma.acceptanceCriterion.update({
      where: { id: criterionId },
      data: {
        isCompleted: nowCompleted,
        completedById: nowCompleted ? user.id : null,
        completedAt: nowCompleted ? new Date() : null,
      },
      include: {
        completedBy: { select: { id: true, fullName: true } },
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'CRITERION_COMPLETED',
      entityName: 'AcceptanceCriterion',
      entityId: criterion.id,
      metadata: { isCompleted: nowCompleted, taskId: criterion.taskId },
      ipAddress,
    });

    return updated;
  }

  async deleteCriterion(criterionId: string, user: { id: string; roleCode: RoleCode }, ipAddress?: string) {
    const criterion = await this.prisma.acceptanceCriterion.findUnique({
      where: { id: criterionId },
      include: { task: true },
    });
    if (!criterion) throw new NotFoundException('Acceptance criterion not found');

    const canDelete =
      criterion.createdById === user.id ||
      criterion.task.creatorId === user.id ||
      user.roleCode !== RoleCode.ROLE_EMPLOYEE;

    if (!canDelete) {
      throw new ForbiddenException('Not authorized to delete this criterion');
    }

    await this.prisma.acceptanceCriterion.delete({ where: { id: criterionId } });
    return { success: true };
  }

  // =========================================================================
  // GUIDANCE POINTS OPERATIONS
  // =========================================================================
  async addGuidancePoint(
    ticketIdOrId: string,
    content: string,
    isRequired: boolean,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ) {
    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      throw new ForbiddenException('Only Leads and Managers can add guidance points');
    }

    const task = await this.getTaskById(ticketIdOrId, user);

    const point = await this.prisma.taskPoint.create({
      data: {
        taskId: task.id,
        authorId: user.id,
        content: content.trim(),
        isRequired,
      },
      include: { author: { select: { id: true, fullName: true } } },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'GUIDANCE_CREATED',
      entityName: 'TaskPoint',
      entityId: point.id,
      metadata: { taskId: task.id, ticketId: task.ticketId, isRequired },
      ipAddress,
    });

    if (task.assigneeId && task.assigneeId !== user.id) {
      await this.prisma.notification.create({
        data: {
          userId: task.assigneeId,
          type: 'GUIDANCE_POINT_ADDED',
          title: `Guidance Added: ${task.ticketId}`,
          message: `${user.roleCode} added directive: "${content}"`,
          linkUrl: `/tasks/${task.ticketId}`,
        },
      });
    }

    return point;
  }

  async toggleGuidancePoint(pointId: string, user: { id: string; roleCode: RoleCode }, ipAddress?: string) {
    const point = await this.prisma.taskPoint.findUnique({
      where: { id: pointId },
      include: { task: true },
    });
    if (!point) throw new NotFoundException('Guidance point not found');

    const isAssignee = point.task.assigneeId === user.id;
    const isLeadOrManager = user.roleCode !== RoleCode.ROLE_EMPLOYEE;
    if (!isAssignee && !isLeadOrManager) {
      throw new ForbiddenException('Only the assignee, Lead, or Manager can check off guidance points');
    }

    const nowCompleted = !point.isCompleted;
    const updated = await this.prisma.taskPoint.update({
      where: { id: pointId },
      data: {
        isCompleted: nowCompleted,
        completedById: nowCompleted ? user.id : null,
        completedAt: nowCompleted ? new Date() : null,
      },
      include: {
        completedBy: { select: { id: true, fullName: true } },
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'GUIDANCE_COMPLETED',
      entityName: 'TaskPoint',
      entityId: point.id,
      metadata: { isCompleted: nowCompleted, taskId: point.taskId },
      ipAddress,
    });

    return updated;
  }

  async deleteGuidancePoint(pointId: string, user: { id: string; roleCode: RoleCode }) {
    const point = await this.prisma.taskPoint.findUnique({
      where: { id: pointId },
    });
    if (!point) throw new NotFoundException('Guidance point not found');

    if (point.authorId !== user.id && user.roleCode !== RoleCode.ROLE_MANAGER) {
      throw new ForbiddenException('Only the author or Manager can delete this guidance point');
    }

    await this.prisma.taskPoint.delete({ where: { id: pointId } });
    return { success: true };
  }

  // =========================================================================
  // WORK EVIDENCE OPERATIONS
  // =========================================================================
  async addEvidence(
    ticketIdOrId: string,
    dto: CreateEvidenceDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ) {
    const task = await this.getTaskById(ticketIdOrId, user);

    if (!dto.uri.startsWith('http://') && !dto.uri.startsWith('https://')) {
      throw new BadRequestException('Evidence uri must be a valid http or https URL');
    }

    const evidence = await this.prisma.taskEvidence.create({
      data: {
        taskId: task.id,
        uploaderId: user.id,
        type: dto.type,
        title: dto.title.trim(),
        uri: dto.uri.trim(),
        notes: dto.notes?.trim(),
      },
      include: {
        uploader: { select: { id: true, fullName: true } },
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'EVIDENCE_ADDED',
      entityName: 'TaskEvidence',
      entityId: evidence.id,
      metadata: { taskId: task.id, ticketId: task.ticketId, type: dto.type, uri: dto.uri },
      ipAddress,
    });

    return evidence;
  }

  async deleteEvidence(evidenceId: string, user: { id: string; roleCode: RoleCode }, ipAddress?: string) {
    const evidence = await this.prisma.taskEvidence.findUnique({
      where: { id: evidenceId },
      include: { task: true },
    });
    if (!evidence) throw new NotFoundException('Evidence not found');

    const canDelete =
      evidence.uploaderId === user.id ||
      evidence.task.creatorId === user.id ||
      user.roleCode !== RoleCode.ROLE_EMPLOYEE;

    if (!canDelete) {
      throw new ForbiddenException('Not authorized to delete this evidence record');
    }

    await this.prisma.taskEvidence.delete({ where: { id: evidenceId } });

    await this.auditService.log({
      actorId: user.id,
      action: 'EVIDENCE_REMOVED',
      entityName: 'TaskEvidence',
      entityId: evidenceId,
      metadata: { taskId: evidence.taskId },
      ipAddress,
    });

    return { success: true };
  }

  // =========================================================================
  // DEPENDENCY OPERATIONS WITH DFS CYCLE DETECTION
  // =========================================================================
  async addDependency(
    sourceTicketIdOrId: string,
    dto: CreateDependencyDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ) {
    return await this.executeWithWriteLock(async () => {
      const sourceTask = await this.getTaskById(sourceTicketIdOrId, user);
      const targetTask = await this.getTaskById(dto.targetTicketId, user);

      if (sourceTask.id === targetTask.id) {
        throw new BadRequestException('A work item cannot depend on itself');
      }

      // Duplicate check
      const existing = await this.prisma.taskDependency.findFirst({
        where: {
          OR: [
            { taskId: sourceTask.id, targetTaskId: targetTask.id, type: dto.type },
            dto.type === DependencyType.RELATES_TO
              ? { taskId: targetTask.id, targetTaskId: sourceTask.id, type: dto.type }
              : {},
          ],
        },
      });

      if (existing) {
        throw new BadRequestException('This dependency relationship already exists');
      }

      // Directional Cycle Detection for BLOCKS: source BLOCKS target
      // Check if path already exists from target to source in BLOCKS graph
      if (dto.type === DependencyType.BLOCKS) {
        const hasCycle = await this.checkBlocksCycle(targetTask.id, sourceTask.id);
        if (hasCycle) {
          throw new BadRequestException(
            `Circular blocking dependency detected: ${targetTask.ticketId} already directly or indirectly blocks ${sourceTask.ticketId}`,
          );
        }
      }

      const dep = await this.prisma.taskDependency.create({
        data: {
          taskId: sourceTask.id,
          targetTaskId: targetTask.id,
          type: dto.type,
        },
        include: {
          task: { select: { ticketId: true, title: true } },
          targetTask: { select: { ticketId: true, title: true } },
        },
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'DEPENDENCY_ADDED',
        entityName: 'TaskDependency',
        entityId: dep.id,
        metadata: {
          sourceId: sourceTask.id,
          sourceTicketId: sourceTask.ticketId,
          targetId: targetTask.id,
          targetTicketId: targetTask.ticketId,
          type: dto.type,
        },
        ipAddress,
      });

      return dep;
    });
  }

  private async checkBlocksCycle(fromTaskId: string, targetTaskId: string): Promise<boolean> {
    const visited = new Set<string>();
    const queue: string[] = [fromTaskId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetTaskId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const outgoing = await this.prisma.taskDependency.findMany({
        where: { taskId: current, type: DependencyType.BLOCKS },
        select: { targetTaskId: true },
      });

      for (const edge of outgoing) {
        if (!visited.has(edge.targetTaskId)) {
          queue.push(edge.targetTaskId);
        }
      }
    }

    return false;
  }

  async removeDependency(dependencyId: string, user: { id: string; roleCode: RoleCode }, ipAddress?: string) {
    const dep = await this.prisma.taskDependency.findUnique({
      where: { id: dependencyId },
      include: { task: true, targetTask: true },
    });
    if (!dep) throw new NotFoundException('Dependency not found');

    await this.prisma.taskDependency.delete({ where: { id: dependencyId } });

    await this.auditService.log({
      actorId: user.id,
      action: 'DEPENDENCY_REMOVED',
      entityName: 'TaskDependency',
      entityId: dependencyId,
      metadata: { sourceId: dep.taskId, targetId: dep.targetTaskId, type: dep.type },
      ipAddress,
    });

    return { success: true };
  }

  // =========================================================================
  // COMMENTS
  // =========================================================================
  async addComment(ticketIdOrId: string, content: string, user: { id: string; roleCode: RoleCode }) {
    const task = await this.getTaskById(ticketIdOrId, user);

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId: task.id,
        authorId: user.id,
        content: content.trim(),
      },
      include: { author: { select: { fullName: true, email: true } } },
    });

    return {
      ...comment,
      authorName: comment.author?.fullName,
      authorEmail: comment.author?.email,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  async getProjectBacklog(
    projectId: string,
    user: { id: string; roleCode: RoleCode },
    query: { cursor?: string; limit?: number; type?: string; priority?: string } = {},
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      const isMember = project.members.some((m) => m.userId === user.id);
      if (!isMember) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }
    } else if (user.roleCode === RoleCode.ROLE_LEAD) {
      const isLead = project.leadId === user.id || project.members.some((m) => m.userId === user.id);
      if (!isLead) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }
    }

    const limit = Math.min(query.limit || 50, 100);
    const where: any = {
      projectId,
      sprintId: null,
      status: { notIn: [WorkItemStatus.DONE, WorkItemStatus.CANCELLED] },
    };

    if (query.type) where.type = query.type.toUpperCase();
    if (query.priority) where.priority = query.priority;

    const findOptions: any = {
      where,
      take: limit + 1,
      orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }, { ticketId: 'asc' }],
      include: {
        creator: { select: { id: true, fullName: true, email: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
        team: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, key: true } },
        sprint: { select: { id: true, name: true, status: true } },
        parentTask: { select: { id: true, ticketId: true, title: true, type: true } },
        subTasks: {
          select: { id: true, ticketId: true, title: true, type: true, status: true },
        },
        acceptanceCriteria: { select: { id: true, isMandatory: true, isCompleted: true } },
        points: { select: { id: true, isRequired: true, isCompleted: true } },
        evidence: { select: { id: true, type: true } },
        dependencies: {
          include: {
            targetTask: { select: { id: true, ticketId: true, status: true } },
          },
        },
        inverseDependencies: {
          include: {
            task: { select: { id: true, ticketId: true, status: true } },
          },
        },
      },
    };

    if (query.cursor) {
      findOptions.cursor = { id: query.cursor };
      findOptions.skip = 1;
    }

    const tasks = await this.prisma.task.findMany(findOptions);

    let nextCursor: string | null = null;
    if (tasks.length > limit) {
      const nextItem = tasks.pop();
      nextCursor = nextItem!.id;
    }

    const items = tasks.map((t) => this.mapTaskAggregate(t));
    return { items, nextCursor, totalReturned: items.length };
  }

  async reorderBacklog(
    projectId: string,
    dto: { ticketId: string; targetRankAbove?: string; targetRankBelow?: string },
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ) {
    return await this.executeWithWriteLock(async () => {
      const task = await this.prisma.task.findFirst({
        where: {
          OR: [{ id: dto.ticketId }, { ticketId: dto.ticketId }],
          projectId,
        },
      });

      if (!task) {
        throw new NotFoundException(`Task ${dto.ticketId} not found in project ${projectId}`);
      }

      if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
        throw new ForbiddenException('Only Leads and Managers can reorder the backlog');
      }

      let prevRank: string | null = null;
      let nextRank: string | null = null;

      if (dto.targetRankAbove) {
        const aboveTask = await this.prisma.task.findFirst({
          where: {
            OR: [{ id: dto.targetRankAbove }, { ticketId: dto.targetRankAbove }, { rank: dto.targetRankAbove }],
            projectId,
          },
          select: { rank: true },
        });
        prevRank = aboveTask?.rank || dto.targetRankAbove;
      }

      if (dto.targetRankBelow) {
        const belowTask = await this.prisma.task.findFirst({
          where: {
            OR: [{ id: dto.targetRankBelow }, { ticketId: dto.targetRankBelow }, { rank: dto.targetRankBelow }],
            projectId,
          },
          select: { rank: true },
        });
        nextRank = belowTask?.rank || dto.targetRankBelow;
      }

      // Handle order normalization
      if (prevRank && nextRank && prevRank > nextRank) {
        const temp = prevRank;
        prevRank = nextRank;
        nextRank = temp;
      }

      // Check for any task already placed between prevRank and nextRank
      if (prevRank && nextRank) {
        const intermediateTask = await this.prisma.task.findFirst({
          where: {
            projectId,
            id: { not: task.id },
            rank: { gt: prevRank, lt: nextRank },
          },
          orderBy: { rank: 'desc' },
          select: { rank: true },
        });
        if (intermediateTask && intermediateTask.rank) {
          prevRank = intermediateTask.rank;
        }
      } else if (prevRank && !nextRank) {
        const nextImmediate = await this.prisma.task.findFirst({
          where: {
            projectId,
            id: { not: task.id },
            rank: { gt: prevRank },
          },
          orderBy: { rank: 'asc' },
          select: { rank: true },
        });
        if (nextImmediate && nextImmediate.rank) {
          nextRank = nextImmediate.rank;
        }
      } else if (!prevRank && nextRank) {
        const prevImmediate = await this.prisma.task.findFirst({
          where: {
            projectId,
            id: { not: task.id },
            rank: { lt: nextRank },
          },
          orderBy: { rank: 'desc' },
          select: { rank: true },
        });
        if (prevImmediate && prevImmediate.rank) {
          prevRank = prevImmediate.rank;
        }
      }

      let newRank = LexoRank.calculateBetween(prevRank, nextRank);

      // Verify that newRank does not collide with any existing task in the project
      let existingWithRank = await this.prisma.task.findFirst({
        where: {
          projectId,
          id: { not: task.id },
          rank: newRank,
        },
        select: { id: true },
      });

      let attempts = 0;
      while (existingWithRank && attempts < 10) {
        newRank = LexoRank.calculateBetween(newRank, nextRank);
        existingWithRank = await this.prisma.task.findFirst({
          where: {
            projectId,
            id: { not: task.id },
            rank: newRank,
          },
          select: { id: true },
        });
        attempts++;
      }

      await this.prisma.task.update({
        where: { id: task.id },
        data: { rank: newRank },
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'BACKLOG_REORDERED',
        entityName: 'Task',
        entityId: task.id,
        metadata: {
          ticketId: task.ticketId,
          previousRank: task.rank,
          newRank,
          targetRankAbove: dto.targetRankAbove,
          targetRankBelow: dto.targetRankBelow,
        },
        ipAddress,
      });

      return { ticketId: task.ticketId, rank: newRank };
    });
  }


  private mapTaskAggregate(t: any) {
    return {
      ...t,
      creatorName: t.creator?.fullName,
      assigneeName: t.assignee?.fullName,
      teamName: t.team?.name,
      projectName: t.project?.name,
      sprintId: t.sprintId || null,
      sprintName: t.sprint?.name || null,
      rank: t.rank || '0|hzzzzz:',
      storyPoints: t.storyPoints ?? null,
      parentTicketId: t.parentTask?.ticketId || null,
      parentTitle: t.parentTask?.title || null,
      parentType: t.parentTask?.type || null,
      urgency: this.calculateUrgency(t.deadline, t.status),
      acceptanceCriteria: (t.acceptanceCriteria || []).map((c: any) => ({
        ...c,
        createdByName: c.createdBy?.fullName,
        completedByName: c.completedBy?.fullName,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        completedAt: c.completedAt?.toISOString() || null,
      })),
      points: (t.points || []).map((p: any) => ({
        ...p,
        authorName: p.author?.fullName,
        completedByName: p.completedBy?.fullName,
        createdAt: p.createdAt.toISOString(),
        completedAt: p.completedAt?.toISOString() || null,
      })),
      evidence: (t.evidence || []).map((e: any) => ({
        ...e,
        uploaderName: e.uploader?.fullName,
        createdAt: e.createdAt.toISOString(),
      })),
      dependencies: (t.dependencies || []).map((d: any) => ({
        id: d.id,
        taskId: d.taskId,
        targetTaskId: d.targetTaskId,
        targetTicketId: d.targetTask?.ticketId,
        targetTitle: d.targetTask?.title,
        targetStatus: d.targetTask?.status,
        type: d.type,
        createdAt: d.createdAt.toISOString(),
      })),
      inverseDependencies: (t.inverseDependencies || []).map((d: any) => ({
        id: d.id,
        taskId: d.taskId,
        taskTicketId: d.task?.ticketId,
        taskTitle: d.task?.title,
        taskStatus: d.task?.status,
        targetTaskId: d.targetTaskId,
        type: d.type,
        createdAt: d.createdAt.toISOString(),
      })),
      comments: (t.comments || []).map((c: any) => ({
        ...c,
        authorName: c.author?.fullName,
        authorEmail: c.author?.email,
        createdAt: c.createdAt.toISOString(),
      })),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      startDate: t.startDate?.toISOString() || null,
      deadline: t.deadline?.toISOString() || null,
      completedAt: t.completedAt?.toISOString() || null,
    };
  }
}
