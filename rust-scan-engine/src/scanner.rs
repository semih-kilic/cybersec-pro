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
    /// Live child processes keyed by scan_id — enables real cancellation.
    children: Arc<RwLock<HashMap<String, (u32, Arc<tokio::sync::Mutex<tokio::process::Child>>)>>>,
    semaphore: Arc<Semaphore>,
    max_workers: usize,
}

impl ScanEngine {
    pub fn new(max_workers: usize) -> Self {
        Self {
            scans: Arc::new(RwLock::new(HashMap::new())),
            outputs: Arc::new(RwLock::new(HashMap::new())),
            children: Arc::new(RwLock::new(HashMap::new())),
            semaphore: Arc::new(Semaphore::new(max_workers)),
            max_workers,
        }
    }

    /// Drop terminal scans (and their buffered output / child handles) older
    /// than `max_age_secs`. Called at the top of `execute` to bound memory.
    pub async fn sweep_stale(&self, max_age_secs: i64) {
        let cutoff = Utc::now() - chrono::Duration::seconds(max_age_secs);
        let mut stale: Vec<String> = Vec::new();
        {
            let mut scans = self.scans.write().await;
            scans.retain(|id, s| {
                let keep = s.finished_at.map(|f| f > cutoff).unwrap_or(true);
                if !keep { stale.push(id.clone()); }
                keep
            });
        }
        if stale.is_empty() { return; }
        {
            let mut outputs = self.outputs.write().await;
            for id in &stale { outputs.remove(id); }
        }
        {
            let mut kids = self.children.write().await;
            for id in &stale { kids.remove(id); }
        }
        tracing::debug!("swept {} stale scan entries", stale.len());
    }

    /// Kill a live child process (best-effort).
    async fn kill_child(
        children: &Arc<RwLock<HashMap<String, (u32, Arc<tokio::sync::Mutex<tokio::process::Child>>)>>>,
        scan_id: &str,
    ) {
        // Kill the whole process GROUP, not just the direct child. Tools like
        // amass/nuclei spawn sub-processes; killing only the child reparents the
        // grandchildren to PID 1 where they run forever (the 14h orphans we saw).
        // Reading the stored pid avoids locking the Child, which `wait()` holds
        // for the process's whole lifetime — locking here would deadlock.
        if let Some((pid, _child)) = children.read().await.get(scan_id) {
            Self::kill_process_group(*pid);
        }
    }

    /// SIGKILL an entire process group. A negative pid signals every process in
    /// the group led by `pid` (established via `.process_group(0)` at spawn).
    fn kill_process_group(pid: u32) {
        if pid == 0 { return; }
        unsafe { libc::kill(-(pid as i32), libc::SIGKILL); }
    }

