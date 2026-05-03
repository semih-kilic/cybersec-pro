use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthUser;
use crate::models::Agent;
use crate::AppState;

// ── Pure helpers (testable without DB) ─────────────────────────────────

/// Extracts `(cpu_usage, memory_usage, active_scans)` from a heartbeat JSON body.
/// Missing or non-numeric fields default to 0.
pub fn parse_heartbeat_metrics(body: &serde_json::Value) -> (f64, f64, i32) {
    let cpu    = body.get("cpu_usage").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let mem    = body.get("memory_usage").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let active = body.get("active_scans").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    (cpu, mem, active)
}

/// Returns `true` if the given string is a valid agent registration token prefix format.
/// Registration tokens are prefixed with `agt_` followed by 32 hex chars (UUID without dashes).
pub fn is_valid_agent_token_format(token: &str) -> bool {
    if let Some(suffix) = token.strip_prefix("agt_") {
        suffix.len() == 32 && suffix.chars().all(|c| c.is_ascii_hexdigit())
    } else {
        false
    }
}

/// Returns `true` if the given string is a valid agent API key format.
/// API keys are prefixed with `ak_` followed by 32 hex chars.
pub fn is_valid_agent_api_key_format(key: &str) -> bool {
    if let Some(suffix) = key.strip_prefix("ak_") {
        suffix.len() == 32 && suffix.chars().all(|c| c.is_ascii_hexdigit())
    } else {
        false
    }
}

pub async fn list_agents(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let agents: Vec<Agent> = match &auth.org_id {
        Some(org_id) => {
            sqlx::query_as(
                "SELECT * FROM agents WHERE organization_id = $1 ORDER BY created_at DESC"
            )
            .bind(org_id)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default()
        }
        None => {
            // Admin users without org see all agents
            sqlx::query_as(
                "SELECT * FROM agents ORDER BY created_at DESC"
            )
            .fetch_all(&state.db)
            .await
            .unwrap_or_default()
        }
    };

    let response: Vec<_> = agents.iter().map(|a| a.to_response()).collect();
    (StatusCode::OK, Json(json!({"agents": response}))).into_response()
}

#[derive(Deserialize)]
pub struct CreateAgentRequest {
    pub name: String,
    pub connection_type: Option<String>,
    pub hostname: Option<String>,
    pub ip_address: Option<String>,
    pub platform: Option<String>,
    pub network_zone: Option<String>,
    pub max_concurrent_scans: Option<i32>,
    // SSH
    pub ssh_host: Option<String>,
    pub ssh_port: Option<i32>,
    pub ssh_username: Option<String>,
    pub ssh_password: Option<String>,
    pub ssh_key: Option<String>,
    // Location
    pub location: Option<String>,
    // VPN
    pub vpn_config_path: Option<String>,
    // Proxy
    pub proxy_endpoint: Option<String>,
}

pub async fn create_agent(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CreateAgentRequest>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    // Check remote_agents feature flag and max_agents plan limit
    let org_plan: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = $1")
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    let plan = org_plan.map(|p| p.0).unwrap_or_else(|| "trial".into());
    let plan_configs = crate::services::plan::get_plan_configs();
    if let Some(config) = plan_configs.get(plan.as_str()) {
        if !config.features.remote_agents {
            return (StatusCode::PAYMENT_REQUIRED, Json(json!({
                "error": "Remote agents require Professional or higher plan."
            }))).into_response();
        }
        if config.max_agents >= 0 {
            let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM agents WHERE organization_id = $1")
                .bind(org_id)
                .fetch_one(&state.db)
                .await
                .unwrap_or((0,));
            if count.0 >= config.max_agents as i64 {
                return (StatusCode::PAYMENT_REQUIRED, Json(json!({
                    "error": format!("Agent limit reached ({}/{}). Upgrade your plan.", count.0, config.max_agents)
                }))).into_response();
            }
        }
    }

    let agent_id = Uuid::new_v4().to_string();
    let reg_token = format!("agt_{}", Uuid::new_v4().to_string().replace('-', ""));
    let api_key = format!("ak_{}", Uuid::new_v4().to_string().replace('-', ""));
    let conn_type = body.connection_type.as_deref().unwrap_or("direct");

    // Encrypt SSH password if provided
    let encrypted_password = body.ssh_password.as_ref().and_then(|pwd| {
        if pwd.is_empty() { return None; }
        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default-secret".into());
        crate::services::connection_engine::crypto::encrypt_password(pwd, &secret).ok()
    });

    let _ = sqlx::query(
        "INSERT INTO agents (id, organization_id, name, connection_type, hostname, ip_address, platform, network_zone, max_concurrent_scans, ssh_host, ssh_port, ssh_username, ssh_password_encrypted, ssh_key_path, location, vpn_config_path, proxy_endpoint, registration_token, api_key, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'pending')"
    )
    .bind(&agent_id)
    .bind(org_id)
    .bind(&body.name)
    .bind(conn_type)
    .bind(&body.hostname)
    .bind(&body.ip_address)
    .bind(body.platform.as_deref().unwrap_or("linux"))
    .bind(body.network_zone.as_deref().unwrap_or("public"))
    .bind(body.max_concurrent_scans.unwrap_or(5))
    .bind(&body.ssh_host)
    .bind(body.ssh_port.unwrap_or(22))
    .bind(&body.ssh_username)
    .bind(&encrypted_password)
    .bind(&body.ssh_key)
    .bind(&body.location)
    .bind(&body.vpn_config_path)
    .bind(&body.proxy_endpoint)
    .bind(&reg_token)
    .bind(&api_key)
    .execute(&state.db)
    .await;

    (StatusCode::CREATED, Json(json!({
        "message": "Agent created",
        "agent": {
            "id": agent_id,
            "name": body.name,
            "connection_type": conn_type,
            "status": "pending",
            "registration_token": reg_token,
            "api_key": api_key
        }
    }))).into_response()
}

