use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthUser;
use crate::models::{User, Organization};
use crate::services::audit::log_audit;
use crate::services::auth::{
    create_access_token, create_refresh_token, hash_password, verify_password,
    generate_totp_secret, generate_totp_uri, verify_totp,
    generate_backup_codes, hash_backup_code, verify_backup_code,
};
use crate::AppState;

// ── Register ───────────────────────────────────────────────

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub organization_name: Option<String>,
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<RegisterRequest>,
) -> impl IntoResponse {
    // Rate limit check
    let ip = headers.get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    if state.rate_limiter.is_limited(&format!("register:{}", ip), 3, std::time::Duration::from_secs(60)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many registration attempts"}))).into_response();
    }

    // Validate email
    if !body.email.contains('@') || body.email.len() < 5 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Valid email required"}))).into_response();
    }

    // Validate password strength
    if body.password.len() < 8 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Password must be at least 8 characters"}))).into_response();
    }

    // Check existing
    let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM users WHERE email = $1")
        .bind(&body.email)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    if existing.is_some() {
        return (StatusCode::CONFLICT, Json(json!({"error": "Email already registered"}))).into_response();
    }

    // Create organization
    let org_id = Uuid::new_v4().to_string();
    let org_name = body.organization_name.as_deref().unwrap_or("My Organization");
    let slug = org_name.to_lowercase().replace(' ', "-");
    let slug = format!("{}-{}", slug, &org_id[..8]);

    let _ = sqlx::query(
        "INSERT INTO organizations (id, name, slug, plan_type) VALUES ($1, $2, $3, 'trial')"
    )
    .bind(&org_id)
    .bind(org_name)
    .bind(&slug)
    .execute(&state.db)
    .await;

    // Create user
    let user_id = Uuid::new_v4().to_string();
    let pw_hash = match hash_password(&body.password) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Password hashing failed"}))).into_response(),
    };

    let verification_token = Uuid::new_v4().to_string();

    let result = sqlx::query(
        "INSERT INTO users (id, email, password_hash, first_name, last_name, role, organization_id, email_verified, verification_token, verification_sent_at)
         VALUES ($1, $2, $3, $4, $5, 'admin', $6, 0, $7, CURRENT_TIMESTAMP)"
    )
    .bind(&user_id)
    .bind(&body.email)
    .bind(&pw_hash)
    .bind(&body.first_name)
    .bind(&body.last_name)
    .bind(&org_id)
    .bind(&verification_token)
    .execute(&state.db)
    .await;

    if let Err(e) = result {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Registration failed: {}", e)}))).into_response();
    }

    log_audit(&state.db, "register", "auth", "info", Some(&user_id), Some(&org_id), None, Some("user"), Some(&user_id), "success", Some(&headers)).await;

    // Generate tokens
    let access_token = create_access_token(&state.jwt_secret, &user_id, Some(&org_id), "admin").unwrap_or_default();
    let refresh_token = create_refresh_token(&state.jwt_secret, &user_id).unwrap_or_default();

    (StatusCode::CREATED, Json(json!({
        "message": "Registration successful",
        "user": {
            "id": user_id,
            "email": body.email,
            "first_name": body.first_name,
            "last_name": body.last_name,
            "role": "admin",
            "organization_id": org_id
        },
        "access_token": access_token,
        "refresh_token": refresh_token,
        "verification_required": true
    }))).into_response()
}

