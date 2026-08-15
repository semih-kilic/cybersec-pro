/// CyberSec Pro — Email Service (Rust/lettre)
/// Replaces Python email_service.py
use lettre::{
    message::{header::ContentType, Mailbox, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    transport::smtp::client::{Tls, TlsParameters},
    AsyncSmtpTransport, AsyncTransport, Message,
};

#[derive(Clone)]
pub struct EmailConfig {
    pub smtp_server: String,
    pub smtp_port: u16,
    pub smtp_email: String,
    pub smtp_password: String,
    pub from_name: String,
    /// FROM header address. Falls back to smtp_email if SMTP_FROM is not set.
    pub from_address: String,
    /// Optional secondary SMTP provider used when the primary fails (e.g.
    /// quota exceeded, temporary outage). Configured via SMTP_FALLBACK_* env.
    pub fallback: Option<Box<EmailConfig>>,
}

impl EmailConfig {
    pub fn from_env() -> Option<Self> {
        let password = std::env::var("SMTP_PASSWORD").unwrap_or_default();
        if password.is_empty() {
            return None;
        }
        let smtp_email = std::env::var("SMTP_EMAIL")
            .unwrap_or_else(|_| "noreply@cyber-sec-pro.com".into());
        let from_address = std::env::var("SMTP_FROM")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| smtp_email.clone());
        let fallback_password = std::env::var("SMTP_FALLBACK_PASSWORD").unwrap_or_default();
        let fallback = if fallback_password.is_empty() {
            None
        } else {
            let fb_email = std::env::var("SMTP_FALLBACK_EMAIL")
                .unwrap_or_else(|_| smtp_email.clone());
            let fb_from = std::env::var("SMTP_FALLBACK_FROM")
                .ok()
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| fb_email.clone());
            Some(Box::new(EmailConfig {
                smtp_server: std::env::var("SMTP_FALLBACK_SERVER")
                    .unwrap_or_else(|_| "smtp.gmail.com".into()),
                smtp_port: std::env::var("SMTP_FALLBACK_PORT")
                    .ok()
                    .and_then(|p| p.parse().ok())
                    .unwrap_or(465),
                smtp_email: fb_email,
                smtp_password: fallback_password,
                from_name: std::env::var("SMTP_FALLBACK_FROM_NAME")
                    .unwrap_or_else(|_| "CyberSec Pro".into()),
                from_address: fb_from,
                fallback: None,
            }))
        };
        Some(Self {
            smtp_server: std::env::var("SMTP_SERVER").unwrap_or_else(|_| "smtp.yandex.com".into()),
            smtp_port: std::env::var("SMTP_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(465),
            smtp_email,
            smtp_password: password,
            from_name: std::env::var("SMTP_FROM_NAME")
                .unwrap_or_else(|_| "CyberSec Pro".into()),
            from_address,
            fallback,
        })
    }
}

pub async fn send_license_email(
    cfg: &EmailConfig,
    customer_email: &str,
    customer_name: &str,
    license_key: &str,
    plan_name: &str,
    expiry_date: &str,
) -> Result<(), String> {
    let html = license_email_html(customer_name, customer_email, license_key, plan_name, expiry_date);
    let plain = license_plain_text(customer_name, plan_name, license_key, expiry_date);

    send_email(
        cfg,
        customer_email,
        &format!("\u{1F510} Your CyberSec Pro License Key - {}", plan_name),
        &plain,
        &html,
    )
    .await
}

pub(crate) fn license_plain_text(name: &str, plan_name: &str, license_key: &str, expiry_date: &str) -> String {
    format!(
        "CyberSec Pro - License Delivery\n\n\
         Dear {},\n\nThank you for purchasing {}!\n\n\
         Your License Key: {}\nValid Until: {}\n\n\
         Quick Start:\n1. Go to Settings \u{2192} License\n2. Enter your license key\n3. Start scanning!\n\n\
         Need help? Contact: support@cyber-sec-pro.com\n\n\u{00A9} 2026 CyberSec Pro",
        name, plan_name, license_key, expiry_date
    )
}

