import { Module } from '@nestjs/common';
import { DeliveryHealthService } from './delivery-health.service';
import { ControlTowerService } from './control-tower.service';
import { DeliveryHealthController } from './delivery-health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TimelineModule } from '../timeline/timeline.module';
import { WorkloadModule } from '../workload/workload.module';

@Module({
  imports: [PrismaModule, TimelineModule, WorkloadModule],
  controllers: [DeliveryHealthController],
  providers: [DeliveryHealthService, ControlTowerService],
  exports: [DeliveryHealthService, ControlTowerService],
})
export class DeliveryHealthModule {}
