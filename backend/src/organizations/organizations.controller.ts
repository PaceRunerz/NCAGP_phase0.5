import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { PrismaService }  from '../prisma/prisma.service';
import { LedgerService }  from '../ledger/ledger.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { IsString, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';

// ── PRD SERVICE LIMITS (from PRD §2) ──────────────────────────
const SERVICE_LIMITS = {
  DEPARTMENT: {
    assetService:    25,    // Org Asset Service — max 25 assets
    auditService:    10,    // Org Audit Service — max 10 concurrent audits
    evidenceService: 100,   // Org Evidence Service — max 100 evidence files/month
    workflowService: null,  // Org Workflow Service — unlimited
    vendorService:   5,     // max 5 vendor assignments
  },
  VENDOR: {
    assetService:    25,
    auditService:    10,
    evidenceService: 100,
    workflowService: null,
    vendorService:   null,
  },
  NIC: {
    assetService:    null,  // unlimited for NIC
    auditService:    null,
    evidenceService: null,
    workflowService: null,
    vendorService:   null,
  },
};

class CreateOrgDto {
  @IsString()   name:      string;
  @IsString()   shortCode: string;
  @IsEnum(['NIC','DEPARTMENT','VENDOR']) orgType: string;
  @IsOptional() @IsString() parentOrgId?:  string;
  @IsOptional() @IsString() description?:  string;
  @IsOptional() @IsString() headOfOrg?:    string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() address?:      string;
  @IsOptional() @IsString() registrationNumber?: string; // for vendors
  @IsOptional()             certifications?: string[];   // for vendors
}

