import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';
import {
  RoleCode,
  TimelineResponseDto,
  TimelineTaskDto,
  RescheduleTaskDto,
  WorkItemType,
  WorkItemStatus,
  TaskPriority,
  TaskUrgency,
  DependencyType,
} from '@workdesk/shared';

@Injectable()
export class TimelineService {
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
      const isLeadOrMember =
        project.leadId === user.id ||
        project.members.some((m) => m.userId === user.id);
      if (!isLeadOrMember) throw new NotFoundException(`Project ${projectId} not found`);
    }

    return project;
  }

  /**
   * Resolve hierarchy level:
   * 1: Initiative, 2: Epic, 3: Standard (Story/Task/Bug/etc), 4: Subtask, 0: Milestone
   */
  private resolveLevel(type: string): number {
    switch (type) {
      case WorkItemType.INITIATIVE:
        return 1;
      case WorkItemType.EPIC:
        return 2;
      case WorkItemType.SUBTASK:
        return 4;
      case WorkItemType.MILESTONE:
        return 0;
      default:
        return 3;
    }
  }

  /**
   * Get Project Timeline with Critical Path calculation
   */
  async getProjectTimeline(
    projectId: string,
    user: { id: string; roleCode: RoleCode },
  ): Promise<TimelineResponseDto> {
    const project = await this.verifyProjectAccess(projectId, user);

    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { fullName: true } },
        parentTask: { select: { ticketId: true } },
        dependencies: {
          include: {
            targetTask: { select: { id: true, ticketId: true, type: true } },
          },
        },
      },
      orderBy: [{ startDate: 'asc' }, { deadline: 'asc' }, { rank: 'asc' }],
    });

    const now = new Date();

    // 1. Calculate duration and standard timeline properties
    const timelineTasks: (TimelineTaskDto & { _durationDays: number })[] = tasks.map((t) => {
      const level = this.resolveLevel(t.type);
      const isMilestone = t.type === WorkItemType.MILESTONE;

      let durationDays = 1;
      if (isMilestone) {
        durationDays = 0;
      } else if (t.startDate && t.deadline) {
        const diffMs = t.deadline.getTime() - t.startDate.getTime();
        durationDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      } else if (t.estimatedHours) {
        durationDays = Math.max(1, Math.ceil(t.estimatedHours / 8));
      }

      return {
        id: t.id,
        ticketId: t.ticketId,
        title: t.title,
        type: t.type as WorkItemType,
        status: t.status as WorkItemStatus,
        priority: t.priority as TaskPriority,
        urgency: this.tasksService.calculateUrgency(t.deadline, t.status),
        startDate: t.startDate?.toISOString() || null,
        deadline: t.deadline?.toISOString() || null,
        completedAt: t.completedAt?.toISOString() || null,
        durationDays,
        _durationDays: durationDays,
        parentTicketId: t.parentTask?.ticketId || null,
        level,
        assigneeId: t.assigneeId,
        assigneeName: t.assignee?.fullName || null,
        dependencies: t.dependencies.map((d) => ({
          targetTaskId: d.targetTaskId,
          targetTicketId: d.targetTask.ticketId,
          type: d.type,
        })),
        isCriticalPath: false,
        totalSlackDays: 0,
      };
    });

    // 2. Critical Path Method (CPM) using ONLY 'BLOCKS' dependencies
    // A BLOCKS B means A is predecessor, B is successor (B cannot start until A finishes)
    const taskMap = new Map<string, typeof timelineTasks[0]>();
    timelineTasks.forEach((t) => taskMap.set(t.id, t));

    // Build adjacency and predecessors for BLOCKS
    const successors = new Map<string, string[]>();
    const predecessors = new Map<string, string[]>();
    timelineTasks.forEach((t) => {
      successors.set(t.id, []);
      predecessors.set(t.id, []);
    });

    timelineTasks.forEach((t) => {
      t.dependencies.forEach((d) => {
        if (d.type === DependencyType.BLOCKS && taskMap.has(d.targetTaskId)) {
          // t.id BLOCKS d.targetTaskId -> t.id is predecessor, d.targetTaskId is successor
          successors.get(t.id)!.push(d.targetTaskId);
          predecessors.get(d.targetTaskId)!.push(t.id);
        }
      });
    });

    // Topological Sort / Kahn's algorithm
    const inDegree = new Map<string, number>();
    timelineTasks.forEach((t) => inDegree.set(t.id, predecessors.get(t.id)!.length));

    const queue: string[] = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    const topoOrder: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      topoOrder.push(u);
      for (const v of successors.get(u) || []) {
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v)! === 0) {
          queue.push(v);
        }
      }
    }

    // Forward Pass: Earliest Start (ES) and Earliest Finish (EF)
    const es = new Map<string, number>();
    const ef = new Map<string, number>();
    timelineTasks.forEach((t) => {
      es.set(t.id, 0);
      ef.set(t.id, t._durationDays);
    });

    for (const u of topoOrder) {
      const uTask = taskMap.get(u)!;
      const uEF = (es.get(u) || 0) + uTask._durationDays;
      ef.set(u, uEF);

      for (const v of successors.get(u) || []) {
        const curES = es.get(v) || 0;
        if (uEF > curES) {
          es.set(v, uEF);
        }
      }
    }

    // Maximum project duration
    let maxProjectEF = 0;
    ef.forEach((val) => {
      if (val > maxProjectEF) maxProjectEF = val;
    });

    // Backward Pass: Latest Start (LS) and Latest Finish (LF)
    const ls = new Map<string, number>();
    const lf = new Map<string, number>();
    timelineTasks.forEach((t) => {
      lf.set(t.id, maxProjectEF);
      ls.set(t.id, maxProjectEF - t._durationDays);
    });

    for (let i = topoOrder.length - 1; i >= 0; i--) {
      const u = topoOrder[i];
      const uTask = taskMap.get(u)!;
      const uSuccessors = successors.get(u) || [];

      if (uSuccessors.length > 0) {
        let minSuccessorLS = Infinity;
        for (const v of uSuccessors) {
          const vLS = ls.get(v) ?? maxProjectEF;
          if (vLS < minSuccessorLS) minSuccessorLS = vLS;
        }
        lf.set(u, minSuccessorLS);
      } else {
        lf.set(u, maxProjectEF);
      }

      ls.set(u, (lf.get(u) || maxProjectEF) - uTask._durationDays);
    }

    // Determine Slack and Critical Path
    const criticalPathTicketIds: string[] = [];
    const hasEdges = timelineTasks.some((t) =>
      t.dependencies.some((d) => d.type === DependencyType.BLOCKS),
    );

    timelineTasks.forEach((t) => {
      const slack = (ls.get(t.id) || 0) - (es.get(t.id) || 0);
      t.totalSlackDays = Math.max(0, slack);

      // On critical path if slack == 0 and participates in active blocking chain
      if (hasEdges && slack === 0 && (successors.get(t.id)!.length > 0 || predecessors.get(t.id)!.length > 0)) {
        t.isCriticalPath = true;
        criticalPathTicketIds.push(t.ticketId);
      }
    });

    return {
      projectId: project.id,
      projectName: project.name,
      tasks: timelineTasks.map(({ _durationDays, ...rest }) => rest),
      criticalPathTicketIds,
    };
  }

  /**
   * Reschedule task dates within Phase 2 PATCH boundary
   */
  async rescheduleTask(
    ticketId: string,
    dto: RescheduleTaskDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<TimelineTaskDto> {
    return await this.tasksService.executeWithWriteLock(async () => {
      const task = await this.tasksService.getTaskById(ticketId, user);

      // Authorization: Lead/Manager or assigned Employee
      if (user.roleCode === RoleCode.ROLE_EMPLOYEE && task.assigneeId !== user.id) {
        throw new ForbiddenException('Employees can only reschedule tasks assigned to them');
      }

      const startDate = dto.startDate !== undefined
        ? (dto.startDate ? new Date(dto.startDate) : null)
        : (task.startDate ? new Date(task.startDate) : null);

      const deadline = dto.deadline !== undefined
        ? (dto.deadline ? new Date(dto.deadline) : null)
        : (task.deadline ? new Date(task.deadline) : null);

      if (startDate && deadline && deadline < startDate) {
        throw new BadRequestException('Deadline cannot be earlier than start date');
      }

      const updated = await this.prisma.task.update({
        where: { id: task.id },
        data: {
          startDate,
          deadline,
        },
        include: {
          assignee: { select: { fullName: true } },
          parentTask: { select: { ticketId: true } },
          dependencies: {
            include: { targetTask: { select: { id: true, ticketId: true, type: true } } },
          },
        },
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'TIMELINE_TASK_RESCHEDULED',
        entityName: 'Task',
        entityId: task.id,
        metadata: {
          ticketId: task.ticketId,
          previousStartDate: task.startDate,
          newStartDate: startDate,
          previousDeadline: task.deadline,
          newDeadline: deadline,
        },
        ipAddress,
      });

      const level = this.resolveLevel(updated.type);
      let durationDays = 1;
      if (updated.type === WorkItemType.MILESTONE) {
        durationDays = 0;
      } else if (startDate && deadline) {
        durationDays = Math.max(1, Math.round((deadline.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      }

      return {
        id: updated.id,
        ticketId: updated.ticketId,
        title: updated.title,
        type: updated.type as WorkItemType,
        status: updated.status as WorkItemStatus,
        priority: updated.priority as TaskPriority,
        urgency: this.tasksService.calculateUrgency(updated.deadline, updated.status),
        startDate: updated.startDate?.toISOString() || null,
        deadline: updated.deadline?.toISOString() || null,
        completedAt: updated.completedAt?.toISOString() || null,
        durationDays,
        parentTicketId: updated.parentTask?.ticketId || null,
        level,
        assigneeId: updated.assigneeId,
        assigneeName: updated.assignee?.fullName || null,
        dependencies: updated.dependencies.map((d) => ({
          targetTaskId: d.targetTaskId,
          targetTicketId: d.targetTask.ticketId,
          type: d.type,
        })),
        isCriticalPath: false,
        totalSlackDays: 0,
      };
    });
  }
}
