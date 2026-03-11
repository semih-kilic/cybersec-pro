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
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let agents: Vec<Agent> = sqlx::query_as(
        "SELECT * FROM agents WHERE organization_id = $1 ORDER BY created_at DESC"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

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

    let agent_id = Uuid::new_v4().to_string();
    let reg_token = format!("agt_{}", Uuid::new_v4().to_string().replace('-', ""));
    let api_key = format!("ak_{}", Uuid::new_v4().to_string().replace('-', ""));
    let conn_type = body.connection_type.as_deref().unwrap_or("direct");

    let _ = sqlx::query(
        "INSERT INTO agents (id, organization_id, name, connection_type, hostname, ip_address, platform, network_zone, max_concurrent_scans, ssh_host, ssh_port, ssh_username, vpn_config_path, proxy_endpoint, registration_token, api_key, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pending')"
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
