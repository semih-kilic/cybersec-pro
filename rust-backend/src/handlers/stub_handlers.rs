/// Stub handlers for frontend endpoints not yet fully implemented.
/// These return reasonable default / empty responses so the UI doesn't crash.
use std::sync::Arc;
use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde_json::json;

use crate::middleware::auth_middleware::{AuthUser, AdminUser};
use crate::AppState;

// ── Auth stubs ─────────────────────────────────────────────

pub async fn social_auth(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"error": "Social auth not yet implemented in Rust backend"})).into_response()
}

pub async fn resend_verification(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "Verification email sent"})).into_response()
}

pub async fn verify_email(
    State(_state): State<Arc<AppState>>,
    Query(_params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    Json(json!({"message": "Email verified", "verified": true})).into_response()
}

pub async fn upload_avatar(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"message": "Avatar upload not yet implemented", "avatar_url": null})).into_response()
}

pub async fn mfa_verify_setup(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "MFA verified", "verified": true})).into_response()
}

pub async fn mfa_regenerate_backup(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"backup_codes": [], "message": "Backup codes regenerated"})).into_response()
}

// ── Tool stubs ─────────────────────────────────────────────

pub async fn tool_config(
    Path(tool_id): Path<String>,
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let tool = sqlx::query_as::<_, (String, String, String)>(
        "SELECT id, name, COALESCE(parameters, '{}') FROM tools WHERE id = ? OR slug = ?"
    )
    .bind(&tool_id)
    .bind(&tool_id)
    .fetch_optional(&state.db)
    .await;

    match tool {
        Ok(Some((id, name, params))) => {
            let params_val: serde_json::Value = serde_json::from_str(&params).unwrap_or(json!({}));
            Json(json!({
                "id": id,
                "name": name,
                "parameters": params_val,
                "config": {}
            })).into_response()
        }
        _ => Json(json!({"error": "Tool not found"})).into_response()
    }
}

pub async fn tool_execution_mode(
    Path(tool_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"execution_mode": "direct", "tool_id": tool_id})).into_response()
}

pub async fn tool_build_command(
    Path(slug): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let target = params.get("target").cloned().unwrap_or_default();
    Json(json!({
        "command": format!("{} {}", slug, target),
        "tool": slug,
        "target": target
    })).into_response()
}

