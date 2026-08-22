// Platform-wide kill switch middleware.
//
// When the `platform_kill_switch` feature flag is enabled, every API request
// is refused with 503 — except superadmin endpoints (so an admin can still
// disengage the switch), login, health probes and the Stripe webhook.
//
// A short in-memory TTL keeps the flag lookup off the database hot path.

use std::sync::Arc;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

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

const FLAG_KEY: &str = "platform_kill_switch";
const CACHE_TTL: Duration = Duration::from_secs(5);

fn cache() -> &'static std::sync::Mutex<(Option<bool>, Instant)> {
    static C: OnceLock<std::sync::Mutex<(Option<bool>, Instant)>> = OnceLock::new();
    C.get_or_init(|| std::sync::Mutex::new((None, Instant::now() - Duration::from_secs(3600))))
}

async fn engaged(db: &sqlx::PgPool) -> bool {
    {
        let cached = cache().lock().unwrap();
        if let Some(v) = cached.0 {
            if cached.1.elapsed() < CACHE_TTL {
                return v;
            }
        }
    }
    let value = sqlx::query_scalar::<_, bool>(
        "SELECT COALESCE((SELECT enabled FROM feature_flags WHERE key = $1), FALSE)",
    )
    .bind(FLAG_KEY)
    .fetch_one(db)
    .await
    .unwrap_or(false);
    let mut cached = cache().lock().unwrap();
    *cached = (Some(value), Instant::now());
    value
}

/// Paths that must keep working while the kill switch is engaged:
///   • /api/v1/superadmin/*     so a superadmin can disengage the switch
///   • /api/v1/auth/login       so sessions can be re-established (lockout guard)
///   • /health, /ready          load balancer probes
///   • /api/v1/billing/webhook  Stripe must keep processing payments
///   • /api/docs                internal reference
const EXEMPT_PREFIXES: &[&str] = &[
    "/api/v1/superadmin",
    "/api/v1/auth/login",
    "/health",
    "/ready",
    "/api/v1/billing/webhook",
    "/api/docs",
];

pub async fn guard(
    State(state): State<Arc<AppState>>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let path = req.uri().path();
    if path == "/" || EXEMPT_PREFIXES.iter().any(|p| path.starts_with(p)) {
        return next.run(req).await;
    }
    if engaged(&state.db).await {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "Platform temporarily unavailable (maintenance mode)",
                "kill_switch": true
            })),
        )
            .into_response();
    }
    next.run(req).await
}
