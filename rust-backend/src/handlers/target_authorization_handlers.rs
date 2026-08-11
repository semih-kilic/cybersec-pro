use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::services::target_authorization::{self, AuthConfirmation};
use crate::AppState;

#[derive(Deserialize)]
pub struct AuthorizeTargetRequest {
    pub target: String,
    pub confirmed: bool,
    pub scope_statement: String,
}

/// Canonical statement + version the UI must display for the confirmation checkbox.
pub async fn authorization_statement() -> impl IntoResponse {
    Json(json!({
        "statement_version": target_authorization::SCOPE_STATEMENT_VERSION,
    }))
}

/// Build the exact canonical statement for a target so the UI shows verbatim
/// what the user is confirming.
pub async fn preview_statement(
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let target = body.get("target").and_then(|v| v.as_str()).unwrap_or("").trim();
    if target.is_empty() || target.len() > 500 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Valid target required"}))).into_response();
    }
    Json(json!({
        "target": target,
        "target_type": target_authorization::classify_target(target).as_str(),
        "scope_statement": target_authorization::canonical_statement(target),
        "statement_version": target_authorization::SCOPE_STATEMENT_VERSION,
    }))
    .into_response()
}

pub async fn list_authorizations(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());
    match target_authorization::list_authorizations(&state.db, &org_id).await {
        Ok(items) => Json(json!({"authorizations": items})).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e}))).into_response(),
    }
}

pub async fn authorize_target(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    headers: HeaderMap,
    Json(body): Json<AuthorizeTargetRequest>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());
    let target = body.target.trim().to_string();
    if target.is_empty() || target.len() > 500 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Valid target required"}))).into_response();
    }
    let confirmation = AuthConfirmation {
        confirmed: body.confirmed,
        scope_statement: body.scope_statement,
    };
    match target_authorization::authorize_and_check(
        &state.db,
        &org_id,
        &auth.user_id,
        &target,
        Some(&confirmation),
        Some(&headers),
    )
    .await
    {
        Ok((authz_id, statement, version)) => Json(json!({
            "id": authz_id,
            "target": target,
            "scope_statement": statement,
            "statement_version": version,
            "message": "Target authorized",
        }))
        .into_response(),
        Err(e) => (StatusCode::FORBIDDEN, Json(json!({"error": e}))).into_response(),
    }
}

pub async fn revoke_authorization(
    Path(authz_id): Path<String>,
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());
    match target_authorization::revoke_authorization(&state.db, &org_id, &auth.user_id, &authz_id).await {
        Ok(()) => Json(json!({"message": "Authorization revoked"})).into_response(),
        Err(e) => (StatusCode::NOT_FOUND, Json(json!({"error": e}))).into_response(),
    }
}
