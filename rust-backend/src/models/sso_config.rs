use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SSOConfig {
    pub id: String,
    pub organization_id: String,
    pub provider_type: String,
    pub provider_name: Option<String>,
    pub is_enabled: Option<bool>,
    // SAML
    pub saml_entity_id: Option<String>,
    pub saml_sso_url: Option<String>,
    pub saml_certificate: Option<String>,
    pub saml_sign_requests: Option<bool>,
    // OIDC
    pub oidc_client_id: Option<String>,
    pub oidc_client_secret: Option<String>,
    pub oidc_issuer_url: Option<String>,
    pub oidc_scopes: Option<String>,
    // LDAP
    pub ldap_host: Option<String>,
    pub ldap_port: Option<i32>,
    pub ldap_use_ssl: Option<bool>,
    pub ldap_bind_dn: Option<String>,
    pub ldap_bind_password: Option<String>,
    pub ldap_base_dn: Option<String>,
    pub ldap_user_filter: Option<String>,
    pub ldap_group_filter: Option<String>,
    // Metadata
    pub domain_hint: Option<String>,
    pub enforce_sso: Option<bool>,
    pub jit_provisioning: Option<bool>,
    pub default_role: Option<String>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
    pub last_login_at: Option<NaiveDateTime>,
}

impl SSOConfig {
    pub fn to_response(&self) -> serde_json::Value {
        let mut base = serde_json::json!({
            "id": self.id,
            "organization_id": self.organization_id,
            "provider_type": self.provider_type,
            "provider_name": self.provider_name,
            "is_enabled": self.is_enabled.unwrap_or(false),
            "domain_hint": self.domain_hint,
            "enforce_sso": self.enforce_sso.unwrap_or(false),
            "jit_provisioning": self.jit_provisioning.unwrap_or(true),
            "default_role": self.default_role.as_deref().unwrap_or("user"),
            "created_at": self.created_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            "updated_at": self.updated_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            "last_login_at": self.last_login_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
        });

        match self.provider_type.as_str() {
            "saml" => {
                base["saml_entity_id"] = serde_json::json!(self.saml_entity_id);
                base["saml_sso_url"] = serde_json::json!(self.saml_sso_url);
                base["saml_certificate"] = if self.saml_certificate.is_some() {
                    serde_json::json!("••••••")
                } else {
                    serde_json::Value::Null
                };
                base["saml_sign_requests"] = serde_json::json!(self.saml_sign_requests.unwrap_or(true));
            }
            "oidc" => {
                base["oidc_client_id"] = serde_json::json!(self.oidc_client_id);
                base["oidc_client_secret"] = if self.oidc_client_secret.is_some() {
                    serde_json::json!("••••••")
                } else {
                    serde_json::Value::Null
                };
                base["oidc_issuer_url"] = serde_json::json!(self.oidc_issuer_url);
                base["oidc_scopes"] = serde_json::json!(self.oidc_scopes.as_deref().unwrap_or("openid profile email"));
            }
            "ldap" => {
                base["ldap_host"] = serde_json::json!(self.ldap_host);
                base["ldap_port"] = serde_json::json!(self.ldap_port.unwrap_or(389));
                base["ldap_use_ssl"] = serde_json::json!(self.ldap_use_ssl.unwrap_or(false));
                base["ldap_bind_dn"] = serde_json::json!(self.ldap_bind_dn);
                base["ldap_bind_password"] = if self.ldap_bind_password.is_some() {
                    serde_json::json!("••••••")
                } else {
                    serde_json::Value::Null
                };
                base["ldap_base_dn"] = serde_json::json!(self.ldap_base_dn);
                base["ldap_user_filter"] = serde_json::json!(self.ldap_user_filter);
                base["ldap_group_filter"] = serde_json::json!(self.ldap_group_filter);
            }
            _ => {}
        }

        base
    }
}
