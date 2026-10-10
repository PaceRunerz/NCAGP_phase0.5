// Tests for AssetCategoriesService — custom category request logging
// (Section 2) and custom field promotion candidate scanning (Section 4).
import { AssetCategoriesService } from './asset-categories.service';

describe('AssetCategoriesService — custom category requests (Section 2)', () => {
  let service: AssetCategoriesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      categoryRequest: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    service = new AssetCategoriesService(prisma);
  });

  it('logs a category request with the requester and org', async () => {
    prisma.categoryRequest.create.mockResolvedValue({ id: 'req1' });
    await service.requestCustomCategory({ orgId: 'org1', requestedById: 'user1', requestedName: 'Drone / UAV' });
    expect(prisma.categoryRequest.create).toHaveBeenCalledWith({
      data: { orgId: 'org1', requestedById: 'user1', requestedName: 'Drone / UAV' },
    });
  });

  it('marks a request reviewed with the reviewer and timestamp', async () => {
    prisma.categoryRequest.findUnique.mockResolvedValue({ id: 'req1' });
    prisma.categoryRequest.update.mockResolvedValue({ id: 'req1', status: 'REVIEWED_ADDED' });
    const result = await service.reviewCustomCategoryRequest('req1', 'admin1', 'REVIEWED_ADDED');
    expect(prisma.categoryRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'req1' }, data: expect.objectContaining({ status: 'REVIEWED_ADDED', reviewedById: 'admin1' }) }),
    );
    expect(result.status).toBe('REVIEWED_ADDED');
  });

  it('throws reviewing a request that does not exist', async () => {
    prisma.categoryRequest.findUnique.mockResolvedValue(null);
    await expect(service.reviewCustomCategoryRequest('nope', 'admin1', 'REVIEWED_DECLINED')).rejects.toThrow();
  });
});

describe('AssetCategoriesService — custom field promotion (Section 4)', () => {
  let service: AssetCategoriesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      assetCategory: { findUnique: jest.fn() },
      asset: { findMany: jest.fn() },
      categoryCustomFieldTemplate: { upsert: jest.fn() },
    };
    service = new AssetCategoriesService(prisma);
  });

  it('surfaces a custom field key used at or above the minimum occurrence threshold', async () => {
    prisma.assetCategory.findUnique.mockResolvedValue({ id: 'cat1', customFieldTemplates: [] });
    prisma.asset.findMany.mockResolvedValue([
      { customFields: { gpuModel: 'RTX 4090' } },
      { customFields: { gpuModel: 'RTX 3080' } },
      { customFields: { gpuModel: 'RTX 3060' } },
    ]);
    const candidates = await service.getCustomFieldPromotionCandidates('cat1', 3);
    expect(candidates).toEqual([{ key: 'gpuModel', occurrences: 3 }]);
  });

  it('excludes a key used below the minimum occurrence threshold', async () => {
    prisma.assetCategory.findUnique.mockResolvedValue({ id: 'cat1', customFieldTemplates: [] });
    prisma.asset.findMany.mockResolvedValue([{ customFields: { rareKey: 'x' } }]);
    const candidates = await service.getCustomFieldPromotionCandidates('cat1', 3);
    expect(candidates).toEqual([]);
  });

  it('excludes a key that has already been promoted', async () => {
    prisma.assetCategory.findUnique.mockResolvedValue({ id: 'cat1', customFieldTemplates: [{ key: 'gpuModel' }] });
    prisma.asset.findMany.mockResolvedValue([
      { customFields: { gpuModel: 'A' } },
      { customFields: { gpuModel: 'B' } },
      { customFields: { gpuModel: 'C' } },
    ]);
    const candidates = await service.getCustomFieldPromotionCandidates('cat1', 3);
    expect(candidates).toEqual([]);
  });

  it('ignores empty/null values when counting occurrences', async () => {
    prisma.assetCategory.findUnique.mockResolvedValue({ id: 'cat1', customFieldTemplates: [] });
    prisma.asset.findMany.mockResolvedValue([
      { customFields: { note: '' } },
      { customFields: { note: null } },
      { customFields: { note: 'real value' } },
    ]);
    const candidates = await service.getCustomFieldPromotionCandidates('cat1', 1);
    expect(candidates).toEqual([{ key: 'note', occurrences: 1 }]);
  });

  it('upserts on promote so re-promoting the same key updates rather than errors', async () => {
    prisma.assetCategory.findUnique.mockResolvedValue({ id: 'cat1' });
    prisma.categoryCustomFieldTemplate.upsert.mockResolvedValue({ id: 'tpl1' });
    await service.promoteCustomField('cat1', { key: 'gpuModel', label: 'GPU Model' }, 'admin1');
    expect(prisma.categoryCustomFieldTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { categoryId_key: { categoryId: 'cat1', key: 'gpuModel' } } }),
    );
  });
});

describe('AssetCategoriesService — getResolvedFields merges Field Groups + promoted custom fields', () => {
  let service: AssetCategoriesService;
  let prisma: any;

  beforeEach(() => {
    prisma = { assetCategory: { findUnique: jest.fn() } };
    service = new AssetCategoriesService(prisma);
  });

  it('includes a promoted custom field alongside the category\'s Field Group fields', async () => {
    prisma.assetCategory.findUnique.mockResolvedValue({
      id: 'cat1',
      fieldGroups: ['GROUP_9_UNIVERSAL'],
      customFieldTemplates: [{ key: 'gpuModel', label: 'GPU Model', fieldType: 'text' }],
    });
    const { fields } = await service.getResolvedFields('cat1');
    expect(fields.some((f) => f.key === 'gpuModel')).toBe(true);
  });

  it('does not duplicate a promoted field key that also exists in a Field Group', async () => {
    prisma.assetCategory.findUnique.mockResolvedValue({
      id: 'cat1',
      fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY'], // has 'serialNumber'
      customFieldTemplates: [{ key: 'serialNumber', label: 'Serial (duplicate)', fieldType: 'text' }],
    });
    const { fields } = await service.getResolvedFields('cat1');
    const serialFields = fields.filter((f) => f.key === 'serialNumber');
    expect(serialFields.length).toBe(1);
  });
});
