-- Password reset tokens table
-- Tokens expire after 1 hour and are single-use
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,   -- SHA-256 hash of the actual token
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,            -- NULL = not yet used
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens(user_id);

-- Auto-cleanup: run via cron or a background task
-- DELETE FROM password_reset_tokens WHERE expires_at < NOW();
