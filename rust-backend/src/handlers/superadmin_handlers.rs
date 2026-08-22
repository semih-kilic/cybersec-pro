// Superadmin God Mode handlers — realtime system telemetry, database
// statistics, log tailing, feature-flag toggles and the kill switch.
//
// Every endpoint is gated by `SuperAdminUser` (role == "superadmin"). All
// state-mutating actions emit an audit log entry.

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sysinfo::{Disks, Networks, System};

use crate::middleware::auth_middleware::SuperAdminUser;
use crate::services::audit;
use crate::AppState;

// ── Realtime telemetry (CPU/RAM/Disk/Net) ───────────────────────────────────

/// GET /api/v1/superadmin/telemetry — single snapshot of system metrics.
pub async fn telemetry(_su: SuperAdminUser, State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    let mut sys = System::new_all();
    sys.refresh_all();
    // Two reads for accurate CPU sampling.
    std::thread::sleep(std::time::Duration::from_millis(120));
    sys.refresh_cpu();

    let cpus = sys.cpus();
    let cpu_usage_avg: f32 =
        if cpus.is_empty() { 0.0 } else { cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / cpus.len() as f32 };

    let total_mem = sys.total_memory();
    let used_mem = sys.used_memory();
    let total_swap = sys.total_swap();
    let used_swap = sys.used_swap();

    let disks_handle = Disks::new_with_refreshed_list();
    let mut disks: Vec<Value> = Vec::with_capacity(disks_handle.list().len());
    let mut total_disk = 0u64;
    let mut used_disk = 0u64;
    for d in disks_handle.list() {
        let total = d.total_space();
        let avail = d.available_space();
        let used = total.saturating_sub(avail);
        total_disk += total;
        used_disk += used;
        disks.push(json!({
            "name": d.name().to_string_lossy(),
            "mount": d.mount_point().to_string_lossy(),
            "fs": String::from_utf8_lossy(d.file_system().as_encoded_bytes()),
            "total_bytes": total,
            "available_bytes": avail,
            "used_bytes": used,
            "usage_pct": if total == 0 { 0.0 } else { (used as f64 / total as f64) * 100.0 },
        }));
    }

    let nets_handle = Networks::new_with_refreshed_list();
    let mut net_rx = 0u64;
    let mut net_tx = 0u64;
    let mut interfaces: Vec<Value> = Vec::new();
    for (name, data) in nets_handle.list() {
        net_rx += data.received();
        net_tx += data.transmitted();
        interfaces.push(json!({
            "name": name,
            "received_bytes_total": data.total_received(),
            "transmitted_bytes_total": data.total_transmitted(),
            "received_bytes_window": data.received(),
            "transmitted_bytes_window": data.transmitted(),
        }));
    }

    let load = System::load_average();

    Json(json!({
        "host": {
            "name": System::host_name(),
            "os": System::long_os_version(),
            "kernel": System::kernel_version(),
            "uptime_secs": System::uptime(),
            "boot_time": System::boot_time(),
        },
        "cpu": {
            "usage_pct": cpu_usage_avg,
            "core_count": cpus.len(),
            "physical_core_count": sys.physical_core_count(),
            "load_avg_1": load.one,
            "load_avg_5": load.five,
            "load_avg_15": load.fifteen,
            "per_core": cpus.iter().map(|c| json!({
                "name": c.name(),
                "usage_pct": c.cpu_usage(),
                "frequency_mhz": c.frequency(),
            })).collect::<Vec<Value>>(),
        },
        "memory": {
            "total_bytes": total_mem,
            "used_bytes": used_mem,
            "available_bytes": total_mem.saturating_sub(used_mem),
            "usage_pct": if total_mem == 0 { 0.0 } else { (used_mem as f64 / total_mem as f64) * 100.0 },
            "swap_total_bytes": total_swap,
            "swap_used_bytes": used_swap,
        },
        "disk": {
            "total_bytes": total_disk,
            "used_bytes": used_disk,
            "usage_pct": if total_disk == 0 { 0.0 } else { (used_disk as f64 / total_disk as f64) * 100.0 },
            "devices": disks,
        },
        "network": {
            "received_bytes_window": net_rx,
            "transmitted_bytes_window": net_tx,
            "interfaces": interfaces,
        },
        "process": {
            "count": sys.processes().len(),
        },
    })).into_response()
}

// ── Database statistics ─────────────────────────────────────────────────────

