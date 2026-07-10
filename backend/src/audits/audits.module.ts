import { Module } from '@nestjs/common';
import { AuditsController } from './audits.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';   fvdveve
 
@Module({
  imports: [PrismaModule, LedgerModule],
  controllers: [AuditsController],
})
export class AuditsModule {}
