use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::AppState;

// ── Security Summary (Dashboard) ───────────────────────────

pub async fn security_summary(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    // Total scans
    let total_scans: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM scans WHERE organization_id = ?")
        .bind(org_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    // Active scans
    let active_scans: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM scans WHERE organization_id = ? AND status IN ('running', 'pending')")
        .bind(org_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    // Completed scans
    let completed: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM scans WHERE organization_id = ? AND status = 'completed'")
        .bind(org_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    // Failed scans
    let failed: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM scans WHERE organization_id = ? AND status = 'failed'")
        .bind(org_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    // Active agents
    let active_agents: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM agents WHERE organization_id = ? AND status = 'online'")
        .bind(org_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    // Tools available
    let tools: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools WHERE is_active = 1")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    // Recent scans
    let recent_scans: Vec<(String, String, String, Option<String>)> = sqlx::query_as(
        "SELECT s.id, t.name, s.target, s.status FROM scans s LEFT JOIN tools t ON s.tool_id = t.id WHERE s.organization_id = ? ORDER BY s.created_at DESC LIMIT 5"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let recent: Vec<_> = recent_scans.iter().map(|(id, tool, target, status)| {
        json!({
            "id": id,
            "tool": tool,
            "target": target,
            "status": status.as_deref().unwrap_or("unknown")
        })
    }).collect();

    // Organization plan
    let plan: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = ?")
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    (StatusCode::OK, Json(json!({
        "total_scans": total_scans.0,
        "active_scans": active_scans.0,
        "completed_scans": completed.0,
        "failed_scans": failed.0,
        "active_agents": active_agents.0,
        "tools_available": tools.0,
        "recent_scans": recent,
        "plan_type": plan.map(|p| p.0).unwrap_or_else(|| "trial".into()),
        "risk_score": 0,
        "risk_level": "None"
    }))).into_response()
}

// ── Analytics Overview ─────────────────────────────────────

pub async fn analytics_overview(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    // Scans per day (last 30 days)
    let daily: Vec<(String, i64)> = sqlx::query_as(
        "SELECT date(created_at) as day, COUNT(*) FROM scans WHERE organization_id = ? AND created_at >= date('now', '-30 days') GROUP BY day ORDER BY day"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    // Top tools
    let top_tools: Vec<(String, i64)> = sqlx::query_as(
        "SELECT t.name, COUNT(*) as cnt FROM scans s JOIN tools t ON s.tool_id = t.id WHERE s.organization_id = ? GROUP BY t.name ORDER BY cnt DESC LIMIT 10"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    // Status breakdown
    let status_breakdown: Vec<(Option<String>, i64)> = sqlx::query_as(
        "SELECT status, COUNT(*) FROM scans WHERE organization_id = ? GROUP BY status"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    (StatusCode::OK, Json(json!({
        "daily_scans": daily.iter().map(|(d, c)| json!({"date": d, "count": c})).collect::<Vec<_>>(),
        "top_tools": top_tools.iter().map(|(t, c)| json!({"tool": t, "count": c})).collect::<Vec<_>>(),
        "status_breakdown": status_breakdown.iter().map(|(s, c)| json!({"status": s.as_deref().unwrap_or("unknown"), "count": c})).collect::<Vec<_>>()
    }))).into_response()
}
