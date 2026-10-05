import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { WorkloadService } from './workload.service';
import { SessionGuard } from '../auth/session.guard';
import { PolicyGuard } from '../auth/policy.guard';
import { RequirePermissions } from '../auth/auth.decorators';
import {
  Permission,
  SetUserCapacityDto,
  UserCapacityDto,
  UserWorkloadDto,
  TeamWorkloadDto,
  ProjectWorkloadDto,
} from '@workdesk/shared';
import { Request } from 'express';

@Controller('workload')
@UseGuards(SessionGuard, PolicyGuard)
export class WorkloadController {
  constructor(private readonly workloadService: WorkloadService) {}

  @Get('user/:userId')
  async getUserWorkload(
    @Param('userId') userId: string,
    @Req() req: Request,
  ): Promise<UserWorkloadDto> {
    return this.workloadService.getUserWorkload(userId, (req as any).user);
  }

  @Get('user/:userId/capacity')
  async getUserCapacity(
    @Param('userId') userId: string,
  ): Promise<UserCapacityDto> {
    return this.workloadService.getUserCapacity(userId);
  }

  @Post('user/:userId/capacity')
  @RequirePermissions(Permission.MANAGE_CAPACITY)
  async setUserCapacity(
    @Param('userId') userId: string,
    @Body() dto: SetUserCapacityDto,
    @Req() req: Request,
  ): Promise<UserCapacityDto> {
    return this.workloadService.setUserCapacity(
      userId,
      dto,
      (req as any).user,
      req.ip,
    );
  }

  @Get('team/:teamId')
  async getTeamWorkload(
    @Param('teamId') teamId: string,
    @Req() req: Request,
  ): Promise<TeamWorkloadDto> {
    return this.workloadService.getTeamWorkload(teamId, (req as any).user);
  }

  @Get('project/:projectId')
  async getProjectWorkload(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ): Promise<ProjectWorkloadDto> {
    return this.workloadService.getProjectWorkload(projectId, (req as any).user);
  }
}
