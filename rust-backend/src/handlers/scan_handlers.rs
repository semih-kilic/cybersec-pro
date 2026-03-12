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
use crate::scan_engine::executor::execute_scan;
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

    let (filter_col, filter_val) = match &auth.org_id {
        Some(id) => ("organization_id", id.clone()),
        None => ("user_id", auth.user_id.clone()),
    };

    let scans: Vec<Scan> = if let Some(status) = &q.status {
        sqlx::query_as(
            &format!("SELECT * FROM scans WHERE {} = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4", filter_col)
        )
        .bind(&filter_val)
        .bind(status)
        .bind(per_page as i64)
        .bind(offset as i64)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_as(
            &format!("SELECT * FROM scans WHERE {} = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3", filter_col)
        )
        .bind(&filter_val)
        .bind(per_page as i64)
        .bind(offset as i64)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
    };

    let total: (i64,) = sqlx::query_as(
        &format!("SELECT COUNT(*) FROM scans WHERE {} = $1", filter_col)
    )
        .bind(&filter_val)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

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
        "total": total.0,
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

    // Check plan access
    let org_plan: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = $1")
        .bind(&org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    let plan = org_plan.map(|p| p.0).unwrap_or_else(|| "trial".into());
    let tool_plan = tool.plan_required.as_deref().unwrap_or("starter");
    if !crate::services::plan::check_plan_access(&plan, tool_plan) {
        return (StatusCode::PAYMENT_REQUIRED, Json(json!({"error": format!("Plan upgrade required. Need {} plan.", tool_plan)}))).into_response();
    }

    // Check daily scan limit
    let plan_configs = crate::services::plan::get_plan_configs();
    if let Some(config) = plan_configs.get(plan.as_str()) {
        if config.daily_scan_limit > 0 {
            let today_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND created_at::date = CURRENT_DATE"
            )
            .bind(&org_id)
            .fetch_one(&state.db)
            .await
            .unwrap_or((0,));

            if today_count.0 >= config.daily_scan_limit as i64 {
                return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Daily scan limit reached"}))).into_response();
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

    tokio::spawn(async move {
        let result = execute_scan(&tool_name, &target_owned, command_template.as_deref(), &scan_tx, &scan_id_clone).await;

        let (status, output, findings, error_log) = match result {
            Ok(r) => ("completed".to_string(), r.output, r.findings, None),
            Err(e) => ("failed".to_string(), String::new(), None, Some(e.to_string())),
        };

        let findings_str = findings.map(|f| f.to_string());

        let _ = sqlx::query(
            "UPDATE scans SET status = $1, output = $2, findings = $3, error_log = $4, completed_at = CURRENT_TIMESTAMP WHERE id = $5"
        )
        .bind(&status)
        .bind(&output)
        .bind(&findings_str)
        .bind(&error_log)
        .bind(&scan_id_clone)
        .execute(&db)
        .await;

        // Notify via broadcast
        let _ = scan_tx.send(json!({
            "type": "complete",
            "scan_id": scan_id_clone,
            "status": status
        }).to_string());
    });

    // Build command string for response
    let (program, args) = crate::scan_engine::tool_registry::build_command(&tool.name, target, tool.command_template.as_deref())
        .unwrap_or_else(|_| (tool.name.clone(), vec![target.to_string()]));
    let command_str = format!("{} {}", program, args.join(" "));

    (StatusCode::CREATED, Json(json!({
        "success": true,
        "message": "Scan started",
        "scan_id": scan_id,
        "command": command_str,
        "status": "running",
        "execution_mode": "local",
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
    Path(scan_id): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let rx = state.scan_output_tx.subscribe();
    let scan_id_filter = scan_id.clone();

    let stream = BroadcastStream::new(rx)
        .filter_map(move |msg: Result<String, tokio_stream::wrappers::errors::BroadcastStreamRecvError>| {
            match msg {
                Ok(data) => {
                    // Filter messages for this scan
                    if data.contains(&scan_id_filter) {
                        Some(Ok(Event::default().data(data)))
                    } else {
                        None
                    }
                }
                Err(_) => None,
            }
        });

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping")
    )
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
