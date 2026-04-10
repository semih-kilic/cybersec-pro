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
}

impl EmailConfig {
    pub fn from_env() -> Option<Self> {
        let password = std::env::var("SMTP_PASSWORD").unwrap_or_default();
        if password.is_empty() {
            return None;
        }
        Some(Self {
            smtp_server: std::env::var("SMTP_SERVER").unwrap_or_else(|_| "smtp.yandex.com".into()),
            smtp_port: std::env::var("SMTP_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(465),
            smtp_email: std::env::var("SMTP_EMAIL")
                .unwrap_or_else(|_| "cybersecpro@semihkilic.com".into()),
            smtp_password: password,
            from_name: std::env::var("SMTP_FROM_NAME")
                .unwrap_or_else(|_| "CyberSec Professional".into()),
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
    let plain = format!(
        "CyberSec Professional - License Delivery\n\n\
         Dear {},\n\nThank you for purchasing {}!\n\n\
         Your License Key: {}\nValid Until: {}\n\n\
         Quick Start:\n1. Go to Settings → License\n2. Enter your license key\n3. Start scanning!\n\n\
         Need help? Contact: support@semihkilic.com\n\n© 2026 CyberSec Professional",
        customer_name, plan_name, license_key, expiry_date
    );

    send_email(
        cfg,
        customer_email,
        &format!("🔐 Your CyberSec Professional License Key - {}", plan_name),
        &plain,
        &html,
    )
    .await
}

pub async fn send_welcome_email(
    cfg: &EmailConfig,
    customer_email: &str,
    customer_name: &str,
) -> Result<(), String> {
    let html = welcome_email_html(customer_name);
    let plain = format!(
        "Welcome, {}!\n\nThank you for joining CyberSec Professional.\n\
         Your journey to professional security starts now!\n\n© 2026 CyberSec Professional",
        customer_name
    );
    send_email(
        cfg,
        customer_email,
        "🛡️ Welcome to CyberSec Professional!",
        &plain,
        &html,
    )
    .await
}

pub async fn send_payment_confirmation(
    cfg: &EmailConfig,
    customer_email: &str,
    customer_name: &str,
    amount: &str,
    plan_name: &str,
) -> Result<(), String> {
    let html = payment_confirmation_html(customer_name, amount, plan_name);
    let plain = format!(
        "Payment Successful!\n\nDear {},\nYour payment of {} for {} has been confirmed.\n\
         Your license key will be sent in a separate email shortly.\n\n© 2026 CyberSec Professional",
        customer_name, amount, plan_name
    );
    send_email(
        cfg,
        customer_email,
        "✅ Payment Confirmed - CyberSec Professional",
        &plain,
        &html,
    )
    .await
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
        <p style="color:#4a5568;font-size:12px;margin-top:20px">© 2026 CyberSec Professional</p>
        </td></tr></table></body></html>"#,
        name, verify_url
    );
    let plain = format!("Hi {},\n\nVerify your email: {}\n\n© 2026 CyberSec Professional", name, verify_url);
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
        <p style="color:#4a5568;font-size:12px;margin-top:20px">© 2026 CyberSec Professional</p>
        </td></tr></table></body></html>"#,
        name, reset_url
    );
    let plain = format!(
        "Hi {},\n\nReset your password: {}\n\nThis link expires in 1 hour.\nIf you didn't request this, ignore this email.\n\n© 2026 CyberSec Professional",
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
        <p style="color:#4a5568;font-size:12px;margin-top:20px">© 2026 CyberSec Professional</p>
        </td></tr></table></body></html>"#,
        role, invite_url
    );
    let plain = format!("You've been invited to CyberSec Pro as {}.\n\nAccept: {}\n\n© 2026 CyberSec Professional", role, invite_url);
    send_email(cfg, to_email, "🛡️ Team Invitation - CyberSec Pro", &plain, &html).await
}

async fn send_email(
    cfg: &EmailConfig,
    to: &str,
    subject: &str,
    plain: &str,
    html: &str,
) -> Result<(), String> {
    let from_mailbox: Mailbox = format!("{} <{}>", cfg.from_name, cfg.smtp_email)
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
        // Port 587 or others: STARTTLS
        AsyncSmtpTransport::<lettre::Tokio1Executor>::relay(&cfg.smtp_server)
            .map_err(|e| format!("SMTP relay error: {}", e))?
            .port(cfg.smtp_port)
            .credentials(creds)
            .build()
    };

    mailer
        .send(email)
        .await
        .map_err(|e| format!("SMTP send error: {}", e))?;

    tracing::info!("✅ Email sent to {}", to);
    Ok(())
}

// ── HTML Templates ─────────────────────────────────────────

fn license_email_html(name: &str, email: &str, key: &str, plan: &str, expiry: &str) -> String {
    format!(r#"<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your CyberSec Professional License</title></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#0a0a0a">
<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:40px 0">
<table role="presentation" style="width:600px;border-collapse:collapse;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,255,136,.1)">
<tr><td style="padding:40px 40px 20px;text-align:center;border-bottom:1px solid rgba(0,255,136,.2)">
<div style="display:inline-block;padding:15px 30px;background:linear-gradient(135deg,#00ff88,#00d4ff);border-radius:50px;margin-bottom:20px">
<span style="font-size:28px;font-weight:bold;color:#0a0a0a;letter-spacing:2px">🛡️ CYBERSEC PRO</span></div>
<h1 style="color:#fff;font-size:28px;margin:20px 0 10px;font-weight:600">Welcome to CyberSec Professional!</h1>
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
<a href="https://semihkilic.com/dashboard/login" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#00ff88,#00d4ff);color:#0a0a0a;text-decoration:none;font-weight:bold;font-size:16px;border-radius:50px;text-transform:uppercase;letter-spacing:1px">Activate Now →</a></td></tr>
<tr><td style="padding:20px 40px;text-align:center;border-top:1px solid rgba(0,255,136,.1)">
<p style="color:#8892b0;font-size:14px;margin:0 0 10px">Need help? <a href="mailto:support@semihkilic.com" style="color:#00d4ff;text-decoration:none">support@semihkilic.com</a></p></td></tr>
<tr><td style="padding:20px 40px;background:#0a0a0a;text-align:center">
<p style="color:#4a5568;font-size:12px;margin:0 0 10px">© 2026 CyberSec Professional. All rights reserved.</p>
<p style="color:#4a5568;font-size:11px;margin:0">This email was sent to {email}</p></td></tr>
</table></td></tr></table></body></html>"#,
        name = name, plan = plan, key = key, expiry = expiry, email = email
    )
}

fn welcome_email_html(name: &str) -> String {
    format!(r#"<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a">
<table style="width:100%;max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px">
<tr><td style="padding:40px;text-align:center">
<h1 style="color:#00ff88;margin-bottom:20px">🛡️ Welcome, {name}!</h1>
<p style="color:#ccd6f6;font-size:16px;line-height:1.6">Thank you for joining CyberSec Professional. Your journey to professional security starts now!</p>
</td></tr></table></body></html>"#, name = name)
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
<p style="color:#4a5568;font-size:12px">© 2026 CyberSec Professional</p>
</td></tr></table></body></html>"#, name = name, amount = amount, plan = plan)
}
