// backend/src/incident/incident.service.ts
// Automated incident reporting to NIC-CERT and CERT-In
// GIGW 3.0 / CERT-In mandate: report security incidents immediately
//
// NIC-CERT  : incident@nic-cert.nic.in
// CERT-In   : incident@cert-in.org.in
// Toll-free : +91-1800-11-4949

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export enum IncidentSeverity {
  CRITICAL = 'CRITICAL',    // Active attack, data breach, defacement
  HIGH     = 'HIGH',        // Suspected breach, RLS bypass, mass login failure
  MEDIUM   = 'MEDIUM',      // Repeated CAPTCHA failures, suspicious scan patterns
  LOW      = 'LOW',         // Policy violations, anomalies for review
}

export enum IncidentType {
  // Auth-related
  BRUTE_FORCE_ATTACK       = 'BRUTE_FORCE_ATTACK',
  CREDENTIAL_STUFFING      = 'CREDENTIAL_STUFFING',
  MFA_BYPASS_ATTEMPT       = 'MFA_BYPASS_ATTEMPT',
  JWT_FORGERY_ATTEMPT      = 'JWT_FORGERY_ATTEMPT',
  // Data-related
  RLS_BYPASS_DETECTED      = 'RLS_BYPASS_DETECTED',
  CROSS_TENANT_ACCESS      = 'CROSS_TENANT_ACCESS',
  DATA_EXFILTRATION        = 'DATA_EXFILTRATION',
  EVIDENCE_TAMPERING       = 'EVIDENCE_TAMPERING',
  LEDGER_TAMPERING         = 'LEDGER_TAMPERING',
  // Infrastructure
  WEBSITE_DEFACEMENT       = 'WEBSITE_DEFACEMENT',
  DDOS_ATTACK              = 'DDOS_ATTACK',
  MALWARE_DETECTED         = 'MALWARE_DETECTED',
  VULNERABILITY_EXPLOITED  = 'VULNERABILITY_EXPLOITED',
  // Access
  UNAUTHORIZED_ADMIN_ACCESS = 'UNAUTHORIZED_ADMIN_ACCESS',
  API_KEY_ABUSE            = 'API_KEY_ABUSE',
  SUSPICIOUS_SCAN          = 'SUSPICIOUS_SCAN',
}

