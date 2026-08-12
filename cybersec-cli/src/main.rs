use clap::{Parser, Subcommand};
use reqwest::Client;
use serde_json::json;
use std::io::{self, Write};

#[derive(Parser)]
#[command(name = "cybersec-pro")]
#[command(about = "CyberSec Pro CLI — CI/CD and local security scanning", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// API base URL
    #[arg(short, long, default_value = "https://cyber-sec-pro.com")]
    api_url: String,

    /// API key for authentication
    #[arg(short, long, env = "CYBERSEC_API_KEY")]
    api_key: Option<String>,
}

#[derive(Subcommand)]
enum Commands {
    /// Trigger a security scan
    Scan {
        /// Tool name (e.g. nmap, nikto, nuclei)
        #[arg(short, long)]
        tool: String,

        /// Target to scan
        #[arg(short, long)]
        target: String,

        /// Wait for scan to complete
        #[arg(short, long)]
        wait: bool,
    },
    /// Check scan status
    Status {
        /// Scan ID
        scan_id: String,
    },
    /// List recent scans
    List {
        /// Maximum number of scans to show
        #[arg(short, long, default_value = "10")]
        limit: u32,
    },
    /// Generate a report for a scan
    Report {
        /// Scan ID
        scan_id: String,

        /// Report format (html, pdf, json, csv, markdown)
        #[arg(short, long, default_value = "html")]
        format: String,

        /// Report template (executive, technical, full)
        #[arg(short, long, default_value = "full")]
        template: String,
    },
    /// List available tools
    Tools,
    /// Show CLI version
    Version,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let api_url = cli.api_url.trim_end_matches('/');

    match cli.command {
        Commands::Scan { tool, target, wait } => {
            println!("🚀 Triggering {} scan on {}...", tool, target);

            let body = json!({
                "tool": tool,
                "target": target,
                "parameters": {}
            });

            let resp = client
                .post(format!("{}/api/v1/scan/start", api_url))
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await?;

            if !resp.status().is_success() {
                let err = resp.text().await?;
                anyhow::bail!("Scan failed: {}", err);
            }

            let result: serde_json::Value = resp.json().await?;
            let scan_id = result["scan_id"].as_str().unwrap_or("unknown");

            println!("✅ Scan started: {}", scan_id);
            println!("   Status: {}", result["status"].as_str().unwrap_or("unknown"));
            println!("   Tool: {}", result["tool"].as_str().unwrap_or("unknown"));
            println!("   Target: {}", result["target"].as_str().unwrap_or("unknown"));

            if wait {
                println!("\n⏳ Waiting for scan to complete...");
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    let status_resp = client
                        .get(format!("{}/api/v1/scans/{}", api_url, scan_id))
                        .send()
                        .await?;

                    if status_resp.status().is_success() {
                        let status: serde_json::Value = status_resp.json().await?;
                        let s = status["status"].as_str().unwrap_or("unknown");
                        println!("   Status: {}", s);

                        if s == "completed" || s == "failed" || s == "cancelled" {
                            println!("\n✅ Scan finished with status: {}", s);
                            if s == "completed" {
                                println!("   Report: {}/api/v1/reports/{}", api_url, scan_id);
                            }
                            break;
                        }
                    }
                }
            }
        }
        Commands::Status { scan_id } => {
            let resp = client
                .get(format!("{}/api/v1/scans/{}", api_url, scan_id))
                .send()
                .await?;

            if !resp.status().is_success() {
                anyhow::bail!("Scan not found");
            }

            let status: serde_json::Value = resp.json().await?;
            println!("Scan ID: {}", scan_id);
            println!("Status: {}", status["status"].as_str().unwrap_or("unknown"));
            println!("Tool: {}", status["tool_name"].as_str().unwrap_or("unknown"));
            println!("Target: {}", status["target"].as_str().unwrap_or("unknown"));
            if let Some(started) = status["started_at"].as_str() {
                println!("Started: {}", started);
            }
        }
        Commands::List { limit } => {
            let resp = client
                .get(format!("{}/api/v1/scans?limit={}", api_url, limit))
                .send()
                .await?;

            if !resp.status().is_success() {
                anyhow::bail!("Failed to list scans");
            }

            let result: serde_json::Value = resp.json().await?;
            let scans = result["scans"].as_array().unwrap_or(&[]);

            if scans.is_empty() {
                println!("No scans found.");
            } else {
                println!("{:<36} {:<12} {:<20} {:<15}", "Scan ID", "Status", "Tool", "Target");
                println!("{}", "-".repeat(85));
                for scan in scans {
                    let id = scan["id"].as_str().unwrap_or("unknown");
                    let status = scan["status"].as_str().unwrap_or("unknown");
                    let tool = scan["tool_name"].as_str().unwrap_or("unknown");
                    let target = scan["target"].as_str().unwrap_or("unknown");
                    println!("{:<36} {:<12} {:<20} {:<15}", id, status, tool, target);
                }
            }
        }
        Commands::Report { scan_id, format, template } => {
            println!("📄 Generating {} report (template: {})...", format, template);

            let body = json!({
                "scan_ids": [scan_id],
                "name": format!("Scan-{}-{}", scan_id, template),
                "format": format,
                "template": template,
            });

            let resp = client
                .post(format!("{}/api/v1/reports", api_url))
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await?;

            if !resp.status().is_success() {
                let err = resp.text().await?;
                anyhow::bail!("Report generation failed: {}", err);
            }

            let result: serde_json::Value = resp.json().await?;
            let report_id = result["report"]["id"].as_str().unwrap_or("unknown");

            println!("✅ Report generated: {}", report_id);
            println!("   Download: {}/api/v1/reports/{}", api_url, report_id);
        }
        Commands::Tools => {
            let resp = client
                .get(format!("{}/api/v1/tools/available", api_url))
                .send()
                .await?;

            if !resp.status().is_success() {
                anyhow::bail!("Failed to fetch tools");
            }

            let result: serde_json::Value = resp.json().await?;
            let tools = result["tools"].as_array().unwrap_or(&[]);

            println!("Available tools ({}/183):", tools.len());
            println!("{:<20} {:<25} {:<15}", "Name", "Category", "Danger Level");
            println!("{}", "-".repeat(65));
            for tool in tools {
                let name = tool["name"].as_str().unwrap_or("unknown");
                let category = tool["category"].as_str().unwrap_or("unknown");
                let danger = tool["danger"].as_u64().unwrap_or(0);
                let danger_str = match danger {
                    0 => "Safe",
                    1 => "Intrusive",
                    2 => "Destructive",
                    _ => "Unknown",
                };
                println!("{:<20} {:<25} {:<15}", name, category, danger_str);
            }
        }
        Commands::Version => {
            println!("cybersec-pro-cli v0.1.0");
            println!("API: {}", api_url);
        }
    }

    Ok(())
}
