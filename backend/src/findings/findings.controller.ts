// ─────────────────────────────────────────────────────────────────
// NCAGP — Findings Controller
// File: src/findings/findings.controller.ts
// ─────────────────────────────────────────────────────────────────

import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FindingsService } from './findings.service';
import { JwtAuthGuard, RolesGuard, OrgScopeGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { Severity, FindingStatus } from '@prisma/client';
import {
  IsString, IsEnum, IsOptional, IsUUID, MinLength,
} from 'class-validator';
import { Request } from 'express';

// ── DTOs ──────────────────────────────────────────────────────

class CreateFindingDto {
  @IsUUID() auditId: string;
  @IsUUID() orgId: string;
  @IsOptional() @IsUUID() assetId?: string;
  @IsOptional() @IsUUID() controlId?: string;
  @IsEnum(Severity) severity: Severity;
  @IsString() @MinLength(5) title: string;
  @IsString() description: string;
  @IsOptional() @IsString() rootCause?: string;
  @IsOptional() @IsString() recommendation?: string;
  @IsOptional() @IsString() technicalDetail?: string;
}

class TransitionFindingDto {
  @IsEnum(FindingStatus) newStatus: FindingStatus;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsString() closureJustification?: string;
}

// ── Controller ────────────────────────────────────────────────

@Controller('findings')
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class FindingsController {
  constructor(private findingsService: FindingsService) {}

  /** National risk heatmap — NIC_ADMIN + DEPT_CISO */
  @Get('risk-heatmap')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async getRiskHeatmap() {
    return this.findingsService.getRiskHeatmap();
  }

  /** List findings with filters */
  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('orgId') orgId?: string,
    @Query('severity') severity?: Severity,
    @Query('status') status?: FindingStatus,
    @Query('auditId') auditId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.findingsService.findAll({
      orgId,
      requestingUserId: user.id,
      requestingUserRole: user.role,
      requestingUserOrgId: user.orgId,
      requestingUserDataScope: user.dataAccessScope,
      severity,
      status,
      auditId,
      page,
      limit,
    });
  }

  /** Create a new finding */
  @Post()
  @Roles('NIC_ADMIN', 'AUDITOR', 'VENDOR_ADMIN')
  async create(
    @Body() dto: CreateFindingDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.findingsService.create({
      ...dto,
      createdById: user.id,
      ipAddress: req.ip || 'unknown',
    });
  }

  /** Get full audit history for a finding */
  @Get(':id/history')
  async getHistory(@Param('id') id: string, @CurrentUser() user: any) {
    // Delegate to ledger service via findings service
    return this.findingsService.findAll({
      requestingUserId: user.id,
      requestingUserRole: user.role,
      requestingUserOrgId: user.orgId,
      requestingUserDataScope: user.dataAccessScope,
      auditId: id,
    });
  }

  /** State machine transition */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async transition(
    @Param('id') findingId: string,
    @Body() dto: TransitionFindingDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.findingsService.transition({
      findingId,
      newStatus: dto.newStatus,
      comment: dto.comment,
      closureJustification: dto.closureJustification,
      requestedById: user.id,
      requestedByRole: user.role,
      orgId: user.orgId,
      ipAddress: req.ip || 'unknown',
    });
  }
}
