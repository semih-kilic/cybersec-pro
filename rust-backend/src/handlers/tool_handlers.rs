use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::models::Tool;
use crate::AppState;

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct ToolQuery {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
    pub category: Option<String>,
    pub search: Option<String>,
    pub plan: Option<String>,
}

// ── List Tools ─────────────────────────────────────────────

pub async fn list_tools(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Query(q): Query<ToolQuery>,
) -> impl IntoResponse {
    let page = q.page.unwrap_or(1).max(1);
    let per_page = q.per_page.unwrap_or(50).min(200);
    let offset = (page - 1) * per_page;

    let tools: Vec<Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE is_active = 1 ORDER BY name LIMIT ? OFFSET ?"
    )
    .bind(per_page as i64)
    .bind(offset as i64)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools WHERE is_active = 1")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    let response: Vec<_> = tools.iter().map(|t| t.to_response()).collect();

    Json(json!({
        "tools": response,
        "total": total.0,
        "page": page,
        "per_page": per_page,
        "pages": (total.0 as f64 / per_page as f64).ceil() as i64
    }))
}

// ── Get Tool ───────────────────────────────────────────────

pub async fn get_tool(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(tool_id): Path<String>,
) -> impl IntoResponse {
    let tool: Option<Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE id = ? OR name = ? OR business_name = ?"
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

// ── Tool Count ─────────────────────────────────────────────

pub async fn tools_count(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
) -> impl IntoResponse {
    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools WHERE is_active = 1")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    let by_category: Vec<(String, i64)> = sqlx::query_as(
        "SELECT COALESCE(business_category, category) as cat, COUNT(*) FROM tools WHERE is_active = 1 GROUP BY cat"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let categories: serde_json::Map<String, serde_json::Value> = by_category
        .into_iter()
        .map(|(cat, count)| (cat, json!(count)))
        .collect();

    Json(json!({
        "total": total.0,
        "by_category": categories
    }))
}

// ── Tool Health ────────────────────────────────────────────

pub async fn tool_health(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(tool_id): Path<String>,
) -> impl IntoResponse {
    let tool: Option<Tool> = sqlx::query_as("SELECT * FROM tools WHERE id = ? OR name = ?")
        .bind(&tool_id)
        .bind(&tool_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let tool = match tool {
        Some(t) => t,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "Tool not found"}))).into_response(),
    };

    // Check if binary exists
    let binary = tool.name.clone();
    let installed = tokio::process::Command::new("which")
        .arg(&binary)
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false);

    (StatusCode::OK, Json(json!({
        "tool": tool.name,
        "installed": installed,
        "status": if installed { "healthy" } else { "not_installed" }
    }))).into_response()
}

// ── All Tools Health ───────────────────────────────────────

pub async fn all_tools_health(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
) -> impl IntoResponse {
    let tools: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, name FROM tools WHERE is_active = 1 AND (tool_type = 'cli' OR tool_type IS NULL)"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut results = Vec::new();
    let mut installed = 0u32;
    let mut missing = 0u32;

    for (id, name) in &tools {
        let ok = tokio::process::Command::new("which")
            .arg(name)
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false);
        if ok { installed += 1; } else { missing += 1; }
        results.push(json!({
            "id": id,
            "name": name,
            "installed": ok
        }));
    }

    Json(json!({
        "total": tools.len(),
        "installed": installed,
        "missing": missing,
        "tools": results
    }))
}

// ── Tools Stats ────────────────────────────────────────────

pub async fn tools_stats(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
) -> impl IntoResponse {
    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools WHERE is_active = 1")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    let cli: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools WHERE tool_type = 'cli' AND is_active = 1")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    let gui: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tools WHERE gui_required = 1 AND is_active = 1")
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

// ── Available Tools (plan-filtered) ────────────────────────

pub async fn available_tools(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    // Get user's org plan
    let org_plan: Option<(String,)> = if let Some(org_id) = &auth.org_id {
        sqlx::query_as("SELECT plan_type FROM organizations WHERE id = ?")
            .bind(org_id)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None)
    } else {
        None
    };

    let plan = org_plan.map(|p| p.0).unwrap_or_else(|| "trial".to_string());
    let plan_level = crate::services::plan::get_plan_level(&plan);

    let tools: Vec<Tool> = sqlx::query_as("SELECT * FROM tools WHERE is_active = 1 ORDER BY name")
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

// ── Business Categories ────────────────────────────────────

pub async fn business_categories(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
) -> impl IntoResponse {
    let categories: Vec<(String, i64)> = sqlx::query_as(
        "SELECT COALESCE(business_category, 'other') as cat, COUNT(*) FROM tools WHERE is_active = 1 GROUP BY cat ORDER BY cat"
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

// ── Business Category Tools ────────────────────────────────

pub async fn business_category_tools(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(category_id): Path<String>,
) -> impl IntoResponse {
    let tools: Vec<Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE (business_category = ? OR category = ?) AND is_active = 1 ORDER BY name"
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
