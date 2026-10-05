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

export interface SubmitStandupDto {
  yesterday: string;
  today: string;
  blockers?: string[];
}

@Injectable()
export class StandupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly tasksService: TasksService,
  ) {}

  private getTodayString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  async submitStandup(dto: SubmitStandupDto, user: { id: string; roleCode: RoleCode }, ipAddress?: string) {
    const today = this.getTodayString();

    const existing = await this.prisma.standup.findUnique({
      where: {
        userId_standupDate: {
          userId: user.id,
          standupDate: today,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('You have already submitted your stand-up for today.');
    }

    // Get user's primary team if any
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId: user.id },
    });

    const hasBlockers = Boolean(dto.blockers && dto.blockers.length > 0);

    const standup = await this.prisma.standup.create({
      data: {
        userId: user.id,
        teamId: membership?.teamId,
        standupDate: today,
        yesterday: dto.yesterday,
        today: dto.today,
        hasBlockers,
        blockers: {
          create: (dto.blockers || []).filter(b => b.trim()).map((b) => ({
            blockerText: b.trim(),
            isResolved: false,
          })),
        },
      },
      include: {
        blockers: true,
        user: { select: { fullName: true, email: true } },
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'STANDUP_SUBMITTED',
      entityName: 'Standup',
      entityId: standup.id,
      metadata: { date: today, hasBlockers },
      ipAddress,
    });

    return {
      ...standup,
      userName: standup.user?.fullName,
      userEmail: standup.user?.email,
      submittedAt: standup.submittedAt.toISOString(),
    };
  }

  async getMyToday(userId: string) {
    const today = this.getTodayString();
    const standup = await this.prisma.standup.findUnique({
      where: {
        userId_standupDate: {
          userId,
          standupDate: today,
        },
      },
      include: {
        blockers: true,
      },
    });

    if (!standup) return null;

    return {
      ...standup,
      submittedAt: standup.submittedAt.toISOString(),
    };
  }

  async getMyHistory(userId: string) {
    const standups = await this.prisma.standup.findMany({
      where: { userId },
      include: { blockers: true },
      orderBy: { standupDate: 'desc' },
      take: 30,
    });

    return standups.map((s) => ({
      ...s,
      submittedAt: s.submittedAt.toISOString(),
    }));
  }

  async getTeamStandups(user: { id: string; roleCode: RoleCode }) {
    const today = this.getTodayString();

    let teamUsersWhere: any = { isActive: true };

    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      // Find own team members
      const memberships = await this.prisma.teamMember.findMany({
        where: { userId: user.id },
      });
      const teamIds = memberships.map((m) => m.teamId);
      teamUsersWhere = {
        isActive: true,
        teamMemberships: { some: { teamId: { in: teamIds } } },
      };
    } else if (user.roleCode === RoleCode.ROLE_LEAD) {
      const ledTeams = await this.prisma.team.findMany({
        where: {
          OR: [
            { leadId: user.id },
            { members: { some: { userId: user.id, roleInTeam: 'LEAD' } } },
          ],
        },
      });
      const teamIds = ledTeams.map((t) => t.id);
      teamUsersWhere = {
        isActive: true,
        teamMemberships: { some: { teamId: { in: teamIds } } },
      };
    }

    const allTeamUsers = await this.prisma.user.findMany({
      where: teamUsersWhere,
      select: { id: true, fullName: true, email: true, role: { select: { code: true } } },
    });

    const userIds = allTeamUsers.map((u) => u.id);

    const submissions = await this.prisma.standup.findMany({
      where: {
        standupDate: today,
        userId: { in: userIds },
      },
      include: {
        blockers: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    const submissionMap = new Map<string, any>();
    submissions.forEach((s) => submissionMap.set(s.userId, s));

    return allTeamUsers.map((u) => {
      const sub = submissionMap.get(u.id);
      return {
        userId: u.id,
        userName: u.fullName,
        userEmail: u.email,
        roleCode: u.role.code,
        hasSubmitted: Boolean(sub),
        standup: sub
          ? {
              id: sub.id,
              yesterday: sub.yesterday,
              today: sub.today,
              hasBlockers: sub.hasBlockers,
              blockers: sub.blockers,
              submittedAt: sub.submittedAt.toISOString(),
            }
          : null,
      };
    });
  }

  async convertBlockerToTask(blockerId: string, user: { id: string; roleCode: RoleCode }) {
    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      throw new ForbiddenException('Only Leads and Managers can convert blockers to tasks');
    }

    const blocker = await this.prisma.standupBlocker.findUnique({
      where: { id: blockerId },
      include: { standup: { include: { user: true } } },
    });

    if (!blocker) {
      throw new NotFoundException('Blocker not found');
    }

    if (blocker.convertedTaskId) {
      throw new BadRequestException('This blocker has already been converted into a task');
    }

    // 1:1 Unique conversion to Task
    const task = await this.tasksService.createTask(
      {
        title: `[BLOCKER]: ${blocker.blockerText.slice(0, 80)}`,
        description: `Originating from Daily Stand-up submitted by ${blocker.standup.user.fullName} on ${blocker.standup.standupDate}.\n\nBlocker Detail:\n${blocker.blockerText}`,
        priority: TaskPriority.HIGH,
        assigneeId: user.id,
        teamId: blocker.standup.teamId || undefined,
      },
      user,
    );

    // Update blocker with converted task ID (enforced 1:1)
    const updatedBlocker = await this.prisma.standupBlocker.update({
      where: { id: blockerId },
      data: {
        convertedTaskId: task.id,
        isResolved: true,
      },
    });

    return {
      blocker: updatedBlocker,
      task,
    };
  }
}
