// ─────────────────────────────────────────────────────────────────
// SYNC — ITAM Location Hierarchy Service
// Organization → Site → Building → Floor → SubLocation
// File: src/locations/locations.service.ts
// ─────────────────────────────────────────────────────────────────

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';

interface ActorUser {
  id: string;
  orgId: string;
  role: string;
}

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService, private ledger: LedgerService) {}

  // Both NIC_ADMIN and DEPT_CISO can build out their own department's
  // location structure — a CISO shouldn't need to file a ticket with NIC
  // just to register that their building has a 3rd floor.
  private assertCanManage(orgId: string, user: ActorUser) {
    if (user.role === 'NIC_ADMIN') return;
    if (user.role === 'DEPT_CISO' && user.orgId === orgId) return;
    throw new ForbiddenException('Only NIC Admin or your department\'s CISO can manage location structure for this organization');
  }

  // ── Sites ─────────────────────────────────────────────────────
  async listSites(orgId: string) {
    return this.prisma.site.findMany({
      where: { orgId },
      include: { _count: { select: { buildings: true, assets: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createSite(dto: { orgId: string; name: string; address?: string; city?: string; state?: string; pincode?: string }, user: ActorUser) {
    this.assertCanManage(dto.orgId, user);
    const site = await this.prisma.site.create({ data: dto });
    await this.ledger.record({
      userId: user.id, orgId: dto.orgId, eventType: 'ASSET_LOCATION_CREATED',
      entityType: 'Site', entityId: site.id,
      payload: { name: site.name }, ipAddress: 'unknown',
    });
    return site;
  }

  // ── Buildings ─────────────────────────────────────────────────
  async listBuildings(siteId: string) {
    return this.prisma.building.findMany({
      where: { siteId },
      include: { _count: { select: { floors: true, assets: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createBuilding(dto: { siteId: string; name: string }, user: ActorUser) {
    const site = await this.prisma.site.findFirst({ where: { id: dto.siteId } });
    if (!site) throw new NotFoundException('Site not found');
    this.assertCanManage(site.orgId, user);

    const building = await this.prisma.building.create({ data: dto });
    await this.ledger.record({
      userId: user.id, orgId: site.orgId, eventType: 'ASSET_LOCATION_CREATED',
      entityType: 'Building', entityId: building.id,
      payload: { name: building.name, siteId: dto.siteId }, ipAddress: 'unknown',
    });
    return building;
  }

  // ── Floors ────────────────────────────────────────────────────
  async listFloors(buildingId: string) {
    return this.prisma.floor.findMany({
      where: { buildingId },
      include: { _count: { select: { subLocations: true, assets: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createFloor(dto: { buildingId: string; name: string }, user: ActorUser) {
    const building = await this.prisma.building.findFirst({ where: { id: dto.buildingId }, include: { site: true } });
    if (!building) throw new NotFoundException('Building not found');
    this.assertCanManage(building.site.orgId, user);

    const floor = await this.prisma.floor.create({ data: dto });
    await this.ledger.record({
      userId: user.id, orgId: building.site.orgId, eventType: 'ASSET_LOCATION_CREATED',
      entityType: 'Floor', entityId: floor.id,
      payload: { name: floor.name, buildingId: dto.buildingId }, ipAddress: 'unknown',
    });
    return floor;
  }

  // ── Sub-locations ─────────────────────────────────────────────
  async listSubLocations(floorId: string) {
    return this.prisma.subLocation.findMany({
      where: { floorId },
      include: { _count: { select: { assets: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createSubLocation(dto: { floorId: string; name: string; description?: string }, user: ActorUser) {
    const floor = await this.prisma.floor.findFirst({ where: { id: dto.floorId }, include: { building: { include: { site: true } } } });
    if (!floor) throw new NotFoundException('Floor not found');
    this.assertCanManage(floor.building.site.orgId, user);

    const subLocation = await this.prisma.subLocation.create({ data: dto });
    await this.ledger.record({
      userId: user.id, orgId: floor.building.site.orgId, eventType: 'ASSET_LOCATION_CREATED',
      entityType: 'SubLocation', entityId: subLocation.id,
      payload: { name: subLocation.name, floorId: dto.floorId }, ipAddress: 'unknown',
    });
    return subLocation;
  }

  // ── Full tree for one org — powers the location picker in Create/Bulk
  // Asset forms, and later the coverage overview scope tree ──
  async getLocationTree(orgId: string) {
    return this.prisma.site.findMany({
      where: { orgId },
      include: {
        buildings: {
          include: {
            floors: {
              include: {
                subLocations: { include: { _count: { select: { assets: true } } } },
                _count: { select: { assets: true } },
              },
            },
            _count: { select: { assets: true } },
          },
        },
        _count: { select: { assets: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
