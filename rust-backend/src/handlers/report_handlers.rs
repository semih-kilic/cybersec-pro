use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthUser;
use crate::models::Report;
use crate::AppState;

#[derive(Deserialize)]
pub struct ReportQuery {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

pub async fn list_reports(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Query(q): Query<ReportQuery>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let page = q.page.unwrap_or(1).max(1);
    let per_page = q.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    let reports: Vec<Report> = sqlx::query_as(
        "SELECT * FROM reports WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
    )
    .bind(org_id)
    .bind(per_page as i64)
    .bind(offset as i64)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let response: Vec<_> = reports.iter().map(|r| r.to_response()).collect();

    // Fetch completed scans available for report generation
    let available_scans: Vec<(String, String, String, Option<String>, Option<chrono::NaiveDateTime>)> = sqlx::query_as(
        "SELECT s.id, s.tool_id, s.target, t.name as tool_name, s.completed_at \
         FROM scans s LEFT JOIN tools t ON s.tool_id = t.id \
         WHERE s.organization_id = $1 AND s.status = 'completed' \
         ORDER BY s.completed_at DESC NULLS LAST LIMIT 100"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let available_scans_json: Vec<_> = available_scans.iter().map(|(id, tool_id, target, tool_name, completed_at)| {
        json!({
            "id": id,
            "tool_id": tool_id,
            "target": target,
            "tool_name": tool_name.as_deref().unwrap_or("Unknown"),
            "completed_at": completed_at
        })
    }).collect();

    (StatusCode::OK, Json(json!({"reports": response, "available_scans": available_scans_json}))).into_response()
}

#[derive(Deserialize)]
pub struct CreateReportRequest {
    pub name: String,
    pub template: Option<String>,
    pub format: Option<String>,
    pub scan_ids: Vec<String>,
    pub sections: Option<Vec<String>>,
}

pub async fn create_report(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CreateReportRequest>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let report_id = Uuid::new_v4().to_string();
    let template = body.template.as_deref().unwrap_or("full");
    let format = body.format.as_deref().unwrap_or("html");
    let scan_ids_json = serde_json::to_string(&body.scan_ids).unwrap_or_default();
    let sections_json = body.sections.as_ref().map(|s| serde_json::to_string(s).unwrap_or_default());

    // Aggregate findings from scans
    let mut total_findings = 0i32;
    let mut critical = 0i32;
    let mut high = 0i32;
    let mut medium = 0i32;
    let mut low = 0i32;

    for scan_id in &body.scan_ids {
        let findings: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT findings FROM scans WHERE id = $1 AND organization_id = $2"
        )
        .bind(scan_id)
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

        if let Some((Some(f_str),)) = findings {
            if let Ok(f) = serde_json::from_str::<serde_json::Value>(&f_str) {
                if let Some(summary) = f.get("summary") {
                    total_findings += summary.get("total").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    critical += summary.get("critical").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    high += summary.get("high").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    medium += summary.get("medium").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    low += summary.get("low").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                }
            }
        }
    }

    let risk_score = critical * 40 + high * 20 + medium * 5 + low;
    let risk_level = if risk_score > 200 { "Critical" } else if risk_score > 100 { "High" } else if risk_score > 30 { "Medium" } else if risk_score > 0 { "Low" } else { "None" };

    let _ = sqlx::query(
        "INSERT INTO reports (id, organization_id, user_id, name, template, format, status, scan_ids, sections, total_findings, critical_count, high_count, medium_count, low_count, risk_score, risk_level)
         VALUES ($1, $2, $3, $4, $5, $6, 'ready', $7, $8, $9, $10, $11, $12, $13, $14, $15)"
    )
    .bind(&report_id)
    .bind(org_id)
    .bind(&auth.user_id)
    .bind(&body.name)
    .bind(template)
    .bind(format)
    .bind(&scan_ids_json)
    .bind(&sections_json)
    .bind(total_findings)
    .bind(critical)
    .bind(high)
    .bind(medium)
    .bind(low)
    .bind(risk_score)
    .bind(risk_level)
    .execute(&state.db)
    .await;

    (StatusCode::CREATED, Json(json!({
        "message": "Report created",
        "report": {
            "id": report_id,
            "name": body.name,
            "template": template,
            "status": "ready",
            "total_findings": total_findings,
            "risk_score": risk_score,
            "risk_level": risk_level
        }
    }))).into_response()
}

pub async fn get_report(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(report_id): Path<String>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let report: Option<Report> = sqlx::query_as(
        "SELECT * FROM reports WHERE id = $1 AND organization_id = $2"
    )
    .bind(&report_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    match report {
        Some(r) => (StatusCode::OK, Json(json!({"report": r.to_response()}))).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Report not found"}))).into_response(),
    }
}

pub async fn delete_report(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(report_id): Path<String>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let _ = sqlx::query("DELETE FROM reports WHERE id = $1 AND organization_id = $2")
        .bind(&report_id)
        .bind(org_id)
        .execute(&state.db)
        .await;

    Json(json!({"message": "Report deleted"})).into_response()
}

pub async fn report_templates() -> impl IntoResponse {
    Json(json!({
        "templates": [
            {"id": "executive", "name": "Executive Summary", "description": "High-level overview for management"},
            {"id": "technical", "name": "Technical Report", "description": "Detailed technical findings"},
            {"id": "compliance", "name": "Compliance Report", "description": "Regulatory compliance assessment"},
            {"id": "owasp", "name": "OWASP Top 10", "description": "OWASP Top 10 vulnerability mapping"},
            {"id": "pci", "name": "PCI DSS", "description": "PCI DSS compliance report"},
            {"id": "iso", "name": "ISO 27001", "description": "ISO 27001 security assessment"},
            {"id": "full", "name": "Full Report", "description": "Comprehensive security report"}
        ]
    }))
}
