use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect},
    Json,
};
use base64::Engine as _;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthUser;
use crate::models::SSOConfig;
use crate::services::auth::{create_access_token, create_refresh_token};
use crate::AppState;

pub async fn get_sso_config(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let config: Option<SSOConfig> = sqlx::query_as(
        "SELECT * FROM sso_configs WHERE organization_id = $1"
    )
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    match config {
        Some(c) => (StatusCode::OK, Json(json!({"sso_config": c.to_response()}))).into_response(),
        None => (StatusCode::OK, Json(json!({"sso_config": null}))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct CreateSSORequest {
    pub provider_type: String,
    pub provider_name: Option<String>,
    // SAML
    pub saml_entity_id: Option<String>,
    pub saml_sso_url: Option<String>,
    pub saml_certificate: Option<String>,
    // OIDC
    pub oidc_client_id: Option<String>,
    pub oidc_client_secret: Option<String>,
    pub oidc_issuer_url: Option<String>,
    // LDAP
    pub ldap_host: Option<String>,
    pub ldap_port: Option<i32>,
    pub ldap_bind_dn: Option<String>,
    pub ldap_bind_password: Option<String>,
    pub ldap_base_dn: Option<String>,
    pub ldap_user_filter: Option<String>,
    // Metadata
    pub domain_hint: Option<String>,
    pub enforce_sso: Option<bool>,
    pub jit_provisioning: Option<bool>,
    pub default_role: Option<String>,
}

pub async fn create_sso_config(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CreateSSORequest>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    // Check plan (enterprise only)
    let plan: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = $1")
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let plan = plan.map(|p| p.0).unwrap_or_else(|| "trial".into());
    if !crate::services::plan::check_plan_access(&plan, "enterprise") {
        return (StatusCode::PAYMENT_REQUIRED, Json(json!({"error": "SSO requires Enterprise plan"}))).into_response();
    }

    let id = Uuid::new_v4().to_string();

    // Delete existing config first (upsert behavior)
    let _ = sqlx::query("DELETE FROM sso_configs WHERE organization_id = $1")
        .bind(org_id)
        .execute(&state.db)
        .await;

    let _ = sqlx::query(
        "INSERT INTO sso_configs (id, organization_id, provider_type, provider_name, saml_entity_id, saml_sso_url, saml_certificate, oidc_client_id, oidc_client_secret, oidc_issuer_url, ldap_host, ldap_port, ldap_bind_dn, ldap_bind_password, ldap_base_dn, ldap_user_filter, domain_hint, enforce_sso, jit_provisioning, default_role, is_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 0)"
    )
    .bind(&id)
    .bind(org_id)
    .bind(&body.provider_type)
    .bind(&body.provider_name)
    .bind(&body.saml_entity_id)
    .bind(&body.saml_sso_url)
    .bind(&body.saml_certificate)
    .bind(&body.oidc_client_id)
    .bind(&body.oidc_client_secret)
    .bind(&body.oidc_issuer_url)
    .bind(&body.ldap_host)
    .bind(body.ldap_port.unwrap_or(389))
    .bind(&body.ldap_bind_dn)
    .bind(&body.ldap_bind_password)
    .bind(&body.ldap_base_dn)
    .bind(&body.ldap_user_filter)
    .bind(&body.domain_hint)
    .bind(body.enforce_sso.unwrap_or(false))
    .bind(body.jit_provisioning.unwrap_or(true))
    .bind(body.default_role.as_deref().unwrap_or("user"))
    .execute(&state.db)
    .await;

    (StatusCode::CREATED, Json(json!({
        "message": "SSO configuration saved",
        "id": id
    }))).into_response()
}

pub async fn delete_sso_config(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let _ = sqlx::query("DELETE FROM sso_configs WHERE organization_id = $1")
        .bind(org_id)
        .execute(&state.db)
        .await;

    Json(json!({"message": "SSO configuration deleted"})).into_response()
}

pub async fn toggle_sso(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let _ = sqlx::query(
        "UPDATE sso_configs SET is_enabled = NOT COALESCE(is_enabled, FALSE) WHERE organization_id = $1"
    )
    .bind(org_id)
    .execute(&state.db)
    .await;

    let enabled: Option<(Option<bool>,)> = sqlx::query_as(
        "SELECT is_enabled FROM sso_configs WHERE organization_id = $1"
    )
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    Json(json!({
        "is_enabled": enabled.and_then(|e| e.0).unwrap_or(false)
    })).into_response()
}

// ═══════════════════════════════════════════════════════════
// SSO Authentication Handlers
// ═══════════════════════════════════════════════════════════

/// LDAP Authentication - verifies username/password against org's LDAP server
#[derive(Deserialize)]
pub struct LdapLoginRequest {
    pub email: String,
    pub password: String,
    pub domain: Option<String>,
}

pub async fn sso_ldap_login(
    State(state): State<Arc<AppState>>,
    Json(body): Json<LdapLoginRequest>,
) -> impl IntoResponse {
    // Find SSO config by domain hint or email domain
    let email_domain = body.email.split('@').nth(1).unwrap_or("");
    let domain = body.domain.as_deref().unwrap_or(email_domain);

    let config: Option<(String, String, Option<String>, Option<i32>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<bool>, Option<String>)> = sqlx::query_as(
        "SELECT organization_id, provider_type, ldap_host, ldap_port, ldap_bind_dn, ldap_bind_password, ldap_base_dn, ldap_user_filter, default_role, jit_provisioning, domain_hint \
         FROM sso_configs WHERE (domain_hint = $1 OR domain_hint = $2) AND is_enabled = TRUE AND provider_type = 'ldap'"
    )
    .bind(domain)
    .bind(email_domain)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (org_id, _provider_type, ldap_host, ldap_port, _bind_dn, _bind_password, ldap_base_dn, ldap_user_filter, default_role, jit_provisioning, _domain_hint) = match config {
        Some(c) => c,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "No LDAP SSO configuration found for this domain"}))).into_response(),
    };

    let host = match ldap_host {
        Some(h) if !h.is_empty() => h,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "LDAP host not configured"}))).into_response(),
    };
    let port = ldap_port.unwrap_or(389);
    let base_dn = ldap_base_dn.unwrap_or_default();
    let user_filter = ldap_user_filter.unwrap_or_else(|| "(uid={username})".to_string());

    // Construct user DN from filter
    let search_filter = user_filter
        .replace("{username}", &body.email)
        .replace("{email}", &body.email);

    // Attempt LDAP bind authentication
    let ldap_url = if port == 636 {
        format!("ldaps://{}:{}", host, port)
    } else {
        format!("ldap://{}:{}", host, port)
    };

    let ldap_result = tokio::task::spawn_blocking(move || -> Result<String, String> {
        use ldap3::{LdapConn, Scope, SearchEntry, ResultEntry};

        let mut ldap = LdapConn::new(&ldap_url)
            .map_err(|e| format!("LDAP connection failed: {}", e))?;

        // Search for user DN first (using base_dn)
        let (rs, _res): (Vec<ResultEntry>, _) = ldap.search(
            &base_dn,
            Scope::Subtree,
            &search_filter,
            vec!["dn", "cn", "mail", "displayName"],
        ).map_err(|e| format!("LDAP search failed: {}", e))?
        .success()
        .map_err(|e| format!("LDAP search error: {}", e))?;

        if rs.is_empty() {
            return Err("User not found in LDAP directory".to_string());
        }

        let entry = SearchEntry::construct(rs.into_iter().next().unwrap());
        let user_dn = entry.dn.clone();

        // Bind as the user to verify password
        ldap.simple_bind(&user_dn, &body.password)
            .map_err(|e| format!("LDAP bind failed: {}", e))?
            .success()
            .map_err(|_| "Invalid LDAP credentials".to_string())?;

        let _ = ldap.unbind();
        Ok(user_dn)
    }).await.unwrap_or(Err("LDAP authentication task failed".to_string()));

    let _user_dn = match ldap_result {
        Ok(dn) => dn,
        Err(e) => {
            tracing::warn!("LDAP login failed for {}: {}", body.email, e);
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": e}))).into_response();
        }
    };

    // User is authenticated via LDAP — find or create local user
    let role = default_role.unwrap_or_else(|| "user".to_string());
    let jit = jit_provisioning.unwrap_or(true);

    let user: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT id, role FROM users WHERE email = $1 AND organization_id = $2"
    )
    .bind(&body.email)
    .bind(&org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (user_id, user_role) = match user {
        Some((id, r)) => (id, r.unwrap_or_else(|| role.clone())),
        None => {
            if !jit {
                return (StatusCode::FORBIDDEN, Json(json!({"error": "User not provisioned. Contact your administrator."}))).into_response();
            }
            // JIT provisioning: create user
            let new_id = Uuid::new_v4().to_string();
            let name = body.email.split('@').next().unwrap_or("User");
            let _ = sqlx::query(
                "INSERT INTO users (id, email, full_name, organization_id, role, is_active, auth_provider, created_at) \
                 VALUES ($1, $2, $3, $4, $5, TRUE, 'ldap', NOW())"
            )
            .bind(&new_id)
            .bind(&body.email)
            .bind(name)
            .bind(&org_id)
            .bind(&role)
            .execute(&state.db)
            .await;
            tracing::info!("JIT provisioned LDAP user: {} in org {}", body.email, org_id);
            (new_id, role.clone())
        }
    };

    // Update last_login
    let _ = sqlx::query("UPDATE users SET last_login = NOW() WHERE id = $1")
        .bind(&user_id)
        .execute(&state.db)
        .await;

    // Issue JWT tokens
    let access_token = create_access_token(
        &state.jwt_secret, &user_id, Some(&org_id), &user_role
    ).unwrap_or_default();
    let refresh_token = create_refresh_token(
        &state.jwt_secret, &user_id
    ).unwrap_or_default();

    Json(json!({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "user": {
            "id": user_id,
            "email": body.email,
            "role": user_role,
            "auth_provider": "ldap"
        }
    })).into_response()
}