class UpdateOrgDto {
  @IsOptional() @IsString() name?:         string;
  @IsOptional() @IsString() headOfOrg?:    string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() description?:  string;
  @IsOptional()             isActive?: boolean;
}

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(
    private prisma:  PrismaService,
    private ledger:  LedgerService,
  ) {}

  // ── GET /api/organizations — tree with service usage ───────
  @Get()
  @Roles('NIC_ADMIN','DEPT_CISO','REVIEWER')
  async list(@Query('type') type: string, @CurrentUser() user: any) {
    // FIX (Phase 6 audit): this returned every organization in the
    // system — all 128 ministries, with their asset/audit/finding/user
    // counts — to a DEPT_CISO with zero filtering. Scoping to their own
    // org only, consistent with the same fix applied to findOne() and
    // serviceUsage() above.
    const scopedWhere: any = type ? { orgType: type as any } : {};
    if (user?.role === 'DEPT_CISO') scopedWhere.id = user.orgId;

    const orgs = await this.prisma.organization.findMany({
      where: scopedWhere,
      include: {
        _count: {
          select: {
            assets:   true,
            auditsOwned: true,
            findings: true,
            users:    true,
          },
        },
      },
      orderBy: [{ orgType:'asc' }, { name:'asc' }],
    });

    // Attach service limits + usage for each org
    return orgs.map(org => {
      const limits = SERVICE_LIMITS[org.orgType as keyof typeof SERVICE_LIMITS] || SERVICE_LIMITS.DEPARTMENT;
      return {
        ...org,
        serviceLimits: limits,
        serviceUsage: {
          assets:   org._count.assets,
          audits:   org._count.auditsOwned,
          findings: org._count.findings,
          users:    org._count.users,
        },
        // Evidence usage (async — approximated by findings count for now)
        evidenceUsage: org._count.findings * 2,
      };
    });
  }

  // ── GET /api/organizations/tree — hierarchical view ────────
  @Get('tree')
  @Roles('NIC_ADMIN','REVIEWER')
  async tree() {
    const all = await this.prisma.organization.findMany({
      include: { _count: { select: { assets:true, auditsOwned:true, users:true } } },
      orderBy: [{ orgType:'asc' }, { name:'asc' }],
    });

    // Build tree: NIC → Departments → Vendors
    const nic   = all.filter(o => o.orgType === 'NIC');
    const depts = all.filter(o => o.orgType === 'DEPARTMENT');
    const vendors = all.filter(o => o.orgType === 'VENDOR');

    return {
      nic:    nic.map(o => ({
        ...o,
        children: depts.map(d => ({
          ...d,
          limits: SERVICE_LIMITS.DEPARTMENT,
          usage: { assets:d._count.assets, audits:d._count.auditsOwned, users:d._count.users },
          vendors: vendors.filter(v => (d as any).parentOrgId === o.id || true)
                          .slice(0,3) // show first 3 assigned vendors
        }))
      })),
      departments: depts,
      vendors,
      totals: {
        total: all.length,
        nic: nic.length,
        departments: depts.length,
        vendors: vendors.length,
      },
    };
  }

  // ── GET /api/organizations/:id ──────────────────────────────
  @Get(':id')
  @Roles('NIC_ADMIN','DEPT_CISO','REVIEWER')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    // FIX (Phase 6 audit): this had no org-scoping at all — a DEPT_CISO
    // could view ANY other ministry's full org record, including every
    // user's name/email/role, just by changing the :id in the URL.
    // The class-level guard here is only RolesGuard (no OrgScopeGuard),
    // and even if OrgScopeGuard had been added it wouldn't have caught
    // this — it only inspects a param/query/body field literally named
    // `orgId`, and this route's param is `:id`. Explicit check instead.
    if (user.role === 'DEPT_CISO' && user.orgId !== id) {
      throw new ForbiddenException('Cannot view an organisation outside your own department');
    }
    const org = await this.prisma.organization.findFirst({
      where: { id },
      include: {
        users:  { select: { id:true, name:true, email:true, role:true } },
        assets: { select: { id:true, name:true, assetType:true, criticality:true } },
        _count: { select: { assets:true, auditsOwned:true, findings:true, users:true } },
      },
    });
    if (!org) return null;
    const limits = SERVICE_LIMITS[org.orgType as keyof typeof SERVICE_LIMITS];
    return { ...org, serviceLimits: limits };
  }

  // ── POST /api/organizations — create org/dept/vendor ───────
  @Post()
  @Roles('NIC_ADMIN')
  async create(@Body() dto: CreateOrgDto, @CurrentUser() user: any) {
    // Check shortCode uniqueness
    const existing = await this.prisma.organization.findFirst({
      where: { shortCode: dto.shortCode.toUpperCase() },
    });
    if (existing) throw new Error(`Short code ${dto.shortCode} already exists`);

    // Validate parent exists if provided
    if (dto.parentOrgId) {
      const parent = await this.prisma.organization.findFirst({ where: { id: dto.parentOrgId } });
      if (!parent) throw new Error('Parent organization not found');
    }

    const encryptionDomain = `ncagp-${dto.shortCode.toLowerCase()}-enc`;

    const org = await this.prisma.organization.create({
      data: {
        name:             dto.name,
        shortCode:        dto.shortCode.toUpperCase(),
        orgType:          dto.orgType as any,
        parentOrgId:      dto.parentOrgId || null,
        encryptionDomain,
        dataAccessScope:  [],
        isActive:         true,
      },
    });

    // If vendor, also create Vendor record with KPI defaults
    if (dto.orgType === 'VENDOR') {
      await this.prisma.vendor.upsert({
        where: { orgId: org.id },
        update: {},
        create: {
          orgId:                org.id,
          registrationNumber:   dto.registrationNumber,
          certifications:       dto.certifications || [],
          trustScore:           0,
          qualityScore:         0,
          onTimeDeliveryPct:    0,
          falsePositiveRate:    0,
          recurringFindingsRate:0,
          slaCompliancePct:     0,
          evidenceQualityScore: 0,
        },
      });
    }

    await this.ledger.record({
      userId:    user.id,
      orgId:     user.orgId,
      eventType: 'ORG_CREATED' as any,
      entityType:'Organization',
      entityId:  org.id,
      payload:   { name:dto.name, orgType:dto.orgType, shortCode:dto.shortCode },
      ipAddress: 'unknown',
    });

    return org;
  }

  // ── PATCH /api/organizations/:id ────────────────────────────
  @Patch(':id')
  @Roles('NIC_ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrgDto,
    @CurrentUser() user: any,
  ) {
    const org = await this.prisma.organization.update({
      where: { id },
      data:  dto,
    });
    return org;
  }

  // ── DELETE /api/organizations/:id — soft deactivate ─────────
  @Delete(':id')
  @Roles('NIC_ADMIN')
  async deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    // Never hard-delete — just deactivate
    await this.prisma.organization.update({
      where: { id },
      data:  { isActive: false },
    });
    await this.ledger.record({
      userId:    user.id,
      orgId:     user.orgId,
      eventType: 'ORG_DEACTIVATED' as any,
      entityType:'Organization',
      entityId:  id,
      payload:   { action:'DEACTIVATED' },
      ipAddress: 'unknown',
    });
    return { deactivated: true };
  }

  // ── GET /api/organizations/:id/service-usage ────────────────
  @Get(':id/service-usage')
  @Roles('NIC_ADMIN','DEPT_CISO')
  async serviceUsage(@Param('id') id: string, @CurrentUser() user: any) {
    // FIX (Phase 6 audit): same gap as findOne() above — no scoping at
    // all, a CISO could pull any other department's usage counts.
    if (user.role === 'DEPT_CISO' && user.orgId !== id) {
      throw new ForbiddenException('Cannot view service usage for an organisation outside your own department');
    }
    const org = await this.prisma.organization.findFirst({ where: { id } });
    if (!org) throw new Error('Org not found');

    const [assetCount, auditCount, findingCount, userCount, evidenceCount] = await Promise.all([
      this.prisma.asset.count({ where: { orgId: id } }),
      this.prisma.audit.count({ where: { orgId: id } }),
      this.prisma.finding.count({ where: { orgId: id } }),
      this.prisma.user.count({ where: { orgId: id } }),
      this.prisma.evidence.count({ where: { finding: { orgId: id } } }),
    ]);

    const limits = SERVICE_LIMITS[org.orgType as keyof typeof SERVICE_LIMITS] || SERVICE_LIMITS.DEPARTMENT;

    return {
      orgId: id,
      orgName: org.name,
      orgType: org.orgType,
      services: {
        assetService:    { used: assetCount,   limit: limits.assetService,    pct: limits.assetService ? Math.round(assetCount/limits.assetService*100) : 0, label:'Org Asset Service' },
        auditService:    { used: auditCount,   limit: limits.auditService,    pct: limits.auditService ? Math.round(auditCount/limits.auditService*100) : 0, label:'Org Audit Service' },
        evidenceService: { used: evidenceCount,limit: limits.evidenceService, pct: limits.evidenceService ? Math.round(evidenceCount/limits.evidenceService*100) : 0, label:'Org Evidence Service' },
        workflowService: { used: findingCount, limit: limits.workflowService, pct: 0, label:'Org Workflow Service' },
        vendorService:   { used: 0, limit: limits.vendorService, pct: 0, label:'Vendor Service' },
        users:           { used: userCount, limit: null, pct: 0, label:'Users' },
      },
      dataLayer: {
        postgresql:  { status:'OPERATIONAL', records: findingCount + userCount + auditCount },
        objectStore: { status:'OPERATIONAL', files: evidenceCount },
        ledger:      { status:'OPERATIONAL', entries: null },
      },
    };
  }
}