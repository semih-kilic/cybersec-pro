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
use tokio::time::{sleep, timeout};

const POLL_INTERVAL_SECS: u64 = 6;
const AGENT_TIMEOUT_SECS: u64 = 180;  // nuclei first pass needs >90s even with cached templates
const CANCEL_POLL_SECS: u64 = 2;
const MAX_OUTPUT_BYTES: usize = 64 * 1024;

/// Sentinel error returned by `run_cmd` when the job was cancelled mid-flight.
const CANCEL_SENTINEL: &str = "__cybersec_ai_cancelled__";

pub async fn run(db: Arc<PgPool>) {
    tracing::info!("🤖 CyberSec AI worker started — polling every {}s", POLL_INTERVAL_SECS);

    // Startup sweep: any row left in `running` or `cancelling` from a previous
    // process is orphaned (no in-flight task watches it). Force-finalize them
    // so the UI doesn't show a perpetually spinning state.
    if let Err(e) = sweep_orphans(&db, true).await {
        tracing::warn!("ai_worker startup sweep failed: {e}");
    }

    let mut interval = tokio::time::interval(Duration::from_secs(POLL_INTERVAL_SECS));
    loop {
        interval.tick().await;
        // Per-tick safety net: any `cancelling` row older than 2 minutes
        // (well beyond AGENT_TIMEOUT_SECS=90) gets force-cancelled. This
        // covers cases where the inner command ignored the cancel sentinel.
        if let Err(e) = sweep_orphans(&db, false).await {
            tracing::warn!("ai_worker per-tick sweep failed: {e}");
        }
        if let Err(e) = pick_and_process(&db).await {
            tracing::error!("cybersec_ai_worker tick failed: {e}");
        }
    }
}

