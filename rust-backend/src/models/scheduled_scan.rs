#[allow(dead_code)]
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScheduledScan {
    pub id: String,
    pub organization_id: String,
    pub user_id: String,
    pub name: String,
    pub tool_name: String,
    pub target: String,
    pub parameters: Option<JsonValue>,
    pub schedule_type: Option<String>,
    pub cron_expression: Option<String>,
    pub hour: Option<i32>,
    pub minute: Option<i32>,
    pub day_of_week: Option<String>,
    pub day_of_month: Option<i32>,
    pub is_active: Option<bool>,
    pub last_run: Option<NaiveDateTime>,
    pub next_run: Option<NaiveDateTime>,
    pub run_count: Option<i32>,
    pub agent_id: Option<String>,
    pub project_id: Option<i64>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize)]
pub struct ScheduledScanResponse {
    pub id: String,
    pub name: String,
    pub tool_name: String,
    pub target: String,
    pub parameters: Option<JsonValue>,
    pub schedule_type: String,
    pub cron_expression: Option<String>,
    pub hour: i32,
    pub minute: i32,
    pub day_of_week: Option<String>,
    pub day_of_month: Option<i32>,
    pub is_active: bool,
    pub last_run: Option<String>,
    pub next_run: Option<String>,
    pub run_count: i32,
    pub agent_id: Option<String>,
    pub project_id: Option<i64>,
    pub created_at: Option<String>,
}

impl ScheduledScan {
    pub fn to_response(&self) -> ScheduledScanResponse {
        ScheduledScanResponse {
            id: self.id.clone(),
            name: self.name.clone(),
            tool_name: self.tool_name.clone(),
            target: self.target.clone(),
            parameters: self.parameters.clone(),
            schedule_type: self.schedule_type.clone().unwrap_or_else(|| "daily".into()),
            cron_expression: self.cron_expression.clone(),
            hour: self.hour.unwrap_or(2),
            minute: self.minute.unwrap_or(0),
            day_of_week: self.day_of_week.clone(),
            day_of_month: self.day_of_month,
            is_active: self.is_active.unwrap_or(true),
            last_run: self.last_run.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            next_run: self.next_run.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            run_count: self.run_count.unwrap_or(0),
            agent_id: self.agent_id.clone(),
            project_id: self.project_id,
            created_at: self.created_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_scan() -> ScheduledScan {
        ScheduledScan {
            id: "ss-001".into(),
            organization_id: "org-001".into(),
            user_id: "usr-001".into(),
            name: "nightly scan".into(),
            tool_name: "nmap".into(),
            target: "10.0.0.0/24".into(),
            parameters: None,
            schedule_type: None,
            cron_expression: None,
            hour: None,
            minute: None,
            day_of_week: None,
            day_of_month: None,
            is_active: None,
            last_run: None,
            next_run: None,
            run_count: None,
            agent_id: None,
            project_id: None,
            created_at: None,
            updated_at: None,
        }
    }

    #[test]
    fn test_to_response_defaults() {
        let s = make_scan();
        let r = s.to_response();
        assert_eq!(r.id, "ss-001");
        assert_eq!(r.name, "nightly scan");
        assert_eq!(r.tool_name, "nmap");
        assert_eq!(r.target, "10.0.0.0/24");
        assert_eq!(r.schedule_type, "daily");
        assert_eq!(r.hour, 2);
        assert_eq!(r.minute, 0);
        assert!(r.is_active);
        assert_eq!(r.run_count, 0);
        assert!(r.last_run.is_none());
        assert!(r.next_run.is_none());
    }

    #[test]
    fn test_to_response_explicit_fields() {
        let mut s = make_scan();
        s.schedule_type = Some("weekly".into());
        s.hour = Some(3);
        s.minute = Some(30);
        s.day_of_week = Some("monday".into());
        s.is_active = Some(false);
        s.run_count = Some(12);
        let r = s.to_response();
        assert_eq!(r.schedule_type, "weekly");
        assert_eq!(r.hour, 3);
        assert_eq!(r.minute, 30);
        assert_eq!(r.day_of_week.as_deref(), Some("monday"));
        assert!(!r.is_active);
        assert_eq!(r.run_count, 12);
    }

    #[test]
    fn test_to_response_last_run_formatted() {
        let mut s = make_scan();
        s.last_run = chrono::NaiveDateTime::parse_from_str("2026-03-01 02:00:00", "%Y-%m-%d %H:%M:%S").ok();
        let r = s.to_response();
        assert_eq!(r.last_run.as_deref(), Some("2026-03-01T02:00:00"));
    }
}
