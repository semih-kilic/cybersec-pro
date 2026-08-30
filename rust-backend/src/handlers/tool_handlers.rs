use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use std::time::Duration;
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::models::Tool;
use crate::AppState;
use crate::services::cache::keys;

// â”€â”€ Pure helpers (testable without DB) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// Human-readable display name for a tool group ID.
pub fn tool_group_display_name(group: &str) -> &str {
    match group {
        "web"           => "Web Application Security",
        "forensics"     => "Digital Forensics",
        "recon"         => "Reconnaissance & OSINT",
        "password"      => "Password & GPU",
        "vulnerability" => "Vulnerability Analysis",
        "wireless"      => "Wireless Security",
        "hardware"      => "Hardware Attacks",
        "network"       => "Network & Sniffing",
        "windows"       => "Windows Resources",
        "reversing"     => "Reverse Engineering",
        "defense"       => "Defense & Detection",
        "post-exploit"  => "Post-Exploitation",
        "crypto"        => "Cryptography & Steganography",
        "reporting"     => "Reporting",
        "exploitation"  => "Exploitation",
        "social"        => "Social Engineering",
        "voip"          => "VoIP Security",
        "database"      => "Database Security",
        "misc"          => "Miscellaneous",
        other           => other,
    }
}

/// Clamps and computes `(page, per_page, offset)` from raw query params.
/// - `page` is 1-based, minimum 1.
/// - `per_page` is capped at 200, defaults to 50.
#[allow(dead_code)] // Public pagination helper covered by tests; awaiting wire-up in tool list endpoint.
pub fn tool_page_params(page: Option<u32>, per_page: Option<u32>) -> (u32, u32, u32) {
    let page = page.unwrap_or(1).max(1);
    let per_page = per_page.unwrap_or(50).min(200);
    let offset = (page - 1) * per_page;
    (page, per_page, offset)
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct ToolQuery {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
    pub category: Option<String>,
    pub group: Option<String>,
    pub search: Option<String>,
    pub plan: Option<String>,
    pub tool_type: Option<String>,
}

// â”€â”€ List Tools â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub async fn list_tools(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Query(q): Query<ToolQuery>,
) -> impl IntoResponse {
    let page = q.page.unwrap_or(1).max(1);
    let per_page = q.per_page.unwrap_or(50).min(200);
    let offset = (page - 1) * per_page;

    // Build cache key
    let cache_key = keys::tools_list(page, per_page, q.search.as_deref());
    
    // Try cache first
    if let Ok(Some(cached)) = state.cache.get(&cache_key).await {
        if let Ok(parsed) = serde_json::from_str(&cached) {
            return Json(parsed);
        }
        // Cache corruption — invalidate and continue
        tracing::warn!("Corrupted tool cache entry, regenerating");
        let _ = state.cache.delete(&cache_key).await;
    }

    // Get user's plan for informational purposes (no longer filters tools)
    let org_plan = if let Some(ref org_id) = auth.org_id {
        let row: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = $1")
            .bind(org_id)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);
        row.map(|r| r.0).unwrap_or_else(|| "trial".into())
    } else {
        "trial".into()
    };
    let _user_plan_level = crate::services::plan::get_plan_level(&org_plan);

    // Build dynamic WHERE clause with PostgreSQL $N placeholders
    // All tools are accessible to all plans â€” no plan-based filtering
    let mut where_clauses = vec!["is_active = TRUE".to_string()];
    let mut bind_values: Vec<String> = vec![];
    let mut param_idx = 0usize;

    if let Some(ref cat) = q.category {
        param_idx += 1;
        let p1 = param_idx;
        param_idx += 1;
        let p2 = param_idx;
        where_clauses.push(format!("(business_category = ${p1} OR category = ${p2})"));
        bind_values.push(cat.clone());
        bind_values.push(cat.clone());
    }
    if let Some(ref group) = q.group {
        param_idx += 1;
        where_clauses.push(format!("tool_group = ${param_idx}"));
        bind_values.push(group.clone());
    }
    if let Some(ref search) = q.search {
        let pattern = format!("%{search}%");
        param_idx += 1;
        let p1 = param_idx;
        param_idx += 1;
        let p2 = param_idx;
        param_idx += 1;
        let p3 = param_idx;
        param_idx += 1;
        let p4 = param_idx;
        where_clauses.push(format!("(name LIKE ${p1} OR business_name LIKE ${p2} OR description LIKE ${p3} OR business_description LIKE ${p4})"));
        bind_values.push(pattern.clone());
        bind_values.push(pattern.clone());
        bind_values.push(pattern.clone());
        bind_values.push(pattern.clone());
    }
    if let Some(ref tt) = q.tool_type {
        param_idx += 1;
        where_clauses.push(format!("tool_type = ${param_idx}"));
        bind_values.push(tt.clone());
    }

    let where_sql = where_clauses.join(" AND ");
    let count_sql = format!("SELECT COUNT(*) FROM tools WHERE {}", where_sql);
    let limit_p = param_idx + 1;
    let offset_p = param_idx + 2;
    let query_sql = format!("SELECT * FROM tools WHERE {} ORDER BY name LIMIT ${limit_p} OFFSET ${offset_p}", where_sql);

    // Build count query
    let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
    for v in &bind_values {
        count_q = count_q.bind(v);
    }
    let total: (i64,) = count_q.fetch_one(&state.db).await.unwrap_or((0,));

    // Build data query
    let mut data_q = sqlx::query_as::<_, Tool>(&query_sql);
    for v in &bind_values {
        data_q = data_q.bind(v);
    }
    data_q = data_q.bind(per_page as i64).bind(offset as i64);
    let tools: Vec<Tool> = data_q.fetch_all(&state.db).await.unwrap_or_default();

    let response: Vec<_> = tools.iter().map(|t| t.to_response()).collect();

    let json_response = json!({
        "tools": response,
        "total": total.0,
        "total_tools": total.0,
        "page": page,
        "per_page": per_page,
        "pages": (total.0 as f64 / per_page as f64).ceil() as i64
    });

    // Cache the response
    let _ = state.cache.set(&cache_key, &json_response.to_string(), Duration::from_secs(300)).await;

    Json(json_response)
}

