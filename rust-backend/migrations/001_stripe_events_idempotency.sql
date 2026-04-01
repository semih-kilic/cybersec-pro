-- Stripe webhook idempotency table
-- Prevents duplicate event processing (replay attacks)
CREATE TABLE IF NOT EXISTS stripe_events (
    event_id    TEXT PRIMARY KEY,
    event_type  TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Auto-cleanup events older than 30 days (optional, run via cron)
-- DELETE FROM stripe_events WHERE processed_at < NOW() - INTERVAL '30 days';
