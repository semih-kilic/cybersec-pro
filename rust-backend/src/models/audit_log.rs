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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_log(action: &str) -> AuditLog {
        AuditLog {
            id: "log-001".into(),
            organization_id: Some("org-001".into()),
            user_id: Some("usr-001".into()),
            action: action.into(),
            category: None,
            severity: None,
            ip_address: None,
            user_agent: None,
            details: None,
            resource_type: None,
            resource_id: None,
            status: None,
            created_at: None,
        }
    }

    #[test]
    fn test_to_response_defaults() {
        let l = make_log("user.login");
        let r = l.to_response();
        assert_eq!(r.id, "log-001");
        assert_eq!(r.action, "user.login");
        assert_eq!(r.category, "system");
        assert_eq!(r.severity, "info");
        assert_eq!(r.status, "success");
        assert!(r.created_at.is_none());
    }

    #[test]
    fn test_to_response_explicit_fields() {
        let mut l = make_log("scan.started");
        l.category = Some("scan".into());
        l.severity = Some("warning".into());
        l.status = Some("failure".into());
        l.resource_type = Some("scan".into());
        l.resource_id = Some("scan-999".into());
        l.ip_address = Some("192.168.1.1".into());
        let r = l.to_response();
        assert_eq!(r.category, "scan");
        assert_eq!(r.severity, "warning");
        assert_eq!(r.status, "failure");
        assert_eq!(r.resource_type.as_deref(), Some("scan"));
        assert_eq!(r.resource_id.as_deref(), Some("scan-999"));
        assert_eq!(r.ip_address.as_deref(), Some("192.168.1.1"));
    }

    #[test]
    fn test_to_response_user_agent_not_exposed() {
        // user_agent is in AuditLog but intentionally not in AuditLogResponse (privacy)
        let mut l = make_log("page.view");
        l.user_agent = Some("Mozilla/5.0".into());
        let r = l.to_response();
        // AuditLogResponse has no user_agent field — this just confirms it compiles fine
        assert_eq!(r.action, "page.view");
    }
}
