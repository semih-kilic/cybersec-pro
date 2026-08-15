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
    pub discovered_subnets: Option<JsonValue>,
    pub agent_docker_enabled: Option<bool>,
    pub auto_update: Option<bool>,
    // Common
    pub registration_token: Option<String>,
    pub api_key_hash: Option<String>,
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
    pub subnets: Vec<String>,
    pub network_zone: String,
    pub agent_docker_enabled: bool,
    pub max_concurrent_scans: i32,
    pub capabilities: Option<JsonValue>,
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
            subnets: self.discovered_subnets.as_ref()
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            network_zone: self.network_zone.clone().unwrap_or_else(|| "public".into()),
            agent_docker_enabled: self.agent_docker_enabled.unwrap_or(false),
            max_concurrent_scans: self.max_concurrent_scans.unwrap_or(5),
            capabilities: self.agent_capabilities.clone(),
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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_agent() -> Agent {
        Agent {
            id: "agt-001".into(),
            organization_id: "org-001".into(),
            name: "prod-agent".into(),
            hostname: None,
            ip_address: None,
            platform: None,
            os_info: None,
            version: None,
            status: None,
            connection_type: None,
            ssh_host: None,
            ssh_port: None,
            ssh_username: None,
            ssh_key_path: None,
            ssh_password_encrypted: None,
            vpn_config_path: None,
            vpn_status: None,
            vpn_assigned_ip: None,
            proxy_endpoint: None,
            proxy_api_key: None,
            proxy_protocol: None,
            agent_websocket_id: None,
            agent_capabilities: None,
            discovered_subnets: None,
            agent_docker_enabled: None,
            auto_update: None,
            registration_token: None,
            api_key_hash: None,
            last_heartbeat: None,
            cpu_usage: None,
            memory_usage: None,
            active_scans: None,
            total_scans: None,
            max_concurrent_scans: None,
            location: None,
            network_zone: None,
            created_at: None,
            updated_at: None,
        }
    }

    #[test]
    fn test_to_response_defaults() {
        let a = make_agent();
        let r = a.to_response();
        assert_eq!(r.id, "agt-001");
        assert_eq!(r.name, "prod-agent");
        assert_eq!(r.platform, "linux");
        assert_eq!(r.status, "pending");
        assert_eq!(r.connection_type, "direct");
        assert_eq!(r.network_zone, "public");
        assert_eq!(r.agent_docker_enabled, false);
        assert_eq!(r.max_concurrent_scans, 5);
        assert_eq!(r.cpu_usage, 0.0);
        assert_eq!(r.memory_usage, 0.0);
        assert_eq!(r.active_scans, 0);
        assert_eq!(r.total_scans, 0);
    }

    #[test]
    fn test_to_response_explicit_fields() {
        let mut a = make_agent();
        a.platform = Some("windows".into());
        a.status = Some("online".into());
        a.connection_type = Some("ssh".into());
        a.network_zone = Some("internal".into());
        a.agent_docker_enabled = Some(true);
        a.max_concurrent_scans = Some(10);
        a.cpu_usage = Some(42.5);
        a.memory_usage = Some(68.0);
        a.active_scans = Some(3);
        a.total_scans = Some(100);
        let r = a.to_response();
        assert_eq!(r.platform, "windows");
        assert_eq!(r.status, "online");
        assert_eq!(r.connection_type, "ssh");
        assert_eq!(r.network_zone, "internal");
        assert!(r.agent_docker_enabled);
        assert_eq!(r.max_concurrent_scans, 10);
        assert!((r.cpu_usage - 42.5).abs() < 0.01);
        assert_eq!(r.active_scans, 3);
        assert_eq!(r.total_scans, 100);
    }

    #[test]
    fn test_to_response_last_seen_none_when_no_heartbeat() {
        let a = make_agent();
        let r = a.to_response();
        assert!(r.last_seen.is_none());
    }

    #[test]
    fn test_to_response_last_seen_formatted_when_heartbeat_set() {
        let mut a = make_agent();
        a.last_heartbeat = chrono::NaiveDateTime::parse_from_str("2026-01-15 08:30:00", "%Y-%m-%d %H:%M:%S").ok();
        let r = a.to_response();
        assert_eq!(r.last_seen.as_deref(), Some("2026-01-15T08:30:00"));
    }
}
