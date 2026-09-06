use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{
        sse::{Event, Sse},
        IntoResponse,
    },
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
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

const SCAN_ENGINE_METADATA_KEY: &str = "_scan_engine";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ScanEngineMetadata {
    url: String,
    remote_scan_id: String,
}

#[derive(Debug, Serialize)]
struct ScanEngineStartRequest {
    tool: String,
    target: String,
    params: Option<JsonValue>,
    program: Option<String>,
    command_args: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct ScanEngineStartResponse {
    scan_id: String,
}

#[derive(Debug, Deserialize)]
struct ScanEngineStatusResponse {
    status: String,
    exit_code: Option<i32>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ScanEngineOutputResponse {
    output: Vec<String>,
}



/// gRPC endpoint for scan engine (port = SCAN_ENGINE_PORT + 1, default 5003)
fn configured_grpc_url() -> Option<String> {
    // Allow explicit GRPC_SCAN_ENGINE_URL override
    if let Ok(url) = std::env::var("GRPC_SCAN_ENGINE_URL") {
        let trimmed = url.trim().trim_end_matches('/').to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }
    // Derive from SCAN_ENGINE_URL: change port to +1
    std::env::var("SCAN_ENGINE_URL")
        .ok()
        .map(|value| {
            let base = value.trim().trim_end_matches('/').to_string();
            // Replace port: http://host:5002 → http://host:5003
            if let Some(pos) = base.rfind(':') {
                if let Ok(port) = base[pos+1..].parse::<u16>() {
                    return format!("{}:{}", &base[..pos], port + 1);
                }
            }
            format!("{}:5003", base)
        })
        .filter(|value| !value.is_empty())
}

/// Create a gRPC client to the scan engine
async fn grpc_client() -> anyhow::Result<crate::grpc_client::ScanEngineGrpcClient> {
    let url = configured_grpc_url()
        .ok_or_else(|| anyhow::anyhow!("no scan engine URL configured"))?;
    crate::grpc_client::ScanEngineGrpcClient::connect(&url).await
        .map_err(|e| anyhow::anyhow!("gRPC connect failed: {}", e))
}

fn configured_scan_engine_url() -> Option<String> {
    std::env::var("SCAN_ENGINE_URL")
        .ok()
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
}

/// Redact secret-valued fields before scan parameters are persisted.
///
/// Per-scan credentials (passwords, API keys, tokens) are forwarded to the
/// executor in the command argv and the scan-engine request, but MUST NOT be
/// written to the DB: the privacy contract (CLAUDE.md §12, the /dashboard/privacy
/// page) is that they live only in memory for the duration of the run. A field
/// is treated as secret when the tool's form marks it `type: "password"` or its
/// key name matches the credential pattern (`pass|passwd|pwd|secret|token|
/// api[_-]?key|credential`). Redacted values become the string "***redacted***"
/// so the parameter set still round-trips for display and diffing.
fn redact_secret_params(params: &JsonValue, tool_form: Option<&JsonValue>) -> JsonValue {
    let secret_names: std::collections::HashSet<String> = tool_form
        .and_then(|f| f.as_array())
        .map(|form| {
            form.iter()
                .filter(|field| field.get("type").and_then(|t| t.as_str()) == Some("password"))
                .filter_map(|field| field.get("name").and_then(|n| n.as_str()))
                .map(|n| n.to_lowercase())
                .collect()
        })
        .unwrap_or_default();

    // Compiled once per call; the key set is tiny so this is not a hot path.
    let secret_re = regex::Regex::new(r"(?i)(pass|passwd|pwd|secret|token|api[_-]?key|credential)")
        .expect("static secret regex is valid");

    match params {
        JsonValue::Object(map) => {
            let mut out = serde_json::Map::with_capacity(map.len());
            for (k, v) in map {
                let is_secret = !v.is_null()
                    && (secret_names.contains(&k.to_lowercase()) || secret_re.is_match(k));
                if is_secret {
                    out.insert(k.clone(), JsonValue::String("***redacted***".to_string()));
                } else {
                    out.insert(k.clone(), v.clone());
                }
            }
            JsonValue::Object(out)
        }
        other => other.clone(),
    }
}

fn merge_scan_parameters(base: &JsonValue, metadata: &ScanEngineMetadata) -> JsonValue {
    let mut merged = match base {
        JsonValue::Object(map) => JsonValue::Object(map.clone()),
        JsonValue::Null => JsonValue::Object(serde_json::Map::new()),
        other => json!({ "_request": other.clone() }),
    };

    if let JsonValue::Object(ref mut map) = merged {
        map.insert(
            SCAN_ENGINE_METADATA_KEY.to_string(),
            serde_json::to_value(metadata).unwrap_or_else(|_| json!({})),
        );
    }

    merged
}

fn extract_scan_engine_metadata(parameters: &Option<JsonValue>) -> Option<ScanEngineMetadata> {
    parameters
        .as_ref()?
        .get(SCAN_ENGINE_METADATA_KEY)
        .cloned()
        .and_then(|value| serde_json::from_value(value).ok())
}

fn normalize_scan_engine_status(status: &str) -> &str {
    match status {
        "queued" => "pending",
        other => other,
    }
}

async fn start_scan_on_engine(
    client: &reqwest::Client,
    engine_url: &str,
    tool: &str,
    target: &str,
    params: Option<JsonValue>,
    program: Option<String>,
    command_args: Option<Vec<String>>,
) -> anyhow::Result<ScanEngineStartResponse> {
    // Mint a short-lived service token so the engine can authenticate us.
    // The engine validates JWT with the same JWT_SECRET_KEY (shared via env_file).
    let engine_token = crate::services::auth::jwt::create_access_token(
        &std::env::var("JWT_SECRET_KEY").unwrap_or_default(),
        "scan-engine",
        None,
        "service",
    )?;

    let response = client
        .post(format!("{}/api/v3/scan", engine_url))
        .bearer_auth(&engine_token)
        .json(&ScanEngineStartRequest {
            tool: tool.to_string(),
            target: target.to_string(),
            params,
            program,
            command_args,
        })
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!(
            "scan-engine start failed with {}: {}",
            status,
            body
        ));
    }

    Ok(response.json::<ScanEngineStartResponse>().await?)
}

async fn fetch_scan_engine_status(
    client: &reqwest::Client,
    engine_url: &str,
    remote_scan_id: &str,
) -> anyhow::Result<ScanEngineStatusResponse> {
    let engine_token = crate::services::auth::jwt::create_access_token(
        &std::env::var("JWT_SECRET_KEY").unwrap_or_default(),
        "scan-engine",
        None,
        "service",
    )?;

    let response = client
        .get(format!("{}/api/v3/scan/{}/status", engine_url, remote_scan_id))
        .bearer_auth(&engine_token)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!(
            "scan-engine status failed with {}: {}",
            status,
            body
        ));
    }

    Ok(response.json::<ScanEngineStatusResponse>().await?)
}

async fn fetch_scan_engine_output(
    client: &reqwest::Client,
    engine_url: &str,
    remote_scan_id: &str,
) -> anyhow::Result<Vec<String>> {
    let engine_token = crate::services::auth::jwt::create_access_token(
        &std::env::var("JWT_SECRET_KEY").unwrap_or_default(),
        "scan-engine",
        None,
        "service",
    )?;

    let response = client
        .get(format!("{}/api/v3/scan/{}/output", engine_url, remote_scan_id))
        .bearer_auth(&engine_token)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!(
            "scan-engine output failed with {}: {}",
            status,
            body
        ));
    }

    Ok(response.json::<ScanEngineOutputResponse>().await?.output)
}

async fn cancel_scan_on_engine(
    client: &reqwest::Client,
    engine_url: &str,
    remote_scan_id: &str,
) -> anyhow::Result<()> {
    let engine_token = crate::services::auth::jwt::create_access_token(
        &std::env::var("JWT_SECRET_KEY").unwrap_or_default(),
        "scan-engine",
        None,
        "service",
    )?;

    let response = client
        .post(format!("{}/api/v3/scan/{}/cancel", engine_url, remote_scan_id))
        .bearer_auth(&engine_token)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!(
            "scan-engine cancel failed with {}: {}",
            status,
            body
        ));
    }

    Ok(())
}



/// Start scan via gRPC (replaces HTTP POST /api/v3/scan)
async fn start_scan_on_engine_grpc(
    tool: &str,
    target: &str,
    params: Option<JsonValue>,
    program: Option<String>,
    command_args: Option<Vec<String>>,
) -> anyhow::Result<ScanEngineStartResponse> {
    let mut client = grpc_client().await?;
    let resp = client.start_scan(tool, target, params, program, command_args).await
        .map_err(|e| anyhow::anyhow!("gRPC StartScan failed: {}", e))?;
    Ok(ScanEngineStartResponse {
        scan_id: resp.scan_id,
    })
}

/// Get status via gRPC
async fn fetch_scan_engine_status_grpc(
    remote_scan_id: &str,
) -> anyhow::Result<ScanEngineStatusResponse> {
    let mut client = grpc_client().await?;
    let resp = client.get_status(remote_scan_id).await
        .map_err(|e| anyhow::anyhow!("gRPC GetStatus failed: {}", e))?;
    Ok(ScanEngineStatusResponse {
        status: normalize_scan_engine_status(&resp.status).to_string(),
        exit_code: if resp.exit_code == 0 { None } else { Some(resp.exit_code) },
        error: if resp.error.is_empty() { None } else { Some(resp.error) },
    })
}

/// Get output via gRPC
async fn fetch_scan_engine_output_grpc(
    remote_scan_id: &str,
) -> anyhow::Result<Vec<String>> {
    let mut client = grpc_client().await?;
    let resp = client.get_output(remote_scan_id).await
        .map_err(|e| anyhow::anyhow!("gRPC GetOutput failed: {}", e))?;
    Ok(resp.output)
}

/// Cancel scan via gRPC
async fn cancel_scan_on_engine_grpc(
    remote_scan_id: &str,
) -> anyhow::Result<()> {
    let mut client = grpc_client().await?;
    client.cancel(remote_scan_id).await
        .map_err(|e| anyhow::anyhow!("gRPC Cancel failed: {}", e))?;
    Ok(())
}

async fn persist_scan_output(db: &sqlx::PgPool, scan_id: &str, output_lines: &[String]) {
    let joined_output = output_lines.join("\n");
    let line_count = output_lines.len() as i64;
    if let Err(error) = sqlx::query(
        "UPDATE scans SET output = $1, last_output_at = NOW(), total_output_lines = $2 WHERE id = $3"
    )
    .bind(&joined_output)
    .bind(line_count)
    .bind(scan_id)
    .execute(db)
    .await
    {
        tracing::warn!("Failed to persist output for scan {}: {}", scan_id, error);
    }
}


/// Emit a scan phase change via SSE broadcast and update DB
fn emit_phase_change(
    tx: &tokio::sync::broadcast::Sender<String>,
    db: &sqlx::PgPool,
    scan_id: &str,
    phase: &str,
    message: &str,
) {
    let phase_num = match phase {
        "initializing" => 1,
        "resolving_target" => 2,
        "preparing_tool" => 3,
        "executing" => 4,
        "parsing_output" => 5,
        "saving_results" => 6,
        "completed" => 7,
        _ => 0,
    };
    let progress = if phase == "completed" { 100 } else { phase_num * 15 };

    // Broadcast SSE event
    let _ = tx.send(json!({
        "type": "phase_change",
        "scan_id": scan_id,
        "phase": phase,
        "phase_num": phase_num,
        "message": message,
        "progress": progress
    }).to_string());

    // Update DB
    let _ = sqlx::query(
        "UPDATE scans SET scan_phase = $1, phase_started_at = NOW() WHERE id = $2"
    )
    .bind(phase)
    .bind(scan_id)
    .execute(db);
}

