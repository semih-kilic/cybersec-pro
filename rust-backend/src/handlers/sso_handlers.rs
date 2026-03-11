use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthUser;
use crate::models::SSOConfig;
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
        "SELECT * FROM sso_configs WHERE organization_id = ?"
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

    // Check plan (team+ only)
    let plan: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = ?")
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let plan = plan.map(|p| p.0).unwrap_or_else(|| "trial".into());
    if !crate::services::plan::check_plan_access(&plan, "team") {
        return (StatusCode::PAYMENT_REQUIRED, Json(json!({"error": "SSO requires Team or Enterprise plan"}))).into_response();
    }

    let id = Uuid::new_v4().to_string();

    // Delete existing config first (upsert behavior)
    let _ = sqlx::query("DELETE FROM sso_configs WHERE organization_id = ?")
        .bind(org_id)
        .execute(&state.db)
        .await;

    let _ = sqlx::query(
        "INSERT INTO sso_configs (id, organization_id, provider_type, provider_name, saml_entity_id, saml_sso_url, saml_certificate, oidc_client_id, oidc_client_secret, oidc_issuer_url, ldap_host, ldap_port, ldap_bind_dn, ldap_bind_password, ldap_base_dn, ldap_user_filter, domain_hint, enforce_sso, jit_provisioning, default_role, is_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)"
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

    let _ = sqlx::query("DELETE FROM sso_configs WHERE organization_id = ?")
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
        "UPDATE sso_configs SET is_enabled = NOT COALESCE(is_enabled, 0) WHERE organization_id = ?"
    )
    .bind(org_id)
    .execute(&state.db)
    .await;

    let enabled: Option<(Option<bool>,)> = sqlx::query_as(
        "SELECT is_enabled FROM sso_configs WHERE organization_id = ?"
    )
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    Json(json!({
        "is_enabled": enabled.and_then(|e| e.0).unwrap_or(false)
    })).into_response()
}