    /// Validate and sanitize scan parameters
    fn validate_request(req: &ScanRequest) -> Result<(), AppError> {
        // 1. Check tool whitelist — unless the trusted backend supplied pre-built args.
        //    When `command_args` is present, the program came from the DB-backed
        //    backend (already whitelisted there); we still enforce blocked patterns.
        if req.command_args.is_none() && !ALLOWED_TOOLS.contains(&req.tool.as_str()) {
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

        // 4. Validate pre-built args (no shell metacharacters)
        if let Some(args) = &req.command_args {
            for arg in args {
                for pattern in BLOCKED_PATTERNS {
                    if arg.contains(pattern) {
                        return Err(AppError::Validation(format!(
                            "Argument contains blocked pattern '{}': {}", pattern, arg
                        )));
                    }
                }
            }
        }

        Ok(())
    }

    /// Build safe command arguments from scan request.
    /// Returns `(program, args)`.
    fn build_command(req: &ScanRequest) -> (String, Vec<String>) {
        // Pre-built argv from the trusted backend wins.
        if let Some(args) = &req.command_args {
            let program = req.program.as_deref().unwrap_or(&req.tool).to_string();
            return (program, args.clone());
        }

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

        (req.tool.clone(), args)
    }

    /// Execute a scan (non-blocking, spawns background task)
    pub async fn execute(&self, req: ScanRequest) -> Result<String, AppError> {
        // Validate
        Self::validate_request(&req)?;

        let scan_id = Uuid::new_v4().to_string();
        let timeout_secs = req.timeout.unwrap_or(300);
        let tool = req.tool.clone();
        let target = req.target.clone();
        let (program, args) = Self::build_command(&req);

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

        // Bound memory: evict long-finished entries before registering a new one.
        self.sweep_stale(900).await;

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
        let children = self.children.clone();
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
                Self::run_process(&program, &args, &outputs, &children, &scan_id_clone),
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
                        // Timeout alone does not kill the process (it lives in
                        // `children` until completion) — kill it explicitly.
                        Self::kill_child(&children, &scan_id_clone).await;
                    }
                }
                scan.finished_at = Some(Utc::now());
            }
        });

        Ok(scan_id)
    }

    /// Run a process safely (no shell, argument vector only)
    async fn run_process(
        program: &str,
        args: &[String],
        outputs: &Arc<RwLock<HashMap<String, Vec<String>>>>,
        children: &Arc<RwLock<HashMap<String, (u32, Arc<tokio::sync::Mutex<tokio::process::Child>>)>>>,
        scan_id: &str,
    ) -> Result<i32, AppError> {
        tracing::info!("Executing: {} {:?}", program, args);

        let mut child = Command::new(program)
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true) // Safety: kill process if task is dropped
            .process_group(0)   // own group, so we can kill the whole subtree
            .spawn()
            .map_err(|e| AppError::ScanExec(format!("Failed to spawn {}: {}", program, e)))?;

        // Stream stdout into the shared buffer
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

        // Drain stderr (prevents pipe-buffer deadlock on chatty tools) and
        // surface it as prefixed lines, capped like stdout.
        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            let outputs = outputs.clone();
            let scan_id = scan_id.to_string();

            tokio::spawn(async move {
                while let Ok(Some(line)) = lines.next_line().await {
                    let mut out = outputs.write().await;
                    if let Some(buffer) = out.get_mut(&scan_id) {
                        if buffer.len() < 10000 {
                            buffer.push(format!("[stderr] {}", line));
                        }
                    }
                }
            });
        }

        // Register the live child (with its pid) so `cancel`/timeout can kill
        // the whole process group.
        let pid = child.id().unwrap_or(0);
        let child = Arc::new(tokio::sync::Mutex::new(child));
        children.write().await.insert(scan_id.to_string(), (pid, child.clone()));

        let status = child.lock().await.wait().await
            .map_err(|e| AppError::ScanExec(format!("Process wait failed: {}", e)))?;

        // Reap any background children the tool left behind on normal exit, then
        // drop the handle. Without this, detached grandchildren leak.
        Self::kill_process_group(pid);
        children.write().await.remove(scan_id);

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
        // Terminate the live process first (status flip alone left orphans).
        Self::kill_child(&self.children, scan_id).await;

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ScanRequest, ALLOWED_TOOLS, BLOCKED_PATTERNS};

    fn make_request(tool: &str, target: &str) -> ScanRequest {
        ScanRequest {
            tool: tool.into(),
            target: target.into(),
            params: None,
            user_id: None,
            profile: None,
            timeout: None,
            program: None,
            command_args: None,
        }
    }

    // ── validate_request: tool whitelist ─────────────────────────────────────

    #[test]
    fn scan_engine_rejects_tool_not_in_whitelist() {
        let req = make_request("bash", "10.0.0.1");
        let err = ScanEngine::validate_request(&req).unwrap_err();
        assert!(err.to_string().contains("not in the allowed whitelist"),
            "expected whitelist error, got: {}", err);
    }

    #[test]
    fn scan_engine_rejects_python_interpreter() {
        let req = make_request("python3", "10.0.0.1");
        assert!(ScanEngine::validate_request(&req).is_err());
    }

    #[test]
    fn scan_engine_accepts_all_whitelisted_tools() {
        // Every tool in ALLOWED_TOOLS must pass validation against a safe target
        let deduped: std::collections::HashSet<&str> = ALLOWED_TOOLS.iter().copied().collect();
        for tool in &deduped {
            let req = make_request(tool, "10.0.0.1");
            assert!(
                ScanEngine::validate_request(&req).is_ok(),
                "tool '{}' should be accepted but was rejected", tool
            );
        }
    }

    // ── validate_request: target injection ───────────────────────────────────

    #[test]
    fn scan_engine_blocks_semicolon_in_target() {
        let req = make_request("nmap", "10.0.0.1; rm -rf /");
        let err = ScanEngine::validate_request(&req).unwrap_err();
        assert!(err.to_string().contains("blocked pattern"), "got: {}", err);
    }

    #[test]
    fn scan_engine_blocks_pipe_in_target() {
        let req = make_request("nmap", "10.0.0.1 | cat /etc/passwd");
        assert!(ScanEngine::validate_request(&req).is_err());
    }

    #[test]
    fn scan_engine_blocks_command_substitution_in_target() {
        let req = make_request("nmap", "$(whoami).example.com");
        assert!(ScanEngine::validate_request(&req).is_err());
    }

    #[test]
    fn scan_engine_blocks_path_traversal_in_target() {
        let req = make_request("nmap", "../../etc/passwd");
        assert!(ScanEngine::validate_request(&req).is_err());
    }

    #[test]
    fn scan_engine_accepts_valid_ip_target() {
        let req = make_request("nmap", "192.168.1.100");
        assert!(ScanEngine::validate_request(&req).is_ok());
    }

    #[test]
    fn scan_engine_accepts_valid_domain_target() {
        let req = make_request("nikto", "example.com");
        assert!(ScanEngine::validate_request(&req).is_ok());
    }

    // ── validate_request: params injection ───────────────────────────────────

    #[test]
    fn scan_engine_blocks_shell_injection_in_params() {
        let mut req = make_request("nmap", "10.0.0.1");
        req.params = Some(serde_json::json!({"flags": "--script=vuln; id"}));
        assert!(ScanEngine::validate_request(&req).is_err());
    }

    #[test]
    fn scan_engine_allows_nmap_script_param() {
        // --script= is a legitimate nmap feature and is no longer blocked
        let mut req = make_request("nmap", "10.0.0.1");
        req.params = Some(serde_json::json!({"flags": "--script=vuln"}));
        assert!(ScanEngine::validate_request(&req).is_ok());
    }

    #[test]
    fn scan_engine_bypasses_whitelist_with_command_args() {
        // Trusted backend supplies pre-built argv for a tool outside ALLOWED_TOOLS
        let mut req = make_request("openvas", "10.0.0.1");
        req.command_args = Some(vec!["-v".into(), "10.0.0.1".into()]);
        req.program = Some("gvm-cli".into());
        assert!(ScanEngine::validate_request(&req).is_ok());
    }

    #[test]
    fn scan_engine_blocks_shell_injection_in_command_args() {
        let mut req = make_request("nmap", "10.0.0.1");
        req.command_args = Some(vec!["-p".into(), "80".into(), "10.0.0.1; id".into()]);
        assert!(ScanEngine::validate_request(&req).is_err());
    }

    #[test]
    fn scan_engine_uses_prebuilt_args_verbatim() {
        let mut req = make_request("nmap", "10.0.0.1");
        req.program = Some("nmap".into());
        req.command_args = Some(vec!["-sV".into(), "-p".into(), "80".into(), "10.0.0.1".into()]);
        let (program, args) = ScanEngine::build_command(&req);
        assert_eq!(program, "nmap");
        assert_eq!(args, vec!["-sV", "-p", "80", "10.0.0.1"]);
    }

    // ── build_command ─────────────────────────────────────────────────────────

    #[test]
    fn scan_engine_nmap_quick_profile_adds_t4_and_f_flags() {
        let mut req = make_request("nmap", "10.0.0.1");
        req.profile = Some("quick".into());
        let (_program, args) = ScanEngine::build_command(&req);
        assert!(args.contains(&"-T4".to_string()), "quick profile missing -T4");
        assert!(args.contains(&"-F".to_string()), "quick profile missing -F");
        assert!(args.contains(&"10.0.0.1".to_string()), "target missing");
    }

    #[test]
    fn scan_engine_nmap_deep_profile_adds_all_ports_flag() {
        let mut req = make_request("nmap", "10.0.0.5");
        req.profile = Some("deep".into());
        let (_program, args) = ScanEngine::build_command(&req);
        assert!(args.contains(&"-p-".to_string()), "deep profile missing -p-");
        assert!(args.contains(&"-A".to_string()), "deep profile missing -A");
    }

    #[test]
    fn scan_engine_nikto_includes_h_flag_before_target() {
        let req = make_request("nikto", "https://example.com");
        let (_program, args) = ScanEngine::build_command(&req);
        let h_pos = args.iter().position(|a| a == "-h");
        let target_pos = args.iter().position(|a| a == "https://example.com");
        assert!(h_pos.is_some(), "nikto missing -h flag");
        assert!(target_pos.is_some(), "nikto missing target");
        assert!(h_pos.unwrap() < target_pos.unwrap(), "-h must precede target");
    }

    #[test]
    fn scan_engine_nuclei_includes_as_flag() {
        let req = make_request("nuclei", "https://example.com");
        let (_program, args) = ScanEngine::build_command(&req);
        assert!(args.contains(&"-as".to_string()), "nuclei missing -as auto-scan flag");
        assert!(args.contains(&"https://example.com".to_string()));
    }

    #[test]
    fn scan_engine_blocked_patterns_covers_critical_injections() {
        // Verify the constant contains the most dangerous shell metacharacters
        let required = [";", "&&", "||", "|", "`", "$(", "${", "../"];
        for pat in required {
            assert!(BLOCKED_PATTERNS.contains(&pat),
                "BLOCKED_PATTERNS missing critical pattern: '{}'", pat);
        }
    }
}
