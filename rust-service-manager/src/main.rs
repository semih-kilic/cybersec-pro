// CyberSec Pro — Service Manager Daemon
// World-class service orchestration + monitoring + super admin API
// Built in Rust for maximum performance and reliability

use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use std::sync::Arc;
use sysinfo::System;
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};

// ================================
// DATA MODELS
// ================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub command: String,
    pub working_dir: String,
    pub port: Option<u16>,
    pub health_endpoint: Option<String>,
    pub auto_restart: bool,
    pub max_restarts: u32,
    pub restart_delay_secs: u64,
    pub category: ServiceCategory,
    pub priority: u8, // 1=critical, 2=high, 3=normal, 4=low
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServiceCategory {
    Core,
    Backend,
    Frontend,
    Database,
    Cache,
    Monitoring,
    Security,
    Network,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServiceStatus {
    Running,
    Stopped,
    Starting,
    Stopping,
    Failed,
    Degraded,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceState {
    pub config: ServiceConfig,
    pub status: ServiceStatus,
    pub pid: Option<u32>,
    pub uptime_secs: Option<u64>,
    pub cpu_percent: f32,
    pub memory_mb: f64,
    pub restart_count: u32,
    pub last_started: Option<DateTime<Utc>>,
    pub last_stopped: Option<DateTime<Utc>>,
    pub last_health_check: Option<DateTime<Utc>>,
    pub health_ok: bool,
    pub error_message: Option<String>,
    pub logs_tail: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub hostname: String,
    pub os: String,
    pub kernel: String,
    pub uptime_secs: u64,
    pub cpu_count: usize,
    pub cpu_usage_percent: f32,
    pub memory_total_mb: u64,
    pub memory_used_mb: u64,
    pub memory_percent: f32,
    pub disk_total_gb: f64,
    pub disk_used_gb: f64,
    pub disk_percent: f32,
    pub load_avg: [f64; 3],
    pub network_rx_bytes: u64,
    pub network_tx_bytes: u64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuperAdminDashboard {
    pub system: SystemMetrics,
    pub services: Vec<ServiceState>,
    pub alerts: Vec<Alert>,
    pub summary: DashboardSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardSummary {
    pub total_services: usize,
    pub running: usize,
    pub stopped: usize,
    pub failed: usize,
    pub total_cpu_percent: f32,
    pub total_memory_mb: f64,
    pub uptime_formatted: String,
    pub overall_health: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id: String,
    pub severity: AlertSeverity,
    pub service_id: Option<String>,
    pub message: String,
    pub timestamp: DateTime<Utc>,
    pub acknowledged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertSeverity {
    Critical,
    Warning,
    Info,
}

#[derive(Debug, Deserialize)]
pub struct ServiceAction {
    pub action: String, // start, stop, restart
}

// ================================
// APP STATE
// ================================

#[derive(Clone)]
pub struct AppState {
    services: Arc<RwLock<HashMap<String, ServiceState>>>,
    alerts: Arc<RwLock<Vec<Alert>>>,
    metrics_history: Arc<RwLock<Vec<SystemMetrics>>>,
}

impl AppState {
    fn new() -> Self {
        Self {
            services: Arc::new(RwLock::new(HashMap::new())),
            alerts: Arc::new(RwLock::new(Vec::new())),
            metrics_history: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

// ================================
// SERVICE DEFINITIONS
// ================================

fn get_service_configs() -> Vec<ServiceConfig> {
    vec![
        ServiceConfig {
            id: "nginx".into(),
            name: "Nginx".into(),
            description: "Reverse proxy & TLS termination".into(),
            command: "systemctl status nginx".into(),
            working_dir: "/etc/nginx".into(),
            port: Some(443),
            health_endpoint: None,
            auto_restart: true,
            max_restarts: 5,
            restart_delay_secs: 3,
            category: ServiceCategory::Network,
            priority: 1,
        },
        ServiceConfig {
            id: "backend".into(),
            name: "Flask Backend".into(),
            description: "CyberSec Pro API Server (Flask + SocketIO)".into(),
            command: "python3 app.py".into(),
            working_dir: "/home/cybersec/cybersec-pro/saas-backend".into(),
            port: Some(5001),
            health_endpoint: Some("http://localhost:5001/api/health".into()),
            auto_restart: true,
            max_restarts: 10,
            restart_delay_secs: 5,
            category: ServiceCategory::Backend,
            priority: 1,
        },
        ServiceConfig {
            id: "frontend".into(),
            name: "React Frontend".into(),
            description: "CyberSec Pro Dashboard (Vite + React)".into(),
            command: "npm run dev".into(),
            working_dir: "/home/cybersec/cybersec-pro/saas-frontend".into(),
            port: Some(3000),
            health_endpoint: None,
            auto_restart: true,
            max_restarts: 5,
            restart_delay_secs: 3,
            category: ServiceCategory::Frontend,
            priority: 2,
        },
        ServiceConfig {
            id: "redis".into(),
            name: "Redis".into(),
            description: "Cache & rate limiting backend".into(),
            command: "redis-server".into(),
            working_dir: "/".into(),
            port: Some(6379),
            health_endpoint: None,
            auto_restart: true,
            max_restarts: 5,
            restart_delay_secs: 2,
            category: ServiceCategory::Cache,
            priority: 1,
        },
        ServiceConfig {
            id: "cloudflared".into(),
            name: "Cloudflare Tunnel".into(),
            description: "Secure tunnel to Cloudflare edge".into(),
            command: "cloudflared tunnel run".into(),
            working_dir: "/".into(),
            port: None,
            health_endpoint: None,
            auto_restart: true,
            max_restarts: 10,
            restart_delay_secs: 5,
            category: ServiceCategory::Network,
            priority: 2,
        },
        ServiceConfig {
            id: "scan-engine".into(),
            name: "Scan Engine".into(),
            description: "Security scan execution engine".into(),
            command: "integrated".into(), // Part of backend
            working_dir: "/home/cybersec/cybersec-pro/saas-backend".into(),
            port: None,
            health_endpoint: Some("http://localhost:5001/api/health".into()),
            auto_restart: false,
            max_restarts: 0,
            restart_delay_secs: 0,
            category: ServiceCategory::Security,
            priority: 1,
        },
        ServiceConfig {
            id: "service-manager".into(),
            name: "Service Manager (Rust)".into(),
            description: "This service — orchestration daemon".into(),
            command: "self".into(),
            working_dir: "/home/cybersec/cybersec-pro/rust-service-manager".into(),
            port: Some(9000),
            health_endpoint: Some("http://localhost:9000/health".into()),
            auto_restart: false,
            max_restarts: 0,
            restart_delay_secs: 0,
            category: ServiceCategory::Core,
            priority: 1,
        },
    ]
}

// ================================
// SYSTEM METRICS
// ================================

fn collect_system_metrics() -> SystemMetrics {
    let mut sys = System::new_all();
    sys.refresh_all();

    let hostname = System::host_name().unwrap_or_else(|| "unknown".into());
    let os = System::long_os_version().unwrap_or_else(|| "Linux".into());
    let kernel = System::kernel_version().unwrap_or_else(|| "unknown".into());

    let cpu_usage: f32 = sys.cpus().iter().map(|c| c.cpu_usage()).sum::<f32>()
        / sys.cpus().len().max(1) as f32;

    let mem_total = sys.total_memory() / (1024 * 1024);
    let mem_used = sys.used_memory() / (1024 * 1024);

    let mut disk_total: u64 = 0;
    let mut disk_used: u64 = 0;
    for disk in sysinfo::Disks::new_with_refreshed_list().iter() {
        disk_total += disk.total_space();
        disk_used += disk.total_space() - disk.available_space();
    }

    let load_avg = System::load_average();

    let mut net_rx: u64 = 0;
    let mut net_tx: u64 = 0;
    for (_name, data) in sysinfo::Networks::new_with_refreshed_list().iter() {
        net_rx += data.total_received();
        net_tx += data.total_transmitted();
    }

    SystemMetrics {
        hostname,
        os,
        kernel,
        uptime_secs: System::uptime(),
        cpu_count: sys.cpus().len(),
        cpu_usage_percent: cpu_usage,
        memory_total_mb: mem_total,
        memory_used_mb: mem_used,
        memory_percent: if mem_total > 0 {
            (mem_used as f32 / mem_total as f32) * 100.0
        } else {
            0.0
        },
        disk_total_gb: disk_total as f64 / (1024.0 * 1024.0 * 1024.0),
        disk_used_gb: disk_used as f64 / (1024.0 * 1024.0 * 1024.0),
        disk_percent: if disk_total > 0 {
            (disk_used as f64 / disk_total as f64 * 100.0) as f32
        } else {
            0.0
        },
        load_avg: [load_avg.one, load_avg.five, load_avg.fifteen],
        network_rx_bytes: net_rx,
        network_tx_bytes: net_tx,
        timestamp: Utc::now(),
    }
}

// ================================
// SERVICE MONITORING
// ================================

fn check_port_listening(port: u16) -> bool {
    std::net::TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", port).parse().unwrap(),
        std::time::Duration::from_millis(500),
    )
    .is_ok()
}

fn check_health_endpoint(url: &str) -> (bool, Option<String>) {
    let output = Command::new("curl")
        .args(["-sf", "--max-time", "3", url])
        .output();

    match output {
        Ok(o) if o.status.success() => (true, None),
        Ok(o) => (false, Some(String::from_utf8_lossy(&o.stderr).to_string())),
        Err(e) => (false, Some(e.to_string())),
    }
}

fn find_process_by_port(port: u16) -> Option<(u32, f32, u64)> {
    // Use ss to find PID listening on port
    let output = Command::new("ss")
        .args(["-tlnp", &format!("sport = :{}", port)])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    // Parse PID from output like "pid=12345"
    for line in stdout.lines() {
        if let Some(pid_start) = line.find("pid=") {
            let pid_str: String = line[pid_start + 4..]
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect();
            if let Ok(pid) = pid_str.parse::<u32>() {
                // Get CPU and memory from /proc
                let stat = Command::new("ps")
                    .args(["-p", &pid.to_string(), "-o", "pcpu=,rss=", "--no-headers"])
                    .output()
                    .ok()?;
                let stat_str = String::from_utf8_lossy(&stat.stdout);
                let parts: Vec<&str> = stat_str.trim().split_whitespace().collect();
                let cpu = parts.first().and_then(|s| s.parse::<f32>().ok()).unwrap_or(0.0);
                let rss_kb = parts.get(1).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
                return Some((pid, cpu, rss_kb));
            }
        }
    }
    None
}

fn find_process_by_name(name: &str) -> Option<(u32, f32, u64)> {
    let output = Command::new("pgrep")
        .args(["-f", name])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let pid_str = stdout.lines().next()?.trim();
    let pid: u32 = pid_str.parse().ok()?;

    let stat = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "pcpu=,rss=", "--no-headers"])
        .output()
        .ok()?;
    let stat_str = String::from_utf8_lossy(&stat.stdout);
    let parts: Vec<&str> = stat_str.trim().split_whitespace().collect();
    let cpu = parts.first().and_then(|s| s.parse::<f32>().ok()).unwrap_or(0.0);
    let rss_kb = parts.get(1).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
    Some((pid, cpu, rss_kb))
}

fn get_service_logs(service_id: &str) -> Vec<String> {
    let output = match service_id {
        "nginx" => Command::new("journalctl")
            .args(["-u", "nginx", "-n", "10", "--no-pager", "-q"])
            .output(),
        "backend" => Command::new("tail")
            .args(["-n", "10", "/home/cybersec/cybersec-pro/saas-backend/backend.log"])
            .output(),
        _ => return vec![],
    };

    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout)
            .lines()
            .map(|l| l.to_string())
            .collect(),
        Err(_) => vec![],
    }
}

async fn refresh_service_state(state: &AppState) {
    let configs = get_service_configs();
    let mut services = state.services.write().await;
    let mut alerts = state.alerts.write().await;

    for config in configs {
        let id = config.id.clone();

        // Determine status
        let (status, pid, cpu, mem_kb) = if let Some(port) = config.port {
            if check_port_listening(port) {
                let proc = find_process_by_port(port);
                match proc {
                    Some((p, c, m)) => (ServiceStatus::Running, Some(p), c, m),
                    None => (ServiceStatus::Running, None, 0.0, 0),
                }
            } else if id == "service-manager" {
                // This service (itself) is always running
                (ServiceStatus::Running, Some(std::process::id()), 0.0, 0)
            } else {
                (ServiceStatus::Stopped, None, 0.0, 0)
            }
        } else {
            // No port — check by process name
            match find_process_by_name(&config.command) {
                Some((p, c, m)) => (ServiceStatus::Running, Some(p), c, m),
                None => {
                    if config.command == "integrated" || config.command == "self" {
                        (ServiceStatus::Running, None, 0.0, 0) // Part of another service
                    } else {
                        (ServiceStatus::Stopped, None, 0.0, 0)
                    }
                }
            }
        };

        // Health check
        let (health_ok, error_msg) = if let Some(ref url) = config.health_endpoint {
            if status == ServiceStatus::Running {
                check_health_endpoint(url)
            } else {
                (false, Some("Service not running".into()))
            }
        } else {
            (status == ServiceStatus::Running, None)
        };

        let final_status = if status == ServiceStatus::Running && !health_ok {
            ServiceStatus::Degraded
        } else {
            status
        };

        // Generate alerts
        if final_status == ServiceStatus::Stopped && config.priority <= 2 {
            let alert_exists = alerts.iter().any(|a| {
                a.service_id.as_deref() == Some(&id) && !a.acknowledged
            });
            if !alert_exists {
                alerts.push(Alert {
                    id: uuid::Uuid::new_v4().to_string(),
                    severity: if config.priority == 1 {
                        AlertSeverity::Critical
                    } else {
                        AlertSeverity::Warning
                    },
                    service_id: Some(id.clone()),
                    message: format!("{} is not running!", config.name),
                    timestamp: Utc::now(),
                    acknowledged: false,
                });
            }
        }

        let existing = services.get(&id).cloned();
        let last_started = if final_status == ServiceStatus::Running {
            existing
                .as_ref()
                .and_then(|e| e.last_started)
                .or(Some(Utc::now()))
        } else {
            existing.as_ref().and_then(|e| e.last_started)
        };

        let uptime = if final_status == ServiceStatus::Running {
            last_started.map(|s| (Utc::now() - s).num_seconds().max(0) as u64)
        } else {
            None
        };

        let logs = get_service_logs(&id);

        services.insert(
            id,
            ServiceState {
                config,
                status: final_status,
                pid,
                uptime_secs: uptime,
                cpu_percent: cpu,
                memory_mb: mem_kb as f64 / 1024.0,
                restart_count: existing.as_ref().map(|e| e.restart_count).unwrap_or(0),
                last_started: last_started,
                last_stopped: existing.as_ref().and_then(|e| e.last_stopped),
                last_health_check: Some(Utc::now()),
                health_ok,
                error_message: error_msg,
                logs_tail: logs,
            },
        );
    }

    // Keep only last 100 alerts
    if alerts.len() > 100 {
        let drain = alerts.len() - 100;
        alerts.drain(0..drain);
    }
}

// ================================
// SERVICE CONTROL
// ================================

fn control_service(service_id: &str, action: &str) -> Result<String, String> {
    match (service_id, action) {
        ("nginx", "start") => run_cmd("systemctl", &["start", "nginx"]),
        ("nginx", "stop") => run_cmd("systemctl", &["stop", "nginx"]),
        ("nginx", "restart") => run_cmd("systemctl", &["restart", "nginx"]),
        ("backend", "start") => {
            let _child = Command::new("bash")
                .args([
                    "-c",
                    "cd /home/cybersec/cybersec-pro/saas-backend && nohup python3 app.py > backend.log 2>&1 &",
                ])
                .spawn()
                .map_err(|e| e.to_string())?;
            Ok("Backend starting...".into())
        }
        ("backend", "stop") => run_cmd("pkill", &["-f", "python3 app.py"]),
        ("backend", "restart") => {
            let _ = run_cmd("pkill", &["-f", "python3 app.py"]);
            std::thread::sleep(std::time::Duration::from_secs(2));
            let _child = Command::new("bash")
                .args([
                    "-c",
                    "cd /home/cybersec/cybersec-pro/saas-backend && nohup python3 app.py > backend.log 2>&1 &",
                ])
                .spawn()
                .map_err(|e| e.to_string())?;
            Ok("Backend restarting...".into())
        }
        ("redis", "start") => run_cmd("redis-server", &["--daemonize", "yes"]),
        ("redis", "stop") => run_cmd("redis-cli", &["shutdown"]),
        ("redis", "restart") => {
            let _ = run_cmd("redis-cli", &["shutdown"]);
            std::thread::sleep(std::time::Duration::from_secs(1));
            run_cmd("redis-server", &["--daemonize", "yes"])
        }
        ("cloudflared", "start") => {
            let _child = Command::new("bash")
                .args(["-c", "nohup cloudflared tunnel run > /dev/null 2>&1 &"])
                .spawn()
                .map_err(|e| e.to_string())?;
            Ok("Cloudflare tunnel starting...".into())
        }
        ("cloudflared", "stop") => run_cmd("pkill", &["-f", "cloudflared"]),
        (id, action) => Err(format!("Unknown service/action: {}/{}", id, action)),
    }
}

fn run_cmd(cmd: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(cmd)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn format_uptime(secs: u64) -> String {
    let days = secs / 86400;
    let hours = (secs % 86400) / 3600;
    let mins = (secs % 3600) / 60;
    if days > 0 {
        format!("{}d {}h {}m", days, hours, mins)
    } else if hours > 0 {
        format!("{}h {}m", hours, mins)
    } else {
        format!("{}m", mins)
    }
}

// ================================
// API HANDLERS
// ================================

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "cybersec-service-manager",
        "version": "1.0.0",
        "rust_version": env!("CARGO_PKG_VERSION"),
        "timestamp": Utc::now().to_rfc3339(),
    }))
}

