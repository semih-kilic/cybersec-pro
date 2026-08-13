-- White-label branding fields for organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#0f172a';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#22d3ee';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS hide_platform_logo BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_footer_text TEXT;

-- Scheduled scan retry and history
ALTER TABLE scheduled_scans ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE scheduled_scans ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;
ALTER TABLE scheduled_scans ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE scheduled_scans ADD COLUMN IF NOT EXISTS notify_on_success BOOLEAN DEFAULT TRUE;
ALTER TABLE scheduled_scans ADD COLUMN IF NOT EXISTS notify_on_failure BOOLEAN DEFAULT TRUE;

-- Schedule run history table
CREATE TABLE IF NOT EXISTS schedule_run_history (
    id TEXT PRIMARY KEY,
    scheduled_scan_id TEXT NOT NULL REFERENCES scheduled_scans(id),
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    scan_id TEXT REFERENCES scans(id),
    status TEXT NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    output TEXT,
    error TEXT,
    retry_of TEXT
);

CREATE INDEX IF NOT EXISTS idx_schedule_run_history_schedule ON schedule_run_history(scheduled_scan_id);
CREATE INDEX IF NOT EXISTS idx_schedule_run_history_org ON schedule_run_history(organization_id);
