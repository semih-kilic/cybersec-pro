/// CyberSec Pro — Site Monitor Service (Rust)
/// Replaces Python site_monitor.py
/// Background task that checks HTTP endpoints and sends alert emails when services go down.
use crate::services::email::{self, EmailConfig};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorTarget {
    pub name: String,
    pub url: String,
    pub critical: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorState {
    pub name: String,
    pub url: String,
    pub is_up: bool,
    pub status_code: Option<u16>,
    pub error: Option<String>,
    pub last_check: String,
    pub consecutive_failures: u32,
}

pub struct SiteMonitor {
    targets: Vec<MonitorTarget>,
    states: RwLock<HashMap<String, MonitorState>>,
    alert_email: Option<String>,
}

impl SiteMonitor {
    pub fn new() -> Arc<Self> {
        let alert_email = std::env::var("ALERT_EMAIL").ok();
        let targets = vec![
            MonitorTarget {
                name: "Sales Website".into(),
                url: std::env::var("DOMAIN")
                    .unwrap_or_else(|_| "https://semihkilic.com".into()),
                critical: true,
            },
            MonitorTarget {
                name: "Main App API".into(),
                url: "http://127.0.0.1:5001/health".into(),
                critical: true,
            },
            MonitorTarget {
                name: "Frontend Dev Server".into(),
                url: "http://127.0.0.1:3001".into(),
                critical: false,
            },
        ];

        Arc::new(Self {
            targets,
            states: RwLock::new(HashMap::new()),
            alert_email,
        })
    }

    pub async fn monitor_loop(self: Arc<Self>) {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        loop {
            interval.tick().await;
            for target in &self.targets {
                let result = client.get(&target.url).send().await;
                let now = chrono::Utc::now().to_rfc3339();

                let (is_up, status_code, error) = match result {
                    Ok(resp) => {
                        let code = resp.status().as_u16();
                        (code == 200, Some(code), None)
                    }
                    Err(e) => (false, None, Some(e.to_string())),
                };

                let mut states = self.states.write().await;
                let prev = states.get(&target.name);
                let was_up = prev.map(|s| s.is_up).unwrap_or(true);
                let consecutive = if is_up {
                    0
                } else {
                    prev.map(|s| s.consecutive_failures).unwrap_or(0) + 1
                };

                // Transition: was up → now down → send alert
                if was_up && !is_up && target.critical {
                    tracing::warn!("🔴 {} is DOWN: {:?}", target.name, error);
                    if let Some(ref alert_addr) = self.alert_email {
                        if let Some(cfg) = EmailConfig::from_env() {
                            let msg = format!(
                                "{} is DOWN!\nURL: {}\nError: {}\nTime: {}",
                                target.name,
                                target.url,
                                error.as_deref().unwrap_or("Unknown"),
                                now
                            );
                            let _ = email::send_welcome_email(&cfg, alert_addr, &msg).await;
                        }
                    }
                } else if !was_up && is_up {
                    tracing::info!("🟢 {} is BACK UP", target.name);
                }

                states.insert(
                    target.name.clone(),
                    MonitorState {
                        name: target.name.clone(),
                        url: target.url.clone(),
                        is_up,
                        status_code,
                        error,
                        last_check: now,
                        consecutive_failures: consecutive,
                    },
                );
            }
        }
    }

    pub async fn get_status(&self) -> Vec<MonitorState> {
        self.states.read().await.values().cloned().collect()
    }
}
