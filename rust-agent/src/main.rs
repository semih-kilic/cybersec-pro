//! CyberSec Pro reverse-tunnel agent.
//!
//! Behavior:
//! 1. Read `CSP_TOKEN` (one-time enrollment JWT) and `CSP_API_URL`
//!    (defaults to https://app.cyber-sec-pro.com).
//! 2. POST `/api/v1/agents/enroll` to exchange token for `{agent_id, api_key}`.
//! 3. Persist `agent_id` + `api_key` to `~/.cybersec-agent/state.json`.
//! 4. Loop: every 30s POST heartbeat with cpu/mem/active_scans metrics.
//! 5. Exit cleanly on SIGINT / SIGTERM.
//!
//! Zero inbound ports. All traffic is the agent dialing out over TLS.

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicI32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use sysinfo::System;
use local_ip_address::list_afinet_netifas;

const DEFAULT_API: &str = "https://app.cyber-sec-pro.com";
const HEARTBEAT_SECS: u64 = 30;
const JOB_POLL_BACKOFF_SECS: u64 = 5;
const JOB_POLL_MAX_BACKOFF_SECS: u64 = 60;
const USER_AGENT: &str = concat!("cybersec-agent/", env!("CARGO_PKG_VERSION"));

#[derive(Serialize, Deserialize, Debug, Clone)]
struct AgentState {
    agent_id: String,
    api_key: String,
    api_url: String,
}

fn state_path() -> PathBuf {
    let base = std::env::var("CSP_STATE_DIR")
        .or_else(|_| std::env::var("HOME").map(|h| format!("{h}/.cybersec-agent")))
        .unwrap_or_else(|_| "/var/lib/cybersec-agent".to_string());
    let _ = std::fs::create_dir_all(&base);
    PathBuf::from(base).join("state.json")
}

fn load_state() -> Option<AgentState> {
    let path = state_path();
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn save_state(s: &AgentState) -> std::io::Result<()> {
    let path = state_path();
    let raw = serde_json::to_string_pretty(s)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    // Set restrictive permissions: owner read/write only
    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    opts.open(&path)?.write_all(raw.as_bytes())?;
    Ok(())
}

#[derive(Deserialize)]
struct EnrollResponse {
    agent_id: String,
    api_key: String,
}

async fn enroll(api_url: &str, token: &str, http: &reqwest::Client) -> Result<AgentState, String> {
    let host = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "unknown".into());
    let platform = std::env::consts::OS.to_string();
    let body = serde_json::json!({
        "token": token,
        "hostname": host,
        "platform": platform,
    });
    let resp = http
        .post(format!("{api_url}/api/v1/agents/enroll"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("enroll request failed: {e}"))?;
    if !resp.status().is_success() {
        let code = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("enroll rejected ({code}): {text}"));
    }
    let parsed: EnrollResponse = resp.json().await.map_err(|e| format!("bad enroll body: {e}"))?;
    Ok(AgentState {
        agent_id: parsed.agent_id,
        api_key: parsed.api_key,
        api_url: api_url.to_string(),
    })
}

fn delete_state() {
    let _ = std::fs::remove_file(state_path());
}

async fn heartbeat(state: &AgentState, http: &reqwest::Client, sys: &mut System, active: i32) -> Result<(), String> {
    sys.refresh_cpu();
    sys.refresh_memory();
    let cpu = sys.global_cpu_info().cpu_usage();
    let mem_pct = if sys.total_memory() > 0 {
        (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0
    } else {
        0.0
    };
    // Collect local IP addresses
    let ip_addresses: Vec<String> = {
        let mut ips = Vec::new();
        if let Ok(ifaces) = local_ip_address::list_afinet_netifas() {
            for (_name, ip) in ifaces {
                let s = ip.to_string();
                if !s.starts_with("127.") && !s.starts_with("::1") && !s.starts_with("fe80") {
                    ips.push(s);
                }
            }
        }
        ips
    };
    let body = serde_json::json!({
        "cpu_usage": cpu,
        "memory_usage": mem_pct,
        "active_scans": active,
        "ip_addresses": ip_addresses,
        "subnets": local_subnets(),
        "tools": detect_tools(),
    });
    let url = format!("{}/api/v1/agents/{}/heartbeat", state.api_url, state.agent_id);
    let resp = http
        .post(url)
        .bearer_auth(&state.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("heartbeat send: {e}"))?;
    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        delete_state();
        return Err("UNAUTHORIZED".into());
    }
    if !resp.status().is_success() {
        return Err(format!("heartbeat status {}", resp.status()));
    }
    Ok(())
}

