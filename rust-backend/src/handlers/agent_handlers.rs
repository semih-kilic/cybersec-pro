use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
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

/// Returns the HMAC secret used for agent enrollment JWTs. Requires `JWT_SECRET_KEY`
/// (the canonical app-wide secret loaded by main.rs from .env). Fails closed rather
/// than falling back to a predictable default — a misconfigured environment must
/// not silently weaken enrollment token signatures.
fn jwt_secret() -> String {
    std::env::var("JWT_SECRET_KEY").expect(
        "JWT_SECRET_KEY must be set: refusing to sign agent enrollment tokens with a default secret",
    )
}

/// Returns the symmetric key used to encrypt SSH passwords stored in the `agents`
/// table. Kept separate from `jwt_secret()` so we don't break decryption of
/// passwords already in the DB when the JWT signing secret rotates. Requires
/// `JWT_SECRET_KEY` — fails closed on missing config instead of a known default.
/// Key used to encrypt secrets at rest (agent SSH credentials, SSO secrets).
///
/// AUDIT 2026-08-29 — this used to return `JWT_SECRET_KEY`, so one value both
/// signed every session token and encrypted every stored credential. That
/// couples two things with opposite lifecycles: rotating the JWT secret is
/// routine (and mandatory after a token leak — we did exactly that during this
/// audit), but doing so would have made every stored SSH credential
/// permanently undecryptable, with no error until someone tried to use an agent.
///
/// `ENCRYPTION_KEY` is now separate. `JWT_SECRET_KEY` is still accepted as a
/// fallback so existing ciphertext keeps working, with a warning.
pub(crate) fn password_encryption_key() -> String {
    if let Ok(k) = std::env::var("ENCRYPTION_KEY") {
        if k.trim().len() >= 32 {
            return k;
        }
        tracing::error!("ENCRYPTION_KEY is set but shorter than 32 characters; ignoring it");
    }
    // Legacy path: secrets encrypted before ENCRYPTION_KEY existed.
    std::env::var("JWT_SECRET_KEY")
        .or_else(|_| std::env::var("JWT_SECRET"))
        .map(|k| {
            tracing::warn!(
                "ENCRYPTION_KEY is not set; falling back to JWT_SECRET_KEY for secret encryption. \
                 Rotating the JWT secret will make stored credentials undecryptable — set \
                 ENCRYPTION_KEY to decouple them."
            );
            k
        })
        .unwrap_or_else(|_| {
            panic!("ENCRYPTION_KEY or JWT_SECRET_KEY must be set: refusing to encrypt secrets with a default")
        })
}

/// Extracts a Bearer token from the Authorization header.
fn bearer_from_headers(headers: &HeaderMap) -> Option<String> {
    headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|s| s.trim().to_string())
}

