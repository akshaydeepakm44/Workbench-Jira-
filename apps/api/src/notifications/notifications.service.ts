import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    linkUrl?: string,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        linkUrl,
      },
    });
  }

  async generateDigest(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) throw new Error('User not found');

    const now = new Date();

    // 1. Overdue tasks assigned to user
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        deadline: { lt: now },
      },
      select: { ticketId: true, title: true, deadline: true },
      take: 10,
    });

    // 2. Active blockers assigned to or affecting user
    const activeBlockers = await this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: 'BLOCKED',
      },
      select: { ticketId: true, title: true, updatedAt: true },
      take: 10,
    });

    // 3. Pending reviews (for Lead/Manager, or tasks user created)
    const pendingReviews = await this.prisma.task.findMany({
      where: {
        status: 'IN_REVIEW',
        OR: [
          { creatorId: userId },
          { project: { leadId: userId } },
        ],
      },
      select: { ticketId: true, title: true, updatedAt: true },
      take: 10,
    });

    // 4. Sprint updates for user's projects
    const userProjects = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const projectIds = userProjects.map((p) => p.projectId);

    const activeSprints = await this.prisma.sprint.findMany({
      where: {
        projectId: { in: projectIds },
        status: 'ACTIVE',
      },
      include: {
        tasks: {
          select: { status: true },
        },
      },
      take: 5,
    });

    const sprintUpdates = activeSprints.map((s) => {
      const total = s.tasks.length;
      const completed = s.tasks.filter((t) => t.status === 'DONE').length;
      const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
      const remainingDays = s.endDate
        ? Math.max(0, Math.ceil((s.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        sprintName: s.name,
        remainingDays,
        progressPercent,
      };
    });

    const totalActionableItems =
      overdueTasks.length + activeBlockers.length + pendingReviews.length;

    return {
      recipientId: user.id,
      recipientEmail: user.email,
      generatedAt: now.toISOString(),
      overdueTasks: overdueTasks.map((t) => ({
        ticketId: t.ticketId,
        title: t.title,
        deadline: t.deadline?.toISOString() || '',
      })),
      activeBlockers: activeBlockers.map((b) => ({
        ticketId: b.ticketId,
        title: b.title,
        hoursBlocked: Math.round((now.getTime() - b.updatedAt.getTime()) / (1000 * 60 * 60)),
      })),
      pendingReviews: pendingReviews.map((r) => ({
        ticketId: r.ticketId,
        title: r.title,
        submittedAt: r.updatedAt.toISOString(),
      })),
      sprintUpdates,
      totalActionableItems,
    };
  }
}
