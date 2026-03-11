use dashmap::DashMap;
use std::time::{Duration, Instant};

/// Simple in-memory rate limiter with optional Redis backend.
/// Mirrors Flask SimpleRateLimiter behavior.
pub struct RateLimiter {
    requests: DashMap<String, Vec<Instant>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            requests: DashMap::new(),
        }
    }

    /// Check if a key has exceeded `limit` requests within `window`.
    /// Returns true if rate limited.
    pub fn is_limited(&self, key: &str, limit: usize, window: Duration) -> bool {
        let now = Instant::now();
        let cutoff = now - window;

        let mut entry = self.requests.entry(key.to_string()).or_insert_with(Vec::new);
        entry.retain(|t| *t > cutoff);

        if entry.len() >= limit {
            return true;
        }
        entry.push(now);
        false
    }

    /// Cleanup expired entries (call periodically).
    pub fn cleanup(&self, max_age: Duration) {
        let cutoff = Instant::now() - max_age;
        self.requests.retain(|_, v| {
            v.retain(|t| *t > cutoff);
            !v.is_empty()
        });
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}
