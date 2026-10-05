import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Ip,
} from '@nestjs/common';
import { SprintsService } from './sprints.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../auth/auth.decorators';
import {
  Permission,
  RoleCode,
  CreateSprintDto,
  UpdateSprintDto,
  StartSprintDto,
  CompleteSprintDto,
} from '@workdesk/shared';

@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Post()
  @RequirePermissions(Permission.MANAGE_SPRINTS)
  async createSprint(
    @Body() dto: CreateSprintDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.sprintsService.createSprint(dto, user, ipAddress);
  }

  @Get('projects/:projectId')
  @RequirePermissions(Permission.VIEW_TEAM_TASKS)
  async getProjectSprints(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.sprintsService.getProjectSprints(projectId, user);
  }

  @Get(':sprintId')
  @RequirePermissions(Permission.VIEW_TEAM_TASKS)
  async getSprintById(
    @Param('sprintId') sprintId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.sprintsService.getSprintById(sprintId, user);
  }

  @Patch(':sprintId')
  @RequirePermissions(Permission.MANAGE_SPRINTS)
  async updateSprint(
    @Param('sprintId') sprintId: string,
    @Body() dto: UpdateSprintDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.sprintsService.updateSprint(sprintId, dto, user, ipAddress);
  }

  @Post(':sprintId/start')
  @RequirePermissions(Permission.MANAGE_SPRINTS)
  async startSprint(
    @Param('sprintId') sprintId: string,
    @Body() dto: StartSprintDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.sprintsService.startSprint(sprintId, dto, user, ipAddress);
  }

  @Post(':sprintId/complete')
  @RequirePermissions(Permission.MANAGE_SPRINTS)
  async completeSprint(
    @Param('sprintId') sprintId: string,
    @Body() dto: CompleteSprintDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.sprintsService.completeSprint(sprintId, dto, user, ipAddress);
  }

  @Post(':sprintId/cancel')
  @RequirePermissions(Permission.MANAGE_SPRINTS)
  async cancelSprint(
    @Param('sprintId') sprintId: string,
    @Body() dto: { reason?: string },
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.sprintsService.cancelSprint(sprintId, dto, user, ipAddress);
  }

  @Post(':sprintId/tasks')
  @RequirePermissions(Permission.MANAGE_SPRINTS)
  async addTasksToSprint(
    @Param('sprintId') sprintId: string,
    @Body('ticketIds') ticketIds: string[],
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.sprintsService.addTasksToSprint(sprintId, ticketIds, user, ipAddress);
  }

  @Delete(':sprintId/tasks/:ticketId')
  @RequirePermissions(Permission.MANAGE_SPRINTS)
  async removeTaskFromSprint(
    @Param('sprintId') sprintId: string,
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.sprintsService.removeTaskFromSprint(sprintId, ticketId, user, ipAddress);
  }
}
