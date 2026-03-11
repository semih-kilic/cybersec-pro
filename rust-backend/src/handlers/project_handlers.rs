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

pub async fn list_projects(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let projects: Vec<Project> = sqlx::query_as(
        "SELECT * FROM projects WHERE organization_id = ? ORDER BY created_at DESC"
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

    let result = sqlx::query(
        "INSERT INTO projects (organization_id, name, description, target_type, target_url, target_ip) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(org_id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.target_type.as_deref().unwrap_or("web"))
    .bind(&body.target_url)
    .bind(&body.target_ip)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) => (StatusCode::CREATED, Json(json!({
            "message": "Project created",
            "project": {
                "id": r.last_insert_rowid(),
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
        "SELECT * FROM projects WHERE id = ? AND organization_id = ?"
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

    let _ = sqlx::query("DELETE FROM projects WHERE id = ? AND organization_id = ?")
        .bind(project_id)
        .bind(org_id)
        .execute(&state.db)
        .await;

    Json(json!({"message": "Project deleted"}))
}