async fn get_dashboard(State(state): State<AppState>) -> Json<SuperAdminDashboard> {
    // Refresh service states
    refresh_service_state(&state).await;

    let services = state.services.read().await;
    let alerts = state.alerts.read().await;
    let system = collect_system_metrics();

    let service_list: Vec<ServiceState> = {
        let mut list: Vec<_> = services.values().cloned().collect();
        list.sort_by_key(|s| (s.config.priority, s.config.id.clone()));
        list
    };

    let running = service_list
        .iter()
        .filter(|s| s.status == ServiceStatus::Running)
        .count();
    let stopped = service_list
        .iter()
        .filter(|s| s.status == ServiceStatus::Stopped)
        .count();
    let failed = service_list
        .iter()
        .filter(|s| s.status == ServiceStatus::Failed || s.status == ServiceStatus::Degraded)
        .count();
    let total_cpu: f32 = service_list.iter().map(|s| s.cpu_percent).sum();
    let total_mem: f64 = service_list.iter().map(|s| s.memory_mb).sum();

    let overall_health = if failed > 0 {
        "degraded"
    } else if stopped > 0 {
        "warning"
    } else {
        "healthy"
    };

    Json(SuperAdminDashboard {
        system,
        services: service_list,
        alerts: alerts.clone(),
        summary: DashboardSummary {
            total_services: services.len(),
            running,
            stopped,
            failed,
            total_cpu_percent: total_cpu,
            total_memory_mb: total_mem,
            uptime_formatted: format_uptime(System::uptime()),
            overall_health: overall_health.into(),
        },
    })
}

