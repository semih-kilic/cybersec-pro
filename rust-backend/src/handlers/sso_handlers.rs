use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Redirect},
    Json,
};
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

/// Encrypt an SSO secret for storage.
///
/// AUDIT 2026-08-29 — `oidc_client_secret` and `ldap_bind_password` were stored
/// in plaintext, while agent SSH credentials in the same database were
/// AES-256-GCM encrypted. Anyone with read access to `sso_configs` held the
/// organisation's IdP client secret and its directory bind password outright.
fn encrypt_sso_secret(value: Option<&String>) -> Option<String> {
    let v = value.map(|s| s.trim()).filter(|s| !s.is_empty())?;
    // Already-encrypted values are re-saved untouched on an edit.
    let key = crate::handlers::agent_handlers::password_encryption_key();
    match crate::services::connection_engine::crypto::encrypt_password(v, &key) {
        Ok(enc) => Some(enc),
        Err(e) => {
            tracing::error!("could not encrypt SSO secret: {e}");
            None
        }
    }
}

/// Decrypt a stored SSO secret, tolerating rows written before encryption.
fn decrypt_sso_secret(stored: Option<&str>) -> Option<String> {
    let v = stored.map(str::trim).filter(|s| !s.is_empty())?;
    let key = crate::handlers::agent_handlers::password_encryption_key();
    match crate::services::connection_engine::crypto::decrypt_password(v, &key) {
        Ok(plain) => Some(plain),
        // Legacy plaintext row: use as-is so existing SSO keeps working, and
        // say so, because it should be re-saved to encrypt it.
        Err(_) => {
            tracing::warn!("SSO secret is not encrypted (legacy row); re-save the SSO configuration to encrypt it");
            Some(v.to_string())
        }
    }
}

