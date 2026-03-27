// ─────────────────────────────────────────────────────────────────
// NCAGP — Findings State Machine Service
// File: src/findings/findings.service.ts
//
// STATE MACHINE:
//   OPEN → ACKNOWLEDGED → IN_REMEDIATION → REMEDIATED_PENDING_VALIDATION
//        → VALIDATED → CLOSED
//        → RISK_ACCEPTED (terminal)
//        → FALSE_POSITIVE (terminal)
//
// SECURITY: All transitions logged to immutable ledger.
// SLA enforcement: severity-based deadlines auto-set on creation.
// ─────────────────────────────────────────────────────────────────

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { FindingStatus, Severity, UserRole } from '@prisma/client';

// SLA in days per severity
const SLA_DAYS: Record<Severity, number> = {
  CRITICAL: 1,   // 24 hours
  HIGH: 3,       // 3 days
  MEDIUM: 7,     // 1 week
  LOW: 30,       // 1 month
  INFO: 90,      // 3 months
};

// Allowed transitions matrix — only these moves are legal
type TransitionMap = Record<FindingStatus, FindingStatus[]>;

const ALLOWED_TRANSITIONS: TransitionMap = {
  OPEN: [
    FindingStatus.ACKNOWLEDGED,
    FindingStatus.RISK_ACCEPTED,
    FindingStatus.FALSE_POSITIVE,
  ],
  ACKNOWLEDGED: [
    FindingStatus.IN_REMEDIATION,
    FindingStatus.RISK_ACCEPTED,
    FindingStatus.FALSE_POSITIVE,
  ],
  IN_REMEDIATION: [
    FindingStatus.REMEDIATED_PENDING_VALIDATION,
    FindingStatus.OPEN, // Regression — vendor rejects fix
  ],
  REMEDIATED_PENDING_VALIDATION: [
    FindingStatus.VALIDATED,
    FindingStatus.IN_REMEDIATION, // Failed validation — back to fix
  ],
  VALIDATED: [
    FindingStatus.CLOSED,
    FindingStatus.IN_REMEDIATION, // NIC override — reopen
  ],
  CLOSED: [], // Terminal — no transitions (except NIC_ADMIN override)
  RISK_ACCEPTED: [], // Terminal
  FALSE_POSITIVE: [], // Terminal
};

// Who can trigger which transitions
const TRANSITION_ROLES: Partial<Record<FindingStatus, UserRole[]>> = {
  [FindingStatus.ACKNOWLEDGED]: ['DEPT_CISO', 'DEPT_SECURITY', 'NIC_ADMIN'],
  [FindingStatus.IN_REMEDIATION]: ['DEPT_SECURITY', 'DEPT_CISO', 'NIC_ADMIN'],
  [FindingStatus.REMEDIATED_PENDING_VALIDATION]: ['DEPT_SECURITY', 'DEPT_CISO'],
  [FindingStatus.VALIDATED]: ['AUDITOR', 'VENDOR_ADMIN', 'NIC_ADMIN'],
  [FindingStatus.CLOSED]: ['NIC_ADMIN', 'DEPT_CISO', 'REVIEWER'],
  [FindingStatus.RISK_ACCEPTED]: ['DEPT_CISO', 'NIC_ADMIN'],
  [FindingStatus.FALSE_POSITIVE]: ['AUDITOR', 'NIC_ADMIN'],
};

interface CreateFindingDto {
  auditId: string;
  orgId: string;
  assetId?: string;
  controlId?: string;
  severity: Severity;
  title: string;
  description: string;
  rootCause?: string;
  recommendation?: string;
  technicalDetail?: string;
  createdById: string;
  ipAddress: string;
}

interface TransitionFindingDto {
  findingId: string;
  newStatus: FindingStatus;
  comment?: string;
  closureJustification?: string;
  requestedById: string;
  requestedByRole: UserRole;
  orgId: string;
  ipAddress: string;
}

