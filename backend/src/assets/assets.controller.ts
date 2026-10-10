import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, Res,
  ForbiddenException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as crypto from 'crypto';
import { AssetsService } from './assets.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { FindingsService } from '../findings/findings.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard, RolesGuard, OrgScopeGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { AssetType, ChecklistStatus } from '@prisma/client';
import {
  IsString, IsEnum, IsOptional, IsUUID, IsInt, Min, Max, IsArray, IsBoolean, IsObject, IsDateString,
} from 'class-validator';

// Certificates get their own, tighter rule set than evidence uploads —
// these are documents (AMC contracts, warranty cards, compliance
// certs), not forensic screenshots/logs, so a looser "accept anything up
// to 50MB" policy doesn't fit. PDF/JPEG/PNG/DOCX covers the realistic
// cases; 10MB is generous for a scanned document.
const CERT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];
const CERT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

class CreateAssetDto {
  @IsUUID() orgId: string;
  @IsEnum(AssetType) assetType: AssetType;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() ownerUserId?: string;
  @IsString() businessUnit: string;
  @IsInt() @Min(1) @Max(5) criticality: number;
  @IsString() dataSensitivity: string;
  @IsString() environment: string;
  @IsOptional() @IsString() ipAddress?: string;
  @IsOptional() @IsString() hostname?: string;
  @IsOptional() @IsArray() tags?: string[];

  // ── ITAM extension — location hierarchy ──
  @IsOptional() @IsUUID() siteId?: string;
  @IsOptional() @IsUUID() buildingId?: string;
  @IsOptional() @IsUUID() floorId?: string;
  @IsOptional() @IsUUID() subLocationId?: string;

  // ── Tangible/intangible + lifecycle fields ──
  @IsOptional() @IsBoolean() isTangible?: boolean;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() manufacturer?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() assetTag?: string;
  @IsOptional() @IsString() amcProvider?: string;
  @IsOptional() @IsDateString() amcStartDate?: string;
  @IsOptional() @IsDateString() amcExpiryDate?: string;
  @IsOptional() @IsDateString() validityDate?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsDateString() procurementDate?: string;
  @IsOptional() @IsString() costCenter?: string;
  @IsOptional() @IsUUID() custodianOrgId?: string;
  @IsOptional() @IsObject() customFields?: Record<string, any>;

  // ── Multi-select categories ──
  @IsOptional() @IsArray() categoryIds?: string[];
}

class SetCategoriesDto {
  @IsArray() categoryIds: string[];
}

class CreateBatchDto {
  @IsUUID() orgId: string;
  @IsString() batchName: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) count?: number;
  @IsOptional() @IsArray() names?: string[];
  @IsOptional() @IsString() namePrefix?: string;
  @IsObject() shared: Omit<CreateAssetDto, 'orgId' | 'name' | 'categoryIds'> & { categoryIds?: string[] };
}

class UpsertChecklistDto {
  @IsUUID() controlId: string;
  @IsEnum(ChecklistStatus) status: ChecklistStatus;
  @IsOptional() @IsString() notes?: string;
  // Required when status is NON_COMPLIANT — identifies which of this
  // asset's linked audits the auto-created Finding should belong to.
  // Not required for other statuses since nothing gets created for those.
  @IsOptional() @IsUUID() auditId?: string;
}