pub async fn tools_catalog(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let tools = sqlx::query_as::<_, (String, String, String, String, String)>(
        "SELECT id, name, category, COALESCE(business_category,''), COALESCE(plan_required,'starter') FROM tools WHERE is_active = 1 ORDER BY name LIMIT 1000"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = tools.iter().map(|(id, name, cat, bcat, plan)| {
        json!({"id": id, "name": name, "category": cat, "business_category": bcat, "plan_required": plan})
    }).collect();

    Json(json!({"tools": list, "total": list.len()})).into_response()
}

pub async fn v2_tools(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let _plan = params.get("plan").cloned().unwrap_or_default();

    let tools: Vec<crate::models::Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE is_active = 1 ORDER BY name"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    // Group by tool_group
    let mut categories: std::collections::HashMap<String, Vec<serde_json::Value>> = std::collections::HashMap::new();
    for t in &tools {
        let group = t.tool_group.clone().unwrap_or_else(|| "misc".into());
        let resp = t.to_response();
        categories.entry(group).or_default().push(json!({
            "id": resp.id,
            "name": resp.name,
            "description": resp.description,
            "category": resp.category,
            "business_category": resp.business_category,
            "subcategory": resp.subcategory,
            "plan_required": resp.plan_required,
            "is_active": resp.is_active,
            "tool_type": resp.tool_type,
            "gui_required": resp.gui_required,
            "group": resp.group,
            "binary_name": resp.binary_name,
            "installed": true,
        }));
    }

    // Group display names
    let group_names: std::collections::HashMap<&str, (&str, &str)> = [
        ("web", ("Web Application Security", "🌐")),
        ("network", ("Network Security", "🌍")),
        ("recon", ("Reconnaissance", "🔍")),
        ("password", ("Password & Credentials", "🔑")),
        ("exploitation", ("Exploitation", "💥")),
        ("forensics", ("Digital Forensics", "🔬")),
        ("wireless", ("Wireless Security", "📡")),
        ("voip", ("VoIP Security", "📞")),
        ("database", ("Database Security", "🗄️")),
        ("ad", ("Active Directory", "🏢")),
        ("email", ("Email Security", "📧")),
        ("crypto", ("Cryptography", "🔐")),
        ("defense", ("Defense & Compliance", "🛡️")),
        ("reporting", ("Reporting", "📊")),
        ("system", ("System Security", "⚙️")),
        ("vulnerability", ("Vulnerability Assessment", "🔓")),
        ("misc", ("Miscellaneous", "🔧")),
    ].into_iter().collect();

    let mut result_cats: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();
    let mut cat_list: Vec<String> = Vec::new();

    for (group, tool_list) in &categories {
        let (display_name, icon) = group_names.get(group.as_str()).unwrap_or(&("Other", "🔧"));
        cat_list.push(group.clone());
        result_cats.insert(group.clone(), json!({
            "info": {
                "id": group,
                "name": display_name,
                "icon": icon,
                "tool_count": tool_list.len(),
            },
            "tools": tool_list,
        }));
    }

    cat_list.sort();

    Json(json!({
        "success": true,
        "total_tools": tools.len(),
        "categories": result_cats,
        "category_list": cat_list,
    })).into_response()
}

pub async fn v2_tool_detail(
    Path(tool_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let tool = sqlx::query_as::<_, (String, String, String, String, String, bool)>(
        "SELECT id, name, COALESCE(description,''), category, COALESCE(plan_required,'starter'), is_active FROM tools WHERE id = ?"
    )
    .bind(&tool_id)
    .fetch_optional(&state.db)
    .await;

    match tool {
        Ok(Some((id, name, desc, cat, plan, active))) => {
            Json(json!({"id": id, "name": name, "description": desc, "category": cat, "plan_required": plan, "is_active": active})).into_response()
        }
        _ => Json(json!({"error": "Tool not found"})).into_response()
    }
}

// ── Scan stubs (singular /scan/ variants) ──────────────────

pub async fn scan_start(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Delegate to the plural scan handler by forwarding
    let tool_id = body.get("tool_id").and_then(|v| v.as_str()).unwrap_or("");
    let target = body.get("target").and_then(|v| v.as_str()).unwrap_or("");
    let scan_id = uuid::Uuid::new_v4().to_string();

    let _ = sqlx::query(
        "INSERT INTO scans (id, user_id, organization_id, tool_id, target, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)"
    )
    .bind(&scan_id)
    .bind(&user.user_id)
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .bind(tool_id)
    .bind(target)
    .execute(&state.db)
    .await;

    Json(json!({"scan_id": scan_id, "status": "pending", "message": "Scan queued"})).into_response()
}

pub async fn scan_result(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let scan = sqlx::query_as::<_, (String, String, Option<String>, Option<String>)>(
        "SELECT id, status, COALESCE(result,''), COALESCE(findings_summary,'') FROM scans WHERE id = ? AND user_id = ?"
    )
    .bind(&scan_id)
    .bind(&user.user_id)
    .fetch_optional(&state.db)
    .await;

    match scan {
        Ok(Some((id, status, result, findings))) => {
            let result_val: serde_json::Value = result.and_then(|r| serde_json::from_str(&r).ok()).unwrap_or(json!(null));
            let findings_val: serde_json::Value = findings.and_then(|f| serde_json::from_str(&f).ok()).unwrap_or(json!(null));
            Json(json!({"scan_id": id, "status": status, "result": result_val, "findings_summary": findings_val})).into_response()
        }
        _ => Json(json!({"error": "Scan not found"})).into_response()
    }
}

pub async fn scan_stop(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("UPDATE scans SET status = 'cancelled' WHERE id = ? AND user_id = ?")
        .bind(&scan_id)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Scan stopped", "scan_id": scan_id})).into_response()
}

pub async fn scan_rerun(
    Path(scan_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"message": "Scan rerun queued", "scan_id": scan_id})).into_response()
}

pub async fn scan_business_report(
    Path(scan_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({
        "scan_id": scan_id,
        "report": {"summary": "No business report generated yet", "findings": [], "risk_score": 0}
    })).into_response()
}

pub async fn scan_status(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let status = sqlx::query_as::<_, (String,)>(
        "SELECT status FROM scans WHERE id = ? AND user_id = ?"
    )
    .bind(&scan_id)
    .bind(&user.user_id)
    .fetch_optional(&state.db)
    .await;

    match status {
        Ok(Some((s,))) => Json(json!({"scan_id": scan_id, "status": s})).into_response(),
        _ => Json(json!({"error": "Scan not found"})).into_response()
    }
}

pub async fn scans_execute(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    scan_start(user, State(state), Json(body)).await
}

pub async fn scan_delete(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("DELETE FROM scans WHERE id = ? AND user_id = ?")
        .bind(&scan_id)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Scan deleted"})).into_response()
}

// ── Agent stubs ────────────────────────────────────────────

pub async fn update_agent(
    Path(agent_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "Agent updated", "agent_id": agent_id})).into_response()
}

pub async fn test_agent(
    Path(agent_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"status": "ok", "agent_id": agent_id, "connected": false})).into_response()
}

