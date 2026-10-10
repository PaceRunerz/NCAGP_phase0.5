// ─────────────────────────────────────────────────────────────────
// SYNC — Expiry Radar (Asset Register Spec, Section 8/9)
// One dashboard answering "what's expiring soon across the whole
// register" — pulled from three sources that would otherwise sit in
// separate silos:
//   1. Asset-level date columns (amcExpiryDate, expiryDate, validityDate)
//   2. AssetCertificate.expiryDate (Section 5 document matrix)
//   3. Category-declared custom fields flagged drivesExpiryAlert (e.g.
//      vendorContractExpiry on a Cloud Resource, aclReviewedDate-driven
//      vendorSupportValidity on network gear) — these live inside the
//      Asset.customFields JSON blob since they're category-specific,
//      not fixed columns.
// File: src/expiry-radar/expiry-radar.service.ts
// ─────────────────────────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FIELD_GROUPS } from '../asset-categories/field-groups.config';

export type ExpiryBucket = 'EXPIRED' | 'DUE_7' | 'DUE_30' | 'DUE_90' | 'HEALTHY';

export interface ExpiryItem {
  assetId: string;
  assetName: string;
  orgId: string;
  orgName?: string;
  source: 'ASSET_AMC' | 'ASSET_EXPIRY' | 'ASSET_VALIDITY' | 'CERTIFICATE' | 'CUSTOM_FIELD' | 'POLICY_REVIEW';
  label: string;
  expiryDate: string; // ISO
  daysRemaining: number;
  bucket: ExpiryBucket;
  certificateId?: string;
  fieldKey?: string;
  policyId?: string;
}

function bucketFor(daysRemaining: number): ExpiryBucket {
  if (daysRemaining < 0) return 'EXPIRED';
  if (daysRemaining <= 7) return 'DUE_7';
  if (daysRemaining <= 30) return 'DUE_30';
  if (daysRemaining <= 90) return 'DUE_90';
  return 'HEALTHY';
}

// Every field across every Field Group flagged drivesExpiryAlert, keyed
// for a friendly label lookup when we find it inside an Asset's
// customFields JSON blob.
const CUSTOM_EXPIRY_FIELDS: { key: string; label: string }[] = Object.values(FIELD_GROUPS)
  .flatMap((g) => g.fields)
  .filter((f) => f.drivesExpiryAlert)
  .map((f) => ({ key: f.key, label: f.label }));

@Injectable()
export class ExpiryRadarService {
  constructor(private prisma: PrismaService) {}

  /**
   * Full radar for one org (or every org, for NIC_ADMIN). horizonDays
   * caps how far out we bother returning (default 90 — beyond that, an
   * item isn't "on the radar" yet).
   */
  async getRadar(orgId: string | null, horizonDays = 90): Promise<{
    items: ExpiryItem[];
    summary: Record<ExpiryBucket, number>;
  }> {
    const now = Date.now();
    const horizonDate = new Date(now + horizonDays * 86400000);

    // Source 4: Policy review dates — same "coming due" concept as an
    // AMC or certificate, just at the org/governance level instead of
    // per-asset. Represented with assetId/assetName holding the policy's
    // id/title so the frontend can render it in the same list without a
    // separate code path, tagged POLICY_REVIEW so it's still distinguishable.
    const policiesDue = await this.prisma.policy.findMany({
      where: {
        status: 'ACTIVE',
        nextReviewDate: { lte: horizonDate, not: null },
        ...(orgId ? { OR: [{ orgId }, { orgId: null }] } : {}),
      },
      select: { id: true, title: true, nextReviewDate: true, orgId: true, org: { select: { name: true } } },
    });
    const policyItems: ExpiryItem[] = policiesDue
      .filter((p) => p.nextReviewDate)
      .map((p) => {
        const daysRemaining = Math.ceil((p.nextReviewDate!.getTime() - now) / 86400000);
        return {
          assetId: p.id,
          assetName: p.title,
          orgId: p.orgId || '',
          orgName: p.org?.name || (p.orgId ? undefined : 'NIC-wide baseline'),
          source: 'POLICY_REVIEW' as const,
          label: 'Policy Review Due',
          expiryDate: p.nextReviewDate!.toISOString(),
          daysRemaining,
          bucket: bucketFor(daysRemaining),
          policyId: p.id,
        };
      });

    const assets = await this.prisma.asset.findMany({
      where: {
        ...(orgId ? { orgId } : {}),
        OR: [
          { amcExpiryDate: { lte: horizonDate } },
          { expiryDate: { lte: horizonDate } },
          { validityDate: { lte: horizonDate } },
          { customFields: { not: null as any } },
        ],
      },
      select: {
        id: true, name: true, orgId: true, amcExpiryDate: true, expiryDate: true, validityDate: true, customFields: true,
        org: { select: { name: true } },
      },
    });

    const items: ExpiryItem[] = [];

    for (const a of assets) {
      const pushIfInRange = (date: Date | null | undefined, source: ExpiryItem['source'], label: string, extra?: Partial<ExpiryItem>) => {
        if (!date) return;
        const daysRemaining = Math.ceil((date.getTime() - now) / 86400000);
        if (date.getTime() > horizonDate.getTime()) return; // beyond horizon, not on the radar yet
        items.push({
          assetId: a.id,
          assetName: a.name,
          orgId: a.orgId,
          orgName: (a as any).org?.name,
          source,
          label,
          expiryDate: date.toISOString(),
          daysRemaining,
          bucket: bucketFor(daysRemaining),
          ...extra,
        });
      };

      pushIfInRange(a.amcExpiryDate, 'ASSET_AMC', 'AMC Expiry');
      pushIfInRange(a.expiryDate, 'ASSET_EXPIRY', 'Expiry Date');
      pushIfInRange(a.validityDate, 'ASSET_VALIDITY', 'Validity Date');

      const cf = (a.customFields as Record<string, any>) || {};
      for (const { key, label } of CUSTOM_EXPIRY_FIELDS) {
        if (!cf[key]) continue;
        const d = new Date(cf[key]);
        if (!isNaN(d.getTime())) pushIfInRange(d, 'CUSTOM_FIELD', label, { fieldKey: key });
      }
    }

    const certs = await this.prisma.assetCertificate.findMany({
      where: {
        expiryDate: { lte: horizonDate, not: null },
        ...(orgId ? { asset: { orgId } } : {}),
      },
      select: {
        id: true, name: true, expiryDate: true,
        asset: { select: { id: true, name: true, orgId: true, org: { select: { name: true } } } },
      },
    });

    for (const c of certs) {
      if (!c.expiryDate) continue;
      const daysRemaining = Math.ceil((c.expiryDate.getTime() - now) / 86400000);
      items.push({
        assetId: c.asset.id,
        assetName: c.asset.name,
        orgId: c.asset.orgId,
        orgName: (c.asset as any).org?.name,
        source: 'CERTIFICATE',
        label: c.name,
        expiryDate: c.expiryDate.toISOString(),
        daysRemaining,
        bucket: bucketFor(daysRemaining),
        certificateId: c.id,
      });
    }

    items.push(...policyItems);
    items.sort((a, b) => a.daysRemaining - b.daysRemaining);

    const summary: Record<ExpiryBucket, number> = { EXPIRED: 0, DUE_7: 0, DUE_30: 0, DUE_90: 0, HEALTHY: 0 };
    for (const it of items) summary[it.bucket]++;

    return { items, summary };
  }
}
