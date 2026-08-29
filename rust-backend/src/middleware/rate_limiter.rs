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

        self.evict_if_oversized();
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

    /// Number of tracked keys — used to bound memory.
    pub fn len(&self) -> usize {
        self.requests.len()
    }

    /// Upper bound on distinct keys held at once.
    ///
    /// The key is derived from the caller (user id, or client IP). An attacker
    /// who can vary that — even slightly — would otherwise grow this map
    /// without limit until the periodic cleanup ran, which is a memory-
    /// exhaustion path on a box that has already proven sensitive to memory
    /// pressure. When the cap is hit we drop the oldest half rather than stop
    /// limiting.
    pub const MAX_KEYS: usize = 50_000;

    fn evict_if_oversized(&self) {
        if self.requests.len() <= Self::MAX_KEYS {
            return;
        }
        let cutoff = Instant::now() - Duration::from_secs(60);
        self.requests.retain(|_, v| v.iter().any(|t| *t > cutoff));
        if self.requests.len() > Self::MAX_KEYS {
            // Still too many distinct callers in the last minute: shed
            // arbitrarily rather than grow unbounded.
            let excess = self.requests.len() - Self::MAX_KEYS;
            let victims: Vec<String> = self
                .requests
                .iter()
                .take(excess)
                .map(|e| e.key().clone())
                .collect();
            for k in victims {
                self.requests.remove(&k);
            }
        }
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_up_to_the_limit_then_blocks() {
        let rl = RateLimiter::new();
        for i in 0..5 {
            assert!(!rl.is_limited("k", 5, Duration::from_secs(60)), "request {i} should pass");
        }
        assert!(rl.is_limited("k", 5, Duration::from_secs(60)), "6th must be blocked");
    }

    #[test]
    fn keys_are_independent() {
        let rl = RateLimiter::new();
        for _ in 0..5 { rl.is_limited("a", 5, Duration::from_secs(60)); }
        assert!(rl.is_limited("a", 5, Duration::from_secs(60)));
        assert!(!rl.is_limited("b", 5, Duration::from_secs(60)), "a different caller must not be affected");
    }

    #[test]
    fn cleanup_drops_stale_keys() {
        let rl = RateLimiter::new();
        rl.is_limited("old", 5, Duration::from_secs(60));
        assert_eq!(rl.len(), 1);
        rl.cleanup(Duration::from_secs(0));
        assert_eq!(rl.len(), 0, "entries older than max_age must be dropped");
    }

    #[test]
    fn map_stays_bounded_under_key_flooding() {
        // Memory-exhaustion guard: a caller varying its key must not be able
        // to grow the map without limit.
        let rl = RateLimiter::new();
        for i in 0..(RateLimiter::MAX_KEYS + 5_000) {
            rl.is_limited(&format!("flood-{i}"), 100, Duration::from_secs(60));
        }
        assert!(
            rl.len() <= RateLimiter::MAX_KEYS + 1,
            "map grew to {} keys, cap is {}",
            rl.len(),
            RateLimiter::MAX_KEYS
        );
    }

    #[test]
    fn limiting_still_works_after_eviction() {
        let rl = RateLimiter::new();
        for i in 0..(RateLimiter::MAX_KEYS + 100) {
            rl.is_limited(&format!("f-{i}"), 100, Duration::from_secs(60));
        }
        for _ in 0..3 { rl.is_limited("victim", 3, Duration::from_secs(60)); }
        assert!(rl.is_limited("victim", 3, Duration::from_secs(60)));
    }
}
