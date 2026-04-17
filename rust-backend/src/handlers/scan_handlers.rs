use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{
        sse::{Event, Sse},
        IntoResponse,
    },
    Json,
};
use futures::stream::Stream;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthUser;
use crate::models::{Scan, Tool};
use crate::scan_engine::executor::{execute_scan, AgentSshInfo};
use crate::services::audit::log_audit;
use crate::AppState;

#[derive(Deserialize)]
pub struct ScanQuery {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
    pub status: Option<String>,
}

// ── List Scans ─────────────────────────────────────────────

pub async fn list_scans(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Query(q): Query<ScanQuery>,
) -> impl IntoResponse {
    let page = q.page.unwrap_or(1).max(1);
    let per_page = q.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    let (scans, total): (Vec<Scan>, i64) = match (&auth.org_id, &q.status) {
        (Some(org_id), Some(status)) => {
            let rows = sqlx::query_as(
                "SELECT * FROM scans WHERE organization_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4"
            )
            .bind(org_id).bind(status).bind(per_page as i64).bind(offset as i64)
            .fetch_all(&state.db).await.unwrap_or_default();
            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND status = $2"
            ).bind(org_id).bind(status).fetch_one(&state.db).await.unwrap_or((0,));
            (rows, count.0)
        }
        (Some(org_id), None) => {
            let rows = sqlx::query_as(
                "SELECT * FROM scans WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
            )
            .bind(org_id).bind(per_page as i64).bind(offset as i64)
            .fetch_all(&state.db).await.unwrap_or_default();
            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM scans WHERE organization_id = $1"
            ).bind(org_id).fetch_one(&state.db).await.unwrap_or((0,));
            (rows, count.0)
        }
        (None, Some(status)) => {
            let rows = sqlx::query_as(
                "SELECT * FROM scans WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4"
            )
            .bind(&auth.user_id).bind(status).bind(per_page as i64).bind(offset as i64)
            .fetch_all(&state.db).await.unwrap_or_default();
            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM scans WHERE user_id = $1 AND status = $2"
            ).bind(&auth.user_id).bind(status).fetch_one(&state.db).await.unwrap_or((0,));
            (rows, count.0)
        }
        (None, None) => {
            let rows = sqlx::query_as(
                "SELECT * FROM scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
            )
            .bind(&auth.user_id).bind(per_page as i64).bind(offset as i64)
            .fetch_all(&state.db).await.unwrap_or_default();
            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM scans WHERE user_id = $1"
            ).bind(&auth.user_id).fetch_one(&state.db).await.unwrap_or((0,));
            (rows, count.0)
        }
    };

    let response: Vec<_> = scans.iter().map(|s| s.to_response()).collect();

    // Enrich with tool names
    let tool_ids: Vec<&str> = scans.iter().map(|s| s.tool_id.as_str()).collect();
    let mut tool_names: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    if !tool_ids.is_empty() {
        let tool_rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT id, name FROM tools WHERE id = ANY($1)"
        )
        .bind(&tool_ids)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();
        for (id, name) in tool_rows {
            tool_names.insert(id, name);
        }
    }

    let enriched: Vec<_> = response.into_iter().zip(scans.iter()).map(|(resp, scan)| {
        let mut val = serde_json::to_value(&resp).unwrap_or(json!({}));
        if let serde_json::Value::Object(ref mut map) = val {
            let tname = tool_names.get(&scan.tool_id).cloned().unwrap_or_default();
            map.insert("tool_name".into(), json!(tname));
        }
        val
    }).collect();

    (StatusCode::OK, Json(json!({
        "scans": enriched,
        "total": total,
        "page": page,
        "per_page": per_page
    }))).into_response()
}

// ── Get Scan ───────────────────────────────────────────────

