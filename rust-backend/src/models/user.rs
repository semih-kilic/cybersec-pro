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