async fn finalize_scan(
    db: &sqlx::PgPool,
    scan_tx: &tokio::sync::broadcast::Sender<String>,
    scan_id: &str,
    status: &str,
    output: &str,
    findings: Option<JsonValue>,
    error_log: Option<String>,
    org_id: &str,
    user_id: &str,
    tool_name: &str,
    target: &str,
    agent_id: Option<String>,
) {
    // Phase: parsing_output (scan complete, now parsing)
    emit_phase_change(scan_tx, db, scan_id, "parsing_output", "Scan complete. Parsing output and extracting findings");

    // Phase: saving_results
    emit_phase_change(scan_tx, db, scan_id, "saving_results", "Saving findings to database and generating reports");

    if let Err(error) = sqlx::query(
        "UPDATE scans SET status = $1, output = $2, findings = $3::jsonb, error_log = $4, completed_at = CURRENT_TIMESTAMP, scan_phase = $5 \
         WHERE id = $6 AND status IN ('pending', 'running')",
    )
    .bind(status)
    .bind(output)
    .bind(&findings)
    .bind(&error_log)
    .bind(status)
    .bind(scan_id)
    .execute(db)
    .await
    {
        tracing::error!("Failed to update scan {}: {}", scan_id, error);
    }

    let _ = scan_tx.send(json!({
        "type": "phase_change",
        "scan_id": scan_id,
        "phase": "completed",
        "status": status,
        "progress": 100
    }).to_string());
    let _ = scan_tx.send(json!({
        "type": "complete",
        "scan_id": scan_id,
        "status": status
    }).to_string());

    let event_type = if status == "completed" {
        "scan_completed"
    } else {
        "scan_failed"
    };
    let payload = json!({
        "scan_id": scan_id,
        "tool": tool_name,
        "target": target,
        "status": status
    });
    crate::services::integrations::notify_integrations(db, org_id, event_type, &payload).await;

    let findings_count = findings
        .as_ref()
        .and_then(|value| value.get("summary"))
        .and_then(|value| value.get("total"))
        .and_then(|value| value.as_u64())
        .unwrap_or(0) as usize;
    crate::services::notifications::notify_scan_complete(
        db,
        user_id,
        scan_id,
        tool_name,
        target,
        status,
        findings_count,
    )
    .await;

    if let Some(agent_id) = agent_id {
        let _ = sqlx::query(
            "UPDATE agents SET active_scans = GREATEST(COALESCE(active_scans, 1) - 1, 0), total_scans = COALESCE(total_scans, 0) + 1, status = CASE WHEN COALESCE(active_scans, 1) - 1 <= 0 THEN 'online' ELSE 'busy' END WHERE id = $1",
        )
        .bind(&agent_id)
        .execute(db)
        .await;
    }
}

async fn monitor_scan_engine(
    db: sqlx::PgPool,
    scan_tx: tokio::sync::broadcast::Sender<String>,
    backend_scan_id: String,
    remote_scan_id: String,
    engine_url: String,
    org_id: String,
    user_id: String,
    tool_name: String,
    target: String,
) {
    let client = reqwest::Client::new(); // kept as fallback
    let mut latest_output: Vec<String> = Vec::new();
    let mut streamed_lines = 0usize;
    let mut status_failures = 0u8;
    let mut heartbeat_counter: u32 = 0;

    loop {
        match { match fetch_scan_engine_output_grpc(&remote_scan_id).await { Ok(v) => Ok(v), Err(_) => fetch_scan_engine_output(&client, &engine_url, &remote_scan_id).await } } {
            Ok(output_lines) => {
                latest_output = output_lines;
                if streamed_lines < latest_output.len() {
                    for line in latest_output.iter().skip(streamed_lines) {
                        let _ = scan_tx.send(json!({
                            "type": "output",
                            "scan_id": backend_scan_id,
                            "line": line,
                            "data": line,
                            "execution_mode": "delegated"
                        }).to_string());
                    }
                    streamed_lines = latest_output.len();
                }
                persist_scan_output(&db, &backend_scan_id, &latest_output).await;
            }
            Err(error) => {
                tracing::warn!(
                    "Failed to fetch scan-engine output for {}: {}",
                    backend_scan_id,
                    error
                );
            }
        }

        let remote_status = match { match fetch_scan_engine_status_grpc(&remote_scan_id).await { Ok(v) => Ok(v), Err(_) => fetch_scan_engine_status(&client, &engine_url, &remote_scan_id).await } } {
            Ok(status) => {
                status_failures = 0;
                status
            }
            Err(error) => {
                status_failures += 1;
                tracing::warn!(
                    "Failed to fetch scan-engine status for {}: {}",
                    backend_scan_id,
                    error
                );

                if status_failures >= 3 {
                    finalize_scan(
                        &db,
                        &scan_tx,
                        &backend_scan_id,
                        "failed",
                        &latest_output.join("\n"),
                        None,
                        Some(format!("Scan engine status polling failed: {}", error)),
                        &org_id,
                        &user_id,
                        &tool_name,
                        &target,
                        None,
                    )
                    .await;
                    break;
                }

                tokio::time::sleep(Duration::from_secs(2)).await;
                continue;
            }
        };

        let normalized_status = normalize_scan_engine_status(&remote_status.status).to_string();
        let joined_output = latest_output.join("\n");

        if normalized_status == "pending" || normalized_status == "running" {
            if let Err(error) = sqlx::query(
                "UPDATE scans SET status = $1, output = $2, error_log = $3 WHERE id = $4",
            )
            .bind(&normalized_status)
            .bind(&joined_output)
            .bind(&remote_status.error)
            .bind(&backend_scan_id)
            .execute(&db)
            .await
            {
                tracing::warn!("Failed to refresh delegated scan {}: {}", backend_scan_id, error);
            }

            heartbeat_counter += 1;
            if heartbeat_counter % 5 == 0 {
                let elapsed_secs = heartbeat_counter * 2;
                let _ = scan_tx.send(serde_json::json!({
                    "type": "heartbeat",
                    "scan_id": backend_scan_id,
                    "line": format!("⏳ Scan in progress... ({}s elapsed)", elapsed_secs),
                    "data": format!("⏳ Scan in progress... ({}s elapsed)", elapsed_secs),
                    "execution_mode": "delegated",
                    "heartbeat": true
                }).to_string());
            }

            tokio::time::sleep(Duration::from_secs(2)).await;
            continue;
        }

        let final_error = remote_status.error.clone().or_else(|| {
            if normalized_status == "failed" {
                Some(format!("Tool exited with code {:?}", remote_status.exit_code))
            } else {
                None
            }
        });

        finalize_scan(
            &db,
            &scan_tx,
            &backend_scan_id,
            &normalized_status,
            &joined_output,
            None,
            final_error,
            &org_id,
            &user_id,
            &tool_name,
            &target,
            None,
        )
        .await;
        break;
    }
}

#[cfg(test)]
mod tests {
    use super::{
        configured_scan_engine_url, extract_scan_engine_metadata, merge_scan_parameters,
        normalize_scan_engine_status, ScanEngineMetadata,
    };
    use serde_json::json;
    use std::sync::Mutex;

    /// Serialize tests that mutate the SCAN_ENGINE_URL env var so they don't
    /// race against each other under the default multi-threaded test runner.
    static ENV_GUARD: Mutex<()> = Mutex::new(());

    #[test]
    fn merge_scan_parameters_preserves_existing_fields() {
        let metadata = ScanEngineMetadata {
            url: "http://scan-engine:5002".to_string(),
            remote_scan_id: "remote-1".to_string(),
        };

        let merged = merge_scan_parameters(&json!({"depth": "quick"}), &metadata);

        assert_eq!(merged.get("depth"), Some(&json!("quick")));
        assert_eq!(
            merged.get("_scan_engine").and_then(|value| value.get("remote_scan_id")),
            Some(&json!("remote-1"))
        );
    }

    #[test]
    fn extract_scan_engine_metadata_reads_reserved_block() {
        let parameters = Some(json!({
            "depth": "quick",
            "_scan_engine": {
                "url": "http://scan-engine:5002",
                "remote_scan_id": "remote-2"
            }
        }));

        let metadata = extract_scan_engine_metadata(&parameters).expect("metadata should exist");

        assert_eq!(metadata.url, "http://scan-engine:5002");
        assert_eq!(metadata.remote_scan_id, "remote-2");
    }

    // ── normalize_scan_engine_status ──────────────────────

    #[test]
    fn normalize_scan_engine_status_maps_queued_to_pending() {
        assert_eq!(normalize_scan_engine_status("queued"), "pending");
    }

    #[test]
    fn normalize_scan_engine_status_passthrough_for_known_values() {
        assert_eq!(normalize_scan_engine_status("running"), "running");
        assert_eq!(normalize_scan_engine_status("completed"), "completed");
        assert_eq!(normalize_scan_engine_status("failed"), "failed");
        assert_eq!(normalize_scan_engine_status("cancelled"), "cancelled");
        assert_eq!(normalize_scan_engine_status("pending"), "pending");
    }

    #[test]
    fn normalize_scan_engine_status_passthrough_for_unknown_values() {
        assert_eq!(normalize_scan_engine_status("unknown_state"), "unknown_state");
        assert_eq!(normalize_scan_engine_status(""), "");
    }

    // ── configured_scan_engine_url ────────────────────────

    #[test]
    fn configured_scan_engine_url_returns_none_when_env_unset() {
        let _g = ENV_GUARD.lock().unwrap_or_else(|p| p.into_inner());
        std::env::remove_var("SCAN_ENGINE_URL");
        assert!(configured_scan_engine_url().is_none());
    }

    #[test]
    fn configured_scan_engine_url_returns_none_for_empty_string() {
        let _g = ENV_GUARD.lock().unwrap_or_else(|p| p.into_inner());
        std::env::set_var("SCAN_ENGINE_URL", "");
        assert!(configured_scan_engine_url().is_none());
        std::env::remove_var("SCAN_ENGINE_URL");
    }

    #[test]
    fn configured_scan_engine_url_trims_trailing_slash() {
        let _g = ENV_GUARD.lock().unwrap_or_else(|p| p.into_inner());
        std::env::set_var("SCAN_ENGINE_URL", "http://scan-engine:5002/");
        let url = configured_scan_engine_url();
        assert_eq!(url.as_deref(), Some("http://scan-engine:5002"));
        std::env::remove_var("SCAN_ENGINE_URL");
    }

    #[test]
    fn configured_scan_engine_url_trims_multiple_trailing_slashes() {
        let _g = ENV_GUARD.lock().unwrap_or_else(|p| p.into_inner());
        std::env::set_var("SCAN_ENGINE_URL", "http://scan-engine:5002///");
        let url = configured_scan_engine_url();
        assert_eq!(url.as_deref(), Some("http://scan-engine:5002"));
        std::env::remove_var("SCAN_ENGINE_URL");
    }