/// Hashes an agent API key for storage using SHA-256. The plaintext key is
/// returned to the agent exactly once at enrollment and never persisted.
fn hash_agent_api_key(key: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(key.as_bytes());
    format!("{:x}", h.finalize())
}

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
#[allow(dead_code)] // Public validator covered by tests; called by future agent-onboarding handler.
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
    pub ssh_passphrase: Option<String>,
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
    let api_key_hash = hash_agent_api_key(&api_key);
    let conn_type = body.connection_type.as_deref().unwrap_or("direct");

    // Encrypt SSH password if provided
    let encrypted_password = body.ssh_password.as_ref().and_then(|pwd| {
        if pwd.is_empty() { return None; }
        let secret = password_encryption_key();
        crate::services::connection_engine::crypto::encrypt_password(pwd, &secret).ok()
    });

    let encrypted_passphrase = body.ssh_passphrase.as_ref().and_then(|pwd| {
        if pwd.is_empty() { return None; }
        let secret = password_encryption_key();
        crate::services::connection_engine::crypto::encrypt_password(pwd, &secret).ok()
    });

    let _ = sqlx::query(
        "INSERT INTO agents (id, organization_id, name, connection_type, hostname, ip_address, platform, network_zone, max_concurrent_scans, ssh_host, ssh_port, ssh_username, ssh_password_encrypted, ssh_passphrase_encrypted, ssh_key_path, location, vpn_config_path, proxy_endpoint, registration_token, api_key_hash, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'pending')"
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
    .bind(&encrypted_passphrase)
    .bind(&body.ssh_key)
    .bind(&body.location)
    .bind(&body.vpn_config_path)
    .bind(&body.proxy_endpoint)
    .bind(&reg_token)
    .bind(&api_key_hash)
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

    // Verify agent exists and belongs to this org
    let existing = sqlx::query_scalar::<_, String>("SELECT id FROM agents WHERE id = $1 AND organization_id = $2")
        .bind(&agent_id)
        .bind(org_id)
        .fetch_optional(&state.db)
        .await;

    match existing {
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({"error": "Agent not found"}))).into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", e)}))).into_response(),
        _ => {}
    }

    // Delete dependent rows first (scans, scheduled_scans reference agents without CASCADE)
    let _ = sqlx::query("DELETE FROM scans WHERE agent_id = $1")
        .bind(&agent_id)
        .execute(&state.db)
        .await;
    let _ = sqlx::query("DELETE FROM scheduled_scans WHERE agent_id = $1")
        .bind(&agent_id)
        .execute(&state.db)
        .await;
    // agent_jobs has ON DELETE CASCADE, but delete explicitly to be safe
    let _ = sqlx::query("DELETE FROM agent_jobs WHERE agent_id = $1")
        .bind(&agent_id)
        .execute(&state.db)
        .await;

    let result = sqlx::query("DELETE FROM agents WHERE id = $1 AND organization_id = $2")
        .bind(&agent_id)
        .bind(org_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => Json(json!({"message": "Agent deleted"})).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Agent not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to delete agent: {}", e)}))).into_response(),
    }
}