pub async fn create_sso_config(
    State(state): State<Arc<AppState>>,
    admin: crate::middleware::auth_middleware::AdminUser,
    Json(body): Json<CreateSSORequest>,
) -> impl IntoResponse {
    // PRIVILEGE FIX: this took a plain `AuthUser`, so ANY member of an
    // enterprise org — including a read-only `viewer` — could overwrite the
    // organisation's SSO configuration: point it at an attacker-controlled IdP,
    // set `default_role: "admin"`, and log in as an administrator.
    let auth = &admin.0;
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

    // DATA-LOSS FIX: the DELETE and the INSERT used to run as two independent
    // statements, and the INSERT ended with a literal `0` for the boolean
    // `is_enabled` column. Postgres rejects that with "column is_enabled is of
    // type boolean but expression is of type integer", but the error was
    // swallowed by `let _ =`. Net effect: saving an SSO config returned
    // 201 "SSO configuration saved" while actually DELETING the existing
    // configuration and storing nothing.
    //
    // Now: one transaction, `FALSE` instead of `0`, and errors are surfaced.
    let mut tx = match state.db.begin().await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("sso config: could not begin transaction: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Could not save SSO configuration"}))).into_response();
        }
    };

    if let Err(e) = sqlx::query("DELETE FROM sso_configs WHERE organization_id = $1")
        .bind(org_id)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        tracing::error!("sso config: delete failed: {e}");
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Could not save SSO configuration"}))).into_response();
    }

    let insert = sqlx::query(
        "INSERT INTO sso_configs (id, organization_id, provider_type, provider_name, saml_entity_id, saml_sso_url, saml_certificate, oidc_client_id, oidc_client_secret, oidc_issuer_url, ldap_host, ldap_port, ldap_bind_dn, ldap_bind_password, ldap_base_dn, ldap_user_filter, domain_hint, enforce_sso, jit_provisioning, default_role, is_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, FALSE)"
    )
    .bind(&id)
    .bind(org_id)
    .bind(&body.provider_type)
    .bind(&body.provider_name)
    .bind(&body.saml_entity_id)
    .bind(&body.saml_sso_url)
    .bind(&body.saml_certificate)
    .bind(&body.oidc_client_id)
    .bind(encrypt_sso_secret(body.oidc_client_secret.as_ref()))
    .bind(&body.oidc_issuer_url)
    .bind(&body.ldap_host)
    .bind(body.ldap_port.unwrap_or(389))
    .bind(&body.ldap_bind_dn)
    .bind(encrypt_sso_secret(body.ldap_bind_password.as_ref()))
    .bind(&body.ldap_base_dn)
    .bind(&body.ldap_user_filter)
    .bind(&body.domain_hint)
    .bind(body.enforce_sso.unwrap_or(false))
    .bind(body.jit_provisioning.unwrap_or(true))
    .bind(body.default_role.as_deref().unwrap_or("user"))
    .execute(&mut *tx)
    .await;

    if let Err(e) = insert {
        let _ = tx.rollback().await;
        // A unique-violation here means another organisation already claims the
        // domain. Say so plainly instead of reporting a server error.
        let is_conflict = e
            .as_database_error()
            .and_then(|db| db.code())
            .map(|c| c == "23505")
            .unwrap_or(false);
        if is_conflict {
            tracing::warn!("sso config: domain '{}' already claimed", body.domain_hint.as_deref().unwrap_or(""));
            return (StatusCode::CONFLICT, Json(json!({
                "error": "This domain is already configured for SSO by another organization. Contact support if you believe this is your domain.",
                "code": "SSO_DOMAIN_TAKEN"
            }))).into_response();
        }
        tracing::error!("sso config: insert failed: {e}");
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Could not save SSO configuration"}))).into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!("sso config: commit failed: {e}");
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Could not save SSO configuration"}))).into_response();
    }

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
    headers: HeaderMap,
    Json(body): Json<LdapLoginRequest>,
) -> impl IntoResponse {
    // Rate limit: 5 attempts per IP per minute (brute-force protection)
    let ip = headers.get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    if state.rate_limiter.is_limited(&format!("sso_ldap:{}", ip), 5, std::time::Duration::from_secs(60)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many attempts. Try again later."}))).into_response();
    }

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
    let ldap_url = build_ldap_url(&host, port);

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

// ── SAML 2.0 Service Provider ──────────────────────────────────────────
//
// Real SP-initiated SAML 2.0 login backed by the `samael` crate (xmlsec-based
// XML-DSIG verification). The earlier hand-rolled version validated no
// signature/audience/expiry and was disabled; this implementation delegates all
// verification to samael's `ServiceProvider`, which:
//   * verifies the response signature against the org's configured signing
//     certificate — weak algorithms (SHA-1) are rejected via
//     `allowed_signature_algorithms`, and if no cert is configured we refuse to
//     build the SP at all rather than silently skip signature checks;
//   * checks Destination, Issuer, Status, InResponseTo, IssueInstant expiry, the
//     assertion Conditions (NotBefore/NotOnOrAfter, AudienceRestriction) and the
//     Bearer SubjectConfirmation (Recipient == our ACS, InResponseTo, expiry).
// Only SP-initiated flows are accepted (`allow_idp_initiated = false`): each
// login is tied to a one-time RelayState + AuthnRequest ID held in Redis, so a
// captured response cannot be replayed. Encrypted assertions and IdP-initiated
// SSO are intentionally not supported yet.

/// Public SP entity ID (the audience the IdP must restrict assertions to).
const SAML_SP_ENTITY_ID: &str = "https://api.cyber-sec-pro.com/saml/metadata";
/// Public Assertion Consumer Service URL (where the IdP POSTs the SAMLResponse).
const SAML_SP_ACS_URL: &str = "https://api.cyber-sec-pro.com/v1/auth/sso/saml/callback";

/// Minimal XML text escaping for values embedded in generated metadata.
fn saml_xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Strip PEM armor/whitespace from a certificate, yielding bare base64 DER.
fn saml_cert_to_b64(cert: &str) -> String {
    cert.lines()
        .filter(|l| !l.contains("CERTIFICATE"))
        .flat_map(|l| l.chars())
        .filter(|c| !c.is_whitespace())
        .collect()
}

/// Redirect the browser to the SSO error page with a short machine code (details
/// are logged server-side, never leaked to the user).
fn saml_error_redirect(code: &str) -> axum::response::Response {
    Redirect::temporary(&format!(
        "https://app.cyber-sec-pro.com/dashboard/sso-error?error={}",
        urlencoding::encode(code)
    ))
    .into_response()
}

/// Build the SP for one org from its stored IdP entity ID, SSO URL and signing
/// certificate. Returns an error (never an unsigned/unverified SP) when the cert
/// is missing — without a signing cert samael would skip signature verification.
fn build_saml_sp(
    idp_entity_id: &str,
    idp_sso_url: &str,
    idp_cert: &str,
) -> Result<samael::service_provider::ServiceProvider, String> {
    use samael::crypto::AllowedSignatureAlgorithm;
    use samael::metadata::EntityDescriptor;
    use samael::service_provider::ServiceProviderBuilder;

    let cert_b64 = saml_cert_to_b64(idp_cert);
    if cert_b64.is_empty() {
        return Err("IdP signing certificate is not configured".to_string());
    }
    if idp_entity_id.trim().is_empty() || idp_sso_url.trim().is_empty() {
        return Err("IdP entity ID or SSO URL is not configured".to_string());
    }

    let idp_metadata_xml = format!(
        r#"<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="{eid}">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data><ds:X509Certificate>{cert}</ds:X509Certificate></ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="{sso}"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>"#,
        eid = saml_xml_escape(idp_entity_id),
        cert = cert_b64,
        sso = saml_xml_escape(idp_sso_url),
    );

    let idp_metadata: EntityDescriptor = idp_metadata_xml
        .parse()
        .map_err(|e| format!("could not parse IdP metadata: {e}"))?;

    ServiceProviderBuilder::default()
        .entity_id(Some(SAML_SP_ENTITY_ID.to_string()))
        .acs_url(Some(SAML_SP_ACS_URL.to_string()))
        .idp_metadata(idp_metadata)
        .allow_idp_initiated(false)
        .allowed_signature_algorithms(Some(vec![
            AllowedSignatureAlgorithm::RsaSha256,
            AllowedSignatureAlgorithm::RsaSha384,
            AllowedSignatureAlgorithm::RsaSha512,
            AllowedSignatureAlgorithm::EcdsaSha256,
            AllowedSignatureAlgorithm::EcdsaSha384,
            AllowedSignatureAlgorithm::EcdsaSha512,
        ]))
        .build()
        .map_err(|e| format!("could not build SAML SP: {e}"))
}

/// Extract (email, display_name) from a verified assertion. Prefers an
/// email-shaped NameID, then common email/name attributes.
fn saml_email_and_name(
    assertion: &samael::schema::Assertion,
) -> (Option<String>, Option<String>) {
    const EMAIL_ATTRS: &[&str] = &[
        "email",
        "mail",
        "emailaddress",
        "urn:oid:0.9.2342.19200300.100.1.3",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    ];
    const NAME_ATTRS: &[&str] = &[
        "name",
        "displayname",
        "cn",
        "urn:oid:2.16.840.1.113730.3.1.241",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    ];

    let attr_value = |wanted: &[&str]| -> Option<String> {
        let stmts = assertion.attribute_statements.as_ref()?;
        for stmt in stmts {
            for attr in &stmt.attributes {
                let name = attr.name.as_deref().unwrap_or("");
                if wanted.iter().any(|w| w.eq_ignore_ascii_case(name)) {
                    if let Some(v) = attr.values.iter().find_map(|v| v.value.clone()) {
                        if !v.trim().is_empty() {
                            return Some(v.trim().to_string());
                        }
                    }
                }
            }
        }
        None
    };

    let name_id = assertion
        .subject
        .as_ref()
        .and_then(|s| s.name_id.as_ref())
        .map(|n| n.value.trim().to_string())
        .filter(|v| !v.is_empty());

    let email = name_id
        .clone()
        .filter(|v| v.contains('@'))
        .or_else(|| attr_value(EMAIL_ATTRS));
    let name = attr_value(NAME_ATTRS);
    (email, name)
}

/// SAML SSO Initiation — builds an AuthnRequest and returns the IdP redirect URL
/// (HTTP-Redirect binding).
pub async fn sso_saml_init(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SSOInitQuery>,
) -> impl IntoResponse {
    let domain = params
        .domain
        .as_deref()
        .or_else(|| params.email.as_deref().and_then(|e| e.split('@').nth(1)))
        .unwrap_or("")
        .to_string();

    let config: Option<(String, Option<String>, Option<String>, Option<String>, bool)> =
        sqlx::query_as(
            "SELECT organization_id, saml_entity_id, saml_sso_url, saml_certificate, \
             (domain_verified_at IS NOT NULL) \
             FROM sso_configs WHERE domain_hint = $1 AND is_enabled = TRUE AND provider_type = 'saml'",
        )
        .bind(&domain)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let (org_id, entity_id, sso_url, cert, domain_verified) = match config {
        Some(c) => c,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "No SAML SSO configuration found for this domain"})),
            )
                .into_response()
        }
    };

    if !domain_verified {
        tracing::warn!("SAML init refused: domain '{}' not verified for org {}", domain, org_id);
        return (
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "This SSO domain has not been verified. An administrator must verify domain ownership before SSO logins are accepted.",
                "code": "SSO_DOMAIN_NOT_VERIFIED"
            })),
        )
            .into_response();
    }

    let entity_id = entity_id.unwrap_or_default();
    let sso_url = sso_url.unwrap_or_default();
    let cert = cert.unwrap_or_default();

    let sp = match build_saml_sp(&entity_id, &sso_url, &cert) {
        Ok(sp) => sp,
        Err(e) => {
            tracing::error!("SAML init: {} (org {})", e, org_id);
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "SAML configuration is incomplete", "code": "SAML_CONFIG_INCOMPLETE"})),
            )
                .into_response();
        }
    };

    let authn_request = match sp.make_authentication_request(&sso_url) {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("SAML init: could not build AuthnRequest: {} (org {})", e, org_id);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Could not start SAML login"})),
            )
                .into_response();
        }
    };
    let request_id = authn_request.id.clone();

    // One-time RelayState -> {domain, request_id}, 10-min TTL. Binds the callback
    // to this exact request (InResponseTo) and selects the right org config.
    let relay_state = Uuid::new_v4().to_string();
    let stored = json!({"domain": domain, "request_id": request_id}).to_string();
    let _ = state
        .cache
        .set(
            &format!("saml_relay:{}", relay_state),
            &stored,
            std::time::Duration::from_secs(600),
        )
        .await;

    match authn_request.redirect(&relay_state) {
        Ok(Some(url)) => Json(json!({"redirect_url": url.to_string()})).into_response(),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Could not build SAML redirect"})),
        )
            .into_response(),
    }
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
    let saml_response = match body.saml_response.as_deref() {
        Some(r) if !r.is_empty() => r.to_string(),
        _ => return saml_error_redirect("missing_saml_response"),
    };
    let relay_state = match body.relay_state.as_deref() {
        Some(r) if !r.is_empty() => r.to_string(),
        _ => return saml_error_redirect("missing_relay_state"),
    };

    // Consume the one-time RelayState (replay protection + CSRF binding).
    let relay_key = format!("saml_relay:{}", relay_state);
    let stored = match state.cache.get(&relay_key).await {
        Ok(Some(v)) => {
            let _ = state.cache.delete(&relay_key).await;
            v
        }
        _ => return saml_error_redirect("invalid_or_expired_state"),
    };
    let stored: serde_json::Value =
        serde_json::from_str(&stored).unwrap_or(serde_json::Value::Null);
    let domain = stored.get("domain").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let request_id = stored.get("request_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if domain.is_empty() || request_id.is_empty() {
        return saml_error_redirect("invalid_state");
    }

    let config: Option<(
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<bool>,
        Option<String>,
        bool,
    )> = sqlx::query_as(
        "SELECT organization_id, saml_entity_id, saml_sso_url, saml_certificate, \
         jit_provisioning, default_role, (domain_verified_at IS NOT NULL) \
         FROM sso_configs WHERE domain_hint = $1 AND is_enabled = TRUE AND provider_type = 'saml'",
    )
    .bind(&domain)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (org_id, entity_id, sso_url, cert, jit, default_role, domain_verified) = match config {
        Some(c) => c,
        None => return saml_error_redirect("no_saml_config"),
    };
    if !domain_verified {
        tracing::warn!("SAML callback refused: domain '{}' not verified for org {}", domain, org_id);
        return saml_error_redirect("domain_not_verified");
    }

    let sp = match build_saml_sp(
        &entity_id.unwrap_or_default(),
        &sso_url.unwrap_or_default(),
        &cert.unwrap_or_default(),
    ) {
        Ok(sp) => sp,
        Err(e) => {
            tracing::error!("SAML callback: {} (org {})", e, org_id);
            return saml_error_redirect("saml_config_incomplete");
        }
    };

    // The security boundary: verifies the XML signature against the IdP cert and
    // validates Destination/Issuer/Status/InResponseTo/expiry + the assertion
    // Conditions and Bearer SubjectConfirmation. Anything forged, tampered,
    // expired, replayed, or for the wrong audience/recipient is rejected here.
    let assertion = match sp.parse_base64_response(&saml_response, Some(&[request_id.as_str()])) {
        Ok(a) => a,
        Err(e) => {
            tracing::warn!("SAML response rejected for org {}: {}", org_id, e);
            return saml_error_redirect("saml_validation_failed");
        }
    };

    let (email, name) = saml_email_and_name(&assertion);
    let email = match email {
        Some(e) if e.contains('@') => e,
        _ => {
            tracing::warn!("SAML assertion for org {} carried no email", org_id);
            return saml_error_redirect("no_email_in_assertion");
        }
    };

    let role = default_role.unwrap_or_else(|| "user".to_string());
    let jit = jit.unwrap_or(true);

    let user: Option<(String, Option<String>)> =
        sqlx::query_as("SELECT id, role FROM users WHERE email = $1 AND organization_id = $2")
            .bind(&email)
            .bind(&org_id)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);

    let (user_id, user_role) = match user {
        Some((id, r)) => (id, r.unwrap_or_else(|| role.clone())),
        None => {
            if !jit {
                return saml_error_redirect("user_not_provisioned");
            }
            let new_id = Uuid::new_v4().to_string();
            let display =
                name.unwrap_or_else(|| email.split('@').next().unwrap_or("User").to_string());
            let _ = sqlx::query(
                "INSERT INTO users (id, email, full_name, organization_id, role, is_active, auth_provider, email_verified, created_at) \
                 VALUES ($1, $2, $3, $4, $5, TRUE, 'saml', TRUE, NOW())",
            )
            .bind(&new_id)
            .bind(&email)
            .bind(&display)
            .bind(&org_id)
            .bind(&role)
            .execute(&state.db)
            .await;
            tracing::info!("JIT provisioned SAML user: {} in org {}", email, org_id);
            (new_id, role.clone())
        }
    };

    let _ = sqlx::query("UPDATE users SET last_login = NOW(), email_verified = TRUE WHERE id = $1")
        .bind(&user_id)
        .execute(&state.db)
        .await;

    let app_access_token =
        create_access_token(&state.jwt_secret, &user_id, Some(&org_id), &user_role)
            .unwrap_or_default();
    let app_refresh_token = create_refresh_token(&state.jwt_secret, &user_id).unwrap_or_default();

    Redirect::temporary(&format!(
        "https://app.cyber-sec-pro.com/dashboard/sso-callback#access_token={}&refresh_token={}",
        app_access_token, app_refresh_token
    ))
    .into_response()
}