/// SAML SSO Initiation — redirects user to IdP login page
#[derive(Deserialize)]
pub struct SSOInitQuery {
    pub domain: Option<String>,
    pub email: Option<String>,
}

pub async fn sso_saml_init(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SSOInitQuery>,
) -> impl IntoResponse {
    let domain = params.domain.as_deref()
        .or_else(|| params.email.as_deref().and_then(|e| e.split('@').nth(1)))
        .unwrap_or("");

    let config: Option<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT saml_entity_id, saml_sso_url, saml_certificate FROM sso_configs \
         WHERE (domain_hint = $1) AND is_enabled = TRUE AND provider_type = 'saml'"
    )
    .bind(domain)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (_entity_id, sso_url, _cert) = match config {
        Some(c) => c,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "No SAML SSO configuration found for this domain"}))).into_response(),
    };

    let sso_url = match sso_url {
        Some(u) if !u.is_empty() => u,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "SAML SSO URL not configured"}))).into_response(),
    };

    // Build SAML AuthnRequest (SP-initiated)
    let request_id = format!("_cspr_{}", Uuid::new_v4());
    let issue_instant = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let acs_url = "https://semihkilic.com/api/v1/auth/sso/saml/callback";

    let authn_request = format!(
        r#"<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{}" Version="2.0" IssueInstant="{}" Destination="{}" AssertionConsumerServiceURL="{}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"><saml:Issuer>https://semihkilic.com</saml:Issuer></samlp:AuthnRequest>"#,
        request_id, issue_instant, sso_url, acs_url
    );

    let encoded = base64::engine::general_purpose::STANDARD.encode(authn_request.as_bytes());
    let redirect_url = format!("{}?SAMLRequest={}", sso_url, urlencoding::encode(&encoded));

    Json(json!({
        "redirect_url": redirect_url,
        "request_id": request_id
    })).into_response()
}