/// Local networks reachable by this agent, as CIDR strings (e.g. "10.0.0.0/24").
/// This is the "target context" the backend uses when the operator starts a
/// sweep with this agent but no explicit subnet. Tools always run server-side.
fn local_subnets() -> Vec<String> {
    const SUBNET_REFRESH_SECS: u64 = 300;
    static LAST_REFRESH: AtomicU64 = AtomicU64::new(0);
    static CACHE: OnceLock<Mutex<Vec<String>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(Vec::new()));

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    if now.saturating_sub(LAST_REFRESH.load(Ordering::Relaxed)) < SUBNET_REFRESH_SECS {
        if let Ok(guard) = cache.lock() {
            return guard.clone();
        }
    }

    let mut nets = collect_subnets();
    nets.sort();
    nets.dedup();
    if let Ok(mut guard) = cache.lock() {
        *guard = nets.clone();
    }
    LAST_REFRESH.store(now, Ordering::Relaxed);
    nets
}

fn collect_subnets() -> Vec<String> {
    let mut nets = Vec::new();
    #[cfg(target_os = "windows")]
    {
        // Get-NetIPAddress prints plain "IP/PrefixLength" lines, independent of
        // the OS display language. WellKnown covers loopback + APIPA; we also
        // filter those out defensively below.
        const SCRIPT: &str = "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -ne 'WellKnown' } | ForEach-Object { \"$($_.IPAddress)/$($_.PrefixLength)\" }";
        if let Ok(out) = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", SCRIPT])
            .output()
        {
            for line in String::from_utf8_lossy(&out.stdout).lines() {
                let s = line.trim();
                if s.contains('/') && !s.starts_with("127.") && !s.starts_with("169.254.") {
                    nets.push(s.to_string());
                }
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(out) = std::process::Command::new("ip")
            .args(["-o", "-f", "inet", "addr", "show"])
            .output()
        {
            for line in String::from_utf8_lossy(&out.stdout).lines() {
                if let Some(idx) = line.find(" inet ") {
                    let rest = line[idx + 6..].trim();
                    let cidr = rest.split_whitespace().next().unwrap_or("").to_string();
                    if cidr.contains('/') && !cidr.starts_with("127.") && !cidr.starts_with("169.254.") {
                        nets.push(cidr);
                    }
                }
            }
        }
    }
    nets
}

/// Tool manifest: detect installed security tooling so the backend scheduler
/// only queues jobs this agent can execute. Reported on every heartbeat and
/// stored in `agents.agent_capabilities`. Refreshed every 5 minutes.
fn detect_tools() -> Vec<serde_json::Value> {
    const TOOLS: &[&str] = &[
        "amass", "nmap", "masscan", "naabu", "nuclei", "httpx", "subfinder",
        "assetfinder", "ffuf", "gobuster", "gau", "waybackurls", "gospider",
        "katana", "nikto", "wpscan", "hydra", "sqlmap", "enum4linux", "smbmap",
        "whatweb", "dnsx", "tlsx", "jq", "curl", "openssl",
    ];
    let mut tools = Vec::new();
    for name in TOOLS {
        let found = std::process::Command::new("which")
            .arg(name)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        let version = if found {
            std::process::Command::new(name)
                .arg("--version")
                .output()
                .ok()
                .map(|o| {
                    let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
                    if s.is_empty() {
                        String::from_utf8_lossy(&o.stderr).trim().to_string()
                    } else {
                        s
                    }
                })
                .filter(|s| !s.is_empty())
        } else {
            None
        };
        if found {
            tools.push(serde_json::json!({
                "name": name,
                "available": true,
                "version": version,
            }));
        }
    }
    tools
}

#[derive(Deserialize, Debug)]
struct PolledJob {
    job_id: String,
    command: String,
    #[serde(default)]
    timeout_seconds: Option<u64>,
    /// JSON argv protocol (v2). When present, the tool is spawned with this
    /// exact argument vector — no shell, no whitespace splitting, so paths and
    /// arguments with spaces/quotes work correctly.
    #[serde(default)]
    args: Option<Vec<String>>,
}

/// Polls `/jobs/next` (long-poll, 25s server-side wait), executes the command,
/// then POSTs the result. Runs forever in its own task. Backs off on errors so
/// a temporarily unreachable backend doesn't tight-loop.
async fn job_loop(state: AgentState, http: reqwest::Client, active: Arc<AtomicI32>) {
    let mut backoff = JOB_POLL_BACKOFF_SECS;
    loop {
        let url = format!("{}/api/v1/agents/{}/jobs/next", state.api_url, state.agent_id);
        let resp = match http
            .get(&url)
            .bearer_auth(&state.api_key)
            .timeout(Duration::from_secs(40))
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[agent] job poll error: {e}");
                tokio::time::sleep(Duration::from_secs(backoff)).await;
                backoff = (backoff * 2).min(JOB_POLL_MAX_BACKOFF_SECS);
                continue;
            }
        };

        let status = resp.status();
        if status == reqwest::StatusCode::NO_CONTENT {
            backoff = JOB_POLL_BACKOFF_SECS;
            continue;
        }
        if status == reqwest::StatusCode::UNAUTHORIZED {
            eprintln!("[agent] 401 on job poll — state invalidated, exiting for re-enrollment");
            delete_state();
            std::process::exit(10);
        }
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            eprintln!("[agent] job poll {}: {}", status, body);
            tokio::time::sleep(Duration::from_secs(backoff)).await;
            backoff = (backoff * 2).min(JOB_POLL_MAX_BACKOFF_SECS);
            continue;
        }

        backoff = JOB_POLL_BACKOFF_SECS;
        let job: PolledJob = match resp.json().await {
            Ok(j) => j,
            Err(e) => {
                eprintln!("[agent] bad job body: {e}");
                continue;
            }
        };

        active.fetch_add(1, Ordering::SeqCst);
        let result = execute_job(&job).await;
        active.fetch_sub(1, Ordering::SeqCst);

        let report_url = format!(
            "{}/api/v1/agents/{}/jobs/{}/result",
            state.api_url, state.agent_id, job.job_id
        );
        if let Err(e) = http
            .post(&report_url)
            .bearer_auth(&state.api_key)
            .json(&result)
            .send()
            .await
            .and_then(|r| r.error_for_status())
        {
            eprintln!("[agent] result POST failed: {e}");
        }
    }
}

