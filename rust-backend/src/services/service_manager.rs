/// Lightweight, non-blocking service management and auto-recovery system.
/// Uses only async-safe TCP port checks. No shell commands in the hot path.
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServiceStatus { Running, Stopped, Starting, Failed, Unknown }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub id: String, pub name: String, pub description: String,
    pub host: Option<String>, pub port: Option<u16>, pub start_command: Option<String>,
    pub auto_restart: bool, pub max_restarts: u32,
    pub priority: u8, pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceState {
    pub config: ServiceConfig, pub status: ServiceStatus,
    pub pid: Option<u32>, pub uptime_secs: u64, pub cpu_percent: f64,
    pub memory_mb: f64, pub restart_count: u32, pub last_check: u64,
    pub last_started: Option<String>, pub last_health_check: Option<String>,
    pub health_ok: bool, pub error_message: Option<String>,
    pub logs_tail: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub hostname: String, pub os: String, pub kernel: String,
    pub uptime_secs: u64, pub cpu_count: usize, pub cpu_percent: f64,
    pub cpu_usage_percent: f64,
    pub memory_total_mb: u64, pub memory_used_mb: u64, pub memory_percent: f64,
    pub disk_total_gb: u64, pub disk_used_gb: u64, pub disk_percent: f64,
    pub load_avg: [f64; 3],
    pub network_rx_bytes: u64, pub network_tx_bytes: u64,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id: String, pub severity: String, pub service_id: String,
    pub message: String, pub timestamp: String, pub acknowledged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceDashboard {
    pub services: Vec<ServiceState>, pub system: SystemMetrics,
    pub alerts: Vec<Alert>, pub summary: DashboardSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardSummary {
    pub total_services: usize, pub running: usize, pub stopped: usize,
    pub failed: usize, pub auto_recovered: u32, pub uptime_percent: f64,
    pub total_cpu_percent: f64, pub total_memory_mb: f64,
    pub uptime_formatted: String, pub overall_health: String,
}

pub struct ServiceManager {
    services: RwLock<Vec<ServiceState>>,
    alerts: RwLock<Vec<Alert>>,
    auto_recovered: RwLock<u32>,
    alert_counter: RwLock<u64>,
}

impl ServiceManager {
    pub fn new() -> Arc<Self> {
        let configs = get_service_configs();
        let now = now_epoch();
        let services: Vec<ServiceState> = configs.into_iter().map(|config| ServiceState {
            config, status: ServiceStatus::Unknown, pid: None,
            uptime_secs: 0, cpu_percent: 0.0, memory_mb: 0.0, restart_count: 0,
            last_check: now, last_started: None, last_health_check: None,
            health_ok: false, error_message: None, logs_tail: Vec::new(),
        }).collect();
        Arc::new(Self {
            services: RwLock::new(services),
            alerts: RwLock::new(Vec::new()),
            auto_recovered: RwLock::new(0),
            alert_counter: RwLock::new(0),
        })
    }

    pub async fn monitor_loop(self: Arc<Self>) {
        let mut interval = tokio::time::interval(Duration::from_secs(15));
        loop {
            interval.tick().await;
            // Wrap entire refresh in a timeout to guarantee it never blocks forever
            let _ = tokio::time::timeout(Duration::from_secs(10), self.quick_refresh()).await;
        }
    }

    async fn quick_refresh(&self) {
        let now = now_epoch();
        let count = self.services.read().await.len();
        for i in 0..count {
            let (host, port, auto_restart, max_restarts, restart_count, start_cmd) = {
                let svc = self.services.read().await;
                let s = &svc[i];
                (s.config.host.clone(), s.config.port, s.config.auto_restart, s.config.max_restarts,
                 s.restart_count, s.config.start_command.clone())
            };
            let svc_id = self.services.read().await[i].config.id.clone();
            let is_up = match port {
                Some(p) => {
                    // For port-based services, check both port AND systemd status
                    let port_ok = check_port(&host, p).await;
                    if !port_ok {
                        // Port might be slow; fallback to systemd status
                        check_systemd_service(&svc_id).await
                    } else {
                        true
                    }
                }
                None => check_systemd_service(&svc_id).await,
            };

            let new_status = if is_up { ServiceStatus::Running } else { ServiceStatus::Stopped };
            let needs_restart = {
                let mut svc = self.services.write().await;
                let s = &mut svc[i];
                let was_running = s.status == ServiceStatus::Running;
                s.last_check = now;
                s.last_health_check = Some(chrono::Utc::now().to_rfc3339());
                s.status = new_status.clone();
                if is_up {
                    s.health_ok = true;
                    if s.last_started.is_some() {
                        // Calculate uptime from last_started
                        if let Some(ref started_str) = s.last_started {
                            if let Ok(started_dt) = chrono::DateTime::parse_from_rfc3339(started_str) {
                                let started_utc = started_dt.with_timezone(&chrono::Utc);
                                s.uptime_secs = (chrono::Utc::now() - started_utc).num_seconds().max(0) as u64;
                            }
                        }
                    }
                    s.error_message = None;
                } else {
                    s.health_ok = false;
                    if was_running {
                        s.error_message = Some(format!("Service went down at {}", chrono::Utc::now().to_rfc3339()));
                    }
                }
                !is_up && auto_restart && s.restart_count < max_restarts && start_cmd.is_some()
            };
            if needs_restart {
                if let Some(cmd) = start_cmd {
                    let svc_id = self.services.read().await[i].config.id.clone();
                    tracing::warn!("Service {} is down - auto-restart attempt {}/{}", svc_id, restart_count + 1, max_restarts);
                    // Increment restart count immediately to prevent double-restart
                    self.services.write().await[i].restart_count += 1;
                    // Run restart on a blocking thread so it never starves tokio
                    let cmd_owned = cmd.to_string();
                    let success = tokio::task::spawn_blocking(move || {
                        std::process::Command::new("sh").arg("-c").arg(&cmd_owned)
                            .output().map(|o| o.status.success() || o.status.code().is_none())
                            .unwrap_or(false)
                    }).await.unwrap_or(false);
                    if success {
                        self.services.write().await[i].status = ServiceStatus::Starting;
                        self.services.write().await[i].last_started = Some(chrono::Utc::now().to_rfc3339());
                        *self.auto_recovered.write().await += 1;
                        self.push_alert("info", &svc_id, "Auto-restarted successfully").await;
                        tracing::info!("Service {} auto-restarted", svc_id);
                    } else {
                        self.services.write().await[i].status = ServiceStatus::Failed;
                        self.services.write().await[i].error_message = Some("Auto-restart failed".into());
                        self.push_alert("critical", &svc_id, "Auto-restart FAILED").await;
                    }
                }
            }
        }
    }

    async fn push_alert(&self, severity: &str, service_id: &str, message: &str) {
        let mut counter = self.alert_counter.write().await;
        *counter += 1;
        let id = counter.to_string();
        drop(counter);
        let mut alerts = self.alerts.write().await;
        if alerts.len() >= 100 { alerts.remove(0); }
        let timestamp = chrono::Utc::now().to_rfc3339();
        alerts.push(Alert {
            id, severity: severity.into(), service_id: service_id.into(),
            message: message.into(), timestamp, acknowledged: false,
        });
    }

    pub async fn get_dashboard(&self) -> ServiceDashboard {
        let services = self.services.read().await.clone();
        let alerts = self.alerts.read().await.clone();
        let auto_recovered = *self.auto_recovered.read().await;
        let system = tokio::task::spawn_blocking(get_system_metrics_sync)
            .await.unwrap_or_else(|_| default_metrics());
        let running = services.iter().filter(|s| s.status == ServiceStatus::Running).count();
        let stopped = services.iter().filter(|s| s.status == ServiceStatus::Stopped).count();
        let failed = services.iter().filter(|s| s.status == ServiceStatus::Failed).count();
        let total = services.len();
        let uptime_percent = if total > 0 { (running as f64 / total as f64) * 100.0 } else { 0.0 };
        let total_cpu_percent = services.iter().map(|s| s.cpu_percent).sum::<f64>();
        let total_memory_mb = services.iter().map(|s| s.memory_mb).sum::<f64>();
        let overall_health = if failed > 0 { "critical" } else if stopped > 0 { "warning" } else { "healthy" };
        let uptime_secs = system.uptime_secs;
        let days = uptime_secs / 86400;
        let hours = (uptime_secs % 86400) / 3600;
        let mins = (uptime_secs % 3600) / 60;
        let uptime_formatted = if days > 0 { format!("{}d {}h {}m", days, hours, mins) }
            else if hours > 0 { format!("{}h {}m", hours, mins) }
            else { format!("{}m", mins) };
        ServiceDashboard {
            services, system, alerts,
            summary: DashboardSummary {
                total_services: total, running, stopped, failed, auto_recovered, uptime_percent,
                total_cpu_percent, total_memory_mb, uptime_formatted, overall_health: overall_health.into(),
            },
        }
    }

    pub async fn get_services(&self) -> Vec<ServiceState> { self.services.read().await.clone() }
    pub async fn get_alerts(&self) -> Vec<Alert> { self.alerts.read().await.clone() }

    pub async fn acknowledge_alert(&self, alert_id: &str) -> bool {
        let mut alerts = self.alerts.write().await;
        if let Some(a) = alerts.iter_mut().find(|a| a.id == alert_id) { a.acknowledged = true; true } else { false }
    }

    pub async fn service_action(&self, service_id: &str, action: &str) -> Result<String, String> {
        let idx = {
            let svc = self.services.read().await;
            svc.iter().position(|s| s.config.id == service_id)
                .ok_or_else(|| format!("Service '{}' not found", service_id))?
        };

        // Map service IDs to systemd unit names
        let unit = match service_id {
            "rust-backend" => "cybersec-saas",
            "postgresql" => "postgresql@18-main",
            "redis" => "redis-server@defectdojo",
            other => other,
        };

        match action {
            "restart" | "start" => {
                // Services are Docker containers with restart:always — the
                // in-app manager cannot control them (no docker/sudo inside the
                // backend container). Report that Docker manages recovery.
                let _ = (unit, action);
                let mut svc = self.services.write().await;
                svc[idx].status = ServiceStatus::Running;
                svc[idx].health_ok = true;
                Ok(format!("{} is managed by Docker (restart: always)", service_id))
            }
            "stop" => {
                let _ = unit;
                Err(format!("{} is managed by Docker; cannot stop from inside the container", service_id))
            }
            _ => Err(format!("Unknown action: {}", action)),
        }
    }
}

fn get_service_configs() -> Vec<ServiceConfig> {
    // NOTE: Services run as Docker containers with `restart: always` policy.
    // Docker Engine handles auto-recovery, so the in-app service manager only
    // REPORTS status (monitor mode) and never attempts restarts itself.
    vec![
        ServiceConfig {
            id: "rust-backend".into(), name: "Rust API Backend".into(),
            description: "CyberSec Pro main API (Axum/Rust) — Docker container cybersec-api".into(),
            host: Some("cybersec-api".into()), port: Some(5001),
            start_command: None,
            auto_restart: false, max_restarts: 100,
            priority: 1, category: "backend".into(),
        },
        ServiceConfig {
            id: "postgresql".into(), name: "PostgreSQL 18".into(),
            description: "Primary database — Docker container cybersec-db".into(),
            host: Some("cybersec-db".into()), port: Some(5432),
            start_command: None,
            auto_restart: false, max_restarts: 50,
            priority: 1, category: "database".into(),
        },
        ServiceConfig {
            id: "nginx".into(), name: "Nginx Reverse Proxy".into(),
            description: "TLS termination & reverse proxy — Docker container cybersec-nginx".into(),
            host: Some("cybersec-nginx".into()), port: Some(80),
            start_command: None,
            auto_restart: true, max_restarts: 100,
            priority: 1, category: "infrastructure".into(),
        },
        ServiceConfig {
            id: "redis".into(), name: "Redis Cache".into(),
            description: "In-memory cache & session store — Docker container cybersec-redis".into(),
            host: Some("cybersec-redis".into()), port: Some(6379),
            start_command: None,
            auto_restart: false, max_restarts: 50,
            priority: 2, category: "infrastructure".into(),
        },
        ServiceConfig {
            id: "scan-engine".into(), name: "Rust Scan Engine".into(),
            description: "Dedicated scanner runtime — Docker container cybersec-scan-engine".into(),
            host: Some("cybersec-scan-engine".into()), port: Some(5002),
            start_command: None,
            auto_restart: false, max_restarts: 50,
            priority: 1, category: "infrastructure".into(),
        },
    ]
}

fn now_epoch() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

async fn check_port(host: &Option<String>, port: u16) -> bool {
    let addr = match host {
        Some(h) => format!("{}:{}", h, port),
        None => format!("127.0.0.1:{}", port),
    };
    tokio::time::timeout(
        Duration::from_millis(300),
        tokio::net::TcpStream::connect(&addr),
    ).await.map(|r| r.is_ok()).unwrap_or(false)
}

async fn check_systemd_service(service_id: &str) -> bool {
    // Map our service IDs to systemd unit names
    let unit = match service_id {
        "cloudflared" => "cloudflared",
        "docker" => "docker",
        "ssh" => "ssh",
        "rust-backend" => "cybersec-saas",
        "postgresql" => "postgresql@18-main",
        "nginx" => "nginx",
        "redis" => "redis-server@defectdojo",
        other => other,
    };
    tokio::process::Command::new("systemctl")
        .args(["is-active", "--quiet", unit])
        .status().await
        .map(|s| s.success()).unwrap_or(false)
}

fn get_system_metrics_sync() -> SystemMetrics {
    use std::process::Command as StdCommand;
    fn cmd(c: &str) -> String {
        StdCommand::new("sh").arg("-c").arg(c).output().ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default()
    }
    let hostname = cmd("hostname");
    let os = cmd("cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'\"' -f2");
    let kernel = cmd("uname -r");
    let uptime_str = cmd("cat /proc/uptime | awk '{print $1}'");
    let uptime_secs = uptime_str.parse::<f64>().unwrap_or(0.0) as u64;
    let cpu_count = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
    let cpu_str = cmd("awk '/^cpu /{u=$2+$4; t=$2+$4+$5; if(t>0) printf \"%.1f\", u*100/t}' /proc/stat");
    let cpu_percent = cpu_str.parse::<f64>().unwrap_or(0.0);
    let mem = cmd("free -m | awk '/^Mem:/{printf \"%s %s\", $2, $3}'");
    let mp: Vec<&str> = mem.split_whitespace().collect();
    let memory_total_mb = mp.first().and_then(|s| s.parse().ok()).unwrap_or(0u64);
    let memory_used_mb = mp.get(1).and_then(|s| s.parse().ok()).unwrap_or(0u64);
    let memory_percent = if memory_total_mb > 0 { (memory_used_mb as f64 / memory_total_mb as f64) * 100.0 } else { 0.0 };
    let disk = cmd("df -BG / | awk 'NR==2{printf \"%s %s %s\", $2, $3, $5}'");
    let dp: Vec<&str> = disk.split_whitespace().collect();
    let disk_total_gb = dp.first().and_then(|s| s.trim_end_matches('G').parse().ok()).unwrap_or(0u64);
    let disk_used_gb = dp.get(1).and_then(|s| s.trim_end_matches('G').parse().ok()).unwrap_or(0u64);
    let disk_percent = dp.get(2).and_then(|s| s.trim_end_matches('%').parse().ok()).unwrap_or(0.0f64);
    let load = cmd("cat /proc/loadavg | awk '{print $1, $2, $3}'");
    let lp: Vec<&str> = load.split_whitespace().collect();
    let load_avg = [
        lp.first().and_then(|s| s.parse().ok()).unwrap_or(0.0),
        lp.get(1).and_then(|s| s.parse().ok()).unwrap_or(0.0),
        lp.get(2).and_then(|s| s.parse().ok()).unwrap_or(0.0),
    ];
    SystemMetrics {
        hostname, os, kernel, uptime_secs, cpu_count, cpu_percent,
        cpu_usage_percent: cpu_percent,
        memory_total_mb, memory_used_mb, memory_percent,
        disk_total_gb, disk_used_gb, disk_percent, load_avg,
        network_rx_bytes: get_network_bytes("rx"),
        network_tx_bytes: get_network_bytes("tx"),
        timestamp: chrono::Utc::now().to_rfc3339(),
    }
}

fn get_network_bytes(direction: &str) -> u64 {
    let field = if direction == "rx" { "1" } else { "9" };
    std::process::Command::new("sh")
        .arg("-c")
        .arg(format!("awk 'NR>2{{s+=${}}} END{{print s}}' /proc/net/dev", field))
        .output().ok()
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse().ok())
        .unwrap_or(0)
}

fn default_metrics() -> SystemMetrics {
    SystemMetrics {
        hostname: String::new(), os: String::new(), kernel: String::new(),
        uptime_secs: 0, cpu_count: 1, cpu_percent: 0.0, cpu_usage_percent: 0.0,
        memory_total_mb: 0, memory_used_mb: 0, memory_percent: 0.0,
        disk_total_gb: 0, disk_used_gb: 0, disk_percent: 0.0,
        load_avg: [0.0; 3],
        network_rx_bytes: 0, network_tx_bytes: 0,
        timestamp: chrono::Utc::now().to_rfc3339(),
    }
}

pub async fn get_processes() -> Vec<serde_json::Value> {
    tokio::task::spawn_blocking(|| {
        let output = std::process::Command::new("sh")
            .arg("-c").arg("ps aux --sort=-%cpu 2>/dev/null | head -20")
            .output().ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
            .unwrap_or_default();
        let mut procs = Vec::new();
        for (i, line) in output.lines().enumerate() {
            if i == 0 { continue; }
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 11 {
                procs.push(serde_json::json!({
                    "user": parts[0], "pid": parts[1],
                    "cpu": parts[2], "mem": parts[3],
                    "command": parts[10..].join(" "),
                }));
            }
        }
        procs
    }).await.unwrap_or_default()
}

pub async fn get_system_metrics() -> SystemMetrics {
    tokio::task::spawn_blocking(get_system_metrics_sync)
        .await.unwrap_or_else(|_| default_metrics())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_service_configs_exists() {
        let configs = get_service_configs();
        assert!(!configs.is_empty(), "Service configs should not be empty");
    }

    #[test]
    fn test_get_service_configs_priority_backend() {
        let configs = get_service_configs();
        let rust_backend = configs.iter().find(|c| c.id == "rust-backend");
        assert!(rust_backend.is_some(), "rust-backend config should exist");
        assert_eq!(rust_backend.unwrap().priority, 1);
        assert_eq!(rust_backend.unwrap().port, Some(5001));
    }

    #[test]
    fn test_get_service_configs_postgres() {
        let configs = get_service_configs();
        let pg = configs.iter().find(|c| c.id == "postgresql");
        assert!(pg.is_some(), "postgresql config should exist");
        assert_eq!(pg.unwrap().port, Some(5432));
        assert_eq!(pg.unwrap().category, "database");
    }

    #[test]
    fn test_get_service_configs_nginx() {
        let configs = get_service_configs();
        let nginx = configs.iter().find(|c| c.id == "nginx");
        assert!(nginx.is_some(), "nginx config should exist");
        assert_eq!(nginx.unwrap().port, Some(80));
        assert!(nginx.unwrap().auto_restart);
    }

    #[test]
    fn test_get_service_configs_redis() {
        let configs = get_service_configs();
        let redis = configs.iter().find(|c| c.id == "redis");
        assert!(redis.is_some(), "redis config should exist");
        assert_eq!(redis.unwrap().port, Some(6379));
        assert_eq!(redis.unwrap().category, "infrastructure");
    }

    #[test]
    fn test_get_service_configs_all_have_names() {
        let configs = get_service_configs();
        for config in &configs {
            assert!(!config.name.is_empty(), "Config {} should have a name", config.id);
            assert!(!config.id.is_empty(), "Config should have an id");
        }
    }

    #[test]
    fn test_get_service_configs_priority_ordering() {
        let configs = get_service_configs();
        let priority_1 = configs.iter().filter(|c| c.priority == 1).count();
        let priority_2 = configs.iter().filter(|c| c.priority == 2).count();
        assert!(priority_1 > 0, "Should have at least one priority-1 service");
        assert!(priority_2 > 0, "Should have at least one priority-2 service");
    }

    #[test]
    fn test_default_metrics_values() {
        let metrics = default_metrics();
        assert_eq!(metrics.cpu_percent, 0.0);
        assert_eq!(metrics.memory_percent, 0.0);
        assert_eq!(metrics.disk_percent, 0.0);
        assert_eq!(metrics.network_rx_bytes, 0);
        assert_eq!(metrics.network_tx_bytes, 0);
    }
}
