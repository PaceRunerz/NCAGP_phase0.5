import { AssetBulkImportService } from './asset-bulk-import.service';

// Tests for AssetBulkImportService — template generation and, most
// importantly, the dry-run validate() pass that enforces Section 6's
// anti-fraud rules (never a silent partial write; duplicate serials
// rejected; past-dated expiries flagged, not hidden).
//
// The service's constructor only takes (prisma, ledger) — no need for
// @nestjs/testing's full DI module machinery just to unit test plain
// class methods, so this instantiates it directly with mocks.
describe('AssetBulkImportService', () => {
  let service: AssetBulkImportService;
  let prisma: any;
  let ledger: any;

  const DESKTOP_CATEGORY = {
    id: 'cat-desktop',
    code: 'DESKTOP_COMPUTER',
    fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_9_UNIVERSAL'],
    name: 'Desktop Computer',
  };

  const LICENSE_CATEGORY = {
    id: 'cat-license',
    code: 'SOFTWARE_LICENSE',
    fieldGroups: ['GROUP_6_LICENSE_CERT', 'GROUP_9_UNIVERSAL'],
    name: 'Software License',
  };

  // Has GROUP_3_NETWORK (unlike Desktop) — the fixture for proving
  // IP/MAC become mandatory only for categories that actually declare
  // network fields.
  const ROUTER_CATEGORY = {
    id: 'cat-router',
    code: 'ROUTER',
    fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_3_NETWORK', 'GROUP_9_UNIVERSAL'],
    name: 'Router',
  };

  beforeEach(() => {
    prisma = {
      assetCategory: { findUnique: jest.fn() },
      asset: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      assetCategoryLink: { createMany: jest.fn() },
      assetBatch: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    ledger = { record: jest.fn() };
    service = new AssetBulkImportService(prisma, ledger);
  });

  describe('generateTemplate', () => {
    it('includes only universal columns plus this category\'s resolved fields', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(DESKTOP_CATEGORY);
      const { csv, filename } = await service.generateTemplate('cat-desktop');
      expect(filename).toBe('DESKTOP_COMPUTER_bulk_import_template.csv');
      expect(csv).toContain('Asset Name');
      expect(csv).toContain('Department');
      expect(csv).toContain('Serial Number');
      // A Desktop pulls Group 1 + Group 2 — should NOT include Group 4/5-only fields.
      expect(csv).not.toContain('URL / Domain');
      expect(csv).not.toContain('Cloud Region');
    });
  });

  describe('validate', () => {
    const DESKTOP_HEADER = 'Asset Name,Department,Criticality (1-5),Data Sensitivity (PUBLIC/INTERNAL/CONFIDENTIAL/SECRET),Model,Serial Number,Asset Tag,Notes';
    const ROUTER_HEADER = 'Asset Name,Department,Criticality (1-5),Data Sensitivity (PUBLIC/INTERNAL/CONFIDENTIAL/SECRET),Model,IP Address,MAC Address,Serial Number,Asset Tag,Notes';
    const LICENSE_HEADER = 'Asset Name,Department,Criticality (1-5),Data Sensitivity (PUBLIC/INTERNAL/CONFIDENTIAL/SECRET),Serial Number,Asset Tag,Notes';

    it('accepts a fully valid Desktop row (only Model required, no IP/MAC — Desktop has no GROUP_3_NETWORK)', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(DESKTOP_CATEGORY);
      const csv = `${DESKTOP_HEADER}\nDesktop 1,IT Division,3,INTERNAL,OptiPlex 7010,SN001,AT001,`;
      const result = await service.validate('cat-desktop', 'org-1', csv);
      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(0);
    });

    it('rejects a Desktop row missing Model (mandatory — Desktop has GROUP_1_PHYSICAL_IDENTITY)', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(DESKTOP_CATEGORY);
      const csv = `${DESKTOP_HEADER}\nDesktop 1,IT Division,3,INTERNAL,,,,`;
      const result = await service.validate('cat-desktop', 'org-1', csv);
      expect(result.validCount).toBe(0);
      expect(result.errors.some((e) => e.message.includes('Missing Model'))).toBe(true);
    });

    it('accepts a Software License row with no Model/IP/MAC columns at all (License has neither Group 1 nor Group 3)', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(LICENSE_CATEGORY);
      const header = `${LICENSE_HEADER},Expiry Date *`;
      const csv = `${header}\nMS Office License,IT,3,INTERNAL,,,,2030-01-01`;
      const result = await service.validate('cat-license', 'org-1', csv);
      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(0);
    });

    it('rejects a Router row missing IP/MAC (mandatory — Router has GROUP_3_NETWORK)', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(ROUTER_CATEGORY);
      const csv = `${ROUTER_HEADER}\nCore Router 1,IT,4,INTERNAL,Cisco ISR4331,,,,,`;
      const result = await service.validate('cat-router', 'org-1', csv);
      expect(result.validCount).toBe(0);
      expect(result.errors.some((e) => e.message.includes('Missing IP Address'))).toBe(true);
      expect(result.errors.some((e) => e.message.includes('Missing MAC Address'))).toBe(true);
    });

    it('accepts a fully valid Router row (Model + IP + MAC all present)', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(ROUTER_CATEGORY);
      const csv = `${ROUTER_HEADER}\nCore Router 1,IT,4,INTERNAL,Cisco ISR4331,10.0.0.1,3C:52:82:1A:9F:0B,,,`;
      const result = await service.validate('cat-router', 'org-1', csv);
      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(0);
    });

    it('rejects a row missing a required universal field', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(DESKTOP_CATEGORY);
      const csv = `${DESKTOP_HEADER}\n,IT Division,3,INTERNAL,OptiPlex 7010,,,`; // missing name
      const result = await service.validate('cat-desktop', 'org-1', csv);
      expect(result.validCount).toBe(0);
      expect(result.errors.some((e) => e.message.includes('Asset Name'))).toBe(true);
    });

    it('rejects criticality outside 1-5', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(DESKTOP_CATEGORY);
      const csv = `${DESKTOP_HEADER}\nDesktop 1,IT,9,INTERNAL,OptiPlex 7010,,,`;
      const result = await service.validate('cat-desktop', 'org-1', csv);
      expect(result.validCount).toBe(0);
      expect(result.errors.some((e) => e.message.includes('Criticality'))).toBe(true);
    });

    it('rejects an invalid Data Sensitivity value', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(DESKTOP_CATEGORY);
      const csv = `${DESKTOP_HEADER}\nDesktop 1,IT,3,TOP_SECRET_LOL,OptiPlex 7010,,,`;
      const result = await service.validate('cat-desktop', 'org-1', csv);
      expect(result.validCount).toBe(0);
      expect(result.errors.some((e) => e.message.includes('Data Sensitivity'))).toBe(true);
    });

    it('rejects a serial number that already exists in the org (Section 6, rule 6)', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(DESKTOP_CATEGORY);
      prisma.asset.findMany.mockResolvedValue([{ serialNumber: 'SN001' }]);
      const csv = `${DESKTOP_HEADER}\nDesktop 1,IT,3,INTERNAL,OptiPlex 7010,SN001,,`;
      const result = await service.validate('cat-desktop', 'org-1', csv);
      expect(result.validCount).toBe(0);
      expect(result.errors.some((e) => e.message.includes('Duplicate Serial Number'))).toBe(true);
    });

    it('rejects a serial number duplicated within the same file', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(DESKTOP_CATEGORY);
      const csv = `${DESKTOP_HEADER}\nDesktop 1,IT,3,INTERNAL,OptiPlex 7010,SN-DUP,,\nDesktop 2,IT,3,INTERNAL,OptiPlex 7010,SN-DUP,,`;
      const result = await service.validate('cat-desktop', 'org-1', csv);
      expect(result.validCount).toBe(1); // first row is fine, second is rejected
      expect(result.errors.some((e) => e.row === 3 && e.message.includes('repeated within this file'))).toBe(true);
    });

    it('flags (but does not block) a past-dated expiry field as a WARNING (Section 6, rule 4)', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(LICENSE_CATEGORY);
      const header = `${LICENSE_HEADER},Expiry Date *`;
      const pastDate = '2020-01-01';
      const csv = `${header}\nOld License,IT,3,INTERNAL,,,,${pastDate}`;
      const result = await service.validate('cat-license', 'org-1', csv);
      // Row should still be valid (warning, not a hard error) but flagged.
      const warnings = result.errors.filter((e) => e.message.startsWith('WARNING'));
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('rejects a malformed date in a date-typed field', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(LICENSE_CATEGORY);
      const header = `${LICENSE_HEADER},Expiry Date *`;
      const csv = `${header}\nBad Date License,IT,3,INTERNAL,,,,not-a-real-date`;
      const result = await service.validate('cat-license', 'org-1', csv);
      expect(result.validCount).toBe(0);
      expect(result.errors.some((e) => e.message.includes('not a valid date'))).toBe(true);
    });

    it('throws if the uploaded file has no data rows', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(DESKTOP_CATEGORY);
      await expect(service.validate('cat-desktop', 'org-1', DESKTOP_HEADER)).rejects.toThrow();
    });
  });

  describe('commit', () => {
    it('writes rows in a single transaction and records one ledger entry per asset plus one batch summary', async () => {
      prisma.assetBatch.create.mockResolvedValue({ id: 'batch-1' });
      prisma.$transaction.mockResolvedValue([{ id: 'asset-1' }, { id: 'asset-2' }]);

      const result = await service.commit({
        categoryId: 'cat-desktop',
        orgId: 'org-1',
        batchName: 'Test Batch',
        createdById: 'user-1',
        rows: [
          { row: 2, name: 'Desktop 1', businessUnit: 'IT', criticality: 3, dataSensitivity: 'INTERNAL', customFields: {} },
          { row: 3, name: 'Desktop 2', businessUnit: 'IT', criticality: 3, dataSensitivity: 'INTERNAL', customFields: {} },
        ] as any,
      });

      expect(result.assetsCreated).toBe(2);
      // One ledger call per asset (2) + one batch summary call = 3.
      expect(ledger.record).toHaveBeenCalledTimes(3);
      expect(ledger.record).toHaveBeenLastCalledWith(
        expect.objectContaining({ eventType: 'ASSET_BATCH_CREATED', entityId: 'batch-1' }),
      );
    });

    it('throws if there are no rows to commit', async () => {
      await expect(
        service.commit({ categoryId: 'cat-desktop', orgId: 'org-1', batchName: 'Empty', createdById: 'user-1', rows: [] }),
      ).rejects.toThrow();
    });
  });
});
