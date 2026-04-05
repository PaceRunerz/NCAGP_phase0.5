-- ─────────────────────────────────────────────────────────────────
-- NCAGP — Database Security Migration
-- File: prisma/migrations/001_security_hardening.sql
--
-- This migration adds the security layer ABOVE the ORM:
--   1. Row-Level Security (RLS) per org — defense in depth
--   2. Immutability trigger on audit_ledger — no UPDATE/DELETE allowed
--   3. Finding SLA auto-breach detection trigger
--   4. Read-only DB user for reporting
-- ─────────────────────────────────────────────────────────────────

-- ─── 1. ROW-LEVEL SECURITY ────────────────────────────────────

-- Enable RLS on all tenant-scoped tables
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_ledger ENABLE ROW LEVEL SECURITY;

-- The app sets this at session start: SET app.current_org_id = '...';
-- The app sets this at session start: SET app.current_role = '...';

-- NIC_ADMIN sees all (no filter)
-- All other roles filtered by org_id

-- Findings RLS Policy
CREATE POLICY findings_org_isolation ON findings
  USING (
    current_setting('app.current_role', true) = 'NIC_ADMIN'
    OR 
    org_id = current_setting('app.current_org_id', true)::uuid
    OR
    org_id = ANY(
      SELECT unnest(data_access_scope::uuid[]) 
      FROM organizations 
      WHERE id = current_setting('app.current_org_id', true)::uuid
    )
  );

-- Assets RLS Policy
CREATE POLICY assets_org_isolation ON assets
  USING (
    current_setting('app.current_role', true) = 'NIC_ADMIN'
    OR 
    org_id = current_setting('app.current_org_id', true)::uuid
  );

-- Audits RLS Policy
CREATE POLICY audits_org_isolation ON audits
  USING (
    current_setting('app.current_role', true) = 'NIC_ADMIN'
    OR 
    org_id = current_setting('app.current_org_id', true)::uuid
    OR
    vendor_org_id = current_setting('app.current_org_id', true)::uuid
  );

-- Audit Ledger: anyone can READ their own org's ledger, no one can write directly
CREATE POLICY ledger_read_own ON audit_ledger
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'NIC_ADMIN'
    OR 
    org_id = current_setting('app.current_org_id', true)::uuid
  );

-- DENY all INSERT/UPDATE/DELETE on ledger from app (use the service method only)
CREATE POLICY ledger_no_direct_write ON audit_ledger
  FOR INSERT
  WITH CHECK (false);  -- Only the service account can insert via trusted function


-- ─── 2. LEDGER IMMUTABILITY TRIGGER ──────────────────────────

-- Block UPDATE on ledger entries — ever
CREATE OR REPLACE FUNCTION prevent_ledger_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 
    'IMMUTABILITY VIOLATION: Audit ledger entries cannot be modified. Entry: %', OLD.id
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_ledger_immutability_update
  BEFORE UPDATE ON audit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_update();

-- Block DELETE on ledger entries — ever
CREATE OR REPLACE FUNCTION prevent_ledger_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 
    'IMMUTABILITY VIOLATION: Audit ledger entries cannot be deleted. Entry: %', OLD.id
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_ledger_immutability_delete
  BEFORE DELETE ON audit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_delete();

-- Block TRUNCATE on ledger table — ever
CREATE OR REPLACE FUNCTION prevent_ledger_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 
    'IMMUTABILITY VIOLATION: Audit ledger table cannot be truncated.'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_ledger_immutability_truncate
  BEFORE TRUNCATE ON audit_ledger
  EXECUTE FUNCTION prevent_ledger_truncate();


-- ─── 3. SLA AUTO-BREACH TRIGGER ───────────────────────────────

CREATE OR REPLACE FUNCTION check_and_mark_sla_breach()
RETURNS void AS $$
BEGIN
  UPDATE findings
  SET sla_breached = true
  WHERE 
    sla_date < NOW()
    AND sla_breached = false
    AND status NOT IN ('CLOSED', 'FALSE_POSITIVE', 'RISK_ACCEPTED');
    
  -- Log all newly breached findings to ledger (via service layer instead)
  -- This is done by the scheduled job in NestJS, not DB trigger
END;
$$ LANGUAGE plpgsql;

-- Run every hour via pg_cron or NestJS scheduler
-- SELECT cron.schedule('sla_breach_check', '0 * * * *', 'SELECT check_and_mark_sla_breach()');


-- ─── 4. REPORTING READ-ONLY USER ──────────────────────────────

-- Create a restricted user for reporting/BI tools
-- This user can only SELECT — cannot modify data
CREATE USER ncagp_reporting WITH PASSWORD 'REPLACE_WITH_VAULT_SECRET';
GRANT CONNECT ON DATABASE ncagp TO ncagp_reporting;
GRANT USAGE ON SCHEMA public TO ncagp_reporting;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ncagp_reporting;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ncagp_reporting;

-- This user cannot bypass RLS
ALTER USER ncagp_reporting SET row_security = on;


-- ─── 5. EVIDENCE IMMUTABILITY ─────────────────────────────────

-- Prevent deletion of evidence records
CREATE OR REPLACE FUNCTION prevent_evidence_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 
    'IMMUTABILITY VIOLATION: Evidence records cannot be deleted. Use supersession. Evidence ID: %', OLD.id
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_evidence_immutability
  BEFORE DELETE ON evidence
  FOR EACH ROW
  EXECUTE FUNCTION prevent_evidence_delete();


-- ─── 6. USEFUL INDEXES FOR PERFORMANCE ────────────────────────

CREATE INDEX CONCURRENTLY idx_findings_org_severity_status 
  ON findings(org_id, severity, status);

CREATE INDEX CONCURRENTLY idx_findings_sla_breach 
  ON findings(sla_date, status) 
  WHERE sla_breached = false AND status NOT IN ('CLOSED', 'FALSE_POSITIVE');

CREATE INDEX CONCURRENTLY idx_ledger_entity 
  ON audit_ledger(entity_type, entity_id, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_ledger_chain 
  ON audit_ledger(timestamp DESC);