/// SP metadata — admins register this entityID + ACS URL with their IdP.
pub async fn sso_saml_metadata() -> impl IntoResponse {
    let xml = format!(
        r#"<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="{eid}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="{acs}" index="0" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>"#,
        eid = SAML_SP_ENTITY_ID,
        acs = SAML_SP_ACS_URL,
    );
    (
        StatusCode::OK,
        [(axum::http::header::CONTENT_TYPE, "application/xml")],
        xml,
    )
        .into_response()
}

// ── Pure helpers (testable without DB) ─────────────────────────────────

/// Builds an LDAP URL choosing ldaps:// for port 636, ldap:// otherwise.
pub fn build_ldap_url(host: &str, port: i32) -> String {
    if port == 636 {
        format!("ldaps://{}:{}", host, port)
    } else {
        format!("ldap://{}:{}", host, port)
    }
}

/// Extract NameID from SAML Response XML (simplified parser)
pub fn extract_saml_name_id(xml: &str) -> Option<String> {
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
    // Bind state -> domain in Redis (one-time, 10 min TTL) so the callback can
    // select the correct org config and reject forged cross-org flows.
    let _ = state.cache.set(
        &format!("oidc_state:{}", oidc_state),
        domain,
        std::time::Duration::from_secs(600),
    ).await;
    let redirect_uri = "https://api.cyber-sec-pro.com/v1/auth/sso/oidc/callback";

    let auth_url = format!(
        "{}/authorize?client_id={}&response_type=code&scope=openid%20email%20profile&redirect_uri={}&state={}",
        issuer_url, client_id, urlencoding::encode(redirect_uri), oidc_state
    );

    Json(json!({
        "redirect_url": auth_url,
        "state": oidc_state
    })).into_response()
}

