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
    let total_scans: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM scans WHERE organization_id = $1")
        .bind(org_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    // Active scans
    let active_scans: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND status IN ('running', 'pending')")
        .bind(org_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    // Completed scans
    let completed: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND status = 'completed'")
        .bind(org_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    // Failed scans
    let failed: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND status = 'failed'")
        .bind(org_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    // Active agents
    let active_agents: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM agents WHERE organization_id = $1 AND status = 'online'")
        .bind(org_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    // Tools available
    let tools: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools WHERE is_active = TRUE")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    // Recent scans
    let recent_scans: Vec<(String, String, String, Option<String>)> = sqlx::query_as(
        "SELECT s.id, t.name, s.target, s.status FROM scans s LEFT JOIN tools t ON s.tool_id = t.id WHERE s.organization_id = $1 ORDER BY s.created_at DESC LIMIT 5"
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
    let plan: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = $1")
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    // Compute open_issues from scan findings
    let mut critical: i64 = 0;
    let mut high: i64 = 0;
    let mut medium: i64 = 0;
    let mut low: i64 = 0;
    let mut info: i64 = 0;

    let findings_rows: Vec<(Option<serde_json::Value>,)> = sqlx::query_as(
        "SELECT findings FROM scans WHERE organization_id = $1 AND findings IS NOT NULL AND status = 'completed' ORDER BY created_at DESC LIMIT 50"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for (findings_opt,) in &findings_rows {
        if let Some(serde_json::Value::Object(map)) = findings_opt {
            if let Some(summary) = map.get("summary") {
                critical += summary.get("critical").and_then(|v| v.as_i64()).unwrap_or(0);
                high += summary.get("high").and_then(|v| v.as_i64()).unwrap_or(0);
                medium += summary.get("medium").and_then(|v| v.as_i64()).unwrap_or(0);
                low += summary.get("low").and_then(|v| v.as_i64()).unwrap_or(0);
            }
        }
    }

    let issues_total = critical + high + medium + low + info;

    // Compute security score: base 100, deduct for issues
    let security_score = if completed.0 == 0 {
        0
    } else {
        let penalty = (critical * 15 + high * 8 + medium * 3 + low * 1).min(100);
        (100 - penalty).max(0)
    };

    let open_issues = json!({
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": low,
        "info": info,
        "total": issues_total
    });

    let risk_level = if security_score >= 80 { "Low" } else if security_score >= 60 { "Medium" } else { "High" };

    (StatusCode::OK, Json(json!({
        "total_scans": total_scans.0,
        "active_scans": active_scans.0,
        "completed_scans": completed.0,
        "failed_scans": failed.0,
        "active_agents": active_agents.0,
        "tools_available": tools.0,
        "recent_scans": recent,
        "plan_type": plan.map(|p| p.0).unwrap_or_else(|| "trial".into()),
        "risk_score": security_score,
        "risk_level": risk_level,
        "security_score": security_score,
        "open_issues": open_issues
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
        "SELECT created_at::date as day, COUNT(*) FROM scans WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '30 days' GROUP BY day ORDER BY day"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    // Top tools
    let top_tools: Vec<(String, i64)> = sqlx::query_as(
        "SELECT t.name, COUNT(*) as cnt FROM scans s JOIN tools t ON s.tool_id = t.id WHERE s.organization_id = $1 GROUP BY t.name ORDER BY cnt DESC LIMIT 10"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    // Status breakdown
    let status_breakdown: Vec<(Option<String>, i64)> = sqlx::query_as(
        "SELECT status, COUNT(*) FROM scans WHERE organization_id = $1 GROUP BY status"
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
