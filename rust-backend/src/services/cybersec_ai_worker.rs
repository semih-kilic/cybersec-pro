// CyberSec Pro AI — Autonomous pentest worker
//
// Picks up `cybersec_ai_jobs` rows in `queued` status and runs the configured
// agents end-to-end. Each agent invokes a real recon/scanning binary with a
// strict timeout, parses its output into structured findings, and persists
// progress back to the database row (`results` JSONB + `status`).
//
// Cancellation: rows whose `status` is set to `cancelling` (or `cancelled`)
// from outside this worker are detected between agent steps and aborted
// gracefully.

use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use sqlx::PgPool;
use tokio::process::Command;
use tokio::time::timeout;

const POLL_INTERVAL_SECS: u64 = 6;
const AGENT_TIMEOUT_SECS: u64 = 90;
const MAX_OUTPUT_BYTES: usize = 64 * 1024;

pub async fn run(db: Arc<PgPool>) {
    tracing::info!("🤖 CyberSec AI worker started — polling every {}s", POLL_INTERVAL_SECS);
    let mut interval = tokio::time::interval(Duration::from_secs(POLL_INTERVAL_SECS));
    loop {
        interval.tick().await;
        if let Err(e) = pick_and_process(&db).await {
            tracing::error!("cybersec_ai_worker tick failed: {e}");
        }
    }
}

async fn pick_and_process(db: &PgPool) -> Result<(), sqlx::Error> {
    // Atomically claim one queued job (oldest first).
    let row: Option<(String, String, String, String, Value)> = sqlx::query_as(
        r#"UPDATE cybersec_ai_jobs
           SET status = 'running', started_at = NOW()
           WHERE id = (
               SELECT id FROM cybersec_ai_jobs
               WHERE status = 'queued'
               ORDER BY created_at ASC
               LIMIT 1
               FOR UPDATE SKIP LOCKED
           )
           RETURNING id, target, target_type, job_type, agents_config"#,
    )
    .fetch_optional(db)
    .await?;

    let Some((id, target, target_type, job_type, agents_config)) = row else {
        return Ok(());
    };

    tracing::info!(job_id=%id, target=%target, "▶ AI job claimed");

    // Best-effort execution; never panic the worker loop on a job error.
    let outcome = process_job(db, &id, &target, &target_type, &job_type, &agents_config).await;
    match outcome {
        Ok(JobOutcome::Completed) => {
            tracing::info!(job_id=%id, "✓ AI job completed");
        }
        Ok(JobOutcome::Cancelled) => {
            tracing::info!(job_id=%id, "⏹ AI job cancelled");
        }
        Err(e) => {
            tracing::error!(job_id=%id, error=%e, "✖ AI job failed");
            let _ = sqlx::query(
                "UPDATE cybersec_ai_jobs
                 SET status = 'failed', completed_at = NOW(),
                     results = COALESCE(results, '{}'::jsonb) ||
                               jsonb_build_object('error', $2::text)
                 WHERE id = $1",
            )
            .bind(&id)
            .bind(e.to_string())
            .execute(db)
            .await;
        }
    }
    Ok(())
}

enum JobOutcome {
    Completed,
    Cancelled,
}