/// OIDC SSO Callback — exchanges authorization code for tokens and provisions user
#[derive(Deserialize)]
pub struct OidcCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

pub async fn sso_oidc_callback(
    State(state): State<Arc<AppState>>,
    Query(params): Query<OidcCallbackQuery>,
) -> impl IntoResponse {
    // Error from IdP
    if let Some(err) = &params.error {
        let redirect = format!(
            "https://app.cyber-sec-pro.com/dashboard/sso-error?error={}",
            urlencoding::encode(err)
        );
        return Redirect::temporary(&redirect).into_response();
    }

    let code = match &params.code {
        Some(c) if !c.is_empty() => c.clone(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Missing authorization code"}))).into_response(),
    };

    let state_val = params.state.as_deref().unwrap_or("").trim().to_string();

    // One-time server-side state validation (login-CSRF defense)
    if state_val.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Missing state parameter"}))).into_response();
    }
    let state_key = format!("oidc_state:{}", state_val);
    let state_domain = match state.cache.get(&state_key).await {
        Ok(Some(d)) => {
            let _ = state.cache.delete(&state_key).await;
            d
        }
        _ => {
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid or expired OIDC state"}))).into_response();
        }
    };

    // Config is selected by the domain bound to this state (never "latest")
    let config: Option<(String, Option<String>, Option<String>, Option<String>, Option<bool>, Option<String>)> = sqlx::query_as(
        "SELECT organization_id, oidc_client_id, oidc_client_secret, oidc_issuer_url, jit_provisioning, default_role \
         FROM sso_configs WHERE is_enabled = TRUE AND provider_type = 'oidc' AND domain_hint = $1 \
         ORDER BY created_at DESC LIMIT 1"
    )
    .bind(&state_domain)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (org_id, client_id, client_secret, issuer_url, jit, default_role) = match config {
        Some(c) => c,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "No OIDC SSO configuration found"}))).into_response(),
    };

    // Refuse to provision into an organisation that has not proved control of
    // the domain. `domain_hint` had no uniqueness constraint and no ownership
    // check, so any tenant could claim any domain and — with JIT provisioning
    // on — collect logins for it. The unique index closes the race; this closes
    // the claim itself.
    let domain_verified: bool = sqlx::query_scalar(
        "SELECT domain_verified_at IS NOT NULL FROM sso_configs \
          WHERE organization_id = $1 AND provider_type = 'oidc' LIMIT 1",
    )
    .bind(&org_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or(false);

    if !domain_verified {
        tracing::warn!("OIDC login refused: domain '{}' is not verified for org {}", state_domain, org_id);
        return (StatusCode::FORBIDDEN, Json(json!({
            "error": "This SSO domain has not been verified. An administrator must verify domain ownership before SSO logins are accepted.",
            "code": "SSO_DOMAIN_NOT_VERIFIED"
        }))).into_response();
    }

    let client_id = client_id.unwrap_or_default();
    let client_secret = decrypt_sso_secret(client_secret.as_deref()).unwrap_or_default();
    let issuer_url = issuer_url.unwrap_or_default();
    let redirect_uri = "https://api.cyber-sec-pro.com/v1/auth/sso/oidc/callback";

    if client_id.is_empty() || client_secret.is_empty() || issuer_url.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "OIDC configuration incomplete"}))).into_response();
    }

    // Exchange authorization code for tokens
    let token_url = format!("{}/token", issuer_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_default();

    let token_res = client
        .post(&token_url)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", redirect_uri),
            ("client_id", &client_id),
            ("client_secret", &client_secret),
        ])
        .send()
        .await;

    let token_body: serde_json::Value = match token_res {
        Ok(r) if r.status().is_success() => r.json().await.unwrap_or_default(),
        Ok(r) => {
            let status = r.status();
            let body = r.text().await.unwrap_or_default();
            tracing::error!("OIDC token exchange failed ({}): {}", status, body);
            return (StatusCode::BAD_GATEWAY, Json(json!({"error": "OIDC token exchange failed"}))).into_response();
        }
        Err(e) => {
            tracing::error!("OIDC token request error: {}", e);
            return (StatusCode::BAD_GATEWAY, Json(json!({"error": "Could not reach OIDC provider"}))).into_response();
        }
    };

    // Fetch userinfo using access_token
    let access_token_oidc = token_body.get("access_token").and_then(|t| t.as_str()).unwrap_or("");
    if access_token_oidc.is_empty() {
        return (StatusCode::BAD_GATEWAY, Json(json!({"error": "No access_token in OIDC response"}))).into_response();
    }

    let userinfo_url = format!("{}/userinfo", issuer_url.trim_end_matches('/'));
    let userinfo: serde_json::Value = match client
        .get(&userinfo_url)
        .bearer_auth(access_token_oidc)
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r.json().await.unwrap_or_default(),
        _ => {
            // SECURITY AUDIT 2026-08: unverified id_token claim decoding removed.
            // Identity must come from the verified userinfo endpoint only.
            serde_json::Value::Null
        }
    };

    let email = userinfo.get("email")
        .and_then(|e| e.as_str())
        .unwrap_or("");

    if email.is_empty() || !email.contains('@') {
        return (StatusCode::BAD_GATEWAY, Json(json!({"error": "Could not extract email from OIDC userinfo"}))).into_response();
    }

    let role = default_role.unwrap_or_else(|| "user".to_string());
    let jit = jit.unwrap_or(true);

    // Find or JIT-provision the user
    let user: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT id, role FROM users WHERE email = $1 AND organization_id = $2"
    )
    .bind(email)
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
            let new_id = Uuid::new_v4().to_string();
            let name = userinfo.get("name").and_then(|n| n.as_str())
                .unwrap_or_else(|| email.split('@').next().unwrap_or("User"));
            let _ = sqlx::query(
                "INSERT INTO users (id, email, full_name, organization_id, role, is_active, auth_provider, email_verified, created_at) \
                 VALUES ($1, $2, $3, $4, $5, TRUE, 'oidc', TRUE, NOW())"
            )
            .bind(&new_id)
            .bind(email)
            .bind(name)
            .bind(&org_id)
            .bind(&role)
            .execute(&state.db)
            .await;
            tracing::info!("JIT provisioned OIDC user: {} in org {}", email, org_id);
            (new_id, role.clone())
        }
    };

    let _ = sqlx::query("UPDATE users SET last_login = NOW(), email_verified = TRUE WHERE id = $1")
        .bind(&user_id)
        .execute(&state.db)
        .await;

    let app_access_token = create_access_token(
        &state.jwt_secret, &user_id, Some(&org_id), &user_role
    ).unwrap_or_default();
    let app_refresh_token = create_refresh_token(
        &state.jwt_secret, &user_id
    ).unwrap_or_default();

    // Redirect to dashboard with tokens in URL fragment
    let redirect_url = format!(
        "https://app.cyber-sec-pro.com/dashboard/sso-callback#access_token={}&refresh_token={}",
        app_access_token, app_refresh_token
    );
    Redirect::temporary(&redirect_url).into_response()
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
        let bind_pw = decrypt_sso_secret(bind_pw.as_deref()).unwrap_or_default();

        let ldap_url = build_ldap_url(&host, port);

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

