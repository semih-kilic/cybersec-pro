-- Add SSH host fingerprint column to agents table
-- Used to prevent MITM attacks during remote scan execution
ALTER TABLE agents ADD COLUMN IF NOT EXISTS ssh_fingerprint TEXT;

-- Index for agent lookup
CREATE INDEX IF NOT EXISTS idx_agents_org_id ON agents(organization_id);
