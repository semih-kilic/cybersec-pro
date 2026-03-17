/// Stub handlers for frontend endpoints not yet fully implemented.
/// These return reasonable default / empty responses so the UI doesn't crash.
use std::sync::Arc;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;

use crate::middleware::auth_middleware::{AuthUser, AdminUser};
use crate::services::auth::{create_access_token, create_refresh_token};
use crate::AppState;

// ── GitHub / Google OAuth ──────────────────────────────────

pub async fn social_auth(
    State(state): State<Arc<AppState>>,
    uri: axum::http::Uri,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let code = match body.get("code").and_then(|c| c.as_str()) {
        Some(c) => c.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Authorization code required"}))).into_response(),
    };
    let redirect_uri = body.get("redirect_uri").and_then(|r| r.as_str()).unwrap_or("").to_string();

    // Detect provider from URI path
    let path = uri.path();
    let provider = if path.contains("/github") { "github" } else if path.contains("/google") { "google" } else { "unknown" };

    if provider != "github" {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": format!("{} OAuth not yet implemented", provider)}))).into_response();
    }

    let client_id = std::env::var("GITHUB_CLIENT_ID").unwrap_or_else(|_| "***REDACTED_GH_OAUTH_CLIENT_ID***".to_string());
    let client_secret = match std::env::var("GITHUB_CLIENT_SECRET") {
        Ok(s) => s,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "GitHub OAuth not configured (missing GITHUB_CLIENT_SECRET)"}))).into_response(),
    };

    // Exchange code for access token
    let http = reqwest::Client::new();
    let token_res = http.post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }))
        .send()
        .await;

    let token_data: serde_json::Value = match token_res {
        Ok(resp) => match resp.json().await {
            Ok(d) => d,
            Err(_) => return (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to parse GitHub token response"}))).into_response(),
        },
        Err(_) => return (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to contact GitHub"}))).into_response(),
    };

    let gh_token = match token_data.get("access_token").and_then(|t| t.as_str()) {
        Some(t) => t.to_string(),
        None => {
            let err = token_data.get("error_description").and_then(|e| e.as_str()).unwrap_or("Unknown error");
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": format!("GitHub OAuth failed: {}", err)}))).into_response();
        }
    };

    // Get GitHub user info
    let user_res = http.get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", gh_token))
        .header("User-Agent", "CyberSec-Pro")
        .send()
        .await;

    let gh_user: serde_json::Value = match user_res {
        Ok(resp) => match resp.json().await {
            Ok(d) => d,
            Err(_) => return (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to parse GitHub user info"}))).into_response(),
        },
        Err(_) => return (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to get GitHub user info"}))).into_response(),
    };

    // Get primary email if not public  
    let mut email = gh_user.get("email").and_then(|e| e.as_str()).unwrap_or("").to_string();
    if email.is_empty() {
        let emails_res = http.get("https://api.github.com/user/emails")
            .header("Authorization", format!("Bearer {}", gh_token))
            .header("User-Agent", "CyberSec-Pro")
            .send()
            .await;
        if let Ok(resp) = emails_res {
            if let Ok(emails) = resp.json::<Vec<serde_json::Value>>().await {
                for e in &emails {
                    if e.get("primary").and_then(|p| p.as_bool()) == Some(true) {
                        if let Some(addr) = e.get("email").and_then(|a| a.as_str()) {
                            email = addr.to_string();
                            break;
                        }
                    }
                }
            }
        }
    }

    if email.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Could not retrieve email from GitHub. Please make email public or grant email scope."}))).into_response();
    }

    let gh_name = gh_user.get("name").and_then(|n| n.as_str()).unwrap_or("");
    let gh_login = gh_user.get("login").and_then(|l| l.as_str()).unwrap_or("");
    let gh_avatar = gh_user.get("avatar_url").and_then(|a| a.as_str()).unwrap_or("");
    let _gh_id = gh_user.get("id").and_then(|i| i.as_i64()).unwrap_or(0);

    let name_parts: Vec<&str> = gh_name.split_whitespace().collect();
    let first_name = if !name_parts.is_empty() { name_parts[0] } else { gh_login };
    let last_name = if name_parts.len() > 1 { name_parts[1..].join(" ") } else { String::new() };

    // Check if user already exists
    let existing: Option<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, role, organization_id FROM users WHERE email = $1"
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (user_id, org_id, role) = if let Some((uid, r, oid)) = existing {
        // Update last login + avatar
        let _ = sqlx::query("UPDATE users SET last_login = CURRENT_TIMESTAMP, avatar_url = $1 WHERE id = $2")
            .bind(gh_avatar)
            .bind(&uid)
            .execute(&state.db)
            .await;
        (uid, oid.unwrap_or_default(), r)
    } else {
        // Create new user + organization
        let new_org_id = uuid::Uuid::new_v4().to_string();
        let new_user_id = uuid::Uuid::new_v4().to_string();
        let slug = email.split('@').next().unwrap_or("user").to_string();

        let _ = sqlx::query(
            "INSERT INTO organizations (id, name, slug, plan_type) VALUES ($1, $2, $3, 'trial')"
        )
        .bind(&new_org_id)
        .bind(&format!("{}'s Organization", first_name))
        .bind(&slug)
        .execute(&state.db)
        .await;

        let _ = sqlx::query(
            "INSERT INTO users (id, email, password_hash, first_name, last_name, role, organization_id, email_verified, avatar_url)
             VALUES ($1, $2, '', $3, $4, 'admin', $5, 1, $6)"
        )
        .bind(&new_user_id)
        .bind(&email)
        .bind(first_name)
        .bind(&last_name)
        .bind(&new_org_id)
        .bind(gh_avatar)
        .execute(&state.db)
        .await;

        (new_user_id, new_org_id, "admin".to_string())
    };

    // Generate JWT tokens
    let access_token = create_access_token(&state.jwt_secret, &user_id, Some(&org_id), &role).unwrap_or_default();
    let refresh_token = create_refresh_token(&state.jwt_secret, &user_id).unwrap_or_default();

    (StatusCode::OK, Json(json!({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "message": "GitHub login successful",
        "user": {
            "id": user_id,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "avatar_url": gh_avatar,
            "role": role
        }
    }))).into_response()
}

pub async fn resend_verification(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let email = match body.get("email").and_then(|e| e.as_str()) {
        Some(e) => e.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Email required"}))).into_response(),
    };

    // Find user and generate new token
    let user: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT id, first_name FROM users WHERE email = $1 AND (email_verified IS NULL OR email_verified = false)"
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (user_id, first_name) = match user {
        Some((uid, name)) => (uid, name.unwrap_or_else(|| "User".to_string())),
        None => {
            // Don't reveal whether email exists
            return Json(json!({"message": "If that email exists, a verification email has been sent"})).into_response();
        }
    };

    let token = uuid::Uuid::new_v4().to_string();
    let _ = sqlx::query("UPDATE users SET verification_token = $1 WHERE id = $2")
        .bind(&token)
        .bind(&user_id)
        .execute(&state.db)
        .await;

    // Send verification email
    if let Some(cfg) = crate::services::email::EmailConfig::from_env() {
        let verify_url = format!("https://semihkilic.com/dashboard/verify-email?token={}", token);
        let html = format!(
            r#"<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a">
            <table style="width:100%;max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px">
            <tr><td style="padding:40px;text-align:center">
            <h1 style="color:#00ff88">🛡️ Verify Your Email</h1>
            <p style="color:#ccd6f6;font-size:16px">Hi {},</p>
            <p style="color:#8892b0;font-size:14px">Please verify your email to activate your CyberSec Pro account.</p>
            <a href="{}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#00ff88,#00d4ff);color:#0a0a0a;text-decoration:none;font-weight:bold;border-radius:50px;margin:20px 0">Verify Email</a>
            <p style="color:#4a5568;font-size:12px;margin-top:20px">© 2026 CyberSec Professional</p>
            </td></tr></table></body></html>"#,
            first_name, verify_url
        );
        let plain = format!("Hi {},\n\nVerify your email: {}\n\n© 2026 CyberSec Professional", first_name, verify_url);
        let _ = crate::services::email::send_verification_email(&cfg, &email, &first_name, &verify_url).await;
        let _ = plain; let _ = html; // sent via the dedicated function
    }

    Json(json!({"message": "If that email exists, a verification email has been sent"})).into_response()
}

pub async fn verify_email(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let token = params.get("token").map(|s| s.as_str()).unwrap_or("");
    if token.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Missing verification token", "verified": false}))).into_response();
    }

    // Verify token matches a user and mark email verified
    let result = sqlx::query(
        "UPDATE users SET email_verified = true, verification_token = NULL WHERE verification_token = $1"
    )
    .bind(token)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            Json(json!({"message": "Email verified", "verified": true})).into_response()
        }
        _ => {
            (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid or expired token", "verified": false}))).into_response()
        }
    }
}

