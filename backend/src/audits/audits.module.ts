import { Module } from '@nestjs/common';
import { AuditsController } from './audits.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [PrismaModule, LedgerModule, ReportsModule],
  controllers: [AuditsController],
})
export class AuditsModule {}
