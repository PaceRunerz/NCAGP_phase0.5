// ─────────────────────────────────────────────────────────────────
// NCAGP — Evidence Controller (updated)
// Adds GET /findings/:findingId/evidence for the Evidence Portal
// ─────────────────────────────────────────────────────────────────

import {
  Controller, Post, Get, Param, Body, UseGuards, Req,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EvidenceService } from './evidence.service';
import { JwtAuthGuard, RolesGuard, OrgScopeGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { EvidenceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';
import { IsString, IsUUID } from 'class-validator';
import { memoryStorage } from 'multer';

class SupersedeDto {
  @IsUUID() evidenceId: string;
  @IsString() reason: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class EvidenceController {
  constructor(
    private evidenceService: EvidenceService,
    private prisma: PrismaService,
  ) {}

  // ── GET /api/findings/:findingId/evidence ────────────────────
  // Returns all evidence for a finding with uploader details + timestamps
  @Get('findings/:findingId/evidence')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN','REVIEWER')
  async listEvidence(
    @Param('findingId') findingId: string,
    @CurrentUser() user: any,
  ) {
    // Verify finding exists
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId },
    });
    if (!finding) return [];

    const evidence = await this.prisma.evidence.findMany({
      where: { findingId },
    });

    return evidence.map(e => ({
      id:               e.id,
      findingId:        e.findingId,
      evidenceType:     e.evidenceType,
      fileName:         e.fileName,
      sha256Hash:       e.sha256Hash,
      fileSize:         e.fileSize,
      mimeType:         e.mimeType,
      description:      e.description,
      storageRef:       e.storageRef,
      isSuperseded:     e.isSuperseded,
      supersededById:   e.supersededById,
      uploadedBy: {
        id:    e.uploadedById,
        name:  "Authorized User", // Fallback for demo
        email: "System",
        role:  "USER",
      },
    }));
  }

  // ── POST /api/findings/:findingId/evidence ───────────────────
  @Post('findings/:findingId/evidence')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async upload(
    @Param('findingId') findingId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('evidenceType') evidenceType: EvidenceType,
    @Body('description') description: string,
    @Body('clientHash') clientHash: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!evidenceType) throw new BadRequestException('evidenceType is required');

    const result = await this.evidenceService.upload({
      findingId,
      evidenceType,
      description,
      file: {
        originalname: file.originalname,
        mimetype:     file.mimetype,
        size:         file.size,
        buffer:       file.buffer,
      },
      uploadedById: user.id,
      orgId:        user.orgId,
      ipAddress:    req.ip || 'unknown',
      userAgent:    req.headers['user-agent'],
    });

    return result;
  }

  // ── POST /api/evidence/:id/supersede ────────────────────────
  @Post('evidence/:id/supersede')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async supersede(
    @Param('id') evidenceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SupersedeDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('No replacement file uploaded');

    return this.evidenceService.supersede({
      evidenceId,
      reason:   dto.reason,
      newFile: {
        originalname: file.originalname,
        mimetype:     file.mimetype,
        size:         file.size,
        buffer:       file.buffer,
      },
      requestedById: user.id,
      orgId:         user.orgId,
      ipAddress:     req.ip || 'unknown',
    });
  }

  // ── GET /api/evidence/:id/verify ────────────────────────────
  @Get('evidence/:id/verify')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN','REVIEWER')
  async verify(
    @Param('id') evidenceId: string,
    @CurrentUser() user: any,
  ) {
    return this.evidenceService.verifyIntegrity(evidenceId, user.orgId);
  }
}