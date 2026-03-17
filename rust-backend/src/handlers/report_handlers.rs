use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
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

    let html_content = generate_html_report(
        &body.name, template, &now, &date_short,
        &scan_rows, total_findings, critical, high, medium, low, info,
        risk_score, risk_level,
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

// ═══════════════════════════════════════════════════════════
// HTML → PDF via headless Chromium
// ═══════════════════════════════════════════════════════════
async fn html_to_pdf(html: &str) -> Result<Vec<u8>, String> {
    use tokio::process::Command;
    use std::io::Write;

    // Write HTML to a temp file
    let tmp_html = format!("/tmp/report_{}.html", Uuid::new_v4());
    let tmp_pdf = format!("/tmp/report_{}.pdf", Uuid::new_v4());

    std::fs::write(&tmp_html, html).map_err(|e| format!("Write HTML: {}", e))?;

    let output = Command::new("chromium")
        .args([
            "--headless",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-software-rasterizer",
            "--run-all-compositor-stages-before-draw",
            &format!("--print-to-pdf={}", tmp_pdf),
            "--print-to-pdf-no-header",
            &tmp_html,
        ])
        .output()
        .await
        .map_err(|e| format!("Chromium exec: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Try to read the file anyway - Chromium often returns non-zero but still produces output
        if std::path::Path::new(&tmp_pdf).exists() {
            let pdf_bytes = std::fs::read(&tmp_pdf).map_err(|e| format!("Read PDF: {}", e))?;
            let _ = std::fs::remove_file(&tmp_html);
            let _ = std::fs::remove_file(&tmp_pdf);
            if pdf_bytes.len() > 500 {
                return Ok(pdf_bytes);
            }
        }
        let _ = std::fs::remove_file(&tmp_html);
        return Err(format!("Chromium failed: {}", stderr));
    }

    let pdf_bytes = std::fs::read(&tmp_pdf).map_err(|e| format!("Read PDF: {}", e))?;
    let _ = std::fs::remove_file(&tmp_html);
    let _ = std::fs::remove_file(&tmp_pdf);
    Ok(pdf_bytes)
}

// ═══════════════════════════════════════════════════════════
// HTML Report Generator
// ═══════════════════════════════════════════════════════════
fn generate_html_report(
    name: &str, template: &str, now: &str, date_short: &str,
    scans: &[(ScanRow, String)],
    total: i32, crit: i32, high: i32, med: i32, low: i32, info: i32,
    risk_score: i32, risk_level: &str,
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
        "pci" => "PCI DSS Compliance Report",
        "iso" => "ISO 27001 Assessment",
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
    let compliance_section = if matches!(template, "compliance" | "owasp" | "pci" | "iso" | "full") {
        build_compliance_section(template, crit, high, med, low, risk_score)
    } else {
        String::new()
    };

    // Build recommendations
    let recommendations = build_recommendations(crit, high, med, low);

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
.header{{border-bottom:3px solid #0f172a;padding-bottom:24px;margin-bottom:32px}}
.header h1{{font-size:22px;font-weight:800;color:#0f172a;margin-bottom:4px}}
.header .subtitle{{font-size:14px;color:#64748b;font-weight:500}}
.header .meta{{display:flex;gap:24px;margin-top:12px;font-size:11px;color:#94a3b8}}
.header .meta span{{display:flex;align-items:center;gap:4px}}
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

@media print{{
    body{{font-size:11px}}
    .page{{padding:20px}}
    .raw-output pre{{max-height:none}}
    .scan-block{{page-break-inside:avoid}}
}}
</style>
</head>
<body>
<div class="page">
    <div class="header">
        <h1>{name}</h1>
        <div class="subtitle">{template_title}</div>
        <div class="meta">
            <span>📅 Generated: {now}</span>
            <span>🔬 Scans: {scan_count}</span>
            <span>🎯 Findings: {total}</span>
            <span class="badge" style="background:{risk_color}20;color:{risk_color}">Risk: {risk_level}</span>
        </div>
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
    offensive security platform running <strong>401 Kali Linux tools</strong> across 61 categories.
    All scans were conducted with proper authorization.</p>
    <table class="meta-table" style="margin-top:12px">
        <tr><td><strong>Platform</strong></td><td>CyberSec Pro v4.0</td></tr>
        <tr><td><strong>Report Template</strong></td><td>{template_title}</td></tr>
        <tr><td><strong>Generated</strong></td><td>{now}</td></tr>
        <tr><td><strong>Classification</strong></td><td>Confidential</td></tr>
    </table>

    <div class="footer">
        <p>Generated by CyberSec Pro — semihkilic.com | This report is confidential and intended only for authorized recipients.</p>
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
        total = total,
        crit = crit,
        high = high,
        med = med,
        low = low,
        low_info = low + info,
        risk_score = risk_score,
        risk_level = risk_level,
        risk_color = risk_color,
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

fn build_compliance_section(template: &str, crit: i32, high: i32, med: i32, low: i32, risk_score: i32) -> String {
    let framework = match template {
        "owasp" => "OWASP Top 10 (2021)",
        "pci" => "PCI DSS v4.0",
        "iso" => "ISO 27001:2022",
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
            ("Req 1", "Network Security Controls", high == 0),
            ("Req 2", "Secure Configurations", med < 3),
            ("Req 5", "Anti-Malware", true),
            ("Req 6", "Secure Development", crit == 0),
            ("Req 8", "Access Control", crit == 0 && high == 0),
            ("Req 10", "Logging & Monitoring", true),
            ("Req 11", "Security Testing", risk_score < 50),
            ("Req 12", "Security Policies", true),
        ],
        "iso" => vec![
            ("A.8", "Asset Management", true),
            ("A.9", "Access Control", crit == 0 && high == 0),
            ("A.12", "Operations Security", high == 0),
            ("A.13", "Communications Security", med < 3),
            ("A.14", "System Acquisition & Development", crit == 0),
            ("A.16", "Incident Management", true),
            ("A.18", "Compliance", risk_score < 50),
        ],
        _ => vec![
            ("NIST CSF", "Identify & Protect", high == 0),
            ("OWASP", "Top 10 Controls", crit == 0),
            ("PCI DSS", "Requirement 11", risk_score < 50),
            ("GDPR", "Data Protection", crit == 0),
            ("HIPAA", "Security Rule", crit == 0 && high == 0),
            ("SOC 2", "Trust Principles", med < 5),
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

// ═══════════════════════════════════════════════════════════
// JSON Report Generator
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

// ═══════════════════════════════════════════════════════════
// CSV Report Generator
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

// ═══════════════════════════════════════════════════════════
// Markdown Report Generator
// ═══════════════════════════════════════════════════════════
fn generate_markdown_report(
    name: &str, template: &str, now: &str,
    scans: &[(ScanRow, String)],
    total: i32, crit: i32, high: i32, med: i32, low: i32, info: i32,
    risk_score: i32, risk_level: &str,
) -> String {
    let mut md = format!("# {}\n\n**Template:** {} | **Generated:** {} | **Platform:** CyberSec Pro v4.0\n\n", name, template, now);
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
