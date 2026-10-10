// ─────────────────────────────────────────────────────────────────
// NCAGP — Findings Controller
// File: src/findings/findings.controller.ts
// ─────────────────────────────────────────────────────────────────

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FindingsService } from './findings.service';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private findingsService: FindingsService, private prisma: PrismaService) {}

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
    const deptRoles = ['DEPT_CISO','DEPT_SECURITY'];

    // Fetch orgType for AUDITOR to determine internal vs external scope
    let requestingUserOrgType: string | undefined;
    if (['AUDITOR','VENDOR_ADMIN'].includes(user.role)) {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { orgType: true },
      });
      requestingUserOrgType = org?.orgType;
    }

    return this.findingsService.findAll({
      orgId,
      requestingUserId:        user.id,
      requestingUserRole:      user.role,
      requestingUserOrgId:     user.orgId,
      requestingUserDataScope: user.dataAccessScope,
      requestingUserOrgType,
      activeAuditsOnly: deptRoles.includes(user.role) && !orgId && user.role !== 'REVIEWER',
      severity,
      status,
      auditId,
      page,
      limit,
    });
  }

  /** Create a new finding */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Get(':id')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR','REVIEWER','OBSERVER')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const results = await this.findingsService.findAll({ id, orgId: user.orgId, role: user.role });
    const items = results?.findings || (Array.isArray(results) ? results : []);
    const finding = items.find((f: any) => f.id === id);
    if (!finding) throw new (require('@nestjs/common').NotFoundException)('Finding not found');
    return finding;
  }

  @Get(':id/history')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR','REVIEWER','OBSERVER')
  async getHistory(@Param('id') id: string, @CurrentUser() user: any) {
    // FIX: this used to call findAll() with auditId set to the finding's
    // id, which returned an unrelated list of findings, not this finding's
    // status-change timeline. Also had no @Roles guard at all before.
    return this.findingsService.getHistory(id, user.orgId, user.role);
  }

  /** State machine transition — role-gating happens inside the service
   *  (TRANSITION_ROLES, checked per target status), but every caller must
   *  still be an authenticated user with a real role; listing the roles
   *  here too keeps this endpoint consistent with every other one instead
   *  of being the one unguarded write path into the finding lifecycle. */
  @Patch(':id/status')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR')
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

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('NIC_ADMIN')
  async deleteFinding(@Param('id') id: string, @CurrentUser() user: any) {
    if (user.role !== 'NIC_ADMIN') throw new Error('NIC_ADMIN only');
    await this.findingsService['prisma'].finding.delete({ where: { id } });
    return { deleted: true, id };
  }

}