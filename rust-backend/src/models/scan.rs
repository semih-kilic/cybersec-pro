use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Scan {
    pub id: String,
    pub organization_id: String,
    pub user_id: String,
    pub tool_id: String,
    pub target: String,
    pub parameters: Option<JsonValue>,
    pub status: Option<String>,
    pub agent_id: Option<String>,
    pub project_id: Option<i64>,
    pub output: Option<String>,
    pub error_log: Option<String>,
    pub findings: Option<JsonValue>,
    pub report_path: Option<String>,
    pub started_at: Option<NaiveDateTime>,
    pub completed_at: Option<NaiveDateTime>,
    pub created_at: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FindingsSummary {
    pub total: i64,
    pub critical: i64,
    pub high: i64,
    pub medium: i64,
    pub low: i64,
    pub open_ports: i64,
}

impl Default for FindingsSummary {
    fn default() -> Self {
        Self { total: 0, critical: 0, high: 0, medium: 0, low: 0, open_ports: 0 }
    }
}

#[derive(Debug, Serialize)]
pub struct ScanResponse {
    pub id: String,
    pub organization_id: String,
    pub user_id: String,
    pub tool_id: String,
    pub target: String,
    pub parameters: Option<JsonValue>,
    pub status: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: Option<String>,
    pub duration: String,
    pub duration_seconds: f64,
    pub findings_summary: FindingsSummary,
    pub findings: Option<JsonValue>,
    pub output: String,
    pub error_log: Option<String>,
}

impl Scan {
    pub fn duration_seconds(&self) -> f64 {
        let start = match self.started_at {
            Some(s) => s,
            None => return 0.0,
        };
        let end = self.completed_at.unwrap_or_else(|| chrono::Utc::now().naive_utc());
        (end - start).num_milliseconds() as f64 / 1000.0
    }

    pub fn duration_str(&self) -> String {
        let secs = self.duration_seconds();
        if secs < 60.0 {
            format!("{}s", secs as i64)
        } else {
            let mins = secs as i64 / 60;
            let rem = secs as i64 % 60;
            format!("{}m {}s", mins, rem)
        }
    }

    pub fn findings_summary(&self) -> FindingsSummary {
        match &self.findings {
            Some(JsonValue::Object(map)) => {
                if let Some(summary) = map.get("summary") {
                    serde_json::from_value(summary.clone()).unwrap_or_default()
                } else {
                    FindingsSummary::default()
                }
            }
            Some(JsonValue::Array(arr)) => FindingsSummary {
                total: arr.len() as i64,
                ..Default::default()
            },
            _ => FindingsSummary::default(),
        }
    }

    pub fn to_response(&self) -> ScanResponse {
        ScanResponse {
            id: self.id.clone(),
            organization_id: self.organization_id.clone(),
            user_id: self.user_id.clone(),
            tool_id: self.tool_id.clone(),
            target: self.target.clone(),
            parameters: self.parameters.clone(),
            status: self.status.clone().unwrap_or_else(|| "pending".into()),
            started_at: self.started_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            completed_at: self.completed_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            created_at: self.created_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            duration: self.duration_str(),
            duration_seconds: self.duration_seconds(),
            findings_summary: self.findings_summary(),
            findings: self.findings.clone(),
            output: self.output.clone().unwrap_or_default(),
            error_log: self.error_log.clone(),
        }
    }
}