    #[test]
    fn configured_scan_engine_url_preserves_valid_url() {
        let _g = ENV_GUARD.lock().unwrap_or_else(|p| p.into_inner());
        std::env::set_var("SCAN_ENGINE_URL", "http://scan-engine:5002");
        let url = configured_scan_engine_url();
        assert_eq!(url.as_deref(), Some("http://scan-engine:5002"));
        std::env::remove_var("SCAN_ENGINE_URL");
    }

    #[test]
    fn configured_scan_engine_url_trims_whitespace() {
        let _g = ENV_GUARD.lock().unwrap_or_else(|p| p.into_inner());
        std::env::set_var("SCAN_ENGINE_URL", "  http://scan-engine:5002  ");
        let url = configured_scan_engine_url();
        assert_eq!(url.as_deref(), Some("http://scan-engine:5002"));
        std::env::remove_var("SCAN_ENGINE_URL");
    }

    // ── merge_scan_parameters edge cases ─────────────────

    #[test]
    fn merge_scan_parameters_handles_null_base() {
        let metadata = ScanEngineMetadata {
            url: "http://engine:5002".to_string(),
            remote_scan_id: "r-3".to_string(),
        };
        let merged = merge_scan_parameters(&json!(null), &metadata);
        assert!(merged.get("_scan_engine").is_some());
    }

    #[test]
    fn merge_scan_parameters_handles_empty_object_base() {
        let metadata = ScanEngineMetadata {
            url: "http://engine:5002".to_string(),
            remote_scan_id: "r-4".to_string(),
        };
        let merged = merge_scan_parameters(&json!({}), &metadata);
        let engine_block = merged.get("_scan_engine").expect("_scan_engine must be present");
        assert_eq!(engine_block.get("url").and_then(|u| u.as_str()), Some("http://engine:5002"));
        assert_eq!(engine_block.get("remote_scan_id").and_then(|id| id.as_str()), Some("r-4"));
    }

    #[test]
    fn merge_scan_parameters_non_object_base_wrapped() {
        let metadata = ScanEngineMetadata {
            url: "http://engine:5002".to_string(),
            remote_scan_id: "r-5".to_string(),
        };
        // A scalar value as base should be wrapped and _scan_engine injected
        let merged = merge_scan_parameters(&json!("just_a_string"), &metadata);
        assert!(merged.get("_scan_engine").is_some(), "_scan_engine must be injected");
    }

    // ── extract_scan_engine_metadata edge cases ───────────

    #[test]
    fn extract_scan_engine_metadata_returns_none_when_absent() {
        let parameters = Some(json!({"depth": "quick"}));
        assert!(extract_scan_engine_metadata(&parameters).is_none());
    }

    #[test]
    fn extract_scan_engine_metadata_returns_none_for_none_input() {
        assert!(extract_scan_engine_metadata(&None).is_none());
    }

    #[test]
    fn extract_scan_engine_metadata_returns_none_for_malformed_block() {
        // _scan_engine present but missing required fields -> deserialize fails -> None
        let parameters = Some(json!({
            "_scan_engine": { "bad_field": true }
        }));
        assert!(extract_scan_engine_metadata(&parameters).is_none());
    }

    // ── engine URL construction ───────────────────────────

    #[test]
    fn scan_engine_api_path_format_is_correct() {
        let engine_url = "http://scan-engine:5002";
        let scan_id = "abc-123";
        assert_eq!(format!("{}/api/v3/scan", engine_url), "http://scan-engine:5002/api/v3/scan");
        assert_eq!(format!("{}/api/v3/scan/{}/status", engine_url, scan_id), "http://scan-engine:5002/api/v3/scan/abc-123/status");
        assert_eq!(format!("{}/api/v3/scan/{}/output", engine_url, scan_id), "http://scan-engine:5002/api/v3/scan/abc-123/output");
        assert_eq!(format!("{}/api/v3/scan/{}/cancel", engine_url, scan_id), "http://scan-engine:5002/api/v3/scan/abc-123/cancel");
    }
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
                "SELECT id, organization_id, user_id, tool_id, target, parameters, status, agent_id, project_id, NULL::TEXT AS output, error_log, NULL::JSONB AS findings, report_path, started_at, completed_at, created_at FROM scans WHERE organization_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4"
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
                "SELECT id, organization_id, user_id, tool_id, target, parameters, status, agent_id, project_id, NULL::TEXT AS output, error_log, NULL::JSONB AS findings, report_path, started_at, completed_at, created_at FROM scans WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
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
                "SELECT id, organization_id, user_id, tool_id, target, parameters, status, agent_id, project_id, NULL::TEXT AS output, error_log, NULL::JSONB AS findings, report_path, started_at, completed_at, created_at FROM scans WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4"
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
                "SELECT id, organization_id, user_id, tool_id, target, parameters, status, agent_id, project_id, NULL::TEXT AS output, error_log, NULL::JSONB AS findings, report_path, started_at, completed_at, created_at FROM scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
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
    let Some(mut scan): Option<Scan> = (match &auth.org_id {
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
    }) else {
        return (StatusCode::NOT_FOUND, Json(json!({"error": "Scan not found"}))).into_response();
    };

    if let Some(metadata) = extract_scan_engine_metadata(&scan.parameters) {
        let current_status = scan.status.clone().unwrap_or_else(|| "pending".to_string());
        if current_status == "pending" || current_status == "running" {
            let client = reqwest::Client::new(); // kept as fallback
            match fetch_scan_engine_status(&client, &metadata.url, &metadata.remote_scan_id).await {
                Ok(remote_status) => {
                    let normalized_status = normalize_scan_engine_status(&remote_status.status).to_string();
                    let output_lines = fetch_scan_engine_output(&client, &metadata.url, &metadata.remote_scan_id)
                        .await
                        .unwrap_or_default();
                    let joined_output = output_lines.join("\n");
                    let remote_error = remote_status.error.clone().or_else(|| {
                        if normalized_status == "failed" {
                            Some(format!("Tool exited with code {:?}", remote_status.exit_code))
                        } else {
                            None
                        }
                    });

                    let _ = sqlx::query(
                        "UPDATE scans SET status = $1, output = $2, error_log = $3, completed_at = CASE WHEN $1 IN ('completed','failed','cancelled','timeout') THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END WHERE id = $4"
                    )
                    .bind(&normalized_status)
                    .bind(&joined_output)
                    .bind(&remote_error)
                    .bind(&scan.id)
                    .execute(&state.db)
                    .await;

                    scan.status = Some(normalized_status);
                    scan.output = Some(joined_output);
                    scan.error_log = remote_error;
                    if scan.status.as_deref() == Some("completed")
                        || scan.status.as_deref() == Some("failed")
                        || scan.status.as_deref() == Some("cancelled")
                        || scan.status.as_deref() == Some("timeout")
                    {
                        if scan.completed_at.is_none() {
                            scan.completed_at = Some(chrono::Utc::now().naive_utc());
                        }
                    }
                }
                Err(error) => {
                    tracing::warn!("Failed to refresh delegated scan {}: {}", scan.id, error);
                }
            }
        }
    }

    (StatusCode::OK, Json(json!({"scan": scan.to_response()}))).into_response()
}

// ── Create / Start Scan ────────────────────────────────────

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct ScanAuthorizationBody {
    pub confirmed: bool,
    pub scope_statement: String,
}

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
    pub authorization: Option<ScanAuthorizationBody>,
}

