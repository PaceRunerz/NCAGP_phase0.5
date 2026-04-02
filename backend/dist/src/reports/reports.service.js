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
var ReportsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const PDFDocument = require("pdfkit");
let ReportsService = ReportsService_1 = class ReportsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(ReportsService_1.name);
    }
    async generateNationalRiskReport() {
        const heatmapData = await this.prisma.$queryRaw `
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
    buildPDF(heatmapData, breached) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 },
                info: {
                    Title: 'National Cyber Risk Posture Report',
                    Author: 'National Informatics Centre',
                    Subject: 'NCAGP Risk Assessment',
                },
            });
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            const W = 495;
            const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
            const nowTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
            doc.rect(50, 50, W, 80).fill('#0f172a');
            doc.fill('white').font('Helvetica-Bold').fontSize(18)
                .text('NATIONAL CYBER AUDIT GOVERNANCE PLATFORM', 65, 68, { width: W - 80 });
            doc.font('Helvetica').fontSize(10).fill('#94a3b8')
                .text('National Informatics Centre · Ministry of Electronics & IT · Government of India', 65, 92);
            doc.fill('#1d4ed8').font('Helvetica-Bold').fontSize(13)
                .text('NATIONAL CYBER RISK POSTURE REPORT', 65, 110);
            doc.rect(50, 134, W, 18).fillAndStroke('#1d4ed8', '#1d4ed8');
            doc.fill('white').font('Helvetica-Bold').fontSize(9)
                .text(`OFFICIAL · SENSITIVE · Generated: ${today} at ${nowTime} IST`, 65, 139, { align: 'center', width: W });
            doc.moveDown(4);
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
            doc.fill('#0f172a').font('Helvetica-Bold').fontSize(12)
                .text('DEPARTMENT RISK SCORES', 50, 260);
            doc.moveTo(50, 275).lineTo(545, 275).stroke('#e2e8f0');
            const cols = [
                { label: 'DEPT', x: 50, w: 50 },
                { label: 'ORGANISATION', x: 105, w: 155 },
                { label: 'RISK', x: 265, w: 45 },
                { label: 'CRITICAL', x: 315, w: 55 },
                { label: 'HIGH', x: 375, w: 45 },
                { label: 'OPEN', x: 425, w: 45 },
                { label: 'SLA BREACH', x: 475, w: 70 },
            ];
            doc.rect(50, 278, W, 16).fill('#1e293b');
            cols.forEach(c => {
                doc.fill('white').font('Helvetica-Bold').fontSize(7)
                    .text(c.label, c.x + 4, 283, { width: c.w - 4 });
            });
            let y = 296;
            heatmapData.forEach((d, i) => {
                if (y > 720) {
                    doc.addPage();
                    y = 60;
                }
                const bg = i % 2 === 0 ? '#f8fafc' : 'white';
                doc.rect(50, y, W, 16).fill(bg);
                const riskScore = Number(d.riskScore || 0);
                const riskColor = riskScore >= 75 ? '#dc2626' : riskScore >= 50 ? '#ea580c' : riskScore >= 25 ? '#d97706' : '#16a34a';
                const breach = Number(d.slaBreachedCount);
                doc.fill('#475569').font('Helvetica').fontSize(8)
                    .text(d.shortCode, 54, y + 4, { width: 45 });
                doc.fill('#1e293b').font('Helvetica').fontSize(8)
                    .text(d.orgName, 109, y + 4, { width: 150, ellipsis: true });
                doc.fill(riskColor).font('Helvetica-Bold').fontSize(9)
                    .text(riskScore.toFixed(0), 269, y + 4, { width: 40 });
                doc.fill('#dc2626').font('Helvetica-Bold').fontSize(8)
                    .text(String(Number(d.criticalCount)), 319, y + 4, { width: 50 });
                doc.fill('#ea580c').font('Helvetica').fontSize(8)
                    .text(String(Number(d.highCount)), 379, y + 4, { width: 40 });
                doc.fill('#475569').font('Helvetica').fontSize(8)
                    .text(String(Number(d.openCount)), 429, y + 4, { width: 40 });
                doc.fill(breach > 0 ? '#dc2626' : '#16a34a').font('Helvetica-Bold').fontSize(8)
                    .text(breach > 0 ? `${breach} OVERDUE` : '✓ CLEAR', 479, y + 4, { width: 65 });
                y += 16;
            });
            y += 20;
            if (breached.length > 0) {
                if (y > 650) {
                    doc.addPage();
                    y = 60;
                }
                doc.fill('#dc2626').font('Helvetica-Bold').fontSize(12)
                    .text('SLA BREACH DETAIL', 50, y);
                y += 15;
                doc.moveTo(50, y).lineTo(545, y).stroke('#fca5a5');
                y += 8;
                doc.fill('#7f1d1d').font('Helvetica').fontSize(9)
                    .text(`The following ${breached.length} finding(s) have exceeded their remediation deadline and require immediate escalation.`, 50, y, { width: W });
                y += 24;
                breached.slice(0, 20).forEach((f, i) => {
                    if (y > 720) {
                        doc.addPage();
                        y = 60;
                    }
                    const sevColor = f.severity === 'CRITICAL' ? '#dc2626' : f.severity === 'HIGH' ? '#ea580c' : '#d97706';
                    const daysBreached = Math.floor((Date.now() - new Date(f.slaDate).getTime()) / 86400000);
                    doc.rect(50, y, W, 36).fill('#fef2f2').stroke('#fecaca');
                    doc.rect(50, y, 4, 36).fill(sevColor);
                    doc.fill(sevColor).font('Helvetica-Bold').fontSize(8)
                        .text(f.severity, 62, y + 4);
                    doc.fill('#1e293b').font('Helvetica-Bold').fontSize(9)
                        .text(f.title, 62, y + 14, { width: W - 120, ellipsis: true });
                    doc.fill('#64748b').font('Helvetica').fontSize(7)
                        .text(`${f.org?.name || ''} · Asset: ${f.asset?.name || 'N/A'} · Breached by: ${daysBreached} day(s)`, 62, y + 26, { width: W - 70 });
                    doc.fill('#dc2626').font('Helvetica-Bold').fontSize(7)
                        .text(`${daysBreached}d OVERDUE`, 480, y + 14);
                    y += 42;
                });
            }
            doc.rect(50, 780, W, 1).fill('#e2e8f0');
            doc.fill('#94a3b8').font('Helvetica').fontSize(7)
                .text(`OFFICIAL · SENSITIVE — This document is generated by the National Cyber Audit Governance Platform (NCAGP). ` +
                `Unauthorized disclosure is prohibited. National Informatics Centre, New Delhi 110003. Report ID: ${Date.now()}`, 50, 787, { width: W, align: 'center' });
            doc.end();
        });
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = ReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map