// â”€â”€ Get Tool â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub async fn get_tool(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(tool_id): Path<String>,
) -> impl IntoResponse {
    let tool: Option<Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE (id = $1 OR name = $2 OR business_name = $3) AND is_active = TRUE"
    )
    .bind(&tool_id)
    .bind(&tool_id)
    .bind(&tool_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    match tool {
        Some(t) => (StatusCode::OK, Json(json!({"tool": t.to_detail_response()}))).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Tool not found"}))).into_response(),
    }
}

// â”€â”€ Tool Count â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// Public endpoint â€” used by the landing page so it must NOT require auth.
pub async fn tools_count(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Try cache first
    let cache_key = keys::tools_count();
    if let Ok(Some(cached)) = state.cache.get(&cache_key).await {
        if let Ok(parsed) = serde_json::from_str(&cached) {
            return Json(parsed);
        }
        tracing::warn!("Corrupted tool count cache entry, regenerating");
        let _ = state.cache.delete(&cache_key).await;
    }

    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools WHERE is_active = TRUE")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    let by_category: Vec<(String, i64)> = sqlx::query_as(
        "SELECT category, COUNT(*) FROM tools WHERE is_active = TRUE GROUP BY category"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let categories_total = by_category.len() as i64;
    let categories: serde_json::Map<String, serde_json::Value> = by_category
        .into_iter()
        .map(|(cat, count)| (cat, json!(count)))
        .collect();

    // Real trial duration from canonical PlanConfig (no hardcoded value).
    let trial_days = crate::services::plan::get_plan_configs()
        .get("trial")
        .map(|p| p.trial_days)
        .unwrap_or(0);

    // All plans now have access to all tools
    let total_tools = total.0;

    let json_response = json!({
        "total": total_tools,
        "categories_total": categories_total,
        "trial_days": trial_days,
        "by_category": categories,
        "plans": {
            "trial": total_tools,
            "starter": total_tools,
            "professional": total_tools,
            "team": total_tools,
            "enterprise": total_tools,
        }
    });

    // Cache the response
    let _ = state.cache.set(&cache_key, &json_response.to_string(), Duration::from_secs(300)).await;

    Json(json_response)
}