pub async fn send_welcome_email(
    cfg: &EmailConfig,
    customer_email: &str,
    customer_name: &str,
) -> Result<(), String> {
    let html = welcome_email_html(customer_name);
    let plain = welcome_plain_text(customer_name);
    send_email(
        cfg,
        customer_email,
        "Your CyberSec Pro account is ready",
        &plain,
        &html,
    )
    .await
}

pub(crate) fn welcome_plain_text(name: &str) -> String {
    format!(
        "Hi {name},\n\n\
         Thanks for verifying your email. Your CyberSec Pro workspace is live.\n\n\
         Open your dashboard:\n  https://app.cyber-sec-pro.com/dashboard\n\n\
         What's included on your free plan:\n  -  50 scans per month\n  -  1 cloud agent (and unlimited self-hosted agents)\n  -  Full CVE / KEV database access\n  -  PDF, JSON and SARIF report export\n\n\
         Three steps to your first scan:\n  1.  Add a target asset (domain, IP or repo URL)\n  2.  Pick a scan profile (Quick, Full or Custom)\n  3.  Hit Run — findings stream in real time\n\n\
         Useful links:\n  Documentation       https://app.cyber-sec-pro.com/dashboard/docs\n  API keys & tokens   https://app.cyber-sec-pro.com/dashboard/settings/api\n  Status page         https://status.cyber-sec-pro.com\n\n\
         If anything looks off, just reply to this email — a real engineer reads every reply.\n\n\
         — The CyberSec Pro team\n         support@cyber-sec-pro.com\n         https://cyber-sec-pro.com\n",
        name = name
    )
}

pub async fn send_payment_confirmation(
    cfg: &EmailConfig,
    customer_email: &str,
    customer_name: &str,
    amount: &str,
    plan_name: &str,
) -> Result<(), String> {
    let html = payment_confirmation_html(customer_name, amount, plan_name);
    let plain = payment_plain_text(customer_name, amount, plan_name);
    send_email(
        cfg,
        customer_email,
        "✅ Payment Confirmed - CyberSec Pro",
        &plain,
        &html,
    )
    .await
}

pub(crate) fn payment_plain_text(name: &str, amount: &str, plan_name: &str) -> String {
    format!(
        "Payment Successful!\n\nDear {},\nYour payment of {} for {} has been confirmed.\n\
         Your license key will be sent in a separate email shortly.\n\n© 2026 CyberSec Pro",
        name, amount, plan_name
    )
}

pub async fn send_verification_email(
    cfg: &EmailConfig,
    to_email: &str,
    name: &str,
    verify_url: &str,
) -> Result<(), String> {
    let html = format!(
        r#"<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a">
        <table style="width:100%;max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px">
        <tr><td style="padding:40px;text-align:center">
        <h1 style="color:#00ff88">🛡️ Verify Your Email</h1>
        <p style="color:#ccd6f6;font-size:16px">Hi {},</p>
        <p style="color:#8892b0;font-size:14px">Please verify your email to activate your CyberSec Pro account.</p>
        <a href="{}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#00ff88,#00d4ff);color:#0a0a0a;text-decoration:none;font-weight:bold;border-radius:50px;margin:20px 0">Verify Email</a>
        <p style="color:#4a5568;font-size:12px;margin-top:20px">© 2026 CyberSec Pro</p>
        </td></tr></table></body></html>"#,
        name, verify_url
    );
    let plain = format!("Hi {},\n\nVerify your email: {}\n\n© 2026 CyberSec Pro", name, verify_url);
    send_email(cfg, to_email, "🛡️ Verify Your Email - CyberSec Pro", &plain, &html).await
}

