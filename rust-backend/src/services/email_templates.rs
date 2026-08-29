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

// ── Invoice / receipt ──────────────────────────────────────────────────

/// A single billable line on an invoice.
pub struct InvoiceLine {
    pub description: String,
    pub amount_formatted: String,
}

/// Everything the invoice document needs. Amounts arrive pre-formatted so the
/// template never has to know about zero-decimal currencies (see
/// `services::billing::format_money`).
pub struct InvoiceView {
    pub number: String,
    pub status: String,
    pub issued_on: String,
    pub period: Option<String>,
    pub customer_name: String,
    pub customer_email: String,
    pub plan_label: String,
    pub lines: Vec<InvoiceLine>,
    pub subtotal_formatted: String,
    pub tax_formatted: String,
    pub total_formatted: String,
    pub amount_paid_formatted: String,
    pub hosted_invoice_url: Option<String>,
    pub invoice_pdf: Option<String>,
}

fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Render a self-contained HTML invoice.
///
/// Used both as the emailed receipt body and as the downloadable document, so
/// it carries the legal entity details and stays readable without CSS support.
pub fn invoice_document(v: &InvoiceView) -> String {
    let rows: String = v
        .lines
        .iter()
        .map(|l| {
            format!(
                r#"<tr><td style="padding:8px 0;color:#e2e8f0;font-size:14px">{}</td><td style="padding:8px 0;color:#e2e8f0;font-size:14px;text-align:right;white-space:nowrap">{}</td></tr>"#,
                esc(&l.description),
                esc(&l.amount_formatted)
            )
        })
        .collect();

    let period = v
        .period
        .as_ref()
        .map(|p| format!(r#"<p style="color:#94a3b8;font-size:12px;margin:4px 0 0">Billing period: {}</p>"#, esc(p)))
        .unwrap_or_default();

    let actions = {
        let mut out = String::new();
        if let Some(url) = &v.hosted_invoice_url {
            out.push_str(&format!(
                r#"<a href="{}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;margin-right:8px">View invoice</a>"#,
                esc(url)
            ));
        }
        if let Some(pdf) = &v.invoice_pdf {
            out.push_str(&format!(
                r#"<a href="{}" style="display:inline-block;background:#334155;color:#e2e8f0;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px">Download PDF</a>"#,
                esc(pdf)
            ));
        }
        out
    };

    format!(
        r#"<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0f172a;padding:24px">
<div style="max-width:620px;margin:0 auto;background:#1e293b;border-radius:12px;padding:28px">
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td><h1 style="color:#f8fafc;font-size:20px;margin:0">Invoice {number}</h1>
          <p style="color:#94a3b8;font-size:12px;margin:4px 0 0">Issued {issued}</p>
          {period}</td>
      <td style="text-align:right;vertical-align:top">
        <span style="display:inline-block;background:{badge_bg};color:{badge_fg};padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600">{status}</span>
      </td>
    </tr>
  </table>

  <div style="border-top:1px solid #334155;margin:20px 0 0;padding-top:16px">
    <p style="color:#94a3b8;font-size:12px;margin:0 0 2px">Billed to</p>
    <p style="color:#e2e8f0;font-size:14px;margin:0">{customer_name}</p>
    <p style="color:#94a3b8;font-size:13px;margin:2px 0 0">{customer_email}</p>
  </div>

  <div style="border-top:1px solid #334155;margin:20px 0 0;padding-top:8px">
    <p style="color:#94a3b8;font-size:12px;margin:8px 0 4px">{plan_label}</p>
    <table style="width:100%;border-collapse:collapse">{rows}</table>
  </div>

  <table style="width:100%;border-collapse:collapse;border-top:1px solid #334155;margin-top:12px;padding-top:8px">
    <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Subtotal</td>
        <td style="padding:6px 0;color:#94a3b8;font-size:13px;text-align:right">{subtotal}</td></tr>
    <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Tax</td>
        <td style="padding:6px 0;color:#94a3b8;font-size:13px;text-align:right">{tax}</td></tr>
    <tr><td style="padding:10px 0 0;color:#f8fafc;font-size:16px;font-weight:700">Total</td>
        <td style="padding:10px 0 0;color:#f8fafc;font-size:16px;font-weight:700;text-align:right">{total}</td></tr>
    <tr><td style="padding:4px 0;color:#34d399;font-size:13px">Amount paid</td>
        <td style="padding:4px 0;color:#34d399;font-size:13px;text-align:right">{paid}</td></tr>
  </table>

  <div style="margin-top:20px">{actions}</div>
</div>
</div>"#,
        number = esc(&v.number),
        issued = esc(&v.issued_on),
        period = period,
        status = esc(&v.status.to_uppercase()),
        badge_bg = if v.status.eq_ignore_ascii_case("paid") { "#064e3b" } else { "#7c2d12" },
        badge_fg = if v.status.eq_ignore_ascii_case("paid") { "#34d399" } else { "#fdba74" },
        customer_name = esc(&v.customer_name),
        customer_email = esc(&v.customer_email),
        plan_label = esc(&v.plan_label),
        rows = rows,
        subtotal = esc(&v.subtotal_formatted),
        tax = esc(&v.tax_formatted),
        total = esc(&v.total_formatted),
        paid = esc(&v.amount_paid_formatted),
        actions = actions,
    )
}

#[cfg(test)]
mod invoice_tests {
    use super::*;

    fn view() -> InvoiceView {
        InvoiceView {
            number: "CSP-0001".into(),
            status: "paid".into(),
            issued_on: "2026-08-29".into(),
            period: Some("2026-08-01 → 2026-09-01".into()),
            customer_name: "Example GmbH".into(),
            customer_email: "billing@example.com".into(),
            plan_label: "Professional Plan".into(),
            lines: vec![InvoiceLine {
                description: "Professional plan — monthly".into(),
                amount_formatted: "99.00 EUR".into(),
            }],
            subtotal_formatted: "99.00 EUR".into(),
            tax_formatted: "18.81 EUR".into(),
            total_formatted: "117.81 EUR".into(),
            amount_paid_formatted: "117.81 EUR".into(),
            hosted_invoice_url: Some("https://invoice.stripe.com/i/abc".into()),
            invoice_pdf: Some("https://invoice.stripe.com/i/abc.pdf".into()),
        }
    }

    #[test]
    fn invoice_document_contains_the_key_figures() {
        let h = invoice_document(&view());
        for needle in ["CSP-0001", "Example GmbH", "billing@example.com",
                       "117.81 EUR", "18.81 EUR", "Professional plan — monthly", "PAID"] {
            assert!(h.contains(needle), "invoice must contain {needle}");
        }
    }

    #[test]
    fn invoice_document_links_to_stripe_when_available() {
        let h = invoice_document(&view());
        assert!(h.contains("https://invoice.stripe.com/i/abc"));
        assert!(h.contains("https://invoice.stripe.com/i/abc.pdf"));
        assert!(h.contains("Download PDF"));
    }

    #[test]
    fn invoice_document_omits_actions_when_no_links() {
        let mut v = view();
        v.hosted_invoice_url = None;
        v.invoice_pdf = None;
        let h = invoice_document(&v);
        assert!(!h.contains("Download PDF"));
        assert!(!h.contains("View invoice"));
    }

    #[test]
    fn invoice_document_omits_period_when_absent() {
        let mut v = view();
        v.period = None;
        assert!(!invoice_document(&v).contains("Billing period"));
    }

    #[test]
    fn invoice_document_escapes_injected_html() {
        // Customer name comes from Stripe, which takes it from the payer.
        let mut v = view();
        v.customer_name = r#"<script>alert('xss')</script>"#.into();
        v.lines[0].description = "Plan <img src=x onerror=alert(1)>".into();
        let h = invoice_document(&v);
        assert!(!h.contains("<script>"), "raw script tag must not survive");
        assert!(!h.contains("<img src=x"), "raw img tag must not survive");
        assert!(h.contains("&lt;script&gt;"));
    }

    #[test]
    fn unpaid_invoice_uses_a_warning_badge() {
        let mut v = view();
        v.status = "open".into();
        let h = invoice_document(&v);
        assert!(h.contains("OPEN"));
        assert!(h.contains("#fdba74"), "unpaid status should not use the green badge");
    }
}
