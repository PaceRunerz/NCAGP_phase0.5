// Tests for AssetsService.update() — the field-level diffing that makes
// every asset edit individually traceable (Section 6 hardening). Only
// exercises update() in isolation; other AssetsService methods have
// their own coverage elsewhere / are exercised via the controller.
import { AssetsService } from './assets.service';

describe('AssetsService.update', () => {
  let service: AssetsService;
  let prisma: any;
  let ledger: any;

  const EXISTING = {
    id: 'asset1',
    orgId: 'org1',
    name: 'Old Name',
    criticality: 2,
    dataSensitivity: 'INTERNAL',
    amcExpiryDate: null,
  };

  beforeEach(() => {
    prisma = {
      asset: {
        findFirst: jest.fn().mockResolvedValue(EXISTING),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...EXISTING, ...data })),
      },
    };
    ledger = { record: jest.fn() };
    service = new AssetsService(prisma, ledger);
  });

  it('does nothing and records no ledger entry when nothing actually changed', async () => {
    const result = await service.update('asset1', 'org1', { name: 'Old Name' }, 'user1');
    expect(result.diffs).toEqual([]);
    expect(prisma.asset.update).not.toHaveBeenCalled();
    expect(ledger.record).not.toHaveBeenCalled();
  });

  it('diffs a real field change and writes it', async () => {
    const result = await service.update('asset1', 'org1', { criticality: 5 }, 'user1');
    expect(result.diffs).toEqual([{ field: 'criticality', before: 2, after: 5 }]);
    expect(prisma.asset.update).toHaveBeenCalledWith(expect.objectContaining({ data: { criticality: 5 } }));
  });

  it('records exactly one ASSET_FIELD_EDITED ledger entry per save, carrying every changed field', async () => {
    await service.update('asset1', 'org1', { criticality: 5, name: 'New Name' }, 'user1');
    expect(ledger.record).toHaveBeenCalledTimes(1);
    const call = ledger.record.mock.calls[0][0];
    expect(call.eventType).toBe('ASSET_FIELD_EDITED');
    expect(call.payload.diffs.length).toBe(2);
  });

  it('rejects fields not in the editable allowlist (cannot smuggle orgId/id through this endpoint)', async () => {
    const result = await service.update('asset1', 'org1', { orgId: 'org2', id: 'hacked' } as any, 'user1');
    expect(result.diffs).toEqual([]);
    expect(prisma.asset.update).not.toHaveBeenCalled();
  });

  it('flags (does not block) an edited-in expiry date already in the past — Section 6 rule 4', async () => {
    const result = await service.update('asset1', 'org1', { amcExpiryDate: '2020-01-01' }, 'user1');
    expect(result.diffs.length).toBe(1);
    expect(result.expiryWarnings.length).toBe(1);
    expect(prisma.asset.update).toHaveBeenCalled(); // not blocked, just flagged
  });

  it('throws when the asset does not exist or is outside the caller\'s org', async () => {
    prisma.asset.findFirst.mockResolvedValue(null);
    await expect(service.update('nope', 'org1', { name: 'X' }, 'user1')).rejects.toThrow();
  });
});
