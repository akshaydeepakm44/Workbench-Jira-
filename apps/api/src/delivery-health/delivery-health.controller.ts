import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { DeliveryHealthService } from './delivery-health.service';
import { ControlTowerService } from './control-tower.service';
import { SessionGuard } from '../auth/session.guard';
import { PolicyGuard } from '../auth/policy.guard';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission, DeliveryHealthDto, ControlTowerSummaryDto } from '@workdesk/shared';
import { Request } from 'express';

@Controller('delivery-health')
@UseGuards(SessionGuard, PolicyGuard)
export class DeliveryHealthController {
  constructor(
    private readonly healthService: DeliveryHealthService,
    private readonly controlTowerService: ControlTowerService,
  ) {}

  @Get('projects/:projectId')
  @RequirePermissions(Permission.VIEW_OWN_KPIS)
  async getProjectHealth(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ): Promise<DeliveryHealthDto> {
    return this.healthService.evaluateProjectHealth(projectId, (req as any).user);
  }

  @Get('control-tower')
  @RequirePermissions(Permission.VIEW_OWN_KPIS)
  async getControlTowerSummary(@Req() req: Request): Promise<ControlTowerSummaryDto> {
    return this.controlTowerService.getSummary((req as any).user);
  }
}
