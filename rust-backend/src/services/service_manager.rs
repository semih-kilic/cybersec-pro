/// Real-time service management, monitoring, and auto-recovery system.
/// This is the "world-class" service manager that ensures no service ever stays down.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::process::Command;
use tokio::sync::RwLock;

// ── Data Types ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServiceStatus {
    Running,
    Stopped,
    Starting,
    Failed,
    Degraded,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub port: Option<u16>,
    pub health_endpoint: Option<String>,
    pub start_command: String,
    pub working_dir: String,
    pub auto_restart: bool,
    pub max_restarts: u32,
    pub restart_delay_secs: u64,
    pub priority: String,  // critical, high, medium, low
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceState {
    pub config: ServiceConfig,
    pub status: ServiceStatus,
    pub pid: Option<u32>,
    pub uptime_secs: u64,
    pub cpu_percent: f64,
    pub memory_mb: f64,
    pub restart_count: u32,
    pub last_started: Option<u64>,
    pub last_stopped: Option<u64>,
    pub last_health_check: Option<u64>,
    pub health_ok: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub hostname: String,
    pub os: String,
    pub kernel: String,
    pub uptime_secs: u64,
    pub cpu_count: usize,
    pub cpu_percent: f64,
    pub memory_total_mb: u64,
    pub memory_used_mb: u64,
    pub memory_percent: f64,
    pub disk_total_gb: u64,
    pub disk_used_gb: u64,
    pub disk_percent: f64,
    pub load_avg: [f64; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id: String,
    pub severity: String, // critical, warning, info
    pub service_id: String,
    pub message: String,
    pub timestamp: u64,
    pub acknowledged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceDashboard {
    pub services: Vec<ServiceState>,
    pub system: SystemMetrics,
    pub alerts: Vec<Alert>,
    pub summary: DashboardSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardSummary {
    pub total_services: usize,
    pub running: usize,
    pub stopped: usize,
    pub failed: usize,
    pub auto_recovered: u32,
    pub uptime_percent: f64,
}

// ── Service Manager (Shared State) ────────────────────────

pub struct ServiceManager {
    pub services: RwLock<HashMap<String, ServiceState>>,
    pub alerts: RwLock<Vec<Alert>>,
    pub auto_recovered_count: RwLock<u32>,
    pub started_at: Instant,
}

impl ServiceManager {
    pub fn new() -> Arc<Self> {
        let manager = Arc::new(Self {
            services: RwLock::new(HashMap::new()),
            alerts: RwLock::new(Vec::new()),
            auto_recovered_count: RwLock::new(0),
            started_at: Instant::now(),
        });

        // Initialize services
        let mgr = manager.clone();
        tokio::spawn(async move {
            mgr.init_services().await;
        });

        manager
    }

    async fn init_services(&self) {
        let configs = get_service_configs();
        let mut services = self.services.write().await;
        for config in configs {
            let state = ServiceState {
                config: config.clone(),
                status: ServiceStatus::Unknown,
                pid: None,
                uptime_secs: 0,
                cpu_percent: 0.0,
                memory_mb: 0.0,
                restart_count: 0,
                last_started: None,
                last_stopped: None,
                last_health_check: None,
                health_ok: false,
                error_message: None,
            };
            services.insert(config.id.clone(), state);
        }
    }

    /// Main monitoring loop — runs every 10 seconds
    pub async fn monitor_loop(self: Arc<Self>) {
        let mut interval = tokio::time::interval(Duration::from_secs(10));
        loop {
            interval.tick().await;
            self.refresh_all().await;
        }
    }

    /// Refresh all service states + auto-restart failed services
    async fn refresh_all(&self) {
        let service_ids: Vec<String> = {
            let svc = self.services.read().await;
            svc.keys().cloned().collect()
        };

        for id in service_ids {
            self.refresh_service(&id).await;
        }
    }

    /// Check one service's real status and auto-restart if needed
    async fn refresh_service(&self, service_id: &str) {
        let now = now_epoch();

        let (port, health_ep, auto_restart, max_restarts, restart_delay, start_cmd, working_dir, restart_count) = {
            let svc = self.services.read().await;
            let Some(s) = svc.get(service_id) else { return };
            (
                s.config.port,
                s.config.health_endpoint.clone(),
                s.config.auto_restart,
                s.config.max_restarts,
                s.config.restart_delay_secs,
                s.config.start_command.clone(),
                s.config.working_dir.clone(),
                s.restart_count,
            )
        };

        // 1. Check if port is listening
        let port_ok = if let Some(p) = port {
            check_port(p).await
        } else {
            true // no port to check
        };

        // 2. Check health endpoint
        let health_ok = if let Some(ref ep) = health_ep {
            check_health(ep).await
        } else {
            port_ok
        };

        // 3. Find process info
        let (pid, cpu, mem) = if let Some(p) = port {
            find_process_by_port(p).await
        } else {
            (None, 0.0, 0.0)
        };

        // 4. Determine status
        let status = if port_ok && health_ok {
            ServiceStatus::Running
        } else if port_ok && !health_ok {
            ServiceStatus::Degraded
        } else {
            ServiceStatus::Stopped
        };

        // 5. Update state
        {
            let mut svc = self.services.write().await;
            if let Some(s) = svc.get_mut(service_id) {
                let prev_status = s.status.clone();
                s.status = status.clone();
                s.pid = pid;
                s.cpu_percent = cpu;
                s.memory_mb = mem;
                s.health_ok = health_ok;
                s.last_health_check = Some(now);
                s.error_message = None;

                if let Some(started) = s.last_started {
                    if status == ServiceStatus::Running {
                        s.uptime_secs = now.saturating_sub(started);
                    }
                }

                // Transition detection
                if prev_status == ServiceStatus::Running && status != ServiceStatus::Running {
                    s.last_stopped = Some(now);
                    s.error_message = Some(format!("Service went down at {}", now));
                }
            }
        }

        // 6. Auto-restart if needed
        if (status == ServiceStatus::Stopped || status == ServiceStatus::Failed)
            && auto_restart
            && restart_count < max_restarts
        {
            tracing::warn!("⚠️ Service {} is down — auto-restarting...", service_id);
            self.add_alert(
                "warning",
                service_id,
                &format!("Service {} is down — attempting auto-restart (#{}/{})", service_id, restart_count + 1, max_restarts),
            ).await;

            tokio::time::sleep(Duration::from_secs(restart_delay)).await;
            let success = restart_service(&start_cmd, &working_dir).await;

            let mut svc = self.services.write().await;
            if let Some(s) = svc.get_mut(service_id) {
                s.restart_count += 1;
                if success {
                    s.status = ServiceStatus::Starting;
                    s.last_started = Some(now_epoch());
                    let mut count = self.auto_recovered_count.write().await;
                    *count += 1;
                    tracing::info!("✅ Service {} auto-restarted successfully", service_id);
                } else {
                    s.status = ServiceStatus::Failed;
                    s.error_message = Some("Auto-restart failed".to_string());
                    drop(svc);
                    self.add_alert(
                        "critical",
                        service_id,
                        &format!("Service {} auto-restart FAILED", service_id),
                    ).await;
                }
            }
        }
    }

    /// Add an alert
    async fn add_alert(&self, severity: &str, service_id: &str, message: &str) {
        let mut alerts = self.alerts.write().await;
        // Keep max 100 alerts
        if alerts.len() >= 100 {
            alerts.remove(0);
        }
        alerts.push(Alert {
            id: uuid::Uuid::new_v4().to_string(),
            severity: severity.to_string(),
            service_id: service_id.to_string(),
            message: message.to_string(),
            timestamp: now_epoch(),
            acknowledged: false,
        });
    }

    /// Acknowledge an alert
    pub async fn acknowledge_alert(&self, alert_id: &str) -> bool {
        let mut alerts = self.alerts.write().await;
        if let Some(a) = alerts.iter_mut().find(|a| a.id == alert_id) {
            a.acknowledged = true;
            true
        } else {
            false
        }
    }

    /// Get full dashboard data
    pub async fn get_dashboard(&self) -> ServiceDashboard {
        let services: Vec<ServiceState> = {
            let svc = self.services.read().await;
            svc.values().cloned().collect()
        };
        let alerts = self.alerts.read().await.clone();
        let auto_recovered = *self.auto_recovered_count.read().await;
        let system = get_system_metrics().await;

        let running = services.iter().filter(|s| s.status == ServiceStatus::Running).count();
        let stopped = services.iter().filter(|s| s.status == ServiceStatus::Stopped).count();
        let failed = services.iter().filter(|s| s.status == ServiceStatus::Failed).count();
        let total = services.len();

        let uptime_percent = if total > 0 {
            (running as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        ServiceDashboard {
            services,
            system,
            alerts,
            summary: DashboardSummary {
                total_services: total,
                running,
                stopped,
                failed,
                auto_recovered,
                uptime_percent,
            },
        }
    }

    /// Get all service states
    pub async fn get_services(&self) -> Vec<ServiceState> {
        self.services.read().await.values().cloned().collect()
    }

    /// Get a single service
    pub async fn get_service(&self, id: &str) -> Option<ServiceState> {
        self.services.read().await.get(id).cloned()
    }

    /// Get alerts
    pub async fn get_alerts(&self) -> Vec<Alert> {
        self.alerts.read().await.clone()
    }

    /// Execute action on a service
    pub async fn service_action(&self, service_id: &str, action: &str) -> Result<String, String> {
        let (start_cmd, working_dir) = {
            let svc = self.services.read().await;
            let s = svc.get(service_id).ok_or_else(|| format!("Service {} not found", service_id))?;
            (s.config.start_command.clone(), s.config.working_dir.clone())
        };

        match action {
            "restart" | "start" => {
                // Kill existing process on the port first
                let port = {
                    let svc = self.services.read().await;
                    svc.get(service_id).and_then(|s| s.config.port)
                };
                if let Some(p) = port {
                    kill_process_on_port(p).await;
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
                let ok = restart_service(&start_cmd, &working_dir).await;
                if ok {
                    let mut svc = self.services.write().await;
                    if let Some(s) = svc.get_mut(service_id) {
                        s.status = ServiceStatus::Starting;
                        s.last_started = Some(now_epoch());
                    }
                    Ok(format!("Service {} {}ed successfully", service_id, action))
                } else {
                    Err(format!("Failed to {} service {}", action, service_id))
                }
            }
            "stop" => {
                let port = {
                    let svc = self.services.read().await;
                    svc.get(service_id).and_then(|s| s.config.port)
                };
                if let Some(p) = port {
                    kill_process_on_port(p).await;
                }
                let mut svc = self.services.write().await;
                if let Some(s) = svc.get_mut(service_id) {
                    s.status = ServiceStatus::Stopped;
                    s.last_stopped = Some(now_epoch());
                }
                Ok(format!("Service {} stopped", service_id))
            }
            _ => Err(format!("Unknown action: {}", action)),
        }
    }
}

// ── Service Configs ────────────────────────────────────────

fn get_service_configs() -> Vec<ServiceConfig> {
    vec![
        ServiceConfig {
            id: "rust-backend".into(),
            name: "Rust API Backend".into(),
            description: "CyberSec Pro main API (Axum/Rust)".into(),
            port: Some(5001),
            health_endpoint: Some("http://localhost:5001/health".into()),
            start_command: "cd /home/cybersec/cybersec-pro/rust-backend && DATABASE_URL='sqlite:../saas-backend/instance/cybersec_saas.db?mode=rwc' JWT_SECRET_KEY='***REDACTED_JWT_SECRET***' RUST_LOG=info nohup ./target/release/cybersec-pro-backend > /tmp/rust-backend.log 2>&1 &".into(),
            working_dir: "/home/cybersec/cybersec-pro/rust-backend".into(),
            auto_restart: true,
            max_restarts: 100,
            restart_delay_secs: 2,
            priority: "critical".into(),
            category: "backend".into(),
        },
        ServiceConfig {
            id: "frontend".into(),
            name: "React Frontend".into(),
            description: "CyberSec Pro SaaS Dashboard (Vite/React)".into(),
            port: Some(3001),
            health_endpoint: Some("http://localhost:3001/dashboard/".into()),
            start_command: "cd /home/cybersec/cybersec-pro/saas-frontend && nohup npm run dev -- --port 3001 > /tmp/frontend.log 2>&1 &".into(),
            working_dir: "/home/cybersec/cybersec-pro/saas-frontend".into(),
            auto_restart: true,
            max_restarts: 50,
            restart_delay_secs: 3,
            priority: "high".into(),
            category: "frontend".into(),
        },
        ServiceConfig {
            id: "sales-api".into(),
            name: "Sales API (Stripe)".into(),
            description: "CyberSec Pro Sales & Billing API".into(),
            port: Some(5002),
            health_endpoint: Some("http://localhost:5002/health".into()),
            start_command: "systemctl start cybersec-sales".into(),
            working_dir: "/home/cybersec/cybersec-pro/cybersec-sales/backend".into(),
            auto_restart: true,
            max_restarts: 50,
            restart_delay_secs: 5,
            priority: "high".into(),
            category: "backend".into(),
        },
        ServiceConfig {
            id: "nginx".into(),
            name: "Nginx Reverse Proxy".into(),
            description: "TLS termination & reverse proxy".into(),
            port: Some(443),
            health_endpoint: None,
            start_command: "systemctl start nginx".into(),
            working_dir: "/etc/nginx".into(),
            auto_restart: true,
            max_restarts: 50,
            restart_delay_secs: 2,
            priority: "critical".into(),
            category: "infrastructure".into(),
        },
        ServiceConfig {
            id: "redis".into(),
            name: "Redis Cache".into(),
            description: "In-memory cache & session store".into(),
            port: Some(6379),
            health_endpoint: None,
            start_command: "systemctl start redis-server".into(),
            working_dir: "/var/lib/redis".into(),
            auto_restart: true,
            max_restarts: 50,
            restart_delay_secs: 2,
            priority: "critical".into(),
            category: "infrastructure".into(),
        },
        ServiceConfig {
            id: "database".into(),
            name: "SQLite Database".into(),
            description: "Main application database".into(),
            port: None,
            health_endpoint: None,
            start_command: "true".into(), // SQLite doesn't need a server process
            working_dir: "/home/cybersec/cybersec-pro/saas-backend/instance".into(),
            auto_restart: false,
            max_restarts: 0,
            restart_delay_secs: 0,
            priority: "critical".into(),
            category: "database".into(),
        },
    ]
}

// ── System Utility Functions ───────────────────────────────

fn now_epoch() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

async fn check_port(port: u16) -> bool {
    tokio::time::timeout(
        Duration::from_millis(500),
        tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port)),
    )
    .await
    .map(|r| r.is_ok())
    .unwrap_or(false)
}

async fn check_health(url: &str) -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build();

    match client {
        Ok(c) => c.get(url).send().await.map(|r| r.status().is_success()).unwrap_or(false),
        Err(_) => false,
    }
}

async fn find_process_by_port(port: u16) -> (Option<u32>, f64, f64) {
    let output = Command::new("sh")
        .arg("-c")
        .arg(format!(
            "lsof -ti :{port} 2>/dev/null | head -1"
        ))
        .output()
        .await;

    if let Ok(o) = output {
        let pid_str = String::from_utf8_lossy(&o.stdout).trim().to_string();
        if let Ok(pid) = pid_str.parse::<u32>() {
            // Get CPU and memory
            let ps_out = Command::new("ps")
                .args(["-p", &pid.to_string(), "-o", "%cpu,%mem,rss", "--no-headers"])
                .output()
                .await;

            if let Ok(ps) = ps_out {
                let line = String::from_utf8_lossy(&ps.stdout).trim().to_string();
                let parts: Vec<&str> = line.split_whitespace().collect();
                let cpu = parts.first().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
                let rss_kb = parts.get(2).and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
                return (Some(pid), cpu, rss_kb / 1024.0);
            }
            return (Some(pid), 0.0, 0.0);
        }
    }
    (None, 0.0, 0.0)
}

async fn kill_process_on_port(port: u16) {
    let _ = Command::new("sh")
        .arg("-c")
        .arg(format!("fuser -k {port}/tcp 2>/dev/null"))
        .output()
        .await;
}

async fn restart_service(cmd: &str, _working_dir: &str) -> bool {
    let result = Command::new("sh")
        .arg("-c")
        .arg(cmd)
        .output()
        .await;

    match result {
        Ok(o) => o.status.success() || o.status.code().is_none(), // background processes return immediately
        Err(e) => {
            tracing::error!("Failed to restart service: {}", e);
            false
        }
    }
}

pub async fn get_system_metrics() -> SystemMetrics {
    let hostname = run_cmd("hostname").await;
    let os = run_cmd("cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'\"' -f2").await;
    let kernel = run_cmd("uname -r").await;
    let uptime = run_cmd("cat /proc/uptime 2>/dev/null | awk '{print $1}'").await;
    let uptime_secs = uptime.parse::<f64>().unwrap_or(0.0) as u64;

    let cpu_count = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);

    // CPU usage
    let cpu_str = run_cmd("top -bn1 2>/dev/null | grep 'Cpu(s)' | awk '{print $2}' | head -1").await;
    let cpu_percent = cpu_str.parse::<f64>().unwrap_or(0.0);

    // Memory
    let mem_info = run_cmd("free -m 2>/dev/null | awk '/^Mem:/{printf \"%s %s %s\", $2, $3, $NF}'").await;
    let mem_parts: Vec<&str> = mem_info.split_whitespace().collect();
    let memory_total_mb = mem_parts.first().and_then(|s| s.parse().ok()).unwrap_or(0u64);
    let memory_used_mb = mem_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0u64);
    let memory_percent = if memory_total_mb > 0 {
        (memory_used_mb as f64 / memory_total_mb as f64) * 100.0
    } else {
        0.0
    };

    // Disk
    let disk_info = run_cmd("df -BG / 2>/dev/null | awk 'NR==2{printf \"%s %s %s\", $2, $3, $5}'").await;
    let disk_parts: Vec<&str> = disk_info.split_whitespace().collect();
    let disk_total_gb = disk_parts.first().and_then(|s| s.trim_end_matches('G').parse().ok()).unwrap_or(0u64);
    let disk_used_gb = disk_parts.get(1).and_then(|s| s.trim_end_matches('G').parse().ok()).unwrap_or(0u64);
    let disk_percent_str = disk_parts.get(2).unwrap_or(&"0%");
    let disk_percent = disk_percent_str.trim_end_matches('%').parse::<f64>().unwrap_or(0.0);

    // Load average
    let load_str = run_cmd("cat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}'").await;
    let load_parts: Vec<&str> = load_str.split_whitespace().collect();
    let load_avg = [
        load_parts.first().and_then(|s| s.parse().ok()).unwrap_or(0.0),
        load_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0.0),
        load_parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0.0),
    ];

    SystemMetrics {
        hostname,
        os,
        kernel,
        uptime_secs,
        cpu_count,
        cpu_percent,
        memory_total_mb,
        memory_used_mb,
        memory_percent,
        disk_total_gb,
        disk_used_gb,
        disk_percent,
        load_avg,
    }
}

/// Get running process list
pub async fn get_processes() -> Vec<serde_json::Value> {
    let output = run_cmd("ps aux --sort=-%cpu 2>/dev/null | head -20").await;
    let mut procs = Vec::new();
    for (i, line) in output.lines().enumerate() {
        if i == 0 { continue; } // skip header
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 11 {
            procs.push(serde_json::json!({
                "user": parts[0],
                "pid": parts[1],
                "cpu": parts[2],
                "mem": parts[3],
                "command": parts[10..].join(" "),
            }));
        }
    }
    procs
}

async fn run_cmd(cmd: &str) -> String {
    Command::new("sh")
        .arg("-c")
        .arg(cmd)
        .output()
        .await
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default()
}
