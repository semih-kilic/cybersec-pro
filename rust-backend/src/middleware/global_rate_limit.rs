//! Blanket rate limiting for every route.
//!
//! AUDIT 2026-08-29 — only 9 of ~232 routes called the limiter by hand. The AI
//! endpoints were among the unprotected ones, and each of those makes a paid
//! upstream LLM call: an authenticated user could run up an unbounded bill, and
//! an unauthenticated one could hammer anything else at will.
//!
//! Applied as a layer so a new route is protected by default rather than by
//! remembering to add a call.

use std::sync::Arc;
use std::time::Duration;

use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::AppState;

/// Paths that must never be throttled.
const EXEMPT: &[&str] = &[
    "/health",
    "/ready",
    "/api/health",
    // Stripe retries on failure; a 429 here turns a transient limit into a
    // lost billing event.
    "/api/v1/billing/webhook",
    // Long-poll and stream endpoints hold a connection open by design.
    "/api/v1/agents/",
    "/api/v1/scan/",
];

/// Cost tiers. First match wins, so order matters.
fn limit_for(path: &str) -> (usize, Duration) {
    // Paid upstream calls — the expensive ones.
    if path.starts_with("/api/v1/ai/") || path.starts_with("/api/v1/chatbot/") {
        return (20, Duration::from_secs(60));
    }
    // Anything that starts work on a remote system.
    if path.starts_with("/api/v1/scans/") || path.starts_with("/api/v1/cybersec-ai/") {
        return (30, Duration::from_secs(60));
    }
    // Credential-adjacent surfaces get their own tighter per-handler limits
    // too; this is the outer bound.
    if path.starts_with("/api/v1/auth/") {
        return (60, Duration::from_secs(60));
    }
    // Everything else: generous, aimed at runaway clients rather than users.
    (300, Duration::from_secs(60))
}

/// Identify the caller: the authenticated subject when we can read one,
/// otherwise the client address our own proxy recorded.
fn caller_key(req: &Request<Body>, jwt_secret: &str) -> String {
    if let Some(auth) = req.headers().get("authorization").and_then(|v| v.to_str().ok()) {
        if let Some(tok) = auth.strip_prefix("Bearer ") {
            if let Ok(claims) = crate::services::auth::decode_token(jwt_secret, tok) {
                return format!("u:{}", claims.sub);
            }
        }
    }
    format!("ip:{}", crate::services::net::client_ip_or_unknown(req.headers()))
}

pub async fn guard(
    State(state): State<Arc<AppState>>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();

    if EXEMPT.iter().any(|p| path.starts_with(p)) {
        return next.run(req).await;
    }

    let (limit, window) = limit_for(&path);
    let key = format!("{}|{}", caller_key(&req, &state.jwt_secret), tier_of(&path));

    if state.rate_limiter.is_limited(&key, limit, window) {
        tracing::warn!("rate limit hit: {} on {}", key, path);
        return (
            StatusCode::TOO_MANY_REQUESTS,
            [("retry-after", window.as_secs().to_string())],
            Json(json!({
                "error": "Too many requests. Please slow down.",
                "code": "RATE_LIMITED",
                "retry_after_seconds": window.as_secs(),
            })),
        )
            .into_response();
    }

    next.run(req).await
}

/// Bucket name for a path, so the tiers count separately: burning the AI
/// allowance must not lock a user out of the rest of the dashboard.
fn tier_of(path: &str) -> &'static str {
    if path.starts_with("/api/v1/ai/") || path.starts_with("/api/v1/chatbot/") {
        "ai"
    } else if path.starts_with("/api/v1/scans/") || path.starts_with("/api/v1/cybersec-ai/") {
        "scan"
    } else if path.starts_with("/api/v1/auth/") {
        "auth"
    } else {
        "general"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ai_endpoints_get_the_tightest_limit() {
        let (n, _) = limit_for("/api/v1/ai/suggest");
        assert_eq!(n, 20, "paid LLM calls must be tightly limited");
        assert_eq!(limit_for("/api/v1/chatbot/message").0, 20);
    }

    #[test]
    fn general_endpoints_are_generous() {
        assert_eq!(limit_for("/api/v1/tools").0, 300);
        assert_eq!(limit_for("/api/v1/dashboard/stats").0, 300);
    }

    #[test]
    fn scan_and_auth_sit_between() {
        assert_eq!(limit_for("/api/v1/scans/create").0, 30);
        assert_eq!(limit_for("/api/v1/auth/login").0, 60);
    }

    #[test]
    fn tiers_are_separate_buckets() {
        // Exhausting the AI allowance must not lock the user out of the app.
        assert_ne!(tier_of("/api/v1/ai/x"), tier_of("/api/v1/tools"));
        assert_ne!(tier_of("/api/v1/auth/login"), tier_of("/api/v1/tools"));
        assert_eq!(tier_of("/api/v1/ai/a"), tier_of("/api/v1/chatbot/b"));
    }

    #[test]
    fn health_and_webhook_are_exempt() {
        for p in ["/health", "/ready", "/api/health", "/api/v1/billing/webhook"] {
            assert!(EXEMPT.iter().any(|e| p.starts_with(e)), "{p} must be exempt");
        }
    }

    #[test]
    fn streaming_and_long_poll_paths_are_exempt() {
        for p in ["/api/v1/scan/abc/output", "/api/v1/agents/xyz/next-job"] {
            assert!(EXEMPT.iter().any(|e| p.starts_with(e)), "{p} must be exempt");
        }
    }

    #[test]
    fn stripe_webhook_is_never_throttled() {
        // A 429 here would turn a retryable Stripe delivery into a lost event.
        assert!(EXEMPT.iter().any(|e| "/api/v1/billing/webhook".starts_with(e)));
    }
}
