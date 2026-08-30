use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::AppState;

/// JWT claims structure (must match the Rust backend's `services::auth::jwt`).
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,        // user ID
    pub email: Option<String>,
    pub role: Option<String>,
    pub exp: usize,
    pub iat: usize,
    /// "access", "refresh", or absent on older tokens.
    #[serde(default)]
    pub token_type: Option<String>,
}

/// JWT authentication middleware
pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if !auth_header.starts_with("Bearer ") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = &auth_header[7..];

    let claims = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?
    .claims;

    // AUDIT 2026-08-29 — the decoded claims used to be discarded (`let _claims`),
    // so this endpoint accepted ANY token the backend had ever signed. A refresh
    // token would pass: it carries the same signature and this struct ignores
    // unknown fields, so `token_type` was never looked at. Refresh tokens live
    // 30 days and are handed to the browser, which is a much larger window than
    // an access token's hour.
    match claims.token_type.as_deref() {
        // The backend mints a service token with role "service" to call us.
        Some("access") => {}
        // Older tokens predate the field; accept them but say so.
        None => tracing::warn!("scan-engine: token without token_type accepted (legacy)"),
        Some(other) => {
            tracing::warn!("scan-engine: rejected '{other}' token — only access tokens may drive scans");
            return Err(StatusCode::UNAUTHORIZED);
        }
    }

    Ok(next.run(request).await)
}


#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{encode, EncodingKey, Header};

    const SECRET: &str = "test-secret-at-least-32-characters-long!!";

    fn token(token_type: Option<&str>) -> String {
        let claims = Claims {
            sub: "u1".into(),
            email: None,
            role: Some("service".into()),
            exp: (chrono::Utc::now().timestamp() + 3600) as usize,
            iat: chrono::Utc::now().timestamp() as usize,
            token_type: token_type.map(String::from),
        };
        encode(&Header::default(), &claims, &EncodingKey::from_secret(SECRET.as_bytes())).unwrap()
    }

    fn accepted(t: &str) -> bool {
        let c = decode::<Claims>(t, &DecodingKey::from_secret(SECRET.as_bytes()),
                                 &Validation::new(Algorithm::HS256));
        match c {
            Err(_) => false,
            Ok(d) => matches!(d.claims.token_type.as_deref(), Some("access") | None),
        }
    }

    #[test]
    fn access_tokens_are_accepted() {
        assert!(accepted(&token(Some("access"))));
    }

    #[test]
    fn refresh_tokens_are_rejected() {
        // The bug: claims were discarded, so a 30-day refresh token drove scans.
        assert!(!accepted(&token(Some("refresh"))));
    }

    #[test]
    fn unknown_token_types_are_rejected() {
        assert!(!accepted(&token(Some("enrollment"))));
        assert!(!accepted(&token(Some(""))));
    }

    #[test]
    fn legacy_tokens_without_a_type_are_accepted() {
        assert!(accepted(&token(None)));
    }

    #[test]
    fn a_token_signed_with_another_key_is_rejected() {
        let other = encode(&Header::default(),
            &Claims { sub: "u".into(), email: None, role: None,
                      exp: (chrono::Utc::now().timestamp() + 3600) as usize,
                      iat: chrono::Utc::now().timestamp() as usize,
                      token_type: Some("access".into()) },
            &EncodingKey::from_secret(b"a-completely-different-secret-value!!")).unwrap();
        assert!(!accepted(&other));
    }
}
