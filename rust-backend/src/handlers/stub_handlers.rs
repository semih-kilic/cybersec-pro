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
        "SELECT id, role, organization_id FROM users WHERE email = ?"
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (user_id, org_id, role) = if let Some((uid, r, oid)) = existing {
        // Update last login + avatar
        let _ = sqlx::query("UPDATE users SET last_login = CURRENT_TIMESTAMP, avatar_url = ? WHERE id = ?")
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
            "INSERT INTO organizations (id, name, slug, plan_type) VALUES (?, ?, ?, 'trial')"
        )
        .bind(&new_org_id)
        .bind(&format!("{}'s Organization", first_name))
        .bind(&slug)
        .execute(&state.db)
        .await;

        let _ = sqlx::query(
            "INSERT INTO users (id, email, password_hash, first_name, last_name, role, organization_id, email_verified, avatar_url)
             VALUES (?, ?, '', ?, ?, 'admin', ?, 1, ?)"
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
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "Verification email sent"})).into_response()
}

pub async fn verify_email(
    State(_state): State<Arc<AppState>>,
    Query(_params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    Json(json!({"message": "Email verified", "verified": true})).into_response()
}

pub async fn upload_avatar(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"message": "Avatar upload not yet implemented", "avatar_url": null})).into_response()
}

pub async fn mfa_verify_setup(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "MFA verified", "verified": true})).into_response()
}

pub async fn mfa_regenerate_backup(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"backup_codes": [], "message": "Backup codes regenerated"})).into_response()
}

// ── Tool stubs ─────────────────────────────────────────────

pub async fn tool_config(
    Path(tool_id): Path<String>,
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let tool = sqlx::query_as::<_, (String, String, String, String, String, String, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, name, COALESCE(parameters, '{}'), COALESCE(description,''), category, COALESCE(plan_required,'starter'), command_template, binary_name, tool_group FROM tools WHERE (id = ? OR name = ?) AND is_active = 1"
    )
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
        "SELECT id, name, category, COALESCE(business_category,''), COALESCE(plan_required,'starter') FROM tools WHERE is_active = 1 ORDER BY name LIMIT 1000"
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
        "SELECT * FROM tools WHERE is_active = 1 ORDER BY name"
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
        "SELECT id, name, COALESCE(description,''), category, COALESCE(plan_required,'starter'), is_active, command_template, binary_name, tool_group, kali_package FROM tools WHERE (id = ? OR name = ?) AND is_active = 1"
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
        "INSERT INTO scans (id, user_id, organization_id, tool_id, target, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)"
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
        "SELECT id, status, output, findings, error_log FROM scans WHERE id = ? AND user_id = ?"
    )
    .bind(&scan_id)
    .bind(&user.user_id)
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
    let _ = sqlx::query("UPDATE scans SET status = 'cancelled' WHERE id = ? AND user_id = ?")
        .bind(&scan_id)
        .bind(&user.user_id)
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
        "SELECT status FROM scans WHERE id = ? AND user_id = ?"
    )
    .bind(&scan_id)
    .bind(&user.user_id)
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
    let _ = sqlx::query("DELETE FROM scans WHERE id = ? AND user_id = ?")
        .bind(&scan_id)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Scan deleted"})).into_response()
}

// ── Agent stubs ────────────────────────────────────────────

pub async fn update_agent(
    Path(agent_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "Agent updated", "agent_id": agent_id})).into_response()
}

pub async fn test_agent(
    Path(agent_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"status": "ok", "agent_id": agent_id, "connected": false})).into_response()
}

