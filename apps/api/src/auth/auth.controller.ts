import { Controller, Post, Get, Body, Req, Res, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Public } from './auth.decorators';
import { CurrentUser } from './current-user.decorator';
import { Request, Response } from 'express';
import { RoleCode } from '@workdesk/shared';
import { IsEmail, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class DevLoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  fullName: string;

  @IsOptional()
  @IsEnum(RoleCode)
  roleCode?: RoleCode;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get('google/url')
  async getGoogleUrl() {
    return this.authService.getGoogleAuthUrl();
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('error') googleError: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:5174';

    if (googleError || !code) {
      const msg = googleError || 'Google authentication was cancelled';
      return res.redirect(`${appUrl}/login?error=${encodeURIComponent(msg)}`);
    }

    try {
      const result = await this.authService.handleGoogleCallback(
        code,
        req.ip,
        req.headers['user-agent'] as string,
      );

      res.cookie('workdesk_session', result.session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: result.session.expiresAt,
        path: '/',
      });

      return res.redirect(`${appUrl}/dashboard`);
    } catch (err: any) {
      console.error('OAuth Callback failure:', err);
      const msg = err.message || 'Authentication failed';
      return res.redirect(`${appUrl}/login?error=${encodeURIComponent(msg)}`);
    }
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: DevLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginOrCreateUser({
      email: dto.email,
      fullName: dto.fullName,
      requestedRole: dto.roleCode,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie('workdesk_session', result.session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: result.session.expiresAt,
      path: '/',
    });

    return {
      user: result.user,
      permissions: result.permissions,
      sessionId: result.session.id,
    };
  }

  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        employeeId: user.employeeId,
        approvalStatus: user.approvalStatus,
        roleCode: user.roleCode,
        roleName: user.roleName,
      },
      permissions: user.permissions,
      ledTeamIds: user.ledTeamIds,
      allTeamIds: user.allTeamIds,
      ledProjectIds: user.ledProjectIds,
      allProjectIds: user.allProjectIds,
    };
  }

  @Post('logout')
  async logout(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = req.cookies?.['workdesk_session'] || req.headers['x-session-id'];
    if (sessionId) {
      await this.authService.logout(sessionId as string, user?.id, req.ip);
    }
    res.clearCookie('workdesk_session', { path: '/' });
    return { success: true };
  }

  // =========================================================================
  // PUBLIC INVITATION & OTP ROUTES
  // =========================================================================
  @Public()
  @Get('invitation/validate')
  async validateInvitation(@Query('token') token: string) {
    return this.authService.validateInvitationToken(token);
  }

  @Public()
  @Post('invitation/request-otp')
  async requestInvitationOtp(@Body('token') token: string, @Req() req: Request) {
    return this.authService.requestInvitationOtp(token, req.ip);
  }

  @Public()
  @Post('invitation/verify-otp')
  async verifyInvitationOtp(
    @Body('token') token: string,
    @Body('otp') otp: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyInvitationOtp(
      token,
      otp,
      req.ip,
      req.headers['user-agent'] as string,
    );

    res.cookie('workdesk_session', result.session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: result.session.expiresAt,
      path: '/',
    });

    return {
      success: true,
      user: result.user,
      permissions: result.permissions,
      ledProjectIds: result.ledProjectIds,
      sessionId: result.session.id,
      redirectTo: result.redirectTo,
    };
  }
}
