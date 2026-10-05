import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryHealthService } from './delivery-health.service';
import { WorkloadService } from '../workload/workload.service';
import {
  RoleCode,
  WorkItemStatus,
  ControlTowerSummaryDto,
  DeliveryHealthDto,
} from '@workdesk/shared';

@Injectable()
export class ControlTowerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthService: DeliveryHealthService,
    private readonly workloadService: WorkloadService,
  ) {}

  async getSummary(user: { id: string; roleCode: RoleCode }): Promise<ControlTowerSummaryDto> {
    // 1. Authorized Projects Scope
    let projects: { id: string; name: string }[] = [];
    if (user.roleCode === RoleCode.ROLE_MANAGER) {
      projects = await this.prisma.project.findMany({ select: { id: true, name: true } });
    } else if (user.roleCode === RoleCode.ROLE_LEAD) {
      const ledOrMember = await this.prisma.project.findMany({
        where: {
          OR: [{ leadId: user.id }, { members: { some: { userId: user.id } } }],
        },
        select: { id: true, name: true },
      });
      projects = ledOrMember;
    } else {
      // Employee: strictly projects they are assigned tasks or members of
      const memberProjects = await this.prisma.project.findMany({
        where: { members: { some: { userId: user.id } } },
        select: { id: true, name: true },
      });
      projects = memberProjects;
    }

    const healthItems: DeliveryHealthDto[] = [];
    let healthyCount = 0;
    let atRiskCount = 0;
    let criticalCount = 0;

    for (const p of projects) {
      try {
        const health = await this.healthService.evaluateProjectHealth(p.id, user);
        healthItems.push(health);
        if (health.overallState === 'HEALTHY') healthyCount++;
        else if (health.overallState === 'AT_RISK') atRiskCount++;
        else if (health.overallState === 'CRITICAL') criticalCount++;
      } catch {
        // skip unaccessible project
      }
    }

    const projectIds = projects.map((p) => p.id);

    // 2. Blocker Queue
    const activeBlockedTasks = await this.prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        status: WorkItemStatus.BLOCKED,
      },
      select: {
        id: true,
        ticketId: true,
        title: true,
        updatedAt: true,
        project: { select: { name: true } },
      },
    });

    const now = Date.now();
    let stagnantCount = 0;
    for (const b of activeBlockedTasks) {
      const hrs = (now - new Date(b.updatedAt).getTime()) / (1000 * 60 * 60);
      if (hrs > 48) stagnantCount++;
    }

    // 3. Workload Health
    const teamMembers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { code: { not: RoleCode.ROLE_MANAGER } },
      },
      select: { id: true },
    });

    let overAllocatedUsersCount = 0;
    let criticalUsersCount = 0;

    for (const u of teamMembers) {
      try {
        const w = await this.workloadService.getUserWorkload(u.id, user);
        if (w.status === 'OVER_ALLOCATED') overAllocatedUsersCount++;
        else if (w.status === 'CRITICAL') criticalUsersCount++;
      } catch {
        // out of scope
      }
    }

    // 4. Top Operational Risks
    const risks: {
      ticketId: string;
      title: string;
      projectName: string;
      issue: string;
      severity: 'WARNING' | 'CRITICAL';
      operationalAction: string;
    }[] = [];

    // Add stagnant blockers
    for (const b of activeBlockedTasks.slice(0, 5)) {
      const hrs = Math.round((now - new Date(b.updatedAt).getTime()) / (1000 * 60 * 60));
      risks.push({
        ticketId: b.ticketId,
        title: b.title,
        projectName: b.project.name,
        issue: `Impediment unresolved for ${hrs} hours.`,
        severity: hrs > 72 ? 'CRITICAL' : 'WARNING',
        operationalAction: 'Engage dependent team lead to unblock work item.',
      });
    }

    // Add overdue high priority items
    const overdueHighTasks = await this.prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        status: { notIn: [WorkItemStatus.DONE, WorkItemStatus.CANCELLED] },
        deadline: { lt: new Date() },
        priority: { in: ['High', 'Critical'] },
      },
      select: {
        id: true,
        ticketId: true,
        title: true,
        priority: true,
        project: { select: { name: true } },
      },
      take: 5,
    });

    for (const o of overdueHighTasks) {
      risks.push({
        ticketId: o.ticketId,
        title: o.title,
        projectName: o.project.name,
        issue: `${o.priority} priority item past due date.`,
        severity: 'CRITICAL',
        operationalAction: 'Reassign or reprioritize to current active sprint cycle.',
      });
    }

    return {
      projectHealth: {
        totalProjects: projects.length,
        healthy: healthyCount,
        atRisk: atRiskCount,
        critical: criticalCount,
        items: healthItems,
      },
      blockers: {
        activeCount: activeBlockedTasks.length,
        criticalPathCount: 0,
        stagnantCount,
      },
      workload: {
        overAllocatedUsersCount,
        criticalUsersCount,
      },
      risks,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
