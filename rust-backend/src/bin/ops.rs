use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::process::Stdio;
use std::time::{Duration, Instant};
use tokio::process::Command as TokioCommand;
use tokio::time::timeout;

#[derive(Parser)]
#[command(name = "cybersec-ops")]
#[command(about = "CyberSec Pro Operations CLI — replaces Python tooling scripts")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Binary health probe — check all tools respond to --version/--help
    HealthProbe {
        #[arg(long, default_value = "8")]
        workers: usize,
        #[arg(long)]
        apply: bool,
    },
    /// Quick smoke test — check tool binaries exist on PATH
    SmokeTest {
        #[arg(long)]
        apply: bool,
    },
    /// Deep smoke test — actually run tools with --help under timeout
    DeepSmoke {
        #[arg(long, default_value = "12")]
        workers: usize,
        #[arg(long)]
        apply: bool,
    },
    /// Audit and gate tools — decide active/inactive based on binary existence
    AuditGate {
        #[arg(long)]
        apply: bool,
    },
    /// Parser validation — launch scans and verify parser output
    ParserValidation {
        #[arg(long, default_value = "http://127.0.0.1:5001")]
        api_base: String,
    },
    /// Verify linked scan IDs for purple-team exercises
    VerifyLinkedScans {
        #[arg(long, default_value = "http://127.0.0.1:5001")]
        api_base: String,
    },
    /// Analyze broken tools from smoke test results
    AnalyzeBroken {
        #[arg(long, default_value = "tool_smoke_results.json")]
        input: String,
    },
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
struct ToolRow {
    id: String,
    name: String,
    binary_name: Option<String>,
    command_template: Option<String>,
    is_active: bool,
    health_status: Option<String>,
    health_exit_code: Option<i32>,
    health_evidence: Option<String>,
    last_health_check: Option<String>,
    hardware_required: Option<serde_json::Value>,
    gui_required: Option<bool>,
    exclusion_reason: Option<String>,
}

