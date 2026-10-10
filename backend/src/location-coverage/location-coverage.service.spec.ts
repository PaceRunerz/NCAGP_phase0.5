// Tests for LocationCoverageService — the tree-building and
// completion-percentage rollup logic (Section 9, item 1).
import { LocationCoverageService } from './location-coverage.service';

describe('LocationCoverageService', () => {
  let service: LocationCoverageService;
  let prisma: any;

  beforeEach(() => {
    prisma = { site: { findMany: jest.fn() }, asset: { findMany: jest.fn() } };
    service = new LocationCoverageService(prisma);
  });

  it('builds a nested Site -> Building -> Floor -> SubLocation tree', async () => {
    prisma.site.findMany.mockResolvedValue([
      {
        id: 'site1', name: 'HQ',
        buildings: [
          {
            id: 'bldg1', name: 'North Block',
            floors: [{ id: 'floor1', name: 'Floor 3', subLocations: [{ id: 'room1', name: 'Server Room A' }] }],
          },
        ],
      },
    ]);
    prisma.asset.findMany.mockResolvedValue([]);

    const tree = await service.getTree('org1');
    expect(tree.length).toBe(1);
    expect(tree[0].type).toBe('SITE');
    expect(tree[0].children[0].type).toBe('BUILDING');
    expect(tree[0].children[0].children[0].type).toBe('FLOOR');
    expect(tree[0].children[0].children[0].children[0].type).toBe('SUB_LOCATION');
  });

  it('rolls up asset counts from leaf sub-locations up through every ancestor', async () => {
    prisma.site.findMany.mockResolvedValue([
      {
        id: 'site1', name: 'HQ',
        buildings: [
          {
            id: 'bldg1', name: 'North Block',
            floors: [{ id: 'floor1', name: 'Floor 3', subLocations: [{ id: 'room1', name: 'Room A' }] }],
          },
        ],
      },
    ]);
    prisma.asset.findMany.mockResolvedValue([
      { id: 'a1', siteId: 'site1', buildingId: 'bldg1', floorId: 'floor1', subLocationId: 'room1', checklistEntries: [] },
      { id: 'a2', siteId: 'site1', buildingId: 'bldg1', floorId: 'floor1', subLocationId: 'room1', checklistEntries: [] },
    ]);

    const tree = await service.getTree('org1');
    expect(tree[0].assetCount).toBe(2); // site level
    expect(tree[0].children[0].assetCount).toBe(2); // building level
    expect(tree[0].children[0].children[0].assetCount).toBe(2); // floor level
    expect(tree[0].children[0].children[0].children[0].assetCount).toBe(2); // room level
  });

  it('computes checklist completion % as the share of non-NOT_CHECKED rows', async () => {
    prisma.site.findMany.mockResolvedValue([
      { id: 'site1', name: 'HQ', buildings: [] },
    ]);
    prisma.asset.findMany.mockResolvedValue([
      {
        id: 'a1', siteId: 'site1', buildingId: null, floorId: null, subLocationId: null,
        checklistEntries: [{ status: 'COMPLIANT' }, { status: 'NOT_CHECKED' }, { status: 'NON_COMPLIANT' }, { status: 'NOT_CHECKED' }],
      },
    ]);

    const tree = await service.getTree('org1');
    // 2 of 4 rows are not NOT_CHECKED -> 50%
    expect(tree[0].checklistCompletionPct).toBe(50);
  });

  it('reports 0% honestly for a node with assets but zero checklist rows, rather than hiding it', async () => {
    prisma.site.findMany.mockResolvedValue([{ id: 'site1', name: 'HQ', buildings: [] }]);
    prisma.asset.findMany.mockResolvedValue([
      { id: 'a1', siteId: 'site1', buildingId: null, floorId: null, subLocationId: null, checklistEntries: [] },
    ]);

    const tree = await service.getTree('org1');
    expect(tree[0].assetCount).toBe(1);
    expect(tree[0].checklistCompletionPct).toBe(0);
  });

  it('returns an empty array for an org with no sites', async () => {
    prisma.site.findMany.mockResolvedValue([]);
    prisma.asset.findMany.mockResolvedValue([]);
    const tree = await service.getTree('org1');
    expect(tree).toEqual([]);
  });
});
