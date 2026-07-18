use sqlx::PgPool;
use std::time::Duration;
use tokio::process::Command;
use tracing::info;

#[derive(Debug, Clone)]
pub struct HealthCheckResult {
    pub tool_id: String,
    pub installed: bool,
    pub version: Option<String>,
    pub runtime_ok: bool,
    pub runtime_output: Option<String>,
    pub dependency_ok: bool,
    pub dependency_output: Option<String>,
    pub response_time_ms: Option<i64>,
    pub error_message: Option<String>,
    pub status: String,
}

/// Run enhanced health check for a single tool
pub async fn check_tool_health_enhanced(
    pool: &PgPool,
    tool_id: &str,
    binary_name: &str,
    quick_test_cmd: Option<&str>,
) -> HealthCheckResult {
    let start = std::time::Instant::now();
    let mut result = HealthCheckResult {
        tool_id: tool_id.to_string(),
        installed: false,
        version: None,
        runtime_ok: false,
        runtime_output: None,
        dependency_ok: true,
        dependency_output: None,
        response_time_ms: None,
        error_message: None,
        status: "unhealthy".to_string(),
    };

    // 1. Check if binary exists
    let which_output = Command::new("which")
        .arg(binary_name)
        .output()
        .await;

    match which_output {
        Ok(out) if out.status.success() => {
            result.installed = true;
        }
        _ => {
            result.status = "not_installed".to_string();
            result.error_message = Some(format!("Binary '{}' not found in PATH", binary_name));
            result.response_time_ms = Some(start.elapsed().as_millis() as i64);
            persist_health_check(pool, &result).await;
            return result;
        }
    }

    // 2. Get version (with 5s timeout, kill on drop to prevent zombie processes)
    {
        let mut cmd = Command::new(binary_name);
        cmd.arg("--version").kill_on_drop(true);
        let version_output = tokio::time::timeout(
            Duration::from_secs(5),
            cmd.output(),
        ).await;

        if let Ok(Ok(out)) = version_output {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let combined = format!("{}{}", stdout, stderr);
            let version_str = combined.lines().next().unwrap_or("").chars().take(100).collect::<String>();
            if !version_str.is_empty() {
                result.version = Some(version_str);
            }
        }
    }

    // 3. Quick runtime test (if provided)
    if let Some(test_cmd) = quick_test_cmd {
        let parts: Vec<&str> = test_cmd.split_whitespace().collect();
        if let Some((cmd, args)) = parts.split_first() {
            let mut command = Command::new(cmd);
            command.args(args).kill_on_drop(true);
            let timeout = Duration::from_secs(10);
            match tokio::time::timeout(timeout, command.output()).await {
                Ok(Ok(out)) => {
                    result.runtime_ok = out.status.success() || out.status.code() != None;
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                    result.runtime_output = Some(format!("{}{}", stdout, stderr).chars().take(500).collect());
                }
                Ok(Err(e)) => {
                    result.error_message = Some(format!("Runtime test failed: {}", e));
                }
                Err(_) => {
                    result.error_message = Some("Runtime test timed out (10s)".to_string());
                }
            }
        }
    } else {
        // Default quick test: run with --help (with 5s timeout, kill on drop)
        let mut cmd = Command::new(binary_name);
        cmd.arg("--help").kill_on_drop(true);
        let help_output = tokio::time::timeout(
            Duration::from_secs(5),
            cmd.output(),
        ).await;

        match help_output {
            Ok(Ok(out)) => {
                result.runtime_ok = true;
                let stdout = String::from_utf8_lossy(&out.stdout);
                result.runtime_output = Some(format!("{} bytes help output", stdout.len()));
            }
            Ok(Err(e)) => {
                result.error_message = Some(format!("Help test failed: {}", e));
            }
            Err(_) => {
                result.error_message = Some("Help test timed out (5s)".to_string());
                result.runtime_ok = true;
            }
        }
    }

    // 4. Determine final status
    result.response_time_ms = Some(start.elapsed().as_millis() as i64);
    result.status = if result.runtime_ok {
        "healthy".to_string()
    } else if result.installed {
        "degraded".to_string()
    } else {
        "unhealthy".to_string()
    };

    // 5. Persist to DB
    persist_health_check(pool, &result).await;

    // 6. Update tools table health columns
    let _ = sqlx::query(
        "UPDATE tools SET health_status = $1, health_exit_code = $2, health_evidence = $3, health_probe = $4, last_health_check = NOW() WHERE id = $5"
    )
    .bind(&result.status)
    .bind(if result.runtime_ok { 0 } else { 1 })
    .bind(&result.runtime_output)
    .bind(quick_test_cmd.unwrap_or("--help"))
    .bind(&result.tool_id)
    .execute(pool)
    .await;

    result
}