/// SAML Callback — receives SAML Response from IdP
#[derive(Deserialize)]
pub struct SAMLCallbackRequest {
    #[serde(rename = "SAMLResponse")]
    pub saml_response: Option<String>,
    #[serde(rename = "RelayState")]
    pub relay_state: Option<String>,
}

pub async fn sso_saml_callback(
    State(state): State<Arc<AppState>>,
    axum::Form(body): axum::Form<SAMLCallbackRequest>,
) -> impl IntoResponse {
    let saml_response = match &body.saml_response {
        Some(r) if !r.is_empty() => r,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Missing SAMLResponse"}))).into_response(),
    };

    // Decode SAML Response
    let decoded = match base64::engine::general_purpose::STANDARD.decode(saml_response) {
        Ok(d) => d,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid SAMLResponse encoding"}))).into_response(),
    };
    let xml = String::from_utf8_lossy(&decoded);

    // Extract NameID (email) from SAML Response XML
    // This is a simplified parser — production would use a full SAML library
    let email = extract_saml_name_id(&xml);
    let email = match email {
        Some(e) => e,
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Could not extract user identity from SAML response"}))).into_response(),
    };

    let email_domain = email.split('@').nth(1).unwrap_or("");

    // Find SSO config for this domain
    let config: Option<(String, Option<String>, Option<bool>, Option<String>)> = sqlx::query_as(
        "SELECT organization_id, saml_certificate, jit_provisioning, default_role \
         FROM sso_configs WHERE domain_hint = $1 AND is_enabled = TRUE AND provider_type = 'saml'"
    )
    .bind(email_domain)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (org_id, _cert, jit, default_role) = match config {
        Some(c) => c,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "No SSO configuration for this domain"}))).into_response(),
    };

    let role = default_role.unwrap_or_else(|| "user".to_string());
    let jit = jit.unwrap_or(true);

    // Find or create user
    let user: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT id, role FROM users WHERE email = $1 AND organization_id = $2"
    )
    .bind(&email)
    .bind(&org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (user_id, user_role) = match user {
        Some((id, r)) => (id, r.unwrap_or_else(|| role.clone())),
        None => {
            if !jit {
                return (StatusCode::FORBIDDEN, Json(json!({"error": "User not provisioned"}))).into_response();
            }
            let new_id = Uuid::new_v4().to_string();
            let name = email.split('@').next().unwrap_or("User");
            let _ = sqlx::query(
                "INSERT INTO users (id, email, full_name, organization_id, role, is_active, auth_provider, created_at) \
                 VALUES ($1, $2, $3, $4, $5, TRUE, 'saml', NOW())"
            )
            .bind(&new_id)
            .bind(&email)
            .bind(name)
            .bind(&org_id)
            .bind(&role)
            .execute(&state.db)
            .await;
            (new_id, role.clone())
        }
    };

    let _ = sqlx::query("UPDATE users SET last_login = NOW() WHERE id = $1")
        .bind(&user_id)
        .execute(&state.db)
        .await;

    let access_token = create_access_token(
        &state.jwt_secret, &user_id, Some(&org_id), &user_role
    ).unwrap_or_default();
    let refresh_token = create_refresh_token(
        &state.jwt_secret, &user_id
    ).unwrap_or_default();

    // Redirect to dashboard with token in URL fragment (secure — not sent to server)
    let redirect_url = format!(
        "https://semihkilic.com/dashboard/sso-callback#access_token={}&refresh_token={}",
        access_token, refresh_token
    );
    Redirect::temporary(&redirect_url).into_response()
}

