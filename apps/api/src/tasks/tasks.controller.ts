import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Ip,
} from '@nestjs/common';
import {
  TasksService,
  CreateTaskDto,
  UpdateTaskDto,
  TransitionTaskDto,
  CreateCriterionDto,
  UpdateCriterionDto,
  CreateEvidenceDto,
  CreateDependencyDto,
  GetTasksQueryDto,
} from './tasks.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission, RoleCode } from '@workdesk/shared';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermissions(Permission.VIEW_OWN_TASKS)
  async getTasks(
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Query() query: GetTasksQueryDto,
  ) {
    return this.tasksService.getTasksForUser(user, query);
  }

  // =========================================================================
  // BACKLOG & REORDERING
  // =========================================================================
  @Get('projects/:projectId/backlog')
  @RequirePermissions(Permission.VIEW_TEAM_TASKS)
  async getProjectBacklog(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
    @Query('priority') priority?: string,
  ) {
    return this.tasksService.getProjectBacklog(projectId, user, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      type,
      priority,
    });
  }

  @Patch('projects/:projectId/backlog/reorder')
  @RequirePermissions(Permission.MANAGE_BACKLOG)
  async reorderBacklog(
    @Param('projectId') projectId: string,
    @Body() dto: { ticketId: string; targetRankAbove?: string; targetRankBelow?: string },
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.reorderBacklog(projectId, dto, user, ipAddress);
  }

  @Get(':ticketId')
  @RequirePermissions(Permission.VIEW_OWN_TASKS)
  async getTask(
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.tasksService.getTaskById(ticketId, user);
  }

  @Post()
  @RequirePermissions(Permission.CREATE_TASK)
  async createTask(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.createTask(dto, user, ipAddress);
  }

  @Patch(':ticketId')
  @RequirePermissions(Permission.UPDATE_TASK)
  async updateTask(
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.updateTask(ticketId, dto, user, ipAddress);
  }

  // =========================================================================
  // DEDICATED DOMAIN TRANSITION COMMAND
  // =========================================================================
  @Post(':ticketId/transition')
  @RequirePermissions(Permission.TRANSITION_TASK)
  async transitionTask(
    @Param('ticketId') ticketId: string,
    @Body() dto: TransitionTaskDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.transitionTask(ticketId, dto, user, ipAddress);
  }

  @Post(':ticketId/reparent')
  @RequirePermissions(Permission.REPARENT_TASK)
  async reparentTask(
    @Param('ticketId') ticketId: string,
    @Body('newParentTicketId') newParentTicketId: string | null,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.reparentTask(ticketId, newParentTicketId, user, ipAddress);
  }

  // =========================================================================
  // ACCEPTANCE CRITERIA
  // =========================================================================
  @Post(':ticketId/criteria')
  @RequirePermissions(Permission.MANAGE_ACCEPTANCE_CRITERIA)
  async addCriterion(
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateCriterionDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.addCriterion(ticketId, dto, user, ipAddress);
  }

  @Patch('criteria/:criterionId')
  @RequirePermissions(Permission.MANAGE_ACCEPTANCE_CRITERIA)
  async updateCriterion(
    @Param('criterionId') criterionId: string,
    @Body() dto: UpdateCriterionDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.updateCriterion(criterionId, dto, user, ipAddress);
  }

  @Post('criteria/:criterionId/toggle')
  @RequirePermissions(Permission.MANAGE_ACCEPTANCE_CRITERIA)
  async toggleCriterion(
    @Param('criterionId') criterionId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.toggleCriterion(criterionId, user, ipAddress);
  }

  @Delete('criteria/:criterionId')
  @RequirePermissions(Permission.MANAGE_ACCEPTANCE_CRITERIA)
  async deleteCriterion(
    @Param('criterionId') criterionId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.deleteCriterion(criterionId, user, ipAddress);
  }

  // =========================================================================
  // GUIDANCE POINTS
  // =========================================================================
  @Post(':ticketId/guidance')
  @RequirePermissions(Permission.ADD_TASK_POINT)
  async addGuidancePoint(
    @Param('ticketId') ticketId: string,
    @Body('content') content: string,
    @Body('isRequired') isRequired: boolean,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.addGuidancePoint(ticketId, content, isRequired || false, user, ipAddress);
  }

  @Post('guidance/:pointId/toggle')
  @RequirePermissions(Permission.TOGGLE_TASK_POINT)
  async toggleGuidancePoint(
    @Param('pointId') pointId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.toggleGuidancePoint(pointId, user, ipAddress);
  }

  @Delete('guidance/:pointId')
  @RequirePermissions(Permission.ADD_TASK_POINT)
  async deleteGuidancePoint(
    @Param('pointId') pointId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.tasksService.deleteGuidancePoint(pointId, user);
  }

  // Backward compatibility alias for legacy points endpoint
  @Post(':ticketId/points')
  @RequirePermissions(Permission.ADD_TASK_POINT)
  async legacyAddPoint(
    @Param('ticketId') ticketId: string,
    @Body('content') content: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.addGuidancePoint(ticketId, content, false, user, ipAddress);
  }

  @Patch('points/:pointId/toggle')
  @RequirePermissions(Permission.TOGGLE_TASK_POINT)
  async legacyTogglePoint(
    @Param('pointId') pointId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.toggleGuidancePoint(pointId, user, ipAddress);
  }

  // =========================================================================
  // WORK EVIDENCE
  // =========================================================================
  @Post(':ticketId/evidence')
  @RequirePermissions(Permission.ADD_WORK_EVIDENCE)
  async addEvidence(
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateEvidenceDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.addEvidence(ticketId, dto, user, ipAddress);
  }

  @Delete('evidence/:evidenceId')
  @RequirePermissions(Permission.ADD_WORK_EVIDENCE)
  async deleteEvidence(
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.deleteEvidence(evidenceId, user, ipAddress);
  }

  // =========================================================================
  // DEPENDENCIES
  // =========================================================================
  @Post(':ticketId/dependencies')
  @RequirePermissions(Permission.MANAGE_DEPENDENCIES)
  async addDependency(
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateDependencyDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.addDependency(ticketId, dto, user, ipAddress);
  }

  @Delete('dependencies/:dependencyId')
  @RequirePermissions(Permission.MANAGE_DEPENDENCIES)
  async removeDependency(
    @Param('dependencyId') dependencyId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.tasksService.removeDependency(dependencyId, user, ipAddress);
  }

  // =========================================================================
  // COMMENTS
  // =========================================================================
  @Post(':ticketId/comments')
  @RequirePermissions(Permission.VIEW_OWN_TASKS)
  async addComment(
    @Param('ticketId') ticketId: string,
    @Body('content') content: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.tasksService.addComment(ticketId, content, user);
  }
}