pub async fn start_scan(
    State(state): State<Arc<AppState>>,
    // Read-only roles must not be able to start scans — see WriteUser.
    crate::middleware::auth_middleware::WriteUser(auth): crate::middleware::auth_middleware::WriteUser,
    headers: HeaderMap,
    Json(body): Json<StartScanRequest>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());

    // Rate limit
    if state.rate_limiter.is_limited(&format!("scan:{}", auth.user_id), 5, Duration::from_secs(60)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many scan requests"}))).into_response();
    }

    // ── Target authorization gate (bypass-proof) ────────────────────────
    // Every scan requires an explicit, timestamped ownership/permission
    // confirmation BEFORE any tool is resolved, scan record created, or job
    // spawned. The statement must match the server-side canonical text and is
    // recorded in the audit log with a timestamp.
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
        body.target.trim(),
        authz_confirmation.as_ref(),
        Some(&headers),
    )
    .await
    {
        Ok((authz_id, _, _)) => authz_id,
        Err(e) => {
            return (StatusCode::FORBIDDEN, Json(json!({"error": e}))).into_response();
        }
    };

    // Resolve tool by name or ID
    let tool_identifier = body.tool.as_deref()
        .or(body.tool_id.as_deref())
        .unwrap_or("");

    if tool_identifier.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Tool name or ID required"}))).into_response();
    }

    let tool: Option<Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE (id = $1 OR name = $2 OR business_name = $3) AND is_active = TRUE LIMIT 1"
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

    // Validate target — block shell metacharacters and injection patterns
    let target = body.target.trim();
    if target.is_empty() || target.len() > 500 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Valid target required"}))).into_response();
    }

    // Block shell injection characters
    let blocked_patterns = [";", "&&", "||", "|", "`", "$(",  "$(", ">>", ">", "<", "\n", "\r", "\\x", "%0a", "%0d"];
    for pattern in &blocked_patterns {
        if target.to_lowercase().contains(pattern) {
            return (StatusCode::BAD_REQUEST, Json(json!({
                "error": format!("Invalid target: contains blocked character '{}'", pattern)
            }))).into_response();
        }
    }

    // Block cloud metadata endpoints (SSRF hardening)
    {
        let tl = target.to_lowercase();
        if tl.contains("169.254.169.254") || tl == "metadata.google.internal" || tl.ends_with(".metadata.google.internal") {
            return (StatusCode::FORBIDDEN, Json(json!({
                "error": "Scanning cloud metadata endpoints is not allowed"
            }))).into_response();
        }
    }

    // Block XSS/HTML injection
    if target.contains('<') || target.contains('>') || target.contains('"') || target.contains('\'') {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid target: contains HTML/script characters"}))).into_response();
    }

    // A target that begins with `-` is read by the tool as an option, not as a
    // host: `nmap --script=/tmp/evil.nse` runs an arbitrary NSE script,
    // `-oN /etc/cron.d/x` writes a file. The command builder drops such values
    // as a last line of defence, but rejecting here gives the caller a real
    // error instead of a scan that silently ran without its target.
    if target.starts_with('-') {
        return (StatusCode::BAD_REQUEST, Json(json!({
            "error": "Invalid target: a target may not begin with '-' (it would be interpreted as a command-line option)",
            "code": "TARGET_LOOKS_LIKE_FLAG"
        }))).into_response();
    }

    // Whitelist of trusted option values per parameter, taken from the tool's
    // own form definition. A submitted value that exactly matches one of these
    // is a choice WE authored (a select option, a boolean true/false value) —
    // not free user input — so it may legitimately be, or contain, a flag. This
    // is the security boundary that lets zero-code forms carry flags like `-sV`
    // without opening argument injection to arbitrary user text.
    let param_whitelist: std::collections::HashMap<String, std::collections::HashSet<String>> = {
        let mut m = std::collections::HashMap::new();
        if let Some(form) = tool.parameters.as_ref()
            .and_then(|p| p.get("form"))
            .and_then(|f| f.as_array())
        {
            for ctrl in form {
                let name = match ctrl.get("name").and_then(|v| v.as_str()) {
                    Some(n) => n.to_string(),
                    None => continue,
                };
                let mut allowed = std::collections::HashSet::new();
                if let Some(opts) = ctrl.get("options").and_then(|o| o.as_array()) {
                    for o in opts {
                        if let Some(v) = o.get("value").and_then(|v| v.as_str()) {
                            allowed.insert(v.to_string());
                        }
                    }
                }
                for key in ["true_value", "false_value"] {
                    if let Some(v) = ctrl.get(key).and_then(|v| v.as_str()) {
                        allowed.insert(v.to_string());
                    }
                }
                if !allowed.is_empty() {
                    m.insert(name, allowed);
                }
            }
        }
        m
    };

    // Same rule for every supplied parameter that could stand alone in argv —
    // except values that match the tool's own whitelist, which are trusted and
    // recorded so the command builder may treat them as flag-bearing options.
    let mut trusted_params: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    if let Some(obj) = body.parameters.as_ref().and_then(|p| p.as_object()) {
        for (k, v) in obj {
            if let Some(sv) = v.as_str() {
                let is_whitelisted = param_whitelist
                    .get(k)
                    .is_some_and(|set| set.contains(sv));
                if is_whitelisted {
                    trusted_params.insert(k.clone());
                    continue;
                }
                if sv.trim_start().starts_with('-') {
                    return (StatusCode::BAD_REQUEST, Json(json!({
                        "error": format!("Invalid value for '{}': parameters may not begin with '-' (it would be interpreted as a command-line option)", k),
                        "code": "PARAM_LOOKS_LIKE_FLAG",
                        "parameter": k
                    }))).into_response();
                }
            }
        }
    }


    // Target type validation: check if target matches tool's expected target_types
    if let Some(params) = tool.parameters.as_ref() {
        if let Some(target_types) = params.get("target_types").and_then(|v| v.as_array()) {
            let allowed: Vec<String> = target_types.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_lowercase()))
                .collect();

            // File-input tools: the target is a path to an uploaded file. Confine
            // it to the org's own upload directory so a file tool can never be
            // pointed at host files (`strings /etc/shadow`, `foremost /dev/sda`).
            // Uploads land at /data/uploads/<org_id>/<uuid>_<name>; require that
            // exact prefix and reject any traversal.
            if allowed.iter().any(|t| t == "file") {
                let expected_prefix = format!("/data/uploads/{}/", org_id);
                let ok = target.starts_with(&expected_prefix)
                    && !target.contains("..")
                    && !target[expected_prefix.len()..].contains('/');
                if !ok {
                    return (StatusCode::BAD_REQUEST, Json(json!({
                        "error": "This tool needs an uploaded file. Upload the file first and use the returned path as the target.",
                        "code": "FILE_TARGET_REQUIRED"
                    }))).into_response();
                }
            }

            if !allowed.is_empty() {
                // Classify the target
                let target_lower = target.to_lowercase();
                let is_ip = target_lower.parse::<std::net::IpAddr>().is_ok()
                    || regex::Regex::new(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(/\d{1,2})?$").unwrap().is_match(&target_lower)
                    || target_lower.starts_with("10.") || target_lower.starts_with("172.") 
                    || target_lower.starts_with("192.168.") || target_lower == "127.0.0.1"
                    || target_lower == "localhost";
                let is_url = target_lower.starts_with("http://") || target_lower.starts_with("https://");
                let is_domain = !is_ip && !is_url && target_lower.contains(".") && !target_lower.contains(" ");
                let is_file = target_lower.starts_with("/") || target_lower.starts_with("./") 
                    || target_lower.contains(".txt") || target_lower.contains(".csv")
                    || target_lower.contains(".json") || target_lower.contains(".pcap")
                    || target_lower.contains(".img") || target_lower.contains(".raw")
                    || target_lower.contains(".dd") || target_lower.contains(".E01")
                    || target_lower.contains(".iso") || target_lower.contains(".bin");
                let is_hash = target_lower.len() == 32 || target_lower.len() == 40 
                    || target_lower.len() == 64 || target_lower.len() == 128;
                
                let mut detected_type = "unknown";
                if is_ip { detected_type = "ip"; }
                else if is_url { detected_type = "url"; }
                else if is_file { detected_type = "file"; }
                else if is_domain { detected_type = "domain"; }
                else if is_hash { detected_type = "hash"; }
                
                let type_matches = allowed.iter().any(|a| {
                    match a.as_str() {
                        "ip" | "host" | "network" => is_ip,
                        "url" => is_url,
                        "domain" => is_domain,
                        "file" | "path" | "image" | "binary" | "apk" => is_file,
                        "hash" => is_hash,
                        "target" => true, // generic target accepts anything
                        _ => false,
                    }
                });
                
                if !type_matches && detected_type != "unknown" {
                    return (StatusCode::BAD_REQUEST, Json(json!({
                        "error": format!("This tool expects {} targets, but you provided a {}. Target: {}", 
                            allowed.join(", "), detected_type, target),
                        "code": "TARGET_TYPE_MISMATCH",
                        "expected": allowed,
                        "detected": detected_type,
                        "hint": match detected_type {
                            "ip" => "Try using nmap, masscan, or rustscan for IP targets.",
                            "url" => "Try using nikto, wpscan, or whatweb for URL targets.",
                            "domain" => "Try using subfinder, amass, or dnsenum for domain targets.",
                            "file" => "Provide a file path (e.g., /path/to/image.img) for this tool.",
                            _ => "Check the tool documentation for supported target types.",
                        }
                    }))).into_response();
                }
            }
        }
    }

        // GUI tools: wrapped with Xvfb virtual framebuffer in executor
    let is_gui_tool = tool.gui_required.unwrap_or(false);

    // Check plan access
    // Read the stored plan together with the latest Stripe subscription status.
    //
    // ENFORCEMENT FIX: quotas used to be resolved from `organizations.plan_type`
    // alone. `subscriptions.status` was written by the webhook (`past_due`,
    // `unpaid`, `canceled`) and then never read anywhere, so an organisation
    // whose card had been declined for weeks kept its full paid scan limits.
    // `resolve_entitlement` collapses the two into the plan we should actually
    // enforce, while still reporting what the customer nominally bought.
    let org_plan: Option<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT o.plan_type, CAST(o.created_at AS TEXT), \
                (SELECT s.status FROM subscriptions s \
                  WHERE s.organization_id = o.id \
                  ORDER BY s.created_at DESC LIMIT 1) \
           FROM organizations o WHERE o.id = $1",
    )
    .bind(&org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let nominal_plan = org_plan.as_ref().map(|p| p.0.clone()).unwrap_or_else(|| "trial".into());
    let org_created_at = org_plan.as_ref().and_then(|p| p.1.clone());
    let sub_status = org_plan.as_ref().and_then(|p| p.2.clone());
    let entitlement = crate::services::billing::resolve_entitlement(&nominal_plan, sub_status.as_deref());

    if entitlement.downgraded {
        return (StatusCode::PAYMENT_REQUIRED, Json(json!({
            "error": "Your subscription is no longer active. Update your payment method to keep scanning.",
            "code": "SUBSCRIPTION_INACTIVE",
            "plan": entitlement.nominal_plan,
            "subscription_status": entitlement.status,
        }))).into_response();
    }
    if entitlement.in_grace {
        tracing::warn!(
            "org {} is past_due but still within the dunning window; allowing scan",
            org_id
        );
    }

    let plan = entitlement.effective_plan.clone();

    let mut concurrent_limit: i64 = i64::MAX;

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

        concurrent_limit = if config.concurrent_scans > 0 {
            config.concurrent_scans as i64
        } else {
            i64::MAX
        };

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

    // Zero-code: collect user-supplied parameters for the command template
    // (placeholders like {url}, {wordlist}, {lhost}, {lport}, {user}).
    //
    // INJECTION FIX: these values used to be written straight into the template
    // string here, and `parse_template` then split the whole thing on
    // whitespace — so any value containing a space became several argv entries
    // and the caller could inject arbitrary flags into the tool (`--script`,
    // `-oN <path>`, `--os-shell`). Values are now handed to the builder as
    // data; it tokenises the trusted template first and fills one placeholder
    // per argument, so a value can never create a new argument.
    let command_template = tool.command_template.clone();
    let scan_params: std::collections::BTreeMap<String, String> = body
        .parameters
        .as_ref()
        .and_then(|p| p.as_object())
        .map(|obj| {
            obj.iter()
                .filter(|(k, _)| k.as_str() != "target") // target is handled separately
                .filter_map(|(k, v)| {
                    let val = v.as_str().map(String::from).unwrap_or_else(|| v.to_string());
                    // Strip characters that have no business in an argv entry.
                    // This is defence in depth: nothing goes through a shell,
                    // but a NUL or newline in argv is never legitimate.
                    let safe: String = val.replace(['\n', '\r', '\0'], "");
                    // Keep empty values in the map. An empty value means the
                    // form control resolved to nothing (a boolean's off state,
                    // an unset optional select) and its template placeholder
                    // must be DROPPED. If the key were removed here instead, the
                    // builder would treat the placeholder as absent and fall
                    // back to placeholder_default() — which returns the target,
                    // silently duplicating it into argv (e.g. `nmap … 1.2.3.4
                    // 1.2.3.4 1.2.3.4`). An empty string resolves to "" and the
                    // token is skipped, which is the intended behaviour.
                    Some((k.clone(), safe))
                })
                .collect()
        })
        .unwrap_or_default();

    // Build the final program + argv from the (substituted) template.
    // This is the single source of truth for what the scan engine will execute.
    let (program, command_args) = crate::scan_engine::tool_registry::build_command_with_trusted(
        tool.binary_name.as_deref().unwrap_or(&tool.name),
        target,
        command_template.as_deref(),
        &scan_params,
        &trusted_params,
    )
    .unwrap_or_else(|_| (tool.name.clone(), vec![target.to_string()]));

    // Create scan record FIRST with an atomic concurrency guard: the INSERT only
    // proceeds when the org's running+pending count is below the plan limit.
    // This closes the TOCTOU race where parallel requests each pass the earlier
    // non-atomic COUNT check and overshoot `concurrent_scans`.
    let scan_id = Uuid::new_v4().to_string();
    // The real credentials are already baked into `command_args` (built above) and
    // are forwarded to the engine via `body.parameters` below. What we PERSIST must
    // have secret fields redacted — passwords/tokens never touch the DB.
    let params_json = redact_secret_params(
        &body.parameters.as_ref().cloned().unwrap_or(serde_json::json!({})),
        tool.parameters.as_ref().and_then(|p| p.get("form")),
    );
    let insert_res = sqlx::query(
        "INSERT INTO scans (id, organization_id, user_id, tool_id, target, parameters, status, scan_phase, agent_id, project_id, authorization_id, started_at)
         SELECT $1, $2, $3, $4, $5, $6::jsonb, 'running', 'initializing', $7, $8, $9, CURRENT_TIMESTAMP
         WHERE (SELECT COUNT(*) FROM scans WHERE organization_id = $2 AND status IN ('running','pending')) < $10"
    )
    .bind(&scan_id)
    .bind(&org_id)
    .bind(&auth.user_id)
    .bind(&tool.id)
    .bind(target)
    .bind(&params_json)
    .bind(&body.agent_id)
    .bind(&body.project_id)
    .bind(&authorization_id)
    .bind(concurrent_limit)
    .execute(&state.db)
    .await;

    match insert_res {
        Err(e) => {
            tracing::error!("Failed to insert scan: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to create scan: {}", e)}))).into_response();
        }
        Ok(r) if r.rows_affected() == 0 => {
            return (StatusCode::TOO_MANY_REQUESTS, Json(json!({
                "error": "Concurrent scan limit reached. Wait for running scans to complete or upgrade.",
                "code": "CONCURRENT_LIMIT"
            }))).into_response();
        }
        _ => {}
    }

    let scan_engine_metadata = if body.agent_id.is_none() {
        match configured_scan_engine_url() {
            Some(engine_url) => {
                let client = reqwest::Client::new(); // kept as fallback
                match start_scan_on_engine(
                    &client,
                    &engine_url,
                    &tool.name,
                    target,
                    body.parameters.clone(),
                    Some(program.clone()),
                    Some(command_args.clone()),
                )
                .await
                {
                    Ok(remote_scan) => Some(ScanEngineMetadata {
                        url: engine_url,
                        remote_scan_id: remote_scan.scan_id,
                    }),
                    Err(error) => {
                        // Roll back the local record so the concurrency slot is freed.
                        let _ = sqlx::query("DELETE FROM scans WHERE id = $1")
                            .bind(&scan_id)
                            .execute(&state.db)
                            .await;
                        tracing::error!("Failed to delegate scan to scan-engine: {}", error);
                        return (
                            StatusCode::BAD_GATEWAY,
                            Json(json!({"error": format!("Failed to start delegated scan: {}", error)})),
                        )
                            .into_response();
                    }
                }
            }
            None => None,
        }
    } else {
        None
    };

    // Merge engine metadata into parameters after a successful dispatch.
    if let Some(metadata) = &scan_engine_metadata {
        let merged = merge_scan_parameters(&params_json, metadata);
        let _ = sqlx::query("UPDATE scans SET parameters = $1::jsonb WHERE id = $2")
            .bind(&merged)
            .bind(&scan_id)
            .execute(&state.db)
            .await;
    }

    // Phase: initializing
    emit_phase_change(&state.scan_output_tx, &state.db, &scan_id, "initializing", "Scan initialized. Starting execution pipeline");

    // Phase: resolving_target (scan record created, now resolving target)
    emit_phase_change(&state.scan_output_tx, &state.db, &scan_id, "resolving_target", "Validating target and resolving DNS");

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
        Some(json!({"tool": tool.name, "target": target, "authorization_id": authorization_id})), Some("scan"), Some(&scan_id), "success", Some(&headers)).await;

    // Phase: preparing_tool (building command and preparing execution)
    emit_phase_change(&state.scan_output_tx, &state.db, &scan_id, "preparing_tool", "Building scan command and checking tool availability");

    // Execute scan asynchronously
    let db = state.db.clone();
    let tool_name = tool.name.clone();
    let target_owned = target.to_string();
    let scan_id_clone = scan_id.clone();
    let scan_tx = state.scan_output_tx.clone();

    // Look up agent connection_type + SSH info. Reverse-tunnel agents run jobs
    // by long-polling the backend; SSH agents are dialled directly.
    let agent_meta: Option<(Option<String>, Option<String>, Option<i32>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)> = if let Some(ref aid) = body.agent_id {
        sqlx::query_as(
            "SELECT connection_type, ssh_host, ssh_port, ssh_username, ssh_key_path, ssh_passphrase_encrypted, ssh_fingerprint, ssh_host_key FROM agents WHERE id = $1 AND organization_id = $2"
        )
        .bind(aid)
        .bind(&org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None)
    } else {
        None
    };
    let connection_type = agent_meta.as_ref().and_then(|m| m.0.clone()).unwrap_or_else(|| "direct".into());
    let is_reverse_tunnel = connection_type == "reverse_tunnel";
    // Reverse-tunnel agents execute scan tools on the user's own machine (local-first
    // architecture). Routing is enabled by default and can be force-disabled for
    // compliance/testing via AGENT_ROUTING_ENABLED=false.
    let tunnel_routing_enabled = std::env::var("AGENT_ROUTING_ENABLED")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true") || v.eq_ignore_ascii_case("yes"))
        .unwrap_or(true);
    // Only dispatch via SSH when the agent is explicitly configured for SSH.
    // "direct"/"local" agents (and anything misconfigured without SSH host/user)
    // fall through to local execution on the backend host, which has all tools installed.
    let agent_ssh: Option<AgentSshInfo> = if connection_type == "ssh" && !is_reverse_tunnel {
        agent_meta.as_ref().and_then(|(_ct, host, port, user, key, pp_enc, fingerprint, host_key)| {
            let passphrase = pp_enc.as_deref().and_then(|enc| {
                let secret = crate::handlers::agent_handlers::password_encryption_key();
                crate::services::connection_engine::crypto::decrypt_password(enc, &secret).ok()
            });
            match (host.clone(), user.clone()) {
                (Some(h), Some(u)) if !h.is_empty() && !u.is_empty() => Some(AgentSshInfo {
                    ssh_host: h,
                    ssh_port: port.unwrap_or(22),
                    ssh_username: u,
                    ssh_key_path: key.clone(),
                    ssh_passphrase: passphrase,
                    ssh_fingerprint: fingerprint.clone(),
                    ssh_host_key: host_key.clone(),
                }),
                _ => None,
            }
        })
    } else {
        None
    };

    // Update agent status to busy if dispatching remotely (SSH or reverse-tunnel).
    if (agent_ssh.is_some() || is_reverse_tunnel) && body.agent_id.is_some() {
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

    // ── Reverse-tunnel branch ────────────────────────────────────────
    // Queue an agent_job and spawn a poller that finalizes the scan when the
    // agent posts its result back. Skip the in-process executor entirely.
    // NOTE: disabled while reverse-tunnel routing is off — tools run server-side.
    if is_reverse_tunnel && tunnel_routing_enabled {
        let aid = body.agent_id.clone().unwrap_or_default();
        let (program, args) = crate::scan_engine::tool_registry::build_command_with_trusted(
            &tool.name, target, command_template.as_deref(), &scan_params, &trusted_params
        ).unwrap_or_else(|_| (tool.name.clone(), vec![target.to_string()]));
        // JSON argv protocol: send the exact argument array so the agent runs the
        // tool without shell interpolation (no shell-escape issues). Also keep a
        // display command string for logs/backward-compat.
        let mut argv: Vec<String> = Vec::with_capacity(args.len() + 1);
        argv.push(program.clone());
        argv.extend(args);
        let mut parts: Vec<String> = Vec::with_capacity(argv.len());
        for a in &argv {
            let escaped = a.replace('\'', "'\\''");
            parts.push(format!("'{}'", escaped));
        }
        let cmd_string = parts.join(" ");
        let job_id = uuid::Uuid::new_v4().to_string();
        let _ = sqlx::query(
            "INSERT INTO agent_jobs (id, agent_id, organization_id, scan_id, tool_id, command, args, timeout_seconds, status) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')"
        )
        .bind(&job_id)
        .bind(&aid)
        .bind(&org_id)
        .bind(&scan_id)
        .bind(&tool.name)
        .bind(&cmd_string)
        .bind(serde_json::Value::Array(argv.into_iter().map(serde_json::Value::String).collect()))
        .bind(1800_i32)
        .execute(&state.db)
        .await;

        let db_poll = state.db.clone();
        let scan_tx_poll = state.scan_output_tx.clone();
        let scan_id_poll = scan_id.clone();
        let job_id_poll = job_id.clone();
        let org_for_finalize = org_id.clone();
        let user_for_finalize = auth.user_id.clone();
        let tool_for_finalize = tool.name.clone();
        let target_for_finalize = target.to_string();
        let agent_for_finalize = body.agent_id.clone();
        tokio::spawn(async move {
            // Poll up to 30 minutes (1800s) at 2s intervals.
            for _ in 0..900u32 {
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                let row: Option<(String, Option<i32>, Option<String>, Option<String>)> = sqlx::query_as(
                    "SELECT status, exit_code, stdout, stderr FROM agent_jobs WHERE id = $1"
                )
                .bind(&job_id_poll)
                .fetch_optional(&db_poll)
                .await
                .ok()
                .flatten();
                if let Some((status, exit, stdout, stderr)) = row {
                    if matches!(status.as_str(), "completed" | "failed" | "timeout" | "cancelled") {
                        let combined = match (stdout, stderr) {
                            (Some(o), Some(e)) if !e.is_empty() => format!("{o}\n--- stderr ---\n{e}"),
                            (Some(o), _) => o,
                            (_, Some(e)) => e,
                            _ => String::new(),
                        };
                        let final_status = if status == "completed" && exit == Some(0) { "completed" } else { "failed" };
                        let err_log = if final_status == "failed" { Some(format!("agent job status={status} exit={exit:?}")) } else { None };
                        finalize_scan(
                            &db_poll, &scan_tx_poll, &scan_id_poll, final_status,
                            &combined, None, err_log,
                            &org_for_finalize, &user_for_finalize,
                            &tool_for_finalize, &target_for_finalize,
                            agent_for_finalize.clone(),
                        ).await;
                        return;
                    }
                }
            }
            // Timed out waiting for agent — mark scan failed.
            finalize_scan(
                &db_poll, &scan_tx_poll, &scan_id_poll, "failed",
                "", None, Some("agent job poll timeout (30m)".to_string()),
                &org_for_finalize, &user_for_finalize,
                &tool_for_finalize, &target_for_finalize,
                agent_for_finalize,
            ).await;
        });

        let exec_mode = "reverse_tunnel";
        return (StatusCode::CREATED, Json(json!({
            "success": true,
            "message": "Scan queued for reverse-tunnel agent",
            "scan_id": scan_id,
            "command": cmd_string,
            "status": "running",
            "execution_mode": exec_mode,
            "engine": "agent-rt",
            "job_id": job_id,
            "scan": {
                "id": scan_id,
                "tool": tool.name,
                "target": target,
                "status": "running"
            }
        }))).into_response();
    }

    // Snapshot the substituted template before it is moved into the executor
    // spawn, so the API response can report the actual command.
    let response_command = command_template.clone();

    if let Some(metadata) = scan_engine_metadata.clone() {
        tokio::spawn(monitor_scan_engine(
            db,
            scan_tx,
            scan_id_clone,
            metadata.remote_scan_id,
            metadata.url,
            org_id_for_spawn,
            user_id_for_spawn,
            tool_name_for_notify,
            target_for_notify,
        ));
    } else {
        tokio::spawn(async move {
            // Phase: executing
            emit_phase_change(&scan_tx, &db, &scan_id_clone, "executing", "Executing scan tool against target");

            let result = execute_scan(&tool_name, &target_owned, command_template.as_deref(), &scan_tx, &scan_id_clone, agent_ssh, is_gui_tool).await;

            let (status, output, findings, error_log) = match &result {
                Ok(r) => {
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

            finalize_scan(
                &db,
                &scan_tx,
                &scan_id_clone,
                &status,
                &output,
                findings,
                error_log,
                &org_id_for_spawn,
                &user_id_for_spawn,
                &tool_name_for_notify,
                &target_for_notify,
                agent_id_for_spawn,
            )
            .await;
        });
    }

    // Report the exact command that was built for execution. This reuses the
    // whitelist-aware (program, command_args) computed above — NOT a second,
    // params-less build_command(), which ignored every form value and echoed
    // the target once per placeholder.
    let _ = &response_command; // retained for backward compat / logging call sites
    let command_str = format!("{} {}", program, command_args.join(" "));

    let exec_mode = if scan_engine_metadata.is_some() {
        "delegated"
    } else if body.agent_id.is_some() {
        "remote"
    } else {
        "local"
    };
    let engine_name = if scan_engine_metadata.is_some() {
        "rust-scan-engine"
    } else {
        "rust-axum"
    };

    (StatusCode::CREATED, Json(json!({
        "success": true,
        "message": "Scan started",
        "scan_id": scan_id,
        "command": command_str,
        "status": "running",
        "execution_mode": exec_mode,
        "engine": engine_name,
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

    // IMPORTANT: subscribe to the broadcast BEFORE we read the scan from the
    // DB so any output emitted between the DB read and the subscription is
    // not lost.
    let rx = state.scan_output_tx.subscribe();
    let scan_id_filter = scan_id.clone();

    // Replay buffer: if the scan already finished (or already produced output)
    // we need to replay the saved output to late subscribers, otherwise the
    // browser sees an empty stream and reports "Stream disconnected
    // unexpectedly".
    let row: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT status, output FROM scans WHERE id = $1"
    )
    .bind(&scan_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let mut replay: Vec<String> = Vec::new();
    let mut already_complete = false;
    if let Some((status, output_opt)) = row {
        if let Some(output) = output_opt.filter(|o| !o.trim().is_empty()) {
            for line in output.lines() {
                replay.push(json!({
                    "type": "output",
                    "scan_id": scan_id,
                    "line": line,
                    "data": line,
                }).to_string());
            }
        }
        if matches!(status.as_str(), "completed" | "failed" | "cancelled") {
            already_complete = true;
            replay.push(json!({
                "type": "complete",
                "scan_id": scan_id,
                "status": status,
                "result": {
                    "status": status,
                },
            }).to_string());
        }
    }

    let replay_stream = tokio_stream::iter(replay.into_iter().map(|data| {
        Ok::<_, std::convert::Infallible>(Event::default().data(data))
    }));

    let live_stream = BroadcastStream::new(rx)
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

    // If the scan is already in a terminal state, do not bother holding the
    // connection open with the live broadcast — replay is the full story.
    let stream: std::pin::Pin<Box<dyn futures::stream::Stream<Item = Result<Event, std::convert::Infallible>> + Send>> =
        if already_complete {
            Box::pin(replay_stream)
        } else {
            Box::pin(replay_stream.chain(live_stream))
        };

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

    let scan = match scan {
        Some(scan) => scan,
        None => {
            return (StatusCode::NOT_FOUND, Json(json!({"error": "Scan not found or already completed"}))).into_response();
        }
    };

    if let Some(metadata) = extract_scan_engine_metadata(&scan.parameters) {
        let client = reqwest::Client::new(); // kept as fallback
        if let Err(error) = cancel_scan_on_engine(&client, &metadata.url, &metadata.remote_scan_id).await {
            tracing::error!("Failed to cancel delegated scan {}: {}", scan_id, error);
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("Failed to cancel delegated scan: {}", error)})),
            )
                .into_response();
        }
    }

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
            // Best-effort cancel any pending/claimed/running agent_jobs tied to this scan,
            // so reverse-tunnel agents won't deliver the next poll and the scan poller
            // exits early. Currently-running jobs on the agent still finish in-process,
            // but the result is ignored (status was already terminal).
            let _ = sqlx::query(
                "UPDATE agent_jobs SET status = 'cancelled', completed_at = now() \
                 WHERE scan_id = $1 AND status IN ('pending', 'claimed', 'running')"
            )
            .bind(&scan_id)
            .execute(&state.db)
            .await;
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
    // First verify the scan belongs to this user/org (authorization check)
    let owned: Option<(String,)> = match &auth.org_id {
        Some(org_id) => sqlx::query_as(
            "SELECT id FROM scans WHERE id = $1 AND organization_id = $2"
        )
        .bind(&scan_id)
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None),
        None => sqlx::query_as(
            "SELECT id FROM scans WHERE id = $1 AND user_id = $2"
        )
        .bind(&scan_id)
        .bind(&auth.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None),
    };

    if owned.is_none() {
        return (StatusCode::NOT_FOUND, Json(json!({"error": "Scan not found or access denied"}))).into_response();
    }

    // Use a transaction to cascade-delete dependent records first
    let result = async {
        let mut tx = state.db.begin().await?;

        // Delete usage_tracking records that reference this scan
        sqlx::query("DELETE FROM usage_tracking WHERE scan_id = $1")
            .bind(&scan_id)
            .execute(&mut *tx)
            .await?;

        // Delete the scan itself
        let r = sqlx::query("DELETE FROM scans WHERE id = $1")
            .bind(&scan_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok::<_, sqlx::Error>(r)
    }.await;

    match result {
        Ok(r) if r.rows_affected() > 0 =>
            (StatusCode::OK, Json(json!({"message": "Scan deleted"}))).into_response(),
        Ok(_) =>
            (StatusCode::NOT_FOUND, Json(json!({"error": "Scan not found or access denied"}))).into_response(),
        Err(e) => {
            tracing::error!("delete_scan DB error: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"}))).into_response()
        }
    }
}

