import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEventParams {
  actorId?: string;
  action: string;
  entityName: string;
  entityId: string;
  metadata?: any;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditEventParams) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          action: params.action,
          entityName: params.entityName,
          entityId: params.entityId,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
          ipAddress: params.ipAddress,
        },
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  async getAuditLogs(take = 100) {
    const logs = await this.prisma.auditLog.findMany({
      include: {
        actor: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return logs.map((l) => ({
      ...l,
      actorName: l.actor?.fullName || 'System',
      actorEmail: l.actor?.email,
      createdAt: l.createdAt.toISOString(),
    }));
  }
}