// â”€â”€ Tool Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub async fn tool_health(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(tool_id): Path<String>,
) -> impl IntoResponse {
    let tool: Option<Tool> = sqlx::query_as("SELECT * FROM tools WHERE (id = $1 OR name = $2) AND is_active = TRUE")
        .bind(&tool_id)
        .bind(&tool_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let tool = match tool {
        Some(t) => t,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "Tool not found"}))).into_response(),
    };

    let binary = tool.binary_name.as_deref().unwrap_or(&tool.name);
    let result = crate::services::tool_health_checker::check_tool_health_enhanced(
        &state.db, &tool.id, binary, None,
    ).await;

    (StatusCode::OK, Json(json!({
        "tool": tool.name,
        "tool_id": tool.id,
        "installed": result.installed,
        "version": result.version,
        "status": result.status,
        "runtime_ok": result.runtime_ok,
        "runtime_output": result.runtime_output,
        "response_time_ms": result.response_time_ms,
        "error_message": result.error_message,
        "last_health_check": tool.last_health_check,
    }))).into_response()
}

// â”€â”€ All Tools Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub async fn all_tools_health(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
) -> impl IntoResponse {
    // Use cached health_status from tools table (updated by daily background check)
    let tools: Vec<(String, String, Option<String>, Option<String>, Option<chrono::DateTime<chrono::Utc>>)> = sqlx::query_as(
        "SELECT id, name, health_status, version, last_health_check FROM tools WHERE is_active = TRUE AND tool_type = 'cli'"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let healthy = tools.iter().filter(|t| t.2.as_deref() == Some("healthy")).count();
    let degraded = tools.iter().filter(|t| t.2.as_deref() == Some("degraded")).count();
    let unhealthy = tools.iter().filter(|t| t.2.as_deref() == Some("unhealthy")).count();
    let not_installed = tools.iter().filter(|t| t.2.as_deref() == Some("not_installed")).count();
    let unchecked = tools.iter().filter(|t| t.2.is_none()).count();

    let results: Vec<_> = tools.iter().map(|(id, name, status, version, last_check)| {
        json!({
            "id": id,
            "name": name,
            "health_status": status.as_deref().unwrap_or("unchecked"),
            "version": version,
            "last_health_check": last_check,
        })
    }).collect();

    Json(json!({
        "total": tools.len(),
        "healthy": healthy,
        "degraded": degraded,
        "unhealthy": unhealthy,
        "not_installed": not_installed,
        "unchecked": unchecked,
        "tools": results
    }))
}

// â”€â”€ Tools Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub async fn tools_stats(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
) -> impl IntoResponse {
    // Try cache first
    let cache_key = keys::tools_count();
    if let Ok(Some(cached)) = state.cache.get(&cache_key).await {
        if let Ok(val) = serde_json::from_str(&cached) {
            return Json(val);
        }
        // Corrupted cache entry — delete and continue
        let _ = state.cache.delete(&cache_key).await;
    }

    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools WHERE is_active = TRUE")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    let cli: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools WHERE tool_type = 'cli' AND is_active = TRUE")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    let gui: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools WHERE gui_required = TRUE AND is_active = TRUE")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    Json(json!({
        "total": total.0,
        "cli_tools": cli.0,
        "gui_tools": gui.0,
        "framework_tools": total.0 - cli.0 - gui.0
    }))
}

// â”€â”€ Available Tools (plan-filtered) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub async fn available_tools(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    // Get user's org plan
    let org_plan: Option<(String,)> = if let Some(org_id) = &auth.org_id {
        sqlx::query_as("SELECT plan_type FROM organizations WHERE id = $1")
            .bind(org_id)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None)
    } else {
        None
    };

    let plan = org_plan.map(|p| p.0).unwrap_or_else(|| "trial".to_string());
    let plan_level = crate::services::plan::get_plan_level(&plan);

    let tools: Vec<Tool> = sqlx::query_as("SELECT * FROM tools WHERE is_active = TRUE ORDER BY name")
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    let available: Vec<_> = tools.iter()
        .filter(|t| {
            let required = t.plan_required.as_deref().unwrap_or("starter");
            crate::services::plan::get_plan_level(required) <= plan_level
        })
        .map(|t| t.to_response())
        .collect();

    Json(json!({
        "tools": available,
        "total": available.len(),
        "plan": plan
    }))
}

