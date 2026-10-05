import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';
import { LexoRank } from '../common/lexorank';
import {
  RoleCode,
  WorkItemStatus,
  BoardType,
  WipLimitType,
  CreateBoardDto,
  MoveBoardCardDto,
  TaskFilterDto,
  BoardDto,
} from '@workdesk/shared';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly tasksService: TasksService,
  ) {}

  private async verifyProjectAccess(
    projectId: string,
    user: { id: string; roleCode: RoleCode },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      const isMember = project.members.some((m) => m.userId === user.id);
      if (!isMember) throw new NotFoundException(`Project ${projectId} not found`);
    } else if (user.roleCode === RoleCode.ROLE_LEAD) {
      const isLead =
        project.leadId === user.id || project.members.some((m) => m.userId === user.id);
      if (!isLead) throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project;
  }

  async getProjectBoards(
    projectId: string,
    user: { id: string; roleCode: RoleCode },
  ): Promise<BoardDto[]> {
    await this.verifyProjectAccess(projectId, user);

    const boards = await this.prisma.board.findMany({
      where: { projectId },
      include: {
        project: { select: { name: true } },
        columns: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return boards.map((b) => this.mapBoard(b));
  }

  async getBoardById(
    boardId: string,
    user: { id: string; roleCode: RoleCode },
  ): Promise<BoardDto> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        project: { select: { name: true } },
        columns: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!board) throw new NotFoundException(`Board ${boardId} not found`);
    await this.verifyProjectAccess(board.projectId, user);

    return this.mapBoard(board);
  }

  async createBoard(
    dto: CreateBoardDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<BoardDto> {
    await this.verifyProjectAccess(dto.projectId, user);

    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      throw new ForbiddenException('Only Leads and Managers can create boards');
    }

    const defaultColumns = [
      { name: 'To Do', orderIndex: 0, wipLimit: 0, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['TODO', 'REOPENED', 'DRAFT']) },
      { name: 'In Progress', orderIndex: 1, wipLimit: 5, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['IN_PROGRESS']) },
      { name: 'In Review', orderIndex: 2, wipLimit: 4, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['IN_REVIEW', 'CHANGES_REQUESTED']) },
      { name: 'Done', orderIndex: 3, wipLimit: 0, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['APPROVED', 'DONE']) },
    ];

    const columnsToCreate = dto.columns?.length
      ? dto.columns.map((c) => ({
          name: c.name,
          orderIndex: c.orderIndex,
          wipLimit: c.wipLimit || 0,
          wipLimitType: c.wipLimitType || 'WARNING',
          mappedStatuses: JSON.stringify(c.mappedStatuses),
        }))
      : defaultColumns;

    const board = await this.prisma.board.create({
      data: {
        projectId: dto.projectId,
        name: dto.name.trim(),
        type: dto.type || BoardType.KANBAN,
        filterQuery: dto.filterQuery || null,
        createdById: user.id,
        columns: { create: columnsToCreate },
      },
      include: {
        project: { select: { name: true } },
        columns: { orderBy: { orderIndex: 'asc' } },
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'BOARD_CREATED',
      entityName: 'Board',
      entityId: board.id,
      metadata: { name: board.name, type: board.type, columnCount: board.columns.length },
      ipAddress,
    });

    return this.mapBoard(board);
  }

  async getBoardTasks(
    boardId: string,
    filter: TaskFilterDto = {},
    user: { id: string; roleCode: RoleCode },
  ) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        project: { select: { name: true } },
        columns: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!board) throw new NotFoundException(`Board ${boardId} not found`);
    await this.verifyProjectAccess(board.projectId, user);

    const where: any = {
      projectId: board.projectId,
    };

    if (filter.sprintId) {
      if (filter.sprintId === 'NONE') {
        where.sprintId = null;
      } else if (filter.sprintId === 'ACTIVE') {
        const activeSprint = await this.prisma.sprint.findFirst({
          where: { projectId: board.projectId, status: 'ACTIVE' },
        });
        where.sprintId = activeSprint ? activeSprint.id : 'NONE';
      } else {
        where.sprintId = filter.sprintId;
      }
    }

    if (filter.types?.length) {
      where.type = { in: filter.types };
    }
    if (filter.priorities?.length) {
      where.priority = { in: filter.priorities };
    }
    if (filter.assigneeIds?.length) {
      where.assigneeId = { in: filter.assigneeIds };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
      include: {
        creator: { select: { fullName: true } },
        assignee: { select: { fullName: true } },
        project: { select: { name: true } },
        team: { select: { name: true } },
        sprint: { select: { id: true, name: true } },
        parentTask: { select: { id: true, ticketId: true, title: true, type: true } },
        subTasks: {
          select: { id: true, ticketId: true, title: true, status: true },
        },
        acceptanceCriteria: { select: { id: true, isMandatory: true, isCompleted: true } },
        evidence: { select: { id: true, type: true } },
        dependencies: { select: { id: true, type: true, targetTaskId: true } },
        inverseDependencies: { select: { id: true, type: true, taskId: true } },
      },
    });

    const mappedTasks = tasks.map((t) => ({
      ...t,
      creatorName: t.creator?.fullName,
      assigneeName: t.assignee?.fullName,
      projectName: t.project?.name,
      teamName: t.team?.name,
      sprintName: t.sprint?.name || null,
      urgency: this.tasksService.calculateUrgency(t.deadline, t.status),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      startDate: t.startDate?.toISOString() || null,
      deadline: t.deadline?.toISOString() || null,
      completedAt: t.completedAt?.toISOString() || null,
    }));

    // Partition tasks into board columns
    const columnsWithTasks = board.columns.map((col) => {
      let mappedStatuses: string[] = [];
      try {
        mappedStatuses = JSON.parse(col.mappedStatuses);
      } catch {
        mappedStatuses = [];
      }

      const colTasks = mappedTasks.filter((t) => mappedStatuses.includes(t.status));
      const taskCount = colTasks.length;
      const isWipExceeded = col.wipLimit > 0 && taskCount > col.wipLimit;

      return {
        id: col.id,
        boardId: col.boardId,
        name: col.name,
        orderIndex: col.orderIndex,
        wipLimit: col.wipLimit,
        wipLimitType: col.wipLimitType as WipLimitType,
        mappedStatuses: mappedStatuses as WorkItemStatus[],
        tasks: colTasks as any,
        taskCount,
        isWipExceeded,
      };
    });

    return {
      board: this.mapBoard(board),
      columns: columnsWithTasks,
      totalTasks: tasks.length,
    };
  }

  /**
   * Governed Drag-and-Drop Card Move
   */
  async moveBoardCard(
    boardId: string,
    ticketId: string,
    dto: MoveBoardCardDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ) {
    return await this.tasksService.executeWithWriteLock(async () => {
      // 1. Verify board exists
      const board = await this.prisma.board.findUnique({
        where: { id: boardId },
        include: { columns: true },
      });
      if (!board) throw new NotFoundException(`Board ${boardId} not found`);

      // 2. Verify target column belongs to board
      const targetColumn = board.columns.find((c) => c.id === dto.targetColumnId);
      if (!targetColumn) {
        throw new NotFoundException(`Column ${dto.targetColumnId} not found on board ${boardId}`);
      }

      // 3. Verify task exists and is in project scope via strict 404 guard
      const task = await this.tasksService.getTaskById(ticketId, user);
      if (task.projectId !== board.projectId) {
        throw new BadRequestException('Task does not belong to the board project');
      }

      let mappedStatuses: WorkItemStatus[] = [];
      try {
        mappedStatuses = JSON.parse(targetColumn.mappedStatuses);
      } catch {
        mappedStatuses = [];
      }

      // 4. Resolve Target Status
      let targetStatus: WorkItemStatus;
      if (mappedStatuses.includes(task.status)) {
        targetStatus = task.status;
      } else if (dto.targetStatus && mappedStatuses.includes(dto.targetStatus)) {
        targetStatus = dto.targetStatus;
      } else {
        targetStatus = mappedStatuses[0] || task.status;
      }

      // Review Gate Redirect
      if (task.requiresReview && targetStatus === WorkItemStatus.DONE && task.status !== WorkItemStatus.APPROVED) {
        targetStatus = WorkItemStatus.IN_REVIEW;
      }

      // 5. WIP Limits Enforcement
      const isDoneColumn = mappedStatuses.includes(WorkItemStatus.DONE);
      if (!isDoneColumn && targetStatus !== task.status && targetColumn.wipLimit > 0) {
        const currentCount = await this.prisma.task.count({
          where: {
            projectId: board.projectId,
            status: { in: mappedStatuses },
          },
        });

        if (currentCount >= targetColumn.wipLimit) {
          if (targetColumn.wipLimitType === 'HARD_LIMIT') {
            if (dto.overrideWipLimit) {
              if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
                throw new ForbiddenException('Only Leads and Managers can override hard WIP limits');
              }
              if (!dto.overrideReason || dto.overrideReason.trim().length < 10) {
                throw new BadRequestException('An override reason of at least 10 characters is required to bypass WIP hard limits');
              }

              await this.auditService.log({
                actorId: user.id,
                action: 'WIP_HARD_LIMIT_OVERRIDDEN',
                entityName: 'BoardColumn',
                entityId: targetColumn.id,
                metadata: {
                  columnName: targetColumn.name,
                  wipLimit: targetColumn.wipLimit,
                  currentCount,
                  ticketId: task.ticketId,
                  overrideReason: dto.overrideReason,
                },
                ipAddress,
              });
            } else {
              throw new BadRequestException(
                `Column WIP limit reached: Column '${targetColumn.name}' is capped at ${targetColumn.wipLimit} tasks (currently ${currentCount})`,
              );
            }
          } else {
            // WARNING mode
            await this.auditService.log({
              actorId: user.id,
              action: 'WIP_LIMIT_EXCEEDED',
              entityName: 'BoardColumn',
              entityId: targetColumn.id,
              metadata: {
                columnName: targetColumn.name,
                wipLimit: targetColumn.wipLimit,
                currentCount: currentCount + 1,
                ticketId: task.ticketId,
              },
              ipAddress,
            });
          }
        }
      }

      // 6. Phase 2 State Transition Engine (Validates state machine, Done Gate, review gates)
      if (targetStatus !== task.status) {
        await this.tasksService.transitionTask(
          task.ticketId,
          {
            targetStatus,
            blockerReason: dto.overrideReason,
            comment: `Moved via Board: ${board.name}`,
          },
          user,
          ipAddress,
        );
      }

      // 7. LexoRank Positioning
      let finalRank = task.rank;
      if (dto.targetRankAbove || dto.targetRankBelow) {
        let prevRank: string | null = null;
        let nextRank: string | null = null;

        if (dto.targetRankAbove) {
          const aboveTask = await this.prisma.task.findFirst({
            where: {
              OR: [
                { id: dto.targetRankAbove },
                { ticketId: dto.targetRankAbove },
                { rank: dto.targetRankAbove },
              ],
              projectId: board.projectId,
            },
            select: { rank: true },
          });
          prevRank = aboveTask?.rank || dto.targetRankAbove;
        }

        if (dto.targetRankBelow) {
          const belowTask = await this.prisma.task.findFirst({
            where: {
              OR: [
                { id: dto.targetRankBelow },
                { ticketId: dto.targetRankBelow },
                { rank: dto.targetRankBelow },
              ],
              projectId: board.projectId,
            },
            select: { rank: true },
          });
          nextRank = belowTask?.rank || dto.targetRankBelow;
        }

        finalRank = LexoRank.calculateBetween(prevRank, nextRank);

        await this.prisma.task.update({
          where: { id: task.id },
          data: { rank: finalRank },
        });
      }

      await this.auditService.log({
        actorId: user.id,
        action: 'BOARD_CARD_MOVED',
        entityName: 'Task',
        entityId: task.id,
        metadata: {
          boardId: board.id,
          ticketId: task.ticketId,
          fromStatus: task.status,
          toStatus: targetStatus,
          targetColumnId: targetColumn.id,
          rank: finalRank,
        },
        ipAddress,
      });

      return await this.tasksService.getTaskById(task.ticketId, user);
    });
  }

  private mapBoard(b: any): BoardDto {
    return {
      id: b.id,
      projectId: b.projectId,
      projectName: b.project?.name,
      name: b.name,
      type: b.type as BoardType,
      filterQuery: b.filterQuery || null,
      columns: (b.columns || []).map((c: any) => {
        let mappedStatuses: WorkItemStatus[] = [];
        try {
          mappedStatuses = JSON.parse(c.mappedStatuses);
        } catch {
          mappedStatuses = [];
        }
        return {
          id: c.id,
          boardId: c.boardId,
          name: c.name,
          orderIndex: c.orderIndex,
          wipLimit: c.wipLimit,
          wipLimitType: c.wipLimitType as WipLimitType,
          mappedStatuses,
        };
      }),
      createdById: b.createdById,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }
}
