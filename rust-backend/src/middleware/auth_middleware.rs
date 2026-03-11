use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use async_trait::async_trait;
use std::sync::Arc;

use crate::services::auth::decode_token;
use crate::AppState;

/// Authenticated user extracted from JWT (cookie or header).
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub org_id: Option<String>,
    pub role: String,
}

#[async_trait]
impl FromRequestParts<Arc<AppState>> for AuthUser
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &Arc<AppState>) -> Result<Self, Self::Rejection> {
        let jwt_secret = &state.jwt_secret;
        let token = extract_token(parts);

        let token = token.ok_or_else(|| {
            (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error": "Authentication required"}))).into_response()
        })?;

        let claims = decode_token(jwt_secret, &token).map_err(|_| {
            (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error": "Invalid or expired token"}))).into_response()
        })?;

        if claims.token_type != "access" {
            return Err((StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error": "Access token required"}))).into_response());
        }

        Ok(AuthUser {
            user_id: claims.sub,
            org_id: claims.org,
            role: claims.role,
        })
    }
}

fn extract_token(parts: &Parts) -> Option<String> {
    // 1. Try Authorization header: "Bearer <token>"
    if let Some(auth) = parts.headers.get("authorization") {
        if let Ok(auth_str) = auth.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }

    // 2. Try cookie: "access_token_cookie=<token>"
    if let Some(cookie_header) = parts.headers.get("cookie") {
        if let Ok(cookies) = cookie_header.to_str() {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if let Some(token) = cookie.strip_prefix("access_token_cookie=") {
                    return Some(token.to_string());
                }
            }
        }
    }

    // 3. Try query parameter: ?token=<token>
    if let Some(query) = parts.uri.query() {
        for pair in query.split('&') {
            if let Some(token) = pair.strip_prefix("token=") {
                return Some(token.to_string());
            }
        }
    }

    None
}

/// Helper: require admin role
pub fn auth_extractor() -> () {}

/// Admin-only auth check
pub struct AdminUser(pub AuthUser);

#[async_trait]
impl FromRequestParts<Arc<AppState>> for AdminUser
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &Arc<AppState>) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;

        if user.role != "admin" && user.role != "superadmin" {
            return Err((StatusCode::FORBIDDEN, Json(serde_json::json!({"error": "Admin access required"}))).into_response());
        }

        Ok(AdminUser(user))
    }
}
