use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailTemplate {
    pub subject: String,
    pub html_body: String,
    pub text_body: String,
}

/// CASL-compliant footer: sender identity (business name + address), a working
/// unsubscribe link, and the free consent/withdrawal notice. Applies to every
/// commercial electronic message (CEM). Unsubscribe is instant and honoured.
pub fn mail_footer(unsubscribe_url: &str) -> String {
    format!(
        r#"<div style="border-top:1px solid #334155;margin-top:24px;padding-top:16px">
<p style="color:#64748b;font-size:11px;margin:0 0 4px;text-align:center">CyberSec Pro (Cyber Security Pro Ltd, Teknopark Istanbul, 34906 Pendik, Istanbul, Turkiye)</p>
<p style="color:#64748b;font-size:11px;margin:0 0 8px;text-align:center">This email was sent to you because you have an account with CyberSec Pro.</p>
<p style="color:#64748b;font-size:11px;margin:0;text-align:center">You can <a href="{url}" style="color:#60a5fa">unsubscribe from marketing emails</a> at any time — consent withdrawal is effective immediately.</p>
</div>"#,
        url = unsubscribe_url,
    )
}

/// Generate scan complete email template
pub fn scan_complete(
    tool_name: &str,
    target: &str,
    status: &str,
    findings_count: usize,
    duration: &str,
    dashboard_url: &str,
    unsubscribe_url: &str,
) -> EmailTemplate {
    let status_color = if status == "completed" { "#10b981" } else { "#ef4444" };
    let status_icon = if status == "completed" { "&#x2705;" } else { "&#x274C;" };

    let findings_html = if findings_count > 0 {
        format!("<p style='color:#f59e0b;font-size:16px;margin:16px 0'><strong>&#x26A0;&#xFE0F; {} finding(s) detected</strong></p>", findings_count)
    } else {
        "<p style='color:#10b981;font-size:16px;margin:16px 0'><strong>&#x2705; No findings detected</strong></p>".to_string()
    };

    EmailTemplate {
        subject: format!("[CyberSec Pro] Scan {} - {} on {}", status, tool_name, target),
        html_body: format!(
            r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;max-width:600px;margin:0 auto">
<div style="background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155">
<h1 style="color:#60a5fa;font-size:24px;margin:0 0 8px">{icon} Scan {status}</h1>
<p style="color:#94a3b8;font-size:14px;margin:0 0 24px">CyberSec Pro Security Assessment</p>

<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><td style="padding:12px;color:#94a3b8;border-bottom:1px solid #334155">Tool</td><td style="padding:12px;border-bottom:1px solid #334155;font-weight:600">{tool}</td></tr>
<tr><td style="padding:12px;color:#94a3b8;border-bottom:1px solid #334155">Target</td><td style="padding:12px;border-bottom:1px solid #334155;font-weight:600">{target}</td></tr>
<tr><td style="padding:12px;color:#94a3b8;border-bottom:1px solid #334155">Status</td><td style="padding:12px;border-bottom:1px solid #334155"><span style="color:{status_color};font-weight:600">{status}</span></td></tr>
<tr><td style="padding:12px;color:#94a3b8;border-bottom:1px solid #334155">Duration</td><td style="padding:12px;border-bottom:1px solid #334155;font-weight:600">{duration}</td></tr>
</table>

{findings}

<div style="text-align:center;margin:24px 0">
<a href="{dashboard_url}" style="background:#3b82f6;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">View Results in Dashboard</a>
</div>

<p style="color:#64748b;font-size:12px;text-align:center;margin-top:24px">This is an automated notification from CyberSec Pro</p>
{footer}
</div></body></html>"#,
            icon = status_icon,
            status = status,
            tool = tool_name,
            target = target,
            status_color = status_color,
            duration = duration,
            findings = findings_html,
            dashboard_url = dashboard_url,
            footer = mail_footer(unsubscribe_url),
        ),
        text_body: format!(
            "Scan {} - {} on {}\nStatus: {}\nDuration: {}\nFindings: {}\n\nView results: {}",
            status, tool_name, target, status, duration, findings_count, dashboard_url,
        ),
    }
}