pub async fn agent_heartbeat(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
    headers: HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Authenticate via the Bearer api_key issued at enrollment. The api_key is
    // bound to the agent row and never leaves the agent — this prevents anyone
    // who knows an agent_id from spoofing heartbeats. Only the SHA-256 hash of
    // the key is stored; the presented key is hashed and compared constant-time.
    let presented = match bearer_from_headers(&headers) {
        Some(k) if is_valid_agent_api_key_format(&k) => k,
        _ => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Missing or malformed Bearer api_key"}))).into_response(),
    };
    let presented_hash = hash_agent_api_key(&presented);

    let row: Option<(String,)> = sqlx::query_as(
        "SELECT api_key_hash FROM agents WHERE id = $1"
    )
    .bind(&agent_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let stored = match row.and_then(|(k,)| Some(k)) {
        Some(k) if !k.is_empty() => k,
        _ => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unknown agent"}))).into_response(),
    };

    // Constant-time compare to avoid timing oracles on api_key.
    if !constant_time_eq(stored.as_bytes(), presented_hash.as_bytes()) {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid api_key"}))).into_response();
    }

    let (cpu, mem, active) = parse_heartbeat_metrics(&body);

    // Extract first non-loopback IP from heartbeat
    let ip_address = body.get("ip_addresses")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let subnets: Vec<String> = body.get("subnets")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
        .unwrap_or_default();

    // Tool manifest: agent reports installed security tools so the scheduler
    // only queues jobs the agent can actually run (tool capabilities).
    let capabilities: Option<serde_json::Value> = body
        .get("tools")
        .filter(|v| v.is_array())
        .cloned();

    let _ = sqlx::query(
        "UPDATE agents SET status = 'online', last_heartbeat = CURRENT_TIMESTAMP, cpu_usage = $1, memory_usage = $2, active_scans = $3, ip_address = COALESCE($5, ip_address), discovered_subnets = $6, agent_capabilities = COALESCE($7, agent_capabilities) WHERE id = $4"
    )
    .bind(cpu)
    .bind(mem)
    .bind(active)
    .bind(&agent_id)
    .bind(&ip_address)
    .bind(serde_json::to_value(&subnets).unwrap_or(json!([])))
    .bind(&capabilities)
    .execute(&state.db)
    .await;

    Json(json!({"status": "ok"})).into_response()
}

/// Constant-time byte comparison.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() { return false; }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) { diff |= x ^ y; }
    diff == 0
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
        let secret = password_encryption_key();
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
    let secret = jwt_secret();
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

    let secret = jwt_secret();
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
    let api_key_hash = hash_agent_api_key(&api_key);
    let name = format!("agent-{}", &agent_id[..8]);
    // Store SHA-256 hash of the enrollment JWT (not the raw token) so the
    // unique constraint enforces single-use without persisting credentials.
    let token_hash = {
        use sha2::{Digest, Sha256};
        let mut h = Sha256::new();
        h.update(token.as_bytes());
        format!("sha256:{:x}", h.finalize())
    };

    // status='pending' until the first heartbeat flips it to 'online'.
    let res = sqlx::query(
        "INSERT INTO agents (id, organization_id, name, connection_type, hostname, platform, network_zone, max_concurrent_scans, registration_token, api_key_hash, status)
         VALUES ($1, $2, $3, 'reverse_tunnel', $4, $5, 'public', 5, $6, $7, 'pending')"
    )
    .bind(&agent_id)
    .bind(&org_id)
    .bind(&name)
    .bind(&hostname)
    .bind(&platform)
    .bind(&token_hash)
    .bind(&api_key_hash)
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

/// Serve the agent binary for the requested platform.
///
/// Files live under `AGENT_BIN_DIR` (default `/home/cybersec/cybersec-pro/agent-binaries`).
/// Naming convention: `cybersec-agent-<os>-<arch>` (e.g. `cybersec-agent-linux-amd64`).
/// Public endpoint — the binary itself is harmless without an enrollment JWT.
pub async fn agent_binary(
    Path(platform): Path<String>,
) -> impl IntoResponse {
    // Whitelist platform names — must match `cybersec-agent-(linux|darwin|windows)-(amd64|arm64)(\.exe)?`.
    let allowed = [
        "linux-amd64", "linux-arm64",
        "darwin-amd64", "darwin-arm64", "darwin-universal",
        "windows-amd64.exe", "windows-arm64.exe",
        "windows-amd64", "windows-arm64",
    ];
    if !allowed.iter().any(|p| *p == platform.as_str()) {
        return (StatusCode::NOT_FOUND, Json(json!({"error": "Unsupported platform"}))).into_response();
    }
    let dir = std::env::var("AGENT_BIN_DIR")
        .unwrap_or_else(|_| "/home/cybersec/cybersec-pro/agent-binaries".to_string());
    // Try exact name first, then with .exe appended, then with .exe stripped
    let base = format!("cybersec-agent-{platform}");
    let dir_path = std::path::PathBuf::from(&dir);
    let path_exact = dir_path.join(&base);
    let path_with_exe = dir_path.join(format!("{base}.exe"));
    let path_noext = dir_path.join(base.trim_end_matches(".exe"));
    let path = if path_exact.exists() {
        path_exact
    } else if path_with_exe.exists() {
        path_with_exe
    } else {
        path_noext
    };
    let bytes = match tokio::fs::read(&path).await {
        Ok(b) => b,
        Err(_) => return (StatusCode::NOT_FOUND, Json(json!({
            "error": "Binary not yet available for this platform — contact support@cyber-sec-pro.com"
        }))).into_response(),
    };
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/octet-stream"),
            (header::CACHE_CONTROL, "public, max-age=300"),
        ],
        bytes,
    ).into_response()
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
  echo "       Get one from https://app.cyber-sec-pro.com/dashboard/agents" >&2
  exit 1
