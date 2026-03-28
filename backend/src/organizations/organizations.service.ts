// ─────────────────────────────────────────────────────────────────
// NCAGP — Organizations Service
// File: src/organizations/organizations.service.ts
// ─────────────────────────────────────────────────────────────────

import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { OrgType } from '@prisma/client';

interface CreateOrgDto {
  name: string;
  shortCode: string;
  orgType: OrgType;
  parentOrgId?: string;
  encryptionDomain: string;
  createdById: string;
  ipAddress: string;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  async create(dto: CreateOrgDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { shortCode: dto.shortCode },
    });
    if (existing) throw new ConflictException(`Short code '${dto.shortCode}' already exists`);

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        shortCode: dto.shortCode,
        orgType: dto.orgType,
        parentOrgId: dto.parentOrgId,
        encryptionDomain: dto.encryptionDomain,
        dataAccessScope: [],
      },
    });

    await this.ledger.record({
      userId: dto.createdById,
      orgId: org.id,
      eventType: 'ORG_CREATED',
      entityType: 'Organization',
      entityId: org.id,
      payload: { name: org.name, shortCode: org.shortCode, orgType: org.orgType },
      ipAddress: dto.ipAddress,
    });

    return org;
  }

  async findAll(requesterRole: string) {
    // NIC_ADMIN sees all, others see their filtered view
    return this.prisma.organization.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { users: true, assets: true, findings: true },
        },
      },
      orderBy: [{ orgType: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        _count: { select: { assets: true, findings: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }
}
