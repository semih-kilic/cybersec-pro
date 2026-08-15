// Public newsletter subscription endpoint. Stores active subscribers in
// `newsletter_subscribers` (created in services/db.rs Phase 7) and sends a
// confirmation email via the existing SMTP service. Idempotent: re-subscribing
// the same email is a no-op (returns already_subscribed=true).

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::{sync::Arc, time::Duration};
use uuid::Uuid;

use crate::AppState;

#[derive(Deserialize)]
pub struct NewsletterSubscribeRequest {
    pub email: String,
    pub source: Option<String>,
}

fn looks_like_email(s: &str) -> bool {
    // RFC-correct enough for a marketing form: one '@', non-empty local + domain
    // with at least one '.' in the domain part, no whitespace, length sane.
    if s.len() < 5 || s.len() > 254 {
        return false;
    }
    if s.chars().any(char::is_whitespace) {
        return false;
    }
    let mut parts = s.splitn(2, '@');
    let (local, domain) = match (parts.next(), parts.next()) {
        (Some(l), Some(d)) => (l, d),
        _ => return false,
    };
    !local.is_empty() && domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.')
}

pub async fn subscribe_newsletter(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<NewsletterSubscribeRequest>,
) -> impl IntoResponse {
    let email = body.email.trim().to_lowercase();
    if !looks_like_email(&email) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Please enter a valid email address."})),
        )
            .into_response();
    }

    // Rate limit: 5 subscriptions / IP / hour to deter scripted abuse.
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .unwrap_or("unknown")
        .trim()
        .to_string();
    if state
        .rate_limiter
        .is_limited(&format!("newsletter:{}", ip), 5, Duration::from_secs(3600))
    {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({"error": "Too many subscription attempts. Try again later."})),
        )
            .into_response();
    }

    // Insert; ON CONFLICT keeps existing row and reports already_subscribed.
    let id = Uuid::new_v4().to_string();
    let source = body.source.unwrap_or_else(|| "blog".to_string());

    let inserted: Result<Option<(String,)>, sqlx::Error> = sqlx::query_as(
        "INSERT INTO newsletter_subscribers (id, email, source, is_active) \
         VALUES ($1, $2, $3, TRUE) \
         ON CONFLICT (email) DO NOTHING \
         RETURNING id",
    )
    .bind(&id)
    .bind(&email)
    .bind(&source)
    .fetch_optional(&state.db)
    .await;

    let already_subscribed = match inserted {
        Ok(Some(_)) => false,
        Ok(None) => true,
        Err(e) => {
            tracing::error!("Newsletter insert failed: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Could not save subscription. Please try again."})),
            )
                .into_response();
        }
    };

    if !already_subscribed {
        // Fire-and-forget welcome email; do not block the response on SMTP.
        let email_for_task = email.clone();
        tokio::spawn(async move {
            if let Err(e) = crate::services::email::send_newsletter_welcome(&email_for_task).await {
                tracing::warn!("Newsletter welcome email failed for {}: {}", email_for_task, e);
            }
        });
    }

    (
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "already_subscribed": already_subscribed,
            "email": email,
        })),
    )
        .into_response()
}

#[derive(Deserialize)]
pub struct UnsubscribeRequest {
    pub email: String,
}

/// CASL one-click unsubscribe. Deactivates the email for all commercial
/// communication:
///   - newsletter_subscribers -> is_active = FALSE (marketing)
///   - notification_preferences -> email_scan_complete = FALSE (operational)
///   - users -> marketing opt-out flag so future campaigns skip them
/// Idempotent and instant — no login required (CASL requires frictionless opt-out).
pub async fn unsubscribe_newsletter(
    State(state): State<Arc<AppState>>,
    Json(body): Json<UnsubscribeRequest>,
) -> impl IntoResponse {
    let email = body.email.trim().to_lowercase();
    if !looks_like_email(&email) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Please provide a valid email address."})),
        )
            .into_response();
    }

    let _ = sqlx::query(
        "UPDATE newsletter_subscribers SET is_active = FALSE WHERE email = $1",
    )
    .bind(&email)
    .execute(&state.db)
    .await;

    let _ = sqlx::query(
        "UPDATE notification_preferences np SET email_scan_complete = FALSE \
         FROM users u WHERE np.user_id = u.id AND u.email = $1",
    )
    .bind(&email)
    .execute(&state.db)
    .await;

    let _ = sqlx::query(
        "UPDATE users SET marketing_opt_out = TRUE, updated_at = NOW() WHERE email = $1",
    )
    .bind(&email)
    .execute(&state.db)
    .await;

    crate::services::audit::log_audit(
        &state.db, "unsubscribe", "marketing", "info",
        None, None,
        Some(serde_json::json!({"email": email})),
        Some("user"), None, "success", None,
    ).await;

    (
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "message": "You have been unsubscribed. Consent withdrawal is effective immediately.",
            "email": email,
        })),
    )
        .into_response()
}
