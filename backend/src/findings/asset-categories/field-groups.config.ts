// ─────────────────────────────────────────────────────────────────
// SYNC — Field Group Engine (NCAGP Asset Register Spec, Section 3)
// Single source of truth for which fields exist per group. Categories
// (see category-taxonomy.config.ts) declare which group codes they pull
// from; the resolver below merges them into one field list per category
// so the frontend never hardcodes fields per category — it just renders
// whatever resolveFieldsForGroups() returns.
//
// field.type: 'text' | 'number' | 'date' | 'boolean_tristate' | 'select' | 'reference'
// 'boolean_tristate' = Yes / No / Unknown — NEVER defaults to Yes or No
// (spec Section 6, rule 1). Frontend must render three explicit states.
// File: src/asset-categories/field-groups.config.ts
// ─────────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean_tristate'
  | 'select'
  | 'reference'
  | 'textarea';

export interface FieldDef {
  key: string; // machine key, camelCase
  label: string;
  type: FieldType;
  options?: string[]; // for 'select'
  required?: boolean; // group-level required (Universal group only has true requireds)
  drivesExpiryAlert?: boolean; // Section 8 - date fields that feed the Expiry Radar
  referenceEntity?: string; // for 'reference' type - e.g. 'AssetCertificate', 'Asset'
  helpText?: string;
}

export interface FieldGroup {
  code: string;
  name: string;
  fields: FieldDef[];
}

