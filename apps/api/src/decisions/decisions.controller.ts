import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { DecisionsService } from './decisions.service';
import { SessionGuard } from '../auth/session.guard';
import { PolicyGuard } from '../auth/policy.guard';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission, ProjectDecisionDto, CreateProjectDecisionDto } from '@workdesk/shared';
import { Request } from 'express';

@Controller('decisions')
@UseGuards(SessionGuard, PolicyGuard)
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Post()
  @RequirePermissions(Permission.CREATE_TASK)
  async createDecision(
    @Body() dto: CreateProjectDecisionDto,
    @Req() req: Request,
  ): Promise<ProjectDecisionDto> {
    return this.decisionsService.createDecision(dto, (req as any).user, req.ip);
  }

  @Get('project/:projectId')
  async getProjectDecisions(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ): Promise<ProjectDecisionDto[]> {
    return this.decisionsService.getDecisions(projectId, (req as any).user);
  }

  @Get(':id')
  async getDecision(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<ProjectDecisionDto> {
    return this.decisionsService.getDecision(id, (req as any).user);
  }
}