// ── Login ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub mfa_code: Option<String>,
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<LoginRequest>,
) -> impl IntoResponse {
    let ip = headers.get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    if state.rate_limiter.is_limited(&format!("login:{}", ip), 5, std::time::Duration::from_secs(60)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many login attempts"}))).into_response();
    }

    // Find user
    let user: Option<User> = sqlx::query_as(
        "SELECT * FROM users WHERE email = $1 AND is_active = TRUE"
    )
    .bind(&body.email)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let user = match user {
        Some(u) => u,
        None => {
            log_audit(&state.db, "login_failed", "auth", "warning", None, None, Some(json!({"email": body.email})), None, None, "failure", Some(&headers)).await;
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid email or password"}))).into_response();
        }
    };

    // Verify password
    let pw_hash = match &user.password_hash {
        Some(h) => h,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Please use OAuth to login"}))).into_response(),
    };

    if !verify_password(&body.password, pw_hash) {
        log_audit(&state.db, "login_failed", "auth", "warning", Some(&user.id), user.organization_id.as_deref(), None, Some("user"), Some(&user.id), "failure", Some(&headers)).await;
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid email or password"}))).into_response();
    }

    // Check MFA
    if user.mfa_enabled.unwrap_or(false) {
        let mfa_code = match &body.mfa_code {
            Some(c) => c,
            None => return (StatusCode::OK, Json(json!({"mfa_required": true, "message": "MFA code required"}))).into_response(),
        };

        if let Some(secret) = &user.mfa_secret {
            let valid = verify_totp(secret, mfa_code).unwrap_or(false);
            if !valid {
                // Try backup codes
                let backup_valid = if let Some(serde_json::Value::Array(codes)) = &user.mfa_backup_codes {
                    let string_codes: Vec<String> = codes.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect();
                    verify_backup_code(mfa_code, &string_codes).is_some()
                } else {
                    false
                };

                if !valid && !backup_valid {
                    return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid MFA code"}))).into_response();
                }
            }
        }
    }

    // Update last_login
    let _ = sqlx::query("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1")
        .bind(&user.id)
        .execute(&state.db)
        .await;

    let org_id = user.organization_id.as_deref();
    let role = user.role.as_deref().unwrap_or("user");

    log_audit(&state.db, "login", "auth", "info", Some(&user.id), org_id, None, Some("user"), Some(&user.id), "success", Some(&headers)).await;

    let access_token = create_access_token(&state.jwt_secret, &user.id, org_id, role).unwrap_or_default();
    let refresh_token = create_refresh_token(&state.jwt_secret, &user.id).unwrap_or_default();

    // Fetch organization for the response
    let org_response = if let Some(oid) = org_id {
        let org: Option<Organization> = sqlx::query_as("SELECT * FROM organizations WHERE id = $1")
            .bind(oid)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);
        org.map(|o| json!(o.to_response()))
    } else {
        None
    };

    (StatusCode::OK, Json(json!({
        "message": "Login successful",
        "user": user.to_response(),
        "organization": org_response,
        "access_token": access_token,
        "refresh_token": refresh_token
    }))).into_response()
}

// ── Refresh Token ──────────────────────────────────────────

pub async fn refresh(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    // Extract refresh token from cookie or header
    let token = extract_refresh_token(&headers);
    let token = match token {
        Some(t) => t,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Refresh token required"}))).into_response(),
    };

    let claims = match crate::services::auth::decode_token(&state.jwt_secret, &token) {
        Ok(c) => c,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid refresh token"}))).into_response(),
    };

    if claims.token_type != "refresh" {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid token type"}))).into_response();
    }

    // Fetch user to get current org/role
    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1 AND is_active = TRUE")
        .bind(&claims.sub)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let user = match user {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "User not found"}))).into_response(),
    };

    let org_id = user.organization_id.as_deref();
    let role = user.role.as_deref().unwrap_or("user");

    let access_token = create_access_token(&state.jwt_secret, &user.id, org_id, role).unwrap_or_default();

    (StatusCode::OK, Json(json!({
        "access_token": access_token
    }))).into_response()
}

fn extract_refresh_token(headers: &HeaderMap) -> Option<String> {
    // Cookie
    if let Some(cookie_header) = headers.get("cookie") {
        if let Ok(cookies) = cookie_header.to_str() {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if let Some(token) = cookie.strip_prefix("refresh_token_cookie=") {
                    return Some(token.to_string());
                }
            }
        }
    }
    // Header
    if let Some(auth) = headers.get("authorization") {
        if let Ok(s) = auth.to_str() {
            if let Some(token) = s.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }
    None
}

// ── Logout ─────────────────────────────────────────────────

pub async fn logout(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    headers: HeaderMap,
) -> impl IntoResponse {
    log_audit(&state.db, "logout", "auth", "info", Some(&auth.user_id), auth.org_id.as_deref(), None, Some("user"), Some(&auth.user_id), "success", Some(&headers)).await;
    Json(json!({"message": "Logged out successfully"})).into_response()
}

// ── Get Current User ───────────────────────────────────────

