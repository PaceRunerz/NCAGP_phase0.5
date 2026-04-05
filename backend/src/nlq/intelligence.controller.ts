import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { IsString } from 'class-validator';

class NlqDto {
  @IsString() query: string;
}

@Controller('intelligence')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IntelligenceController {
  constructor(private prisma: PrismaService) {}

  // POST /api/intelligence/query
  // Translates natural language to a findings query using Claude API
  @Post('query')
  @Roles('NIC_ADMIN','DEPT_CISO','REVIEWER')
  async naturalLanguageQuery(@Body() dto: NlqDto, @CurrentUser() user: any) {
    const { query } = dto;

    // Pull context data the AI needs to understand
    const [orgs, totalFindings, severityCounts] = await Promise.all([
      this.prisma.organization.findMany({ select: { id:true, name:true, shortCode:true } }),
      this.prisma.finding.count(),
      this.prisma.finding.groupBy({ by:['severity'], _count:{ id:true } }),
    ]);

    const orgList = orgs.map(o => `${o.shortCode} (${o.name})`).join(', ');

    // Build query filters from Claude's response
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: `You are a database query assistant for NCAGP (National Cyber Audit Governance Platform).
Your ONLY job is to convert natural language queries into a JSON filter object.

Available fields:
- severity: CRITICAL, HIGH, MEDIUM, LOW, INFO
- status: OPEN, ACKNOWLEDGED, IN_REMEDIATION, REMEDIATED_PENDING_VALIDATION, VALIDATED, CLOSED, RISK_ACCEPTED, FALSE_POSITIVE
- slaBreached: true/false
- isRecurring: true/false
- orgShortCode: one of: ${orgList}
- daysAgo: number (how many days back to look)

Respond with ONLY valid JSON, nothing else. Example:
{"severity":"CRITICAL","status":"OPEN","slaBreached":true}`,
        messages: [{ role:'user', content: query }],
      }),
    });

    let filters: any = {};
    try {
      const data: any = await response.json();
      const text = data.content?.[0]?.text || '{}';
      filters = JSON.parse(text);
    } catch {
      // Fallback: do basic keyword matching
      const q = query.toLowerCase();
      if (q.includes('critical')) filters.severity = 'CRITICAL';
      if (q.includes('high')) filters.severity = 'HIGH';
      if (q.includes('open')) filters.status = 'OPEN';
      if (q.includes('breach') || q.includes('overdue')) filters.slaBreached = true;
      if (q.includes('recurring')) filters.isRecurring = true;
      if (q.includes('closed')) filters.status = 'CLOSED';
    }

    // Build Prisma where clause
    const where: any = {};
    if (filters.severity) where.severity = filters.severity;
    if (filters.status)   where.status   = filters.status;
    if (filters.slaBreached !== undefined) where.slaBreached = filters.slaBreached;
    if (filters.isRecurring !== undefined) where.isRecurring = filters.isRecurring;

    if (filters.daysAgo) {
      where.createdAt = { gte: new Date(Date.now() - filters.daysAgo * 86400000) };
    }

    if (filters.orgShortCode) {
      const org = await this.prisma.organization.findFirst({
        where: { shortCode: filters.orgShortCode },
      });
      if (org) where.orgId = org.id;
    }

    // Scope enforcement — non-admins only see their org
    if (user.role !== 'NIC_ADMIN') {
      where.orgId = { in: user.dataAccessScope || [user.orgId] };
    }

    const findings = await this.prisma.finding.findMany({
      where,
      include: {
        org:   { select: { name:true, shortCode:true } },
        asset: { select: { name:true } },
      },
      orderBy: [{ severity:'asc' }, { slaBreached:'desc' }, { createdAt:'desc' }],
      take: 100,
    });

    return {
      query,
      filtersApplied: filters,
      count: findings.length,
      findings,
    };
  }

  // POST /api/intelligence/anomalies
  // Rule-based anomaly detection — no ML needed, uses actual data patterns
  @Post('anomalies')
  @Roles('NIC_ADMIN','DEPT_CISO','REVIEWER')
  async detectAnomalies(@CurrentUser() user: any) {
    const anomalies: any[] = [];
    const now = new Date();

    // 1. Findings closed too fast (< 1 hour) — possible fake closure
    const fastClosed = await this.prisma.findingStatusHistory.findMany({
      where: { toStatus: 'CLOSED', changedAt: { gte: new Date(now.getTime() - 30 * 86400000) } },
    });

    for (const h of fastClosed) {
      const finding = await this.prisma.finding.findFirst({
        where: { id: h.findingId },
        select: { id:true, title:true, severity:true, createdAt:true, org:{ select:{ name:true } } },
      });
      if (!finding) continue;
      const ageHours = (h.changedAt.getTime() - finding.createdAt.getTime()) / 3600000;
      if (ageHours < 2 && ['CRITICAL','HIGH'].includes(finding.severity)) {
        anomalies.push({
          type: 'SUSPICIOUS_FAST_CLOSURE',
          severity: 'HIGH',
          description: `${finding.severity} finding closed in ${Math.round(ageHours * 60)} minutes`,
          findingId: finding.id, findingTitle: finding.title,
          org: finding.org?.name, detectedAt: now,
        });
      }
    }

    // 2. Vendor with high false positive rate (> 30%)
    const vendors = await this.prisma.vendor.findMany({
      where: { falsePositiveRate: { gt: 30 } },
      include: { org: { select: { name:true } } },
    });
    for (const v of vendors) {
      anomalies.push({
        type: 'HIGH_FALSE_POSITIVE_RATE',
        severity: 'MEDIUM',
        description: `Vendor ${v.org.name} has ${v.falsePositiveRate.toFixed(1)}% false positive rate`,
        vendorOrgId: v.orgId, org: v.org.name, detectedAt: now,
      });
    }

    // 3. Evidence uploaded outside business hours (possible weekend/night activity)
    const offHoursEvidence = await this.prisma.evidence.findMany({
      where: {
        uploadedAt: { gte: new Date(now.getTime() - 7 * 86400000) },
      },
      include: {
        uploadedBy: { select: { name:true, role:true } },
        finding:    { select: { title:true, org:{ select:{ name:true } } } },
      },
    });

    for (const e of offHoursEvidence) {
      const hour = new Date(e.uploadedAt).getHours();
      const isWeekend = [0,6].includes(new Date(e.uploadedAt).getDay());
      if (hour < 6 || hour > 22 || isWeekend) {
        anomalies.push({
          type: 'OFF_HOURS_EVIDENCE_UPLOAD',
          severity: 'LOW',
          description: `Evidence uploaded at ${new Date(e.uploadedAt).toLocaleString('en-IN')} by ${e.uploadedBy?.name}`,
          evidenceId: e.id, org: e.finding?.org?.name, detectedAt: now,
        });
      }
    }

    // 4. Same finding re-opened 3+ times — possible gaming
    const reopened = await this.prisma.findingStatusHistory.groupBy({
      by: ['findingId'],
      _count: { id: true },
      having: { id: { _count: { gt: 5 } } },
    });
    for (const r of reopened) {
      const f = await this.prisma.finding.findFirst({
        where: { id: r.findingId },
        select: { title:true, severity:true, org:{ select:{ name:true } } },
      });
      if (f) {
        anomalies.push({
          type: 'EXCESSIVE_STATUS_CHANGES',
          severity: 'MEDIUM',
          description: `Finding has ${r._count.id} status transitions — possible gaming`,
          findingId: r.findingId, findingTitle: f.title, org: f.org?.name, detectedAt: now,
        });
      }
    }

    // 5. Control decay — controls flagged multiple times in recent audits
    const controlFailures = await this.prisma.finding.groupBy({
      by: ['controlId'],
      where: {
        controlId: { not: null },
        createdAt: { gte: new Date(now.getTime() - 365 * 86400000) },
        status: { notIn: ['FALSE_POSITIVE','RISK_ACCEPTED'] },
      },
      _count: { id: true },
      having: { id: { _count: { gt: 2 } } },
    });

    for (const cf of controlFailures) {
      if (!cf.controlId) continue;
      const ctrl = await this.prisma.control.findFirst({
        where: { id: cf.controlId }, select: { name:true, controlCode:true },
      });
      if (ctrl) {
        anomalies.push({
          type: 'CONTROL_DECAY',
          severity: 'HIGH',
          description: `Control ${ctrl.controlCode} (${ctrl.name}) failed ${cf._count.id} times in the past year — may exist on paper only`,
          controlId: cf.controlId, controlName: ctrl.name, detectedAt: now,
        });
      }
    }

    return {
      total: anomalies.length,
      anomalies: anomalies.sort((a,b) => {
        const order = { HIGH:0, MEDIUM:1, LOW:2 };
        return (order[a.severity as keyof typeof order]||2) - (order[b.severity as keyof typeof order]||2);
      }),
      generatedAt: now,
    };
  }

  // POST /api/intelligence/risk-forecast
  // Rule-based predictive scoring — works with any amount of data
  @Post('risk-forecast')
  @Roles('NIC_ADMIN','DEPT_CISO','REVIEWER')
  async riskForecast(@CurrentUser() user: any) {
    const orgs = await this.prisma.organization.findMany({
      where: { orgType: 'DEPARTMENT' },
    });

    const orgFindings = await Promise.all(orgs.map(async org => {
      const findings = await this.prisma.finding.findMany({
        where: { orgId: org.id, status: { notIn: ['CLOSED','FALSE_POSITIVE'] } },
        select: { severity:true, slaBreached:true, isRecurring:true, createdAt:true },
      });
      return { org, findings };
    }));

    const forecasts = orgFindings.map(({ org, findings: f }) => {
      const total = f.length;
      if (total === 0) return { orgId:org.id, orgName:org.name, shortCode:org.shortCode, riskTrend:'STABLE', forecastScore:0, factors:[] };

      const criticalCount  = f.filter(x=>x.severity==='CRITICAL').length;
      const highCount      = f.filter(x=>x.severity==='HIGH').length;
      const breachedCount  = f.filter(x=>x.slaBreached).length;
      const recurringCount = f.filter(x=>x.isRecurring).length;

      // Recent 30d vs previous 30d
      const now = Date.now();
      const recent30 = f.filter(x=>now-new Date(x.createdAt).getTime()<30*86400000).length;
      const prev30   = f.filter(x=>{const d=now-new Date(x.createdAt).getTime();return d>=30*86400000&&d<60*86400000;}).length;

      const trend = recent30 > prev30 * 1.3 ? 'WORSENING' : recent30 < prev30 * 0.7 ? 'IMPROVING' : 'STABLE';

      const factors: string[] = [];
      if (criticalCount > 0)  factors.push(`${criticalCount} critical findings unresolved`);
      if (breachedCount > 0)  factors.push(`${breachedCount} SLA breaches`);
      if (recurringCount > 0) factors.push(`${recurringCount} recurring control failures`);
      if (trend==='WORSENING') factors.push(`30% more findings in last 30 days`);

      const score = Math.min(100,
        criticalCount*25 + highCount*8 + breachedCount*15 + recurringCount*10 +
        (trend==='WORSENING'?20:0)
      );

      return { orgId:org.id, orgName:org.name, shortCode:org.shortCode, riskTrend:trend, forecastScore:Math.round(score), factors, total, criticalCount, breachedCount };
    });

    return {
      forecasts: forecasts.sort((a,b)=>b.forecastScore-a.forecastScore),
      generatedAt: new Date(),
      note: 'Rule-based risk forecast. Predictive ML model requires 1M+ findings (Phase 2).',
    };
  }
}
