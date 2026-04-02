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
var AlertsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const nodemailer = require("nodemailer");
let AlertsService = AlertsService_1 = class AlertsService {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
        this.logger = new common_1.Logger(AlertsService_1.name);
        this.transporter = null;
        this.intervalId = null;
    }
    onModuleInit() {
        const smtpUser = this.config.get('SMTP_USER');
        const smtpPass = this.config.get('SMTP_PASS');
        if (!smtpUser || !smtpPass) {
            this.logger.warn('SMTP not configured — SLA alerts disabled. Set SMTP_USER and SMTP_PASS in .env');
            return;
        }
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: { user: smtpUser, pass: smtpPass },
        });
        this.logger.log(`SLA alert service ready. Notifications → ${smtpUser}`);
        this.runAlertCheck();
        this.intervalId = setInterval(() => this.runAlertCheck(), 60 * 60 * 1000);
    }
    async runAlertCheck() {
        if (!this.transporter)
            return;
        this.logger.debug('Running SLA alert check...');
        try {
            const breached = await this.getBreachers();
            const warning24h = await this.getWarnings(24);
            let sent = 0;
            for (const f of breached) {
                const alreadySent = await this.wasAlreadySent(f.id, 'SLA_BREACH');
                if (!alreadySent && f.cisoEmail) {
                    await this.sendBreachAlert(f);
                    await this.markSent(f.id, 'SLA_BREACH', f.cisoEmail);
                    sent++;
                }
            }
            for (const f of warning24h) {
                const alreadySent = await this.wasAlreadySent(f.id, 'SLA_WARNING_24H');
                if (!alreadySent && f.cisoEmail) {
                    await this.sendWarningAlert(f, 24);
                    await this.markSent(f.id, 'SLA_WARNING_24H', f.cisoEmail);
                    sent++;
                }
            }
            if (sent > 0) {
                this.logger.log(`SLA alerts: sent ${sent} emails`);
            }
            else {
                this.logger.debug('SLA alert check complete — no new alerts needed');
            }
        }
        catch (err) {
            this.logger.error('SLA alert check failed', err);
        }
    }
    async getBreachers() {
        const results = await this.prisma.$queryRaw `
      SELECT 
        f.id, f.title, f.severity, f."slaDate",
        o.name as "orgName",
        u.email as "cisoEmail",
        u.name as "cisoName"
      FROM findings f
      JOIN organizations o ON f."orgId" = o.id
      LEFT JOIN users u ON u."orgId" = o.id AND u.role = 'DEPT_CISO' AND u."isActive" = true
      WHERE 
        f."slaDate" < NOW()
        AND f.status NOT IN ('CLOSED', 'FALSE_POSITIVE', 'RISK_ACCEPTED')
        AND f."slaBreached" = false
      ORDER BY f."slaDate" ASC
      LIMIT 50
    `;
        return results;
    }
    async getWarnings(hoursAhead) {
        const results = await this.prisma.$queryRaw `
      SELECT 
        f.id, f.title, f.severity, f."slaDate",
        o.name as "orgName",
        u.email as "cisoEmail",
        u.name as "cisoName"
      FROM findings f
      JOIN organizations o ON f."orgId" = o.id
      LEFT JOIN users u ON u."orgId" = o.id AND u.role = 'DEPT_CISO' AND u."isActive" = true
      WHERE 
        f."slaDate" BETWEEN NOW() AND NOW() + INTERVAL '${hoursAhead} hours'
        AND f.status NOT IN ('CLOSED', 'FALSE_POSITIVE', 'RISK_ACCEPTED')
        AND f.severity IN ('CRITICAL', 'HIGH')
      ORDER BY f.severity ASC, f."slaDate" ASC
      LIMIT 50
    `;
        return results;
    }
    async wasAlreadySent(findingId, alertType) {
        try {
            const result = await this.prisma.$queryRaw `
        SELECT id FROM sla_alert_log
        WHERE "findingId" = ${findingId}::uuid AND "alertType" = ${alertType}
        LIMIT 1
      `;
            return result.length > 0;
        }
        catch {
            return false;
        }
    }
    async markSent(findingId, alertType, sentTo) {
        try {
            await this.prisma.$executeRaw `
        INSERT INTO sla_alert_log ("findingId", "alertType", "sentTo")
        VALUES (${findingId}::uuid, ${alertType}, ${sentTo})
        ON CONFLICT ("findingId", "alertType") DO NOTHING
      `;
        }
        catch (err) {
            this.logger.warn('Could not mark alert as sent:', err);
        }
    }
    async sendBreachAlert(f) {
        const hoursBreached = Math.round((Date.now() - new Date(f.slaDate).getTime()) / 3600000);
        await this.transporter.sendMail({
            from: `"NCAGP Alert System" <${this.config.get('SMTP_USER')}>`,
            to: f.cisoEmail,
            subject: `🚨 [NCAGP] SLA BREACHED — ${f.severity} Finding | ${f.orgName}`,
            html: this.buildBreachEmail(f, hoursBreached),
        });
        this.logger.log(`Breach alert sent to ${f.cisoEmail} for finding ${f.id}`);
    }
    async sendWarningAlert(f, hoursLeft) {
        await this.transporter.sendMail({
            from: `"NCAGP Alert System" <${this.config.get('SMTP_USER')}>`,
            to: f.cisoEmail,
            subject: `⚠️ [NCAGP] SLA Due in ${hoursLeft}h — ${f.severity} Finding | ${f.orgName}`,
            html: this.buildWarningEmail(f, hoursLeft),
        });
    }
    buildBreachEmail(f, hoursBreached) {
        const sevColor = f.severity === 'CRITICAL' ? '#dc2626' : '#ea580c';
        return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:40px auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
  
  <!-- Header -->
  <div style="background:#0f172a;padding:24px 32px;display:flex;align-items:center;gap:12px;">
    <div style="width:36px;height:36px;background:#1d4ed8;border-radius:8px;display:flex;align-items:center;justify-content:center;">
      <span style="color:white;font-size:18px;">🛡</span>
    </div>
    <div>
      <div style="color:#94a3b8;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">Government of India</div>
      <div style="color:white;font-weight:700;font-size:16px;">NCAGP — Cyber Audit Platform</div>
    </div>
  </div>

  <!-- Alert banner -->
  <div style="background:${sevColor};padding:16px 32px;display:flex;align-items:center;gap:10px;">
    <span style="font-size:20px;">🚨</span>
    <div>
      <div style="color:white;font-weight:700;font-size:16px;letter-spacing:0.03em;">SLA DEADLINE BREACHED</div>
      <div style="color:rgba(255,255,255,0.8);font-size:12px;">${hoursBreached} hours overdue</div>
    </div>
  </div>

  <!-- Content -->
  <div style="padding:32px;">
    <p style="color:#64748b;font-size:13px;margin:0 0 24px;">Dear ${f.cisoName || 'CISO'},</p>
    <p style="color:#1e293b;font-size:14px;margin:0 0 24px;">
      A <strong style="color:${sevColor};">${f.severity}</strong> security finding in 
      <strong>${f.orgName}</strong> has exceeded its remediation SLA deadline and requires immediate attention.
    </p>

    <!-- Finding card -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${sevColor};border-radius:6px;padding:20px;margin-bottom:24px;">
      <div style="font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Finding Details</div>
      <div style="font-weight:700;color:#0f172a;font-size:15px;margin-bottom:12px;">${f.title}</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#64748b;width:120px;">Severity</td>
          <td style="padding:4px 0;font-size:12px;font-weight:700;color:${sevColor};">${f.severity}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#64748b;">Organisation</td>
          <td style="padding:4px 0;font-size:12px;color:#1e293b;">${f.orgName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#64748b;">SLA Deadline</td>
          <td style="padding:4px 0;font-size:12px;color:#dc2626;font-weight:600;">${new Date(f.slaDate).toLocaleDateString('en-IN')} — BREACHED</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#64748b;">Finding ID</td>
          <td style="padding:4px 0;font-size:11px;color:#94a3b8;font-family:monospace;">${f.id}</td>
        </tr>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${this.config.get('FRONTEND_URL') || 'http://localhost:3001'}/findings" 
         style="display:inline-block;background:#1d4ed8;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.04em;">
        VIEW IN NCAGP DASHBOARD →
      </a>
    </div>

    <p style="color:#94a3b8;font-size:11px;border-top:1px solid #f1f5f9;padding-top:16px;margin:0;">
      This is an automated alert from the National Cyber Audit Governance Platform (NCAGP), 
      operated by the National Informatics Centre, Ministry of Electronics and Information Technology, 
      Government of India. All access is monitored and logged.
    </p>
  </div>
</div>
</body>
</html>`;
    }
    buildWarningEmail(f, hoursLeft) {
        return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:40px auto;background:white;border-radius:8px;overflow:hidden;">
  <div style="background:#0f172a;padding:24px 32px;">
    <div style="color:white;font-weight:700;font-size:16px;">🛡 NCAGP — SLA Warning</div>
  </div>
  <div style="background:#f59e0b;padding:14px 32px;">
    <div style="color:white;font-weight:700;">⚠️ SLA DUE IN ${hoursLeft} HOURS</div>
  </div>
  <div style="padding:32px;">
    <p style="color:#1e293b;font-size:14px;">
      A <strong>${f.severity}</strong> finding in <strong>${f.orgName}</strong> is due for remediation in ${hoursLeft} hours.
    </p>
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:16px;margin:16px 0;">
      <strong>${f.title}</strong><br/>
      <small style="color:#92400e;">Deadline: ${new Date(f.slaDate).toLocaleString('en-IN')}</small>
    </div>
    <a href="${this.config.get('FRONTEND_URL') || 'http://localhost:3001'}/findings"
       style="display:inline-block;background:#1d4ed8;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;">
      TAKE ACTION NOW →
    </a>
  </div>
</div>
</body>
</html>`;
    }
};
exports.AlertsService = AlertsService;
exports.AlertsService = AlertsService = AlertsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], AlertsService);
//# sourceMappingURL=alerts.service.js.map