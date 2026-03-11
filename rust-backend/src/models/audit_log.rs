#[allow(dead_code)]
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AuditLog {
    pub id: String,
    pub organization_id: Option<String>,
    pub user_id: Option<String>,
    pub action: String,
    pub category: Option<String>,
    pub severity: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub details: Option<JsonValue>,
    pub resource_type: Option<String>,
    pub resource_id: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize)]
pub struct AuditLogResponse {
    pub id: String,
    pub organization_id: Option<String>,
    pub user_id: Option<String>,
    pub action: String,
    pub category: String,
    pub severity: String,
    pub ip_address: Option<String>,
    pub details: Option<JsonValue>,
    pub resource_type: Option<String>,
    pub resource_id: Option<String>,
    pub status: String,
    pub created_at: Option<String>,
}

impl AuditLog {
    pub fn to_response(&self) -> AuditLogResponse {
        AuditLogResponse {
            id: self.id.clone(),
            organization_id: self.organization_id.clone(),
            user_id: self.user_id.clone(),
            action: self.action.clone(),
            category: self.category.clone().unwrap_or_else(|| "system".into()),
            severity: self.severity.clone().unwrap_or_else(|| "info".into()),
            ip_address: self.ip_address.clone(),
            details: self.details.clone(),
            resource_type: self.resource_type.clone(),
            resource_id: self.resource_id.clone(),
            status: self.status.clone().unwrap_or_else(|| "success".into()),
            created_at: self.created_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
        }
    }
}