fi

case "${CSP_TOKEN}" in
  agt_*|eyJ*) : ;; # accept legacy agt_<hex> or JWT
  *) echo "ERROR: CSP_TOKEN looks malformed (expected agt_… or JWT)." >&2; exit 1 ;;
esac

API="${CSP_API_URL:-https://app.cyber-sec-pro.com}"
OS_RAW="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "${OS_RAW}" in
  linux) OS=linux ;;
  darwin) OS=darwin ;;
  *) echo "ERROR: unsupported OS '${OS_RAW}'" >&2; exit 1 ;;
esac
ARCH_RAW="$(uname -m)"
case "${ARCH_RAW}" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "ERROR: unsupported arch '${ARCH_RAW}'" >&2; exit 1 ;;
esac

INSTALL_DIR="${CSP_INSTALL_DIR:-${HOME}/.cybersec-agent}"
mkdir -p "${INSTALL_DIR}"
BIN="${INSTALL_DIR}/cybersec-agent"
URL="${API}/api/v1/agents/binary/${OS}-${ARCH}"
echo "==> Downloading ${URL}"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL -o "${BIN}" "${URL}"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "${BIN}" "${URL}"
else
  echo "ERROR: need curl or wget" >&2; exit 1
fi
chmod +x "${BIN}"
echo "==> Installed to ${BIN}"

# Try to install systemd unit if running as root and systemd is available.
if [ "$(id -u)" = "0" ] && command -v systemctl >/dev/null 2>&1; then
  cat > /etc/systemd/system/cybersec-agent.service <<UNIT
[Unit]
Description=CyberSec Pro reverse-tunnel agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=CSP_TOKEN=${CSP_TOKEN}
Environment=CSP_API_URL=${API}
ExecStart=${BIN}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable --now cybersec-agent.service
  echo "==> systemd unit installed and started"
else
  echo "==> Run manually: CSP_TOKEN=${CSP_TOKEN} CSP_API_URL=${API} ${BIN}"
fi
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
    let body = r#"# CyberSec Pro reverse-tunnel agent installer (Windows / PowerShell 5+)
$ErrorActionPreference = 'Stop'

if (-not $env:CSP_TOKEN) {
  Write-Error "CSP_TOKEN environment variable is required. Get one from https://app.cyber-sec-pro.com/dashboard/agents"
  exit 1
}

$Api = if ($env:CSP_API_URL) { $env:CSP_API_URL } else { 'https://app.cyber-sec-pro.com' }
$Arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }
$Dir  = Join-Path $env:LOCALAPPDATA 'CyberSecAgent'
$Bin  = Join-Path $Dir 'cybersec-agent.exe'
$State = Join-Path $Dir 'state.json'

# 1. Kill any running agent and wipe stale state so re-enrollment is clean.
Get-Process -Name 'cybersec-agent' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Stop-ScheduledTask -TaskName 'CyberSecAgent' -ErrorAction SilentlyContinue
if (Test-Path $State) { Remove-Item $State -Force }

New-Item -ItemType Directory -Force -Path $Dir | Out-Null

# 2. Download binary.
$Url = "$Api/api/v1/agents/binary/windows-$Arch"
Write-Host "==> Downloading $Url"
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $Url -OutFile $Bin -UseBasicParsing
if (-not (Test-Path $Bin)) { Write-Error "Download failed."; exit 1 }
Write-Host "==> Installed: $Bin"

# 3. Write wrapper that sets env vars and restarts on exit code 10 (re-enroll).
$Wrapper = Join-Path $Dir 'run-agent.ps1'
@"
`$env:CSP_TOKEN   = '$($env:CSP_TOKEN)'
`$env:CSP_API_URL = '$Api'
while (`$true) {
    & '$Bin'
    if (`$LASTEXITCODE -ne 10) { break }
    Write-Host '[agent] Re-enrolling...'
    Start-Sleep -Seconds 2
}
"@ | Set-Content -Path $Wrapper -Encoding UTF8

