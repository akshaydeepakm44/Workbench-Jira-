import { Module } from '@nestjs/common';
import { StandupsService } from './standups.service';
import { StandupsController } from './standups.controller';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  providers: [StandupsService],
  controllers: [StandupsController],
  exports: [StandupsService],
})
export class StandupsModule {}
