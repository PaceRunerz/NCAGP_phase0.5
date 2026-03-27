-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('NIC', 'DEPARTMENT', 'VENDOR');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'VENDOR_ADMIN', 'AUDITOR', 'REVIEWER', 'OBSERVER');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('WEB_APPLICATION', 'API_SERVICE', 'DATABASE', 'NETWORK_DEVICE', 'SERVER', 'CLOUD_RESOURCE', 'IOT_DEVICE', 'MOBILE_APP', 'DATA_STORE', 'THIRD_PARTY_INTEGRATION');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'DECOMMISSIONED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "FrameworkType" AS ENUM ('ISO_27001', 'NIST_CSF', 'SOC2', 'DPDP', 'MEITY_AUDIT', 'CIS_CONTROLS', 'PCI_DSS');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'FINDINGS_SUBMITTED', 'REMEDIATION', 'VALIDATION', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION', 'REMEDIATED_PENDING_VALIDATION', 'VALIDATED', 'CLOSED', 'RISK_ACCEPTED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('SCREENSHOT', 'LOG_FILE', 'CONFIGURATION_EXPORT', 'POLICY_DOCUMENT', 'SCAN_REPORT', 'TEST_RESULT', 'CERTIFICATE', 'VIDEO_RECORDING', 'CODE_SNIPPET', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "LedgerEventType" AS ENUM ('USER_LOGIN', 'USER_LOGOUT', 'USER_MFA_BYPASS_ATTEMPT', 'USER_LOCKED', 'ORG_CREATED', 'ORG_MODIFIED', 'AUDIT_CREATED', 'AUDIT_STATUS_CHANGED', 'AUDIT_CLOSED', 'FINDING_CREATED', 'FINDING_STATUS_CHANGED', 'FINDING_SEVERITY_CHANGED', 'FINDING_OWNER_CHANGED', 'FINDING_RISK_ACCEPTED', 'FINDING_FALSE_POSITIVE', 'EVIDENCE_UPLOADED', 'EVIDENCE_SUPERSEDED', 'EVIDENCE_INTEGRITY_CHECK', 'TASK_CREATED', 'TASK_ASSIGNED', 'TASK_COMPLETED', 'VENDOR_SCORED', 'VENDOR_BLACKLISTED', 'BULK_IMPORT', 'REPORT_EXPORTED', 'DATA_ACCESS_ANOMALY');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "orgType" "OrgType" NOT NULL,
    "parentOrgId" TEXT,
    "encryptionDomain" TEXT NOT NULL,
    "dataAccessScope" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "publicKey" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerUserId" TEXT,
    "businessUnit" TEXT NOT NULL,
    "criticality" INTEGER NOT NULL,
    "dataSensitivity" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "locationRegion" TEXT NOT NULL DEFAULT 'IN',
    "ipAddress" TEXT,
    "hostname" TEXT,
    "dependencies" TEXT[],
    "tags" TEXT[],
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_owner_history" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "previousOwner" TEXT,
    "newOwner" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "asset_owner_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controls" (
    "id" TEXT NOT NULL,
    "controlCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "testingGuidance" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_framework_mappings" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "framework" "FrameworkType" NOT NULL,
    "frameworkControlId" TEXT NOT NULL,
    "frameworkDomain" TEXT NOT NULL,

    CONSTRAINT "control_framework_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vendorOrgId" TEXT,
    "framework" "FrameworkType" NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'PLANNED',
    "auditLeadId" TEXT,
    "reportRef" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_assets" (
    "auditId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_assets_pkey" PRIMARY KEY ("auditId","assetId")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT,
    "controlId" TEXT,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "recommendation" TEXT,
    "technicalDetail" TEXT,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT,
    "slaDate" TIMESTAMP(3),
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closureJustification" TEXT,
    "riskAcceptedBy" TEXT,
    "riskAcceptedAt" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "previousFindingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_status_history" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "fromStatus" "FindingStatus",
    "toStatus" "FindingStatus" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,

    CONSTRAINT "finding_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "storageRef" TEXT NOT NULL,
    "storageRegion" TEXT NOT NULL DEFAULT 'ap-south-1',
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "digitalSignature" TEXT,
    "description" TEXT,
    "isSuperseded" BOOLEAN NOT NULL DEFAULT false,
    "supersededById" TEXT,
    "supersededAt" TIMESTAMP(3),
    "supersessionReason" TEXT,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedToId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "certifications" TEXT[],
    "empanelmentDate" TIMESTAMP(3),
    "empanelmentExpiry" TIMESTAMP(3),
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "onTimeDeliveryPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "falsePositiveRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recurringFindingsRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "slaCompliancePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklistReason" TEXT,
    "blacklistedAt" TIMESTAMP(3),
    "blacklistedBy" TEXT,
    "totalAudits" INTEGER NOT NULL DEFAULT 0,
    "totalFindings" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventType" "LedgerEventType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "hashPrev" TEXT NOT NULL,
    "hashCurrent" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_shortCode_key" ON "organizations"("shortCode");

-- CreateIndex
CREATE INDEX "organizations_orgType_idx" ON "organizations"("orgType");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_orgId_idx" ON "users"("orgId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "assets_orgId_idx" ON "assets"("orgId");

-- CreateIndex
CREATE INDEX "assets_criticality_idx" ON "assets"("criticality");

-- CreateIndex
CREATE UNIQUE INDEX "controls_controlCode_key" ON "controls"("controlCode");

-- CreateIndex
CREATE UNIQUE INDEX "control_framework_mappings_controlId_framework_frameworkCon_key" ON "control_framework_mappings"("controlId", "framework", "frameworkControlId");

-- CreateIndex
CREATE INDEX "audits_orgId_idx" ON "audits"("orgId");

-- CreateIndex
CREATE INDEX "audits_status_idx" ON "audits"("status");

-- CreateIndex
CREATE INDEX "findings_orgId_idx" ON "findings"("orgId");

-- CreateIndex
CREATE INDEX "findings_auditId_idx" ON "findings"("auditId");

-- CreateIndex
CREATE INDEX "findings_severity_idx" ON "findings"("severity");

-- CreateIndex
CREATE INDEX "findings_status_idx" ON "findings"("status");

-- CreateIndex
CREATE INDEX "findings_slaDate_idx" ON "findings"("slaDate");

-- CreateIndex
CREATE INDEX "evidence_findingId_idx" ON "evidence"("findingId");

-- CreateIndex
CREATE INDEX "tasks_assignedToId_idx" ON "tasks"("assignedToId");

-- CreateIndex
CREATE INDEX "tasks_findingId_idx" ON "tasks"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_orgId_key" ON "vendors"("orgId");

-- CreateIndex
CREATE INDEX "audit_ledger_userId_idx" ON "audit_ledger"("userId");

-- CreateIndex
CREATE INDEX "audit_ledger_entityId_idx" ON "audit_ledger"("entityId");

-- CreateIndex
CREATE INDEX "audit_ledger_eventType_idx" ON "audit_ledger"("eventType");

-- CreateIndex
CREATE INDEX "audit_ledger_timestamp_idx" ON "audit_ledger"("timestamp");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parentOrgId_fkey" FOREIGN KEY ("parentOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_owner_history" ADD CONSTRAINT "asset_owner_history_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_framework_mappings" ADD CONSTRAINT "control_framework_mappings_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_vendorOrgId_fkey" FOREIGN KEY ("vendorOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_assets" ADD CONSTRAINT "audit_assets_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_assets" ADD CONSTRAINT "audit_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_status_history" ADD CONSTRAINT "finding_status_history_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_ledger" ADD CONSTRAINT "audit_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
