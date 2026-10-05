import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { AutomationService } from './automation.service';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  RoleCode,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from '@workdesk/shared';
import { Request } from 'express';

@Controller('automation/rules')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post()
  async createRule(
    @Body() dto: CreateAutomationRuleDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Req() req: Request,
  ) {
    return this.automationService.createRule(dto, user, req.ip);
  }

  @Get('project/:projectId')
  async getRules(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.automationService.getRules(projectId, user);
  }

  @Patch(':id')
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateAutomationRuleDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Req() req: Request,
  ) {
    return this.automationService.updateRule(id, dto, user, req.ip);
  }

  @Delete(':id')
  async deleteRule(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Req() req: Request,
  ) {
    return this.automationService.deleteRule(id, user, req.ip);
  }

  @Get(':id/logs')
  async getExecutionLogs(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.automationService.getExecutionLogs(id, user);
  }
}
