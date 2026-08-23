use sqlx::PgPool;
use std::time::Duration;
use tracing::info;

/// Tool health checks now run INSIDE the scan-engine container and are exposed
/// over an authenticated HTTP endpoint (`POST /api/v3/tools/check`). This lets
/// the API container drop its docker.sock mount entirely (container-escape
/// hardening). One HTTP round-trip replaces 2-3 `docker exec` calls per tool.

fn engine_url() -> String {
    std::env::var("SCAN_ENGINE_URL").unwrap_or_else(|_| "http://rust-scan-engine:5002".to_string())
}

async fn engine_token() -> String {
    crate::services::auth::jwt::create_access_token(
        &std::env::var("JWT_SECRET_KEY").unwrap_or_default(),
        "scan-engine",
        None,
        "service",
    )
    .unwrap_or_default()
}

#[derive(Debug, serde::Deserialize)]
struct EngineToolCheck {
    #[serde(default)]
    installed: bool,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    runtime_ok: bool,
    #[serde(default)]
    runtime_output: Option<String>,
}

async fn engine_tool_check(
    binary_name: &str,
    quick_test_cmd: Option<&str>,
) -> Result<EngineToolCheck, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(25))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(format!("{}/api/v3/tools/check", engine_url()))
        .bearer_auth(&engine_token().await)
        .json(&serde_json::json!({
            "binary": binary_name,
            "quick_test_cmd": quick_test_cmd,
        }))
        .send()
        .await
        .map_err(|e| format!("engine unreachable: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("engine returned {}", status));
    }
    resp.json::<EngineToolCheck>().await.map_err(|e| format!("bad engine payload: {}", e))
}

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

    match engine_tool_check(binary_name, quick_test_cmd).await {
        Ok(check) => {
            result.installed = check.installed;
            result.version = check.version.filter(|v| !v.is_empty());
            result.runtime_ok = check.runtime_ok;
            result.runtime_output = check.runtime_output;
            if !check.installed {
                result.status = "not_installed".to_string();
                result.error_message = Some(format!("Binary '{}' not found in scan-engine", binary_name));
            }
        }
        Err(err) => {
            // Engine unreachable is a degraded signal, not proof the tool is missing.
            result.error_message = Some(format!("Health probe failed: {}", err));
            result.status = "degraded".to_string();
            result.response_time_ms = Some(start.elapsed().as_millis() as i64);
            persist_health_check(pool, &result).await;
            return result;
        }
    }

    result.response_time_ms = Some(start.elapsed().as_millis() as i64);
    result.status = if result.runtime_ok {
        "healthy".to_string()
    } else if result.installed {
        "degraded".to_string()
    } else {
        "not_installed".to_string()
    };

    persist_health_check(pool, &result).await;

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

    info!("Running startup health check for all tools...");
    let startup_pool = pool.clone();
    tokio::spawn(async move {
        let results = run_full_health_check(&startup_pool).await;
        let healthy = results.iter().filter(|r| r.status == "healthy").count();
        let total = results.len();
        info!("Startup health check completed: {}/{} tools healthy", healthy, total);
    });

    loop {
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
