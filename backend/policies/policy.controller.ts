// ─────────────────────────────────────────────────────────────────
// SYNC — Policy Management Controller (Governance)
// File: src/policies/policy.controller.ts
// ─────────────────────────────────────────────────────────────────

import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PolicyService } from './policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard, RolesGuard, OrgScopeGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';

const EDITOR_ROLES: UserRole[] = ['NIC_ADMIN', 'DEPT_CISO'];
const VIEWER_ROLES: UserRole[] = ['NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER'];

@Controller('policies')
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class PolicyController {
  constructor(
    private policies: PolicyService,
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  @Get()
  @Roles(...VIEWER_ROLES)
  async list(@Query('orgId') orgId: string | undefined, @CurrentUser() user: any): Promise<any> {
    const scopedOrgId = user.role === 'NIC_ADMIN' ? orgId : user.orgId;
    return this.policies.list(scopedOrgId);
  }

  @Get(':id')
  @Roles(...VIEWER_ROLES)
  async getOne(@Param('id') id: string): Promise<any> {
    return this.policies.getOne(id);
  }

  @Get(':id/compliance-rollup')
  @Roles(...VIEWER_ROLES)
  async getComplianceRollup(@Param('id') id: string): Promise<any> {
    return this.policies.getComplianceRollup(id);
  }

  @Post()
  @Roles(...EDITOR_ROLES)
  async create(@Body() dto: any, @CurrentUser() user: any): Promise<any> {
    return this.policies.create({ ...dto, orgId: dto.orgId || user.orgId }, user.id);
  }

  @Patch(':id')
  @Roles(...EDITOR_ROLES)
  async update(@Param('id') id: string, @Body() dto: any): Promise<any> {
    return this.policies.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(...EDITOR_ROLES)
  async setStatus(@Param('id') id: string, @Body('status') status: any, @CurrentUser() user: any): Promise<any> {
    return this.policies.setStatus(id, status, user.id, user.orgId);
  }

  @Post(':id/document')
  @Roles(...EDITOR_ROLES)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }))
  async uploadDocument(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: any): Promise<any> {
    if (!file) throw new BadRequestException('A file is required');
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const storagePath = `policies/${user.orgId}/${id}/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await this.storage.upload({
      path: storagePath,
      buffer: file.buffer,
      contentType: file.mimetype,
      encryptionKeyId: user.orgId,
      metadata: { 'x-ncagp-policy-id': id, 'x-ncagp-sha256': fileHash, 'x-data-residency': 'IN' },
    });
    return this.policies.setStorageInfo(id, storagePath, fileHash, file.mimetype, file.size);
  }

  @Post(':id/controls/:controlId')
  @Roles(...EDITOR_ROLES)
  async linkControl(@Param('id') id: string, @Param('controlId') controlId: string, @CurrentUser() user: any): Promise<any> {
    return this.policies.linkControl(id, controlId, user.id, user.orgId);
  }

  @Delete(':id/controls/:controlId')
  @Roles(...EDITOR_ROLES)
  async unlinkControl(@Param('id') id: string, @Param('controlId') controlId: string): Promise<any> {
    return this.policies.unlinkControl(id, controlId);
  }

  @Patch(':id/applicability')
  @Roles(...EDITOR_ROLES)
  async setApplicability(@Param('id') id: string, @Body('categoryCodes') categoryCodes: string[]): Promise<any> {
    return this.policies.setApplicability(id, categoryCodes || []);
  }

  // Reference list of available controls for the "link a control" picker.
  @Get('reference/controls')
  @Roles(...EDITOR_ROLES)
  async listControls(): Promise<any> {
    return this.prisma.control.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, controlCode: true, name: true, category: true } });
  }
}
