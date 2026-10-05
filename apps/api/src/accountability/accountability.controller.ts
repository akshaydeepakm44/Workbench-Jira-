import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AccountabilityService } from './accountability.service';
import { SessionGuard } from '../auth/session.guard';
import { PolicyGuard } from '../auth/policy.guard';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission, AccountabilityMetricsDto } from '@workdesk/shared';
import { Request } from 'express';

@Controller('accountability')
@UseGuards(SessionGuard, PolicyGuard)
export class AccountabilityController {
  constructor(private readonly accountabilityService: AccountabilityService) {}

  @Get('metrics')
  @RequirePermissions(Permission.VIEW_OWN_KPIS)
  async getMetrics(
    @Query('projectId') projectId: string | undefined,
    @Query('windowDays') windowDays: number | undefined,
    @Req() req: Request,
  ): Promise<AccountabilityMetricsDto> {
    return this.accountabilityService.getMetrics(
      { projectId, windowDays },
      (req as any).user,
    );
  }
}
