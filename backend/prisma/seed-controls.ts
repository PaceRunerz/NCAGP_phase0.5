// prisma/seed-controls.ts
// Run: npx ts-node prisma/seed-controls.ts

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CONTROLS = [
  // Access Control
  { code:'AC-001', name:'Access Control Policy', category:'Access Control', description:'Establish, document, and enforce access control policy', objective:'Ensure only authorised users access information systems', iso:'A.9.1.1', nist:'AC-1' },
  { code:'AC-002', name:'Account Management', category:'Access Control', description:'Create, enable, disable user accounts per policy', objective:'Manage information system accounts including types of accounts', iso:'A.9.2.1', nist:'AC-2' },
  { code:'AC-003', name:'Access Enforcement', category:'Access Control', description:'Enforce approved authorisations for logical access', objective:'Control access to systems based on approved authorisations', iso:'A.9.4.1', nist:'AC-3' },
  { code:'AC-004', name:'Multi-Factor Authentication', category:'Access Control', description:'MFA required for privileged and remote access', objective:'Verify identity using two or more factors', iso:'A.9.4.2', nist:'IA-2' },
  { code:'AC-005', name:'Privileged Account Management', category:'Access Control', description:'Restrict and monitor privileged account usage', objective:'Limit privileged accounts to minimum necessary', iso:'A.9.2.3', nist:'AC-6' },

  // Incident Management
  { code:'IR-001', name:'Incident Response Policy', category:'Incident Management', description:'Incident response capability with documented procedures', objective:'Establish incident response capability', iso:'A.16.1.1', nist:'IR-1' },
  { code:'IR-002', name:'Incident Reporting', category:'Incident Management', description:'Mechanism to report security incidents', objective:'Ensure timely reporting of security events', iso:'A.16.1.2', nist:'IR-6' },
  { code:'IR-003', name:'Incident Response Testing', category:'Incident Management', description:'Test incident response capability annually', objective:'Verify incident response effectiveness', iso:'A.16.1.3', nist:'IR-3' },
  { code:'IR-004', name:'Forensic Evidence', category:'Incident Management', description:'Preserve and collect evidence during incidents', objective:'Maintain forensic integrity of incident evidence', iso:'A.16.1.7', nist:'IR-10' },

  // Cryptography
  { code:'CR-001', name:'Cryptographic Policy', category:'Cryptography', description:'Policy on use of cryptographic controls', objective:'Proper and effective use of cryptography', iso:'A.10.1.1', nist:'SC-13' },
  { code:'CR-002', name:'Key Management', category:'Cryptography', description:'Lifecycle management of cryptographic keys', objective:'Protect cryptographic keys throughout their lifecycle', iso:'A.10.1.2', nist:'SC-12' },
  { code:'CR-003', name:'Encryption at Rest', category:'Cryptography', description:'Sensitive data encrypted when stored', objective:'Protect stored sensitive information', iso:'A.10.1.1', nist:'SC-28' },
  { code:'CR-004', name:'Encryption in Transit', category:'Cryptography', description:'Data encrypted during transmission', objective:'Protect data transmitted over networks', iso:'A.13.2.1', nist:'SC-8' },

  // Network Security
  { code:'NS-001', name:'Network Segmentation', category:'Network Security', description:'Segregate networks based on risk and function', objective:'Limit blast radius of security incidents', iso:'A.13.1.3', nist:'SC-7' },
  { code:'NS-002', name:'Firewall Management', category:'Network Security', description:'Manage firewall rules and configurations', objective:'Control network traffic based on policy', iso:'A.13.1.1', nist:'SC-7' },
  { code:'NS-003', name:'Intrusion Detection', category:'Network Security', description:'Deploy IDS/IPS on critical network segments', objective:'Detect and prevent network-based attacks', iso:'A.12.6.1', nist:'SI-4' },
  { code:'NS-004', name:'Remote Access Security', category:'Network Security', description:'Secure VPN/remote access with MFA', objective:'Protect remote access to internal systems', iso:'A.6.2.2', nist:'AC-17' },

  // Vulnerability Management
  { code:'VM-001', name:'Vulnerability Scanning', category:'Vulnerability Management', description:'Regular automated vulnerability scans', objective:'Identify system vulnerabilities before attackers', iso:'A.12.6.1', nist:'RA-5' },
  { code:'VM-002', name:'Patch Management', category:'Vulnerability Management', description:'Timely application of security patches', objective:'Remediate known vulnerabilities', iso:'A.12.6.1', nist:'SI-2' },
  { code:'VM-003', name:'Penetration Testing', category:'Vulnerability Management', description:'Annual penetration test by certified vendor', objective:'Identify exploitable vulnerabilities', iso:'A.18.2.3', nist:'CA-8' },
  { code:'VM-004', name:'Risk Assessment', category:'Vulnerability Management', description:'Conduct risk assessments for systems and processes', objective:'Identify and quantify security risks', iso:'A.12.6.1', nist:'RA-3' },

  // Data Protection
  { code:'DP-001', name:'Data Classification', category:'Data Protection', description:'Classify information assets by sensitivity', objective:'Apply appropriate protection based on data sensitivity', iso:'A.8.2.1', nist:'RA-2' },
  { code:'DP-002', name:'Data Retention', category:'Data Protection', description:'Define and enforce data retention periods', objective:'Retain data per legal/regulatory requirements', iso:'A.18.1.3', nist:'SI-12' },
  { code:'DP-003', name:'Data Loss Prevention', category:'Data Protection', description:'Controls to prevent unauthorised data exfiltration', objective:'Prevent sensitive data leaving organisation', iso:'A.13.2.1', nist:'AC-23' },
  { code:'DP-004', name:'Privacy Controls (DPDP)', category:'Data Protection', description:'India DPDP Act compliance — consent, purpose limitation', objective:'Protect personal data per DPDP 2023', iso:'A.18.1.4', nist:'PT-1' },

  // Business Continuity
  { code:'BC-001', name:'Backup and Recovery', category:'Business Continuity', description:'Regular backups with tested restore procedures', objective:'Recover systems and data after incidents', iso:'A.12.3.1', nist:'CP-9' },
  { code:'BC-002', name:'Disaster Recovery Plan', category:'Business Continuity', description:'Documented DRP with RTO/RPO targets', objective:'Restore critical functions after disruption', iso:'A.17.1.1', nist:'CP-2' },
  { code:'BC-003', name:'Business Impact Analysis', category:'Business Continuity', description:'Identify critical processes and dependencies', objective:'Prioritise recovery of critical systems', iso:'A.17.1.1', nist:'CP-2' },

  // Physical Security
  { code:'PS-001', name:'Physical Access Control', category:'Physical Security', description:'Restrict physical access to data centres', objective:'Prevent unauthorised physical access', iso:'A.11.1.1', nist:'PE-3' },
  { code:'PS-002', name:'CCTV and Monitoring', category:'Physical Security', description:'24/7 CCTV coverage of critical areas', objective:'Detect and deter physical security threats', iso:'A.11.1.2', nist:'PE-6' },
];