async fn get_services(State(state): State<AppState>) -> Json<Vec<ServiceState>> {
    refresh_service_state(&state).await;
    let services = state.services.read().await;
    let mut list: Vec<_> = services.values().cloned().collect();
    list.sort_by_key(|s| (s.config.priority, s.config.id.clone()));
    Json(list)
}

async fn get_service(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ServiceState>, StatusCode> {
    refresh_service_state(&state).await;
    let services = state.services.read().await;
    services
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn service_action(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<ServiceAction>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let valid_actions = ["start", "stop", "restart"];
    if !valid_actions.contains(&body.action.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Invalid action. Use: start, stop, restart"})),
        ));
    }

    info!("Service action: {} -> {}", id, body.action);

    match control_service(&id, &body.action) {
        Ok(msg) => {
            // Add alert for service action
            let mut alerts = state.alerts.write().await;
            alerts.push(Alert {
                id: uuid::Uuid::new_v4().to_string(),
                severity: AlertSeverity::Info,
                service_id: Some(id.clone()),
                message: format!("Service {} action: {}", id, body.action),
                timestamp: Utc::now(),
                acknowledged: false,
            });

            Ok(Json(serde_json::json!({
                "success": true,
                "service": id,
                "action": body.action,
                "message": msg,
            })))
        }
        Err(e) => {
            error!("Service control failed: {} {} — {}", id, body.action, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": e})),
            ))
        }
    }
}

