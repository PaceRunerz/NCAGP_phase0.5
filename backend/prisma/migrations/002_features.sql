-- NCAGP — Feature Migration 002 (FIXED — uses TEXT ids to match Prisma schema)

-- Clean up any partial previous runs
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS sla_alert_log CASCADE;
DROP TYPE IF EXISTS "ApiKeyScope" CASCADE;

-- 1. API Keys table
CREATE TYPE "ApiKeyScope" AS ENUM (
  'FINDINGS_WRITE', 'FINDINGS_READ', 'EVIDENCE_WRITE', 'FULL_ACCESS'
);

CREATE TABLE api_keys (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orgId"       TEXT NOT NULL REFERENCES organizations(id),
  name          TEXT NOT NULL,
  "keyHash"     TEXT NOT NULL UNIQUE,
  "keyPrefix"   TEXT NOT NULL,
  scopes        "ApiKeyScope"[] NOT NULL DEFAULT '{}',
  "createdById" TEXT NOT NULL,
  "lastUsedAt"  TIMESTAMPTZ,
  "expiresAt"   TIMESTAMPTZ,
  "isRevoked"   BOOLEAN NOT NULL DEFAULT FALSE,
  "revokedAt"   TIMESTAMPTZ,
  "revokedBy"   TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_org ON api_keys("orgId");
CREATE INDEX idx_api_keys_prefix ON api_keys("keyPrefix");

-- 2. SLA alerts log
CREATE TABLE sla_alert_log (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "findingId"  TEXT NOT NULL REFERENCES findings(id),
  "alertType"  TEXT NOT NULL,
  "sentAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "sentTo"     TEXT NOT NULL,
  UNIQUE("findingId", "alertType")
);

-- 3. MFA columns on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS "mfaSetupPending" BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "mfaBackupCodes" TEXT[];

-- 4. Grant permissions to app user
GRANT ALL ON api_keys TO ncagp_app;
GRANT ALL ON sla_alert_log TO ncagp_app;