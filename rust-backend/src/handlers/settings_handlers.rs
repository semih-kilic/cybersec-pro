/// CyberSec Pro — Settings Handlers (Notification Preferences, API Keys, Team)
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::AppState;

// ══════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCES
// ══════════════════════════════════════════════════════════

pub async fn get_notification_preferences(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let row: Option<(
        bool, bool, bool, bool, bool, String, String,
    )> = sqlx::query_as(
        "SELECT email_scan_complete, email_weekly_report, email_security_alerts, browser_notifications, quiet_hours_enabled, quiet_hours_from, quiet_hours_to FROM notification_preferences WHERE user_id = $1"
    )
    .bind(&user.user_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    match row {
        Some((scan, weekly, security, browser, quiet_enabled, quiet_from, quiet_to)) => {
            Json(json!({
                "email_scan_complete": scan,
                "email_weekly_report": weekly,
                "email_security_alerts": security,
                "browser_notifications": browser,
                "quiet_hours": {
                    "enabled": quiet_enabled,
                    "from": quiet_from,
                    "to": quiet_to
                }
            }))
        },
        None => {
            // Return defaults
            Json(json!({
                "email_scan_complete": true,
                "email_weekly_report": true,
                "email_security_alerts": true,
                "browser_notifications": true,
                "quiet_hours": {
                    "enabled": false,
                    "from": "22:00",
                    "to": "08:00"
                }
            }))
        }
    }
}

pub async fn update_notification_preferences(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let email_scan = body.get("email_scan_complete").and_then(|v| v.as_bool()).unwrap_or(true);
    let email_weekly = body.get("email_weekly_report").and_then(|v| v.as_bool()).unwrap_or(true);
    let email_security = body.get("email_security_alerts").and_then(|v| v.as_bool()).unwrap_or(true);
    let browser = body.get("browser_notifications").and_then(|v| v.as_bool()).unwrap_or(true);

    let quiet_hours = body.get("quiet_hours");
    let quiet_enabled = quiet_hours.and_then(|q| q.get("enabled")).and_then(|v| v.as_bool()).unwrap_or(false);
    let quiet_from = quiet_hours.and_then(|q| q.get("from")).and_then(|v| v.as_str()).unwrap_or("22:00").to_string();
    let quiet_to = quiet_hours.and_then(|q| q.get("to")).and_then(|v| v.as_str()).unwrap_or("08:00").to_string();

    let id = uuid::Uuid::new_v4().to_string();
    let result = sqlx::query(
        "INSERT INTO notification_preferences (id, user_id, email_scan_complete, email_weekly_report, email_security_alerts, browser_notifications, quiet_hours_enabled, quiet_hours_from, quiet_hours_to, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
            email_scan_complete = $3, email_weekly_report = $4, email_security_alerts = $5,
            browser_notifications = $6, quiet_hours_enabled = $7, quiet_hours_from = $8,
            quiet_hours_to = $9, updated_at = NOW()"
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(email_scan)
    .bind(email_weekly)
    .bind(email_security)
    .bind(browser)
    .bind(quiet_enabled)
    .bind(&quiet_from)
    .bind(&quiet_to)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => Json(json!({
            "message": "Notification preferences saved",
            "email_scan_complete": email_scan,
            "email_weekly_report": email_weekly,
            "email_security_alerts": email_security,
            "browser_notifications": browser,
            "quiet_hours": {
                "enabled": quiet_enabled,
                "from": quiet_from,
                "to": quiet_to
            }
        })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to save: {}", e)}))).into_response(),
    }
}

// ══════════════════════════════════════════════════════════
// API KEYS
// ══════════════════════════════════════════════════════════

pub async fn list_api_keys(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let keys: Vec<(String, String, String, String, Option<String>, bool, String)> = sqlx::query_as(
        "SELECT id, name, key_preview, COALESCE(permissions::text, '[\"read\"]'), CAST(last_used_at AS TEXT), is_active, CAST(created_at AS TEXT) FROM api_keys WHERE organization_id = $1 AND user_id = $2 ORDER BY created_at DESC"
    )
    .bind(&org_id)
    .bind(&user.user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let key_list: Vec<serde_json::Value> = keys.iter().map(|(id, name, preview, perms, last_used, active, created)| {
        let permissions: serde_json::Value = serde_json::from_str(perms).unwrap_or(json!(["read"]));
        json!({
            "id": id,
            "name": name,
            "key": format!("csp_...{}", preview),
            "permissions": permissions,
            "last_used": last_used,
            "is_active": active,
            "created_at": created
        })
    }).collect();

    Json(json!({"api_keys": key_list})).into_response()
}

pub async fn create_api_key(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let name = body.get("name").and_then(|n| n.as_str()).unwrap_or("API Key").to_string();
    let permissions = body.get("permissions").cloned().unwrap_or(json!(["read"]));

    // Generate secure API key (scope rng to avoid !Send across await)
    let (raw_key, key_preview, key_hash) = {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let key_bytes: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
        let raw = format!("csp_{}", hex::encode(&key_bytes));
        let preview = raw[raw.len()-8..].to_string();
        let salt = argon2::password_hash::SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
        let hash = match argon2::PasswordHasher::hash_password(
            &argon2::Argon2::default(),
            raw.as_bytes(),
            &salt,
        ) {
            Ok(h) => h.to_string(),
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Key generation failed"}))).into_response(),
        };
        (raw, preview, hash)
    };

    let id = uuid::Uuid::new_v4().to_string();
    let perms_str = serde_json::to_string(&permissions).unwrap_or_else(|_| "[\"read\"]".to_string());

    let result = sqlx::query(
        "INSERT INTO api_keys (id, organization_id, user_id, name, key_hash, key_preview, permissions) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)"
    )
    .bind(&id)
    .bind(&org_id)
    .bind(&user.user_id)
    .bind(&name)
    .bind(&key_hash)
    .bind(&key_preview)
    .bind(&perms_str)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => Json(json!({
            "message": "API key created",
            "api_key": {
                "id": id,
                "name": name,
                "key": raw_key,
                "key_preview": &key_preview,
                "permissions": permissions,
                "created_at": chrono::Utc::now().to_rfc3339()
            }
        })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to create key: {}", e)}))).into_response(),
    }
}

pub async fn delete_api_key(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(key_id): Path<String>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM api_keys WHERE id = $1 AND user_id = $2")
        .bind(&key_id)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => Json(json!({"message": "API key deleted"})).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "API key not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Delete failed: {}", e)}))).into_response(),
    }
}

