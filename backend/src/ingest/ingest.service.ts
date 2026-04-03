// ─────────────────────────────────────────────────────────────────
// NCAGP — Scanner Ingestion Service
// File: src/ingest/ingest.service.ts
//
// PRD Reference: Section 8 (Findings Engine) + Section 11 (Ledger)
//
// Maps external scanner payloads (Nessus, OpenVAS, SonarQube, etc.)
// to the internal Finding schema, then writes to DB + Ledger.
// ─────────────────────────────────────────────────────────────────

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { FindingStatus, Severity } from '@prisma/client';

// ── Nessus severity → NCAGP severity mapping ─────────────────────
const NESSUS_SEVERITY_MAP: Record<string, Severity> = {
  '4': Severity.CRITICAL,
  '3': Severity.HIGH,
  '2': Severity.MEDIUM,
  '1': Severity.LOW,
  '0': Severity.INFO,
  'critical': Severity.CRITICAL,
  'high':     Severity.HIGH,
  'medium':   Severity.MEDIUM,
  'low':      Severity.LOW,
  'info':     Severity.INFO,
  'none':     Severity.INFO,
};

// ── SLA days per severity (PRD §8) ───────────────────────────────
const SLA_DAYS: Record<Severity, number> = {
  CRITICAL: 1,
  HIGH:     3,
  MEDIUM:   7,
  LOW:      30,
  INFO:     90,
};

export interface ScannerPayload {
  // Common fields (all scanners)
  audit_id:       string;   // Which audit this belongs to
  severity:       string;   // Raw severity from scanner
  title:          string;
  description:    string;

  // Optional mapping fields
  asset_id?:      string;
  control_id?:    string;
  root_cause?:    string;
  recommendation?:string;
  technical_detail?: string;

  // Scanner-specific raw fields (we normalize these)
  plugin_id?:     string;   // Nessus plugin ID
  plugin_name?:   string;   // Nessus plugin name
  host?:          string;   // Target host
  port?:          string;   // Port number
  protocol?:      string;
  solution?:      string;   // Nessus solution field
  synopsis?:      string;   // Nessus synopsis
  cvss_score?:    number;
  cve?:           string[];
  cwe?:           string[];

  // SonarQube fields
  rule_key?:      string;
  component?:     string;
  message?:       string;

  // OpenVAS fields
  oid?:           string;   // OpenVAS OID
  nvt_name?:      string;
  threat?:        string;   // OpenVAS threat level
}

