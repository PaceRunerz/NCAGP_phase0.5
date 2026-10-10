// ─────────────────────────────────────────────────────────────────
// SYNC — Full Category Taxonomy (NCAGP Asset Register Spec, Section 2 + 8)
// Seed data consumed by AssetCategoriesService.seedTaxonomy(). Each entry:
// code, name, isTangible, which Field Groups it pulls from (always
// includes GROUP_9_UNIVERSAL), and which compliance frameworks are
// auto-suggested (Section 8) — user can add/remove before confirming,
// this is guidance not a lock, except forcedFrameworks which apply when
// a triggering condition is met (e.g. piiPresent -> DPDP 2023 forced).
// File: src/asset-categories/category-taxonomy.config.ts
// ─────────────────────────────────────────────────────────────────

export interface CategoryTaxonomyEntry {
  code: string;
  name: string;
  groupCode: string; // A-J from Section 2, for UI grouping/tiles
  isTangible: boolean;
  fieldGroups: string[]; // always includes GROUP_9_UNIVERSAL, appended automatically
  suggestedFrameworks: string[];
  requiredDocuments?: string[]; // Section 5 matrix — advisory checklist, not blocking
}

const U = 'GROUP_9_UNIVERSAL';

export const CATEGORY_TAXONOMY: CategoryTaxonomyEntry[] = [
  // A. Compute & Endpoints
  { code: 'DESKTOP_COMPUTER', name: 'Desktop Computer', groupCode: 'A', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', U], suggestedFrameworks: ['ISO_27001', 'CERT_IN'] },
  { code: 'LAPTOP_COMPUTER', name: 'Laptop Computer', groupCode: 'A', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', U], suggestedFrameworks: ['ISO_27001', 'CERT_IN'] },
  { code: 'MOBILE_DEVICE', name: 'Mobile Device', groupCode: 'A', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', U], suggestedFrameworks: ['ISO_27001', 'CERT_IN'] },
  { code: 'SERVER_PHYSICAL', name: 'Server (Physical)', groupCode: 'A', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['VAPT', 'CERT_IN', 'NIC_GUIDELINES'] },
  { code: 'VIRTUAL_MACHINE', name: 'Virtual Machine', groupCode: 'A', isTangible: false, fieldGroups: ['GROUP_2_SECURITY_POSTURE', 'GROUP_3_NETWORK', 'GROUP_5_CLOUD_SAAS', U], suggestedFrameworks: ['VAPT', 'CERT_IN', 'NIC_GUIDELINES'] },
  { code: 'TERMINAL_KIOSK', name: 'Terminal / Kiosk', groupCode: 'A', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', U], suggestedFrameworks: ['ISO_27001', 'CERT_IN'] },

  // B. Network Infrastructure
  { code: 'ROUTER', name: 'Router', groupCode: 'B', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['VAPT', 'CERT_IN', 'NIC_GUIDELINES'] },
  { code: 'SWITCH', name: 'Switch', groupCode: 'B', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['VAPT', 'CERT_IN', 'NIC_GUIDELINES'] },
  { code: 'FIREWALL', name: 'Firewall', groupCode: 'B', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['VAPT', 'CERT_IN', 'NIC_GUIDELINES'] },
  { code: 'LOAD_BALANCER', name: 'Load Balancer', groupCode: 'B', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['VAPT', 'CERT_IN', 'NIC_GUIDELINES'] },
  { code: 'WIRELESS_AP', name: 'Wireless Access Point', groupCode: 'B', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['VAPT', 'CERT_IN', 'NIC_GUIDELINES'] },
  { code: 'VPN_CONCENTRATOR', name: 'VPN Concentrator', groupCode: 'B', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['VAPT', 'CERT_IN', 'NIC_GUIDELINES'] },
  { code: 'IDS_IPS_APPLIANCE', name: 'IDS/IPS Appliance', groupCode: 'B', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['VAPT', 'CERT_IN', 'NIC_GUIDELINES'] },
  { code: 'NETWORK_TAP_SPAN', name: 'Network Tap / SPAN', groupCode: 'B', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['VAPT', 'CERT_IN'] },

  // C. Storage & Backup
  { code: 'NAS_DEVICE', name: 'NAS Device', groupCode: 'C', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_3_NETWORK', 'GROUP_7_DATA_ASSET', U], suggestedFrameworks: ['VAPT', 'ISO_27001', 'DPDP_2023'] },
  { code: 'SAN_ARRAY', name: 'SAN Array', groupCode: 'C', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_3_NETWORK', 'GROUP_7_DATA_ASSET', U], suggestedFrameworks: ['VAPT', 'ISO_27001', 'DPDP_2023'] },
  { code: 'TAPE_LIBRARY', name: 'Tape Library', groupCode: 'C', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_7_DATA_ASSET', U], suggestedFrameworks: ['ISO_27001'] },
  { code: 'BACKUP_APPLIANCE', name: 'Backup Appliance', groupCode: 'C', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', 'GROUP_7_DATA_ASSET', U], suggestedFrameworks: ['ISO_27001', 'CERT_IN'] },
  { code: 'REMOVABLE_STORAGE', name: 'External / Removable Storage', groupCode: 'C', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', U], suggestedFrameworks: ['ISO_27001'] },

  // D. Endpoint Peripherals & Physical Security
  { code: 'PRINTER_MFP', name: 'Printer / MFP', groupCode: 'D', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['NIC_GUIDELINES'] },
  { code: 'SCANNER', name: 'Scanner', groupCode: 'D', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', U], suggestedFrameworks: ['NIC_GUIDELINES'] },
  { code: 'BIOMETRIC_DEVICE', name: 'Biometric Device', groupCode: 'D', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE', U], suggestedFrameworks: ['DPDP_2023', 'NIC_GUIDELINES'], requiredDocuments: ['UIDAI_APPROVAL', 'BIS_IS_STANDARD_CERT', 'VENDOR_EMPANELMENT_CERT'] },
  { code: 'SMART_CARD_READER', name: 'Smart Card Reader', groupCode: 'D', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', U], suggestedFrameworks: ['NIC_GUIDELINES'] },
  { code: 'CCTV_SYSTEM', name: 'CCTV Camera / System', groupCode: 'D', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_8_PHYSICAL_LOCATION', U], suggestedFrameworks: ['PHYSICAL_SECURITY_BASELINE', 'NIC_GUIDELINES'] },
  { code: 'UPS_POWER_EQUIPMENT', name: 'UPS / Power Equipment', groupCode: 'D', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', U], suggestedFrameworks: ['NIC_GUIDELINES'] },
  { code: 'ACCESS_CONTROL_SYSTEM', name: 'Access Control System', groupCode: 'D', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_8_PHYSICAL_LOCATION', U], suggestedFrameworks: ['PHYSICAL_SECURITY_BASELINE', 'NIC_GUIDELINES'] },
  { code: 'FIRE_SUPPRESSION_SYSTEM', name: 'Fire Suppression System', groupCode: 'D', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_8_PHYSICAL_LOCATION', U], suggestedFrameworks: ['PHYSICAL_SECURITY_BASELINE'] },
  { code: 'ENVIRONMENTAL_MONITOR', name: 'Environmental Monitor', groupCode: 'D', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_8_PHYSICAL_LOCATION', U], suggestedFrameworks: ['PHYSICAL_SECURITY_BASELINE'] },

  // E. Applications & Software
  { code: 'WEB_APPLICATION', name: 'Web Application', groupCode: 'E', isTangible: false, fieldGroups: ['GROUP_4_APPLICATION_WEB', U], suggestedFrameworks: ['VAPT', 'GIGW', 'STQC', 'ISO_27001'], requiredDocuments: ['SSL_TLS_CERT', 'STQC_CERT', 'GIGW_COMPLIANCE_CERT', 'NIC_HOSTING_AGREEMENT'] },
  { code: 'MOBILE_APPLICATION', name: 'Mobile Application', groupCode: 'E', isTangible: false, fieldGroups: ['GROUP_4_APPLICATION_WEB', U], suggestedFrameworks: ['VAPT', 'GIGW'] },
  { code: 'DESKTOP_SOFTWARE', name: 'Desktop Software', groupCode: 'E', isTangible: false, fieldGroups: ['GROUP_6_LICENSE_CERT', U], suggestedFrameworks: ['ISO_27001'] },
  { code: 'ERP_HRMS', name: 'ERP / HRMS', groupCode: 'E', isTangible: false, fieldGroups: ['GROUP_4_APPLICATION_WEB', 'GROUP_7_DATA_ASSET', U], suggestedFrameworks: ['VAPT', 'ISO_27001', 'DPDP_2023'] },
  { code: 'DOCUMENT_MGMT_SYSTEM', name: 'Document Management System', groupCode: 'E', isTangible: false, fieldGroups: ['GROUP_4_APPLICATION_WEB', 'GROUP_7_DATA_ASSET', U], suggestedFrameworks: ['VAPT', 'ISO_27001', 'DPDP_2023'] },
  { code: 'CUSTOM_BUILT_APPLICATION', name: 'Custom-Built Application', groupCode: 'E', isTangible: false, fieldGroups: ['GROUP_4_APPLICATION_WEB', U], suggestedFrameworks: ['VAPT', 'GIGW'] },

  // F. Cloud & SaaS
  { code: 'CLOUD_RESOURCE', name: 'Cloud Resource', groupCode: 'F', isTangible: false, fieldGroups: ['GROUP_5_CLOUD_SAAS', U], suggestedFrameworks: ['CERT_IN', 'ISO_27001', 'DPDP_2023'] },
  { code: 'SAAS_SUBSCRIPTION', name: 'SaaS Subscription', groupCode: 'F', isTangible: false, fieldGroups: ['GROUP_5_CLOUD_SAAS', 'GROUP_6_LICENSE_CERT', U], suggestedFrameworks: ['CERT_IN', 'ISO_27001', 'DPDP_2023'] },
  { code: 'API_SERVICE', name: 'API Service', groupCode: 'F', isTangible: false, fieldGroups: ['GROUP_4_APPLICATION_WEB', 'GROUP_5_CLOUD_SAAS', U], suggestedFrameworks: ['VAPT', 'CERT_IN'] },
  { code: 'CDN_SERVICE', name: 'CDN Service', groupCode: 'F', isTangible: false, fieldGroups: ['GROUP_5_CLOUD_SAAS', U], suggestedFrameworks: ['CERT_IN'] },
  { code: 'EMAIL_SERVICE', name: 'Email Service', groupCode: 'F', isTangible: false, fieldGroups: ['GROUP_5_CLOUD_SAAS', U], suggestedFrameworks: ['CERT_IN', 'ISO_27001'] },

  // G. Licenses, Certificates & Legal Instruments
  { code: 'SOFTWARE_LICENSE', name: 'Software License', groupCode: 'G', isTangible: false, fieldGroups: ['GROUP_6_LICENSE_CERT', U], suggestedFrameworks: ['ISO_27001'] },
  { code: 'SSL_TLS_CERTIFICATE', name: 'SSL/TLS Certificate', groupCode: 'G', isTangible: false, fieldGroups: ['GROUP_6_LICENSE_CERT', U], suggestedFrameworks: ['CERT_IN', 'GIGW'] },
  { code: 'DIGITAL_SIGNATURE_CERT', name: 'Digital Signature Certificate (DSC)', groupCode: 'G', isTangible: false, fieldGroups: ['GROUP_6_LICENSE_CERT', U], suggestedFrameworks: ['CERT_IN'] },
  { code: 'DOMAIN_NAME', name: 'Domain Name', groupCode: 'G', isTangible: false, fieldGroups: ['GROUP_6_LICENSE_CERT', U], suggestedFrameworks: ['CERT_IN', 'GIGW'] },
  { code: 'AMC_CONTRACT', name: 'AMC Contract', groupCode: 'G', isTangible: false, fieldGroups: ['GROUP_6_LICENSE_CERT', U], suggestedFrameworks: [] },
  { code: 'VENDOR_EMPANELMENT_CERT', name: 'Vendor Empanelment Certificate', groupCode: 'G', isTangible: false, fieldGroups: ['GROUP_6_LICENSE_CERT', U], suggestedFrameworks: [] },

  // H. Data Assets
  { code: 'DATABASE', name: 'Database', groupCode: 'H', isTangible: false, fieldGroups: ['GROUP_7_DATA_ASSET', U], suggestedFrameworks: ['VAPT', 'ISO_27001', 'DPDP_2023'] },
  { code: 'DATA_WAREHOUSE', name: 'Data Warehouse', groupCode: 'H', isTangible: false, fieldGroups: ['GROUP_7_DATA_ASSET', U], suggestedFrameworks: ['VAPT', 'ISO_27001', 'DPDP_2023'] },
  { code: 'FILE_SERVER_REPOSITORY', name: 'File Server / Repository', groupCode: 'H', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_7_DATA_ASSET', U], suggestedFrameworks: ['ISO_27001', 'DPDP_2023'] },
  { code: 'CLASSIFIED_DOC_REPOSITORY', name: 'Classified Document Repository', groupCode: 'H', isTangible: false, fieldGroups: ['GROUP_7_DATA_ASSET', U], suggestedFrameworks: ['ISO_27001', 'DPDP_2023'] },
  { code: 'ANALYTICS_PLATFORM', name: 'Analytics Platform', groupCode: 'H', isTangible: false, fieldGroups: ['GROUP_7_DATA_ASSET', 'GROUP_5_CLOUD_SAAS', U], suggestedFrameworks: ['VAPT', 'ISO_27001', 'DPDP_2023'] },

  // I. Communication Systems
  { code: 'EPABX_SYSTEM', name: 'EPABX System', groupCode: 'I', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['NIC_GUIDELINES'] },
  { code: 'VIDEO_CONFERENCING_UNIT', name: 'Video Conferencing Unit', groupCode: 'I', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['NIC_GUIDELINES'] },
  { code: 'SECURE_COMM_LINE', name: 'Secure Communication Line', groupCode: 'I', isTangible: true, fieldGroups: ['GROUP_3_NETWORK', U], suggestedFrameworks: ['CERT_IN', 'NIC_GUIDELINES'] },
  { code: 'SATELLITE_LINK', name: 'Satellite Link', groupCode: 'I', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_3_NETWORK', U], suggestedFrameworks: ['CERT_IN', 'NIC_GUIDELINES'] },
  { code: 'INTERCOM_SYSTEM', name: 'Intercom System', groupCode: 'I', isTangible: true, fieldGroups: ['GROUP_1_PHYSICAL_IDENTITY', U], suggestedFrameworks: ['NIC_GUIDELINES'] },

  // J. Physical Locations
  { code: 'SERVER_ROOM_DATA_CENTRE', name: 'Server Room / Data Centre', groupCode: 'J', isTangible: true, fieldGroups: ['GROUP_8_PHYSICAL_LOCATION', U], suggestedFrameworks: ['PHYSICAL_SECURITY_BASELINE', 'NIC_GUIDELINES'], requiredDocuments: ['TIER_CERTIFICATION', 'ISO_27001_ORG', 'FIRE_NOC', 'ELECTRICAL_SAFETY_CERT', 'BIS_CERTIFICATION'] },
  { code: 'BUILDING', name: 'Building', groupCode: 'J', isTangible: true, fieldGroups: ['GROUP_8_PHYSICAL_LOCATION', U], suggestedFrameworks: ['PHYSICAL_SECURITY_BASELINE'] },
  { code: 'SITE_CAMPUS', name: 'Site / Campus', groupCode: 'J', isTangible: true, fieldGroups: ['GROUP_8_PHYSICAL_LOCATION', U], suggestedFrameworks: ['PHYSICAL_SECURITY_BASELINE'] },
];

/** Frameworks that are FORCED (not just suggested) once a triggering field is set. Section 8 last row. */
export const FORCED_FRAMEWORK_TRIGGERS: { field: string; value: any; framework: string }[] = [
  { field: 'piiPresent', value: 'YES', framework: 'DPDP_2023' },
];