pub async fn demo_scan(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let tool_name = match body.get("tool").and_then(|t| t.as_str()) {
        Some(t) => t,
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Tool name required"}))),
    };
    let target = match body.get("target").and_then(|t| t.as_str()) {
        Some(t) => t.trim().to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Target required"}))),
    };

    if target.is_empty() || target.len() > 500 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Valid target required"})));
    }

        let blocked = [";", "&", "|", "`", "$", "<", ">", "\n", "\r", "\\x", "%0a", "%0d"];
    for p in &blocked {
        if target.to_lowercase().contains(p) {
            return (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Invalid target: contains blocked character '{}'", p)})));
        }
    }

    let target_type = crate::services::target_authorization::classify_target(&target);
    if target_type != crate::services::target_authorization::TargetType::Sandbox {
        return (StatusCode::FORBIDDEN, Json(json!({"error": "Demo scans are only allowed for sandbox/public targets. Please sign up for full access."})));
    }

    let tool: Option<Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE (id = $1 OR name = $2 OR business_name = $3) AND is_active = TRUE LIMIT 1"
    )
    .bind(tool_name)
    .bind(tool_name)
    .bind(tool_name)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let tool = match tool {
        Some(t) => t,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": format!("Tool not found: {}", tool_name)}))),
    };

    let scan_id = uuid::Uuid::new_v4().to_string();

    (StatusCode::OK, Json(json!({
        "scan_id": scan_id,
        "status": "running",
        "tool": tool.name,
        "target": target,
        "message": "Demo scan started. Sign up to track results and get full reports.",
        "demo": true,
    })))
}