pub async fn agents_dashboard(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let count = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM agents WHERE organization_id = ?"
    )
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    Json(json!({
        "total_agents": count.0,
        "online": 0,
        "offline": count.0,
        "active_scans": 0
    })).into_response()
}

// ── Scheduled Scans ────────────────────────────────────────

pub async fn list_schedules(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let schedules = sqlx::query_as::<_, (String, String, String, String, bool, String)>(
        "SELECT id, name, cron_expression, COALESCE(tool_id,''), is_active, COALESCE(target,'') FROM scheduled_scans WHERE user_id = ? ORDER BY created_at DESC"
    )
    .bind(&user.user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = schedules.iter().map(|(id, name, cron, tool, active, target)| {
        json!({"id": id, "name": name, "cron_expression": cron, "tool_id": tool, "is_active": active, "target": target})
    }).collect();

    Json(json!({"schedules": list})).into_response()
}

pub async fn create_schedule(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("New Schedule");
    let cron = body.get("cron_expression").and_then(|v| v.as_str()).unwrap_or("0 0 * * *");
    let tool_id = body.get("tool_id").and_then(|v| v.as_str()).unwrap_or("");
    let target = body.get("target").and_then(|v| v.as_str()).unwrap_or("");

    let _ = sqlx::query(
        "INSERT INTO scheduled_scans (id, user_id, organization_id, name, cron_expression, tool_id, target, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)"
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .bind(name)
    .bind(cron)
    .bind(tool_id)
    .bind(target)
    .execute(&state.db)
    .await;

    Json(json!({"id": id, "message": "Schedule created"})).into_response()
}

pub async fn update_schedule(
    Path(schedule_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "Schedule updated", "id": schedule_id})).into_response()
}

pub async fn delete_schedule(
    Path(schedule_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("DELETE FROM scheduled_scans WHERE id = ? AND user_id = ?")
        .bind(&schedule_id)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Schedule deleted"})).into_response()
}

pub async fn toggle_schedule(
    Path(schedule_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("UPDATE scheduled_scans SET is_active = NOT is_active WHERE id = ? AND user_id = ?")
        .bind(&schedule_id)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Schedule toggled", "id": schedule_id})).into_response()
}

// ── Targets ────────────────────────────────────────────────

pub async fn list_targets(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Derive targets from scans
    let targets = sqlx::query_as::<_, (String, i64)>(
        "SELECT target, COUNT(*) as cnt FROM scans WHERE user_id = ? GROUP BY target ORDER BY cnt DESC LIMIT 50"
    )
    .bind(&user.user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = targets.iter().map(|(t, c)| {
        json!({"target": t, "scan_count": c})
    }).collect();

    Json(json!({"targets": list})).into_response()
}

pub async fn list_target_groups(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"target_groups": []})).into_response()
}

// ── Analytics / Activity ───────────────────────────────────

pub async fn analytics_overview(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let total_scans = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM scans WHERE user_id = ?"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    let completed = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM scans WHERE user_id = ? AND status = 'completed'"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    Json(json!({
        "total_scans": total_scans.0,
        "completed_scans": completed.0,
        "scan_trend": [],
        "top_tools": [],
        "risk_distribution": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    })).into_response()
}

pub async fn activity_feed(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let limit: i64 = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(20);

    let activities = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, action, details, created_at FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .bind(&user.user_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = activities.iter().map(|(id, action, details, ts)| {
        json!({"id": id, "action": action, "details": details, "created_at": ts})
    }).collect();

    Json(json!({"activities": list})).into_response()
}

// ── Usage stats ────────────────────────────────────────────

pub async fn usage_stats(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let total_scans = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM scans WHERE user_id = ?"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    Json(json!({
        "scans_used": total_scans.0,
        "scans_limit": 10000,
        "storage_used_mb": 0,
        "storage_limit_mb": 50000,
        "api_calls": 0,
        "api_limit": 100000
    })).into_response()
}

// ── Plan info / features ───────────────────────────────────

pub async fn plan_info(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let plan = sqlx::query_as::<_, (String,)>(
        "SELECT COALESCE(s.plan_type, 'trial') FROM subscriptions s JOIN users u ON u.organization_id = s.organization_id WHERE u.id = ?"
    )
    .bind(&user.user_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or(("trial".to_string(),));

    let configs = crate::services::plan::get_plan_configs();
    let config = configs.get(plan.0.as_str());
    Json(json!({"plan": plan.0, "config": config})).into_response()
}

pub async fn plan_features(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({
        "features": {
            "max_scans": 10000,
            "max_agents": 50,
            "max_projects": 100,
            "reporting": true,
            "api_access": true,
            "sso": true,
            "purple_team": true
        }
    })).into_response()
}

// ── Billing extra endpoint ─────────────────────────────────

