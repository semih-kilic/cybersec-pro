use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use sha2::Digest;
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
use crate::services::email::{EmailConfig, send_welcome_email};

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

    // Validate email — RFC 5322 basic check
    let email = body.email.trim().to_lowercase();
    let at_pos = email.find('@');
    let valid_email = at_pos.map(|pos| {
        let local = &email[..pos];
        let domain = &email[pos + 1..];
        !local.is_empty()
            && !domain.is_empty()
            && domain.contains('.')
            && domain.len() >= 3
            && !email.contains(' ')
            && email.len() >= 6
            && email.len() <= 254
    }).unwrap_or(false);

    if !valid_email {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Valid email required"}))).into_response();
    }

    // Validate password strength
    if body.password.len() < 8 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Password must be at least 8 characters"}))).into_response();
    }

    // Check existing
    let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    if existing.is_some() {
        return (StatusCode::CONFLICT, Json(json!({"error": "Email already registered"}))).into_response();
    }

    // Hash password before transaction
    let pw_hash = match hash_password(&body.password) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Password hashing failed"}))).into_response(),
    };

    // Create org + user atomically in a transaction
    let org_id = Uuid::new_v4().to_string();
    let org_name = body.organization_name.as_deref().unwrap_or("My Organization");
    let slug = format!("{}-{}", org_name.to_lowercase().replace(' ', "-"), &org_id[..8]);
    let user_id = Uuid::new_v4().to_string();
    let verification_token = Uuid::new_v4().to_string();

    let mut tx = match state.db.begin().await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to begin transaction: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Registration failed"}))).into_response();
        }
    };

    if let Err(e) = sqlx::query(
        "INSERT INTO organizations (id, name, slug, plan_type) VALUES ($1, $2, $3, 'trial')"
    )
    .bind(&org_id).bind(org_name).bind(&slug)
    .execute(&mut *tx).await {
        let _ = tx.rollback().await;
        tracing::error!("Failed to create organization: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Registration failed"}))).into_response();
    }

    if let Err(e) = sqlx::query(
        "INSERT INTO users (id, email, password_hash, first_name, last_name, role, organization_id, email_verified, verification_token, verification_sent_at)
         VALUES ($1, $2, $3, $4, $5, 'admin', $6, FALSE, $7, CURRENT_TIMESTAMP)"
    )
    .bind(&user_id).bind(&email).bind(&pw_hash)
    .bind(&body.first_name).bind(&body.last_name)
    .bind(&org_id).bind(&verification_token)
    .execute(&mut *tx).await {
        let _ = tx.rollback().await;
        tracing::error!("Failed to create user: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Registration failed"}))).into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!("Transaction commit failed: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Registration failed"}))).into_response();
    }

    log_audit(&state.db, "register", "auth", "info", Some(&user_id), Some(&org_id), None, Some("user"), Some(&user_id), "success", Some(&headers)).await;

    // Send welcome email (best-effort, don't block registration)
    let welcome_name = body.first_name.as_deref().unwrap_or("there");
    if let Some(cfg) = EmailConfig::from_env() {
        if let Err(e) = send_welcome_email(&cfg, &email, welcome_name).await {
            tracing::error!("Failed to send welcome email to {}: {}", email, e);
        }
    }

    // Generate tokens
    let access_token = create_access_token(&state.jwt_secret, &user_id, Some(&org_id), "admin").unwrap_or_default();
    let refresh_token = create_refresh_token(&state.jwt_secret, &user_id).unwrap_or_default();

    (StatusCode::CREATED, Json(json!({
        "message": "Registration successful",
        "user": {
            "id": user_id,
            "email": email,
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
                if let Some(serde_json::Value::Array(codes)) = &user.mfa_backup_codes {
                    let string_codes: Vec<String> = codes.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect();
                    if let Some(used_idx) = verify_backup_code(mfa_code, &string_codes) {
                        // Remove used backup code (one-time use)
                        let mut remaining = string_codes.clone();
                        remaining.remove(used_idx);
                        let updated = serde_json::to_string(&remaining).unwrap_or_default();
                        let _ = sqlx::query("UPDATE users SET mfa_backup_codes = $1 WHERE id = $2")
                            .bind(&updated)
                            .bind(&user.id)
                            .execute(&state.db)
                            .await;
                        // backup code valid — continue to login
                    } else {
                        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid MFA code"}))).into_response();
                    }
                } else {
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
        org.map(|o: Organization| json!(o.to_response()))
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
                org.map(|o: Organization| json!(o.to_response()))
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
    pub company: Option<String>,
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

    // Update organization name (company) if provided
    if let Some(ref company) = body.company {
        if let Some(ref org_id) = auth.org_id {
            let _ = sqlx::query("UPDATE organizations SET name = $1 WHERE id = $2")
                .bind(company)
                .bind(org_id)
                .execute(&state.db)
                .await;
        }
    }

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

#[derive(Deserialize)]
pub struct MfaDisableRequest {
    pub password: String,
}

pub async fn mfa_disable(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    headers: HeaderMap,
    Json(body): Json<MfaDisableRequest>,
) -> impl IntoResponse {
    // Require current password to disable MFA
    let row: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT password_hash FROM users WHERE id = $1"
    )
    .bind(&auth.user_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let pw_hash = match row.and_then(|r| r.0) {
        Some(h) => h,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    };

    if !verify_password(&body.password, &pw_hash) {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid password"}))).into_response();
    }

    let _ = sqlx::query(
        "UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL, mfa_backup_codes = NULL, mfa_enabled_at = NULL WHERE id = $1"
    )
    .bind(&auth.user_id)
    .execute(&state.db)
    .await;

    log_audit(&state.db, "mfa_disable", "security", "warning", Some(&auth.user_id), auth.org_id.as_deref(), None, Some("user"), Some(&auth.user_id), "success", Some(&headers)).await;

    Json(json!({"message": "MFA disabled"})).into_response()
}

// ── MFA Status ─────────────────────────────────────────────

pub async fn mfa_status(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let row: Option<(Option<bool>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT mfa_enabled, mfa_enabled_at, mfa_backup_codes FROM users WHERE id = $1"
    )
    .bind(&auth.user_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    match row {
        Some((enabled, enabled_at, backup_codes_json)) => {
            let backup_codes_remaining = backup_codes_json
                .and_then(|j| serde_json::from_str::<Vec<String>>(&j).ok())
                .map(|codes| codes.len())
                .unwrap_or(0);
            Json(json!({
                "mfa_enabled": enabled.unwrap_or(false),
                "mfa_enabled_at": enabled_at,
                "backup_codes_remaining": backup_codes_remaining
            }))
        },
        None => Json(json!({"mfa_enabled": false, "backup_codes_remaining": 0})),
    }
}

// ── Forgot Password ────────────────────────────────────────

#[derive(Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
}

pub async fn forgot_password(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<ForgotPasswordRequest>,
) -> impl IntoResponse {
    let ip = headers.get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    if state.rate_limiter.is_limited(&format!("forgot_password:{}", ip), 3, std::time::Duration::from_secs(300)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many requests. Please try again later."}))).into_response();
    }

    let email = body.email.trim().to_lowercase();

    // Always return success to prevent email enumeration
    let success_response = Json(json!({
        "message": "If an account with that email exists, a password reset link has been sent."
    }));

    // Look up user
    let user: Option<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT id, first_name, email FROM users WHERE email = $1 AND is_active = TRUE"
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (user_id, first_name, user_email) = match user {
        Some(u) => u,
        None => return success_response.into_response(),
    };

    // Generate secure reset token
    let reset_token = Uuid::new_v4().to_string();
    let expires = chrono::Utc::now().naive_utc() + chrono::Duration::hours(1);

    // Store the token (hashed for security)
    let token_hash = format!("{:x}", sha2::Sha256::digest(reset_token.as_bytes()));
    if let Err(e) = sqlx::query(
        "UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3"
    )
    .bind(&token_hash)
    .bind(&expires)
    .bind(&user_id)
    .execute(&state.db)
    .await
    {
        tracing::error!("Failed to store reset token: {}", e);
        return success_response.into_response();
    }

    // Send reset email (best-effort; don't reveal failure to client)
    let base_url = std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "https://semihkilic.com".to_string());
    let reset_url = format!("{}/dashboard/reset-password?token={}", base_url, reset_token);
    let name = first_name.as_deref().unwrap_or("there");

    if let Some(cfg) = crate::services::email::EmailConfig::from_env() {
        if let Err(e) = crate::services::email::send_password_reset_email(
            &cfg,
            &user_email.unwrap_or(email),
            name,
            &reset_url,
        ).await {
            tracing::error!("Failed to send reset email: {}", e);
        }
    } else {
        tracing::warn!("SMTP not configured — reset token generated but email not sent");
    }

    log_audit(&state.db, "forgot_password", "auth", "info", Some(&user_id), None, None, Some("user"), Some(&user_id), "success", Some(&headers)).await;

    success_response.into_response()
}

// ── Reset Password ─────────────────────────────────────────

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    pub token: String,
    pub new_password: String,
}

pub async fn reset_password(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<ResetPasswordRequest>,
) -> impl IntoResponse {
    let ip = headers.get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    if state.rate_limiter.is_limited(&format!("reset_password:{}", ip), 5, std::time::Duration::from_secs(300)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many attempts. Please try again later."}))).into_response();
    }

    if body.new_password.len() < 8 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Password must be at least 8 characters"}))).into_response();
    }

    // Hash the submitted token to compare with DB
    let token_hash = format!("{:x}", sha2::Sha256::digest(body.token.as_bytes()));

    // Find user with this reset token that hasn't expired
    let user: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW() AND is_active = TRUE"
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (user_id,) = match user {
        Some(u) => u,
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid or expired reset token"}))).into_response(),
    };

    // Hash the new password
    let pw_hash = match hash_password(&body.new_password) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Password hashing failed"}))).into_response(),
    };

    // Update password and clear reset token atomically
    if let Err(e) = sqlx::query(
        "UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2"
    )
    .bind(&pw_hash)
    .bind(&user_id)
    .execute(&state.db)
    .await
    {
        tracing::error!("Failed to update password: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Password reset failed"}))).into_response();
    }

    log_audit(&state.db, "password_reset", "auth", "info", Some(&user_id), None, None, Some("user"), Some(&user_id), "success", Some(&headers)).await;

    Json(json!({"message": "Password has been reset successfully. You can now log in with your new password."})).into_response()
}