// ── POST /api/v1/scans (alternative create endpoint) ──────

pub async fn create_scan(
    state: State<Arc<AppState>>,
    auth: crate::middleware::auth_middleware::WriteUser,
    headers: HeaderMap,
    body: Json<StartScanRequest>,
) -> impl IntoResponse {
    start_scan(state, auth, headers, body).await
}

#[derive(Deserialize)]
pub struct NetworkSweepRequest {
    pub subnet: Option<String>,
    pub tool: Option<String>,
    pub agent_id: Option<String>,
    pub project_id: Option<i64>,
    pub authorization: Option<ScanAuthorizationBody>,
}



/// Extract a curated tool form's default values so a sweep can build a complete,
/// runnable command for each host. Without this, template placeholders like
/// `{ports}`/`{rate}` resolve to empty and are dropped (parse_template skips an
/// empty standalone placeholder), so e.g. masscan would run with no `-p` and
/// abort. Defaults come from our own seeded form definitions, so they are
/// trusted (a value like `-p1-1000` or `--rate 1000` may contain flags and
/// split into multiple argv entries).
fn sweep_form_defaults(
    tool: &crate::models::Tool,
) -> (
    std::collections::BTreeMap<String, String>,
    std::collections::BTreeSet<String>,
) {
    let mut params = std::collections::BTreeMap::new();
    let mut trusted = std::collections::BTreeSet::new();
    if let Some(form) = tool
        .parameters
        .as_ref()
        .and_then(|p| p.get("form"))
        .and_then(|f| f.as_array())
    {
        for field in form {
            let name = field.get("name").and_then(|v| v.as_str());
            let default = field.get("default").and_then(|v| v.as_str());
            if let (Some(name), Some(default)) = (name, default) {
                if !default.is_empty() {
                    params.insert(name.to_string(), default.to_string());
                    trusted.insert(name.to_string());
                }
            }
        }
    }
    (params, trusted)
}

