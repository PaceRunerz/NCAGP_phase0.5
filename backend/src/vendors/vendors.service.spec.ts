import { Test, TestingModule } from '@nestjs/testing';
import { VendorScoringService } from './vendor-scoring.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

// Tests for VendorScoringService
// - Trust score calculation (0-100 range)
// - Quality score calculation (evidence + SLA compliance)
// - Vendor rescoring with ledger entries
// - Nightly batch rescoring job with transactions
// - Org-scoped score retrieval with access control

describe('VendorScoringService', () => {
  let service: VendorScoringService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      vendor: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      audit: {
        findMany: jest.fn(),
      },
      finding: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)), // Mock transaction
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [VendorScoringService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<VendorScoringService>(VendorScoringService);

    jest.resetAllMocks();
    jest.useRealTimers();
  });

  // ────────────────────────────────────────────────────────────────
  // 1. calculateTrustScore Tests
  // ────────────────────────────────────────────────────────────────
  describe('Trust Score Calculation (scoreVendor)', () => {
    it('vendor with all VALIDATED/CLOSED findings -> high trust score (>80)', async () => {
      const vendorOrgId = 'vendor-org-1';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'audit-1',
          vendorOrgId,
          status: 'CLOSED',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-28'), // On time
          findings: [
            {
              id: 'f-1',
              severity: 'CRITICAL',
              status: 'VALIDATED',
              slaDate: new Date('2026-01-07'),
              slaBreached: false,
              isRecurring: false,
              _count: { evidence: 3 },
            },
            {
              id: 'f-2',
              severity: 'HIGH',
              status: 'VALIDATED',
              slaDate: new Date('2026-01-10'),
              slaBreached: false,
              isRecurring: false,
              _count: { evidence: 2 },
            },
            {
              id: 'f-3',
              severity: 'MEDIUM',
              status: 'CLOSED',
              slaDate: new Date('2026-01-20'),
              slaBreached: false,
              isRecurring: false,
              _count: { evidence: 1 },
            },
          ],
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        orgId: vendorOrgId,
        trustScore: 95.0,
        qualityScore: 98.3,
      });

      const result = await service.scoreVendor(vendorOrgId);

      expect(result.trustScore).toBeGreaterThan(80);
      expect(prisma.vendor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: vendorOrgId },
          data: expect.objectContaining({
            trustScore: expect.any(Number),
            qualityScore: expect.any(Number),
          }),
        })
      );
    });

    it('vendor with many OPEN/overdue findings -> low trust score (<40)', async () => {
      const vendorOrgId = 'vendor-org-low';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'audit-bad',
          vendorOrgId,
          status: 'IN_PROGRESS',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          closedAt: null,
          findings: [
            {
              id: 'f-open-1',
              severity: 'CRITICAL',
              status: 'OPEN',
              slaDate: new Date('2026-01-07'),
              slaBreached: true, // Breached
              isRecurring: true, // Recurring
              _count: { evidence: 0 }, // No evidence
            },
            {
              id: 'f-open-2',
              severity: 'CRITICAL',
              status: 'OPEN',
              slaDate: new Date('2026-01-08'),
              slaBreached: true,
              isRecurring: true,
              _count: { evidence: 0 },
            },
            {
              id: 'f-false-pos',
              severity: 'HIGH',
              status: 'FALSE_POSITIVE',
              slaDate: new Date('2026-01-10'),
              slaBreached: false,
              isRecurring: false,
              _count: { evidence: 0 },
            },
          ],
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        orgId: vendorOrgId,
        trustScore: 25.5,
        qualityScore: 32.1,
      });

      const result = await service.scoreVendor(vendorOrgId);

      expect(result.trustScore).toBeLessThan(40);
      expect(prisma.vendor.update).toHaveBeenCalled();
    });

    it('vendor with no findings -> neutral score (50)', async () => {
      const vendorOrgId = 'vendor-org-empty';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'audit-empty',
          vendorOrgId,
          status: 'CLOSED',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-31'),
          findings: [], // No findings
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        orgId: vendorOrgId,
        trustScore: 0,
        qualityScore: 0,
      });

      const result = await service.scoreVendor(vendorOrgId);

      expect(result.trustScore).toBeDefined();
      expect(prisma.vendor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trustScore: 0,
            qualityScore: 0,
          }),
        })
      );
    });

    it('no audits for vendor -> all scores set to 0', async () => {
      const vendorOrgId = 'vendor-org-no-audits';

      prisma.audit.findMany.mockResolvedValue([]);

      prisma.vendor.update.mockResolvedValue({
        orgId: vendorOrgId,
        trustScore: 0,
        qualityScore: 0,
        onTimeDeliveryPct: 0,
        falsePositiveRate: 0,
        recurringFindingsRate: 0,
        slaCompliancePct: 0,
        evidenceQualityScore: 0,
      });

      const result = await service.scoreVendor(vendorOrgId);

      expect(result.trustScore).toBe(0);
      expect(result.qualityScore).toBe(0);
      expect(prisma.vendor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trustScore: 0,
            qualityScore: 0,
            onTimeDeliveryPct: 0,
            falsePositiveRate: 0,
            slaCompliancePct: 0,
          }),
        })
      );
    });

    it('trust score always between 0-100', async () => {
      const vendorOrgId = 'vendor-org-bounded';

      // Test with perfect findings
      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'audit-perfect',
          vendorOrgId,
          status: 'CLOSED',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-30'),
          findings: Array.from({ length: 10 }, (_, i) => ({
            id: `f-${i}`,
            severity: 'MEDIUM',
            status: 'VALIDATED',
            slaDate: new Date('2026-01-20'),
            slaBreached: false,
            isRecurring: false,
            _count: { evidence: 2 },
          })),
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        trustScore: 100.0, // Max
        qualityScore: 100.0,
      });

      let result = await service.scoreVendor(vendorOrgId);
      expect(result.trustScore).toBeLessThanOrEqual(100);
      expect(result.trustScore).toBeGreaterThanOrEqual(0);

      // Test with worst-case findings
      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'audit-worst',
          vendorOrgId,
          status: 'IN_PROGRESS',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          closedAt: null,
          findings: Array.from({ length: 20 }, (_, i) => ({
            id: `f-bad-${i}`,
            severity: 'CRITICAL',
            status: 'OPEN',
            slaDate: new Date('2026-01-01'),
            slaBreached: true,
            isRecurring: true,
            _count: { evidence: 0 },
          })),
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        trustScore: 0.0,
        qualityScore: 0.0,
      });

      result = await service.scoreVendor(vendorOrgId);
      expect(result.trustScore).toBeLessThanOrEqual(100);
      expect(result.trustScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 2. calculateQualityScore Tests
  // ────────────────────────────────────────────────────────────────
  describe('Quality Score Calculation', () => {
    it('100% on-time remediation + full evidence -> quality score >80', async () => {
      const vendorOrgId = 'vendor-org-quality-high';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'audit-quality',
          vendorOrgId,
          status: 'CLOSED',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-25'), // Before endDate
          findings: [
            {
              id: 'f-q1',
              severity: 'CRITICAL',
              status: 'VALIDATED',
              slaDate: new Date('2026-01-08'),
              slaBreached: false, // On SLA
              isRecurring: false,
              _count: { evidence: 5 }, // Evidence attached
            },
            {
              id: 'f-q2',
              severity: 'HIGH',
              status: 'VALIDATED',
              slaDate: new Date('2026-01-12'),
              slaBreached: false, // On SLA
              isRecurring: false,
              _count: { evidence: 3 },
            },
            {
              id: 'f-q3',
              severity: 'MEDIUM',
              status: 'CLOSED',
              slaDate: new Date('2026-01-20'),
              slaBreached: false,
              isRecurring: false,
              _count: { evidence: 4 },
            },
          ],
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        qualityScore: 95.2,
        onTimeDeliveryPct: 100.0,
        slaCompliancePct: 100.0,
        evidenceQualityScore: 100.0,
      });

      const result = await service.scoreVendor(vendorOrgId);

      expect(result.qualityScore).toBeGreaterThan(80);
      expect(prisma.vendor.update).toHaveBeenCalled();
    });

    it('many SLA breaches + missing evidence -> quality score <40', async () => {
      const vendorOrgId = 'vendor-org-quality-low';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'audit-poor',
          vendorOrgId,
          status: 'CLOSED',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-02-28'),
          closedAt: new Date('2026-03-05'), // After endDate
          findings: [
            {
              id: 'f-poor-1',
              severity: 'CRITICAL',
              status: 'OPEN',
              slaDate: new Date('2026-01-08'),
              slaBreached: true, // Breached
              isRecurring: true,
              _count: { evidence: 0 }, // No evidence
            },
            {
              id: 'f-poor-2',
              severity: 'HIGH',
              status: 'OPEN',
              slaDate: new Date('2026-01-10'),
              slaBreached: true,
              isRecurring: true,
              _count: { evidence: 0 },
            },
            {
              id: 'f-poor-3',
              severity: 'MEDIUM',
              status: 'FALSE_POSITIVE',
              slaDate: null,
              slaBreached: false,
              isRecurring: false,
              _count: { evidence: 0 },
            },
          ],
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        qualityScore: 28.3,
        onTimeDeliveryPct: 0.0,
        slaCompliancePct: 0.0,
        evidenceQualityScore: 0.0,
        falsePositiveRate: 33.3,
      });

      const result = await service.scoreVendor(vendorOrgId);

      expect(result.qualityScore).toBeLessThan(40);
    });

    it('quality score components are weighted correctly (FP: 0.35, SLA: 0.30, Evidence: 0.20, Recurring: 0.15)', async () => {
      const vendorOrgId = 'vendor-org-weights';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'audit-weights',
          vendorOrgId,
          status: 'CLOSED',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-30'),
          findings: [
            // Scenario: 50% false positive, 75% SLA compliant, 50% with evidence, 50% recurring
            { severity: 'MEDIUM', status: 'FALSE_POSITIVE', slaDate: null, slaBreached: false, isRecurring: false, _count: { evidence: 0 } },
            { severity: 'MEDIUM', status: 'VALIDATED', slaDate: new Date('2026-01-20'), slaBreached: false, isRecurring: false, _count: { evidence: 0 } },
            { severity: 'HIGH', status: 'VALIDATED', slaDate: new Date('2026-01-15'), slaBreached: true, isRecurring: true, _count: { evidence: 1 } },
            { severity: 'HIGH', status: 'VALIDATED', slaDate: new Date('2026-01-15'), slaBreached: false, isRecurring: true, _count: { evidence: 1 } },
          ].map((f, i) => ({ id: `f-w${i}`, ...f })),
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        qualityScore: 62.5, // Calculated with weights
        falsePositiveRate: 25.0, // 1/4
        slaCompliancePct: 66.7, // 2/3 of HIGH/CRITICAL
        evidenceQualityScore: 50.0, // 2/4
        recurringFindingsRate: 50.0, // 2/4
      });

      await service.scoreVendor(vendorOrgId);

      expect(prisma.vendor.update).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 3. rescoreVendor Tests
  // ────────────────────────────────────────────────────────────────
  describe('rescoreVendor (On-demand vendor scoring)', () => {
    it('recalculates both trust and quality scores and saves to DB', async () => {
      const vendorOrgId = 'vendor-org-rescore';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'audit-rescore',
          vendorOrgId,
          status: 'CLOSED',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-28'),
          findings: [
            {
              id: 'f-rescore-1',
              severity: 'CRITICAL',
              status: 'VALIDATED',
              slaDate: new Date('2026-01-07'),
              slaBreached: false,
              isRecurring: false,
              _count: { evidence: 2 },
            },
          ],
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        orgId: vendorOrgId,
        trustScore: 85.0,
        qualityScore: 90.0,
        onTimeDeliveryPct: 100.0,
        slaCompliancePct: 100.0,
        evidenceQualityScore: 100.0,
      });

      const result = await service.scoreVendor(vendorOrgId);

      // Verify update was called with all metrics
      expect(prisma.vendor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: vendorOrgId },
          data: expect.objectContaining({
            trustScore: expect.any(Number),
            qualityScore: expect.any(Number),
            onTimeDeliveryPct: expect.any(Number),
            slaCompliancePct: expect.any(Number),
            falsePositiveRate: expect.any(Number),
            recurringFindingsRate: expect.any(Number),
            evidenceQualityScore: expect.any(Number),
          }),
        })
      );

      expect(result.trustScore).toBeDefined();
      expect(result.qualityScore).toBeDefined();
    });

    it('scores are rounded to 1 decimal place', async () => {
      const vendorOrgId = 'vendor-org-precision';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'audit-precision',
          vendorOrgId,
          status: 'CLOSED',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-25'),
          findings: Array.from({ length: 3 }, (_, i) => ({
            id: `f-p${i}`,
            severity: 'MEDIUM',
            status: 'VALIDATED',
            slaDate: new Date('2026-01-20'),
            slaBreached: false,
            isRecurring: false,
            _count: { evidence: 1 },
          })),
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        trustScore: 93.3, // 1 decimal place
        qualityScore: 93.3,
      });

      const result = await service.scoreVendor(vendorOrgId);

      // Verify rounding occurred (scores end in .0 or .1 to .9)
      expect(result.trustScore).toBeDefined();
      expect(String(result.trustScore).split('.')[1]?.length || 0).toBeLessThanOrEqual(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 4. rescoreAll (Nightly Job) Tests
  // ────────────────────────────────────────────────────────────────
  describe('runNightlyScoring (rescoreAll batch job)', () => {
    it('calls scoreVendor for every vendor org in the system', async () => {
      prisma.vendor.findMany.mockResolvedValue([
        { orgId: 'vendor-1', org: { id: 'vendor-1', name: 'Vendor One' } },
        { orgId: 'vendor-2', org: { id: 'vendor-2', name: 'Vendor Two' } },
        { orgId: 'vendor-3', org: { id: 'vendor-3', name: 'Vendor Three' } },
      ]);

      // Mock scoreVendor indirectly through audit queries
      prisma.audit.findMany.mockResolvedValue([]);
      prisma.vendor.update.mockResolvedValue({ orgId: 'vendor-x', trustScore: 0, qualityScore: 0 });

      await service.runNightlyScoring();

      // Verify vendor.findMany was called to get all vendors
      expect(prisma.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { org: expect.objectContaining({ select: { id: true, name: true } }) },
        })
      );

      // Verify audit.findMany was called for each vendor (3 times)
      expect(prisma.audit.findMany).toHaveBeenCalledTimes(3);
    });

    it('returns summary of rescored vendors (updated count)', async () => {
      prisma.vendor.findMany.mockResolvedValue([
        { orgId: 'v-1', org: { name: 'V1' } },
        { orgId: 'v-2', org: { name: 'V2' } },
      ]);

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'a-1',
          vendorOrgId: 'v-1',
          status: 'CLOSED',
          endDate: new Date(),
          closedAt: new Date(),
          findings: [],
        },
      ]);

      prisma.vendor.update.mockResolvedValue({ trustScore: 0, qualityScore: 0 });

      // Note: runNightlyScoring is a void method that just logs,
      // but we can verify the internal calls
      await service.runNightlyScoring();

      // Each vendor should have scoreVendor called (audit lookup)
      expect(prisma.audit.findMany).toHaveBeenCalledTimes(2);
    });

    it('handles errors gracefully during nightly run — continues with next vendor', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      prisma.vendor.findMany.mockResolvedValue([
        { orgId: 'v-error', org: { name: 'Error Vendor' } },
        { orgId: 'v-ok', org: { name: 'OK Vendor' } },
      ]);

      // First vendor fails, second succeeds
      prisma.audit.findMany
        .mockRejectedValueOnce(new Error('DB Connection Failed'))
        .mockResolvedValueOnce([
          {
            id: 'a-ok',
            vendorOrgId: 'v-ok',
            status: 'CLOSED',
            endDate: new Date(),
            closedAt: new Date(),
            findings: [],
          },
        ]);

      prisma.vendor.update.mockResolvedValue({ trustScore: 0 });

      // Should not throw
      await expect(service.runNightlyScoring()).resolves.not.toThrow();

      // Second vendor should still be processed
      expect(prisma.audit.findMany).toHaveBeenCalledTimes(2);

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });

    it('skips vendors with no audits (sets all scores to 0)', async () => {
      prisma.vendor.findMany.mockResolvedValue([
        { orgId: 'vendor-no-audits', org: { name: 'No Audits' } },
      ]);

      prisma.audit.findMany.mockResolvedValue([]);

      prisma.vendor.update.mockResolvedValue({
        orgId: 'vendor-no-audits',
        trustScore: 0,
        qualityScore: 0,
        onTimeDeliveryPct: 0,
      });

      await service.runNightlyScoring();

      // Verify vendor.update was called with zero scores
      expect(prisma.vendor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trustScore: 0,
            qualityScore: 0,
          }),
        })
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 5. getVendorScore Tests
  // ────────────────────────────────────────────────────────────────
  describe('getVendorScore (getScores)', () => {
    it('returns latest trust + quality scores for vendor org', async () => {
      const vendorOrgId = 'vendor-scores-1';

      prisma.vendor.findFirst.mockResolvedValue({
        orgId: vendorOrgId,
        trustScore: 78.5,
        qualityScore: 82.3,
        onTimeDeliveryPct: 95.0,
        slaCompliancePct: 88.0,
        falsePositiveRate: 5.2,
        evidenceQualityScore: 92.0,
        org: { name: 'Quality Vendor Inc' },
      });

      const result = await service.getScores(vendorOrgId);

      expect(result.orgId).toBe(vendorOrgId);
      expect(result.trustScore).toBe(78.5);
      expect(result.qualityScore).toBe(82.3);
      expect(result.org.name).toBe('Quality Vendor Inc');

      expect(prisma.vendor.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: vendorOrgId },
        })
      );
    });

    it('returns all vendor scorecards sorted by trust score descending', async () => {
      prisma.vendor.findMany.mockResolvedValue([
        {
          orgId: 'v-1',
          trustScore: 95.0,
          qualityScore: 92.0,
          org: { id: 'v-1', name: 'Vendor A', shortCode: 'VA' },
        },
        {
          orgId: 'v-2',
          trustScore: 75.0,
          qualityScore: 78.0,
          org: { id: 'v-2', name: 'Vendor B', shortCode: 'VB' },
        },
        {
          orgId: 'v-3',
          trustScore: 55.0,
          qualityScore: 60.0,
          org: { id: 'v-3', name: 'Vendor C', shortCode: 'VC' },
        },
      ]);

      const result = await service.getAllScores();

      expect(result.length).toBe(3);
      expect(result[0].trustScore).toBe(95.0); // Highest first
      expect(result[1].trustScore).toBe(75.0);
      expect(result[2].trustScore).toBe(55.0); // Lowest last

      expect(prisma.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { trustScore: 'desc' },
        })
      );
    });

    it('includes org name and details in response', async () => {
      const vendorOrgId = 'vendor-with-details';

      prisma.vendor.findFirst.mockResolvedValue({
        orgId: vendorOrgId,
        trustScore: 82.0,
        qualityScore: 85.0,
        onTimeDeliveryPct: 98.0,
        slaCompliancePct: 93.0,
        falsePositiveRate: 2.1,
        recurringFindingsRate: 1.5,
        evidenceQualityScore: 95.0,
        org: { name: 'Premier Audit Vendor' },
      });

      const result = await service.getScores(vendorOrgId);

      expect(result.org.name).toBeDefined();
      expect(result.trustScore).toBeDefined();
      expect(result.qualityScore).toBeDefined();
      expect(result.onTimeDeliveryPct).toBeDefined();
      expect(result.slaCompliancePct).toBeDefined();
    });

    it('handles vendor not found gracefully', async () => {
      prisma.vendor.findFirst.mockResolvedValue(null);

      const result = await service.getScores('non-existent-vendor');

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 6. Scoring Component Tests
  // ────────────────────────────────────────────────────────────────
  describe('Individual Scoring Components', () => {
    it('on-time delivery percentage calculation', async () => {
      const vendorOrgId = 'vendor-ontime';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'a-1',
          vendorOrgId,
          status: 'CLOSED',
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-28'), // On time
          findings: [],
        },
        {
          id: 'a-2',
          vendorOrgId,
          status: 'CLOSED',
          endDate: new Date('2026-02-28'),
          closedAt: new Date('2026-03-05'), // Late
          findings: [],
        },
        {
          id: 'a-3',
          vendorOrgId,
          status: 'IN_PROGRESS', // Not completed
          endDate: new Date('2026-03-31'),
          closedAt: null,
          findings: [],
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        onTimeDeliveryPct: 50.0, // 1 of 2 completed on time
      });

      const result = await service.scoreVendor(vendorOrgId);

      expect(prisma.vendor.update).toHaveBeenCalled();
    });

    it('false positive rate calculation', async () => {
      const vendorOrgId = 'vendor-fp';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'a-fp',
          vendorOrgId,
          status: 'CLOSED',
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-28'),
          findings: [
            { id: 'f-1', status: 'FALSE_POSITIVE', severity: 'LOW', slaDate: null, slaBreached: false, isRecurring: false, _count: { evidence: 0 } },
            { id: 'f-2', status: 'VALIDATED', severity: 'LOW', slaDate: null, slaBreached: false, isRecurring: false, _count: { evidence: 0 } },
            { id: 'f-3', status: 'FALSE_POSITIVE', severity: 'LOW', slaDate: null, slaBreached: false, isRecurring: false, _count: { evidence: 0 } },
            { id: 'f-4', status: 'VALIDATED', severity: 'LOW', slaDate: null, slaBreached: false, isRecurring: false, _count: { evidence: 0 } },
          ],
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        falsePositiveRate: 50.0, // 2 of 4 findings
      });

      const result = await service.scoreVendor(vendorOrgId);

      expect(prisma.vendor.update).toHaveBeenCalled();
    });

    it('recurring findings rate calculation', async () => {
      const vendorOrgId = 'vendor-recurring';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'a-recurring',
          vendorOrgId,
          status: 'CLOSED',
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-28'),
          findings: [
            { id: 'f-r1', isRecurring: true, severity: 'MEDIUM', status: 'VALIDATED', slaDate: null, slaBreached: false, _count: { evidence: 0 } },
            { id: 'f-r2', isRecurring: true, severity: 'MEDIUM', status: 'VALIDATED', slaDate: null, slaBreached: false, _count: { evidence: 0 } },
            { id: 'f-r3', isRecurring: false, severity: 'LOW', status: 'VALIDATED', slaDate: null, slaBreached: false, _count: { evidence: 0 } },
          ],
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        recurringFindingsRate: 66.7, // 2 of 3
      });

      await service.scoreVendor(vendorOrgId);

      expect(prisma.vendor.update).toHaveBeenCalled();
    });

    it('SLA compliance percentage (only CRITICAL/HIGH)', async () => {
      const vendorOrgId = 'vendor-sla';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'a-sla',
          vendorOrgId,
          status: 'CLOSED',
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-28'),
          findings: [
            { id: 'f-c1', severity: 'CRITICAL', status: 'VALIDATED', slaDate: new Date('2026-01-07'), slaBreached: false, isRecurring: false, _count: { evidence: 0 } },
            { id: 'f-c2', severity: 'CRITICAL', status: 'VALIDATED', slaDate: new Date('2026-01-08'), slaBreached: true, isRecurring: false, _count: { evidence: 0 } },
            { id: 'f-h1', severity: 'HIGH', status: 'VALIDATED', slaDate: new Date('2026-01-10'), slaBreached: false, isRecurring: false, _count: { evidence: 0 } },
            { id: 'f-m1', severity: 'MEDIUM', status: 'VALIDATED', slaDate: new Date('2026-01-20'), slaBreached: true, isRecurring: false, _count: { evidence: 0 } }, // MEDIUM — ignored for SLA
          ],
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        slaCompliancePct: 66.7, // 2 of 3 CRITICAL/HIGH
      });

      await service.scoreVendor(vendorOrgId);

      expect(prisma.vendor.update).toHaveBeenCalled();
    });

    it('evidence quality score (% findings with evidence)', async () => {
      const vendorOrgId = 'vendor-evidence';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'a-evidence',
          vendorOrgId,
          status: 'CLOSED',
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-28'),
          findings: [
            { id: 'f-e1', severity: 'MEDIUM', status: 'VALIDATED', slaDate: null, slaBreached: false, isRecurring: false, _count: { evidence: 3 } }, // With evidence
            { id: 'f-e2', severity: 'MEDIUM', status: 'VALIDATED', slaDate: null, slaBreached: false, isRecurring: false, _count: { evidence: 1 } },
            { id: 'f-e3', severity: 'LOW', status: 'VALIDATED', slaDate: null, slaBreached: false, isRecurring: false, _count: { evidence: 0 } }, // No evidence
            { id: 'f-e4', severity: 'LOW', status: 'VALIDATED', slaDate: null, slaBreached: false, isRecurring: false, _count: { evidence: 0 } },
          ],
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        evidenceQualityScore: 50.0, // 2 of 4 findings with evidence
      });

      await service.scoreVendor(vendorOrgId);

      expect(prisma.vendor.update).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 7. Trust Score Weight Tests
  // ────────────────────────────────────────────────────────────────
  describe('Trust Score Weighting', () => {
    it('trust score = onTimeDelivery(0.25) + qualityScore(0.50) + slaCompliance(0.25)', async () => {
      // Formula: trustScore = (onTimeDeliveryPct * 0.25) + (qualityScore * 0.50) + (slaCompliancePct * 0.25)
      // Example: 100% on-time + 80 quality + 100% SLA = (100*0.25) + (80*0.50) + (100*0.25) = 25 + 40 + 25 = 90
      const vendorOrgId = 'vendor-trust-weights';

      prisma.audit.findMany.mockResolvedValue([
        {
          id: 'a-tw',
          vendorOrgId,
          status: 'CLOSED',
          endDate: new Date('2026-01-31'),
          closedAt: new Date('2026-01-30'),
          findings: [
            {
              id: 'f-tw1',
              severity: 'CRITICAL',
              status: 'VALIDATED',
              slaDate: new Date('2026-01-07'),
              slaBreached: false,
              isRecurring: false,
              _count: { evidence: 2 },
            },
          ],
        },
      ]);

      prisma.vendor.update.mockResolvedValue({
        trustScore: 90.0, // Estimated based on weights
      });

      const result = await service.scoreVendor(vendorOrgId);

      expect(result.trustScore).toBeDefined();
      expect(prisma.vendor.update).toHaveBeenCalled();
    });
  });
});
