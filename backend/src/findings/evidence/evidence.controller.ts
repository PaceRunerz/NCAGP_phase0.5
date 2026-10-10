import {
  Controller, Post, Get, Param, Body, UseGuards, Req,
  UseInterceptors, UploadedFile, BadRequestException,
  Res, NotFoundException, StreamableFile, UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { EvidenceService } from './evidence.service';
import { JwtAuthGuard, RolesGuard, OrgScopeGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { EvidenceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Request } from 'express';
import { IsString } from 'class-validator';
import { memoryStorage } from 'multer';

class SupersedeDto {
    @IsString() evidenceId!: string;
    @IsString() reason!: string;
  
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class EvidenceController {
  constructor(
    private evidenceService: EvidenceService,
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // ── GET /api/findings/:findingId/evidence ──────────────────────
  // Returns all evidence with correct field names for the portal
  @Get('findings/:findingId/evidence')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN','REVIEWER','OBSERVER')
  async listForFinding(
    @Param('findingId') findingId: string,
    @CurrentUser() user: any,
  ) {
    const rows = await this.prisma.evidence.findMany({
      where: { findingId },
      include: {
        uploadedBy: { select: { id:true, name:true, email:true, role:true } },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    // Normalise field names so frontend always gets consistent shape
    return rows.map(e => ({
      id:               e.id,
      findingId:        e.findingId,
      evidenceType:     e.evidenceType,
      originalFilename: e.fileName,          
      fileName:         e.fileName,
      fileHash:         e.sha256Hash,        
      sha256Hash:       e.sha256Hash,
      fileSize:         e.fileSize,
      mimeType:         e.mimeType,
      description:      e.description,
      storageRef:       e.storageRef,
      isSuperseded:     e.isSuperseded,
      createdAt:        e.uploadedAt,        
      uploadedAt:       e.uploadedAt,
      uploadedBy:       e.uploadedBy,
    }));
  }

  // ── GET /api/evidence (all evidence — for the portal overview) ─
  @Get('evidence')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN','REVIEWER')
  async listAll(@CurrentUser() user: any) {
    let evidenceWhere: any = undefined;
    if (user.role === 'NIC_ADMIN' || user.role === 'REVIEWER') {
      evidenceWhere = undefined; // full access
    } else if (user.role === 'AUDITOR' || user.role === 'VENDOR_ADMIN') {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.orgId }, select: { orgType: true },
      });
      if (org?.orgType === 'DEPARTMENT') {
        evidenceWhere = { finding: { orgId: user.orgId } };
      } else {
        evidenceWhere = { finding: { audit: { vendorOrgId: user.orgId } } };
      }
    } else {
      const scope = (user.dataAccessScope && user.dataAccessScope.length > 0)
        ? user.dataAccessScope : [user.orgId];
      evidenceWhere = { finding: { orgId: { in: scope } } };
    }
    const rows = await this.prisma.evidence.findMany({
      where: evidenceWhere,
      include: {
        uploadedBy: { select: { id:true, name:true, email:true, role:true } },
        finding: {
          select: {
            id:true, title:true, severity:true, status:true,
            org: { select: { id:true, name:true, shortCode:true } },
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
      take: 200,
    });

    return rows.map(e => ({
      id:               e.id,
      findingId:        e.findingId,
      evidenceType:     e.evidenceType,
      originalFilename: e.fileName,
      fileName:         e.fileName,
      fileHash:         e.sha256Hash,
      sha256Hash:       e.sha256Hash,
      fileSize:         e.fileSize,
      mimeType:         e.mimeType,
      description:      e.description,
      storageRef:       e.storageRef,
      isSuperseded:     e.isSuperseded,
      createdAt:        e.uploadedAt,
      uploadedAt:       e.uploadedAt,
      uploadedBy:       e.uploadedBy,
      findingTitle:     e.finding?.title,
      findingSeverity:  e.finding?.severity,
      findingStatus:    e.finding?.status,
      orgName:          e.finding?.org?.name,
      orgShortCode:     e.finding?.org?.shortCode,
    }));
  }

  // ── GET /api/evidence/:id/file ─────────────────────────────────
  // Streams the file directly from MinIO — no manual MinIO login needed
  @Get('evidence/:id/file')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN','REVIEWER')
  async serveFile(
    @Param('id') evidenceId: string,
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ev = await this.prisma.evidence.findFirst({
      where: { id: evidenceId },
      include: { finding: { select: { orgId:true, auditId:true } } },
    });

    if (!ev) throw new NotFoundException('Evidence not found');

    // Scope check per role
    if (user.role === 'NIC_ADMIN' || user.role === 'REVIEWER') {
      // full access — no check needed
    } else if (user.role === 'AUDITOR' || user.role === 'VENDOR_ADMIN') {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.orgId }, select: { orgType: true },
      });
      if (org?.orgType === 'DEPARTMENT') {
        if (ev.finding?.orgId !== user.orgId) throw new NotFoundException('Evidence not found');
      } else {
        // Auditor can only access evidence from their vendor's assigned audits
        const audit = await this.prisma.audit.findFirst({
          where: { id: ev.finding?.auditId, vendorOrgId: user.orgId },
        });
        if (!audit) throw new NotFoundException('Evidence not found');
      }
    } else {
      // DEPT roles — own org only
      const scope = (user.dataAccessScope && user.dataAccessScope.length > 0)
        ? user.dataAccessScope : [user.orgId];
      if (!scope.includes(ev.finding?.orgId)) {
        throw new NotFoundException('Evidence not found');
      }
    }

    let buffer: Buffer;
    try {
      buffer = await this.storage.download(ev.storageRef);
    } catch (error) {
      // If the file was deleted from MinIO server, catch it and tell the frontend
      throw new NotFoundException('FILE_DELETED: This file has been securely removed from the storage server for authentic reasons.');
    }

    res.set({
      'Content-Type':        ev.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${ev.fileName}"`,
      'Content-Length':      buffer.length.toString(),
      'Cache-Control':       'private, max-age=3600',
      'X-Evidence-Hash':     ev.sha256Hash,
    });

    return new StreamableFile(buffer);
  }

  // ── GET /api/evidence/:id/verify ──────────────────────────────
  @Get('evidence/:id/verify')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN','REVIEWER')
  async verify(@Param('id') id: string, @CurrentUser() user: any) {
    const ev = await this.prisma.evidence.findFirst({ where: { id } });
    if (!ev) throw new NotFoundException('Evidence not found');
    return this.evidenceService.verifyIntegrity(id, user.orgId, user.role);
  }

  // ── POST /api/findings/:findingId/evidence ─────────────────────
  @Post('findings/:findingId/evidence')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 50*1024*1024 } }))
  async upload(
    @Param('findingId') findingId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('evidenceType') evidenceType: EvidenceType,
    @Body('description') description: string,
    @Body('clientHash') clientHash: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    // ── ADDED CHECK: Catch undefined user identity early ──
    if (!user?.id) {
      throw new UnauthorizedException('User identity could not be resolved');
    }

    if (!file) throw new BadRequestException('No file uploaded');
    if (!evidenceType) throw new BadRequestException('evidenceType is required');

    // Get the finding's actual orgId (NIC_ADMIN may upload to any finding)
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId },
      select: { orgId: true },
    });
    if (!finding) throw new NotFoundException('Finding not found');

    const effectiveOrgId = user.role === 'NIC_ADMIN' ? finding.orgId : user.orgId;

    return this.evidenceService.upload({
      findingId,
      evidenceType,
      description,
      file: {
        originalname: file.originalname,
        mimetype:     file.mimetype,
        size:         file.size,
        buffer:       file.buffer,
      },
      uploadedById: user.id, // Safe to use because of the check above
      orgId:        effectiveOrgId,
      ipAddress:    req.ip || 'unknown',
      userAgent:    req.headers['user-agent'],
    });
  }

  // ── POST /api/evidence/:id/supersede ──────────────────────────
  @Post('evidence/:id/supersede')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 50*1024*1024 } }))
  async supersede(
    @Param('id') evidenceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SupersedeDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    // ── ADDED CHECK: Catch undefined user identity early ──
    if (!user?.id) {
      throw new UnauthorizedException('User identity could not be resolved');
    }

    if (!file) throw new BadRequestException('No replacement file');
    
    return this.evidenceService.supersede({
      evidenceId,
      reason: dto.reason,
      newFile: { originalname:file.originalname, mimetype:file.mimetype, size:file.size, buffer:file.buffer },
      requestedById: user.id, // Safe to use because of the check above
      orgId:         user.orgId,
      ipAddress:     req.ip || 'unknown',
    });
  }
}