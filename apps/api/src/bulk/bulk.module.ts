import { Module } from '@nestjs/common';
import { BulkService } from './bulk.service';
import { BulkController } from './bulk.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TasksModule } from '../tasks/tasks.module';
import { SprintsModule } from '../sprints/sprints.module';

@Module({
  imports: [PrismaModule, TasksModule, SprintsModule],
  controllers: [BulkController],
  providers: [BulkService],
  exports: [BulkService],
})
export class BulkModule {}