pub async fn network_sweep(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<NetworkSweepRequest>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());

    // The agent only identifies the target network; all tools run server-side.
    // When no subnet is given, use the network the agent reported via heartbeat.
    let mut subnet = body.subnet.as_deref().unwrap_or("").trim().to_string();
    if subnet.is_empty() {
        if let Some(ref aid) = body.agent_id {
            let row: Option<(Option<serde_json::Value>,)> = sqlx::query_as(
                "SELECT discovered_subnets FROM agents WHERE id = $1 AND organization_id = $2"
            )
            .bind(aid)
            .bind(&org_id)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);
            if let Some((Some(v),)) = row {
                if let Some(first) = v.as_array().and_then(|a| a.first()).and_then(|x| x.as_str()) {
                    subnet = first.to_string();
                }
            }
        }
    }
    if subnet.is_empty() || !subnet.contains('/') {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Valid subnet required (e.g. 10.0.0.0/24), or select an agent whose network is known"}))).into_response();
    }
    // Block shell injection
    for ch in [';', '&', '|', '`', '$', '<', '>', '\n', '\r'] {
        if subnet.contains(ch) {
            return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid subnet"}))).into_response();
        }
    }

    // The client may send either the tool's name ("nmap") or its UUID id
    // (the "browse all" grid sends the id), so resolve against both and derive
    // the canonical name for the guard below.
    let tool_input = body.tool.as_deref().unwrap_or("nmap").to_string();
    let tool: Option<crate::models::Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE (id = $1 OR name = $2) AND is_active = TRUE LIMIT 1"
    )
    .bind(&tool_input)
    .bind(&tool_input)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);
    let tool_name = tool.as_ref().map(|t| t.name.clone()).unwrap_or_else(|| tool_input.clone());

    // A sweep discovers live hosts and then runs the per-host tool against each
    // bare IP. Only network/port scanners make sense here; web-oriented tools
    // (gobuster, wpscan, nikto, …) need a URL + wordlist and fail on every host,
    // flooding the scan history with useless "failed" rows. Restrict to an
    // allowlist so the failure happens up-front with a clear message instead.
    // Checked (by resolved name) before the authorization gate so a wrong tool
    // choice is rejected with a specific message rather than a generic authz error.
    const SWEEP_TOOLS: &[&str] = &[
        "nmap", "masscan", "naabu", "unicornscan", "fping", "netdiscover",
    ];
    if !SWEEP_TOOLS.contains(&tool_name.as_str()) {
        return (StatusCode::BAD_REQUEST, Json(json!({
            "error": format!(
                "'{}' can't run a network sweep. A sweep scans every host in the subnet, so it needs a network/port scanner ({}). To use '{}', switch to 'Single Target' and give it a URL/host.",
                tool_name, SWEEP_TOOLS.join(", "), tool_name
            )
        }))).into_response();
    }

    // ── Target authorization gate (bypass-proof) ────────────────────────
    // Sweeping a subnet scans every live host inside it, so the subnet itself
    // must carry an explicit, timestamped ownership confirmation.
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
        &subnet,
        authz_confirmation.as_ref(),
        None,
    )
    .await
    {
        Ok((authz_id, _, _)) => authz_id,
        Err(e) => {
            return (StatusCode::FORBIDDEN, Json(json!({"error": e}))).into_response();
        }
    };

    let sweep_id = Uuid::new_v4().to_string();

    // Resolve agent
    let agent_id = body.agent_id.clone();
    let is_reverse_tunnel = if let Some(ref aid) = agent_id {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT connection_type FROM agents WHERE id = $1 AND organization_id = $2"
        )
        .bind(aid)
        .bind(&org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
        row.map(|(ct,)| ct == "reverse_tunnel").unwrap_or(false)
    } else {
        false
    };

    // Reverse-tunnel agents are target context + connectivity: they never run or
    // install tools. All tools execute server-side inside the app. Agent-side
    // traffic routing stays off until a traffic tunnel is implemented.
    let tunnel_routing_enabled = false;

    // `tool` was already resolved (by id or name) above for the sweep guard.

    // Create a visible sweep scan row so the sweep shows up in /dashboard/scans
    let sweep_scan_id = Uuid::new_v4().to_string();
    let sweep_params = json!({"sweep_id": sweep_id, "subnet": subnet, "kind": "network-sweep"});
    let _ = sqlx::query(
        "INSERT INTO scans (id, organization_id, user_id, tool_id, target, parameters, status, scan_phase, agent_id, project_id, authorization_id, started_at) \
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'running', 'sweeping', $7, $8::int, $9, CURRENT_TIMESTAMP)"
    )
    .bind(&sweep_scan_id)
    .bind(&org_id)
    .bind(&auth.user_id)
    .bind(tool.as_ref().map(|t| t.id.clone()).unwrap_or_else(|| tool_name.clone()))
    .bind(&subnet)
    .bind(&sweep_params)
    .bind(&agent_id)
    .bind(&body.project_id)
    .bind(&authorization_id)
    .execute(&state.db)
    .await;

    let db = state.db.clone();
    let scan_tx = state.scan_output_tx.clone();
    let org_id_spawn = org_id.clone();
    let user_id_spawn = auth.user_id.clone();
    let tool_name_spawn = tool_name.clone();
    let project_id = body.project_id;
    let sweep_id_spawn = sweep_id.clone();
    let sweep_scan_id_spawn = sweep_scan_id.clone();
    let subnet_spawn = subnet.clone();
    let authorization_id_spawn = authorization_id.clone();

    // Spawn background task: discover hosts → start individual scans
    tokio::spawn(async move {
        // Step 1: discover live hosts
        let mut discovery_status = "completed".to_string();
        let mut discovery_output = String::new();
        // Step 1: discover live hosts — tools run server-side in the app; the
        // agent only identifies the target network.
        let hosts: Vec<String> = match tokio::process::Command::new("nmap")
            .args(["-sn", "-T4", "--open", "-oG", "-", &subnet_spawn])
            .output()
            .await
        {
            Ok(out) => {
                let out_str = String::from_utf8_lossy(&out.stdout).to_string();
                discovery_status = if out.status.success() { "completed".to_string() } else { "failed".to_string() };
                discovery_output = out_str.clone();
                parse_nmap_hosts(&out_str)
            }
            Err(e) => {
                discovery_status = "failed".to_string();
                discovery_output = e.to_string();
                vec![]
            }
        };

        // Always finalize the sweep scan row so the sweep is visible with a result/error
        if hosts.is_empty() {
            let (final_status, out) = if discovery_status == "completed" {
                ("completed", format!("Network sweep completed: no live hosts found in {}", subnet_spawn))
            } else {
                ("failed", format!("Network sweep discovery failed: {}", discovery_output.trim()))
            };
            let _ = sqlx::query(
                "UPDATE scans SET status=$1, output=$2, completed_at=CURRENT_TIMESTAMP, scan_phase='complete' WHERE id=$3"
            )
            .bind(final_status)
            .bind(&out)
            .bind(&sweep_scan_id_spawn)
            .execute(&db)
            .await;
            let _ = scan_tx.send(json!({
                "type": "complete",
                "scan_id": sweep_scan_id_spawn.clone(),
                "status": final_status
            }).to_string());
            tracing::warn!("network_sweep {}: {} in {}", sweep_id_spawn, out, subnet_spawn);
            return;
        }

        // Discovery succeeded - mark the sweep scan completed with the host list
        let _ = sqlx::query(
            "UPDATE scans SET status='completed', output=$1, completed_at=CURRENT_TIMESTAMP, scan_phase='complete' WHERE id=$2"
        )
        .bind(format!("Network sweep found {} live host(s): {}", hosts.len(), hosts.join(", ")))
        .bind(&sweep_scan_id_spawn)
        .execute(&db)
        .await;
        let _ = scan_tx.send(json!({
            "type": "complete",
            "scan_id": sweep_scan_id_spawn.clone(),
            "status": "completed"
        }).to_string());

        tracing::info!("network_sweep {}: found {} hosts, starting {} scans", sweep_id_spawn, hosts.len(), hosts.len());

        // Step 2: start a scan for each host
        for host in hosts {
            let tool: Option<crate::models::Tool> = sqlx::query_as(
                "SELECT * FROM tools WHERE (id = $1 OR name = $2) AND is_active = TRUE LIMIT 1"
            )
            .bind(&tool_name_spawn)
            .bind(&tool_name_spawn)
            .fetch_optional(&db)
            .await
            .unwrap_or(None);

            let tool = match tool {
                Some(t) => t,
                None => continue,
            };

            let scan_id = Uuid::new_v4().to_string();
            let params = json!({"sweep_id": sweep_id_spawn, "subnet": subnet_spawn});

            let _ = sqlx::query(
                "INSERT INTO scans (id, organization_id, user_id, tool_id, target, parameters, status, scan_phase, agent_id, project_id, authorization_id, started_at) \
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'running', 'initializing', $7, $8, $9, CURRENT_TIMESTAMP)"
            )
            .bind(&scan_id)
            .bind(&org_id_spawn)
            .bind(&user_id_spawn)
            .bind(&tool.id)
            .bind(&host)
            .bind(&params)
            .bind(&agent_id)
            .bind(project_id)
            .bind(&authorization_id_spawn)
            .execute(&db)
            .await;

            // Queue agent job or run locally (reverse-tunnel routing off -> local)
            if is_reverse_tunnel && tunnel_routing_enabled {
                if let Some(ref aid) = agent_id {
                    let (program, args) = crate::scan_engine::tool_registry::build_command(
                        &tool.name, &host, tool.command_template.as_deref()
                    ).unwrap_or_else(|_| (tool.name.clone(), vec![host.clone()]));
                    let mut argv: Vec<String> = Vec::with_capacity(args.len() + 1);
                    argv.push(program);
                    argv.extend(args);
                    let cmd = argv.join(" ");
                    let job_id = Uuid::new_v4().to_string();
                    let _ = sqlx::query(
                        "INSERT INTO agent_jobs (id, agent_id, organization_id, scan_id, tool_id, command, args, timeout_seconds, status) \
                         VALUES ($1, $2, $3, $4, $5, $6, $7, 1800, 'pending')"
                    )
                    .bind(&job_id)
                    .bind(aid)
                    .bind(&org_id_spawn)
                    .bind(&scan_id)
                    .bind(&tool.name)
                    .bind(&cmd)
                    .bind(serde_json::Value::Array(argv.into_iter().map(serde_json::Value::String).collect()))
                    .execute(&db)
                    .await;

                    // Poll for result
                    let db2 = db.clone();
                    let scan_id2 = scan_id.clone();
                    let job_id2 = job_id.clone();
                    let scan_tx2 = scan_tx.clone();
                    let aid2 = aid.clone();
                    tokio::spawn(async move {
                        for _ in 0..900u32 {
                            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                            let row: Option<(String, Option<i32>, Option<String>, Option<String>)> = sqlx::query_as(
                                "SELECT status, exit_code, stdout, stderr FROM agent_jobs WHERE id = $1"
                            )
                            .bind(&job_id2)
                            .fetch_optional(&db2)
                            .await
                            .unwrap_or(None);
                            if let Some((status, exit_code, stdout, _stderr)) = row {
                                if status == "completed" || status == "failed" || status == "timeout" {
                                    let output = stdout.unwrap_or_default();
                                    let final_status = if status == "completed" && exit_code.unwrap_or(1) == 0 { "completed" } else { "failed" };
                                    let _ = sqlx::query(
                                        "UPDATE scans SET status=$1, output=$2, findings=$3::jsonb, completed_at=CURRENT_TIMESTAMP, scan_phase='complete' WHERE id=$4"
                                    )
                                    .bind(final_status)
                                    .bind(&output)
                                    .bind(serde_json::to_value(parse_findings_simple(&output)).unwrap_or(json!([])))
                                    .bind(&scan_id2)
                                    .execute(&db2)
                                    .await;
                                    let _ = sqlx::query(
                                        "UPDATE agents SET status='online', active_scans=GREATEST(0, active_scans-1) WHERE id=$1"
                                    ).bind(&aid2).execute(&db2).await;
                                    let _ = scan_tx2.send(json!({
                                        "type": "complete",
                                        "scan_id": scan_id2.clone(),
                                        "status": final_status,
                                        "scheduled": false
                                    }).to_string());
                                    break;
                                }
                            }
                        }
                    });
                }
            } else {
                // Per-host scans delegate to the scan engine, where every tool is
                // installed. Running them locally in the backend container only
                // works for nmap (the sole scanner in the API image) — masscan,
                // naabu, unicornscan, fping and netdiscover live only in the
                // engine, so the old local path failed every host with
                // "No such file or directory (os error 2)". Curated form defaults
                // are applied so the command is complete (e.g. masscan gets
                // -p1-1000 --rate 1000; an empty {ports} would otherwise drop out).
                let db2 = db.clone();
                let scan_id2 = scan_id.clone();
                let tool2 = tool.clone();
                let host2 = host.clone();
                let scan_tx2 = scan_tx.clone();
                let org_id2 = org_id_spawn.clone();
                let user_id2 = user_id_spawn.clone();
                let subnet2 = subnet_spawn.clone();
                let sweep_id2 = sweep_id_spawn.clone();
                tokio::spawn(async move {
                    let (defaults, trusted) = sweep_form_defaults(&tool2);
                    let (program, args) = crate::scan_engine::tool_registry::build_command_with_trusted(
                        &tool2.name, &host2, tool2.command_template.as_deref(), &defaults, &trusted,
                    ).unwrap_or_else(|_| (tool2.name.clone(), vec![host2.clone()]));

                    if let Some(engine_url) = configured_scan_engine_url() {
                        // Delegated execution (production path — tools live here).
                        let client = reqwest::Client::new();
                        match start_scan_on_engine(
                            &client, &engine_url, &tool2.name, &host2,
                            None, Some(program.clone()), Some(args.clone()),
                        ).await {
                            Ok(remote) => {
                                // Persist engine metadata so status/restart reconciliation works.
                                let base = json!({"sweep_id": sweep_id2, "subnet": subnet2});
                                let metadata = ScanEngineMetadata {
                                    url: engine_url.clone(),
                                    remote_scan_id: remote.scan_id.clone(),
                                };
                                let merged = merge_scan_parameters(&base, &metadata);
                                let _ = sqlx::query("UPDATE scans SET parameters = $1::jsonb WHERE id = $2")
                                    .bind(&merged).bind(&scan_id2).execute(&db2).await;
                                // Polls the engine, streams output, and finalizes the scan row.
                                monitor_scan_engine(
                                    db2, scan_tx2, scan_id2, remote.scan_id, engine_url,
                                    org_id2, user_id2, tool2.name.clone(), host2,
                                ).await;
                            }
                            Err(e) => {
                                let _ = sqlx::query(
                                    "UPDATE scans SET status='failed', output=$1, completed_at=CURRENT_TIMESTAMP, scan_phase='complete' WHERE id=$2"
                                )
                                .bind(format!("Failed to delegate scan to engine: {}", e))
                                .bind(&scan_id2)
                                .execute(&db2)
                                .await;
                                let _ = scan_tx2.send(json!({
                                    "type": "complete", "scan_id": scan_id2.clone(), "status": "failed"
                                }).to_string());
                            }
                        }
                    } else {
                        // No engine configured: local fallback (only nmap is
                        // present in the backend image).
                        let result = tokio::process::Command::new(&program)
                            .args(&args)
                            .output()
                            .await;
                        let (status, output) = match result {
                            Ok(out) => {
                                let o = String::from_utf8_lossy(&out.stdout).to_string();
                                let s = if out.status.success() { "completed" } else { "failed" };
                                (s, o)
                            }
                            Err(e) => ("failed", e.to_string()),
                        };
                        let _ = sqlx::query(
                            "UPDATE scans SET status=$1, output=$2, findings=$3::jsonb, completed_at=CURRENT_TIMESTAMP, scan_phase='complete' WHERE id=$4"
                        )
                        .bind(status)
                        .bind(&output)
                        .bind(serde_json::to_value(parse_findings_simple(&output)).unwrap_or(json!([])))
                        .bind(&scan_id2)
                        .execute(&db2)
                        .await;
                        let _ = scan_tx2.send(json!({
                            "type": "complete", "scan_id": scan_id2.clone(), "status": status
                        }).to_string());
                    }
                });
            }
        }
    });

    (StatusCode::ACCEPTED, Json(json!({
        "sweep_id": sweep_id,
        "subnet": subnet,
        "tool": tool_name,
        "status": "running",
        "message": "Network sweep started. Individual scans will appear in /dashboard/scans as hosts are discovered."
    }))).into_response()
}