/// GET /api/v1/superadmin/db-stats — table sizes, connection pool, slow queries.
pub async fn db_stats(_su: SuperAdminUser, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    // Per-table sizes (only the public schema).
    let sizes: Vec<(String, i64, i64)> = sqlx::query_as(
        r#"
        SELECT
            relname::text                                                          AS table_name,
            COALESCE(pg_total_relation_size(relid), 0)::bigint                     AS total_bytes,
            COALESCE(n_live_tup, 0)::bigint                                        AS live_rows
        FROM pg_stat_user_tables
        ORDER BY total_bytes DESC
        LIMIT 50
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let tables: Vec<Value> = sizes.into_iter().map(|(name, bytes, rows)| json!({
        "name": name,
        "size_bytes": bytes,
        "row_count": rows,
    })).collect();

    let db_size: Option<(i64,)> = sqlx::query_as(
        "SELECT pg_database_size(current_database())::bigint",
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let conn_count: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM pg_stat_activity WHERE datname = current_database()",
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let active_queries: Vec<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        r#"
        SELECT state, query, CAST(query_start AS TEXT)
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND state != 'idle'
          AND pid != pg_backend_pid()
        ORDER BY query_start ASC NULLS LAST
        LIMIT 25
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(json!({
        "database_size_bytes": db_size.map(|(b,)| b).unwrap_or(0),
        "active_connections": conn_count.map(|(c,)| c).unwrap_or(0),
        "pool_size": state.db.size(),
        "pool_idle": state.db.num_idle(),
        "tables": tables,
        "active_queries": active_queries.into_iter().map(|(state, query, started)| json!({
            "state": state,
            "query": query.map(|q| q.chars().take(500).collect::<String>()),
            "started_at": started,
        })).collect::<Vec<_>>(),
    })).into_response()
}

// ── Logs (journalctl tail) ─────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LogsQuery {
    #[serde(default = "default_lines")]
    pub lines: usize,
    pub unit: Option<String>,
}
fn default_lines() -> usize { 200 }

/// GET /api/v1/superadmin/logs — tail of `journalctl -u <unit>`.
pub async fn logs(
    _su: SuperAdminUser,
    State(_state): State<Arc<AppState>>,
    Query(q): Query<LogsQuery>,
) -> impl IntoResponse {
    let unit = q.unit.as_deref().unwrap_or("cybersec-rust.service");
    let lines = q.lines.min(2000).max(1);

    let output = tokio::process::Command::new("journalctl")
        .args([
            "-u", unit,
            "-n", &lines.to_string(),
            "--no-pager",
            "--output=short-iso",
        ])
        .output()
        .await;

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).to_string();
            let stderr = String::from_utf8_lossy(&o.stderr).to_string();
            Json(json!({
                "unit": unit,
                "lines": lines,
                "stdout": stdout,
                "stderr": if stderr.is_empty() { None } else { Some(stderr) },
            })).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("journalctl exec failed: {e}")})),
        ).into_response(),
    }
}

// ── Feature flags ───────────────────────────────────────────────────────────

/// GET /api/v1/superadmin/feature-flags — list all flags.
pub async fn list_feature_flags(_su: SuperAdminUser, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let rows: Vec<(String, bool, Option<String>, String, String)> = sqlx::query_as(
        r#"
        SELECT key, enabled, description,
               CAST(updated_at AS TEXT),
               CAST(created_at AS TEXT)
        FROM feature_flags
        ORDER BY key ASC
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let flags: Vec<Value> = rows.into_iter().map(|(key, enabled, desc, updated, created)| json!({
        "key": key,
        "enabled": enabled,
        "description": desc,
        "updated_at": updated,
        "created_at": created,
    })).collect();

    Json(json!({"flags": flags})).into_response()
}

#[derive(Deserialize)]
pub struct FlagBody {
    pub enabled: bool,
    pub description: Option<String>,
}

/// PUT /api/v1/superadmin/feature-flags/:key — upsert a flag.
pub async fn upsert_feature_flag(
    su: SuperAdminUser,
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
    Json(body): Json<FlagBody>,
) -> impl IntoResponse {
    if key.trim().is_empty() || key.len() > 100 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "invalid flag key"}))).into_response();
    }

    let res = sqlx::query(
        r#"
        INSERT INTO feature_flags (key, enabled, description, updated_at, created_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (key) DO UPDATE
            SET enabled = EXCLUDED.enabled,
                description = COALESCE(EXCLUDED.description, feature_flags.description),
                updated_at = NOW()
        "#,
    )
    .bind(&key)
    .bind(body.enabled)
    .bind(&body.description)
    .execute(&state.db)
    .await;

    if let Err(e) = res {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response();
    }

    audit::log_audit(
        &state.db,
        "feature_flag_changed",
        "superadmin",
        if body.enabled { "info" } else { "warning" },
        Some(&su.0.user_id),
        su.0.org_id.as_deref(),
        Some(json!({"key": &key, "enabled": body.enabled, "description": &body.description})),
        Some("feature_flag"),
        Some(&key),
        "success",
        None,
    ).await;

    Json(json!({"key": key, "enabled": body.enabled})).into_response()
}

