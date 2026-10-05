import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RoleCode,
  AskWorkdeskQueryDto,
  AskWorkdeskResponseDto,
  AskWorkdeskCitationDto,
} from '@workdesk/shared';

@Injectable()
export class AskWorkdeskService {
  constructor(private readonly prisma: PrismaService) {}

  private async getAuthorizedProjectIds(user: {
    id: string;
    roleCode: RoleCode;
  }): Promise<string[] | 'ALL'> {
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

    return Array.from(
      new Set([...memberships.map((m) => m.projectId), ...ledProjects.map((p) => p.id)]),
    );
  }

  async ask(
    dto: AskWorkdeskQueryDto,
    user: { id: string; roleCode: RoleCode },
  ): Promise<AskWorkdeskResponseDto> {
    const rawQuery = dto.query?.trim();
    if (!rawQuery) {
      throw new BadRequestException('Query string is required');
    }

    const lowerQuery = rawQuery.toLowerCase();

    // 1. FORBIDDEN MUTATION CHECK
    const mutationKeywords = [
      'create task',
      'create ticket',
      'delete',
      'assign to',
      'change status',
      'update priority',
      'create sprint',
      'modify sprint',
      'create automation',
      'drop table',
    ];
    const isMutationAttempt = mutationKeywords.some((kw) => lowerQuery.includes(kw));

    if (isMutationAttempt) {
      return {
        answer:
          'WorkDesk AI is strictly read-only. Task creation, assignments, status transitions, and data mutations are governed operations and must be executed directly through authorized WorkDesk interfaces.',
        citations: [],
        confidence: 1.0,
        isDeterministicFallback: true,
      };
    }

    // 2. SCOPED RETRIEVAL SETUP
    const authorizedScope = await this.getAuthorizedProjectIds(user);
    const projectFilter =
      authorizedScope === 'ALL'
        ? dto.projectId
          ? { id: dto.projectId }
          : {}
        : { in: authorizedScope };

    // 3. INTENT RECOGNITION & GROUNDED CITATIONS

    // Case A: Specific Ticket Query (e.g. "What is the status of DESK-1001?" or "P4D-1350-1")
    const ticketMatch = rawQuery.match(/([A-Z0-9]+(?:-[A-Z0-9]+)+)/i) || rawQuery.match(/([A-Z0-9]+-\d+)/i);
    if (ticketMatch) {
      const ticketId = ticketMatch[1].toUpperCase();

      let task = await this.prisma.task.findFirst({
        where: {
          ticketId,
          ...(authorizedScope !== 'ALL' && {
            projectId: { in: authorizedScope },
          }),
        },
        include: {
          project: { select: { name: true } },
          assignee: { select: { fullName: true } },
          sprint: { select: { name: true } },
        },
      });

      if (!task) {
        // Also check LegacyTicketAlias
        const aliasRecord = await this.prisma.legacyTicketAlias.findFirst({
          where: { legacyKey: ticketId },
        });
        if (aliasRecord) {
          task = await this.prisma.task.findFirst({
            where: {
              id: aliasRecord.workitemId,
              ...(authorizedScope !== 'ALL' && {
                projectId: { in: authorizedScope },
              }),
            },
            include: {
              project: { select: { name: true } },
              assignee: { select: { fullName: true } },
              sprint: { select: { name: true } },
            },
          });
        }
      }

      if (!task) {
        return {
          answer: `Insufficient authorized data. Ticket ${ticketId} was not found or is outside your authorized project scope.`,
          citations: [],
          confidence: 0.9,
          isDeterministicFallback: true,
        };
      }

      const citations: AskWorkdeskCitationDto[] = [
        {
          ticketId: task.ticketId,
          title: task.title,
          type: task.type,
          status: task.status,
          linkUrl: `/tasks/${task.ticketId}`,
        },
      ];

      const assigneeStr = task.assignee
        ? `assigned to ${task.assignee.fullName}`
        : 'currently unassigned';
      const sprintStr = task.sprint ? ` in sprint "${task.sprint.name}"` : '';

      return {
        answer: `Task [${task.ticketId}] "${task.title}" in project ${task.project.name} is currently in ${task.status} status, ${assigneeStr}${sprintStr}. Priority: ${task.priority}.`,
        citations,
        confidence: 0.98,
        isDeterministicFallback: true,
      };
    }

    // Case B: Blockers Query ("What is blocking", "active blockers")
    if (lowerQuery.includes('block') || lowerQuery.includes('blocker')) {
      const blockedTasks = await this.prisma.task.findMany({
        where: {
          status: 'BLOCKED',
          ...(authorizedScope !== 'ALL' && {
            projectId: { in: authorizedScope },
          }),
        },
        include: {
          project: { select: { name: true } },
          assignee: { select: { fullName: true } },
        },
        take: 5,
      });

      if (blockedTasks.length === 0) {
        return {
          answer: 'There are currently no active blocked tasks within your authorized scope.',
          citations: [],
          confidence: 0.95,
          isDeterministicFallback: true,
        };
      }

      const citations: AskWorkdeskCitationDto[] = blockedTasks.map((t) => ({
        ticketId: t.ticketId,
        title: t.title,
        type: t.type,
        status: t.status,
        linkUrl: `/tasks/${t.ticketId}`,
      }));

      const itemsList = blockedTasks
        .map(
          (t) =>
            `• [${t.ticketId}] "${t.title}" (${t.project.name}) - ${
              t.assignee ? t.assignee.fullName : 'Unassigned'
            }`,
        )
        .join('\n');

      return {
        answer: `Currently there are ${blockedTasks.length} active blocked task(s) within your authorized scope:\n${itemsList}`,
        citations,
        confidence: 0.95,
        isDeterministicFallback: true,
      };
    }

    // Case C: Overdue Tasks Query ("overdue", "past due")
    if (lowerQuery.includes('overdue') || lowerQuery.includes('past due')) {
      const now = new Date();
      const overdueTasks = await this.prisma.task.findMany({
        where: {
          status: { notIn: ['DONE', 'CANCELLED'] },
          deadline: { lt: now },
          ...(authorizedScope !== 'ALL' && {
            projectId: { in: authorizedScope },
          }),
        },
        include: {
          project: { select: { name: true } },
          assignee: { select: { fullName: true } },
        },
        take: 5,
      });

      if (overdueTasks.length === 0) {
        return {
          answer: 'There are no overdue tasks currently past their scheduled deadline.',
          citations: [],
          confidence: 0.95,
          isDeterministicFallback: true,
        };
      }

      const citations: AskWorkdeskCitationDto[] = overdueTasks.map((t) => ({
        ticketId: t.ticketId,
        title: t.title,
        type: t.type,
        status: t.status,
        linkUrl: `/tasks/${t.ticketId}`,
      }));

      const itemsList = overdueTasks
        .map(
          (t) =>
            `• [${t.ticketId}] "${t.title}" (Due: ${
              t.deadline ? t.deadline.toISOString().split('T')[0] : 'N/A'
            }, Assignee: ${t.assignee ? t.assignee.fullName : 'Unassigned'})`,
        )
        .join('\n');

      return {
        answer: `Identified ${overdueTasks.length} overdue task(s) past deadline:\n${itemsList}`,
        citations,
        confidence: 0.95,
        isDeterministicFallback: true,
      };
    }

    // Case D: Sprint Progress Query ("sprint progress", "sprint")
    if (lowerQuery.includes('sprint')) {
      const activeSprint = await this.prisma.sprint.findFirst({
        where: {
          status: 'ACTIVE',
          ...(authorizedScope !== 'ALL' && {
            projectId: { in: authorizedScope },
          }),
        },
        include: {
          project: { select: { name: true } },
          tasks: { select: { id: true, ticketId: true, title: true, type: true, status: true } },
        },
      });

      if (!activeSprint) {
        return {
          answer: 'No active sprint is currently running in your authorized project scope.',
          citations: [],
          confidence: 0.9,
          isDeterministicFallback: true,
        };
      }

      const total = activeSprint.tasks.length;
      const done = activeSprint.tasks.filter((t) => t.status === 'DONE').length;
      const inProgress = activeSprint.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;

      const citations: AskWorkdeskCitationDto[] = activeSprint.tasks.slice(0, 5).map((t) => ({
        ticketId: t.ticketId,
        title: t.title,
        type: t.type,
        status: t.status,
        linkUrl: `/tasks/${t.ticketId}`,
      }));

      return {
        answer: `Active Sprint "${activeSprint.name}" in project ${activeSprint.project.name} has ${total} committed task(s). Progress: ${done}/${total} completed (${percent}%), ${inProgress} in progress.`,
        citations,
        confidence: 0.96,
        isDeterministicFallback: true,
      };
    }

    // Default Fallback
    return {
      answer:
        'Insufficient authorized data or unsupported query intent. You can ask about specific tickets (e.g. "status of DESK-1001"), active blockers, overdue tasks, or active sprint progress.',
      citations: [],
      confidence: 0.7,
      isDeterministicFallback: true,
    };
  }
}
