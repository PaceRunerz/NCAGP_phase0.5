// ─────────────────────────────────────────────────────────────────
// NCAGP — Ledger Controller
// File: src/ledger/ledger.controller.ts
// ─────────────────────────────────────────────────────────────────

import {
  Controller, Get, Post, Query, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard, RolesGuard, OrgScopeGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { IsOptional, IsDateString } from 'class-validator';

class VerifyChainDto {
  @IsOptional()
  @IsDateString()
  fromTimestamp?: string;

  @IsOptional()
  @IsDateString()
  toTimestamp?: string;
}

@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class LedgerController {
  constructor(private ledger: LedgerService) {}

  /**
   * Get audit trail for any entity. Previously had no @Roles and no
   * org-scoping at all (see the fix note in ledger.service.ts) — now
   * restricted to the roles that legitimately need ledger access
   * (matches CAN.accessLedger on the frontend, plus AUDITOR/
   * VENDOR_ADMIN who need to see their own audits' trails), and scoped
   * server-side regardless of what the frontend sends.
   */
  @Get()
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async getEntityHistory(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @CurrentUser() user: any,
  ) {
    return this.ledger.getEntityHistory(entityType, entityId, user.orgId, user.role);
  }

  /** Verify chain integrity — NIC_ADMIN only */
  @Post('verify-chain')
  @HttpCode(HttpStatus.OK)
  @Roles('NIC_ADMIN')
  async verifyChain(@Body() dto: VerifyChainDto) {
    return this.ledger.verifyChainIntegrity(
      dto.fromTimestamp ? new Date(dto.fromTimestamp) : undefined,
      dto.toTimestamp ? new Date(dto.toTimestamp) : undefined,
    );
  }
}