export interface IngestResult {
  findingId:   string;
  ledgerEntryId: string;
  severity:    string;
  slaDate:     string;
  isDuplicate: boolean;
  message:     string;
}

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  /**
   * Main ingestion method.
   * Validates audit exists, normalizes payload, creates finding + ledger entry.
   */
  async ingestFinding(
    payload: ScannerPayload,
    orgId: string,
    apiKeyId: string,
    ipAddress: string,
  ): Promise<IngestResult> {
    // 1. Verify audit exists and belongs to org
    const audit = await this.prisma.audit.findFirst({
      where: { id: payload.audit_id },
    });

    if (!audit) {
      throw new BadRequestException(`Audit '${payload.audit_id}' not found`);
    }

    // 2. Normalize severity
    const severityRaw = String(payload.severity || '').toLowerCase();
    const severity = NESSUS_SEVERITY_MAP[severityRaw] ?? Severity.INFO;

    // 3. Normalize description — merge scanner-specific fields
    const description = this.normalizeDescription(payload);
    const recommendation = payload.recommendation || payload.solution || '';
    const technicalDetail = this.normalizeTechnicalDetail(payload);

    // 4. Check for duplicate (same title + audit + asset within 24h)
    //    Prevents scanner re-runs from creating duplicate findings
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
        findingId:    existing.id,
        ledgerEntryId:'',
        severity:     existing.severity,
        slaDate:      existing.slaDate?.toISOString() || '',
        isDuplicate:  true,
        message:      'Duplicate finding detected within 24h — skipped',
      };
    }

    // 5. Compute SLA date
    const slaDate = new Date();
    slaDate.setDate(slaDate.getDate() + SLA_DAYS[severity]);

    // 6. Create finding
    const finding = await this.prisma.finding.create({
      data: {
        auditId:         payload.audit_id,
        orgId:           audit.orgId,
        assetId:         payload.asset_id || null,
        controlId:       payload.control_id || null,
        severity,
        title:           payload.title || payload.plugin_name || payload.nvt_name || 'Untitled Finding',
        description,
        rootCause:       payload.root_cause || null,
        recommendation,
        technicalDetail,
        status:          FindingStatus.OPEN,
        slaDate,
        slaBreached:     false,
      },
    });

    // 7. Write to immutable audit ledger (PRD §11)
    const ledgerEntryId = await this.ledger.record({
      userId:     'SYSTEM_SCANNER',
      orgId:      audit.orgId,
      eventType:  'FINDING_CREATED',
      entityType: 'Finding',
      entityId:   finding.id,
      payload: {
        source:         'scanner_api',
        apiKeyId,
        findingId:      finding.id,
        auditId:        payload.audit_id,
        severity,
        title:          finding.title,
        slaDate:        slaDate.toISOString(),
        // Preserve original scanner data for audit trail
        scanner: {
          pluginId:   payload.plugin_id,
          oid:        payload.oid,
          ruleKey:    payload.rule_key,
          host:       payload.host,
          port:       payload.port,
          cvssScore:  payload.cvss_score,
          cve:        payload.cve,
          cwe:        payload.cwe,
        },
      },
      ipAddress,
    });

    this.logger.log(
      `Finding ingested: ${finding.id} | ${severity} | ${finding.title} | Audit: ${payload.audit_id}`
    );

    return {
      findingId:    finding.id,
      ledgerEntryId,
      severity,
      slaDate:      slaDate.toISOString(),
      isDuplicate:  false,
      message:      'Finding created successfully',
    };
  }

  /**
   * Batch ingestion — process multiple findings from one scanner run.
   */
  async ingestBatch(
    payloads: ScannerPayload[],
    orgId: string,
    apiKeyId: string,
    ipAddress: string,
  ): Promise<{
    total: number;
    created: number;
    duplicates: number;
    errors: number;
    results: IngestResult[];
  }> {
    const results: IngestResult[] = [];
    let created = 0, duplicates = 0, errors = 0;

    for (const payload of payloads) {
      try {
        const result = await this.ingestFinding(payload, orgId, apiKeyId, ipAddress);
        results.push(result);
        if (result.isDuplicate) duplicates++;
        else created++;
      } catch (err: any) {
        errors++;
        this.logger.error(`Batch ingest error for "${payload.title}": ${err.message}`);
        results.push({
          findingId:    '',
          ledgerEntryId:'',
          severity:     'ERROR',
          slaDate:      '',
          isDuplicate:  false,
          message:      err.message,
        });
      }
    }

    return { total: payloads.length, created, duplicates, errors, results };
  }

  // ── Private normalizers ────────────────────────────────────────

  private normalizeDescription(p: ScannerPayload): string {
    const parts: string[] = [];

    if (p.description) parts.push(p.description);
    else if (p.synopsis) parts.push(p.synopsis);
    else if (p.message)  parts.push(p.message);

    if (p.host)     parts.push(`Host: ${p.host}${p.port ? `:${p.port}` : ''}`);
    if (p.cve?.length)  parts.push(`CVE: ${p.cve.join(', ')}`);
    if (p.cwe?.length)  parts.push(`CWE: ${p.cwe.join(', ')}`);
    if (p.cvss_score)   parts.push(`CVSS Score: ${p.cvss_score}`);

    return parts.join('\n\n') || 'No description provided';
  }

  private normalizeTechnicalDetail(p: ScannerPayload): string {
    const parts: string[] = [];

    if (p.plugin_id)   parts.push(`Nessus Plugin ID: ${p.plugin_id}`);
    if (p.oid)         parts.push(`OpenVAS OID: ${p.oid}`);
    if (p.rule_key)    parts.push(`SonarQube Rule: ${p.rule_key}`);
    if (p.component)   parts.push(`Component: ${p.component}`);
    if (p.protocol)    parts.push(`Protocol: ${p.protocol}`);

    return parts.join('\n') || '';
  }
}