pub async fn get_scan(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(scan_id): Path<String>,
) -> impl IntoResponse {
    let scan: Option<Scan> = match &auth.org_id {
        Some(org_id) => sqlx::query_as(
            "SELECT * FROM scans WHERE id = $1 AND organization_id = $2"
        )
        .bind(&scan_id)
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None),
        None => sqlx::query_as(
            "SELECT * FROM scans WHERE id = $1 AND user_id = $2"
        )
        .bind(&scan_id)
        .bind(&auth.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None),
    };

    match scan {
        Some(s) => (StatusCode::OK, Json(json!({"scan": s.to_response()}))).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Scan not found"}))).into_response(),
    }
}

// ── Create / Start Scan ────────────────────────────────────

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct StartScanRequest {
    pub tool: Option<String>,
    pub tool_id: Option<String>,
    pub target: String,
    pub parameters: Option<serde_json::Value>,
    pub execution_mode: Option<String>,
    pub agent_id: Option<String>,
    pub project_id: Option<i64>,
}

pub async fn start_scan(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    headers: HeaderMap,
    Json(body): Json<StartScanRequest>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());

    // Rate limit
    if state.rate_limiter.is_limited(&format!("scan:{}", auth.user_id), 5, Duration::from_secs(60)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many scan requests"}))).into_response();
    }

    // Resolve tool by name or ID
    let tool_identifier = body.tool.as_deref()
        .or(body.tool_id.as_deref())
        .unwrap_or("");

    if tool_identifier.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Tool name or ID required"}))).into_response();
    }

    let tool: Option<Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE id = $1 OR name = $2 OR business_name = $3 LIMIT 1"
    )
    .bind(tool_identifier)
    .bind(tool_identifier)
    .bind(tool_identifier)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let tool = match tool {
        Some(t) => t,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": format!("Tool not found: {}", tool_identifier)}))).into_response(),
    };

    // Validate target
    let target = body.target.trim();
    if target.is_empty() || target.len() > 500 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Valid target required"}))).into_response();
    }

    // Block GUI-only tools from scan execution
    if tool.gui_required.unwrap_or(false) {
        return (StatusCode::BAD_REQUEST, Json(json!({
            "error": format!("{} is a GUI-based tool and cannot be run as an automated scan. Please use it directly on the desktop.", tool.name),
            "code": "GUI_TOOL",
            "hint": "Try a CLI-based alternative tool for automated scanning."
        }))).into_response();
    }

    // Check plan access
    let org_plan: Option<(String, Option<String>)> = sqlx::query_as("SELECT plan_type, CAST(created_at AS TEXT) FROM organizations WHERE id = $1")
        .bind(&org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    let plan = org_plan.as_ref().map(|p| p.0.clone()).unwrap_or_else(|| "trial".into());
    let org_created_at = org_plan.as_ref().and_then(|p| p.1.clone());

    // Check plan limits (no tool-level blocking — all tools accessible to all plans)
    let plan_configs = crate::services::plan::get_plan_configs();
    if let Some(config) = plan_configs.get(plan.as_str()) {
        // Check trial expiration
        if config.trial_days > 0 {
            if let Some(ref created) = org_created_at {
                if let Ok(created_dt) = chrono::NaiveDateTime::parse_from_str(
                    created.split('.').next().unwrap_or(created),
                    "%Y-%m-%d %H:%M:%S"
                ) {
                    let now = chrono::Utc::now().naive_utc();
                    let days_since = (now - created_dt).num_days();
                    if days_since > config.trial_days as i64 {
                        return (StatusCode::PAYMENT_REQUIRED, Json(json!({
                            "error": "Trial period expired. Please upgrade to continue scanning.",
                            "code": "TRIAL_EXPIRED",
                            "trial_days": config.trial_days,
                            "days_elapsed": days_since
                        }))).into_response();
                    }
                }
            }
        }

        // Check daily scan limit (trial plan)
        if config.daily_scan_limit > 0 {
            let today_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND created_at::date = CURRENT_DATE"
            )
            .bind(&org_id)
            .fetch_one(&state.db)
            .await
            .unwrap_or((0,));

            if today_count.0 >= config.daily_scan_limit as i64 {
                return (StatusCode::TOO_MANY_REQUESTS, Json(json!({
                    "error": format!("Daily scan limit reached ({}/{}). Upgrade for more scans.", today_count.0, config.daily_scan_limit),
                    "code": "DAILY_LIMIT",
                    "used": today_count.0,
                    "limit": config.daily_scan_limit
                }))).into_response();
            }
        }

        // Check monthly scan limit (paid plans)
        if config.monthly_scan_limit > 0 {
            let month_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)"
            )
            .bind(&org_id)
            .fetch_one(&state.db)
            .await
            .unwrap_or((0,));

            if month_count.0 >= config.monthly_scan_limit as i64 {
                return (StatusCode::TOO_MANY_REQUESTS, Json(json!({
                    "error": format!("Monthly scan limit reached ({}/{}). Upgrade for more scans.", month_count.0, config.monthly_scan_limit),
                    "code": "MONTHLY_LIMIT",
                    "used": month_count.0,
                    "limit": config.monthly_scan_limit
                }))).into_response();
            }
        }

        // Check concurrent scan limit
        if config.concurrent_scans > 0 {
            let running_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND status IN ('running', 'pending')"
            )
            .bind(&org_id)
            .fetch_one(&state.db)
            .await
            .unwrap_or((0,));

            if running_count.0 >= config.concurrent_scans as i64 {
                return (StatusCode::TOO_MANY_REQUESTS, Json(json!({
                    "error": format!("Concurrent scan limit reached ({}/{}). Wait for running scans to complete or upgrade.", running_count.0, config.concurrent_scans),
                    "code": "CONCURRENT_LIMIT",
                    "running": running_count.0,
                    "limit": config.concurrent_scans
                }))).into_response();
            }
        }
    }

    // Create scan record
    let scan_id = Uuid::new_v4().to_string();
    let params_json = body.parameters.as_ref().cloned().unwrap_or(serde_json::json!({}));
    if let Err(e) = sqlx::query(
        "INSERT INTO scans (id, organization_id, user_id, tool_id, target, parameters, status, agent_id, project_id, started_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'running', $7, $8, CURRENT_TIMESTAMP)"
    )
    .bind(&scan_id)
    .bind(&org_id)
    .bind(&auth.user_id)
    .bind(&tool.id)
    .bind(target)
    .bind(&params_json)
    .bind(&body.agent_id)
    .bind(&body.project_id)
    .execute(&state.db)
    .await {
        tracing::error!("Failed to insert scan: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to create scan: {}", e)}))).into_response();
    }

    // Track usage
    let usage_id = Uuid::new_v4().to_string();
    let _ = sqlx::query(
        "INSERT INTO usage_tracking (id, organization_id, tool_id, scan_id) VALUES ($1, $2, $3, $4)"
    )
    .bind(&usage_id)
    .bind(&org_id)
    .bind(&tool.id)
    .bind(&scan_id)
    .execute(&state.db)
    .await;

    log_audit(&state.db, "scan_start", "scan", "info", Some(&auth.user_id), Some(&org_id),
        Some(json!({"tool": tool.name, "target": target})), Some("scan"), Some(&scan_id), "success", Some(&headers)).await;

    // Execute scan asynchronously
    let db = state.db.clone();
    let tool_name = tool.name.clone();
    let command_template = tool.command_template.clone();
    let target_owned = target.to_string();
    let scan_id_clone = scan_id.clone();
    let scan_tx = state.scan_output_tx.clone();

    // Look up agent SSH info for remote execution
    let agent_ssh: Option<AgentSshInfo> = if let Some(ref aid) = body.agent_id {
        let agent_row: Option<(Option<String>, Option<i32>, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT ssh_host, ssh_port, ssh_username, ssh_key_path, ssh_fingerprint FROM agents WHERE id = $1 AND organization_id = $2"
        )
        .bind(aid)
        .bind(&org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
        agent_row.and_then(|(host, port, user, key, fingerprint)| {
            match (host, user) {
                (Some(h), Some(u)) if !h.is_empty() && !u.is_empty() => Some(AgentSshInfo {
                    ssh_host: h,
                    ssh_port: port.unwrap_or(22),
                    ssh_username: u,
                    ssh_key_path: key,
                    ssh_fingerprint: fingerprint,
                }),
                _ => None,
            }
        })
    } else {
        None
    };

    // Update agent status to busy if dispatching remotely
    if agent_ssh.is_some() {
        if let Some(ref aid) = body.agent_id {
            let _ = sqlx::query("UPDATE agents SET status = 'busy', active_scans = COALESCE(active_scans, 0) + 1 WHERE id = $1")
                .bind(aid)
                .execute(&state.db)
                .await;
        }
    }

    let agent_id_for_spawn = body.agent_id.clone();
    let org_id_for_spawn = org_id.clone();
    let user_id_for_spawn = auth.user_id.clone();
    let tool_name_for_notify = tool.name.clone();
    let target_for_notify = target.to_string();

    tokio::spawn(async move {
        let result = execute_scan(&tool_name, &target_owned, command_template.as_deref(), &scan_tx, &scan_id_clone, agent_ssh).await;

        let (status, output, findings, error_log) = match &result {
            Ok(r) => {
                // Check exit code: non-zero means the tool reported an error
                let is_success = r.exit_code == Some(0);
                let has_output = !r.output.trim().is_empty();
                let final_status = if is_success || has_output {
                    "completed".to_string()
                } else {
                    "failed".to_string()
                };
                let err_log = if !is_success {
                    Some(format!("Tool exited with code {:?}", r.exit_code))
                } else {
                    None
                };
                (final_status, r.output.clone(), r.findings.clone(), err_log)
            }
            Err(e) => {
                tracing::error!("Scan {} failed: {}", scan_id_clone, e);
                ("failed".to_string(), String::new(), None, Some(e.to_string()))
            }
        };

        if let Err(e) = sqlx::query(
            "UPDATE scans SET status = $1, output = $2, findings = $3::jsonb, error_log = $4, completed_at = CURRENT_TIMESTAMP WHERE id = $5"
        )
        .bind(&status)
        .bind(&output)
        .bind(&findings)
        .bind(&error_log)
        .bind(&scan_id_clone)
        .execute(&db)
        .await {
            tracing::error!("Failed to update scan {}: {}", scan_id_clone, e);
        }

        // Notify via broadcast
        let _ = scan_tx.send(json!({
            "type": "complete",
            "scan_id": scan_id_clone,
            "status": status
        }).to_string());

        // Notify integrations (Slack, Teams, Webhooks)
        let event_type = if status == "completed" { "scan_completed" } else { "scan_failed" };
        let payload = json!({
            "scan_id": scan_id_clone,
            "tool": tool_name_for_notify,
            "target": target_for_notify,
            "status": status
        });
        crate::services::integrations::notify_integrations(&db, &org_id_for_spawn, event_type, &payload).await;

        // Email notification to user (respects notification_preferences)
        let findings_count = findings.as_ref()
            .and_then(|f| f.get("summary"))
            .and_then(|s| s.get("total"))
            .and_then(|t| t.as_u64())
            .unwrap_or(0) as usize;
        crate::services::notifications::notify_scan_complete(
            &db, &user_id_for_spawn, &scan_id_clone,
            &tool_name_for_notify, &target_for_notify,
            &status, findings_count,
        ).await;

        // Update agent: decrement active_scans, increment total_scans, set status back to online
        if let Some(aid) = agent_id_for_spawn {
            let _ = sqlx::query(
                "UPDATE agents SET active_scans = GREATEST(COALESCE(active_scans, 1) - 1, 0), total_scans = COALESCE(total_scans, 0) + 1, status = CASE WHEN COALESCE(active_scans, 1) - 1 <= 0 THEN 'online' ELSE 'busy' END WHERE id = $1"
            ).bind(&aid).execute(&db).await;
        }
    });

    // Build command string for response
    let (program, args) = crate::scan_engine::tool_registry::build_command(&tool.name, target, tool.command_template.as_deref())
        .unwrap_or_else(|_| (tool.name.clone(), vec![target.to_string()]));
    let command_str = format!("{} {}", program, args.join(" "));

    let exec_mode = if body.agent_id.is_some() { "remote" } else { "local" };

    (StatusCode::CREATED, Json(json!({
        "success": true,
        "message": "Scan started",
        "scan_id": scan_id,
        "command": command_str,
        "status": "running",
        "execution_mode": exec_mode,
        "engine": "rust-axum",
        "scan": {
            "id": scan_id,
            "tool": tool.name,
            "target": target,
            "status": "running"
        }
    }))).into_response()
}