@Injectable()
export class FindingsService {
  private readonly logger = new Logger(FindingsService.name);

  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  async create(dto: CreateFindingDto) {
    const audit = await this.prisma.audit.findFirst({
      where: { id: dto.auditId, orgId: dto.orgId },
    });
    if (!audit) throw new NotFoundException('Audit not found');

    const slaDate = new Date();
    slaDate.setDate(slaDate.getDate() + SLA_DAYS[dto.severity]);

    let isRecurring = false;
    let previousFindingId: string | undefined;

    if (dto.assetId && dto.controlId) {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const previous = await this.prisma.finding.findFirst({
        where: {
          orgId: dto.orgId,
          assetId: dto.assetId,
          controlId: dto.controlId,
          status: { in: [FindingStatus.CLOSED, FindingStatus.VALIDATED] },
          createdAt: { gte: twoYearsAgo },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (previous) {
        isRecurring = true;
        previousFindingId = previous.id;
        this.logger.warn(
          `Recurring finding detected: ${dto.controlId} on asset ${dto.assetId} in org ${dto.orgId}`,
        );
      }
    }

    const finding = await this.prisma.finding.create({
      data: {
        auditId: dto.auditId,
        orgId: dto.orgId,
        assetId: dto.assetId,
        controlId: dto.controlId,
        severity: dto.severity,
        title: dto.title,
        description: dto.description,
        rootCause: dto.rootCause,
        recommendation: dto.recommendation,
        technicalDetail: dto.technicalDetail,
        slaDate,
        isRecurring,
        previousFindingId,
        status: FindingStatus.OPEN,
      },
    });

    await this.ledger.record({
      userId: dto.createdById,
      orgId: dto.orgId,
      eventType: 'FINDING_CREATED',
      entityType: 'Finding',
      entityId: finding.id,
      payload: {
        severity: dto.severity,
        title: dto.title,
        auditId: dto.auditId,
        assetId: dto.assetId,
        controlId: dto.controlId,
        slaDate: slaDate.toISOString(),
        isRecurring,
        previousFindingId,
      },
      ipAddress: dto.ipAddress,
    });

    return finding;
  }

  async transition(dto: TransitionFindingDto) {
    const finding = await this.prisma.finding.findFirst({
      where: { id: dto.findingId, orgId: dto.orgId },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found or access denied');
    }

    const allowedNext = ALLOWED_TRANSITIONS[finding.status] ?? [];

    const isNicAdminOverride =
      dto.requestedByRole === 'NIC_ADMIN' &&
      finding.status === FindingStatus.CLOSED;

    if (!allowedNext.includes(dto.newStatus) && !isNicAdminOverride) {
      throw new BadRequestException(
        `Cannot transition from ${finding.status} to ${dto.newStatus}. ` +
        `Allowed transitions: [${allowedNext.join(', ')}]`,
      );
    }

    const allowedRoles = TRANSITION_ROLES[dto.newStatus] ?? [];
    if (allowedRoles.length > 0 && !allowedRoles.includes(dto.requestedByRole)) {
      throw new ForbiddenException(
        `Role ${dto.requestedByRole} cannot set status to ${dto.newStatus}`,
      );
    }

    if (dto.newStatus === FindingStatus.RISK_ACCEPTED) {
      if (!dto.closureJustification) {
        throw new BadRequestException(
          'Risk acceptance requires a formal justification',
        );
      }
    }

    const updatedFinding = await this.prisma.finding.update({
      where: { id: dto.findingId },
      data: {
        status: dto.newStatus,
        ...(dto.newStatus === FindingStatus.CLOSED && {
          closedAt: new Date(),
          closureJustification: dto.closureJustification,
        }),
        ...(dto.newStatus === FindingStatus.RISK_ACCEPTED && {
          riskAcceptedBy: dto.requestedById,
          riskAcceptedAt: new Date(),
          closureJustification: dto.closureJustification,
        }),
      },
    });

    await this.prisma.findingStatusHistory.create({
      data: {
        findingId: dto.findingId,
        fromStatus: finding.status,
        toStatus: dto.newStatus,
        changedBy: dto.requestedById,
        comment: dto.comment,
      },
    });

    await this.ledger.record({
      userId: dto.requestedById,
      orgId: dto.orgId,
      eventType: 'FINDING_STATUS_CHANGED',
      entityType: 'Finding',
      entityId: dto.findingId,
      payload: {
        fromStatus: finding.status,
        toStatus: dto.newStatus,
        comment: dto.comment,
        closureJustification: dto.closureJustification,
        severity: finding.severity,
        slaDate: finding.slaDate?.toISOString(),
        slaBreached: finding.slaDate ? new Date() > finding.slaDate : false,
      },
      ipAddress: dto.ipAddress,
    });

    return updatedFinding;
  }

  async findAll(filters: {
    orgId?: string;
    requestingUserId: string;
    requestingUserRole: UserRole;
    requestingUserOrgId: string;
    requestingUserDataScope: string[];
    severity?: Severity;
    status?: FindingStatus;
    auditId?: string;
    page?: number | string; // Handled string from frontend
    limit?: number | string; // Handled string from frontend
  }) {
    // FIX 1: Safely parse page and limit so they are never NaN
    const pageNum = Number(filters.page) || 1;
    const limitNum = Number(filters.limit) || 50;

    let orgFilter: string[] | undefined;

    if (filters.requestingUserRole === 'NIC_ADMIN') {
      orgFilter = undefined;
    } else if (filters.orgId) {
      if (
        !filters.requestingUserDataScope.includes(filters.orgId) &&
        filters.requestingUserOrgId !== filters.orgId
      ) {
        throw new ForbiddenException('Access denied to this organization');
      }
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
          ...(filters.auditId && { auditId: filters.auditId }),
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
    // FIX 2: Matched the TypeScript interface perfectly to the SQL "AS" aliases
    const data = await this.prisma.$queryRaw<
      Array<{
        orgId: string;
        orgName: string;
        shortCode: string;
        criticalCount: bigint;
        highCount: bigint;
        mediumCount: bigint;
        lowCount: bigint;
        openCount: bigint;
        slaBreachedCount: bigint;
        riskScore: number;
      }>
    >`
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

    return data.map((row) => ({
      orgId: row.orgId,
      orgName: row.orgName,
      shortCode: row.shortCode,
      criticalCount: Number(row.criticalCount),
      highCount: Number(row.highCount),
      mediumCount: Number(row.mediumCount),
      lowCount: Number(row.lowCount),
      openCount: Number(row.openCount),
      slaBreachedCount: Number(row.slaBreachedCount),
      riskScore: Number(row.riskScore) ?? 0,
    }));
  }
}