// Tests for PolicyService — most importantly getComplianceRollup(),
// since that's the entire enforcement mechanism this feature relies on:
// Policy -> PolicyControlLink -> existing Control -> existing
// AssetControlChecklist. No per-asset Policy table exists on purpose;
// these tests prove per-asset compliance is fully derivable anyway.
import { PolicyService } from './policy.service';

describe('PolicyService', () => {
  let service: PolicyService;
  let prisma: any;
  let ledger: any;

  beforeEach(() => {
    prisma = {
      policy: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      control: { findUnique: jest.fn() },
      policyControlLink: { upsert: jest.fn(), deleteMany: jest.fn() },
      policyApplicability: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
      assetControlChecklist: { findMany: jest.fn() },
    };
    ledger = { record: jest.fn() };
    service = new PolicyService(prisma, ledger);
  });

  describe('linkControl', () => {
    it('links a control and records a ledger entry', async () => {
      prisma.policy.findUnique.mockResolvedValue({ id: 'pol1', title: 'Data Privacy Policy' });
      prisma.control.findUnique.mockResolvedValue({ id: 'ctrl1', controlCode: 'AC-001', name: 'PII Encrypted' });
      prisma.policyControlLink.upsert.mockResolvedValue({ id: 'link1' });

      await service.linkControl('pol1', 'ctrl1', 'user1', 'org1');

      expect(prisma.policyControlLink.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { policyId_controlId: { policyId: 'pol1', controlId: 'ctrl1' } } }),
      );
      expect(ledger.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'POLICY_CONTROL_LINKED' }));
    });

    it('throws when the policy does not exist', async () => {
      prisma.policy.findUnique.mockResolvedValue(null);
      await expect(service.linkControl('nope', 'ctrl1', 'user1', 'org1')).rejects.toThrow();
    });

    it('throws when the control does not exist', async () => {
      prisma.policy.findUnique.mockResolvedValue({ id: 'pol1' });
      prisma.control.findUnique.mockResolvedValue(null);
      await expect(service.linkControl('pol1', 'nope', 'user1', 'org1')).rejects.toThrow();
    });
  });

  describe('setStatus', () => {
    it('auto-records the activator as approver on first DRAFT -> ACTIVE transition (separation of duties)', async () => {
      prisma.policy.findUnique.mockResolvedValue({ id: 'pol1', status: 'DRAFT', approvedById: null, title: 'Security Policy', version: 'v1' });
      prisma.policy.update.mockResolvedValue({ id: 'pol1', status: 'ACTIVE', approvedById: 'admin1' });

      await service.setStatus('pol1', 'ACTIVE', 'admin1', 'org1');

      expect(prisma.policy.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE', approvedById: 'admin1' }) }),
      );
      expect(ledger.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'POLICY_ACTIVATED' }));
    });

    it('does not overwrite an existing approver on a later status change', async () => {
      prisma.policy.findUnique.mockResolvedValue({ id: 'pol1', status: 'ACTIVE', approvedById: 'admin1' });
      prisma.policy.update.mockResolvedValue({ id: 'pol1', status: 'RETIRED' });

      await service.setStatus('pol1', 'RETIRED', 'admin2', 'org1');

      // Simple status-only update, no re-approval ledger entry for this transition.
      expect(prisma.policy.update).toHaveBeenCalledWith({ where: { id: 'pol1' }, data: { status: 'RETIRED' } });
    });
  });

  describe('getComplianceRollup', () => {
    it('returns null compliancePct when the policy has no linked controls yet', async () => {
      prisma.policy.findUnique.mockResolvedValue({ id: 'pol1', title: 'New Policy', orgId: 'org1', controlLinks: [] });
      const result = await service.getComplianceRollup('pol1');
      expect(result.compliancePct).toBeNull();
      expect(result.totalChecked).toBe(0);
    });

    it('computes compliance % across every checklist row on the policy\'s linked controls', async () => {
      prisma.policy.findUnique.mockResolvedValue({
        id: 'pol1', title: 'Data Privacy Policy', orgId: 'org1',
        controlLinks: [{ controlId: 'ctrl1', control: { id: 'ctrl1', name: 'PII Encrypted' } }],
      });
      prisma.assetControlChecklist.findMany.mockResolvedValue([
        { assetId: 'a1', controlId: 'ctrl1', status: 'COMPLIANT', asset: { id: 'a1', name: 'Desktop 1', orgId: 'org1' }, control: { id: 'ctrl1', name: 'PII Encrypted', controlCode: 'AC-001' } },
        { assetId: 'a2', controlId: 'ctrl1', status: 'NON_COMPLIANT', asset: { id: 'a2', name: 'Desktop 2', orgId: 'org1' }, control: { id: 'ctrl1', name: 'PII Encrypted', controlCode: 'AC-001' } },
      ]);

      const result = await service.getComplianceRollup('pol1');

      expect(result.totalChecked).toBe(2);
      expect(result.compliant).toBe(1);
      expect(result.nonCompliant).toBe(1);
      expect(result.compliancePct).toBe(50);
    });

    it('marks an asset non-compliant if ANY of its linked-control rows fail, even if others pass', async () => {
      prisma.policy.findUnique.mockResolvedValue({
        id: 'pol1', title: 'Security Policy', orgId: 'org1',
        controlLinks: [
          { controlId: 'ctrl1', control: { id: 'ctrl1', name: 'Encryption' } },
          { controlId: 'ctrl2', control: { id: 'ctrl2', name: 'Access Logging' } },
        ],
      });
      prisma.assetControlChecklist.findMany.mockResolvedValue([
        { assetId: 'a1', controlId: 'ctrl1', status: 'COMPLIANT', asset: { id: 'a1', name: 'Server 1', orgId: 'org1' }, control: { id: 'ctrl1', name: 'Encryption', controlCode: 'AC-001' } },
        { assetId: 'a1', controlId: 'ctrl2', status: 'NON_COMPLIANT', asset: { id: 'a1', name: 'Server 1', orgId: 'org1' }, control: { id: 'ctrl2', name: 'Access Logging', controlCode: 'AC-002' } },
      ]);

      const result = await service.getComplianceRollup('pol1');
      const server1 = result.byAsset.find((a) => a.assetId === 'a1');
      expect(server1!.compliant).toBe(false); // one failing control = asset fails the policy overall
    });

    it('throws for a policy that does not exist', async () => {
      prisma.policy.findUnique.mockResolvedValue(null);
      await expect(service.getComplianceRollup('nope')).rejects.toThrow();
    });
  });

  describe('setApplicability', () => {
    it('replaces the full applicability set rather than appending', async () => {
      prisma.policy.findUnique.mockResolvedValue({ id: 'pol1' });
      prisma.policyApplicability.findMany.mockResolvedValue([{ policyId: 'pol1', categoryCode: 'DATABASE' }]);

      await service.setApplicability('pol1', ['DATABASE']);

      expect(prisma.policyApplicability.deleteMany).toHaveBeenCalledWith({ where: { policyId: 'pol1' } });
      expect(prisma.policyApplicability.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [{ policyId: 'pol1', categoryCode: 'DATABASE' }] }),
      );
    });

    it('clears applicability entirely when given an empty list', async () => {
      prisma.policy.findUnique.mockResolvedValue({ id: 'pol1' });
      const result = await service.setApplicability('pol1', []);
      expect(prisma.policyApplicability.deleteMany).toHaveBeenCalled();
      expect(prisma.policyApplicability.createMany).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