async function main() {
  console.log('Seeding control library...');

  for (const ctrl of CONTROLS) {
    const control = await prisma.control.upsert({
      where: { controlCode: ctrl.code },
      update: {
        name: ctrl.name, description: ctrl.description,
        category: ctrl.category, objective: ctrl.objective,
      },
      create: {
        controlCode: ctrl.code, name: ctrl.name,
        description: ctrl.description, category: ctrl.category,
        objective: ctrl.objective, testingGuidance: `Verify ${ctrl.name.toLowerCase()} is implemented and operating effectively`,
        isActive: true,
      },
    });

    // ISO 27001 mapping
    if (ctrl.iso) {
      await prisma.controlFrameworkMapping.upsert({
        where: { controlId_framework_frameworkControlId: { controlId:control.id, framework:'ISO_27001', frameworkControlId:ctrl.iso } },
        update: {},
        create: { controlId:control.id, framework:'ISO_27001', frameworkControlId:ctrl.iso, frameworkDomain:ctrl.category },
      }).catch(()=>{});
    }

    // NIST mapping
    if (ctrl.nist) {
      await prisma.controlFrameworkMapping.upsert({
        where: { controlId_framework_frameworkControlId: { controlId:control.id, framework:'NIST_CSF', frameworkControlId:ctrl.nist } },
        update: {},
        create: { controlId:control.id, framework:'NIST_CSF', frameworkControlId:ctrl.nist, frameworkDomain:ctrl.category },
      }).catch(()=>{});
    }

    console.log(`  ✓ ${ctrl.code} — ${ctrl.name}`);
  }

  console.log(`\n✅ Seeded ${CONTROLS.length} controls`);
}

main().catch(console.error).finally(()=>prisma.$disconnect());
