//! Scan pipelines — persist and execute an ordered, multi-step set of scans.
//!
//! A pipeline is a saved list of steps ({tool, params}); running one authorizes
//! the target once (same bypass-proof gate as a single scan or a network sweep)
//! and then executes each step **sequentially as a real scan delegated to the
//! scan engine**, reusing the exact helpers the individual-scan and network-sweep
//! paths use. There is no simulation: each step becomes a real `scans` row with
//! live output, and the pipeline run records each step's scan id + final status.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::collections::BTreeMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::handlers::scan_handlers::{
    configured_scan_engine_url, merge_scan_parameters, monitor_scan_engine, redact_secret_params,
    start_scan_on_engine, sweep_form_defaults, ScanEngineMetadata,
};
use crate::middleware::auth_middleware::{AuthUser, WriteUser};
use crate::models::Tool;
use crate::AppState;

#[derive(Deserialize)]
pub struct SavePipelineRequest {
    pub name: String,
    pub description: Option<String>,
    /// Free-form builder definition; must contain a `steps` array of
    /// `{ tool, params }` objects. Stored verbatim as JSONB.
    pub definition: serde_json::Value,
}

#[derive(Deserialize)]
pub struct RunPipelineRequest {
    pub target: String,
    pub authorization: Option<crate::handlers::scan_handlers::ScanAuthorizationBody>,
}

/// One executable step extracted from a stored definition.
struct StepDef {
    tool: String,
    params: Option<serde_json::Value>,
}

fn extract_steps(definition: &serde_json::Value) -> Vec<StepDef> {
    definition
        .get("steps")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|s| {
                    let tool = s.get("tool").and_then(|t| t.as_str())?.trim().to_string();
                    if tool.is_empty() {
                        return None;
                    }
                    Some(StepDef {
                        tool,
                        params: s.get("params").cloned(),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

// ── CRUD ────────────────────────────────────────────────────────────────

/// POST /api/v1/pipelines — create a pipeline.
pub async fn create_pipeline(
    State(state): State<Arc<AppState>>,
    WriteUser(auth): WriteUser,
    Json(body): Json<SavePipelineRequest>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());
    let name = body.name.trim();
    if name.is_empty() || name.len() > 200 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Pipeline name required (max 200 chars)"}))).into_response();
    }
    if extract_steps(&body.definition).is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Pipeline must contain at least one step with a tool"}))).into_response();
    }
    let id = Uuid::new_v4().to_string();
    let res = sqlx::query(
        "INSERT INTO pipelines (id, organization_id, user_id, name, description, definition) \
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
    )
    .bind(&id)
    .bind(&org_id)
    .bind(&auth.user_id)
    .bind(name)
    .bind(&body.description)
    .bind(&body.definition)
    .execute(&state.db)
    .await;
    match res {
        Ok(_) => (StatusCode::CREATED, Json(json!({"id": id, "name": name}))).into_response(),
        Err(e) => {
            tracing::error!("create_pipeline: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Could not save pipeline"}))).into_response()
        }
    }
}

/// GET /api/v1/pipelines — list the org's pipelines.
pub async fn list_pipelines(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());
    let rows: Vec<(String, String, Option<String>, serde_json::Value, Option<String>, Option<String>)> =
        sqlx::query_as(
            "SELECT id, name, description, definition, created_at::text, updated_at::text \
             FROM pipelines WHERE organization_id = $1 ORDER BY updated_at DESC",
        )
        .bind(&org_id)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();
    let pipelines: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|(id, name, description, definition, created_at, updated_at)| {
            json!({
                "id": id, "name": name, "description": description,
                "definition": definition,
                "created_at": created_at,
                "updated_at": updated_at,
            })
        })
        .collect();
    Json(json!({ "pipelines": pipelines })).into_response()
}

/// GET /api/v1/pipelines/:id — one pipeline (org-scoped).
pub async fn get_pipeline(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());
    let row: Option<(String, String, Option<String>, serde_json::Value)> = sqlx::query_as(
        "SELECT id, name, description, definition FROM pipelines WHERE id = $1 AND organization_id = $2",
    )
    .bind(&id)
    .bind(&org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);
    match row {
        Some((id, name, description, definition)) => Json(json!({
            "id": id, "name": name, "description": description, "definition": definition
        })).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Pipeline not found"}))).into_response(),
    }
}

