use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};

/// JWT claims structure (must match Flask backend)
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,        // user ID
    pub email: Option<String>,
    pub role: Option<String>,
    pub exp: usize,
    pub iat: usize,
}

/// JWT authentication middleware
pub async fn auth_middleware(
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
    let jwt_secret = std::env::var("JWT_SECRET_KEY")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let _claims = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    Ok(next.run(request).await)
}