// Physical/logical existence check — separate concern from the
// compliance checklist above. "Does this asset actually exist / match
// the declared count" not "is it configured correctly."
class VerifyAssetDto {
  @IsOptional() @IsUUID() auditId?: string;
  @IsEnum(['VERIFIED', 'DISCREPANCY_FLAGGED']) result: 'VERIFIED' | 'DISCREPANCY_FLAGGED';
  @IsOptional() @IsInt() declaredCount?: number;
  @IsOptional() @IsInt() actualCount?: number;
  @IsOptional() @IsString() notes?: string;
}

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class AssetsController {
  constructor(
    private assetsService: AssetsService,
    private prisma: PrismaService,
    private ledger: LedgerService,
    private findingsService: FindingsService,
    private storage: StorageService,
  ) {}

  @Get()
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN','REVIEWER')
  async findAll(@Query('orgId') orgId: string, @CurrentUser() user: any) {
    if (user.role === 'NIC_ADMIN') {
      return this.assetsService.findAll(orgId || '');
    }
    return this.assetsService.findAll(orgId || user.orgId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.assetsService.findOne(id, user.orgId);
  }

  @Post()
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async create(@Body() dto: CreateAssetDto, @CurrentUser() user: any) {
    // DEPT_CISO can only create assets for their own org
    if (user.role === 'DEPT_CISO') {
      dto.orgId = user.orgId;
    }
    return this.assetsService.create(dto);
  }

  /**
   * GET /api/assets/:id/checklist — every persisted checklist entry for
   * this asset (one row per control that's ever been marked). Controls
   * with no entry yet simply aren't in this list — the frontend treats
   * those as NOT_CHECKED by default.
   */
  @Get(':id/checklist')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN','REVIEWER')
  async getChecklist(@Param('id') assetId: string, @CurrentUser() user: any) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (user.role !== 'NIC_ADMIN' && asset.orgId !== user.orgId) {
      throw new ForbiddenException('Cannot view checklist for an asset outside your department');
    }
    const items = await this.prisma.assetControlChecklist.findMany({
      where: { assetId },
      include: { updatedBy: { select: { id: true, name: true, role: true } } },
    });
    // findingId isn't a formal Prisma relation (see schema comment), so
    // resolve finding status manually for whichever entries have one.
    const findingIds = items.map(i => i.findingId).filter(Boolean) as string[];
    const findings = findingIds.length
      ? await this.prisma.finding.findMany({ where: { id: { in: findingIds } }, select: { id: true, status: true, severity: true } })
      : [];
    const findingById = new Map(findings.map(f => [f.id, f]));
    return items.map(i => ({ ...i, finding: i.findingId ? findingById.get(i.findingId) ?? null : null }));
  }

  /**
   * PATCH /api/assets/:id/checklist — set (upsert) the compliance status
   * of one control for this asset.
   *
   * This is the actual persistence AND workflow behind the Checklist tab.
   * Previously (a) status only lived in browser localStorage — invisible
   * between users and lost on browser data clear — and (b) even after
   * being made server-side, selecting NON_COMPLIANT didn't *do* anything:
   * no Finding was created, nothing else in the system reacted to it.
   * Now: marking a control NON_COMPLIANT automatically creates a real
   * Finding, linked to the audit + asset + control, which immediately:
   *   - shows up in the asset's Findings tab (real count, not stale)
   *   - shows up in the linked audit's finding list
   *   - starts its SLA clock
   *   - flows through the normal Acknowledge → Remediate → Validate →
   *     Close lifecycle just like any manually-created finding
   *   - nudges the audit's own status forward (see syncAuditStatus)
   * Re-marking the same control NON_COMPLIANT again does NOT create a
   * duplicate finding as long as the previously-created one is still
   * open — it just returns the existing one.
   */
  @Patch(':id/checklist')
  @Roles('NIC_ADMIN','DEPT_CISO','AUDITOR')
  async upsertChecklist(@Param('id') assetId: string, @Body() dto: UpsertChecklistDto, @CurrentUser() user: any) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (user.role === 'DEPT_CISO' && asset.orgId !== user.orgId) {
      throw new ForbiddenException('Cannot modify checklist for an asset outside your department');
    }

    const existing = await this.prisma.assetControlChecklist.findUnique({
      where: { assetId_controlId: { assetId, controlId: dto.controlId } },
    });

    let finding: any = null;

    if (dto.status === ChecklistStatus.NON_COMPLIANT) {
      // Is there already an unresolved finding from a previous NON_COMPLIANT
      // mark of this exact control on this exact asset? If so, reuse it —
      // don't spawn a second finding for the same underlying gap.
      if (existing?.findingId) {
        const linked = await this.prisma.finding.findFirst({ where: { id: existing.findingId } });
        if (linked && !['CLOSED', 'FALSE_POSITIVE', 'RISK_ACCEPTED'].includes(linked.status)) {
          finding = linked;
        }
      }

      if (!finding) {
        if (!dto.auditId) {
          throw new BadRequestException(
            'auditId is required to mark a control Non-Compliant — select which audit this finding belongs to'
          );
        }
        const auditLink = await this.prisma.auditAsset.findFirst({
          where: { assetId, auditId: dto.auditId },
        });
        if (!auditLink) {
          throw new BadRequestException('This asset is not linked to that audit — link it first from the Audit Drawer');
        }
        const control = await this.prisma.control.findFirst({ where: { id: dto.controlId } });
        if (!control) throw new NotFoundException('Control not found');

        finding = await this.findingsService.create({
          auditId: dto.auditId,
          orgId: asset.orgId,
          assetId,
          controlId: dto.controlId,
          severity: 'MEDIUM',
          title: `${control.name} — Non-Compliant`,
          description: `Control "${control.controlCode} — ${control.name}" was marked Non-Compliant during checklist review of asset "${asset.name}".`,
          recommendation: control.description,
          createdById: user.id,
          ipAddress: 'unknown',
        });
      }
    }

    const entry = await this.prisma.assetControlChecklist.upsert({
      where: { assetId_controlId: { assetId, controlId: dto.controlId } },
      update: { status: dto.status, notes: dto.notes, updatedById: user.id, findingId: finding?.id ?? existing?.findingId ?? null },
      create: { assetId, controlId: dto.controlId, status: dto.status, notes: dto.notes, updatedById: user.id, findingId: finding?.id ?? null },
      include: { control: { select: { controlCode: true, name: true } } },
    });

    await this.ledger.record({
      userId: user.id, orgId: asset.orgId,
      eventType: 'ASSET_CONTROL_STATUS_CHANGED', entityType: 'Asset', entityId: assetId,
      payload: { controlId: dto.controlId, controlCode: entry.control.controlCode, status: dto.status, findingId: finding?.id },
      ipAddress: 'unknown',
    });

    const findingsCount = await this.prisma.finding.count({ where: { assetId } });

    return { ...entry, finding, findingsCount };
  }

  /**
   * POST /api/assets/:id/verify — auditor's physical/logical walkthrough
   * check. "Register says 3 switches, I found 4 on the floor" goes here,
   * not into the compliance checklist (that's about configuration, not
   * existence/count). Deliberately AUDITOR-only (+ NIC_ADMIN override) —
   * a department can't self-certify its own asset count, that defeats
   * the point of an independent check, same reasoning as why CISO can't
   * choose their own auditor.
   */
  @Post(':id/verify')
  @Roles('AUDITOR', 'NIC_ADMIN')
  async verifyAsset(@Param('id') assetId: string, @Body() dto: VerifyAssetDto, @CurrentUser() user: any) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');

    if (dto.auditId) {
      const auditLink = await this.prisma.auditAsset.findFirst({ where: { assetId, auditId: dto.auditId } });
      if (!auditLink) throw new BadRequestException('This asset is not linked to that audit');
    }

    const log = await this.prisma.assetVerificationLog.create({
      data: {
        assetId,
        auditId: dto.auditId,
        verifiedById: user.id,
        result: dto.result,
        declaredCount: dto.declaredCount,
        actualCount: dto.actualCount,
        notes: dto.notes,
      },
    });

    await this.prisma.asset.update({
      where: { id: assetId },
      data: { verificationStatus: dto.result, lastVerifiedAt: new Date() },
    });

    await this.ledger.record({
      userId: user.id, orgId: asset.orgId,
      eventType: dto.result === 'DISCREPANCY_FLAGGED' ? 'ASSET_DISCREPANCY_FLAGGED' : 'ASSET_VERIFIED',
      entityType: 'Asset', entityId: assetId,
      payload: { auditId: dto.auditId, declaredCount: dto.declaredCount, actualCount: dto.actualCount, notes: dto.notes },
      ipAddress: 'unknown',
    });

    return log;
  }

  /**
   * GET /api/assets/:id/verifications — full verification history for
   * this asset, newest first. Mirrors how finding history works: one
   * current status field on the parent record for fast filtering, full
   * append-only log for the real trail.
   */
  @Get(':id/verifications')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'VENDOR_ADMIN', 'AUDITOR', 'REVIEWER', 'OBSERVER')
  async getVerifications(@Param('id') assetId: string, @CurrentUser() user: any) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');
    const scopedRoles = ['DEPT_CISO', 'DEPT_SECURITY'];
    if (scopedRoles.includes(user.role) && asset.orgId !== user.orgId) {
      throw new ForbiddenException('Cannot view verification history for an asset outside your department');
    }
    return this.prisma.assetVerificationLog.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
      include: { verifiedBy: { select: { name: true, role: true } }, audit: { select: { title: true } } },
    });
  }

  /**
   * PATCH /api/assets/:id/categories — set (replace) this asset's
   * category assignments. This is the "multi-select instead of one rigid
   * type" piece — an asset can carry several categories at once (e.g.
   * "Endpoint" + "Data-Bearing Device"), each pulling in its own relevant
   * checklist controls.
   */
  /**
   * PATCH /api/assets/:id — edit an existing asset's fields. Restricted
   * to roles that actually own the data (NIC Admin / department
   * security roles) — AUDITOR, VENDOR_ADMIN, and REVIEWER stay
   * read-only here, same separation of duties as the finding lifecycle.
   * Every change is diffed and individually ledgered — see
   * AssetsService.update().
   */
  @Patch(':id')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY')
  async update(@Param('id') id: string, @Body() patch: Record<string, any>, @CurrentUser() user: any) {
    const asset = await this.prisma.asset.findFirst({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (user.role !== 'NIC_ADMIN' && asset.orgId !== user.orgId) {
      throw new ForbiddenException('Cannot edit an asset outside your department');
    }
    return this.assetsService.update(id, asset.orgId, patch, user.id);
  }

  @Patch(':id/categories')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'AUDITOR')
  async setCategories(@Param('id') assetId: string, @Body() dto: SetCategoriesDto, @CurrentUser() user: any) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (user.role === 'DEPT_CISO' && asset.orgId !== user.orgId) {
      throw new ForbiddenException('Cannot modify categories for an asset outside your department');
    }

    const links = await this.assetsService.setCategories(assetId, dto.categoryIds);

    await this.ledger.record({
      userId: user.id, orgId: asset.orgId,
      eventType: 'ASSET_CATEGORY_ASSIGNED', entityType: 'Asset', entityId: assetId,
      payload: { categoryIds: dto.categoryIds }, ipAddress: 'unknown',
    });

    return links;
  }

  /**
   * POST /api/assets/batch — bulk registration. "50 desktops on Floor 3"
   * in one action instead of 50 separate form submissions. See
   * AssetsService.createBatch for the auto-numbered vs individually-named
   * identity rules.
   */
  @Post('batch')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async createBatch(@Body() dto: CreateBatchDto, @CurrentUser() user: any) {
    const orgId = user.role === 'DEPT_CISO' ? user.orgId : dto.orgId;

    const result = await this.assetsService.createBatch({
      orgId,
      batchName: dto.batchName,
      createdById: user.id,
      count: dto.count,
      names: dto.names,
      namePrefix: dto.namePrefix,
      shared: dto.shared as any,
    });

    await this.ledger.record({
      userId: user.id, orgId,
      eventType: 'ASSET_BATCH_CREATED', entityType: 'AssetBatch', entityId: result.batch.id,
      payload: { batchName: dto.batchName, assetCount: result.assets.length },
      ipAddress: 'unknown',
    });

    return result;
  }

  /**
   * POST /api/assets/:id/certificates — upload a certificate/document
   * (AMC contract, warranty card, compliance certificate, license doc).
   * Reuses the same MinIO storage + SHA-256 hashing pattern as Evidence
   * uploads, but with its own, tighter file-type/size rules — see
   * CERT_ALLOWED_MIME_TYPES / CERT_MAX_SIZE_BYTES above.
   */
  @Post(':id/certificates')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: CERT_MAX_SIZE_BYTES } }))
  async uploadCertificate(
    @Param('id') assetId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Body('documentType') documentType: string | undefined,
    @Body('issuedDate') issuedDate: string | undefined,
    @Body('expiryDate') expiryDate: string | undefined,
    @CurrentUser() user: any,
  ) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (user.role !== 'NIC_ADMIN' && asset.orgId !== user.orgId) {
      throw new ForbiddenException('Cannot upload a certificate for an asset outside your department');
    }
    if (!file) throw new BadRequestException('No file uploaded');
    if (!name) throw new BadRequestException('Certificate name is required');

    if (!CERT_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type '${file.mimetype}' is not permitted for certificates. Allowed: PDF, JPEG, PNG, DOCX`,
      );
    }
    if (file.size > CERT_MAX_SIZE_BYTES) {
      throw new BadRequestException(`Certificate file exceeds the 10MB limit`);
    }

    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const storagePath = `asset-certificates/${assetId}/${Date.now()}-${file.originalname}`;

    await this.storage.upload({
      path: storagePath,
      buffer: file.buffer,
      contentType: file.mimetype,
      metadata: { assetId, uploadedBy: user.id },
    });

    // Section 6, rule 4: an expiry date already in the past is flagged
    // on save, not discovered later. We don't block the upload (someone
    // may deliberately be recording an already-lapsed cert to track
    // renewal) — the response just carries the warning explicitly.
    const expiryWarning = expiryDate && new Date(expiryDate).getTime() < Date.now()
      ? `This certificate's expiry date (${expiryDate}) is already in the past.`
      : undefined;

    const cert = await this.prisma.assetCertificate.create({
      data: {
        assetId,
        name,
        documentType,
        storagePath,
        fileHash,
        fileType: file.mimetype,
        fileSizeBytes: file.size,
        issuedDate: issuedDate ? new Date(issuedDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        uploadedById: user.id,
        // Every new certificate starts SELF_DECLARED (amber) — never
        // auto-verified (Section 6, rules 2 & 7). Only NIC_ADMIN/
        // DEPT_CISO can upgrade it via POST /asset-certificates/:id/verify.
        verificationStatus: 'SELF_DECLARED',
      },
    });

    await this.ledger.record({
      userId: user.id, orgId: asset.orgId,
      eventType: 'ASSET_CERTIFICATE_UPLOADED', entityType: 'Asset', entityId: assetId,
      payload: { certificateId: cert.id, name, documentType, fileHash, expiryWarning }, ipAddress: 'unknown',
    });

    return { ...cert, expiryWarning };
  }

  /** GET /api/assets/:id/certificates — list certificates for this asset */
  @Get(':id/certificates')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async listCertificates(@Param('id') assetId: string, @CurrentUser() user: any) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (user.role !== 'NIC_ADMIN' && asset.orgId !== user.orgId) {
      throw new ForbiddenException('Cannot view certificates for an asset outside your department');
    }
    const certs = await this.prisma.assetCertificate.findMany({
      where: { assetId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
      },
    });
    // Section 6 rule 2: a claim's badge must reflect real verification
    // state, not just "a file exists" — EXPIRED takes precedence over
    // VERIFIED (a verified-but-now-lapsed cert is not still trustworthy).
    return certs.map((c) => ({
      ...c,
      displayStatus:
        c.expiryDate && c.expiryDate.getTime() < Date.now()
          ? 'EXPIRED'
          : c.verificationStatus === 'VERIFIED'
          ? 'VERIFIED'
          : 'SELF_DECLARED_UNVERIFIED',
    }));
  }

  /**
   * GET /api/assets/:id/certificates/:certId/download — stream the actual
   * file back, same pattern as Evidence downloads (fetch from MinIO,
   * re-serve with the right content type, never expose the raw storage
   * path/bucket directly to the frontend).
   */
  @Get(':id/certificates/:certId/download')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async downloadCertificate(
    @Param('id') assetId: string,
    @Param('certId') certId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (user.role !== 'NIC_ADMIN' && asset.orgId !== user.orgId) {
      throw new ForbiddenException('Cannot download certificates for an asset outside your department');
    }
    const cert = await this.prisma.assetCertificate.findFirst({ where: { id: certId, assetId } });
    if (!cert) throw new NotFoundException('Certificate not found');

    let buffer: Buffer;
    try {
      buffer = await this.storage.download(cert.storagePath);
    } catch {
      throw new NotFoundException('FILE_DELETED: This file has been removed from storage.');
    }

    res.set({
      'Content-Type': cert.fileType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${cert.name}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, max-age=3600',
      'X-Certificate-Hash': cert.fileHash,
    });
    res.send(buffer);
  }
}