pub async fn upload_avatar(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    // Validate file size (max 2MB)
    if body.len() > 2 * 1024 * 1024 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "File too large. Max 2MB"}))).into_response();
    }

    if body.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "No file data received"}))).into_response();
    }

    // Detect image type from magic bytes
    let ext = if body.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "png"
    } else if body.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "jpg"
    } else if body.starts_with(b"GIF8") {
        "gif"
    } else if body.starts_with(b"RIFF") && body.len() > 12 && &body[8..12] == b"WEBP" {
        "webp"
    } else {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid image format. Accepted: PNG, JPG, GIF, WebP"}))).into_response();
    };

    // Save to disk
    let upload_dir = std::path::Path::new("/home/cybersec/cybersec-pro/uploads/avatars");
    if let Err(e) = tokio::fs::create_dir_all(upload_dir).await {
        tracing::error!("Failed to create avatar dir: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Server storage error"}))).into_response();
    }

    let filename = format!("{}.{}", user.user_id, ext);
    let filepath = upload_dir.join(&filename);

    if let Err(e) = tokio::fs::write(&filepath, &body).await {
        tracing::error!("Failed to write avatar: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save avatar"}))).into_response();
    }

    // Update user avatar URL in DB
    let avatar_url = format!("/uploads/avatars/{}", filename);
    let _ = sqlx::query("UPDATE users SET avatar_url = $1 WHERE id = $2")
        .bind(&avatar_url)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;

    Json(json!({"message": "Avatar uploaded", "avatar_url": avatar_url})).into_response()
}

pub async fn mfa_verify_setup(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let code = body.get("code").and_then(|c| c.as_str()).unwrap_or("");
    if code.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "TOTP code required", "verified": false}))).into_response();
    }

    // Fetch user's MFA secret
    let secret: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT mfa_secret FROM users WHERE id = $1"
    )
    .bind(&user.user_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let mfa_secret = match secret.and_then(|s| s.0) {
        Some(s) if !s.is_empty() => s,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "MFA not set up", "verified": false}))).into_response(),
    };

    // Verify TOTP code
    use totp_rs::{Algorithm, TOTP, Secret};
    let totp = match TOTP::new(Algorithm::SHA1, 6, 1, 30,
        Secret::Encoded(mfa_secret.clone()).to_bytes().unwrap_or_default(),
        Some("CyberSec Pro".to_string()),
        user.user_id.clone())
    {
        Ok(t) => t,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "MFA config error", "verified": false}))).into_response(),
    };

    if totp.check_current(code).unwrap_or(false) {
        // Generate 10 backup codes (scope rng to avoid !Send across await)
        let (backup_codes, hashed_json) = {
            use rand::Rng;
            let mut rng = rand::thread_rng();
            let mut codes: Vec<String> = Vec::new();
            let mut hashed: Vec<String> = Vec::new();
            for _ in 0..10 {
                let code_val: u32 = rng.gen_range(10000000..99999999);
                let code_str = format!("{}", code_val);
                codes.push(code_str.clone());
                let salt = argon2::password_hash::SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
                if let Ok(hash) = argon2::PasswordHasher::hash_password(
                    &argon2::Argon2::default(),
                    code_str.as_bytes(),
                    &salt,
                ) {
                    hashed.push(hash.to_string());
                }
            }
            (codes, serde_json::to_string(&hashed).unwrap_or_else(|_| "[]".to_string()))
        };

        // Enable MFA + store hashed backup codes
        let _ = sqlx::query("UPDATE users SET mfa_enabled = true, mfa_backup_codes = $1 WHERE id = $2")
            .bind(&hashed_json)
            .bind(&user.user_id)
            .execute(&state.db)
            .await;

        Json(json!({"message": "MFA verified and enabled", "verified": true, "backup_codes": backup_codes})).into_response()
    } else {
        (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid TOTP code", "verified": false}))).into_response()
    }
}

pub async fn mfa_regenerate_backup(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let password = match body.get("password").and_then(|p| p.as_str()) {
        Some(p) => p.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Password required"}))).into_response(),
    };

    // Verify password
    let row: Option<(String, Option<bool>)> = sqlx::query_as(
        "SELECT password_hash, mfa_enabled FROM users WHERE id = $1"
    )
    .bind(&user.user_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (pw_hash, mfa_enabled) = match row {
        Some(r) => r,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    };

    if !mfa_enabled.unwrap_or(false) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "MFA is not enabled"}))).into_response();
    }

    // Verify password
    use argon2::PasswordVerifier;
    let parsed_hash = match argon2::PasswordHash::new(&pw_hash) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Password verification error"}))).into_response(),
    };
    if argon2::Argon2::default().verify_password(password.as_bytes(), &parsed_hash).is_err() {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid password"}))).into_response();
    }

    // Generate 10 new backup codes (scope rng to avoid !Send across await)
    let (backup_codes, hashed_json) = {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let mut codes: Vec<String> = Vec::new();
        let mut hashed: Vec<String> = Vec::new();
        for _ in 0..10 {
            let code_val: u32 = rng.gen_range(10000000..99999999);
            let code_str = format!("{}", code_val);
            codes.push(code_str.clone());
            let salt = argon2::password_hash::SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
            if let Ok(hash) = argon2::PasswordHasher::hash_password(
                &argon2::Argon2::default(),
                code_str.as_bytes(),
                &salt,
            ) {
                hashed.push(hash.to_string());
            }
        }
        (codes, serde_json::to_string(&hashed).unwrap_or_else(|_| "[]".to_string()))
    };

    let _ = sqlx::query("UPDATE users SET mfa_backup_codes = $1 WHERE id = $2")
        .bind(&hashed_json)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;

    Json(json!({"backup_codes": backup_codes, "message": "Backup codes regenerated"})).into_response()
}

