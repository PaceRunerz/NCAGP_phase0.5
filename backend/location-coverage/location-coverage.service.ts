// ─────────────────────────────────────────────────────────────────
// SYNC — Location Coverage Tree (Asset Register Spec, Section 9, item 1)
// Org → Site → Building → Floor → Room, with asset count and checklist
// completion % rolled up at every node. Distinct from the existing
// per-audit /audits/:id/coverage page (control-gap coverage for one
// audit) — this is location-hierarchy coverage across the whole
// register, independent of any single audit.
// File: src/location-coverage/location-coverage.service.ts
// ─────────────────────────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CoverageNode {
  id: string;
  name: string;
  type: 'SITE' | 'BUILDING' | 'FLOOR' | 'SUB_LOCATION';
  assetCount: number;
  checklistCompletionPct: number; // 0-100, across every checklist row for assets under this node
  children: CoverageNode[];
}

@Injectable()
export class LocationCoverageService {
  constructor(private prisma: PrismaService) {}

  /**
   * Completion % definition: of every AssetControlChecklist row that
   * exists for assets under a node, what fraction are NOT NOT_CHECKED
   * (i.e. someone has actually looked at it — Compliant, Non-Compliant,
   * In Progress, or Not Applicable all count as "reviewed"). A node
   * with assets but zero checklist rows yet shows 0%, honestly, rather
   * than hiding an empty state behind a blank number.
   */
  async getTree(orgId: string): Promise<CoverageNode[]> {
    const sites = await this.prisma.site.findMany({
      where: { orgId, isActive: true },
      include: {
        buildings: {
          where: { isActive: true },
          include: {
            floors: {
              where: { isActive: true },
              include: { subLocations: { where: { isActive: true } } },
            },
          },
        },
      },
    });

    // Pull every asset's location + checklist completion in one pass,
    // rather than N+1 querying per node.
    const assets = await this.prisma.asset.findMany({
      where: { orgId },
      select: {
        id: true,
        siteId: true,
        buildingId: true,
        floorId: true,
        subLocationId: true,
        checklistEntries: { select: { status: true } },
      },
    });

    const completionForAssets = (assetIds: string[]): { assetCount: number; completionPct: number } => {
      const relevant = assets.filter((a) => assetIds.includes(a.id));
      let total = 0;
      let reviewed = 0;
      for (const a of relevant) {
        for (const c of a.checklistEntries) {
          total++;
          if (c.status !== 'NOT_CHECKED') reviewed++;
        }
      }
      return { assetCount: relevant.length, completionPct: total === 0 ? 0 : Math.round((reviewed / total) * 100) };
    };

    const buildSubLocationNode = (sl: any): CoverageNode => {
      const assetIds = assets.filter((a) => a.subLocationId === sl.id).map((a) => a.id);
      const { assetCount, completionPct } = completionForAssets(assetIds);
      return { id: sl.id, name: sl.name, type: 'SUB_LOCATION', assetCount, checklistCompletionPct: completionPct, children: [] };
    };

    const buildFloorNode = (floor: any): CoverageNode => {
      const children = floor.subLocations.map(buildSubLocationNode);
      // Floor-level assets are ones assigned directly to the floor (no room), plus rollup of children.
      const directAssetIds = assets.filter((a) => a.floorId === floor.id && !a.subLocationId).map((a) => a.id);
      const allAssetIdsUnderFloor = assets.filter((a) => a.floorId === floor.id).map((a) => a.id);
      const { completionPct } = completionForAssets(allAssetIdsUnderFloor);
      const assetCount = allAssetIdsUnderFloor.length;
      return { id: floor.id, name: floor.name, type: 'FLOOR', assetCount, checklistCompletionPct: completionPct, children };
    };

    const buildBuildingNode = (building: any): CoverageNode => {
      const children = building.floors.map(buildFloorNode);
      const allAssetIdsUnderBuilding = assets.filter((a) => a.buildingId === building.id).map((a) => a.id);
      const { completionPct } = completionForAssets(allAssetIdsUnderBuilding);
      return { id: building.id, name: building.name, type: 'BUILDING', assetCount: allAssetIdsUnderBuilding.length, checklistCompletionPct: completionPct, children };
    };

    const buildSiteNode = (site: any): CoverageNode => {
      const children = site.buildings.map(buildBuildingNode);
      const allAssetIdsUnderSite = assets.filter((a) => a.siteId === site.id).map((a) => a.id);
      const { completionPct } = completionForAssets(allAssetIdsUnderSite);
      return { id: site.id, name: site.name, type: 'SITE', assetCount: allAssetIdsUnderSite.length, checklistCompletionPct: completionPct, children };
    };

    return sites.map(buildSiteNode);
  }
}
