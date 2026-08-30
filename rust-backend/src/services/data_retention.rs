use sqlx::PgPool;
use serde::Serialize;
use regex::Regex;

#[derive(Serialize)]
pub struct RetentionHealth {
    pub scan_retention_days: u32,
    pub log_retention_days: u32,
    pub scans_pending_purge: i64,
    pub logs_pending_purge: i64,
}

/// How long scan records are kept. GDPR/PIPEDA storage limitation: personal
/// data must not be kept longer than the purpose requires.
pub fn scan_retention_days() -> u32 {
    std::env::var("SCAN_RETENTION_DAYS").ok().and_then(|v| v.parse().ok()).unwrap_or(30)
}

/// How long audit logs are kept. Longer than scans: SOC 2 expects an audit
/// trail, and these rows carry far less personal data.
pub fn log_retention_days() -> u32 {
    std::env::var("LOG_RETENTION_DAYS").ok().and_then(|v| v.parse().ok()).unwrap_or(90)
}

/// Is automatic purging switched on?
///
/// Off by default, deliberately. The purge functions below existed but were
/// never called from anywhere, so every deployment has years of history that
/// enabling this would delete on the first run. That should be a decision, not
/// a surprise — set `DATA_RETENTION_ENABLED=true` once you have checked
/// `/api/v1/data-retention/health` and are happy with the counts.
pub fn retention_enabled() -> bool {
    std::env::var("DATA_RETENTION_ENABLED")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true") || v.eq_ignore_ascii_case("yes"))
        .unwrap_or(false)
}

/// Purge expired scans across every organisation.
pub async fn purge_all_expired_scans(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let days = scan_retention_days() as i32;
    let result = sqlx::query(
        "DELETE FROM scans WHERE created_at < NOW() - make_interval(days => $1)",
    )
    .bind(days)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Daily retention sweep.
///
/// The purge functions were dead code: nothing scheduled them, while
/// `/api/v1/data-retention/health` reported a "pending purge" count to the
/// customer that never went down.
pub async fn run_retention_loop(pool: PgPool) {
    if !retention_enabled() {
        tracing::info!(
            "data retention purge is DISABLED (scans>{}d, logs>{}d would be deleted). \
             Set DATA_RETENTION_ENABLED=true to switch it on.",
            scan_retention_days(),
            log_retention_days()
        );
        return;
    }

    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(24 * 3600));
    loop {
        ticker.tick().await;
        match purge_all_expired_scans(&pool).await {
            Ok(n) if n > 0 => tracing::info!("data retention: purged {n} scans older than {}d", scan_retention_days()),
            Ok(_) => tracing::debug!("data retention: no scans to purge"),
            Err(e) => tracing::error!("data retention: scan purge failed: {e}"),
        }
        match purge_old_audit_logs(&pool).await {
            Ok(n) if n > 0 => tracing::info!("data retention: purged {n} audit logs older than {}d", log_retention_days()),
            Ok(_) => tracing::debug!("data retention: no audit logs to purge"),
            Err(e) => tracing::error!("data retention: audit log purge failed: {e}"),
        }
    }
}

pub async fn purge_old_scans(pool: &PgPool, org_id: &str) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM scans WHERE created_at < NOW() - INTERVAL '30 days' AND organization_id = $1"
    )
    .bind(org_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

pub async fn purge_old_audit_logs(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM audit_logs WHERE created_at < NOW() - make_interval(days => $1)",
    )
    .bind(log_retention_days() as i32)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

pub async fn erase_user_data(pool: &PgPool, user_id: &str) -> Result<String, String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE scans SET target = 'REDACTED' WHERE organization_id IN (SELECT organization_id FROM users WHERE id = $1)")
        .bind(user_id).execute(&mut *tx).await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM agents WHERE organization_id IN (SELECT organization_id FROM users WHERE id = $1)")
        .bind(user_id).execute(&mut *tx).await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM audit_logs WHERE user_id = $1")
        .bind(user_id).execute(&mut *tx).await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id).execute(&mut *tx).await.map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok("All user data has been erased".to_string())
}

pub fn purge_sensitive_data(text: &str) -> String {
    let patterns: Vec<(&str, &str)> = vec![
        (r"(?i)(password|pwd|pass)\s*[:=]\s*\S+", "$1=[REDACTED]"),
        (r"(?i)(api[_-]?key|apikey)\s*[:=]\s*\S+", "$1=[REDACTED]"),
        (r"(?i)(secret|token)\s*[:=]\s*\S+", "$1=[REDACTED]"),
        (r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b", "[REDACTED_CARD]"),
        (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", "[REDACTED_EMAIL]"),
        (r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b", "[REDACTED_IP]"),
    ];

    let mut result = text.to_string();
    for (pattern, replacement) in patterns {
        if let Ok(re) = Regex::new(pattern) {
            result = re.replace_all(&result, replacement).to_string();
        }
    }
    result
}

pub async fn data_retention_health(pool: &PgPool) -> Result<RetentionHealth, String> {
    let scan_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM scans WHERE created_at < NOW() - INTERVAL '30 days'"
    ).fetch_one(pool).await.map_err(|e| e.to_string())?;

    let log_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days'"
    ).fetch_one(pool).await.map_err(|e| e.to_string())?;

    Ok(RetentionHealth {
        scan_retention_days: 30,
        log_retention_days: 90,
        scans_pending_purge: scan_count.0,
        logs_pending_purge: log_count.0,
    })
}
