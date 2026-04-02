// ─────────────────────────────────────────────────────────────────
// NCAGP — Evidence Module
// File: src/evidence/evidence.module.ts
// ─────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EvidenceService } from './evidence.service';
import { EvidenceController } from './evidence.controller';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [PrismaModule, LedgerModule],
  providers: [EvidenceService],
  controllers: [EvidenceController],
})
export class EvidenceModule {}
