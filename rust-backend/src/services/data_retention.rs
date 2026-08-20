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
        "DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days'"
    )
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
