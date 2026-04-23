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

    // NOTE: Query parameter token support intentionally removed — tokens in URLs
    // appear in server logs, browser history, and Referer headers (security risk).

    None
}

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

/// Analyst or higher auth check (analyst, admin, superadmin)
pub struct AnalystUser(pub AuthUser);

#[async_trait]
impl FromRequestParts<Arc<AppState>> for AnalystUser
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &Arc<AppState>) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;

        if !matches!(user.role.as_str(), "analyst" | "admin" | "superadmin") {
            return Err((StatusCode::FORBIDDEN, Json(serde_json::json!({"error": "Analyst access required"}))).into_response());
        }

        Ok(AnalystUser(user))
    }
}

/// Role hierarchy for permission checks.
/// superadmin > admin > analyst > user > viewer
pub fn role_level(role: &str) -> u8 {
    match role {
        "superadmin" => 5,
        "admin" => 4,
        "analyst" => 3,
        "user" => 2,
        "viewer" => 1,
        _ => 0,
    }
}

/// Check if a role has at least the required permission level.
pub fn has_role_access(user_role: &str, required_role: &str) -> bool {
    role_level(user_role) >= role_level(required_role)
}

/// Valid roles for the system
pub const VALID_ROLES: [&str; 5] = ["viewer", "user", "analyst", "admin", "superadmin"];

#[cfg(test)]
mod tests {
    use super::{has_role_access, role_level, VALID_ROLES};

    // ── role_level ─────────────────────────────────────────────────────

    #[test]
    fn role_level_returns_correct_level_for_all_roles() {
        assert_eq!(role_level("superadmin"), 5);
        assert_eq!(role_level("admin"), 4);
        assert_eq!(role_level("analyst"), 3);
        assert_eq!(role_level("user"), 2);
        assert_eq!(role_level("viewer"), 1);
    }

    #[test]
    fn role_level_returns_zero_for_unknown_role() {
        assert_eq!(role_level("unknown"), 0);
        assert_eq!(role_level(""), 0);
        assert_eq!(role_level("ADMIN"), 0); // case-sensitive
    }

    #[test]
    fn role_level_ordering_is_monotonically_increasing() {
        assert!(role_level("viewer") < role_level("user"));
        assert!(role_level("user") < role_level("analyst"));
        assert!(role_level("analyst") < role_level("admin"));
        assert!(role_level("admin") < role_level("superadmin"));
    }

    // ── has_role_access ───────────────────────────────────────────────

    #[test]
    fn has_role_access_allows_same_role() {
        assert!(has_role_access("viewer", "viewer"));
        assert!(has_role_access("admin", "admin"));
        assert!(has_role_access("superadmin", "superadmin"));
    }

    #[test]
    fn has_role_access_allows_higher_role() {
        assert!(has_role_access("superadmin", "viewer"));
        assert!(has_role_access("admin", "user"));
        assert!(has_role_access("analyst", "viewer"));
    }

    #[test]
    fn has_role_access_rejects_lower_role() {
        assert!(!has_role_access("viewer", "user"));
        assert!(!has_role_access("user", "analyst"));
        assert!(!has_role_access("analyst", "admin"));
        assert!(!has_role_access("admin", "superadmin"));
    }

    #[test]
    fn has_role_access_unknown_role_cannot_access_anything() {
        assert!(!has_role_access("unknown", "viewer"));
        assert!(!has_role_access("", "viewer"));
    }

    // ── VALID_ROLES ──────────────────────────────────────────────────

    #[test]
    fn valid_roles_contains_all_five_system_roles() {
        assert!(VALID_ROLES.contains(&"viewer"));
        assert!(VALID_ROLES.contains(&"user"));
        assert!(VALID_ROLES.contains(&"analyst"));
        assert!(VALID_ROLES.contains(&"admin"));
        assert!(VALID_ROLES.contains(&"superadmin"));
        assert_eq!(VALID_ROLES.len(), 5);
    }

    #[test]
    fn valid_roles_does_not_contain_unknown_roles() {
        assert!(!VALID_ROLES.contains(&"guest"));
        assert!(!VALID_ROLES.contains(&"superuser"));
        assert!(!VALID_ROLES.contains(&"ADMIN"));
    }

    #[test]
    fn every_valid_role_has_nonzero_level() {
        for role in VALID_ROLES.iter() {
            assert!(role_level(role) > 0, "role '{}' should have nonzero level", role);
        }
    }
}