/// Run the job's command with a hard timeout. Captures stdout, stderr, exit
/// code. Uses argument vector (no shell) for safety. Prefers the JSON `args`
/// protocol when the backend provides it; falls back to whitespace splitting of
/// `command` for older backends.
async fn execute_job(job: &PolledJob) -> serde_json::Value {
    // Allow the backend to specify up to 30 minutes (1800s).
    let timeout = Duration::from_secs(job.timeout_seconds.unwrap_or(300).clamp(10, 1800));

    // Resolve program + args: JSON argv protocol first, whitespace split fallback.
    let argv: Vec<String> = if let Some(args) = &job.args {
        if args.is_empty() {
            vec![job.command.clone()]
        } else {
            args.clone()
        }
    } else {
        let parts: Vec<&str> = job.command.split_whitespace().collect();
        if parts.is_empty() {
            return serde_json::json!({
                "status": "failed",
                "exit_code": null,
                "stdout": "",
                "stderr": "empty command",
            });
        }
        parts.iter().map(|s| s.to_string()).collect()
    };

    let mut cmd = tokio::process::Command::new(&argv[0]);
    if argv.len() > 1 {
        cmd.args(&argv[1..]);
    }

    cmd.stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        // If the timeout future is dropped, the child is killed automatically.
        .kill_on_drop(true);

    let child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return serde_json::json!({
                "status": "failed",
                "exit_code": null,
                "stdout": "",
                "stderr": format!("spawn failed: {e}"),
            });
        }
    };

    match tokio::time::timeout(timeout, child.wait_with_output()).await {
        Ok(Ok(out)) => serde_json::json!({
            "status": if out.status.success() { "completed" } else { "failed" },
            "exit_code": out.status.code(),
            "stdout": String::from_utf8_lossy(&out.stdout).to_string(),
            "stderr": String::from_utf8_lossy(&out.stderr).to_string(),
        }),
        Ok(Err(e)) => serde_json::json!({
            "status": "failed",
            "exit_code": null,
            "stdout": "",
            "stderr": format!("wait error: {e}"),
        }),
        Err(_) => {
            // Child is killed by kill_on_drop when the timeout future is dropped.
            serde_json::json!({
                "status": "timeout",
                "exit_code": null,
                "stdout": "",
                "stderr": format!("command exceeded {}s timeout", timeout.as_secs()),
            })
        }
    }
}

