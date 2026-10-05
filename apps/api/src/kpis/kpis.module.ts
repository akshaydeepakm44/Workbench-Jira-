import { Module } from '@nestjs/common';
import { KpisService } from './kpis.service';
import { KpisController } from './kpis.controller';

@Module({
  providers: [KpisService],
  controllers: [KpisController],
  exports: [KpisService],
})
export class KpisModule {}
