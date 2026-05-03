//! CyberSec Pro reverse-tunnel agent.
//!
//! Behavior:
//! 1. Read `CSP_TOKEN` (one-time enrollment JWT) and `CSP_API_URL`
//!    (defaults to https://cybersecpro.semihkilic.com).
//! 2. POST `/api/v1/agents/enroll` to exchange token for `{agent_id, api_key}`.
//! 3. Persist `agent_id` + `api_key` to `~/.cybersec-agent/state.json`.
//! 4. Loop: every 30s POST heartbeat with cpu/mem/active_scans metrics.
//! 5. Exit cleanly on SIGINT / SIGTERM.
//!
//! Zero inbound ports. All traffic is the agent dialing out over TLS.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use sysinfo::System;

const DEFAULT_API: &str = "https://cybersecpro.semihkilic.com";
const HEARTBEAT_SECS: u64 = 30;
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
    let raw = serde_json::to_string_pretty(s).unwrap();
    std::fs::write(path, raw)
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

async fn heartbeat(state: &AgentState, http: &reqwest::Client, sys: &mut System) -> Result<(), String> {
    sys.refresh_cpu();
    sys.refresh_memory();
    let cpu = sys.global_cpu_info().cpu_usage();
    let mem_pct = if sys.total_memory() > 0 {
        (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0
    } else {
        0.0
    };
    let body = serde_json::json!({
        "cpu_usage": cpu,
        "memory_usage": mem_pct,
        "active_scans": 0,
    });
    let url = format!("{}/api/v1/agents/{}/heartbeat", state.api_url, state.agent_id);
    let resp = http
        .post(url)
        .bearer_auth(&state.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("heartbeat send: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("heartbeat status {}", resp.status()));
    }
    Ok(())
}

#[tokio::main]
async fn main() {
    let api_url = std::env::var("CSP_API_URL").unwrap_or_else(|_| DEFAULT_API.to_string());
    let http = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(20))
        .build()
        .expect("http client");

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

    #[cfg(unix)]
    let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        .expect("sigterm handler");

    loop {
        #[cfg(unix)]
        tokio::select! {
            _ = interval.tick() => {
                if let Err(e) = heartbeat(&state, &http, &mut sys).await {
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
                if let Err(e) = heartbeat(&state, &http, &mut sys).await {
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