// ── SSE Scan Output Stream ─────────────────────────────────

pub async fn scan_output_stream(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(scan_id): Path<String>,
) -> impl IntoResponse {
    // Verify the scan belongs to this user/org before streaming
    let owns_scan: bool = match &auth.org_id {
        Some(org_id) => sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM scans WHERE id = $1 AND organization_id = $2)"
        )
        .bind(&scan_id)
        .bind(org_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(false),
        None => sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM scans WHERE id = $1 AND user_id = $2)"
        )
        .bind(&scan_id)
        .bind(&auth.user_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(false),
    };

    if !owns_scan {
        return (
            axum::http::StatusCode::FORBIDDEN,
            Json(json!({"error": "Access denied"})),
        )
            .into_response();
    }

    let rx = state.scan_output_tx.subscribe();
    let scan_id_filter = scan_id.clone();

    let stream = BroadcastStream::new(rx)
        .filter_map(move |msg: Result<String, tokio_stream::wrappers::errors::BroadcastStreamRecvError>| {
            match msg {
                Ok(data) => {
                    if data.contains(&scan_id_filter) {
                        Some(Ok::<_, std::convert::Infallible>(Event::default().data(data)))
                    } else {
                        None
                    }
                }
                Err(_) => None,
            }
        });

    Sse::new(stream)
        .keep_alive(
            axum::response::sse::KeepAlive::new()
                .interval(Duration::from_secs(15))
                .text("ping"),
        )
        .into_response()
}

