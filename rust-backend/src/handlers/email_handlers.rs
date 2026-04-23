/// CyberSec Pro — Email API Handlers (Rust)
/// Replaces Python email_service.py API endpoints
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::services::email::{self, EmailConfig};
use crate::AppState;

// ── Pure helpers (testable without DB) ─────────────────────────────────────

/// Returns the configured SMTP server, falling back to `smtp.yandex.com`.
pub fn resolve_smtp_server(env_val: Option<String>) -> String {
    env_val.unwrap_or_else(|| "smtp.yandex.com".into())
}

/// Returns the configured SMTP email address, falling back to the default.
pub fn resolve_smtp_email(env_val: Option<String>) -> String {
    env_val.unwrap_or_else(|| "cybersecpro@semihkilic.com".into())
}

#[derive(Deserialize)]
pub struct SendLicenseRequest {
    pub customer_email: String,
    pub customer_name: String,
    pub license_key: String,
    pub plan_name: String,
    pub expiry_date: String,
}

#[derive(Deserialize)]
pub struct SendEmailRequest {
    pub to: String,
    pub name: String,
    #[serde(default)]
    pub template: String,
}

/// POST /api/v1/email/send-license — send license key email (admin only)
pub async fn send_license_email(
    State(_state): State<Arc<AppState>>,
    _auth: AuthUser,
    Json(body): Json<SendLicenseRequest>,
) -> impl IntoResponse {
    let cfg = match EmailConfig::from_env() {
        Some(c) => c,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "Email not configured. Set SMTP_PASSWORD env var."})),
            )
                .into_response()
        }
    };

    match email::send_license_email(
        &cfg,
        &body.customer_email,
        &body.customer_name,
        &body.license_key,
        &body.plan_name,
        &body.expiry_date,
    )
    .await
    {
        Ok(()) => (StatusCode::OK, Json(json!({"success": true, "message": "License email sent"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e}))).into_response(),
    }
}

/// POST /api/v1/email/send-welcome — send welcome email (admin only)
pub async fn send_welcome_email(
    State(_state): State<Arc<AppState>>,
    _auth: AuthUser,
    Json(body): Json<SendEmailRequest>,
) -> impl IntoResponse {
    let cfg = match EmailConfig::from_env() {
        Some(c) => c,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "Email not configured"})),
            )
                .into_response()
        }
    };

    match email::send_welcome_email(&cfg, &body.to, &body.name).await {
        Ok(()) => (StatusCode::OK, Json(json!({"success": true, "message": "Welcome email sent"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e}))).into_response(),
    }
}

/// GET /api/v1/email/config — check email config status
pub async fn email_config_status(
    State(_state): State<Arc<AppState>>,
    _auth: AuthUser,
) -> impl IntoResponse {
    let configured = EmailConfig::from_env().is_some();
    Json(json!({
        "configured": configured,
        "smtp_server": resolve_smtp_server(std::env::var("SMTP_SERVER").ok()),
        "smtp_email": resolve_smtp_email(std::env::var("SMTP_EMAIL").ok()),
    }))
}

#[cfg(test)]
mod tests {
    use super::{resolve_smtp_email, resolve_smtp_server};

    // ── resolve_smtp_server ───────────────────────────────────────────────

    #[test]
    fn resolve_smtp_server_uses_fallback_when_none() {
        assert_eq!(resolve_smtp_server(None), "smtp.yandex.com");
    }

    #[test]
    fn resolve_smtp_server_uses_provided_value() {
        assert_eq!(
            resolve_smtp_server(Some("smtp.gmail.com".into())),
            "smtp.gmail.com"
        );
    }

    #[test]
    fn resolve_smtp_server_uses_custom_enterprise_server() {
        assert_eq!(
            resolve_smtp_server(Some("mail.company.internal".into())),
            "mail.company.internal"
        );
    }

    // ── resolve_smtp_email ────────────────────────────────────────────────

    #[test]
    fn resolve_smtp_email_uses_fallback_when_none() {
        assert_eq!(resolve_smtp_email(None), "cybersecpro@semihkilic.com");
    }

    #[test]
    fn resolve_smtp_email_uses_provided_value() {
        assert_eq!(
            resolve_smtp_email(Some("noreply@mycompany.com".into())),
            "noreply@mycompany.com"
        );
    }
}
