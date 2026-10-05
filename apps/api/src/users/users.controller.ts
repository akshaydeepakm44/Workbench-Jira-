import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { RequirePermissions } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permission, RoleCode } from '@workdesk/shared';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsEmail, IsBoolean } from 'class-validator';
import { Request } from 'express';

class UpdateRoleDto {
  @IsEnum(RoleCode)
  roleCode: RoleCode;
}

class ApproveUserDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsOptional()
  @IsEnum(RoleCode)
  roleCode?: RoleCode;

  @IsOptional()
  @IsString()
  teamId?: string;
}

class PromoteLeadDto {
  @IsOptional()
  @IsString()
  teamId?: string;
}

class PreProvisionDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsOptional()
  @IsEnum(RoleCode)
  roleCode?: RoleCode;

  @IsOptional()
  @IsString()
  teamId?: string;
}

class InviteUserDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsBoolean()
  isProjectLead?: boolean;

  @IsOptional()
  @IsBoolean()
  isLead?: boolean;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getUsers(@Query('search') search?: string, @Query('roleCode') roleCode?: RoleCode) {
    return this.usersService.findAll({ search, roleCode });
  }

  @Get('pending-approvals')
  @RequirePermissions(Permission.APPROVE_EMPLOYEES)
  async getPendingApprovals() {
    return this.usersService.findPendingApprovals();
  }

  @Get('invitations')
  @RequirePermissions(Permission.MANAGE_USERS)
  async getInvitations() {
    return this.usersService.getInvitations();
  }

  @Get('projects')
  async getProjects() {
    return this.usersService.getProjects();
  }


  @Post('invite')
  @RequirePermissions(Permission.MANAGE_USERS)
  async inviteUser(
    @Body() dto: InviteUserDto,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.usersService.inviteUser(dto, actor, req.ip);
  }

  @Post('invitations/:id/resend')
  @RequirePermissions(Permission.MANAGE_USERS)
  async resendInvitation(
    @Param('id') id: string,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.usersService.resendInvitation(id, actor, req.ip);
  }

  @Delete('invitations/:id')
  @RequirePermissions(Permission.MANAGE_USERS)
  async revokeInvitation(
    @Param('id') id: string,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.usersService.revokeInvitation(id, actor, req.ip);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_USERS)
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.usersService.deleteUser(id, actor, req.ip);
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.APPROVE_EMPLOYEES)
  async approveUser(
    @Param('id') id: string,
    @Body() dto: ApproveUserDto,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.usersService.approveUser(id, dto, actor, req.ip);
  }

  @Post(':id/promote-lead')
  @RequirePermissions(Permission.PROMOTE_LEADS)
  async promoteLead(
    @Param('id') id: string,
    @Body() dto: PromoteLeadDto,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.usersService.promoteToLead(id, dto, actor, req.ip);
  }

  @Post('pre-provision')
  @RequirePermissions(Permission.APPROVE_EMPLOYEES)
  async preProvision(
    @Body() dto: PreProvisionDto,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.usersService.preProvision(dto, actor, req.ip);
  }

  @Patch(':id/role')
  @RequirePermissions(Permission.MANAGE_USERS)
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.usersService.updateRole(id, dto.roleCode, actor.id, req.ip);
  }

  @Patch(':id/toggle-active')
  @RequirePermissions(Permission.MANAGE_USERS)
  async toggleActive(
    @Param('id') id: string,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.usersService.toggleActive(id, actor.id, req.ip);
  }
}