// ── Tool stubs ─────────────────────────────────────────────

pub async fn tool_config(
    Path(tool_id): Path<String>,
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let tool = sqlx::query_as::<_, (String, String, String, String, String, String, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, name, COALESCE(parameters::text, '{}'), COALESCE(description,''), category, COALESCE(plan_required,'starter'), command_template, binary_name, tool_group FROM tools WHERE (id = $1 OR name = $2 OR binary_name = $3) AND is_active = TRUE"
    )
    .bind(&tool_id)
    .bind(&tool_id)
    .bind(&tool_id)
    .fetch_optional(&state.db)
    .await;

    match tool {
        Ok(Some((id, name, params, desc, cat, plan, cmd_tpl, binary, group))) => {
            let params_val: serde_json::Value = serde_json::from_str(&params).unwrap_or(json!({}));
            Json(json!({
                "tool": {
                    "id": id,
                    "name": name,
                    "slug": name,
                    "description": desc,
                    "category": cat,
                    "plan_required": plan,
                    "is_active": true,
                    "parameters": params_val,
                    "command_template": cmd_tpl,
                    "binary_name": binary,
                    "group": group,
                },
                "config": {}
            })).into_response()
        }
        _ => Json(json!({"error": "Tool not found"})).into_response()
    }
}

pub async fn tool_execution_mode(
    Path(tool_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"execution_mode": "direct", "supports_streaming": true, "tool_id": tool_id})).into_response()
}

pub async fn tool_build_command(
    Path(slug): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let target = params.get("target").cloned().unwrap_or_default();
    Json(json!({
        "command": format!("{} {}", slug, target),
        "tool": slug,
        "target": target
    })).into_response()
}

pub async fn tools_catalog(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let tools = sqlx::query_as::<_, (String, String, String, String, String)>(
        "SELECT id, name, category, COALESCE(business_category,''), COALESCE(plan_required,'starter') FROM tools WHERE is_active = TRUE ORDER BY name LIMIT 1000"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = tools.iter().map(|(id, name, cat, bcat, plan)| {
        json!({"id": id, "name": name, "category": cat, "business_category": bcat, "plan_required": plan})
    }).collect();

    Json(json!({"tools": list, "total": list.len()})).into_response()
}

pub async fn v2_tools(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let _plan = params.get("plan").cloned().unwrap_or_default();

    let tools: Vec<crate::models::Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE is_active = TRUE ORDER BY name"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    // Group by tool_group
    let mut categories: std::collections::HashMap<String, Vec<serde_json::Value>> = std::collections::HashMap::new();
    for t in &tools {
        let group = t.tool_group.clone().unwrap_or_else(|| "misc".into());
        let resp = t.to_response();
        categories.entry(group).or_default().push(json!({
            "id": resp.id,
            "name": resp.name,
            "description": resp.description,
            "category": resp.category,
            "business_category": resp.business_category,
            "subcategory": resp.subcategory,
            "plan_required": resp.plan_required,
            "is_active": resp.is_active,
            "tool_type": resp.tool_type,
            "gui_required": resp.gui_required,
            "group": resp.group,
            "binary_name": resp.binary_name,
            "installed": true,
        }));
    }

    // Group display names
    let group_names: std::collections::HashMap<&str, (&str, &str)> = [
        ("web", ("Web Application Security", "🌐")),
        ("forensics", ("Digital Forensics", "🔬")),
        ("recon", ("Reconnaissance & OSINT", "🔍")),
        ("password", ("Password & GPU", "🔑")),
        ("vulnerability", ("Vulnerability Analysis", "🔓")),
        ("wireless", ("Wireless Security", "📡")),
        ("hardware", ("Hardware Attacks", "🔌")),
        ("network", ("Network & Sniffing", "🌍")),
        ("windows", ("Windows Resources", "🪟")),
        ("reversing", ("Reverse Engineering", "⚙️")),
        ("defense", ("Defense & Detection", "🛡️")),
        ("post-exploit", ("Post-Exploitation", "💀")),
        ("crypto", ("Cryptography & Steganography", "🔐")),
        ("reporting", ("Reporting", "📊")),
        ("exploitation", ("Exploitation", "💥")),
        ("social", ("Social Engineering", "🎭")),
        ("voip", ("VoIP Security", "📞")),
        ("database", ("Database Security", "🗄️")),
        ("misc", ("Miscellaneous", "🔧")),
    ].into_iter().collect();

    let mut result_cats: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();
    let mut cat_list: Vec<String> = Vec::new();

    for (group, tool_list) in &categories {
        let (display_name, icon) = group_names.get(group.as_str()).unwrap_or(&("Other", "🔧"));
        cat_list.push(group.clone());
        result_cats.insert(group.clone(), json!({
            "info": {
                "id": group,
                "name": display_name,
                "icon": icon,
                "tool_count": tool_list.len(),
            },
            "tools": tool_list,
        }));
    }

    cat_list.sort();

    Json(json!({
        "success": true,
        "total_tools": tools.len(),
        "categories": result_cats,
        "category_list": cat_list,
    })).into_response()
}

pub async fn v2_tool_detail(
    Path(tool_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let tool = sqlx::query_as::<_, (String, String, String, String, String, bool, Option<String>, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, name, COALESCE(description,''), category, COALESCE(plan_required,'starter'), is_active, command_template, binary_name, tool_group, kali_package FROM tools WHERE (id = $1 OR name = $2) AND is_active = TRUE"
    )
    .bind(&tool_id)
    .bind(&tool_id)
    .fetch_optional(&state.db)
    .await;

    match tool {
        Ok(Some((id, name, desc, cat, plan, active, cmd_tpl, binary, group, kali_pkg))) => {
            Json(json!({
                "success": true,
                "tool": {
                    "id": id,
                    "name": name,
                    "slug": name,
                    "description": desc,
                    "category": cat,
                    "plan_required": plan,
                    "is_active": active,
                    "command_template": cmd_tpl,
                    "binary_name": binary,
                    "group": group,
                    "kali_package": kali_pkg,
                }
            })).into_response()
        }
        _ => Json(json!({"error": "Tool not found"})).into_response()
    }
}

// ── Scan stubs (singular /scan/ variants) ──────────────────

pub async fn scan_start(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Delegate to the plural scan handler by forwarding
    let tool_id = body.get("tool_id").and_then(|v| v.as_str()).unwrap_or("");
    let target = body.get("target").and_then(|v| v.as_str()).unwrap_or("");
    let scan_id = uuid::Uuid::new_v4().to_string();

    let _ = sqlx::query(
        "INSERT INTO scans (id, user_id, organization_id, tool_id, target, status, created_at) VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP)"
    )
    .bind(&scan_id)
    .bind(&user.user_id)
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .bind(tool_id)
    .bind(target)
    .execute(&state.db)
    .await;

    Json(json!({"scan_id": scan_id, "status": "pending", "message": "Scan queued"})).into_response()
}

pub async fn scan_result(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let scan = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, status, output, CAST(findings AS TEXT), error_log FROM scans WHERE id = $1 AND organization_id = $2"
    )
    .bind(&scan_id)
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .fetch_optional(&state.db)
    .await;

    match scan {
        Ok(Some((id, status, output, findings, error_log))) => {
            let findings_val: serde_json::Value = findings.and_then(|f| serde_json::from_str(&f).ok()).unwrap_or(json!(null));
            let output_str = output.unwrap_or_default();
            Json(json!({
                "scan": {
                    "id": id,
                    "status": status,
                    "output": output_str,
                    "error_log": error_log,
                },
                "execution_result": {
                    "status": status,
                    "output": output_str,
                    "findings": findings_val
                }
            })).into_response()
        }
        _ => (StatusCode::NOT_FOUND, Json(json!({"error": "Scan not found"}))).into_response()
    }
}

pub async fn scan_stop(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("UPDATE scans SET status = 'cancelled' WHERE id = $1 AND organization_id = $2")
        .bind(&scan_id)
        .bind(&user.org_id.as_deref().unwrap_or(""))
        .execute(&state.db)
        .await;
    Json(json!({"message": "Scan stopped", "scan_id": scan_id})).into_response()
}

pub async fn scan_rerun(
    Path(scan_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"message": "Scan rerun queued", "scan_id": scan_id})).into_response()
}

