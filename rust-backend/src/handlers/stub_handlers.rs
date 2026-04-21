/// Stub handlers for frontend endpoints not yet fully implemented.
/// These return reasonable default / empty responses so the UI doesn't crash.
use std::{collections::HashMap, sync::{Arc, Mutex, OnceLock}};
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

static PURPLE_TEAM_EXERCISES: OnceLock<Mutex<HashMap<String, Vec<serde_json::Value>>>> = OnceLock::new();

fn purple_team_store() -> &'static Mutex<HashMap<String, Vec<serde_json::Value>>> {
    PURPLE_TEAM_EXERCISES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn purple_team_chains_catalog() -> Vec<serde_json::Value> {
    vec![
        json!({
            "id": "chain-initial-access-phishing",
            "name": "Initial Access Validation",
            "description": "Simulate a phishing-led foothold and validate whether early detections trigger.",
            "severity": "high",
            "steps_count": 5,
            "mitre_tactics": ["TA0001", "TA0002"],
            "tools_used": ["social-engineering", "payload-simulation", "http-callback"]
        }),
        json!({
            "id": "chain-credential-access",
            "name": "Credential Access Drill",
            "description": "Exercise credential theft and verify blue-team alerting paths.",
            "severity": "critical",
            "steps_count": 7,
            "mitre_tactics": ["TA0006", "TA0003"],
            "tools_used": ["hash-dump-simulation", "lsass-access", "credential-spray"]
        }),
        json!({
            "id": "chain-lateral-movement",
            "name": "Lateral Movement Simulation",
            "description": "Validate segmentation and response workflows for east-west movement.",
            "severity": "medium",
            "steps_count": 6,
            "mitre_tactics": ["TA0008", "TA0007"],
            "tools_used": ["psexec-simulation", "ssh-pivot", "remote-service-exec"]
        }),
    ]
}

fn purple_team_playbooks_catalog() -> Vec<serde_json::Value> {
    vec![
        json!({
            "id": "playbook-email-compromise",
            "name": "Email Compromise Response",
            "description": "Covers phishing triage, mailbox hardening, and credential reset workflow.",
            "chain_ids": ["chain-initial-access-phishing"],
            "estimated_duration_minutes": 45,
            "difficulty": "medium"
        }),
        json!({
            "id": "playbook-credential-breach",
            "name": "Credential Breach Containment",
            "description": "Validates SOC response for credential theft and suspicious auth patterns.",
            "chain_ids": ["chain-credential-access"],
            "estimated_duration_minutes": 60,
            "difficulty": "high"
        }),
        json!({
            "id": "playbook-east-west-movement",
            "name": "East-West Movement Hunt",
            "description": "Exercises rapid host isolation and lateral movement detection coverage.",
            "chain_ids": ["chain-lateral-movement"],
            "estimated_duration_minutes": 50,
            "difficulty": "medium"
        }),
    ]
}

fn purple_team_mitre_matrix_data() -> serde_json::Value {
    json!({
        "version": "ATT&CK v14",
        "tactics": [
            {
                "id": "TA0001",
                "name": "Initial Access",
                "coverage": 72.0,
                "techniques": ["T1566", "T1190"]
            },
            {
                "id": "TA0002",
                "name": "Execution",
                "coverage": 58.0,
                "techniques": ["T1059", "T1204"]
            },
            {
                "id": "TA0003",
                "name": "Persistence",
                "coverage": 44.0,
                "techniques": ["T1547", "T1136"]
            },
            {
                "id": "TA0006",
                "name": "Credential Access",
                "coverage": 63.0,
                "techniques": ["T1003", "T1110"]
            },
            {
                "id": "TA0007",
                "name": "Discovery",
                "coverage": 55.0,
                "techniques": ["T1018", "T1082"]
            },
            {
                "id": "TA0008",
                "name": "Lateral Movement",
                "coverage": 49.0,
                "techniques": ["T1021", "T1072"]
            }
        ],
        "summary": {
            "overall_coverage": 56.8,
            "covered_techniques": 12,
            "high_risk_gaps": 4
        }
    })
}

fn purple_team_base_gap_analysis(total_steps: i64) -> serde_json::Value {
    json!({
        "total_attacks": total_steps,
        "detected": 0,
        "missed": 0,
        "detection_rate": 0.0,
        "missed_techniques": [],
        "recommendations": []
    })
}

fn purple_team_risk_score(severity: &str) -> f64 {
    match severity {
        "critical" => 82.5,
        "high" => 64.0,
        "medium" => 41.0,
        _ => 25.0,
    }
}

fn purple_team_chain_by_id(chain_id: &str) -> Option<serde_json::Value> {
    purple_team_chains_catalog()
        .into_iter()
        .find(|chain| chain.get("id").and_then(|value| value.as_str()) == Some(chain_id))
}

fn purple_team_build_exercise(
    selected_chain: &serde_json::Value,
    chain_id: &str,
    target: &str,
    requested_name: Option<&str>,
) -> serde_json::Value {
    let chain_name = selected_chain
        .get("name")
        .and_then(|value| value.as_str())
        .unwrap_or("Purple Team Exercise");
    let severity = selected_chain
        .get("severity")
        .and_then(|value| value.as_str())
        .unwrap_or("medium");
    let total_steps = selected_chain
        .get("steps_count")
        .and_then(|value| value.as_i64())
        .unwrap_or(0);

    json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "name": requested_name
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(chain_name),
        "attack_chain_id": chain_id,
        "target": target,
        "status": "pending",
        "started_at": chrono::Utc::now().to_rfc3339(),
        "completed_at": "",
        "total_steps": total_steps,
        "completed_steps": 0,
        "detected_attacks": 0,
        "missed_attacks": 0,
        "risk_score": purple_team_risk_score(severity),
        "red_team_results": [],
        "blue_team_alerts": [],
        "gap_analysis": purple_team_base_gap_analysis(total_steps),
        "coverage_map": {}
    })
}

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

    let http = reqwest::Client::new();

    // ── Resolve email, name, avatar from provider ──
    let (email, first_name, last_name, avatar_url, provider_label) = match provider {
        "github" => {
            match github_oauth(&http, &code, &redirect_uri).await {
                Ok(info) => info,
                Err(resp) => return resp,
            }
        }
        "google" => {
            match google_oauth(&http, &code, &redirect_uri).await {
                Ok(info) => info,
                Err(resp) => return resp,
            }
        }
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Unknown OAuth provider"}))).into_response(),
    };

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
            .bind(&avatar_url)
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
             VALUES ($1, $2, '', $3, $4, 'admin', $5, true, $6)"
        )
        .bind(&new_user_id)
        .bind(&email)
        .bind(&first_name)
        .bind(&last_name)
        .bind(&new_org_id)
        .bind(&avatar_url)
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
        "message": format!("{} login successful", provider_label),
        "user": {
            "id": user_id,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "avatar_url": avatar_url,
            "role": role
        }
    }))).into_response()
}