# 4. Register scheduled task.
$Action   = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Wrapper`""
$Trigger  = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
try {
  Register-ScheduledTask -TaskName 'CyberSecAgent' -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force | Out-Null
  Start-ScheduledTask -TaskName 'CyberSecAgent'
  Write-Host "==> Agent started. It will appear online in the dashboard within ~30 seconds."
} catch {
  Write-Warning "Scheduled task failed: $_. Starting directly..."
  Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$Wrapper`"" -WindowStyle Hidden
}
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

// ── Reverse-tunnel job channel ─────────────────────────────────────────
// Agents authenticated with Bearer api_key long-poll for new commands and POST
// back the captured stdout/stderr/exit_code. The control plane queues commands
// via `queue_agent_job` (called from scan_handlers when agent.connection_type =
// 'reverse_tunnel') or directly by an admin via POST /agents/:id/jobs.

/// Authenticates an agent request via Bearer api_key and confirms the agent
/// row exists. Returns the agent's `organization_id` on success.
async fn authenticate_agent(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    agent_id: &str,
) -> Result<String, (StatusCode, Json<serde_json::Value>)> {
    let presented = match bearer_from_headers(headers) {
        Some(k) if is_valid_agent_api_key_format(&k) => k,
        _ => return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "Missing or malformed Bearer api_key"})))),
    };
    let presented_hash = hash_agent_api_key(&presented);

    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT api_key_hash, organization_id FROM agents WHERE id = $1"
    )
    .bind(agent_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (stored, org_id) = match row {
        Some((k, o)) if !k.is_empty() => (k, o),
        _ => return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "Unknown agent"})))),
    };

    if !constant_time_eq(stored.as_bytes(), presented_hash.as_bytes()) {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid api_key"}))));
    }
    Ok(org_id)
}

