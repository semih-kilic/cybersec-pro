/// CyberSec Pro — Security Handlers
/// Phase 1: Login History, IP Whitelist, Audit Log export, Session management
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthUser;
use crate::AppState;

// ══════════════════════════════════════════════════════════
// LOGIN HISTORY
// ══════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct PaginationQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn get_login_history(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Query(pagination): Query<PaginationQuery>,
) -> impl IntoResponse {
    let limit = pagination.limit.unwrap_or(20).min(100);
    let offset = pagination.offset.unwrap_or(0);

    let rows: Vec<(String, Option<String>, Option<String>, bool, Option<String>, Option<String>, String)> = sqlx::query_as(
        "SELECT id, ip_address, user_agent, success, failure_reason, CAST(created_at AS TEXT), COALESCE(city, '') as city
         FROM login_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
    )
    .bind(&user.user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM login_history WHERE user_id = $1"
    )
    .bind(&user.user_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let history: Vec<serde_json::Value> = rows.iter().map(|(id, ip, ua, success, reason, created, city)| {
        json!({
            "id": id,
            "ip_address": ip,
            "user_agent": ua,
            "success": success,
            "failure_reason": reason,
            "city": city,
            "created_at": created
        })
    }).collect();

    Json(json!({
        "login_history": history,
        "total": total.0,
        "limit": limit,
        "offset": offset
    })).into_response()
}

pub async fn get_active_sessions(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Return recent successful logins (last 30 days) as "active sessions"
    let rows: Vec<(String, Option<String>, Option<String>, String)> = sqlx::query_as(
        "SELECT id, ip_address, user_agent, CAST(created_at AS TEXT)
         FROM login_history
         WHERE user_id = $1 AND success = TRUE AND created_at > NOW() - INTERVAL '30 days'
         ORDER BY created_at DESC LIMIT 10"
    )
    .bind(&user.user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let sessions: Vec<serde_json::Value> = rows.iter().enumerate().map(|(i, (id, ip, ua, created))| {
        json!({
            "id": id,
            "ip_address": ip,
            "user_agent": ua,
            "is_current": i == 0,
            "last_active": created
        })
    }).collect();

    Json(json!({"sessions": sessions})).into_response()
}

// ══════════════════════════════════════════════════════════
// IP WHITELIST
// ══════════════════════════════════════════════════════════

pub async fn list_ip_whitelist(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let rows: Vec<(String, String, Option<String>, bool, String)> = sqlx::query_as(
        "SELECT id, ip_cidr, label, is_active, CAST(created_at AS TEXT)
         FROM ip_whitelist WHERE organization_id = $1 ORDER BY created_at DESC"
    )
    .bind(&org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let whitelist: Vec<serde_json::Value> = rows.iter().map(|(id, cidr, label, active, created)| {
        json!({
            "id": id,
            "ip_cidr": cidr,
            "label": label,
            "is_active": active,
            "created_at": created
        })
    }).collect();

    Json(json!({"ip_whitelist": whitelist, "total": whitelist.len()})).into_response()
}

pub async fn add_ip_whitelist(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let ip_cidr = match body.get("ip_cidr").and_then(|v| v.as_str()) {
        Some(ip) => ip.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "ip_cidr required"}))).into_response(),
    };

    // Basic CIDR/IP validation
    if !validate_ip_cidr(&ip_cidr) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid IP address or CIDR notation"}))).into_response();
    }

    let label = body.get("label").and_then(|v| v.as_str()).map(|s| s.to_string());
    let id = Uuid::new_v4().to_string();

    let result = sqlx::query(
        "INSERT INTO ip_whitelist (id, organization_id, ip_cidr, label, created_by) VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(&id).bind(&org_id).bind(&ip_cidr).bind(&label).bind(&user.user_id)
    .execute(&state.db).await;

    match result {
        Ok(_) => Json(json!({
            "message": "IP added to whitelist",
            "id": id,
            "ip_cidr": ip_cidr,
            "label": label
        })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed: {}", e)}))).into_response(),
    }
}

pub async fn remove_ip_whitelist(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(ip_id): Path<String>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let result = sqlx::query(
        "DELETE FROM ip_whitelist WHERE id = $1 AND organization_id = $2"
    )
    .bind(&ip_id).bind(&org_id)
    .execute(&state.db).await;

    match result {
        Ok(r) if r.rows_affected() > 0 => Json(json!({"message": "IP removed from whitelist"})).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Entry not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed: {}", e)}))).into_response(),
    }
}

/// Validates an IP address (v4/v6) or CIDR notation
fn validate_ip_cidr(input: &str) -> bool {
    // CIDR: split on '/'
    let (ip_part, prefix) = if let Some(pos) = input.find('/') {
        let prefix = &input[pos+1..];
        let prefix_num: u8 = match prefix.parse() {
            Ok(n) => n,
            Err(_) => return false,
        };
        if prefix_num > 128 { return false; } // max IPv6 prefix
        (&input[..pos], Some(prefix_num))
    } else {
        (input, None)
    };

    // Try IPv4
    let is_ipv4 = ip_part.split('.').count() == 4
        && ip_part.split('.').all(|o| o.parse::<u8>().is_ok());
    // Try IPv6
    let is_ipv6 = ip_part.contains(':');

    if is_ipv4 {
        if let Some(p) = prefix { return p <= 32; }
        return true;
    }
    if is_ipv6 {
        if let Some(p) = prefix { return p <= 128; }
        return true;
    }
    false
}

// ══════════════════════════════════════════════════════════
// AUDIT LOG ENDPOINT (for dashboard)
// ══════════════════════════════════════════════════════════

pub async fn get_audit_logs(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Query(pagination): Query<PaginationQuery>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let limit = pagination.limit.unwrap_or(50).min(200);
    let offset = pagination.offset.unwrap_or(0);

    let rows: Vec<(String, Option<String>, String, String, String, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT id, user_id, action, category, severity, status, resource_type, CAST(created_at AS TEXT)
         FROM audit_logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
    )
    .bind(&org_id).bind(limit).bind(offset)
    .fetch_all(&state.db).await.unwrap_or_default();

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM audit_logs WHERE organization_id = $1"
    )
    .bind(&org_id)
    .fetch_one(&state.db).await.unwrap_or((0,));

    let logs: Vec<serde_json::Value> = rows.iter().map(|(id, uid, action, cat, sev, status, rtype, created)| {
        json!({
            "id": id,
            "user_id": uid,
            "action": action,
            "category": cat,
            "severity": sev,
            "status": status,
            "resource_type": rtype,
            "created_at": created
        })
    }).collect();

    Json(json!({
        "audit_logs": logs,
        "total": total.0,
        "limit": limit,
        "offset": offset
    })).into_response()
}

