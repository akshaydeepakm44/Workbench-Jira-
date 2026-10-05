import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Ip,
} from '@nestjs/common';
import { BoardsService } from './boards.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../auth/auth.decorators';
import {
  Permission,
  RoleCode,
  CreateBoardDto,
  MoveBoardCardDto,
  TaskFilterDto,
} from '@workdesk/shared';

@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get('projects/:projectId')
  @RequirePermissions(Permission.VIEW_TEAM_TASKS)
  async getProjectBoards(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.boardsService.getProjectBoards(projectId, user);
  }

  @Get(':boardId')
  @RequirePermissions(Permission.VIEW_TEAM_TASKS)
  async getBoardById(
    @Param('boardId') boardId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
  ) {
    return this.boardsService.getBoardById(boardId, user);
  }

  @Get(':boardId/tasks')
  @RequirePermissions(Permission.VIEW_TEAM_TASKS)
  async getBoardTasks(
    @Param('boardId') boardId: string,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Query('sprintId') sprintId?: string,
    @Query('types') types?: string,
    @Query('priorities') priorities?: string,
    @Query('assigneeIds') assigneeIds?: string,
  ) {
    const filter: TaskFilterDto = {
      sprintId,
      types: types ? (types.split(',') as any) : undefined,
      priorities: priorities ? (priorities.split(',') as any) : undefined,
      assigneeIds: assigneeIds ? assigneeIds.split(',') : undefined,
    };
    return this.boardsService.getBoardTasks(boardId, filter, user);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_BOARDS)
  async createBoard(
    @Body() dto: CreateBoardDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.boardsService.createBoard(dto, user, ipAddress);
  }

  @Post(':boardId/tasks/:ticketId/move')
  @RequirePermissions(Permission.TRANSITION_TASK)
  async moveBoardCard(
    @Param('boardId') boardId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: MoveBoardCardDto,
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Ip() ipAddress: string,
  ) {
    return this.boardsService.moveBoardCard(boardId, ticketId, dto, user, ipAddress);
  }
}
