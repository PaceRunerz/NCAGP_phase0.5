// ─────────────────────────────────────────────────────────────────
// SYNC — Asset Certificate Controller (Spec Section 5 & 6)
// File: src/asset-certificates/asset-certificates.controller.ts
// ─────────────────────────────────────────────────────────────────

import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { AssetCertificatesService } from './asset-certificates.service';
import { JwtAuthGuard, RolesGuard, OrgScopeGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { DOCUMENT_TYPE_LABELS } from './document-matrix.config';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class AssetCertificatesController {
  constructor(private certs: AssetCertificatesService) {}

  // Reference list for the frontend upload picker — every named slot in
  // the Section 5 matrix, plus "OTHER" for free-form certs.
  @Get('asset-certificates/document-types')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  listDocumentTypes(): any {
    return Object.entries(DOCUMENT_TYPE_LABELS).map(([documentType, label]) => ({ documentType, label }));
  }

  // The document matrix view — every expected slot for this asset's
  // category cross-referenced against what's uploaded (Section 5).
  // NOTE: upload/list of certificates themselves stays on the existing
  // AssetsController (:id/certificates) to avoid a duplicate route —
  // this controller only adds what doesn't already exist there.
  @Get('assets/:assetId/document-matrix')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async getDocumentMatrix(@Param('assetId') assetId: string): Promise<any> {
    return this.certs.getDocumentMatrixForAsset(assetId);
  }

  // Section 6 rule 7 — CISO/Admin sign-off, checked again inside the
  // service (defense in depth) beyond this route-level @Roles guard.
  @Post('asset-certificates/:certificateId/verify')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async verify(@Param('certificateId') certificateId: string, @CurrentUser() user: any): Promise<any> {
    return this.certs.verify(certificateId, user.id, user.role, user.orgId, 'unknown');
  }
}