#[derive(Debug, Serialize)]
struct HealthProbeResult {
    tool_id: String,
    tool_name: String,
    status: String,
    exit_code: Option<i32>,
    evidence: String,
    probe_duration_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct SmokeResult {
    working: Vec<String>,
    broken: Vec<String>,
    total: usize,
}

#[derive(Debug, Serialize)]
struct DeepSmokeResult {
    tool_id: String,
    tool_name: String,
    status: String,
    exit_code: Option<i32>,
    evidence: String,
    probe_duration_ms: u64,
}

#[derive(Debug, Serialize)]
struct AuditDecision {
    tool_name: String,
    should_be_active: bool,
    reason: String,
}

const DANGEROUS_TOOLS: &[&str] = &[
    "shutdown", "reboot", "halt", "poweroff", "init",
    "msfconsole", "msfvenom", "meterpreter",
    "wireshark", "tcpdump", "ettercap", "bettercap",
    "aircrack-ng", "airmon-ng", "aireplay-ng",
    "hydra", "john", "hashcat", "medusa", "ncrack",
];

const TUI_TOOLS: &[&str] = &[
    "htop", "top", "btop", "glances", "atop",
    "nmtui", "nmcli", "systemctl", "journalctl",
    "vim", "nano", "less", "more",
];

const SKIP_PROBE_TOOLS: &[&str] = &[
    "metasploit", "burpsuite", "nessus", "openvas",
    "armitage", "cobalt strike", "empire",
];

fn get_db_dsn() -> String {
    std::env::var("PG_DSN").unwrap_or_else(|_| {
        "postgres://cybersec:***REMOVED-BY-AUDIT***@localhost:5432/cybersec_pro".to_string()
    })
}

async fn get_db_pool() -> Result<sqlx::PgPool, sqlx::Error> {
    let dsn = get_db_dsn();
    sqlx::PgPool::connect(&dsn).await
}

fn is_tui_tool(name: &str) -> bool {
    TUI_TOOLS.iter().any(|t| name.contains(t))
}

fn is_skip_probe(name: &str) -> bool {
    SKIP_PROBE_TOOLS.iter().any(|s| name.contains(s))
}

fn is_dangerous(name: &str) -> bool {
    DANGEROUS_TOOLS.iter().any(|d| name.contains(d))
}

fn parse_command_template(template: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = ' ';

    for c in template.chars() {
        match c {
            '"' | '\'' if !in_quotes => {
                in_quotes = true;
                quote_char = c;
            }
            c if in_quotes && c == quote_char => {
                in_quotes = false;
            }
            ' ' if !in_quotes => {
                if !current.is_empty() {
                    parts.push(current.clone());
                    current.clear();
                }
            }
            c => {
                current.push(c);
            }
        }
    }
    if !current.is_empty() {
        parts.push(current);
    }

    // Skip sudo, env, and other prefix commands
    let skip_prefixes = ["sudo", "env", "nice", "nohup", "time"];
    while !parts.is_empty() && skip_prefixes.contains(&parts[0].as_str()) {
        parts.remove(0);
    }

    parts
}

async fn cmd_health_probe(workers: usize, apply: bool) {
    println!("🔍 Running health probe with {} workers...", workers);
    let pool = match get_db_pool().await {
        Ok(p) => p,
        Err(e) => {
            eprintln!("❌ Database connection failed: {}", e);
            return;
        }
    };

    let tools: Vec<ToolRow> = sqlx::query_as::<_, ToolRow>(
        "SELECT id, name, binary_name, command_template, is_active, health_status, health_exit_code, health_evidence, last_health_check, hardware_required, gui_required, exclusion_reason FROM tools"
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let tools = std::sync::Arc::new(tools);
    let results = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::new()));
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(workers));

    let mut handles = Vec::new();
    for tool in tools.iter() {
        if is_tui_tool(&tool.name) || is_skip_probe(&tool.name) {
            continue;
        }

        let tool = tool.clone();
        let results = results.clone();
        let sem = semaphore.clone();

        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            let result = probe_tool(&tool).await;
            results.lock().await.push(result);
        }));
    }

    for h in handles {
        let _ = h.await;
    }

    let results = results.lock().await;
    let mut working = 0;
    let mut broken = 0;

    for r in results.iter() {
        match r.status.as_str() {
            "healthy" => {
                println!("  ✅ {} — {}ms", r.tool_name, r.probe_duration_ms);
                working += 1;
            }
            "missing" => {
                println!("  ❌ {} — binary not found", r.tool_name);
                broken += 1;
            }
            _ => {
                println!("  ⚠️  {} — {} (exit {})", r.tool_name, r.status, r.exit_code.unwrap_or(-1));
                broken += 1;
            }
        }
    }

    if apply {
        for r in results.iter() {
            let status = if r.status == "healthy" { "healthy" } else { "unhealthy" };
            let _ = sqlx::query(
                "UPDATE tools SET health_status = $1, health_exit_code = $2, health_evidence = $3, last_health_check = NOW() WHERE id = $4"
            )
            .bind(status)
            .bind(r.exit_code)
            .bind(&r.evidence)
            .bind(r.tool_id)
            .execute(&pool)
            .await;
        }
        println!("\n✅ Applied health status to database");
    }

    let report = serde_json::json!({
        "total_probed": results.len(),
        "working": working,
        "broken": broken,
        "results": results.iter().collect::<Vec<_>>(),
    });

    fs::write("/tmp/health_probe_report.json", serde_json::to_string_pretty(&report).unwrap()).ok();
    println!("\n📊 Report saved to /tmp/health_probe_report.json");
}

async fn probe_tool(tool: &ToolRow) -> HealthProbeResult {
    let start = Instant::now();
    let binary = tool.binary_name.as_deref().unwrap_or(&tool.name);

    let probes = ["--version", "-V", "-v", "--help", "-h"];
    for flag in &probes {
        let result = timeout(
            Duration::from_secs(5),
            TokioCommand::new(binary)
                .arg(flag)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
        ).await;

        match result {
            Ok(Ok(output)) => {
                let exit_code = output.status.code().unwrap_or(-1);
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                let evidence = if !stdout.is_empty() {
                    stdout.chars().take(800).collect::<String>()
                } else {
                    stderr.chars().take(800).collect::<String>()
                };

                let status = if exit_code == 0 || exit_code == 1 {
                    "healthy".to_string()
                } else {
                    format!("exit_{}", exit_code)
                };

                return HealthProbeResult {
                    tool_id: tool.id,
                    tool_name: tool.name.clone(),
                    status,
                    exit_code: Some(exit_code),
                    evidence,
                    probe_duration_ms: start.elapsed().as_millis() as u64,
                };
            }
            Ok(Err(_)) => continue,
            Err(_) => continue,
        }
    }

    HealthProbeResult {
        tool_id: tool.id,
        tool_name: tool.name.clone(),
        status: "missing".to_string(),
        exit_code: None,
        evidence: "Binary not found or all probes failed".to_string(),
        probe_duration_ms: start.elapsed().as_millis() as u64,
    }
}