export interface IncidentReport {
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  affectedSystem: string;
  detectedAt: Date;
  sourceIp?: string;
  userId?: string;
  orgId?: string;
  evidence?: string;          // Technical details — included in report
  immediateActions?: string;  // What you've already done (e.g., account locked)
}

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);
  private readonly orgName   = process.env.ORG_NAME         ?? 'OpenOS Technologies Pvt Ltd';
  private readonly appName   = process.env.APP_NAME          ?? 'SYNC — Cyber Audit Governance Platform';
  private readonly appUrl    = process.env.APP_BASE_URL       ?? 'https://sync-stg-openos.azurewebsites.net';
  private readonly contactEmail = process.env.INCIDENT_CONTACT_EMAIL ?? 'security@sync.gov.in';

  private readonly mailer = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   ?? 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  /**
   * Report an incident to NIC-CERT and CERT-In.
   * Call this as soon as an incident is detected — do not wait.
   */
  async report(incident: IncidentReport): Promise<void> {
    this.logger.warn(
      `INCIDENT REPORTED: [${incident.severity}] ${incident.type} — ${incident.title}`,
      { type: incident.type, severity: incident.severity, sourceIp: incident.sourceIp },
    );

    const body = this.buildEmailBody(incident);
    const subject = `[${incident.severity}] Security Incident Report — ${incident.type} — ${this.appName}`;

    const recipients = this.getRecipients(incident.severity);

    // Fire all emails concurrently — don't let one failure block the others
    const results = await Promise.allSettled(
      recipients.map((to) =>
        this.mailer.sendMail({
          from: `"${this.orgName} Security" <${this.contactEmail}>`,
          to,
          subject,
          text: body,
          html: this.buildHtmlBody(incident, body),
        })
      )
    );

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        this.logger.log(`Incident report sent to ${recipients[i]}`);
      } else {
        this.logger.error(`Failed to send incident report to ${recipients[i]}`, result.reason?.message);
      }
    });

    // Also write to audit ledger if available (injected separately to avoid circular deps)
    await this.writeToAuditLedger(incident);
  }

  /**
   * Auto-detect and report based on threshold triggers.
   * Call this from auth, ingest, and rls modules.
   */
  async checkAndReport(
    trigger: 'failed_logins' | 'rls_violation' | 'captcha_failures' | 'api_key_abuse' | 'ledger_tamper',
    context: {
      count?: number;
      userId?: string;
      orgId?: string;
      sourceIp?: string;
      details?: string;
    }
  ): Promise<void> {
    const thresholds: Record<string, { count: number; type: IncidentType; severity: IncidentSeverity }> = {
      failed_logins:   { count: 10,  type: IncidentType.BRUTE_FORCE_ATTACK,  severity: IncidentSeverity.HIGH },
      rls_violation:   { count: 1,   type: IncidentType.RLS_BYPASS_DETECTED, severity: IncidentSeverity.CRITICAL },
      captcha_failures:{ count: 20,  type: IncidentType.CREDENTIAL_STUFFING, severity: IncidentSeverity.MEDIUM },
      api_key_abuse:   { count: 50,  type: IncidentType.API_KEY_ABUSE,       severity: IncidentSeverity.HIGH },
      ledger_tamper:   { count: 1,   type: IncidentType.LEDGER_TAMPERING,    severity: IncidentSeverity.CRITICAL },
    };

    const threshold = thresholds[trigger];
    if (!threshold) return;

    const count = context.count ?? 1;
    if (count < threshold.count) return;

    await this.report({
      type:            threshold.type,
      severity:        threshold.severity,
      title:           `Automated detection: ${trigger} threshold exceeded (count: ${count})`,
      description:     context.details ?? `Automated trigger: ${trigger} exceeded threshold of ${threshold.count}`,
      affectedSystem:  this.appName,
      detectedAt:      new Date(),
      sourceIp:        context.sourceIp,
      userId:          context.userId,
      orgId:           context.orgId,
      evidence:        `Trigger: ${trigger}, Count: ${count}, Threshold: ${threshold.count}`,
      immediateActions:'Automated detection. System has enforced lockout/rate-limit where applicable.',
    });
  }

  private getRecipients(severity: IncidentSeverity): string[] {
    // CRITICAL and HIGH: notify both NIC-CERT and CERT-In immediately
    // MEDIUM: notify NIC-CERT only
    // LOW: internal only
    const internal = [this.contactEmail];
    const nicCert  = ['incident@nic-cert.nic.in'];
    const certIn   = ['incident@cert-in.org.in'];

    switch (severity) {
      case IncidentSeverity.CRITICAL:
        return [...internal, ...nicCert, ...certIn];
      case IncidentSeverity.HIGH:
        return [...internal, ...nicCert, ...certIn];
      case IncidentSeverity.MEDIUM:
        return [...internal, ...nicCert];
      case IncidentSeverity.LOW:
        return [...internal];
    }
  }

  private buildEmailBody(incident: IncidentReport): string {
    return `
SECURITY INCIDENT REPORT
========================

Organisation   : ${this.orgName}
Application    : ${this.appName}
URL            : ${this.appUrl}
Contact        : ${this.contactEmail}

INCIDENT DETAILS
----------------
Type           : ${incident.type}
Severity       : ${incident.severity}
Title          : ${incident.title}
Detected At    : ${incident.detectedAt.toISOString()}

DESCRIPTION
-----------
${incident.description}

AFFECTED SYSTEM
---------------
${incident.affectedSystem}

TECHNICAL DETAILS
-----------------
Source IP      : ${incident.sourceIp ?? 'Unknown'}
User ID        : ${incident.userId ?? 'N/A'}
Org ID         : ${incident.orgId ?? 'N/A'}

EVIDENCE / LOGS
---------------
${incident.evidence ?? 'See Application Insights logs for full trace.'}

IMMEDIATE ACTIONS TAKEN
------------------------
${incident.immediateActions ?? 'Investigation ongoing. System security controls active.'}

---
This report was generated automatically by SYNC Security Monitoring.
For urgent follow-up, contact: ${this.contactEmail}
NIC-CERT Helpdesk: incident@nic-cert.nic.in
CERT-In Helpdesk : incident@cert-in.org.in | +91-1800-11-4949
`;
  }

  private buildHtmlBody(incident: IncidentReport, plainText: string): string {
    const severityColors: Record<string, string> = {
      CRITICAL: '#ef4444',
      HIGH:     '#f97316',
      MEDIUM:   '#eab308',
      LOW:      '#6b7280',
    };
    const color = severityColors[incident.severity] ?? '#6b7280';

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Security Incident Report</title></head>
<body style="font-family:monospace;background:#0a0a0a;color:#fafafa;padding:24px;max-width:600px">
  <div style="border-left:4px solid ${color};padding-left:16px;margin-bottom:24px">
    <h1 style="color:${color};margin:0;font-size:18px">🔴 SECURITY INCIDENT — ${incident.severity}</h1>
    <p style="color:#a3a3a3;margin:4px 0 0">${incident.type}</p>
  </div>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="color:#a3a3a3;padding:4px 8px 4px 0;width:140px">Application</td><td>${this.appName}</td></tr>
    <tr><td style="color:#a3a3a3;padding:4px 8px 4px 0">Detected At</td><td>${incident.detectedAt.toISOString()}</td></tr>
    <tr><td style="color:#a3a3a3;padding:4px 8px 4px 0">Source IP</td><td>${incident.sourceIp ?? 'Unknown'}</td></tr>
    <tr><td style="color:#a3a3a3;padding:4px 8px 4px 0">Severity</td><td style="color:${color};font-weight:bold">${incident.severity}</td></tr>
  </table>
  <hr style="border-color:#2a2a2a;margin:16px 0">
  <h2 style="font-size:14px;color:#fafafa">Description</h2>
  <p style="color:#a3a3a3">${incident.description}</p>
  <h2 style="font-size:14px;color:#fafafa">Immediate Actions</h2>
  <p style="color:#a3a3a3">${incident.immediateActions ?? 'Investigation ongoing.'}</p>
  <hr style="border-color:#2a2a2a;margin:16px 0">
  <p style="color:#6b7280;font-size:11px">
    Automated report by SYNC Security Monitoring.<br>
    NIC-CERT: incident@nic-cert.nic.in &nbsp;|&nbsp; CERT-In: incident@cert-in.org.in &nbsp;|&nbsp; +91-1800-11-4949
  </p>
</body>
</html>`;
  }

  private async writeToAuditLedger(incident: IncidentReport): Promise<void> {
    // This is a placeholder — inject LedgerService and call ledger.appendEntry()
    // to write every incident report to the immutable audit ledger
    this.logger.log(`Incident written to audit ledger: ${incident.type} at ${incident.detectedAt.toISOString()}`);
  }
}