async fn get_system_metrics() -> Json<SystemMetrics> {
    Json(collect_system_metrics())
}

async fn get_alerts(State(state): State<AppState>) -> Json<Vec<Alert>> {
    let alerts = state.alerts.read().await;
    Json(alerts.clone())
}

async fn acknowledge_alert(
    State(state): State<AppState>,
    axum::extract::Path(alert_id): axum::extract::Path<String>,
) -> StatusCode {
    let mut alerts = state.alerts.write().await;
    if let Some(alert) = alerts.iter_mut().find(|a| a.id == alert_id) {
        alert.acknowledged = true;
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

async fn get_processes() -> Json<Vec<serde_json::Value>> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let mut processes: Vec<_> = sys
        .processes()
        .values()
        .map(|p| {
            serde_json::json!({
                "pid": p.pid().as_u32(),
                "name": p.name().to_string_lossy(),
                "cpu": p.cpu_usage(),
                "memory_mb": p.memory() as f64 / (1024.0 * 1024.0),
                "status": format!("{:?}", p.status()),
                "cmd": p.cmd().iter().take(3).map(|c| c.to_string_lossy().to_string()).collect::<Vec<_>>().join(" "),
            })
        })
        .collect();

    processes.sort_by(|a, b| {
        let cpu_a = a["cpu"].as_f64().unwrap_or(0.0);
        let cpu_b = b["cpu"].as_f64().unwrap_or(0.0);
        cpu_b.partial_cmp(&cpu_a).unwrap_or(std::cmp::Ordering::Equal)
    });
    processes.truncate(50); // Top 50 by CPU

    Json(processes)
}

// ================================
// BACKGROUND MONITORING
// ================================

async fn monitoring_loop(state: AppState) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(15));

    loop {
        interval.tick().await;

        // Refresh services
        refresh_service_state(&state).await;

        // Collect metrics
        let metrics = collect_system_metrics();
        let mut history = state.metrics_history.write().await;
        history.push(metrics);
        // Keep last 240 entries (1 hour at 15s intervals)
        if history.len() > 240 {
            let drain_count = history.len() - 240;
            history.drain(0..drain_count);
        }
    }
}

// ================================
// MAIN
// ================================

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .compact()
        .init();

    info!("🦀 CyberSec Pro Service Manager v1.0.0 starting...");

    let state = AppState::new();

    // Initial service discovery
    refresh_service_state(&state).await;

    // Start background monitoring
    let monitor_state = state.clone();
    tokio::spawn(async move {
        monitoring_loop(monitor_state).await;
    });

    // CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Router
    let app = Router::new()
        // Health
        .route("/health", get(health))
        // Dashboard
        .route("/api/admin/dashboard", get(get_dashboard))
        // Services
        .route("/api/admin/services", get(get_services))
        .route("/api/admin/services/{id}", get(get_service))
        .route("/api/admin/services/{id}/action", post(service_action))
        // System
        .route("/api/admin/system", get(get_system_metrics))
        .route("/api/admin/processes", get(get_processes))
        // Alerts
        .route("/api/admin/alerts", get(get_alerts))
        .route("/api/admin/alerts/{id}/acknowledge", post(acknowledge_alert))
        .layer(cors)
        .with_state(state);

    let addr = "0.0.0.0:9000";
    info!("🚀 Service Manager API listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
