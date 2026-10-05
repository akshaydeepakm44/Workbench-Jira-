import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';
import {
  RoleCode,
  SprintStatus,
  WorkItemStatus,
  CreateSprintDto,
  UpdateSprintDto,
  StartSprintDto,
  CompleteSprintDto,
  SprintDto,
  SprintDetailDto,
} from '@workdesk/shared';

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly tasksService: TasksService,
  ) {}

  /**
   * Helper to verify project access and resource scope
   */
  private async verifyProjectAccess(
    projectId: string,
    user: { id: string; roleCode: RoleCode },
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
      const isLead =
        project.leadId === user.id || project.members.some((m) => m.userId === user.id);
      if (!isLead) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }
    }
    return project;
  }

  /**
   * Create a new sprint in PLANNED state
   */
  async createSprint(
    dto: CreateSprintDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<SprintDto> {
    await this.verifyProjectAccess(dto.projectId, user);

    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      throw new ForbiddenException('Only Leads and Managers can create sprints');
    }

    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate).getTime();
      const end = new Date(dto.endDate).getTime();
      if (end <= start) {
        throw new BadRequestException('Sprint endDate must be strictly after startDate');
      }
    }

    const sprint = await this.prisma.sprint.create({
      data: {
        projectId: dto.projectId,
        teamId: dto.teamId || null,
        name: dto.name.trim(),
        goal: dto.goal?.trim() || null,
        status: SprintStatus.PLANNED,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        capacityPoints: dto.capacityPoints || null,
        createdById: user.id,
      },
      include: { project: { select: { name: true } }, team: { select: { name: true } } },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'SPRINT_CREATED',
      entityName: 'Sprint',
      entityId: sprint.id,
      metadata: { name: sprint.name, projectId: sprint.projectId, goal: sprint.goal },
      ipAddress,
    });

    return this.mapSprint(sprint);
  }

  /**
   * Get all sprints for a project
   */
  async getProjectSprints(
    projectId: string,
    user: { id: string; roleCode: RoleCode },
  ): Promise<SprintDto[]> {
    await this.verifyProjectAccess(projectId, user);

    const sprints = await this.prisma.sprint.findMany({
      where: { projectId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        project: { select: { name: true } },
        team: { select: { name: true } },
        tasks: {
          select: { id: true, status: true, storyPoints: true },
        },
      },
    });

    return sprints.map((s) => {
      const taskCount = s.tasks.length;
      const completedTaskCount = s.tasks.filter((t) => t.status === WorkItemStatus.DONE).length;
      const totalStoryPoints = s.tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const completedStoryPoints = s.tasks
        .filter((t) => t.status === WorkItemStatus.DONE)
        .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

      return {
        ...this.mapSprint(s),
        taskCount,
        completedTaskCount,
        totalStoryPoints,
        completedStoryPoints,
      };
    });
  }

  /**
   * Get sprint detail including member tasks and commitments
   */
  async getSprintById(
    sprintId: string,
    user: { id: string; roleCode: RoleCode },
  ): Promise<SprintDetailDto> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        project: { select: { name: true } },
        team: { select: { name: true } },
        commitments: {
          include: {
            task: {
              select: { id: true, ticketId: true, title: true, status: true },
            },
          },
          orderBy: { addedAt: 'asc' },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException(`Sprint ${sprintId} not found`);
    }

    await this.verifyProjectAccess(sprint.projectId, user);

    // Fetch full tasks belonging currently to sprint
    const tasks = await this.prisma.task.findMany({
      where: { sprintId: sprint.id },
      orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
      include: {
        creator: { select: { fullName: true } },
        assignee: { select: { fullName: true } },
        project: { select: { name: true } },
        team: { select: { name: true } },
      },
    });

    const mappedTasks = tasks.map((t) => ({
      ...t,
      creatorName: t.creator?.fullName,
      assigneeName: t.assignee?.fullName,
      projectName: t.project?.name,
      teamName: t.team?.name,
      urgency: this.tasksService.calculateUrgency(t.deadline, t.status),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      startDate: t.startDate?.toISOString() || null,
      deadline: t.deadline?.toISOString() || null,
      completedAt: t.completedAt?.toISOString() || null,
    }));

    const mappedCommitments = sprint.commitments.map((c) => ({
      id: c.id,
      sprintId: c.sprintId,
      taskId: c.taskId,
      ticketId: c.task?.ticketId,
      title: c.task?.title,
      wasPlanned: c.wasPlanned,
      storyPoints: c.storyPoints,
      statusAtStart: c.statusAtStart,
      statusAtEnd: c.statusAtEnd,
      addedAt: c.addedAt.toISOString(),
      removedAt: c.removedAt?.toISOString() || null,
      completedAt: c.completedAt?.toISOString() || null,
      carriedOverToSprintId: c.carriedOverToSprintId,
    }));

    const taskCount = tasks.length;
    const completedTaskCount = tasks.filter((t) => t.status === WorkItemStatus.DONE).length;
    const totalStoryPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const completedStoryPoints = tasks
      .filter((t) => t.status === WorkItemStatus.DONE)
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    return {
      ...this.mapSprint(sprint),
      taskCount,
      completedTaskCount,
      totalStoryPoints,
      completedStoryPoints,
      tasks: mappedTasks as any,
      commitments: mappedCommitments,
    };
  }

  /**
   * Update Sprint (goal, name, dates)
   */
  async updateSprint(
    sprintId: string,
    dto: UpdateSprintDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<SprintDto> {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) throw new NotFoundException(`Sprint ${sprintId} not found`);

    await this.verifyProjectAccess(sprint.projectId, user);

    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      throw new ForbiddenException('Only Leads and Managers can update sprints');
    }

    if (sprint.status === SprintStatus.COMPLETED || sprint.status === SprintStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit a closed sprint');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.goal !== undefined) data.goal = dto.goal ? dto.goal.trim() : null;
    if (dto.capacityPoints !== undefined) data.capacityPoints = dto.capacityPoints;
    if (dto.startDate !== undefined) data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;

    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data,
      include: { project: { select: { name: true } }, team: { select: { name: true } } },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'SPRINT_UPDATED',
      entityName: 'Sprint',
      entityId: sprint.id,
      metadata: data,
      ipAddress,
    });

    return this.mapSprint(updated);
  }

  /**
   * Start Sprint: Enforces Active Sprint Invariant inside write lock
   */
  async startSprint(
    sprintId: string,
    dto: StartSprintDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<SprintDto> {
    return await this.tasksService.executeWithWriteLock(async () => {
      const sprint = await this.prisma.sprint.findUnique({
        where: { id: sprintId },
        include: { tasks: true },
      });
      if (!sprint) throw new NotFoundException(`Sprint ${sprintId} not found`);

      await this.verifyProjectAccess(sprint.projectId, user);

      if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
        throw new ForbiddenException('Only Leads and Managers can start sprints');
      }

      if (sprint.status !== SprintStatus.PLANNED) {
        throw new BadRequestException(`Cannot start sprint in status ${sprint.status}`);
      }

      if (sprint.tasks.length === 0) {
        throw new BadRequestException('Cannot start an empty sprint. Add at least one task.');
      }

      const start = new Date(dto.startDate).getTime();
      const end = new Date(dto.endDate).getTime();
      if (end <= start) {
        throw new BadRequestException('Sprint endDate must be strictly after startDate');
      }

      // Check Active Sprint Invariant
      const activeSprint = await this.prisma.sprint.findFirst({
        where: {
          projectId: sprint.projectId,
          teamId: sprint.teamId ?? null,
          status: SprintStatus.ACTIVE,
        },
      });

      if (activeSprint) {
        throw new ConflictException(
          `Scope already has an active sprint: "${activeSprint.name}" (${activeSprint.id})`,
        );
      }

      // Atomic Start + Commitments Snapshot
      const updated = await this.prisma.$transaction(async (tx) => {
        const started = await tx.sprint.update({
          where: { id: sprintId },
          data: {
            status: SprintStatus.ACTIVE,
            startDate: new Date(dto.startDate),
            endDate: new Date(dto.endDate),
          },
          include: { project: { select: { name: true } }, team: { select: { name: true } } },
        });

        // Snapshot all current tasks into SprintCommitment
        for (const task of sprint.tasks) {
          await tx.sprintCommitment.upsert({
            where: {
              sprintId_taskId: {
                sprintId: sprint.id,
                taskId: task.id,
              },
            },
            create: {
              sprintId: sprint.id,
              taskId: task.id,
              wasPlanned: true,
              storyPoints: task.storyPoints,
              statusAtStart: task.status,
              addedAt: new Date(),
            },
            update: {
              wasPlanned: true,
              statusAtStart: task.status,
              removedAt: null,
            },
          });
        }

        return started;
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'SPRINT_STARTED',
        entityName: 'Sprint',
        entityId: sprint.id,
        metadata: {
          name: sprint.name,
          committedTaskCount: sprint.tasks.length,
          startDate: dto.startDate,
          endDate: dto.endDate,
        },
        ipAddress,
      });

      return this.mapSprint(updated);
    });
  }

  /**
   * Complete Sprint: Records final commitment states and handles carry-over
   */
  async completeSprint(
    sprintId: string,
    dto: CompleteSprintDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<SprintDto> {
    return await this.tasksService.executeWithWriteLock(async () => {
      const sprint = await this.prisma.sprint.findUnique({
        where: { id: sprintId },
        include: { tasks: true },
      });
      if (!sprint) throw new NotFoundException(`Sprint ${sprintId} not found`);

      await this.verifyProjectAccess(sprint.projectId, user);

      if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
        throw new ForbiddenException('Only Leads and Managers can complete sprints');
      }

      if (sprint.status !== SprintStatus.ACTIVE) {
        throw new BadRequestException('Only ACTIVE sprints can be completed');
      }

      if (dto.incompleteTaskAction === 'MOVE_TO_SPRINT' && dto.targetSprintId) {
        const targetSprint = await this.prisma.sprint.findUnique({
          where: { id: dto.targetSprintId },
        });
        if (!targetSprint || targetSprint.projectId !== sprint.projectId) {
          throw new BadRequestException('Target sprint for carry-over must exist in the same project');
        }
      }

      const completed = await this.prisma.$transaction(async (tx) => {
        const now = new Date();

        for (const task of sprint.tasks) {
          const isDone = task.status === WorkItemStatus.DONE;

          if (isDone) {
            await tx.sprintCommitment.updateMany({
              where: { sprintId: sprint.id, taskId: task.id },
              data: {
                completedAt: now,
                statusAtEnd: WorkItemStatus.DONE,
              },
            });
          } else {
            // Incomplete task
            const carryTarget =
              dto.incompleteTaskAction === 'MOVE_TO_SPRINT' ? dto.targetSprintId : null;

            await tx.sprintCommitment.updateMany({
              where: { sprintId: sprint.id, taskId: task.id },
              data: {
                completedAt: null,
                statusAtEnd: task.status,
                carriedOverToSprintId: carryTarget,
              },
            });

            // Update task's current sprintId pointer
            await tx.task.update({
              where: { id: task.id },
              data: { sprintId: carryTarget || null },
            });
          }
        }

        return await tx.sprint.update({
          where: { id: sprintId },
          data: {
            status: SprintStatus.COMPLETED,
            completedAt: now,
          },
          include: { project: { select: { name: true } }, team: { select: { name: true } } },
        });
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'SPRINT_COMPLETED',
        entityName: 'Sprint',
        entityId: sprint.id,
        metadata: {
          name: sprint.name,
          completedAt: completed.completedAt,
          incompleteTaskAction: dto.incompleteTaskAction,
          targetSprintId: dto.targetSprintId,
        },
        ipAddress,
      });

      return this.mapSprint(completed);
    });
  }

  /**
   * Cancel Sprint
   */
  async cancelSprint(
    sprintId: string,
    dto: { reason?: string },
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<SprintDto> {
    return await this.tasksService.executeWithWriteLock(async () => {
      const sprint = await this.prisma.sprint.findUnique({
        where: { id: sprintId },
        include: { tasks: true },
      });
      if (!sprint) throw new NotFoundException(`Sprint ${sprintId} not found`);

      await this.verifyProjectAccess(sprint.projectId, user);

      if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
        throw new ForbiddenException('Only Leads and Managers can cancel sprints');
      }

      if (sprint.status === SprintStatus.COMPLETED) {
        throw new BadRequestException('Cannot cancel an already completed sprint');
      }

      const cancelled = await this.prisma.$transaction(async (tx) => {
        // Return all tasks to Product Backlog
        await tx.task.updateMany({
          where: { sprintId: sprint.id },
          data: { sprintId: null },
        });

        return await tx.sprint.update({
          where: { id: sprintId },
          data: { status: SprintStatus.CANCELLED },
          include: { project: { select: { name: true } }, team: { select: { name: true } } },
        });
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'SPRINT_CANCELLED',
        entityName: 'Sprint',
        entityId: sprint.id,
        metadata: { reason: dto.reason },
        ipAddress,
      });

      return this.mapSprint(cancelled);
    });
  }

  /**
   * Add Tasks to Sprint (Single or Bulk)
   */
  async addTasksToSprint(
    sprintId: string,
    ticketIds: string[],
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ) {
    return await this.tasksService.executeWithWriteLock(async () => {
      const sprint = await this.prisma.sprint.findUnique({
        where: { id: sprintId },
      });
      if (!sprint) throw new NotFoundException(`Sprint ${sprintId} not found`);

      await this.verifyProjectAccess(sprint.projectId, user);

      if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
        throw new ForbiddenException('Only Leads and Managers can assign tasks to sprints');
      }

      if (sprint.status === SprintStatus.COMPLETED || sprint.status === SprintStatus.CANCELLED) {
        throw new BadRequestException('Cannot add tasks to a closed sprint');
      }

      const tasks = await this.prisma.task.findMany({
        where: {
          OR: ticketIds.flatMap((t) => [{ id: t }, { ticketId: t }]),
        },
      });

      if (tasks.length === 0) {
        throw new BadRequestException('No matching tasks found to add');
      }

      // Verify all tasks belong to same project as sprint
      for (const task of tasks) {
        if (task.projectId !== sprint.projectId) {
          throw new BadRequestException(
            `Task ${task.ticketId} belongs to project ${task.projectId}, cannot add to sprint in project ${sprint.projectId}`,
          );
        }
      }

      await this.prisma.$transaction(async (tx) => {
        const now = new Date();

        for (const task of tasks) {
          await tx.task.update({
            where: { id: task.id },
            data: { sprintId: sprint.id },
          });

          // If sprint is ACTIVE, record commitment with wasPlanned = false (Scope Creep)
          if (sprint.status === SprintStatus.ACTIVE) {
            await tx.sprintCommitment.upsert({
              where: {
                sprintId_taskId: {
                  sprintId: sprint.id,
                  taskId: task.id,
                },
              },
              create: {
                sprintId: sprint.id,
                taskId: task.id,
                wasPlanned: false,
                storyPoints: task.storyPoints,
                statusAtStart: task.status,
                addedAt: now,
              },
              update: {
                removedAt: null,
              },
            });
          }
        }
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'SPRINT_SCOPE_CHANGED',
        entityName: 'Sprint',
        entityId: sprint.id,
        metadata: {
          action: 'TASKS_ADDED',
          sprintStatus: sprint.status,
          ticketIds,
        },
        ipAddress,
      });

      return { addedCount: tasks.length, sprintId: sprint.id };
    });
  }

  /**
   * Remove Task from Sprint (Returns to Product Backlog)
   */
  async removeTaskFromSprint(
    sprintId: string,
    ticketId: string,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ) {
    return await this.tasksService.executeWithWriteLock(async () => {
      const sprint = await this.prisma.sprint.findUnique({
        where: { id: sprintId },
      });
      if (!sprint) throw new NotFoundException(`Sprint ${sprintId} not found`);

      await this.verifyProjectAccess(sprint.projectId, user);

      if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
        throw new ForbiddenException('Only Leads and Managers can remove tasks from sprints');
      }

      const task = await this.prisma.task.findFirst({
        where: {
          OR: [{ id: ticketId }, { ticketId }],
          sprintId: sprint.id,
        },
      });

      if (!task) {
        throw new NotFoundException(`Task ${ticketId} not found in sprint ${sprintId}`);
      }

      await this.prisma.$transaction(async (tx) => {
        // Return to Product Backlog
        await tx.task.update({
          where: { id: task.id },
          data: { sprintId: null },
        });

        // If sprint is active, stamp removedAt
        if (sprint.status === SprintStatus.ACTIVE) {
          await tx.sprintCommitment.updateMany({
            where: { sprintId: sprint.id, taskId: task.id },
            data: { removedAt: new Date() },
          });
        }
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'SPRINT_SCOPE_CHANGED',
        entityName: 'Sprint',
        entityId: sprint.id,
        metadata: {
          action: 'TASK_REMOVED',
          ticketId: task.ticketId,
        },
        ipAddress,
      });

      return { removedTicketId: task.ticketId, sprintId: sprint.id };
    });
  }

  private mapSprint(s: any): SprintDto {
    return {
      id: s.id,
      projectId: s.projectId,
      projectName: s.project?.name,
      teamId: s.teamId || null,
      teamName: s.team?.name || null,
      name: s.name,
      goal: s.goal || null,
      status: s.status as SprintStatus,
      startDate: s.startDate?.toISOString() || null,
      endDate: s.endDate?.toISOString() || null,
      completedAt: s.completedAt?.toISOString() || null,
      capacityPoints: s.capacityPoints ?? null,
      createdById: s.createdById,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}
