import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import {
  RoleCode,
  CalendarEventDto,
  CalendarQueryDto,
  WorkItemType,
  WorkItemStatus,
} from '@workdesk/shared';

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  /**
   * Pure aggregation query layer over existing records.
   * Zero redundant storage.
   */
  async getCalendarEvents(
    query: CalendarQueryDto,
    user: { id: string; roleCode: RoleCode },
  ): Promise<CalendarEventDto[]> {
    if (!query.start || !query.end) {
      throw new BadRequestException('Query parameters start and end date are required');
    }

    const startDate = new Date(query.start);
    const endDate = new Date(query.end);

    // Resolve user's authorized project and team memberships
    let userProjectIds: string[] = [];
    let userTeamIds: string[] = [];

    if (user.roleCode !== RoleCode.ROLE_MANAGER) {
      const projectMemberships = await this.prisma.projectMember.findMany({
        where: { userId: user.id },
        select: { projectId: true },
      });
      userProjectIds = projectMemberships.map((p) => p.projectId);

      const teamMemberships = await this.prisma.teamMember.findMany({
        where: { userId: user.id },
        select: { teamId: true },
      });
      userTeamIds = teamMemberships.map((t) => t.teamId);

      // If Lead, also include led projects & teams
      if (user.roleCode === RoleCode.ROLE_LEAD) {
        const ledProjects = await this.prisma.project.findMany({
          where: { leadId: user.id },
          select: { id: true },
        });
        userProjectIds.push(...ledProjects.map((p) => p.id));

        const ledTeams = await this.prisma.team.findMany({
          where: { leadId: user.id },
          select: { id: true },
        });
        userTeamIds.push(...ledTeams.map((t) => t.id));
      }

      userProjectIds = Array.from(new Set(userProjectIds));
      userTeamIds = Array.from(new Set(userTeamIds));
    }

    const events: CalendarEventDto[] = [];

    // 1. Task Deadlines & Milestones Query
    const taskWhere: any = {
      deadline: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (query.projectId) {
      taskWhere.projectId = query.projectId;
    }
    if (query.teamId) {
      taskWhere.teamId = query.teamId;
    }

    if (user.roleCode !== RoleCode.ROLE_MANAGER) {
      taskWhere.OR = [
        { projectId: { in: userProjectIds } },
        { teamId: { in: userTeamIds } },
        { assigneeId: user.id },
        { creatorId: user.id },
      ];
    }

    const tasks = await this.prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        ticketId: true,
        title: true,
        type: true,
        status: true,
        deadline: true,
        startDate: true,
        urgency: true,
        project: { select: { name: true } },
      },
    });

    tasks.forEach((t) => {
      const isMilestone = t.type === WorkItemType.MILESTONE;
      const start = t.startDate ? t.startDate.toISOString() : t.deadline!.toISOString();
      events.push({
        id: `task-${t.id}`,
        sourceType: isMilestone ? 'MILESTONE' : 'TASK_DEADLINE',
        title: `${t.ticketId}: ${t.title}`,
        startDate: start,
        endDate: t.deadline!.toISOString(),
        status: t.status,
        urgency: this.tasksService.calculateUrgency(t.deadline, t.status),
        linkUrl: `/tasks/${t.ticketId}`,
        metadata: {
          ticketId: t.ticketId,
          type: t.type,
          projectName: t.project?.name,
        },
      });
    });

    // 2. Sprint Boundaries Query
    const sprintWhere: any = {
      OR: [
        { startDate: { gte: startDate, lte: endDate } },
        { endDate: { gte: startDate, lte: endDate } },
        {
          AND: [
            { startDate: { lte: startDate } },
            { endDate: { gte: endDate } },
          ],
        },
      ],
    };

    if (query.projectId) {
      sprintWhere.projectId = query.projectId;
    }
    if (user.roleCode !== RoleCode.ROLE_MANAGER) {
      sprintWhere.projectId = { in: userProjectIds };
    }

    const sprints = await this.prisma.sprint.findMany({
      where: sprintWhere,
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        project: { select: { id: true, name: true } },
      },
    });

    sprints.forEach((s) => {
      if (s.startDate && s.endDate) {
        events.push({
          id: `sprint-${s.id}`,
          sourceType: 'SPRINT',
          title: `Sprint: ${s.name}`,
          startDate: s.startDate.toISOString(),
          endDate: s.endDate.toISOString(),
          status: s.status,
          linkUrl: `/projects/${s.project.id}/sprints/${s.id}/planning`,
          metadata: {
            sprintId: s.id,
            projectName: s.project.name,
          },
        });
      }
    });

    // 3. Meetings Query
    const meetingWhere: any = {
      startTime: { lte: endDate },
      endTime: { gte: startDate },
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
        endTime: true,
        googleMeetUrl: true,
        isInstant: true,
      },
    });

    meetings.forEach((m) => {
      events.push({
        id: `meeting-${m.id}`,
        sourceType: 'MEETING',
        title: `Meeting: ${m.title}`,
        startDate: m.startTime.toISOString(),
        endDate: m.endTime.toISOString(),
        status: 'SCHEDULED',
        linkUrl: `/meetings/${m.id}/workspace`,
        metadata: {
          googleMeetUrl: m.googleMeetUrl,
          isInstant: m.isInstant,
        },
      });
    });

    // 4. Standups Query
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const standupWhere: any = {
      standupDate: { gte: startStr, lte: endStr },
    };

    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      standupWhere.userId = user.id;
    } else if (user.roleCode === RoleCode.ROLE_LEAD) {
      standupWhere.teamId = { in: userTeamIds };
    }

    const standups = await this.prisma.standup.findMany({
      where: standupWhere,
      select: {
        id: true,
        standupDate: true,
        hasBlockers: true,
        user: { select: { fullName: true } },
      },
    });

    standups.forEach((st) => {
      events.push({
        id: `standup-${st.id}`,
        sourceType: 'STANDUP',
        title: `Stand-up: ${st.user.fullName} ${st.hasBlockers ? '(Blockers)' : ''}`,
        startDate: `${st.standupDate}T09:00:00.000Z`,
        endDate: `${st.standupDate}T09:15:00.000Z`,
        status: st.hasBlockers ? 'BLOCKED' : 'SUBMITTED',
        linkUrl: '/standup',
        metadata: {
          hasBlockers: st.hasBlockers,
        },
      });
    });

    // Chronological Sort
    return events.sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
  }
}
