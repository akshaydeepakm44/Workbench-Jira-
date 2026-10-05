import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { BulkService } from './bulk.service';
import { SessionGuard } from '../auth/session.guard';
import { PolicyGuard } from '../auth/policy.guard';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission, BulkOperationDto, BulkOperationResponseDto } from '@workdesk/shared';
import { Request } from 'express';

@Controller('bulk')
@UseGuards(SessionGuard, PolicyGuard)
export class BulkController {
  constructor(private readonly bulkService: BulkService) {}

  @Post('tasks')
  @RequirePermissions(Permission.UPDATE_TASK)
  async executeBulk(
    @Body() dto: BulkOperationDto,
    @Req() req: Request,
  ): Promise<BulkOperationResponseDto> {
    return this.bulkService.executeBulk(dto, (req as any).user, req.ip);
  }
}