async fn cmd_smoke_test(apply: bool) {
    println!("💨 Running smoke test...");
    let pool = match get_db_pool().await {
        Ok(p) => p,
        Err(e) => {
            eprintln!("❌ Database connection failed: {}", e);
            return;
        }
    };

    let tools: Vec<ToolRow> = match sqlx::query_as::<_, ToolRow>(
        "SELECT id, name, binary_name, command_template, is_active, health_status, health_exit_code, health_evidence, last_health_check, hardware_required, gui_required, exclusion_reason FROM tools"
    )
    .fetch_all(&pool)
    .await {
        Ok(t) => t,
        Err(e) => {
            eprintln!("❌ Query failed: {}", e);
            return;
        }
    };

    println!("  Found {} active tools", tools.len());

    let mut working = Vec::new();
    let mut broken = Vec::new();

    for tool in &tools {
        let binary = tool.binary_name.as_deref().unwrap_or(&tool.name);

        // Try to find the binary
        let found = TokioCommand::new("which")
            .arg(binary)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false);

        if found {
            working.push(tool.name.clone());
        } else {
            // Try known tool roots
            let roots = ["/opt/cybersec-tools/", "/usr/local/bin/", "/usr/bin/"];
            let mut resolved = false;
            for root in &roots {
                let path = format!("{}{}", root, binary);
                if tokio::fs::metadata(&path).await.is_ok() {
                    working.push(tool.name.clone());
                    resolved = true;
                    break;
                }
            }
            if !resolved {
                broken.push(tool.name.clone());
                println!("  ❌ {} — not found", tool.name);
            }
        }
    }

    println!("\n📊 Results: {} working, {} broken, {} total", working.len(), broken.len(), tools.len());

    if apply && !broken.is_empty() {
        for name in &broken {
            let _ = sqlx::query("UPDATE tools SET is_active = FALSE WHERE name = $1")
                .bind(name)
                .execute(&pool)
                .await;
        }
        println!("✅ Deactivated {} broken tools in database", broken.len());
    }

    let result = SmokeResult {
        working,
        broken,
        total: tools.len(),
    };

    fs::write("tool_smoke_results.json", serde_json::to_string_pretty(&result).unwrap()).ok();
    println!("📄 Results saved to tool_smoke_results.json");
}

async fn cmd_deep_smoke(workers: usize, apply: bool) {
    println!("🔬 Running deep smoke test with {} workers...", workers);
    let pool = match get_db_pool().await {
        Ok(p) => p,
        Err(e) => {
            eprintln!("❌ Database connection failed: {}", e);
            return;
        }
    };

    let tools: Vec<ToolRow> = sqlx::query_as::<_, ToolRow>(
        "SELECT id, name, binary_name, command_template, is_active, health_status, health_exit_code, health_evidence, last_health_check, hardware_required, gui_required, exclusion_reason FROM tools"
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let tools = std::sync::Arc::new(tools);
    let results = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::new()));
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(workers));

    let mut handles = Vec::new();
    for tool in tools.iter() {
        if is_dangerous(&tool.name) || is_tui_tool(&tool.name) {
            continue;
        }

        let tool = tool.clone();
        let results = results.clone();
        let sem = semaphore.clone();

        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            let result = deep_probe_tool(&tool).await;
            results.lock().await.push(result);
        }));
    }

    for h in handles {
        let _ = h.await;
    }

    let results = results.lock().await;
    let mut healthy = 0;
    let mut unhealthy = 0;

    for r in results.iter() {
        let icon = match r.status.as_str() {
            "healthy" => "✅",
            "needs_interactive" => "⏭️",
            "missing" => "❌",
            _ => "⚠️",
        };
        println!("  {} {} — {} ({}ms)", icon, r.tool_name, r.status, r.probe_duration_ms);
        if r.status == "healthy" { healthy += 1; } else { unhealthy += 1; }
    }

    if apply {
        for r in results.iter() {
            let _ = sqlx::query(
                "UPDATE tools SET health_status = $1, health_exit_code = $2, health_evidence = $3, health_probe = $4, last_health_check = NOW() WHERE id = $5"
            )
            .bind(&r.status)
            .bind(r.exit_code)
            .bind(&r.evidence)
            .bind(serde_json::to_string(&r).unwrap())
            .bind(r.tool_id)            .execute(&pool)
            .await;
        }
        println!("\n✅ Applied results to database");
    }

    println!("\n📊 {} healthy, {} unhealthy", healthy, unhealthy);
}