pub async fn send_password_reset_email(
    cfg: &EmailConfig,
    to_email: &str,
    name: &str,
    reset_url: &str,
) -> Result<(), String> {
    let html = format!(
        r#"<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a">
        <table style="width:100%;max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px">
        <tr><td style="padding:40px;text-align:center">
        <h1 style="color:#00ff88">🔑 Password Reset</h1>
        <p style="color:#ccd6f6;font-size:16px">Hi {},</p>
        <p style="color:#8892b0;font-size:14px">We received a request to reset your password. Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="{}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#00ff88,#00d4ff);color:#0a0a0a;text-decoration:none;font-weight:bold;border-radius:50px;margin:20px 0">Reset Password</a>
        <p style="color:#8892b0;font-size:12px;margin-top:20px">If you didn't request this, you can safely ignore this email.</p>
        <p style="color:#4a5568;font-size:12px;margin-top:20px">© 2026 CyberSec Pro</p>
        </td></tr></table></body></html>"#,
        name, reset_url
    );
    let plain = format!(
        "Hi {},\n\nReset your password: {}\n\nThis link expires in 1 hour.\nIf you didn't request this, ignore this email.\n\n© 2026 CyberSec Pro",
        name, reset_url
    );
    send_email(cfg, to_email, "🔑 Password Reset - CyberSec Pro", &plain, &html).await
}

pub async fn send_team_invite_email(
    cfg: &EmailConfig,
    to_email: &str,
    invite_url: &str,
    role: &str,
) -> Result<(), String> {
    let html = format!(
        r#"<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a">
        <table style="width:100%;max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px">
        <tr><td style="padding:40px;text-align:center">
        <h1 style="color:#00ff88">🛡️ Team Invitation</h1>
        <p style="color:#ccd6f6;font-size:16px">You've been invited to join a CyberSec Pro team as <strong style="color:#00d4ff">{}</strong>.</p>
        <a href="{}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#00ff88,#00d4ff);color:#0a0a0a;text-decoration:none;font-weight:bold;border-radius:50px;margin:20px 0">Accept Invitation</a>
        <p style="color:#4a5568;font-size:12px;margin-top:20px">© 2026 CyberSec Pro</p>
        </td></tr></table></body></html>"#,
        role, invite_url
    );
    let plain = format!("You've been invited to CyberSec Pro as {}.\n\nAccept: {}\n\n© 2026 CyberSec Pro", role, invite_url);
    send_email(cfg, to_email, "🛡️ Team Invitation - CyberSec Pro", &plain, &html).await
}

async fn send_email(
    cfg: &EmailConfig,
    to: &str,
    subject: &str,
    plain: &str,
    html: &str,
) -> Result<(), String> {
    let from_mailbox: Mailbox = format!("{} <{}>", cfg.from_name, cfg.from_address)
        .parse()
        .map_err(|e| format!("Invalid from address: {}", e))?;

    let to_mailbox: Mailbox = to
        .parse()
        .map_err(|e| format!("Invalid recipient address: {}", e))?;

    let email = Message::builder()
        .from(from_mailbox)
        .to(to_mailbox)
        .subject(subject)
        .multipart(
            MultiPart::alternative()
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_PLAIN)
                        .body(plain.to_string()),
                )
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_HTML)
                        .body(html.to_string()),
                ),
        )
        .map_err(|e| format!("Failed to build email: {}", e))?;

    match try_send_provider(cfg, &email).await {
        Ok(()) => {
            tracing::info!("✅ Email sent to {} via {}", to, cfg.smtp_server);
            Ok(())
        }
        Err(primary_err) => match &cfg.fallback {
            None => Err(primary_err),
            Some(fb) => {
                tracing::warn!(
                    "Primary SMTP {} failed ({}); failing over to {}",
                    cfg.smtp_server,
                    primary_err,
                    fb.smtp_server
                );
                match try_send_provider(fb, &email).await {
                    Ok(()) => {
                        tracing::info!("✅ Email sent to {} via fallback {}", to, fb.smtp_server);
                        Ok(())
                    }
                    Err(fb_err) => Err(format!(
                        "Primary SMTP error: {}; fallback {} error: {}",
                        primary_err, fb.smtp_server, fb_err
                    )),
                }
            }
        },
    }
}