// ══════════════════════════════════════════════════════════
// TEAM MANAGEMENT
// ══════════════════════════════════════════════════════════

pub async fn list_team_members(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    // Get current team members
    let members: Vec<(String, String, Option<String>, Option<String>, Option<String>, bool, String, Option<String>)> = sqlx::query_as(
        "SELECT id, email, first_name, last_name, role, is_active, CAST(created_at AS TEXT), CAST(last_login AS TEXT) FROM users WHERE organization_id = $1 ORDER BY created_at"
    )
    .bind(&org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let member_list: Vec<serde_json::Value> = members.iter().map(|(id, email, first, last, role, active, created, last_login)| {
        json!({
            "id": id,
            "email": email,
            "first_name": first,
            "last_name": last,
            "role": role.as_deref().unwrap_or("user"),
            "is_active": active,
            "created_at": created,
            "last_login": last_login
        })
    }).collect();

    // Get pending invitations
    let invitations: Vec<(String, String, String, String, String)> = sqlx::query_as(
        "SELECT id, email, role, status, CAST(created_at AS TEXT) FROM team_invitations WHERE organization_id = $1 AND status = 'pending' ORDER BY created_at DESC"
    )
    .bind(&org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let invite_list: Vec<serde_json::Value> = invitations.iter().map(|(id, email, role, status, created)| {
        json!({
            "id": id,
            "email": email,
            "role": role,
            "status": status,
            "created_at": created
        })
    }).collect();

    Json(json!({
        "members": member_list,
        "invitations": invite_list,
        "total": member_list.len()
    })).into_response()
}

pub async fn invite_team_member(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let email = match body.get("email").and_then(|e| e.as_str()) {
        Some(e) => e.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Email required"}))).into_response(),
    };

    let role = body.get("role").and_then(|r| r.as_str()).unwrap_or("user").to_string();
    let valid_roles = ["user", "admin"];
    if !valid_roles.contains(&role.as_str()) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid role"}))).into_response();
    }

    // Check if user already exists in org
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM users WHERE email = $1 AND organization_id = $2"
    )
    .bind(&email)
    .bind(&org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    if existing.is_some() {
        return (StatusCode::CONFLICT, Json(json!({"error": "User already in organization"}))).into_response();
    }

    let id = uuid::Uuid::new_v4().to_string();
    let token = uuid::Uuid::new_v4().to_string();

    let result = sqlx::query(
        "INSERT INTO team_invitations (id, organization_id, email, role, invited_by, token) VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(&id)
    .bind(&org_id)
    .bind(&email)
    .bind(&role)
    .bind(&user.user_id)
    .bind(&token)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            // Send invitation email if SMTP is configured
            if let Some(cfg) = crate::services::email::EmailConfig::from_env() {
                let invite_url = format!("https://semihkilic.com/dashboard/register?invite={}&org={}", token, org_id);
                let _ = crate::services::email::send_team_invite_email(&cfg, &email, &invite_url, &role).await;
            }
            Json(json!({"message": "Invitation sent", "invitation_id": id})).into_response()
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to invite: {}", e)}))).into_response(),
    }
}

pub async fn remove_team_member(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(member_id): Path<String>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    if member_id == user.user_id {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Cannot remove yourself"}))).into_response();
    }

    // Check it's a team_invitation or a user in the org
    // First try to delete invitation
    let inv_result = sqlx::query("DELETE FROM team_invitations WHERE id = $1 AND organization_id = $2")
        .bind(&member_id)
        .bind(&org_id)
        .execute(&state.db)
        .await;

    if let Ok(r) = &inv_result {
        if r.rows_affected() > 0 {
            return Json(json!({"message": "Invitation cancelled"})).into_response();
        }
    }

    // Try to remove user from org (deactivate)
    let result = sqlx::query("UPDATE users SET is_active = false WHERE id = $1 AND organization_id = $2")
        .bind(&member_id)
        .bind(&org_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => Json(json!({"message": "Team member removed"})).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Member not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Remove failed: {}", e)}))).into_response(),
    }
}

pub async fn change_member_role(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(member_id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let role = match body.get("role").and_then(|r| r.as_str()) {
        Some(r) => r.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Role required"}))).into_response(),
    };

    let valid_roles = ["user", "admin"];
    if !valid_roles.contains(&role.as_str()) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid role"}))).into_response();
    }

    let result = sqlx::query("UPDATE users SET role = $1 WHERE id = $2 AND organization_id = $3")
        .bind(&role)
        .bind(&member_id)
        .bind(&org_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => Json(json!({"message": "Role updated", "role": role})).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Member not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed: {}", e)}))).into_response(),
    }
}

// ══════════════════════════════════════════════════════════
// PASSWORD CHANGE (basic implementation)
// ══════════════════════════════════════════════════════════

pub async fn change_password(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let current = match body.get("current_password").and_then(|p| p.as_str()) {
        Some(p) => p.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Current password required"}))).into_response(),
    };
    let new_password = match body.get("new_password").and_then(|p| p.as_str()) {
        Some(p) => p.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "New password required"}))).into_response(),
    };

    if new_password.len() < 8 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Password must be at least 8 characters"}))).into_response();
    }

    // Verify current password
    let row: Option<(String,)> = sqlx::query_as("SELECT password_hash FROM users WHERE id = $1")
        .bind(&user.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let pw_hash = match row {
        Some((h,)) => h,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    };

    use argon2::PasswordVerifier;
    let parsed = match argon2::PasswordHash::new(&pw_hash) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Password check failed"}))).into_response(),
    };
    if argon2::Argon2::default().verify_password(current.as_bytes(), &parsed).is_err() {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Current password is incorrect"}))).into_response();
    }

    // Hash new password (scope to avoid !Send across await)
    let new_hash = {
        let salt = argon2::password_hash::SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
        match argon2::PasswordHasher::hash_password(
            &argon2::Argon2::default(),
            new_password.as_bytes(),
            &salt,
        ) {
            Ok(h) => h.to_string(),
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Password hashing failed"}))).into_response(),
        }
    };

    let _ = sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&new_hash)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;

    Json(json!({"message": "Password changed successfully"})).into_response()
}
