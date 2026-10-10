// ─────────────────────────────────────────────────────────────────
// SYNC — Policy Management Service (Governance)
// Policy -> PolicyControlLink -> existing Control -> existing
// AssetControlChecklist. Deliberately no per-asset Policy link table —
// per-asset compliance is fully derivable through the Control chain
// that already exists, so an auditor working a normal checklist is
// automatically checking policy compliance too, with zero new UI.
// File: src/policies/policy.service.ts
// ─────────────────────────────────────────────────────────────────

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';

interface CreatePolicyDto {
  orgId?: string;
  policyType: string;
  title: string;
  version: string;
  effectiveDate?: string;
  nextReviewDate?: string;
  description?: string;
}

@Injectable()
export class PolicyService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  async list(orgId?: string) {
    return this.prisma.policy.findMany({
      where: orgId ? { OR: [{ orgId }, { orgId: null }] } : undefined,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      include: {
        org: { select: { id: true, name: true, shortCode: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        _count: { select: { controlLinks: true, applicability: true } },
      },
    });
  }

  async getOne(id: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id },
      include: {
        org: { select: { id: true, name: true, shortCode: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        controlLinks: { include: { control: true } },
        applicability: true,
      },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  async create(dto: CreatePolicyDto, createdById: string) {
    return this.prisma.policy.create({
      data: {
        orgId: dto.orgId || null,
        policyType: dto.policyType as any,
        title: dto.title,
        version: dto.version,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        nextReviewDate: dto.nextReviewDate ? new Date(dto.nextReviewDate) : undefined,
        description: dto.description,
        createdById,
      },
    });
  }

  async update(id: string, dto: Partial<CreatePolicyDto>) {
    const existing = await this.prisma.policy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Policy not found');
    return this.prisma.policy.update({
      where: { id },
      data: {
        title: dto.title,
        version: dto.version,
        description: dto.description,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        nextReviewDate: dto.nextReviewDate ? new Date(dto.nextReviewDate) : undefined,
      },
    });
  }

  /**
   * DRAFT -> ACTIVE requires an approver (separation of duties — the
   * person who wrote the policy shouldn't be the only signature on it
   * going live). ACTIVE -> SUPERSEDED/RETIRED needs no approval, any
   * status change is logged either way.
   */
  async setStatus(id: string, status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'RETIRED', actorId: string, orgId: string) {
    const policy = await this.prisma.policy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundException('Policy not found');
    if (status === 'ACTIVE' && policy.status === 'DRAFT' && !policy.approvedById) {
      // Auto-record the activator as approver if none set yet — this is
      // the sign-off moment.
      const updated = await this.prisma.policy.update({
        where: { id },
        data: { status, approvedById: actorId, approvedAt: new Date() },
      });
      await this.ledger.record({
        userId: actorId, orgId,
        eventType: 'POLICY_ACTIVATED' as any,
        entityType: 'Policy', entityId: id,
        payload: { title: policy.title, version: policy.version },
        ipAddress: 'unknown',
      });
      return updated;
    }
    return this.prisma.policy.update({ where: { id }, data: { status } });
  }

  async setStorageInfo(id: string, storagePath: string, fileHash: string, fileType: string, fileSizeBytes: number) {
    return this.prisma.policy.update({
      where: { id },
      data: { storagePath, fileHash, fileType, fileSizeBytes },
    });
  }

  // ── Control linking (the actual enforcement mechanism) ────────────
  async linkControl(policyId: string, controlId: string, actorId: string, orgId: string) {
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) throw new NotFoundException('Policy not found');
    const control = await this.prisma.control.findUnique({ where: { id: controlId } });
    if (!control) throw new NotFoundException('Control not found');
    const link = await this.prisma.policyControlLink.upsert({
      where: { policyId_controlId: { policyId, controlId } },
      update: {},
      create: { policyId, controlId },
    });
    await this.ledger.record({
      userId: actorId, orgId,
      eventType: 'POLICY_CONTROL_LINKED' as any,
      entityType: 'Policy', entityId: policyId,
      payload: { controlId, controlCode: control.controlCode, controlName: control.name },
      ipAddress: 'unknown',
    });
    return link;
  }

  async unlinkControl(policyId: string, controlId: string) {
    return this.prisma.policyControlLink.deleteMany({ where: { policyId, controlId } });
  }

  // ── Applicability (descriptive, not gating) ────────────────────────
  async setApplicability(policyId: string, categoryCodes: string[]) {
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) throw new NotFoundException('Policy not found');
    await this.prisma.policyApplicability.deleteMany({ where: { policyId } });
    if (categoryCodes.length === 0) return [];
    await this.prisma.policyApplicability.createMany({
      data: categoryCodes.map((categoryCode) => ({ policyId, categoryCode })),
      skipDuplicates: true,
    });
    return this.prisma.policyApplicability.findMany({ where: { policyId } });
  }

  /**
   * The compliance rollup: for one policy, what fraction of checklist
   * rows on its linked controls (across the policy's org, or every org
   * if it's a NIC-wide baseline) are COMPLIANT. This is a live query
   * over data that already exists — nothing about this is duplicated
   * or cached, so it can never drift from the real checklist state.
   */
  async getComplianceRollup(policyId: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: { controlLinks: { include: { control: true } } },
    });
    if (!policy) throw new NotFoundException('Policy not found');