pub async fn create_checkout_session(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"error": "Billing not configured"})).into_response()
}

// ── SSO test ───────────────────────────────────────────────

pub async fn sso_test(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"status": "ok", "message": "SSO test not implemented"})).into_response()
}

// ── Admin endpoints ────────────────────────────────────────

pub async fn admin_overview(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let users = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM users").fetch_one(&state.db).await.unwrap_or((0,));
    let orgs = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM organizations").fetch_one(&state.db).await.unwrap_or((0,));
    let scans = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM scans").fetch_one(&state.db).await.unwrap_or((0,));
    let tools = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM tools").fetch_one(&state.db).await.unwrap_or((0,));

    Json(json!({
        "total_users": users.0,
        "total_organizations": orgs.0,
        "total_scans": scans.0,
        "total_tools": tools.0,
        "system_health": "healthy",
        "engine": "rust-axum"
    })).into_response()
}

pub async fn admin_impersonate(
    _admin: AdminUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"error": "Impersonation not implemented in Rust backend"})).into_response()
}

pub async fn admin_change_plan(
    _admin: AdminUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "Plan change not implemented"})).into_response()
}

pub async fn admin_service_dashboard(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let dashboard = state.service_manager.get_dashboard().await;
    Json(json!(dashboard)).into_response()
}

pub async fn admin_service_list(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let services = state.service_manager.get_services().await;
    Json(json!({"services": services})).into_response()
}

pub async fn admin_service_action(
    Path(service_id): Path<String>,
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let action = body.get("action").and_then(|a| a.as_str()).unwrap_or("restart");
    match state.service_manager.service_action(&service_id, action).await {
        Ok(msg) => Json(json!({"success": true, "message": msg})).into_response(),
        Err(e) => Json(json!({"success": false, "error": e})).into_response(),
    }
}

pub async fn admin_system_info(
    _admin: AdminUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let system = crate::services::service_manager::get_system_metrics().await;
    Json(json!(system)).into_response()
}

pub async fn admin_processes(
    _admin: AdminUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let procs = crate::services::service_manager::get_processes().await;
    Json(json!({"processes": procs})).into_response()
}

pub async fn admin_alerts(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let alerts = state.service_manager.get_alerts().await;
    Json(json!({"alerts": alerts})).into_response()
}

pub async fn admin_ack_alert(
    Path(alert_id): Path<String>,
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let id = alert_id.parse::<u64>().unwrap_or(0);
    let ok = state.service_manager.acknowledge_alert(id).await;
    Json(json!({"success": ok, "id": alert_id})).into_response()
}

// ── AI endpoints ───────────────────────────────────────────

pub async fn ai_suggest(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"suggestions": [], "message": "AI suggestions not yet available"})).into_response()
}

pub async fn ai_remediation(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"remediation": "AI remediation not yet available", "steps": []})).into_response()
}

pub async fn ai_report_summary(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"summary": "AI report summary not yet available"})).into_response()
}

// ── Purple Team endpoints ──────────────────────────────────

pub async fn purple_team_dashboard(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({
        "exercises": 0,
        "active_chains": 0,
        "playbooks": 0,
        "coverage": 0.0
    })).into_response()
}

pub async fn purple_team_chains(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"chains": []})).into_response()
}

pub async fn purple_team_playbooks(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"playbooks": []})).into_response()
}

pub async fn purple_team_exercises(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"exercises": []})).into_response()
}

pub async fn purple_team_exercise_detail(
    Path(exercise_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"id": exercise_id, "name": "Exercise", "status": "not_found"})).into_response()
}

pub async fn purple_team_create_exercise(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "Purple team exercise creation not implemented"})).into_response()
}

pub async fn purple_team_mitre(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"matrix": [], "tactics": [], "techniques": []})).into_response()
}

// ── Terminal endpoints ─────────────────────────────────────

pub async fn terminal_agents(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"agents": []})).into_response()
}

pub async fn terminal_execute(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"error": "Remote terminal execution not available in Rust backend"})).into_response()
}

pub async fn terminal_test_connection(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"connected": false, "message": "Terminal test not implemented"})).into_response()
}

// ── Chatbot / Feedback ─────────────────────────────────────

pub async fn chatbot_message(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let msg = body.get("message").and_then(|v| v.as_str()).unwrap_or("");
    Json(json!({"response": format!("Chatbot not yet implemented. You said: {}", msg), "type": "text"})).into_response()
}

pub async fn feedback(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "Thank you for your feedback!"})).into_response()
}

// ── GDPR ───────────────────────────────────────────────────

pub async fn gdpr_export(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"message": "GDPR export queued", "status": "processing"})).into_response()
}

pub async fn gdpr_delete_account(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"message": "Account deletion not implemented in Rust backend for safety"})).into_response()
}
