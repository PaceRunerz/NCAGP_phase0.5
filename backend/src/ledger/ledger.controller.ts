// ─────────────────────────────────────────────────────────────────
// NCAGP — Ledger Controller
// File: src/ledger/ledger.controller.ts
// ─────────────────────────────────────────────────────────────────

import {
  Controller, Get, Post, Query, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
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
@UseGuards(JwtAuthGuard, RolesGuard)
export class LedgerController {
  constructor(private ledger: LedgerService) {}

  /** Get audit trail for any entity */
  @Get()
  async getEntityHistory(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.ledger.getEntityHistory(entityType, entityId);
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
