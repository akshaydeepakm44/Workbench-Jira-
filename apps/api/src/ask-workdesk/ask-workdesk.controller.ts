import { Controller, Post, Body } from '@nestjs/common';
import { AskWorkdeskService } from './ask-workdesk.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RoleCode, AskWorkdeskQueryDto } from '@workdesk/shared';

@Controller('ask-workdesk')
export class AskWorkdeskController {
  constructor(private readonly askWorkdeskService: AskWorkdeskService) {}

  @Post()
  async ask(
    @Body() dto: AskWorkdeskQueryDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.askWorkdeskService.ask(dto, user);
  }
}
