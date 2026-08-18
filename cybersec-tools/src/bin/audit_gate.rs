use anyhow::Result;
use clap::Parser;
use colored::*;
use std::collections::HashMap;

#[derive(Parser)]
#[command(name = "csec-audit-gate", about = "Audit tools and gate is_active status")]
struct Cli {
    #[arg(long, env = "DATABASE_URL", default_value = "postgres://cybersec:***REMOVED-BY-AUDIT***@localhost:5432/cybersec_pro")]
    database_url: String,

    #[arg(long)]
    apply: bool,
}

const SKIP_PREFIXES: &[&str] = &["sudo", "env", "time", "nice", "ionice", "stdbuf", "/usr/bin/env"];

fn first_token(template: &str) -> Option<String> {
    let template = template.trim();
    if template.is_empty() { return None; }

    let tokens: Vec<&str> = template.split_whitespace().collect();
    if tokens.is_empty() { return None; }

    let mut cmd = tokens[0];
    let mut i = 1;

    while SKIP_PREFIXES.contains(&cmd) && i < tokens.len() {
        cmd = tokens[i];
        i += 1;
        if cmd.starts_with('-') || cmd.contains('=') {
            if i < tokens.len() {
                cmd = tokens[i];
                i += 1;
            } else {
                return None;
            }
        }
    }
    Some(cmd.to_string())
}

fn binary_exists(path_or_name: &str) -> bool {
    if path_or_name.starts_with('/') {
        let p = std::path::Path::new(path_or_name);
        p.exists() && p.is_file()
    } else {
        which::which(path_or_name).is_ok()
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let pool = sqlx::PgPool::connect(&cli.database_url).await?;

    let rows: Vec<crate::tools::Tool> = sqlx::query_as(
        "SELECT id, name, category, binary_name, command_template, is_active,
                exclusion_reason, hardware_required, gui_required,
                health_status, health_exit_code, health_evidence, last_health_check
         FROM tools ORDER BY name"
    )
    .fetch_all(&pool)
    .await?;

    let mut to_activate: Vec<(String, String)> = Vec::new();
    let mut to_deactivate: Vec<(String, String, String)> = Vec::new();
    let mut keep_active = 0;
    let mut keep_inactive = 0;
    let mut reason_counter: HashMap<String, i64> = HashMap::new();

    for r in &rows {
        let bin_name = r.binary_name.as_deref().unwrap_or("").trim();
        let tmpl = r.command_template.as_deref().unwrap_or("").trim();
        let is_active = r.is_active.unwrap_or(false);
        let existing_excl = r.exclusion_reason.as_deref().unwrap_or("");
        let hw = r.hardware_required.unwrap_or(false);
        let gui = r.gui_required.unwrap_or(false);

        let (new_active, reason) = if hw {
            (false, existing_excl.to_string().or_empty("hardware_required"))
        } else if gui {
            (false, existing_excl.to_string().or_empty("gui_required"))
        } else {
            let bin_ok = if !bin_name.is_empty() { binary_exists(bin_name) } else { false };
            let tmpl_cmd = first_token(tmpl);
            let tmpl_ok = tmpl_cmd.as_deref().map(|c| binary_exists(c)).unwrap_or(false);

            if tmpl.is_empty() {
                if !bin_name.is_empty() && bin_ok {
                    (true, String::new())
                } else if !bin_name.is_empty() {
                    (false, format!("binary_missing:{}", bin_name))
                } else {
                    (false, "no_binary_or_template".into())
                }
            } else if let Some(cmd) = &tmpl_cmd {
                if !tmpl_ok && !(bin_ok) {
                    (false, format!("binary_missing:{}", cmd))
                } else {
                    (true, String::new())
                }
            } else {
                (false, "template_unparseable".into())
            }
        };

        // Preserve permanent exclusions
        let final_active = if ["paid_license", "ios_only", "windows_only", "discontinued"].contains(&existing_excl) {
            false
        } else {
            new_active
        };
        let final_reason = if ["paid_license", "ios_only", "windows_only", "discontinued"].contains(&existing_excl) {
            existing_excl.to_string()
        } else {
            reason
        };

        if final_active && !is_active {
            to_activate.push((r.id.clone(), r.name.clone()));
        } else if !final_active && is_active {
            to_deactivate.push((r.id.clone(), r.name.clone(), final_reason.clone()));
        } else if final_active {
            keep_active += 1;
        } else {
            keep_inactive += 1;
        }

        if !final_reason.is_empty() {
            *reason_counter.entry(final_reason.split(':').next().unwrap_or("?").to_string()).or_insert(0) += 1;
        }
    }

    println!("{}", "=".repeat(70));
    println!("TOOL AUDIT: {} total", rows.len());
    println!("  Active: {} ({} existing + {} new)", keep_active + to_activate.len(), keep_active, to_activate.len());
    println!("  Inactive: {} ({} existing + {} new)", keep_inactive + to_deactivate.len(), keep_inactive, to_deactivate.len());
    println!();
    println!("Inactive reasons:");
    let mut sorted: Vec<_> = reason_counter.iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(a.1));
    for (r, c) in sorted {
        println!("  {:30} {}", r, c);
    }

    if !cli.apply {
        println!("\n>>> DRY-RUN. Use --apply to execute.");
        return Ok(());
    }

    for (id, _) in &to_activate {
        sqlx::query("UPDATE tools SET is_active=TRUE, exclusion_reason=NULL WHERE id=$1")
            .bind(id).execute(&pool).await?;
    }
    for (id, _, reason) in &to_deactivate {
        sqlx::query("UPDATE tools SET is_active=FALSE, exclusion_reason=COALESCE(NULLIF(exclusion_reason,''), $1) WHERE id=$2")
            .bind(reason).bind(id).execute(&pool).await?;
    }

    println!("Activated: {}", to_activate.len());
    println!("Deactivated: {}", to_deactivate.len());

    let final_active: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools WHERE is_active=TRUE")
        .fetch_one(&pool).await?;
    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools")
        .fetch_one(&pool).await?;
    println!("\nFinal: {}/{} active", final_active.0, total.0);

    Ok(())
}

trait OrEmpty {
    fn or_empty(self, fallback: &str) -> String;
}
impl OrEmpty for String {
    fn or_empty(self, fallback: &str) -> String {
        if self.is_empty() { fallback.to_string() } else { self }
    }
}