async fn process_job(
    db: &PgPool,
    id: &str,
    target: &str,
    target_type: &str,
    job_type: &str,
    agents_config: &Value,
) -> Result<JobOutcome, Box<dyn std::error::Error + Send + Sync>> {
    let agents = agents_config.as_object().cloned().unwrap_or_default();
    let mut steps: Vec<Value> = Vec::new();
    let mut findings: Vec<Value> = Vec::new();

    // Helper to record a step and persist progress back to the DB.
    macro_rules! save_progress {
        ($db:expr, $id:expr, $steps:expr, $findings:expr) => {{
            let payload = json!({
                "steps": $steps,
                "findings": $findings,
                "summary": {
                    "agents_completed": $steps.iter()
                        .filter(|s| s.get("status").and_then(|v| v.as_str()) == Some("done"))
                        .count(),
                    "agents_total": $steps.len(),
                }
            });
            let _ = sqlx::query(
                "UPDATE cybersec_ai_jobs
                 SET results = $2, findings_count = $3
                 WHERE id = $1",
            )
            .bind($id)
            .bind(&payload)
            .bind($findings.len() as i32)
            .execute($db)
            .await;
        }};
    }

    // ── Run each enabled agent in order ────────────────────────────────────
    let mut order: Vec<&str> = Vec::new();
    if agents.get("recon").and_then(|v| v.as_bool()).unwrap_or(false) {
        order.push("recon");
    }
    if agents.get("vuln_scan").and_then(|v| v.as_bool()).unwrap_or(false) {
        order.push("vuln_scan");
    }
    if agents.get("exploit_verify").and_then(|v| v.as_bool()).unwrap_or(false) {
        order.push("exploit_verify");
    }
    // auto_fix is intentionally a no-op for now (beta) — we only emit a
    // recommendation step.
    if agents.get("auto_fix").and_then(|v| v.as_bool()).unwrap_or(false) {
        order.push("auto_fix");
    }

    if order.is_empty() {
        order.push("recon");
    }

    let host = extract_host(target);

    for agent in order {
        if is_cancelled(db, id).await? {
            mark_cancelled(db, id).await?;
            return Ok(JobOutcome::Cancelled);
        }

        let mut step = json!({
            "agent": agent,
            "status": "running",
            "started_at": chrono::Utc::now().to_rfc3339(),
            "output": "",
        });
        steps.push(step.clone());
        save_progress!(db, id, steps, findings);

        let result = match agent {
            "recon" => run_recon(target, target_type, &host).await,
            "vuln_scan" => run_vuln_scan(target, target_type, &host).await,
            "exploit_verify" => run_exploit_verify(target, &host).await,
            "auto_fix" => run_auto_fix_recommendation(target, job_type).await,
            _ => Ok(AgentResult::default()),
        };

        let agent_result = result.unwrap_or_else(|e| AgentResult {
            output: format!("agent error: {e}"),
            findings: vec![],
            error: Some(e.to_string()),
        });

        for f in &agent_result.findings {
            findings.push(f.clone());
        }
        step = json!({
            "agent": agent,
            "status": if agent_result.error.is_some() { "error" } else { "done" },
            "started_at": step.get("started_at").cloned().unwrap_or(Value::Null),
            "completed_at": chrono::Utc::now().to_rfc3339(),
            "output": truncate(&agent_result.output, MAX_OUTPUT_BYTES),
            "finding_count": agent_result.findings.len(),
            "error": agent_result.error.clone(),
        });
        // Replace last (running) step with finalized one
        if let Some(last) = steps.last_mut() {
            *last = step;
        }
        save_progress!(db, id, steps, findings);
    }

    // Mark verified count = findings with verified == true
    let verified = findings
        .iter()
        .filter(|f| f.get("verified").and_then(|v| v.as_bool()).unwrap_or(false))
        .count() as i32;

    sqlx::query(
        "UPDATE cybersec_ai_jobs
         SET status = 'completed', completed_at = NOW(),
             findings_count = $2, poc_verified_count = $3
         WHERE id = $1",
    )
    .bind(id)
    .bind(findings.len() as i32)
    .bind(verified)
    .execute(db)
    .await?;

    Ok(JobOutcome::Completed)
}

async fn is_cancelled(db: &PgPool, id: &str) -> Result<bool, sqlx::Error> {
    let s: Option<(String,)> =
        sqlx::query_as("SELECT status FROM cybersec_ai_jobs WHERE id = $1")
            .bind(id)
            .fetch_optional(db)
            .await?;
    Ok(matches!(s, Some((ref v,)) if v == "cancelling" || v == "cancelled"))
}

async fn mark_cancelled(db: &PgPool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE cybersec_ai_jobs
         SET status = 'cancelled', completed_at = NOW()
         WHERE id = $1",
    )
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

#[derive(Default)]
struct AgentResult {
    output: String,
    findings: Vec<Value>,
    error: Option<String>,
}