#[cfg(test)]
mod tests {
    use super::{build_ldap_url, extract_saml_name_id};

    // ── build_ldap_url ────────────────────────────────────────────────────

    #[test]
    fn build_ldap_url_uses_ldap_for_standard_port() {
        assert_eq!(build_ldap_url("ldap.example.com", 389), "ldap://ldap.example.com:389");
    }

    #[test]
    fn build_ldap_url_uses_ldaps_for_port_636() {
        assert_eq!(build_ldap_url("ldap.example.com", 636), "ldaps://ldap.example.com:636");
    }

    #[test]
    fn build_ldap_url_uses_ldap_for_custom_port() {
        assert_eq!(build_ldap_url("corp.internal", 3389), "ldap://corp.internal:3389");
    }

    #[test]
    fn build_ldap_url_uses_ldaps_for_636_regardless_of_hostname() {
        assert_eq!(build_ldap_url("10.0.0.1", 636), "ldaps://10.0.0.1:636");
    }

    // ── extract_saml_name_id ──────────────────────────────────────────────

    #[test]
    fn extract_saml_name_id_reads_namespaced_tag() {
        let xml = r#"<samlp:Response><saml:NameID Format="email">user@example.com</saml:NameID></samlp:Response>"#;
        assert_eq!(extract_saml_name_id(xml).as_deref(), Some("user@example.com"));
    }

