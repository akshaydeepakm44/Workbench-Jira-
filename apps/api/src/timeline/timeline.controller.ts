import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { SessionGuard } from '../auth/session.guard';
import { PolicyGuard } from '../auth/policy.guard';
import {
  TimelineResponseDto,
  TimelineTaskDto,
  RescheduleTaskDto,
} from '@workdesk/shared';
import { Request } from 'express';

@Controller('timeline')
@UseGuards(SessionGuard, PolicyGuard)
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get('projects/:projectId')
  async getProjectTimeline(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ): Promise<TimelineResponseDto> {
    return this.timelineService.getProjectTimeline(projectId, (req as any).user);
  }

  @Patch('tasks/:ticketId/reschedule')
  async rescheduleTask(
    @Param('ticketId') ticketId: string,
    @Body() dto: RescheduleTaskDto,
    @Req() req: Request,
  ): Promise<TimelineTaskDto> {
    return this.timelineService.rescheduleTask(
      ticketId,
      dto,
      (req as any).user,
      req.ip,
    );
  }
}