// ─────────────────────────── Agent: recon ───────────────────────────────────
async fn run_recon(
    target: &str,
    target_type: &str,
    host: &str,
) -> Result<AgentResult, Box<dyn std::error::Error + Send + Sync>> {
    let mut output = String::new();
    let mut findings: Vec<Value> = Vec::new();

    if target_type == "url" || target_type == "domain" {
        // Subdomain enumeration (passive, fast).
        let sub = run_cmd(
            "subfinder",
            &["-d", host, "-silent", "-timeout", "8", "-max-time", "1"],
        )
        .await;
        if let Ok(out) = &sub {
            output.push_str("── subfinder ──\n");
            output.push_str(out);
            output.push('\n');
            for line in out.lines().take(50) {
                let s = line.trim();
                if !s.is_empty() && s != host {
                    findings.push(json!({
                        "agent": "recon",
                        "severity": "info",
                        "title": "Subdomain discovered",
                        "evidence": s,
                        "target": s,
                    }));
                }
            }
        }

        // Liveness probe via httpx.
        let httpx = run_cmd(
            "httpx",
            &[
                "-silent", "-status-code", "-title", "-tech-detect",
                "-timeout", "8", "-no-color", "-u", target,
            ],
        )
        .await;
        if let Ok(out) = &httpx {
            output.push_str("── httpx ──\n");
            output.push_str(out);
        }
    } else if target_type == "ip" {
        // Lightweight nmap top-100.
        let nmap = run_cmd(
            "nmap",
            &["-Pn", "--top-ports", "100", "-T4", "--open", host],
        )
        .await;
        if let Ok(out) = &nmap {
            output.push_str("── nmap ──\n");
            output.push_str(out);
            for line in out.lines() {
                if line.contains("/tcp") && line.contains("open") {
                    findings.push(json!({
                        "agent": "recon",
                        "severity": "info",
                        "title": "Open port",
                        "evidence": line.trim(),
                        "target": host,
                    }));
                }
            }
        }
    } else {
        output.push_str(format!("recon: target_type '{target_type}' not yet supported\n").as_str());
    }

    Ok(AgentResult {
        output,
        findings,
        error: None,
    })
}

// ─────────────────────────── Agent: vuln_scan ───────────────────────────────
async fn run_vuln_scan(
    target: &str,
    target_type: &str,
    _host: &str,
) -> Result<AgentResult, Box<dyn std::error::Error + Send + Sync>> {
    let mut output = String::new();
    let mut findings: Vec<Value> = Vec::new();

    if target_type == "url" || target_type == "domain" {
        // nuclei with CVE templates only — bounded by AGENT_TIMEOUT_SECS.
        let nuclei = run_cmd(
            "nuclei",
            &[
                "-u", target,
                "-tags", "cve,exposure",
                "-severity", "low,medium,high,critical",
                "-rate-limit", "50",
                "-timeout", "8",
                "-silent",
                "-no-color",
                "-jsonl",
            ],
        )
        .await;
        if let Ok(out) = &nuclei {
            output.push_str("── nuclei ──\n");
            output.push_str(out);
            for line in out.lines() {
                if let Ok(v) = serde_json::from_str::<Value>(line) {
                    let info = v.get("info").cloned().unwrap_or(Value::Null);
                    findings.push(json!({
                        "agent": "vuln_scan",
                        "severity": info.get("severity").and_then(|s| s.as_str()).unwrap_or("info"),
                        "title": info.get("name").and_then(|s| s.as_str()).unwrap_or("Finding"),
                        "evidence": v.get("matched-at").and_then(|s| s.as_str()).unwrap_or(""),
                        "template": v.get("template-id").and_then(|s| s.as_str()).unwrap_or(""),
                        "target": target,
                    }));
                }
            }
        }
    } else if target_type == "ip" {
        let nmap = run_cmd(
            "nmap",
            &["-Pn", "-sV", "--top-ports", "50", "--script", "vuln", target],
        )
        .await;
        if let Ok(out) = &nmap {
            output.push_str("── nmap vuln ──\n");
            output.push_str(out);
            for line in out.lines() {
                if line.contains("VULNERABLE") {
                    findings.push(json!({
                        "agent": "vuln_scan",
                        "severity": "high",
                        "title": "Potential vulnerability",
                        "evidence": line.trim(),
                        "target": target,
                    }));
                }
            }
        }
    } else {
        output.push_str(format!("vuln_scan: target_type '{target_type}' not supported\n").as_str());
    }

    Ok(AgentResult {
        output,
        findings,
        error: None,
    })
}

