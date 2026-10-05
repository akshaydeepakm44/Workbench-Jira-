import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';
import { RoleCode, TaskPriority } from '@workdesk/shared';
import { v4 as uuidv4 } from 'uuid';

export interface CreateMeetingDto {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  participantUserIds?: string[];
}

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly tasksService: TasksService,
  ) {}

  private generateGoogleMeetUrl(): string {
    // Generates genuine Google Meet URL format (3-4-3 chars)
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const rand = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `https://meet.google.com/${rand(3)}-${rand(4)}-${rand(3)}`;
  }

  async createInstantMeeting(user: { id: string; roleCode: RoleCode }, ipAddress?: string) {
    const meetUrl = this.generateGoogleMeetUrl();
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const meeting = await this.prisma.meeting.create({
      data: {
        title: `Instant Meeting (${user.roleCode})`,
        description: 'Instant collaborative sync room',
        startTime,
        endTime,
        googleMeetUrl: meetUrl,
        isInstant: true,
        organizerId: user.id,
        participants: {
          create: [{ userId: user.id, responseStatus: 'ACCEPTED' }],
        },
      },
      include: {
        participants: { include: { user: { select: { fullName: true, email: true } } } },
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'INSTANT_MEETING_CREATED',
      entityName: 'Meeting',
      entityId: meeting.id,
      metadata: { meetUrl },
      ipAddress,
    });

    return meeting;
  }

  async createScheduledMeeting(dto: CreateMeetingDto, user: { id: string; roleCode: RoleCode }, ipAddress?: string) {
    const meetUrl = this.generateGoogleMeetUrl();
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    const uniqueParticipants = Array.from(new Set([user.id, ...(dto.participantUserIds || [])]));

    const meeting = await this.prisma.meeting.create({
      data: {
        title: dto.title,
        description: dto.description,
        startTime,
        endTime,
        timezone: dto.timezone || 'UTC',
        googleMeetUrl: meetUrl,
        isInstant: false,
        organizerId: user.id,
        participants: {
          create: uniqueParticipants.map((uid) => ({
            userId: uid,
            responseStatus: uid === user.id ? 'ACCEPTED' : 'NEEDS_ACTION',
          })),
        },
      },
      include: {
        participants: { include: { user: { select: { id: true, fullName: true, email: true } } } },
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'MEETING_SCHEDULED',
      entityName: 'Meeting',
      entityId: meeting.id,
      metadata: { title: meeting.title, participantsCount: uniqueParticipants.length },
      ipAddress,
    });

    // Notify participants
    for (const uid of uniqueParticipants) {
      if (uid !== user.id) {
        await this.prisma.notification.create({
          data: {
            userId: uid,
            type: 'MEETING_INVITATION',
            title: `Meeting Invite: ${meeting.title}`,
            message: `Scheduled for ${startTime.toLocaleString()}`,
            linkUrl: `/meetings/${meeting.id}/workspace`,
          },
        });
      }
    }

    return meeting;
  }

  async getMeetingsForUser(user: { id: string; roleCode: RoleCode }) {
    let whereClause: any = {};

    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      whereClause = {
        OR: [
          { organizerId: user.id },
          { participants: { some: { userId: user.id } } },
        ],
      };
    } else if (user.roleCode === RoleCode.ROLE_LEAD) {
      whereClause = {
        OR: [
          { organizerId: user.id },
          { participants: { some: { userId: user.id } } },
        ],
      };
    } else {
      whereClause = {};
    }

    const meetings = await this.prisma.meeting.findMany({
      where: whereClause,
      include: {
        organizer: { select: { fullName: true, email: true } },
        participants: { include: { user: { select: { id: true, fullName: true } } } },
        _count: { select: { actionItems: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 50,
    });

    return meetings.map((m) => ({
      ...m,
      organizerName: m.organizer?.fullName,
      startTime: m.startTime.toISOString(),
      endTime: m.endTime.toISOString(),
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async getMeetingWorkspace(id: string, user: { id: string; roleCode: RoleCode }) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, fullName: true, email: true } },
        participants: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        agendaItems: { orderBy: { orderIndex: 'asc' } },
        decisions: { orderBy: { recordedAt: 'asc' } },
        actionItems: {
          include: { assignee: { select: { id: true, fullName: true } } },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const isParticipant = meeting.participants.some((p) => p.userId === user.id);
    const isOrganizer = meeting.organizerId === user.id;
    const isManager = user.roleCode === RoleCode.ROLE_MANAGER;

    if (!isParticipant && !isOrganizer && !isManager) {
      throw new NotFoundException('Meeting not found');
    }

    return {
      ...meeting,
      organizerName: meeting.organizer?.fullName,
      startTime: meeting.startTime.toISOString(),
      endTime: meeting.endTime.toISOString(),
      createdAt: meeting.createdAt.toISOString(),
      actionItems: meeting.actionItems.map((a) => ({
        ...a,
        assigneeName: a.assignee?.fullName,
        dueDate: a.dueDate?.toISOString() || null,
      })),
      decisions: meeting.decisions.map((d) => ({
        ...d,
        recordedAt: d.recordedAt.toISOString(),
      })),
    };
  }

  async addAgendaItem(meetingId: string, topic: string) {
    const count = await this.prisma.meetingAgendaItem.count({ where: { meetingId } });
    return this.prisma.meetingAgendaItem.create({
      data: {
        meetingId,
        topic,
        orderIndex: count + 1,
      },
    });
  }

  async addDecision(meetingId: string, description: string) {
    return this.prisma.meetingDecision.create({
      data: {
        meetingId,
        description,
      },
    });
  }

  async addActionItem(
    meetingId: string,
    description: string,
    assigneeId?: string,
    dueDate?: string,
  ) {
    return this.prisma.meetingActionItem.create({
      data: {
        meetingId,
        description,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { assignee: { select: { fullName: true } } },
    });
  }

  async convertActionItemToTask(
    meetingId: string,
    actionId: string,
    user: { id: string; roleCode: RoleCode },
  ) {
    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      throw new ForbiddenException('Only Leads and Managers can convert action items to tasks');
    }

    const action = await this.prisma.meetingActionItem.findUnique({
      where: { id: actionId },
      include: { meeting: true },
    });

    if (!action) {
      throw new NotFoundException('Action item not found');
    }

    if (action.convertedTaskId) {
      throw new BadRequestException('Action item has already been converted to a task');
    }

    const task = await this.tasksService.createTask(
      {
        title: `[ACTION ITEM]: ${action.description.slice(0, 80)}`,
        description: `Generated from meeting "${action.meeting.title}".\n\nFull Action Description:\n${action.description}`,
        priority: TaskPriority.MEDIUM,
        assigneeId: action.assigneeId || user.id,
        deadline: action.dueDate ? action.dueDate.toISOString() : undefined,
      },
      user,
    );

    // 1:1 Unique Constraint link
    const updatedAction = await this.prisma.meetingActionItem.update({
      where: { id: actionId },
      data: { convertedTaskId: task.id },
    });

    return {
      action: updatedAction,
      task,
    };
  }
}
