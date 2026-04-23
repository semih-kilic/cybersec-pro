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

    pub fn to_response_json(&self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "name": self.name,
            "template": self.template.clone().unwrap_or_else(|| "full".into()),
            "format": self.format.clone().unwrap_or_else(|| "html".into()),
            "status": self.status.clone().unwrap_or_else(|| "generating".into()),
            "scan_ids": self.scan_ids,
            "sections": self.sections,
            "total_findings": self.total_findings.unwrap_or(0),
            "severity_breakdown": {
                "critical": self.critical_count.unwrap_or(0),
                "high": self.high_count.unwrap_or(0),
                "medium": self.medium_count.unwrap_or(0),
                "low": self.low_count.unwrap_or(0),
                "info": self.info_count.unwrap_or(0),
            },
            "risk_score": self.risk_score.unwrap_or(0),
            "risk_level": self.risk_level.clone().unwrap_or_else(|| "None".into()),
            "file_size": self.file_size,
            "created_at": self.created_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            "completed_at": self.completed_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_report() -> Report {
        Report {
            id: "rep-001".into(),
            organization_id: "org-001".into(),
            user_id: "user-001".into(),
            name: "Q1 Report".into(),
            template: None,
            format: None,
            status: None,
            scan_ids: None,
            sections: None,
            total_findings: None,
            critical_count: None,
            high_count: None,
            medium_count: None,
            low_count: None,
            info_count: None,
            risk_score: None,
            risk_level: None,
            content: None,
            file_path: None,
            file_size: None,
            created_at: None,
            completed_at: None,
        }
    }

    #[test]
    fn test_to_response_defaults() {
        let r = make_report();
        let resp = r.to_response();
        assert_eq!(resp.id, "rep-001");
        assert_eq!(resp.name, "Q1 Report");
        assert_eq!(resp.template, "full");
        assert_eq!(resp.format, "html");
        assert_eq!(resp.status, "generating");
        assert_eq!(resp.total_findings, 0);
        assert_eq!(resp.risk_score, 0);
        assert_eq!(resp.risk_level, "None");
        assert!(resp.file_size.is_none());
    }

    #[test]
    fn test_to_response_severity_breakdown_defaults_to_zero() {
        let r = make_report();
        let resp = r.to_response();
        assert_eq!(resp.severity_breakdown.critical, 0);
        assert_eq!(resp.severity_breakdown.high, 0);
        assert_eq!(resp.severity_breakdown.medium, 0);
        assert_eq!(resp.severity_breakdown.low, 0);
        assert_eq!(resp.severity_breakdown.info, 0);
    }

    #[test]
    fn test_to_response_severity_breakdown_uses_counts() {
        let mut r = make_report();
        r.critical_count = Some(2);
        r.high_count = Some(5);
        r.medium_count = Some(3);
        r.low_count = Some(1);
        r.info_count = Some(4);
        r.total_findings = Some(15);
        let resp = r.to_response();
        assert_eq!(resp.severity_breakdown.critical, 2);
        assert_eq!(resp.severity_breakdown.high, 5);
        assert_eq!(resp.severity_breakdown.info, 4);
        assert_eq!(resp.total_findings, 15);
    }

    #[test]
    fn test_to_response_explicit_template_and_format() {
        let mut r = make_report();
        r.template = Some("executive".into());
        r.format = Some("pdf".into());
        r.status = Some("completed".into());
        r.risk_level = Some("High".into());
        let resp = r.to_response();
        assert_eq!(resp.template, "executive");
        assert_eq!(resp.format, "pdf");
        assert_eq!(resp.status, "completed");
        assert_eq!(resp.risk_level, "High");
    }

    #[test]
    fn test_to_response_json_matches_to_response() {
        let mut r = make_report();
        r.total_findings = Some(7);
        r.risk_score = Some(42);
        let resp = r.to_response();
        let json = r.to_response_json();
        assert_eq!(json["total_findings"], resp.total_findings);
        assert_eq!(json["risk_score"], resp.risk_score);
        assert_eq!(json["template"].as_str().unwrap(), resp.template);
    }
}