/// Extract NameID from SAML Response XML (simplified parser)
fn extract_saml_name_id(xml: &str) -> Option<String> {
    // Look for <saml:NameID ...>email@domain.com</saml:NameID>
    let start_tag = "<saml:NameID";
    let end_tag = "</saml:NameID>";
    if let Some(start) = xml.find(start_tag) {
        let after = &xml[start..];
        if let Some(close_bracket) = after.find('>') {
            let content_start = start + close_bracket + 1;
            if let Some(end) = xml[content_start..].find(end_tag) {
                let name_id = xml[content_start..content_start + end].trim().to_string();
                if name_id.contains('@') {
                    return Some(name_id);
                }
            }
        }
    }
    // Fallback: try NameID without namespace prefix
    let start_tag = "<NameID";
    if let Some(start) = xml.find(start_tag) {
        let after = &xml[start..];
        if let Some(close_bracket) = after.find('>') {
            let content_start = start + close_bracket + 1;
            if let Some(end) = xml[content_start..].find("</NameID>") {
                let name_id = xml[content_start..content_start + end].trim().to_string();
                if name_id.contains('@') {
                    return Some(name_id);
                }
            }
        }
    }
    None
}

/// OIDC SSO Initiation — redirects to OIDC provider
pub async fn sso_oidc_init(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SSOInitQuery>,
) -> impl IntoResponse {
    let domain = params.domain.as_deref()
        .or_else(|| params.email.as_deref().and_then(|e| e.split('@').nth(1)))
        .unwrap_or("");

    let config: Option<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT oidc_client_id, oidc_client_secret, oidc_issuer_url FROM sso_configs \
         WHERE domain_hint = $1 AND is_enabled = TRUE AND provider_type = 'oidc'"
    )
    .bind(domain)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (client_id, _client_secret, issuer_url) = match config {
        Some(c) => c,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "No OIDC SSO configuration found"}))).into_response(),
    };

    let client_id = client_id.unwrap_or_default();
    let issuer_url = issuer_url.unwrap_or_default();
    let oidc_state = Uuid::new_v4().to_string();
    let redirect_uri = "https://semihkilic.com/api/v1/auth/sso/oidc/callback";

    let auth_url = format!(
        "{}/authorize?client_id={}&response_type=code&scope=openid%20email%20profile&redirect_uri={}&state={}",
        issuer_url, client_id, urlencoding::encode(redirect_uri), oidc_state
    );

    Json(json!({
        "redirect_url": auth_url,
        "state": oidc_state
    })).into_response()
}

