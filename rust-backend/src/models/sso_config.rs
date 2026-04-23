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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_sso(provider_type: &str) -> SSOConfig {
        SSOConfig {
            id: "sso-001".into(),
            organization_id: "org-001".into(),
            provider_type: provider_type.into(),
            provider_name: None,
            is_enabled: None,
            saml_entity_id: None,
            saml_sso_url: None,
            saml_certificate: None,
            saml_sign_requests: None,
            oidc_client_id: None,
            oidc_client_secret: None,
            oidc_issuer_url: None,
            oidc_scopes: None,
            ldap_host: None,
            ldap_port: None,
            ldap_use_ssl: None,
            ldap_bind_dn: None,
            ldap_bind_password: None,
            ldap_base_dn: None,
            ldap_user_filter: None,
            ldap_group_filter: None,
            domain_hint: None,
            enforce_sso: None,
            jit_provisioning: None,
            default_role: None,
            created_at: None,
            updated_at: None,
            last_login_at: None,
        }
    }

    #[test]
    fn test_to_response_base_defaults() {
        let s = make_sso("saml");
        let r = s.to_response();
        assert_eq!(r["id"], "sso-001");
        assert_eq!(r["provider_type"], "saml");
        assert_eq!(r["is_enabled"], false);
        assert_eq!(r["enforce_sso"], false);
        assert_eq!(r["jit_provisioning"], true);
        assert_eq!(r["default_role"], "user");
    }

    #[test]
    fn test_to_response_saml_masks_certificate() {
        let mut s = make_sso("saml");
        s.saml_certificate = Some("REAL_CERT_DATA".into());
        s.saml_entity_id = Some("https://example.com/saml".into());
        s.saml_sso_url = Some("https://idp.example.com/sso".into());
        let r = s.to_response();
        // Certificate must be masked, never exposed raw
        assert_eq!(r["saml_certificate"], "\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}");
        assert_eq!(r["saml_entity_id"], "https://example.com/saml");
        assert_eq!(r["saml_sign_requests"], true); // default
    }

    #[test]
    fn test_to_response_saml_certificate_null_when_none() {
        let s = make_sso("saml");
        let r = s.to_response();
        assert!(r["saml_certificate"].is_null());
    }

    #[test]
    fn test_to_response_oidc_masks_secret() {
        let mut s = make_sso("oidc");
        s.oidc_client_id = Some("client-123".into());
        s.oidc_client_secret = Some("super-secret".into());
        s.oidc_issuer_url = Some("https://accounts.google.com".into());
        let r = s.to_response();
        assert_eq!(r["oidc_client_id"], "client-123");
        // Secret must be masked
        assert_eq!(r["oidc_client_secret"], "\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}");
        assert_eq!(r["oidc_issuer_url"], "https://accounts.google.com");
        assert_eq!(r["oidc_scopes"], "openid profile email"); // default
    }

    #[test]
    fn test_to_response_ldap_masks_password() {
        let mut s = make_sso("ldap");
        s.ldap_host = Some("ldap.corp.com".into());
        s.ldap_port = Some(636);
        s.ldap_use_ssl = Some(true);
        s.ldap_bind_password = Some("s3cr3t".into());
        let r = s.to_response();
        assert_eq!(r["ldap_host"], "ldap.corp.com");
        assert_eq!(r["ldap_port"], 636);
        assert_eq!(r["ldap_use_ssl"], true);
        // Password must be masked
        assert_eq!(r["ldap_bind_password"], "\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}");
    }

    #[test]
    fn test_to_response_ldap_defaults_port_389() {
        let s = make_sso("ldap");
        let r = s.to_response();
        assert_eq!(r["ldap_port"], 389);
        assert_eq!(r["ldap_use_ssl"], false);
        assert!(r["ldap_bind_password"].is_null());
    }

    #[test]
    fn test_to_response_unknown_provider_no_extra_fields() {
        let s = make_sso("oauth2");
        let r = s.to_response();
        assert_eq!(r["provider_type"], "oauth2");
        // None of the provider-specific keys should be present
        assert!(r.get("saml_entity_id").is_none());
        assert!(r.get("oidc_client_id").is_none());
        assert!(r.get("ldap_host").is_none());
    }
}
