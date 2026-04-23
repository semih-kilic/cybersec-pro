use chrono::{DateTime, Utc};
use cron::Schedule;
use sqlx::PgPool;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::broadcast;

/// Compute the next fire time from a cron expression after a given reference time.
pub fn next_cron_fire(cron_expr: &str, after: DateTime<Utc>) -> Option<DateTime<Utc>> {
    // Standard cron (5 fields) needs a seconds prefix for the `cron` crate (6/7 fields).
    let expr = if cron_expr.split_whitespace().count() == 5 {
        format!("0 {}", cron_expr)
    } else {
        cron_expr.to_string()
    };
    let schedule = Schedule::from_str(&expr).ok()?;
    schedule.after(&after).next()
}

/// Background scheduler that runs every 30 seconds, checks for due scheduled scans,
/// and triggers them via the existing scan engine.
pub async fn run_scheduler(db: PgPool, scan_tx: broadcast::Sender<String>) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
    tracing::info!("📅 Scan Scheduler started — checking every 30s");

    loop {
        interval.tick().await;
        if let Err(e) = tick(&db, &scan_tx).await {
            tracing::error!("Scheduler tick error: {}", e);
        }
    }
}

async fn tick(db: &PgPool, scan_tx: &broadcast::Sender<String>) -> Result<(), String> {
    // Fetch active schedules whose next_run is in the past (or NULL).
    let rows = sqlx::query_as::<_, (
        String,          // id
        String,          // user_id
        String,          // organization_id
        String,          // tool_name
        String,          // target
        Option<String>,  // cron_expression
        Option<String>,  // parameters (json text)
        Option<String>,  // agent_id
        Option<i64>,     // project_id (as i64 for compat)
    )>(
        r#"SELECT id, user_id, organization_id, COALESCE(tool_name,''), COALESCE(target,''),
                  cron_expression, parameters::text, agent_id, CAST(project_id AS BIGINT)
           FROM scheduled_scans
           WHERE is_active = TRUE
             AND (next_run IS NULL OR next_run <= NOW())
           ORDER BY next_run ASC NULLS FIRST
           LIMIT 20"#,
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB query failed: {}", e))?;

    for (sched_id, user_id, org_id, tool_name, target, cron_expr, params_text, agent_id, project_id) in rows {
        tracing::info!("📅 Triggering scheduled scan '{}' — tool={}, target={}", sched_id, tool_name, target);

        // Resolve tool
        let tool: Option<crate::models::Tool> = sqlx::query_as(
            "SELECT * FROM tools WHERE name = $1 OR business_name = $2 OR id = $3 LIMIT 1",
        )
        .bind(&tool_name)
        .bind(&tool_name)
        .bind(&tool_name)
        .fetch_optional(db)
        .await
        .unwrap_or(None);

        let tool = match tool {
            Some(t) => t,
            None => {
                tracing::warn!("Scheduled scan {}: tool '{}' not found, skipping", sched_id, tool_name);
                // Still advance next_run so we don't loop forever
                advance_next_run(db, &sched_id, cron_expr.as_deref()).await;
                continue;
            }
        };

        // Parse optional parameters
        let params: serde_json::Value = params_text
            .as_deref()
            .and_then(|t| serde_json::from_str(t).ok())
            .unwrap_or(serde_json::json!({}));

        // Create scan record
        let scan_id = uuid::Uuid::new_v4().to_string();
        if let Err(e) = sqlx::query(
            "INSERT INTO scans (id, organization_id, user_id, tool_id, target, parameters, status, agent_id, project_id, started_at)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'running', $7, $8, CURRENT_TIMESTAMP)",
        )
        .bind(&scan_id)
        .bind(&org_id)
        .bind(&user_id)
        .bind(&tool.id)
        .bind(&target)
        .bind(&params)
        .bind(&agent_id)
        .bind(&project_id.map(|v| v as i32))
        .execute(db)
        .await
        {
            tracing::error!("Scheduled scan {} — failed to insert scan: {}", sched_id, e);
            advance_next_run(db, &sched_id, cron_expr.as_deref()).await;
            continue;
        }

        // Resolve agent SSH info (if agent_id is set)
        let agent_ssh = resolve_agent_ssh(db, agent_id.as_deref(), &org_id).await;

        // Spawn scan execution
        let db2 = db.clone();
        let scan_tx2 = scan_tx.clone();
        let tool_name2 = tool.name.clone();
        let command_template = tool.command_template.clone();
        let target2 = target.clone();
        let scan_id2 = scan_id.clone();
        let agent_id2 = agent_id.clone();

        tokio::spawn(async move {
            use crate::scan_engine::executor::{execute_scan, AgentSshInfo};

            let agent_info: Option<AgentSshInfo> = agent_ssh.map(|(h, p, u, k, fp)| AgentSshInfo {
                ssh_host: h,
                ssh_port: p,
                ssh_username: u,
                ssh_key_path: k,
                ssh_fingerprint: fp,
            });

            let result = execute_scan(&tool_name2, &target2, command_template.as_deref(), &scan_tx2, &scan_id2, agent_info).await;

            let (status, output, findings, error_log) = match &result {
                Ok(r) => ("completed".to_string(), r.output.clone(), r.findings.clone(), None),
                Err(e) => {
                    tracing::error!("Scheduled scan {} failed: {}", scan_id2, e);
                    ("failed".to_string(), String::new(), None, Some(e.to_string()))
                }
            };

            let _ = sqlx::query(
                "UPDATE scans SET status = $1, output = $2, findings = $3::jsonb, error_log = $4, completed_at = CURRENT_TIMESTAMP WHERE id = $5",
            )
            .bind(&status)
            .bind(&output)
            .bind(&findings)
            .bind(&error_log)
            .bind(&scan_id2)
            .execute(&db2)
            .await;

            let _ = scan_tx2.send(
                serde_json::json!({"type": "complete", "scan_id": scan_id2, "status": status, "scheduled": true}).to_string(),
            );

            // Release agent
            if let Some(aid) = agent_id2 {
                let _ = sqlx::query(
                    "UPDATE agents SET active_scans = GREATEST(COALESCE(active_scans,1)-1,0), total_scans = COALESCE(total_scans,0)+1, status = CASE WHEN COALESCE(active_scans,1)-1 <= 0 THEN 'online' ELSE 'busy' END WHERE id = $1",
                )
                .bind(&aid)
                .execute(&db2)
                .await;
            }
        });

        // Update schedule: increment run_count, set last_run, compute next_run
        advance_next_run(db, &sched_id, cron_expr.as_deref()).await;
    }

    Ok(())
}

async fn advance_next_run(db: &PgPool, schedule_id: &str, cron_expr: Option<&str>) {
    let next = cron_expr.and_then(|c| next_cron_fire(c, Utc::now()));
    let _ = sqlx::query(
        "UPDATE scheduled_scans SET last_run = NOW(), run_count = COALESCE(run_count,0) + 1, next_run = $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(next)
    .bind(schedule_id)
    .execute(db)
    .await;
}

async fn resolve_agent_ssh(
    db: &PgPool,
    agent_id: Option<&str>,
    org_id: &str,
) -> Option<(String, i32, String, Option<String>, Option<String>)> {
    let aid = agent_id?;
    if aid.is_empty() {
        return None;
    }
    let row: Option<(Option<String>, Option<i32>, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT ssh_host, ssh_port, ssh_username, ssh_key_path, ssh_fingerprint FROM agents WHERE id = $1 AND organization_id = $2",
    )
    .bind(aid)
    .bind(org_id)
    .fetch_optional(db)
    .await
    .unwrap_or(None);

    row.and_then(|(host, port, user, key, fp)| match (host, user) {
        (Some(h), Some(u)) if !h.is_empty() && !u.is_empty() => Some((h, port.unwrap_or(22), u, key, fp)),
        _ => None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Timelike};

    #[test]
    fn test_next_cron_fire_5field_expr_adds_seconds_prefix() {
        // "0 2 * * *" = daily at 02:00; next fire after 2026-01-01 03:00 should be 2026-01-02 02:00
        let after = Utc.with_ymd_and_hms(2026, 1, 1, 3, 0, 0).unwrap();
        let next = next_cron_fire("0 2 * * *", after);
        assert!(next.is_some(), "expected a next fire time");
        let next = next.unwrap();
        assert_eq!(next.hour(), 2);
        assert_eq!(next.minute(), 0);
        // Should be the next calendar day
        assert!(next > after);
    }

    #[test]
    fn test_next_cron_fire_already_6field_expr() {
        // 6-field cron with explicit seconds: "0 30 6 * * *" = daily at 06:30:00
        let after = Utc.with_ymd_and_hms(2026, 6, 1, 7, 0, 0).unwrap();
        let next = next_cron_fire("0 30 6 * * *", after);
        assert!(next.is_some());
        let next = next.unwrap();
        assert_eq!(next.hour(), 6);
        assert_eq!(next.minute(), 30);
        assert!(next > after);
    }

    #[test]
    fn test_next_cron_fire_invalid_expr_returns_none() {
        let after = Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap();
        assert!(next_cron_fire("not a cron", after).is_none());
        assert!(next_cron_fire("", after).is_none());
        assert!(next_cron_fire("99 99 99 99 99", after).is_none());
    }

    #[test]
    fn test_next_cron_fire_is_always_in_the_future() {
        let after = Utc.with_ymd_and_hms(2026, 3, 15, 12, 0, 0).unwrap();
        // Every hour
        let next = next_cron_fire("0 * * * *", after).unwrap();
        assert!(next > after, "next fire must be strictly after 'after'");
    }

    #[test]
    fn test_next_cron_fire_weekly_schedule() {
        // Every Monday at 09:00: "0 9 * * 1"
        let after = Utc.with_ymd_and_hms(2026, 4, 21, 10, 0, 0).unwrap(); // Tuesday
        let next = next_cron_fire("0 9 * * 1", after).unwrap();
        // Next Monday must be >= 6 days away
        let diff_days = (next - after).num_days();
        assert!(diff_days >= 5, "weekly schedule should fire ~7 days later, got {} days", diff_days);
        assert_eq!(next.hour(), 9);
    }
}
