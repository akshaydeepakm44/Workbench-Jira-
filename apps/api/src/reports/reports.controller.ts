import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../auth/auth.decorators';
import { Permission, RoleCode } from '@workdesk/shared';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('tasks/csv')
  @RequirePermissions(Permission.EXPORT_TEAM_REPORTS)
  async downloadTasksCsv(
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.exportTasksCsv(user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tasks-report.csv"');
    return res.send(csv);
  }

  @Get('standups/csv')
  @RequirePermissions(Permission.EXPORT_TEAM_REPORTS)
  async downloadStandupsCsv(
    @CurrentUser() user: { id: string; roleCode: RoleCode },
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.exportStandupsCsv(user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="standups-report.csv"');
    return res.send(csv);
  }

  @Get('python-digest')
  @RequirePermissions(Permission.VIEW_ORG_KPIS)
  async runPythonDigest() {
    return this.reportsService.runPythonAnalytics();
  }
}
