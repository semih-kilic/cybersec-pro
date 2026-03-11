use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Report {
    pub id: String,
    pub organization_id: String,
    pub user_id: String,
    pub name: String,
    pub template: Option<String>,
    pub format: Option<String>,
    pub status: Option<String>,
    pub scan_ids: Option<JsonValue>,
    pub sections: Option<JsonValue>,
    pub total_findings: Option<i32>,
    pub critical_count: Option<i32>,
    pub high_count: Option<i32>,
    pub medium_count: Option<i32>,
    pub low_count: Option<i32>,
    pub info_count: Option<i32>,
    pub risk_score: Option<i32>,
    pub risk_level: Option<String>,
    pub content: Option<String>,
    pub file_path: Option<String>,
    pub file_size: Option<i32>,
    pub created_at: Option<NaiveDateTime>,
    pub completed_at: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize)]
pub struct SeverityBreakdown {
    pub critical: i32,
    pub high: i32,
    pub medium: i32,
    pub low: i32,
    pub info: i32,
}

#[derive(Debug, Serialize)]
pub struct ReportResponse {
    pub id: String,
    pub name: String,
    pub template: String,
    pub format: String,
    pub status: String,
    pub scan_ids: Option<JsonValue>,
    pub sections: Option<JsonValue>,
    pub total_findings: i32,
    pub severity_breakdown: SeverityBreakdown,
    pub risk_score: i32,
    pub risk_level: String,
    pub file_size: Option<i32>,
    pub created_at: Option<String>,
    pub completed_at: Option<String>,
}

impl Report {
    pub fn to_response(&self) -> ReportResponse {
        ReportResponse {
            id: self.id.clone(),
            name: self.name.clone(),
            template: self.template.clone().unwrap_or_else(|| "full".into()),
            format: self.format.clone().unwrap_or_else(|| "html".into()),
            status: self.status.clone().unwrap_or_else(|| "generating".into()),
            scan_ids: self.scan_ids.clone(),
            sections: self.sections.clone(),
            total_findings: self.total_findings.unwrap_or(0),
            severity_breakdown: SeverityBreakdown {
                critical: self.critical_count.unwrap_or(0),
                high: self.high_count.unwrap_or(0),
                medium: self.medium_count.unwrap_or(0),
                low: self.low_count.unwrap_or(0),
                info: self.info_count.unwrap_or(0),
            },
            risk_score: self.risk_score.unwrap_or(0),
            risk_level: self.risk_level.clone().unwrap_or_else(|| "None".into()),
            file_size: self.file_size,
            created_at: self.created_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            completed_at: self.completed_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
        }
    }
}
