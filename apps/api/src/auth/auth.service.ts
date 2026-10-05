import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RoleCode } from '@workdesk/shared';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { encryptToken } from './crypto.util';
import { EmailService } from '../notifications/email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  async getGoogleAuthUrl(): Promise<{ url: string }> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId || clientId.trim() === '') {
      throw new BadRequestException('GOOGLE_CLIENT_ID is not configured yet. Please add your Client ID from Google Cloud Console into .env.');
    }
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI') || 'http://localhost:3000/api/v1/auth/google/callback';
    const state = uuidv4();
    const scope = encodeURIComponent('openid email profile https://www.googleapis.com/auth/calendar.events');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

    return { url };
  }

  async handleGoogleCallback(code: string, ipAddress?: string, userAgent?: string) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI') || 'http://localhost:3000/api/v1/auth/google/callback';
    const encKey = this.configService.get<string>('ENCRYPTION_KEY') || '0123456789abcdef0123456789abcdef';

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth client ID or secret is not configured in .env');
    }

    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Google token exchange error:', errText);
      throw new UnauthorizedException('Failed to exchange code with Google');
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;

    // 2. Fetch userinfo from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      throw new UnauthorizedException('Failed to retrieve user profile from Google');
    }

    const userInfo = await userRes.json();
    const googleSub = userInfo.sub;
    const email = userInfo.email;
    const fullName = userInfo.name || userInfo.email.split('@')[0];
    const avatarUrl = userInfo.picture;

    // 3. Domain Check (only enforce if GOOGLE_ALLOWED_DOMAIN is set and not wildcard)
    const allowedDomain = this.configService.get<string>('GOOGLE_ALLOWED_DOMAIN');
    const bootstrapManagerEmail = (
      this.configService.get<string>('BOOTSTRAP_MANAGER_EMAIL') ||
      this.configService.get<string>('SUPER_ADMIN_EMAIL') ||
      'akshay.m@datai2i.com'
    ).toLowerCase().replace(/\s+/g, '');
    const cleanEmail = email.toLowerCase().trim();
    const domain = cleanEmail.split('@')[1];

    const isBootstrapManager = cleanEmail === bootstrapManagerEmail || cleanEmail === 'akshay.m@datai2i.com';

    if (
      allowedDomain &&
      allowedDomain.trim() !== '' &&
      allowedDomain !== '*' &&
      domain !== allowedDomain &&
      !isBootstrapManager
    ) {
      throw new UnauthorizedException(`Access restricted to @${allowedDomain} domain`);
    }

    // 4. Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { role: true },
    });

    if (!user) {
      let assignedRoleCode = RoleCode.ROLE_EMPLOYEE;
      let approvalStatus = 'PENDING';
      let employeeId: string | null = null;

      if (isBootstrapManager) {
        assignedRoleCode = RoleCode.ROLE_MANAGER;
        approvalStatus = 'APPROVED';
        employeeId = 'MGR-001';
      }

      const role = await this.prisma.role.findUnique({
        where: { code: assignedRoleCode },
      });

      if (!role) {
        throw new BadRequestException(`Role ${assignedRoleCode} not found in database.`);
      }

      user = await this.prisma.user.create({
        data: {
          email: cleanEmail,
          fullName,
          avatarUrl,
          employeeId,
          approvalStatus,
          approvedAt: approvalStatus === 'APPROVED' ? new Date() : null,
          roleId: role.id,
          isActive: true,
          notificationPreference: {
            create: {},
          },
        },
        include: { role: true },
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'USER_CREATED_GOOGLE',
        entityName: 'User',
        entityId: user.id,
        metadata: { email: user.email, role: user.role.code, approvalStatus },
        ipAddress,
      });

      if (approvalStatus === 'PENDING') {
        this.emailService.sendAccessRequestEmail(user).catch((err) => {
          console.error('Failed to dispatch access request email:', err);
        });
      }
    } else {
      let updatedData: any = {};
      if (avatarUrl && avatarUrl !== user.avatarUrl) {
        updatedData.avatarUrl = avatarUrl;
      }

      if (isBootstrapManager && user.role.code !== RoleCode.ROLE_MANAGER) {
        const managerRole = await this.prisma.role.findUnique({ where: { code: RoleCode.ROLE_MANAGER } });
        if (managerRole) {
          updatedData.roleId = managerRole.id;
          updatedData.approvalStatus = 'APPROVED';
          updatedData.isActive = true;
          if (!user.employeeId) updatedData.employeeId = 'MGR-001';
        }
      }

      if (Object.keys(updatedData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updatedData,
          include: { role: true },
        });
      }
    }

    // 5. Upsert GoogleAccount link
    const encryptedRefreshToken = refreshToken ? encryptToken(refreshToken, encKey) : null;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    const existingGoogle = await this.prisma.googleAccount.findFirst({
      where: { userId: user.id },
    });

    if (existingGoogle) {
      await this.prisma.googleAccount.update({
        where: { id: existingGoogle.id },
        data: {
          googleSub,
          accessToken,
          ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
          tokenExpiresAt,
        },
      });
    } else {
      await this.prisma.googleAccount.create({
        data: {
          userId: user.id,
          googleSub,
          accessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
        },
      });
    }

    // 6. Create session
    const sessionId = uuidv4();
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + 30);

    const session = await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        userAgent,
        ipAddress,
        expiresAt: sessionExpiresAt,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'USER_LOGIN_GOOGLE',
      entityName: 'Session',
      entityId: session.id,
      metadata: { email: user.email },
      ipAddress,
    });

    return { session, user };
  }

  async loginOrCreateUser(params: {
    email: string;
    fullName: string;
    avatarUrl?: string;
    googleSub?: string;
    ipAddress?: string;
    userAgent?: string;
    requestedRole?: RoleCode;
  }) {
    const bootstrapManagerEmail = (
      this.configService.get<string>('BOOTSTRAP_MANAGER_EMAIL') ||
      this.configService.get<string>('SUPER_ADMIN_EMAIL') ||
      'akshay.m@datai2i.com'
    ).toLowerCase().replace(/\s+/g, '');
    const allowedDomain = this.configService.get<string>('GOOGLE_ALLOWED_DOMAIN');

    const cleanEmail = params.email.toLowerCase().trim();
    const domain = cleanEmail.split('@')[1];
    const isBootstrapManager = cleanEmail === bootstrapManagerEmail || cleanEmail === 'akshay.m@datai2i.com';

    if (allowedDomain && allowedDomain.trim() !== '' && allowedDomain !== '*' && domain !== allowedDomain && !isBootstrapManager) {
      throw new UnauthorizedException(`Access restricted to @${allowedDomain} domain`);
    }

    let user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { role: true },
    });

    if (!user) {
      let assignedRoleCode = RoleCode.ROLE_EMPLOYEE;
      let approvalStatus = 'PENDING';
      let employeeId: string | null = null;

      if (isBootstrapManager) {
        assignedRoleCode = RoleCode.ROLE_MANAGER;
        approvalStatus = 'APPROVED';
        employeeId = 'MGR-001';
      } else if (params.requestedRole) {
        assignedRoleCode = params.requestedRole;
      }

      const role = await this.prisma.role.findUnique({
        where: { code: assignedRoleCode },
      });

      if (!role) {
        throw new BadRequestException(`Role ${assignedRoleCode} not found. Please run database seed.`);
      }

      user = await this.prisma.user.create({
        data: {
          email: cleanEmail,
          fullName: params.fullName,
          avatarUrl: params.avatarUrl,
          employeeId,
          approvalStatus,
          approvedAt: approvalStatus === 'APPROVED' ? new Date() : null,
          roleId: role.id,
          isActive: true,
          notificationPreference: {
            create: {},
          },
        },
        include: { role: true },
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'USER_CREATED',
        entityName: 'User',
        entityId: user.id,
        metadata: { email: user.email, role: user.role.code, approvalStatus },
        ipAddress: params.ipAddress,
      });

      if (approvalStatus === 'PENDING') {
        this.emailService.sendAccessRequestEmail(user).catch((err) => {
          console.error('Failed to dispatch access request email:', err);
        });
      }
    } else {
      let updatedData: any = {};
      if (isBootstrapManager && user.role.code !== RoleCode.ROLE_MANAGER) {
        const managerRole = await this.prisma.role.findUnique({ where: { code: RoleCode.ROLE_MANAGER } });
        if (managerRole) {
          updatedData.roleId = managerRole.id;
          updatedData.approvalStatus = 'APPROVED';
          updatedData.isActive = true;
          if (!user.employeeId) updatedData.employeeId = 'MGR-001';
        }
      }

      if (Object.keys(updatedData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updatedData,
          include: { role: true },
        });
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive. Please contact an organization manager.');
    }

    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

    const session = await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
        expiresAt,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'USER_LOGIN',
      entityName: 'Session',
      entityId: session.id,
      metadata: { email: user.email },
      ipAddress: params.ipAddress,
    });

    let permissions: string[] = [];
    try {
      permissions = JSON.parse(user.role.permissions);
    } catch {
      permissions = [];
    }

    return {
      session,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        employeeId: user.employeeId,
        approvalStatus: user.approvalStatus,
        roleCode: user.role.code as RoleCode,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      permissions,
    };
  }

  async logout(sessionId: string, userId?: string, ipAddress?: string) {
    await this.prisma.session.deleteMany({
      where: { id: sessionId },
    });

    if (userId) {
      await this.auditService.log({
        actorId: userId,
        action: 'USER_LOGOUT',
        entityName: 'Session',
        entityId: sessionId,
        ipAddress,
      });
    }
    return { success: true };
  }

  // =========================================================================
  // INVITATION & OTP VERIFICATION PIPELINE
  // =========================================================================
  async validateInvitationToken(rawToken: string) {
    if (!rawToken || rawToken.trim() === '') {
      throw new BadRequestException('Invitation token is required');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { invitationTokenHash: tokenHash },
      include: {
        role: true,
        projectMemberships: { include: { project: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Invitation token is invalid or does not exist');
    }

    if (user.invitationStatus === 'APPROVED' && user.isActive) {
      throw new BadRequestException('Invitation has already been accepted and verified');
    }

    if (user.invitationStatus === 'REVOKED') {
      throw new HttpException('Invitation has been revoked by the Manager', HttpStatus.GONE);
    }

    if (user.invitationExpiresAt && user.invitationExpiresAt < new Date()) {
      throw new HttpException('Invitation link has expired (72h limit). Please request a new invite.', HttpStatus.GONE);
    }

    const primaryProject = user.projectMemberships[0]?.project;
    const isLead = user.projectMemberships.some((pm) => pm.roleInProject === 'LEAD');

    return {
      valid: true,
      user: {
        fullName: user.fullName,
        email: user.email,
        employeeId: user.employeeId,
        roleName: user.role.name,
        projectName: primaryProject?.name || null,
        isLead,
        invitationStatus: user.invitationStatus,
      },
    };
  }

  async requestInvitationOtp(rawToken: string, ipAddress?: string) {
    if (!rawToken || rawToken.trim() === '') {
      throw new BadRequestException('Invitation token is required');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { invitationTokenHash: tokenHash },
    });

    if (!user) {
      throw new NotFoundException('Invitation token is invalid or does not exist');
    }

    if (user.invitationStatus === 'REVOKED') {
      throw new HttpException('Invitation has been revoked', HttpStatus.GONE);
    }

    if (user.invitationExpiresAt && user.invitationExpiresAt < new Date()) {
      throw new HttpException('Invitation has expired', HttpStatus.GONE);
    }

    // Cooldown check (60 seconds)
    if (user.otpLastSentAt) {
      const diffMs = Date.now() - user.otpLastSentAt.getTime();
      if (diffMs < 60000) {
        const remainingSec = Math.ceil((60000 - diffMs) / 1000);
        throw new HttpException(`Please wait ${remainingSec} seconds before requesting a new code.`, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    // Lockout check
    if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
      const waitMin = Math.ceil((user.otpLockedUntil.getTime() - Date.now()) / 60000);
      throw new HttpException(`Account verification temporarily locked. Try again in ${waitMin} minutes.`, 423);
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp + user.id).digest('hex');
    const now = new Date();
    const otpExpiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otpHash,
        otpExpiresAt,
        otpLastSentAt: now,
        invitationStatus: 'PENDING_VERIFY',
      },
    });

    let emailStatus: 'SENT' | 'PENDING_ENVIRONMENT' = 'PENDING_ENVIRONMENT';
    let emailPreviewUrl: string | null = null;
    try {
      const emailResult = await this.emailService.sendMail({
        to: user.email,
        subject: 'Your WorkDesk Verification Code',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #4f46e5; margin: 0 0 8px 0; font-size: 20px;">Identity Confirmation</h2>
            <p style="color: #334155; font-size: 14px;">Hello <strong>${user.fullName}</strong>,</p>
            <p style="color: #475569; font-size: 14px;">Your 6-digit one-time verification code is:</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e1b4b; background: #e0e7ff; padding: 14px; text-align: center; border-radius: 8px; margin: 20px 0; font-family: monospace;">
              ${otp}
            </div>
            <p style="color: #64748b; font-size: 13px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `,
        text: `Hello ${user.fullName},\n\nYour WorkDesk one-time verification code is: ${otp}\n\nThis code will expire in 10 minutes.`,
        templateName: 'INVITATION_OTP',
      });
      emailStatus = emailResult.success ? 'SENT' : 'PENDING_ENVIRONMENT';
      emailPreviewUrl = emailResult.previewUrl || null;
    } catch {
      emailStatus = 'PENDING_ENVIRONMENT';
    }

    await this.auditService.log({
      actorId: user.id,
      action: 'INVITATION_OTP_DISPATCHED',
      entityName: 'User',
      entityId: user.id,
      metadata: { email: user.email, otpExpiresAt, emailStatus, emailPreviewUrl },
      ipAddress,
    });

    return {
      success: true,
      message: 'Verification code sent to registered email.',
      expiresInSeconds: 600,
      cooldownSeconds: 60,
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
      emailPreviewUrl,
    };
  }

  async verifyInvitationOtp(
    rawToken: string,
    otp: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!rawToken || !otp) {
      throw new BadRequestException('Token and 6-digit OTP code are required');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { invitationTokenHash: tokenHash },
      include: {
        role: true,
        projectMemberships: true,
        ledProjects: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Invitation token is invalid or expired');
    }

    // Check lockout
    if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
      const waitMin = Math.ceil((user.otpLockedUntil.getTime() - Date.now()) / 60000);
      throw new HttpException(`Verification is locked due to too many failed attempts. Try again in ${waitMin} minutes.`, 423);
    }

    // Check expiration
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new BadRequestException('Verification code has expired. Please request a new code.');
    }

    const inputHash = crypto.createHash('sha256').update(otp.trim() + user.id).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(user.otpHash || ''))) {
      const newAttempts = (user.otpAttempts || 0) + 1;
      const isLocked = newAttempts >= 5;
      const lockedUntil = isLocked ? new Date(Date.now() + 30 * 60 * 1000) : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          otpAttempts: newAttempts,
          otpLockedUntil: lockedUntil,
          invitationStatus: isLocked ? 'LOCKED' : user.invitationStatus,
        },
      });

      await this.auditService.log({
        actorId: user.id,
        action: isLocked ? 'INVITATION_OTP_LOCKED' : 'INVITATION_OTP_FAILED',
        entityName: 'User',
        entityId: user.id,
        metadata: { attempts: newAttempts, isLocked },
        ipAddress,
      });

      if (isLocked) {
        throw new HttpException('Too many failed attempts. Verification locked for 30 minutes.', 423);
      }

      throw new BadRequestException(`Invalid verification code. ${5 - newAttempts} attempt(s) remaining.`);
    }

    // OTP Verified! Activate user and issue session
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        invitationTokenHash: null,
        invitationStatus: 'APPROVED',
        approvalStatus: 'APPROVED',
        isActive: true,
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        otpLockedUntil: null,
      },
      include: {
        role: true,
        projectMemberships: true,
        ledProjects: true,
      },
    });

    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day session

    const session = await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: updatedUser.id,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    await this.auditService.log({
      actorId: updatedUser.id,
      action: 'USER_INVITATION_ACCEPTED',
      entityName: 'User',
      entityId: updatedUser.id,
      metadata: { email: updatedUser.email, role: updatedUser.role.code },
      ipAddress,
    });

    let permissions: string[] = [];
    try {
      permissions = JSON.parse(updatedUser.role.permissions);
    } catch {
      permissions = [];
    }

    const ledProjectIds = updatedUser.ledProjects.map((p) => p.id);
    const redirectTo = (updatedUser.role.code === RoleCode.ROLE_LEAD || ledProjectIds.length > 0)
      ? '/lead-dashboard'
      : '/dashboard';

    return {
      session,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        avatarUrl: updatedUser.avatarUrl,
        employeeId: updatedUser.employeeId,
        approvalStatus: updatedUser.approvalStatus,
        roleCode: updatedUser.role.code as RoleCode,
        isActive: updatedUser.isActive,
      },
      permissions,
      ledProjectIds,
      redirectTo,
    };
  }
}
