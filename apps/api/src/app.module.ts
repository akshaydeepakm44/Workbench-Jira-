import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { TasksModule } from './tasks/tasks.module';
import { StandupsModule } from './standups/standups.module';
import { MeetingsModule } from './meetings/meetings.module';
import { KpisModule } from './kpis/kpis.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { SprintsModule } from './sprints/sprints.module';
import { BoardsModule } from './boards/boards.module';
import { WorkloadModule } from './workload/workload.module';
import { TimelineModule } from './timeline/timeline.module';
import { CalendarModule } from './calendar/calendar.module';
import { AccountabilityModule } from './accountability/accountability.module';
import { DeliveryHealthModule } from './delivery-health/delivery-health.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SearchModule } from './search/search.module';
import { BulkModule } from './bulk/bulk.module';
import { DecisionsModule } from './decisions/decisions.module';
import { AutomationModule } from './automation/automation.module';
import { AskWorkdeskModule } from './ask-workdesk/ask-workdesk.module';
import { SessionGuard } from './auth/session.guard';
import { PolicyGuard } from './auth/policy.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    HealthModule,
    TasksModule,
    SprintsModule,
    BoardsModule,
    WorkloadModule,
    TimelineModule,
    CalendarModule,
    AccountabilityModule,
    DeliveryHealthModule,
    AnalyticsModule,
    SearchModule,
    BulkModule,
    DecisionsModule,
    AutomationModule,
    AskWorkdeskModule,
    StandupsModule,
    MeetingsModule,
    KpisModule,
    NotificationsModule,
    ReportsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PolicyGuard,
    },
  ],
})
export class AppModule {}