/// Generate security alert email template
pub fn security_alert(
    alert_type: &str,
    title: &str,
    description: &str,
    severity: &str,
    dashboard_url: &str,
    unsubscribe_url: &str,
) -> EmailTemplate {
    let severity_color = match severity {
        "critical" => "#dc2626",
        "high" => "#f97316",
        "medium" => "#eab308",
        _ => "#3b82f6",
    };

    EmailTemplate {
        subject: format!("[CyberSec Pro] Security Alert: {} ({})", title, severity.to_uppercase()),
        html_body: format!(
            r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;max-width:600px;margin:0 auto">
<div style="background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155">
<h1 style="color:{severity_color};font-size:24px;margin:0 0 8px">&#x1F6A8; Security Alert</h1>
<p style="color:#94a3b8;font-size:14px;margin:0 0 24px">CyberSec Pro Security Monitoring</p>

<div style="background:#0f172a;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid {severity_color}">
<h3 style="color:white;margin:0 0 8px">{title}</h3>
<p style="color:#94a3b8;margin:0">{description}</p>
</div>

<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><td style="padding:12px;color:#94a3b8;border-bottom:1px solid #334155">Type</td><td style="padding:12px;border-bottom:1px solid #334155;font-weight:600">{alert_type}</td></tr>
<tr><td style="padding:12px;color:#94a3b8;border-bottom:1px solid #334155">Severity</td><td style="padding:12px;border-bottom:1px solid #334155"><span style="color:{severity_color};font-weight:600">{severity}</span></td></tr>
</table>

<div style="text-align:center;margin:24px 0">
<a href="{dashboard_url}" style="background:#ef4444;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">Investigate Now</a>
</div>
{footer}
</div></body></html>"#,
            severity_color = severity_color,
            title = title,
            description = description,
            alert_type = alert_type,
            severity = severity,
            dashboard_url = dashboard_url,
            footer = mail_footer(unsubscribe_url),
        ),
        text_body: format!(
            "Security Alert: {} ({})\nType: {}\nSeverity: {}\n\n{}\n\nInvestigate: {}",
            title, severity, alert_type, severity, description, dashboard_url,
        ),
    }
}

/// Generate weekly compliance report email
pub fn weekly_report(
    org_name: &str,
    frameworks: &[(String, f64)],
    total_scans: i64,
    findings_summary: &str,
    dashboard_url: &str,
    unsubscribe_url: &str,
) -> EmailTemplate {
    let framework_rows: String = frameworks.iter()
        .map(|(name, score)| {
            let color = if *score >= 80.0 { "#10b981" } else if *score >= 50.0 { "#eab308" } else { "#ef4444" };
            format!(
                "<tr><td style='padding:12px;border-bottom:1px solid #334155'>{}</td><td style='padding:12px;border-bottom:1px solid #334155;text-align:right'><span style='color:{};font-weight:600'>{:.0}%</span></td></tr>",
                name, color, score
            )
        })
        .collect();

    EmailTemplate {
        subject: format!("[CyberSec Pro] Weekly Security Report - {}", org_name),
        html_body: format!(
            r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;max-width:600px;margin:0 auto">
<div style="background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155">
<h1 style="color:#60a5fa;font-size:24px;margin:0 0 8px">&#x1F4CA; Weekly Security Report</h1>
<p style="color:#94a3b8;font-size:14px;margin:0 0 24px">{org_name} - Week Summary</p>

<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><th style="padding:12px;text-align:left;color:#94a3b8;border-bottom:2px solid #334155">Framework</th><th style="padding:12px;text-align:right;color:#94a3b8;border-bottom:2px solid #334155">Score</th></tr>
{framework_rows}
</table>

<div style="background:#0f172a;border-radius:8px;padding:16px;margin:16px 0">
<p style="margin:0 0 8px;color:#94a3b8">Scans this week</p>
<p style="margin:0;font-size:24px;font-weight:700;color:#60a5fa">{total_scans}</p>
</div>

{findings_section}

<div style="text-align:center;margin:24px 0">
<a href="{dashboard_url}" style="background:#3b82f6;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">View Full Dashboard</a>
</div>

<p style="color:#64748b;font-size:12px;text-align:center;margin-top:24px">Weekly report from CyberSec Pro</p>
{footer}
</div></body></html>"#,
            org_name = org_name,
            framework_rows = framework_rows,
            total_scans = total_scans,
            findings_section = if !findings_summary.is_empty() {
                format!("<div style='background:#0f172a;border-radius:8px;padding:16px;margin:16px 0'><p style='margin:0 0 8px;color:#94a3b8'>Key Findings</p><p style='margin:0;color:#e2e8f0'>{}</p></div>", findings_summary)
            } else {
                String::new()
            },
            dashboard_url = dashboard_url,
            footer = mail_footer(unsubscribe_url),
        ),
        text_body: format!(
            "Weekly Security Report - {}\n\nCompliance Scores:\n{}\n\nScans this week: {}\n\nView dashboard: {}",
            org_name,
            frameworks.iter().map(|(n, s)| format!("  {}: {:.0}%", n, s)).collect::<Vec<_>>().join("\n"),
            total_scans,
            dashboard_url,
        ),
    }
}
