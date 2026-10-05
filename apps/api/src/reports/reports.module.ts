import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { TasksModule } from '../tasks/tasks.module';
import { StandupsModule } from '../standups/standups.module';

@Module({
  imports: [TasksModule, StandupsModule],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