async fn try_send_provider(cfg: &EmailConfig, email: &Message) -> Result<(), String> {
    let creds = Credentials::new(cfg.smtp_email.clone(), cfg.smtp_password.clone());

    let mailer = if cfg.smtp_port == 465 {
        // Port 465: Implicit TLS (SMTPS) — required for Gmail/Yandex port 465
        let tls_params = TlsParameters::new(cfg.smtp_server.clone())
            .map_err(|e| format!("TLS params error: {}", e))?;
        AsyncSmtpTransport::<lettre::Tokio1Executor>::builder_dangerous(&cfg.smtp_server)
            .port(cfg.smtp_port)
            .tls(Tls::Wrapper(tls_params))
            .credentials(creds)
            .build()
    } else {
        // Port 587 or others: STARTTLS upgrade
        AsyncSmtpTransport::<lettre::Tokio1Executor>::starttls_relay(&cfg.smtp_server)
            .map_err(|e| format!("SMTP starttls_relay error: {}", e))?
            .port(cfg.smtp_port)
            .credentials(creds)
            .build()
    };

    mailer
        .send(email.clone())
        .await
        .map_err(|e| format!("SMTP send error: {}", e))?;

    tracing::info!("✅ Email sent via {}", cfg.smtp_server);
    Ok(())
}

/// Public wrapper for notifications module
pub async fn send_email_public(
    cfg: &EmailConfig,
    to: &str,
    subject: &str,
    plain: &str,
    html: &str,
) -> Result<(), String> {
    send_email(cfg, to, subject, plain, html).await
}

/// Newsletter welcome email. Loads SMTP config from env on demand so callers
/// (the newsletter handler) do not need access to it.
pub async fn send_newsletter_welcome(to: &str) -> Result<(), String> {
    let cfg = EmailConfig::from_env()
        .ok_or_else(|| "SMTP not configured (missing env vars)".to_string())?;
    let subject = "\u{1F4E8} Welcome to the CyberSec Pro newsletter";
    let plain = "Thanks for subscribing to CyberSec Pro!\n\n\
                 You'll get curated security news, tool deep-dives, and \
                 platform updates roughly once a week. No spam, ever.\n\n\
                 Unsubscribe anytime by replying to any of our emails.\n\n\
                 \u{2014} The CyberSec Pro team\nhttps://cyber-sec-pro.com";
    let html = newsletter_welcome_html();
    send_email(&cfg, to, subject, plain, &html).await
}

fn newsletter_welcome_html() -> String {
    r#"<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Welcome</title></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,sans-serif;background:#0a0e14;color:#e6edf3">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><td align="center" style="padding:48px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#0d1117;border:1px solid #1f242c;border-radius:14px;overflow:hidden">
<tr><td style="padding:40px 40px 24px;text-align:center;border-bottom:1px solid #1f242c">
<div style="font-size:32px;line-height:1">🛡️</div>
<h1 style="margin:16px 0 4px;font-size:22px;color:#fff">Welcome to CyberSec Pro</h1>
<p style="margin:0;color:#8b949e;font-size:14px">You're on the list.</p></td></tr>
<tr><td style="padding:28px 40px;color:#c9d1d9;font-size:15px;line-height:1.65">
<p style="margin:0 0 16px">Thanks for subscribing! Here's what to expect:</p>
<ul style="margin:0 0 16px;padding-left:20px;color:#b1bac4">
<li style="margin-bottom:6px">Curated weekly security news from BleepingComputer, Krebs, The Hacker News, CISA &amp; more.</li>
<li style="margin-bottom:6px">Hands-on tool guides &mdash; nmap, Burp, Metasploit, Hashcat, Wireshark.</li>
<li style="margin-bottom:6px">Platform updates and feature announcements.</li></ul>
<p style="margin:0 0 8px">Roughly one email per week. No spam, no third-party tracking.</p></td></tr>
<tr><td style="padding:0 40px 40px;text-align:center">
<a href="https://cyber-sec-pro.com/en/blog/" style="display:inline-block;padding:12px 28px;background:#9fef00;color:#0a0e14;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px">Read the latest →</a>
<p style="margin:24px 0 0;color:#6e7681;font-size:11px">CyberSec Pro · <a href="https://cyber-sec-pro.com" style="color:#6e7681">cyber-sec-pro.com</a> · Reply to unsubscribe</p></td></tr>
</table></td></tr></table></body></html>"#.to_string()
}

