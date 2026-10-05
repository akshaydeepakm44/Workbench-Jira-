import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { SessionGuard } from '../auth/session.guard';
import { PolicyGuard } from '../auth/policy.guard';
import { CalendarEventDto, CalendarQueryDto } from '@workdesk/shared';
import { Request } from 'express';

@Controller('calendar')
@UseGuards(SessionGuard, PolicyGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  async getCalendarEvents(
    @Query() query: CalendarQueryDto,
    @Req() req: Request,
  ): Promise<CalendarEventDto[]> {
    return this.calendarService.getCalendarEvents(query, (req as any).user);
  }
}
