// ─────────────────────────────────────────────────────────────────
// NCAGP — Database Seed
// File: prisma/seed.ts
//
// Creates initial NIC org, admin user, and sample dept orgs.
// Run: npx ts-node prisma/seed.ts
// ─────────────────────────────────────────────────────────────────

import { PrismaClient, OrgType, UserRole, AssetType, Severity, AuditStatus, FrameworkType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();  dfz

async function main() {
  console.log('🌱 Seeding NCAGP database...\n');

  // ── 1. Create NIC (root organization) ─────────────────────────
  const nic = await prisma.organization.upsert({
    where: { shortCode: 'NIC' },
    update: {},
    create: {
      name: 'National Informatics Centre',
      shortCode: 'NIC',
      orgType: OrgType.NIC,
      encryptionDomain: 'nic.in',
      dataAccessScope: [],
    },
  });
  console.log(`✅ Org: ${nic.name} (${nic.id})`);

  // ── 2. Create department orgs ──────────────────────────────────
  const depts = [
    { name: 'Ministry of Home Affairs', shortCode: 'MHA' },
    { name: 'Ministry of Finance', shortCode: 'MOF' },
    { name: 'Ministry of Defence', shortCode: 'MOD' },
    { name: 'Ministry of Health', shortCode: 'MOH' },
    { name: 'Ministry of External Affairs', shortCode: 'MEA' },
  ];

  const deptOrgs: Record<string, string> = {};
  for (const d of depts) {
    const org = await prisma.organization.upsert({
      where: { shortCode: d.shortCode },
      update: {},
      create: {
        name: d.name,
        shortCode: d.shortCode,
        orgType: OrgType.DEPARTMENT,
        parentOrgId: nic.id,
        encryptionDomain: `${d.shortCode.toLowerCase()}.gov.in`,
        dataAccessScope: [],
      },
    });
    deptOrgs[d.shortCode] = org.id;
    console.log(`✅ Dept: ${d.name} (${org.id})`);
  }

  // ── 3. Create vendor org ───────────────────────────────────────
  const vendorOrg = await prisma.organization.upsert({
    where: { shortCode: 'CRED' },
    update: {},
    create: {
      name: 'Credential Security Pvt Ltd',
      shortCode: 'CRED',
      orgType: OrgType.VENDOR,
      encryptionDomain: 'credsec.in',
      dataAccessScope: Object.values(deptOrgs),
    },
  });
  console.log(`✅ Vendor: ${vendorOrg.name} (${vendorOrg.id})`);

  await prisma.vendor.upsert({
    where: { orgId: vendorOrg.id },
    update: {},
    create: {
      orgId: vendorOrg.id,
      registrationNumber: 'GSTIN-29AAACC1234F1Z5',
      certifications: ['ISO27001', 'CREST'],
      trustScore: 85,
      qualityScore: 78,
    },
  });

  // ── 4. Create users ───────────────────────────────────────────
  const HASH = await bcrypt.hash('Admin@1234!', 12);
  const DEPT_HASH = await bcrypt.hash('Dept@5678!', 12);

  const users = [
    {
      email: 'admin@nic.in',
      name: 'NIC Admin',
      role: UserRole.NIC_ADMIN,
      orgId: nic.id,
      hash: HASH,
    },
    {
      email: 'ciso@mha.gov.in',
      name: 'MHA CISO',
      role: UserRole.DEPT_CISO,
      orgId: deptOrgs['MHA'],
      hash: DEPT_HASH,
    },
    {
      email: 'security@mha.gov.in',
      name: 'MHA Security Officer',
      role: UserRole.DEPT_SECURITY,
      orgId: deptOrgs['MHA'],
      hash: DEPT_HASH,
    },
    {
      email: 'auditor@credsec.in',
      name: 'Lead Auditor',
      role: UserRole.AUDITOR,
      orgId: vendorOrg.id,
      hash: DEPT_HASH,
    },
  ];

  const createdUsers: Record<string, string> = {};
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        orgId: u.orgId,
        passwordHash: u.hash,
        mfaEnabled: false,
      },
    });
    createdUsers[u.email] = user.id;
    console.log(`✅ User: ${u.email} (${u.role})`);
  }

  // ── 5. Create sample asset ─────────────────────────────────────
  const asset = await prisma.asset.create({
    data: {
      orgId: deptOrgs['MHA'],
      assetType: AssetType.WEB_APPLICATION,
      name: 'MHA Citizen Portal',
      description: 'Public-facing web portal for citizen services',
      businessUnit: 'Digital Services',
      criticality: 5,
      dataSensitivity: 'CONFIDENTIAL',
      environment: 'PROD',
      hostname: 'portal.mha.gov.in',
      tags: ['citizen-facing', 'pii', 'mission-critical'],
    },
  });
  console.log(`✅ Asset: ${asset.name}`);

  // ── 6. Create sample audit ─────────────────────────────────────
  const audit = await prisma.audit.create({
    data: {
      orgId: deptOrgs['MHA'],
      vendorOrgId: vendorOrg.id,
      framework: FrameworkType.ISO_27001,
      title: 'MHA Annual ISO 27001 Audit 2024',
      scope: 'Full audit of MHA digital infrastructure including citizen portal, internal systems, and cloud assets',
      objectives: 'Assess compliance with ISO 27001:2022, identify security gaps, and recommend remediation actions',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-03-31'),
      status: AuditStatus.IN_PROGRESS,
      auditLeadId: createdUsers['auditor@credsec.in'],
    },
  });
  console.log(`✅ Audit: ${audit.title}`);

  // ── 7. Create sample findings ──────────────────────────────────
  const findingsData = [
    {
      severity: Severity.CRITICAL,
      title: 'MFA Not Enforced on Admin Accounts',
      description: 'Administrative accounts can authenticate without multi-factor authentication, enabling account takeover via credential stuffing.',
      recommendation: 'Enable TOTP-based MFA for all administrative accounts within 24 hours. Use hardware tokens for super-admin accounts.',
      slaOffset: 1,
    },
    {
      severity: Severity.HIGH,
      title: 'TLS 1.0/1.1 Enabled on API Gateway',
      description: 'The API gateway accepts connections using deprecated TLS 1.0 and 1.1 protocols which have known vulnerabilities (POODLE, BEAST).',
      recommendation: 'Disable TLS 1.0 and 1.1. Enforce TLS 1.2 minimum, TLS 1.3 preferred.',
      slaOffset: 3,
    },
    {
      severity: Severity.HIGH,
      title: 'Unpatched CVE-2023-44487 (HTTP/2 Rapid Reset)',
      description: 'Web server is vulnerable to the HTTP/2 rapid reset attack (CVE-2023-44487) which can cause denial of service.',
      recommendation: 'Apply vendor patches immediately. Implement HTTP/2 rate limiting as interim mitigation.',
      slaOffset: 3,
    },
    {
      severity: Severity.MEDIUM,
      title: 'Excessive CORS Policy on API',
      description: 'API CORS policy uses wildcard (*) origin which allows any domain to make cross-origin requests.',
      recommendation: 'Restrict CORS to specific trusted domains. Implement CORS allowlist.',
      slaOffset: 7,
    },
    {
      severity: Severity.MEDIUM,
      title: 'Sensitive Data in Application Logs',
      description: 'Application logs contain PII including Aadhaar numbers and mobile numbers in plaintext.',
      recommendation: 'Implement log masking for all PII fields. Audit existing log data and purge sensitive content.',
      slaOffset: 7,
    },
    {
      severity: Severity.LOW,
      title: 'Missing Security Headers (CSP, HSTS)',
      description: 'Web application does not set Content-Security-Policy or Strict-Transport-Security headers.',
      recommendation: 'Add CSP header with strict policy. Enable HSTS with max-age of at least 1 year.',
      slaOffset: 30,
    },
  ];

  for (const f of findingsData) {
    const slaDate = new Date();
    slaDate.setDate(slaDate.getDate() + f.slaOffset);

    await prisma.finding.create({
      data: {
        auditId: audit.id,
        orgId: deptOrgs['MHA'],
        assetId: asset.id,
        severity: f.severity,
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        slaDate,
        slaBreached: false,
      },
    });
    console.log(`✅ Finding [${f.severity}]: ${f.title}`);
  }

  // ── 8. Create sample finding for MOF (heatmap variety) ────────
  await prisma.finding.create({
    data: {
      auditId: audit.id,
      orgId: deptOrgs['MOF'],
      severity: Severity.CRITICAL,
      title: 'SQL Injection in Revenue Portal',
      description: 'Tax filing portal vulnerable to SQL injection enabling data exfiltration.',
      recommendation: 'Parameterize all queries. Deploy WAF immediately.',
      slaDate: new Date(Date.now() - 2 * 86400000), // Already breached
      slaBreached: true,
    },
  });

  // Create a genesis ledger entry (required for hash chain)
  const adminUserId = createdUsers['admin@nic.in'];
  
  // Use the $executeRaw to directly insert genesis entry with known hash
  await prisma.$executeRaw`
    INSERT INTO audit_ledger 
      (id, user_id, org_id, event_type, entity_type, entity_id, payload, ip_address, hash_prev, hash_current, timestamp)
    VALUES 
      (gen_random_uuid(), ${adminUserId}, ${nic.id}, 'ORG_CREATED', 'System', 'GENESIS', 
       '{"message":"NCAGP ledger initialized"}'::jsonb, '127.0.0.1',
       '0000000000000000000000000000000000000000000000000000000000000000',
       '0000000000000000000000000000000000000000000000000000000000000001',
       NOW())
    ON CONFLICT DO NOTHING
  `;
  console.log(`✅ Ledger genesis entry created`);

  console.log('\n🎉 Seed complete!\n');
  console.log('Login credentials:');
  console.log('  NIC Admin   → admin@nic.in     / Admin@1234!');
  console.log('  MHA CISO    → ciso@mha.gov.in  / Dept@5678!');
  console.log('  MHA Security→ security@mha.gov.in / Dept@5678!');
  console.log('  Auditor     → auditor@credsec.in / Dept@5678!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
