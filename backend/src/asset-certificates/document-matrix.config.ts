// ─────────────────────────────────────────────────────────────────
// SYNC — Document Matrix (Asset Register Spec, Section 5)
// Which document slots are expected for which category. Purely
// advisory: the UI shows each slot as Uploaded / Not Yet Provided /
// Expired (never a bare checkbox with no evidence). Nothing blocks
// registration if a document is missing — that's the whole point of
// "Not Yet Provided" being an honest, explicit state.
// File: src/asset-certificates/document-matrix.config.ts
// ─────────────────────────────────────────────────────────────────

export interface DocumentSlot {
  documentType: string; // matches AssetCertificate.documentType
  label: string;
}

/** documentType -> label, used everywhere a slot needs a display name. */
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  SSL_TLS_CERT: 'SSL/TLS Certificate',
  STQC_CERT: 'STQC Certificate',
  GIGW_COMPLIANCE_CERT: 'GIGW Compliance Certificate',
  NIC_HOSTING_AGREEMENT: 'NIC Hosting Agreement',
  TIER_CERTIFICATION: 'Tier Certification',
  ISO_27001_ORG: 'ISO 27001 (org-level)',
  FIRE_NOC: 'Fire NOC',
  ELECTRICAL_SAFETY_CERT: 'Electrical Safety Certificate',
  BIS_CERTIFICATION: 'BIS Certification (equipment)',
  UIDAI_APPROVAL: 'UIDAI Approval (Aadhaar-linked)',
  BIS_IS_STANDARD_CERT: 'BIS/IS Standard Certificate',
  VENDOR_EMPANELMENT_CERT: 'Vendor Empanelment Certificate',
  CERT_IN_EMPANELMENT: 'CERT-In Empanelment Certificate',
  ISO_27001_FIRM: 'ISO 27001 (firm-level)',
  AUDITOR_CISA_CISSP: 'Auditor CISA/CISSP Certificate',
  NCSC_DSCI_APPROVAL: 'NCSC/DSCI Approval',
  FIPS_140_2_CERT: 'FIPS 140-2 Certification',
  AMC_CONTRACT_PDF: 'AMC Contract PDF',
  PURCHASE_ORDER: 'Purchase Order',
  WARRANTY_CERTIFICATE: 'Warranty Certificate',
};

/**
 * category taxonomy code (from category-taxonomy.config.ts) -> required
 * document slots (Section 5 table). Categories not listed here still get
 * the two universal rows (AMC_CONTRACT_PDF / PURCHASE_ORDER + WARRANTY)
 * applied conditionally below.
 */
export const CATEGORY_DOCUMENT_MATRIX: Record<string, string[]> = {
  WEB_APPLICATION: ['SSL_TLS_CERT', 'STQC_CERT', 'GIGW_COMPLIANCE_CERT', 'NIC_HOSTING_AGREEMENT'],
  SERVER_ROOM_DATA_CENTRE: [
    'TIER_CERTIFICATION',
    'ISO_27001_ORG',
    'FIRE_NOC',
    'ELECTRICAL_SAFETY_CERT',
    'BIS_CERTIFICATION',
  ],
  BIOMETRIC_DEVICE: ['UIDAI_APPROVAL', 'BIS_IS_STANDARD_CERT', 'VENDOR_EMPANELMENT_CERT'],
  SMART_CARD_READER: ['BIS_IS_STANDARD_CERT', 'VENDOR_EMPANELMENT_CERT'],
};

/** Cryptographic-equipment style categories get the crypto slots (any category can opt in via customFields today; this is the named seed set). */
export const CRYPTO_EQUIPMENT_CATEGORIES = ['VPN_CONCENTRATOR', 'SECURE_COMM_LINE', 'DIGITAL_SIGNATURE_CERT'];

export function resolveRequiredDocuments(categoryCode: string, isTangible: boolean, hasAmc: boolean): DocumentSlot[] {
  const slots = new Set<string>(CATEGORY_DOCUMENT_MATRIX[categoryCode] || []);
  if (CRYPTO_EQUIPMENT_CATEGORIES.includes(categoryCode)) {
    slots.add('NCSC_DSCI_APPROVAL');
    slots.add('FIPS_140_2_CERT');
  }
  if (hasAmc) slots.add('AMC_CONTRACT_PDF');
  if (isTangible) {
    slots.add('PURCHASE_ORDER');
    slots.add('WARRANTY_CERTIFICATE');
  }
  return Array.from(slots).map((documentType) => ({
    documentType,
    label: DOCUMENT_TYPE_LABELS[documentType] || documentType,
  }));
}
