// ─────────────────────────────────────────────────────────────────
// NCAGP — Evidence Controller
// File: src/evidence/evidence.controller.ts
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
import { Request } from 'express';
import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { memoryStorage } from 'multer';

class SupersedeDto {
  @IsUUID() evidenceId: string;
  @IsString() reason: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class EvidenceController {
  constructor(private evidenceService: EvidenceService) {}

  /** Upload evidence for a finding */
  @Post('findings/:findingId/evidence')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
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
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      uploadedById: user.id,
      orgId: user.orgId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    // Optionally verify client-side hash matches server hash
    if (clientHash && clientHash !== result.sha256Hash) {
      return {
        ...result,
        hashMismatchWarning:
          'Client hash differs from server hash — possible transit corruption',
      };
    }

    return result;
  }

  /** Supersede (replace) existing evidence */
  @Post('evidence/:id/supersede')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async supersede(
    @Param('id') evidenceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!reason) throw new BadRequestException('Supersession reason is required');

    return this.evidenceService.supersede({
      evidenceId,
      reason,
      newFile: {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      requestedById: user.id,
      orgId: user.orgId,
      ipAddress: req.ip || 'unknown',
    });
  }

  /** Re-hash and verify integrity of stored evidence */
  @Get('evidence/:id/verify')
  async verifyIntegrity(
    @Param('id') evidenceId: string,
    @CurrentUser() user: any,
  ) {
    return this.evidenceService.verifyIntegrity(evidenceId, user.orgId);
  }
}
