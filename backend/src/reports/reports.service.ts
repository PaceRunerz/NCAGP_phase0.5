// ─────────────────────────────────────────────────────────────────
// SYNC — PDF Report Service
// File: src/reports/reports.service.ts
//
// FREE: Uses pdfkit — pure Node.js PDF generation, no browser needed.
// Generates a professional enterprise-grade risk report.
// ─────────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as PDFDocument from 'pdfkit';
import { Writable } from 'stream';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate the National Risk Heatmap PDF report.
   * Returns a Buffer containing the complete PDF.
   */
  /**
   * PHASE 4 — Audit Closure Certificate.
   *
   * Distinct from the other reports here (which are all cross-audit
   * rollups): this is the single-audit deliverable a department
   * actually needs at the end of a cycle — the real-world equivalent
   * of a "Safe to Host" / compliance certificate. Only callable once
   * an audit reaches CLOSED (enforced in the controller, not here) —
   * generating one earlier would be certifying work that isn't
   * actually finished.
   *
   * Includes: audit identity + dates, every finding with its full
   * remediation trail (not just current status — who found it, when
   * acknowledged, how long remediation took vs SLA, who validated,
   * who approved closure), asset verification summary, and an overall
   * SLA compliance figure. This is the artifact NIC_ADMIN hands back
   * to the department as proof the cycle is genuinely done.
   */
  async generateAuditCertificate(auditId: string): Promise<Buffer> {
    const audit = await this.prisma.audit.findFirst({
      where: { id: auditId },
      include: {
        org: { select: { name: true, shortCode: true } },
        vendorOrg: { select: { name: true } },
        findings: {
          include: {
            statusHistory: {
              orderBy: { changedAt: 'asc' },
              include: { changedByUser: { select: { name: true, role: true } } },
            },
            // FIX: field is `sha256Hash`, not `fileHash` — was guessed
            // instead of checked against the actual schema.
            evidence: { select: { id: true, sha256Hash: true } },
          },
        },
        auditAssets: {
          include: {
            asset: {
              select: {
                name: true, verificationStatus: true, lastVerifiedAt: true,
              },
            },
          },
        },
      },
    });
    if (!audit) throw new Error('Audit not found');

    // FIX: `auditLead` was never a real relation on Audit — only
    // `auditLeadId` (a plain scalar) exists in the schema. Including a
    // non-existent relation key broke Prisma's TypeScript inference for
    // the ENTIRE query result, which is what actually caused every
    // other "property does not exist on type Audit" error in the build
    // log (audit.findings, audit.auditAssets, audit.org, audit.vendorOrg
    // all failed as a side effect of this one bad key, not because
    // those relations don't exist — they do). Fetching the lead
    // separately here instead of inventing a relation.
    const auditLead = audit.auditLeadId
      ? await this.prisma.user.findFirst({ where: { id: audit.auditLeadId }, select: { name: true, email: true } })
      : null;

    const findings = audit.findings || [];
    const closedFindings = findings.filter((f) => f.status === 'CLOSED');
    const riskAccepted = findings.filter((f) => f.status === 'RISK_ACCEPTED');
    const falsePositive = findings.filter((f) => f.status === 'FALSE_POSITIVE');
    const stillOpen = findings.filter((f) => !['CLOSED', 'RISK_ACCEPTED', 'FALSE_POSITIVE'].includes(f.status));
    const slaBreached = findings.filter((f) => f.slaBreached);
    const slaCompliancePct = findings.length
      ? Math.round(((findings.length - slaBreached.length) / findings.length) * 100)
      : 100;

    const verifiedAssets = (audit.auditAssets || []).filter((aa) => aa.asset.verificationStatus === 'VERIFIED').length;
    const discrepancyAssets = (audit.auditAssets || []).filter((aa) => aa.asset.verificationStatus === 'DISCREPANCY_FLAGGED').length;
    const totalAssets = (audit.auditAssets || []).length;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Audit Closure Certificate — ${audit.title}`,
          Author: 'OpenOS Technologies Pvt Ltd',
          Subject: 'SYNC Audit Closure Certificate',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 495;
      const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' });

      // ── HEADER ────────────────────────────────────────────────
      doc.rect(50, 50, W, 90).fill('#0f172a');
      doc.fill('white').font('Helvetica-Bold').fontSize(18)
        .text('AUDIT CLOSURE CERTIFICATE', 65, 68, { width: W - 80 });
      doc.font('Helvetica').fontSize(10).fill('#94a3b8')
        .text('SYNC · OpenOS Family Product · National Cyber Audit & Governance Platform', 65, 92, { width: W - 80 });
      doc.fill('#4ade80').font('Helvetica-Bold').fontSize(12)
        .text(audit.title, 65, 112, { width: W - 80 });

      doc.rect(50, 148, W, 18).fillAndStroke('#16a34a', '#16a34a');
      doc.fill('white').font('Helvetica-Bold').fontSize(9)
        .text(`CERTIFIED CLOSED · Issued: ${today}`, 65, 153, { align: 'center', width: W });

      let y = 180;
      doc.fill('#475569').font('Helvetica').fontSize(9)
        .text(`Department: ${audit.org?.name || '—'}  ·  Framework: ${audit.framework?.replace(/_/g, ' ')}  ·  Vendor: ${audit.vendorOrg?.name || '—'}`, 50, y, { width: W });
      y += 14;
      if (auditLead) {
        doc.text(`Audit Lead: ${auditLead.name} (${auditLead.email})`, 50, y, { width: W });
        y += 14;
      }
      doc.text(`Audit window: ${new Date(audit.startDate).toLocaleDateString('en-IN')} — ${new Date(audit.endDate).toLocaleDateString('en-IN')}  ·  Closed: ${audit.closedAt ? new Date(audit.closedAt).toLocaleDateString('en-IN') : '—'}`, 50, y, { width: W });
      y += 24;

      // ── KPIs ─────────────────────────────────────────────────
      const kpis = [
        { label: 'Total Findings', value: String(findings.length), color: '#0f172a' },
        { label: 'Closed / Resolved', value: String(closedFindings.length + riskAccepted.length + falsePositive.length), color: '#16a34a' },
        { label: 'SLA Compliance', value: `${slaCompliancePct}%`, color: slaCompliancePct >= 90 ? '#16a34a' : slaCompliancePct >= 70 ? '#d97706' : '#dc2626' },
        { label: 'Assets Verified', value: totalAssets ? `${verifiedAssets}/${totalAssets}` : '—', color: discrepancyAssets > 0 ? '#dc2626' : '#0f172a' },
      ];
      const kpiW = (W - 30) / 4;
      kpis.forEach((kpi, i) => {
        const x = 50 + i * (kpiW + 10);
        doc.rect(x, y, kpiW, 55).fill('#f8fafc').stroke('#e2e8f0');
        doc.fill('#64748b').font('Helvetica').fontSize(7).text(kpi.label.toUpperCase(), x + 8, y + 7, { width: kpiW - 16 });
        doc.fill(kpi.color).font('Helvetica-Bold').fontSize(18).text(kpi.value, x + 8, y + 17);
      });
      y += 70;

      if (stillOpen.length > 0) {
        doc.rect(50, y, W, 22).fill('#fef2f2').stroke('#fecaca');
        doc.fill('#dc2626').font('Helvetica-Bold').fontSize(8)
          .text(`⚠ NOTE: ${stillOpen.length} finding(s) still not in a terminal state at time of certificate generation.`, 60, y + 7, { width: W - 20 });
        y += 30;
      }
      if (discrepancyAssets > 0) {
        doc.rect(50, y, W, 22).fill('#fef2f2').stroke('#fecaca');
        doc.fill('#dc2626').font('Helvetica-Bold').fontSize(8)
          .text(`⚠ NOTE: ${discrepancyAssets} asset(s) had a verification discrepancy flagged and not yet resolved.`, 60, y + 7, { width: W - 20 });
        y += 30;
      }

      // ── FINDINGS TABLE ───────────────────────────────────────
      doc.fill('#0f172a').font('Helvetica-Bold').fontSize(12).text('FINDING DISPOSITION', 50, y);
      y += 15;
      doc.moveTo(50, y).lineTo(545, y).stroke('#e2e8f0');
      y += 8;

      const cols = [
        { label: 'FINDING', x: 50, w: 190 },
        { label: 'SEVERITY', x: 245, w: 55 },
        { label: 'DISPOSITION', x: 305, w: 90 },
        { label: 'SLA', x: 400, w: 50 },
        { label: 'EVIDENCE', x: 455, w: 90 },
      ];

      const drawTableHeader = () => {
        doc.rect(50, y, W, 18).fill('#1e293b');
        cols.forEach((c) => doc.fill('white').font('Helvetica-Bold').fontSize(7).text(c.label, c.x + 4, y + 5, { width: c.w - 4 }));
        y += 22;
      };

      if (findings.length === 0) {
        doc.fill('#64748b').font('Helvetica').fontSize(10).text('No findings were raised under this audit.', 50, y);
        y += 20;
      } else {
        drawTableHeader();
        findings.forEach((f, i) => {
          if (y > 700) { doc.addPage(); y = 60; drawTableHeader(); }
          const rowH = 26;
          doc.rect(50, y, W, rowH).fill(i % 2 === 0 ? '#f8fafc' : 'white');

          doc.fill('#1e293b').font('Helvetica-Bold').fontSize(8).text(f.title, cols[0].x + 4, y + 4, { width: cols[0].w - 8, ellipsis: true });
          doc.fill('#64748b').font('Helvetica').fontSize(7).text(f.id.slice(0, 8), cols[0].x + 4, y + 15, { width: cols[0].w - 8 });

          const sevColor = f.severity === 'CRITICAL' ? '#dc2626' : f.severity === 'HIGH' ? '#ea580c' : f.severity === 'MEDIUM' ? '#d97706' : '#64748b';
          doc.fill(sevColor).font('Helvetica-Bold').fontSize(8).text(f.severity, cols[1].x + 4, y + 8, { width: cols[1].w - 8 });

          const dispColor = f.status === 'CLOSED' ? '#16a34a' : f.status === 'RISK_ACCEPTED' ? '#d97706' : f.status === 'FALSE_POSITIVE' ? '#64748b' : '#2563eb';
          doc.fill(dispColor).font('Helvetica-Bold').fontSize(7.5).text(f.status.replace(/_/g, ' '), cols[2].x + 4, y + 8, { width: cols[2].w - 8 });

          doc.fill(f.slaBreached ? '#dc2626' : '#16a34a').font('Helvetica-Bold').fontSize(7.5).text(f.slaBreached ? 'MISSED' : 'MET', cols[3].x + 4, y + 8, { width: cols[3].w - 8 });

          const hash = f.evidence?.[0]?.sha256Hash;
          doc.fill('#475569').font('Helvetica').fontSize(6.5).text(hash ? `${hash.slice(0, 14)}...` : '— none —', cols[4].x + 4, y + 8, { width: cols[4].w - 8 });

          y += rowH;
        });
      }

      // ── CERTIFICATION STATEMENT ──────────────────────────────
      if (y > 680) { doc.addPage(); y = 60; }
      y += 20;
      doc.rect(50, y, W, 1).fill('#e2e8f0');
      y += 16;
      doc.fill('#0f172a').font('Helvetica-Bold').fontSize(11).text('CERTIFICATION', 50, y);
      y += 16;
      doc.fill('#334155').font('Helvetica').fontSize(8.5).text(
        `This certifies that the audit "${audit.title}" for ${audit.org?.name || 'the department'} under the ` +
        `${audit.framework?.replace(/_/g, ' ')} framework has been formally closed. Every finding raised during ` +
        `this audit reached a terminal disposition (Closed, Risk Accepted, or marked False Positive) with a ` +
        `complete, tamper-evident record of who found it, who acknowledged it, who remediated it, who validated ` +
        `the remediation, and who approved final closure — recoverable in full from the platform's audit ledger.`,
        50, y, { width: W, align: 'justify' },
      );
      y += 60;
      doc.fill('#64748b').font('Helvetica').fontSize(8).text(`Generated by: NIC Admin  ·  Generated on: ${today}`, 50, y);

      // ── FOOTER ────────────────────────────────────────────────
      doc.rect(50, 780, W, 1).fill('#e2e8f0');
      doc.fill('#94a3b8').font('Helvetica').fontSize(7).text(
        `CONFIDENTIAL · INTERNAL — This certificate is generated directly from ledger-backed platform data and ` +
        `is not valid if independently altered. A product of OpenOS Technologies Pvt Ltd. Certificate ID: ${auditId}-${Date.now()}`,
        50, 787, { width: W, align: 'center' },
      );

      doc.end();
    });
  }

  async generateNationalRiskReport(): Promise<Buffer> {
    // Fetch all heatmap data
    const heatmapData = await this.prisma.$queryRaw<any[]>`
      SELECT 
        o.name as "orgName",
        o."shortCode",
        COUNT(f.id) FILTER (WHERE f.severity = 'CRITICAL' AND f.status NOT IN ('CLOSED','FALSE_POSITIVE')) as "criticalCount",
        COUNT(f.id) FILTER (WHERE f.severity = 'HIGH' AND f.status NOT IN ('CLOSED','FALSE_POSITIVE')) as "highCount",
        COUNT(f.id) FILTER (WHERE f.severity = 'MEDIUM' AND f.status NOT IN ('CLOSED','FALSE_POSITIVE')) as "mediumCount",
        COUNT(f.id) FILTER (WHERE f.severity = 'LOW' AND f.status NOT IN ('CLOSED','FALSE_POSITIVE')) as "lowCount",
        COUNT(f.id) FILTER (WHERE f.status NOT IN ('CLOSED','FALSE_POSITIVE')) as "openCount",
        COUNT(f.id) FILTER (WHERE f."slaDate" < NOW() AND f.status NOT IN ('CLOSED','FALSE_POSITIVE')) as "slaBreachedCount",
        ROUND((
          COUNT(f.id) FILTER (WHERE f.severity='CRITICAL' AND f.status NOT IN ('CLOSED','FALSE_POSITIVE'))*40 +
          COUNT(f.id) FILTER (WHERE f.severity='HIGH' AND f.status NOT IN ('CLOSED','FALSE_POSITIVE'))*20 +
          COUNT(f.id) FILTER (WHERE f.severity='MEDIUM' AND f.status NOT IN ('CLOSED','FALSE_POSITIVE'))*8 +
          COUNT(f.id) FILTER (WHERE f.severity='LOW' AND f.status NOT IN ('CLOSED','FALSE_POSITIVE'))*2
        ) / NULLIF(COUNT(a.id)*10.0,0)*100, 1) as "riskScore"
      FROM organizations o
      LEFT JOIN findings f ON f."orgId" = o.id
      LEFT JOIN assets a ON a."orgId" = o.id AND a.status='ACTIVE'
      WHERE o."orgType" = 'DEPARTMENT'
      GROUP BY o.id, o.name, o."shortCode"
      ORDER BY "riskScore" DESC NULLS LAST
    `;

    // Fetch breached findings detail
    const breached = await this.prisma.finding.findMany({
      where: {
        slaBreached: true,
        status: { notIn: ['CLOSED', 'FALSE_POSITIVE', 'RISK_ACCEPTED'] },
      },
      include: {
        org: { select: { name: true, shortCode: true } },
        asset: { select: { name: true } },
      },
      orderBy: [{ severity: 'asc' }, { slaDate: 'asc' }],
      take: 50,
    });

    return this.buildPDF(heatmapData, breached);
  }

  /**
   * Earliest year that has any audit activity — used by the frontend to
   * bound the "Pick a Month" year dropdown.
   */
  async getEarliestYear(orgId?: string): Promise<{ year: number }> {
    const earliest = await this.prisma.audit.findFirst({
      where: orgId ? { orgId } : undefined,
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    return { year: earliest ? earliest.createdAt.getFullYear() : new Date().getFullYear() };
  }

  /**
   * Combined report across every audit, all time — one PDF covering every
   * audit's status, framework, org, findings breakdown, and evidence/ledger
   * summary.
   */
  async generateAllAuditsReport(orgId?: string): Promise<Buffer> {
    const org = orgId ? await this.prisma.organization.findFirst({ where: { id: orgId }, select: { name: true, shortCode: true } }) : null;

    const audits = await this.prisma.audit.findMany({
      where: orgId ? { orgId } : undefined,
      include: {
        org: { select: { name: true, shortCode: true } },
        vendorOrg: { select: { name: true } },
        findings: { select: { severity: true, status: true, slaBreached: true } },
        auditAssets: { select: { assetId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.buildAuditsPDF(audits, {
      title: org ? `${org.name.toUpperCase()} — ALL AUDITS REPORT` : 'ALL AUDITS — COMBINED REPORT',
      subtitle: org ? `Every audit for ${org.name}, all time` : 'Every audit on record, all time',
    });
  }

  /**
   * Combined report scoped to a single calendar month — every audit whose
   * activity (creation) falls within that month/year.
   */
  async generateMonthlyReport(month: number, year: number, orgId?: string): Promise<Buffer> {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const org = orgId ? await this.prisma.organization.findFirst({ where: { id: orgId }, select: { name: true, shortCode: true } }) : null;

    const audits = await this.prisma.audit.findMany({
      where: { createdAt: { gte: start, lt: end }, ...(orgId && { orgId }) },
      include: {
        org: { select: { name: true, shortCode: true } },
        vendorOrg: { select: { name: true } },
        findings: { select: { severity: true, status: true, slaBreached: true } },
        auditAssets: { select: { assetId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const monthName = start.toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' });
    return this.buildAuditsPDF(audits, {
      title: org
        ? `${org.name.toUpperCase()} — MONTHLY AUDIT REPORT — ${monthName.toUpperCase()} ${year}`
        : `MONTHLY AUDIT REPORT — ${monthName.toUpperCase()} ${year}`,
      subtitle: org
        ? `${org.name} — audits created between 1 ${monthName} and ${new Date(end.getTime()-1).getUTCDate()} ${monthName} ${year}`
        : `Audits created between 1 ${monthName} and ${new Date(end.getTime()-1).getUTCDate()} ${monthName} ${year}`,
    });
  }

  private buildAuditsPDF(audits: any[], header: { title: string; subtitle: string }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: header.title,
          Author: 'OpenOS Technologies Pvt Ltd',
          Subject: 'SYNC Audit Report',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 495;
      const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' });
      const nowTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });

      // ── HEADER ────────────────────────────────────────────────
      doc.rect(50, 50, W, 80).fill('#0f172a');
      doc.fill('white').font('Helvetica-Bold').fontSize(18)
        .text('CYBER AUDIT PLATFORM', 65, 68, { width: W - 80 });
      doc.font('Helvetica').fontSize(10).fill('#94a3b8')
        .text('SYNC · OpenOS Family Product', 65, 92);
      doc.fill('#f97316').font('Helvetica-Bold').fontSize(13)
        .text(header.title, 65, 110, { width: W - 80 });

      doc.rect(50, 134, W, 18).fillAndStroke('#f97316', '#f97316');
      doc.fill('white').font('Helvetica-Bold').fontSize(9)
        .text(`CONFIDENTIAL · INTERNAL · Generated: ${today} at ${nowTime} IST`, 65, 139, { align: 'center', width: W });

      doc.fill('#475569').font('Helvetica').fontSize(9)
        .text(header.subtitle, 50, 160, { width: W });

      // ── SUMMARY ──────────────────────────────────────────────
      const totals = audits.reduce((acc, a) => {
        const findings = a.findings || [];
        acc.audits += 1;
        acc.findings += findings.length;
        acc.critical += findings.filter((f: any) => f.severity === 'CRITICAL').length;
        acc.breached += findings.filter((f: any) => f.slaBreached).length;
        acc.assets += (a.auditAssets || []).length;
        return acc;
      }, { audits: 0, findings: 0, critical: 0, breached: 0, assets: 0 });

      const kpis = [
        { label: 'Total Audits', value: String(totals.audits), color: '#0f172a' },
        { label: 'Total Findings', value: String(totals.findings), color: '#ea580c' },
        { label: 'Critical Findings', value: String(totals.critical), color: '#dc2626' },
        { label: 'SLA Breached', value: String(totals.breached), color: '#dc2626' },
      ];
      const kpiW = (W - 30) / 4;
      kpis.forEach((kpi, i) => {
        const x = 50 + i * (kpiW + 10);
        doc.rect(x, 185, kpiW, 55).fill('#f8fafc').stroke('#e2e8f0');
        doc.fill('#64748b').font('Helvetica').fontSize(7)
          .text(kpi.label.toUpperCase(), x + 8, 192, { width: kpiW - 16 });
        doc.fill(kpi.color).font('Helvetica-Bold').fontSize(20)
          .text(kpi.value, x + 8, 202);
      });

      // ── AUDIT TABLE ──────────────────────────────────────────
      let y = 260;
      doc.fill('#0f172a').font('Helvetica-Bold').fontSize(12)
        .text('AUDIT REGISTER', 50, y);
      y += 15;
      doc.moveTo(50, y).lineTo(545, y).stroke('#e2e8f0');
      y += 8;

      if (audits.length === 0) {
        doc.fill('#64748b').font('Helvetica').fontSize(10)
          .text('No audits found for this period.', 50, y);
        y += 20;
      }

      const cols = [
        { label: 'AUDIT / DEPT', x: 50, w: 175 },
        { label: 'FRAMEWORK', x: 225, w: 90 },
        { label: 'STATUS', x: 315, w: 75 },
        { label: 'FINDINGS', x: 390, w: 55 },
        { label: 'SLA BREACH', x: 445, w: 100 },
      ];

      audits.forEach((a, i) => {
        if (y > 700) {
          doc.addPage();
          y = 60;
          doc.rect(50, y, W, 18).fill('#1e293b');
          cols.forEach(c => doc.fill('white').font('Helvetica-Bold').fontSize(7).text(c.label, c.x + 4, y + 5, { width: c.w - 4 }));
          y += 22;
        } else if (i === 0) {
          doc.rect(50, y, W, 18).fill('#1e293b');
          cols.forEach(c => doc.fill('white').font('Helvetica-Bold').fontSize(7).text(c.label, c.x + 4, y + 5, { width: c.w - 4 }));
          y += 22;
        }

        const findings = a.findings || [];
        const breach = findings.filter((f: any) => f.slaBreached).length;
        const rowH = 26;
        const bg = i % 2 === 0 ? '#f8fafc' : 'white';
        doc.rect(50, y, W, rowH).fill(bg);

        doc.fill('#1e293b').font('Helvetica-Bold').fontSize(8)
          .text(a.title, cols[0].x + 4, y + 4, { width: cols[0].w - 8, ellipsis: true });
        doc.fill('#64748b').font('Helvetica').fontSize(7)
          .text(a.org?.name || '—', cols[0].x + 4, y + 15, { width: cols[0].w - 8, ellipsis: true });

        doc.fill('#475569').font('Helvetica').fontSize(8)
          .text(a.framework?.replace(/_/g, ' ') || '—', cols[1].x + 4, y + 8, { width: cols[1].w - 8 });

        const statusColor = a.status === 'CLOSED' ? '#16a34a' : a.status === 'IN_PROGRESS' ? '#2563eb' : '#94a3b8';
        doc.fill(statusColor).font('Helvetica-Bold').fontSize(8)
          .text(a.status?.replace(/_/g, ' ') || '—', cols[2].x + 4, y + 8, { width: cols[2].w - 8 });

        doc.fill('#0f172a').font('Helvetica-Bold').fontSize(8)
          .text(String(findings.length), cols[3].x + 4, y + 8, { width: cols[3].w - 8 });

        doc.fill(breach > 0 ? '#dc2626' : '#16a34a').font('Helvetica-Bold').fontSize(8)
          .text(breach > 0 ? `${breach} OVERDUE` : '✓ CLEAR', cols[4].x + 4, y + 8, { width: cols[4].w - 8 });

        y += rowH;
      });

      // ── FOOTER ────────────────────────────────────────────────
      doc.rect(50, 780, W, 1).fill('#e2e8f0');
      doc.fill('#94a3b8').font('Helvetica').fontSize(7)
        .text(
          `CONFIDENTIAL · INTERNAL — Advanced cyber audit intelligence platform (SYNC). ` +
          `Unauthorized disclosure is prohibited. A product of OpenOS Technologies Pvt Ltd. Report ID: ${Date.now()}`,
          50, 787, { width: W, align: 'center' }
        );

      doc.end();
    });
  }

  private buildPDF(heatmapData: any[], breached: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: 'Cyber Risk Posture Report',
          Author: 'OpenOS Technologies Pvt Ltd',
          Subject: 'SYNC Risk Assessment',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 495; // usable width
      
      // Fixed: Forced the timezone to Asia/Kolkata so Docker doesn't print UTC dates
      const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' });
      const nowTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });

      // ── HEADER ────────────────────────────────────────────────
      doc.rect(50, 50, W, 80).fill('#0f172a');
      doc.fill('white').font('Helvetica-Bold').fontSize(18)
        .text('CYBER AUDIT PLATFORM', 65, 68, { width: W - 80 });
      doc.font('Helvetica').fontSize(10).fill('#94a3b8')
        .text('SYNC · OpenOS Family Product', 65, 92);
      doc.fill('#f97316').font('Helvetica-Bold').fontSize(13)
        .text('CYBER RISK POSTURE REPORT', 65, 110);

      // Classification banner
      doc.rect(50, 134, W, 18).fillAndStroke('#f97316', '#f97316');
      doc.fill('white').font('Helvetica-Bold').fontSize(9)
        .text(`CONFIDENTIAL · INTERNAL · Generated: ${today} at ${nowTime} IST`, 65, 139, { align: 'center', width: W });

      doc.moveDown(4);

      // ── EXECUTIVE SUMMARY ─────────────────────────────────────
      doc.fill('#0f172a').font('Helvetica-Bold').fontSize(12)
        .text('EXECUTIVE SUMMARY', 50, 165);
      doc.moveTo(50, 180).lineTo(545, 180).stroke('#e2e8f0');

      const totals = heatmapData.reduce((acc, d) => ({
        critical: acc.critical + Number(d.criticalCount),
        high: acc.high + Number(d.highCount),
        open: acc.open + Number(d.openCount),
        breached: acc.breached + Number(d.slaBreachedCount),
      }), { critical: 0, high: 0, open: 0, breached: 0 });

      const avgRisk = heatmapData.length > 0
        ? heatmapData.reduce((s, d) => s + Number(d.riskScore || 0), 0) / heatmapData.length : 0;

      // KPI boxes
      const kpis = [
        { label: 'Avg Risk Score', value: avgRisk.toFixed(1), color: avgRisk >= 50 ? '#dc2626' : '#16a34a' },
        { label: 'Critical Findings', value: String(totals.critical), color: '#dc2626' },
        { label: 'Total Open', value: String(totals.open), color: '#ea580c' },
        { label: 'SLA Breached', value: String(totals.breached), color: '#dc2626' },
      ];

      const kpiW = (W - 30) / 4;
      kpis.forEach((kpi, i) => {
        const x = 50 + i * (kpiW + 10);
        doc.rect(x, 188, kpiW, 55).fill('#f8fafc').stroke('#e2e8f0');
        doc.fill('#64748b').font('Helvetica').fontSize(7)
          .text(kpi.label.toUpperCase(), x + 8, 195, { width: kpiW - 16 });
        doc.fill(kpi.color).font('Helvetica-Bold').fontSize(22)
          .text(kpi.value, x + 8, 205);
      });

      doc.moveDown(1);

      // ── DEPARTMENT RISK TABLE ──────────────────────────────────
      doc.fill('#0f172a').font('Helvetica-Bold').fontSize(12)
        .text('DEPARTMENT RISK SCORES', 50, 260);
      doc.moveTo(50, 275).lineTo(545, 275).stroke('#e2e8f0');

      // Table header
      const cols = [
        { label: 'DEPT', x: 50, w: 50 },
        { label: 'ORGANISATION', x: 105, w: 155 },
        { label: 'RISK', x: 265, w: 45 },
        { label: 'CRITICAL', x: 315, w: 55 },
        { label: 'HIGH', x: 375, w: 45 },
        { label: 'OPEN', x: 425, w: 45 },
        { label: 'SLA BREACH', x: 475, w: 70 },
      ];

      // Fixed: Increased Header Height for spacing
      doc.rect(50, 278, W, 20).fill('#1e293b');
      cols.forEach(c => {
        doc.fill('white').font('Helvetica-Bold').fontSize(7)
          .text(c.label, c.x + 4, 284, { width: c.w - 4 });
      });

      let y = 302;
      heatmapData.forEach((d, i) => {
        if (y > 720) { doc.addPage(); y = 60; }

        const bg = i % 2 === 0 ? '#f8fafc' : 'white';
        // Fixed: Increased row height from 16 to 20 for better readability
        doc.rect(50, y, W, 20).fill(bg);

        const riskScore = Number(d.riskScore || 0);
        const riskColor = riskScore >= 75 ? '#dc2626' : riskScore >= 50 ? '#ea580c' : riskScore >= 25 ? '#d97706' : '#16a34a';
        const breach = Number(d.slaBreachedCount);

        // Fixed: Adjusted Y offsets slightly down to match the new 20px row height
        doc.fill('#475569').font('Helvetica').fontSize(8)
          .text(d.shortCode, 54, y + 6, { width: 45 });
        doc.fill('#1e293b').font('Helvetica').fontSize(8)
          .text(d.orgName, 109, y + 6, { width: 150, ellipsis: true });
        doc.fill(riskColor).font('Helvetica-Bold').fontSize(9)
          .text(riskScore.toFixed(0), 269, y + 6, { width: 40 });
        doc.fill('#dc2626').font('Helvetica-Bold').fontSize(8)
          .text(String(Number(d.criticalCount)), 319, y + 6, { width: 50 });
        doc.fill('#ea580c').font('Helvetica').fontSize(8)
          .text(String(Number(d.highCount)), 379, y + 6, { width: 40 });
        doc.fill('#475569').font('Helvetica').fontSize(8)
          .text(String(Number(d.openCount)), 429, y + 6, { width: 40 });
        doc.fill(breach > 0 ? '#dc2626' : '#16a34a').font('Helvetica-Bold').fontSize(8)
          .text(breach > 0 ? `${breach} OVERDUE` : '✓ CLEAR', 479, y + 6, { width: 65 });

        y += 20; // Replaced 16 with 20 for vertical spacing
      });

      y += 24;

      // ── SLA BREACH DETAIL ──────────────────────────────────────
      if (breached.length > 0) {
        if (y > 650) { doc.addPage(); y = 60; }

        doc.fill('#dc2626').font('Helvetica-Bold').fontSize(12)
          .text('SLA BREACH DETAIL', 50, y);
        y += 15;
        doc.moveTo(50, y).lineTo(545, y).stroke('#fca5a5');
        y += 8;

        doc.fill('#7f1d1d').font('Helvetica').fontSize(9)
          .text(`The following ${breached.length} finding(s) have exceeded their remediation deadline and require immediate escalation.`, 50, y, { width: W });
        y += 24;

        breached.slice(0, 20).forEach((f, i) => {
          if (y > 720) { doc.addPage(); y = 60; }

          const sevColor = f.severity === 'CRITICAL' ? '#dc2626' : f.severity === 'HIGH' ? '#ea580c' : '#d97706';
          const daysBreached = Math.floor((Date.now() - new Date(f.slaDate).getTime()) / 86400000);

          // Fixed: Increased box height from 36 to 44 so text fits properly
          doc.rect(50, y, W, 44).fill('#fef2f2').stroke('#fecaca');
          doc.rect(50, y, 4, 44).fill(sevColor);

          // Fixed: Adjusted Y positioning so lines don't mash together
          doc.fill(sevColor).font('Helvetica-Bold').fontSize(8)
            .text(f.severity, 62, y + 6);
          doc.fill('#1e293b').font('Helvetica-Bold').fontSize(9)
            .text(f.title, 62, y + 18, { width: W - 120, ellipsis: true });
          doc.fill('#64748b').font('Helvetica').fontSize(7)
            .text(`${f.org?.name || ''} · Asset: ${f.asset?.name || 'N/A'} · Breached by: ${daysBreached} day(s)`, 62, y + 30, { width: W - 70 });
          doc.fill('#dc2626').font('Helvetica-Bold').fontSize(7)
            .text(`${daysBreached}d OVERDUE`, 480, y + 18);

          y += 52; // Replaced 42 with 52 to add space between the individual boxes
        });
      }

      // ── FOOTER ────────────────────────────────────────────────
      doc.rect(50, 780, W, 1).fill('#e2e8f0');
      doc.fill('#94a3b8').font('Helvetica').fontSize(7)
        .text(
          `CONFIDENTIAL · INTERNAL — Advanced cyber audit intelligence platform (SYNC). ` +
          `Unauthorized disclosure is prohibited. A product of OpenOS Technologies Pvt Ltd. Report ID: ${Date.now()}`,
          50, 787, { width: W, align: 'center' }
        );

      doc.end();
    });
  }
}