import { Controller, Get, Post, Patch, Body, Param, UseGuards, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { IsString, IsDateString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { AuditStatus, FrameworkType } from '@prisma/client';  sdvw

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

@Controller('audits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditsController {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  @Get()
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR','REVIEWER')
  async list(@CurrentUser() user: any, @Query() q: any) {
    const where: any = {};
    if (user.role !== 'NIC_ADMIN') {
      where.OR = [
        { orgId: { in: user.dataAccessScope || [user.orgId] } },
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
}