// ══════════════════════════════════════════════════════════
// SCAN TEMPLATES (Phase 3)
// ══════════════════════════════════════════════════════════

pub async fn list_scan_templates(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.clone().unwrap_or_default();

    let rows: Vec<(String, String, Option<String>, Option<String>, bool, i32, String)> = sqlx::query_as(
        "SELECT id, name, description, tool_id, is_public, use_count, CAST(created_at AS TEXT)
         FROM scan_templates
         WHERE organization_id = $1 OR is_public = TRUE
         ORDER BY use_count DESC, created_at DESC"
    )
    .bind(&org_id)
    .fetch_all(&state.db).await.unwrap_or_default();

    let templates: Vec<serde_json::Value> = rows.iter().map(|(id, name, desc, tool_id, public, uses, created)| {
        json!({
            "id": id,
            "name": name,
            "description": desc,
            "tool_id": tool_id,
            "is_public": public,
            "use_count": uses,
            "created_at": created
        })
    }).collect();

    Json(json!({"templates": templates, "total": templates.len()})).into_response()
}

pub async fn create_scan_template(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let name = match body.get("name").and_then(|v| v.as_str()) {
        Some(n) if !n.is_empty() => n.to_string(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Template name required"}))).into_response(),
    };

    let id = Uuid::new_v4().to_string();
    let description = body.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
    let tool_id = body.get("tool_id").and_then(|v| v.as_str()).map(|s| s.to_string());
    let parameters = body.get("parameters").cloned().unwrap_or(json!({}));
    let is_public = body.get("is_public").and_then(|v| v.as_bool()).unwrap_or(false);
    let params_str = parameters.to_string();

    let result = sqlx::query(
        "INSERT INTO scan_templates (id, organization_id, created_by, name, description, tool_id, parameters, is_public)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)"
    )
    .bind(&id).bind(&org_id).bind(&user.user_id).bind(&name)
    .bind(&description).bind(&tool_id).bind(&params_str).bind(is_public)
    .execute(&state.db).await;

    match result {
        Ok(_) => (StatusCode::CREATED, Json(json!({
            "message": "Scan template created",
            "template": {
                "id": id,
                "name": name,
                "description": description,
                "tool_id": tool_id,
                "parameters": parameters,
                "is_public": is_public
            }
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed: {}", e)}))).into_response(),
    }
}

pub async fn delete_scan_template(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(template_id): Path<String>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let result = sqlx::query(
        "DELETE FROM scan_templates WHERE id = $1 AND organization_id = $2 AND created_by = $3"
    )
    .bind(&template_id).bind(&org_id).bind(&user.user_id)
    .execute(&state.db).await;

    match result {
        Ok(r) if r.rows_affected() > 0 => Json(json!({"message": "Template deleted"})).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Template not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed: {}", e)}))).into_response(),
    }
}

// ══════════════════════════════════════════════════════════
// ANALYTICS — Trend + Snapshot (Phase 5)
// ══════════════════════════════════════════════════════════

pub async fn get_analytics_trend(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let days: i64 = params.get("days").and_then(|d| d.parse().ok()).unwrap_or(30);
    let days = days.min(365);

    // Daily scan counts for trend
    let trend: Vec<(String, i64, i64, i64)> = sqlx::query_as(
        "SELECT CAST(DATE(created_at) AS TEXT), COUNT(*) as total,
                SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
         FROM scans WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
         GROUP BY DATE(created_at) ORDER BY DATE(created_at)"
    )
    .bind(&org_id).bind(days)
    .fetch_all(&state.db).await.unwrap_or_default();

    let trend_data: Vec<serde_json::Value> = trend.iter().map(|(date, total, completed, failed)| {
        json!({
            "date": date,
            "total_scans": total,
            "completed": completed,
            "failed": failed,
            "success_rate": if *total > 0 { (*completed as f64 / *total as f64 * 100.0).round() } else { 0.0 }
        })
    }).collect();

    // Risk score over time from snapshots
    let risk_trend: Vec<(String, f64)> = sqlx::query_as(
        "SELECT CAST(snapshot_date AS TEXT), risk_score FROM analytics_snapshots
         WHERE organization_id = $1 AND snapshot_date > NOW() - INTERVAL '1 day' * $2
         ORDER BY snapshot_date"
    )
    .bind(&org_id).bind(days)
    .fetch_all(&state.db).await.unwrap_or_default();

    let risk_data: Vec<serde_json::Value> = risk_trend.iter().map(|(date, score)| {
        json!({"date": date, "risk_score": score})
    }).collect();

    // Anomaly detection: days where scans > avg + 2*stddev
    let avg_scans: (f64,) = sqlx::query_as(
        "SELECT COALESCE(AVG(daily_count), 0) FROM (
            SELECT COUNT(*) as daily_count FROM scans
            WHERE organization_id = $1 GROUP BY DATE(created_at)
         ) sub"
    )
    .bind(&org_id)
    .fetch_one(&state.db).await.unwrap_or((0.0,));

    Json(json!({
        "trend": trend_data,
        "risk_trend": risk_data,
        "anomaly_threshold": avg_scans.0 * 2.5,
        "days": days
    })).into_response()
}

// ══════════════════════════════════════════════════════════
// STRIX AI JOBS (Phase 6)
// ══════════════════════════════════════════════════════════

pub async fn create_cybersec_ai_job(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let target = match body.get("target").and_then(|v| v.as_str()) {
        Some(t) if !t.is_empty() => t.to_string(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Target required (URL or repository)"}))).into_response(),
    };

    let target_type = body.get("target_type").and_then(|v| v.as_str()).unwrap_or("url").to_string();
    let job_type = body.get("job_type").and_then(|v| v.as_str()).unwrap_or("autonomous_pentest").to_string();
    let agents_config = body.get("agents_config").cloned().unwrap_or(json!({
        "recon": true,
        "vuln_scan": true,
        "exploit_verify": true,
        "auto_fix": false
    }));

    let id = Uuid::new_v4().to_string();
    let config_str = agents_config.to_string();

    let result = sqlx::query(
        "INSERT INTO cybersec_ai_jobs (id, organization_id, user_id, target, target_type, job_type, agents_config, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'queued')"
    )
    .bind(&id).bind(&org_id).bind(&user.user_id)
    .bind(&target).bind(&target_type).bind(&job_type).bind(&config_str)
    .execute(&state.db).await;

    match result {
        Ok(_) => {
            // Log audit
            crate::services::audit::log_audit(
                &state.db, "cybersec_ai_job_created", "security", "info",
                Some(&user.user_id), Some(&org_id),
                Some(json!({"target": &target, "job_type": &job_type})),
                Some("cybersec_ai_job"), Some(&id), "success", None
            ).await;

            (StatusCode::CREATED, Json(json!({
                "message": "Strix AI job queued",
                "job": {
                    "id": id,
                    "target": target,
                    "target_type": target_type,
                    "job_type": job_type,
                    "status": "queued",
                    "agents_config": agents_config,
                    "created_at": chrono::Utc::now().to_rfc3339()
                }
            }))).into_response()
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed: {}", e)}))).into_response(),
    }
}

pub async fn list_cybersec_ai_jobs(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let rows: Vec<(String, String, String, String, i32, i32, Option<String>, Option<String>, String)> = sqlx::query_as(
        "SELECT id, target, job_type, status, findings_count, poc_verified_count,
                CAST(started_at AS TEXT), CAST(completed_at AS TEXT), CAST(created_at AS TEXT)
         FROM cybersec_ai_jobs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 50"
    )
    .bind(&org_id)
    .fetch_all(&state.db).await.unwrap_or_default();

    let jobs: Vec<serde_json::Value> = rows.iter().map(|(id, target, jtype, status, findings, poc_verified, started, completed, created)| {
        json!({
            "id": id,
            "target": target,
            "job_type": jtype,
            "status": status,
            "findings_count": findings,
            "poc_verified_count": poc_verified,
            "started_at": started,
            "completed_at": completed,
            "created_at": created
        })
    }).collect();

    Json(json!({"cybersec_ai_jobs": jobs, "total": jobs.len()})).into_response()
}

pub async fn get_cybersec_ai_job(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let row: Option<(String, String, String, String, serde_json::Value, Option<serde_json::Value>, i32, i32, Option<String>)> = sqlx::query_as(
        "SELECT id, target, job_type, status, agents_config, results, findings_count, poc_verified_count, CAST(created_at AS TEXT)
         FROM cybersec_ai_jobs WHERE id = $1 AND organization_id = $2"
    )
    .bind(&job_id).bind(&org_id)
    .fetch_optional(&state.db).await.unwrap_or(None);

    match row {
        Some((id, target, jtype, status, config, results, findings, poc, created)) => {
            Json(json!({
                "id": id,
                "target": target,
                "job_type": jtype,
                "status": status,
                "agents_config": config,
                "results": results,
                "findings_count": findings,
                "poc_verified_count": poc,
                "created_at": created
            })).into_response()
        },
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Job not found"}))).into_response(),
    }
}

pub async fn cancel_cybersec_ai_job(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    // Look up current status (and verify ownership).
    let current: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM cybersec_ai_jobs WHERE id = $1 AND organization_id = $2"
    )
    .bind(&job_id).bind(&org_id)
    .fetch_optional(&state.db).await.unwrap_or(None);

    let Some((status,)) = current else {
        return (StatusCode::NOT_FOUND, Json(json!({"error": "Job not found"}))).into_response();
    };

    let new_status = match status.as_str() {
        "queued" => "cancelled",                 // never started → cancel immediately
        "running" => "cancelling",               // worker will observe and stop
        "cancelling" | "cancelled" | "completed" | "failed" => {
            return (StatusCode::OK, Json(json!({
                "message": "Job already in terminal state",
                "status": status
            }))).into_response();
        }
        _ => "cancelled",
    };

    let updated = sqlx::query(
        "UPDATE cybersec_ai_jobs
         SET status = $3,
             completed_at = CASE WHEN $3 = 'cancelled' THEN NOW() ELSE completed_at END
         WHERE id = $1 AND organization_id = $2"
    )
    .bind(&job_id).bind(&org_id).bind(new_status)
    .execute(&state.db).await;

    match updated {
        Ok(_) => {
            crate::services::audit::log_audit(
                &state.db, "cybersec_ai_job_cancelled", "security", "warning",
                Some(&user.user_id), Some(&org_id),
                Some(json!({"job_id": &job_id, "previous_status": status})),
                Some("cybersec_ai_job"), Some(&job_id), "success", None
            ).await;
            (StatusCode::OK, Json(json!({
                "message": "Cancellation requested",
                "status": new_status
            }))).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed: {}", e)}))).into_response(),
    }
}

/// Hard-delete a CyberSec AI job. Only allowed for jobs in a terminal state
/// (`completed`, `failed`, `cancelled`) — running/queued jobs must be
/// cancelled first to avoid orphaning a worker. Verifies organization
/// ownership before deletion.
pub async fn delete_cybersec_ai_job(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let current: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM cybersec_ai_jobs WHERE id = $1 AND organization_id = $2"
    )
    .bind(&job_id).bind(&org_id)
    .fetch_optional(&state.db).await.unwrap_or(None);

    let Some((status,)) = current else {
        return (StatusCode::NOT_FOUND, Json(json!({"error": "Job not found"}))).into_response();
    };

    if !matches!(status.as_str(), "completed" | "failed" | "cancelled") {
        return (
            StatusCode::CONFLICT,
            Json(json!({
                "error": "Cancel the job before deleting it.",
                "status": status,
            })),
        )
            .into_response();
    }

    let res = sqlx::query("DELETE FROM cybersec_ai_jobs WHERE id = $1 AND organization_id = $2")
        .bind(&job_id).bind(&org_id)
        .execute(&state.db).await;

    match res {
        Ok(r) if r.rows_affected() > 0 => {
            crate::services::audit::log_audit(
                &state.db, "cybersec_ai_job_deleted", "security", "warning",
                Some(&user.user_id), Some(&org_id),
                Some(json!({"job_id": &job_id, "previous_status": status})),
                Some("cybersec_ai_job"), Some(&job_id), "success", None
            ).await;
            (StatusCode::OK, Json(json!({"message": "Job deleted", "id": job_id}))).into_response()
        }
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Job not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed: {}", e)}))).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::validate_ip_cidr;

    #[test]
    fn test_valid_ipv4() {
        assert!(validate_ip_cidr("192.168.1.1"));
        assert!(validate_ip_cidr("10.0.0.0"));
        assert!(validate_ip_cidr("0.0.0.0"));
    }

    #[test]
    fn test_valid_ipv4_cidr() {
        assert!(validate_ip_cidr("192.168.1.0/24"));
        assert!(validate_ip_cidr("10.0.0.0/8"));
        assert!(validate_ip_cidr("0.0.0.0/0"));
        assert!(validate_ip_cidr("192.168.0.1/32"));
    }

    #[test]
    fn test_invalid_ipv4_cidr_too_large() {
        assert!(!validate_ip_cidr("10.0.0.0/33"));
    }

    #[test]
    fn test_valid_ipv6() {
        assert!(validate_ip_cidr("::1"));
        assert!(validate_ip_cidr("2001:db8::1"));
        assert!(validate_ip_cidr("2001:db8::/32"));
    }

    #[test]
    fn test_invalid_inputs() {
        assert!(!validate_ip_cidr("not-an-ip"));
        assert!(!validate_ip_cidr("256.0.0.1"));
        assert!(!validate_ip_cidr("10.0.0.0/abc"));
        assert!(!validate_ip_cidr(""));
    }
}