// ── Kill switch ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct KillSwitchBody {
    pub engaged: bool,
    pub reason: Option<String>,
}

/// POST /api/v1/superadmin/kill-switch — flip the platform-wide kill switch.
///
/// When engaged, the `platform_kill_switch` flag is set; middleware can read
/// this flag to refuse non-superadmin requests on subsequent calls.
pub async fn kill_switch(
    su: SuperAdminUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<KillSwitchBody>,
) -> impl IntoResponse {
    let res = sqlx::query(
        r#"
        INSERT INTO feature_flags (key, enabled, description, updated_at, created_at)
        VALUES ('platform_kill_switch', $1, $2, NOW(), NOW())
        ON CONFLICT (key) DO UPDATE
            SET enabled = EXCLUDED.enabled,
                description = EXCLUDED.description,
                updated_at = NOW()
        "#,
    )
    .bind(body.engaged)
    .bind(body.reason.clone().unwrap_or_else(|| {
        if body.engaged { "Engaged via God Mode".into() } else { "Disengaged via God Mode".into() }
    }))
    .execute(&state.db)
    .await;

    if let Err(e) = res {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response();
    }

    audit::log_audit(
        &state.db,
        if body.engaged { "kill_switch_engaged" } else { "kill_switch_released" },
        "superadmin",
        if body.engaged { "critical" } else { "warning" },
        Some(&su.0.user_id),
        su.0.org_id.as_deref(),
        Some(json!({"engaged": body.engaged, "reason": body.reason})),
        Some("kill_switch"),
        None,
        "success",
        None,
    ).await;

    Json(json!({
        "engaged": body.engaged,
        "reason": body.reason,
    })).into_response()
}

/// GET /api/v1/superadmin/kill-switch — current state.
pub async fn kill_switch_status(_su: SuperAdminUser, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let row: Option<(bool, Option<String>, String)> = sqlx::query_as(
        "SELECT enabled, description, CAST(updated_at AS TEXT) FROM feature_flags WHERE key = 'platform_kill_switch'",
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    Json(match row {
        Some((engaged, reason, updated)) => json!({
            "engaged": engaged,
            "reason": reason,
            "updated_at": updated,
        }),
        None => json!({"engaged": false}),
    }).into_response()
}

// ── Organizations & plan management ─────────────────────────────────────────

#[derive(Deserialize)]
pub struct OrgListQuery {
    pub q: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/v1/superadmin/organizations — list orgs with member counts.
pub async fn list_organizations(
    _su: SuperAdminUser,
    State(state): State<Arc<AppState>>,
    Query(q): Query<OrgListQuery>,
) -> impl IntoResponse {
    let limit = q.limit.unwrap_or(200).clamp(1, 1000);
    let needle = q.q.as_deref().map(|s| format!("%{}%", s.to_lowercase()));

    let rows = match needle {
        Some(n) => sqlx::query_as::<_, (String, String, String, Option<String>, bool, chrono::NaiveDateTime, i64, Option<String>)>(
            r#"
            SELECT o.id, o.name, o.slug, o.plan_type, o.is_active, o.created_at,
                   COALESCE((SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id), 0) AS member_count,
                   (SELECT u.email FROM users u WHERE u.organization_id = o.id ORDER BY u.created_at ASC LIMIT 1) AS owner_email
            FROM organizations o
            WHERE LOWER(o.name) LIKE $1 OR LOWER(o.slug) LIKE $1
               OR EXISTS (SELECT 1 FROM users u WHERE u.organization_id = o.id AND LOWER(u.email) LIKE $1)
            ORDER BY o.created_at DESC
            LIMIT $2
            "#
        ).bind(&n).bind(limit).fetch_all(&state.db).await,
        None => sqlx::query_as::<_, (String, String, String, Option<String>, bool, chrono::NaiveDateTime, i64, Option<String>)>(
            r#"
            SELECT o.id, o.name, o.slug, o.plan_type, o.is_active, o.created_at,
                   COALESCE((SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id), 0) AS member_count,
                   (SELECT u.email FROM users u WHERE u.organization_id = o.id ORDER BY u.created_at ASC LIMIT 1) AS owner_email
            FROM organizations o
            ORDER BY o.created_at DESC
            LIMIT $1
            "#
        ).bind(limit).fetch_all(&state.db).await,
    };

    let rows = match rows {
        Ok(r) => r,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    };

    let plans = crate::services::plan::get_plan_configs();
    let mut available_plans: Vec<String> = plans.keys().map(|k| (*k).to_string()).collect();
    available_plans.sort();

    let items: Vec<Value> = rows.into_iter().map(|r| {
        json!({
            "id": r.0,
            "name": r.1,
            "slug": r.2,
            "plan_type": r.3.unwrap_or_else(|| "starter".into()),
            "is_active": r.4,
            "created_at": r.5.and_utc().to_rfc3339(),
            "member_count": r.6,
            "owner_email": r.7,
        })
    }).collect();

    let count = items.len();
    Json(json!({
        "organizations": items,
        "available_plans": available_plans,
        "count": count,
    })).into_response()
}

#[derive(Deserialize)]
pub struct ChangePlanBody {
    pub plan_type: String,
    pub reason: Option<String>,
}

/// PUT /api/v1/superadmin/organizations/:org_id/plan — change an org's plan.
pub async fn change_org_plan(
    su: SuperAdminUser,
    State(state): State<Arc<AppState>>,
    Path(org_id): Path<String>,
    Json(body): Json<ChangePlanBody>,
) -> impl IntoResponse {
    let plans = crate::services::plan::get_plan_configs();
    if !plans.contains_key(body.plan_type.as_str()) {
        let valid: Vec<String> = plans.keys().map(|k| (*k).to_string()).collect();
        return (StatusCode::BAD_REQUEST, Json(json!({
            "error": "invalid plan_type",
            "valid_plans": valid,
        }))).into_response();
    }

    let prev: Option<(String, Option<String>)> = match sqlx::query_as(
        "SELECT name, plan_type FROM organizations WHERE id = $1"
    ).bind(&org_id).fetch_optional(&state.db).await {
        Ok(p) => p,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    };

    let prev = match prev {
        Some(p) => p,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "organization not found"}))).into_response(),
    };

    let res = sqlx::query("UPDATE organizations SET plan_type = $1 WHERE id = $2")
        .bind(&body.plan_type)
        .bind(&org_id)
        .execute(&state.db)
        .await;

    if let Err(e) = res {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response();
    }

    audit::log_audit(
        &state.db,
        "org_plan_changed",
        "superadmin",
        "warning",
        Some(&su.0.user_id),
        su.0.org_id.as_deref(),
        Some(json!({
            "org_id": &org_id,
            "org_name": prev.0,
            "from_plan": prev.1,
            "to_plan": &body.plan_type,
            "reason": body.reason,
        })),
        Some("organization"),
        Some(&org_id),
        "success",
        None,
    ).await;

    Json(json!({
        "organization_id": org_id,
        "previous_plan": prev.1,
        "plan_type": body.plan_type,
    })).into_response()
}


