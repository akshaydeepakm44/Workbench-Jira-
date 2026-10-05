import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { SessionGuard } from '../auth/session.guard';
import { PolicyGuard } from '../auth/policy.guard';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission, AdvancedAnalyticsDto } from '@workdesk/shared';
import { Request } from 'express';

@Controller('analytics')
@UseGuards(SessionGuard, PolicyGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('advanced')
  @RequirePermissions(Permission.VIEW_OWN_KPIS)
  async getAdvancedAnalytics(
    @Query('projectId') projectId: string | undefined,
    @Query('windowDays') windowDays: number | undefined,
    @Req() req: Request,
  ): Promise<AdvancedAnalyticsDto> {
    return this.analyticsService.getAdvancedAnalytics(
      { projectId, windowDays },
      (req as any).user,
    );
  }
}