// ── HTML Templates ─────────────────────────────────────────

fn license_email_html(name: &str, email: &str, key: &str, plan: &str, expiry: &str) -> String {
    format!(r#"<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your CyberSec Pro License</title></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#0a0a0a">
<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:40px 0">
<table role="presentation" style="width:600px;border-collapse:collapse;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,255,136,.1)">
<tr><td style="padding:40px 40px 20px;text-align:center;border-bottom:1px solid rgba(0,255,136,.2)">
<div style="display:inline-block;padding:15px 30px;background:linear-gradient(135deg,#00ff88,#00d4ff);border-radius:50px;margin-bottom:20px">
<span style="font-size:28px;font-weight:bold;color:#0a0a0a;letter-spacing:2px">🛡️ CYBERSEC PRO</span></div>
<h1 style="color:#fff;font-size:28px;margin:20px 0 10px;font-weight:600">Welcome to CyberSec Pro!</h1>
<p style="color:#8892b0;font-size:16px;margin:0">Your license has been activated successfully</p></td></tr>
<tr><td style="padding:30px 40px 20px">
<p style="color:#ccd6f6;font-size:16px;line-height:1.6;margin:0">Dear <strong style="color:#00ff88">{name}</strong>,</p>
<p style="color:#8892b0;font-size:15px;line-height:1.8;margin:15px 0 0">Thank you for purchasing <strong style="color:#00d4ff">{plan}</strong>! Your professional security toolkit is now ready to use.</p></td></tr>
<tr><td style="padding:20px 40px">
<div style="background:linear-gradient(135deg,rgba(0,255,136,.1),rgba(0,212,255,.1));border:2px solid rgba(0,255,136,.3);border-radius:12px;padding:30px;text-align:center">
<p style="color:#8892b0;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 15px">Your License Key</p>
<div style="background:#0a0a0a;border-radius:8px;padding:20px;border:1px solid rgba(0,255,136,.2)">
<code style="font-size:24px;font-weight:bold;color:#00ff88;letter-spacing:3px;font-family:'Courier New',monospace">{key}</code></div>
<p style="color:#ff6b6b;font-size:12px;margin:15px 0 0">⚠️ Keep this key secure. Do not share it with anyone.</p></div></td></tr>
<tr><td style="padding:20px 40px">
<table role="presentation" style="width:100%;border-collapse:collapse"><tr>
<td style="padding:15px;background:rgba(0,255,136,.05);border-radius:8px 0 0 8px;border-left:3px solid #00ff88">
<p style="color:#8892b0;font-size:12px;margin:0 0 5px;text-transform:uppercase">Plan</p>
<p style="color:#ccd6f6;font-size:16px;font-weight:600;margin:0">{plan}</p></td>
<td style="padding:15px;background:rgba(0,212,255,.05);border-radius:0 8px 8px 0;border-right:3px solid #00d4ff">
<p style="color:#8892b0;font-size:12px;margin:0 0 5px;text-transform:uppercase">Valid Until</p>
<p style="color:#ccd6f6;font-size:16px;font-weight:600;margin:0">{expiry}</p></td></tr></table></td></tr>
<tr><td style="padding:20px 40px 30px;text-align:center">
<a href="https://app.cyber-sec-pro.com/dashboard/login" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#00ff88,#00d4ff);color:#0a0a0a;text-decoration:none;font-weight:bold;font-size:16px;border-radius:50px;text-transform:uppercase;letter-spacing:1px">Activate Now →</a></td></tr>
<tr><td style="padding:20px 40px;text-align:center;border-top:1px solid rgba(0,255,136,.1)">
<p style="color:#8892b0;font-size:14px;margin:0 0 10px">Need help? <a href="mailto:support@cyber-sec-pro.com" style="color:#00d4ff;text-decoration:none">support@cyber-sec-pro.com</a></p></td></tr>
<tr><td style="padding:20px 40px;background:#0a0a0a;text-align:center">
<p style="color:#4a5568;font-size:12px;margin:0 0 10px">© 2026 CyberSec Pro. All rights reserved.</p>
<p style="color:#4a5568;font-size:11px;margin:0">This email was sent to {email}</p></td></tr>
</table></td></tr></table></body></html>"#,
        name = name, plan = plan, key = key, expiry = expiry, email = email
    )
}

