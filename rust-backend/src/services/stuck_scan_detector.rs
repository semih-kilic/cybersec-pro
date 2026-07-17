use sqlx::PgPool;
use std::time::Duration;
use tracing::{info, warn};

/// Background task: detect and fail stuck scans
/// Scans that have been in 'running' or 'pending' status for too long
/// without output updates are automatically marked as 'failed'.
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
    // 1. Find scans stuck in 'running' for more than 30 minutes with no output updates
    let stale_running = sqlx::query!(
        r#"SELECT id, tool_id, target, started_at, last_output_at, timeout_seconds, scan_phase
           FROM scans 
           WHERE status = 'running' 
           AND (
               (last_output_at IS NOT NULL AND last_output_at < NOW() - INTERVAL '10 minutes')
               OR (last_output_at IS NULL AND started_at < NOW() - INTERVAL '30 minutes')
           )"#
    )
    .fetch_all(&pool)
    .await?;

    for scan in &stale_running {
        let timeout = scan.timeout_seconds.unwrap_or(900) as i64;
        let elapsed = chrono::Utc::now().naive_utc() - scan.started_at.unwrap_or_else(chrono::Utc::now().naive_utc());

        // Also check per-tool timeout
        if elapsed.num_seconds() > timeout {
            warn!(
                "Scan {} stuck ({}s elapsed, {}s timeout) — marking as failed",
                scan.id, elapsed.num_seconds(), timeout
            );

            sqlx::query!(
                r#"UPDATE scans SET 
                   status = 'failed', 
                   error_log = COALESCE(error_log, '') || $1,
                   completed_at = NOW(),
                   scan_phase = 'failed'
                   WHERE id = $2"#,
                format!("\n[STUCK DETECTOR] Scan exceeded timeout ({}s). Last output at {:?}. Automatically failed.\n", 
                    elapsed.num_seconds(), scan.last_output_at),
                scan.id
            )
            .execute(&pool)
            .await?;
        }
    }

    // 2. Find scans stuck in 'pending' for more than 5 minutes
    let stale_pending = sqlx::query!(
        r#"SELECT id FROM scans 
           WHERE status = 'pending' 
           AND created_at < NOW() - INTERVAL '5 minutes'"#
    )
    .fetch_all(&pool)
    .await?;

    for scan in &stale_pending {
        warn!("Scan {} stuck in pending for 5+ minutes — marking as failed", scan.id);
        sqlx::query!(
            r#"UPDATE scans SET 
               status = 'failed', 
               error_log = COALESCE(error_log, '') || $1,
               completed_at = NOW()
               WHERE id = $2"#,
            "\n[STUCK DETECTOR] Scan stuck in pending state for 5+ minutes. Automatically failed.\n",
            scan.id
        )
        .execute(&pool)
        .await?;
    }

    let total_cleaned = stale_running.len() + stale_pending.len();
    if total_cleaned > 0 {
        info!("Stuck scan detector cleaned up {} stale scans", total_cleaned);
    }

    Ok(())
}

use tracing::error;