async fn deep_probe_tool(tool: &ToolRow) -> DeepSmokeResult {
    let start = Instant::now();
    let binary = tool.binary_name.as_deref().unwrap_or(&tool.name);

    let probes = ["--help", "-h", "--version", "-V", "version"];
    for flag in &probes {
        let result = timeout(
            Duration::from_secs(10),
            TokioCommand::new(binary)
                .arg(flag)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
        ).await;

        match result {
            Ok(Ok(output)) => {
                let exit_code = output.status.code().unwrap_or(-1);
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                let evidence = if !stdout.is_empty() {
                    stdout.chars().take(800).collect::<String>()
                } else {
                    stderr.chars().take(800).collect::<String>()
                };

                let status = if exit_code == 0 {
                    "healthy".to_string()
                } else if evidence.contains("password") || evidence.contains("interactive") {
                    "needs_interactive".to_string()
                } else if exit_code == 1 {
                    "healthy".to_string() // Many tools return 1 for --help
                } else {
                    format!("exit_{}", exit_code)
                };

                return DeepSmokeResult {
                    tool_id: tool.id,
                    tool_name: tool.name.clone(),
                    status,
                    exit_code: Some(exit_code),
                    evidence,
                    probe_duration_ms: start.elapsed().as_millis() as u64,
                };
            }
            Ok(Err(_)) => continue,
            Err(_) => {
                return DeepSmokeResult {
                    tool_id: tool.id,
                    tool_name: tool.name.clone(),
                    status: "timeout".to_string(),
                    exit_code: None,
                    evidence: "Probe timed out after 10s".to_string(),
                    probe_duration_ms: start.elapsed().as_millis() as u64,
                };
            }
        }
    }

    DeepSmokeResult {
        tool_id: tool.id,
        tool_name: tool.name.clone(),
        status: "missing".to_string(),
        exit_code: None,
        evidence: "All probes failed".to_string(),
        probe_duration_ms: start.elapsed().as_millis() as u64,
    }
}