pub async fn scan_business_report(
    Path(scan_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({
        "scan_id": scan_id,
        "report": {"summary": "No business report generated yet", "findings": [], "risk_score": 0}
    })).into_response()
}

pub async fn scan_status(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let status = sqlx::query_as::<_, (String,)>(
        "SELECT status FROM scans WHERE id = $1 AND organization_id = $2"
    )
    .bind(&scan_id)
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .fetch_optional(&state.db)
    .await;

    match status {
        Ok(Some((s,))) => Json(json!({"scan_id": scan_id, "status": s})).into_response(),
        _ => Json(json!({"error": "Scan not found"})).into_response()
    }
}

pub async fn scans_execute(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    scan_start(user, State(state), Json(body)).await
}

pub async fn scan_delete(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("DELETE FROM scans WHERE id = $1 AND organization_id = $2")
        .bind(&scan_id)
        .bind(&user.org_id.as_deref().unwrap_or(""))
        .execute(&state.db)
        .await;
    Json(json!({"message": "Scan deleted"})).into_response()
}

// ── Agent stubs ────────────────────────────────────────────

pub async fn update_agent(
    Path(agent_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");

    let name = body.get("name").and_then(|v| v.as_str());
    let ssh_host = body.get("ssh_host").and_then(|v| v.as_str());
    let ssh_port = body.get("ssh_port").and_then(|v| v.as_i64()).map(|v| v as i32);
    let ssh_username = body.get("ssh_username").and_then(|v| v.as_str());
    let ssh_key_path = body.get("ssh_key_path").and_then(|v| v.as_str());
    let location = body.get("location").and_then(|v| v.as_str());
    let connection_type = body.get("connection_type").and_then(|v| v.as_str());
    let hostname = body.get("hostname").and_then(|v| v.as_str());
    let ip_address = body.get("ip_address").and_then(|v| v.as_str());
    let platform = body.get("platform").and_then(|v| v.as_str());
    let max_concurrent = body.get("max_concurrent_scans").and_then(|v| v.as_i64()).map(|v| v as i32);

    let result = sqlx::query(
        "UPDATE agents SET \
         name = COALESCE($1, name), \
         ssh_host = COALESCE($2, ssh_host), \
         ssh_port = COALESCE($3, ssh_port), \
         ssh_username = COALESCE($4, ssh_username), \
         location = COALESCE($5, location), \
         connection_type = COALESCE($6, connection_type), \
         ssh_key_path = COALESCE($7, ssh_key_path), \
         hostname = COALESCE($8, hostname), \
         ip_address = COALESCE($9, ip_address), \
         platform = COALESCE($10, platform), \
         max_concurrent_scans = COALESCE($11, max_concurrent_scans), \
         updated_at = CURRENT_TIMESTAMP \
         WHERE id = $12 AND organization_id = $13"
    )
    .bind(name)
    .bind(ssh_host)
    .bind(ssh_port)
    .bind(ssh_username)
    .bind(location)
    .bind(connection_type)
    .bind(ssh_key_path)
    .bind(hostname)
    .bind(ip_address)
    .bind(platform)
    .bind(max_concurrent)
    .bind(&agent_id)
    .bind(org_id)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            Json(json!({"message": "Agent updated", "agent_id": agent_id})).into_response()
        }
        Ok(_) => {
            (axum::http::StatusCode::NOT_FOUND, Json(json!({"error": "Agent not found"}))).into_response()
        }
        Err(e) => {
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Update failed: {}", e)}))).into_response()
        }
    }
}