    #[test]
    fn extract_saml_name_id_reads_bare_tag_fallback() {
        let xml = r#"<Response><NameID>alice@corp.com</NameID></Response>"#;
        assert_eq!(extract_saml_name_id(xml).as_deref(), Some("alice@corp.com"));
    }

    #[test]
    fn extract_saml_name_id_prefers_namespaced_over_bare() {
        let xml = r#"<saml:NameID>ns@ns.com</saml:NameID><NameID>bare@bare.com</NameID>"#;
        assert_eq!(extract_saml_name_id(xml).as_deref(), Some("ns@ns.com"));
    }

    #[test]
    fn extract_saml_name_id_trims_whitespace() {
        let xml = "<saml:NameID>  padded@example.com  </saml:NameID>";
        assert_eq!(extract_saml_name_id(xml).as_deref(), Some("padded@example.com"));
    }

    #[test]
    fn extract_saml_name_id_returns_none_when_absent() {
        let xml = "<samlp:Response><saml:Status>Success</saml:Status></samlp:Response>";
        assert!(extract_saml_name_id(xml).is_none());
    }

    #[test]
    fn extract_saml_name_id_returns_none_for_empty_string() {
        assert!(extract_saml_name_id("").is_none());
    }

    #[test]
    fn extract_saml_name_id_returns_none_when_content_has_no_at_sign() {
        // Content without '@' should not be treated as an email
        let xml = "<saml:NameID>justausername</saml:NameID>";
        assert!(extract_saml_name_id(xml).is_none());
    }

