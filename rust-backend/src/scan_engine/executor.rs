use anyhow::{anyhow, Result};
use serde_json::Value as JsonValue;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::broadcast;
use tokio::time::{timeout, Duration};
use nix::sys::signal::{killpg, Signal};
use nix::unistd::Pid;

use super::parsers::parse_output;
use super::tool_registry::{build_command, get_tool_max_runtime_secs};

#[allow(dead_code)]
pub struct ScanResult {
    pub output: String,
    pub findings: Option<JsonValue>,
    pub exit_code: Option<i32>,
}

/// Agent SSH connection details for remote scan execution
pub struct AgentSshInfo {
    pub ssh_host: String,
    pub ssh_port: i32,
    pub ssh_username: String,
    pub ssh_key_path: Option<String>,
    /// Known host fingerprint stored at agent registration time.
    /// If Some, StrictHostKeyChecking is enabled and fingerprint is verified.
    pub ssh_fingerprint: Option<String>,
}

/// Execute a security scan tool as a subprocess with real-time output streaming.
/// If `agent_ssh` is provided, the scan command is dispatched to the remote agent via SSH.
pub async fn execute_scan(
    tool_name: &str,
    target: &str,
    command_template: Option<&str>,
    tx: &broadcast::Sender<String>,
    scan_id: &str,
    agent_ssh: Option<AgentSshInfo>,
) -> Result<ScanResult> {
    // Build the command
    let (program, args) = build_command(tool_name, target, command_template)?;

    let (actual_program, actual_args, execution_mode) = if let Some(ssh) = &agent_ssh {
        // Remote execution via SSH
        let remote_cmd = format!("{} {}", shell_escape(&program), args.iter().map(|a| shell_escape(a)).collect::<Vec<_>>().join(" "));
        let mut ssh_args = vec![
            "-o".to_string(), "ConnectTimeout=10".to_string(),
            "-o".to_string(), "BatchMode=yes".to_string(),
            "-p".to_string(), ssh.ssh_port.to_string(),
        ];

        // Use stored fingerprint for host verification (prevents MITM)
        if let Some(fp) = &ssh.ssh_fingerprint {
            ssh_args.push("-o".to_string());
            ssh_args.push("StrictHostKeyChecking=yes".to_string());
            ssh_args.push("-o".to_string());
            ssh_args.push(format!("FingerprintHash=sha256"));
            // Write known_hosts entry to a temp file
            let known_hosts_content = format!("[{}]:{} {}", ssh.ssh_host, ssh.ssh_port, fp);
            let tmp_path = format!("/tmp/cybersec_known_hosts_{}", uuid::Uuid::new_v4());
            if tokio::fs::write(&tmp_path, known_hosts_content).await.is_ok() {
                ssh_args.push("-o".to_string());
                ssh_args.push(format!("UserKnownHostsFile={}", tmp_path));
            }
        } else {
            // No fingerprint stored — refuse connection for security
            return Err(anyhow!(
                "Agent {} has no stored SSH fingerprint. Re-register the agent to store its fingerprint.",
                ssh.ssh_host
            ));
        }

        if let Some(key_path) = &ssh.ssh_key_path {
            ssh_args.push("-i".to_string());
            ssh_args.push(key_path.clone());
        }
        ssh_args.push(format!("{}@{}", ssh.ssh_username, ssh.ssh_host));
        ssh_args.push(remote_cmd);
        ("ssh".to_string(), ssh_args, "remote")
    } else {
        // Local execution — verify binary exists
        let which = Command::new("which")
            .arg(&program)
            .output()
            .await?;
        if !which.status.success() {
            return Err(anyhow!("Tool binary not found: {}", program));
        }
        (program.clone(), args, "local")
    };

    // Send scan phase update
    let _ = tx.send(serde_json::json!({
        "type": "output",
        "scan_id": scan_id,
        "phase": "executing",
        "execution_mode": execution_mode,
        "line": format!("Starting {} on {} ({})", tool_name, target, execution_mode),
        "data": format!("Starting {} on {} ({})", tool_name, target, execution_mode)
    }).to_string());

    // Spawn process in its own process group for clean cleanup
    let mut child = Command::new(&actual_program)
        .args(&actual_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .process_group(0)  // Create new process group so we can kill entire tree
        .spawn()
        .map_err(|e| anyhow!("Failed to spawn {}: {}", program, e))?;

    let child_pid = child.id().unwrap_or(0) as i32;

    let stdout = child.stdout.take().ok_or_else(|| anyhow!("No stdout"))?;
    let stderr = child.stderr.take().ok_or_else(|| anyhow!("No stderr"))?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut output = String::new();
    let mut stderr_output = String::new();
    let mut stderr_done = false;

    let tx_clone = tx.clone();
    let scan_id_owned = scan_id.to_string();

    // Spawn heartbeat task for local execution
    let heartbeat_tx = tx.clone();
    let heartbeat_scan_id = scan_id.to_string();
    let heartbeat_handle = tokio::spawn(async move {
        let mut counter = 0u32;
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            counter += 1;
            let elapsed = counter * 5;
            let _ = heartbeat_tx.send(serde_json::json!({
                "type": "heartbeat",
                "scan_id": heartbeat_scan_id,
                "line": format!("⏳ Scan in progress... ({}s elapsed)", elapsed),
                "data": format!("⏳ Scan in progress... ({}s elapsed)", elapsed),
                "heartbeat": true
            }).to_string());
        }
    });

    // Per-tool runtime override (defaults to 900s); slow tools like nikto/gitleaks get more headroom.
    let max_runtime_secs = get_tool_max_runtime_secs(tool_name);

    // Read stdout and stderr concurrently with timeout
    let result = timeout(Duration::from_secs(max_runtime_secs), async {
        loop {
            if stderr_done {
                // Only read stdout
                match stdout_reader.next_line().await {
                    Ok(Some(line)) => {
                        output.push_str(&line);
                        output.push('\n');
                        let _ = tx_clone.send(serde_json::json!({
                            "type": "output",
                            "scan_id": scan_id_owned,
                            "line": line,
                            "data": line
                        }).to_string());
                    }
                    Ok(None) => break,
                    Err(e) => {
                        tracing::warn!("stdout read error: {}", e);
                        break;
                    }
                }
            } else {
                tokio::select! {
                    line = stdout_reader.next_line() => {
                        match line {
                            Ok(Some(line)) => {
                                output.push_str(&line);
                                output.push('\n');
                                let _ = tx_clone.send(serde_json::json!({
                                    "type": "output",
                                    "scan_id": scan_id_owned,
                                    "line": line,
                                    "data": line
                                }).to_string());
                            }
                            Ok(None) => break,
                            Err(e) => {
                                tracing::warn!("stdout read error: {}", e);
                                break;
                            }
                        }
                    }
                    line = stderr_reader.next_line() => {
                        match line {
                            Ok(Some(line)) => {
                                stderr_output.push_str(&line);
                                stderr_output.push('\n');
                            }
                            Ok(None) => { stderr_done = true; }
                            Err(_) => { stderr_done = true; }
                        }
                    }
                }
            }
        }
    })
    .await;

    if result.is_err() {
        // Timeout — kill the entire process group (not just direct child)
        // Guard: never send signal to PID 0 (would kill entire process group of the server)
        if child_pid > 0 {
            let _ = killpg(Pid::from_raw(child_pid), Signal::SIGKILL);
        } else {
            tracing::warn!("Could not get child PID for scan {}, attempting direct kill", scan_id);
        }
        let _ = child.kill().await;
        return Err(anyhow!("Scan timed out after {} seconds", max_runtime_secs));
    }

    // Stop heartbeat
    heartbeat_handle.abort();

    let status = child.wait().await?;
    let exit_code = status.code();

    // Combine stderr into output — append after stdout (many tools write to stderr)
    if !stderr_output.trim().is_empty() {
        if output.trim().is_empty() {
            output = stderr_output;
        } else {
            output.push_str("\n--- STDERR ---\n");
            output.push_str(&stderr_output);
        }
    }

    // Parse output for structured findings
    let findings = parse_output(tool_name, &output);

    // Send completion
    let _ = tx.send(serde_json::json!({
        "type": "complete",
        "scan_id": scan_id,
        "status": "completed",
        "exit_code": exit_code,
        "output_length": output.len(),
        "result": {
            "status": if exit_code == Some(0) { "completed" } else { "failed" },
            "exit_code": exit_code,
            "output_length": output.len()
        }
    }).to_string());

    Ok(ScanResult {
        output,
        findings,
        exit_code,
    })
}

/// Escape a string for safe inclusion in a remote shell command
fn shell_escape(s: &str) -> String {
    if s.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '/' || c == ':') {
        s.to_string()
    } else {
        format!("'{}'", s.replace('\'', "'\\''"))
    }
}
