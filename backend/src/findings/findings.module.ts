// ─────────────────────────────────────────────────────────────────
// NCAGP — Findings Module
// File: src/findings/findings.module.ts
// ─────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { FindingsService } from './findings.service';
import { FindingsController } from './findings.controller';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [FindingsService],
  controllers: [FindingsController],
  exports: [FindingsService],
})
export class FindingsModule {}
