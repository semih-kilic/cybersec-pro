#[allow(dead_code)]
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub password_hash: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub role: Option<String>,
    pub organization_id: Option<String>,
    pub created_at: Option<NaiveDateTime>,
    pub last_login: Option<NaiveDateTime>,
    pub is_active: Option<bool>,
    // Email verification
    pub email_verified: Option<bool>,
    pub verification_token: Option<String>,
    pub verification_sent_at: Option<NaiveDateTime>,
    // OAuth
    pub oauth_provider: Option<String>,
    pub oauth_id: Option<String>,
    pub avatar_url: Option<String>,
    // MFA
    pub mfa_enabled: Option<bool>,
    pub mfa_secret: Option<String>,
    pub mfa_backup_codes: Option<JsonValue>,
    pub mfa_enabled_at: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub role: String,
    pub organization_id: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: Option<String>,
    pub last_login: Option<String>,
    pub is_active: bool,
    pub email_verified: bool,
    pub mfa_enabled: bool,
}

impl User {
    pub fn to_response(&self) -> UserResponse {
        UserResponse {
            id: self.id.clone(),
            email: self.email.clone(),
            first_name: self.first_name.clone(),
            last_name: self.last_name.clone(),
            role: self.role.clone().unwrap_or_else(|| "user".into()),
            organization_id: self.organization_id.clone(),
            avatar_url: self.avatar_url.clone(),
            created_at: self.created_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            last_login: self.last_login.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            is_active: self.is_active.unwrap_or(true),
            email_verified: self.email_verified.unwrap_or(true),
            mfa_enabled: self.mfa_enabled.unwrap_or(false),
        }
    }

    pub fn is_admin(&self) -> bool {
        matches!(self.role.as_deref(), Some("admin") | Some("superadmin"))
    }

    pub fn display_name(&self) -> String {
        match (&self.first_name, &self.last_name) {
            (Some(f), Some(l)) => format!("{} {}", f, l),
            (Some(f), None) => f.clone(),
            _ => self.email.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_user() -> User {
        User {
            id: "usr-001".into(),
            email: "alice@example.com".into(),
            password_hash: None,
            first_name: None,
            last_name: None,
            role: None,
            organization_id: None,
            created_at: None,
            last_login: None,
            is_active: None,
            email_verified: None,
            verification_token: None,
            verification_sent_at: None,
            oauth_provider: None,
            oauth_id: None,
            avatar_url: None,
            mfa_enabled: None,
            mfa_secret: None,
            mfa_backup_codes: None,
            mfa_enabled_at: None,
        }
    }

    #[test]
    fn test_to_response_defaults() {
        let u = make_user();
        let r = u.to_response();
        assert_eq!(r.id, "usr-001");
        assert_eq!(r.email, "alice@example.com");
        assert_eq!(r.role, "user");
        assert!(r.is_active);
        assert!(r.email_verified);
        assert!(!r.mfa_enabled);
        assert!(r.organization_id.is_none());
    }

    #[test]
    fn test_to_response_explicit_fields() {
        let mut u = make_user();
        u.role = Some("admin".into());
        u.is_active = Some(false);
        u.email_verified = Some(false);
        u.mfa_enabled = Some(true);
        u.organization_id = Some("org-999".into());
        let r = u.to_response();
        assert_eq!(r.role, "admin");
        assert!(!r.is_active);
        assert!(!r.email_verified);
        assert!(r.mfa_enabled);
        assert_eq!(r.organization_id.as_deref(), Some("org-999"));
    }

    #[test]
    fn test_is_admin_true_for_admin_and_superadmin() {
        let mut u = make_user();
        u.role = Some("admin".into());
        assert!(u.is_admin());
        u.role = Some("superadmin".into());
        assert!(u.is_admin());
    }

    #[test]
    fn test_is_admin_false_for_other_roles() {
        let mut u = make_user();
        for role in &["user", "analyst", "viewer", ""] {
            u.role = Some(role.to_string());
            assert!(!u.is_admin(), "expected is_admin=false for role '{}'", role);
        }
        u.role = None;
        assert!(!u.is_admin());
    }

    #[test]
    fn test_display_name_both_names() {
        let mut u = make_user();
        u.first_name = Some("Alice".into());
        u.last_name = Some("Smith".into());
        assert_eq!(u.display_name(), "Alice Smith");
    }

    #[test]
    fn test_display_name_first_name_only() {
        let mut u = make_user();
        u.first_name = Some("Alice".into());
        assert_eq!(u.display_name(), "Alice");
    }

    #[test]
    fn test_display_name_falls_back_to_email() {
        let u = make_user();
        assert_eq!(u.display_name(), "alice@example.com");
    }
}