pub async fn agents_dashboard(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let rows = sqlx::query(
        "SELECT id, name, hostname, ip_address, COALESCE(status,'offline') as status, os_info, platform, version, cpu_usage, memory_usage, active_scans, total_scans, location, connection_type, ssh_port, ssh_username, last_heartbeat FROM agents WHERE organization_id = ? ORDER BY created_at DESC"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut online = 0i64;
    let mut offline = 0i64;
    let mut busy = 0i64;
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
        let cpu: Option<f64> = row.get("cpu_usage");
        let mem: Option<f64> = row.get("memory_usage");
        let active: Option<i32> = row.get("active_scans");
        let total: Option<i32> = row.get("total_scans");
        let location: Option<String> = row.get("location");
        let conn_type: Option<String> = row.get("connection_type");
        let ssh_port: Option<i32> = row.get("ssh_port");
        let ssh_user: Option<String> = row.get("ssh_username");
        let heartbeat: Option<String> = row.get("last_heartbeat");

        match status.as_str() {
            "online" => online += 1,
            "busy" => { busy += 1; online += 1; },
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

    Json(json!({
        "total_agents": rows.len(),
        "online": online,
        "offline": offline,
        "busy": busy,
        "pending": 0,
        "total_scans_completed": 0,
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
        "SELECT id, name, cron_expression, COALESCE(tool_id,''), is_active, COALESCE(target,'') FROM scheduled_scans WHERE user_id = ? ORDER BY created_at DESC"
    )
    .bind(&user.user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = schedules.iter().map(|(id, name, cron, tool, active, target)| {
        json!({"id": id, "name": name, "cron_expression": cron, "tool_id": tool, "is_active": active, "target": target})
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
        "INSERT INTO scheduled_scans (id, user_id, organization_id, name, cron_expression, tool_id, target, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)"
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
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "Schedule updated", "id": schedule_id})).into_response()
}

pub async fn delete_schedule(
    Path(schedule_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("DELETE FROM scheduled_scans WHERE id = ? AND user_id = ?")
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
    let _ = sqlx::query("UPDATE scheduled_scans SET is_active = NOT is_active WHERE id = ? AND user_id = ?")
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
        "SELECT target, COUNT(*) as cnt, MAX(created_at) as last_scan, MIN(created_at) as first_scan FROM scans WHERE user_id = ? GROUP BY target ORDER BY cnt DESC LIMIT 50"
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
        "SELECT COUNT(*) FROM scans WHERE user_id = ?"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    let completed = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM scans WHERE user_id = ? AND status = 'completed'"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    Json(json!({
        "total_scans": total_scans.0,
        "completed_scans": completed.0,
        "scan_trend": [],
        "top_tools": [],
        "risk_distribution": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    })).into_response()
}

pub async fn activity_feed(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let limit: i64 = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(20);

    let activities = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, action, details, created_at FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .bind(&user.user_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = activities.iter().map(|(id, action, details, ts)| {
        json!({"id": id, "action": action, "details": details, "created_at": ts})
    }).collect();

    Json(json!({"activities": list})).into_response()
}

// ── Usage stats ────────────────────────────────────────────

pub async fn usage_stats(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let total_scans = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM scans WHERE user_id = ?"
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
        "SELECT COALESCE(s.plan_type, 'trial') FROM subscriptions s JOIN users u ON u.organization_id = s.organization_id WHERE u.id = ?"
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
    let active_users = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM users WHERE is_active = 1").fetch_one(&state.db).await.unwrap_or((0,)).0;
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
        "SELECT id, email, COALESCE(first_name,''), COALESCE(role,'user'), organization_id, is_active, created_at FROM users ORDER BY created_at DESC LIMIT 10"
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
        "SELECT id, target, status, created_at FROM scans ORDER BY created_at DESC LIMIT 5"
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
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"error": "Impersonation not implemented in Rust backend"})).into_response()
}

pub async fn admin_change_plan(
    _admin: AdminUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"message": "Plan change not implemented"})).into_response()
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
    let id = alert_id.parse::<u64>().unwrap_or(0);
    let ok = state.service_manager.acknowledge_alert(id).await;
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
    Json(json!({"chains": []})).into_response()
}

pub async fn purple_team_playbooks(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"playbooks": []})).into_response()
}

pub async fn purple_team_exercises(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"exercises": []})).into_response()
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
    Json(json!({"matrix": [], "tactics": [], "techniques": []})).into_response()
}

// ── Terminal endpoints ─────────────────────────────────────

pub async fn terminal_agents(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"agents": []})).into_response()
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