// ── Founding Member offer control ───────────────────────────────────────────

use crate::handlers::billing_handlers::{founding_availability, FOUNDING_MEMBER_FLAG, FOUNDING_MEMBER_SPOTS};

/// GET /api/v1/superadmin/founding-member — offer status + spot usage.
pub async fn founding_member_status(_su: SuperAdminUser, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let (enabled, claimed) = founding_availability(&state.db).await;
    Json(json!({
        "flag": FOUNDING_MEMBER_FLAG,
        "enabled": enabled,
        "claimed": claimed,
        "total_spots": FOUNDING_MEMBER_SPOTS,
        "remaining": (FOUNDING_MEMBER_SPOTS - claimed).max(0),
        "available": enabled && claimed < FOUNDING_MEMBER_SPOTS,
    }))
}

#[derive(Deserialize)]
pub struct FoundingMemberBody {
    pub enabled: bool,
    pub reason: Option<String>,
}

/// PUT /api/v1/superadmin/founding-member — manually open/close the offer.
pub async fn set_founding_member(
    su: SuperAdminUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<FoundingMemberBody>,
) -> impl IntoResponse {
    let res = sqlx::query(
        r#"
        INSERT INTO feature_flags (key, enabled, description, updated_at, created_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (key) DO UPDATE
            SET enabled = EXCLUDED.enabled,
                description = COALESCE(EXCLUDED.description, feature_flags.description),
                updated_at = NOW()
        "#,
    )
    .bind(FOUNDING_MEMBER_FLAG)
    .bind(body.enabled)
    .bind(Some("Founding Member 10-spot lifetime-deal offer"))
    .execute(&state.db)
    .await;

    if let Err(e) = res {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response();
    }

    audit::log_audit(
        &state.db,
        "founding_member_toggled",
        "superadmin",
        if body.enabled { "info" } else { "warning" },
        Some(&su.0.user_id),
        su.0.org_id.as_deref(),
        Some(json!({"enabled": body.enabled, "reason": &body.reason})),
        Some("feature_flag"),
        Some(FOUNDING_MEMBER_FLAG),
        "success",
        None,
    ).await;

    let (_, claimed) = founding_availability(&state.db).await;
    Json(json!({
        "flag": FOUNDING_MEMBER_FLAG,
        "enabled": body.enabled,
        "claimed": claimed,
        "total_spots": FOUNDING_MEMBER_SPOTS,
        "available": body.enabled && claimed < FOUNDING_MEMBER_SPOTS,
    })).into_response()
}
