import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RoleCode,
  GlobalSearchItemDto,
  GlobalSearchResponseDto,
} from '@workdesk/shared';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  private async getAuthorizedProjectIds(user: { id: string; roleCode: RoleCode }): Promise<string[] | 'ALL'> {
    if (user.roleCode === RoleCode.ROLE_MANAGER) {
      return 'ALL';
    }

    const memberships = await this.prisma.projectMember.findMany({
      where: { userId: user.id },
      select: { projectId: true },
    });
    const ledProjects = await this.prisma.project.findMany({
      where: { leadId: user.id },
      select: { id: true },
    });

    return Array.from(new Set([...memberships.map((m) => m.projectId), ...ledProjects.map((p) => p.id)]));
  }

  async search(
    queryText: string,
    user: { id: string; roleCode: RoleCode },
    limit: number = 20,
  ): Promise<GlobalSearchResponseDto> {
    const q = queryText?.trim();
    if (!q || q.length < 2) {
      return { query: queryText, totalResults: 0, results: [] };
    }

    const authorizedProjectIds = await this.getAuthorizedProjectIds(user);
    const results: GlobalSearchItemDto[] = [];
    const searchPattern = `%${q}%`;

    // 1. Search Tasks (by ticketId or title)
    const taskWhere: any = {
      OR: [
        { ticketId: { contains: q } },
        { title: { contains: q } },
        { description: { contains: q } },
      ],
    };

    if (authorizedProjectIds !== 'ALL') {
      taskWhere.projectId = { in: authorizedProjectIds };
    }

    const tasks = await this.prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        ticketId: true,
        title: true,
        type: true,
        status: true,
        project: { select: { name: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    tasks.forEach((t) => {
      results.push({
        id: t.id,
        entityType: 'TASK',
        ticketId: t.ticketId,
        title: t.title,
        subtitle: `${t.type} • ${t.project.name}`,
        status: t.status,
        linkUrl: `/tasks/${t.ticketId}`,
      });
    });

    // 2. Search Projects
    const projectWhere: any = {
      OR: [
        { key: { contains: q } },
        { name: { contains: q } },
      ],
    };

    if (authorizedProjectIds !== 'ALL') {
      projectWhere.id = { in: authorizedProjectIds };
    }

    const projects = await this.prisma.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        key: true,
        name: true,
        status: true,
      },
      take: 5,
    });

    projects.forEach((p) => {
      results.push({
        id: p.id,
        entityType: 'PROJECT',
        ticketId: p.key,
        title: p.name,
        subtitle: `Project Key: ${p.key}`,
        status: p.status,
        linkUrl: `/projects/${p.id}/boards`,
      });
    });

    // 3. Search Sprints
    const sprintWhere: any = {
      name: { contains: q },
    };

    if (authorizedProjectIds !== 'ALL') {
      sprintWhere.projectId = { in: authorizedProjectIds };
    }

    const sprints = await this.prisma.sprint.findMany({
      where: sprintWhere,
      select: {
        id: true,
        name: true,
        status: true,
        projectId: true,
        project: { select: { name: true } },
      },
      take: 5,
    });

    sprints.forEach((s) => {
      results.push({
        id: s.id,
        entityType: 'SPRINT',
        title: s.name,
        subtitle: `Sprint • ${s.project.name}`,
        status: s.status,
        linkUrl: `/projects/${s.projectId}/sprints/${s.id}/planning`,
      });
    });

    // 4. Search Project Decisions
    const decisionWhere: any = {
      OR: [
        { title: { contains: q } },
        { summary: { contains: q } },
      ],
    };

    if (authorizedProjectIds !== 'ALL') {
      decisionWhere.projectId = { in: authorizedProjectIds };
    }

    const decisions = await this.prisma.projectDecision.findMany({
      where: decisionWhere,
      select: {
        id: true,
        title: true,
        summary: true,
        status: true,
        projectId: true,
        project: { select: { name: true } },
      },
      take: 5,
    });

    decisions.forEach((d) => {
      results.push({
        id: d.id,
        entityType: 'DECISION',
        title: d.title,
        subtitle: `Decision • ${d.project.name}`,
        status: d.status,
        snippet: d.summary.slice(0, 100),
        linkUrl: `/projects/${d.projectId}/decisions`,
      });
    });

    // 5. Search Meetings (authorized participants only)
    const meetingWhere: any = {
      title: { contains: q },
    };

    if (user.roleCode !== RoleCode.ROLE_MANAGER) {
      meetingWhere.OR = [
        { organizerId: user.id },
        { participants: { some: { userId: user.id } } },
      ];
    }

    const meetings = await this.prisma.meeting.findMany({
      where: meetingWhere,
      select: {
        id: true,
        title: true,
        startTime: true,
      },
      take: 5,
    });

    meetings.forEach((m) => {
      results.push({
        id: m.id,
        entityType: 'MEETING',
        title: m.title,
        subtitle: `Scheduled Meeting • ${new Date(m.startTime).toLocaleDateString()}`,
        status: 'SCHEDULED',
        linkUrl: `/meetings/${m.id}/workspace`,
      });
    });

    return {
      query: q,
      totalResults: results.length,
      results: results.slice(0, limit),
    };
  }
}