    #[test]
    fn extract_saml_name_id_bare_returns_none_when_content_has_no_at_sign() {
        let xml = "<NameID>notanemail</NameID>";
        assert!(extract_saml_name_id(xml).is_none());
    }

    #[test]
    fn extract_saml_name_id_handles_attributes_on_tag() {
        let xml = r#"<saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">ops@company.io</saml:NameID>"#;
        assert_eq!(extract_saml_name_id(xml).as_deref(), Some("ops@company.io"));
    }

    #[test]
    fn extract_saml_name_id_handles_multiline_xml() {
        let xml = "<samlp:Response>\n  <saml:Assertion>\n    <saml:NameID>\n      multi@line.com\n    </saml:NameID>\n  </saml:Assertion>\n</samlp:Response>";
        assert_eq!(extract_saml_name_id(xml).as_deref(), Some("multi@line.com"));
    }
}

#[cfg(test)]
mod secret_tests {
    use super::*;

    fn with_key<T>(f: impl FnOnce() -> T) -> T {
        std::env::set_var("ENCRYPTION_KEY", "test-encryption-key-at-least-32-characters-long");
        f()
    }

    #[test]
    fn sso_secret_round_trips() {
        with_key(|| {
            let plain = "super-secret-oidc-client-secret".to_string();
            let enc = encrypt_sso_secret(Some(&plain)).expect("should encrypt");
            assert_ne!(enc, plain, "must not be stored in plaintext");
            assert_eq!(decrypt_sso_secret(Some(&enc)).as_deref(), Some(plain.as_str()));
        });
    }

    #[test]
    fn encryption_is_non_deterministic() {
        with_key(|| {
            // A random nonce per encryption: two identical secrets must not
            // produce identical ciphertext.
            let p = "same-secret".to_string();
            assert_ne!(encrypt_sso_secret(Some(&p)), encrypt_sso_secret(Some(&p)));
        });
    }

