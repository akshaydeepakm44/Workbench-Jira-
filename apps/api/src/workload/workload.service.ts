import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  RoleCode,
  WorkloadStatus,
  UserWorkloadDto,
  TeamWorkloadDto,
  ProjectWorkloadDto,
  SetUserCapacityDto,
  UserCapacityDto,
  WorkItemStatus,
} from '@workdesk/shared';

@Injectable()
export class WorkloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Evaluates utilization ratio and classifies workload status.
   * Parameterized thresholds:
   *  - UNDER_ALLOCATED: < 0.70
   *  - OPTIMAL: 0.70 - 1.00
   *  - OVER_ALLOCATED: 1.01 - 1.25
   *  - CRITICAL: > 1.25
   */
  private classifyWorkload(ratio: number): WorkloadStatus {
    if (ratio < 0.7) return 'UNDER_ALLOCATED';
    if (ratio <= 1.0) return 'OPTIMAL';
    if (ratio <= 1.25) return 'OVER_ALLOCATED';
    return 'CRITICAL';
  }

  /**
   * Get user effective weekly capacity hours
   */
  async getUserCapacity(userId: string): Promise<UserCapacityDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const now = new Date();
    const capacityRecord = await this.prisma.userCapacity.findFirst({
      where: {
        userId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    const weeklyCapacity = capacityRecord ? capacityRecord.weeklyCapacity : 40;

    return {
      id: capacityRecord?.id || 'default',
      userId,
      weeklyCapacity,
      effectiveFrom: capacityRecord?.effectiveFrom.toISOString() || now.toISOString(),
      effectiveTo: capacityRecord?.effectiveTo?.toISOString() || null,
      notes: capacityRecord?.notes || 'Standard 40 hours/week budget',
    };
  }

  /**
   * Set user weekly capacity (Manager/Lead only)
   */
  async setUserCapacity(
    userId: string,
    dto: SetUserCapacityDto,
    currentUser: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<UserCapacityDto> {
    if (currentUser.roleCode === RoleCode.ROLE_EMPLOYEE) {
      throw new ForbiddenException('Only Leads and Managers can configure user capacity');
    }

    if (dto.weeklyCapacity <= 0 || dto.weeklyCapacity > 80) {
      throw new BadRequestException('Weekly capacity must be between 1 and 80 hours');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) throw new NotFoundException(`User ${userId} not found`);

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    const record = await this.prisma.userCapacity.create({
      data: {
        userId,
        weeklyCapacity: dto.weeklyCapacity,
        effectiveFrom,
        effectiveTo,
        notes: dto.notes,
      },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      action: 'USER_CAPACITY_CONFIGURED',
      entityName: 'UserCapacity',
      entityId: record.id,
      metadata: {
        targetUserId: userId,
        weeklyCapacity: dto.weeklyCapacity,
        effectiveFrom: record.effectiveFrom,
        effectiveTo: record.effectiveTo,
      },
      ipAddress,
    });

    return {
      id: record.id,
      userId: record.userId,
      weeklyCapacity: record.weeklyCapacity,
      effectiveFrom: record.effectiveFrom.toISOString(),
      effectiveTo: record.effectiveTo?.toISOString() || null,
      notes: record.notes,
    };
  }

  /**
   * Calculate individual workload
   */
  async getUserWorkload(
    targetUserId: string,
    currentUser: { id: string; roleCode: RoleCode },
  ): Promise<UserWorkloadDto> {
    // Authorization check
    if (currentUser.roleCode === RoleCode.ROLE_EMPLOYEE && currentUser.id !== targetUserId) {
      throw new ForbiddenException('Employees can only view their own workload');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { role: true },
    });
    if (!targetUser) throw new NotFoundException(`User ${targetUserId} not found`);

    const capacity = await this.getUserCapacity(targetUserId);

    // Sum open task estimates assigned to target user
    const openTasks = await this.prisma.task.findMany({
      where: {
        assigneeId: targetUserId,
        status: { notIn: [WorkItemStatus.DONE, WorkItemStatus.CANCELLED] },
      },
      select: {
        estimatedHours: true,
        actualHours: true,
      },
    });

    const allocatedEstimatedHours = openTasks.reduce(
      (sum, t) => sum + (t.estimatedHours || 0),
      0,
    );
    const allocatedActualHours = openTasks.reduce(
      (sum, t) => sum + (t.actualHours || 0),
      0,
    );

    const utilizationRatio =
      capacity.weeklyCapacity > 0
        ? Number((allocatedEstimatedHours / capacity.weeklyCapacity).toFixed(2))
        : 0;

    return {
      userId: targetUser.id,
      userName: targetUser.fullName,
      userEmail: targetUser.email,
      roleCode: targetUser.role.code as RoleCode,
      weeklyCapacityHours: capacity.weeklyCapacity,
      allocatedEstimatedHours,
      allocatedActualHours,
      openTaskCount: openTasks.length,
      utilizationRatio,
      status: this.classifyWorkload(utilizationRatio),
    };
  }

  /**
   * Calculate team workload
   */
  async getTeamWorkload(
    teamId: string,
    currentUser: { id: string; roleCode: RoleCode },
  ): Promise<TeamWorkloadDto> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: { include: { role: true } },
          },
        },
      },
    });

    if (!team) throw new NotFoundException(`Team ${teamId} not found`);

    // Authorization: Employee must be member of team; Lead must be lead/member; Manager global
    if (currentUser.roleCode === RoleCode.ROLE_EMPLOYEE) {
      const isMember = team.members.some((m) => m.userId === currentUser.id);
      if (!isMember) throw new NotFoundException(`Team ${teamId} not found`);
    } else if (currentUser.roleCode === RoleCode.ROLE_LEAD) {
      const isLeadOrMember =
        team.leadId === currentUser.id ||
        team.members.some((m) => m.userId === currentUser.id);
      if (!isLeadOrMember) throw new NotFoundException(`Team ${teamId} not found`);
    }

    const memberWorkloads: UserWorkloadDto[] = [];
    let totalCapacityHours = 0;
    let totalAllocatedHours = 0;

    for (const member of team.members) {
      const workload = await this.getUserWorkload(member.userId, currentUser);
      memberWorkloads.push(workload);
      totalCapacityHours += workload.weeklyCapacityHours;
      totalAllocatedHours += workload.allocatedEstimatedHours;
    }

    const teamUtilizationRatio =
      totalCapacityHours > 0
        ? Number((totalAllocatedHours / totalCapacityHours).toFixed(2))
        : 0;

    return {
      teamId: team.id,
      teamName: team.name,
      totalCapacityHours,
      totalAllocatedHours,
      utilizationRatio: teamUtilizationRatio,
      status: this.classifyWorkload(teamUtilizationRatio),
      members: memberWorkloads,
    };
  }

  /**
   * Calculate project workload
   */
  async getProjectWorkload(
    projectId: string,
    currentUser: { id: string; roleCode: RoleCode },
  ): Promise<ProjectWorkloadDto> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    // Resource-scope authorization
    if (currentUser.roleCode === RoleCode.ROLE_EMPLOYEE) {
      const isMember = project.members.some((m) => m.userId === currentUser.id);
      if (!isMember) throw new NotFoundException(`Project ${projectId} not found`);
    } else if (currentUser.roleCode === RoleCode.ROLE_LEAD) {
      const isLeadOrMember =
        project.leadId === currentUser.id ||
        project.members.some((m) => m.userId === currentUser.id);
      if (!isLeadOrMember) throw new NotFoundException(`Project ${projectId} not found`);
    }

    // Find all open tasks in project with assignees
    const projectTasks = await this.prisma.task.findMany({
      where: {
        projectId,
        status: { notIn: [WorkItemStatus.DONE, WorkItemStatus.CANCELLED] },
      },
      select: {
        assigneeId: true,
        estimatedHours: true,
        actualHours: true,
      },
    });

    const totalEstimatedHours = projectTasks.reduce(
      (sum, t) => sum + (t.estimatedHours || 0),
      0,
    );
    const totalActualHours = projectTasks.reduce(
      (sum, t) => sum + (t.actualHours || 0),
      0,
    );

    const distinctAssigneeIds = Array.from(
      new Set(projectTasks.map((t) => t.assigneeId).filter(Boolean)),
    ) as string[];

    const assigneeWorkloads: UserWorkloadDto[] = [];
    for (const assigneeId of distinctAssigneeIds) {
      const workload = await this.getUserWorkload(assigneeId, currentUser);
      assigneeWorkloads.push(workload);
    }

    return {
      projectId: project.id,
      projectName: project.name,
      totalEstimatedHours,
      totalActualHours,
      assignees: assigneeWorkloads,
    };
  }
}
