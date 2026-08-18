use anyhow::Result;
use clap::Parser;
use indicatif::{ProgressBar, ProgressStyle};
use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::process::Command;
use tokio::sync::Semaphore;

#[derive(Parser)]
#[command(name = "csec-health-probe", about = "Probe tool binaries for health status")]
struct Cli {
    #[arg(long, env = "PG_DSN", default_value = "dbname=cybersec_pro")]
    dsn: String,
    #[arg(long, env = "PROBE_TIMEOUT", default_value = "8")]
    timeout: u64,
    #[arg(long, env = "PROBE_WORKERS", default_value = "8")]
    workers: usize,
    #[arg(long)]
    report: Option<String>,
}

const PROBE_FLAGS: &[&str] = &["--version", "-V", "-v", "--help", "-h"];
const EVIDENCE_MAX: usize = 400;
const TUI_DENYLIST: &[&str] = &[
    "vim", "vi", "nvim", "less", "more", "mc", "tmux", "screen", "htop", "top",
    "nano", "joe", "emacs", "ne", "pico", "mutt", "ranger", "tig", "lynx", "links",
    "elinks", "w3m", "irssi", "weechat", "btop",
];

fn truncate(s: &str) -> String {
    let s = s.trim().to_string();
    if s.len() <= EVIDENCE_MAX { s } else { format!("{}...[trunc]", &s[..EVIDENCE_MAX]) }
}

async fn probe_binary(binary_name: &str, custom_probe: Option<&str>, timeout: Duration) -> (String, Option<i32>, String) {
    if binary_name.is_empty() {
        return ("skipped".into(), None, "no binary_name".into());
    }
    if TUI_DENYLIST.contains(&binary_name.to_lowercase().as_str()) {
        return ("skipped".into(), None, "TUI binary (denylisted)".into());
    }

    // Custom probe from DB
    if let Some(probe) = custom_probe {
        if !probe.trim().is_empty() {
            let result = Command::new("sh").arg("-c").arg(probe)
                .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
                .env("TERM", "dumb").env("NO_COLOR", "1").env("PAGER", "cat")
                .spawn();
            match result {
                Ok(child) => {
                    let output = tokio::time::timeout(timeout, child.wait_with_output()).await;
                    match output {
                        Ok(Ok(out)) => {
                            let stdout = String::from_utf8_lossy(&out.stdout);
                            let stderr = String::from_utf8_lossy(&out.stderr);
                            let ev = truncate(if stdout.is_empty() { &stderr } else { &stdout });
                            let status = if out.status.code() == Some(0) { "ok" } else { "broken" };
                            return (status.into(), out.status.code(), ev);
                        }
                        Ok(Err(e)) => return ("broken".into(), None, truncate(&e.to_string())),
                        Err(_) => return ("timeout".into(), None, format!("timeout {}s", timeout.as_secs())),
                    }
                }
                Err(e) => return ("broken".into(), None, truncate(&e.to_string())),
            }
        }
    }

    let bin_path = which::which(binary_name).ok().or_else(|| {
        for prefix in &["/usr/bin/", "/usr/sbin/", "/usr/local/bin/", "/opt/"] {
            let cand = format!("{}{}", prefix, binary_name);
            if Path::new(&cand).exists() { return Some(std::path::PathBuf::from(cand)); }
        }
        None
    });

    let bin_path = match bin_path {
        Some(p) => p,
        None => return ("missing".into(), Some(127), format!("which({}) not found", binary_name)),
    };

    let mut last_err = String::new();
    for flag in PROBE_FLAGS {
        let result = Command::new(&bin_path).arg(flag)
            .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
            .env("TERM", "dumb").env("NO_COLOR", "1").env("PAGER", "cat")
            .spawn();
        match result {
            Ok(child) => {
                let output = tokio::time::timeout(timeout, child.wait_with_output()).await;
                match output {
                    Ok(Ok(out)) => {
                        let stdout = String::from_utf8_lossy(&out.stdout);
                        let stderr = String::from_utf8_lossy(&out.stderr);
                        let ev = truncate(if stdout.is_empty() { &stderr } else { &stdout });
                        let rc = out.status.code().unwrap_or(-1);
                        if (rc == 0 || rc == 1 || rc == 2) && (!stdout.is_empty() || !stderr.is_empty()) {
                            return ("ok".into(), Some(rc), ev);
                        }
                        last_err = format!("{}->rc={}", flag, rc);
                    }
                    Ok(Err(e)) => last_err = format!("err({}): {}", flag, e),
                    Err(_) => last_err = format!("timeout({})", flag),
                }
            }
            Err(e) => last_err = format!("err({}): {}", flag, e),
        }
    }
    ("broken".into(), None, truncate(&last_err))
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let pool = sqlx::PgPool::connect(&cli.dsn).await?;
    let rows: Vec<(String, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT id, name, binary_name, health_probe FROM tools WHERE binary_name IS NOT NULL AND binary_name <> '' AND (last_health_check IS NULL OR last_health_check < NOW() - INTERVAL '24 hours') ORDER BY name"
    ).fetch_all(&pool).await?;

    let total = rows.len();
    println!("[probe] {} tools to check (timeout={}s)", total, cli.timeout);
    let pb = Arc::new(ProgressBar::new(total as u64));
    pb.set_style(ProgressStyle::default_bar().template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} ({percent}%) {msg}").unwrap());
    let sem = Arc::new(Semaphore::new(cli.workers));
    let start = Instant::now();
    let mut handles = Vec::new();

    for (id, name, bin, probe) in rows {
        let sem = sem.clone();
        let pb = pb.clone();
        let timeout = Duration::from_secs(cli.timeout);
        let bin = bin.unwrap_or_default();
        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            let (status, exit_code, evidence) = probe_binary(&bin, probe.as_deref(), timeout).await;
            pb.inc(1);
            (id, name, bin, status, exit_code, evidence)
        }));
    }

    let mut summary: HashMap<String, i64> = HashMap::new();
    let mut detailed = Vec::new();
    for h in handles {
        let (id, name, bin, status, exit_code, evidence) = h.await?;
        *summary.entry(status.clone()).or_insert(0) += 1;
        detailed.push(serde_json::json!({"id": id, "name": name, "binary": bin, "status": status, "exit_code": exit_code, "evidence": evidence}));
        sqlx::query("UPDATE tools SET health_status=$1, health_exit_code=$2, health_evidence=$3, last_health_check=NOW() WHERE id=$4")
            .bind(&status).bind(exit_code).bind(&evidence).bind(&id).execute(&pool).await?;
    }
    pb.finish_with_message("done");
    let duration = start.elapsed().as_secs_f64();
    println!("[probe] DONE in {:.1}s — summary: {}", duration, serde_json::to_string(&summary)?);

    if let Some(path) = cli.report {
        let report = serde_json::json!({"generated_at": chrono::Utc::now().to_rfc3339(), "duration_seconds": duration, "total": total, "summary": summary, "details": detailed});
        std::fs::write(&path, serde_json::to_string_pretty(&report)?)?;
        println!("[probe] report: {}", path);
    }
    Ok(())
}