    #[test]
    fn empty_and_missing_secrets_stay_empty() {
        with_key(|| {
            assert!(encrypt_sso_secret(None).is_none());
            assert!(encrypt_sso_secret(Some(&String::new())).is_none());
            assert!(encrypt_sso_secret(Some(&"   ".to_string())).is_none());
            assert!(decrypt_sso_secret(None).is_none());
            assert!(decrypt_sso_secret(Some("")).is_none());
        });
    }

    #[test]
    fn legacy_plaintext_rows_still_work() {
        with_key(|| {
            // Rows written before encryption must keep working rather than
            // breaking SSO for an existing customer.
            assert_eq!(decrypt_sso_secret(Some("legacy-plaintext")).as_deref(), Some("legacy-plaintext"));
        });
    }

    // ── SAML 2.0 helpers ──────────────────────────────────────────────────

    // A valid base64 DER certificate (samael's sample IdP signing cert).
    const SAMPLE_IDP_CERT: &str = "MIIBhzCCAS0CFGE3kR43hTxJz3hg+bsefDiZjTSiMAoGCCqGSM49BAMCMEUxCzAJBgNVBAYTAkNBMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwIBcNMjQwNjIzMTc0NTQ5WhgPMzAyMzEwMjUxNzQ1NDlaMEUxCzAJBgNVBAYTAkNBMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAATKNT2CQbh99zdbDIsXZDiWZGUyafCXMl3fWAe/moGDviPWQpJpBYNkSRMcW3iDsCoiVFGoO3+7167FU1rlEurGMAoGCCqGSM49BAMCA0gAMEUCIQCdW4SacWlIqj04IXo5QNWgbIrG6MKcXbvWEXDmMkiIewIgHkDlDn8Aq4reI+4BvUN+ZDmvOs1IUevJyxGd/2RkolE=";

    #[test]
    fn saml_cert_to_b64_strips_pem_and_whitespace() {
        let pem = "-----BEGIN CERTIFICATE-----\nAAAA BBBB\n  CCCC\n-----END CERTIFICATE-----\n";
        assert_eq!(saml_cert_to_b64(pem), "AAAABBBBCCCC");
        // Bare base64 (already stripped) is returned unchanged, whitespace removed.
        assert_eq!(saml_cert_to_b64(" AA AA\n"), "AAAA");
    }

    #[test]
    fn saml_xml_escape_escapes_specials() {
        assert_eq!(saml_xml_escape("a&b<c>d\"e"), "a&amp;b&lt;c&gt;d&quot;e");
    }

    #[test]
    fn build_saml_sp_requires_certificate() {
        // Without a signing cert we must refuse to build the SP — otherwise
        // samael would skip signature verification entirely.
        let err = build_saml_sp("https://idp.example.com/entity", "https://idp.example.com/sso", "");
        assert!(err.is_err(), "SP must not build without a signing certificate");
    }

    #[test]
    fn build_saml_sp_requires_entity_and_sso_url() {
        assert!(build_saml_sp("", "https://idp.example.com/sso", SAMPLE_IDP_CERT).is_err());
        assert!(build_saml_sp("https://idp.example.com/entity", "", SAMPLE_IDP_CERT).is_err());
    }

    #[test]
    fn build_saml_sp_ok_with_cert() {
        let sp = build_saml_sp(
            "https://idp.example.com/entity",
            "https://idp.example.com/sso",
            SAMPLE_IDP_CERT,
        )
        .expect("SP should build with a cert");
        // The IdP signing cert must be visible to samael, or signatures are not
        // checked. This is the guarantee that verification actually runs.
        assert!(
            sp.idp_signing_certs().ok().flatten().is_some(),
            "IdP signing cert must be loaded for signature verification"
        );
    }

    #[test]
    fn saml_sp_rejects_unsigned_response() {
        use base64::Engine;
        // A syntactically-valid but UNSIGNED SAML response naming an attacker
        // must be rejected: the SP has a signing cert, so signature verification
        // is mandatory. This is the exact class of forgery the old code accepted.
        let sp = build_saml_sp(
            "https://idp.example.com/entity",
            "https://idp.example.com/sso",
            SAMPLE_IDP_CERT,
        )
        .unwrap();
        let unsigned = r#"<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" Destination="https://api.cyber-sec-pro.com/v1/auth/sso/saml/callback"><saml:Issuer>https://idp.example.com/entity</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status><saml:Assertion><saml:Issuer>https://idp.example.com/entity</saml:Issuer><saml:Subject><saml:NameID>attacker@evil.com</saml:NameID></saml:Subject></saml:Assertion></samlp:Response>"#;
        let encoded = base64::engine::general_purpose::STANDARD.encode(unsigned.as_bytes());
        let result = sp.parse_base64_response(&encoded, Some(&["id-123"]));
        assert!(result.is_err(), "unsigned/forged SAML response must be rejected");
    }
}
