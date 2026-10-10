import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceService } from './evidence.service';
import { EvidenceController } from './evidence.controller';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LedgerService } from '../ledger/ledger.service';
import { BadRequestException, NotFoundException, StreamableFile } from '@nestjs/common';
import * as crypto from 'crypto';
import { FindingStatus, EvidenceType } from '@prisma/client';

// Tests for EvidenceService (and related controller behaviors)

describe('EvidenceService', () => {
  let service: EvidenceService;
  let controller: EvidenceController;
  let prisma: any;
  let storage: any;
  let ledger: any;

  beforeEach(async () => {
    prisma = {
      finding: { findFirst: jest.fn(), update: jest.fn() },
      evidence: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    };

    storage = {
      upload: jest.fn(),
      download: jest.fn(),
    };

    ledger = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceController],
      providers: [
        EvidenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: LedgerService, useValue: ledger },
      ],
    }).compile();

    service = module.get<EvidenceService>(EvidenceService);
    controller = module.get<EvidenceController>(EvidenceController);

    jest.resetAllMocks();
    // Ensure any timer state is clean
    jest.useRealTimers();
  });

  describe('uploadEvidence', () => {
    it('file uploaded -> SHA-256 hash stored in DB and ledger recorded', async () => {
      const fileBuffer = Buffer.from('hello-evidence');
      const expectedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      prisma.finding.findFirst.mockResolvedValue({ id: 'f1', status: FindingStatus.OPEN, audit: { id: 'audit-1', orgId: 'org-1' } });
      storage.upload.mockResolvedValue({ path: 'dummy-path' });
      prisma.evidence.create.mockResolvedValue({ id: 'e-1', uploadedAt: new Date(), sha256Hash: expectedHash, storageRef: 'dummy-path' });
      prisma.finding.update.mockResolvedValue({ id: 'f1', status: FindingStatus.IN_REMEDIATION });

      const dto: any = {
        findingId: 'f1',
        evidenceType: 'OTHER' as EvidenceType,
        description: 'desc',
        file: { originalname: 'report.pdf', mimetype: 'application/pdf', size: fileBuffer.length, buffer: fileBuffer },
        uploadedById: 'user-1',
        orgId: 'org-1',
        ipAddress: '1.1.1.1',
      };

      const res = await service.upload(dto);

      expect(prisma.finding.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'f1' }, include: { audit: expect.any(Object) } }));
      expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ buffer: fileBuffer, contentType: 'application/pdf' }));
      expect(prisma.evidence.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sha256Hash: expectedHash, fileName: expect.any(String) }) }));
      expect(ledger.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'EVIDENCE_UPLOADED', orgId: 'org-1', entityType: 'Evidence' }));
      expect(res.sha256Hash).toBe(expectedHash);
    });

    it('hash computed matches the file bytes', async () => {
      const buf = Buffer.from('match-test');
      const expected = crypto.createHash('sha256').update(buf).digest('hex');

      prisma.finding.findFirst.mockResolvedValue({ id: 'f2', status: FindingStatus.OPEN, audit: { id: 'audit-2', orgId: 'org-2' } });
      storage.upload.mockResolvedValue({ path: 'p' });
      prisma.evidence.create.mockResolvedValue({ id: 'e-2', uploadedAt: new Date(), sha256Hash: expected, storageRef: 'p' });

      const dto: any = { findingId: 'f2', evidenceType: 'OTHER' as EvidenceType, file: { originalname: 'a.txt', mimetype: 'text/plain', size: buf.length, buffer: buf }, uploadedById: 'u', orgId: 'org-2', ipAddress: 'ip' };

      const r = await service.upload(dto);
      expect(r.sha256Hash).toBe(expected);
    });

    it('allowed MIME types pass', async () => {
      const allowed = [
        'image/png','image/jpeg','image/gif','application/pdf','text/plain','text/csv','application/json','application/xml','application/zip','video/mp4',
      ];

      prisma.finding.findFirst.mockResolvedValue({ id: 'f3', status: FindingStatus.OPEN, audit: { id: 'audit-3', orgId: 'org-3' } });
      prisma.evidence.create.mockResolvedValue({ id: 'e-3', uploadedAt: new Date(), sha256Hash: 'h', storageRef: 'p' });
      storage.upload.mockResolvedValue({ path: 'p' });

      for (const m of allowed) {
        const dto: any = { findingId: 'f3', evidenceType: 'OTHER' as EvidenceType, file: { originalname: 'file.bin', mimetype: m, size: 4, buffer: Buffer.from('x') }, uploadedById: 'u', orgId: 'org-3', ipAddress: 'ip' };
        await expect(service.upload(dto)).resolves.toBeDefined();
      }

      expect(prisma.evidence.create).toHaveBeenCalled();
    });

    it('blocked MIME type -> throws BadRequestException', async () => {
      const buf = Buffer.from('x');
      const dto: any = { findingId: 'f4', evidenceType: 'OTHER' as EvidenceType, file: { originalname: 'bad.doc', mimetype: 'application/msword', size: buf.length, buffer: buf }, uploadedById: 'u', orgId: 'org-4', ipAddress: 'ip' };

      // Should fail fast before DB lookup
      await expect(service.upload(dto)).rejects.toThrow(BadRequestException);
      expect(prisma.finding.findFirst).not.toHaveBeenCalled();
    });

    it('file saved to storage with correct key (timestamp + sanitized filename)', async () => {
      const now = 1600000000000;
      jest.useFakeTimers('modern');
      jest.setSystemTime(now);

      const buf = Buffer.from('data');
      prisma.finding.findFirst.mockResolvedValue({ id: 'f5', status: FindingStatus.OPEN, audit: { id: 'audit-5', orgId: 'org-5' } });
      prisma.evidence.create.mockResolvedValue({ id: 'e-5', uploadedAt: new Date(now), sha256Hash: 'h', storageRef: 'p' });
      storage.upload.mockResolvedValue({ path: 'p' });

      const dto: any = { findingId: 'f5', evidenceType: 'OTHER' as EvidenceType, file: { originalname: 'weird name.pdf', mimetype: 'application/pdf', size: buf.length, buffer: buf }, uploadedById: 'u', orgId: 'org-5', ipAddress: 'ip' };

      await service.upload(dto);

      const safeFile = 'weird_name.pdf';
      const expectedPath = `evidence/${dto.orgId}/${'audit-5'}/${dto.findingId}/${now}_${safeFile}`;
      expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ path: expectedPath }));

      jest.useRealTimers();
    });
  });

  describe('Immutability', () => {
    it('deleteEvidence method does not exist', () => {
      expect((service as any).deleteEvidence).toBeUndefined();
    });

    it('supersede -> creates new evidence and marks old as superseded; original not deleted', async () => {
      const existing = { id: 'old-e', findingId: 'f10', evidenceType: 'OTHER', isSuperseded: false };
      prisma.evidence.findFirst.mockResolvedValue(existing);

      const newEvidence = { id: 'new-e', storageRef: 'p', sha256Hash: 'h', uploadedAt: new Date() };
      // spy on upload to avoid full upload flow
      jest.spyOn(service as any, 'upload').mockResolvedValue(newEvidence);

      prisma.evidence.update.mockResolvedValue({ ...existing, isSuperseded: true, supersededById: newEvidence.id });

      const dto: any = { evidenceId: existing.id, reason: 'replace', newFile: { originalname: 'r.pdf', mimetype: 'application/pdf', size: 1, buffer: Buffer.from('x') }, requestedById: 'user-9', orgId: 'org-9', ipAddress: 'ip' };

      const res = await service.supersede(dto);

      expect((service as any).upload).toHaveBeenCalledWith(expect.objectContaining({ findingId: existing.findingId }));
      expect(prisma.evidence.update).toHaveBeenCalledWith({ where: { id: existing.id }, data: expect.objectContaining({ isSuperseded: true, supersededById: newEvidence.id }) });
      expect(ledger.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'EVIDENCE_SUPERSEDED', entityId: existing.id }));
      // Ensure no delete called
      expect((prisma.evidence as any).delete).toBeUndefined();
      expect(res).toEqual(newEvidence);
    });
  });

  describe('verifyIntegrity', () => {
    it('file in storage matches stored SHA-256 -> returns valid true', async () => {
      const buf = Buffer.from('integrity-ok');
      const hash = crypto.createHash('sha256').update(buf).digest('hex');

      prisma.evidence.findFirst.mockResolvedValue({ id: 'ev1', storageRef: 'p1', sha256Hash: hash, finding: { orgId: 'org-x' } });
      storage.download.mockResolvedValue(buf);

      const result = await service.verifyIntegrity('ev1', 'org-x');
      expect(result.isIntact).toBe(true);
      expect(result.storedHash).toBe(hash);
      expect(result.computedHash).toBe(hash);
    });

    it('file tampered (hash mismatch) -> returns valid false and ledger recorded', async () => {
      const original = Buffer.from('original');
      const tampered = Buffer.from('tampered');
      const originalHash = crypto.createHash('sha256').update(original).digest('hex');

      prisma.evidence.findFirst.mockResolvedValue({ id: 'ev2', storageRef: 'p2', sha256Hash: originalHash, finding: { orgId: 'org-y' } });
      storage.download.mockResolvedValue(tampered);

      const result = await service.verifyIntegrity('ev2', 'org-y');
      expect(result.isIntact).toBe(false);
      expect(result.storedHash).toBe(originalHash);
      expect(result.computedHash).not.toBe(originalHash);
      expect(ledger.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'EVIDENCE_INTEGRITY_CHECK', orgId: 'org-y', entityId: 'ev2' }));
    });
  });

  describe('Controller file serving & org-scoping', () => {
    it('serveFile returns stream from storage and sets headers', async () => {
      const buf = Buffer.from('file-stream');
      prisma.evidence.findFirst.mockResolvedValue({ id: 'e-file', storageRef: 'pfile', mimeType: 'application/pdf', fileName: 'r.pdf', sha256Hash: 'h', finding: { orgId: 'org-serve' } });
      storage.download.mockResolvedValue(buf);

      const user = { id: 'u1', role: 'DEPT_CISO', dataAccessScope: ['org-serve'], orgId: 'org-other' };
      const res: any = { set: jest.fn() };

      const ret = await controller.serveFile('e-file', user, res);
      expect(storage.download).toHaveBeenCalledWith('pfile');
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'X-Evidence-Hash': 'h' }));
      expect(ret).toBeInstanceOf(StreamableFile);
    });

    it('evidence belonging to different org -> throws NotFoundException (org-scoped)', async () => {
      prisma.evidence.findFirst.mockResolvedValue({ id: 'e-file2', storageRef: 'pfile2', mimeType: 'application/pdf', fileName: 'r.pdf', sha256Hash: 'h', finding: { orgId: 'org-other' } });

      const user = { id: 'u2', role: 'DEPT_CISO', dataAccessScope: ['org-xyz'], orgId: 'org-xyz' };
      const res: any = { set: jest.fn() };

      await expect(controller.serveFile('e-file2', user, res)).rejects.toThrow(NotFoundException);
    });

    it('listAll filters by org_id for non-NIC_ADMIN users', async () => {
      prisma.evidence.findMany.mockResolvedValue([]);

      const user = { id: 'u3', role: 'DEPT_SECURITY', orgId: 'org-list', dataAccessScope: [] };
      await controller.listAll(user as any);

      expect(prisma.evidence.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { finding: { orgId: { in: [user.orgId] } } } }));
    });

    it('listAll does not filter for NIC_ADMIN', async () => {
      prisma.evidence.findMany.mockResolvedValue([]);
      const user = { id: 'admin', role: 'NIC_ADMIN', orgId: 'org-any', dataAccessScope: [] };
      await controller.listAll(user as any);
      expect(prisma.evidence.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
    });
  });
});