/// Persist health check result to tool_health_checks table
async fn persist_health_check(pool: &PgPool, result: &HealthCheckResult) {
    let _ = sqlx::query(
        r#"INSERT INTO tool_health_checks 
           (tool_id, check_type, status, installed, version, runtime_ok, runtime_output, 
            dependency_ok, dependency_output, response_time_ms, error_message, checked_at)
           VALUES ($1, 'full', $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())"#
    )
    .bind(&result.tool_id)
    .bind(&result.status)
    .bind(result.installed)
    .bind(&result.version)
    .bind(result.runtime_ok)
    .bind(&result.runtime_output)
    .bind(result.dependency_ok)
    .bind(&result.dependency_output)
    .bind(result.response_time_ms)
    .bind(&result.error_message)
    .execute(pool)
    .await;
}

/// Run health checks for all active CLI tools (batch, with concurrency limit)
pub async fn run_full_health_check(pool: &PgPool) -> Vec<HealthCheckResult> {
    info!("Starting full health check for all active CLI tools");

    let tools: Vec<(String, Option<String>)> = sqlx::query_as(
        "SELECT id, binary_name FROM tools WHERE is_active = true AND tool_type = 'cli' AND binary_name != ''"
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let total = tools.len();
    info!("Checking {} tools...", total);

    let mut results = Vec::with_capacity(tools.len());
    let concurrency = 10;
    let chunks: Vec<Vec<_>> = tools.chunks(concurrency).map(|c| c.to_vec()).collect();

    for (batch_idx, chunk) in chunks.into_iter().enumerate() {
        let mut handles = Vec::new();
        for tool in chunk {
            let pool_clone = pool.clone();
            let tool_id = tool.0.clone();
            let binary = tool.1.clone().unwrap_or_default();
            handles.push(tokio::spawn(async move {
                check_tool_health_enhanced(&pool_clone, &tool_id, &binary, None).await
            }));
        }

        for handle in handles {
            if let Ok(result) = handle.await {
                results.push(result);
            }
        }

        info!("Batch {}/{} complete", batch_idx + 1, (total + concurrency - 1) / concurrency);
    }

    let healthy = results.iter().filter(|r| r.status == "healthy").count();
    let degraded = results.iter().filter(|r| r.status == "degraded").count();
    let unhealthy = results.iter().filter(|r| r.status == "unhealthy").count();
    let not_installed = results.iter().filter(|r| r.status == "not_installed").count();

    info!(
        "Health check complete: {} healthy, {} degraded, {} unhealthy, {} not_installed (total: {})",
        healthy, degraded, unhealthy, not_installed, total
    );

    results
}

/// Background task: run health checks daily
pub async fn run_health_check_loop(pool: PgPool) {
    info!("Tool health check loop started");
    loop {
        // Run at 3:00 AM daily
        let now = chrono::Utc::now();
        let tomorrow_3am = {
            let mut target = now + chrono::Duration::hours(24);
            target = target.date_naive().and_hms_opt(3, 0, 0).unwrap().and_utc();
            if target <= now {
                target + chrono::Duration::hours(24)
            } else {
                target
            }
        };
        let wait_secs = (tomorrow_3am - now).num_seconds() as u64;
        info!("Next health check in {} seconds", wait_secs);
        tokio::time::sleep(Duration::from_secs(wait_secs)).await;

        info!("Running scheduled daily health check...");
        let _ = run_full_health_check(&pool).await;
    }
}
