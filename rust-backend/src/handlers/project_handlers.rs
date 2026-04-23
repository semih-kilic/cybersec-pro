use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::models::Project;
use crate::AppState;

// ── Pure helpers (testable without DB) ─────────────────────────────────────

/// Returns the default project target type when none is provided.
pub fn default_project_target_type(provided: Option<&str>) -> &str {
    provided.unwrap_or("web")
}

/// Returns `true` when the project count has reached the plan limit.
/// A `max_projects` of 0 means unlimited.
pub fn is_over_project_limit(count: i64, max_projects: i64) -> bool {
    max_projects > 0 && count >= max_projects
}

/// Builds the plan-limit-reached error message.
pub fn format_project_limit_error(count: i64, max: i64) -> String {
    format!("Project limit reached ({}/{}). Upgrade your plan.", count, max)
}

pub async fn list_projects(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let projects: Vec<Project> = sqlx::query_as(
        "SELECT * FROM projects WHERE organization_id = $1 ORDER BY created_at DESC"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let response: Vec<_> = projects.iter().map(|p| p.to_response()).collect();
    (StatusCode::OK, Json(json!({"projects": response}))).into_response()
}

#[derive(Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    pub target_type: Option<String>,
    pub target_url: Option<String>,
    pub target_ip: Option<String>,
}

pub async fn create_project(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CreateProjectRequest>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    // Check max_projects plan limit
    let org_plan: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = $1")
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    let plan = org_plan.map(|p| p.0).unwrap_or_else(|| "trial".into());
    let plan_configs = crate::services::plan::get_plan_configs();
    if let Some(config) = plan_configs.get(plan.as_str()) {
        if config.max_projects > 0 {
            let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM projects WHERE organization_id = $1")
                .bind(org_id)
                .fetch_one(&state.db)
                .await
                .unwrap_or((0,));
            if is_over_project_limit(count.0, config.max_projects as i64) {
                return (StatusCode::PAYMENT_REQUIRED, Json(json!({
                    "error": format_project_limit_error(count.0, config.max_projects as i64)
                }))).into_response();
            }
        }
    }

    let result: Result<(i32,), _> = sqlx::query_as(
        "INSERT INTO projects (organization_id, name, description, target_type, target_url, target_ip) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id"
    )
    .bind(org_id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(default_project_target_type(body.target_type.as_deref()))
    .bind(&body.target_url)
    .bind(&body.target_ip)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok((new_id,)) => (StatusCode::CREATED, Json(json!({
            "message": "Project created",
            "project": {
                "id": new_id,
                "name": body.name
            }
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

pub async fn get_project(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(project_id): Path<i64>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let project: Option<Project> = sqlx::query_as(
        "SELECT * FROM projects WHERE id = $1 AND organization_id = $2"
    )
    .bind(project_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    match project {
        Some(p) => (StatusCode::OK, Json(json!({"project": p.to_response()}))).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Project not found"}))).into_response(),
    }
}

pub async fn delete_project(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(project_id): Path<i64>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let _ = sqlx::query("DELETE FROM projects WHERE id = $1 AND organization_id = $2")
        .bind(project_id)
        .bind(org_id)
        .execute(&state.db)
        .await;

    Json(json!({"message": "Project deleted"})).into_response()
}

#[cfg(test)]
mod tests {
    use super::{default_project_target_type, format_project_limit_error, is_over_project_limit};

    // ── default_project_target_type ─────────────────────────────────────────

    #[test]
    fn default_project_target_type_returns_web_when_none() {
        assert_eq!(default_project_target_type(None), "web");
    }

    #[test]
    fn default_project_target_type_returns_provided_value() {
        assert_eq!(default_project_target_type(Some("api")), "api");
        assert_eq!(default_project_target_type(Some("mobile")), "mobile");
        assert_eq!(default_project_target_type(Some("network")), "network");
    }

    // ── is_over_project_limit ───────────────────────────────────────────────

    #[test]
    fn is_over_project_limit_false_when_max_is_zero_unlimited() {
        assert!(!is_over_project_limit(100, 0));
        assert!(!is_over_project_limit(0, 0));
    }

    #[test]
    fn is_over_project_limit_false_when_below_limit() {
        assert!(!is_over_project_limit(4, 5));
        assert!(!is_over_project_limit(0, 5));
    }

    #[test]
    fn is_over_project_limit_true_at_limit() {
        assert!(is_over_project_limit(5, 5));
    }

    #[test]
    fn is_over_project_limit_true_above_limit() {
        assert!(is_over_project_limit(6, 5));
    }

    // ── format_project_limit_error ──────────────────────────────────────────

    #[test]
    fn format_project_limit_error_includes_count_and_max() {
        let msg = format_project_limit_error(5, 5);
        assert!(msg.contains("5/5"), "expected '5/5' in: {msg}");
        assert!(msg.contains("Upgrade"), "expected 'Upgrade' in: {msg}");
    }

    #[test]
    fn format_project_limit_error_includes_exact_values() {
        let msg = format_project_limit_error(3, 10);
        assert!(msg.contains("3/10"), "expected '3/10' in: {msg}");
    }
}