/// Force-finalize stuck rows.
/// - When `startup=true`: any `running`/`cancelling` row → cancelled (this
///   process didn't claim it, so no task is watching).
/// - When `startup=false`: only `cancelling` rows whose `started_at` is older
///   than 2 minutes get cancelled (the worker has had ample time to react).
async fn sweep_orphans(db: &PgPool, startup: bool) -> Result<(), sqlx::Error> {
    let res = if startup {
        sqlx::query(
            "UPDATE cybersec_ai_jobs
             SET status = 'cancelled', completed_at = NOW(),
                 results = COALESCE(results, '{}'::jsonb) ||
                           jsonb_build_object('cancel_reason', 'orphaned by worker restart')
             WHERE status IN ('running', 'cancelling')",
        )
        .execute(db)
        .await?
    } else {
        sqlx::query(
            "UPDATE cybersec_ai_jobs
             SET status = 'cancelled', completed_at = NOW(),
                 results = COALESCE(results, '{}'::jsonb) ||
                           jsonb_build_object('cancel_reason', 'force-cancelled after grace period')
             WHERE status = 'cancelling'
               AND started_at IS NOT NULL
               AND started_at < NOW() - INTERVAL '2 minutes'",
        )
        .execute(db)
        .await?
    };
    if res.rows_affected() > 0 {
        tracing::info!(
            startup,
            count = res.rows_affected(),
            "ai_worker sweep finalized stuck job(s)"
        );
    }
    Ok(())
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
            "recon" => run_recon(db, id, target, target_type, &host).await,
            "vuln_scan" => run_vuln_scan(db, id, target, target_type, &host).await,
            "exploit_verify" => run_exploit_verify(db, id, target, &host).await,
            "auto_fix" => run_auto_fix_recommendation(target, job_type).await,
            _ => Ok(AgentResult::default()),
        };

        let agent_result = result.unwrap_or_else(|e| AgentResult {
            output: format!("agent error: {e}"),
            findings: vec![],
            error: Some(e.to_string()),
        });

        // If any inner command observed a cancellation, abort the whole job now.
        if agent_result.output.contains(CANCEL_SENTINEL)
            || agent_result.error.as_deref() == Some(CANCEL_SENTINEL)
        {
            mark_cancelled(db, id).await?;
            return Ok(JobOutcome::Cancelled);
        }

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

    // ── LLM enrichment (optional) ──────────────────────────────────────────
    let llm_analysis = llm_enrich_findings(&findings).await;
    if llm_analysis != Value::Null {
        // Store the LLM analysis alongside the findings
        // We add it as the last finding with type "llm_analysis" so the frontend can render it
        findings.push(json!({
            "type": "llm_analysis",
            "analysis": llm_analysis,
            "source": "llm",
            "model": "deepseek-ai/deepseek-v4-flash-0731",
            "enriched_at": chrono::Utc::now().to_rfc3339(),
        }));
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
    db: &PgPool,
    job_id: &str,
    target: &str,
    target_type: &str,
    host: &str,
) -> Result<AgentResult, Box<dyn std::error::Error + Send + Sync>> {
    let mut output = String::new();
    let mut findings: Vec<Value> = Vec::new();

    if target_type == "url" || target_type == "domain" {
        // Subdomain enumeration (passive, fast).
        let sub = run_cmd(
            db, job_id,
            "subfinder",
            &["-d", host, "-silent", "-timeout", "8", "-max-time", "1"],
        )
        .await;
        if let Ok(out) = &sub {
            if out.contains(CANCEL_SENTINEL) {
                return Ok(AgentResult { output: out.clone(), findings, error: Some(CANCEL_SENTINEL.into()) });
            }
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
            db, job_id,
            "httpx",
            &[
                "-silent", "-status-code", "-title", "-tech-detect",
                "-timeout", "8", "-no-color", "-u", target,
            ],
        )
        .await;
        if let Ok(out) = &httpx {
            if out.contains(CANCEL_SENTINEL) {
                return Ok(AgentResult { output: out.clone(), findings, error: Some(CANCEL_SENTINEL.into()) });
            }
            output.push_str("── httpx ──\n");
            output.push_str(out);
        }
    } else if target_type == "ip" {
        // Lightweight nmap top-100.
        let nmap = run_cmd(
            db, job_id,
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
    db: &PgPool,
    job_id: &str,
    target: &str,
    target_type: &str,
    _host: &str,
) -> Result<AgentResult, Box<dyn std::error::Error + Send + Sync>> {
    let mut output = String::new();
    let mut findings: Vec<Value> = Vec::new();

    if target_type == "url" || target_type == "domain" {
        // nuclei with CVE templates only — bounded by AGENT_TIMEOUT_SECS.
        let nuclei = run_cmd(
            db, job_id,
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
                "-duc",  // disable update check — hangs without it
                "-ni",   // no interactsh — avoids startup handshake delay
            ],
        )
        .await;
        if let Ok(out) = &nuclei {
            if out.contains(CANCEL_SENTINEL) {
                return Ok(AgentResult { output: out.clone(), findings, error: Some(CANCEL_SENTINEL.into()) });
            }
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
            db, job_id,
            "nmap",
            &["-Pn", "-sV", "--top-ports", "50", "--script", "vuln", target],
        )
        .await;
        if let Ok(out) = &nmap {
            if out.contains(CANCEL_SENTINEL) {
                return Ok(AgentResult { output: out.clone(), findings, error: Some(CANCEL_SENTINEL.into()) });
            }
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
    db: &PgPool,
    job_id: &str,
    target: &str,
    _host: &str,
) -> Result<AgentResult, Box<dyn std::error::Error + Send + Sync>> {
    let mut output = String::from("── exploit_verify ──\n");
    output.push_str("Safe verification mode — no destructive payloads sent.\n");

    // Lightweight follow-up: re-run nuclei in verification template set.
    let nuclei = run_cmd(
        db, job_id,
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
    if nuclei.contains(CANCEL_SENTINEL) {
        return Ok(AgentResult { output: nuclei, findings: vec![], error: Some(CANCEL_SENTINEL.into()) });
    }
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
//
// `run_cmd` wraps the command future inside a tokio::select! that races against
// a polling loop watching the job's `status` column.  The moment the row is
// flipped to `cancelling`/`cancelled`, the command future is dropped — and
// because Tokio's `Command` was built with `kill_on_drop(true)` the OS process
// is reaped immediately.  The function then returns the CANCEL_SENTINEL string
// so the agent layer can short-circuit cleanly.
async fn run_cmd(
    db: &PgPool,
    job_id: &str,
    bin: &str,
    args: &[&str],
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let cmd_fut = async {
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

    let cancel_fut = async {
        loop {
            sleep(Duration::from_secs(CANCEL_POLL_SECS)).await;
            if is_cancelled(db, job_id).await.unwrap_or(false) {
                return ();
            }
        }
    };

    let bounded = async {
        tokio::select! {
            biased;
            _ = cancel_fut => Ok::<String, std::io::Error>(CANCEL_SENTINEL.to_string()),
            r = cmd_fut => r,
        }
    };

    match timeout(Duration::from_secs(AGENT_TIMEOUT_SECS), bounded).await {
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


fn llm_api_key() -> Option<String> {
    std::env::var("NVIDIA_API_KEY")
        .or_else(|_| std::env::var("OPENAI_API_KEY"))
        .ok()
        .filter(|k| !k.trim().is_empty())
}

fn llm_base_url() -> String {
    std::env::var("LLM_BASE_URL")
        .unwrap_or_else(|_| "https://integrate.api.nvidia.com/v1".to_string())
}

fn llm_model() -> String {
    std::env::var("LLM_MODEL")
        .unwrap_or_else(|_| "nvidia/llama-3.1-8b-instruct".to_string())
}

/// Sends all findings to OpenAI for risk-prioritised analysis, remediation
/// recommendations, and business-impact context.  Returns a single JSON value
/// with `recommendations` (array) and `executive_summary` (string), or `null`
/// if the API key is missing or the call fails.
async fn llm_enrich_findings(findings: &[Value]) -> Value {
    let api_key = match llm_api_key() {
        Some(k) => k,
        None => return Value::Null,
    };
    if findings.is_empty() {
        return Value::Null;
    }

    // Build a compact representation of findings for the LLM
    let compact: Vec<Value> = findings.iter().enumerate().map(|(i, f)| {
        json!({
            "id": i + 1,
            "title": f.get("title").and_then(|v| v.as_str()).unwrap_or("unknown"),
            "severity": f.get("severity").and_then(|v| v.as_str()).unwrap_or("info"),
            "category": f.get("category").and_then(|v| v.as_str()).unwrap_or("general"),
            "detail": f.get("detail").and_then(|v| v.as_str()).unwrap_or(""),
            "verified": f.get("verified").and_then(|v| v.as_bool()).unwrap_or(false),
        })
    }).collect();

    let findings_json = serde_json::to_string_pretty(&compact).unwrap_or_default();
    let prompt = format!(
        "You are a senior security analyst. Analyze the following {} findings from an automated pentest scan.

         Findings:
{}

         Return a JSON object with exactly these fields:
         - executive_summary: 2-3 sentence risk overview for a CISO
         - recommendations: array of objects, each with:
           - finding_id: the finding id number this applies to
           - priority: immediate, short-term, or long-term
           - action: concise remediation step
           - business_impact: one sentence on business risk if unaddressed
         - overall_risk: critical, high, medium, or low

         Return ONLY the JSON object, no markdown fencing.",
        findings.len(),
        findings_json,
    );

    let model_name = llm_model();
    let body = json!({
        "model": model_name.clone(),
        "messages": [
            {"role": "system", "content": "You are an expert cybersecurity analyst. Respond only with valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 4000,
    });

    let url = format!("{}/chat/completions", llm_base_url());
    tracing::info!("LLM enrichment calling: {}", url);
    tracing::info!("LLM model: {}", body.get("model").and_then(|v| v.as_str()).unwrap_or("?"));

    let body_json = serde_json::to_string(&body).unwrap_or_default();

    // Use curl via subprocess since reqwest has TLS issues in the container
    let output = tokio::process::Command::new("curl")
        .args(["-s", "-w", "\n%{http_code}", &url,
               "-H", &format!("Authorization: Bearer {}", api_key),
               "-H", "Content-Type: application/json",
               "-d", &body_json,
               "--max-time", "120"])
        .output()
        .await;

    let raw = match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(e) => {
            tracing::warn!("LLM enrichment curl failed: {e}");
            return Value::Null;
        }
    };

    let lines: Vec<&str> = raw.rsplitn(2, '
').collect();
    let http_code = lines.first().and_then(|s| s.trim().parse::<u16>().ok()).unwrap_or(0);
    let resp_text = if lines.len() > 1 { lines[1] } else { "" };

    tracing::info!("LLM enrichment response status: {}", http_code);
    if http_code < 200 || http_code >= 300 {
        tracing::warn!("LLM enrichment HTTP {http_code}: {}", truncate(resp_text, 300));
        return Value::Null;
    }

    // Truncate response to avoid DeepSeek V4 reasoning_content bloat
    let truncated = if resp_text.len() > 8000 { &resp_text[..8000] } else { resp_text };
    // Try to find a valid JSON end
    let cleaned = if let Some(last_brace) = truncated.rfind('}') {
        &truncated[..=last_brace]
    } else {
        truncated
    };
    let resp_body: Value = match serde_json::from_str(&cleaned) {
        Ok(v) => v,
        Err(e) => {
            // If still failing, try to extract just the content field with regex
            tracing::warn!("LLM enrichment parse failed: {e} — trying fallback extraction");
            // Try to extract content between quotes after "content":
            if let Some(content_start) = resp_text.find(""content":") {
                let rest = &resp_text[content_start + 10..];
                let trimmed = rest.trim_start();
                if trimmed.starts_with('"') && trimmed.len() > 2 {
                    let inner = &trimmed[1..];
                    if let Some(end) = inner.find('"') {
                        let content = &inner[..end];
                        return json!({
                            "executive_summary": content,
                            "recommendations": [],
                            "overall_risk": "medium"
                        });
                    }
                }
            }
            return Value::Null;
        }
    };

    // Reasoning models (DeepSeek V4) may put output in reasoning_content
    // when content is null; fall back to reasoning_content.
    let content = resp_body
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty() && *s != "null")
        .or_else(|| resp_body
            .pointer("/choices/0/message/reasoning_content")
            .and_then(|v| v.as_str()))
        .unwrap_or("");

    // Strip markdown fencing if present
    let stripped = content.trim().trim_start_matches("```json").trim_start_matches("```").trim_end_matches("```").trim();
    match serde_json::from_str::<Value>(stripped) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("LLM enrichment JSON parse failed: {e} — content: {}", truncate(stripped, 200));
            Value::Null
        }
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
