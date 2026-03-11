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
