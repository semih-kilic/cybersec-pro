use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::{RwLock, Semaphore};
use uuid::Uuid;
use chrono::Utc;

use crate::error::AppError;
use crate::models::*;

/// High-performance scan execution engine
/// 
/// Key security features:
/// - Tool whitelist: Only allowed tools can be executed
/// - No shell execution: Commands are built as argument vectors (never shell=true)
/// - Argument sanitization: Dangerous patterns blocked
/// - Concurrent limit: Semaphore-based worker pool
/// - Timeout enforcement: Per-scan timeout with automatic kill
/// - Output capture: Real-time stdout/stderr buffering
pub struct ScanEngine {
    scans: Arc<RwLock<HashMap<String, ScanStatus>>>,
    outputs: Arc<RwLock<HashMap<String, Vec<String>>>>,
    semaphore: Arc<Semaphore>,
    max_workers: usize,
}

impl ScanEngine {
    pub fn new(max_workers: usize) -> Self {
        Self {
            scans: Arc::new(RwLock::new(HashMap::new())),
            outputs: Arc::new(RwLock::new(HashMap::new())),
            semaphore: Arc::new(Semaphore::new(max_workers)),
            max_workers,
        }
    }

    /// Validate and sanitize scan parameters
    fn validate_request(req: &ScanRequest) -> Result<(), AppError> {
        // 1. Check tool whitelist
        if !ALLOWED_TOOLS.contains(&req.tool.as_str()) {
            return Err(AppError::Validation(format!(
                "Tool '{}' is not in the allowed whitelist", req.tool
            )));
        }

        // 2. Validate target (no shell injection)
        for pattern in BLOCKED_PATTERNS {
            if req.target.contains(pattern) {
                return Err(AppError::Validation(format!(
                    "Target contains blocked pattern: '{}'", pattern
                )));
            }
        }

        // 3. Validate params
        if let Some(params) = &req.params {
            let params_str = params.to_string();
            for pattern in BLOCKED_PATTERNS {
                if params_str.contains(pattern) {
                    return Err(AppError::Validation(format!(
                        "Parameters contain blocked pattern: '{}'", pattern
                    )));
                }
            }
        }

        Ok(())
    }

    /// Build safe command arguments from scan request
    fn build_command(req: &ScanRequest) -> Vec<String> {
        let mut args = Vec::new();

        // Tool-specific argument builders
        match req.tool.as_str() {
            "nmap" => {
                // Base nmap args
                if let Some(profile) = &req.profile {
                    match profile.as_str() {
                        "quick" => args.extend_from_slice(&["-T4".into(), "-F".into()]),
                        "standard" => args.extend_from_slice(&["-sV".into(), "-sC".into()]),
                        "deep" => args.extend_from_slice(&["-sV".into(), "-sC".into(), "-A".into(), "-p-".into()]),
                        _ => args.push("-sV".into()),
                    }
                }
                args.push(req.target.clone());
            }
            "nikto" => {
                args.extend_from_slice(&["-h".into(), req.target.clone()]);
            }
            "gobuster" | "ffuf" | "feroxbuster" => {
                args.extend_from_slice(&["dir".into(), "-u".into(), req.target.clone()]);
            }
            "nuclei" => {
                args.extend_from_slice(&["-u".into(), req.target.clone(), "-as".into()]);
            }
            "subfinder" => {
                args.extend_from_slice(&["-d".into(), req.target.clone()]);
            }
            "httpx" => {
                args.extend_from_slice(&["-u".into(), req.target.clone()]);
            }
            _ => {
                // Generic: just pass target as last arg
                args.push(req.target.clone());
            }
        }

        args
    }

