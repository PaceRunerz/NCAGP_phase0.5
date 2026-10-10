// Tests for ExpiryRadarService — the bucketing math and multi-source
// merge (asset dates, certificates, category-declared custom fields)
// are the parts most likely to silently drift wrong, so they're
// isolated here from the DB query shape.
import { ExpiryRadarService } from './expiry-radar.service';

describe('ExpiryRadarService', () => {
  let service: ExpiryRadarService;
  let prisma: any;

  const DAY = 86400000;
  const now = Date.now();

  beforeEach(() => {
    prisma = {
      asset: { findMany: jest.fn().mockResolvedValue([]) },
      assetCertificate: { findMany: jest.fn().mockResolvedValue([]) },
      policy: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new ExpiryRadarService(prisma);
  });

  it('includes an active policy nextReviewDate as a POLICY_REVIEW item', async () => {
    prisma.policy.findMany.mockResolvedValue([
      { id: 'pol1', title: 'Data Privacy Policy', nextReviewDate: new Date(now + 12 * DAY), orgId: 'org1', org: { name: 'MHA' } },
    ]);
    const { items } = await service.getRadar('org1', 90);
    const policyItem = items.find((i) => i.source === 'POLICY_REVIEW');
    expect(policyItem).toBeDefined();
    expect(policyItem!.assetName).toBe('Data Privacy Policy');
    expect(policyItem!.bucket).toBe('DUE_30');
  });

  it('buckets an already-past date as EXPIRED', async () => {
    prisma.asset.findMany.mockResolvedValue([
      { id: 'a1', name: 'Asset 1', orgId: 'org1', amcExpiryDate: new Date(now - 5 * DAY), expiryDate: null, validityDate: null, customFields: null, org: { name: 'Org' } },
    ]);
    const { items } = await service.getRadar('org1', 90);
    expect(items[0].bucket).toBe('EXPIRED');
    expect(items[0].daysRemaining).toBeLessThan(0);
  });

  it('buckets a date 5 days out as DUE_7', async () => {
    prisma.asset.findMany.mockResolvedValue([
      { id: 'a1', name: 'Asset 1', orgId: 'org1', amcExpiryDate: new Date(now + 5 * DAY), expiryDate: null, validityDate: null, customFields: null, org: { name: 'Org' } },
    ]);
    const { items } = await service.getRadar('org1', 90);
    expect(items[0].bucket).toBe('DUE_7');
  });

  it('buckets a date 20 days out as DUE_30', async () => {
    prisma.asset.findMany.mockResolvedValue([
      { id: 'a1', name: 'Asset 1', orgId: 'org1', amcExpiryDate: new Date(now + 20 * DAY), expiryDate: null, validityDate: null, customFields: null, org: { name: 'Org' } },
    ]);
    const { items } = await service.getRadar('org1', 90);
    expect(items[0].bucket).toBe('DUE_30');
  });

  it('buckets a date 60 days out as DUE_90', async () => {
    prisma.asset.findMany.mockResolvedValue([
      { id: 'a1', name: 'Asset 1', orgId: 'org1', amcExpiryDate: new Date(now + 60 * DAY), expiryDate: null, validityDate: null, customFields: null, org: { name: 'Org' } },
    ]);
    const { items } = await service.getRadar('org1', 90);
    expect(items[0].bucket).toBe('DUE_90');
  });

  it('excludes items entirely beyond the requested horizon', async () => {
    prisma.asset.findMany.mockResolvedValue([
      { id: 'a1', name: 'Asset 1', orgId: 'org1', amcExpiryDate: new Date(now + 200 * DAY), expiryDate: null, validityDate: null, customFields: null, org: { name: 'Org' } },
    ]);
    const { items } = await service.getRadar('org1', 90);
    expect(items.length).toBe(0);
  });

  it('pulls an expiry-bearing value out of customFields for a category-declared field (Section 3 drivesExpiryAlert)', async () => {
    prisma.asset.findMany.mockResolvedValue([
      {
        id: 'a1', name: 'Cloud Resource', orgId: 'org1',
        amcExpiryDate: null, expiryDate: null, validityDate: null,
        customFields: { vendorContractExpiry: new Date(now + 10 * DAY).toISOString() },
        org: { name: 'Org' },
      },
    ]);
    const { items } = await service.getRadar('org1', 90);
    expect(items.some((i) => i.source === 'CUSTOM_FIELD' && i.fieldKey === 'vendorContractExpiry')).toBe(true);
  });

  it('ignores a garbage (non-parseable) value in a customFields expiry key rather than throwing', async () => {
    prisma.asset.findMany.mockResolvedValue([
      {
        id: 'a1', name: 'Cloud Resource', orgId: 'org1',
        amcExpiryDate: null, expiryDate: null, validityDate: null,
        customFields: { vendorContractExpiry: 'not-a-date' },
        org: { name: 'Org' },
      },
    ]);
    await expect(service.getRadar('org1', 90)).resolves.not.toThrow();
  });

  it('merges certificate expiries alongside asset-level dates and sorts everything by daysRemaining ascending', async () => {
    prisma.asset.findMany.mockResolvedValue([
      { id: 'a1', name: 'Asset 1', orgId: 'org1', amcExpiryDate: new Date(now + 40 * DAY), expiryDate: null, validityDate: null, customFields: null, org: { name: 'Org' } },
    ]);
    prisma.assetCertificate.findMany.mockResolvedValue([
      { id: 'c1', name: 'SSL Cert', expiryDate: new Date(now + 2 * DAY), asset: { id: 'a2', name: 'Web App', orgId: 'org1', org: { name: 'Org' } } },
    ]);
    const { items, summary } = await service.getRadar('org1', 90);
    expect(items.length).toBe(2);
    expect(items[0].source).toBe('CERTIFICATE'); // sooner item first
    expect(summary.DUE_7).toBe(1);
    expect(summary.DUE_90).toBe(1);
  });

  it('produces a summary count matching every bucket represented', async () => {
    prisma.asset.findMany.mockResolvedValue([
      { id: 'a1', name: 'A1', orgId: 'org1', amcExpiryDate: new Date(now - DAY), expiryDate: null, validityDate: null, customFields: null, org: { name: 'Org' } },
      { id: 'a2', name: 'A2', orgId: 'org1', amcExpiryDate: null, expiryDate: new Date(now + 3 * DAY), validityDate: null, customFields: null, org: { name: 'Org' } },
    ]);
    const { summary } = await service.getRadar('org1', 90);
    expect(summary.EXPIRED).toBe(1);
    expect(summary.DUE_7).toBe(1);
  });
});