async fn cmd_audit_gate(apply: bool) {
    println!("📋 Running audit and gate...");
    let pool = match get_db_pool().await {
        Ok(p) => p,
        Err(e) => {
            eprintln!("❌ Database connection failed: {}", e);
            return;
        }
    };

    let tools: Vec<ToolRow> = sqlx::query_as::<_, ToolRow>(
        "SELECT id, name, binary_name, command_template, is_active, health_status, health_exit_code, health_evidence, last_health_check, hardware_required, gui_required, exclusion_reason FROM tools"
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let mut decisions = Vec::new();

    for tool in &tools {
        let (should_be_active, reason) = decide_tool_active(tool);
        decisions.push(AuditDecision {
            tool_name: tool.name.clone(),
            should_be_active,
            reason,
        });
    }

    let active_count = decisions.iter().filter(|d| d.should_be_active).count();
    let inactive_count = decisions.iter().filter(|d| !d.should_be_active).count();

    println!("\n📊 Audit Results:");
    println!("  ✅ Should be active: {}", active_count);
    println!("  ❌ Should be inactive: {}", inactive_count);

    for d in &decisions {
        let icon = if d.should_be_active { "✅" } else { "❌" };
        println!("  {} {} — {}", icon, d.tool_name, d.reason);
    }

    if apply {
        for d in &decisions {
            let _ = sqlx::query("UPDATE tools SET is_active = $1 WHERE name = $2")
                .bind(d.should_be_active)
                .bind(&d.tool_name)
                .execute(&pool)
                .await;
        }
        println!("\n✅ Applied audit decisions to database");
    }
}

fn decide_tool_active(tool: &ToolRow) -> (bool, String) {
    // Preserve existing exclusion reasons
    if let Some(ref reason) = tool.exclusion_reason {
        if !reason.is_empty() && reason != "null" {
            return (false, format!("excluded: {}", reason));
        }
    }

    // Check hardware requirement
    if tool.hardware_required.unwrap_or(false) {
        return (false, "hardware_required".to_string());
    }

    // Check GUI requirement
    if tool.gui_required.unwrap_or(false) {
        return (false, "gui_required".to_string());
    }

    // Check binary existence
    let binary = tool.binary_name.as_deref().unwrap_or(&tool.name);
    let found = std::process::Command::new("which")
        .arg(binary)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !found {
        return (false, "binary_not_found".to_string());
    }

    // Check command template
    if let Some(ref tmpl) = tool.command_template {
        let parts = parse_command_template(tmpl);
        if !parts.is_empty() {
            let cmd = &parts[0];
            let cmd_found = std::process::Command::new("which")
                .arg(cmd)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);

            if !cmd_found {
                return (false, format!("command_template_binary_not_found: {}", cmd));
            }
        }
    }

    (true, "all_checks_passed".to_string())
}

async fn cmd_parser_validation(api_base: &str) {
    println!("🔍 Running parser validation...");

    let client = reqwest::Client::new();
    let tools = vec![
        "nmap", "nuclei", "whatweb", "httpx", "subfinder",
        "dig", "nikto", "sslscan", "gitleaks", "tfsec", "trivy",
    ];

    let mut results = Vec::new();
    let target = "scanme.nmap.org";

    for tool_name in &tools {
        println!("  🚀 Launching scan with {}...", tool_name);

        // Create scan via API
        let body = serde_json::json!({
            "tool_name": tool_name,
            "target": target,
            "options": {}
        });

        let resp = client.post(format!("{}/api/v1/scans", api_base))
            .json(&body)
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => {
                let scan: serde_json::Value = r.json().await.unwrap_or_default();
                let scan_id = scan.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");

                // Poll for completion
                for _ in 0..30 {
                    tokio::time::sleep(Duration::from_secs(10)).await;
                    let status_resp = client.get(format!("{}/api/v1/scans/{}", api_base, scan_id))
                        .send()
                        .await;

                    if let Ok(s) = status_resp {
                        let status: serde_json::Value = s.json().await.unwrap_or_default();
                        let state = status.get("status").and_then(|v| v.as_str()).unwrap_or("unknown");

                        if state == "completed" {
                            let findings = status.get("findings");
                            let has_parser_specific = findings
                                .and_then(|f| f.as_object())
                                .map(|obj| obj.keys().any(|k| k != "summary" && k != "raw_lines"))
                                .unwrap_or(false);

                            results.push(serde_json::json!({
                                "tool": tool_name,
                                "parser_valid": has_parser_specific,
                                "findings_keys": findings.and_then(|f| f.as_object()).map(|o| o.keys().cloned().collect::<Vec<_>>()),
                            }));
                            println!("    ✅ {} — parser valid: {}", tool_name, has_parser_specific);
                            break;
                        } else if state == "failed" {
                            results.push(serde_json::json!({
                                "tool": tool_name,
                                "parser_valid": false,
                                "error": "scan_failed",
                            }));
                            println!("    ❌ {} — scan failed", tool_name);
                            break;
                        }
                    }
                }
            }
            _ => {
                results.push(serde_json::json!({
                    "tool": tool_name,
                    "parser_valid": false,
                    "error": "api_error",
                }));
                println!("    ⚠️  {} — API error", tool_name);
            }
        }
    }

    fs::write("/tmp/parser_validation.json", serde_json::to_string_pretty(&results).unwrap()).ok();
    println!("\n📄 Results saved to /tmp/parser_validation.json");
}

