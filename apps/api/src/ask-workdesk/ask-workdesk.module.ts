import { Module } from '@nestjs/common';
import { AskWorkdeskService } from './ask-workdesk.service';
import { AskWorkdeskController } from './ask-workdesk.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AskWorkdeskController],
  providers: [AskWorkdeskService],
  exports: [AskWorkdeskService],
})
export class AskWorkdeskModule {}
