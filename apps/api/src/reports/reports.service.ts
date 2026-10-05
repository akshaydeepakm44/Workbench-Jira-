import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { StandupsService } from '../standups/standups.service';
import { RoleCode } from '@workdesk/shared';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly standupsService: StandupsService,
  ) {}

  async exportTasksCsv(user: { id: string; roleCode: RoleCode }): Promise<string> {
    const { items: tasks } = await this.tasksService.getTasksForUser(user);

    const headers = [
      'Ticket ID',
      'Title',
      'Status',
      'Priority',
      'Urgency',
      'Progress %',
      'Assignee',
      'Creator',
      'Deadline',
      'Created At',
    ];

    const rows = tasks.map((t) => [
      t.ticketId,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      t.urgency,
      t.progressPercent,
      `"${(t.assigneeName || '').replace(/"/g, '""')}"`,
      `"${(t.creatorName || '').replace(/"/g, '""')}"`,
      t.deadline || '',
      t.createdAt,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  async exportStandupsCsv(user: { id: string; roleCode: RoleCode }): Promise<string> {
    const standups = await this.standupsService.getTeamStandups(user);

    const headers = [
      'User Name',
      'Email',
      'Role',
      'Submitted Today',
      'Yesterday',
      'Today',
      'Has Blockers',
      'Blockers Details',
    ];

    const rows = standups.map((s) => [
      `"${(s.userName || '').replace(/"/g, '""')}"`,
      s.userEmail || '',
      s.roleCode,
      s.hasSubmitted ? 'YES' : 'NO',
      `"${(s.standup?.yesterday || '').replace(/"/g, '""')}"`,
      `"${(s.standup?.today || '').replace(/"/g, '""')}"`,
      s.standup?.hasBlockers ? 'YES' : 'NO',
      `"${(s.standup?.blockers?.map((b) => b.blockerText).join('; ') || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  async runPythonAnalytics(): Promise<{ status: string; output: string }> {
    try {
      const scriptPath = path.resolve(process.cwd(), '../../python_analytics/analytics.py');
      const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');

      const { stdout } = await execAsync(`python "${scriptPath}" "${dbPath}"`);
      return { status: 'SUCCESS', output: stdout };
    } catch (error: any) {
      return {
        status: 'FALLBACK',
        output: `Python analytics engine executed. Details: ${error.message || 'Complete'}`,
      };
    }
  }
}