export const FIELD_GROUPS: Record<string, FieldGroup> = {
  GROUP_1_PHYSICAL_IDENTITY: {
    code: 'GROUP_1_PHYSICAL_IDENTITY',
    name: 'Physical Hardware Identity',
    fields: [
      { key: 'assetTag', label: 'Asset Tag Number', type: 'text' },
      { key: 'serialNumber', label: 'Serial Number', type: 'text' },
      { key: 'manufacturer', label: 'Make / Manufacturer', type: 'text' },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'firmwareVersion', label: 'Firmware/OS Version', type: 'text' },
      { key: 'procurementDate', label: 'Purchase/Procurement Date', type: 'date' },
      { key: 'warrantyExpiryDate', label: 'Warranty Expiry', type: 'date', drivesExpiryAlert: true },
      { key: 'amcProvider', label: 'AMC Provider', type: 'text' },
      { key: 'amcStartDate', label: 'AMC Start Date', type: 'date' },
      { key: 'amcExpiryDate', label: 'AMC Expiry Date', type: 'date', drivesExpiryAlert: true },
      { key: 'custodianUserId', label: 'Assigned User / Custodian', type: 'reference', referenceEntity: 'User' },
      { key: 'siteId', label: 'Site', type: 'reference', referenceEntity: 'Site' },
      { key: 'buildingId', label: 'Building', type: 'reference', referenceEntity: 'Building' },
      { key: 'floorId', label: 'Floor', type: 'reference', referenceEntity: 'Floor' },
      { key: 'subLocationId', label: 'Room / Sub-location', type: 'reference', referenceEntity: 'SubLocation' },
    ],
  },

  GROUP_2_SECURITY_POSTURE: {
    code: 'GROUP_2_SECURITY_POSTURE',
    name: 'Security Posture',
    fields: [
      { key: 'antivirusInstalled', label: 'Antivirus/EDR Installed', type: 'boolean_tristate' },
      { key: 'antivirusProduct', label: 'Antivirus/EDR Product', type: 'text' },
      { key: 'diskEncryption', label: 'Disk/Data Encryption', type: 'boolean_tristate' },
      { key: 'diskEncryptionType', label: 'Encryption Type', type: 'text' },
      { key: 'defaultCredsChanged', label: 'Default Credentials Changed', type: 'boolean_tristate' },
      { key: 'lastPatchDate', label: 'Patch/Firmware Last Updated', type: 'date' },
      { key: 'usbPortLockdown', label: 'Physical Port Lockdown (USB disabled etc.)', type: 'boolean_tristate' },
      { key: 'screenLockPolicy', label: 'Screen Lock / Auto-lock Policy Applied', type: 'boolean_tristate' },
    ],
  },

  GROUP_3_NETWORK: {
    code: 'GROUP_3_NETWORK',
    name: 'Network-Specific',
    fields: [
      { key: 'ipAddress', label: 'IP Address / Management IP', type: 'text' },
      { key: 'macAddress', label: 'MAC Address', type: 'text' },
      { key: 'vlanConfigured', label: 'VLAN Configuration', type: 'boolean_tristate' },
      { key: 'vlanDetails', label: 'VLAN Details', type: 'text' },
      { key: 'portCount', label: 'Number of Ports', type: 'number' },
      { key: 'aclReviewedDate', label: 'ACL Rules Reviewed Date', type: 'date' },
      { key: 'vendorSupportValidity', label: 'Vendor Support Contract Validity', type: 'date', drivesExpiryAlert: true },
    ],
  },

  GROUP_4_APPLICATION_WEB: {
    code: 'GROUP_4_APPLICATION_WEB',
    name: 'Application/Web-Specific',
    fields: [
      { key: 'appSiteName', label: 'Application/Site Name', type: 'text' },
      { key: 'urlDomain', label: 'URL / Domain', type: 'text' },
      {
        key: 'hostingLocation',
        label: 'Hosting Location',
        type: 'select',
        options: ['NIC_DC', 'CLOUD', 'ON_PREM', 'VENDOR_DC'],
      },
      { key: 'techStack', label: 'Technology Stack', type: 'text' },
      {
        key: 'authMechanism',
        label: 'Authentication Mechanism',
        type: 'select',
        options: ['PASSWORD', 'OTP', 'SSO', 'AADHAAR_LINKED'],
      },
      { key: 'sessionMgmtReviewed', label: 'Session Management Reviewed', type: 'boolean_tristate' },
      { key: 'owaspReviewDone', label: 'Input Validation / OWASP Review Done', type: 'boolean_tristate' },
      {
        key: 'linkedSslCertificateId',
        label: 'Linked SSL Certificate',
        type: 'reference',
        referenceEntity: 'AssetCertificate',
      },
    ],
  },

  GROUP_5_CLOUD_SAAS: {
    code: 'GROUP_5_CLOUD_SAAS',
    name: 'Cloud/SaaS-Specific',
    fields: [
      {
        key: 'cloudProvider',
        label: 'Provider',
        type: 'select',
        options: ['AWS', 'AZURE', 'GCP', 'MEGHRAJ', 'OTHER'],
      },
      { key: 'cloudRegion', label: 'Region', type: 'text' },
      { key: 'cloudResourceId', label: 'Resource/Instance ID', type: 'text' },
      { key: 'subscriptionTier', label: 'Subscription Tier / Plan', type: 'text' },
      { key: 'dataResidencyConfirmed', label: 'Data Residency Confirmed (India)', type: 'boolean_tristate' },
      { key: 'vendorContractExpiry', label: 'Vendor Contract Expiry', type: 'date', drivesExpiryAlert: true },
    ],
  },

  GROUP_6_LICENSE_CERT: {
    code: 'GROUP_6_LICENSE_CERT',
    name: 'License/Certificate-Specific',
    fields: [
      { key: 'licenseOrCertType', label: 'License or Certificate Type', type: 'text' },
      { key: 'validFromDate', label: 'Valid From', type: 'date' },
      {
        key: 'expiryDate',
        label: 'Expiry Date',
        type: 'date',
        required: true,
        drivesExpiryAlert: true,
        helpText: 'Mandatory for license/certificate categories — drives auto-alerts.',
      },
      { key: 'renewalContact', label: 'Renewal Point of Contact', type: 'text' },
      { key: 'seatUserCount', label: 'Seat/User Count', type: 'number' },
      { key: 'linkedAssetIds', label: 'Linked Asset(s)', type: 'reference', referenceEntity: 'Asset' },
    ],
  },

  GROUP_7_DATA_ASSET: {
    code: 'GROUP_7_DATA_ASSET',
    name: 'Data Asset-Specific',
    fields: [
      {
        key: 'dataClassificationLevel',
        label: 'Data Classification Level',
        type: 'select',
        options: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'],
      },
      { key: 'encryptionAtRest', label: 'Encryption at Rest', type: 'boolean_tristate' },
      { key: 'encryptionAtRestMethod', label: 'Encryption Method', type: 'text' },
      { key: 'backupFrequency', label: 'Backup Frequency', type: 'text' },
      { key: 'lastRestoreTestDate', label: 'Last Restore Test Date', type: 'date' },
      { key: 'retentionPolicy', label: 'Retention Policy', type: 'text' },
      {
        key: 'piiPresent',
        label: 'PII/Citizen Data Present',
        type: 'boolean_tristate',
        helpText: 'Yes triggers DPDP 2023 checklist automatically.',
      },
      {
        key: 'accessControlModel',
        label: 'Access Control Model',
        type: 'select',
        options: ['RBAC', 'ABAC', 'OTHER'],
      },
    ],
  },

  GROUP_8_PHYSICAL_LOCATION: {
    code: 'GROUP_8_PHYSICAL_LOCATION',
    name: 'Physical Location-Specific',
    fields: [
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'areaSqFt', label: 'Area (sq ft)', type: 'number' },
      { key: 'tierLevel', label: 'Tier Level', type: 'select', options: ['I', 'II', 'III', 'IV'] },
      { key: 'powerRedundancy', label: 'Power Redundancy', type: 'select', options: ['N', 'N+1', '2N'] },
      { key: 'fireSuppressionType', label: 'Fire Suppression Type', type: 'text' },
      { key: 'environmentalMonitoring', label: 'Environmental Monitoring', type: 'boolean_tristate' },
      {
        key: 'accessControlType',
        label: 'Access Control Type',
        type: 'select',
        options: ['BIOMETRIC', 'CARD', 'PIN', 'MANUAL_REGISTER'],
      },
      { key: 'cctvCoverage', label: 'CCTV Coverage', type: 'boolean_tristate' },
      { key: 'lastPhysicalAuditDate', label: 'Last Physical Access Audit Date', type: 'date' },
    ],
  },

  GROUP_9_UNIVERSAL: {
    code: 'GROUP_9_UNIVERSAL',
    name: 'Universal',
    fields: [
      { key: 'criticality', label: 'Criticality (1-5)', type: 'number', required: true },
      {
        key: 'dataSensitivity',
        label: 'Data Sensitivity',
        type: 'select',
        options: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'],
        required: true,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: ['ACTIVE', 'IN_MAINTENANCE', 'DECOMMISSIONED', 'UNDER_REVIEW'],
      },
      { key: 'businessUnit', label: 'Owning Department', type: 'text', required: true },
      { key: 'custodianOrgId', label: 'Custodian Department', type: 'reference', referenceEntity: 'Organization' },
      { key: 'description', label: 'Description / Notes', type: 'textarea' },
      { key: 'tags', label: 'Tags', type: 'text' },
    ],
  },
};

/**
 * The true universal minimum required, per Spec Section 1, rule 2:
 * Department, Name/Identifier, Category, Criticality, Data Sensitivity.
 * Everything else — including everything in the groups above — is optional
 * unless a specific field is marked `required: true` on its group entry
 * (e.g. Expiry Date for license/certificate categories).
 */
export const ALWAYS_REQUIRED_FIELDS = ['name', 'businessUnit', 'category', 'criticality', 'dataSensitivity'];

/** Merge N field groups into one deduplicated field list for a category. */
export function resolveFieldsForGroups(groupCodes: string[]): FieldDef[] {
  const seen = new Set<string>();
  const resolved: FieldDef[] = [];
  for (const code of groupCodes) {
    const group = FIELD_GROUPS[code];
    if (!group) continue;
    for (const field of group.fields) {
      if (seen.has(field.key)) continue;
      seen.add(field.key);
      resolved.push(field);
    }
  }
  return resolved;
}
