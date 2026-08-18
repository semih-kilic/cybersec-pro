use anyhow::Result;
use clap::Parser;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Parser)]
#[command(name = "csec-disk-cleanup", about = "Periodic disk cleanup for CyberSec Pro")]
struct Cli {
    #[arg(long, default_value = "/home/cybersec")]
    home: String,
    #[arg(long)]
    dry_run: bool,
}

fn log_msg(msg: &str) { println!("[{}] {}", chrono::Local::now().format("%F %T"), msg); }

fn disk_free_mb() -> u64 {
    Command::new("df").args(["-BM", "/"]).output().ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.lines().nth(1).map(|l| l.to_string()))
        .and_then(|l| l.split_whitespace().nth(3).map(|s| s.trim_end_matches('M').to_string()))
        .and_then(|s| s.parse().ok()).unwrap_or(0)
}

fn remove_dir_all(path: &Path) -> bool { path.exists() && std::fs::remove_dir_all(path).is_ok() }

fn remove_glob(pattern: &str) -> usize {
    let mut count = 0;
    if let Ok(entries) = glob::glob(pattern) {
        for entry in entries.flatten() {
            if entry.is_file() { let _ = std::fs::remove_file(&entry); count += 1; }
            else if entry.is_dir() { let _ = std::fs::remove_dir_all(&entry); count += 1; }
        }
    }
    count
}

fn run_cmd(cmd: &str, args: &[&str]) -> bool {
    Command::new(cmd).args(args).stdout(Stdio::null()).stderr(Stdio::null()).status().map(|s| s.success()).unwrap_or(false)
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let home = &cli.home;
    let before = disk_free_mb();
    log_msg(&format!("Cleanup started. Free space: {} MB", before));

    if !cli.dry_run {
        if remove_dir_all(&PathBuf::from(home).join(".cache/go-build")) { log_msg("go-build cache cleared"); }
        if remove_dir_all(&PathBuf::from(home).join(".cache/pip")) { log_msg("pip cache cleared"); }
        for sub in &["cache", "src"] {
            let n = remove_glob(&format!("{}/.cargo/registry/{}/*", home, sub));
            if n > 0 { log_msg(&format!("cargo registry/{} cleared: {} items", sub, n)); }
        }
        let n = remove_glob(&format!("{}/.cargo/git/checkouts/*", home));
        if n > 0 { log_msg(&format!("cargo git checkouts cleared: {} items", n)); }
        let n = remove_glob(&format!("{}/.rustup/tmp/*", home));
        if n > 0 { log_msg(&format!("rustup tmp cleared: {} items", n)); }
        run_cmd("npm", &["cache", "clean", "--force"]);
        log_msg("npm cache cleared");
        run_cmd("apt-get", &["clean"]);
        run_cmd("apt-get", &["autoremove", "-y"]);
        log_msg("apt cache cleared");
        run_cmd("journalctl", &["--vacuum-size=200M"]);
        log_msg("journal vacuumed (200M)");
        run_cmd("find", &["/tmp", "-mtime", "+1", "-type", "f", "-delete"]);
        run_cmd("find", &["/var/tmp", "-mtime", "+3", "-type", "f", "-delete"]);
        log_msg("/tmp and /var/tmp old files removed");
        for dir in &["rust-agent", "rust-scan-engine", "rust-service-manager"] {
            let debug = PathBuf::from(home).join(format!("cybersec-pro/{}/target/debug", dir));
            if debug.exists() { remove_dir_all(&debug); log_msg(&format!("Removed: {}/target/debug", dir)); }
        }
    }
    let after = disk_free_mb();
    log_msg(&format!("Cleanup done. Free: {} MB (saved: {} MB)", after, after as i64 - before as i64));
    Ok(())
}