/// Parse nmap greppable output (-oG) and return list of live host IPs.
fn parse_nmap_hosts(output: &str) -> Vec<String> {
    output.lines()
        .filter(|l| l.starts_with("Host:") && l.contains("Status: Up"))
        .filter_map(|l| {
            l.split_whitespace().nth(1).map(|ip| ip.to_string())
        })
        .collect()
}

/// Lightweight findings extraction from raw tool output.
fn parse_findings_simple(output: &str) -> JsonValue {
    let mut findings: Vec<JsonValue> = Vec::new();
    for line in output.lines() {
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() {
            continue;
        }
        // Heuristic: lines matching a severity keyword or an IP/port pattern
        let is_severity = ["VULNERABLE", "CRITICAL", "HIGH", "MEDIUM", "LOW", "open", "failed", "ERROR"].iter()
            .any(|kw| line_trimmed.contains(kw));
        let is_address = regex::Regex::new(r"\b\d{1,3}(\.\d{1,3}){3}(:\d{1,5})?\b").unwrap().is_match(line_trimmed);
        if is_severity || is_address {
            findings.push(json!({
                "type": if is_address { "address" } else { "finding" },
                "value": line_trimmed,
            }));
            if findings.len() >= 100 {
                break;
            }
        }
    }
    JsonValue::Array(findings)
}

// ── Re-scan verification diff ───────────────────────────────
// A "re-scan" re-runs a completed scan against the same target with the same
// tool + parameters; the new scan carries `parameters._rescan_of = <baseline
// scan id>` (set by the client, which reuses the fully-guarded start_scan
// path). This endpoint compares the two runs' findings and classifies each as
// fixed / still-present / new so a user can verify a remediation worked.

/// The subset of a scan row needed to diff two runs.
struct DiffScan {
    parameters: Option<JsonValue>,
    findings: Option<JsonValue>,
    output: Option<String>,
    created_at: Option<chrono::NaiveDateTime>,
    tool_id: String,
    target: String,
    status: Option<String>,
}

async fn fetch_diff_scan(db: &sqlx::PgPool, auth: &AuthUser, scan_id: &str) -> Option<DiffScan> {
    type Row = (Option<JsonValue>, Option<JsonValue>, Option<String>, Option<chrono::NaiveDateTime>, String, String, Option<String>);
    let row: Option<Row> = match &auth.org_id {
        Some(org) => sqlx::query_as(
            "SELECT parameters, findings, output, created_at, tool_id, target, status FROM scans WHERE id = $1 AND organization_id = $2"
        ).bind(scan_id).bind(org).fetch_optional(db).await.unwrap_or(None),
        None => sqlx::query_as(
            "SELECT parameters, findings, output, created_at, tool_id, target, status FROM scans WHERE id = $1 AND user_id = $2"
        ).bind(scan_id).bind(&auth.user_id).fetch_optional(db).await.unwrap_or(None),
    };
    row.map(|(parameters, findings, output, created_at, tool_id, target, status)| DiffScan {
        parameters, findings, output, created_at, tool_id, target, status,
    })
}

/// Collapse internal whitespace so two runs that format a finding slightly
/// differently still match.
fn normalize_sig(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Build a stable signature for an object-shaped finding.
fn object_finding_sig(f: &JsonValue) -> Option<String> {
    for key in ["title", "name", "id", "template-id", "matched-at", "description"] {
        if let Some(s) = f.get(key).and_then(|v| v.as_str()) {
            let sig = normalize_sig(s);
            if !sig.is_empty() {
                return Some(sig);
            }
        }
    }
    None
}

/// Reduce a scan's findings (or, failing that, its raw output) to a set of
/// comparable finding signatures. Handles both stored shapes: an array of
/// `{type,value}` (parse_findings_simple) and an object with
/// `services[]`/`vulnerabilities[]` (scan-engine parsers).
fn extract_finding_signatures(findings: &Option<JsonValue>, output: &Option<String>) -> std::collections::BTreeSet<String> {
    use std::collections::BTreeSet;
    let mut set: BTreeSet<String> = BTreeSet::new();
    match findings {
        Some(JsonValue::Array(arr)) => {
            for f in arr {
                match f {
                    JsonValue::String(s) => {
                        let sig = normalize_sig(s);
                        if !sig.is_empty() { set.insert(sig); }
                    }
                    JsonValue::Object(_) => {
                        let ty = f.get("type").and_then(|v| v.as_str()).unwrap_or("");
                        // "address" entries are host headers (e.g. "Nmap scan
                        // report for X"), not findings — never diff them.
                        if ty.eq_ignore_ascii_case("address") { continue; }
                        if let Some(v) = f.get("value").and_then(|v| v.as_str()) {
                            let sig = normalize_sig(v);
                            if !sig.is_empty() { set.insert(sig); }
                        } else if let Some(sig) = object_finding_sig(f) {
                            set.insert(sig);
                        }
                    }
                    _ => {}
                }
            }
        }
        Some(JsonValue::Object(map)) => {
            if let Some(JsonValue::Array(services)) = map.get("services") {
                for svc in services {
                    if let Some(port) = svc.get("port").and_then(|p| p.as_u64()) {
                        let proto = svc.get("protocol").and_then(|p| p.as_str()).unwrap_or("tcp");
                        let name = svc.get("service").and_then(|s| s.as_str()).unwrap_or("");
                        set.insert(normalize_sig(&format!("port {}/{} {}", port, proto, name)));
                    }
                }
            }
            for key in ["vulnerabilities", "findings", "issues"] {
                if let Some(JsonValue::Array(items)) = map.get(key) {
                    for v in items {
                        if let Some(sig) = object_finding_sig(v) {
                            set.insert(sig);
                        } else if let Some(s) = v.as_str() {
                            let sig = normalize_sig(s);
                            if !sig.is_empty() { set.insert(sig); }
                        }
                    }
                }
            }
        }
        _ => {}
    }
    // Fallback: no structured findings — pull finding-shaped lines from output.
    if set.is_empty() {
        if let Some(out) = output {
            for line in out.lines() {
                let l = line.trim();
                if l.is_empty() { continue; }
                let low = l.to_lowercase();
                let looks_like_finding = l.contains("/tcp") || l.contains("/udp")
                    || low.contains("open") || low.contains("vulnerable")
                    || low.contains("cve-") || l.starts_with('[');
                if looks_like_finding {
                    let sig = normalize_sig(l);
                    if !sig.is_empty() { set.insert(sig); }
                    if set.len() >= 500 { break; }
                }
            }
        }
    }
    set
}

/// GET /api/v1/scans/:scan_id/diff — verify a re-scan against its baseline.
pub async fn scan_diff(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(scan_id): Path<String>,
) -> impl IntoResponse {
    let Some(current) = fetch_diff_scan(&state.db, &auth, &scan_id).await else {
        return (StatusCode::NOT_FOUND, Json(json!({"error": "Scan not found"}))).into_response();
    };
    let baseline_id = current.parameters.as_ref()
        .and_then(|p| p.get("_rescan_of"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let Some(baseline_id) = baseline_id else {
        return (StatusCode::BAD_REQUEST, Json(json!({
            "error": "This scan is not a re-scan, so there is no baseline to compare against."
        }))).into_response();
    };
    let Some(baseline) = fetch_diff_scan(&state.db, &auth, &baseline_id).await else {
        return (StatusCode::NOT_FOUND, Json(json!({"error": "Baseline scan not found or not accessible."}))).into_response();
    };

    let cur_set = extract_finding_signatures(&current.findings, &current.output);
    let base_set = extract_finding_signatures(&baseline.findings, &baseline.output);

    let fixed: Vec<&String> = base_set.difference(&cur_set).collect();
    let still_present: Vec<&String> = base_set.intersection(&cur_set).collect();
    let new_findings: Vec<&String> = cur_set.difference(&base_set).collect();

    let tool_name: Option<String> = sqlx::query_scalar("SELECT name FROM tools WHERE id = $1")
        .bind(&current.tool_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let fmt = |d: &Option<chrono::NaiveDateTime>| d.map(|x| x.format("%Y-%m-%dT%H:%M:%S").to_string());

    (StatusCode::OK, Json(json!({
        "baseline_scan_id": baseline_id,
        "baseline_at": fmt(&baseline.created_at),
        "baseline_status": baseline.status,
        "current_scan_id": scan_id,
        "current_at": fmt(&current.created_at),
        "current_status": current.status,
        "target": current.target,
        "tool_name": tool_name.unwrap_or_default(),
        "fixed": fixed,
        "still_present": still_present,
        "new_findings": new_findings,
        "counts": {
            "fixed": fixed.len(),
            "still_present": still_present.len(),
            "new": new_findings.len(),
            "baseline_total": base_set.len(),
            "current_total": cur_set.len()
        }
    }))).into_response()
}


