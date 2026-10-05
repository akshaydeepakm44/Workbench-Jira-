import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Ip,
} from '@nestjs/common';
import { MeetingsService, CreateMeetingDto } from './meetings.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission, RoleCode } from '@workdesk/shared';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  async getMeetings(@CurrentUser() user: { id: string; roleCode: RoleCode }) {
    return this.meetingsService.getMeetingsForUser(user);
  }

  @Post('instant')
  @RequirePermissions(Permission.CREATE_MEETING)
  async createInstantMeeting(
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.meetingsService.createInstantMeeting(user, ipAddress);
  }

  @Post('schedule')
  @RequirePermissions(Permission.CREATE_MEETING)
  async createScheduledMeeting(
    @Body() dto: CreateMeetingDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.meetingsService.createScheduledMeeting(dto, user, ipAddress);
  }

  @Get(':id/workspace')
  async getMeetingWorkspace(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.meetingsService.getMeetingWorkspace(id, user);
  }

  @Post(':id/agenda')
  async addAgendaItem(@Param('id') id: string, @Body('topic') topic: string) {
    return this.meetingsService.addAgendaItem(id, topic);
  }

  @Post(':id/decisions')
  async addDecision(@Param('id') id: string, @Body('description') description: string) {
    return this.meetingsService.addDecision(id, description);
  }

  @Post(':id/action-items')
  async addActionItem(
    @Param('id') id: string,
    @Body() body: { description: string; assigneeId?: string; dueDate?: string },
  ) {
    return this.meetingsService.addActionItem(id, body.description, body.assigneeId, body.dueDate);
  }

  @Post(':id/action-items/:actionId/convert')
  @RequirePermissions(Permission.CONVERT_ACTION_TASK)
  async convertActionItemToTask(
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.meetingsService.convertActionItemToTask(id, actionId, user);
  }
}
