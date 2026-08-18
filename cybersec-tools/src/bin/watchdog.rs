use anyhow::Result;
use clap::Parser;
use std::process::Command;
use std::time::Duration;

#[derive(Parser)]
#[command(name = "csec-watchdog", about = "Service health watchdog with auto-healing")]
struct Cli {
    #[arg(long, default_value = "/home/cybersec/cybersec-pro")]
    basedir: String,

    /// Check interval in seconds
    #[arg(long, default_value = "60")]
    interval: u64,

    /// Run once and exit (for cron)
    #[arg(long)]
    once: bool,
}

fn log(msg: &str) {
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

fn check_container_health(name: &str) -> String {
    Command::new("docker")
        .args(["inspect", "-f", "{{.State.Health.Status}}", name])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "missing".into())
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

fn restart_container(name: &str, basedir: &str) {
    log(&format!("Restarting container {}...", name));
    let _ = Command::new("sh")
        .arg("-c")
        .arg(format!("cd {} && docker compose up -d {}", basedir, name))
        .status();
}

fn main_loop(basedir: &str) {
    // 1. RAM check
    let free = free_mem_mb();
    if free < 1000 {
        log(&format!("Low RAM ({}MB). Dropping caches...", free));
        let _ = Command::new("sync").status();
        let _ = Command::new("sh")
            .arg("-c")
            .arg("sysctl -w vm.drop_caches=3")
            .status();
    }

    // 2. Kill zombie processes
    let zombies = ["maltego", "vite.config.staging.ts"];
    for proc in &zombies {
        let output = Command::new("pgrep")
            .args(["-f", proc])
            .output()
            .ok();
        if let Some(o) = output {
            if !o.stdout.is_empty() {
                let _ = Command::new("pkill")
                    .args(["-f", proc])
                    .status();
                log(&format!("Killed zombie process: {}", proc));
            }
        }
    }

    // 3. Check backend
    let status = check_container_health("cybersec-api");
    if status != "healthy" {
        log(&format!("Backend is {}. Restarting...", status));
        restart_container("rust-backend", basedir);
    }

    // 4. Check scan engine
    if !check_url("http://localhost:5002/health") {
        log("Scan engine DOWN. Restarting...");
        let _ = Command::new("pkill")
            .args(["-f", "cybersec-scan-engine"])
            .status();
        std::thread::sleep(Duration::from_secs(1));
        let engine_dir = format!("{}/rust-scan-engine", basedir);
        let _ = Command::new("sh")
            .arg("-c")
            .arg(format!("cd {} && ./target/release/cybersec-scan-engine &", engine_dir))
            .status();
    }

    // 5. Check nginx
    let nginx_status = check_container_health("cybersec-nginx");
    if nginx_status != "running" {
        log(&format!("Nginx is {}. Restarting...", nginx_status));
        restart_container("cybersec-nginx", basedir);
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    if cli.once {
        main_loop(&cli.basedir);
        return Ok(());
    }

    log("Watchdog started (continuous mode)");
    loop {
        main_loop(&cli.basedir);
        tokio::time::sleep(Duration::from_secs(cli.interval)).await;
    }
}
