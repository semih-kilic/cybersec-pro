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
    let logs: Vec<(String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT id, action, category, severity, created_at, resource_type, resource_id FROM audit_logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 50"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let notifications: Vec<_> = logs.iter().map(|(id, action, cat, sev, created, res_type, res_id)| {
        let category = cat.as_deref().unwrap_or("system");
        let severity = sev.as_deref().unwrap_or("info");
        let is_read = severity == "read";
        let resource = res_type.as_deref().unwrap_or("");
        let resource_id_val = res_id.as_deref().unwrap_or("");

        // Generate meaningful notification data
        let (notif_type, title, message, link) = match (category, action.as_str()) {
            (_, a) if a.contains("scan_start") => (
                "system", 
                "Scan Started".to_string(),
                format!("A new scan has been initiated"),
                if !resource_id_val.is_empty() { Some(format!("/dashboard/scans/{}", resource_id_val)) } else { None }
            ),
            (_, a) if a.contains("scan_complete") || a.contains("scan_finish") => (
                "scan_complete",
                "Scan Completed".to_string(),
                format!("Scan finished successfully"),
                if !resource_id_val.is_empty() { Some(format!("/dashboard/scans/{}", resource_id_val)) } else { None }
            ),
            (_, a) if a.contains("scan_fail") => (
                "scan_failed",
                "Scan Failed".to_string(),
                format!("A scan has failed"),
                if !resource_id_val.is_empty() { Some(format!("/dashboard/scans/{}", resource_id_val)) } else { None }
            ),
            ("auth", _) => (
                "system",
                format!("{}", action),
                "Authentication activity detected".to_string(),
                None
            ),
            ("security", _) => (
                "security_alert",
                format!("Security: {}", action),
                "Security event detected".to_string(),
                None
            ),
            _ => (
                "system",
                action.clone(),
                format!("{} activity", category),
                if resource == "scan" && !resource_id_val.is_empty() {
                    Some(format!("/dashboard/scans/{}", resource_id_val))
                } else { None }
            ),
        };

        json!({
            "id": id,
            "type": notif_type,
            "title": title,
            "message": message,
            "category": category,
            "severity": severity,
            "read": is_read,
            "link": link,
            "timestamp": created.as_deref().unwrap_or(""),
            "created_at": created.as_deref().unwrap_or("")
        })
    }).collect();

    let unread_count = notifications.iter().filter(|n| n.get("read") == Some(&json!(false))).count();

    (StatusCode::OK, Json(json!({
        "notifications": notifications,
        "unread_count": unread_count
    }))).into_response()
}

pub async fn read_all_notifications(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    // Mark all audit logs as read for this org (using a "read" flag approach)
    if let Some(org_id) = &auth.org_id {
        let _ = sqlx::query(
            "UPDATE audit_logs SET severity = 'read' WHERE organization_id = $1 AND (severity IS NULL OR severity != 'read')"
        )
        .bind(org_id)
        .execute(&state.db)
        .await;
    }
    Json(json!({"message": "All notifications marked as read", "success": true}))
}

pub async fn read_notification(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(notification_id): Path<String>,
) -> impl IntoResponse {
    let _ = sqlx::query(
        "UPDATE audit_logs SET severity = 'read' WHERE id = $1"
    )
    .bind(&notification_id)
    .execute(&state.db)
    .await;
    Json(json!({"message": "Notification marked as read", "success": true}))
}
