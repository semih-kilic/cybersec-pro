use anyhow::{Result, Context};
use clap::Parser;
use std::fs;
use std::process::Command;

#[derive(Parser)]
#[command(name = "csec-backup-db", about = "PostgreSQL backup with encryption")]
struct Cli {
    #[arg(long, env = "DB_USER", default_value = "cybersec")]
    db_user: String,

    #[arg(long, env = "DB_NAME", default_value = "cybersec_pro")]
    db_name: String,

    #[arg(long, env = "BACKUP_DIR", default_value = "/home/cybersec/cybersec-pro/backups")]
    backup_dir: String,

    #[arg(long, env = "BACKUP_KEY_FILE", default_value = "/home/cybersec/.secrets/backup-key")]
    key_file: String,

    #[arg(long, env = "KEEP_DAYS", default_value = "30")]
    keep_days: u32,
}

fn log(msg: &str) {
    println!("[backup] {}", msg);
}

fn now_str() -> String {
    chrono::Utc::now().format("%Y%m%d-%H%M%S").to_string()
}

fn now_iso() -> String {
    chrono::Utc::now().format("%FT%TZ").to_string()
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Read encryption key
    let key = fs::read_to_string(&cli.key_file)
        .context("Key file not found")?
        .trim()
        .to_string();
    if key.is_empty() {
        anyhow::bail!("Encryption key is empty");
    }

    fs::create_dir_all(&cli.backup_dir)?;
    let ts = now_str();
    let dump_path = format!("/tmp/cybersec_dump_{}.dump", ts);
    let gz_path = format!("{}/cybersec_pro-{}.sql.gz", cli.backup_dir, ts);
    let enc_path = format!("{}/cybersec_pro-{}.sql.gz.enc", cli.backup_dir, ts);

    log(&format!("Starting dump at {}", now_iso()));

    // pg_dump via Docker
    let output = Command::new("docker")
        .args(["exec", "cybersec-db", "pg_dump", "-U", &cli.db_user, "-d", &cli.db_name, "--format=custom"])
        .output()
        .context("Failed to run pg_dump")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("pg_dump failed: {}", stderr);
    }
    fs::write(&dump_path, &output.stdout)?;

    // gzip
    Command::new("gzip")
        .args(["-c", &dump_path])
        .output()
        .and_then(|o| {
            fs::write(&gz_path, &o.stdout)?;
            Ok(())
        })
        .context("gzip failed")?;
    fs::remove_file(&dump_path)?;

    // Encrypt with openssl
    let enc_status = Command::new("sh")
        .arg("-c")
        .arg(format!(
            "echo -n '{}' | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass stdin -in '{}' -out '{}'",
            key, gz_path, enc_path
        ))
        .status()
        .context("openssl encryption failed")?;

    if !enc_status.success() {
        anyhow::bail!("Encryption failed");
    }
    fs::remove_file(&gz_path)?;

    let size = fs::metadata(&enc_path)?.len();
    log(&format!("OK: {} ({})", enc_path, size));
    log(&format!("Completed at {}", now_iso()));

    // Prune old backups
    let keep_days = cli.keep_days as i64;
    if let Ok(entries) = fs::read_dir(&cli.backup_dir) {
        let cutoff = chrono::Utc::now() - chrono::Duration::days(keep_days);
        let mut pruned = 0;
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("cybersec_pro-") && name.ends_with(".sql.gz.enc") {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(modified) = meta.modified() {
                        if modified < cutoff.into() {
                            let _ = fs::remove_file(entry.path());
                            pruned += 1;
                        }
                    }
                }
            }
        }
        if pruned > 0 {
            log(&format!("Pruned {} backups older than {}d", pruned, keep_days));
        }
    }

    Ok(())
}
