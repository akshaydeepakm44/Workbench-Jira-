import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleCode, TaskStatus } from '@workdesk/shared';

@Injectable()
export class KpisService {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  async getKpisForUser(user: { id: string; roleCode: RoleCode }) {
    let taskWhere: any = {};

    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      taskWhere = {
        OR: [
          { assigneeId: user.id },
          { creatorId: user.id },
          { watchers: { some: { userId: user.id } } },
        ],
      };
    } else if (user.roleCode === RoleCode.ROLE_LEAD) {
      const ledTeams = await this.prisma.team.findMany({
        where: {
          OR: [
            { leadId: user.id },
            { members: { some: { userId: user.id, roleInTeam: 'LEAD' } } },
          ],
        },
        select: { id: true },
      });
      const teamIds = ledTeams.map((t) => t.id);

      taskWhere = {
        OR: [
          { assigneeId: user.id },
          { creatorId: user.id },
          { teamId: { in: teamIds } },
        ],
      };
    } else {
      taskWhere = {};
    }

    const tasks = await this.prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        status: true,
        priority: true,
        deadline: true,
        completedAt: true,
        reviewPending: true,
      },
    });

    const now = new Date();
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const inProgress = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    const blocked = tasks.filter((t) => t.status === TaskStatus.BLOCKED).length;
    const reviewPending = tasks.filter((t) => t.reviewPending).length;

    const openTasks = tasks.filter((t) => t.status !== TaskStatus.DONE);
    const overdueTasks = openTasks.filter((t) => t.deadline && new Date(t.deadline) < now).length;

    const completedWithDeadline = tasks.filter((t) => t.status === TaskStatus.DONE && t.deadline);
    const onTimeCompleted = completedWithDeadline.filter(
      (t) => t.completedAt && new Date(t.completedAt) <= new Date(t.deadline!),
    ).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const onTimeRate =
      completedWithDeadline.length > 0
        ? Math.round((onTimeCompleted / completedWithDeadline.length) * 100)
        : 100;
    const overdueRate = openTasks.length > 0 ? Math.round((overdueTasks / openTasks.length) * 100) : 0;
    const blockedRate = openTasks.length > 0 ? Math.round((blocked / openTasks.length) * 100) : 0;

    // Stand-up check
    const today = this.getTodayString();
    const myStandup = await this.prisma.standup.findUnique({
      where: {
        userId_standupDate: {
          userId: user.id,
          standupDate: today,
        },
      },
    });

    let totalTeamMembers = 1;
    let teamStandupParticipationRate = myStandup ? 100 : 0;

    if (user.roleCode !== RoleCode.ROLE_EMPLOYEE) {
      const activeUsers = await this.prisma.user.count({ where: { isActive: true } });
      const submittedToday = await this.prisma.standup.count({
        where: { standupDate: today },
      });
      totalTeamMembers = activeUsers;
      teamStandupParticipationRate =
        activeUsers > 0 ? Math.round((submittedToday / activeUsers) * 100) : 0;
    }

    return {
      totalTasks: total,
      completedTasks: completed,
      inProgressTasks: inProgress,
      blockedTasks: blocked,
      reviewPendingTasks: reviewPending,
      overdueTasks,
      completionRate,
      onTimeRate,
      overdueRate,
      blockedRate,
      standupSubmittedToday: Boolean(myStandup),
      totalTeamMembers,
      teamStandupParticipationRate,
    };
  }
}
