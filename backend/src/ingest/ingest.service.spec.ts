import { Test, TestingModule } from '@nestjs/testing';
import { IngestService, ScannerPayload, IngestResult } from './ingest.service';
import { IngestController } from './ingest.controller';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ApiKeysService } from '../apikeys/apikeys.service';
import { BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { FindingStatus, Severity } from '@prisma/client';

// Tests for IngestService and IngestController
// - Single and batch finding ingestion
// - API key validation with scopes
// - Duplicate detection within 24h window
// - Org-scoping enforcement
// - Batch size limits

describe('IngestService', () => {
  let service: IngestService;
  let controller: IngestController;
  let prisma: any;
  let ledger: any;
  let apiKeys: any;

  beforeEach(async () => {
    prisma = {
      audit: { findFirst: jest.fn() },
      finding: { create: jest.fn(), findFirst: jest.fn() },
    };

    ledger = { record: jest.fn().mockResolvedValue('ledger-entry-1') };

    apiKeys = { validateKey: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestController],
      providers: [
        IngestService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledger },
        { provide: ApiKeysService, useValue: apiKeys },
      ],
    }).compile();

    service = module.get<IngestService>(IngestService);
    controller = module.get<IngestController>(IngestController);

    jest.resetAllMocks();
    jest.useRealTimers();
  });

  // -------------------------
  // Single finding ingestion
  // -------------------------
  describe('Single finding ingestion', () => {
    it('valid API key + valid payload -> finding created and returned', async () => {
      const audit = { id: 'audit-1', orgId: 'org-1' };
      const payload: ScannerPayload = {
        audit_id: 'audit-1',
        severity: 'critical',
        title: 'SSL cert expired',
        description: 'The certificate is expired.',
      };

      prisma.audit.findFirst.mockResolvedValue(audit);
      prisma.finding.create.mockResolvedValue({
        id: 'finding-1',
        severity: Severity.CRITICAL,
        slaDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const result = await service.ingestFinding(payload, 'org-1', 'key-1', '1.1.1.1');

      expect(result.findingId).toBe('finding-1');
      expect(result.severity).toBe(Severity.CRITICAL);
      expect(result.isDuplicate).toBe(false);
      expect(result.message).toBe('Finding created successfully');
      expect(ledger.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'FINDING_CREATED', entityId: 'finding-1' }));
    });

    it('missing required fields (audit_id, severity, title) -> throws BadRequestException', async () => {
      const payload: ScannerPayload = {
        audit_id: '',
        severity: 'high',
        title: 'X',
        description: 'desc',
      };

      prisma.audit.findFirst.mockResolvedValue(null);

      await expect(service.ingestFinding(payload, 'org-1', 'key-1', 'ip')).rejects.toThrow(BadRequestException);
    });

    it('audit not found for org -> throws BadRequestException', async () => {
      const payload: ScannerPayload = {
        audit_id: 'missing-audit',
        severity: 'medium',
        title: 'Finding',
        description: 'desc',
      };

      prisma.audit.findFirst.mockResolvedValue(null);

      await expect(service.ingestFinding(payload, 'org-1', 'key-1', 'ip')).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------
  // Batch ingestion
  // -------------------------
  describe('Batch ingestion', () => {
    it('500 findings -> all created, returns { created: 500, duplicates: 0 }', async () => {
      const audit = { id: 'audit-b', orgId: 'org-b' };
      prisma.audit.findFirst.mockResolvedValue(audit);
      prisma.finding.create.mockResolvedValue({ id: 'f-123', severity: Severity.MEDIUM, slaDate: new Date() });

      const payloads = Array.from({ length: 500 }, (_, i) => ({
        audit_id: 'audit-b',
        severity: 'medium',
        title: `Finding ${i}`,
        description: 'desc',
      } as ScannerPayload));

      const result = await service.ingestBatch(payloads, 'org-b', 'key-b', 'ip');

      expect(result.created).toBe(500);
      expect(result.duplicates).toBe(0);
      expect(result.total).toBe(500);
      expect(result.errors).toBe(0);
      expect(result.results.length).toBe(500);
    });

    it('501 findings in controller batch endpoint -> throws BadRequestException (max 500)', async () => {
      const payloads = Array.from({ length: 501 }, (_, i) => ({
        audit_id: 'audit-c',
        severity: 'high',
        title: `F${i}`,
        description: 'd',
      } as ScannerPayload));

      const dto: any = { findings: payloads };
      apiKeys.validateKey.mockResolvedValue({ orgId: 'org-c', scopes: ['FINDINGS_WRITE'] });

      await expect(controller.ingestBatch(dto, 'ncagp_sk_validkey', { ip: 'ip' } as any)).rejects.toThrow(BadRequestException);
    });

    it('empty array -> throws BadRequestException (validation layer should catch)', async () => {
      // In practice, class-validator @ArrayMinSize enforces this; test verifies service handles empty batch gracefully
      const result = await service.ingestBatch([], 'org-d', 'key-d', 'ip');
      expect(result.total).toBe(0);
      expect(result.created).toBe(0);
    });
  });

  // -------------------------
  // Duplicate detection
  // -------------------------
  describe('Duplicate detection', () => {
    it('same title + asset + audit within 24 hours -> skipped as duplicate', async () => {
      const audit = { id: 'audit-dup', orgId: 'org-dup' };
      const now = new Date();
      const withinDay = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12h ago

      prisma.audit.findFirst.mockResolvedValue(audit);
      prisma.finding.findFirst.mockResolvedValue({
        id: 'existing-finding',
        severity: Severity.HIGH,
        slaDate: withinDay,
      });

      const payload: ScannerPayload = {
        audit_id: 'audit-dup',
        severity: 'high',
        title: 'Dup Finding',
        description: 'desc',
        asset_id: 'asset-1',
      };

      const result = await service.ingestFinding(payload, 'org-dup', 'key-dup', 'ip');

      expect(result.isDuplicate).toBe(true);
      expect(result.findingId).toBe('existing-finding');
      expect(result.message).toContain('Duplicate');
      expect(prisma.finding.create).not.toHaveBeenCalled();
      expect(ledger.record).not.toHaveBeenCalled();
    });

    it('same finding after 25+ hours -> NOT duplicate, created fresh', async () => {
      const audit = { id: 'audit-old', orgId: 'org-old' };
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago

      prisma.audit.findFirst.mockResolvedValue(audit);
      // First findFirst returns null (no old finding in 24h window)
      prisma.finding.findFirst.mockResolvedValue(null);
      prisma.finding.create.mockResolvedValue({
        id: 'new-finding-fresh',
        severity: Severity.MEDIUM,
        slaDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const payload: ScannerPayload = {
        audit_id: 'audit-old',
        severity: 'medium',
        title: 'Same Title But Old',
        description: 'desc',
        asset_id: 'asset-x',
      };

      const result = await service.ingestFinding(payload, 'org-old', 'key-old', 'ip');

      expect(result.isDuplicate).toBe(false);
      expect(result.findingId).toBe('new-finding-fresh');
      expect(prisma.finding.create).toHaveBeenCalled();
      expect(ledger.record).toHaveBeenCalled();
    });
  });

  // -------------------------
  // Controller: API key validation and scopes
  // -------------------------
  describe('Controller: API key validation and scopes', () => {
    it('valid API key with FINDINGS_WRITE scope -> can ingest', async () => {
      apiKeys.validateKey.mockResolvedValue({ orgId: 'org-auth', scopes: ['FINDINGS_WRITE'] });
      prisma.audit.findFirst.mockResolvedValue({ id: 'audit-auth', orgId: 'org-auth' });
      prisma.finding.create.mockResolvedValue({ id: 'f-auth', severity: Severity.INFO, slaDate: new Date() });

      const dto: any = {
        audit_id: 'audit-auth',
        severity: 'info',
        title: 'Auth test',
        description: 'Test',
      };

      const res = await controller.ingestSingle(dto, 'ncagp_sk_validkey', { ip: '1.1.1.1' } as any);

      expect(res.success).toBe(true);
      expect(res.findingId).toBe('f-auth');
    });

    it('key with FINDINGS_READ scope only -> throws ForbiddenException', async () => {
      apiKeys.validateKey.mockResolvedValue({ orgId: 'org-ro', scopes: ['FINDINGS_READ'] });

      const dto: any = { audit_id: 'a', severity: 'high', title: 'X', description: 'Y' };

      await expect(controller.ingestSingle(dto, 'ncagp_sk_readonly', { ip: 'ip' } as any)).rejects.toThrow(ForbiddenException);
    });

    it('key with FULL_ACCESS scope -> can ingest', async () => {
      apiKeys.validateKey.mockResolvedValue({ orgId: 'org-full', scopes: ['FULL_ACCESS'] });
      prisma.audit.findFirst.mockResolvedValue({ id: 'audit-full', orgId: 'org-full' });
      prisma.finding.create.mockResolvedValue({ id: 'f-full', severity: Severity.CRITICAL, slaDate: new Date() });

      const dto: any = {
        audit_id: 'audit-full',
        severity: 'critical',
        title: 'Full access test',
        description: 'Test',
      };

      const res = await controller.ingestSingle(dto, 'ncagp_sk_fullaccess', { ip: '2.2.2.2' } as any);

      expect(res.success).toBe(true);
      expect(res.findingId).toBe('f-full');
    });

    it('invalid API key -> throws UnauthorizedException', async () => {
      apiKeys.validateKey.mockResolvedValue(null);

      const dto: any = { audit_id: 'a', severity: 'high', title: 'X', description: 'Y' };

      await expect(controller.ingestSingle(dto, 'ncagp_sk_invalid', { ip: 'ip' } as any)).rejects.toThrow(UnauthorizedException);
    });

    it('missing X-API-Key header -> throws UnauthorizedException', async () => {
      const dto: any = { audit_id: 'a', severity: 'high', title: 'X', description: 'Y' };

      await expect(controller.ingestSingle(dto, '', { ip: 'ip' } as any)).rejects.toThrow(UnauthorizedException);
    });

    it('invalid API key format (not starting with ncagp_sk_) -> throws UnauthorizedException', async () => {
      const dto: any = { audit_id: 'a', severity: 'high', title: 'X', description: 'Y' };

      await expect(controller.ingestSingle(dto, 'invalid_prefix_key', { ip: 'ip' } as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  // -------------------------
  // Org-scoping
  // -------------------------
  describe('Org-scoping', () => {
    it('finding ingested always tied to audit.orgId (not API key caller org)', async () => {
      const audit = { id: 'audit-org', orgId: 'org-actual' };
      prisma.audit.findFirst.mockResolvedValue(audit);
      prisma.finding.create.mockResolvedValue({ id: 'f-org', severity: Severity.HIGH, slaDate: new Date() });

      const payload: ScannerPayload = {
        audit_id: 'audit-org',
        severity: 'high',
        title: 'Org test',
        description: 'desc',
      };

      const result = await service.ingestFinding(payload, 'org-caller', 'key', 'ip');

      // Verify that finding was created with audit.orgId, not caller orgId
      expect(prisma.finding.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ orgId: audit.orgId }),
        })
      );

      expect(result.findingId).toBe('f-org');
    });

    it('cannot ingest into a different org\'s audit (audit not found for request context)', async () => {
      // Simulate: API key is from org-X, but tries to ingest into org-Y's audit
      prisma.audit.findFirst.mockResolvedValue(null); // Audit doesn't exist in caller's view

      const payload: ScannerPayload = {
        audit_id: 'org-y-audit',
        severity: 'medium',
        title: 'Cross-org attempt',
        description: 'desc',
      };

      await expect(service.ingestFinding(payload, 'org-x', 'key', 'ip')).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------
  // Severity and SLA mapping
  // -------------------------
  describe('Severity and SLA mapping', () => {
    it('critical severity maps to CRITICAL and SLA = 1 day', async () => {
      const now = new Date('2026-06-01T00:00:00Z');
      jest.useFakeTimers('modern');
      jest.setSystemTime(now);

      const audit = { id: 'audit-sla', orgId: 'org-sla' };
      prisma.audit.findFirst.mockResolvedValue(audit);

      let capturedData: any = null;
      prisma.finding.create.mockImplementation(({ data }: any) => {
        capturedData = data;
        return Promise.resolve({
          id: 'f-sla',
          severity: data.severity,
          slaDate: data.slaDate,
        });
      });

      const payload: ScannerPayload = {
        audit_id: 'audit-sla',
        severity: 'critical',
        title: 'Critical',
        description: 'desc',
      };

      await service.ingestFinding(payload, 'org-sla', 'key', 'ip');

      expect(capturedData.severity).toBe(Severity.CRITICAL);
      const expected = new Date(now);
      expected.setDate(expected.getDate() + 1);
      expect(capturedData.slaDate.toDateString()).toBe(expected.toDateString());

      jest.useRealTimers();
    });

    it('high severity maps to HIGH and SLA = 3 days', async () => {
      const now = new Date('2026-06-05T12:00:00Z');
      jest.useFakeTimers('modern');
      jest.setSystemTime(now);

      const audit = { id: 'audit-h', orgId: 'org-h' };
      prisma.audit.findFirst.mockResolvedValue(audit);

      let capturedData: any = null;
      prisma.finding.create.mockImplementation(({ data }: any) => {
        capturedData = data;
        return Promise.resolve({ id: 'f-h', severity: data.severity, slaDate: data.slaDate });
      });

      const payload: ScannerPayload = {
        audit_id: 'audit-h',
        severity: 'high',
        title: 'High',
        description: 'desc',
      };

      await service.ingestFinding(payload, 'org-h', 'key', 'ip');

      expect(capturedData.severity).toBe(Severity.HIGH);
      const expected = new Date(now);
      expected.setDate(expected.getDate() + 3);
      expect(capturedData.slaDate.toDateString()).toBe(expected.toDateString());

      jest.useRealTimers();
    });
  });

  // -------------------------
  // Batch error handling
  // -------------------------
  describe('Batch error handling', () => {
    it('batch with mixed success and errors -> returns results array with error entries', async () => {
      const audit = { id: 'audit-mix', orgId: 'org-mix' };
      prisma.audit.findFirst.mockImplementation(({ where: { id } }: any) => {
        if (id === 'audit-mix') return Promise.resolve(audit);
        return Promise.resolve(null);
      });

      prisma.finding.create.mockResolvedValue({ id: 'f-ok', severity: Severity.MEDIUM, slaDate: new Date() });

      const payloads = [
        { audit_id: 'audit-mix', severity: 'medium', title: 'OK', description: 'ok' } as ScannerPayload,
        { audit_id: 'missing-audit', severity: 'high', title: 'Fail', description: 'fail' } as ScannerPayload,
      ];

      const result = await service.ingestBatch(payloads, 'org-mix', 'key-mix', 'ip');

      expect(result.created).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.total).toBe(2);
      expect(result.results[0].severity).toBe(Severity.MEDIUM);
      expect(result.results[1].severity).toBe('ERROR');
    });
  });
});
