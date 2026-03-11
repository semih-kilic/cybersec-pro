use axum::http::HeaderMap;
use serde_json::Value as JsonValue;
use sqlx::PgPool;
use uuid::Uuid;

/// Record an audit log entry.
pub async fn log_audit(
    pool: &PgPool,
    action: &str,
    category: &str,
    severity: &str,
    user_id: Option<&str>,
    org_id: Option<&str>,
    details: Option<JsonValue>,
    resource_type: Option<&str>,
    resource_id: Option<&str>,
    status: &str,
    headers: Option<&HeaderMap>,
) {
    let id = Uuid::new_v4().to_string();
    let ip = headers
        .and_then(|h| h.get("x-forwarded-for").or_else(|| h.get("x-real-ip")))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let ua = headers
        .and_then(|h| h.get("user-agent"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.chars().take(500).collect::<String>());
    let details_str = details.map(|d| d.to_string());

    let result = sqlx::query(
        "INSERT INTO audit_logs (id, organization_id, user_id, action, category, severity, ip_address, user_agent, details, resource_type, resource_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)"
    )
    .bind(&id)
    .bind(org_id)
    .bind(user_id)
    .bind(action)
    .bind(category)
    .bind(severity)
    .bind(&ip)
    .bind(&ua)
    .bind(&details_str)
    .bind(resource_type)
    .bind(resource_id)
    .bind(status)
    .execute(pool)
    .await;

    if let Err(e) = result {
        tracing::error!("Audit log error: {}", e);
    }
}
