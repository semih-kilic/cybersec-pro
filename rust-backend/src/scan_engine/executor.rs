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
use super::tool_registry::build_command;

#[allow(dead_code)]
pub struct ScanResult {
    pub output: String,
    pub findings: Option<JsonValue>,
    pub exit_code: Option<i32>,
}

/// Execute a security scan tool as a subprocess with real-time output streaming.
pub async fn execute_scan(
    tool_name: &str,
    target: &str,
    command_template: Option<&str>,
    tx: &broadcast::Sender<String>,
    scan_id: &str,
) -> Result<ScanResult> {
    // Build the command
    let (program, args) = build_command(tool_name, target, command_template)?;

    // Verify binary exists
    let which = Command::new("which")
        .arg(&program)
        .output()
        .await?;
    if !which.status.success() {
        return Err(anyhow!("Tool binary not found: {}", program));
    }

    // Send scan phase update
    let _ = tx.send(serde_json::json!({
        "type": "output",
        "scan_id": scan_id,
        "phase": "executing",
        "line": format!("Starting {} on {}", tool_name, target),
        "data": format!("Starting {} on {}", tool_name, target)
    }).to_string());

    // Spawn process in its own process group for clean cleanup
    let mut child = Command::new(&program)
        .args(&args)
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

    // Read stdout and stderr concurrently with timeout
    let result = timeout(Duration::from_secs(30), async {
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
        if child_pid > 0 {
            let _ = killpg(Pid::from_raw(child_pid), Signal::SIGKILL);
        }
        let _ = child.kill().await;
        return Err(anyhow!("Scan timed out after 30 seconds"));
    }

    let status = child.wait().await?;
    let exit_code = status.code();

    // Combine stderr into output if stdout is empty
    if output.trim().is_empty() && !stderr_output.trim().is_empty() {
        output = stderr_output;
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