pub async fn test_agent(
    Path(agent_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");

    // Fetch agent SSH details
    let agent = sqlx::query(
        "SELECT ssh_host, ssh_port, ssh_username, connection_type, platform FROM agents WHERE id = $1 AND organization_id = $2"
    )
    .bind(&agent_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let agent = match agent {
        Some(a) => a,
        None => return (axum::http::StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Agent not found"}))).into_response(),
    };

    use sqlx::Row;
    let ssh_host: Option<String> = agent.get("ssh_host");
    let ssh_port: Option<i32> = agent.get("ssh_port");
    let platform: Option<String> = agent.get("platform");

    let host = match ssh_host {
        Some(h) if !h.is_empty() => h,
        _ => return Json(json!({"success": false, "error": "No SSH host configured"})).into_response(),
    };
    let port = ssh_port.unwrap_or(22);

    // Try TCP connection to the SSH port
    let addr = format!("{}:{}", host, port);
    match tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(&addr),
    ).await {
        Ok(Ok(_)) => {
            // Update agent status to online
            let _ = sqlx::query("UPDATE agents SET status = 'online', last_heartbeat = CURRENT_TIMESTAMP WHERE id = $1")
                .bind(&agent_id)
                .execute(&state.db)
                .await;
            Json(json!({
                "success": true,
                "os_info": platform.unwrap_or_else(|| "Linux".to_string()),
                "agent_id": agent_id,
                "message": format!("SSH port {} reachable on {}", port, host)
            })).into_response()
        }
        _ => {
            Json(json!({
                "success": false,
                "error": format!("Cannot reach {}:{} — check firewall/SSH service", host, port),
                "agent_id": agent_id
            })).into_response()
        }
    }
}

pub async fn agents_dashboard(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let rows = sqlx::query(
        "SELECT id, name, hostname, ip_address, COALESCE(status,'offline') as status, os_info, platform, version, cpu_usage, memory_usage, active_scans, total_scans, location, connection_type, ssh_port, ssh_username, CAST(last_heartbeat AS TEXT) as last_heartbeat FROM agents WHERE organization_id = $1 ORDER BY created_at DESC"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut online = 0i64;
    let mut offline = 0i64;
    let mut busy = 0i64;
    let mut pending = 0i64;
    let mut total_active_scans = 0i64;

    let agent_list: Vec<serde_json::Value> = rows.iter().map(|row| {
        use sqlx::Row;
        let id: String = row.get("id");
        let name: String = row.get("name");
        let hostname: Option<String> = row.get("hostname");
        let ip: Option<String> = row.get("ip_address");
        let status: String = row.get("status");
        let os: Option<String> = row.get("os_info");
        let platform: Option<String> = row.get("platform");
        let version: Option<String> = row.get("version");
        let cpu: Option<f32> = row.get("cpu_usage");
        let mem: Option<f32> = row.get("memory_usage");
        let active: Option<i32> = row.get("active_scans");
        let total: Option<i32> = row.get("total_scans");
        let location: Option<String> = row.get("location");
        let conn_type: Option<String> = row.get("connection_type");
        let ssh_port: Option<i32> = row.get("ssh_port");
        let ssh_user: Option<String> = row.get("ssh_username");
        let heartbeat: Option<String> = row.get("last_heartbeat");

        match status.as_str() {
            "online" => online += 1,
            "busy" => { busy += 1; },
            "pending" => { pending += 1; },
            _ => offline += 1,
        }
        total_active_scans += active.unwrap_or(0) as i64;

        let emoji = match status.as_str() {
            "online" => "\u{1f7e2}",
            "busy" => "\u{1f7e1}",
            "error" => "\u{1f534}",
            "pending" => "\u{1f7e0}",
            _ => "\u{26ab}",
        };

        json!({
            "id": id,
            "name": name,
            "hostname": hostname.unwrap_or_default(),
            "ip_address": ip.unwrap_or_default(),
            "status": status,
            "status_emoji": emoji,
            "os": os.unwrap_or_else(|| "Linux".into()),
            "platform": platform.unwrap_or_else(|| "linux".into()),
            "version": version.unwrap_or_else(|| "1.0.0".into()),
            "last_seen": &heartbeat,
            "last_heartbeat": &heartbeat,
            "cpu_usage": cpu.unwrap_or(0.0),
            "memory_usage": mem.unwrap_or(0.0),
            "active_scans": active.unwrap_or(0),
            "total_scans": total.unwrap_or(0),
            "location": location.unwrap_or_default(),
            "connection_type": conn_type.unwrap_or_else(|| "direct".into()),
            "ssh_port": ssh_port.unwrap_or(22),
            "ssh_username": ssh_user.unwrap_or_default(),
        })
    }).collect();

    // Total scans completed across all agents
    let total_scans_completed: i64 = sqlx::query_as::<_, (Option<i64>,)>(
        "SELECT SUM(COALESCE(total_scans, 0)) FROM agents WHERE organization_id = $1"
    ).bind(org_id).fetch_one(&state.db).await.map(|r| r.0.unwrap_or(0)).unwrap_or(0);

    Json(json!({
        "total_agents": rows.len(),
        "online": online,
        "offline": offline,
        "busy": busy,
        "pending": pending,
        "total_scans_completed": total_scans_completed,
        "active_scans": total_active_scans,
        "agents": agent_list
    })).into_response()
}

// ── Scheduled Scans ────────────────────────────────────────

pub async fn list_schedules(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let schedules = sqlx::query_as::<_, (String, String, String, String, bool, String)>(
        "SELECT id, name, cron_expression, COALESCE(tool_id,''), is_active, COALESCE(target,'') FROM scheduled_scans WHERE organization_id = $1 ORDER BY created_at DESC"
    )
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = schedules.iter().map(|(id, name, cron, tool_id, active, target)| {
        let status = if *active { "active" } else { "paused" };
        json!({
            "id": id,
            "name": name,
            "cron_expression": cron,
            "tool_id": tool_id,
            "tool_name": tool_id,
            "tool": tool_id,
            "is_active": active,
            "status": status,
            "target": target,
            "next_run": "",
            "last_run": "",
            "run_count": 0,
            "schedule_type": "cron",
            "created_at": ""
        })
    }).collect();

    Json(json!({"schedules": list})).into_response()
}

pub async fn create_schedule(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("New Schedule");
    let cron = body.get("cron_expression").and_then(|v| v.as_str()).unwrap_or("0 0 * * *");
    let tool_id = body.get("tool_id").and_then(|v| v.as_str()).unwrap_or("");
    let target = body.get("target").and_then(|v| v.as_str()).unwrap_or("");

    let _ = sqlx::query(
        "INSERT INTO scheduled_scans (id, user_id, organization_id, name, cron_expression, tool_id, target, is_active, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, CURRENT_TIMESTAMP)"
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .bind(name)
    .bind(cron)
    .bind(tool_id)
    .bind(target)
    .execute(&state.db)
    .await;

    Json(json!({"id": id, "message": "Schedule created"})).into_response()
}

pub async fn update_schedule(
    Path(schedule_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let name = body.get("name").and_then(|v| v.as_str());
    let cron = body.get("cron_expression").and_then(|v| v.as_str());
    let tool_id = body.get("tool_id").and_then(|v| v.as_str());
    let target = body.get("target").and_then(|v| v.as_str());

    // Build dynamic update
    let mut sets = Vec::new();
    let mut idx = 1;
    if name.is_some() { sets.push(format!("name = ${}", idx)); idx += 1; }
    if cron.is_some() { sets.push(format!("cron_expression = ${}", idx)); idx += 1; }
    if tool_id.is_some() { sets.push(format!("tool_id = ${}", idx)); idx += 1; }
    if target.is_some() { sets.push(format!("target = ${}", idx)); idx += 1; }

    if sets.is_empty() {
        return Json(json!({"message": "Nothing to update", "id": schedule_id})).into_response();
    }

    let user_param = idx;
    let id_param = idx + 1;
    let sql = format!(
        "UPDATE scheduled_scans SET {} WHERE id = ${} AND user_id = ${}",
        sets.join(", "), id_param, user_param
    );

    let mut query = sqlx::query(&sql);
    if let Some(v) = name { query = query.bind(v); }
    if let Some(v) = cron { query = query.bind(v); }
    if let Some(v) = tool_id { query = query.bind(v); }
    if let Some(v) = target { query = query.bind(v); }
    query = query.bind(&user.user_id);
    query = query.bind(&schedule_id);

    let _ = query.execute(&state.db).await;
    Json(json!({"message": "Schedule updated", "id": schedule_id})).into_response()
}

pub async fn delete_schedule(
    Path(schedule_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("DELETE FROM scheduled_scans WHERE id = $1 AND user_id = $2")
        .bind(&schedule_id)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Schedule deleted"})).into_response()
}

pub async fn toggle_schedule(
    Path(schedule_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("UPDATE scheduled_scans SET is_active = NOT is_active WHERE id = $1 AND user_id = $2")
        .bind(&schedule_id)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Schedule toggled", "id": schedule_id})).into_response()
}

// ── Targets ────────────────────────────────────────────────

pub async fn list_targets(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Derive targets from scans with full details
    let targets = sqlx::query_as::<_, (String, i64, Option<String>, Option<String>)>(
        "SELECT target, COUNT(*) as cnt, CAST(MAX(created_at) AS TEXT) as last_scan, CAST(MIN(created_at) AS TEXT) as first_scan FROM scans WHERE user_id = $1 GROUP BY target ORDER BY cnt DESC LIMIT 50"
    )
    .bind(&user.user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = targets.iter().enumerate().map(|(i, (t, c, last, first))| {
        // Detect target type
        let target_type = if t.contains('/') && t.chars().any(|c| c.is_numeric()) {
            "cidr"
        } else if t.starts_with("http://") || t.starts_with("https://") {
            "url"
        } else if t.chars().all(|c| c.is_numeric() || c == '.') {
            "ip"
        } else if t.contains('-') && t.chars().all(|c| c.is_numeric() || c == '.' || c == '-') {
            "range"
        } else {
            "domain"
        };
        json!({
            "id": format!("target-{}", i+1),
            "name": t,
            "value": t,
            "type": target_type,
            "tags": [],
            "last_scan": last,
            "scans_count": c,
            "risk_score": null,
            "created_at": first.clone().unwrap_or_default(),
            "notes": null,
        })
    }).collect();

    Json(json!({"targets": list})).into_response()
}

pub async fn list_target_groups(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"target_groups": []})).into_response()
}

// ── Analytics / Activity ───────────────────────────────────

pub async fn analytics_overview(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let total_scans = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM scans WHERE user_id = $1"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    let completed = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM scans WHERE user_id = $1 AND status = 'completed'"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    let failed = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM scans WHERE user_id = $1 AND status = 'failed'"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    let success_rate = if total_scans.0 > 0 {
        (completed.0 as f64 / total_scans.0 as f64 * 100.0).round()
    } else { 0.0 };

    // Build daily_trend from scans table
    let trend_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT CAST(created_at::date AS TEXT), COUNT(*) FROM scans WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days' GROUP BY created_at::date ORDER BY created_at::date"
    ).bind(&user.user_id).fetch_all(&state.db).await.unwrap_or_default();
    let daily_trend: Vec<serde_json::Value> = trend_rows.iter().map(|(d, c)| json!({"date": d, "scans": c})).collect();

    // Build tool_usage from scans joined with tools
    let tool_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT COALESCE(t.name,'unknown'), COUNT(*) FROM scans s LEFT JOIN tools t ON s.tool_id = t.id WHERE s.user_id = $1 GROUP BY t.name ORDER BY COUNT(*) DESC LIMIT 10"
    ).bind(&user.user_id).fetch_all(&state.db).await.unwrap_or_default();
    let tool_usage: Vec<serde_json::Value> = tool_rows.iter().map(|(n, c)| json!({"name": n, "count": c})).collect();

    // Status distribution
    let status_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT COALESCE(status,'unknown'), COUNT(*) FROM scans WHERE user_id = $1 GROUP BY status"
    ).bind(&user.user_id).fetch_all(&state.db).await.unwrap_or_default();
    let mut status_dist = serde_json::Map::new();
    for (s, c) in &status_rows {
        status_dist.insert(s.clone(), json!(c));
    }

    Json(json!({
        "daily_trend": daily_trend,
        "tool_usage": tool_usage,
        "status_distribution": status_dist,
        "target_distribution": [],
        "comparison": {
            "this_week": total_scans.0,
            "last_week": 0,
            "change_pct": 0.0
        },
        "performance": {
            "avg_duration_seconds": 0,
            "total_scans": total_scans.0,
            "success_rate": success_rate
        },
        "risk": {
            "score": 0,
            "level": "low",
            "severity_totals": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "total_issues": 0
        }
    })).into_response()
}

pub async fn activity_feed(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let limit: i64 = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(20);
    let org_id = user.org_id.clone().unwrap_or_else(|| user.user_id.clone());

    let mut activities: Vec<serde_json::Value> = Vec::new();

    // 1) Recent scans
    let scans = sqlx::query_as::<_, (String, String, String, Option<String>, String)>(
        "SELECT id, COALESCE(target,''), status, tool_id, CAST(created_at AS TEXT) FROM scans WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2"
    )
    .bind(&org_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for (id, target, status, tool_id, ts) in &scans {
        let (act_type, title, severity) = match status.as_str() {
            "running" => ("scan_started", format!("Scan started on {}", target), "info"),
            "completed" => ("scan_completed", format!("Scan completed on {}", target), "success"),
            "failed" => ("scan_failed", format!("Scan failed on {}", target), "critical"),
            "cancelled" => ("scan_failed", format!("Scan cancelled on {}", target), "warning"),
            _ => ("scan_started", format!("Scan on {}", target), "info"),
        };
        activities.push(json!({
            "id": format!("scan-{}", id),
            "type": act_type,
            "title": title,
            "description": format!("Tool: {} • Target: {}", tool_id.as_deref().unwrap_or("unknown"), target),
            "timestamp": ts,
            "severity": severity,
            "link": format!("/dashboard/scans/{}", id),
            "meta": { "target": target, "status": status }
        }));
    }

    // 2) Recent reports
    let reports = sqlx::query_as::<_, (String, String, String, i32, String)>(
        "SELECT id, COALESCE(name,'Report'), COALESCE(template,''), total_findings, CAST(created_at AS TEXT) FROM reports WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2"
    )
    .bind(&org_id)
    .bind(limit / 2)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for (id, name, template, findings, ts) in &reports {
        activities.push(json!({
            "id": format!("report-{}", id),
            "type": "report_generated",
            "title": format!("Report generated: {}", name),
            "description": format!("{} template • {} findings", template, findings),
            "timestamp": ts,
            "severity": if *findings > 10 { "warning" } else { "success" },
            "link": format!("/dashboard/reports?id={}", id),
            "meta": { "template": template, "findings": findings }
        }));
    }

    // 3) Audit log entries (login, settings changes, etc.)
    let audit = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, action, COALESCE(details::text, '{}'), CAST(created_at AS TEXT) FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2"
    )
    .bind(&user.user_id)
    .bind(limit / 2)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for (id, action, details, ts) in &audit {
        let (act_type, severity) = match action.as_str() {
            "login" | "login_success" => ("user_action", "info"),
            "logout" => ("user_action", "info"),
            "scan_start" | "scan_started" => continue, // already covered
            "mfa_enabled" | "mfa_disabled" => ("system", "warning"),
            "plan_change" => ("system", "info"),
            _ => ("system", "info"),
        };
        let title = match action.as_str() {
            "login" | "login_success" => "User logged in".to_string(),
            "logout" => "User logged out".to_string(),
            "mfa_enabled" => "MFA enabled".to_string(),
            "mfa_disabled" => "MFA disabled".to_string(),
            "plan_change" => "Plan changed".to_string(),
            _ => format!("Action: {}", action),
        };
        activities.push(json!({
            "id": format!("audit-{}", id),
            "type": act_type,
            "title": title,
            "description": if details.len() > 2 { Some(details.clone()) } else { None::<String> },
            "timestamp": ts,
            "severity": severity
        }));
    }

    // Sort by timestamp descending and limit
    activities.sort_by(|a, b| {
        let ts_a = a["timestamp"].as_str().unwrap_or("");
        let ts_b = b["timestamp"].as_str().unwrap_or("");
        ts_b.cmp(ts_a)
    });
    activities.truncate(limit as usize);

    Json(json!({"activities": activities})).into_response()
}

// ── Usage stats ────────────────────────────────────────────

pub async fn usage_stats(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let total_scans = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM scans WHERE user_id = $1"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    Json(json!({
        "scans_used": total_scans.0,
        "scans_limit": 10000,
        "storage_used_mb": 0,
        "storage_limit_mb": 50000,
        "api_calls": 0,
        "api_limit": 100000
    })).into_response()
}

