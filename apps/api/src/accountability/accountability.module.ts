import { Module } from '@nestjs/common';
import { AccountabilityService } from './accountability.service';
import { AccountabilityController } from './accountability.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AccountabilityController],
  providers: [AccountabilityService],
  exports: [AccountabilityService],
})
export class AccountabilityModule {}