fn welcome_email_html(name: &str) -> String {
    format!(r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your CyberSec Pro account is ready</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif;color:#1a1f2e;-webkit-font-smoothing:antialiased">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">Your workspace is live. Three steps to your first scan inside.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e8ee;border-radius:8px">
        <tr><td style="padding:28px 36px 20px 36px;border-bottom:1px solid #eef0f4">
          <table role="presentation" width="100%"><tr>
            <td style="font-size:14px;font-weight:600;color:#0f172a;letter-spacing:-0.1px">CyberSec&nbsp;Pro</td>
            <td align="right" style="font-size:12px;color:#64748b">Account verified</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px 36px 8px 36px">
          <h1 style="margin:0 0 10px 0;font-size:22px;font-weight:600;letter-spacing:-0.4px;color:#0f172a">Hi {name}, your workspace is ready.</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#475569">Thanks for verifying your email. You can sign in any time using the address you registered with — no extra steps required.</p>
        </td></tr>
        <tr><td style="padding:24px 36px 8px 36px">
          <a href="https://app.cyber-sec-pro.com/dashboard" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 20px;border-radius:6px;border:1px solid #0f172a">Open dashboard</a>
          <a href="https://app.cyber-sec-pro.com/dashboard/scans/new" style="display:inline-block;margin-left:8px;background:#ffffff;color:#0f172a;font-size:14px;font-weight:600;text-decoration:none;padding:11px 20px;border-radius:6px;border:1px solid #cbd5e1">Start your first scan</a>
        </td></tr>
        <tr><td style="padding:28px 36px 4px 36px">
          <p style="margin:0 0 12px 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:#64748b">Three steps to your first scan</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td valign="top" width="22" style="padding:6px 10px 6px 0;font-size:13px;color:#94a3b8;font-variant-numeric:tabular-nums">01</td><td style="padding:6px 0;font-size:14px;color:#1e293b;line-height:1.55">Add a target asset — a domain, IP range or repository URL.</td></tr>
            <tr><td valign="top" width="22" style="padding:6px 10px 6px 0;font-size:13px;color:#94a3b8;font-variant-numeric:tabular-nums">02</td><td style="padding:6px 0;font-size:14px;color:#1e293b;line-height:1.55">Pick a scan profile (Quick, Full or Custom) — no commands required.</td></tr>
            <tr><td valign="top" width="22" style="padding:6px 10px 6px 0;font-size:13px;color:#94a3b8;font-variant-numeric:tabular-nums">03</td><td style="padding:6px 0;font-size:14px;color:#1e293b;line-height:1.55">Press Run. Findings stream into the dashboard in real time.</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 36px 4px 36px">
          <p style="margin:0 0 12px 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:#64748b">Your free plan includes</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#1e293b">
            <tr><td style="padding:6px 0;width:50%">50 scans / month</td><td style="padding:6px 0">1 cloud agent</td></tr>
            <tr><td style="padding:6px 0">Unlimited self-hosted agents</td><td style="padding:6px 0">Full CVE / KEV database</td></tr>
            <tr><td style="padding:6px 0">PDF, JSON, SARIF export</td><td style="padding:6px 0">REST API + webhooks</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 36px 8px 36px">
          <p style="margin:0 0 6px 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:#64748b">Useful links</p>
          <p style="margin:0;font-size:14px;line-height:1.8;color:#1e293b">
            <a href="https://app.cyber-sec-pro.com/dashboard/docs" style="color:#0f172a;text-decoration:underline">Documentation</a>&nbsp;·&nbsp;
            <a href="https://app.cyber-sec-pro.com/dashboard/settings/api" style="color:#0f172a;text-decoration:underline">API keys</a>&nbsp;·&nbsp;
            <a href="https://status.cyber-sec-pro.com" style="color:#0f172a;text-decoration:underline">Status</a>&nbsp;·&nbsp;
            <a href="https://cyber-sec-pro.com/changelog" style="color:#0f172a;text-decoration:underline">Changelog</a>
          </p>
        </td></tr>
        <tr><td style="padding:24px 36px 28px 36px;border-top:1px solid #eef0f4;margin-top:8px">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#475569">If anything looks off, just reply to this email — a real engineer reads every reply.</p>
          <p style="margin:14px 0 0 0;font-size:13px;color:#475569">— The CyberSec Pro team</p>
        </td></tr>
      </table>
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;margin-top:14px">
        <tr><td align="center" style="padding:8px 16px;font-size:11px;color:#94a3b8;line-height:1.6">
          You’re receiving this because you signed up at cyber-sec-pro.com.<br>
          CyberSec Pro · support@cyber-sec-pro.com · <a href="https://cyber-sec-pro.com" style="color:#94a3b8;text-decoration:underline">cyber-sec-pro.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"#, name = name)
}

fn payment_confirmation_html(name: &str, amount: &str, plan: &str) -> String {
    format!(r#"<!DOCTYPE html><html>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a">
<table style="width:100%;max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px;padding:40px">
<tr><td style="text-align:center">
<div style="font-size:60px;margin-bottom:20px">✅</div>
<h1 style="color:#00ff88">Payment Successful!</h1>
<p style="color:#ccd6f6;font-size:16px">Dear {name},<br><br>
Your payment of <strong style="color:#00d4ff">{amount}</strong> for <strong>{plan}</strong> has been confirmed.</p>
<p style="color:#8892b0;font-size:14px">Your license key will be sent in a separate email shortly.</p>
<hr style="border:1px solid #2d3748;margin:30px 0">
<p style="color:#4a5568;font-size:12px">© 2026 CyberSec Pro</p>
</td></tr></table></body></html>"#, name = name, amount = amount, plan = plan)
}

#[cfg(test)]
mod tests {
    use super::{license_plain_text, payment_plain_text, welcome_plain_text};

    // ── license_plain_text ──────────────────────────────────────────────

    #[test]
    fn license_plain_text_contains_all_fields() {
        let text = license_plain_text("Alice", "Professional", "ABC-123", "2027-01-01");
        assert!(text.contains("Alice"));
        assert!(text.contains("Professional"));
        assert!(text.contains("ABC-123"));
        assert!(text.contains("2027-01-01"));
    }

    #[test]
    fn license_plain_text_contains_support_contact() {
        let text = license_plain_text("Alice", "Starter", "KEY", "2027-01-01");
        assert!(text.contains("support@cyber-sec-pro.com"));
    }

    #[test]
    fn license_plain_text_contains_quick_start_steps() {
        let text = license_plain_text("Bob", "Enterprise", "KEY-XYZ", "2028-12-31");
        assert!(text.contains("Quick Start"));
        assert!(text.contains("License"));
    }

    // ── welcome_plain_text ──────────────────────────────────────────────

    #[test]
    fn welcome_plain_text_contains_name() {
        let text = welcome_plain_text("Carol");
        assert!(text.contains("Carol"));
    }

    #[test]
    fn welcome_plain_text_contains_brand() {
        let text = welcome_plain_text("Dave");
        assert!(text.contains("CyberSec Pro"));
    }

    #[test]
    fn welcome_plain_text_is_non_empty() {
        assert!(!welcome_plain_text("").is_empty());
    }

    // ── payment_plain_text ──────────────────────────────────────────────

    #[test]
    fn payment_plain_text_contains_all_fields() {
        let text = payment_plain_text("Eve", "EUR299", "Professional");
        assert!(text.contains("Eve"));
        assert!(text.contains("EUR299"));
        assert!(text.contains("Professional"));
    }

    #[test]
    fn payment_plain_text_mentions_license_key_followup() {
        let text = payment_plain_text("Frank", "EUR99", "Starter");
        assert!(text.contains("license key"));
    }

    #[test]
    fn payment_plain_text_contains_payment_successful() {
        let text = payment_plain_text("Grace", "EUR799", "Enterprise");
        assert!(text.contains("Payment Successful"));
    }
}
