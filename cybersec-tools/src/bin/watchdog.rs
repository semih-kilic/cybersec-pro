use anyhow::Result;
use clap::Parser;
use std::process::Command;
use std::time::Duration;

#[derive(Parser)]
#[command(name = "csec-watchdog", about = "Service health watchdog with auto-healing")]
struct Cli {
    #[arg(long, default_value = "/home/cybersec/cybersec-pro")]
    basedir: String,
    #[arg(long, default_value = "60")]
    interval: u64,
    #[arg(long)]
    once: bool,
}

fn log_msg(msg: &str) {
    let line = format!("[{}] {}", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"), msg);
    let _ = std::fs::OpenOptions::new()
        .create(true).append(true)
        .open("/tmp/cybersec-watchdog.log")
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", line)
        });
    println!("{}", line);
}

fn check_container_health(container_name: &str) -> String {
    Command::new("docker")
        .args(["inspect", "-f", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", container_name])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "missing".into())
}

fn is_container_ok(status: &str) -> bool {
    status == "healthy" || status == "running"
}

fn check_url(url: &str) -> bool {
    Command::new("curl")
        .args(["-s", "-o", "/dev/null", "-w", "%{http_code}", url])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim() == "200")
        .unwrap_or(false)
}

fn free_mem_mb() -> u64 {
    Command::new("free")
        .arg("-m")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|out| {
            out.lines().find(|l| l.starts_with("Mem:"))
                .and_then(|l| l.split_whitespace().nth(6))
                .and_then(|s| s.parse().ok())
        })
        .unwrap_or(0)
}

fn restart_service(service_name: &str, basedir: &str) {
    log_msg(&format!("Restarting service {}...", service_name));
    let _ = Command::new("sh")
        .arg("-c")
        .arg(format!("cd {} && docker compose up -d {}", basedir, service_name))
        .status();
}

fn restart_container(container_name: &str, basedir: &str) {
    log_msg(&format!("Restarting container {}...", container_name));
    let _ = Command::new("sh")
        .arg("-c")
        .arg(format!("cd {} && docker compose up -d {}", basedir, container_name))
        .status();
}

fn main_loop(basedir: &str) {
    let free = free_mem_mb();
    if free < 1000 {
        log_msg(&format!("Low RAM ({}MB). Dropping caches...", free));
        let _ = Command::new("sync").status();
        let _ = Command::new("sh")
            .arg("-c")
            .arg("sysctl -w vm.drop_caches=3")
            .status();
    }

    let zombies = ["maltego", "vite.config.staging.ts"];
    for proc in &zombies {
        if let Ok(o) = Command::new("pgrep").args(["-f", proc]).output() {
            if !o.stdout.is_empty() {
                let _ = Command::new("pkill").args(["-f", proc]).status();
                log_msg(&format!("Killed zombie: {}", proc));
            }
        }
    }

    let api_status = check_container_health("cybersec-api");
    if !is_container_ok(&api_status) {
        log_msg(&format!("Backend is {} (container: cybersec-api). Restarting...", api_status));
        restart_service("rust-backend", basedir);
    }

    let engine_status = check_container_health("cybersec-scan-engine");
    if !is_container_ok(&engine_status) {
        log_msg(&format!("Scan engine is {} (container: cybersec-scan-engine). Restarting...", engine_status));
        restart_service("rust-scan-engine", basedir);
    }

    if !check_url("http://localhost:5002/health") {
        log_msg("Scan engine port 5002 DOWN. Restarting scan engine...");
        restart_service("rust-scan-engine", basedir);
    }

    let nginx_status = check_container_health("cybersec-nginx");
    if !is_container_ok(&nginx_status) {
        log_msg(&format!("Nginx is {} (container: cybersec-nginx). Restarting...", nginx_status));
        restart_service("nginx", basedir);
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    if cli.once {
        main_loop(&cli.basedir);
        return Ok(());
    }

    log_msg("Watchdog started (continuous mode)");
    loop {
        main_loop(&cli.basedir);
        tokio::time::sleep(Duration::from_secs(cli.interval)).await;
    }
}