pub async fn get_agent(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(agent_id): Path<String>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let agent: Option<Agent> = sqlx::query_as(
        "SELECT * FROM agents WHERE id = $1 AND organization_id = $2"
    )
    .bind(&agent_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    match agent {
        Some(a) => (StatusCode::OK, Json(json!({"agent": a.to_response()}))).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Agent not found"}))).into_response(),
    }
}

pub async fn delete_agent(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(agent_id): Path<String>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let _ = sqlx::query("DELETE FROM agents WHERE id = $1 AND organization_id = $2")
        .bind(&agent_id)
        .bind(org_id)
        .execute(&state.db)
        .await;

    Json(json!({"message": "Agent deleted"})).into_response()
}

pub async fn agent_heartbeat(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let (cpu, mem, active) = parse_heartbeat_metrics(&body);

    let _ = sqlx::query(
        "UPDATE agents SET status = 'online', last_heartbeat = CURRENT_TIMESTAMP, cpu_usage = $1, memory_usage = $2, active_scans = $3 WHERE id = $4"
    )
    .bind(cpu)
    .bind(mem)
    .bind(active)
    .bind(&agent_id)
    .execute(&state.db)
    .await;

    Json(json!({"status": "ok"}))
}

/// Execute a command on agent via SSH
pub async fn agent_execute(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(agent_id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let command = match body.get("command").and_then(|v| v.as_str()) {
        Some(cmd) => cmd.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "command is required"}))).into_response(),
    };

    // Fetch agent SSH details
    let agent: Option<Agent> = sqlx::query_as(
        "SELECT * FROM agents WHERE id = $1 AND organization_id = $2"
    )
    .bind(&agent_id)
    .bind(org_id.as_str())
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let agent = match agent {
        Some(a) => a,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "Agent not found"}))).into_response(),
    };

    let host = match &agent.ssh_host {
        Some(h) if !h.is_empty() => h.clone(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "No SSH host configured"}))).into_response(),
    };

    let password = agent.ssh_password_encrypted.as_ref().and_then(|enc| {
        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default-secret".into());
        crate::services::connection_engine::crypto::decrypt_password(enc, &secret).ok()
    });

    let params = crate::services::connection_engine::SshConnParams {
        host,
        port: agent.ssh_port.unwrap_or(22) as u16,
        username: agent.ssh_username.unwrap_or_else(|| "root".into()),
        password,
        private_key: agent.ssh_key_path.clone(),
        passphrase: None,
        timeout_secs: 30,
    };

    match crate::services::connection_engine::ssh_execute(&params, &command).await {
        Ok(result) => Json(json!({
            "success": true,
            "exit_code": result.exit_code,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "duration_ms": result.duration_ms,
        })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
            "success": false,
            "error": e,
        }))).into_response(),
    }
}

/// Discover devices on a subnet via an agent or directly
pub async fn network_discover(
    State(_state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let _org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let subnet = body.get("subnet").and_then(|v| v.as_str()).unwrap_or("10.0.0.0/24");
    let timeout_ms = body.get("timeout_ms").and_then(|v| v.as_u64()).unwrap_or(1500);

    let options = crate::services::network_discovery::DiscoveryOptions {
        subnet: subnet.to_string(),
        port_scan: true,
        timeout_ms,
        ..Default::default()
    };

    match crate::services::network_discovery::discover_subnet(&options).await {
        Ok(hosts) => Json(json!({
            "success": true,
            "subnet": subnet,
            "hosts_found": hosts.len(),
            "hosts": hosts,
        })).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, Json(json!({
            "success": false,
            "error": e,
        }))).into_response(),
    }
}

