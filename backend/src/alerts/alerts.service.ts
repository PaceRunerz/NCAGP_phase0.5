// ─────────────────────────────────────────────────────────────────
// SYNC — Login Notification Service (Event-Driven, All Roles)
// File: src/alerts/alerts.service.ts
// ─────────────────────────────────────────────────────────────────

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

// Role display map — converts DB enum to human-readable label
const ROLE_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  NIC_ADMIN:     { label: 'NIC Admin',        color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  DEPT_CISO:     { label: 'Dept CISO',         color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  DEPT_SECURITY: { label: 'Dept Security',     color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
  VENDOR_ADMIN:  { label: 'Vendor Admin',      color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
  AUDITOR:       { label: 'Auditor',           color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  REVIEWER:      { label: 'Reviewer',          color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  OBSERVER:      { label: 'Observer',          color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

type Metric = { label: string; value: string; color: string };
type FindingRow = { severity: string; title: string; slaDate: Date | null; status: string; orgName?: string };

interface EmailContext {
  // What this login's dashboard is actually scoped to — shown in the
  // email so it's obvious this data matches what they'd see in the portal,
  // not a generic canned summary.
  scopeLabel: string;
  metrics: Metric[];
  findings: FindingRow[];
  findingsTableTitle: string;
  topOrgs: { name: string; shortCode: string; count: number }[];
  auditsByStatus: { status: string; count: number }[];
}

@Injectable()
export class AlertsService implements OnModuleInit {
  private readonly logger = new Logger(AlertsService.name);
  private transporter: Transporter | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    const smtpUser = this.config.get('SMTP_USER');
    const smtpPass = this.config.get('SMTP_PASS');

    if (!smtpUser || !smtpPass) {
      this.logger.warn('SMTP not configured — Login alerts disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host:   'smtp.gmail.com',
      port:   587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    this.logger.log('SLA alert service ready. Mode: All-Roles Login Trigger, role-scoped content.');
  }

  /**
   * Builds the data for this login's email, correctly scoped per role.
   *
   * IMPORTANT FIX: the previous version always filtered findings by
   * `orgId: user.orgId` for every role. That's correct for DEPT_CISO and
   * DEPT_SECURITY (their orgId IS the department being audited, which is
   * also `Finding.orgId`). It is WRONG for AUDITOR and VENDOR_ADMIN —
   * their orgId is a vendor firm. `Finding.orgId` is always "the
   * department being audited", never the vendor. So the old query
   * silently returned zero findings for every Auditor/Vendor Admin
   * login — their emails always said "No SLA Breaches" regardless of
   * what was actually happening on their audits. This version scopes
   * Auditor/Vendor Admin by their actual assigned audits
   * (`Audit.vendorOrgId` / `Audit.auditLeadId`) instead.
   *
   * It's also NOT the same generic content for every role — each role
   * gets the metrics actually relevant to what they do in the portal,
   * matching their own dashboard rather than one-size-fits-all.
   */
  private async gatherEmailContext(user: { id: string; orgId: string; role: string }): Promise<EmailContext> {
    const NOT_TERMINAL = { notIn: ['CLOSED', 'FALSE_POSITIVE', 'RISK_ACCEPTED'] as any };

    // ── NIC_ADMIN / REVIEWER — national, cross-department scope ──
    if (user.role === 'NIC_ADMIN' || user.role === 'REVIEWER') {
      const [totalOpen, totalCritical, totalBreached, topOrgsRaw, auditsByStatusRaw] = await Promise.all([
        this.prisma.finding.count({ where: { status: NOT_TERMINAL } }),
        this.prisma.finding.count({ where: { severity: 'CRITICAL', status: NOT_TERMINAL } }),
        this.prisma.finding.count({ where: { slaBreached: true, status: NOT_TERMINAL } }),
        this.prisma.finding.groupBy({
          by: ['orgId'], where: { status: NOT_TERMINAL },
          _count: { _all: true }, orderBy: { _count: { orgId: 'desc' } }, take: 5,
        }),
        this.prisma.audit.groupBy({ by: ['status'], _count: { _all: true } }),
      ]);

      const orgs = await this.prisma.organization.findMany({
        where: { id: { in: topOrgsRaw.map(o => o.orgId) } },
        select: { id: true, name: true, shortCode: true },
      });
      const orgMap = new Map<string, { name: string; shortCode: string }>(
        orgs.map(o => [o.id, { name: o.name, shortCode: o.shortCode }])
      );

      return {
        scopeLabel: 'National — All Departments',
        metrics: [
          { label: 'Open Findings (National)', value: String(totalOpen), color: '#1d4ed8' },
          { label: 'Critical (Open)', value: String(totalCritical), color: '#dc2626' },
          { label: 'SLA Breached (National)', value: String(totalBreached), color: '#ea580c' },
        ],
        findings: [],
        findingsTableTitle: '',
        topOrgs: topOrgsRaw.map(o => ({
          name: orgMap.get(o.orgId)?.name || 'Unknown Department',
          shortCode: orgMap.get(o.orgId)?.shortCode || '—',
          count: o._count._all,
        })),
        auditsByStatus: auditsByStatusRaw.map(a => ({ status: a.status, count: a._count._all })),
      };
    }

    // ── AUDITOR / VENDOR_ADMIN — scoped by their actual assigned audits,
    // NOT by orgId (see fix note above) ──
    if (user.role === 'AUDITOR' || user.role === 'VENDOR_ADMIN') {
      const audits = await this.prisma.audit.findMany({
        where: user.role === 'VENDOR_ADMIN'
          ? { vendorOrgId: user.orgId }
          : { OR: [{ vendorOrgId: user.orgId }, { auditLeadId: user.id }] },
        select: { id: true, status: true },
      });
      const auditIds = audits.map(a => a.id);

      const [findingsRaw, pendingValidation] = await Promise.all([
        auditIds.length
          ? this.prisma.finding.findMany({
              where: { auditId: { in: auditIds }, slaBreached: true, status: NOT_TERMINAL },
              include: { org: { select: { name: true } } },
              orderBy: [{ severity: 'asc' }, { slaDate: 'asc' }],
            })
          : Promise.resolve([]),
        auditIds.length
          ? this.prisma.finding.count({ where: { auditId: { in: auditIds }, status: 'REMEDIATED_PENDING_VALIDATION' } })
          : Promise.resolve(0),
      ]);

      const metrics: Metric[] = [
        { label: 'Assigned Audits', value: String(audits.length), color: '#0f766e' },
        { label: 'Pending Your Validation', value: String(pendingValidation), color: '#b45309' },
        { label: 'SLA Breached (Your Audits)', value: String(findingsRaw.length), color: '#dc2626' },
      ];

      if (user.role === 'VENDOR_ADMIN') {
        const vendor = await this.prisma.vendor.findUnique({ where: { orgId: user.orgId }, select: { trustScore: true, isBlacklisted: true } });
        if (vendor) {
          metrics.push({
            label: 'Vendor Trust Score',
            value: `${vendor.trustScore.toFixed(0)}/100`,
            color: vendor.isBlacklisted ? '#dc2626' : vendor.trustScore >= 70 ? '#15803d' : vendor.trustScore >= 40 ? '#b45309' : '#dc2626',
          });
        }
      }

      return {
        scopeLabel: user.role === 'VENDOR_ADMIN' ? 'Your Vendor Firm — Assigned Audits' : 'Your Assigned Audits',
        metrics,
        findings: findingsRaw.map(f => ({ severity: f.severity, title: f.title, slaDate: f.slaDate, status: f.status, orgName: f.org?.name })),
        findingsTableTitle: 'Breached Findings on Your Audits',
        topOrgs: [],
        auditsByStatus: [],
      };
    }

    // ── OBSERVER — most restricted, single national summary number only,
    // matching the "summary view, no detail" access they get in the portal ──
    if (user.role === 'OBSERVER') {
      const totalOpen = await this.prisma.finding.count({ where: { status: NOT_TERMINAL } });
      return {
        scopeLabel: 'National Summary (Read-Only)',
        metrics: [{ label: 'Open Findings (National)', value: String(totalOpen), color: '#6b7280' }],
        findings: [],
        findingsTableTitle: '',
        topOrgs: [],
        auditsByStatus: [],
      };
    }

    // ── DEPT_CISO / DEPT_SECURITY — department scope (orgId IS the
    // department here, so the original org-scoped query is correct) ──
    const [findingsRaw, pendingAck, inRemediation, auditsInProgress] = await Promise.all([
      this.prisma.finding.findMany({
        where: { orgId: user.orgId, slaBreached: true, status: NOT_TERMINAL },
        include: { org: { select: { name: true } } },
        orderBy: [{ severity: 'asc' }, { slaDate: 'asc' }],
      }),
      this.prisma.finding.count({ where: { orgId: user.orgId, status: 'OPEN' } }),
      this.prisma.finding.count({ where: { orgId: user.orgId, status: 'IN_REMEDIATION' } }),
      this.prisma.audit.count({ where: { orgId: user.orgId, status: { in: ['IN_PROGRESS', 'FINDINGS_SUBMITTED', 'REMEDIATION', 'VALIDATION'] } } }),
    ]);

    const metrics: Metric[] = user.role === 'DEPT_CISO'
      ? [
          { label: 'Awaiting Your Acknowledgement', value: String(pendingAck), color: '#b45309' },
          { label: 'Audits In Progress', value: String(auditsInProgress), color: '#1d4ed8' },
        ]
      : [
          { label: 'In Remediation (Your Queue)', value: String(inRemediation), color: '#b45309' },
          { label: 'Awaiting Acknowledgement (Dept)', value: String(pendingAck), color: '#6b7280' },
        ];

    return {
      scopeLabel: 'Your Department',
      metrics,
      findings: findingsRaw.map(f => ({ severity: f.severity, title: f.title, slaDate: f.slaDate, status: f.status, orgName: f.org?.name })),
      findingsTableTitle: 'Breached Findings Requiring Attention',
      topOrgs: [],
      auditsByStatus: [],
    };
  }

  /**
   * Called every time ANY user logs in — all 7 roles. Content is scoped
   * to what that role actually sees/does in the portal (see
   * gatherEmailContext above), not a one-size-fits-all summary.
   */
  async sendLoginBreachAlert(user: {
    id:        string;
    name:      string;
    email:     string;
    orgId:     string;
    role:      string;
    loginTime: Date;
  }): Promise<void> {
    if (!this.transporter) return;

    try {
      const ctx = await this.gatherEmailContext(user);
      const criticalCount = ctx.findings.filter((f) => f.severity === 'CRITICAL').length;

      const loginTimestamp = user.loginTime.toLocaleString('en-IN', {
        timeZone:  'Asia/Kolkata',
        day:       '2-digit',
        month:     'short',
        year:      'numeric',
        hour:      '2-digit',
        minute:    '2-digit',
        second:    '2-digit',
        hour12:    false,
      });

      const roleInfo = ROLE_LABELS[user.role] ?? {
        label:  user.role.replace(/_/g, ' '),
        color:  '#6b7280',
        bg:     '#f9fafb',
        border: '#e5e7eb',
      };

      const findingRows = ctx.findings
        .map((f) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:${
              f.severity === 'CRITICAL' ? '#dc2626' :
              f.severity === 'HIGH'     ? '#ea580c' :
              f.severity === 'MEDIUM'   ? '#d97706' : '#6b7280'
            };">${f.severity}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;">${f.title}</td>
            ${f.orgName ? `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${f.orgName}</td>` : ''}
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${
              f.slaDate
                ? new Date(f.slaDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'
            }</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151;">${f.status.replace(/_/g, ' ')}</td>
          </tr>
        `)
        .join('');

      const showOrgColumn = ctx.findings.some(f => f.orgName);

      const metricsHtml = ctx.metrics.map(m => `
        <div style="flex:1;background:${m.color}0d;border:1px solid ${m.color}33;border-radius:8px;padding:14px;text-align:center;min-width:0;">
          <div style="font-size:28px;font-weight:700;color:${m.color};">${m.value}</div>
          <div style="font-size:10.5px;color:${m.color};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px;opacity:0.85;">${m.label}</div>
        </div>
      `).join('');

      const topOrgsHtml = ctx.topOrgs.length ? `
        <div style="margin-bottom:20px;">
          <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">
            Top At-Risk Departments
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <tbody>
              ${ctx.topOrgs.map((o, i) => `
                <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                  <td style="padding:9px 12px;font-size:12.5px;color:#111827;font-weight:600;border-bottom:1px solid #e5e7eb;">${i + 1}. ${o.name} <span style="color:#9ca3af;font-weight:400;">[${o.shortCode}]</span></td>
                  <td style="padding:9px 12px;font-size:12.5px;color:#dc2626;font-weight:700;text-align:right;border-bottom:1px solid #e5e7eb;">${o.count} open</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '';

      const auditsByStatusHtml = ctx.auditsByStatus.length ? `
        <div style="margin-bottom:20px;">
          <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">
            Audits by Status (National)
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${ctx.auditsByStatus.map(a => `
              <span style="display:inline-block;padding:5px 12px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb;font-size:11.5px;color:#374151;">
                <strong>${a.count}</strong> ${a.status.replace(/_/g, ' ')}
              </span>
            `).join('')}
          </div>
        </div>
      ` : '';

      const findingsSectionHtml = ctx.findingsTableTitle
        ? (ctx.findings.length === 0
            ? `<div style="text-align:center;padding:32px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:20px;">
                <div style="font-size:32px;margin-bottom:8px;">✅</div>
                <div style="font-size:16px;font-weight:600;color:#15803d;">No SLA Breaches</div>
                <div style="font-size:13px;color:#166534;margin-top:4px;">Nothing in your scope is currently overdue.</div>
               </div>`
            : `<div style="margin-bottom:20px;">
                <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">
                  ${ctx.findingsTableTitle}
                </div>
                <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                  <thead>
                    <tr style="background:#f9fafb;">
                      <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid #e5e7eb;">Severity</th>
                      <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid #e5e7eb;">Finding</th>
                      ${showOrgColumn ? `<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid #e5e7eb;">Department</th>` : ''}
                      <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid #e5e7eb;">SLA Date</th>
                      <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid #e5e7eb;">Status</th>
                    </tr>
                  </thead>
                  <tbody>${findingRows}</tbody>
                </table>
               </div>`)
        : '';

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width,initial-scale=1"/>
        </head>
        <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
          <div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

            <!-- Header -->
            <div style="background:linear-gradient(135deg,#1a3a6e,#1a56db);padding:28px 32px;">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;">
                  <span style="font-size:20px;">🛡️</span>
                </div>
                <div>
                  <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">Government of India · NIC</div>
                  <div style="color:#ffffff;font-size:18px;font-weight:700;margin-top:2px;">SYNC — Login Notification</div>
                </div>
              </div>
            </div>

            <!-- Login context bar -->
            <div style="background:#fef9c3;border-bottom:1px solid #fde68a;padding:14px 32px;">
              <div style="font-size:12px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">
                Login Session Detected
              </div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;background:${roleInfo.bg};color:${roleInfo.color};border:1px solid ${roleInfo.border};">
                  ${roleInfo.label}
                </span>
                <span style="font-size:13px;color:#78350f;">
                  <strong>${user.name}</strong>
                  &nbsp;·&nbsp;
                  ${user.email}
                  &nbsp;·&nbsp;
                  <strong>${loginTimestamp} IST</strong>
                </span>
              </div>
            </div>

            <!-- Body -->
            <div style="padding:28px 32px;">
              <p style="font-size:15px;color:#111827;margin:0 0 6px;">
                Dear <strong>${user.name}</strong>,
              </p>
              <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 8px;">
                A login to the SYNC portal was detected using your credentials.
                Everything below reflects <strong>exactly what your ${roleInfo.label} dashboard shows right now</strong> —
                scoped to <strong>${ctx.scopeLabel}</strong>, the same as when you're signed in.
              </p>

              <!-- Role / scope info block -->
              <div style="margin-bottom:20px;padding:14px 16px;border-radius:8px;background:${roleInfo.bg};border:1px solid ${roleInfo.border};">
                <div style="font-size:11px;font-weight:700;color:${roleInfo.color};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">
                  Access Level · Data Scope
                </div>
                <div style="font-size:14px;font-weight:600;color:${roleInfo.color};">
                  ${roleInfo.label} — ${ctx.scopeLabel}
                </div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">
                  If this login was not you, contact your administrator immediately.
                </div>
              </div>

              <!-- Role-specific metrics -->
              <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
                ${metricsHtml}
              </div>

              ${topOrgsHtml}
              ${auditsByStatusHtml}
              ${findingsSectionHtml}

              <!-- CTA -->
              <div style="text-align:center;margin-top:24px;">
                <a href="${this.config.get('FRONTEND_URL') || 'http://localhost:3001'}/dashboard"
                   style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#1a56db,#1345b0);color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.04em;">
                  Open SYNC Dashboard →
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;">
              <div style="font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;">
                Login by <strong style="color:#6b7280;">${roleInfo.label} · ${user.name}</strong>
                (${user.email}) at ${loginTimestamp} IST<br/>
                National Informatics Centre · MeitY · Government of India<br/>
                This is an automated security alert. Do not reply to this email.
              </div>
            </div>

          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from:    `"SYNC Security Alerts" <${this.config.get('SMTP_USER')}>`,
        to:      user.email,
        subject: `🔐 SYNC Login — ${roleInfo.label} · ${user.name} · ${loginTimestamp} IST`,
        html:    emailHtml,
      });

      this.logger.log(
        `Login alert sent → ${user.email} [${roleInfo.label}] scope=${ctx.scopeLabel} — ${ctx.findings.length} breaches, ${criticalCount} critical`,
      );
    } catch (error: any) {
      // Never let email failure block login
      this.logger.warn(`Login alert failed for ${user.email}: ${error.message}`);
    }
  }
}
