use anyhow::Result;
use clap::Parser;
use colored::*;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Parser)]
#[command(name = "csec-disk-cleanup", about = "Periodic disk cleanup for CyberSec Pro")]
struct Cli {
    #[arg(long, default_value = "/home/cybersec")]
    home: String,

    #[arg(long)]
    dry_run: bool,
}

fn log(msg: &str) {
    println!("[{}] {}", chrono::Local::now().format("%F %T"), msg);
}

fn disk_free_mb() -> u64 {
    let output = Command::new("df")
        .args(["-BM", "/"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default();
    output.lines().nth(1)
        .and_then(|l| l.split_whitespace().nth(3))
        .and_then(|s| s.trim_end_matches('M').parse().ok())
        .unwrap_or(0)
}

fn remove_dir(path: &Path) -> bool {
    if path.exists() {
        std::fs::remove_dir_all(path).is_ok()
    } else {
        false
    }
}

fn remove_glob(pattern: &str) -> usize {
    let mut count = 0;
    for entry in glob::glob(pattern).unwrap_or_else(|_| glob::Pattern::new("*").unwrap().into()) {
        if let Ok(path) = entry {
            if path.is_file() || path.is_dir() {
                let _ = std::fs::remove_file(&path);
                let _ = std::fs::remove_dir_all(&path);
                count += 1;
            }
        }
    }
    count
}

fn run_cmd(cmd: &str, args: &[&str]) -> bool {
    Command::new(cmd).args(args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let home = &cli.home;

    let before = disk_free_mb();
    log(&format!("Cleanup started. Free space: {} MB", before));

    if !cli.dry_run {
        // 1) Go build cache
        let go_build = PathBuf::from(home).join(".cache/go-build");
        if remove_dir(&go_build) { log("go-build cache cleared"); }

        // 2) Pip cache
        let pip_cache = PathBuf::from(home).join(".cache/pip");
        if remove_dir(&pip_cache) { log("pip cache cleared"); }

        // 3) Cargo cache (keep registry/index)
        for sub in &["cache", "src"] {
            let pattern = format!("{}/.cargo/registry/{}/*", home, sub);
            let n = remove_glob(&pattern);
            if n > 0 { log(&format!("cargo registry/{} cleared: {} items", sub, n)); }
        }
        let git_pattern = format!("{}/.cargo/git/checkouts/*", home);
        let n = remove_glob(&git_pattern);
        if n > 0 { log(&format!("cargo git checkouts cleared: {} items", n)); }

        // 4) Rustup tmp
        let rustup_pattern = format!("{}/.rustup/tmp/*", home);
        let n = remove_glob(&rustup_pattern);
        if n > 0 { log(&format!("rustup tmp cleared: {} items", n)); }

        // 5) NPM cache
        run_cmd("npm", &["cache", "clean", "--force"]);
        log("npm cache cleared");

        // 6) APT
        run_cmd("apt-get", &["clean"]);
        run_cmd("apt-get", &["autoremove", "-y"]);
        log("apt cache cleared");

        // 7) Journal (max 200M)
        run_cmd("journalctl", &["--vacuum-size=200M"]);
        log("journal vacuumed (200M)");

        // 8) Old /tmp files
        run_cmd("find", &["/tmp", "-mtime", "+1", "-type", "f", "-delete"]);
        run_cmd("find", &["/var/tmp", "-mtime", "+3", "-type", "f", "-delete"]);
        log("/tmp and /var/tmp old files removed");

        // 9) Rust target/debug directories
        for dir in &["rust-agent", "rust-scan-engine", "rust-service-manager"] {
            let debug = PathBuf::from(home).join(format!("cybersec-pro/{}/target/debug", dir));
            if debug.exists() {
                remove_dir(&debug);
                log(&format!("Removed: {}/target/debug", dir));
            }
        }
    }

    let after = disk_free_mb();
    let saved = after as i64 - before as i64;
    log(&format!("Cleanup done. Free space: {} MB (saved: {} MB)", after, saved));

    Ok(())
}
