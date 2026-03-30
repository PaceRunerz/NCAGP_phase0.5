// ─────────────────────────────────────────────────────────────────
// NCAGP — Evidence Module
// File: src/evidence/evidence.module.ts
// ─────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { EvidenceController } from './evidence.controller';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [EvidenceService],
  controllers: [EvidenceController],
})
export class EvidenceModule {}