/// Issue a short-lived enrollment token for a reverse-tunnel agent.
///
/// Returns a JWT signed with `JWT_SECRET` carrying `{ org_id, kind: "agent_enroll", exp }`
/// where `exp` is 24 hours from issuance. The agent presents this token on first dial-in
/// to bind itself to the calling user's organization. The token is single-use on the
/// agent side (the agent rotates to a long-lived API key after enrollment); the backend
/// does not need to track issued tokens because the `exp` claim caps the blast radius.
pub async fn issue_enrollment_token(
    State(_state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };
    let now = chrono::Utc::now().timestamp() as usize;
    let exp = now + 60 * 60 * 24; // 24h
    let claims = serde_json::json!({
        "org_id": org_id,
        "kind": "agent_enroll",
        "iat": now,
        "exp": exp,
    });
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default-secret".into());
    let token = match jsonwebtoken::encode(
        &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()),
    ) {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("enrollment token sign failed: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Token signing failed"}))).into_response();
        }
    };
    Json(json!({
        "token": token,
        "expires_at": exp,
        "ttl_seconds": 60 * 60 * 24,
    })).into_response()
}

/// Enroll a reverse-tunnel agent using a short-lived enrollment JWT.
///
/// Body: `{ "token": "<jwt>", "hostname": "...", "platform": "linux|macos|windows" }`.
/// Validates the JWT (HS256, kind=agent_enroll), derives `organization_id` from
/// claims, inserts the agent row, and returns `{ agent_id, api_key }` which the
/// agent stores locally and presents on every heartbeat / job-poll thereafter.
///
/// Public endpoint (no AuthUser) — the JWT is the auth.
pub async fn enroll_agent(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let token = match body.get("token").and_then(|v| v.as_str()) {
        Some(t) if !t.is_empty() => t.to_string(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "token is required"}))).into_response(),
    };
    let hostname = body.get("hostname").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
    let platform = body.get("platform").and_then(|v| v.as_str()).unwrap_or("linux").to_string();

    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default-secret".into());
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
    validation.validate_exp = true;
    let data = match jsonwebtoken::decode::<serde_json::Value>(
        &token,
        &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    ) {
        Ok(d) => d,
        Err(e) => {
            tracing::warn!("agent enroll: invalid JWT: {e}");
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid or expired enrollment token"}))).into_response();
        }
    };
    let claims = data.claims;
    if claims.get("kind").and_then(|v| v.as_str()) != Some("agent_enroll") {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Wrong token kind"}))).into_response();
    }
    let org_id = match claims.get("org_id").and_then(|v| v.as_str()) {
        Some(s) => s.to_string(),
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Token missing org_id"}))).into_response(),
    };

    let agent_id = Uuid::new_v4().to_string();
    let api_key = format!("ak_{}", Uuid::new_v4().to_string().replace('-', ""));
    let name = format!("agent-{}", &agent_id[..8]);

    let res = sqlx::query(
        "INSERT INTO agents (id, organization_id, name, connection_type, hostname, platform, network_zone, max_concurrent_scans, registration_token, api_key, status)
         VALUES ($1, $2, $3, 'reverse_tunnel', $4, $5, 'public', 5, $6, $7, 'online')"
    )
    .bind(&agent_id)
    .bind(&org_id)
    .bind(&name)
    .bind(&hostname)
    .bind(&platform)
    .bind(&token)
    .bind(&api_key)
    .execute(&state.db)
    .await;

    if let Err(e) = res {
        tracing::error!("agent enroll: db insert failed: {e}");
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to register agent"}))).into_response();
    }

    Json(json!({
        "agent_id": agent_id,
        "api_key": api_key,
        "name": name,
        "heartbeat_url": format!("/api/v1/agents/{}/heartbeat", agent_id),
        "heartbeat_interval_seconds": 30,
    })).into_response()
}

/// Serve a POSIX install script for the reverse-tunnel agent.
///
/// Public endpoint (no auth) — the script itself reads `CSP_TOKEN` from the
/// caller's environment and uses it to enroll. The script is intentionally
/// minimal: it prints next steps and currently exits with a friendly notice
/// because the agent binary is still being staged. Once `cybersec-agent` is
/// published this handler is the single rollout point — no nginx changes.
pub async fn install_sh() -> impl IntoResponse {
    let body = r#"#!/bin/sh
# CyberSec Pro reverse-tunnel agent installer
set -eu

if [ -z "${CSP_TOKEN:-}" ]; then
  echo "ERROR: CSP_TOKEN environment variable is required." >&2
  echo "       Get one from https://cybersecpro.semihkilic.com/dashboard/agents" >&2
  exit 1
fi

case "${CSP_TOKEN}" in
  agt_*|eyJ*) : ;; # accept legacy agt_<hex> or JWT
  *) echo "ERROR: CSP_TOKEN looks malformed (expected agt_… or JWT)." >&2; exit 1 ;;
