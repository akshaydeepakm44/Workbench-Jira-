import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission } from '@workdesk/shared';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getProjects() {
    return this.usersService.getProjects();
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_PROJECTS)
  async createProject(
    @Body() dto: { name: string; key: string; description?: string },
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.usersService.createProject(dto, actor, req.ip);
  }
}
