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
var IngestService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ledger_service_1 = require("../ledger/ledger.service");
const client_1 = require("@prisma/client");
const NESSUS_SEVERITY_MAP = {
    '4': client_1.Severity.CRITICAL,
    '3': client_1.Severity.HIGH,
    '2': client_1.Severity.MEDIUM,
    '1': client_1.Severity.LOW,
    '0': client_1.Severity.INFO,
    'critical': client_1.Severity.CRITICAL,
    'high': client_1.Severity.HIGH,
    'medium': client_1.Severity.MEDIUM,
    'low': client_1.Severity.LOW,
    'info': client_1.Severity.INFO,
    'none': client_1.Severity.INFO,
};
const SLA_DAYS = {
    CRITICAL: 1,
    HIGH: 3,
    MEDIUM: 7,
    LOW: 30,
    INFO: 90,
};
let IngestService = IngestService_1 = class IngestService {
    constructor(prisma, ledger) {
        this.prisma = prisma;
        this.ledger = ledger;
        this.logger = new common_1.Logger(IngestService_1.name);
    }
    async ingestFinding(payload, orgId, apiKeyId, ipAddress) {
        const audit = await this.prisma.audit.findFirst({
            where: { id: payload.audit_id },
        });
        if (!audit) {
            throw new common_1.BadRequestException(`Audit '${payload.audit_id}' not found`);
        }
        const severityRaw = String(payload.severity || '').toLowerCase();
        const severity = NESSUS_SEVERITY_MAP[severityRaw] ?? client_1.Severity.INFO;
        const description = this.normalizeDescription(payload);
        const recommendation = payload.recommendation || payload.solution || '';
        const technicalDetail = this.normalizeTechnicalDetail(payload);
        const oneDayAgo = new Date(Date.now() - 86400000);
        const existing = await this.prisma.finding.findFirst({
            where: {
                auditId: payload.audit_id,
                title: payload.title || payload.plugin_name || payload.nvt_name || 'Unknown Finding',
                assetId: payload.asset_id || null,
                createdAt: { gte: oneDayAgo },
            },
        });
        if (existing) {
            this.logger.warn(`Duplicate finding skipped: ${existing.id} | ${payload.title}`);
            return {
                findingId: existing.id,
                ledgerEntryId: '',
                severity: existing.severity,
                slaDate: existing.slaDate?.toISOString() || '',
                isDuplicate: true,
                message: 'Duplicate finding detected within 24h — skipped',
            };
        }
        const slaDate = new Date();
        slaDate.setDate(slaDate.getDate() + SLA_DAYS[severity]);
        const finding = await this.prisma.finding.create({
            data: {
                auditId: payload.audit_id,
                orgId: audit.orgId,
                assetId: payload.asset_id || null,
                controlId: payload.control_id || null,
                severity,
                title: payload.title || payload.plugin_name || payload.nvt_name || 'Untitled Finding',
                description,
                rootCause: payload.root_cause || null,
                recommendation,
                technicalDetail,
                status: client_1.FindingStatus.OPEN,
                slaDate,
                slaBreached: false,
            },
        });
        const ledgerEntryId = await this.ledger.record({
            userId: 'SYSTEM_SCANNER',
            orgId: audit.orgId,
            eventType: 'FINDING_CREATED',
            entityType: 'Finding',
            entityId: finding.id,
            payload: {
                source: 'scanner_api',
                apiKeyId,
                findingId: finding.id,
                auditId: payload.audit_id,
                severity,
                title: finding.title,
                slaDate: slaDate.toISOString(),
                scanner: {
                    pluginId: payload.plugin_id,
                    oid: payload.oid,
                    ruleKey: payload.rule_key,
                    host: payload.host,
                    port: payload.port,
                    cvssScore: payload.cvss_score,
                    cve: payload.cve,
                    cwe: payload.cwe,
                },
            },
            ipAddress,
        });
        this.logger.log(`Finding ingested: ${finding.id} | ${severity} | ${finding.title} | Audit: ${payload.audit_id}`);
        return {
            findingId: finding.id,
            ledgerEntryId,
            severity,
            slaDate: slaDate.toISOString(),
            isDuplicate: false,
            message: 'Finding created successfully',
        };
    }
    async ingestBatch(payloads, orgId, apiKeyId, ipAddress) {
        const results = [];
        let created = 0, duplicates = 0, errors = 0;
        for (const payload of payloads) {
            try {
                const result = await this.ingestFinding(payload, orgId, apiKeyId, ipAddress);
                results.push(result);
                if (result.isDuplicate)
                    duplicates++;
                else
                    created++;
            }
            catch (err) {
                errors++;
                this.logger.error(`Batch ingest error for "${payload.title}": ${err.message}`);
                results.push({
                    findingId: '',
                    ledgerEntryId: '',
                    severity: 'ERROR',
                    slaDate: '',
                    isDuplicate: false,
                    message: err.message,
                });
            }
        }
        return { total: payloads.length, created, duplicates, errors, results };
    }
    normalizeDescription(p) {
        const parts = [];
        if (p.description)
            parts.push(p.description);
        else if (p.synopsis)
            parts.push(p.synopsis);
        else if (p.message)
            parts.push(p.message);
        if (p.host)
            parts.push(`Host: ${p.host}${p.port ? `:${p.port}` : ''}`);
        if (p.cve?.length)
            parts.push(`CVE: ${p.cve.join(', ')}`);
        if (p.cwe?.length)
            parts.push(`CWE: ${p.cwe.join(', ')}`);
        if (p.cvss_score)
            parts.push(`CVSS Score: ${p.cvss_score}`);
        return parts.join('\n\n') || 'No description provided';
    }
    normalizeTechnicalDetail(p) {
        const parts = [];
        if (p.plugin_id)
            parts.push(`Nessus Plugin ID: ${p.plugin_id}`);
        if (p.oid)
            parts.push(`OpenVAS OID: ${p.oid}`);
        if (p.rule_key)
            parts.push(`SonarQube Rule: ${p.rule_key}`);
        if (p.component)
            parts.push(`Component: ${p.component}`);
        if (p.protocol)
            parts.push(`Protocol: ${p.protocol}`);
        return parts.join('\n') || '';
    }
};
exports.IngestService = IngestService;
exports.IngestService = IngestService = IngestService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ledger_service_1.LedgerService])
], IngestService);
//# sourceMappingURL=ingest.service.js.map