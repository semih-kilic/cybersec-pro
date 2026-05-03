-- Reverse-tunnel agent job queue.
-- Agents poll GET /api/v1/agents/:id/jobs/next (long-poll, Bearer api_key)
-- and POST results to /api/v1/agents/:id/jobs/:job_id/result.

CREATE TABLE IF NOT EXISTS agent_jobs (
    id              TEXT         PRIMARY KEY,
    agent_id        TEXT         NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    organization_id TEXT         NOT NULL,
    scan_id         TEXT         NULL,
    tool_id         TEXT         NULL,
    command         TEXT         NOT NULL,
    timeout_seconds INTEGER      NOT NULL DEFAULT 600,
    status          TEXT         NOT NULL DEFAULT 'pending',  -- pending | claimed | running | completed | failed | timeout | cancelled
    exit_code       INTEGER      NULL,
    stdout          TEXT         NULL,
    stderr          TEXT         NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    claimed_at      TIMESTAMPTZ  NULL,
    completed_at    TIMESTAMPTZ  NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_jobs_agent_status
    ON agent_jobs (agent_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_jobs_org_created
    ON agent_jobs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_jobs_scan
    ON agent_jobs (scan_id) WHERE scan_id IS NOT NULL;
