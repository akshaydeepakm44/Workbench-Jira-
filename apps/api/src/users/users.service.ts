import { Injectable, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';
import { RoleCode } from '@workdesk/shared';
import * as crypto from 'crypto';

export interface InviteUserDto {
  fullName: string;
  email: string;
  employeeId?: string;
  projectId?: string;
  isProjectLead?: boolean;
  isLead?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  async findAll(query?: { search?: string; roleCode?: RoleCode }) {
    const where: any = {};
    if (query?.roleCode) {
      where.role = { code: query.roleCode };
    }
    if (query?.search) {
      where.OR = [
        { fullName: { contains: query.search } },
        { email: { contains: query.search } },
        { employeeId: { contains: query.search } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        role: true,
        teamMemberships: { include: { team: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      employeeId: u.employeeId,
      approvalStatus: u.approvalStatus,
      approvedById: u.approvedById,
      approvedAt: u.approvedAt,
      roleCode: u.role.code as RoleCode,
      roleName: u.role.name,
      isActive: u.isActive,
      teams: u.teamMemberships.map((tm) => ({
        id: tm.team.id,
        name: tm.team.name,
        roleInTeam: tm.roleInTeam,
      })),
      createdAt: u.createdAt,
    }));
  }

  async findPendingApprovals() {
    return this.prisma.user.findMany({
      where: { approvalStatus: 'PENDING' },
      include: {
        role: true,
        teamMemberships: { include: { team: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        teamMemberships: { include: { team: true } },
        projectMemberships: { include: { project: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      employeeId: user.employeeId,
      approvalStatus: user.approvalStatus,
      approvedById: user.approvedById,
      approvedAt: user.approvedAt,
      roleCode: user.role.code as RoleCode,
      roleName: user.role.name,
      isActive: user.isActive,
      teams: user.teamMemberships.map((tm) => ({
        id: tm.team.id,
        name: tm.team.name,
        roleInTeam: tm.roleInTeam,
      })),
      projects: user.projectMemberships.map((pm) => ({
        id: pm.project.id,
        name: pm.project.name,
        key: pm.project.key,
        roleInProject: pm.roleInProject,
      })),
      createdAt: user.createdAt,
    };
  }

  async updateRole(id: string, newRoleCode: RoleCode, actorId: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.role.findUnique({
      where: { code: newRoleCode },
    });

    if (!role) {
      throw new BadRequestException(`Role ${newRoleCode} does not exist`);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { roleId: role.id },
      include: { role: true },
    });

    await this.auditService.log({
      actorId,
      action: 'USER_ROLE_CHANGED',
      entityName: 'User',
      entityId: user.id,
      metadata: { previousRole: user.role.code, newRole: newRoleCode },
      ipAddress,
    });

    return {
      id: updated.id,
      email: updated.email,
      roleCode: updated.role.code,
      roleName: updated.role.name,
    };
  }

  async toggleActive(id: string, actorId: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });

    await this.auditService.log({
      actorId,
      action: updated.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityName: 'User',
      entityId: user.id,
      metadata: { isActive: updated.isActive },
      ipAddress,
    });

    return { id: updated.id, isActive: updated.isActive };
  }

  async approveUser(
    id: string,
    dto: { employeeId: string; roleCode?: RoleCode; teamId?: string },
    actor: any,
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!dto.employeeId || dto.employeeId.trim() === '') {
      throw new BadRequestException('Employee ID is required');
    }

    const existingEmpId = await this.prisma.user.findFirst({
      where: { employeeId: dto.employeeId.trim(), id: { not: id } },
    });
    if (existingEmpId) {
      throw new BadRequestException(`Employee ID ${dto.employeeId} is already assigned to ${existingEmpId.fullName}`);
    }

    let newRoleId = user.roleId;
    if (dto.roleCode) {
      if (dto.roleCode === RoleCode.ROLE_MANAGER && actor.roleCode !== RoleCode.ROLE_MANAGER) {
        throw new BadRequestException('Only a Manager can approve or grant Manager roles');
      }
      const targetRole = await this.prisma.role.findUnique({ where: { code: dto.roleCode } });
      if (targetRole) newRoleId = targetRole.id;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        employeeId: dto.employeeId.trim(),
        approvalStatus: 'APPROVED',
        approvedById: actor.id,
        approvedAt: new Date(),
        roleId: newRoleId,
        isActive: true,
      },
      include: { role: true },
    });

    if (dto.teamId) {
      await this.prisma.teamMember.upsert({
        where: {
          teamId_userId: { teamId: dto.teamId, userId: id },
        },
        update: {},
        create: {
          userId: id,
          teamId: dto.teamId,
          roleInTeam: dto.roleCode === RoleCode.ROLE_LEAD ? 'LEAD' : 'MEMBER',
        },
      });
    }

    await this.auditService.log({
      actorId: actor.id,
      action: 'USER_APPROVED',
      entityName: 'User',
      entityId: user.id,
      metadata: {
        email: user.email,
        employeeId: dto.employeeId.trim(),
        assignedRole: updated.role.code,
        approvedBy: actor.email,
      },
      ipAddress,
    });

    this.emailService.sendAccountApprovedEmail({
      to: updated.email,
      fullName: updated.fullName,
      employeeId: updated.employeeId || dto.employeeId.trim(),
      roleName: updated.role.name,
    }).catch((err) => {
      console.error('Failed to dispatch user approval email:', err);
    });

    return updated;
  }

  async promoteToLead(id: string, dto: { teamId?: string }, actor: any, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const leadRole = await this.prisma.role.findUnique({ where: { code: RoleCode.ROLE_LEAD } });
    if (!leadRole) throw new BadRequestException('ROLE_LEAD not configured');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { roleId: leadRole.id },
      include: { role: true },
    });

    if (dto.teamId) {
      await this.prisma.team.update({
        where: { id: dto.teamId },
        data: { leadId: user.id },
      });
      await this.prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: dto.teamId, userId: id } },
        update: { roleInTeam: 'LEAD' },
        create: { userId: id, teamId: dto.teamId, roleInTeam: 'LEAD' },
      });
    }

    await this.auditService.log({
      actorId: actor.id,
      action: 'LEAD_PROMOTED',
      entityName: 'User',
      entityId: user.id,
      metadata: { email: user.email, teamId: dto.teamId, promotedBy: actor.email },
      ipAddress,
    });

    return updated;
  }

  async preProvision(
    dto: { email: string; fullName: string; employeeId: string; roleCode?: RoleCode; teamId?: string },
    actor: any,
    ipAddress?: string,
  ) {
    if (!dto.email || !dto.employeeId || !dto.fullName) {
      throw new BadRequestException('Email, Full Name, and Employee ID are required');
    }

    const cleanEmail = dto.email.toLowerCase().trim();
    const cleanEmpId = dto.employeeId.trim();

    const existingEmp = await this.prisma.user.findFirst({
      where: { employeeId: cleanEmpId },
    });
    if (existingEmp) {
      throw new BadRequestException(`Employee ID ${cleanEmpId} is already assigned to ${existingEmp.fullName}`);
    }

    const assignedRoleCode = dto.roleCode || RoleCode.ROLE_EMPLOYEE;
    if (assignedRoleCode === RoleCode.ROLE_MANAGER && actor.roleCode !== RoleCode.ROLE_MANAGER) {
      throw new BadRequestException('Only a Manager can pre-provision Managers');
    }

    const role = await this.prisma.role.findUnique({ where: { code: assignedRoleCode } });
    if (!role) throw new BadRequestException(`Role ${assignedRoleCode} not found`);

    const user = await this.prisma.user.upsert({
      where: { email: cleanEmail },
      update: {
        fullName: dto.fullName,
        employeeId: cleanEmpId,
        approvalStatus: 'APPROVED',
        approvedById: actor.id,
        approvedAt: new Date(),
        roleId: role.id,
        isActive: true,
      },
      create: {
        email: cleanEmail,
        fullName: dto.fullName,
        employeeId: cleanEmpId,
        approvalStatus: 'APPROVED',
        approvedById: actor.id,
        approvedAt: new Date(),
        roleId: role.id,
        isActive: true,
        notificationPreference: { create: {} },
      },
      include: { role: true },
    });

    if (dto.teamId) {
      await this.prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: dto.teamId, userId: user.id } },
        update: { roleInTeam: assignedRoleCode === RoleCode.ROLE_LEAD ? 'LEAD' : 'MEMBER' },
        create: {
          userId: user.id,
          teamId: dto.teamId,
          roleInTeam: assignedRoleCode === RoleCode.ROLE_LEAD ? 'LEAD' : 'MEMBER',
        },
      });
    }

    await this.auditService.log({
      actorId: actor.id,
      action: 'USER_PRE_PROVISIONED',
      entityName: 'User',
      entityId: user.id,
      metadata: { email: cleanEmail, employeeId: cleanEmpId, role: assignedRoleCode },
      ipAddress,
    });

    return user;
  }

  // =========================================================================
  // ONBOARDING & INVITATION PIPELINE
  // =========================================================================
  async inviteUser(dto: InviteUserDto, actor: any, ipAddress?: string) {
    if (!dto.email || !dto.fullName) {
      throw new BadRequestException('Full Name and Email are required');
    }

    const cleanEmail = dto.email.toLowerCase().trim();
    let cleanEmpId = dto.employeeId?.trim();

    if (!cleanEmpId) {
      const count = await this.prisma.user.count();
      cleanEmpId = `EMP-${(count + 1).toString().padStart(4, '0')}`;
    }

    const existing = await this.prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing && existing.invitationStatus === 'APPROVED' && existing.isActive) {
      throw new BadRequestException(`User with email ${cleanEmail} is already active.`);
    }

    const existingEmp = await this.prisma.user.findFirst({
      where: { employeeId: cleanEmpId, email: { not: cleanEmail } },
    });
    if (existingEmp) {
      throw new BadRequestException(`Employee ID ${cleanEmpId} is already in use by ${existingEmp.fullName}`);
    }

    let project: any = null;
    if (dto.projectId) {
      project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
      if (!project) throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    // Baseline role is ROLE_EMPLOYEE.
    // If designated as Project Lead, Governed Synchronization sets role to ROLE_LEAD.
    const targetRoleCode = (dto.projectId && dto.isProjectLead) ? RoleCode.ROLE_LEAD : RoleCode.ROLE_EMPLOYEE;
    const role = await this.prisma.role.findUnique({ where: { code: targetRoleCode } });
    if (!role) throw new BadRequestException(`Role ${targetRoleCode} not found`);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitationTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();
    const invitationExpiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours

    const user = await this.prisma.user.upsert({
      where: { email: cleanEmail },
      update: {
        fullName: dto.fullName.trim(),
        employeeId: cleanEmpId,
        roleId: role.id,
        approvalStatus: 'PENDING',
        isActive: false,
        invitationTokenHash,
        invitationSentAt: now,
        invitationExpiresAt,
        invitationStatus: 'INVITED',
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        otpLockedUntil: null,
      },
      create: {
        email: cleanEmail,
        fullName: dto.fullName.trim(),
        employeeId: cleanEmpId,
        roleId: role.id,
        approvalStatus: 'PENDING',
        isActive: false,
        invitationTokenHash,
        invitationSentAt: now,
        invitationExpiresAt,
        invitationStatus: 'INVITED',
        notificationPreference: { create: {} },
      },
      include: { role: true },
    });

    const isProjectLead = Boolean(dto.isLead !== undefined ? dto.isLead : dto.isProjectLead);
    if (project) {
      const roleInProject = isProjectLead ? 'LEAD' : 'CONTRIBUTOR';
      await this.prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
        update: { roleInProject },
        create: { projectId: project.id, userId: user.id, roleInProject },
      });

      if (isProjectLead) {
        await this.prisma.project.update({
          where: { id: project.id },
          data: { leadId: user.id },
        });
      }
    }

    const appUrl = process.env.APP_URL || 'http://localhost:5174';
    const inviteLink = `${appUrl}/accept-invitation?token=${rawToken}`;
    const localLink = `http://localhost:5174/accept-invitation?token=${rawToken}`;
    let emailStatus: 'SENT' | 'PENDING_ENVIRONMENT' = 'PENDING_ENVIRONMENT';
    let emailPreviewUrl: string | null = null;

    try {
      const emailResult = await this.emailService.sendMail({
        to: cleanEmail,
        subject: `You have been invited to WorkDesk by ${actor.fullName || 'Manager'}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
            <div style="margin-bottom: 20px;">
              <h2 style="color: #4f46e5; margin: 0; font-size: 22px;">WorkDesk Invitation</h2>
              <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Productivity & Team Management</p>
            </div>
            <p style="font-size: 15px; line-height: 1.5;">Hello <strong>${user.fullName}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.5;">
              You have been invited to join WorkDesk as <strong>${role.name}</strong>${project ? ` on <strong>${project.name}</strong>` : ''}.
            </p>
            <div style="margin: 28px 0; text-align: center;">
              <a href="${inviteLink}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
                Accept & Verify Invitation
              </a>
            </div>
            <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
              Primary Verification Link:<br/>
              <a href="${inviteLink}" style="color: #4f46e5; word-break: break-all;">${inviteLink}</a>
            </p>
            ${!appUrl.includes('localhost') ? `
            <p style="color: #64748b; font-size: 12px; line-height: 1.4; margin-top: 12px; padding: 10px; background-color: #f8fafc; border-radius: 6px; border: 1px dashed #cbd5e1;">
              <strong>Testing on this local computer?</strong> You can also access via your local dev URL:<br/>
              <a href="${localLink}" style="color: #0284c7; word-break: break-all;">${localLink}</a>
            </p>` : ''}
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">This invitation is valid for 72 hours. If you did not expect this invitation, you can ignore this email.</p>
          </div>
        `,
        text: `Hello ${user.fullName},\n\nYou have been invited to join WorkDesk as ${role.name}${project ? ` on ${project.name}` : ''}.\n\nClick the link below to accept and verify your invitation:\n${inviteLink}\n\nLocal development link: ${localLink}\n\nThis invitation is valid for 72 hours.`,
        templateName: 'USER_INVITATION',
      });
      emailStatus = emailResult.success ? 'SENT' : 'PENDING_ENVIRONMENT';
      emailPreviewUrl = emailResult.previewUrl || null;
    } catch {
      emailStatus = 'PENDING_ENVIRONMENT';
    }

    await this.auditService.log({
      actorId: actor.id,
      action: 'USER_INVITATION_CREATED',
      entityName: 'User',
      entityId: user.id,
      metadata: {
        email: cleanEmail,
        employeeId: cleanEmpId,
        projectId: project?.id,
        isLead: isProjectLead,
        invitationExpiresAt,
        emailStatus,
        emailPreviewUrl,
      },
      ipAddress,
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        employeeId: user.employeeId,
        roleCode: user.role.code,
        status: user.invitationStatus,
        invitationExpiresAt: user.invitationExpiresAt,
      },
      token: rawToken,
      rawToken,
      inviteLink,
      emailStatus,
      emailPreviewUrl,
    };
  }

  async resendInvitation(userId: string, actor: any, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.invitationStatus === 'APPROVED' && user.isActive) {
      throw new BadRequestException('User is already approved and active');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitationTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();
    const invitationExpiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        invitationTokenHash,
        invitationSentAt: now,
        invitationExpiresAt,
        invitationStatus: 'INVITED',
        otpHash: null,
        otpAttempts: 0,
        otpLockedUntil: null,
        otpLastSentAt: null,
      },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:5174';
    const inviteLink = `${appUrl}/accept-invitation?token=${rawToken}`;
    const localLink = `http://localhost:5174/accept-invitation?token=${rawToken}`;
    let emailStatus: 'SENT' | 'PENDING_ENVIRONMENT' = 'PENDING_ENVIRONMENT';
    let emailPreviewUrl: string | null = null;

    try {
      const emailResult = await this.emailService.sendMail({
        to: user.email,
        subject: `Your WorkDesk Invitation (Resent)`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
            <div style="margin-bottom: 20px;">
              <h2 style="color: #4f46e5; margin: 0; font-size: 22px;">WorkDesk Invitation (Resent)</h2>
              <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Productivity & Team Management</p>
            </div>
            <p style="font-size: 15px; line-height: 1.5;">Hello <strong>${user.fullName}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.5;">
              Here is your updated invitation link to join WorkDesk:
            </p>
            <div style="margin: 28px 0; text-align: center;">
              <a href="${inviteLink}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
                Accept & Verify Invitation
              </a>
            </div>
            <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
              Primary Verification Link:<br/>
              <a href="${inviteLink}" style="color: #4f46e5; word-break: break-all;">${inviteLink}</a>
            </p>
            ${!appUrl.includes('localhost') ? `
            <p style="color: #64748b; font-size: 12px; line-height: 1.4; margin-top: 12px; padding: 10px; background-color: #f8fafc; border-radius: 6px; border: 1px dashed #cbd5e1;">
              <strong>Testing on this local computer?</strong> You can also access via your local dev URL:<br/>
              <a href="${localLink}" style="color: #0284c7; word-break: break-all;">${localLink}</a>
            </p>` : ''}
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">This invitation is valid for 72 hours.</p>
          </div>
        `,
        text: `Hello ${user.fullName},\n\nHere is your updated invitation link to join WorkDesk:\n${inviteLink}\n\nLocal development link: ${localLink}\n\nThis invitation is valid for 72 hours.`,
        templateName: 'USER_INVITATION_RESENT',
      });
      emailStatus = emailResult.success ? 'SENT' : 'PENDING_ENVIRONMENT';
      emailPreviewUrl = emailResult.previewUrl || null;
    } catch {
      emailStatus = 'PENDING_ENVIRONMENT';
    }

    await this.auditService.log({
      actorId: actor.id,
      action: 'USER_INVITATION_RESENT',
      entityName: 'User',
      entityId: user.id,
      metadata: { email: user.email, newExpiresAt: invitationExpiresAt, emailStatus, emailPreviewUrl },
      ipAddress,
    });

    return { success: true, token: rawToken, rawToken, inviteLink, emailStatus, emailPreviewUrl };
  }

  async revokeInvitation(userId: string, actor: any, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.invitationStatus === 'APPROVED' && user.isActive) {
      throw new BadRequestException('Cannot revoke an already active user');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        invitationTokenHash: null,
        invitationStatus: 'REVOKED',
        otpHash: null,
      },
    });

    await this.auditService.log({
      actorId: actor.id,
      action: 'USER_INVITATION_REVOKED',
      entityName: 'User',
      entityId: user.id,
      metadata: { email: user.email },
      ipAddress,
    });

    return { success: true, message: 'Invitation revoked successfully' };
  }

  async getInvitations() {
    const users = await this.prisma.user.findMany({
      where: {
        invitationStatus: { in: ['INVITED', 'PENDING_VERIFY', 'EXPIRED', 'REVOKED', 'LOCKED'] },
      },
      include: {
        role: true,
        projectMemberships: { include: { project: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      employeeId: u.employeeId,
      roleCode: u.role.code as RoleCode,
      roleName: u.role.name,
      invitationStatus: u.invitationStatus,
      invitationSentAt: u.invitationSentAt,
      invitationExpiresAt: u.invitationExpiresAt,
      projects: u.projectMemberships.map((pm) => ({
        id: pm.project.id,
        name: pm.project.name,
        key: pm.project.key,
        roleInProject: pm.roleInProject,
        isLead: pm.roleInProject === 'LEAD',
      })),
    }));
  }

  async getProjects() {
    return this.prisma.project.findMany({
      include: {
        lead: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createProject(dto: { name: string; key: string; description?: string }, actor: any, ipAddress?: string) {
    const formattedKey = dto.key.toUpperCase().trim();
    const existing = await this.prisma.project.findUnique({
      where: { key: formattedKey },
    });
    if (existing) {
      throw new BadRequestException(`Project key "${formattedKey}" is already in use`);
    }

    const project = await this.prisma.project.create({
      data: {
        name: dto.name.trim(),
        key: formattedKey,
        status: 'Active',
        sequence: {
          create: {
            projectKey: formattedKey,
            currentSeq: 1000,
          },
        },
      },
      include: {
        lead: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    await this.auditService.log({
      actorId: actor.id,
      action: 'CREATE_PROJECT',
      entityName: 'Project',
      entityId: project.id,
      metadata: { name: project.name, key: project.key },
      ipAddress,
    });

    return project;
  }

  async deleteUser(userId: string, actor: any, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    if (actor.id === userId) {
      throw new BadRequestException('You cannot remove your own administrator account');
    }

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'akshay.m@datai2i.com';
    if (user.email === superAdminEmail) {
      throw new BadRequestException('Cannot remove the root organization administrator');
    }

    // Clean up all related records before deleting user
    await this.prisma.$transaction([
      this.prisma.session.deleteMany({ where: { userId } }),
      this.prisma.googleAccount.deleteMany({ where: { userId } }),
      this.prisma.projectMember.deleteMany({ where: { userId } }),
      this.prisma.teamMember.deleteMany({ where: { userId } }),
      this.prisma.taskWatcher.deleteMany({ where: { userId } }),
      this.prisma.taskPoint.updateMany({ where: { completedById: userId }, data: { completedById: null } }),
      this.prisma.taskPoint.deleteMany({ where: { authorId: userId } }),
      this.prisma.acceptanceCriterion.updateMany({ where: { completedById: userId }, data: { completedById: null } }),
      this.prisma.acceptanceCriterion.deleteMany({ where: { createdById: userId } }),
      this.prisma.taskEvidence.deleteMany({ where: { uploaderId: userId } }),
      this.prisma.taskComment.deleteMany({ where: { authorId: userId } }),
      this.prisma.taskActivity.deleteMany({ where: { actorId: userId } }),
      this.prisma.standup.deleteMany({ where: { userId } }),
      this.prisma.meetingParticipant.deleteMany({ where: { userId } }),
      this.prisma.meetingActionItem.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } }),
      this.prisma.notification.deleteMany({ where: { userId } }),
      this.prisma.notificationPreference.deleteMany({ where: { userId } }),
      this.prisma.userCapacity.deleteMany({ where: { userId } }),
      this.prisma.projectDecision.deleteMany({ where: { decidedById: userId } }),
      this.prisma.task.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } }),
      this.prisma.task.deleteMany({ where: { creatorId: userId } }),
      this.prisma.project.updateMany({ where: { leadId: userId }, data: { leadId: null } }),
      this.prisma.team.updateMany({ where: { leadId: userId }, data: { leadId: null } }),
      this.prisma.meeting.deleteMany({ where: { organizerId: userId } }),
      this.prisma.automationRule.deleteMany({ where: { creatorId: userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    await this.auditService.log({
      actorId: actor.id,
      action: 'USER_REMOVED',
      entityName: 'User',
      entityId: userId,
      metadata: { email: user.email, fullName: user.fullName, employeeId: user.employeeId },
      ipAddress,
    });

    return {
      success: true,
      message: `User ${user.fullName} (${user.email}) permanently removed from platform`,
    };
  }
}

