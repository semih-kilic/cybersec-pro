use sqlx::PgPool;
use std::time::Duration;
use tracing::{info, warn, error};

#[derive(sqlx::FromRow)]
struct StaleRunning {
    id: String,
    tool_id: String,
    target: String,
    started_at: Option<chrono::NaiveDateTime>,
    last_output_at: Option<chrono::NaiveDateTime>,
    timeout_seconds: Option<i32>,
    scan_phase: Option<String>,
}

/// Background task: detect and fail stuck scans
pub async fn run_stuck_scan_detector(pool: PgPool) {
    info!("Stuck scan detector started");
    loop {
        tokio::time::sleep(Duration::from_secs(60)).await;
        if let Err(e) = detect_and_fail_stuck_scans(&pool).await {
            error!("Stuck scan detector error: {}", e);
        }
    }
}

async fn detect_and_fail_stuck_scans(pool: &PgPool) -> Result<(), sqlx::Error> {
    // 1. Find scans stuck in 'running' for too long without output updates
    let stale_running: Vec<StaleRunning> = sqlx::query_as(
        r#"SELECT id, tool_id, target, started_at, last_output_at, timeout_seconds, scan_phase
           FROM scans
           WHERE status = 'running'
           AND (
               (last_output_at IS NOT NULL AND last_output_at < NOW() - INTERVAL '10 minutes')
               OR (last_output_at IS NULL AND started_at < NOW() - INTERVAL '30 minutes')
           )"#
    )
    .fetch_all(pool)
    .await?;

    for scan in &stale_running {
        let timeout = scan.timeout_seconds.unwrap_or(900) as i64;
        let started = scan.started_at.unwrap_or_else(|| chrono::Utc::now().naive_utc());
        let elapsed_secs = (chrono::Utc::now().naive_utc() - started).num_seconds();

        if elapsed_secs > timeout {
            warn!(
                "Scan {} stuck ({}s elapsed, {}s timeout) - marking as failed",
                scan.id, elapsed_secs, timeout
            );

            sqlx::query(
                r#"UPDATE scans SET
                   status = 'failed',
                   error_log = COALESCE(error_log, '') || $1,
                   completed_at = NOW(),
                   scan_phase = 'failed'
                   WHERE id = $2"#
            )
            .bind(format!(
                "[STUCK DETECTOR] Scan exceeded timeout ({}s). Last output at {:?}. Automatically failed.",
                elapsed_secs, scan.last_output_at
            ))
            .bind(&scan.id)
            .execute(pool)
            .await?;
        }
    }

    // 2. Find scans stuck in 'pending' for more than 5 minutes
    let stale_pending: Vec<(String,)> = sqlx::query_as(
        r#"SELECT id FROM scans
           WHERE status = 'pending'
           AND created_at < NOW() - INTERVAL '5 minutes'"#
    )
    .fetch_all(pool)
    .await?;

    for scan in &stale_pending {
        warn!("Scan {} stuck in pending for 5+ minutes - marking as failed", scan.0);
        sqlx::query(
            r#"UPDATE scans SET
               status = 'failed',
               error_log = COALESCE(error_log, '') || $1,
               completed_at = NOW()
               WHERE id = $2"#
        )
        .bind("[STUCK DETECTOR] Scan stuck in pending state for 5+ minutes. Automatically failed.")
        .bind(&scan.0)
        .execute(pool)
        .await?;
    }

    let total_cleaned = stale_running.len() + stale_pending.len();
    if total_cleaned > 0 {
        info!("Stuck scan detector cleaned up {} stale scans", total_cleaned);
    }

    Ok(())
}