esac

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
echo "==> Detected ${OS}/${ARCH}"
echo "==> CyberSec Pro agent v1 installation"
echo "==> Token accepted; agent binary is in private beta."
echo "    Reach out: cybersecpro@semihkilic.com to get the binary."
exit 0
"#;
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "text/x-shellscript; charset=utf-8"),
            (header::CACHE_CONTROL, "public, max-age=300"),
        ],
        body,
    )
}

/// Serve a PowerShell install script for the reverse-tunnel agent on Windows.
pub async fn install_ps1() -> impl IntoResponse {
    let body = r#"# CyberSec Pro reverse-tunnel agent installer (Windows)
$ErrorActionPreference = 'Stop'

if (-not $env:CSP_TOKEN) {
  Write-Error "CSP_TOKEN environment variable is required. Get one from https://cybersecpro.semihkilic.com/dashboard/agents"
  exit 1
}

if ($env:CSP_TOKEN -notmatch '^(agt_|eyJ)') {
  Write-Error "CSP_TOKEN looks malformed (expected agt_... or JWT)."
  exit 1
}

Write-Host "==> CyberSec Pro agent v1 installation"
Write-Host "==> Token accepted; agent binary is in private beta."
Write-Host "    Reach out: cybersecpro@semihkilic.com to get the binary."
exit 0
"#;
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "text/plain; charset=utf-8"),
            (header::CACHE_CONTROL, "public, max-age=300"),
        ],
        body,
    )
}

#[cfg(test)]
mod tests {
    use super::{is_valid_agent_api_key_format, is_valid_agent_token_format, parse_heartbeat_metrics};
    use serde_json::json;

    // ── parse_heartbeat_metrics ──────────────────────────────────────────

    #[test]
    fn parse_heartbeat_metrics_reads_all_fields() {
        let body = json!({"cpu_usage": 55.5, "memory_usage": 72.3, "active_scans": 3});
        let (cpu, mem, active) = parse_heartbeat_metrics(&body);
        assert!((cpu - 55.5).abs() < f64::EPSILON);
        assert!((mem - 72.3).abs() < f64::EPSILON);
        assert_eq!(active, 3);
    }

    #[test]
    fn parse_heartbeat_metrics_defaults_to_zero_for_empty_body() {
        let (cpu, mem, active) = parse_heartbeat_metrics(&json!({}));
        assert_eq!(cpu, 0.0);
        assert_eq!(mem, 0.0);
        assert_eq!(active, 0);
    }

    #[test]
    fn parse_heartbeat_metrics_defaults_to_zero_for_non_numeric_fields() {
        let body = json!({"cpu_usage": "high", "memory_usage": null, "active_scans": false});
        let (cpu, mem, active) = parse_heartbeat_metrics(&body);
        assert_eq!(cpu, 0.0);
        assert_eq!(mem, 0.0);
        assert_eq!(active, 0);
    }

    #[test]
    fn parse_heartbeat_metrics_handles_zero_values_explicitly() {
        let body = json!({"cpu_usage": 0.0, "memory_usage": 0.0, "active_scans": 0});
        let (cpu, mem, active) = parse_heartbeat_metrics(&body);
        assert_eq!(cpu, 0.0);
        assert_eq!(mem, 0.0);
        assert_eq!(active, 0);
    }

    // ── is_valid_agent_token_format ────────────────────────────────────

    #[test]
    fn is_valid_agent_token_format_accepts_well_formed_token() {
        // 32 lowercase hex chars after "agt_"
        assert!(is_valid_agent_token_format("agt_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"));
    }

    #[test]
    fn is_valid_agent_token_format_rejects_wrong_prefix() {
        assert!(!is_valid_agent_token_format("ak_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"));
        assert!(!is_valid_agent_token_format("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"));
    }

    #[test]
    fn is_valid_agent_token_format_rejects_too_short_suffix() {
        assert!(!is_valid_agent_token_format("agt_a1b2c3"));
    }

    #[test]
    fn is_valid_agent_token_format_rejects_non_hex_chars() {
        // contains 'g' which is not hex
        assert!(!is_valid_agent_token_format("agt_g1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"));
    }

    // ── is_valid_agent_api_key_format ──────────────────────────────────

    #[test]
    fn is_valid_agent_api_key_format_accepts_well_formed_key() {
        assert!(is_valid_agent_api_key_format("ak_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"));
    }

    #[test]
    fn is_valid_agent_api_key_format_rejects_wrong_prefix() {
        assert!(!is_valid_agent_api_key_format("agt_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"));
    }

    #[test]
    fn is_valid_agent_api_key_format_rejects_non_hex_chars() {
        assert!(!is_valid_agent_api_key_format("ak_xyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxy"));
    }
}