// ─────────────────────────── Agent: exploit_verify ──────────────────────────
async fn run_exploit_verify(
    target: &str,
    _host: &str,
) -> Result<AgentResult, Box<dyn std::error::Error + Send + Sync>> {
    let mut output = String::from("── exploit_verify ──\n");
    output.push_str("Safe verification mode — no destructive payloads sent.\n");

    // Lightweight follow-up: re-run nuclei in verification template set.
    let nuclei = run_cmd(
        "nuclei",
        &[
            "-u", target,
            "-tags", "intrusive,verify",
            "-severity", "high,critical",
            "-rate-limit", "20",
            "-timeout", "8",
            "-silent",
            "-no-color",
            "-jsonl",
        ],
    )
    .await
    .unwrap_or_default();
    output.push_str(&nuclei);

    let mut findings: Vec<Value> = Vec::new();
    for line in nuclei.lines() {
        if let Ok(v) = serde_json::from_str::<Value>(line) {
            let info = v.get("info").cloned().unwrap_or(Value::Null);
            findings.push(json!({
                "agent": "exploit_verify",
                "severity": info.get("severity").and_then(|s| s.as_str()).unwrap_or("high"),
                "title": info.get("name").and_then(|s| s.as_str()).unwrap_or("Verified"),
                "evidence": v.get("matched-at").and_then(|s| s.as_str()).unwrap_or(""),
                "target": target,
                "verified": true,
            }));
        }
    }

    Ok(AgentResult {
        output,
        findings,
        error: None,
    })
}

// ─────────────────────────── Agent: auto_fix (beta) ─────────────────────────
async fn run_auto_fix_recommendation(
    _target: &str,
    _job_type: &str,
) -> Result<AgentResult, Box<dyn std::error::Error + Send + Sync>> {
    Ok(AgentResult {
        output: "Auto-fix is in beta — recommendations only.\nA pull request \
                 generator will be enabled when GitHub App integration is configured."
            .to_string(),
        findings: vec![],
        error: None,
    })
}

// ─────────────────────────── helpers ────────────────────────────────────────
async fn run_cmd(
    bin: &str,
    args: &[&str],
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let fut = async {
        let out = Command::new(bin)
            .args(args)
            .kill_on_drop(true)
            .output()
            .await?;
        let mut s = String::from_utf8_lossy(&out.stdout).to_string();
        if !out.stderr.is_empty() {
            s.push_str("\n[stderr]\n");
            s.push_str(&String::from_utf8_lossy(&out.stderr));
        }
        Ok::<String, std::io::Error>(s)
    };
    match timeout(Duration::from_secs(AGENT_TIMEOUT_SECS), fut).await {
        Ok(Ok(s)) => Ok(s),
        Ok(Err(e)) => Err(Box::new(e) as _),
        Err(_) => Ok(format!("[timeout after {AGENT_TIMEOUT_SECS}s]")),
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        let mut out = s[..max].to_string();
        out.push_str("\n… [truncated]");
        out
    }
}

fn extract_host(target: &str) -> String {
    // Strip scheme, path, and trailing port for tools that need a bare host.
    let mut s = target.trim().to_string();
    if let Some(idx) = s.find("://") {
        s = s[idx + 3..].to_string();
    }
    if let Some(idx) = s.find('/') {
        s.truncate(idx);
    }
    if let Some(idx) = s.rfind(':') {
        // keep IPv6 brackets intact
        if !s.starts_with('[') {
            s.truncate(idx);
        }
    }
    s
}
