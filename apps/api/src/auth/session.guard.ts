import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_KEY } from './auth.decorators';
import { ROLE_PERMISSIONS, RoleCode } from '@workdesk/shared';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const sessionId = request.cookies?.['workdesk_session'] || request.headers['x-session-id'];

    if (!sessionId) {
      throw new UnauthorizedException('Authentication required');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            role: true,
            teamMemberships: true,
            ledTeams: true,
            projectMemberships: true,
            ledProjects: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    let parsedPermissions: string[] = [];
    try {
      parsedPermissions = JSON.parse(session.user.role.permissions);
    } catch {
      parsedPermissions = [];
    }

    // Self-healing fallback: if DB permissions are stale/empty, use authoritative code-side list
    const roleCode = session.user.role.code as RoleCode;
    const codePerms: string[] = ROLE_PERMISSIONS[roleCode] ?? [];
    if (codePerms.length > 0 && parsedPermissions.length < codePerms.length) {
      parsedPermissions = codePerms as string[];
    }

    const ledTeamIds = [
      ...session.user.ledTeams.map((t) => t.id),
      ...session.user.teamMemberships.filter((tm) => tm.roleInTeam === 'LEAD').map((tm) => tm.teamId),
    ];

    const ledProjectIds = [
      ...session.user.ledProjects.map((p) => p.id),
      ...session.user.projectMemberships.filter((pm) => pm.roleInProject === 'LEAD').map((pm) => pm.projectId),
    ];

    const url = request.originalUrl || request.url;
    const isMeOrLogout = url.includes('/api/v1/auth/me') || url.includes('/api/v1/auth/logout');

    if (session.user.approvalStatus !== 'APPROVED' && !isMeOrLogout) {
      throw new UnauthorizedException('Account awaiting Manager approval and Employee ID assignment');
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      avatarUrl: session.user.avatarUrl,
      employeeId: session.user.employeeId,
      approvalStatus: session.user.approvalStatus,
      roleCode: session.user.role.code,
      roleName: session.user.role.name,
      permissions: parsedPermissions,
      ledTeamIds,
      allTeamIds: session.user.teamMemberships.map((tm) => tm.teamId),
      ledProjectIds,
      allProjectIds: session.user.projectMemberships.map((pm) => pm.projectId),
      sessionId: session.id,
    };

    return true;
  }
}
