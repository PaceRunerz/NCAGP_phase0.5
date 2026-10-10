import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

// Tests for LedgerService — append (record), verifyChainIntegrity, and query/getEntityHistory.
// Note: The ledger is designed so DB-level protections (triggers / RLS) enforce immutability and org-scoping.

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: any;

  const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      auditLedger: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);

    jest.resetAllMocks();
    jest.useRealTimers();
  });

  // -------------------------
  // appendEntry (record)
  // -------------------------
  describe('appendEntry (record)', () => {
    it('new entry gets correct hash derived from prev_hash, payload and metadata', async () => {
      // Freeze time for deterministic timestamp
      const fixed = new Date('2026-01-01T00:00:00.000Z');
      jest.useFakeTimers('modern');
      jest.setSystemTime(fixed);

      const payload = { a: 1, b: 'two' };
      const lastHash = 'abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd';

      // Capture tx to inspect create call
      let capturedTx: any = null;
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          auditLedger: {
            findFirst: jest.fn().mockResolvedValue({ hashCurrent: lastHash }),
            create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
          },
        };
        capturedTx = tx;
        return await fn(tx);
      });

      const entry = {
        userId: 'user-123',
        orgId: 'org-9',
        eventType: 'TEST_EVENT',
        entityType: 'Finding',
        entityId: 'finding-77',
        payload,
        ipAddress: '10.0.0.1',
        userAgent: 'jest',
      } as any;

      const id = await service.record(entry);
      expect(id).toBe('ledger-1');

      // Verify create was called with expected hashPrev and hashCurrent
      expect(capturedTx).not.toBeNull();
      const createArg = capturedTx.auditLedger.create.mock.calls[0][0].data;

      // payloadHash computed deterministically with sorted keys
      const payloadHash = crypto.createHash('sha256')
        .update(JSON.stringify(payload, Object.keys(payload).sort()))
        .digest('hex');

      const timestamp = fixed.toISOString();
      const hashInput = [
        lastHash,
        timestamp,
        entry.userId,
        entry.orgId,
        entry.eventType,
        entry.entityType,
        entry.entityId,
        payloadHash,
      ].join('|');

      const expectedHashCurrent = crypto.createHash('sha256').update(hashInput).digest('hex');

      expect(createArg.hashPrev).toBe(lastHash);
      expect(createArg.hashCurrent).toBe(expectedHashCurrent);

      // verify essential fields were persisted
      expect(createArg.userId).toBe(entry.userId);
      expect(createArg.orgId).toBe(entry.orgId);
      expect(createArg.eventType).toBe(entry.eventType);
      expect(createArg.entityType).toBe(entry.entityType);
      expect(createArg.entityId).toBe(entry.entityId);

      // Service must not call top-level update/delete on auditLedger (DB triggers protect the table)
      expect(prisma.auditLedger.update).not.toHaveBeenCalled();
      expect(prisma.auditLedger.delete).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('first entry uses GENESIS hash as prev_hash', async () => {
      const fixed = new Date('2026-02-02T12:00:00.000Z');
      jest.useFakeTimers('modern');
      jest.setSystemTime(fixed);

      const payload = { hello: 'world' };

      let capturedTx: any = null;
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          auditLedger: {
            findFirst: jest.fn().mockResolvedValue(null), // no previous entry
            create: jest.fn().mockResolvedValue({ id: 'ledger-genesis' }),
          },
        };
        capturedTx = tx;
        return await fn(tx);
      });

      const entry = { userId: 'u', orgId: 'orgG', eventType: 'CREATE', entityType: 'Audit', entityId: 'a1', payload, ipAddress: 'ip' } as any;
      const id = await service.record(entry);
      expect(id).toBe('ledger-genesis');

      const createArg = capturedTx.auditLedger.create.mock.calls[0][0].data;
      expect(createArg.hashPrev).toBe(GENESIS_HASH);

      // recompute hashCurrent and ensure it matches
      const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload, Object.keys(payload).sort())).digest('hex');
      const timestamp = fixed.toISOString();
      const expectedHash = crypto.createHash('sha256').update([GENESIS_HASH, timestamp, entry.userId, entry.orgId, entry.eventType, entry.entityType, entry.entityId, payloadHash].join('|')).digest('hex');
      expect(createArg.hashCurrent).toBe(expectedHash);

      jest.useRealTimers();
    });

    it('every append performs INSERT only (never UPDATE)', async () => {
      // make a minimal successful append
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          auditLedger: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'i1' }),
          },
        };
        return await fn(tx);
      });

      const entry = { userId: 'u', orgId: 'o', eventType: 'E', entityType: 'X', entityId: 'id', payload: {}, ipAddress: 'ip' } as any;
      await service.record(entry);

      expect(prisma.auditLedger.update).not.toHaveBeenCalled();
      expect(prisma.auditLedger.delete).not.toHaveBeenCalled();
    });
  });

  // -------------------------
  // verifyChainIntegrity
  // -------------------------
  describe('verifyChainIntegrity', () => {
    function payloadHash(payload: any) {
      return crypto.createHash('sha256')
        .update(JSON.stringify(payload, Object.keys(payload).sort()))
        .digest('hex');
    }

    function computeHash(prevHash: string, timestampIso: string, entry: any) {
      const pHash = payloadHash(entry.payload || {});
      const input = [prevHash, timestampIso, entry.userId, entry.orgId, entry.eventType, entry.entityType, entry.entityId, pHash].join('|');
      return crypto.createHash('sha256').update(input).digest('hex');
    }

    it('chain with no tampering -> valid true and totalEntries = N', async () => {
      // Build 3 consistent entries
      const t1 = new Date('2026-03-01T00:00:00.000Z');
      const t2 = new Date('2026-03-01T00:01:00.000Z');
      const t3 = new Date('2026-03-01T00:02:00.000Z');

      const e1: any = { id: 'e1', userId: 'u1', orgId: 'orgA', eventType: 'A', entityType: 'Finding', entityId: 'f1', payload: { x: 1 }, ipAddress: 'ip', timestamp: t1, hashPrev: GENESIS_HASH };
      e1.hashCurrent = computeHash(e1.hashPrev, e1.timestamp.toISOString(), e1);

      const e2: any = { id: 'e2', userId: 'u2', orgId: 'orgA', eventType: 'B', entityType: 'Finding', entityId: 'f2', payload: { y: 2 }, ipAddress: 'ip', timestamp: t2, hashPrev: e1.hashCurrent };
      e2.hashCurrent = computeHash(e2.hashPrev, e2.timestamp.toISOString(), e2);

      const e3: any = { id: 'e3', userId: 'u3', orgId: 'orgA', eventType: 'C', entityType: 'Evidence', entityId: 'ev1', payload: { z: 3 }, ipAddress: 'ip', timestamp: t3, hashPrev: e2.hashCurrent };
      e3.hashCurrent = computeHash(e3.hashPrev, e3.timestamp.toISOString(), e3);

      prisma.auditLedger.findMany.mockResolvedValue([e1, e2, e3]);

      const res = await service.verifyChainIntegrity();
      expect(res.isValid).toBe(true);
      expect(res.totalEntries).toBe(3);
    });

    it('tampered entry -> returns invalid and brokenEntryId', async () => {
      const t1 = new Date('2026-04-01T00:00:00.000Z');
      const t2 = new Date('2026-04-01T00:01:00.000Z');

      const a1: any = { id: 'a1', userId: 'u1', orgId: 'orgX', eventType: 'A', entityType: 'Finding', entityId: 'f1', payload: { x: 1 }, ipAddress: 'ip', timestamp: t1, hashPrev: GENESIS_HASH };
      a1.hashCurrent = computeHash(a1.hashPrev, a1.timestamp.toISOString(), a1);

      const a2: any = { id: 'a2', userId: 'u2', orgId: 'orgX', eventType: 'B', entityType: 'Finding', entityId: 'f1', payload: { y: 2 }, ipAddress: 'ip', timestamp: t2, hashPrev: a1.hashCurrent };
      a2.hashCurrent = computeHash(a2.hashPrev, a2.timestamp.toISOString(), a2);

      // Tamper with a2: change eventType after hash was computed
      const tampered = { ...a2, eventType: 'MALICIOUS' };
      // Keep hashCurrent as originally computed (so recompute will mismatch)
      tampered.hashCurrent = a2.hashCurrent;

      prisma.auditLedger.findMany.mockResolvedValue([a1, tampered]);

      const res = await service.verifyChainIntegrity();
      expect(res.isValid).toBe(false);
      expect(res.brokenEntryId).toBe('a2');
      expect(res.totalEntries).toBe(2);
    });

    it('empty ledger -> returns valid true and totalEntries 0', async () => {
      prisma.auditLedger.findMany.mockResolvedValue([]);
      const res = await service.verifyChainIntegrity();
      expect(res.isValid).toBe(true);
      expect(res.totalEntries).toBe(0);
    });
  });

  // -------------------------
  // queryLedger / getEntityHistory
  // -------------------------
  describe('queryLedger / getEntityHistory', () => {
    it('getEntityHistory returns entries filtered by entityType and entityId in chronological order and includes user info', async () => {
      const rows = [
        { id: 'h1', entityType: 'Finding', entityId: 'f100', timestamp: new Date('2026-05-01T00:00:00Z'), user: { id: 'u1', name: 'Alice' } },
        { id: 'h2', entityType: 'Finding', entityId: 'f100', timestamp: new Date('2026-05-02T00:00:00Z'), user: { id: 'u2', name: 'Bob' } },
      ];

      prisma.auditLedger.findMany.mockResolvedValue(rows);

      const result = await service.getEntityHistory('Finding', 'f100');

      // assert call shape — service delegates filtering and ordering to Prisma
      expect(prisma.auditLedger.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { entityType: 'Finding', entityId: 'f100' },
        orderBy: { timestamp: 'asc' },
        include: { user: expect.any(Object) },
      }));

      expect(result).toEqual(rows);
    });

    it('query capabilities (entityType, userId) are provided by DB layer — service returns DB results (org-scoping is enforced by DB/RLS)', async () => {
      // This test documents intent: Ledger service delegates filtering to DB. Here we sanity-check that
      // the service returns entries the DB provides. DB-level org filtering / RLS must prevent cross-tenant reads.
      const rows = [ { id: 'x1', orgId: 'org-Z', userId: 'uX', entityType: 'Evidence', entityId: 'ev1', timestamp: new Date('2026-06-01T00:00:00Z') } ];
      prisma.auditLedger.findMany.mockResolvedValue(rows);

      const res = await service.verifyChainIntegrity(new Date('2026-01-01'), new Date('2027-01-01'));
      // verifyChainIntegrity asked for entries in a time-range; result.totalEntries should reflect DB output
      expect(res.totalEntries).toBe(1);
    });
  });

  // -------------------------
  // DB trigger protection
  // -------------------------
  describe('DB trigger protection (intent)', () => {
    it('DB triggers block UPDATE/DELETE — service must not call update or delete on auditLedger', async () => {
      // Documented intent: Audit ledger is append-only. Database triggers deny UPDATE/DELETE.
      // These tests ensure the service layer never attempts them.

      // Arrange a normal record append
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = { auditLedger: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'aa' }) } };
        return await fn(tx);
      });

      await service.record({ userId: 'u', orgId: 'o', eventType: 'E', entityType: 'X', entityId: 'id', payload: {}, ipAddress: 'ip' } as any);
      await service.verifyChainIntegrity();
      await service.getEntityHistory('X', 'id');

      expect(prisma.auditLedger.update).not.toHaveBeenCalled();
      expect(prisma.auditLedger.delete).not.toHaveBeenCalled();
    });
  });
});
