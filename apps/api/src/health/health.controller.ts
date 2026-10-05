import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'workdesk-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('liveness')
  getLiveness() {
    return {
      status: 'ok',
      service: 'workdesk-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('readiness')
  async getReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
