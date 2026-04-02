"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FindingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ledger_service_1 = require("../ledger/ledger.service");
const client_1 = require("@prisma/client");
const SLA_DAYS = {
    CRITICAL: 1, HIGH: 3, MEDIUM: 7, LOW: 30, INFO: 90,
};
const ALLOWED_TRANSITIONS = {
    OPEN: [client_1.FindingStatus.ACKNOWLEDGED, client_1.FindingStatus.RISK_ACCEPTED, client_1.FindingStatus.FALSE_POSITIVE],
    ACKNOWLEDGED: [client_1.FindingStatus.IN_REMEDIATION, client_1.FindingStatus.RISK_ACCEPTED, client_1.FindingStatus.FALSE_POSITIVE],
    IN_REMEDIATION: [client_1.FindingStatus.REMEDIATED_PENDING_VALIDATION, client_1.FindingStatus.OPEN],
    REMEDIATED_PENDING_VALIDATION: [client_1.FindingStatus.VALIDATED, client_1.FindingStatus.IN_REMEDIATION],
    VALIDATED: [client_1.FindingStatus.CLOSED, client_1.FindingStatus.IN_REMEDIATION],
    CLOSED: [], RISK_ACCEPTED: [], FALSE_POSITIVE: [],
};
const TRANSITION_ROLES = {
    [client_1.FindingStatus.ACKNOWLEDGED]: ['DEPT_CISO', 'DEPT_SECURITY', 'NIC_ADMIN'],
    [client_1.FindingStatus.IN_REMEDIATION]: ['DEPT_SECURITY', 'DEPT_CISO', 'NIC_ADMIN'],
    [client_1.FindingStatus.REMEDIATED_PENDING_VALIDATION]: ['DEPT_SECURITY', 'DEPT_CISO'],
    [client_1.FindingStatus.VALIDATED]: ['AUDITOR', 'VENDOR_ADMIN', 'NIC_ADMIN'],
    [client_1.FindingStatus.CLOSED]: ['NIC_ADMIN', 'DEPT_CISO', 'REVIEWER'],
    [client_1.FindingStatus.RISK_ACCEPTED]: ['DEPT_CISO', 'NIC_ADMIN'],
    [client_1.FindingStatus.FALSE_POSITIVE]: ['AUDITOR', 'NIC_ADMIN'],
};
let FindingsService = FindingsService_1 = class FindingsService {
    constructor(prisma, ledger) {
        this.prisma = prisma;
        this.ledger = ledger;
        this.logger = new common_1.Logger(FindingsService_1.name);
    }
    async create(dto) {
        const slaDate = new Date();
        slaDate.setDate(slaDate.getDate() + SLA_DAYS[dto.severity]);
        const finding = await this.prisma.finding.create({
            data: {
                auditId: dto.auditId, orgId: dto.orgId, assetId: dto.assetId,
                controlId: dto.controlId, severity: dto.severity, title: dto.title,
                description: dto.description, rootCause: dto.rootCause,
                recommendation: dto.recommendation, technicalDetail: dto.technicalDetail,
                slaDate, status: client_1.FindingStatus.OPEN,
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
    async transition(dto) {
        const finding = await this.prisma.finding.findFirst({
            where: { id: dto.findingId, orgId: dto.orgId },
        });
        if (!finding)
            throw new common_1.NotFoundException('Finding not found');
        const allowedNext = ALLOWED_TRANSITIONS[finding.status] ?? [];
        const isNicAdminOverride = dto.requestedByRole === 'NIC_ADMIN' && finding.status === client_1.FindingStatus.CLOSED;
        if (!allowedNext.includes(dto.newStatus) && !isNicAdminOverride) {
            throw new common_1.BadRequestException('Invalid transition');
        }
        const updatedFinding = await this.prisma.finding.update({
            where: { id: dto.findingId },
            data: {
                status: dto.newStatus,
                ...(dto.newStatus === client_1.FindingStatus.CLOSED && { closedAt: new Date(), closureJustification: dto.closureJustification }),
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
    async findAll(filters) {
        const pageNum = Number(filters.page) || 1;
        const limitNum = Number(filters.limit) || 50;
        let orgFilter;
        if (filters.requestingUserRole === 'NIC_ADMIN') {
            orgFilter = undefined;
        }
        else if (filters.orgId) {
            orgFilter = [filters.orgId];
        }
        else {
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
        const data = await this.prisma.$queryRaw `
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
};
exports.FindingsService = FindingsService;
exports.FindingsService = FindingsService = FindingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ledger_service_1.LedgerService])
], FindingsService);
//# sourceMappingURL=findings.service.js.map