// ── Cancel Scan ────────────────────────────────────────────

pub async fn cancel_scan(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(scan_id): Path<String>,
) -> impl IntoResponse {
    let result = match &auth.org_id {
        Some(org_id) => sqlx::query(
            "UPDATE scans SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2 AND status IN ('pending', 'running')"
        )
        .bind(&scan_id)
        .bind(org_id)
        .execute(&state.db)
        .await,
        None => sqlx::query(
            "UPDATE scans SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'running')"
        )
        .bind(&scan_id)
        .bind(&auth.user_id)
        .execute(&state.db)
        .await,
    };

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(json!({"message": "Scan cancelled"}))).into_response()
        }
        _ => (StatusCode::NOT_FOUND, Json(json!({"error": "Scan not found or already completed"}))).into_response(),
    }
}

// ── Delete Scan ────────────────────────────────────────────

pub async fn delete_scan(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(scan_id): Path<String>,
) -> impl IntoResponse {
    let result = match &auth.org_id {
        Some(org_id) => sqlx::query(
            "DELETE FROM scans WHERE id = $1 AND organization_id = $2"
        )
        .bind(&scan_id)
        .bind(org_id)
        .execute(&state.db)
        .await,
        None => sqlx::query(
            "DELETE FROM scans WHERE id = $1 AND user_id = $2"
        )
        .bind(&scan_id)
        .bind(&auth.user_id)
        .execute(&state.db)
        .await,
    };

    match result {
        Ok(r) if r.rows_affected() > 0 => Json(json!({"message": "Scan deleted"})).into_response(),
        _ => Json(json!({"error": "Scan not found"})).into_response(),
    }
}

// ── POST /api/v1/scans (alternative create endpoint) ──────

pub async fn create_scan(
    state: State<Arc<AppState>>,
    auth: AuthUser,
    headers: HeaderMap,
    body: Json<StartScanRequest>,
) -> impl IntoResponse {
    start_scan(state, auth, headers, body).await
}
