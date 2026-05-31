// ─────────────────────────────────────────────────────────────────
// NCAGP — Assets Service
// File: src/assets/assets.service.ts
// ─────────────────────────────────────────────────────────────────

import { Injectable, NotFoundException } from '@nestjs/common'; feav
import { PrismaService } from '../prisma/prisma.service';
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
}

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAssetDto) {
    return this.prisma.asset.create({ data: { ...dto, status: AssetStatus.ACTIVE } });
  }

  async findAll(orgId: string) {
    return this.prisma.asset.findMany({
      where: { orgId, status: { not: AssetStatus.DECOMMISSIONED } },
      include: {
        _count: { select: { findings: true } },
      },
      orderBy: [{ criticality: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, orgId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, orgId },
      include: {
        findings: {
          where: { status: { notIn: ['CLOSED', 'FALSE_POSITIVE'] } },
          select: { id: true, severity: true, status: true, title: true },
        },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }
}
