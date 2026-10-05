import { Controller, Get } from '@nestjs/common';
import { KpisService } from './kpis.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission, RoleCode } from '@workdesk/shared';

@Controller('kpis')
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Get('summary')
  @RequirePermissions(Permission.VIEW_OWN_KPIS)
  async getSummary(@CurrentUser() user: { id: string; roleCode: RoleCode }) {
    return this.kpisService.getKpisForUser(user);
  }
}
