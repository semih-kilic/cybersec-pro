-- Add Purple Team persistence tables for exercises and org-specific profiles.
-- This backfills databases that predate the inline schema additions in db.rs.

CREATE TABLE IF NOT EXISTS purple_team_exercises (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    attack_chain_id TEXT NOT NULL,
    target TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    total_steps BIGINT DEFAULT 0,
    completed_steps BIGINT DEFAULT 0,
    detected_attacks BIGINT DEFAULT 0,
    missed_attacks BIGINT DEFAULT 0,
    risk_score DOUBLE PRECISION DEFAULT 0,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purple_team_exercises_org_created
    ON purple_team_exercises(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purple_team_exercises_status
    ON purple_team_exercises(organization_id, status);

CREATE TABLE IF NOT EXISTS purple_team_profiles (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purple_team_profiles_updated_at
    ON purple_team_profiles(updated_at);