pub async fn me(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(&auth.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    match user {
        Some(u) => {
            let org_response = if let Some(ref oid) = u.organization_id {
                let org: Option<Organization> = sqlx::query_as("SELECT * FROM organizations WHERE id = $1")
                    .bind(oid)
                    .fetch_optional(&state.db)
                    .await
                    .unwrap_or(None);
                org.map(|o| json!(o.to_response()))
            } else {
                None
            };
            (StatusCode::OK, Json(json!({"user": u.to_response(), "organization": org_response}))).into_response()
        },
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    }
}

// ── Update Profile ─────────────────────────────────────────

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

pub async fn update_profile(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<UpdateProfileRequest>,
) -> impl IntoResponse {
    let _ = sqlx::query("UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name) WHERE id = $3")
        .bind(&body.first_name)
        .bind(&body.last_name)
        .bind(&auth.user_id)
        .execute(&state.db)
        .await;

    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(&auth.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    match user {
        Some(u) => Json(json!({"user": u.to_response()})),
        None => Json(json!({"error": "User not found"})),
    }
}

// ── MFA Setup ──────────────────────────────────────────────

pub async fn mfa_setup(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(&auth.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let user = match user {
        Some(u) => u,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    };

    if user.mfa_enabled.unwrap_or(false) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "MFA already enabled"}))).into_response();
    }

    let secret = generate_totp_secret();
    let uri = generate_totp_uri(&secret, &user.email).unwrap_or_default();

    // Store secret temporarily
    let _ = sqlx::query("UPDATE users SET mfa_secret = $1 WHERE id = $2")
        .bind(&secret)
        .bind(&auth.user_id)
        .execute(&state.db)
        .await;

    (StatusCode::OK, Json(json!({
        "secret": secret,
        "uri": uri,
        "message": "Scan QR code with authenticator app, then verify"
    }))).into_response()
}

// ── MFA Verify (Enable) ───────────────────────────────────

#[derive(Deserialize)]
pub struct MfaVerifyRequest {
    pub code: String,
}

pub async fn mfa_verify(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    headers: HeaderMap,
    Json(body): Json<MfaVerifyRequest>,
) -> impl IntoResponse {
    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(&auth.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let user = match user {
        Some(u) => u,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    };

    let secret = match &user.mfa_secret {
        Some(s) => s,
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "MFA not set up"}))).into_response(),
    };

    if !verify_totp(secret, &body.code).unwrap_or(false) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid MFA code"}))).into_response();
    }

    // Generate backup codes
    let backup_codes = generate_backup_codes();
    let hashed_codes: Vec<String> = backup_codes.iter().map(|c| hash_backup_code(c)).collect();
    let codes_json = serde_json::to_string(&hashed_codes).unwrap_or_default();

    let _ = sqlx::query("UPDATE users SET mfa_enabled = TRUE, mfa_backup_codes = $1, mfa_enabled_at = CURRENT_TIMESTAMP WHERE id = $2")
        .bind(&codes_json)
        .bind(&auth.user_id)
        .execute(&state.db)
        .await;

    log_audit(&state.db, "mfa_enable", "security", "info", Some(&auth.user_id), auth.org_id.as_deref(), None, Some("user"), Some(&auth.user_id), "success", Some(&headers)).await;

    (StatusCode::OK, Json(json!({
        "message": "MFA enabled successfully",
        "backup_codes": backup_codes
    }))).into_response()
}

// ── MFA Disable ────────────────────────────────────────────

pub async fn mfa_disable(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _ = sqlx::query("UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL, mfa_backup_codes = NULL, mfa_enabled_at = NULL WHERE id = $1")
        .bind(&auth.user_id)
        .execute(&state.db)
        .await;

    log_audit(&state.db, "mfa_disable", "security", "warning", Some(&auth.user_id), auth.org_id.as_deref(), None, Some("user"), Some(&auth.user_id), "success", Some(&headers)).await;

    Json(json!({"message": "MFA disabled"}))
}

// ── MFA Status ─────────────────────────────────────────────

pub async fn mfa_status(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let row: Option<(Option<bool>, Option<String>)> = sqlx::query_as(
        "SELECT mfa_enabled, mfa_enabled_at FROM users WHERE id = $1"
    )
    .bind(&auth.user_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    match row {
        Some((enabled, enabled_at)) => Json(json!({
            "mfa_enabled": enabled.unwrap_or(false),
            "mfa_enabled_at": enabled_at
        })),
        None => Json(json!({"mfa_enabled": false})),
    }
}