// â”€â”€ Business Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub async fn business_categories(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
) -> impl IntoResponse {
    let categories: Vec<(String, i64)> = sqlx::query_as(
        "SELECT COALESCE(business_category, 'other') as cat, COUNT(*) FROM tools WHERE is_active = TRUE GROUP BY cat ORDER BY cat"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let result: Vec<_> = categories.iter().map(|(cat, count)| {
        json!({
            "id": cat,
            "name": cat.replace('_', " "),
            "tool_count": count
        })
    }).collect();

    Json(json!({"categories": result}))
}

// â”€â”€ Business Category Tools â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub async fn business_category_tools(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(category_id): Path<String>,
) -> impl IntoResponse {
    let tools: Vec<Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE (business_category = $1 OR category = $2) AND is_active = TRUE ORDER BY name"
    )
    .bind(&category_id)
    .bind(&category_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let response: Vec<_> = tools.iter().map(|t| t.to_response()).collect();

    Json(json!({
        "category": category_id,
        "tools": response,
        "total": response.len()
    }))
}

// â”€â”€ Tool Groups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub async fn tool_groups(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
) -> impl IntoResponse {
    let groups: Vec<(String, i64)> = sqlx::query_as(
        "SELECT COALESCE(tool_group, 'misc') as grp, COUNT(*) FROM tools WHERE is_active = TRUE GROUP BY grp ORDER BY COUNT(*) DESC"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let result: Vec<_> = groups.iter().map(|(grp, count)| {
        json!({
            "id": grp,
            "name": tool_group_display_name(grp.as_str()),
            "tool_count": count
        })
    }).collect();

    let total: i64 = groups.iter().map(|(_, c)| c).sum();

    Json(json!({
        "groups": result,
        "total": total
    }))
}

// â”€â”€ Group Tools â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub async fn group_tools(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(group_id): Path<String>,
) -> impl IntoResponse {
    let tools: Vec<Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE tool_group = $1 AND is_active = TRUE ORDER BY name"
    )
    .bind(&group_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let response: Vec<_> = tools.iter().map(|t| t.to_response()).collect();

    Json(json!({
        "group": group_id,
        "tools": response,
        "total": response.len()
    }))
}

// â”€â”€ Search Tools â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub async fn search_tools(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Query(q): Query<ToolQuery>,
) -> impl IntoResponse {
    let search = q.search.unwrap_or_default();
    if search.is_empty() {
        return Json(json!({"tools": [], "total": 0}));
    }
    let pattern = format!("%{search}%");

    let tools: Vec<Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE is_active = TRUE AND (name LIKE $1 OR business_name LIKE $2 OR description LIKE $3 OR binary_name LIKE $4) ORDER BY name LIMIT 50"
    )
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let response: Vec<_> = tools.iter().map(|t| t.to_response()).collect();

    Json(json!({
        "tools": response,
        "total": response.len()
    }))
}

#[cfg(test)]
mod tests {
    use super::{tool_group_display_name, tool_page_params};

    // â”€â”€ tool_group_display_name â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    #[test]
    fn tool_group_display_name_returns_correct_label_for_all_known_groups() {
        assert_eq!(tool_group_display_name("web"),           "Web Application Security");
        assert_eq!(tool_group_display_name("forensics"),     "Digital Forensics");
        assert_eq!(tool_group_display_name("recon"),         "Reconnaissance & OSINT");
        assert_eq!(tool_group_display_name("password"),      "Password & GPU");
        assert_eq!(tool_group_display_name("vulnerability"), "Vulnerability Analysis");
        assert_eq!(tool_group_display_name("wireless"),      "Wireless Security");
        assert_eq!(tool_group_display_name("hardware"),      "Hardware Attacks");
        assert_eq!(tool_group_display_name("network"),       "Network & Sniffing");
        assert_eq!(tool_group_display_name("windows"),       "Windows Resources");
        assert_eq!(tool_group_display_name("reversing"),     "Reverse Engineering");
        assert_eq!(tool_group_display_name("defense"),       "Defense & Detection");
        assert_eq!(tool_group_display_name("post-exploit"),  "Post-Exploitation");
        assert_eq!(tool_group_display_name("crypto"),        "Cryptography & Steganography");
        assert_eq!(tool_group_display_name("reporting"),     "Reporting");
        assert_eq!(tool_group_display_name("exploitation"),  "Exploitation");
        assert_eq!(tool_group_display_name("social"),        "Social Engineering");
        assert_eq!(tool_group_display_name("voip"),          "VoIP Security");
        assert_eq!(tool_group_display_name("database"),      "Database Security");
        assert_eq!(tool_group_display_name("misc"),          "Miscellaneous");
    }

