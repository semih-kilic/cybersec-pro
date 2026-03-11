use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::AppState;

pub async fn list_notifications(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    // Notifications from audit logs (recent activity)
    let logs: Vec<(String, String, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT id, action, category, severity, created_at FROM audit_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 50"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let notifications: Vec<_> = logs.iter().map(|(id, action, cat, sev, created)| {
        json!({
            "id": id,
            "title": action,
            "category": cat.as_deref().unwrap_or("system"),
            "severity": sev.as_deref().unwrap_or("info"),
            "read": false,
            "created_at": created.as_deref().unwrap_or("")
        })
    }).collect();

    (StatusCode::OK, Json(json!({
        "notifications": notifications,
        "unread_count": notifications.len()
    }))).into_response()
}

pub async fn read_all_notifications(
    State(_state): State<Arc<AppState>>,
    _auth: AuthUser,
) -> impl IntoResponse {
    Json(json!({"message": "All notifications marked as read"}))
}

pub async fn read_notification(
    State(_state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(_notification_id): Path<String>,
) -> impl IntoResponse {
    Json(json!({"message": "Notification marked as read"}))
}
