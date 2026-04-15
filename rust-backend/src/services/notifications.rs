/// CyberSec Pro — Email Notification Service
/// Sends email notifications based on user preferences (notification_preferences table)
use sqlx::PgPool;

use super::email::EmailConfig;

/// Send scan completion email to the user who started the scan, if they have
/// `email_scan_complete = true` in notification_preferences.
pub async fn notify_scan_complete(
    db: &PgPool,
    user_id: &str,
    scan_id: &str,
    tool_name: &str,
    target: &str,
    status: &str,
    findings_count: usize,
) {
    // Check if user opted-in for scan completion emails
    let pref: Option<(bool,)> = sqlx::query_as(
        "SELECT email_scan_complete FROM notification_preferences WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
    .unwrap_or(None);

    // Default is true if no preference row exists
    let should_send = pref.map(|(v,)| v).unwrap_or(true);
    if !should_send {
        return;
    }

    // Check quiet hours
    if is_quiet_hours(db, user_id).await {
        tracing::debug!("Skipping scan email for user {} — quiet hours", user_id);
        return;
    }

    // Get user email + name
    let user: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT email, first_name FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
    .unwrap_or(None);

    let (email, name) = match user {
        Some((e, n)) => (e, n.unwrap_or_else(|| "User".to_string())),
        None => return,
    };

    let cfg = match EmailConfig::from_env() {
        Some(c) => c,
        None => return,
    };

    let status_emoji = if status == "completed" { "✅" } else { "❌" };
    let status_color = if status == "completed" { "#00ff88" } else { "#ff4444" };
    let findings_text = if findings_count > 0 {
        format!("{} findings detected", findings_count)
    } else {
        "No findings".to_string()
    };

    let subject = format!("{} Scan {} — {} on {}", status_emoji, status, tool_name, target);

    let html = format!(
        r#"<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a">
<table style="width:100%;max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px">
<tr><td style="padding:40px;text-align:center">
<h1 style="color:{status_color}">🛡️ Scan {status}</h1>
<p style="color:#ccd6f6;font-size:16px">Hi {name},</p>
<p style="color:#8892b0;font-size:14px">Your <strong style="color:#00d4ff">{tool_name}</strong> scan on <strong style="color:#00d4ff">{target}</strong> has {status}.</p>
<table style="width:100%;margin:20px 0;border-collapse:collapse">
<tr><td style="padding:10px;color:#8892b0;border-bottom:1px solid #2d2d4e">Scan ID</td><td style="padding:10px;color:#ccd6f6;border-bottom:1px solid #2d2d4e;text-align:right"><code>{scan_id_short}</code></td></tr>
<tr><td style="padding:10px;color:#8892b0;border-bottom:1px solid #2d2d4e">Tool</td><td style="padding:10px;color:#ccd6f6;border-bottom:1px solid #2d2d4e;text-align:right">{tool_name}</td></tr>
<tr><td style="padding:10px;color:#8892b0;border-bottom:1px solid #2d2d4e">Target</td><td style="padding:10px;color:#ccd6f6;border-bottom:1px solid #2d2d4e;text-align:right">{target}</td></tr>
<tr><td style="padding:10px;color:#8892b0">Findings</td><td style="padding:10px;color:{status_color};text-align:right;font-weight:bold">{findings_text}</td></tr>
</table>
<a href="https://cybersecpro.semihkilic.com/dashboard/scans/{scan_id}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#00ff88,#00d4ff);color:#0a0a0a;text-decoration:none;font-weight:bold;border-radius:50px;margin:10px 0">View Results</a>
<p style="color:#4a5568;font-size:12px;margin-top:20px">You can adjust email preferences in Settings → Notifications</p>
<p style="color:#4a5568;font-size:12px">© 2026 CyberSec Professional</p>
</td></tr></table></body></html>"#,
        status_color = status_color,
        status = status,
        name = name,
        tool_name = tool_name,
        target = target,
        scan_id = scan_id,
        scan_id_short = &scan_id[..8.min(scan_id.len())],
        findings_text = findings_text,
    );

    let plain = format!(
        "Hi {},\n\nYour {} scan on {} has {}.\nFindings: {}\n\nView: https://cybersecpro.semihkilic.com/dashboard/scans/{}\n\n© 2026 CyberSec Professional",
        name, tool_name, target, status, findings_text, scan_id
    );

    if let Err(e) = super::email::send_email_public(&cfg, &email, &subject, &plain, &html).await {
        tracing::error!("Failed to send scan notification email to {}: {}", email, e);
    } else {
        tracing::info!("📧 Scan notification sent to {}", email);
    }
}

/// Send security alert email to all org members who have `email_security_alerts = true`
pub async fn notify_security_alert(
    db: &PgPool,
    org_id: &str,
    alert_title: &str,
    alert_body: &str,
    severity: &str,
) {
    // Find all users in org with security alerts enabled
    let users: Vec<(String, Option<String>)> = sqlx::query_as(
        "SELECT u.email, u.first_name FROM users u
         LEFT JOIN notification_preferences np ON np.user_id = u.id
         WHERE u.organization_id = $1
         AND u.is_active != false
         AND COALESCE(np.email_security_alerts, true) = true"
    )
    .bind(org_id)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let cfg = match EmailConfig::from_env() {
        Some(c) => c,
        None => return,
    };

    let severity_color = match severity {
        "critical" => "#ff0000",
        "high" => "#ff6600",
        "medium" => "#ffaa00",
        _ => "#00d4ff",
    };

    for (email, name) in &users {
        let name = name.as_deref().unwrap_or("User");
        let subject = format!("🚨 Security Alert: {}", alert_title);
        let html = format!(
            r#"<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a">
<table style="width:100%;max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px">
<tr><td style="padding:40px;text-align:center">
<h1 style="color:{sev_color}">🚨 Security Alert</h1>
<p style="color:#ccd6f6;font-size:16px">Hi {name},</p>
<div style="background:#0d1117;border-left:4px solid {sev_color};padding:16px;text-align:left;border-radius:4px;margin:20px 0">
<p style="color:{sev_color};font-weight:bold;margin:0 0 8px;text-transform:uppercase">{severity} — {title}</p>
<p style="color:#8892b0;margin:0">{body}</p>
</div>
<a href="https://cybersecpro.semihkilic.com/dashboard" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#ff4444,#ff6600);color:#fff;text-decoration:none;font-weight:bold;border-radius:50px;margin:10px 0">Review Now</a>
<p style="color:#4a5568;font-size:12px;margin-top:20px">© 2026 CyberSec Professional</p>
</td></tr></table></body></html>"#,
            sev_color = severity_color,
            name = name,
            severity = severity,
            title = alert_title,
            body = alert_body,
        );
        let plain = format!(
            "Hi {},\n\n🚨 {} ALERT: {}\n{}\n\nReview: https://cybersecpro.semihkilic.com/dashboard\n\n© 2026 CyberSec Professional",
            name, severity.to_uppercase(), alert_title, alert_body
        );
        if let Err(e) = super::email::send_email_public(&cfg, email, &subject, &plain, &html).await {
            tracing::error!("Failed to send security alert to {}: {}", email, e);
        }
    }
}

/// Check if the user is currently in quiet hours
async fn is_quiet_hours(db: &PgPool, user_id: &str) -> bool {
    let pref: Option<(bool, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT quiet_hours_enabled, quiet_hours_from, quiet_hours_to FROM notification_preferences WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
    .unwrap_or(None);

    match pref {
        Some((true, Some(from), Some(to))) => {
            let now = chrono::Utc::now().format("%H:%M").to_string();
            if from <= to {
                now >= from && now <= to
            } else {
                // Wraps midnight, e.g. 22:00 - 08:00
                now >= from || now <= to
            }
        }
        _ => false,
    }
}
