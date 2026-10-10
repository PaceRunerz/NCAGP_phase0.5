// ─────────────────────────────────────────────────────────────────
// NCAGP — Assets Service
// File: src/assets/assets.service.ts
// ─────────────────────────────────────────────────────────────────

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { AssetType, AssetStatus } from '@prisma/client';

interface CreateAssetDto {
  orgId: string;
  assetType: AssetType;
  name: string;
  description?: string;
  ownerUserId?: string;
  businessUnit: string;
  criticality: number;
  dataSensitivity: string;
  environment: string;
  ipAddress?: string;
  hostname?: string;
  tags?: string[];

  // ITAM extension — all optional
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  subLocationId?: string;
  isTangible?: boolean;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  assetTag?: string;
  amcProvider?: string;
  amcStartDate?: string;
  amcExpiryDate?: string;
  validityDate?: string;
  expiryDate?: string;
  procurementDate?: string;
  costCenter?: string;
  custodianOrgId?: string;
  customFields?: Record<string, any>;
  categoryIds?: string[];
}

const ASSET_INCLUDE_COMMON = {
  org: { select: { id: true, name: true, shortCode: true } },
  site: { select: { id: true, name: true } },
  building: { select: { id: true, name: true } },
  floor: { select: { id: true, name: true } },
  subLocation: { select: { id: true, name: true } },
  custodianOrg: { select: { id: true, name: true, shortCode: true } },
  // .category: true already pulls every scalar field; nesting
  // controlGroups here is what actually powers the multi-category ->
  // multi-checklist merge — the frontend needs to know which
  // Control.category groups each of an asset's tagged categories pulls
  // in, without a separate round trip.
  categoryLinks: { include: { category: { include: { controlGroups: true } } } },
  certificates: {
    select: { id: true, name: true, fileType: true, fileSizeBytes: true, issuedDate: true, expiryDate: true, uploadedAt: true },
  },
};

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService, private ledger: LedgerService) {}

  async create(dto: CreateAssetDto) {
    const { categoryIds, ...assetData } = dto;

    const asset = await this.prisma.asset.create({
      data: {
        ...assetData,
        amcStartDate: dto.amcStartDate ? new Date(dto.amcStartDate) : undefined,
        amcExpiryDate: dto.amcExpiryDate ? new Date(dto.amcExpiryDate) : undefined,
        validityDate: dto.validityDate ? new Date(dto.validityDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        procurementDate: dto.procurementDate ? new Date(dto.procurementDate) : undefined,
        customFields: dto.customFields ?? undefined,
        status: AssetStatus.ACTIVE,
      },
    });

    if (categoryIds && categoryIds.length > 0) {
      await this.prisma.assetCategoryLink.createMany({
        data: categoryIds.map(categoryId => ({ assetId: asset.id, categoryId })),
        skipDuplicates: true,
      });
    }

    return this.findOne(asset.id, asset.orgId);
  }

  async findAll(orgId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { ...(orgId ? { orgId } : {}), status: { not: AssetStatus.DECOMMISSIONED } },
      include: {
        _count: { select: { findings: true, certificates: true } },
        org: { select: { id: true, name: true, shortCode: true } },
        site: { select: { id: true, name: true } },
        building: { select: { id: true, name: true } },
        floor: { select: { id: true, name: true } },
        subLocation: { select: { id: true, name: true } },
        categoryLinks: { include: { category: { include: { controlGroups: true } } } },
        auditAssets: {
          include: {
            audit: {
              select: {
                id: true, title: true, status: true, framework: true,
                startDate: true, endDate: true,
                vendorOrg: { select: { name: true } },
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
      orderBy: [{ criticality: 'desc' }, { name: 'asc' }],
    });

    // Same merge computation as findOne — see note there. Done here too
    // since the Asset Register drawer's "selected" asset comes straight
    // from this list, not a separate per-asset fetch.
    return assets.map(asset => ({
      ...asset,
      applicableControlCategories: Array.from(new Set(
        (asset as any).categoryLinks.flatMap((link: any) =>
          (link.category?.controlGroups || []).map((g: any) => g.controlCategory)
        )
      )),
    }));
  }

  async findOne(id: string, orgId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: orgId ? { id, orgId } : { id },
      include: {
        ...ASSET_INCLUDE_COMMON,
        _count: { select: { findings: true, certificates: true } },
        findings: {
          where: { status: { notIn: ['CLOSED', 'FALSE_POSITIVE'] } },
          select: { id: true, severity: true, status: true, title: true },
        },
        auditAssets: {
          include: {
            audit: {
              select: {
                id: true, title: true, status: true, framework: true,
                startDate: true, endDate: true,
                vendorOrg: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    // Multi-category → multi-checklist merge: flatten every tagged
    // category's linked control-groups into one deduplicated list. The
    // Checklist tab unions this with the linked audit's framework
    // controls, so an asset tagged e.g. "Network Device" pulls in Network
    // Security controls even on an audit whose framework alone wouldn't
    // have surfaced them for that particular asset.
    const applicableControlCategories = Array.from(new Set(
      (asset as any).categoryLinks.flatMap((link: any) =>
        (link.category?.controlGroups || []).map((g: any) => g.controlCategory)
      )
    ));

    return { ...asset, applicableControlCategories };
  }

  /**
   * Set (replace) this asset's category assignments in one call — the
   * multi-select the frontend uses. Diffing add/remove rather than
   * delete-then-recreate everything so `assignedAt` timestamps on
   * categories that stay assigned aren't wiped for no reason.
   */
  /**
   * Section 6 hardening: every edit to an existing asset's fields is
   * individually diffed and ledgered — not just asset creation. A
   * criticality downgrade, a quietly-changed data-sensitivity level, or
   * an edited AMC expiry date all leave a permanent, attributable trace
   * (before -> after, who, when). This is what makes the register
   * trustworthy for audit purposes, not just a database with a form on
   * top of it.
   */
  async update(id: string, orgId: string, patch: Partial<CreateAssetDto>, updatedById: string) {
    const existing = await this.prisma.asset.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Asset not found or outside your department');

    // Only allow known, editable scalar fields through — never let a
    // caller smuggle orgId/id/batchId changes via this endpoint.
    const EDITABLE_KEYS = [
      'name', 'description', 'businessUnit', 'criticality', 'dataSensitivity', 'environment',
      'ipAddress', 'hostname', 'tags', 'model', 'manufacturer', 'serialNumber', 'assetTag',
      'amcProvider', 'amcStartDate', 'amcExpiryDate', 'validityDate', 'expiryDate',
      'procurementDate', 'costCenter', 'status', 'customFields',
    ] as const;

    const DATE_KEYS = new Set(['amcStartDate', 'amcExpiryDate', 'validityDate', 'expiryDate', 'procurementDate']);

    const data: Record<string, any> = {};
    const diffs: { field: string; before: any; after: any }[] = [];
    const expiryWarnings: string[] = [];

    for (const key of EDITABLE_KEYS) {
      if (!(key in patch)) continue;
      let value: any = (patch as any)[key];
      if (DATE_KEYS.has(key) && value) value = new Date(value);

      const beforeValue = (existing as any)[key];
      const beforeComparable = beforeValue instanceof Date ? beforeValue.toISOString() : beforeValue;
      const afterComparable = value instanceof Date ? value.toISOString() : value;
      if (JSON.stringify(beforeComparable) === JSON.stringify(afterComparable)) continue; // no real change, skip noise

      data[key] = value;
      diffs.push({ field: key, before: beforeComparable ?? null, after: afterComparable ?? null });

      // Section 6, rule 4: an edited-in expiry date already in the past
      // is flagged on save, never silently accepted.
      if (DATE_KEYS.has(key) && value instanceof Date && value.getTime() < Date.now()) {
        expiryWarnings.push(`"${key}" was set to a date already in the past (${value.toISOString().slice(0, 10)})`);
      }
    }

    if (diffs.length === 0) {
      return { asset: existing, diffs: [], expiryWarnings: [] };
    }

    const updated = await this.prisma.asset.update({ where: { id }, data, include: ASSET_INCLUDE_COMMON });

    // One ledger entry per edit action, carrying every field that
    // changed in this save — granular enough to reconstruct history
    // field-by-field, without spamming one entry per key.
    await this.ledger.record({
      userId: updatedById,
      orgId,
      eventType: 'ASSET_FIELD_EDITED' as any,
      entityType: 'Asset',
      entityId: id,
      payload: { diffs, expiryWarnings },
      ipAddress: 'unknown',
    });

    return { asset: updated, diffs, expiryWarnings };
  }

  async setCategories(assetId: string, categoryIds: string[]) {
    const existing = await this.prisma.assetCategoryLink.findMany({ where: { assetId } });
    const existingIds = new Set(existing.map(e => e.categoryId));
    const wantedIds = new Set(categoryIds);

    const toAdd = categoryIds.filter(id => !existingIds.has(id));
    const toRemove = existing.filter(e => !wantedIds.has(e.categoryId));

    await this.prisma.$transaction([
      ...(toAdd.length ? [this.prisma.assetCategoryLink.createMany({ data: toAdd.map(categoryId => ({ assetId, categoryId })), skipDuplicates: true })] : []),
      ...(toRemove.length ? [this.prisma.assetCategoryLink.deleteMany({ where: { id: { in: toRemove.map(r => r.id) } } })] : []),
    ]);

    return this.prisma.assetCategoryLink.findMany({ where: { assetId }, include: { category: true } });
  }

  /**
   * Bulk registration — "50 desktops on Floor 3" in one action instead of
   * 50 form submissions. Shared attributes (location, categories,
   * criticality, AMC, etc.) are applied to every asset in the batch.
   * Supports both:
   *   - auto-numbered identity: pass `count`, get Asset-001..050 (renamed
   *     later as needed)
   *   - individually-provided identity: pass `names` (one per asset —
   *     e.g. real serial numbers or asset tags known up front)
   * Exactly one of `count` / `names` must be provided.
   */
  async createBatch(dto: {
    orgId: string;
    batchName: string;
    createdById: string;
    count?: number;
    names?: string[];
    namePrefix?: string;
    shared: Omit<CreateAssetDto, 'orgId' | 'name' | 'categoryIds'> & { categoryIds?: string[] };
  }) {
    if (!dto.count && (!dto.names || dto.names.length === 0)) {
      throw new BadRequestException('Provide either count (for auto-numbered assets) or names (for individually-identified assets)');
    }
    if (dto.count && dto.names?.length) {
      throw new BadRequestException('Provide either count or names, not both');
    }

    const assetNames: string[] = dto.names && dto.names.length > 0
      ? dto.names
      : Array.from({ length: dto.count! }, (_, i) => `${dto.namePrefix || dto.batchName}-${String(i + 1).padStart(3, '0')}`);

    const batch = await this.prisma.assetBatch.create({
      data: {
        orgId: dto.orgId,
        name: dto.batchName,
        createdById: dto.createdById,
        assetCount: assetNames.length,
      },
    });

    const { categoryIds, ...sharedData } = dto.shared;

    const createdAssets = await this.prisma.$transaction(
      assetNames.map(name =>
        this.prisma.asset.create({
          data: {
            ...sharedData,
            orgId: dto.orgId,
            name,
            batchId: batch.id,
            amcStartDate: sharedData.amcStartDate ? new Date(sharedData.amcStartDate) : undefined,
            amcExpiryDate: sharedData.amcExpiryDate ? new Date(sharedData.amcExpiryDate) : undefined,
            validityDate: sharedData.validityDate ? new Date(sharedData.validityDate) : undefined,
            expiryDate: sharedData.expiryDate ? new Date(sharedData.expiryDate) : undefined,
            procurementDate: sharedData.procurementDate ? new Date(sharedData.procurementDate) : undefined,
            customFields: sharedData.customFields ?? undefined,
            status: AssetStatus.ACTIVE,
          },
        })
      )
    );

    if (categoryIds && categoryIds.length > 0) {
      await this.prisma.assetCategoryLink.createMany({
        data: createdAssets.flatMap(a => categoryIds.map(categoryId => ({ assetId: a.id, categoryId }))),
        skipDuplicates: true,
      });
    }

    return { batch, assets: createdAssets };
  }
}
