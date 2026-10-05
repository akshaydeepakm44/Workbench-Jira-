import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  RoleCode,
  ProjectDecisionDto,
  CreateProjectDecisionDto,
} from '@workdesk/shared';

@Injectable()
export class DecisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async verifyProjectAccess(projectId: string, user: { id: string; roleCode: RoleCode }) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      const isMember = project.members.some((m) => m.userId === user.id);
      if (!isMember) throw new NotFoundException(`Project ${projectId} not found`);
    } else if (user.roleCode === RoleCode.ROLE_LEAD) {
      const isLeadOrMember = project.leadId === user.id || project.members.some((m) => m.userId === user.id);
      if (!isLeadOrMember) throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project;
  }

  private async checkIsIntern(userId: string): Promise<boolean> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true, employeeId: true },
    });
    if (!dbUser) return false;
    const email = dbUser.email?.toLowerCase() || '';
    const name = dbUser.fullName?.toLowerCase() || '';
    const empId = dbUser.employeeId?.toUpperCase() || '';
    return (
      email.includes('intern') ||
      name.includes('intern') ||
      empId.startsWith('INT') ||
      empId.includes('INTERN')
    );
  }

  async createDecision(
    dto: CreateProjectDecisionDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<ProjectDecisionDto> {
    const project = await this.verifyProjectAccess(dto.projectId, user);

    // Only Leads and Managers can record formal project decisions
    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      throw new ForbiddenException('Only Leads and Managers can record project decisions');
    }

    const rawVis = (dto.visibility || 'TEAM').toUpperCase();
    const visibility = ['MYSELF', 'TEAM', 'CORE'].includes(rawVis) ? rawVis : 'TEAM';

    const decision = await this.prisma.projectDecision.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        summary: dto.summary,
        rationale: dto.rationale,
        status: dto.status || 'APPROVED',
        visibility,
        decidedById: user.id,
        meetingId: dto.meetingId,
        taskId: dto.taskId,
      },
      include: {
        project: { select: { name: true } },
        decidedBy: { select: { fullName: true } },
        meeting: { select: { title: true } },
      },
    });

    let taskTicketId: string | null = null;
    if (dto.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: dto.taskId },
        select: { ticketId: true },
      });
      taskTicketId = task?.ticketId || null;
    }

    await this.auditService.log({
      actorId: user.id,
      action: 'PROJECT_DECISION_RECORDED',
      entityName: 'ProjectDecision',
      entityId: decision.id,
      metadata: {
        projectId: dto.projectId,
        title: dto.title,
        status: decision.status,
        visibility: decision.visibility,
      },
      ipAddress,
    });

    return {
      id: decision.id,
      projectId: decision.projectId,
      projectName: decision.project.name,
      title: decision.title,
      summary: decision.summary,
      rationale: decision.rationale,
      status: decision.status,
      visibility: decision.visibility,
      decidedById: decision.decidedById,
      decidedByName: decision.decidedBy.fullName,
      meetingId: decision.meetingId,
      meetingTitle: decision.meeting?.title || null,
      taskId: decision.taskId,
      taskTicketId,
      createdAt: decision.createdAt.toISOString(),
      updatedAt: decision.updatedAt.toISOString(),
    };
  }

  async getDecisions(
    projectId: string,
    user: { id: string; roleCode: RoleCode },
  ): Promise<ProjectDecisionDto[]> {
    const project = await this.verifyProjectAccess(projectId, user);
    const isIntern = await this.checkIsIntern(user.id);

    const decisions = await this.prisma.projectDecision.findMany({
      where: { projectId },
      include: {
        project: { select: { name: true } },
        decidedBy: { select: { fullName: true } },
        meeting: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const visibleDecisions = decisions.filter((d) => {
      const vis = (d.visibility || 'TEAM').toUpperCase();
      // 1. MYSELF: only visible to the author himself
      if (vis === 'MYSELF') {
        return d.decidedById === user.id;
      }
      // 2. CORE: visible to employees, hr, leads, managers, but NOT interns / external
      if (vis === 'CORE') {
        if (isIntern) return false;
        return true;
      }
      // 3. TEAM: visible to everyone
      return true;
    });

    return visibleDecisions.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      projectName: d.project.name,
      title: d.title,
      summary: d.summary,
      rationale: d.rationale,
      status: d.status,
      visibility: d.visibility,
      decidedById: d.decidedById,
      decidedByName: d.decidedBy.fullName,
      meetingId: d.meetingId,
      meetingTitle: d.meeting?.title || null,
      taskId: d.taskId,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async getDecision(id: string, user: { id: string; roleCode: RoleCode }): Promise<ProjectDecisionDto> {
    const d = await this.prisma.projectDecision.findUnique({
      where: { id },
      include: {
        project: { select: { name: true } },
        decidedBy: { select: { fullName: true } },
        meeting: { select: { title: true } },
      },
    });

    if (!d) throw new NotFoundException(`Decision ${id} not found`);
    await this.verifyProjectAccess(d.projectId, user);

    const isIntern = await this.checkIsIntern(user.id);
    const vis = (d.visibility || 'TEAM').toUpperCase();
    if (vis === 'MYSELF' && d.decidedById !== user.id) {
      throw new ForbiddenException('This decision is only visible to its author.');
    }
    if (vis === 'CORE' && isIntern) {
      throw new ForbiddenException('This decision is restricted to core personnel.');
    }

    return {
      id: d.id,
      projectId: d.projectId,
      projectName: d.project.name,
      title: d.title,
      summary: d.summary,
      rationale: d.rationale,
      status: d.status,
      visibility: d.visibility,
      decidedById: d.decidedById,
      decidedByName: d.decidedBy.fullName,
      meetingId: d.meetingId,
      meetingTitle: d.meeting?.title || null,
      taskId: d.taskId,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }
}