/// Test SSO connection (LDAP bind test)
pub async fn test_sso_connection(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let config: Option<(String, Option<String>, Option<i32>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT provider_type, ldap_host, ldap_port, ldap_bind_dn, ldap_bind_password FROM sso_configs WHERE organization_id = $1"
    )
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (provider_type, host, port, bind_dn, bind_pw) = match config {
        Some(c) => c,
        None => return Json(json!({"status": "error", "message": "No SSO config found"})).into_response(),
    };

    if provider_type == "ldap" {
        let host = host.unwrap_or_default();
        let port = port.unwrap_or(389);
        let bind_dn = bind_dn.unwrap_or_default();
        let bind_pw = bind_pw.unwrap_or_default();

        let ldap_url = if port == 636 {
            format!("ldaps://{}:{}", host, port)
        } else {
            format!("ldap://{}:{}", host, port)
        };

        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            use ldap3::LdapConn;
            let mut ldap = LdapConn::new(&ldap_url)
                .map_err(|e| format!("Connection failed: {}", e))?;
            ldap.simple_bind(&bind_dn, &bind_pw)
                .map_err(|e| format!("Bind failed: {}", e))?
                .success()
                .map_err(|e| format!("Bind error: {:?}", e))?;
            let _ = ldap.unbind();
            Ok("LDAP connection successful".to_string())
        }).await.unwrap_or(Err("Task failed".to_string()));

        match result {
            Ok(msg) => Json(json!({"status": "success", "message": msg})).into_response(),
            Err(e) => Json(json!({"status": "error", "message": e})).into_response(),
        }
    } else {
        Json(json!({"status": "info", "message": format!("{} — connection test requires manual verification via browser SSO flow", provider_type)})).into_response()
    }
}