/// PUT /api/v1/pipelines/:id — update a pipeline (org-scoped).
pub async fn update_pipeline(
    State(state): State<Arc<AppState>>,
    WriteUser(auth): WriteUser,
    Path(id): Path<String>,
    Json(body): Json<SavePipelineRequest>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());
    let name = body.name.trim();
    if name.is_empty() || name.len() > 200 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Pipeline name required (max 200 chars)"}))).into_response();
    }
    if extract_steps(&body.definition).is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Pipeline must contain at least one step with a tool"}))).into_response();
    }
    let res = sqlx::query(
        "UPDATE pipelines SET name = $1, description = $2, definition = $3::jsonb, updated_at = NOW() \
         WHERE id = $4 AND organization_id = $5",
    )
    .bind(name)
    .bind(&body.description)
    .bind(&body.definition)
    .bind(&id)
    .bind(&org_id)
    .execute(&state.db)
    .await;
    match res {
        Ok(r) if r.rows_affected() > 0 => Json(json!({"id": id, "updated": true})).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Pipeline not found"}))).into_response(),
        Err(e) => {
            tracing::error!("update_pipeline: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Could not update pipeline"}))).into_response()
        }
    }
}

/// DELETE /api/v1/pipelines/:id — delete a pipeline (org-scoped). Runs cascade.
pub async fn delete_pipeline(
    State(state): State<Arc<AppState>>,
    WriteUser(auth): WriteUser,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());
    let res = sqlx::query("DELETE FROM pipelines WHERE id = $1 AND organization_id = $2")
        .bind(&id)
        .bind(&org_id)
        .execute(&state.db)
        .await;
    match res {
        Ok(r) if r.rows_affected() > 0 => Json(json!({"deleted": true})).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Pipeline not found"}))).into_response(),
        Err(e) => {
            tracing::error!("delete_pipeline: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Could not delete pipeline"}))).into_response()
        }
    }
}

// ── Execution ─────────────────────────────────────────────────────────────

/// POST /api/v1/pipelines/:id/run — authorize the target, create a run record,
/// and execute the steps sequentially in the background.
pub async fn run_pipeline(
    State(state): State<Arc<AppState>>,
    WriteUser(auth): WriteUser,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<RunPipelineRequest>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());

    // Rate limit (same tier as scans).
    if state.rate_limiter.is_limited(&format!("pipeline:{}", auth.user_id), 5, std::time::Duration::from_secs(60)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many pipeline runs"}))).into_response();
    }

    let target = body.target.trim().to_string();
    if target.is_empty() || target.len() > 500 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Valid target required"}))).into_response();
    }
    for ch in [';', '&', '|', '`', '$', '<', '>', '\n', '\r'] {
        if target.contains(ch) {
            return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid target"}))).into_response();
        }
    }

    // Pipeline execution requires the scan engine (the API container ships no
    // scanner tools). Refuse up-front with a clear message rather than failing
    // every step.
    let engine_url = match configured_scan_engine_url() {
        Some(u) => u,
        None => return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({
            "error": "Pipeline execution requires the scan engine, which is not configured.",
            "code": "SCAN_ENGINE_UNAVAILABLE"
        }))).into_response(),
    };

    // Load the pipeline (org-scoped) and its steps.
    let row: Option<(serde_json::Value,)> = sqlx::query_as(
        "SELECT definition FROM pipelines WHERE id = $1 AND organization_id = $2",
    )
    .bind(&id)
    .bind(&org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);
    let definition = match row {
        Some((d,)) => d,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "Pipeline not found"}))).into_response(),
    };
    let steps = extract_steps(&definition);
    if steps.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Pipeline has no runnable steps"}))).into_response();
    }

    // ── Target authorization gate (bypass-proof, same as a single scan) ──
    let authz_confirmation = body.authorization.as_ref().map(|a| {
        crate::services::target_authorization::AuthConfirmation {
            confirmed: a.confirmed,
            scope_statement: a.scope_statement.clone(),
        }
    });
    let authorization_id = match crate::services::target_authorization::authorize_and_check(
        &state.db,
        &org_id,
        &auth.user_id,
        &target,
        authz_confirmation.as_ref(),
        Some(&headers),
    )
    .await
    {
        Ok((authz_id, _, _)) => authz_id,
        Err(e) => return (StatusCode::FORBIDDEN, Json(json!({"error": e}))).into_response(),
    };

    // Create the run record (running) and dispatch the sequential runner.
    let run_id = Uuid::new_v4().to_string();
    let res = sqlx::query(
        "INSERT INTO pipeline_runs (id, pipeline_id, organization_id, user_id, target, status) \
         VALUES ($1, $2, $3, $4, $5, 'running')",
    )
    .bind(&run_id)
    .bind(&id)
    .bind(&org_id)
    .bind(&auth.user_id)
    .bind(&target)
    .execute(&state.db)
    .await;
    if let Err(e) = res {
        tracing::error!("run_pipeline: could not create run: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Could not start pipeline run"}))).into_response();
    }

    let db = state.db.clone();
    let scan_tx = state.scan_output_tx.clone();
    let run_id_spawn = run_id.clone();
    let org_spawn = org_id.clone();
    let user_spawn = auth.user_id.clone();
    tokio::spawn(async move {
        execute_pipeline_run(
            db, scan_tx, run_id_spawn, org_spawn, user_spawn, target, authorization_id, engine_url, steps,
        )
        .await;
    });

    (StatusCode::ACCEPTED, Json(json!({"run_id": run_id, "status": "running"}))).into_response()
}

