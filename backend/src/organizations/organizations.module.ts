// ─────────────────────────────────────────────────────────────────
// NCAGP — Organizations Module
// File: src/organizations/organizations.module.ts
// ─────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [OrganizationsService],
  controllers: [OrganizationsController],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