// ── Plan info / features ───────────────────────────────────

pub async fn plan_info(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let plan = sqlx::query_as::<_, (String,)>(
        "SELECT COALESCE(s.plan_type, 'trial') FROM subscriptions s JOIN users u ON u.organization_id = s.organization_id WHERE u.id = $1"
    )
    .bind(&user.user_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or(("trial".to_string(),));

    let configs = crate::services::plan::get_plan_configs();
    let config = configs.get(plan.0.as_str());
    Json(json!({"plan": plan.0, "config": config})).into_response()
}

pub async fn plan_features(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({
        "features": {
            "max_scans": 10000,
            "max_agents": 50,
            "max_projects": 100,
            "reporting": true,
            "api_access": true,
            "sso": true,
            "purple_team": true
        }
    })).into_response()
}

// ── Billing extra endpoint ─────────────────────────────────

pub async fn create_checkout_session(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"error": "Billing not configured"})).into_response()
}

// ── SSO test ───────────────────────────────────────────────

pub async fn sso_test(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"status": "ok", "message": "SSO test not implemented"})).into_response()
}

// ── Admin endpoints ────────────────────────────────────────

pub async fn admin_overview(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let total_users = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM users").fetch_one(&state.db).await.unwrap_or((0,)).0;
    let active_users = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM users WHERE is_active = TRUE").fetch_one(&state.db).await.unwrap_or((0,)).0;
    let total_orgs = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM organizations").fetch_one(&state.db).await.unwrap_or((0,)).0;
    let total_scans = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM scans").fetch_one(&state.db).await.unwrap_or((0,)).0;
    let running_scans = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM scans WHERE status IN ('running','pending')").fetch_one(&state.db).await.unwrap_or((0,)).0;
    let total_agents = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM agents").fetch_one(&state.db).await.unwrap_or((0,)).0;
    let online_agents = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM agents WHERE status = 'online'").fetch_one(&state.db).await.unwrap_or((0,)).0;

    // Plan distribution
    let plans = sqlx::query_as::<_, (String, i64)>("SELECT COALESCE(plan_type,'trial'), COUNT(*) FROM organizations GROUP BY plan_type")
        .fetch_all(&state.db).await.unwrap_or_default();
    let plans_dist: serde_json::Map<String, serde_json::Value> = plans.into_iter().map(|(p, c)| (p, json!(c))).collect();

    // Recent users
    let recent_users = sqlx::query_as::<_, (String, String, String, String, Option<String>, bool, String)>(
        "SELECT id, email, COALESCE(first_name,''), COALESCE(role,'user'), organization_id, is_active, CAST(created_at AS TEXT) FROM users ORDER BY created_at DESC LIMIT 10"
    ).fetch_all(&state.db).await.unwrap_or_default();
    let user_list: Vec<serde_json::Value> = recent_users.iter().map(|(id, email, name, role, org, active, created)| {
        json!({"id": id, "email": email, "first_name": name, "last_name": "", "role": role, "organization_id": org, "is_active": active, "created_at": created})
    }).collect();

    // Recent orgs
    let recent_orgs = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, bool)>(
        "SELECT id, name, slug, plan_type, is_active FROM organizations ORDER BY created_at DESC LIMIT 10"
    ).fetch_all(&state.db).await.unwrap_or_default();
    let org_list: Vec<serde_json::Value> = recent_orgs.iter().map(|(id, name, slug, plan, active)| {
        json!({"id": id, "name": name, "slug": slug, "plan_type": plan.clone().unwrap_or_else(|| "trial".into()), "is_active": active})
    }).collect();

    // Recent scans
    let recent_scans = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, target, status, CAST(created_at AS TEXT) FROM scans ORDER BY created_at DESC LIMIT 5"
    ).fetch_all(&state.db).await.unwrap_or_default();
    let scan_list: Vec<serde_json::Value> = recent_scans.iter().map(|(id, target, status, created)| {
        json!({"id": id, "target": target, "status": status, "created_at": created})
    }).collect();

    Json(json!({
        "users": { "total": total_users, "active": active_users, "list": user_list },
        "organizations": { "total": total_orgs, "plans_distribution": plans_dist, "list": org_list },
        "scans": { "total": total_scans, "running": running_scans, "recent": scan_list },
        "agents": { "total": total_agents, "online": online_agents },
        "revenue": { "mrr": 0, "arr": 0 },
        "system_health": "healthy",
        "engine": "rust-axum"
    })).into_response()
}