/// The sequential runner. Runs each step as a real engine-delegated scan and
/// awaits its completion before starting the next, persisting per-step progress.
#[allow(clippy::too_many_arguments)]
async fn execute_pipeline_run(
    db: sqlx::PgPool,
    scan_tx: tokio::sync::broadcast::Sender<String>,
    run_id: String,
    org_id: String,
    user_id: String,
    target: String,
    authorization_id: String,
    engine_url: String,
    steps: Vec<StepDef>,
) {
    let client = reqwest::Client::new();
    let mut results: Vec<serde_json::Value> = Vec::with_capacity(steps.len());
    let mut had_setup_error = false;

    for (idx, step) in steps.iter().enumerate() {
        // Resolve the tool by id or name.
        let tool: Option<Tool> = sqlx::query_as(
            "SELECT * FROM tools WHERE (id = $1 OR name = $2) AND is_active = TRUE LIMIT 1",
        )
        .bind(&step.tool)
        .bind(&step.tool)
        .fetch_optional(&db)
        .await
        .unwrap_or(None);

        let tool = match tool {
            Some(t) => t,
            None => {
                had_setup_error = true;
                results.push(json!({"index": idx, "tool": step.tool, "status": "failed", "error": "tool not found"}));
                persist_step_results(&db, &run_id, &results).await;
                continue;
            }
        };

        // Curated form defaults, then overlay the step's own params.
        let (mut params_map, trusted): (BTreeMap<String, String>, _) = sweep_form_defaults(&tool);
        if let Some(obj) = step.params.as_ref().and_then(|v| v.as_object()) {
            for (k, v) in obj {
                if k == "target" {
                    continue;
                }
                let val = if v.is_null() {
                    String::new()
                } else {
                    v.as_str().map(String::from).unwrap_or_else(|| v.to_string())
                };
                params_map.insert(k.clone(), val.replace(['\n', '\r', '\0'], ""));
            }
        }

        let (program, command_args) = crate::scan_engine::tool_registry::build_command_with_trusted(
            tool.binary_name.as_deref().unwrap_or(&tool.name),
            &target,
            tool.command_template.as_deref(),
            &params_map,
            &trusted,
        )
        .unwrap_or_else(|_| (tool.name.clone(), vec![target.clone()]));

        // Persist a real scan row (secrets redacted); credentials still reach the
        // engine over the wire via `params` below.
        let scan_id = Uuid::new_v4().to_string();
        let params_json = redact_secret_params(
            step.params.as_ref().unwrap_or(&json!({})),
            tool.parameters.as_ref().and_then(|p| p.get("form")),
        );
        let insert = sqlx::query(
            "INSERT INTO scans (id, organization_id, user_id, tool_id, target, parameters, status, scan_phase, authorization_id, started_at) \
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'running', 'initializing', $7, CURRENT_TIMESTAMP)",
        )
        .bind(&scan_id)
        .bind(&org_id)
        .bind(&user_id)
        .bind(&tool.id)
        .bind(&target)
        .bind(&params_json)
        .bind(&authorization_id)
        .execute(&db)
        .await;
        if let Err(e) = insert {
            had_setup_error = true;
            tracing::error!("pipeline run {}: step {} scan insert failed: {}", run_id, idx, e);
            results.push(json!({"index": idx, "tool": tool.name, "status": "failed", "error": "could not create scan"}));
            persist_step_results(&db, &run_id, &results).await;
            continue;
        }

        // Delegate to the scan engine (same path as a single scan / sweep host).
        match start_scan_on_engine(
            &client,
            &engine_url,
            &tool.name,
            &target,
            step.params.clone(),
            Some(program),
            Some(command_args),
        )
        .await
        {
            Ok(remote) => {
                let metadata = ScanEngineMetadata {
                    url: engine_url.clone(),
                    remote_scan_id: remote.scan_id.clone(),
                };
                let merged = merge_scan_parameters(&params_json, &metadata);
                let _ = sqlx::query("UPDATE scans SET parameters = $1::jsonb WHERE id = $2")
                    .bind(&merged)
                    .bind(&scan_id)
                    .execute(&db)
                    .await;

                // Block until this step's scan finalizes, then move to the next.
                monitor_scan_engine(
                    db.clone(),
                    scan_tx.clone(),
                    scan_id.clone(),
                    remote.scan_id,
                    engine_url.clone(),
                    org_id.clone(),
                    user_id.clone(),
                    tool.name.clone(),
                    target.clone(),
                )
                .await;

                let status: Option<String> = sqlx::query_scalar("SELECT status FROM scans WHERE id = $1")
                    .bind(&scan_id)
                    .fetch_optional(&db)
                    .await
                    .ok()
                    .flatten();
                results.push(json!({
                    "index": idx, "tool": tool.name, "scan_id": scan_id,
                    "status": status.unwrap_or_else(|| "completed".to_string())
                }));
            }
            Err(e) => {
                tracing::error!("pipeline run {}: step {} engine dispatch failed: {}", run_id, idx, e);
                let _ = sqlx::query("UPDATE scans SET status = 'failed', error_log = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2")
                    .bind(format!("engine dispatch failed: {e}"))
                    .bind(&scan_id)
                    .execute(&db)
                    .await;
                results.push(json!({"index": idx, "tool": tool.name, "scan_id": scan_id, "status": "failed", "error": "engine dispatch failed"}));
            }
        }
        persist_step_results(&db, &run_id, &results).await;
    }

    // A run is "completed" when every step ran (individual scans may still carry
    // their own failed status); it is "failed" only on a setup error (missing
    // tool, insert failure, engine dispatch failure).
    let any_dispatch_fail = results.iter().any(|r| r.get("status").and_then(|s| s.as_str()) == Some("failed"));
    let final_status = if had_setup_error || any_dispatch_fail { "failed" } else { "completed" };
    let _ = sqlx::query(
        "UPDATE pipeline_runs SET status = $1, step_results = $2::jsonb, finished_at = NOW() WHERE id = $3",
    )
    .bind(final_status)
    .bind(serde_json::Value::Array(results))
    .bind(&run_id)
    .execute(&db)
    .await;
}

