// ─────────────────────────────────────────────────────────────────
// SYNC — Asset Certificate Service (Spec Section 5 & 6)
// Reuses the exact Evidence hash-before-upload pattern so certificates
// get the same court-grade integrity guarantee. Adds the
// Self-Declared/Verified badge split (rule 2) and RBAC-gated
// verification (rule 7): only NIC_ADMIN / DEPT_CISO can flip a
// certificate to VERIFIED — enforced again here even though the
// controller also checks @Roles, because this service may be called
// from other services later (defense in depth).
// File: src/asset-certificates/asset-certificates.service.ts
// ─────────────────────────────────────────────────────────────────

import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { resolveRequiredDocuments } from './document-matrix.config';

const VERIFIER_ROLES = ['NIC_ADMIN', 'DEPT_CISO'];

@Injectable()
export class AssetCertificatesService {
  private readonly logger = new Logger(AssetCertificatesService.name);

  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  private computeDisplayStatus(cert: { expiryDate: Date | null; verificationStatus: string }) {
    if (cert.expiryDate && cert.expiryDate.getTime() < Date.now()) return 'EXPIRED';
    return cert.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'SELF_DECLARED_UNVERIFIED';
  }

  /**
   * Section 5's document matrix for one asset: every expected slot for
   * its category, cross-referenced against what's actually uploaded.
   * Each row is Uploaded(Verified) / Uploaded(Self-declared) / Expired /
   * Not Yet Provided — never a bare checkbox with no evidence behind it.
   */
  async getDocumentMatrixForAsset(assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId },
      include: { categoryLinks: { include: { category: true } }, certificates: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const hasAmc = !!asset.amcProvider || !!asset.amcExpiryDate;
    const categoryCodes = asset.categoryLinks.map((l) => l.category.code);
    const slotSet = new Map<string, string>();
    for (const code of categoryCodes.length ? categoryCodes : ['__NONE__']) {
      for (const slot of resolveRequiredDocuments(code, asset.isTangible, hasAmc)) {
        slotSet.set(slot.documentType, slot.label);
      }
    }
    // Even with zero categories linked, tangible/AMC-driven slots still apply.
    if (categoryCodes.length === 0) {
      for (const slot of resolveRequiredDocuments('__NONE__', asset.isTangible, hasAmc)) {
        slotSet.set(slot.documentType, slot.label);
      }
    }

    const rows = Array.from(slotSet.entries()).map(([documentType, label]) => {
      const matches = asset.certificates.filter((c) => c.documentType === documentType);
      const latest = matches.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];
      if (!latest) return { documentType, label, status: 'NOT_YET_PROVIDED' as const, certificate: null };
      const status = this.computeDisplayStatus(latest);
      return {
        documentType,
        label,
        status: status === 'EXPIRED' ? ('EXPIRED' as const) : status === 'VERIFIED' ? ('VERIFIED' as const) : ('SELF_DECLARED' as const),
        certificate: latest,
      };
    });

    return { assetId, rows };
  }

  /**
   * Section 6, rule 7: only NIC_ADMIN or DEPT_CISO can flip a certificate
   * from Self-Declared (amber) to Verified (green). This is a sign-off,
   * not a data edit — mirrors the auditor != closer separation already
   * used in the finding lifecycle.
   */
  async verify(certificateId: string, verifierId: string, verifierRole: string, orgId: string, ipAddress: string) {
    if (!VERIFIER_ROLES.includes(verifierRole)) {
      throw new ForbiddenException('Only NIC Admin or Department CISO can mark a certificate as Verified');
    }
    const cert = await this.prisma.assetCertificate.findFirst({ where: { id: certificateId } });
    if (!cert) throw new NotFoundException('Certificate not found');

    if (cert.expiryDate && cert.expiryDate.getTime() < Date.now()) {
      throw new BadRequestException('Cannot mark an already-expired certificate as Verified — upload a current one first');
    }

    const updated = await this.prisma.assetCertificate.update({
      where: { id: certificateId },
      data: { verificationStatus: 'VERIFIED', verifiedById: verifierId, verifiedAt: new Date() },
    });

    await this.ledger.record({
      userId: verifierId,
      orgId,
      eventType: 'ASSET_CERTIFICATE_VERIFIED' as any,
      entityType: 'ASSET_CERTIFICATE',
      entityId: certificateId,
      payload: { assetId: cert.assetId, documentType: cert.documentType },
      ipAddress,
    });

    return updated;
  }
}
