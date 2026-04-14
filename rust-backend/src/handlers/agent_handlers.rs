use axum::{
    extract::{Path, State},
    http::StatusCode,
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
    let cpu = body.get("cpu_usage").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let mem = body.get("memory_usage").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let active = body.get("active_scans").and_then(|v| v.as_i64()).unwrap_or(0);

    let _ = sqlx::query(
        "UPDATE agents SET status = 'online', last_heartbeat = CURRENT_TIMESTAMP, cpu_usage = $1, memory_usage = $2, active_scans = $3 WHERE id = $4"
    )
    .bind(cpu)
    .bind(mem)
    .bind(active as i32)
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
