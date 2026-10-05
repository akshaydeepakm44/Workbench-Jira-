import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Ip,
  UseGuards,
} from '@nestjs/common';
import { StandupsService, SubmitStandupDto } from './standups.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission, RoleCode } from '@workdesk/shared';

@Controller('standups')
export class StandupsController {
  constructor(private readonly standupsService: StandupsService) {}

  @Post()
  @RequirePermissions(Permission.VIEW_OWN_STANDUPS)
  async submitStandup(
    @Body() dto: SubmitStandupDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.standupsService.submitStandup(dto, user, ipAddress);
  }

  @Get('my-today')
  @RequirePermissions(Permission.VIEW_OWN_STANDUPS)
  async getMyToday(@CurrentUser() user: { id: string }) {
    return this.standupsService.getMyToday(user.id);
  }

  @Get('my-history')
  @RequirePermissions(Permission.VIEW_OWN_STANDUPS)
  async getMyHistory(@CurrentUser() user: { id: string }) {
    return this.standupsService.getMyHistory(user.id);
  }

  @Get('team')
  @RequirePermissions(Permission.VIEW_TEAM_STANDUPS)
  async getTeamStandups(@CurrentUser() user: { id: string; roleCode: RoleCode }) {
    return this.standupsService.getTeamStandups(user);
  }

  @Post('blockers/:id/convert')
  @RequirePermissions(Permission.CONVERT_BLOCKER_TASK)
  async convertBlockerToTask(
    @Param('id') blockerId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.standupsService.convertBlockerToTask(blockerId, user);
  }
}