    #[test]
    fn tool_group_display_name_echoes_unknown_group_id() {
        assert_eq!(tool_group_display_name("custom-group"), "custom-group");
        assert_eq!(tool_group_display_name(""), "");
        assert_eq!(tool_group_display_name("iot"), "iot");
    }

    // â”€â”€ tool_page_params â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    #[test]
    fn tool_page_params_defaults_when_none() {
        let (page, per_page, offset) = tool_page_params(None, None);
        assert_eq!(page, 1);
        assert_eq!(per_page, 50);
        assert_eq!(offset, 0);
    }

    #[test]
    fn tool_page_params_first_page_has_zero_offset() {
        let (page, per_page, offset) = tool_page_params(Some(1), Some(20));
        assert_eq!(page, 1);
        assert_eq!(per_page, 20);
        assert_eq!(offset, 0);
    }

    #[test]
    fn tool_page_params_second_page_offset_equals_per_page() {
        let (page, per_page, offset) = tool_page_params(Some(2), Some(20));
        assert_eq!(page, 2);
        assert_eq!(per_page, 20);
        assert_eq!(offset, 20);
    }

    #[test]
    fn tool_page_params_third_page_correct_offset() {
        let (_page, _per_page, offset) = tool_page_params(Some(3), Some(25));
        assert_eq!(offset, 50);
    }

    #[test]
    fn tool_page_params_clamps_page_zero_to_one() {
        let (page, _per_page, offset) = tool_page_params(Some(0), None);
        assert_eq!(page, 1);
        assert_eq!(offset, 0);
    }

    #[test]
    fn tool_page_params_caps_per_page_at_200() {
        let (_page, per_page, _offset) = tool_page_params(None, Some(500));
        assert_eq!(per_page, 200);
    }

    #[test]
    fn tool_page_params_per_page_at_exactly_200_is_accepted() {
        let (_page, per_page, _offset) = tool_page_params(None, Some(200));
        assert_eq!(per_page, 200);
    }

    #[test]
    fn tool_page_params_per_page_zero_has_zero_offset() {
        let (_page, per_page, offset) = tool_page_params(None, Some(0));
        assert_eq!(per_page, 0);
        assert_eq!(offset, 0);
    }
}

// ── Run Health Check (on-demand) ──────────────────────────

pub async fn run_health_check(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
) -> impl IntoResponse {
    let results = crate::services::tool_health_checker::run_full_health_check(&state.db).await;
    
    let healthy = results.iter().filter(|r| r.status == "healthy").count();
    let degraded = results.iter().filter(|r| r.status == "degraded").count();
    let unhealthy = results.iter().filter(|r| r.status == "unhealthy").count();
    let not_installed = results.iter().filter(|r| r.status == "not_installed").count();

    Json(json!({
        "total": results.len(),
        "healthy": healthy,
        "degraded": degraded,
        "unhealthy": unhealthy,
        "not_installed": not_installed,
        "results": results.iter().map(|r| json!({
            "tool_id": r.tool_id,
            "status": r.status,
            "version": r.version,
            "runtime_ok": r.runtime_ok,
            "response_time_ms": r.response_time_ms,
            "error_message": r.error_message,
        })).collect::<Vec<_>>(),
    }))
}

// ── Tool Health History ───────────────────────────────────

pub async fn tool_health_history(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(tool_id): Path<String>,
) -> impl IntoResponse {
    let history = sqlx::query_as::<_, crate::models::tool::ToolHealthCheck>(
        "SELECT id, tool_id, check_type, status, installed, version, runtime_ok, \
         runtime_output, dependency_ok, dependency_output, response_time_ms, \
         error_message, checked_at \
         FROM tool_health_checks \
         WHERE tool_id = $1 \
         ORDER BY checked_at DESC \
         LIMIT 50"
    )
    .bind(&tool_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(json!({
        "tool_id": tool_id,
        "history": history.iter().map(|h| json!({
            "id": h.id,
            "status": h.status,
            "version": h.version,
            "runtime_ok": h.runtime_ok,
            "response_time_ms": h.response_time_ms,
            "checked_at": h.checked_at,
        })).collect::<Vec<_>>(),
    }))
}


