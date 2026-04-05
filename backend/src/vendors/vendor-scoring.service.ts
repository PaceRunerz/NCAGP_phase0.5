import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VendorScoringService {
  private readonly logger = new Logger(VendorScoringService.name);

  constructor(private prisma: PrismaService) {}

  // Runs every night at 2 AM IST
  @Cron('0 20 * * *') // 20:30 UTC = 02:00 IST
  async runNightlyScoring() {
    this.logger.log('Starting nightly vendor scoring job...');
    const vendors = await this.prisma.vendor.findMany({
      include: { org: { select: { id:true, name:true } } },
    });

    let updated = 0;
    for (const vendor of vendors) {
      try {
        await this.scoreVendor(vendor.orgId);
        updated++;
      } catch (err: any) {
        this.logger.error(`Failed to score vendor ${vendor.orgId}: ${err.message}`);
      }
    }
    this.logger.log(`Vendor scoring complete — ${updated}/${vendors.length} vendors scored`);
  }

  async scoreVendor(vendorOrgId: string): Promise<any> {
    // Get all findings from audits conducted by this vendor
    const audits = await this.prisma.audit.findMany({
      where: { vendorOrgId },
      include: {
        findings: {
          include: { _count: { select: { evidence: true } } },
        },
      },
    });

    if (audits.length === 0) {
      return this.prisma.vendor.update({
        where: { orgId: vendorOrgId },
        data: { trustScore:0, qualityScore:0, onTimeDeliveryPct:0, falsePositiveRate:0, recurringFindingsRate:0, slaCompliancePct:0, evidenceQualityScore:0 },
      });
    }

    const allFindings = audits.flatMap(a => a.findings);
    const total = allFindings.length;

    if (total === 0) return null;

    // 1. On-time delivery — audits closed by endDate
    const completedAudits = audits.filter(a => a.status === 'CLOSED' || a.status === 'VALIDATION');
    const onTimeAudits = completedAudits.filter(a => !a.closedAt || a.closedAt <= a.endDate);
    const onTimeDeliveryPct = completedAudits.length > 0
      ? (onTimeAudits.length / completedAudits.length) * 100 : 100;

    // 2. False positive rate — findings marked FALSE_POSITIVE
    const falsePositives = allFindings.filter(f => f.status === 'FALSE_POSITIVE').length;
    const falsePositiveRate = (falsePositives / total) * 100;

    // 3. Recurring findings rate
    const recurring = allFindings.filter(f => f.isRecurring).length;
    const recurringFindingsRate = (recurring / total) * 100;

    // 4. SLA compliance — critical/high findings closed within SLA
    const slaApplicable = allFindings.filter(f =>
      ['CRITICAL','HIGH'].includes(f.severity) && f.slaDate
    );
    const slaCompliant = slaApplicable.filter(f => !f.slaBreached).length;
    const slaCompliancePct = slaApplicable.length > 0
      ? (slaCompliant / slaApplicable.length) * 100 : 100;

    // 5. Evidence quality — findings with evidence attached
    const withEvidence = allFindings.filter(f => (f._count as any).evidence > 0).length;
    const evidenceQualityScore = (withEvidence / total) * 100;

    // 6. Quality score — weighted average of above KPIs
    const qualityScore = (
      (100 - falsePositiveRate) * 0.35 +
      slaCompliancePct          * 0.30 +
      evidenceQualityScore      * 0.20 +
      (100 - recurringFindingsRate) * 0.15
    );

    // 7. Trust score — overall vendor reliability
    const trustScore = (
      onTimeDeliveryPct * 0.25 +
      qualityScore      * 0.50 +
      slaCompliancePct  * 0.25
    );

    const scores = {
      trustScore:           Math.round(trustScore * 10) / 10,
      qualityScore:         Math.round(qualityScore * 10) / 10,
      onTimeDeliveryPct:    Math.round(onTimeDeliveryPct * 10) / 10,
      falsePositiveRate:    Math.round(falsePositiveRate * 10) / 10,
      recurringFindingsRate:Math.round(recurringFindingsRate * 10) / 10,
      slaCompliancePct:     Math.round(slaCompliancePct * 10) / 10,
      evidenceQualityScore: Math.round(evidenceQualityScore * 10) / 10,
    };

    return this.prisma.vendor.update({ where: { orgId: vendorOrgId }, data: scores });
  }

  // GET scores for a vendor
  async getScores(vendorOrgId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { orgId: vendorOrgId },
      include: { org: { select: { name:true } } },
    });
    return vendor;
  }

  // GET all vendor scorecards
  async getAllScores() {
    return this.prisma.vendor.findMany({
      include: { org: { select: { id:true, name:true, shortCode:true } } },
      orderBy: { trustScore: 'desc' },
    });
  }
}
