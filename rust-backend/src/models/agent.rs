use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Agent {
    pub id: String,
    pub organization_id: String,
    pub name: String,
    pub hostname: Option<String>,
    pub ip_address: Option<String>,
    pub platform: Option<String>,
    pub os_info: Option<String>,
    pub version: Option<String>,
    pub status: Option<String>,
    pub connection_type: Option<String>,
    // SSH
    pub ssh_host: Option<String>,
    pub ssh_port: Option<i32>,
    pub ssh_username: Option<String>,
    pub ssh_key_path: Option<String>,
    pub ssh_password_encrypted: Option<String>,
    // VPN
    pub vpn_config_path: Option<String>,
    pub vpn_status: Option<String>,
    pub vpn_assigned_ip: Option<String>,
    // API Proxy
    pub proxy_endpoint: Option<String>,
    pub proxy_api_key: Option<String>,
    pub proxy_protocol: Option<String>,
    // Agent WebSocket
    pub agent_websocket_id: Option<String>,
    pub agent_capabilities: Option<JsonValue>,
    pub agent_docker_enabled: Option<bool>,
    pub auto_update: Option<bool>,
    // Common
    pub registration_token: Option<String>,
    pub api_key: Option<String>,
    pub last_heartbeat: Option<NaiveDateTime>,
    pub cpu_usage: Option<f32>,
    pub memory_usage: Option<f32>,
    pub active_scans: Option<i32>,
    pub total_scans: Option<i32>,
    pub max_concurrent_scans: Option<i32>,
    pub location: Option<String>,
    pub network_zone: Option<String>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize)]
pub struct AgentResponse {
    pub id: String,
    pub organization_id: String,
    pub name: String,
    pub hostname: Option<String>,
    pub ip_address: Option<String>,
    pub platform: String,
    pub os: Option<String>,
    pub version: Option<String>,
    pub status: String,
    pub connection_type: String,
    pub network_zone: String,
    pub agent_docker_enabled: bool,
    pub max_concurrent_scans: i32,
    pub last_seen: Option<String>,
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub active_scans: i32,
    pub total_scans: i32,
    pub location: Option<String>,
    pub created_at: Option<String>,
}

impl Agent {
    pub fn to_response(&self) -> AgentResponse {
        AgentResponse {
            id: self.id.clone(),
            organization_id: self.organization_id.clone(),
            name: self.name.clone(),
            hostname: self.hostname.clone(),
            ip_address: self.ip_address.clone(),
            platform: self.platform.clone().unwrap_or_else(|| "linux".into()),
            os: self.os_info.clone(),
            version: self.version.clone(),
            status: self.status.clone().unwrap_or_else(|| "pending".into()),
            connection_type: self.connection_type.clone().unwrap_or_else(|| "direct".into()),
            network_zone: self.network_zone.clone().unwrap_or_else(|| "public".into()),
            agent_docker_enabled: self.agent_docker_enabled.unwrap_or(false),
            max_concurrent_scans: self.max_concurrent_scans.unwrap_or(5),
            last_seen: self.last_heartbeat.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            cpu_usage: self.cpu_usage.unwrap_or(0.0) as f64,
            memory_usage: self.memory_usage.unwrap_or(0.0) as f64,
            active_scans: self.active_scans.unwrap_or(0),
            total_scans: self.total_scans.unwrap_or(0),
            location: self.location.clone(),
            created_at: self.created_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
        }
    }
}
