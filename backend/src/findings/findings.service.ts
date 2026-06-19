import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { FindingStatus, Severity, UserRole } from '@prisma/client';   db

const SLA_DAYS: Record<Severity, number> = {
  CRITICAL: 1, HIGH: 3, MEDIUM: 7, LOW: 30, INFO: 90,
};

type TransitionMap = Record<FindingStatus, FindingStatus[]>;
const ALLOWED_TRANSITIONS: TransitionMap = {
  OPEN: [FindingStatus.ACKNOWLEDGED, FindingStatus.RISK_ACCEPTED, FindingStatus.FALSE_POSITIVE],
  ACKNOWLEDGED: [FindingStatus.IN_REMEDIATION, FindingStatus.RISK_ACCEPTED, FindingStatus.FALSE_POSITIVE],
  IN_REMEDIATION: [FindingStatus.REMEDIATED_PENDING_VALIDATION, FindingStatus.OPEN],
  REMEDIATED_PENDING_VALIDATION: [FindingStatus.VALIDATED, FindingStatus.IN_REMEDIATION],
  VALIDATED: [FindingStatus.CLOSED, FindingStatus.IN_REMEDIATION],
  CLOSED: [], RISK_ACCEPTED: [], FALSE_POSITIVE: [],
};

const TRANSITION_ROLES: Partial<Record<FindingStatus, UserRole[]>> = {
  [FindingStatus.ACKNOWLEDGED]: ['DEPT_CISO', 'DEPT_SECURITY', 'NIC_ADMIN'],
  [FindingStatus.IN_REMEDIATION]: ['DEPT_SECURITY', 'DEPT_CISO', 'NIC_ADMIN'],
  [FindingStatus.REMEDIATED_PENDING_VALIDATION]: ['DEPT_SECURITY', 'DEPT_CISO'],
  [FindingStatus.VALIDATED]: ['AUDITOR', 'VENDOR_ADMIN', 'NIC_ADMIN'],
  [FindingStatus.CLOSED]: ['NIC_ADMIN', 'DEPT_CISO', 'REVIEWER'],
  [FindingStatus.RISK_ACCEPTED]: ['DEPT_CISO', 'NIC_ADMIN'],
  [FindingStatus.FALSE_POSITIVE]: ['AUDITOR', 'NIC_ADMIN'],
};

@Injectable()
export class FindingsService {
  private readonly logger = new Logger(FindingsService.name);

  constructor(private prisma: PrismaService, private ledger: LedgerService) {}

  async create(dto: any) {
    const slaDate = new Date();
    slaDate.setDate(slaDate.getDate() + SLA_DAYS[dto.severity as Severity]);

    const finding = await this.prisma.finding.create({
      data: {
        auditId: dto.auditId, orgId: dto.orgId, assetId: dto.assetId,
        controlId: dto.controlId, severity: dto.severity, title: dto.title,
        description: dto.description, rootCause: dto.rootCause,
        recommendation: dto.recommendation, technicalDetail: dto.technicalDetail,
        slaDate, status: FindingStatus.OPEN,
      },
    });

    await this.ledger.record({
      userId: dto.createdById, orgId: dto.orgId, eventType: 'FINDING_CREATED',
      entityType: 'Finding', entityId: finding.id,
      payload: { severity: dto.severity, title: dto.title, slaDate: slaDate.toISOString() },
      ipAddress: dto.ipAddress,
    });
    return finding;
  }

  async transition(dto: any) {
    const finding = await this.prisma.finding.findFirst({
      where: { id: dto.findingId, orgId: dto.orgId },
    });

    if (!finding) throw new NotFoundException('Finding not found');

    const allowedNext = ALLOWED_TRANSITIONS[finding.status] ?? [];
    const isNicAdminOverride = dto.requestedByRole === 'NIC_ADMIN' && finding.status === FindingStatus.CLOSED;

    if (!allowedNext.includes(dto.newStatus) && !isNicAdminOverride) {
      throw new BadRequestException('Invalid transition');
    }

    const updatedFinding = await this.prisma.finding.update({
      where: { id: dto.findingId },
      data: {
        status: dto.newStatus,
        ...(dto.newStatus === FindingStatus.CLOSED && { closedAt: new Date(), closureJustification: dto.closureJustification }),
      },
    });

    await this.ledger.record({
      userId: dto.requestedById, orgId: dto.orgId, eventType: 'FINDING_STATUS_CHANGED',
      entityType: 'Finding', entityId: dto.findingId,
      payload: { fromStatus: finding.status, toStatus: dto.newStatus },
      ipAddress: dto.ipAddress,
    });

    return updatedFinding;
  }

