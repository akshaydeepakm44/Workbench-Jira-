import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RoleCode,
  WorkItemStatus,
  AccountabilityMetricsDto,
  DueDateAdherenceDto,
  SprintSayDoDto,
  ScopeCreepDto,
  BlockerAgingDto,
  ReworkRateDto,
} from '@workdesk/shared';

@Injectable()
export class AccountabilityService {
  constructor(private readonly prisma: PrismaService) {}

  private async getAuthorizedProjectIds(user: { id: string; roleCode: RoleCode }, requestedProjectId?: string): Promise<string[]> {
    if (user.roleCode === RoleCode.ROLE_MANAGER) {
      if (requestedProjectId) {
        const p = await this.prisma.project.findUnique({ where: { id: requestedProjectId } });
        if (!p) throw new NotFoundException(`Project ${requestedProjectId} not found`);
        return [requestedProjectId];
      }
      const all = await this.prisma.project.findMany({ select: { id: true } });
      return all.map((p) => p.id);
    }

    // Lead or Employee: only assigned or member projects
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId: user.id },
      select: { projectId: true },
    });
    const ledProjects = await this.prisma.project.findMany({
      where: { leadId: user.id },
      select: { id: true },
    });
    const allowed = Array.from(new Set([...memberships.map((m) => m.projectId), ...ledProjects.map((p) => p.id)]));

    if (requestedProjectId) {
      if (!allowed.includes(requestedProjectId)) {
        throw new NotFoundException(`Project ${requestedProjectId} not found`);
      }
      return [requestedProjectId];
    }
    return allowed;
  }

  async getMetrics(
    query: { projectId?: string; windowDays?: number },
    user: { id: string; roleCode: RoleCode },
  ): Promise<AccountabilityMetricsDto> {
    const windowDays = query.windowDays ? Number(query.windowDays) : 30;
    const sinceDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const authorizedProjectIds = await this.getAuthorizedProjectIds(user, query.projectId);

    // 1. Metric 1: Due-Date Commitment Adherence
    const completedTasksWithDeadline = await this.prisma.task.findMany({
      where: {
        projectId: { in: authorizedProjectIds },
        status: WorkItemStatus.DONE,
        deadline: { not: null },
        completedAt: { gte: sinceDate },
      },
      select: {
        id: true,
        ticketId: true,
        deadline: true,
        completedAt: true,
      },
    });

    let onTimeCount = 0;
    for (const t of completedTasksWithDeadline) {
      if (t.deadline && t.completedAt && t.completedAt <= t.deadline) {
        onTimeCount++;
      }
    }

    const totalWithDeadline = completedTasksWithDeadline.length;
    const adherenceRate = totalWithDeadline > 0 ? Math.round((onTimeCount / totalWithDeadline) * 100) / 100 : 1.0;

    const dueDateAdherence: DueDateAdherenceDto = {
      completedWithDeadline: totalWithDeadline,
      onTimeCount,
      lateCount: totalWithDeadline - onTimeCount,
      adherenceRate,
    };

    // 2. Metric 2 & 3: Sprint Say/Do Ratio & Scope Creep Rate
    const sprints = await this.prisma.sprint.findMany({
      where: {
        projectId: { in: authorizedProjectIds },
        OR: [
          { status: 'COMPLETED' },
          { status: 'ACTIVE' },
        ],
        createdAt: { gte: sinceDate },
      },
      include: {
        commitments: {
          include: {
            task: { select: { id: true, ticketId: true, status: true, storyPoints: true } },
          },
        },
      },
    });

    const sprintSayDo: SprintSayDoDto[] = [];
    const scopeCreep: ScopeCreepDto[] = [];

    for (const sprint of sprints) {
      const plannedCommitments = sprint.commitments.filter((c) => c.wasPlanned);
      const unplannedCommitments = sprint.commitments.filter((c) => !c.wasPlanned);

      const plannedPoints = plannedCommitments.reduce((acc, c) => acc + (c.storyPoints || 0), 0);
      const completedPlannedPoints = plannedCommitments
        .filter((c) => c.task.status === WorkItemStatus.DONE)
        .reduce((acc, c) => acc + (c.storyPoints || 0), 0);

      const sayDoRatio = plannedPoints > 0 ? Math.round((completedPlannedPoints / plannedPoints) * 100) / 100 : 1.0;

      sprintSayDo.push({
        sprintId: sprint.id,
        sprintName: sprint.name,
        plannedPoints,
        completedPlannedPoints,
        sayDoRatio,
      });

      const midSprintAddedPoints = unplannedCommitments.reduce((acc, c) => acc + (c.storyPoints || 0), 0);
      const creepRate = plannedPoints > 0 ? Math.round((midSprintAddedPoints / plannedPoints) * 100) / 100 : 0.0;

      scopeCreep.push({
        sprintId: sprint.id,
        sprintName: sprint.name,
        initialPlannedPoints: plannedPoints,
        midSprintAddedPoints,
        scopeCreepRate: creepRate,
      });
    }

    // 3. Metric 4: Blocker Aging
    const activeBlockedTasks = await this.prisma.task.findMany({
      where: {
        projectId: { in: authorizedProjectIds },
        status: WorkItemStatus.BLOCKED,
      },
      select: {
        id: true,
        ticketId: true,
        title: true,
        updatedAt: true,
        activities: {
          where: { actionType: 'STATUS_CHANGED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const now = Date.now();
    let longestActiveHours = 0;
    const activeBlockersList = activeBlockedTasks.map((t) => {
      const blockedSince = t.activities[0]?.createdAt || t.updatedAt;
      const hoursBlocked = Math.max(0, Math.round((now - new Date(blockedSince).getTime()) / (1000 * 60 * 60)));
      if (hoursBlocked > longestActiveHours) longestActiveHours = hoursBlocked;
      return {
        taskId: t.id,
        ticketId: t.ticketId,
        title: t.title,
        blockedSince: blockedSince.toISOString(),
        hoursBlocked,
      };
    });

    // Calculate historical resolved blocker resolution duration from audit logs
    const blockerAudits = await this.prisma.auditLog.findMany({
      where: {
        entityName: 'Task',
        action: 'TASK_STATUS_CHANGED',
        createdAt: { gte: sinceDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Pair transitions into BLOCKED and out of BLOCKED
    let totalResolutionHours = 0;
    let resolvedBlockerCount = 0;
    const taskBlockedTimes: Record<string, number> = {};

    for (const log of blockerAudits) {
      if (!log.metadata) continue;
      try {
        const meta = JSON.parse(log.metadata);
        if (meta.to === WorkItemStatus.BLOCKED) {
          taskBlockedTimes[log.entityId] = new Date(log.createdAt).getTime();
        } else if (meta.from === WorkItemStatus.BLOCKED && taskBlockedTimes[log.entityId]) {
          const durationHrs = (new Date(log.createdAt).getTime() - taskBlockedTimes[log.entityId]) / (1000 * 60 * 60);
          totalResolutionHours += Math.max(0, durationHrs);
          resolvedBlockerCount++;
          delete taskBlockedTimes[log.entityId];
        }
      } catch {
        // ignore parse error
      }
    }

    const avgResolutionHours =
      resolvedBlockerCount > 0 ? Math.round((totalResolutionHours / resolvedBlockerCount) * 10) / 10 : 0;

    const blockerAging: BlockerAgingDto = {
      totalBlockers: activeBlockedTasks.length + resolvedBlockerCount,
      activeBlockersCount: activeBlockedTasks.length,
      avgResolutionHours,
      longestActiveHours,
      activeBlockers: activeBlockersList,
    };

    // 4. Metric 5: Rework Rate (CHANGES_REQUESTED or REOPENED)
    const completedTasksInWindow = await this.prisma.task.findMany({
      where: {
        projectId: { in: authorizedProjectIds },
        status: WorkItemStatus.DONE,
        completedAt: { gte: sinceDate },
      },
      select: {
        id: true,
        ticketId: true,
        title: true,
      },
    });

    const completedTaskIds = completedTasksInWindow.map((t) => t.id);
    const reworkAudits = await this.prisma.auditLog.findMany({
      where: {
        entityId: { in: completedTaskIds },
        entityName: 'Task',
        action: 'TASK_STATUS_CHANGED',
      },
    });

    const reworkCountByTask: Record<string, number> = {};
    for (const log of reworkAudits) {
      if (!log.metadata) continue;
      try {
        const meta = JSON.parse(log.metadata);
        if (meta.to === WorkItemStatus.CHANGES_REQUESTED || meta.to === WorkItemStatus.REOPENED) {
          reworkCountByTask[log.entityId] = (reworkCountByTask[log.entityId] || 0) + 1;
        }
      } catch {}
    }

    const reworkItems = completedTasksInWindow
      .filter((t) => (reworkCountByTask[t.id] || 0) > 0)
      .map((t) => ({
        taskId: t.id,
        ticketId: t.ticketId,
        title: t.title,
        reworkCount: reworkCountByTask[t.id] || 0,
      }));

    const totalCompleted = completedTasksInWindow.length;
    const reworkedCount = reworkItems.length;
    const reworkRate = totalCompleted > 0 ? Math.round((reworkedCount / totalCompleted) * 100) / 100 : 0.0;

    const reworkRateDto: ReworkRateDto = {
      totalCompletedTasks: totalCompleted,
      reworkedTasksCount: reworkedCount,
      reworkRate,
      reworkItems,
    };

    return {
      dueDateAdherence,
      sprintSayDo,
      scopeCreep,
      blockerAging,
      reworkRate: reworkRateDto,
      timeWindowDays: windowDays,
    };
  }
}