async fn persist_step_results(db: &sqlx::PgPool, run_id: &str, results: &[serde_json::Value]) {
    let _ = sqlx::query("UPDATE pipeline_runs SET step_results = $1::jsonb WHERE id = $2")
        .bind(serde_json::Value::Array(results.to_vec()))
        .bind(run_id)
        .execute(db)
        .await;
}

/// GET /api/v1/pipelines/runs/:run_id — run status + per-step results.
pub async fn get_pipeline_run(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(run_id): Path<String>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());
    let row: Option<(String, String, String, String, serde_json::Value, Option<String>, Option<String>, Option<String>)> =
        sqlx::query_as(
            "SELECT id, pipeline_id, target, status, step_results, error, started_at::text, finished_at::text \
             FROM pipeline_runs WHERE id = $1 AND organization_id = $2",
        )
        .bind(&run_id)
        .bind(&org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    match row {
        Some((id, pipeline_id, target, status, step_results, error, started_at, finished_at)) => Json(json!({
            "id": id, "pipeline_id": pipeline_id, "target": target, "status": status,
            "steps": step_results, "error": error,
            "started_at": started_at,
            "finished_at": finished_at,
        })).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Run not found"}))).into_response(),
    }
}

/// GET /api/v1/pipelines/:id/runs — recent runs for a pipeline (org-scoped).
pub async fn list_pipeline_runs(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());
    let rows: Vec<(String, String, serde_json::Value, Option<String>, Option<String>)> =
        sqlx::query_as(
            "SELECT id, status, step_results, started_at::text, finished_at::text \
             FROM pipeline_runs WHERE pipeline_id = $1 AND organization_id = $2 \
             ORDER BY started_at DESC LIMIT 25",
        )
        .bind(&id)
        .bind(&org_id)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();
    let runs: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|(id, status, step_results, started_at, finished_at)| {
            json!({
                "id": id, "status": status, "steps": step_results,
                "started_at": started_at,
                "finished_at": finished_at,
            })
        })
        .collect();
    Json(json!({ "runs": runs })).into_response()
}
