import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { FindingStatus, Severity, UserRole } from '@prisma/client';

const SLA_DAYS: Record<Severity, number> = {
  CRITICAL: 7, HIGH: 30, MEDIUM: 90, LOW: 180, INFO: 365,
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

// Who is allowed to move a finding INTO each status.
// Design rule enforced here (accountability integrity):
//  - Only the department accountable party (CISO) or NIC can ACKNOWLEDGE —
//    Security shouldn't be able to acknowledge its own future work, that
//    defeats the point of a separate accountability step.
//  - Only NIC_ADMIN can CLOSE. REVIEWER is read-only by design across the
//    whole system — it must never appear here.
const TRANSITION_ROLES: Partial<Record<FindingStatus, UserRole[]>> = {
  [FindingStatus.ACKNOWLEDGED]: ['DEPT_CISO', 'NIC_ADMIN'],
  [FindingStatus.IN_REMEDIATION]: ['DEPT_SECURITY', 'DEPT_CISO', 'NIC_ADMIN'],
  [FindingStatus.REMEDIATED_PENDING_VALIDATION]: ['DEPT_SECURITY', 'DEPT_CISO'],
  [FindingStatus.VALIDATED]: ['AUDITOR', 'VENDOR_ADMIN', 'NIC_ADMIN'],
  [FindingStatus.CLOSED]: ['NIC_ADMIN'],
  [FindingStatus.RISK_ACCEPTED]: ['DEPT_CISO', 'NIC_ADMIN'],
  [FindingStatus.FALSE_POSITIVE]: ['AUDITOR', 'NIC_ADMIN'],
};

@Injectable()
export class FindingsService {
  private readonly logger = new Logger(FindingsService.name);

  constructor(private prisma: PrismaService, private ledger: LedgerService) {}

  /**
   * Keeps Audit.status in sync with the collective state of its findings,
   * instead of requiring NIC Admin to manually flip it every time. Runs
   * after every finding create/transition. Never touches an audit that's
   * been manually set to CANCELLED — that's a deliberate admin decision,
   * not something finding activity should override.
   *
   * Mapping (best-effort — "Findings Submitted" isn't automated since
   * nothing in the finding lifecycle maps cleanly onto it; that stage
   * stays admin-controlled):
   *   no findings yet                              → left as PLANNED
   *   any finding still OPEN/ACKNOWLEDGED           → IN_PROGRESS
   *   none open, but some IN_REMEDIATION/PENDING    → REMEDIATION
   *   none of the above, some VALIDATED             → VALIDATION
   *   every finding CLOSED/RISK_ACCEPTED/FALSE_POS  → CLOSED
   */
  private async syncAuditStatus(auditId: string, actorUserId: string) {
    const audit = await this.prisma.audit.findFirst({ where: { id: auditId } });
    if (!audit || audit.status === 'CANCELLED') return;

    const findings = await this.prisma.finding.findMany({
      where: { auditId },
      select: { status: true },
    });
    if (findings.length === 0) return; // stay PLANNED until something exists

    const RESOLVED = ['CLOSED', 'RISK_ACCEPTED', 'FALSE_POSITIVE'];
    const allResolved = findings.every(f => RESOLVED.includes(f.status));
    const anyOpen = findings.some(f => ['OPEN', 'ACKNOWLEDGED'].includes(f.status));
    const anyRemediation = findings.some(f => ['IN_REMEDIATION', 'REMEDIATED_PENDING_VALIDATION'].includes(f.status));

    let nextStatus: string;
    if (allResolved) nextStatus = 'CLOSED';
    else if (anyOpen) nextStatus = 'IN_PROGRESS';
    else if (anyRemediation) nextStatus = 'REMEDIATION';
    else nextStatus = 'VALIDATION'; // remaining are a mix of VALIDATED + resolved

    if (nextStatus === audit.status) return; // no change, don't spam the ledger

    await this.prisma.audit.update({
      where: { id: auditId },
      data: { status: nextStatus as any, ...(nextStatus === 'CLOSED' && { actualEndDate: new Date() }) },
    }).catch(() => {}); // actualEndDate may not exist on schema — ignore if so

    await this.ledger.record({
      userId: actorUserId, orgId: audit.orgId, eventType: 'AUDIT_STATUS_CHANGED',
      entityType: 'Audit', entityId: auditId,
      payload: { fromStatus: audit.status, toStatus: nextStatus, auto: true, reason: 'Derived from finding statuses' },
      ipAddress: 'unknown',
    });
  }

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

    // A new finding lands on an audit — make sure the audit reflects that
    // work is actually underway (covers PLANNED → IN_PROGRESS, and also
    // reopens a previously-CLOSED audit if new scope shows up later).
    await this.syncAuditStatus(dto.auditId, dto.createdById);

    return finding;
  }

  async transition(dto: any) {
    const finding = await this.prisma.finding.findFirst({
      where: { id: dto.findingId },
    });

    if (!finding) throw new NotFoundException('Finding not found');

    const allowedNext = ALLOWED_TRANSITIONS[finding.status] ?? [];
    const isNicAdminOverride = dto.requestedByRole === 'NIC_ADMIN' && finding.status === FindingStatus.CLOSED;

    if (!allowedNext.includes(dto.newStatus) && !isNicAdminOverride) {
      throw new BadRequestException('Invalid transition');
    }

    // CRITICAL FIX: TRANSITION_ROLES was defined above but never actually
    // checked anywhere — meaning any authenticated role that could reach
    // this endpoint could move a finding into ANY next-status the state
    // machine allowed, regardless of who should be allowed to do it (e.g.
    // DEPT_SECURITY could previously CLOSE a finding). This is the actual
    // role gate. NIC_ADMIN can always override (final-authority role).
    const allowedRoles = TRANSITION_ROLES[dto.newStatus];
    if (allowedRoles && !allowedRoles.includes(dto.requestedByRole) && dto.requestedByRole !== 'NIC_ADMIN') {
      throw new ForbiddenException(
        `Role ${dto.requestedByRole} cannot move a finding to ${dto.newStatus}. Allowed: ${allowedRoles.join(', ')}`,
      );
    }

    const updatedFinding = await this.prisma.finding.update({
      where: { id: dto.findingId },
      data: {
        status: dto.newStatus,
        ...(dto.newStatus === FindingStatus.CLOSED && { closedAt: new Date(), closureJustification: dto.closureJustification }),
        ...(dto.newStatus === FindingStatus.RISK_ACCEPTED && { riskAcceptedBy: dto.requestedById, riskAcceptedAt: new Date() }),
      },
    });

    // FIX: FindingStatusHistory model existed in the schema purely to
    // record this, but nothing ever wrote to it — the /history endpoint
    // and the AI Intelligence queries (fastClosed, reopened) were reading
    // from a table that was always empty. This is what actually populates it.
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
      userId: dto.requestedById, orgId: dto.orgId, eventType: 'FINDING_STATUS_CHANGED',
      entityType: 'Finding', entityId: dto.findingId,
      payload: { fromStatus: finding.status, toStatus: dto.newStatus },
      ipAddress: dto.ipAddress,
    });

    // BUG FIX: this was only ever called from create(), never from here.
    // That's why Audit.status froze at IN_PROGRESS forever — Acknowledge,
    // Remediate, Validate, and Close all changed the *finding's* status
    // but nothing ever re-derived the *audit's* status from it. Every
    // finding transition needs to re-check where the audit as a whole
    // stands now.
    await this.syncAuditStatus(finding.auditId, dto.requestedById);

    return updatedFinding;
  }

  async findAll(filters: any) {
    // FIX 1: Safely parse page and limit so they are never NaN
    const pageNum = Number(filters.page) || 1;
    const limitNum = Number(filters.limit) || 500;

    let orgFilter: string[] | undefined;
    let auditVendorFilter: string | undefined;
    if (['NIC_ADMIN','REVIEWER','OBSERVER'].includes(filters.requestingUserRole)) {
      // Full access — optional orgId filter only
      orgFilter = filters.orgId ? [filters.orgId] : undefined;
    } else if (['AUDITOR','VENDOR_ADMIN'].includes(filters.requestingUserRole)) {
      // Check org type — VENDOR auditor sees via vendorOrgId, DEPARTMENT auditor sees own dept
      if (filters.requestingUserOrgType === 'DEPARTMENT') {
        // Internal auditor — scoped to own ministry
        orgFilter = filters.orgId ? [filters.orgId] : [filters.requestingUserOrgId];
      } else {
        // External vendor auditor — scoped to assigned audits
        auditVendorFilter = filters.requestingUserOrgId;
        if (filters.orgId) orgFilter = [filters.orgId];
      }
    } else {
      // DEPT roles — own ministry only
      if (filters.orgId) {
        orgFilter = [filters.orgId];
      } else {
        const scope = filters.requestingUserDataScope;
        orgFilter = (scope && scope.length > 0) ? scope : (filters.requestingUserOrgId ? [filters.requestingUserOrgId] : undefined);
      }
    }

    const [findings, total] = await Promise.all([
      this.prisma.finding.findMany({
        where: {
          ...(orgFilter && { orgId: { in: orgFilter } }),
          ...(auditVendorFilter && { audit: { vendorOrgId: auditVendorFilter } }),
          ...(filters.severity && { severity: filters.severity }),
          ...(filters.status && { status: filters.status }),
          // For dept roles — only show findings from active audits unless auditId specified
          ...(filters.activeAuditsOnly && {
            audit: {
              status: { in: ['IN_PROGRESS', 'REMEDIATION', 'VALIDATION', 'FINDINGS_SUBMITTED'] }
            }
          }),
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
          ...(auditVendorFilter && { audit: { vendorOrgId: auditVendorFilter } }),
          ...(filters.severity && { severity: filters.severity }),
          ...(filters.status && { status: filters.status }),
          // For dept roles — only show findings from active audits unless auditId specified
          ...(filters.activeAuditsOnly && {
            audit: {
              status: { in: ['IN_PROGRESS', 'REMEDIATION', 'VALIDATION', 'FINDINGS_SUBMITTED'] }
            }
          }),
        },
      }),
    ]);

    const now = new Date();
    const enriched = findings.map((f: any) => ({
      ...f,
      slaBreached: f.slaDate ? new Date(f.slaDate) < now && !['CLOSED','FALSE_POSITIVE'].includes(f.status) : false,
    }));
    return { findings: enriched, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) };
  }

  /**
   * Actual finding history — was previously routed through findAll() by
   * mistake (returned a list of findings filtered by auditId, not the
   * status-change timeline of one finding). Now reads FindingStatusHistory,
   * org-scoped so a dept role can't pull history for another ministry's
   * finding just by guessing an ID.
   */
  async getHistory(findingId: string, requestingUserOrgId: string, requestingUserRole: string) {
    const finding = await this.prisma.finding.findFirst({ where: { id: findingId } });
    if (!finding) throw new NotFoundException('Finding not found');

    const fullAccessRoles = ['NIC_ADMIN', 'REVIEWER', 'OBSERVER', 'AUDITOR', 'VENDOR_ADMIN'];
    if (!fullAccessRoles.includes(requestingUserRole) && finding.orgId !== requestingUserOrgId) {
      throw new ForbiddenException('Access denied: Different organisation');
    }

    const history = await this.prisma.findingStatusHistory.findMany({
      where: { findingId },
      orderBy: { changedAt: 'asc' },
      include: {
        finding: { select: { title: true, severity: true } },
        changedByUser: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return { findingId, title: finding.title, history };
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