#[tokio::main]
async fn main() {
    let api_url = std::env::var("CSP_API_URL").unwrap_or_else(|_| DEFAULT_API.to_string());
    let http = match reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(20))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            eprintln!("ERROR: failed to build http client: {e}");
            std::process::exit(1);
        }
    };

    // Load existing state, or enroll fresh.
    let state = match load_state() {
        Some(s) => {
            eprintln!("[agent] resuming as {}", s.agent_id);
            s
        }
        None => {
            let token = match std::env::var("CSP_TOKEN") {
                Ok(t) if !t.is_empty() => t,
                _ => {
                    eprintln!("ERROR: CSP_TOKEN env var required for first-time enrollment.");
                    std::process::exit(2);
                }
            };
            eprintln!("[agent] enrolling against {api_url}");
            match enroll(&api_url, &token, &http).await {
                Ok(s) => {
                    if let Err(e) = save_state(&s) {
                        eprintln!("WARN: state save failed: {e}");
                    }
                    eprintln!("[agent] enrolled as {}", s.agent_id);
                    s
                }
                Err(e) => {
                    eprintln!("ERROR: enrollment failed: {e}");
                    std::process::exit(1);
                }
            }
        }
    };

    // Heartbeat loop with graceful shutdown.
    let mut sys = System::new_all();
    let mut interval = tokio::time::interval(Duration::from_secs(HEARTBEAT_SECS));

    // Shared counter so heartbeat reports the number of in-flight jobs.
    let active = Arc::new(AtomicI32::new(0));

    // Background job poller — long-polls /jobs/next, executes, posts result.
    tokio::spawn(job_loop(state.clone(), http.clone(), active.clone()));

    #[cfg(unix)]
    let mut sigterm = match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("WARN: sigterm handler unavailable: {e}");
            // Continue without graceful shutdown
            let () = std::future::pending().await;
            return;
        }
    };

    loop {
        #[cfg(unix)]
        tokio::select! {
            _ = interval.tick() => {
                let n = active.load(Ordering::SeqCst);
                if let Err(e) = heartbeat(&state, &http, &mut sys, n).await {
                    if e == "UNAUTHORIZED" {
                        eprintln!("[agent] 401 on heartbeat — state invalidated, exiting for re-enrollment");
                        std::process::exit(10);
                    }
                    eprintln!("[agent] heartbeat error: {e}");
                }
            }
            _ = tokio::signal::ctrl_c() => {
                eprintln!("[agent] SIGINT received, exiting");
                break;
            }
            _ = sigterm.recv() => {
                eprintln!("[agent] SIGTERM received, exiting");
                break;
            }
        }
        #[cfg(not(unix))]
        tokio::select! {
            _ = interval.tick() => {
                let n = active.load(Ordering::SeqCst);
                if let Err(e) = heartbeat(&state, &http, &mut sys, n).await {
                    if e == "UNAUTHORIZED" {
                        eprintln!("[agent] 401 on heartbeat — state invalidated, exiting for re-enrollment");
                        std::process::exit(10);
                    }
                    eprintln!("[agent] heartbeat error: {e}");
                }
            }
            _ = tokio::signal::ctrl_c() => {
                eprintln!("[agent] Ctrl-C received, exiting");
                break;
            }
        }
    }
}
