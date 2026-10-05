import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RoleCode,
  WorkItemStatus,
  AdvancedAnalyticsDto,
} from '@workdesk/shared';

@Injectable()
export class AnalyticsService {
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

  async getAdvancedAnalytics(
    query: { projectId?: string; windowDays?: number },
    user: { id: string; roleCode: RoleCode },
  ): Promise<AdvancedAnalyticsDto> {
    const windowDays = query.windowDays ? Number(query.windowDays) : 30;
    const sinceDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const authorizedProjectIds = await this.getAuthorizedProjectIds(user, query.projectId);

    // 1. Completed tasks within window for Lead & Cycle Time
    const completedTasks = await this.prisma.task.findMany({
      where: {
        projectId: { in: authorizedProjectIds },
        status: WorkItemStatus.DONE,
        completedAt: { gte: sinceDate },
      },
      select: {
        id: true,
        createdAt: true,
        completedAt: true,
        activities: {
          where: { actionType: 'STATUS_CHANGED' },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const leadTimes: number[] = [];
    const cycleTimes: number[] = [];

    for (const t of completedTasks) {
      if (!t.completedAt) continue;
      const leadTimeDays = (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      leadTimes.push(Math.max(0.1, Math.round(leadTimeDays * 10) / 10));

      // Find first transition into IN_PROGRESS
      let startedAt: Date | null = null;
      for (const act of t.activities) {
        if (act.changes && act.changes.includes('IN_PROGRESS')) {
          startedAt = act.createdAt;
          break;
        }
      }

      if (startedAt) {
        const cycleTimeDays = (new Date(t.completedAt).getTime() - new Date(startedAt).getTime()) / (1000 * 60 * 60 * 24);
        cycleTimes.push(Math.max(0.1, Math.round(cycleTimeDays * 10) / 10));
      } else {
        // Fallback: estimate cycle time as half lead time
        cycleTimes.push(Math.max(0.1, Math.round((leadTimeDays * 0.5) * 10) / 10));
      }
    }

    const calcPercentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
      return sorted[index];
    };

    const calcAvg = (arr: number[]): number => {
      if (arr.length === 0) return 0;
      const sum = arr.reduce((acc, v) => acc + v, 0);
      return Math.round((sum / arr.length) * 10) / 10;
    };

    const leadTimeStats = {
      avg: calcAvg(leadTimes),
      median: calcPercentile(leadTimes, 50),
      p85: calcPercentile(leadTimes, 85),
    };

    const cycleTimeStats = {
      avg: calcAvg(cycleTimes),
      median: calcPercentile(cycleTimes, 50),
      p85: calcPercentile(cycleTimes, 85),
    };

    // 2. Cumulative Flow Diagram (CFD)
    // Daily task distribution over the window
    const allProjectTasks = await this.prisma.task.findMany({
      where: { projectId: { in: authorizedProjectIds } },
      select: { id: true, status: true, createdAt: true, completedAt: true },
    });

    const cfd: { date: string; countsByStatus: Record<string, number> }[] = [];
    const stepDays = Math.max(1, Math.floor(windowDays / 14)); // Up to 14 data points
    for (let i = windowDays; i >= 0; i -= stepDays) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];

      const counts: Record<string, number> = {
        TODO: 0,
        IN_PROGRESS: 0,
        IN_REVIEW: 0,
        DONE: 0,
      };

      for (const t of allProjectTasks) {
        if (new Date(t.createdAt) <= d) {
          if (t.completedAt && new Date(t.completedAt) <= d) {
            counts.DONE++;
          } else if (t.status === WorkItemStatus.IN_REVIEW) {
            counts.IN_REVIEW++;
          } else if (t.status === WorkItemStatus.IN_PROGRESS || t.status === WorkItemStatus.BLOCKED) {
            counts.IN_PROGRESS++;
          } else {
            counts.TODO++;
          }
        }
      }

      cfd.push({ date: dateStr, countsByStatus: counts });
    }

    // 3. Velocity History across Sprints
    const sprints = await this.prisma.sprint.findMany({
      where: {
        projectId: { in: authorizedProjectIds },
        status: { in: ['COMPLETED', 'ACTIVE'] },
      },
      include: {
        commitments: {
          include: {
            task: { select: { status: true, storyPoints: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const velocityHistory = sprints.map((s) => {
      const committedPoints = s.commitments.reduce((acc, c) => acc + (c.storyPoints || 0), 0);
      const completedPoints = s.commitments
        .filter((c) => c.task.status === WorkItemStatus.DONE)
        .reduce((acc, c) => acc + (c.storyPoints || 0), 0);
      return {
        sprintId: s.id,
        sprintName: s.name,
        committedPoints,
        completedPoints,
      };
    });

    // Velocity Predictability
    let velocityPredictability = 1.0;
    if (velocityHistory.length > 1) {
      const velocities = velocityHistory.map((v) => v.completedPoints);
      const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
      if (mean > 0) {
        const variance = velocities.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / velocities.length;
        const stdDev = Math.sqrt(variance);
        // Predictability ratio: 1 - coefficient of variation (bounded [0, 1])
        velocityPredictability = Math.max(0, Math.min(1, Math.round((1 - stdDev / mean) * 100) / 100));
      }
    }

    // 4. Backlog Aging
    const openBacklogTasks = await this.prisma.task.findMany({
      where: {
        projectId: { in: authorizedProjectIds },
        status: { in: [WorkItemStatus.TODO, WorkItemStatus.DRAFT] },
      },
      select: { createdAt: true },
    });

    const backlogAging = {
      under30d: 0,
      d30to60: 0,
      d60to90: 0,
      over90d: 0,
    };

    const nowMs = Date.now();
    for (const t of openBacklogTasks) {
      const ageDays = (nowMs - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < 30) backlogAging.under30d++;
      else if (ageDays <= 60) backlogAging.d30to60++;
      else if (ageDays <= 90) backlogAging.d60to90++;
      else backlogAging.over90d++;
    }

    return {
      leadTimeDays: leadTimeStats,
      cycleTimeDays: cycleTimeStats,
      cumulativeFlow: cfd,
      velocityHistory,
      velocityPredictability,
      backlogAging,
    };
  }
}