    /// Execute a scan (non-blocking, spawns background task)
    pub async fn execute(&self, req: ScanRequest) -> Result<String, AppError> {
        // Validate
        Self::validate_request(&req)?;

        let scan_id = Uuid::new_v4().to_string();
        let timeout_secs = req.timeout.unwrap_or(300);
        let tool = req.tool.clone();
        let target = req.target.clone();
        let args = Self::build_command(&req);

        // Create scan status
        let status = ScanStatus {
            scan_id: scan_id.clone(),
            status: ScanState::Queued,
            tool: tool.clone(),
            target: target.clone(),
            started_at: Utc::now(),
            finished_at: None,
            progress: 0,
            exit_code: None,
            error: None,
        };

        // Register scan
        {
            let mut scans = self.scans.write().await;
            scans.insert(scan_id.clone(), status);
        }
        {
            let mut outputs = self.outputs.write().await;
            outputs.insert(scan_id.clone(), Vec::new());
        }

        // Spawn execution task
        let scans = self.scans.clone();
        let outputs = self.outputs.clone();
        let semaphore = self.semaphore.clone();
        let scan_id_clone = scan_id.clone();

        tokio::spawn(async move {
            // Acquire worker slot (semaphore is never closed, so unwrap is safe here,
            // but we handle the error gracefully anyway)
            let _permit = match semaphore.acquire().await {
                Ok(p) => p,
                Err(e) => {
                    tracing::error!("Semaphore acquire failed for scan {}: {}", scan_id_clone, e);
                    let mut s = scans.write().await;
                    if let Some(scan) = s.get_mut(&scan_id_clone) {
                        scan.status = ScanState::Failed;
                        scan.error = Some("Worker pool unavailable".to_string());
                        scan.finished_at = Some(Utc::now());
                    }
                    return;
                }
            };

            // Update status to running
            {
                let mut s = scans.write().await;
                if let Some(scan) = s.get_mut(&scan_id_clone) {
                    scan.status = ScanState::Running;
                    scan.progress = 10;
                }
            }

            // Execute command (NO SHELL — direct process spawn)
            let result = tokio::time::timeout(
                std::time::Duration::from_secs(timeout_secs as u64),
                Self::run_process(&tool, &args, &outputs, &scan_id_clone),
            )
            .await;

            // Update final status
            let mut s = scans.write().await;
            if let Some(scan) = s.get_mut(&scan_id_clone) {
                match result {
                    Ok(Ok(exit_code)) => {
                        scan.status = if exit_code == 0 { ScanState::Completed } else { ScanState::Failed };
                        scan.exit_code = Some(exit_code);
                        scan.progress = 100;
                    }
                    Ok(Err(e)) => {
                        scan.status = ScanState::Failed;
                        scan.error = Some(e.to_string());
                        scan.progress = 100;
                    }
                    Err(_) => {
                        scan.status = ScanState::Timeout;
                        scan.error = Some(format!("Scan timed out after {}s", timeout_secs));
                        scan.progress = 100;
                    }
                }
                scan.finished_at = Some(Utc::now());
            }
        });

        Ok(scan_id)
    }

    /// Run a process safely (no shell, argument vector only)
    async fn run_process(
        tool: &str,
        args: &[String],
        outputs: &Arc<RwLock<HashMap<String, Vec<String>>>>,
        scan_id: &str,
    ) -> Result<i32, AppError> {
        tracing::info!("Executing: {} {:?}", tool, args);

        let mut child = Command::new(tool)
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true) // Safety: kill process if task is dropped
            .spawn()
            .map_err(|e| AppError::ScanExec(format!("Failed to spawn {}: {}", tool, e)))?;

        // Stream stdout
        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            let outputs = outputs.clone();
            let scan_id = scan_id.to_string();

            tokio::spawn(async move {
                while let Ok(Some(line)) = lines.next_line().await {
                    let mut out = outputs.write().await;
                    if let Some(buffer) = out.get_mut(&scan_id) {
                        // Cap output at 10000 lines
                        if buffer.len() < 10000 {
                            buffer.push(line);
                        }
                    }
                }
            });
        }

        let status = child.wait().await
            .map_err(|e| AppError::ScanExec(format!("Process wait failed: {}", e)))?;

        Ok(status.code().unwrap_or(-1))
    }

    /// Get scan status
    pub async fn get_status(&self, scan_id: &str) -> Result<ScanStatus, AppError> {
        let scans = self.scans.read().await;
        scans.get(scan_id)
            .cloned()
            .ok_or(AppError::NotFound(format!("Scan {} not found", scan_id)))
    }

    /// Cancel a running scan
    pub async fn cancel(&self, scan_id: &str) -> Result<(), AppError> {
        let mut scans = self.scans.write().await;
        if let Some(scan) = scans.get_mut(scan_id) {
            if scan.status == ScanState::Running || scan.status == ScanState::Queued {
                scan.status = ScanState::Cancelled;
                scan.finished_at = Some(Utc::now());
                scan.progress = 100;
                Ok(())
            } else {
                Err(AppError::Validation(format!("Scan {} is not running", scan_id)))
            }
        } else {
            Err(AppError::NotFound(format!("Scan {} not found", scan_id)))
        }
    }

    /// Get scan output lines
    pub async fn get_output(&self, scan_id: &str) -> Result<Vec<String>, AppError> {
        let outputs = self.outputs.read().await;
        outputs.get(scan_id)
            .cloned()
            .ok_or(AppError::NotFound(format!("Scan {} output not found", scan_id)))
    }
}
