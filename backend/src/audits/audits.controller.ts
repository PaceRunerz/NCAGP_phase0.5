import { Controller, Get, Post, Patch, Body, Param, UseGuards, Query, Res, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ReportsService } from '../reports/reports.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { IsString, IsDateString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { AuditStatus, FrameworkType } from '@prisma/client';

class CreateAuditDto {
  @IsString()    orgId: string;
  @IsOptional() @IsString() vendorOrgId?: string;
  @IsEnum(FrameworkType) framework: FrameworkType;
  @IsString()    title: string;
  @IsString()    scope: string;
  @IsString()    objectives: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsString() auditLeadId?: string;
  @IsOptional() @IsArray() assetIds?: string[];
}

class UpdateAuditDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() scope?: string;
  @IsOptional() @IsEnum(AuditStatus) status?: AuditStatus;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() auditLeadId?: string;
}

class UpdateAuditAssetsDto {
  @IsArray() assetIds: string[];
}

@Controller('audits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditsController {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
    private reports: ReportsService,
    private storage: StorageService,
  ) {}

  @Get()
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR','REVIEWER','OBSERVER')
  async list(@CurrentUser() user: any, @Query() q: any) {
    const where: any = {};
    if (user.role !== 'NIC_ADMIN') {
      const auditScope = (user.dataAccessScope && user.dataAccessScope.length > 0) ? user.dataAccessScope : [user.orgId];
      where.OR = [
        { orgId: { in: auditScope } },
        { vendorOrgId: user.orgId },
      ];
    }
    if (q.status) where.status = q.status;

    return this.prisma.audit.findMany({
      where,
      include: {
        org:       { select: { id:true, name:true, shortCode:true } },
        vendorOrg: { select: { id:true, name:true } },
        _count:    { select: { findings:true, auditAssets:true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR','REVIEWER')
  async findOne(@Param('id') id: string) {
    return this.prisma.audit.findFirst({
      where: { id },
      include: {
        org:       { select: { id:true, name:true, shortCode:true } },
        vendorOrg: { select: { id:true, name:true } },
        findings: {
          select: { id:true, title:true, severity:true, status:true, slaBreached:true },
          take: 20,
        },
        auditAssets: { include: { asset: { select: { id:true, name:true, criticality:true } } } },
        _count: { select: { findings:true } },
      },
    });
  }

  @Post()
  @Roles('NIC_ADMIN','DEPT_CISO')
  async create(@Body() dto: CreateAuditDto, @CurrentUser() user: any) {
    const audit = await this.prisma.audit.create({
      data: {
        orgId:       dto.orgId,
        vendorOrgId: dto.vendorOrgId,
        framework:   dto.framework,
        title:       dto.title,
        scope:       dto.scope,
        objectives:  dto.objectives,
        startDate:   new Date(dto.startDate),
        endDate:     new Date(dto.endDate),
        auditLeadId: dto.auditLeadId,
        status:      AuditStatus.PLANNED,
        auditAssets: dto.assetIds?.length ? {
          create: dto.assetIds.map(assetId => ({ assetId })),
        } : undefined,
      },
      include: {
        org: { select: { name:true } },
      },
    });

    await this.ledger.record({
      userId: user.id, orgId: user.orgId,
      eventType: 'AUDIT_CREATED', entityType: 'Audit', entityId: audit.id,
      payload: { title: dto.title, framework: dto.framework, orgId: dto.orgId },
      ipAddress: 'unknown',
    });

    return audit;
  }

  @Patch(':id')
  @Roles('NIC_ADMIN','DEPT_CISO','VENDOR_ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateAuditDto, @CurrentUser() user: any) {
    const existing = await this.prisma.audit.findFirst({ where: { id } });
    const data: any = { ...dto };
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if (dto.status === AuditStatus.CLOSED) data.closedAt = new Date();

    const audit = await this.prisma.audit.update({ where: { id }, data });

    if (dto.status && dto.status !== existing?.status) {
      await this.ledger.record({
        userId: user.id, orgId: user.orgId,
        eventType: 'AUDIT_STATUS_CHANGED', entityType: 'Audit', entityId: id,
        payload: { from: existing?.status, to: dto.status },
        ipAddress: 'unknown',
      });
    }

    return audit;
  }

  /**
   * PATCH /api/audits/:id/assets — link one or more existing assets to an
   * audit (additive; doesn't unlink anything already attached). This is
   * what actually powers the framework-specific checklist in Asset
   * Register — without a link here, an asset has no framework to scope
   * its checklist against.
   */
  @Patch(':id/assets')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async linkAssets(@Param('id') id: string, @Body() dto: UpdateAuditAssetsDto, @CurrentUser() user: any) {
    const audit = await this.prisma.audit.findFirst({ where: { id } });
    if (!audit) throw new NotFoundException('Audit not found');

    if (user.role === 'DEPT_CISO' && audit.orgId !== user.orgId) {
      throw new ForbiddenException('Cannot modify assets for an audit outside your department');
    }

    // Only allow linking assets that actually belong to the audited
    // department — prevents accidentally scoping another org's asset
    // into this audit's checklist.
    const validAssets = await this.prisma.asset.findMany({
      where: { id: { in: dto.assetIds }, orgId: audit.orgId },
      select: { id: true },
    });
    const validIds = validAssets.map(a => a.id);
    const skipped = dto.assetIds.filter(id2 => !validIds.includes(id2));

    if (validIds.length > 0) {
      await this.prisma.auditAsset.createMany({
        data: validIds.map(assetId => ({ auditId: id, assetId })),
        skipDuplicates: true,
      });

      await this.ledger.record({
        userId: user.id, orgId: user.orgId,
        eventType: 'AUDIT_ASSETS_LINKED', entityType: 'Audit', entityId: id,
        payload: { assetIds: validIds },
        ipAddress: 'unknown',
      });
    }

    const updated = await this.prisma.audit.findFirst({
      where: { id },
      include: { auditAssets: { include: { asset: { select: { id: true, name: true, criticality: true } } } } },
    });

    return { audit: updated, linkedCount: validIds.length, skipped };
  }

  /**
   * GET /api/audits/:id/coverage — the "holistic view" of how much of
   * what's in scope for this audit is actually checked. Answers: of every
   * asset linked to this audit, how many of the audit's framework
   * controls have been reviewed on each one, and — critically — which
   * specific locations have registered assets that nobody has looked at
   * yet. Rolls up both by individual asset and by location (Site →
   * Building → Floor → Sub-Location), so a coverage gap is visible at a
   * glance instead of buried in a flat asset list.
   */
  @Get(':id/coverage')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async getCoverage(@Param('id') id: string, @CurrentUser() user: any) {
    const audit = await this.prisma.audit.findFirst({
      where: { id },
      select: { id: true, title: true, framework: true, orgId: true, status: true },
    });
    if (!audit) throw new NotFoundException('Audit not found');
    if (user.role === 'DEPT_CISO' && audit.orgId !== user.orgId) {
      throw new ForbiddenException('Cannot view coverage for an audit outside your department');
    }

    // Every control mapped to this audit's framework — the denominator
    // for "how much of what should be checked, has been checked".
    const frameworkMappings = await this.prisma.controlFrameworkMapping.findMany({
      where: { framework: audit.framework },
      select: { controlId: true },
      distinct: ['controlId'],
    });
    const controlIds = frameworkMappings.map(m => m.controlId);
    const totalControls = controlIds.length;

    const auditAssets = await this.prisma.auditAsset.findMany({
      where: { auditId: id },
      include: {
        asset: {
          include: {
            site: { select: { id: true, name: true } },
            building: { select: { id: true, name: true } },
            floor: { select: { id: true, name: true } },
            subLocation: { select: { id: true, name: true } },
            checklistEntries: controlIds.length
              ? { where: { controlId: { in: controlIds } }, select: { status: true } }
              : false,
          },
        },
      },
    });

    const assetsCoverage = auditAssets.map(aa => {
      const entries = (aa.asset as any).checklistEntries || [];
      const reviewed = entries.filter((e: any) => e.status !== 'NOT_CHECKED').length;
      const nonCompliantOpen = entries.filter((e: any) => e.status === 'NON_COMPLIANT').length;
      const coveragePct = totalControls > 0 ? Math.round((reviewed / totalControls) * 100) : 0;

      const locationParts = [
        (aa.asset as any).site?.name,
        (aa.asset as any).building?.name,
        (aa.asset as any).floor?.name,
        (aa.asset as any).subLocation?.name,
      ].filter(Boolean);

      return {
        assetId: aa.asset.id,
        assetName: aa.asset.name,
        location: locationParts.length ? locationParts.join(' → ') : 'No location set',
        locationKey: [aa.asset.siteId, aa.asset.buildingId, aa.asset.floorId, aa.asset.subLocationId].filter(Boolean).join('/') || 'unassigned',
        totalControls,
        reviewed,
        nonCompliantOpen,
        coveragePct,
      };
    });

    // Roll up by location — same locationKey groups together
    const byLocationMap = new Map<string, { location: string; assetCount: number; totalReviewed: number; totalPossible: number; zeroReviewedCount: number }>();
    for (const a of assetsCoverage) {
      const bucket = byLocationMap.get(a.locationKey) || { location: a.location, assetCount: 0, totalReviewed: 0, totalPossible: 0, zeroReviewedCount: 0 };
      bucket.assetCount += 1;
      bucket.totalReviewed += a.reviewed;
      bucket.totalPossible += a.totalControls;
      if (a.reviewed === 0 && a.totalControls > 0) bucket.zeroReviewedCount += 1;
      byLocationMap.set(a.locationKey, bucket);
    }
    const byLocation = Array.from(byLocationMap.values()).map(b => ({
      ...b,
      coveragePct: b.totalPossible > 0 ? Math.round((b.totalReviewed / b.totalPossible) * 100) : 0,
    })).sort((a, b) => a.coveragePct - b.coveragePct); // worst coverage first — the gaps you need to see

    // Explicit gap callouts — assets with zero controls reviewed at all
    const gaps = assetsCoverage.filter(a => a.reviewed === 0 && a.totalControls > 0);

    const overallReviewed = assetsCoverage.reduce((sum, a) => sum + a.reviewed, 0);
    const overallPossible = assetsCoverage.reduce((sum, a) => sum + a.totalControls, 0);
    const overallCoveragePct = overallPossible > 0 ? Math.round((overallReviewed / overallPossible) * 100) : 0;

    return {
      auditId: audit.id,
      auditTitle: audit.title,
      framework: audit.framework,
      totalControls,
      totalAssetsInScope: assetsCoverage.length,
      overallCoveragePct,
      totalNonCompliantOpen: assetsCoverage.reduce((sum, a) => sum + a.nonCompliantOpen, 0),
      gaps,
      byLocation,
      assets: assetsCoverage.sort((a, b) => a.coveragePct - b.coveragePct),
    };
  }

  // Stats for dashboard
  @Get('stats/summary')
  @Roles('NIC_ADMIN','DEPT_CISO','REVIEWER')
  async stats(@CurrentUser() user: any) {
    const all = await this.prisma.audit.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    return all.reduce((acc: any, r) => { acc[r.status] = r._count.id; return acc; }, {});
  }

  /**
   * POST /api/audits/:id/generate-report — the Phase 4 feature. Before
   * this, `Audit.reportRef` was a plain string field nobody ever
   * populated — there was no actual closure deliverable. NIC_ADMIN
   * only, and only callable once the audit is CLOSED — generating a
   * certificate for work that isn't actually finished would defeat
   * the point of it being a certificate. Persists the PDF via the
   * same StorageService evidence uploads use, sets `reportRef` to the
   * storage path, and writes a ledger entry (the certificate's own
   * generation is itself part of the tamper-evident trail).
   *
   * Idempotent-ish: calling this again on an already-certified audit
   * regenerates and overwrites — useful if a finding was reopened and
   * re-closed after the first certificate, but every regeneration is
   * still logged to the ledger so there's no silent rewrite.
   */
  @Post(':id/generate-report')
  @Roles('NIC_ADMIN')
  async generateReport(@Param('id') id: string, @CurrentUser() user: any) {
    const audit = await this.prisma.audit.findFirst({ where: { id } });
    if (!audit) throw new NotFoundException('Audit not found');
    if (audit.status !== AuditStatus.CLOSED) {
      throw new BadRequestException(
        `Audit must be CLOSED before a closure certificate can be generated (current status: ${audit.status})`,
      );
    }

    const pdfBuffer = await this.reports.generateAuditCertificate(id);
    const storagePath = `audit-certificates/${id}/${Date.now()}-closure-certificate.pdf`;

    await this.storage.upload({
      path: storagePath,
      buffer: pdfBuffer,
      contentType: 'application/pdf',
      metadata: { auditId: id, generatedBy: user.id },
    });

    await this.prisma.audit.update({ where: { id }, data: { reportRef: storagePath } });

    await this.ledger.record({
      userId: user.id, orgId: user.orgId,
      eventType: 'AUDIT_STATUS_CHANGED', entityType: 'Audit', entityId: id,
      payload: { action: 'CLOSURE_CERTIFICATE_GENERATED', reportRef: storagePath },
      ipAddress: 'unknown',
    });

    return { reportRef: storagePath, generatedAt: new Date().toISOString() };
  }

  /**
   * GET /api/audits/:id/report — download the stored certificate.
   * Same role set as the other report downloads (NIC_ADMIN, DEPT_CISO)
   * — DEPT_CISO is scoped to their own department's audit only.
   */
  @Get(':id/report')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async downloadReport(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    const audit = await this.prisma.audit.findFirst({ where: { id } });
    if (!audit) throw new NotFoundException('Audit not found');
    if (user.role === 'DEPT_CISO' && audit.orgId !== user.orgId) {
      throw new ForbiddenException('Cannot download a certificate for an audit outside your department');
    }
    if (!audit.reportRef) {
      throw new NotFoundException('No certificate has been generated for this audit yet');
    }

    const buffer = await this.storage.download(audit.reportRef);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Closure-Certificate-${audit.title.replace(/[^a-z0-9]+/gi, '-')}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