async fn cmd_verify_linked_scans(api_base: &str) {
    println!("🔗 Verifying linked scan IDs...");
    let client = reqwest::Client::new();

    // Create purple-team exercise
    let body = serde_json::json!({
        "exercise_type": "purple_team",
        "target": "scanme.nmap.org",
    });

    let resp = client.post(format!("{}/api/v1/exercises", api_base))
        .json(&body)
        .send()
        .await;

    match resp {
        Ok(r) if r.status().is_success() => {
            let exercise: serde_json::Value = r.json().await.unwrap_or_default();
            let exercise_id = exercise.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");
            println!("  Created exercise: {}", exercise_id);

            // Poll for completion
            for i in 0..2 {
                tokio::time::sleep(Duration::from_secs(if i == 0 { 0 } else { 95 })).await;

                let status_resp = client.get(format!("{}/api/v1/exercises/{}", api_base, exercise_id))
                    .send()
                    .await;

                if let Ok(s) = status_resp {
                    let status: serde_json::Value = s.json().await.unwrap_or_default();
                    let linked = status.get("linked_scan_ids")
                        .and_then(|v| v.as_array())
                        .map(|a| a.len())
                        .unwrap_or(0);

                    println!("  Poll {}: linked_scan_ids count = {}", i + 1, linked);

                    let result = serde_json::json!({
                        "exercise_id": exercise_id,
                        "poll": i + 1,
                        "linked_scan_count": linked,
                        "valid": linked > 0,
                    });

                    fs::write("/tmp/linked_scan_ids_verify.json", serde_json::to_string_pretty(&result).unwrap()).ok();

                    if linked > 0 {
                        println!("  ✅ Linked scan IDs verified: {} scans linked", linked);
                        return;
                    }
                }
            }
            println!("  ⚠️  No linked scan IDs found after polling");
        }
        _ => {
            eprintln!("  ❌ Failed to create exercise");
        }
    }
}

async fn cmd_analyze_broken(input: &str) {
    println!("📊 Analyzing broken tools from {}...", input);

    let data = match fs::read_to_string(input) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("❌ Cannot read {}: {}", input, e);
            return;
        }
    };

    let results: SmokeResult = match serde_json::from_str(&data) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("❌ Cannot parse JSON: {}", e);
            return;
        }
    };

    println!("\n📊 Broken Tool Analysis:");
    println!("  Total tools: {}", results.total);
    println!("  Working: {}", results.working.len());
    println!("  Broken: {}", results.broken.len());

    if results.broken.is_empty() {
        println!("\n✅ No broken tools found!");
        return;
    }

    // Categorize broken tools
    let mut categories: HashMap<String, Vec<String>> = HashMap::new();

    for tool in &results.broken {
        let binary = tool;
        let found = std::process::Command::new("which")
            .arg(binary)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        if !found {
            // Check known roots
            let roots = ["/opt/cybersec-tools/", "/usr/local/bin/", "/usr/bin/", "/usr/share/"];
            let mut found_in_root = false;
            for root in &roots {
                let path = format!("{}{}", root, binary);
                if std::path::Path::new(&path).exists() {
                    categories.entry("absolute_path_missing".to_string())
                        .or_default()
                        .push(format!("{} → {}", binary, path));
                    found_in_root = true;
                    break;
                }
            }
            if !found_in_root {
                categories.entry("missing_binary".to_string())
                    .or_default()
                    .push(binary.clone());
            }
        } else {
            categories.entry("script_not_found".to_string())
                .or_default()
                .push(binary.clone());
        }
    }

    for (category, tools) in &categories {
        println!("\n  📁 {} ({}):", category, tools.len());
        for tool in tools {
            println!("    • {}", tool);
        }
    }
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::HealthProbe { workers, apply } => cmd_health_probe(workers, apply).await,
        Commands::SmokeTest { apply } => cmd_smoke_test(apply).await,
        Commands::DeepSmoke { workers, apply } => cmd_deep_smoke(workers, apply).await,
        Commands::AuditGate { apply } => cmd_audit_gate(apply).await,
        Commands::ParserValidation { api_base } => cmd_parser_validation(&api_base).await,
        Commands::VerifyLinkedScans { api_base } => cmd_verify_linked_scans(&api_base).await,
        Commands::AnalyzeBroken { input } => cmd_analyze_broken(&input).await,
    }
}