  async findAll(filters: any) {
    // FIX 1: Safely parse page and limit so they are never NaN
    const pageNum = Number(filters.page) || 1;
    const limitNum = Number(filters.limit) || 50;

    let orgFilter: string[] | undefined;
    if (filters.requestingUserRole === 'NIC_ADMIN') {
      orgFilter = undefined;
    } else if (filters.orgId) {
      orgFilter = [filters.orgId];
    } else {
      orgFilter = filters.requestingUserDataScope;
    }

    const [findings, total] = await Promise.all([
      this.prisma.finding.findMany({
        where: {
          ...(orgFilter && { orgId: { in: orgFilter } }),
          ...(filters.severity && { severity: filters.severity }),
          ...(filters.status && { status: filters.status }),
        },
        include: {
          org: { select: { id: true, name: true, shortCode: true } },
          asset: { select: { id: true, name: true, criticality: true } },
          control: { select: { id: true, controlCode: true, name: true } },
          _count: { select: { evidence: true, tasks: true } },
        },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.finding.count({
        where: {
          ...(orgFilter && { orgId: { in: orgFilter } }),
          ...(filters.severity && { severity: filters.severity }),
          ...(filters.status && { status: filters.status }),
        },
      }),
    ]);

    return { findings, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) };
  }

  async getRiskHeatmap() {
    // FIX 2: Strict CamelCase SQL targeting Prisma schema
    const data = await this.prisma.$queryRaw<any[]>`
      SELECT 
        o.id as "orgId",
        o.name as "orgName",
        o."shortCode" as "shortCode",
        COUNT(f.id) FILTER (WHERE f.severity = 'CRITICAL' AND f.status NOT IN ('CLOSED', 'FALSE_POSITIVE')) as "criticalCount",
        COUNT(f.id) FILTER (WHERE f.severity = 'HIGH' AND f.status NOT IN ('CLOSED', 'FALSE_POSITIVE')) as "highCount",
        COUNT(f.id) FILTER (WHERE f.severity = 'MEDIUM' AND f.status NOT IN ('CLOSED', 'FALSE_POSITIVE')) as "mediumCount",
        COUNT(f.id) FILTER (WHERE f.severity = 'LOW' AND f.status NOT IN ('CLOSED', 'FALSE_POSITIVE')) as "lowCount",
        COUNT(f.id) FILTER (WHERE f.status NOT IN ('CLOSED', 'FALSE_POSITIVE')) as "openCount",
        COUNT(f.id) FILTER (WHERE f."slaDate" < NOW() AND f.status NOT IN ('CLOSED', 'FALSE_POSITIVE')) as "slaBreachedCount",
        ROUND(
          (
            COUNT(f.id) FILTER (WHERE f.severity = 'CRITICAL' AND f.status NOT IN ('CLOSED', 'FALSE_POSITIVE')) * 40 +
            COUNT(f.id) FILTER (WHERE f.severity = 'HIGH' AND f.status NOT IN ('CLOSED', 'FALSE_POSITIVE')) * 20 +
            COUNT(f.id) FILTER (WHERE f.severity = 'MEDIUM' AND f.status NOT IN ('CLOSED', 'FALSE_POSITIVE')) * 8 +
            COUNT(f.id) FILTER (WHERE f.severity = 'LOW' AND f.status NOT IN ('CLOSED', 'FALSE_POSITIVE')) * 2
          ) / NULLIF(COUNT(a.id) * 10.0, 0) * 100, 1
        ) as "riskScore"
      FROM organizations o
      LEFT JOIN findings f ON f."orgId" = o.id
      LEFT JOIN assets a ON a."orgId" = o.id AND a.status = 'ACTIVE'
      WHERE o."orgType" = 'DEPARTMENT'
      GROUP BY o.id, o.name, o."shortCode"
      ORDER BY "riskScore" DESC NULLS LAST
    `;

    // FIX 3: Bulletproof mapping to handle Postgres driver nuances
    return data.map((row: any) => ({
      orgId: row.orgId || row.org_id,
      orgName: row.orgName || row.org_name,
      shortCode: row.shortCode || row.short_code,
      criticalCount: Number(row.criticalCount || row.critical_count || 0),
      highCount: Number(row.highCount || row.high_count || 0),
      mediumCount: Number(row.mediumCount || row.medium_count || 0),
      lowCount: Number(row.lowCount || row.low_count || 0),
      openCount: Number(row.openCount || row.open_count || 0),
      slaBreachedCount: Number(row.slaBreachedCount || row.sla_breached_count || 0),
      riskScore: Number(row.riskScore || row.risk_score || 0),
    }));
  }
}
