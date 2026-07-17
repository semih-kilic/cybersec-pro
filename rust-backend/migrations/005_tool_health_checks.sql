-- Tool health check history table
CREATE TABLE IF NOT EXISTS tool_health_checks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tool_id TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    check_type TEXT NOT NULL DEFAULT 'full',
    status TEXT NOT NULL DEFAULT 'pending',
    installed BOOLEAN DEFAULT false,
    version TEXT,
    runtime_ok BOOLEAN DEFAULT false,
    runtime_output TEXT,
    dependency_ok BOOLEAN DEFAULT true,
    dependency_output TEXT,
    response_time_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_health_checks_tool_id ON tool_health_checks(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_health_checks_status ON tool_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_tool_health_checks_checked_at ON tool_health_checks(checked_at);

-- Add scan_phase column to scans for state machine tracking
ALTER TABLE scans ADD COLUMN IF NOT EXISTS scan_phase TEXT DEFAULT 'pending';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS phase_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS last_output_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS total_output_lines INTEGER DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS estimated_duration_ms INTEGER;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER DEFAULT 900;