// ── GitHub OAuth helper ──
async fn github_oauth(
    http: &reqwest::Client,
    code: &str,
    redirect_uri: &str,
) -> Result<(String, String, String, String, &'static str), axum::response::Response> {
    let client_id = std::env::var("GITHUB_CLIENT_ID").unwrap_or_else(|_| "***REDACTED_GH_OAUTH_CLIENT_ID***".to_string());
    let client_secret = match std::env::var("GITHUB_CLIENT_SECRET") {
        Ok(s) => s,
        Err(_) => return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "GitHub OAuth not configured"}))).into_response()),
    };

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
        Ok(resp) => resp.json().await.unwrap_or_default(),
        Err(_) => return Err((StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to contact GitHub"}))).into_response()),
    };

    let gh_token = match token_data.get("access_token").and_then(|t| t.as_str()) {
        Some(t) => t.to_string(),
        None => {
            let err = token_data.get("error_description").and_then(|e| e.as_str()).unwrap_or("Unknown error");
            return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": format!("GitHub OAuth failed: {}", err)}))).into_response());
        }
    };

    let gh_user: serde_json::Value = http.get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", gh_token))
        .header("User-Agent", "CyberSec-Pro")
        .send().await
        .map_err(|_| (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to get GitHub user info"}))).into_response())?
        .json().await
        .map_err(|_| (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to parse GitHub user info"}))).into_response())?;

    let mut email = gh_user.get("email").and_then(|e| e.as_str()).unwrap_or("").to_string();
    if email.is_empty() {
        if let Ok(resp) = http.get("https://api.github.com/user/emails")
            .header("Authorization", format!("Bearer {}", gh_token))
            .header("User-Agent", "CyberSec-Pro")
            .send().await
        {
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
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Could not retrieve email from GitHub"}))).into_response());
    }

    let gh_name = gh_user.get("name").and_then(|n| n.as_str()).unwrap_or("");
    let gh_login = gh_user.get("login").and_then(|l| l.as_str()).unwrap_or("");
    let avatar = gh_user.get("avatar_url").and_then(|a| a.as_str()).unwrap_or("").to_string();
    let name_parts: Vec<&str> = gh_name.split_whitespace().collect();
    let first = if !name_parts.is_empty() { name_parts[0].to_string() } else { gh_login.to_string() };
    let last = if name_parts.len() > 1 { name_parts[1..].join(" ") } else { String::new() };

    Ok((email, first, last, avatar, "GitHub"))
}

// ── Google OAuth helper ──
async fn google_oauth(
    http: &reqwest::Client,
    code: &str,
    redirect_uri: &str,
) -> Result<(String, String, String, String, &'static str), axum::response::Response> {
    let client_id = std::env::var("GOOGLE_CLIENT_ID").unwrap_or_else(|_|
        "547951331800-kqkuc6aohfr7ptt26p38mnqfdvt7b6mu.apps.googleusercontent.com".to_string()
    );
    let client_secret = match std::env::var("GOOGLE_CLIENT_SECRET") {
        Ok(s) => s,
        Err(_) => return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Google OAuth not configured (missing GOOGLE_CLIENT_SECRET)"}))).into_response()),
    };

    // Exchange authorization code for tokens
    let token_res = http.post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code),
            ("client_id", &client_id),
            ("client_secret", &client_secret),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await;

    let token_data: serde_json::Value = match token_res {
        Ok(resp) => resp.json().await.unwrap_or_default(),
        Err(_) => return Err((StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to contact Google"}))).into_response()),
    };

    let id_token = token_data.get("id_token").and_then(|t| t.as_str()).unwrap_or("");
    let access_token = token_data.get("access_token").and_then(|t| t.as_str()).unwrap_or("");

    if access_token.is_empty() {
        let err = token_data.get("error_description").and_then(|e| e.as_str()).unwrap_or("Token exchange failed");
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": format!("Google OAuth failed: {}", err)}))).into_response());
    }

    // Try id_token first (contains user info as JWT), fallback to userinfo endpoint
    let (email, first, last, picture) = if !id_token.is_empty() {
        // Decode JWT payload (id_token is base64url: header.payload.signature)
        let parts: Vec<&str> = id_token.split('.').collect();
        if parts.len() >= 2 {
            use base64::Engine;
            let engine = base64::engine::general_purpose::URL_SAFE_NO_PAD;
            if let Ok(payload_bytes) = engine.decode(parts[1]) {
                if let Ok(claims) = serde_json::from_slice::<serde_json::Value>(&payload_bytes) {
                    let em = claims.get("email").and_then(|e| e.as_str()).unwrap_or("").to_string();
                    let gn = claims.get("given_name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                    let fn_ = claims.get("family_name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                    let pic = claims.get("picture").and_then(|p| p.as_str()).unwrap_or("").to_string();
                    (em, gn, fn_, pic)
                } else {
                    (String::new(), String::new(), String::new(), String::new())
                }
            } else {
                (String::new(), String::new(), String::new(), String::new())
            }
        } else {
            (String::new(), String::new(), String::new(), String::new())
        }
    } else {
        (String::new(), String::new(), String::new(), String::new())
    };

    // Fallback: use userinfo endpoint if id_token decoding failed
    let (email, first, last, picture) = if email.is_empty() {
        let user_info: serde_json::Value = http.get("https://www.googleapis.com/oauth2/v2/userinfo")
            .header("Authorization", format!("Bearer {}", access_token))
            .send().await
            .map_err(|_| (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to get Google user info"}))).into_response())?
            .json().await
            .map_err(|_| (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to parse Google user info"}))).into_response())?;

        let em = user_info.get("email").and_then(|e| e.as_str()).unwrap_or("").to_string();
        let gn = user_info.get("given_name").and_then(|n| n.as_str()).unwrap_or("").to_string();
        let fn_ = user_info.get("family_name").and_then(|n| n.as_str()).unwrap_or("").to_string();
        let pic = user_info.get("picture").and_then(|p| p.as_str()).unwrap_or("").to_string();
        (em, gn, fn_, pic)
    } else {
        (email, first, last, picture)
    };

    if email.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Could not retrieve email from Google"}))).into_response());
    }

    Ok((email, first, last, picture, "Google"))
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

    // Validate user_id is a valid UUID to prevent path traversal
    if uuid::Uuid::parse_str(&user.user_id).is_err() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid user session"}))).into_response();
    }

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
    let org_id = user.org_id.as_deref().unwrap_or("");
    let scan = if !org_id.is_empty() {
        sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
            "SELECT s.id, s.status, s.output, CAST(s.findings AS TEXT), s.error_log, s.target, t.name, t.command_template FROM scans s LEFT JOIN tools t ON s.tool_id = t.id WHERE s.id = $1 AND s.organization_id = $2"
        )
        .bind(&scan_id)
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
            "SELECT s.id, s.status, s.output, CAST(s.findings AS TEXT), s.error_log, s.target, t.name, t.command_template FROM scans s LEFT JOIN tools t ON s.tool_id = t.id WHERE s.id = $1 AND s.user_id = $2"
        )
        .bind(&scan_id)
        .bind(&user.user_id)
        .fetch_optional(&state.db)
        .await
    };

    match scan {
        Ok(Some((id, status, output, findings, error_log, target, tool_name, command))) => {
            let findings_val: serde_json::Value = findings.and_then(|f| serde_json::from_str(&f).ok()).unwrap_or(json!(null));
            let output_str = output.unwrap_or_default();
            Json(json!({
                "scan": {
                    "id": id,
                    "status": status,
                    "output": output_str,
                    "target": target,
                    "tool_name": tool_name,
                    "command": command,
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
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Query the actual scan from DB
    let org_id = user.org_id.as_deref().unwrap_or("");
    let row: Option<(Option<serde_json::Value>, Option<String>)> = if !org_id.is_empty() {
        sqlx::query_as(
            "SELECT findings, output FROM scans WHERE id = $1 AND organization_id = $2"
        )
        .bind(&scan_id)
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None)
    } else {
        sqlx::query_as(
            "SELECT findings, output FROM scans WHERE id = $1 AND user_id = $2"
        )
        .bind(&scan_id)
        .bind(&user.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None)
    };

    let (findings_json, _raw_output) = match row {
        Some(r) => r,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "Scan not found"}))).into_response(),
    };

    let findings_val = findings_json.unwrap_or(json!({}));

    // Extract summary from the parsed findings (parsers store summary as an object)
    let summary = findings_val.get("summary").cloned().unwrap_or(json!({}));
    let total = summary.get("total").and_then(|v| v.as_i64()).unwrap_or(0);
    let critical = summary.get("critical").and_then(|v| v.as_i64()).unwrap_or(0);
    let high = summary.get("high").and_then(|v| v.as_i64()).unwrap_or(0);
    let medium = summary.get("medium").and_then(|v| v.as_i64()).unwrap_or(0);
    let low = summary.get("low").and_then(|v| v.as_i64()).unwrap_or(0);
    let open_ports = summary.get("open_ports").and_then(|v| v.as_i64()).unwrap_or(0);

    // Calculate security score: 100 minus deductions per severity
    let score = (100 - (critical * 25) - (high * 10) - (medium * 5) - (low * 2)).max(0);

    // Flatten findings into a display-friendly array
    let mut all_findings: Vec<serde_json::Value> = Vec::new();

    // Services (open ports)
    if let Some(services) = findings_val.get("services").and_then(|s| s.as_array()) {
        for svc in services {
            let port = svc.get("port").and_then(|p| p.as_u64()).unwrap_or(0);
            let service_name = svc.get("service").and_then(|s| s.as_str()).unwrap_or("");
            all_findings.push(json!({
                "severity": "info",
                "title": format!("Open Port {}", port),
                "description": format!("Port {}/{} — {}", port,
                    svc.get("protocol").and_then(|p| p.as_str()).unwrap_or("tcp"),
                    service_name),
                "category": "open_port"
            }));
        }
    }

    // Vulnerabilities
    if let Some(vulns) = findings_val.get("vulnerabilities").and_then(|v| v.as_array()) {
        for vuln in vulns {
            all_findings.push(json!({
                "severity": vuln.get("severity").and_then(|s| s.as_str()).unwrap_or("medium"),
                "title": vuln.get("title").or(vuln.get("description")).and_then(|t| t.as_str()).unwrap_or("Vulnerability"),
                "description": vuln.get("description").and_then(|d| d.as_str()).unwrap_or(""),
                "category": "vulnerability"
            }));
        }
    }

    // Generic findings array (nikto, nuclei, etc.)
    if let Some(f_list) = findings_val.get("findings").and_then(|f| f.as_array()) {
        for f in f_list {
            all_findings.push(json!({
                "severity": f.get("severity").and_then(|s| s.as_str()).unwrap_or("info"),
                "title": f.get("title").or(f.get("description")).and_then(|t| t.as_str()).unwrap_or("Finding"),
                "description": f.get("description").and_then(|d| d.as_str()).unwrap_or(""),
                "category": f.get("category").and_then(|c| c.as_str()).unwrap_or("general")
            }));
        }
    }

    // Subdomains
    if let Some(subs) = findings_val.get("subdomains").and_then(|s| s.as_array()) {
        for sub in subs {
            let name = sub.as_str().unwrap_or("");
            all_findings.push(json!({
                "severity": "info",
                "title": format!("Subdomain: {}", name),
                "description": name,
                "category": "subdomain"
            }));
        }
    }

    // Directories
    if let Some(dirs) = findings_val.get("directories").and_then(|d| d.as_array()) {
        for dir in dirs {
            all_findings.push(json!({
                "severity": dir.get("severity").and_then(|s| s.as_str()).unwrap_or("info"),
                "title": format!("Directory: {}", dir.get("path").and_then(|p| p.as_str()).unwrap_or("")),
                "description": format!("Status {} — {}", dir.get("status").and_then(|s| s.as_u64()).unwrap_or(0), dir.get("path").and_then(|p| p.as_str()).unwrap_or("")),
                "category": "directory"
            }));
        }
    }

    // Return flat structure that frontend expects directly
    Json(json!({
        "scan_id": scan_id,
        "summary": {
            "score": score,
            "total": total,
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "open_ports": open_ports
        },
        "findings": all_findings
    })).into_response()
}

pub async fn scan_status(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let status = if !org_id.is_empty() {
        sqlx::query_as::<_, (String,)>(
            "SELECT status FROM scans WHERE id = $1 AND organization_id = $2"
        )
        .bind(&scan_id)
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query_as::<_, (String,)>(
            "SELECT status FROM scans WHERE id = $1 AND user_id = $2"
        )
        .bind(&scan_id)
        .bind(&user.user_id)
        .fetch_optional(&state.db)
        .await
    };

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

    // Encrypt SSH password if provided
    let ssh_password_enc = body.get("ssh_password").and_then(|v| v.as_str()).and_then(|pwd| {
        if pwd.is_empty() { return None; }
        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default-secret".into());
        crate::services::connection_engine::crypto::encrypt_password(pwd, &secret).ok()
    });

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
         ssh_password_encrypted = COALESCE($12, ssh_password_encrypted), \
         updated_at = CURRENT_TIMESTAMP \
         WHERE id = $13 AND organization_id = $14"
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
    .bind(ssh_password_enc.as_deref())
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

    // Fetch agent details
    let agent = sqlx::query(
        "SELECT ssh_host, ssh_port, ssh_username, ssh_password_encrypted, ssh_key_path, connection_type, platform FROM agents WHERE id = $1 AND organization_id = $2"
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
    let ssh_username: Option<String> = agent.get("ssh_username");
    let ssh_password_enc: Option<String> = agent.get("ssh_password_encrypted");
    let ssh_key_path: Option<String> = agent.get("ssh_key_path");
    let platform: Option<String> = agent.get("platform");

    let host = match ssh_host {
        Some(h) if !h.is_empty() => h,
        _ => return Json(json!({"success": false, "error": "No SSH host configured"})).into_response(),
    };
    let port = ssh_port.unwrap_or(22) as u16;
    let username = ssh_username.unwrap_or_else(|| "root".into());

    // Decrypt password if stored
    let password = ssh_password_enc.and_then(|enc| {
        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default-secret".into());
        crate::services::connection_engine::crypto::decrypt_password(&enc, &secret).ok()
    });

    // Real SSH connection test
    let params = crate::services::connection_engine::SshConnParams {
        host: host.clone(),
        port,
        username: username.clone(),
        password,
        private_key: ssh_key_path,
        passphrase: None,
        timeout_secs: 10,
    };

    let result = crate::services::connection_engine::test_ssh_connection(&params).await;

    if result.success {
        // Update agent with discovered info
        let _ = sqlx::query(
            "UPDATE agents SET status = 'online', last_heartbeat = CURRENT_TIMESTAMP, \
             hostname = COALESCE($1, hostname), os_info = COALESCE($2, os_info), \
             ip_address = COALESCE($3, ip_address), \
             cpu_usage = 0, memory_usage = 0 \
             WHERE id = $4"
        )
        .bind(&result.hostname)
        .bind(&result.os_info)
        .bind(result.ip_addresses.first())
        .bind(&agent_id)
        .execute(&state.db)
        .await;

        Json(json!({
            "success": true,
            "agent_id": agent_id,
            "connection": {
                "type": "ssh",
                "host": host,
                "port": port,
                "username": username,
                "latency_ms": result.latency_ms,
                "ssh_banner": result.ssh_banner,
            },
            "system": {
                "hostname": result.hostname,
                "os": result.os_info,
                "kernel": result.kernel,
                "uptime": result.uptime,
                "cpu_cores": result.cpu_cores,
                "memory_total_mb": result.memory_total_mb,
                "memory_used_mb": result.memory_used_mb,
                "disk_total_gb": result.disk_total_gb,
                "disk_used_gb": result.disk_used_gb,
                "ip_addresses": result.ip_addresses,
            },
            "message": format!("✅ SSH connected to {}@{}:{}", username, host, port)
        })).into_response()
    } else {
        // Try TCP-only fallback for error diagnostics
        let tcp_reachable = crate::services::connection_engine::scan_port(&host, port, 5000).await;

        Json(json!({
            "success": false,
            "agent_id": agent_id,
            "error": result.error.unwrap_or_else(|| "Connection failed".into()),
            "diagnostics": {
                "tcp_port_reachable": tcp_reachable,
                "host": host,
                "port": port,
                "hint": if !tcp_reachable {
                    "Port is not reachable. Check: 1) Host IP is correct 2) SSH service is running 3) Firewall allows port"
                } else {
                    "Port is reachable but SSH auth failed. Check: 1) Username 2) Password/Key 3) SSH config (AllowUsers, PermitRootLogin)"
                }
            }
        })).into_response()
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
    let schedules = sqlx::query_as::<_, (
        String, String, Option<String>, String, bool, String,
        Option<String>, Option<String>, Option<i32>, i32,
        Option<String>, String,
    )>(
        "SELECT id, name, cron_expression, COALESCE(tool_name,''), is_active, COALESCE(target,''),
                CAST(last_run AS TEXT), CAST(next_run AS TEXT), run_count, COALESCE(hour,0),
                schedule_type, CAST(created_at AS TEXT)
         FROM scheduled_scans WHERE organization_id = $1 ORDER BY created_at DESC"
    )
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = schedules.iter().map(|(id, name, cron, tool_name, active, target, last_run, next_run, run_count, _hour, sched_type, created)| {
        let status = if *active { "active" } else { "paused" };
        json!({
            "id": id,
            "name": name,
            "cron_expression": cron,
            "tool_name": tool_name,
            "tool": tool_name,
            "is_active": active,
            "status": status,
            "target": target,
            "next_run": next_run,
            "last_run": last_run,
            "run_count": run_count.unwrap_or(0),
            "schedule_type": sched_type,
            "created_at": created
        })
    }).collect();

    Json(json!({"schedules": list})).into_response()
}

pub async fn create_schedule(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Check scheduled_scans feature flag
    let org_id_str = user.org_id.as_deref().unwrap_or("");
    let org_plan: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = $1")
        .bind(org_id_str)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    let plan = org_plan.map(|p| p.0).unwrap_or_else(|| "trial".into());
    let plan_configs = crate::services::plan::get_plan_configs();
    if let Some(config) = plan_configs.get(plan.as_str()) {
        if !config.features.scheduled_scans {
            return (StatusCode::PAYMENT_REQUIRED, Json(json!({
                "error": "Scheduled scans require Starter or higher plan."
            }))).into_response();
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("New Schedule");
    let cron = body.get("cron_expression").and_then(|v| v.as_str()).unwrap_or("0 0 * * *");
    let tool_name = body.get("tool_name").and_then(|v| v.as_str())
        .or_else(|| body.get("tool").and_then(|v| v.as_str()))
        .unwrap_or("");
    let target = body.get("target").and_then(|v| v.as_str()).unwrap_or("");
    let schedule_type = body.get("schedule_type").and_then(|v| v.as_str()).unwrap_or("cron");
    let agent_id = body.get("agent_id").and_then(|v| v.as_str());
    let params = body.get("parameters").cloned().unwrap_or(json!({}));

    // Compute first next_run
    let next_run = crate::services::scheduler::next_cron_fire(cron, chrono::Utc::now());

    let result = sqlx::query(
        "INSERT INTO scheduled_scans (id, user_id, organization_id, name, cron_expression, tool_name, target, schedule_type, parameters, agent_id, is_active, next_run, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, TRUE, $11, NOW(), NOW())"
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .bind(name)
    .bind(cron)
    .bind(tool_name)
    .bind(target)
    .bind(schedule_type)
    .bind(&params)
    .bind(agent_id)
    .bind(next_run)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => Json(json!({"id": id, "message": "Schedule created", "next_run": next_run})).into_response(),
        Err(e) => {
            tracing::error!("Failed to create schedule: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to create schedule: {}", e)}))).into_response()
        }
    }
}

pub async fn update_schedule(
    Path(schedule_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let name = body.get("name").and_then(|v| v.as_str());
    let cron = body.get("cron_expression").and_then(|v| v.as_str());
    let tool_name = body.get("tool_name").and_then(|v| v.as_str())
        .or_else(|| body.get("tool").and_then(|v| v.as_str()));
    let target = body.get("target").and_then(|v| v.as_str());

    let mut sets = Vec::new();
    let mut idx = 1;
    if name.is_some() { sets.push(format!("name = ${}", idx)); idx += 1; }
    if cron.is_some() { sets.push(format!("cron_expression = ${}", idx)); idx += 1; }
    if tool_name.is_some() { sets.push(format!("tool_name = ${}", idx)); idx += 1; }
    if target.is_some() { sets.push(format!("target = ${}", idx)); idx += 1; }

    if sets.is_empty() {
        return Json(json!({"message": "Nothing to update", "id": schedule_id})).into_response();
    }

    // Always update updated_at
    sets.push("updated_at = NOW()".to_string());

    let user_param = idx;
    let id_param = idx + 1;
    let sql = format!(
        "UPDATE scheduled_scans SET {} WHERE id = ${} AND user_id = ${}",
        sets.join(", "), id_param, user_param
    );

    let mut query = sqlx::query(&sql);
    if let Some(v) = name { query = query.bind(v); }
    if let Some(v) = cron { query = query.bind(v); }
    if let Some(v) = tool_name { query = query.bind(v); }
    if let Some(v) = target { query = query.bind(v); }
    query = query.bind(&user.user_id);
    query = query.bind(&schedule_id);

    let _ = query.execute(&state.db).await;

    // Recompute next_run if cron changed
    if let Some(new_cron) = cron {
        let next = crate::services::scheduler::next_cron_fire(new_cron, chrono::Utc::now());
        let _ = sqlx::query("UPDATE scheduled_scans SET next_run = $1 WHERE id = $2")
            .bind(next).bind(&schedule_id).execute(&state.db).await;
    }

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

/// Enable continuous (hourly) monitoring for a project.
/// Creates scheduled scans with `0 * * * *` cron (every hour) for a set of
/// security tools against the project targets. Requires Enterprise plan.
pub async fn enable_continuous_monitoring(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    // Require Enterprise plan
    let org_plan: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = $1")
        .bind(&org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    let plan = org_plan.map(|p| p.0).unwrap_or_else(|| "trial".into());
    if plan != "enterprise" {
        return (StatusCode::PAYMENT_REQUIRED, Json(json!({
            "error": "Continuous monitoring requires Enterprise plan."
        }))).into_response();
    }

    let project_id = body.get("project_id").and_then(|v| v.as_i64());
    let target = body.get("target").and_then(|v| v.as_str()).unwrap_or("");
    if target.is_empty() && project_id.is_none() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Either target or project_id is required"}))).into_response();
    }

    // Tools for continuous monitoring: run key security checks hourly
    let monitoring_tools = vec!["nmap", "nuclei", "whatweb", "sslscan", "httpx"];
    let cron_hourly = "0 * * * *";
    let mut created = Vec::new();

    for tool_name in &monitoring_tools {
        let id = uuid::Uuid::new_v4().to_string();
        let name = format!("Continuous Monitor: {} → {}", tool_name, target);
        let next_run = crate::services::scheduler::next_cron_fire(cron_hourly, chrono::Utc::now());

        let result = sqlx::query(
            "INSERT INTO scheduled_scans (id, user_id, organization_id, name, cron_expression, tool_name, target, schedule_type, parameters, is_active, next_run, project_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'continuous', '{}'::jsonb, TRUE, $8, $9, NOW(), NOW())"
        )
        .bind(&id)
        .bind(&user.user_id)
        .bind(&org_id)
        .bind(&name)
        .bind(cron_hourly)
        .bind(tool_name)
        .bind(target)
        .bind(next_run)
        .bind(project_id.map(|v| v as i32))
        .execute(&state.db)
        .await;

        if result.is_ok() {
            created.push(json!({"id": id, "tool": tool_name, "next_run": next_run}));
        }
    }

    Json(json!({
        "message": format!("Continuous monitoring enabled with {} tools", created.len()),
        "schedules": created,
        "cron": cron_hourly,
        "target": target
    })).into_response()
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

pub async fn roles_list(
    _user: AuthUser,
) -> impl IntoResponse {
    Json(json!({
        "roles": [
            {"id": "viewer", "name": "Viewer", "level": 1, "description": "Read-only access to dashboards and reports"},
            {"id": "user", "name": "User", "level": 2, "description": "Can run scans, manage own agents and view results"},
            {"id": "analyst", "name": "Analyst", "level": 3, "description": "Can manage all scans, reports, and team resources"},
            {"id": "admin", "name": "Admin", "level": 4, "description": "Full organization management, billing, and team control"},
            {"id": "superadmin", "name": "Super Admin", "level": 5, "description": "Platform-level access, can impersonate and manage all orgs"}
        ]
    })).into_response()
}

pub async fn plan_info(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.clone().unwrap_or_else(|| user.user_id.clone());

    // Fetch plan and org created_at
    let org_row: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT COALESCE(plan_type, 'trial'), CAST(created_at AS TEXT) FROM organizations WHERE id = $1"
    )
    .bind(&org_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let plan = org_row.as_ref().map(|r| r.0.clone()).unwrap_or_else(|| "trial".to_string());
    let org_created = org_row.as_ref().and_then(|r| r.1.clone());

    let configs = crate::services::plan::get_plan_configs();
    let config = configs.get(plan.as_str());

    // Calculate usage
    let scans_today: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND created_at::date = CURRENT_DATE"
    )
    .bind(&org_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let scans_this_month: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)"
    )
    .bind(&org_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let running_scans: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND status IN ('running', 'pending')"
    )
    .bind(&org_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let total_scans: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scans WHERE organization_id = $1"
    )
    .bind(&org_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let team_members: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = TRUE"
    )
    .bind(&org_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let online_agents: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM agents WHERE organization_id = $1 AND status = 'online'"
    )
    .bind(&org_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let total_tools: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM tools WHERE is_active = TRUE"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    // Calculate trial days remaining
    let trial_days_remaining = if let Some(ref cfg) = config {
        if cfg.trial_days > 0 {
            if let Some(ref created) = org_created {
                chrono::NaiveDateTime::parse_from_str(
                    created.split('.').next().unwrap_or(created),
                    "%Y-%m-%d %H:%M:%S"
                ).ok().map(|dt| {
                    let days_elapsed = (chrono::Utc::now().naive_utc() - dt).num_days();
                    (cfg.trial_days as i64 - days_elapsed).max(0)
                }).unwrap_or(0)
            } else { 0 }
        } else { -1 } // -1 = not a trial plan
    } else { 0 };

    let daily_limit = config.as_ref().map(|c| c.daily_scan_limit).unwrap_or(0);
    let monthly_limit = config.as_ref().map(|c| c.monthly_scan_limit).unwrap_or(0);
    let concurrent_limit = config.as_ref().map(|c| c.concurrent_scans).unwrap_or(0);

    let scans_remaining_daily = if daily_limit > 0 {
        (daily_limit as i64 - scans_today.0).max(0)
    } else { -1 };

    let scans_remaining_monthly = if monthly_limit > 0 {
        (monthly_limit as i64 - scans_this_month.0).max(0)
    } else { -1 };

    Json(json!({
        "plan": plan,
        "config": config,
        "usage": {
            "scans_today": scans_today.0,
            "scans_this_month": scans_this_month.0,
            "scans_remaining_daily": scans_remaining_daily,
            "scans_remaining_monthly": scans_remaining_monthly,
            "running_scans": running_scans.0,
            "total_scans": total_scans.0,
            "team_members": team_members.0,
            "online_agents": online_agents.0,
            "tools_accessible": total_tools.0,
            "tools_total": total_tools.0,
            "concurrent_limit": concurrent_limit,
            "daily_limit": daily_limit,
            "monthly_limit": monthly_limit
        },
        "trial": {
            "is_trial": plan == "trial",
            "days_remaining": trial_days_remaining,
            "expired": trial_days_remaining == 0 && plan == "trial"
        }
    })).into_response()
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

    let valid_roles = crate::middleware::auth_middleware::VALID_ROLES;
    if !valid_roles.contains(&role.as_str()) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Invalid role. Must be one of: {:?}", valid_roles)}))).into_response();
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
    user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.unwrap_or_default();
    let exercises = purple_team_store()
        .lock()
        .ok()
        .and_then(|store| store.get(&org_id).cloned())
        .unwrap_or_default();

    let total_exercises = exercises.len() as i64;
    let running = exercises.iter().filter(|exercise| {
        matches!(exercise.get("status").and_then(|value| value.as_str()), Some("running") | Some("pending"))
    }).count() as i64;
    let completed = exercises.iter().filter(|exercise| {
        exercise.get("status").and_then(|value| value.as_str()) == Some("completed")
    }).count() as i64;
    let total_attack_steps: i64 = exercises.iter().map(|exercise| {
        exercise.get("total_steps").and_then(|value| value.as_i64()).unwrap_or(0)
    }).sum();
    let total_detected: i64 = exercises.iter().map(|exercise| {
        exercise.get("detected_attacks").and_then(|value| value.as_i64()).unwrap_or(0)
    }).sum();
    let total_missed: i64 = exercises.iter().map(|exercise| {
        exercise.get("missed_attacks").and_then(|value| value.as_i64()).unwrap_or(0)
    }).sum();
    let average_risk_score = if total_exercises > 0 {
        exercises.iter().map(|exercise| {
            exercise.get("risk_score").and_then(|value| value.as_f64()).unwrap_or(0.0)
        }).sum::<f64>() / total_exercises as f64
    } else {
        0.0
    };
    let detection_rate = if total_attack_steps > 0 {
        (total_detected as f64 / total_attack_steps as f64) * 100.0
    } else {
        0.0
    };

    Json(json!({
        "total_exercises": total_exercises,
        "running": running,
        "completed": completed,
        "total_attack_steps": total_attack_steps,
        "total_detected": total_detected,
        "total_missed": total_missed,
        "detection_rate": detection_rate,
        "average_risk_score": average_risk_score,
        "available_chains": purple_team_chains_catalog().len(),
        "available_playbooks": purple_team_playbooks_catalog().len(),
        "exercises": total_exercises,
        "active_chains": purple_team_chains_catalog().len(),
        "playbooks": purple_team_playbooks_catalog().len(),
        "coverage": detection_rate
    })).into_response()
}

pub async fn purple_team_chains(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!(purple_team_chains_catalog())).into_response()
}

pub async fn purple_team_playbooks(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!(purple_team_playbooks_catalog())).into_response()
}

pub async fn purple_team_exercises(
    user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.unwrap_or_default();
    let exercises = purple_team_store()
        .lock()
        .ok()
        .and_then(|store| store.get(&org_id).cloned())
        .unwrap_or_default();
    Json(json!(exercises)).into_response()
}

pub async fn purple_team_exercise_detail(
    Path(exercise_id): Path<String>,
    user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.unwrap_or_default();
    let exercise = purple_team_store()
        .lock()
        .ok()
        .and_then(|store| store.get(&org_id).cloned())
        .and_then(|items| items.into_iter().find(|item| item.get("id").and_then(|value| value.as_str()) == Some(exercise_id.as_str())));

    match exercise {
        Some(item) => Json(item).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Exercise not found"}))).into_response(),
    }
}

pub async fn purple_team_create_exercise(
    user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = user.org_id.unwrap_or_default();
    let chain_id = match body.get("chain_id").and_then(|value| value.as_str()) {
        Some(value) if !value.trim().is_empty() => value.trim(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "chain_id is required"}))).into_response(),
    };
    let target = match body.get("target").and_then(|value| value.as_str()) {
        Some(value) if !value.trim().is_empty() => value.trim(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "target is required"}))).into_response(),
    };

    let selected_chain = match purple_team_chain_by_id(chain_id) {
        Some(chain) => chain,
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Unknown attack chain"}))).into_response(),
    };
    let exercise = purple_team_build_exercise(
        &selected_chain,
        chain_id,
        target,
        body.get("name").and_then(|value| value.as_str()),
    );

    match purple_team_store().lock() {
        Ok(mut store) => {
            let entries = store.entry(org_id).or_default();
            entries.insert(0, exercise.clone());
            (StatusCode::CREATED, Json(exercise)).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Exercise store unavailable"}))).into_response(),
    }
}

pub async fn purple_team_mitre(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(purple_team_mitre_matrix_data()).into_response()
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
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let agent_id = body.get("agent_id").and_then(|v| v.as_str()).or_else(|| body.get("agent_id").and_then(|v| v.as_i64()).map(|_| "")).unwrap_or("");
    let agent_id_str = body.get("agent_id").map(|v| v.to_string().replace('"', "")).unwrap_or_default();
    let agent_id_val = if agent_id.is_empty() { &agent_id_str } else { agent_id };
    let command = match body.get("command").and_then(|v| v.as_str()) {
        Some(c) if !c.is_empty() => c.to_string(),
        _ => return Json(json!({"error": "No command provided"})).into_response(),
    };

    // Block dangerous commands
    let blocked = ["rm -rf /", "mkfs", "dd if=/dev/zero", "> /dev/sda", ":(){ :|:& };:"];
    for b in &blocked {
        if command.contains(b) {
            return Json(json!({"error": "Command blocked for safety", "output": "", "exit_code": -1})).into_response();
        }
    }

    // Fetch agent
    use sqlx::Row;
    let agent = sqlx::query(
        "SELECT ssh_host, ssh_port, ssh_username, ssh_password_encrypted, ssh_key_path FROM agents WHERE id = $1 AND organization_id = $2"
    )
    .bind(agent_id_val)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let agent = match agent {
        Some(a) => a,
        None => return Json(json!({"error": "Agent not found", "output": "", "exit_code": -1})).into_response(),
    };

    let ssh_host: Option<String> = agent.get("ssh_host");
    let ssh_port: Option<i32> = agent.get("ssh_port");
    let ssh_username: Option<String> = agent.get("ssh_username");
    let ssh_password_enc: Option<String> = agent.get("ssh_password_encrypted");
    let ssh_key_path: Option<String> = agent.get("ssh_key_path");

    let host = match ssh_host {
        Some(h) if !h.is_empty() => h,
        _ => return Json(json!({"error": "No SSH host configured for this agent", "output": "", "exit_code": -1})).into_response(),
    };

    let password = ssh_password_enc.and_then(|enc| {
        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default-secret".into());
        crate::services::connection_engine::crypto::decrypt_password(&enc, &secret).ok()
    });

    let params = crate::services::connection_engine::SshConnParams {
        host: host.clone(),
        port: ssh_port.unwrap_or(22) as u16,
        username: ssh_username.unwrap_or_else(|| "root".into()),
        password,
        private_key: ssh_key_path,
        passphrase: None,
        timeout_secs: 30,
    };

    match crate::services::connection_engine::ssh_execute(&params, &command).await {
        Ok(res) => {
            let output = if !res.stdout.is_empty() {
                if !res.stderr.is_empty() { format!("{}\n{}", res.stdout, res.stderr) } else { res.stdout }
            } else {
                res.stderr
            };
            Json(json!({
                "output": output,
                "exit_code": res.exit_code,
                "duration_ms": res.duration_ms
            })).into_response()
        }
        Err(e) => {
            Json(json!({"error": e, "output": "", "exit_code": -1})).into_response()
        }
    }
}

pub async fn terminal_test_connection(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let agent_id = body.get("agent_id").and_then(|v| v.as_str()).or_else(|| body.get("agent_id").and_then(|v| v.as_i64()).map(|_| "")).unwrap_or("");
    let agent_id_str = body.get("agent_id").map(|v| v.to_string().replace('"', "")).unwrap_or_default();
    let agent_id_val = if agent_id.is_empty() { &agent_id_str } else { agent_id };

    use sqlx::Row;
    let agent = sqlx::query(
        "SELECT ssh_host, ssh_port, ssh_username, ssh_password_encrypted, ssh_key_path, name, platform FROM agents WHERE id = $1 AND organization_id = $2"
    )
    .bind(agent_id_val)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let agent = match agent {
        Some(a) => a,
        None => return Json(json!({"connected": false, "error": "Agent not found"})).into_response(),
    };

    let ssh_host: Option<String> = agent.get("ssh_host");
    let ssh_port: Option<i32> = agent.get("ssh_port");
    let ssh_username: Option<String> = agent.get("ssh_username");
    let ssh_password_enc: Option<String> = agent.get("ssh_password_encrypted");
    let ssh_key_path: Option<String> = agent.get("ssh_key_path");
    let agent_name: Option<String> = agent.get("name");
    let platform: Option<String> = agent.get("platform");

    let host = match ssh_host {
        Some(h) if !h.is_empty() => h,
        _ => return Json(json!({"connected": false, "error": "No SSH host configured. Edit the agent and set SSH host/IP."})).into_response(),
    };

    let password = ssh_password_enc.and_then(|enc| {
        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default-secret".into());
        crate::services::connection_engine::crypto::decrypt_password(&enc, &secret).ok()
    });

    let params = crate::services::connection_engine::SshConnParams {
        host: host.clone(),
        port: ssh_port.unwrap_or(22) as u16,
        username: ssh_username.clone().unwrap_or_else(|| "root".into()),
        password,
        private_key: ssh_key_path,
        passphrase: None,
        timeout_secs: 10,
    };

    let result = crate::services::connection_engine::test_ssh_connection(&params).await;

    if result.success {
        // Update agent status
        let _ = sqlx::query("UPDATE agents SET status = 'online', last_heartbeat = CURRENT_TIMESTAMP WHERE id = $1")
            .bind(agent_id_val).execute(&state.db).await;

        let sys_info = format!("{} | {} | {}",
            result.hostname.as_deref().unwrap_or("unknown"),
            result.os_info.as_deref().unwrap_or("unknown"),
            result.kernel.as_deref().unwrap_or(""));

        Json(json!({
            "connected": true,
            "system_info": sys_info,
            "agent_name": agent_name,
            "platform": platform,
            "hostname": result.hostname,
            "latency_ms": result.latency_ms,
        })).into_response()
    } else {
        Json(json!({
            "connected": false,
            "error": result.error.unwrap_or_else(|| "SSH connection failed".into()),
        })).into_response()
    }
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
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");

    // Collect user's data
    let scans = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, target, status, CAST(created_at AS TEXT) FROM scans WHERE user_id = $1 ORDER BY created_at DESC"
    ).bind(&user.user_id).fetch_all(&state.db).await.unwrap_or_default();

    let scan_list: Vec<serde_json::Value> = scans.iter().map(|(id, target, status, created)| {
        json!({"id": id, "target": target, "status": status, "created_at": created})
    }).collect();

    let audits = sqlx::query_as::<_, (String, String, String)>(
        "SELECT action, COALESCE(status,''), CAST(created_at AS TEXT) FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200"
    ).bind(&user.user_id).fetch_all(&state.db).await.unwrap_or_default();

    let audit_list: Vec<serde_json::Value> = audits.iter().map(|(action, status, created)| {
        json!({"action": action, "status": status, "created_at": created})
    }).collect();

    let user_data: Option<(String, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT email, first_name, last_name, role FROM users WHERE id = $1"
    ).bind(&user.user_id).fetch_optional(&state.db).await.unwrap_or(None);

    let profile = user_data.map(|(email, first, last, role)| json!({
        "email": email, "first_name": first, "last_name": last, "role": role
    })).unwrap_or(json!({}));

    Json(json!({
        "status": "complete",
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "data": {
            "profile": profile,
            "scans": scan_list,
            "audit_logs": audit_list,
            "organization_id": org_id
        }
    })).into_response()
}

pub async fn gdpr_delete_account(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Anonymize user data instead of hard delete (preserves referential integrity)
    let anon_email = format!("deleted-{}@deleted.local", &user.user_id[..8]);
    let result = sqlx::query(
        "UPDATE users SET email = $1, first_name = 'Deleted', last_name = 'User', is_active = FALSE, mfa_enabled = FALSE, mfa_secret = NULL, password_hash = 'DELETED' WHERE id = $2"
    )
    .bind(&anon_email)
    .bind(&user.user_id)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            // Delete personal audit logs
            let _ = sqlx::query("DELETE FROM audit_logs WHERE user_id = $1").bind(&user.user_id).execute(&state.db).await;
            Json(json!({"message": "Account data deleted and anonymized", "status": "complete"})).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed: {}", e)}))).into_response(),
    }
}

// ── Integrations ───────────────────────────────────────────

pub async fn list_integrations(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let rows = sqlx::query_as::<_, (String, String, String, Option<String>, bool, Option<String>, Option<String>, Option<String>, String)>(
        "SELECT id, name, integration_type, webhook_url, is_active, CAST(last_triggered_at AS TEXT), last_error, config::text, CAST(created_at AS TEXT) FROM integrations WHERE organization_id = $1 ORDER BY created_at DESC"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = rows.iter().map(|(id, name, itype, url, active, last_trig, last_err, config, created)| {
        let config_val: serde_json::Value = config.as_deref().and_then(|c| serde_json::from_str(c).ok()).unwrap_or(json!({}));
        json!({
            "id": id,
            "name": name,
            "integration_type": itype,
            "webhook_url": url,
            "is_active": active,
            "last_triggered_at": last_trig,
            "last_error": last_err,
            "config": config_val,
            "created_at": created
        })
    }).collect();

    Json(json!({"integrations": list})).into_response()
}

pub async fn create_integration(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let id = uuid::Uuid::new_v4().to_string();

    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("New Integration");
    let int_type = body.get("integration_type").and_then(|v| v.as_str()).unwrap_or("webhook");
    let webhook_url = body.get("webhook_url").and_then(|v| v.as_str()).unwrap_or("");
    let config = body.get("config").cloned().unwrap_or(json!({}));
    let events = body.get("events").cloned().unwrap_or(json!(["scan_completed","scan_failed","vulnerability_critical"]));

    // Validate integration type
    let valid_types = ["slack", "teams", "jira", "github", "webhook"];
    if !valid_types.contains(&int_type) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Invalid type. Must be one of: {:?}", valid_types)}))).into_response();
    }

    // Validate webhook URL format
    if !webhook_url.is_empty() && !webhook_url.starts_with("https://") {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Webhook URL must use HTTPS"}))).into_response();
    }

    let events_vec: Vec<String> = events.as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let result = sqlx::query(
        "INSERT INTO integrations (id, organization_id, name, integration_type, webhook_url, config, events, is_active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, TRUE, $8, NOW(), NOW())"
    )
    .bind(&id)
    .bind(org_id)
    .bind(name)
    .bind(int_type)
    .bind(webhook_url)
    .bind(&config)
    .bind(&events_vec)
    .bind(&user.user_id)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => (StatusCode::CREATED, Json(json!({"id": id, "message": "Integration created"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed: {}", e)}))).into_response(),
    }
}

pub async fn update_integration(
    Path(integration_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");

    let name = body.get("name").and_then(|v| v.as_str());
    let webhook_url = body.get("webhook_url").and_then(|v| v.as_str());
    let config = body.get("config");

    if let Some(url) = webhook_url {
        if !url.is_empty() && !url.starts_with("https://") {
            return (StatusCode::BAD_REQUEST, Json(json!({"error": "Webhook URL must use HTTPS"}))).into_response();
        }
    }

    let _ = sqlx::query(
        "UPDATE integrations SET name = COALESCE($1, name), webhook_url = COALESCE($2, webhook_url), config = COALESCE($3::jsonb, config), updated_at = NOW() WHERE id = $4 AND organization_id = $5"
    )
    .bind(name)
    .bind(webhook_url)
    .bind(config)
    .bind(&integration_id)
    .bind(org_id)
    .execute(&state.db)
    .await;

    Json(json!({"message": "Integration updated", "id": integration_id})).into_response()
}

pub async fn delete_integration(
    Path(integration_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let _ = sqlx::query("DELETE FROM integrations WHERE id = $1 AND organization_id = $2")
        .bind(&integration_id)
        .bind(org_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Integration deleted"})).into_response()
}

pub async fn toggle_integration(
    Path(integration_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let _ = sqlx::query("UPDATE integrations SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 AND organization_id = $2")
        .bind(&integration_id)
        .bind(org_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Integration toggled", "id": integration_id})).into_response()
}

pub async fn test_integration(
    Path(integration_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");

    let row = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT integration_type, webhook_url FROM integrations WHERE id = $1 AND organization_id = $2"
    )
    .bind(&integration_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (int_type, webhook_url) = match row {
        Some(r) => r,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "Integration not found"}))).into_response(),
    };

    let url = match webhook_url {
        Some(u) if !u.is_empty() => u,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "No webhook URL configured"}))).into_response(),
    };

    let test_payload = json!({
        "target": "test.example.com",
        "tool": "test-scan",
        "status": "completed",
        "message": "This is a test notification from CyberSec Pro"
    });

    // Use the integration service to send
    let result = match int_type.as_str() {
        "slack" => {
            let client = reqwest::Client::new();
            let payload = json!({
                "text": "🧪 *Test notification from CyberSec Pro*\nYour Slack integration is working correctly!"
            });
            client.post(&url).json(&payload).timeout(std::time::Duration::from_secs(10)).send().await
                .map(|r| r.status().is_success())
                .map_err(|e| e.to_string())
        }
        _ => {
            let client = reqwest::Client::new();
            client.post(&url).json(&json!({"event": "test", "data": test_payload})).timeout(std::time::Duration::from_secs(10)).send().await
                .map(|r| r.status().is_success())
                .map_err(|e| e.to_string())
        }
    };

    match result {
        Ok(true) => Json(json!({"success": true, "message": "Test notification sent successfully"})).into_response(),
        Ok(false) => Json(json!({"success": false, "error": "Remote server returned error status"})).into_response(),
        Err(e) => Json(json!({"success": false, "error": e})).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn purple_team_create_flow_builds_expected_shape() {
        let chain = purple_team_chain_by_id("chain-credential-access").expect("expected chain catalog entry");
        let exercise = purple_team_build_exercise(
            &chain,
            "chain-credential-access",
            "10.10.10.5",
            Some("Credential drill test"),
        );

        assert_eq!(exercise.get("attack_chain_id").and_then(|v| v.as_str()), Some("chain-credential-access"));
        assert_eq!(exercise.get("target").and_then(|v| v.as_str()), Some("10.10.10.5"));
        assert_eq!(exercise.get("name").and_then(|v| v.as_str()), Some("Credential drill test"));
        assert_eq!(exercise.get("status").and_then(|v| v.as_str()), Some("pending"));
        assert_eq!(exercise.get("total_steps").and_then(|v| v.as_i64()), Some(7));
        assert!(exercise.get("id").and_then(|v| v.as_str()).is_some());
    }

    #[test]
    fn purple_team_list_and_detail_round_trip_from_store() {
        let org_id = "test-org-purple";

        let chain = purple_team_chain_by_id("chain-initial-access-phishing").expect("expected chain catalog entry");
        let exercise = purple_team_build_exercise(
            &chain,
            "chain-initial-access-phishing",
            "mail.target.local",
            None,
        );
        let exercise_id = exercise
            .get("id")
            .and_then(|v| v.as_str())
            .expect("exercise must have id")
            .to_string();

        {
            let mut store = purple_team_store().lock().expect("store lock");
            store.entry(org_id.to_string()).or_default().insert(0, exercise);
        }

        let listed = {
            let store = purple_team_store().lock().expect("store lock");
            store.get(org_id).cloned().unwrap_or_default()
        };
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].get("attack_chain_id").and_then(|v| v.as_str()), Some("chain-initial-access-phishing"));

        let fetched = listed
            .iter()
            .find(|item| item.get("id").and_then(|v| v.as_str()) == Some(exercise_id.as_str()));
        assert!(fetched.is_some());

        {
            let mut store = purple_team_store().lock().expect("store lock");
            store.remove(org_id);
        }
    }
}