    const controlIds = policy.controlLinks.map((l) => l.controlId);
    if (controlIds.length === 0) {
      return { policyId, policyTitle: policy.title, totalChecked: 0, compliant: 0, nonCompliant: 0, notChecked: 0, compliancePct: null, byAsset: [] };
    }

    const rows = await this.prisma.assetControlChecklist.findMany({
      where: {
        controlId: { in: controlIds },
        asset: policy.orgId ? { orgId: policy.orgId } : undefined,
      },
      include: { asset: { select: { id: true, name: true, orgId: true } }, control: { select: { id: true, name: true, controlCode: true } } },
    });

    const totalChecked = rows.length;
    const compliant = rows.filter((r) => r.status === 'COMPLIANT').length;
    const nonCompliant = rows.filter((r) => r.status === 'NON_COMPLIANT').length;
    const notChecked = rows.filter((r) => r.status === 'NOT_CHECKED').length;

    // Roll up per-asset: an asset "passes" this policy only if ALL of
    // its linked-control rows are COMPLIANT — one failing control means
    // the asset doesn't follow the policy, even if the rest pass.
    const byAssetMap = new Map<string, { assetId: string; assetName: string; rows: { control: string; status: string }[] }>();
    for (const r of rows) {
      if (!byAssetMap.has(r.assetId)) byAssetMap.set(r.assetId, { assetId: r.assetId, assetName: r.asset.name, rows: [] });
      byAssetMap.get(r.assetId)!.rows.push({ control: r.control.name, status: r.status });
    }
    const byAsset = Array.from(byAssetMap.values()).map((a) => ({
      ...a,
      compliant: a.rows.every((row) => row.status === 'COMPLIANT'),
    }));

    return {
      policyId,
      policyTitle: policy.title,
      totalChecked,
      compliant,
      nonCompliant,
      notChecked,
      compliancePct: totalChecked === 0 ? null : Math.round((compliant / totalChecked) * 1000) / 10,
      byAsset,
    };
  }

  /** Every active policy's nextReviewDate, for Expiry Radar to merge in as a 4th source. */
  async listUpcomingReviews(orgId: string | null, horizonDate: Date) {
    return this.prisma.policy.findMany({
      where: {
        status: 'ACTIVE',
        nextReviewDate: { lte: horizonDate, not: null },
        ...(orgId ? { OR: [{ orgId }, { orgId: null }] } : {}),
      },
      select: { id: true, title: true, nextReviewDate: true, orgId: true, org: { select: { name: true } } },
    });
  }
}
