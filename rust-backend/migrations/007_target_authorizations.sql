-- Target authorization: unbypassable ownership/permission confirmation gate.
-- Every scan/sweep requires the user to confirm, with a timestamped audit log
-- entry, that they own or are authorized to test the target. Scheduled scans
-- re-check validity on every run and are skipped when no authorization exists.

CREATE TABLE IF NOT EXISTS target_authorizations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    target TEXT NOT NULL,
    target_type TEXT NOT NULL,
    scope_statement TEXT NOT NULL,
    statement_version TEXT NOT NULL,
    confirmed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    last_used_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_target_auth_org_target ON target_authorizations(organization_id, target);
CREATE INDEX IF NOT EXISTS idx_target_auth_org ON target_authorizations(organization_id);

-- Link each scan to the authorization that permitted it (traceability).
ALTER TABLE scans ADD COLUMN IF NOT EXISTS authorization_id TEXT REFERENCES target_authorizations(id);

-- Scheduled scans snapshot the authorization that created them; the scheduler
-- re-validates against target_authorizations before every run.
ALTER TABLE scheduled_scans ADD COLUMN IF NOT EXISTS authorization_id TEXT REFERENCES target_authorizations(id);
ALTER TABLE scheduled_scans ADD COLUMN IF NOT EXISTS scope_statement TEXT;
ALTER TABLE scheduled_scans ADD COLUMN IF NOT EXISTS statement_version TEXT;