/// GET /api/v1/agents/:agent_id/jobs/next — long-poll up to 25s for the next
/// pending job for this agent. Atomically claims the job (status -> 'claimed').
/// Returns 204 No Content if no job appears within the poll window.
pub async fn agent_next_job(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(e) = authenticate_agent(&state, &headers, &agent_id).await {
        return e.into_response();
    }

    // Long-poll: try up to 25 times with 1s sleep between attempts.
    for _ in 0..25 {
        let claimed: Option<(String, String, Option<String>, Option<String>, i32, Option<serde_json::Value>)> = sqlx::query_as(
            "UPDATE agent_jobs SET status = 'claimed', claimed_at = now() \
             WHERE id = ( \
                 SELECT id FROM agent_jobs \
                 WHERE agent_id = $1 AND status = 'pending' \
                 ORDER BY created_at ASC \
                 FOR UPDATE SKIP LOCKED \
                 LIMIT 1 \
             ) \
             RETURNING id, command, scan_id, tool_id, timeout_seconds, args"
        )
        .bind(&agent_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

        if let Some((job_id, command, scan_id, tool_id, timeout_seconds, args)) = claimed {
            return (StatusCode::OK, Json(json!({
                "job_id": job_id,
                "command": command,
                "scan_id": scan_id,
                "tool_id": tool_id,
                "timeout_seconds": timeout_seconds,
                "args": args,
            }))).into_response();
        }

        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }

    StatusCode::NO_CONTENT.into_response()
}

/// POST /api/v1/agents/:agent_id/jobs/:job_id/result — agent reports outcome.
pub async fn agent_job_result(
    State(state): State<Arc<AppState>>,
    Path((agent_id, job_id)): Path<(String, String)>,
    headers: HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    if let Err(e) = authenticate_agent(&state, &headers, &agent_id).await {
        return e.into_response();
    }

    // Cap stored output at 1 MiB each to avoid runaway rows from misbehaving agents.
    const MAX_OUTPUT_BYTES: usize = 1_048_576;
    let truncate = |s: Option<&str>| -> Option<String> {
        s.map(|v| {
            if v.len() > MAX_OUTPUT_BYTES {
                // Agent stdout is arbitrary tool output and routinely contains
                // non-ASCII; `&v[..MAX_OUTPUT_BYTES]` panicked on a multi-byte
                // boundary.
                format!(
                    "{}\n...[truncated {} bytes]",
                    crate::services::net::truncate_bytes(v, MAX_OUTPUT_BYTES),
                    v.len() - MAX_OUTPUT_BYTES
                )
            } else {
                v.to_string()
            }
        })
    };

    let exit_code = body.get("exit_code").and_then(|v| v.as_i64()).map(|v| v as i32);
    let stdout = truncate(body.get("stdout").and_then(|v| v.as_str()));
    let stderr = truncate(body.get("stderr").and_then(|v| v.as_str()));
    let raw_status = body.get("status").and_then(|v| v.as_str()).unwrap_or("completed");
    let status = match raw_status {
        "completed" | "failed" | "timeout" | "cancelled" => raw_status,
        _ => "completed",
    };

    let updated = sqlx::query(
        "UPDATE agent_jobs \
         SET status = $1, exit_code = $2, stdout = $3, stderr = $4, completed_at = now() \
         WHERE id = $5 AND agent_id = $6 AND status IN ('pending','claimed','running')"
    )
    .bind(status)
    .bind(exit_code)
    .bind(&stdout)
    .bind(&stderr)
    .bind(&job_id)
    .bind(&agent_id)
    .execute(&state.db)
    .await;

    match updated {
        Ok(r) if r.rows_affected() == 1 => (StatusCode::OK, Json(json!({"status":"ok"}))).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error":"Job not found or already finalized"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}


#[derive(Deserialize)]
pub struct QueueJobBody {
    pub command: String,
    #[serde(default)]
    pub tool_id: Option<String>,
    #[serde(default)]
    pub scan_id: Option<String>,
    #[serde(default)]
    pub timeout_seconds: Option<i32>,
}

/// POST /api/v1/agents/:agent_id/jobs — operator queues a command for the
/// reverse-tunnel agent to execute. The agent must belong to the operator's org.
pub async fn queue_agent_job(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
    auth: AuthUser,
    Json(body): Json<QueueJobBody>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(o) => o.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error":"Org context required"}))).into_response(),
    };

    // Confirm the agent is in the caller's org and is a reverse-tunnel agent.
    let row: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT organization_id, connection_type FROM agents WHERE id = $1"
    )
    .bind(&agent_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (agent_org, conn_type) = match row {
        Some(r) => r,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error":"Agent not found"}))).into_response(),
    };
    if agent_org != org_id {
        return (StatusCode::FORBIDDEN, Json(json!({"error":"Agent is not in your organization"}))).into_response();
    }
    if conn_type.as_deref() != Some("reverse_tunnel") {
        return (StatusCode::BAD_REQUEST, Json(json!({"error":"Agent is not a reverse-tunnel agent"}))).into_response();
    }

    // Reject command strings with shell metachars that would let a tenant
    // string commands together. Match the policy used by start_scan substitution.
    let cmd = body.command.trim();
    if cmd.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error":"Empty command"}))).into_response();
    }
    if cmd.contains("$(") || cmd.contains("`") || cmd.contains("&&")
        || cmd.contains("||") || cmd.contains(';') || cmd.contains('|')
        || cmd.contains('\n') || cmd.contains('\r')
    {
        return (StatusCode::BAD_REQUEST, Json(json!({"error":"Command contains forbidden shell metacharacters"}))).into_response();
    }

    let job_id = Uuid::new_v4().to_string();
    let timeout = body.timeout_seconds.unwrap_or(600).clamp(10, 3600);

    let res = sqlx::query(
        "INSERT INTO agent_jobs (id, agent_id, organization_id, scan_id, tool_id, command, timeout_seconds, status) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')"
    )
    .bind(&job_id)
    .bind(&agent_id)
    .bind(&org_id)
    .bind(&body.scan_id)
    .bind(&body.tool_id)
    .bind(cmd)
    .bind(timeout)
    .execute(&state.db)
    .await;

    match res {
        Ok(_) => (StatusCode::CREATED, Json(json!({"job_id": job_id, "status":"pending"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct ListJobsQuery {
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default = "default_jobs_limit")]
    pub limit: i64,
}

fn default_jobs_limit() -> i64 { 50 }

/// GET /api/v1/agents/jobs — recent reverse-tunnel agent jobs for the
/// caller's organization. Optional filters: agent_id, status, limit (1..=200).
pub async fn list_agent_jobs(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Query(q): Query<ListJobsQuery>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(o) => o.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error":"Org context required"}))).into_response(),
    };
    let limit = q.limit.clamp(1, 200);

    // Build dynamic WHERE — keep parameter binding ordered.
    let mut sql = String::from(
        "SELECT j.id, j.agent_id, COALESCE(a.name, j.agent_id) AS agent_name, \
                j.scan_id, j.tool_id, j.command, j.status, j.exit_code, \
                j.timeout_seconds, \
                CAST(j.created_at AS TEXT)   AS created_at, \
                CAST(j.claimed_at AS TEXT)   AS claimed_at, \
                CAST(j.completed_at AS TEXT) AS completed_at, \
                COALESCE(LENGTH(j.stdout), 0)::int AS stdout_bytes, \
                COALESCE(LENGTH(j.stderr), 0)::int AS stderr_bytes \
         FROM agent_jobs j \
         LEFT JOIN agents a ON a.id = j.agent_id \
         WHERE j.organization_id = $1"
    );
    let mut idx = 2;
    if q.agent_id.is_some() { sql.push_str(&format!(" AND j.agent_id = ${}", idx)); idx += 1; }
    if q.status.is_some()   { sql.push_str(&format!(" AND j.status   = ${}", idx)); idx += 1; }
    sql.push_str(&format!(" ORDER BY j.created_at DESC LIMIT ${}", idx));

    let mut query = sqlx::query_as::<_, (
        String, String, String,
        Option<String>, Option<String>, String, String, Option<i32>, i32,
        Option<String>, Option<String>, Option<String>,
        i32, i32,
    )>(&sql).bind(&org_id);
    if let Some(a) = &q.agent_id { query = query.bind(a); }
    if let Some(s) = &q.status   { query = query.bind(s); }
    query = query.bind(limit);

    match query.fetch_all(&state.db).await {
        Ok(rows) => {
            let jobs: Vec<_> = rows.into_iter().map(|(
                id, agent_id, agent_name, scan_id, tool_id, command, status, exit_code, timeout_seconds,
                created_at, claimed_at, completed_at, stdout_bytes, stderr_bytes,
            )| json!({
                "id": id,
                "agent_id": agent_id,
                "agent_name": agent_name,
                "scan_id": scan_id,
                "tool_id": tool_id,
                "command": command.chars().take(500).collect::<String>(),
                "status": status,
                "exit_code": exit_code,
                "timeout_seconds": timeout_seconds,
                "created_at": created_at,
                "claimed_at": claimed_at,
                "completed_at": completed_at,
                "stdout_bytes": stdout_bytes,
                "stderr_bytes": stderr_bytes,
            })).collect();

            // Quick org-scoped status counters for the dashboard header.
            let counts: Vec<(String, i64)> = sqlx::query_as(
                "SELECT status, COUNT(*)::bigint FROM agent_jobs WHERE organization_id = $1 GROUP BY status"
            )
            .bind(&org_id)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();
            let mut by_status = serde_json::Map::new();
            for (s, c) in counts { by_status.insert(s, json!(c)); }

            Json(json!({"jobs": jobs, "by_status": by_status, "limit": limit})).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
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
