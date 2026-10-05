import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission } from '@workdesk/shared';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @RequirePermissions(Permission.VIEW_AUDIT_LOGS)
  async getAuditLogs(@Query('limit') limit?: string) {
    const take = limit ? parseInt(limit, 10) : 100;
    return this.auditService.getAuditLogs(take);
  }
}
