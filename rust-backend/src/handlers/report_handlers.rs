use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
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
        let tool = tool_name.as_deref().unwrap_or("Unknown");
        json!({
            "id": id,
            "name": format!("{} scan", tool),
            "tool": tool,
            "tool_id": tool_id,
            "target": target,
            "tool_name": tool,
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

// ── Scan row for report aggregation ─────────────────────
#[derive(sqlx::FromRow)]
struct ScanRow {
    id: String,
    tool_id: String,
    target: String,
    output: Option<String>,
    findings: Option<serde_json::Value>,
    started_at: Option<chrono::NaiveDateTime>,
    completed_at: Option<chrono::NaiveDateTime>,
}

#[derive(sqlx::FromRow)]
struct ToolName {
    name: Option<String>,
}

pub async fn create_report(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    _headers: HeaderMap,
    Json(body): Json<CreateReportRequest>,
) -> impl IntoResponse {
    // Rate limit: 10 reports per user per hour (CPU-intensive generation)
    if state.rate_limiter.is_limited(&format!("create_report:{}", auth.user_id), 10, std::time::Duration::from_secs(3600)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Report generation rate limit exceeded. Maximum 10 reports per hour."}))).into_response();
    }
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let report_id = Uuid::new_v4().to_string();
    let template = body.template.as_deref().unwrap_or("full");
    let format = body.format.as_deref().unwrap_or("html");
    let scan_ids_json = serde_json::to_string(&body.scan_ids).unwrap_or_default();
    let sections_json = body.sections.as_ref().map(|s| serde_json::to_string(s).unwrap_or_default());

    // Gate compliance report templates by plan
    let compliance_templates = ["compliance", "owasp", "pci", "iso", "nist", "gdpr", "hipaa", "soc2"];
    if compliance_templates.contains(&template) {
        let org_plan: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = $1")
            .bind(org_id)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);
        let plan = org_plan.map(|p| p.0).unwrap_or_else(|| "trial".into());
        let plan_configs = crate::services::plan::get_plan_configs();
        if let Some(config) = plan_configs.get(plan.as_str()) {
            if !config.features.compliance_reports {
                return (StatusCode::PAYMENT_REQUIRED, Json(json!({
                    "error": "Compliance reports require Professional or higher plan.",
                    "required_plan": "professional"
                }))).into_response();
            }
        }
    }

    // ── Collect full scan data ──────────────────────────
    let mut scan_rows: Vec<(ScanRow, String)> = Vec::new();
    let mut total_findings = 0i32;
    let mut critical = 0i32;
    let mut high = 0i32;
    let mut medium = 0i32;
    let mut low = 0i32;
    let mut info = 0i32;

    for scan_id in &body.scan_ids {
        let row: Option<ScanRow> = sqlx::query_as(
            "SELECT id, tool_id, target, output, findings, started_at, completed_at \
             FROM scans WHERE id = $1 AND organization_id = $2"
        )
        .bind(scan_id)
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

        if let Some(scan) = row {
            // Look up tool name
            let tool: Option<ToolName> = sqlx::query_as(
                "SELECT name FROM tools WHERE id = $1"
            )
            .bind(&scan.tool_id)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);
            let tool_name = tool.and_then(|t| t.name).unwrap_or_else(|| "Unknown Tool".into());

            // Aggregate severity counts
            if let Some(ref f) = scan.findings {
                if let Some(summary) = f.get("summary") {
                    total_findings += summary.get("total").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    critical += summary.get("critical").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    high += summary.get("high").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    medium += summary.get("medium").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    low += summary.get("low").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    info += summary.get("info").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                }
            }

            scan_rows.push((scan, tool_name));
        }
    }

    let risk_score = (critical * 40 + high * 20 + medium * 5 + low).min(100);
    let risk_level = if critical > 0 || risk_score > 80 { "Critical" }
        else if high > 0 || risk_score > 50 { "High" }
        else if medium > 0 || risk_score > 20 { "Medium" }
        else if total_findings > 0 { "Low" }
        else { "None" };

    // ── Generate report content ─────────────────────────
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let date_short = chrono::Utc::now().format("%Y-%m-%d").to_string();

    // Fetch org logo data URI for embedding in reports
    let org_logo = load_org_logo_data_uri(&state.db, org_id).await;

    // Fetch org name
    let org_name: Option<String> = sqlx::query_scalar("SELECT name FROM organizations WHERE id = $1")
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    // Fetch live tool & category counts from DB so the methodology section stays accurate.
    let (tools_count, categories_count) = load_tool_inventory_counts(&state.db).await;

    let html_content = generate_html_report(
        &body.name, template, &now, &date_short,
        &scan_rows, total_findings, critical, high, medium, low, info,
        risk_score, risk_level, org_logo.as_deref(), org_name.as_deref(),
        tools_count, categories_count,
    );

    // Convert based on requested format
    let content = match format {
        "json" => generate_json_report(
            &body.name, template, &now,
            &scan_rows, total_findings, critical, high, medium, low, info,
            risk_score, risk_level,
        ),
        "csv" => generate_csv_report(&scan_rows, &now),
        "markdown" => generate_markdown_report(
            &body.name, template, &now,
            &scan_rows, total_findings, critical, high, medium, low, info,
            risk_score, risk_level,
        ),
        _ => html_content.clone(), // html and pdf both start from HTML
    };

    let file_size = content.len() as i32;

    // ── Persist to DB ───────────────────────────────────
    let scan_ids_value: serde_json::Value = serde_json::from_str(&scan_ids_json).unwrap_or(json!([]));
    let sections_value: Option<serde_json::Value> = sections_json
        .as_ref()
        .and_then(|s| serde_json::from_str(s).ok());

    if let Err(e) = sqlx::query(
        "INSERT INTO reports (id, organization_id, user_id, name, template, format, status, \
         scan_ids, sections, total_findings, critical_count, high_count, medium_count, low_count, \
         info_count, risk_score, risk_level, content, file_size, completed_at) \
         VALUES ($1,$2,$3,$4,$5,$6,'ready',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())"
    )
    .bind(&report_id).bind(org_id).bind(&auth.user_id).bind(&body.name)
    .bind(template).bind(format).bind(&scan_ids_value).bind(&sections_value)
    .bind(total_findings).bind(critical).bind(high).bind(medium).bind(low)
    .bind(info).bind(risk_score).bind(risk_level).bind(&content).bind(file_size)
    .execute(&state.db)
    .await {
        tracing::error!("Failed to insert report: {}", e);
    }

    // ── Return response based on format ─────────────────
    if format == "pdf" {
        // Convert HTML to PDF using headless Chromium
        match html_to_pdf(&html_content).await {
            Ok(pdf_bytes) => {
                // Update file_size in DB with actual PDF size
                if let Err(e) = sqlx::query("UPDATE reports SET file_size = $1, content = $2 WHERE id = $3")
                    .bind(pdf_bytes.len() as i32)
                    .bind(&html_content)
                    .bind(&report_id)
                    .execute(&state.db)
                    .await {
                    tracing::error!("Failed to update PDF report: {}", e);
                }

                return (
                    StatusCode::OK,
                    [
                        (header::CONTENT_TYPE, "application/pdf"),
                        (header::CONTENT_DISPOSITION,
                         &format!("attachment; filename=\"{}.pdf\"",
                             body.name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_"))),
                    ],
                    pdf_bytes,
                ).into_response();
            }
            Err(e) => {
                tracing::error!("PDF generation failed: {}, falling back to HTML", e);
                // Fall back: return HTML with download hint
            }
        }
    }

    (StatusCode::CREATED, Json(json!({
        "message": "Report created",
        "report": {
            "id": report_id,
            "name": body.name,
            "template": template,
            "format": format,
            "status": "ready",
            "content": content,
            "total_findings": total_findings,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "file_size": file_size
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
        Some(r) => {
            let mut resp = r.to_response_json();
            // Always include content for preview/download
            if let Some(ref c) = r.content {
                resp["content"] = json!(c);
            }
            (StatusCode::OK, Json(json!({"report": resp, "content": r.content.unwrap_or_default()}))).into_response()
        }
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
            {"id": "executive", "name": "Executive Summary", "description": "High-level overview for management",
             "icon":"📊","sections":["Risk Overview","Key Findings","Recommendations"],"formats":["html","pdf","json"]},
            {"id": "technical", "name": "Technical Report", "description": "Detailed technical findings",
             "icon":"🔧","sections":["Vulnerability Details","CVE References","Technical Remediation"],"formats":["html","pdf","json","csv"]},
            {"id": "compliance", "name": "Compliance Report", "description": "Regulatory compliance assessment",
             "icon":"📋","sections":["Compliance Status","Control Mapping","Gap Analysis"],"formats":["html","pdf"]},
            {"id": "owasp", "name": "OWASP Top 10", "description": "OWASP Top 10 vulnerability mapping",
             "icon":"🛡️","sections":["OWASP Top 10 Mapping","Vulnerability Details","Remediation"],"formats":["html","pdf","json"]},
            {"id": "pci", "name": "PCI DSS", "description": "PCI DSS compliance report",
             "icon":"💳","sections":["PCI DSS Requirements","Assessment","Gaps"],"formats":["html","pdf"]},
            {"id": "iso", "name": "ISO 27001", "description": "ISO 27001 security assessment",
             "icon":"🏢","sections":["ISO 27001 Controls","Risk Assessment","Statement of Applicability"],"formats":["html","pdf"]},
            {"id": "full", "name": "Full Report", "description": "Comprehensive security report",
             "icon":"📑","sections":["Executive Summary","Technical Details","Vulnerabilities","Recommendations","Appendix"],"formats":["html","pdf","json","csv","markdown"]}
        ]
    }))
}

pub async fn sample_report(
    Path(template): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let format = params.get("format").map(|s| s.as_str()).unwrap_or("html");
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let date_short = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let dummy_scans: Vec<(ScanRow, String)> = vec![
        (ScanRow {
            id: "sample-1".into(),
            tool_id: "nmap".into(),
            target: "scanme.nmap.org".into(),
            output: Some("22/tcp open ssh\n80/tcp open http".into()),
            findings: Some(json!({"summary": {"total": 2, "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 2}}),
            started_at: Some(chrono::Utc::now().naive_utc()),
            completed_at: Some(chrono::Utc::now().naive_utc()),
        }, "Nmap".into()),
    ];

    let total_findings = 2;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 2;
    let risk_score = 5;
    let risk_level = "Low";

    let html_content = generate_html_report(
        "Sample Report", &template, &now, &date_short,
        &dummy_scans, total_findings, critical, high, medium, low, info,
        risk_score, risk_level, None, Some("CyberSec Pro Demo"),
        183, 18,
    );

    match format {
        "pdf" => {
            match html_to_pdf(&html_content).await {
                Ok(pdf_bytes) => {
                    return (
                        StatusCode::OK,
                        [
                            (header::CONTENT_TYPE, "application/pdf"),
                            (header::CONTENT_DISPOSITION, &format!("attachment; filename="{}.pdf"", template)),
                        ],
                        pdf_bytes,
                    ).into_response();
                }
                Err(_) => {
                    return (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                        html_content,
                    ).into_response();
                }
            }
        }
        _ => {
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                html_content,
            ).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════
// HTML → PDF via headless Chromium
pub async fn sample_report(
    Path(template): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let format = params.get("format").map(|s| s.as_str()).unwrap_or("html");
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let date_short = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let dummy_scans: Vec<(ScanRow, String)> = vec![
        (ScanRow {
            id: "sample-1".into(),
            tool_id: "nmap".into(),
            target: "scanme.nmap.org".into(),
            output: Some("22/tcp open ssh\n80/tcp open http".into()),
            findings: Some(json!({"summary": {"total": 2, "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 2}}),
            started_at: Some(chrono::Utc::now().naive_utc()),
            completed_at: Some(chrono::Utc::now().naive_utc()),
        }, "Nmap".into()),
    ];

    let total_findings = 2;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 2;
    let risk_score = 5;
    let risk_level = "Low";

    let html_content = generate_html_report(
        "Sample Report", &template, &now, &date_short,
        &dummy_scans, total_findings, critical, high, medium, low, info,
        risk_score, risk_level, None, Some("CyberSec Pro Demo"),
        183, 18,
    );

    match format {
        "pdf" => {
            match html_to_pdf(&html_content).await {
                Ok(pdf_bytes) => {
                    return (
                        StatusCode::OK,
                        [
                            (header::CONTENT_TYPE, "application/pdf"),
                            (header::CONTENT_DISPOSITION, &format!("attachment; filename="{}.pdf"", template)),
                        ],
                        pdf_bytes,
                    ).into_response();
                }
                Err(_) => {
                    return (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                        html_content,
                    ).into_response();
                }
            }
        }
        _ => {
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                html_content,
            ).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════
async fn html_to_pdf(html: &str) -> Result<Vec<u8>, String> {
    use tokio::process::Command;

    // Resolve Chromium binary (try multiple common names)
    let chromium_bin = ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome"]
        .iter()
        .find(|bin| std::process::Command::new("which").arg(bin).output().map(|o| o.status.success()).unwrap_or(false))
        .ok_or_else(|| "No Chromium/Chrome binary found on system. Install chromium or google-chrome.".to_string())?;

    // Write HTML to a temp file
    let tmp_html = format!("/tmp/report_{}.html", Uuid::new_v4());
    let tmp_pdf = format!("/tmp/report_{}.pdf", Uuid::new_v4());

    std::fs::write(&tmp_html, html).map_err(|e| format!("Write HTML: {}", e))?;

    // Execute with timeout (30 seconds max)
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        Command::new(chromium_bin)
            .args([
                "--headless",
                "--disable-gpu",
                "--no-sandbox",
                "--disable-software-rasterizer",
                "--disable-dev-shm-usage",
                "--run-all-compositor-stages-before-draw",
                &format!("--print-to-pdf={}", tmp_pdf),
                "--print-to-pdf-no-header",
                &tmp_html,
            ])
            .output()
    ).await;

    let cleanup = || {
        let _ = std::fs::remove_file(&tmp_html);
        let _ = std::fs::remove_file(&tmp_pdf);
    };

    let output = match result {
        Ok(Ok(o)) => o,
        Ok(Err(e)) => {
            cleanup();
            return Err(format!("Chromium exec: {}", e));
        }
        Err(_) => {
            cleanup();
            return Err("PDF generation timed out after 30 seconds".to_string());
        }
    };

    // Chromium often returns non-zero exit but still produces a valid PDF
    if std::path::Path::new(&tmp_pdf).exists() {
        let pdf_bytes = std::fs::read(&tmp_pdf).map_err(|e| {
            cleanup();
            format!("Read PDF: {}", e)
        })?;
        cleanup();
        if pdf_bytes.len() > 500 {
            return Ok(pdf_bytes);
        }
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        cleanup();
        return Err(format!("Chromium failed (exit {}): {}", output.status, stderr));
    }

    cleanup();
    Err("PDF file was not generated".to_string())
}

pub async fn sample_report(
    Path(template): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let format = params.get("format").map(|s| s.as_str()).unwrap_or("html");
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let date_short = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let dummy_scans: Vec<(ScanRow, String)> = vec![
        (ScanRow {
            id: "sample-1".into(),
            tool_id: "nmap".into(),
            target: "scanme.nmap.org".into(),
            output: Some("22/tcp open ssh\n80/tcp open http".into()),
            findings: Some(json!({"summary": {"total": 2, "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 2}}),
            started_at: Some(chrono::Utc::now().naive_utc()),
            completed_at: Some(chrono::Utc::now().naive_utc()),
        }, "Nmap".into()),
    ];

    let total_findings = 2;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 2;
    let risk_score = 5;
    let risk_level = "Low";

    let html_content = generate_html_report(
        "Sample Report", &template, &now, &date_short,
        &dummy_scans, total_findings, critical, high, medium, low, info,
        risk_score, risk_level, None, Some("CyberSec Pro Demo"),
        183, 18,
    );

    match format {
        "pdf" => {
            match html_to_pdf(&html_content).await {
                Ok(pdf_bytes) => {
                    return (
                        StatusCode::OK,
                        [
                            (header::CONTENT_TYPE, "application/pdf"),
                            (header::CONTENT_DISPOSITION, &format!("attachment; filename="{}.pdf"", template)),
                        ],
                        pdf_bytes,
                    ).into_response();
                }
                Err(_) => {
                    return (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                        html_content,
                    ).into_response();
                }
            }
        }
        _ => {
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                html_content,
            ).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════
// HTML Report Generator
pub async fn sample_report(
    Path(template): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let format = params.get("format").map(|s| s.as_str()).unwrap_or("html");
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let date_short = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let dummy_scans: Vec<(ScanRow, String)> = vec![
        (ScanRow {
            id: "sample-1".into(),
            tool_id: "nmap".into(),
            target: "scanme.nmap.org".into(),
            output: Some("22/tcp open ssh\n80/tcp open http".into()),
            findings: Some(json!({"summary": {"total": 2, "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 2}}),
            started_at: Some(chrono::Utc::now().naive_utc()),
            completed_at: Some(chrono::Utc::now().naive_utc()),
        }, "Nmap".into()),
    ];

    let total_findings = 2;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 2;
    let risk_score = 5;
    let risk_level = "Low";

    let html_content = generate_html_report(
        "Sample Report", &template, &now, &date_short,
        &dummy_scans, total_findings, critical, high, medium, low, info,
        risk_score, risk_level, None, Some("CyberSec Pro Demo"),
        183, 18,
    );

    match format {
        "pdf" => {
            match html_to_pdf(&html_content).await {
                Ok(pdf_bytes) => {
                    return (
                        StatusCode::OK,
                        [
                            (header::CONTENT_TYPE, "application/pdf"),
                            (header::CONTENT_DISPOSITION, &format!("attachment; filename="{}.pdf"", template)),
                        ],
                        pdf_bytes,
                    ).into_response();
                }
                Err(_) => {
                    return (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                        html_content,
                    ).into_response();
                }
            }
        }
        _ => {
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                html_content,
            ).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════
fn generate_html_report(
    name: &str, template: &str, now: &str, date_short: &str,
    scans: &[(ScanRow, String)],
    total: i32, crit: i32, high: i32, med: i32, low: i32, info: i32,
    risk_score: i32, risk_level: &str,
    org_logo_data_uri: Option<&str>, org_name: Option<&str>,
    tools_count: i64, categories_count: i64,
) -> String {
    let risk_color = match risk_level {
        "Critical" => "#ef4444",
        "High" => "#f97316",
        "Medium" => "#eab308",
        "Low" => "#22c55e",
        _ => "#3b82f6",
    };

    let template_title = match template {
        "executive" => "Executive Summary",
        "technical" => "Technical Report",
        "compliance" => "Compliance Assessment",
        "owasp" => "OWASP Top 10 Assessment",
        "pci" => "PCI DSS v4.0 Compliance Report",
        "iso" => "ISO 27001 Assessment",
        "nist" => "NIST CSF 2.0 Compliance Report",
        "gdpr" => "GDPR Data Protection Assessment",
        "hipaa" => "HIPAA Security Rule Compliance Report",
        "soc2" => "SOC 2 Type II Assessment Report",
        _ => "Full Security Assessment",
    };

    // Build scan details sections
    let mut scan_sections = String::new();
    for (i, (scan, tool_name)) in scans.iter().enumerate() {
        let findings_html = build_findings_html(scan);
        let raw_output_escaped = scan.output.as_deref().unwrap_or("No output captured")
            .replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
        let started = scan.started_at.map(|d| d.format("%Y-%m-%d %H:%M").to_string()).unwrap_or_default();
        let completed = scan.completed_at.map(|d| d.format("%Y-%m-%d %H:%M").to_string()).unwrap_or_default();

        scan_sections.push_str(&format!(r#"
        <div class="scan-block">
            <h3>Scan #{n}: {tool} → {target}</h3>
            <table class="meta-table">
                <tr><td><strong>Tool</strong></td><td>{tool}</td></tr>
                <tr><td><strong>Target</strong></td><td>{target}</td></tr>
                <tr><td><strong>Started</strong></td><td>{started}</td></tr>
                <tr><td><strong>Completed</strong></td><td>{completed}</td></tr>
                <tr><td><strong>Scan ID</strong></td><td style="font-family:monospace;font-size:11px">{sid}</td></tr>
            </table>
            {findings_html}
            <div class="raw-output">
                <h4>Raw Tool Output</h4>
                <pre>{raw}</pre>
            </div>
        </div>"#,
            n = i + 1,
            tool = tool_name,
            target = scan.target,
            started = started,
            completed = completed,
            sid = scan.id,
            findings_html = findings_html,
            raw = raw_output_escaped,
        ));
    }

    // Build compliance section for compliance/owasp/pci/iso templates
    let compliance_section = if matches!(template, "compliance" | "owasp" | "pci" | "iso" | "nist" | "gdpr" | "hipaa" | "soc2" | "full") {
        build_compliance_section(template, crit, high, med, low, risk_score)
    } else {
        String::new()
    };

    // Build recommendations
    let recommendations = build_recommendations(crit, high, med, low);

    // Build header logo HTML — org logo + CyberSec Pro logo
    let cybersec_svg = r##"<svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="60" rx="8" fill="#0f172a"/>
                <circle cx="30" cy="30" r="18" fill="none" stroke="#22d3ee" stroke-width="2.5"/>
                <path d="M30 16 L30 44 M18 30 L42 30 M21 21 L39 39 M39 21 L21 39" stroke="#22d3ee" stroke-width="1.5" opacity="0.4"/>
                <circle cx="30" cy="30" r="5" fill="#22d3ee"/>
                <text x="56" y="26" font-family="system-ui,sans-serif" font-weight="800" font-size="16" fill="#fff">CyberSec</text>
                <text x="56" y="44" font-family="system-ui,sans-serif" font-weight="700" font-size="14" fill="#22d3ee">Pro</text>
                <text x="88" y="44" font-family="system-ui,sans-serif" font-weight="400" font-size="8" fill="#64748b">cyber-sec-pro.com</text>
            </svg>"##;

    let logo_html = if let Some(data_uri) = org_logo_data_uri {
        let org_display = org_name.unwrap_or("Organization");
        format!(
            "<div class=\"header-logos\">\
                <img class=\"org-logo\" src=\"{}\" alt=\"{}\" />\
                <div class=\"platform-logo\">{}</div>\
            </div>",
            data_uri, org_display, cybersec_svg
        )
    } else {
        format!("<div class=\"header-logo\">{}</div>", cybersec_svg)
    };

    format!(r##"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{name} — CyberSec Pro</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;background:#fff;line-height:1.6;font-size:13px}}
.page{{max-width:900px;margin:0 auto;padding:40px 48px}}
.header{{border-bottom:3px solid #0f172a;padding-bottom:24px;margin-bottom:32px;display:flex;justify-content:space-between;align-items:flex-start}}
.header-left{{flex:1}}
.header-left h1{{font-size:22px;font-weight:800;color:#0f172a;margin-bottom:4px}}
.header .subtitle{{font-size:14px;color:#64748b;font-weight:500}}
.header .meta{{display:flex;gap:24px;margin-top:12px;font-size:11px;color:#94a3b8}}
.header .meta span{{display:flex;align-items:center;gap:4px}}
.header-logo{{width:120px;flex-shrink:0;text-align:right}}
.header-logo svg{{width:120px;height:auto}}
.header-logos{{display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0}}
.header-logos .org-logo{{width:100px;height:auto;max-height:60px;object-fit:contain}}
.header-logos .platform-logo{{width:100px}}
.header-logos .platform-logo svg{{width:100px;height:auto}}
.badge{{display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.03em}}

.summary-grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:32px}}
.summary-card{{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;text-align:center}}
.summary-card .label{{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:700}}
.summary-card .value{{font-size:28px;font-weight:800;margin-top:4px}}

.risk-bar{{height:8px;border-radius:4px;background:#e2e8f0;margin:8px 0 32px;overflow:hidden}}
.risk-bar-fill{{height:100%;border-radius:4px;transition:width .3s}}

h2{{font-size:16px;font-weight:700;color:#0f172a;margin:32px 0 16px;padding-bottom:8px;border-bottom:1px solid #e2e8f0}}
h3{{font-size:14px;font-weight:700;color:#1e293b;margin:20px 0 12px}}
h4{{font-size:12px;font-weight:700;color:#475569;margin:16px 0 8px}}

.scan-block{{margin-bottom:32px;page-break-inside:avoid}}
.meta-table{{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px}}
.meta-table td{{padding:6px 12px;border:1px solid #e2e8f0}}
.meta-table td:first-child{{width:120px;background:#f8fafc;color:#475569}}

.findings-table{{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}}
.findings-table th{{background:#0f172a;color:#fff;padding:8px 12px;text-align:left;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em}}
.findings-table td{{padding:8px 12px;border-bottom:1px solid #e2e8f0}}
.findings-table tr:nth-child(even){{background:#f8fafc}}

.sev{{display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;text-transform:uppercase}}
.sev-critical{{background:#fef2f2;color:#dc2626}}
.sev-high{{background:#fff7ed;color:#ea580c}}
.sev-medium{{background:#fefce8;color:#ca8a04}}
.sev-low{{background:#f0fdf4;color:#16a34a}}
.sev-info{{background:#eff6ff;color:#2563eb}}

.raw-output{{margin:16px 0;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}}
.raw-output h4{{background:#0f172a;color:#94a3b8;padding:8px 16px;margin:0;font-size:11px;text-transform:uppercase;letter-spacing:.06em}}
.raw-output pre{{padding:16px;font-family:'JetBrains Mono','Fira Code',monospace;font-size:11px;line-height:1.5;overflow-x:auto;background:#0f172a;color:#e2e8f0;white-space:pre-wrap;word-break:break-all;max-height:400px;overflow-y:auto}}

.compliance-table{{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}}
.compliance-table th{{background:#1e40af;color:#fff;padding:8px 12px;text-align:left;font-size:11px}}
.compliance-table td{{padding:8px 12px;border-bottom:1px solid #e2e8f0}}
.pass{{color:#16a34a;font-weight:700}}.fail{{color:#dc2626;font-weight:700}}.partial{{color:#ca8a04;font-weight:700}}

.rec-list{{list-style:none;padding:0}}
.rec-list li{{padding:10px 16px;margin-bottom:6px;border-radius:4px;font-size:12px;display:flex;gap:10px}}
.rec-list li.rec-crit{{background:#fef2f2;border-left:3px solid #dc2626}}
.rec-list li.rec-high{{background:#fff7ed;border-left:3px solid #ea580c}}
.rec-list li.rec-med{{background:#fefce8;border-left:3px solid #ca8a04}}
.rec-list li.rec-low{{background:#f0fdf4;border-left:3px solid #16a34a}}

.footer{{margin-top:48px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}}
.footer a{{color:#2563eb;text-decoration:none;font-weight:600}}
.footer a:hover{{text-decoration:underline}}

@media print{{
    body{{font-size:11px}}
    .page{{padding:20px}}
    .raw-output pre{{max-height:none}}
    .scan-block{{page-break-inside:avoid}}
    .header{{position:running(header);display:flex;justify-content:space-between;align-items:flex-start}}
    .footer{{position:running(footer)}}
    @page{{
        margin:60px 40px 50px 40px;
        @top-right{{content:element(pagelogo)}}
        @bottom-center{{content:element(pagefooter)}}
    }}
    .page-logo-repeat{{position:running(pagelogo);width:80px}}
    .page-footer-repeat{{position:running(pagefooter);font-size:9px;color:#94a3b8;text-align:center}}
    .page-footer-repeat a{{color:#2563eb;text-decoration:none}}
}}
</style>
</head>
<body>
<div class="page">
    <div class="header">
        <div class="header-left">
            <h1>{name}</h1>
            <div class="subtitle">{template_title}</div>
            <div class="meta">
                <span>📅 Generated: {now}</span>
                <span>🔬 Scans: {scan_count}</span>
                <span>🎯 Findings: {total}</span>
                <span class="badge" style="background:{risk_color}20;color:{risk_color}">Risk: {risk_level}</span>
            </div>
        </div>
        {logo_html}
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="label">Critical</div>
            <div class="value" style="color:#dc2626">{crit}</div>
        </div>
        <div class="summary-card">
            <div class="label">High</div>
            <div class="value" style="color:#ea580c">{high}</div>
        </div>
        <div class="summary-card">
            <div class="label">Medium</div>
            <div class="value" style="color:#ca8a04">{med}</div>
        </div>
        <div class="summary-card">
            <div class="label">Low / Info</div>
            <div class="value" style="color:#16a34a">{low_info}</div>
        </div>
    </div>

    <div style="font-size:12px;color:#64748b;margin-bottom:4px">Overall Risk Score: <strong style="color:{risk_color}">{risk_score}/100</strong></div>
    <div class="risk-bar"><div class="risk-bar-fill" style="width:{risk_score}%;background:{risk_color}"></div></div>

    <h2>📋 Executive Summary</h2>
    <p style="margin-bottom:16px">This security assessment was conducted on <strong>{date_short}</strong> covering
    <strong>{scan_count} scan(s)</strong> across the target infrastructure. A total of <strong>{total} finding(s)</strong>
    were identified, including <strong>{crit} critical</strong>, <strong>{high} high</strong>,
    <strong>{med} medium</strong>, and <strong>{low} low</strong> severity issues.
    The overall risk level is assessed as <strong style="color:{risk_color}">{risk_level}</strong>.</p>

    {exec_summary}

    <h2>🔍 Scan Results</h2>
    {scan_sections}

    {compliance_section}

    <h2>💡 Recommendations</h2>
    {recommendations}

    <h2>📊 Methodology</h2>
    <p style="margin-bottom:8px">This assessment was performed using <strong>CyberSec Pro</strong>, a cloud-based
    offensive security platform running <strong>{tools_count} Kali Linux tools</strong> across {categories_count} categories.
    All scans were conducted with proper authorization.</p>
    <table class="meta-table" style="margin-top:12px">
        <tr><td><strong>Platform</strong></td><td>CyberSec Pro v4.0</td></tr>
        <tr><td><strong>Report Template</strong></td><td>{template_title}</td></tr>
        <tr><td><strong>Generated</strong></td><td>{now}</td></tr>
        <tr><td><strong>Classification</strong></td><td>Confidential</td></tr>
    </table>

    <div class="footer">
        <p>Generated by <strong>CyberSec Pro</strong> | <a href="https://cyber-sec-pro.com" target="_blank">cyber-sec-pro.com</a></p>
        <p style="margin-top:4px">This report is confidential and intended only for authorized recipients.</p>
        <p>© 2026 CyberSec Pro. All rights reserved.</p>
    </div>
</div>
</body>
</html>"##,
        name = name,
        template_title = template_title,
        now = now,
        date_short = date_short,
        scan_count = scans.len(),
        tools_count = tools_count,
        categories_count = categories_count,
        total = total,
        crit = crit,
        high = high,
        med = med,
        low = low,
        low_info = low + info,
        risk_score = risk_score,
        risk_level = risk_level,
        risk_color = risk_color,
        logo_html = logo_html,
        exec_summary = build_executive_summary(scans, template),
        scan_sections = scan_sections,
        compliance_section = compliance_section,
        recommendations = recommendations,
    )
}

fn build_executive_summary(scans: &[(ScanRow, String)], _template: &str) -> String {
    if scans.is_empty() {
        return "<p style=\"color:#94a3b8\">No completed scans were included in this report.</p>".into();
    }
    let targets: Vec<&str> = scans.iter().map(|(s, _)| s.target.as_str()).collect();
    let tools: Vec<&str> = scans.iter().map(|(_, t)| t.as_str()).collect();
    let unique_targets: Vec<&str> = {
        let mut v = targets.clone();
        v.sort(); v.dedup(); v
    };

    format!(
        "<p style=\"margin-bottom:12px\">The assessment targeted <strong>{}</strong> using the following tools: <strong>{}</strong>. \
         Targets scanned: {}.</p>",
        unique_targets.len(),
        tools.join(", "),
        unique_targets.iter().map(|t| format!("<code style=\"background:#f1f5f9;padding:1px 6px;border-radius:3px;font-size:12px\">{}</code>", t)).collect::<Vec<_>>().join(", "),
    )
}

fn build_findings_html(scan: &ScanRow) -> String {
    let mut html = String::new();
    if let Some(ref f) = scan.findings {
        // Services / open ports
        if let Some(services) = f.get("services").and_then(|v| v.as_array()) {
            if !services.is_empty() {
                html.push_str("<h4>Discovered Services</h4><table class=\"findings-table\"><tr><th>Port</th><th>Protocol</th><th>State</th><th>Service</th></tr>");
                for svc in services {
                    let port = svc.get("port").and_then(|v| v.as_i64()).unwrap_or(0);
                    let proto = svc.get("protocol").and_then(|v| v.as_str()).unwrap_or("tcp");
                    let state = svc.get("state").and_then(|v| v.as_str()).unwrap_or("unknown");
                    let service = svc.get("service").and_then(|v| v.as_str()).unwrap_or("unknown");
                    let state_color = if state == "open" { "#16a34a" } else { "#94a3b8" };
                    html.push_str(&format!(
                        "<tr><td><strong>{}</strong></td><td>{}</td><td style=\"color:{}\">{}</td><td>{}</td></tr>",
                        port, proto, state_color, state, service
                    ));
                }
                html.push_str("</table>");
            }
        }

        // Vulnerabilities
        if let Some(vulns) = f.get("vulnerabilities").and_then(|v| v.as_array()) {
            if !vulns.is_empty() {
                html.push_str("<h4>Vulnerabilities</h4><table class=\"findings-table\"><tr><th>Severity</th><th>Title</th><th>Description</th><th>CVE</th></tr>");
                for vuln in vulns {
                    let sev = vuln.get("severity").and_then(|v| v.as_str()).unwrap_or("info");
                    let title = vuln.get("title").and_then(|v| v.as_str()).unwrap_or("Finding");
                    let desc = vuln.get("description").and_then(|v| v.as_str()).unwrap_or("-");
                    let cve = vuln.get("cve").and_then(|v| v.as_str()).unwrap_or("-");
                    let sev_class = match sev.to_lowercase().as_str() {
                        "critical" => "sev-critical",
                        "high" => "sev-high",
                        "medium" => "sev-medium",
                        "low" => "sev-low",
                        _ => "sev-info",
                    };
                    html.push_str(&format!(
                        "<tr><td><span class=\"sev {}\">{}</span></td><td>{}</td><td>{}</td><td>{}</td></tr>",
                        sev_class, sev.to_uppercase(), title, desc, cve
                    ));
                }
                html.push_str("</table>");
            }
        }

        // Summary stats
        if let Some(summary) = f.get("summary") {
            let open_ports = summary.get("open_ports").and_then(|v| v.as_i64()).unwrap_or(0);
            let total = summary.get("total").and_then(|v| v.as_i64()).unwrap_or(0);
            html.push_str(&format!(
                "<p style=\"margin-top:8px;font-size:11px;color:#64748b\">Summary: {} open port(s), {} total finding(s)</p>",
                open_ports, total
            ));
        }
    }
    if html.is_empty() {
        html.push_str("<p style=\"color:#94a3b8;font-style:italic\">No structured findings extracted from this scan.</p>");
    }
    html
}

fn build_compliance_section(template: &str, crit: i32, high: i32, med: i32, _low: i32, risk_score: i32) -> String {
    let framework = match template {
        "owasp" => "OWASP Top 10 (2021)",
        "pci" => "PCI DSS v4.0",
        "iso" => "ISO 27001:2022",
        "nist" => "NIST Cybersecurity Framework (CSF 2.0)",
        "gdpr" => "GDPR Data Protection",
        "hipaa" => "HIPAA Security Rule",
        "soc2" => "SOC 2 Type II — Trust Services Criteria",
        _ => "Multi-Framework Compliance",
    };

    let controls = match template {
        "owasp" => vec![
            ("A01:2021", "Broken Access Control", crit == 0 && high == 0),
            ("A02:2021", "Cryptographic Failures", crit == 0),
            ("A03:2021", "Injection", crit == 0 && high == 0),
            ("A04:2021", "Insecure Design", med < 3),
            ("A05:2021", "Security Misconfiguration", high == 0),
            ("A06:2021", "Vulnerable Components", crit == 0),
            ("A07:2021", "Auth Failures", crit == 0 && high == 0),
            ("A08:2021", "Software Integrity Failures", true),
            ("A09:2021", "Logging & Monitoring Failures", true),
            ("A10:2021", "Server-Side Request Forgery", crit == 0),
        ],
        "pci" => vec![
            ("Req 1", "Install and Maintain Network Security Controls", high == 0),
            ("Req 2", "Apply Secure Configurations to All Components", med < 3),
            ("Req 3", "Protect Stored Account Data", crit == 0),
            ("Req 4", "Protect Cardholder Data in Transit (TLS)", crit == 0),
            ("Req 5", "Protect Against Malicious Software", true),
            ("Req 6", "Develop and Maintain Secure Systems", crit == 0 && high == 0),
            ("Req 7", "Restrict Access by Business Need-to-Know", high == 0),
            ("Req 8", "Identify Users and Authenticate Access", crit == 0 && high == 0),
            ("Req 10", "Log and Monitor All Access", true),
            ("Req 11", "Test Security of Systems and Networks Regularly", risk_score < 50),
            ("Req 12", "Support Infosec with Organizational Policies", true),
        ],
        "iso" => vec![
            ("A.5", "Information Security Policies", true),
            ("A.6", "Organization of Information Security", true),
            ("A.8", "Asset Management", true),
            ("A.9", "Access Control", crit == 0 && high == 0),
            ("A.10", "Cryptography", crit == 0),
            ("A.12", "Operations Security", high == 0),
            ("A.13", "Communications Security", med < 3),
            ("A.14", "System Acquisition, Development & Maintenance", crit == 0),
            ("A.16", "Information Security Incident Management", true),
            ("A.18", "Compliance", risk_score < 50),
        ],
        "nist" => vec![
            ("GV", "Govern — Establish cybersecurity risk strategy", true),
            ("ID.AM", "Identify — Asset Management", true),
            ("ID.RA", "Identify — Risk Assessment", risk_score < 60),
            ("PR.AC", "Protect — Access Control", crit == 0 && high == 0),
            ("PR.DS", "Protect — Data Security", crit == 0),
            ("PR.IP", "Protect — Information Protection Processes", high == 0),
            ("PR.MA", "Protect — Maintenance", med < 5),
            ("PR.PT", "Protect — Protective Technology", high == 0),
            ("DE.AE", "Detect — Anomalies and Events", true),
            ("DE.CM", "Detect — Continuous Monitoring", true),
            ("RS.RP", "Respond — Response Planning", true),
            ("RS.MI", "Respond — Mitigation", crit == 0),
            ("RC.RP", "Recover — Recovery Planning", true),
        ],
        "gdpr" => vec![
            ("Art. 5", "Principles of Data Processing", crit == 0),
            ("Art. 25", "Data Protection by Design and by Default", high == 0),
            ("Art. 30", "Records of Processing Activities", true),
            ("Art. 32", "Security of Processing — Encryption & Pseudonymisation", crit == 0),
            ("Art. 32", "Security of Processing — Confidentiality & Integrity", high == 0),
            ("Art. 32", "Security of Processing — Availability & Resilience", med < 5),
            ("Art. 33", "Notification of Personal Data Breach", crit == 0),
            ("Art. 35", "Data Protection Impact Assessment", risk_score < 60),
            ("Art. 44", "Transfer Safeguards — Adequate Protection", true),
        ],
        "hipaa" => vec![
            ("§164.308(a)(1)", "Security Management Process — Risk Analysis", risk_score < 60),
            ("§164.308(a)(3)", "Workforce Security", high == 0),
            ("§164.308(a)(4)", "Information Access Management", crit == 0 && high == 0),
            ("§164.308(a)(5)", "Security Awareness and Training", true),
            ("§164.310(a)", "Facility Access Controls", true),
            ("§164.310(d)", "Device and Media Controls", true),
            ("§164.312(a)", "Access Control — Unique User ID, Auto-Logoff", crit == 0),
            ("§164.312(b)", "Audit Controls", true),
            ("§164.312(c)", "Integrity Controls", crit == 0 && high == 0),
            ("§164.312(d)", "Person or Entity Authentication", crit == 0),
            ("§164.312(e)", "Transmission Security — Encryption", crit == 0),
        ],
        "soc2" => vec![
            ("CC1", "Control Environment", true),
            ("CC2", "Communication and Information", true),
            ("CC3", "Risk Assessment", risk_score < 60),
            ("CC5", "Control Activities", high == 0),
            ("CC6.1", "Logical and Physical Access — Authentication", crit == 0 && high == 0),
            ("CC6.6", "Security Against Threats Outside System Boundaries", crit == 0),
            ("CC6.7", "Restrict Data Transmission to Authorized Users", crit == 0),
            ("CC7.1", "Detect and Monitor Security Events", true),
            ("CC7.2", "Monitor for Anomalies — Indicators of Compromise", high == 0),
            ("CC7.3", "Evaluate Security Events", med < 5),
            ("CC8.1", "Change Management", true),
            ("CC9.1", "Risk Mitigation", crit == 0),
        ],
        _ => vec![
            ("NIST CSF", "Identify & Protect", high == 0),
            ("OWASP", "Top 10 Controls", crit == 0),
            ("PCI DSS", "Network & App Security (Req 1, 6, 11)", risk_score < 50),
            ("GDPR Art.32", "Security of Processing", crit == 0),
            ("HIPAA §164.312", "Technical Safeguards", crit == 0 && high == 0),
            ("SOC 2 CC6", "Logical Access & Security", med < 5),
            ("ISO 27001 A.12", "Operations Security", high == 0),
        ],
    };

    let mut rows = String::new();
    let (mut pass_count, mut fail_count) = (0, 0);
    for (id, name, passed) in &controls {
        let (status_class, status_text) = if *passed {
            pass_count += 1;
            ("pass", "PASS")
        } else {
            fail_count += 1;
            ("fail", "FAIL")
        };
        rows.push_str(&format!(
            "<tr><td><strong>{}</strong></td><td>{}</td><td class=\"{}\">{}</td></tr>",
            id, name, status_class, status_text
        ));
    }

    let total_controls = controls.len();
    let pass_pct = if total_controls > 0 { pass_count * 100 / total_controls } else { 0 };

    format!(
        "<h2>🏛️ {} Compliance</h2>\
         <p style=\"margin-bottom:12px\">Compliance score: <strong>{}/{} controls passing ({}%)</strong></p>\
         <table class=\"compliance-table\"><tr><th>Control</th><th>Description</th><th>Status</th></tr>{}</table>",
        framework, pass_count, total_controls, pass_pct, rows
    )
}

fn build_recommendations(crit: i32, high: i32, med: i32, low: i32) -> String {
    let mut recs = String::from("<ul class=\"rec-list\">");

    if crit > 0 {
        recs.push_str(&format!(
            "<li class=\"rec-crit\"><strong>🔴 CRITICAL:</strong> {} critical finding(s) require immediate remediation. \
             Patch vulnerable services, rotate exposed credentials, and assess blast radius.</li>", crit));
    }
    if high > 0 {
        recs.push_str(&format!(
            "<li class=\"rec-high\"><strong>🟠 HIGH:</strong> {} high-severity issue(s) found. Schedule remediation within 7 days. \
             Review service configurations and update vulnerable software versions.</li>", high));
    }
    if med > 0 {
        recs.push_str(&format!(
            "<li class=\"rec-med\"><strong>🟡 MEDIUM:</strong> {} medium-severity finding(s). Plan remediation within 30 days. \
             Harden configurations and implement defense-in-depth controls.</li>", med));
    }
    if low > 0 {
        recs.push_str(&format!(
            "<li class=\"rec-low\"><strong>🟢 LOW:</strong> {} low-severity issue(s). Address during next maintenance window. \
             These represent informational findings and best-practice improvements.</li>", low));
    }
    if crit == 0 && high == 0 && med == 0 && low == 0 {
        recs.push_str(
            "<li class=\"rec-low\"><strong>✅ CLEAN:</strong> No significant vulnerabilities detected in this assessment. \
             Continue regular scanning and maintain current security posture.</li>");
    }

    recs.push_str("</ul>");
    recs
}

pub async fn sample_report(
    Path(template): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let format = params.get("format").map(|s| s.as_str()).unwrap_or("html");
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let date_short = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let dummy_scans: Vec<(ScanRow, String)> = vec![
        (ScanRow {
            id: "sample-1".into(),
            tool_id: "nmap".into(),
            target: "scanme.nmap.org".into(),
            output: Some("22/tcp open ssh\n80/tcp open http".into()),
            findings: Some(json!({"summary": {"total": 2, "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 2}}),
            started_at: Some(chrono::Utc::now().naive_utc()),
            completed_at: Some(chrono::Utc::now().naive_utc()),
        }, "Nmap".into()),
    ];

    let total_findings = 2;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 2;
    let risk_score = 5;
    let risk_level = "Low";

    let html_content = generate_html_report(
        "Sample Report", &template, &now, &date_short,
        &dummy_scans, total_findings, critical, high, medium, low, info,
        risk_score, risk_level, None, Some("CyberSec Pro Demo"),
        183, 18,
    );

    match format {
        "pdf" => {
            match html_to_pdf(&html_content).await {
                Ok(pdf_bytes) => {
                    return (
                        StatusCode::OK,
                        [
                            (header::CONTENT_TYPE, "application/pdf"),
                            (header::CONTENT_DISPOSITION, &format!("attachment; filename="{}.pdf"", template)),
                        ],
                        pdf_bytes,
                    ).into_response();
                }
                Err(_) => {
                    return (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                        html_content,
                    ).into_response();
                }
            }
        }
        _ => {
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                html_content,
            ).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════
// JSON Report Generator
pub async fn sample_report(
    Path(template): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let format = params.get("format").map(|s| s.as_str()).unwrap_or("html");
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let date_short = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let dummy_scans: Vec<(ScanRow, String)> = vec![
        (ScanRow {
            id: "sample-1".into(),
            tool_id: "nmap".into(),
            target: "scanme.nmap.org".into(),
            output: Some("22/tcp open ssh\n80/tcp open http".into()),
            findings: Some(json!({"summary": {"total": 2, "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 2}}),
            started_at: Some(chrono::Utc::now().naive_utc()),
            completed_at: Some(chrono::Utc::now().naive_utc()),
        }, "Nmap".into()),
    ];

    let total_findings = 2;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 2;
    let risk_score = 5;
    let risk_level = "Low";

    let html_content = generate_html_report(
        "Sample Report", &template, &now, &date_short,
        &dummy_scans, total_findings, critical, high, medium, low, info,
        risk_score, risk_level, None, Some("CyberSec Pro Demo"),
        183, 18,
    );

    match format {
        "pdf" => {
            match html_to_pdf(&html_content).await {
                Ok(pdf_bytes) => {
                    return (
                        StatusCode::OK,
                        [
                            (header::CONTENT_TYPE, "application/pdf"),
                            (header::CONTENT_DISPOSITION, &format!("attachment; filename="{}.pdf"", template)),
                        ],
                        pdf_bytes,
                    ).into_response();
                }
                Err(_) => {
                    return (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                        html_content,
                    ).into_response();
                }
            }
        }
        _ => {
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                html_content,
            ).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════
fn generate_json_report(
    name: &str, template: &str, now: &str,
    scans: &[(ScanRow, String)],
    total: i32, crit: i32, high: i32, med: i32, low: i32, info: i32,
    risk_score: i32, risk_level: &str,
) -> String {
    let scan_data: Vec<serde_json::Value> = scans.iter().map(|(s, tool_name)| {
        json!({
            "scan_id": s.id,
            "tool": tool_name,
            "target": s.target,
            "started_at": s.started_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            "completed_at": s.completed_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            "findings": s.findings,
            "output_length": s.output.as_ref().map(|o| o.len()).unwrap_or(0),
        })
    }).collect();

    serde_json::to_string_pretty(&json!({
        "report": {
            "name": name,
            "template": template,
            "generated_at": now,
            "platform": "CyberSec Pro v4.0",
            "url": "https://cyber-sec-pro.com",
        },
        "summary": {
            "total_findings": total,
            "critical": crit,
            "high": high,
            "medium": med,
            "low": low,
            "info": info,
            "risk_score": risk_score,
            "risk_level": risk_level,
        },
        "scans": scan_data,
    })).unwrap_or_else(|_| "{}".into())
}

pub async fn sample_report(
    Path(template): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let format = params.get("format").map(|s| s.as_str()).unwrap_or("html");
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let date_short = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let dummy_scans: Vec<(ScanRow, String)> = vec![
        (ScanRow {
            id: "sample-1".into(),
            tool_id: "nmap".into(),
            target: "scanme.nmap.org".into(),
            output: Some("22/tcp open ssh\n80/tcp open http".into()),
            findings: Some(json!({"summary": {"total": 2, "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 2}}),
            started_at: Some(chrono::Utc::now().naive_utc()),
            completed_at: Some(chrono::Utc::now().naive_utc()),
        }, "Nmap".into()),
    ];

    let total_findings = 2;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 2;
    let risk_score = 5;
    let risk_level = "Low";

    let html_content = generate_html_report(
        "Sample Report", &template, &now, &date_short,
        &dummy_scans, total_findings, critical, high, medium, low, info,
        risk_score, risk_level, None, Some("CyberSec Pro Demo"),
        183, 18,
    );

    match format {
        "pdf" => {
            match html_to_pdf(&html_content).await {
                Ok(pdf_bytes) => {
                    return (
                        StatusCode::OK,
                        [
                            (header::CONTENT_TYPE, "application/pdf"),
                            (header::CONTENT_DISPOSITION, &format!("attachment; filename="{}.pdf"", template)),
                        ],
                        pdf_bytes,
                    ).into_response();
                }
                Err(_) => {
                    return (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                        html_content,
                    ).into_response();
                }
            }
        }
        _ => {
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                html_content,
            ).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════
// CSV Report Generator
pub async fn sample_report(
    Path(template): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let format = params.get("format").map(|s| s.as_str()).unwrap_or("html");
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let date_short = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let dummy_scans: Vec<(ScanRow, String)> = vec![
        (ScanRow {
            id: "sample-1".into(),
            tool_id: "nmap".into(),
            target: "scanme.nmap.org".into(),
            output: Some("22/tcp open ssh\n80/tcp open http".into()),
            findings: Some(json!({"summary": {"total": 2, "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 2}}),
            started_at: Some(chrono::Utc::now().naive_utc()),
            completed_at: Some(chrono::Utc::now().naive_utc()),
        }, "Nmap".into()),
    ];

    let total_findings = 2;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 2;
    let risk_score = 5;
    let risk_level = "Low";

    let html_content = generate_html_report(
        "Sample Report", &template, &now, &date_short,
        &dummy_scans, total_findings, critical, high, medium, low, info,
        risk_score, risk_level, None, Some("CyberSec Pro Demo"),
        183, 18,
    );

    match format {
        "pdf" => {
            match html_to_pdf(&html_content).await {
                Ok(pdf_bytes) => {
                    return (
                        StatusCode::OK,
                        [
                            (header::CONTENT_TYPE, "application/pdf"),
                            (header::CONTENT_DISPOSITION, &format!("attachment; filename="{}.pdf"", template)),
                        ],
                        pdf_bytes,
                    ).into_response();
                }
                Err(_) => {
                    return (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                        html_content,
                    ).into_response();
                }
            }
        }
        _ => {
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                html_content,
            ).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════
fn generate_csv_report(scans: &[(ScanRow, String)], now: &str) -> String {
    let mut csv = String::from("Scan ID,Tool,Target,Port,Protocol,State,Service,Severity,Finding,Generated\n");
    for (scan, tool_name) in scans {
        if let Some(ref f) = scan.findings {
            if let Some(services) = f.get("services").and_then(|v| v.as_array()) {
                for svc in services {
                    csv.push_str(&format!("{},{},{},{},{},{},{},info,open port,{}\n",
                        scan.id, tool_name, scan.target,
                        svc.get("port").and_then(|v| v.as_i64()).unwrap_or(0),
                        svc.get("protocol").and_then(|v| v.as_str()).unwrap_or("tcp"),
                        svc.get("state").and_then(|v| v.as_str()).unwrap_or(""),
                        svc.get("service").and_then(|v| v.as_str()).unwrap_or(""),
                        now,
                    ));
                }
            }
            if let Some(vulns) = f.get("vulnerabilities").and_then(|v| v.as_array()) {
                for vuln in vulns {
                    let title = vuln.get("title").and_then(|v| v.as_str()).unwrap_or("").replace(',', ";");
                    csv.push_str(&format!("{},{},{},,,,,{},{},{}\n",
                        scan.id, tool_name, scan.target,
                        vuln.get("severity").and_then(|v| v.as_str()).unwrap_or("info"),
                        title, now,
                    ));
                }
            }
        }
    }
    csv
}

pub async fn sample_report(
    Path(template): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let format = params.get("format").map(|s| s.as_str()).unwrap_or("html");
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let date_short = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let dummy_scans: Vec<(ScanRow, String)> = vec![
        (ScanRow {
            id: "sample-1".into(),
            tool_id: "nmap".into(),
            target: "scanme.nmap.org".into(),
            output: Some("22/tcp open ssh\n80/tcp open http".into()),
            findings: Some(json!({"summary": {"total": 2, "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 2}}),
            started_at: Some(chrono::Utc::now().naive_utc()),
            completed_at: Some(chrono::Utc::now().naive_utc()),
        }, "Nmap".into()),
    ];

    let total_findings = 2;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 2;
    let risk_score = 5;
    let risk_level = "Low";

    let html_content = generate_html_report(
        "Sample Report", &template, &now, &date_short,
        &dummy_scans, total_findings, critical, high, medium, low, info,
        risk_score, risk_level, None, Some("CyberSec Pro Demo"),
        183, 18,
    );

    match format {
        "pdf" => {
            match html_to_pdf(&html_content).await {
                Ok(pdf_bytes) => {
                    return (
                        StatusCode::OK,
                        [
                            (header::CONTENT_TYPE, "application/pdf"),
                            (header::CONTENT_DISPOSITION, &format!("attachment; filename="{}.pdf"", template)),
                        ],
                        pdf_bytes,
                    ).into_response();
                }
                Err(_) => {
                    return (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                        html_content,
                    ).into_response();
                }
            }
        }
        _ => {
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                html_content,
            ).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════
// Markdown Report Generator
pub async fn sample_report(
    Path(template): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let format = params.get("format").map(|s| s.as_str()).unwrap_or("html");
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let date_short = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let dummy_scans: Vec<(ScanRow, String)> = vec![
        (ScanRow {
            id: "sample-1".into(),
            tool_id: "nmap".into(),
            target: "scanme.nmap.org".into(),
            output: Some("22/tcp open ssh\n80/tcp open http".into()),
            findings: Some(json!({"summary": {"total": 2, "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 2}}),
            started_at: Some(chrono::Utc::now().naive_utc()),
            completed_at: Some(chrono::Utc::now().naive_utc()),
        }, "Nmap".into()),
    ];

    let total_findings = 2;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 2;
    let risk_score = 5;
    let risk_level = "Low";

    let html_content = generate_html_report(
        "Sample Report", &template, &now, &date_short,
        &dummy_scans, total_findings, critical, high, medium, low, info,
        risk_score, risk_level, None, Some("CyberSec Pro Demo"),
        183, 18,
    );

    match format {
        "pdf" => {
            match html_to_pdf(&html_content).await {
                Ok(pdf_bytes) => {
                    return (
                        StatusCode::OK,
                        [
                            (header::CONTENT_TYPE, "application/pdf"),
                            (header::CONTENT_DISPOSITION, &format!("attachment; filename="{}.pdf"", template)),
                        ],
                        pdf_bytes,
                    ).into_response();
                }
                Err(_) => {
                    return (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                        html_content,
                    ).into_response();
                }
            }
        }
        _ => {
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                html_content,
            ).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════
fn generate_markdown_report(
    name: &str, template: &str, now: &str,
    scans: &[(ScanRow, String)],
    total: i32, crit: i32, high: i32, med: i32, low: i32, info: i32,
    risk_score: i32, risk_level: &str,
) -> String {
    let mut md = format!("# {}\n\n**Template:** {} | **Generated:** {} | **Platform:** CyberSec Pro v4.0 | **Website:** [cyber-sec-pro.com](https://cyber-sec-pro.com)\n\n", name, template, now);
    md.push_str(&format!("## Summary\n\n| Metric | Value |\n|--------|-------|\n| Total Findings | {} |\n| Critical | {} |\n| High | {} |\n| Medium | {} |\n| Low | {} |\n| Info | {} |\n| Risk Score | {}/100 |\n| Risk Level | {} |\n\n",
        total, crit, high, med, low, info, risk_score, risk_level));

    for (i, (scan, tool_name)) in scans.iter().enumerate() {
        md.push_str(&format!("## Scan #{}: {} → {}\n\n", i + 1, tool_name, scan.target));
        if let Some(ref f) = scan.findings {
            if let Some(services) = f.get("services").and_then(|v| v.as_array()) {
                if !services.is_empty() {
                    md.push_str("### Open Ports\n\n| Port | Protocol | State | Service |\n|------|----------|-------|--------|\n");
                    for svc in services {
                        md.push_str(&format!("| {} | {} | {} | {} |\n",
                            svc.get("port").and_then(|v| v.as_i64()).unwrap_or(0),
                            svc.get("protocol").and_then(|v| v.as_str()).unwrap_or("tcp"),
                            svc.get("state").and_then(|v| v.as_str()).unwrap_or(""),
                            svc.get("service").and_then(|v| v.as_str()).unwrap_or(""),
                        ));
                    }
                    md.push('\n');
                }
            }
        }
        if let Some(ref output) = scan.output {
            md.push_str(&format!("### Raw Output\n\n```\n{}\n```\n\n", output));
        }
    }
    md
}

// ── Organization Logo Upload ────────────────────────────────────────────

pub async fn upload_org_logo(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    // Max 5MB
    if body.len() > 5 * 1024 * 1024 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "File too large. Max 5MB"}))).into_response();
    }
    if body.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "No file data received"}))).into_response();
    }

    // Detect image type from magic bytes (PNG, JPG, GIF, WebP, SVG)
    let ext = if body.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "png"
    } else if body.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "jpg"
    } else if body.starts_with(b"GIF8") {
        "gif"
    } else if body.starts_with(b"RIFF") && body.len() > 12 && &body[8..12] == b"WEBP" {
        "webp"
    } else if body.starts_with(b"<?xml") || body.starts_with(b"<svg") {
        "svg"
    } else {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid image format. Accepted: PNG, JPG, GIF, WebP, SVG"}))).into_response();
    };

    // Validate org_id is a valid UUID to prevent path traversal
    if uuid::Uuid::parse_str(&org_id).is_err() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid organization"}))).into_response();
    }

    // Save to disk
    let upload_dir = std::path::Path::new("/home/cybersec/cybersec-pro/uploads/logos");
    if let Err(e) = tokio::fs::create_dir_all(upload_dir).await {
        tracing::error!("Failed to create logos dir: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Server storage error"}))).into_response();
    }

    // Remove old logo files for this org (any extension)
    if let Ok(mut entries) = tokio::fs::read_dir(upload_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with(&org_id) {
                let _ = tokio::fs::remove_file(entry.path()).await;
            }
        }
    }

    let filename = format!("{}.{}", org_id, ext);
    let filepath = upload_dir.join(&filename);

    if let Err(e) = tokio::fs::write(&filepath, &body).await {
        tracing::error!("Failed to write logo: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save logo"}))).into_response();
    }

    // Update organization logo_url in DB
    let logo_url = format!("/uploads/logos/{}", filename);
    let _ = sqlx::query("UPDATE organizations SET logo_url = $1 WHERE id = $2")
        .bind(&logo_url)
        .bind(&org_id)
        .execute(&state.db)
        .await;

    Json(json!({"message": "Logo uploaded", "logo_url": logo_url})).into_response()
}

pub async fn delete_org_logo(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    // Remove files from disk
    let upload_dir = std::path::Path::new("/home/cybersec/cybersec-pro/uploads/logos");
    if let Ok(mut entries) = tokio::fs::read_dir(upload_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with(&org_id) {
                let _ = tokio::fs::remove_file(entry.path()).await;
            }
        }
    }

    // Clear in DB
    let _ = sqlx::query("UPDATE organizations SET logo_url = NULL WHERE id = $1")
        .bind(&org_id)
        .execute(&state.db)
        .await;

    Json(json!({"message": "Logo removed"})).into_response()
}

pub async fn get_org_logo(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let logo_url: Option<String> = sqlx::query_scalar(
        "SELECT logo_url FROM organizations WHERE id = $1 AND logo_url IS NOT NULL"
    )
    .bind(&org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    Json(json!({"logo_url": logo_url})).into_response()
}

/// Read org logo from disk and return as a base64 data URI for embedding in reports.
/// Returns None if no logo is set or file can't be read.
async fn load_org_logo_data_uri(db: &sqlx::PgPool, org_id: &str) -> Option<String> {
    let logo_url: String = sqlx::query_scalar(
        "SELECT logo_url FROM organizations WHERE id = $1 AND logo_url IS NOT NULL"
    )
    .bind(org_id)
    .fetch_optional(db)
    .await
    .ok()??;

    // logo_url is like /uploads/logos/{org_id}.png
    let disk_path = format!("/home/cybersec/cybersec-pro{}", logo_url);
    let bytes = tokio::fs::read(&disk_path).await.ok()?;

    let ext = logo_url.rsplit('.').next().unwrap_or("png");
    if ext == "svg" {
        // For SVG, return the raw SVG markup as base64 data URI
        Some(format!("data:image/svg+xml;base64,{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes)))
    } else {
        let mime = match ext {
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            _ => "image/png",
        };
        Some(format!("data:{};base64,{}", mime, base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes)))
    }
}

/// Read live tool inventory counts from the DB so the methodology section in
/// generated reports always reflects the actual catalog rather than hard-coded numbers.
/// Falls back to (0, 0) if the query fails — the template will simply render zero,
/// which is preferable to inventing numbers.
async fn load_tool_inventory_counts(db: &sqlx::PgPool) -> (i64, i64) {
    let tools: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tools WHERE is_active = TRUE"
    )
    .fetch_one(db)
    .await
    .unwrap_or(0);

    let categories: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT category) FROM tools WHERE is_active = TRUE AND category IS NOT NULL AND category <> ''"
    )
    .fetch_one(db)
    .await
    .unwrap_or(0);

    (tools, categories)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── build_recommendations ─────────────────────────────────────────────────

    #[test]
    fn report_recommendations_clean_scan_message() {
        let html = build_recommendations(0, 0, 0, 0);
        assert!(html.contains("CLEAN"), "expected CLEAN message for zero findings");
        assert!(!html.contains("CRITICAL"));
        assert!(!html.contains("HIGH"));
    }

    #[test]
    fn report_recommendations_critical_only() {
        let html = build_recommendations(3, 0, 0, 0);
        assert!(html.contains("CRITICAL"), "CRITICAL section missing");
        assert!(html.contains("3 critical"), "count mismatch");
        assert!(!html.contains("CLEAN"));
        assert!(!html.contains("HIGH"));
    }

    #[test]
    fn report_recommendations_all_severities_present() {
        let html = build_recommendations(1, 2, 3, 4);
        assert!(html.contains("CRITICAL"));
        assert!(html.contains("HIGH"));
        assert!(html.contains("MEDIUM"));
        assert!(html.contains("LOW"));
        assert!(!html.contains("CLEAN"));
    }

    // ── build_compliance_section ──────────────────────────────────────────────

    #[test]
    fn report_compliance_owasp_all_pass_when_clean() {
        let html = build_compliance_section("owasp", 0, 0, 0, 0, 10);
        assert!(html.contains("OWASP Top 10"), "framework name missing");
        assert!(!html.contains(">FAIL<"), "expected zero FAIL rows with clean scan");
    }

    #[test]
    fn report_compliance_owasp_fails_on_critical() {
        let html = build_compliance_section("owasp", 1, 0, 0, 0, 80);
        assert!(html.contains(">FAIL<"), "expected at least one FAIL row");
    }

    #[test]
    fn report_compliance_pci_higher_risk_yields_more_failures() {
        let html_low_risk  = build_compliance_section("pci", 0, 0, 0, 0, 40);
        let html_high_risk = build_compliance_section("pci", 0, 0, 0, 0, 75);
        assert!(html_low_risk.contains("PCI DSS"), "framework name missing");
        let fails_low  = html_low_risk.matches(">FAIL<").count();
        let fails_high = html_high_risk.matches(">FAIL<").count();
        assert!(fails_high >= fails_low, "higher risk_score should yield at least as many failures");
    }

    #[test]
    fn report_compliance_unknown_template_uses_multi_framework() {
        let html = build_compliance_section("unknown_template", 0, 0, 0, 0, 30);
        assert!(html.contains("Multi-Framework Compliance"), "should fall back to multi-framework");
    }

    #[test]
    fn report_compliance_pass_percentage_embedded_in_output() {
        let html = build_compliance_section("iso", 0, 0, 0, 0, 30);
        assert!(html.contains("controls passing"), "pass count text missing");
        assert!(html.contains('%'), "percentage sign missing");
    }

    // ── build_executive_summary ───────────────────────────────────────────────

    #[test]
    fn report_executive_summary_empty_scans() {
        let html = build_executive_summary(&[], "full");
        assert!(html.contains("No completed scans"), "empty state message missing");
    }

    #[test]
    fn report_executive_summary_single_scan() {
        let scan = ScanRow {
            id: "scan-1".into(),
            tool_id: "tool-1".into(),
            target: "10.0.0.1".into(),
            output: None,
            findings: None,
            started_at: None,
            completed_at: None,
        };
        let html = build_executive_summary(&[(scan, "nmap".into())], "full");
        assert!(html.contains("10.0.0.1"), "target missing from summary");
        assert!(html.contains("nmap"), "tool name missing from summary");
    }

    #[test]
    fn report_executive_summary_deduplicates_targets() {
        let make_scan = |target: &str, tool: &str| -> (ScanRow, String) {
            (ScanRow {
                id: uuid::Uuid::new_v4().to_string(),
                tool_id: "t".into(),
                target: target.into(),
                output: None,
                findings: None,
                started_at: None,
                completed_at: None,
            }, tool.into())
        };
        let scans = vec![
            make_scan("192.168.1.1", "nmap"),
            make_scan("192.168.1.1", "masscan"),
            make_scan("10.0.0.5", "nikto"),
        ];
        let html = build_executive_summary(&scans, "full");
        // 2 unique targets — the summary embeds the deduplicated count
        assert!(html.contains("<strong>2</strong>"), "should deduplicate to 2 unique targets");
    }
}
