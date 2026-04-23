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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDateTime;

    fn make_scan() -> Scan {
        Scan {
            id: "scan-001".into(),
            organization_id: "org-001".into(),
            user_id: "user-001".into(),
            tool_id: "tool-001".into(),
            target: "example.com".into(),
            parameters: None,
            status: None,
            agent_id: None,
            project_id: None,
            output: None,
            error_log: None,
            findings: None,
            report_path: None,
            started_at: None,
            completed_at: None,
            created_at: None,
        }
    }

    #[test]
    fn test_duration_seconds_no_start() {
        let s = make_scan();
        assert_eq!(s.duration_seconds(), 0.0);
    }

    #[test]
    fn test_duration_str_no_start() {
        let s = make_scan();
        assert_eq!(s.duration_str(), "0s");
    }

    #[test]
    fn test_duration_str_seconds() {
        let mut s = make_scan();
        s.started_at = NaiveDateTime::parse_from_str("2026-01-01 10:00:00", "%Y-%m-%d %H:%M:%S").ok();
        s.completed_at = NaiveDateTime::parse_from_str("2026-01-01 10:00:45", "%Y-%m-%d %H:%M:%S").ok();
        assert_eq!(s.duration_str(), "45s");
        assert!((s.duration_seconds() - 45.0).abs() < 0.1);
    }

    #[test]
    fn test_duration_str_minutes() {
        let mut s = make_scan();
        s.started_at = NaiveDateTime::parse_from_str("2026-01-01 10:00:00", "%Y-%m-%d %H:%M:%S").ok();
        s.completed_at = NaiveDateTime::parse_from_str("2026-01-01 10:02:15", "%Y-%m-%d %H:%M:%S").ok();
        assert_eq!(s.duration_str(), "2m 15s");
    }

    #[test]
    fn test_findings_summary_none() {
        let s = make_scan();
        let sum = s.findings_summary();
        assert_eq!(sum.total, 0);
        assert_eq!(sum.critical, 0);
        assert_eq!(sum.high, 0);
    }

    #[test]
    fn test_findings_summary_array() {
        let mut s = make_scan();
        s.findings = Some(serde_json::json!([{"id": 1}, {"id": 2}, {"id": 3}]));
        let sum = s.findings_summary();
        assert_eq!(sum.total, 3);
        assert_eq!(sum.critical, 0);
    }

    #[test]
    fn test_findings_summary_object_with_summary() {
        let mut s = make_scan();
        s.findings = Some(serde_json::json!({
            "summary": {
                "total": 5,
                "critical": 1,
                "high": 2,
                "medium": 1,
                "low": 1,
                "open_ports": 0
            }
        }));
        let sum = s.findings_summary();
        assert_eq!(sum.total, 5);
        assert_eq!(sum.critical, 1);
        assert_eq!(sum.high, 2);
    }

    #[test]
    fn test_to_response_defaults() {
        let s = make_scan();
        let r = s.to_response();
        assert_eq!(r.status, "pending");
        assert_eq!(r.output, "");
        assert_eq!(r.id, "scan-001");
        assert_eq!(r.target, "example.com");
    }
}