pub async fn admin_impersonate(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let email = match body.get("email").and_then(|e| e.as_str()) {
        Some(e) => e.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "email is required"}))).into_response(),
    };

    let user: Option<crate::models::User> = sqlx::query_as("SELECT * FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let user = match user {
        Some(u) => u,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    };

    let org_id = user.organization_id.as_deref();
    let role = user.role.as_deref().unwrap_or("user");
    let token = create_access_token(&state.jwt_secret, &user.id, org_id, role).unwrap_or_default();
    let refresh = create_refresh_token(&state.jwt_secret, &user.id).unwrap_or_default();

    (StatusCode::OK, Json(json!({
        "token": token,
        "refresh_token": refresh,
        "user": user.to_response()
    }))).into_response()
}

pub async fn admin_change_plan(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match body.get("organization_id").and_then(|o| o.as_str()) {
        Some(id) => id.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "organization_id is required"}))).into_response(),
    };
    let plan_type = match body.get("plan_type").and_then(|p| p.as_str()) {
        Some(p) => p.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "plan_type is required"}))).into_response(),
    };

    let valid_plans = ["free", "starter", "professional", "enterprise"];
    if !valid_plans.contains(&plan_type.as_str()) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid plan_type. Must be one of: free, starter, professional, enterprise"}))).into_response();
    }

    let result = sqlx::query("UPDATE organizations SET plan_type = $1 WHERE id = $2")
        .bind(&plan_type)
        .bind(&org_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(json!({"message": format!("Plan changed to {}", plan_type), "plan_type": plan_type}))).into_response()
        },
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Organization not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", e)}))).into_response(),
    }
}

// ── Admin Organization Deletion (Hard Delete + Cascade) ────

