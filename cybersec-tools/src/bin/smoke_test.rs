use anyhow::Result;
use clap::Parser;

use std::collections::HashMap;
use std::path::Path;

#[derive(Parser)]
#[command(name = "csec-smoke-test", about = "Test if tool binaries are reachable")]
struct Cli {
    #[arg(long, env = "DATABASE_URL", default_value = "postgres://cybersec:***REMOVED-BY-AUDIT***@localhost:5432/cybersec_pro")]
    database_url: String,

    #[arg(long)]
    apply: bool,

    #[arg(long, default_value = "/home/cybersec/tool_smoke_results.json")]
    out: String,
}

const ALWAYS_PRESENT: &[&str] = &["echo", "ls", "cat", "grep", "awk", "sed", "true", "false"];
const INTERPRETER_WRAPPERS: &[&str] = &["bash", "sh", "python3", "python", "ruby", "perl", "go", "node"];
const RELPATH_SEARCH_ROOTS: &[&str] = &[
    "/opt/cybersec-tools", "/opt", "/usr/share", "/usr/local/share",
    "/usr/share/kali-menu", "/home/cybersec/cybersec-tools",
];

fn which(binary: &str) -> Option<String> {
    if ALWAYS_PRESENT.contains(&binary) {
        return Some(format!("/builtin/{}", binary));
    }
    which::which(binary).ok().map(|p| p.to_string_lossy().to_string())
}

fn resolve_relative_script(token: &str) -> Option<String> {
    if !token.contains('/') {
        return None;
    }
    for root in RELPATH_SEARCH_ROOTS {
        let candidate = Path::new(root).join(token);
        if candidate.exists() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }
    None
}

fn evaluate_tool(tool_id: &str, name: &str, binary_name: &str, template: &str) -> serde_json::Value {
    let template = template.trim();
    let binary_name = if binary_name.is_empty() { name } else { binary_name };

    // 1. Primary binary check
    if let Some(found) = which(binary_name) {
        return serde_json::json!({"id": tool_id, "name": name, "status": "working", "reason": "binary_in_path", "evidence": found});
    }

    // 2. Inspect command_template tokens
    if !template.is_empty() {
        let tokens: Vec<&str> = template.split_whitespace().collect();
        if tokens.is_empty() {
            return serde_json::json!({"id": tool_id, "name": name, "status": "broken", "reason": "empty_template"});
        }

        let first = tokens[0];
        let rest = &tokens[1..];

        // Case A: bash X/y.sh
        if INTERPRETER_WRAPPERS.contains(&first) && !rest.is_empty() {
            if which(first).is_none() {
                return serde_json::json!({"id": tool_id, "name": name, "status": "broken", "reason": "interpreter_missing", "evidence": first});
            }
            let script_token = rest[0];
            if script_token.contains('/') && !script_token.starts_with('/') {
                if let Some(resolved) = resolve_relative_script(script_token) {
                    return serde_json::json!({"id": tool_id, "name": name, "status": "working", "reason": "script_found", "evidence": resolved});
                }
                return serde_json::json!({"id": tool_id, "name": name, "status": "broken", "reason": "script_not_found", "evidence": script_token});
            }
            if script_token.starts_with('/') {
                if Path::new(script_token).exists() {
                    return serde_json::json!({"id": tool_id, "name": name, "status": "working", "reason": "script_found", "evidence": script_token});
                }
                return serde_json::json!({"id": tool_id, "name": name, "status": "broken", "reason": "script_not_found", "evidence": script_token});
            }
            if script_token.starts_with('-') {
                return serde_json::json!({"id": tool_id, "name": name, "status": "working", "reason": "interpreter_inline"});
            }
        }

        // Case B: absolute path
        if first.starts_with('/') {
            if Path::new(first).exists() {
                return serde_json::json!({"id": tool_id, "name": name, "status": "working", "reason": "absolute_path_exists", "evidence": first});
            }
            return serde_json::json!({"id": tool_id, "name": name, "status": "broken", "reason": "absolute_path_missing", "evidence": first});
        }

        // Case C: plain binary
        if !first.starts_with('{') {
            if let Some(found) = which(first) {
                return serde_json::json!({"id": tool_id, "name": name, "status": "working", "reason": "template_binary_in_path", "evidence": found});
            }
        }
    }

    // 3. Last resort — tool name as binary
    if let Some(found) = which(name) {
        return serde_json::json!({"id": tool_id, "name": name, "status": "working", "reason": "name_in_path", "evidence": found});
    }

    serde_json::json!({"id": tool_id, "name": name, "status": "broken", "reason": "binary_not_found",
        "evidence": format!("binary_name={} template={}", binary_name, &template[..template.len().min(80)])})
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let pool = sqlx::PgPool::connect(&cli.database_url).await?;

    let rows: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT id, name, COALESCE(binary_name, name), COALESCE(command_template, '') FROM tools WHERE is_active = TRUE ORDER BY name"
    )
    .fetch_all(&pool)
    .await?;

    let results: Vec<serde_json::Value> = rows.iter()
        .map(|(id, name, bin, tmpl)| evaluate_tool(id, name, bin, tmpl))
        .collect();

    let working: Vec<_> = results.iter().filter(|r| r["status"] == "working").collect();
    let broken: Vec<_> = results.iter().filter(|r| r["status"] == "broken").collect();

    let mut work_reasons: HashMap<String, i64> = HashMap::new();
    let mut broken_reasons: HashMap<String, i64> = HashMap::new();
    for r in &working {
        *work_reasons.entry(r["reason"].as_str().unwrap_or("?").to_string()).or_insert(0) += 1;
    }
    for r in &broken {
        *broken_reasons.entry(r["reason"].as_str().unwrap_or("?").to_string()).or_insert(0) += 1;
    }

    println!("Total: {}  Working: {}  Broken: {}", results.len(), working.len(), broken.len());
    println!("Working reasons: {:?}", work_reasons);
    println!("Broken reasons: {:?}", broken_reasons);

    let summary = serde_json::json!({
        "total": results.len(),
        "working_count": working.len(),
        "broken_count": broken.len(),
        "work_reasons": work_reasons,
        "broken_reasons": broken_reasons,
        "working": working,
        "broken": broken,
    });
    std::fs::write(&cli.out, serde_json::to_string_pretty(&summary)?)?;
    println!("Wrote: {}", cli.out);

    if cli.apply && !broken.is_empty() {
        let broken_ids: Vec<String> = broken.iter()
            .filter_map(|r| r["id"].as_str().map(|s| s.to_string()))
            .collect();
        for id in &broken_ids {
            sqlx::query("UPDATE tools SET is_active = FALSE WHERE id = $1")
                .bind(id)
                .execute(&pool)
                .await?;
        }
        println!("Marked {} broken tools as is_active=FALSE.", broken_ids.len());
    }

    Ok(())
}