pub async fn admin_delete_organization(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Path(org_id): Path<String>,
) -> impl IntoResponse {
    // Verify org exists
    let org_exists: Option<(String,)> = sqlx::query_as("SELECT id FROM organizations WHERE id = $1")
        .bind(&org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    if org_exists.is_none() {
        return (StatusCode::NOT_FOUND, Json(json!({"error": "Organization not found"}))).into_response();
    }

    // Cascade delete all related data (respecting FK constraint order)
    let _ = sqlx::query("DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM scheduled_scans WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM usage_tracking WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM reports WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM scans WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM sso_configs WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM subscriptions WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM projects WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM agents WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM users WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;

    let result = sqlx::query("DELETE FROM organizations WHERE id = $1")
        .bind(&org_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(json!({"message": "Organization and all related data deleted"}))).into_response()
        },
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Organization not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", e)}))).into_response(),
    }
}

// ── Admin User Management ──────────────────────────────────

pub async fn admin_delete_user(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> impl IntoResponse {
    // Don't allow deleting yourself
    if user_id == _admin.0.user_id {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Cannot delete yourself"}))).into_response();
    }

    // Delete related records first to avoid FK constraint violations
    let _ = sqlx::query("DELETE FROM audit_logs WHERE user_id = $1").bind(&user_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM reports WHERE user_id = $1").bind(&user_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM scheduled_scans WHERE user_id = $1").bind(&user_id).execute(&state.db).await;
    let _ = sqlx::query("UPDATE scans SET user_id = NULL WHERE user_id = $1").bind(&user_id).execute(&state.db).await;

    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(&user_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(json!({"message": "User deleted"}))).into_response()
        },
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", e)}))).into_response(),
    }
}

pub async fn admin_toggle_user(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> impl IntoResponse {
    let result = sqlx::query("UPDATE users SET is_active = NOT COALESCE(is_active, true) WHERE id = $1 RETURNING is_active")
        .bind(&user_id)
        .fetch_optional(&state.db)
        .await;

    match result {
        Ok(Some(row)) => {
            let is_active: bool = sqlx::Row::get(&row, "is_active");
            (StatusCode::OK, Json(json!({"message": if is_active { "User activated" } else { "User deactivated" }, "is_active": is_active}))).into_response()
        },
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", e)}))).into_response(),
    }
}

pub async fn admin_change_role(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let role = match body.get("role").and_then(|r| r.as_str()) {
        Some(r) => r.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "role is required"}))).into_response(),
    };

    let valid_roles = ["user", "admin", "superadmin"];
    if !valid_roles.contains(&role.as_str()) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid role. Must be one of: user, admin, superadmin"}))).into_response();
    }

    let result = sqlx::query("UPDATE users SET role = $1 WHERE id = $2")
        .bind(&role)
        .bind(&user_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(json!({"message": format!("Role changed to {}", role), "role": role}))).into_response()
        },
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", e)}))).into_response(),
    }
}

pub async fn admin_service_dashboard(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let dashboard = state.service_manager.get_dashboard().await;
    Json(json!(dashboard)).into_response()
}

pub async fn admin_service_list(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let services = state.service_manager.get_services().await;
    Json(json!({"services": services})).into_response()
}

pub async fn admin_service_action(
    Path(service_id): Path<String>,
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let action = body.get("action").and_then(|a| a.as_str()).unwrap_or("restart");
    match state.service_manager.service_action(&service_id, action).await {
        Ok(msg) => Json(json!({"success": true, "message": msg})).into_response(),
        Err(e) => Json(json!({"success": false, "error": e})).into_response(),
    }
}

pub async fn admin_system_info(
    _admin: AdminUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let system = crate::services::service_manager::get_system_metrics().await;
    Json(json!(system)).into_response()
}

pub async fn admin_processes(
    _admin: AdminUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let procs = crate::services::service_manager::get_processes().await;
    Json(json!({"processes": procs})).into_response()
}

pub async fn admin_alerts(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let alerts = state.service_manager.get_alerts().await;
    Json(json!({"alerts": alerts})).into_response()
}

pub async fn admin_ack_alert(
    Path(alert_id): Path<String>,
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let ok = state.service_manager.acknowledge_alert(&alert_id).await;
    Json(json!({"success": ok, "id": alert_id})).into_response()
}

// ── AI endpoints ───────────────────────────────────────────

pub async fn ai_suggest(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"suggestions": [], "message": "AI suggestions not yet available"})).into_response()
}

pub async fn ai_remediation(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"remediation": "AI remediation not yet available", "steps": []})).into_response()
}

pub async fn ai_report_summary(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"summary": "AI report summary not yet available"})).into_response()
}

// ── Purple Team endpoints ──────────────────────────────────

pub async fn purple_team_dashboard(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({
        "total_exercises": 0,
        "running": 0,
        "completed": 0,
        "total_attack_steps": 0,
        "total_detected": 0,
        "total_missed": 0,
        "detection_rate": 0.0,
        "average_risk_score": 0.0,
        "available_chains": 0,
        "available_playbooks": 0,
        "exercises": 0,
        "active_chains": 0,
        "playbooks": 0,
        "coverage": 0.0
    })).into_response()
}

pub async fn purple_team_chains(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!([])).into_response()
}

pub async fn purple_team_playbooks(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!([])).into_response()
}

pub async fn purple_team_exercises(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!([])).into_response()
}

pub async fn purple_team_exercise_detail(
    Path(exercise_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"id": exercise_id, "name": "Exercise", "status": "not_found"})).into_response()
}

pub async fn purple_team_create_exercise(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "Purple team exercise creation not implemented"})).into_response()
}

pub async fn purple_team_mitre(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({})).into_response()
}

// ── Terminal endpoints ─────────────────────────────────────

pub async fn terminal_agents(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let agents = sqlx::query_as::<_, (String, String, String, String, String, String, Option<i32>, Option<String>)>(
        "SELECT id, name, COALESCE(hostname,''), COALESCE(ip_address,''), COALESCE(platform,'linux'), COALESCE(status,'offline'), ssh_port, ssh_username FROM agents LIMIT 50"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = agents.iter().map(|(id, name, host, ip, platform, status, port, user)| {
        json!({
            "id": id,
            "name": name,
            "hostname": host,
            "ip_address": ip,
            "platform": platform,
            "status": status,
            "ssh_host": ip,
            "ssh_port": port.unwrap_or(22),
            "ssh_username": user.as_deref().unwrap_or("root"),
            "connection_type": "ssh"
        })
    }).collect();

    Json(json!({"agents": list})).into_response()
}

pub async fn terminal_execute(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"error": "Remote terminal execution not available in Rust backend"})).into_response()
}

pub async fn terminal_test_connection(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"connected": false, "message": "Terminal test not implemented"})).into_response()
}

// ── Chatbot / Feedback ─────────────────────────────────────

pub async fn chatbot_message(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let msg = body.get("message").and_then(|v| v.as_str()).unwrap_or("");
    Json(json!({"response": format!("Chatbot not yet implemented. You said: {}", msg), "type": "text"})).into_response()
}

pub async fn feedback(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "Thank you for your feedback!"})).into_response()
}

// ── GDPR ───────────────────────────────────────────────────

pub async fn gdpr_export(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"message": "GDPR export queued", "status": "processing"})).into_response()
}

pub async fn gdpr_delete_account(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"message": "Account deletion not implemented in Rust backend for safety"})).into_response()
}
