use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use sha2::Digest;
use std::sync::Arc;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthUser;
use crate::models::{User, Organization};
use crate::services::audit::log_audit;
use crate::services::auth::{
    create_access_token, create_refresh_token, hash_password, verify_password,
    generate_totp_secret, generate_totp_uri, generate_totp_qr_code, verify_totp,
    generate_backup_codes, hash_backup_codes_json, backup_codes_from_json, verify_backup_code,
};
use crate::AppState;
use crate::services::email::{EmailConfig, send_welcome_email, send_verification_email};

// ── Disposable / temporary email domain blocklist ─────────
// Trial accounts MUST come from a real mailbox the user controls.
// Common throwaway providers used to farm free trials are rejected.
const DISPOSABLE_DOMAINS: &[&str] = &[
    "mailinator.com", "guerrillamail.com", "guerrillamail.info", "guerrillamail.biz",
    "guerrillamail.net", "guerrillamail.org", "sharklasers.com", "grr.la",
    "10minutemail.com", "10minutemail.net", "20minutemail.com", "30minutemail.com",
    "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmailo.com", "tempmail.dev",
    "tempmail.plus", "tempmail.email", "tempmail.us.com", "tempmailaddress.com",
    "yopmail.com", "yopmail.fr", "yopmail.net", "cool.fr.nf", "jetable.fr.nf",
    "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf",
    "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
    "trashmail.com", "trashmail.de", "trashmail.net", "trashmail.io", "trashmail.ws",
    "throwawaymail.com", "getnada.com", "nada.email", "nada.ltd", "inboxbear.com",
    "mintemail.com", "mohmal.com", "emailondeck.com", "fakemail.net", "fakeinbox.com",
    "fakemailgenerator.com", "dispostable.com", "discard.email", "discardmail.com",
    "maildrop.cc", "mailcatch.com", "mailnesia.com", "mailnull.com", "mailtemp.info",
    "mailtothis.com", "mailtrap.io", "meltmail.com", "mytrashmail.com", "e4ward.com",
    "spamgourmet.com", "spambog.com", "spambox.us", "spam4.me", "trbvm.com",
    "33mail.com", "anonbox.net", "deadaddress.com", "despam.it",
    "mailforspam.com", "my10minutemail.com", "sogetthis.com", "spamfree24.com",
    "spamfree24.de", "spamfree24.eu", "spamfree24.info", "spamfree24.net",
    "spamfree24.org", "thankyou2010.com", "trash2009.com", "trash-amil.com",
    "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org", "emailfake.com",
    "emailto.de", "emltmp.com", "linshiyou.com", "linshiyouxiang.net",
    "sneakemail.com", "snkmail.com", "trash-mail.com", "trbvn.com",
    "yapped.net", "zoemail.org", "luxusmail.org", "hidemail.de", "hide.biz.st",
    "hidemail.pro", "smashmail.de", "shitmail.me", "binkmail.com",
    "bobmail.info", "chammy.info", "devnullmail.com", "letthemeatspam.com",
    "mailshell.com", "mailzilla.org", "reallymymail.com", "safetymail.info",
    "selfdestructingmail.com", "sendspamhere.com", "spamavert.com", "spamspot.com",
    "superrito.com", "thismail.net", "tradermail.info", "vidchart.com", "yepmail.net",
    "jourrapide.com", "einrot.com", "rhyta.com", "teleworm.us", "armyspy.com",
    "cuvox.de", "dayrep.com", "fleckens.hu", "gustr.com", "superrito.com",
];

/// Returns true if the domain part of the email is on the disposable list.
pub fn is_disposable_email(email_lower: &str) -> bool {
    let Some(at) = email_lower.find('@') else { return false; };
    let domain = &email_lower[at + 1..];
    DISPOSABLE_DOMAINS.iter().any(|d| *d == domain)
}

// ── Helper: record login history ──────────────────────────

async fn record_login_history(
    pool: &sqlx::PgPool,
    user_id: &str,
    headers: &HeaderMap,
    success: bool,
    failure_reason: Option<&str>,
) {
    let id = Uuid::new_v4().to_string();
    // Was `.split(',').next()` — the FIRST element, which is whatever the client
    // sent. That let anyone write an arbitrary IP into the security audit trail.
    let ip = crate::services::net::client_ip(headers);
    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.chars().take(500).collect::<String>());
    let _ = sqlx::query(
        "INSERT INTO login_history (id, user_id, ip_address, user_agent, success, failure_reason)
         VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(&id)
    .bind(user_id)
    .bind(&ip)
    .bind(&ua)
    .bind(success)
    .bind(failure_reason)
    .execute(pool)
    .await;
}

// ── Pure helpers (testable without DB) ────────────────────

/// Basic email format validation (RFC 5322 subset).
/// Input should already be trimmed and lowercased.
pub fn validate_email(email: &str) -> bool {
    let at_pos = email.find('@');
    at_pos.map(|pos| {
        let local = &email[..pos];
        let domain = &email[pos + 1..];
        !local.is_empty()
            && !domain.is_empty()
            && domain.contains('.')
            && domain.len() >= 3
            && !email.contains(' ')
            && email.len() >= 6
            && email.len() <= 254
    }).unwrap_or(false)
}

/// Collapse aliases of the same mailbox to a single canonical key.
/// - lowercases everything
/// - strips `+tag` suffix from the local part for every provider
/// - removes `.` from the local part for gmail.com / googlemail.com
///   (Google ignores dots) and rewrites googlemail.com → gmail.com
/// Used to block one human from claiming multiple trial accounts.
pub fn normalize_email(email: &str) -> String {
    let lower = email.trim().to_lowercase();
    let Some(at) = lower.find('@') else { return lower; };
    let (local_raw, domain_with_at) = lower.split_at(at);
    let domain = &domain_with_at[1..];
    // strip +tag
    let local = local_raw.split('+').next().unwrap_or(local_raw);
    let (local_clean, domain_clean): (String, &str) = match domain {
        "gmail.com" | "googlemail.com" => (local.replace('.', ""), "gmail.com"),
        _ => (local.to_string(), domain),
    };
    format!("{}@{}", local_clean, domain_clean)
}

// ── Register ───────────────────────────────────────────────

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub organization_name: Option<String>,
    pub invite_token: Option<String>,
    /// Explicit consent to the Privacy Policy / Terms (PIPEDA 5.1 "Consent",
    /// CCPA notice-at-collection). Required for account creation.
    #[serde(default)]
    pub consent: Option<bool>,
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<RegisterRequest>,
) -> impl IntoResponse {
    // Rate limit check
    let ip = crate::services::net::client_ip_or_unknown(&headers);
    if state.rate_limiter.is_limited(&format!("register:{}", ip), 3, std::time::Duration::from_secs(60)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many registration attempts"}))).into_response();
    }

    // Validate email — RFC 5322 basic check
    let email = body.email.trim().to_lowercase();

    if !validate_email(&email) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Valid email required"}))).into_response();
    }

    // Block disposable / temporary mailboxes — trial requires a real mailbox
    // we can verify and that links a single human to the account.
    if is_disposable_email(&email) {
        return (StatusCode::BAD_REQUEST, Json(json!({
            "error": "Disposable email addresses are not allowed. Please use your work or personal email.",
            "code": "DISPOSABLE_EMAIL_BLOCKED"
        }))).into_response();
    }

    // Validate password strength
    if body.password.len() < 8 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Password must be at least 8 characters"}))).into_response();
    }

    // Consent to Privacy Policy / Terms is mandatory (PIPEDA "Consent", CCPA
    // notice-at-collection). Registration without explicit consent is refused.
    if body.consent != Some(true) {
        return (StatusCode::BAD_REQUEST, Json(json!({
            "error": "Consent to the Privacy Policy and Terms of Service is required to create an account.",
            "code": "CONSENT_REQUIRED"
        }))).into_response();
    }

    // Trial-abuse prevention: normalize the email so aliases like
    //   john.doe+test@gmail.com  and  johndoe@gmail.com
    // collapse to a single key. Reject if anyone already signed up with the
    // same normalized address — trial gives full access, so each human gets
    // exactly one trial.
    let email_normalized = normalize_email(&email);

    // Check existing — both raw and normalized.
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM users WHERE email = $1 OR email_normalized = $2 LIMIT 1"
    )
    .bind(&email).bind(&email_normalized)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    if existing.is_some() {
        return (StatusCode::CONFLICT, Json(json!({
            "error": "An account already exists for this email. Trial is one-per-person — please log in or upgrade.",
            "code": "EMAIL_OR_ALIAS_TAKEN"
        }))).into_response();
    }

    // Block obvious multi-account abuse from the same source IP. Allow up to
    // 2 signups per /32 in 30 days (covers legit family/colleague case);
    // reject the 3rd. `unknown` IPs (no XFF header) skip this check so we
    // don't lock out the test environment.
    if ip != "unknown" {
        let recent_signups: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM users \
             WHERE signup_ip = $1 AND created_at > NOW() - INTERVAL '30 days'"
        )
        .bind(&ip)
        .fetch_one(&state.db).await.unwrap_or((0,));
        if recent_signups.0 >= 2 {
            return (StatusCode::TOO_MANY_REQUESTS, Json(json!({
                "error": "Too many trial signups from this network. Contact sales for a team plan.",
                "code": "TRIAL_LIMIT_PER_NETWORK"
            }))).into_response();
        }
    }

    // Hash password before transaction
    let pw_hash = match hash_password(&body.password) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Password hashing failed"}))).into_response(),
    };

    // Check for invitation token
    let invite_data = if let Some(token) = &body.invite_token {
        sqlx::query_as::<_, (String, String, String)>(
            "SELECT organization_id, role, email FROM team_invitations WHERE token = $1 AND status = 'pending' AND expires_at > NOW()"
        )
        .bind(token)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None)
    } else {
        None
    };

    let (org_id, role, invited_email) = match invite_data {
        Some((inv_org_id, inv_role, inv_email)) => {
            if inv_email != email {
                return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invitation email does not match registration email"}))).into_response();
            }
            (inv_org_id, inv_role, Some(inv_email))
        }
        None => {
            if body.invite_token.is_some() {
                return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid or expired invitation token"}))).into_response();
            }
            (Uuid::new_v4().to_string(), "admin".to_string(), None)
        }
    };

    // Create org + user atomically in a transaction
    let org_name = body.organization_name.as_deref().unwrap_or("My Organization");
    let slug = format!("{}-{}", org_name.to_lowercase().replace(' ', "-"), &org_id[..8]);
    let user_id = Uuid::new_v4().to_string();
    let verification_token = Uuid::new_v4().to_string();

    let mut tx = match state.db.begin().await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to begin transaction: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Registration failed"}))).into_response();
        }
    };

    // Only create organization if this is not an invite acceptance
    if invited_email.is_none() {
        if let Err(e) = sqlx::query(
            "INSERT INTO organizations (id, name, slug, plan_type) VALUES ($1, $2, $3, 'trial')"
        )
        .bind(&org_id).bind(org_name).bind(&slug)
        .execute(&mut *tx).await {
            let _ = tx.rollback().await;
            tracing::error!("Failed to create organization: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Registration failed"}))).into_response();
        }
    }

    if let Err(e) = sqlx::query(
        "INSERT INTO users (id, email, email_normalized, signup_ip, password_hash, first_name, last_name, role, organization_id, email_verified, verification_token, verification_sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, $10, CURRENT_TIMESTAMP)"
    )
    .bind(&user_id).bind(&email).bind(&email_normalized).bind(&ip).bind(&pw_hash)
    .bind(&body.first_name).bind(&body.last_name)
    .bind(&role).bind(&org_id).bind(&verification_token)
    .execute(&mut *tx).await {
        let _ = tx.rollback().await;
        tracing::error!("Failed to create user: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Registration failed"}))).into_response();
    }

    // Mark invitation as accepted if this was an invite
    if let Some(ref token) = body.invite_token {
        let _ = sqlx::query(
            "UPDATE team_invitations SET status = 'accepted', updated_at = NOW() WHERE token = $1"
        )
        .bind(token)
        .execute(&mut *tx)
        .await;
    }

    if let Err(e) = tx.commit().await {
        tracing::error!("Transaction commit failed: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Registration failed"}))).into_response();
    }

    log_audit(&state.db, "register", "auth", "info", Some(&user_id), Some(&org_id), None, Some("user"), Some(&user_id), "success", Some(&headers)).await;

    // Record explicit consent (PIPEDA/CCPA/CASL evidence trail). Best-effort:
    // a failed consent write must not block account creation.
    if body.consent == Some(true) {
        let ua = headers.get("user-agent").and_then(|v| v.to_str().ok()).unwrap_or("").to_string();
        let _ = sqlx::query(
            "INSERT INTO consent_records (user_id, organization_id, purpose, category, status, version, ip_address, user_agent) \
             VALUES ($1, $2, 'account', 'essential', 'granted', '2026-01-01', $3, $4)"
        )
        .bind(&user_id)
        .bind(&org_id)
        .bind(&ip)
        .bind(&ua)
        .execute(&state.db)
        .await;
    }

    // Send verification email (best-effort, don't block registration response).
    // We DO NOT issue access/refresh tokens until the user clicks the link —
    // otherwise abusers could spin up trials with throwaway addresses and
    // immediately run scans without ever proving they own the mailbox.
    let display_name = body.first_name.as_deref().unwrap_or("there");
    if let Some(cfg) = EmailConfig::from_env() {
        let verify_url = format!(
            "https://app.cyber-sec-pro.com/dashboard/verify-email?token={}",
            verification_token
        );
        if let Err(e) = send_verification_email(&cfg, &email, display_name, &verify_url).await {
            tracing::error!("Failed to send verification email to {}: {}", email, e);
        }
        // Welcome email is queued but not blocking — informational only.
        let _ = send_welcome_email(&cfg, &email, display_name).await;
    } else {
        tracing::warn!("SMTP not configured — verification email NOT sent for {}", email);
    }

    // No tokens until the email is verified.
    (StatusCode::CREATED, Json(json!({
        "message": "Registration successful. Please check your email to verify your account before logging in.",
        "user": {
            "id": user_id,
            "email": email,
            "first_name": body.first_name,
            "last_name": body.last_name,
            "role": "admin",
            "organization_id": org_id
        },
        "verification_required": true,
        "code": "EMAIL_VERIFICATION_REQUIRED"
    }))).into_response()
}

// ── Login ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub mfa_code: Option<String>,
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<LoginRequest>,
) -> impl IntoResponse {
    // Was the RAW header value. Because nginx appends to whatever the client
    // sends, an attacker could vary the prefix on every request and land in a
    // fresh rate-limit bucket each time — defeating brute-force protection
    // entirely. `client_ip` pins the key to the hop nginx itself wrote.
    let ip = crate::services::net::client_ip_or_unknown(&headers);
    if state.rate_limiter.is_limited(&format!("login:{}", ip), 5, std::time::Duration::from_secs(60)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many login attempts"}))).into_response();
    }

    // Registration lowercases the address before storing it, so the lookup has
    // to as well. Without this, anyone who typed their email with different
    // capitalisation than at signup simply could not log in.
    let login_email = body.email.trim().to_lowercase();

    // Find user
    let user: Option<User> = sqlx::query_as(
        "SELECT * FROM users WHERE email = $1 AND is_active = TRUE"
    )
    .bind(&login_email)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let user = match user {
        Some(u) => u,
        None => {
            log_audit(&state.db, "login_failed", "auth", "warning", None, None, Some(json!({"email": login_email})), None, None, "failure", Some(&headers)).await;
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid email or password"}))).into_response();
        }
    };

    // Check account lockout (5 failed attempts → 15 min lockout).
    //
    // Evaluated in SQL on purpose: `locked_until` is TIMESTAMPTZ in the live
    // database but TIMESTAMP in the declared schema, and decoding it into a
    // fixed Rust type bricked any account that ever got locked (see the note in
    // `models::user`). Comparing server-side is correct for both types.
    let is_locked: bool = sqlx::query_scalar(
        "SELECT COALESCE(locked_until > NOW(), FALSE) FROM users WHERE id = $1",
    )
    .bind(&user.id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(false);

    if is_locked {
        record_login_history(&state.db, &user.id, &headers, false, Some("Account locked")).await;
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Account temporarily locked. Try again later."}))).into_response();
    }

    // The lockout window has passed — clear the stale counter so the user gets a
    // full set of attempts again. Previously the counter stayed at 5, so the
    // very next mistyped password re-locked the account immediately.
    let _ = sqlx::query(
        "UPDATE users SET failed_login_count = 0, locked_until = NULL \
         WHERE id = $1 AND locked_until IS NOT NULL AND locked_until <= NOW()",
    )
    .bind(&user.id)
    .execute(&state.db)
    .await;

    // Verify password.
    //
    // Some rows carry an empty string instead of NULL for "no password set"
    // (OAuth/SSO accounts). Those used to fall through to verification and fail
    // with a misleading "invalid email or password"; `is_passwordless` treats
    // both spellings as the same thing.
    if crate::services::auth::is_passwordless(user.password_hash.as_deref()) {
        return (StatusCode::UNAUTHORIZED, Json(json!({
            "error": "This account has no password set. Please sign in with your identity provider.",
            "code": "NO_PASSWORD_SET"
        }))).into_response();
    }
    let pw_hash = user.password_hash.as_deref().unwrap_or_default();

    if !verify_password(&body.password, pw_hash) {
        // Increment failed login counter, lock after 5 failures
        let new_count = user.failed_login_count.unwrap_or(0) + 1;
        if new_count >= 5 {
            let _ = sqlx::query(
                "UPDATE users SET failed_login_count = $1, last_failed_login = NOW(), locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $2"
            ).bind(new_count).bind(&user.id).execute(&state.db).await;
        } else {
            let _ = sqlx::query(
                "UPDATE users SET failed_login_count = $1, last_failed_login = NOW() WHERE id = $2"
            ).bind(new_count).bind(&user.id).execute(&state.db).await;
        }
        record_login_history(&state.db, &user.id, &headers, false, Some("Invalid password")).await;
        log_audit(&state.db, "login_failed", "auth", "warning", Some(&user.id), user.organization_id.as_deref(), None, Some("user"), Some(&user.id), "failure", Some(&headers)).await;
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid email or password"}))).into_response();
    }

    // Email-verification gate. Password is correct but the mailbox was never
    // proven — refuse to issue a session token so unverified accounts cannot
    // start scans, hit our rate-limited API, or burn trial quota.
    // OAuth users (no password) are auto-verified by their provider.
    if user.password_hash.is_some() && !user.email_verified.unwrap_or(false) {
        record_login_history(&state.db, &user.id, &headers, false, Some("Email not verified")).await;
        return (StatusCode::FORBIDDEN, Json(json!({
            "error": "Please verify your email before logging in. Check your inbox for the verification link.",
            "code": "EMAIL_NOT_VERIFIED",
            "email": user.email
        }))).into_response();
    }

    // Check MFA
    if user.mfa_enabled.unwrap_or(false) {
        let mfa_code = match &body.mfa_code {
            Some(c) => c,
            None => return (StatusCode::OK, Json(json!({"mfa_required": true, "message": "MFA code required"}))).into_response(),
        };

        // FAIL CLOSED: if MFA is flagged on but no secret is stored, the old code
        // skipped this whole block and completed the login *without verifying
        // anything*. A missing secret is a broken enrolment, not a free pass.
        let Some(secret) = &user.mfa_secret else {
            tracing::error!("user {} has mfa_enabled but no mfa_secret; refusing login", user.id);
            record_login_history(&state.db, &user.id, &headers, false, Some("MFA misconfigured")).await;
            return (StatusCode::UNAUTHORIZED, Json(json!({
                "error": "Two-factor authentication is misconfigured for this account. Contact support.",
                "code": "MFA_MISCONFIGURED"
            }))).into_response();
        };
        {
            let valid = verify_totp(secret, mfa_code).unwrap_or(false);
            if !valid {
                // Try backup codes
                let string_codes = backup_codes_from_json(user.mfa_backup_codes.as_ref());
                match verify_backup_code(mfa_code, &string_codes) {
                    Some(used_idx) => {
                        // Burn the code — single use. The old UPDATE bound a
                        // String to the jsonb column and always failed silently,
                        // so backup codes were infinitely reusable.
                        let mut remaining = string_codes.clone();
                        remaining.remove(used_idx);
                        let updated = serde_json::Value::Array(
                            remaining.into_iter().map(serde_json::Value::String).collect(),
                        );
                        if let Err(e) = sqlx::query("UPDATE users SET mfa_backup_codes = $1 WHERE id = $2")
                            .bind(&updated)
                            .bind(&user.id)
                            .execute(&state.db)
                            .await
                        {
                            // Refuse the login rather than let the code be reused.
                            tracing::error!("could not burn backup code for {}: {}", user.id, e);
                            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Could not complete two-factor verification"}))).into_response();
                        }
                    }
                    None => {
                        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid MFA code"}))).into_response();
                    }
                }
            }
        }
    }

    // Update last_login + reset failed counter
    let _ = sqlx::query("UPDATE users SET last_login = CURRENT_TIMESTAMP, failed_login_count = 0, locked_until = NULL WHERE id = $1")
        .bind(&user.id)
        .execute(&state.db)
        .await;

    let org_id = user.organization_id.as_deref();
    let role = user.role.as_deref().unwrap_or("user");

    // Record successful login history
    record_login_history(&state.db, &user.id, &headers, true, None).await;
    log_audit(&state.db, "login", "auth", "info", Some(&user.id), org_id, None, Some("user"), Some(&user.id), "success", Some(&headers)).await;

    let access_token = create_access_token(&state.jwt_secret, &user.id, org_id, role).unwrap_or_default();
    let refresh_token = create_refresh_token(&state.jwt_secret, &user.id).unwrap_or_default();

    // Fetch organization for the response
    let org_response = if let Some(oid) = org_id {
        let org: Option<Organization> = sqlx::query_as("SELECT * FROM organizations WHERE id = $1")
            .bind(oid)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);
        org.map(|o: Organization| json!(o.to_response()))
    } else {
        None
    };

    (StatusCode::OK, Json(json!({
        "message": "Login successful",
        "user": user.to_response(),
        "organization": org_response,
        "access_token": access_token,
        "refresh_token": refresh_token
    }))).into_response()
}

// ── Refresh Token ──────────────────────────────────────────

pub async fn refresh(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    // Extract refresh token from cookie or header
    let token = extract_refresh_token(&headers);
    let token = match token {
        Some(t) => t,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Refresh token required"}))).into_response(),
    };

    let claims = match crate::services::auth::decode_token(&state.jwt_secret, &token) {
        Ok(c) => c,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid refresh token"}))).into_response(),
    };

    if claims.token_type != "refresh" {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid token type"}))).into_response();
    }

    // ── Token rotation + reuse detection (SOC 2 CC6.1, OAuth2 best practice) ──
    // Each refresh token carries a unique `jti`. On every successful refresh the
    // old jti is revoked in Redis, so a stolen/rotated token can never be replayed.
    if let Some(jti) = &claims.jti {
        let revoked_key = format!("revoked:refresh:{}", jti);
        match state.cache.exists(&revoked_key).await {
            Ok(true) => {
                return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Refresh token has been revoked"}))).into_response();
            }
            Ok(false) => {}
            Err(e) => tracing::warn!("refresh blacklist lookup failed: {e}"),
        }
    }

    // Revoke sessions issued before a password change/reset.
    {
        let pwd_changed_at: i64 = sqlx::query_scalar(
            "SELECT COALESCE(password_changed_at, 0) FROM users WHERE id = $1",
        )
        .bind(&claims.sub)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);
        let issued_at: i64 = claims.iat;
        if pwd_changed_at > 0 && issued_at > 0 && issued_at < pwd_changed_at {
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Session revoked: password was changed"}))).into_response();
        }
    }

    // Fetch user to get current org/role
    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1 AND is_active = TRUE")
        .bind(&claims.sub)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let user = match user {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "User not found"}))).into_response(),
    };

    let org_id = user.organization_id.as_deref();
    let role = user.role.as_deref().unwrap_or("user");

    let access_token = create_access_token(&state.jwt_secret, &user.id, org_id, role).unwrap_or_default();

    // Rotate: revoke the old refresh token, issue a fresh one.
    let new_refresh = create_refresh_token(&state.jwt_secret, &user.id).unwrap_or_default();
    if let Some(jti) = &claims.jti {
        // Blacklist the old jti for the remainder of its 30-day lifetime.
        let now = chrono::Utc::now().timestamp();
        let ttl = (claims.exp - now).max(60) as u64;
        let revoked_key = format!("revoked:refresh:{}", jti);
        match state.cache.set(&revoked_key, "1", std::time::Duration::from_secs(ttl)).await {
            Ok(_) => {}
            Err(e) => tracing::warn!("refresh blacklist write failed: {e}"),
        }
    }

    (StatusCode::OK, Json(json!({
        "access_token": access_token,
        "refresh_token": new_refresh
    }))).into_response()
}

fn extract_refresh_token(headers: &HeaderMap) -> Option<String> {
    // Cookie
    if let Some(cookie_header) = headers.get("cookie") {
        if let Ok(cookies) = cookie_header.to_str() {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if let Some(token) = cookie.strip_prefix("refresh_token_cookie=") {
                    return Some(token.to_string());
                }
            }
        }
    }
    // Header
    if let Some(auth) = headers.get("authorization") {
        if let Ok(s) = auth.to_str() {
            if let Some(token) = s.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }
    None
}

// ── Logout ─────────────────────────────────────────────────

pub async fn logout(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    headers: HeaderMap,
) -> impl IntoResponse {
    log_audit(&state.db, "logout", "auth", "info", Some(&auth.user_id), auth.org_id.as_deref(), None, Some("user"), Some(&auth.user_id), "success", Some(&headers)).await;
    Json(json!({"message": "Logged out successfully"})).into_response()
}

// ── Get Current User ───────────────────────────────────────

pub async fn me(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(&auth.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    match user {
        Some(u) => {
            let org_response = if let Some(ref oid) = u.organization_id {
                let org: Option<Organization> = sqlx::query_as("SELECT * FROM organizations WHERE id = $1")
                    .bind(oid)
                    .fetch_optional(&state.db)
                    .await
                    .unwrap_or(None);
                org.map(|o: Organization| json!(o.to_response()))
            } else {
                None
            };
            (StatusCode::OK, Json(json!({"user": u.to_response(), "organization": org_response}))).into_response()
        },
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    }
}

// ── Update Profile ─────────────────────────────────────────

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub company: Option<String>,
}

pub async fn update_profile(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<UpdateProfileRequest>,
) -> impl IntoResponse {
    let _ = sqlx::query("UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name) WHERE id = $3")
        .bind(&body.first_name)
        .bind(&body.last_name)
        .bind(&auth.user_id)
        .execute(&state.db)
        .await;

    // Update organization name (company) if provided
    if let Some(ref company) = body.company {
        if let Some(ref org_id) = auth.org_id {
            let _ = sqlx::query("UPDATE organizations SET name = $1 WHERE id = $2")
                .bind(company)
                .bind(org_id)
                .execute(&state.db)
                .await;
        }
    }

    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(&auth.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    match user {
        Some(u) => Json(json!({"user": u.to_response()})),
        None => Json(json!({"error": "User not found"})),
    }
}

// ── MFA Setup ──────────────────────────────────────────────

pub async fn mfa_setup(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(&auth.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let user = match user {
        Some(u) => u,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    };

    if user.mfa_enabled.unwrap_or(false) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "MFA already enabled"}))).into_response();
    }

    let secret = generate_totp_secret();
    let uri = generate_totp_uri(&secret, &user.email).unwrap_or_default();
    let qr_code = match generate_totp_qr_code(&secret, &user.email) {
        Ok(code) => code,
        Err(e) => {
            tracing::error!("Failed to generate MFA QR code: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to generate MFA QR code"}))).into_response();
        }
    };

    // Store secret temporarily
    let _ = sqlx::query("UPDATE users SET mfa_secret = $1 WHERE id = $2")
        .bind(&secret)
        .bind(&auth.user_id)
        .execute(&state.db)
        .await;

    (StatusCode::OK, Json(json!({
        "secret": secret,
        "qr_code": qr_code,
        "uri": uri,
        "issuer": "CyberSec Pro",
        "message": "Scan QR code with authenticator app, then verify"
    }))).into_response()
}

// ── MFA Verify (Enable) ───────────────────────────────────

#[derive(Deserialize)]
pub struct MfaVerifyRequest {
    pub code: String,
}

pub async fn mfa_verify(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    headers: HeaderMap,
    Json(body): Json<MfaVerifyRequest>,
) -> impl IntoResponse {
    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(&auth.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let user = match user {
        Some(u) => u,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    };

    let secret = match &user.mfa_secret {
        Some(s) => s,
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "MFA not set up"}))).into_response(),
    };

    if !verify_totp(secret, &body.code).unwrap_or(false) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid MFA code"}))).into_response();
    }

    // Generate backup codes.
    //
    // BUG FIX: this bound a Rust `String` to the `jsonb` column, so Postgres
    // rejected every UPDATE with "is of type jsonb but expression is of type
    // text". The error was discarded by `let _ =`, so the endpoint returned 200
    // with a fresh set of codes while `mfa_enabled` stayed FALSE — users
    // believed MFA was on when it was never enabled. Binding a
    // `serde_json::Value` makes the type line up, and the result is now checked.
    let backup_codes = generate_backup_codes();
    let codes_json = hash_backup_codes_json(&backup_codes);

    if let Err(e) = sqlx::query("UPDATE users SET mfa_enabled = TRUE, mfa_backup_codes = $1, mfa_enabled_at = CURRENT_TIMESTAMP WHERE id = $2")
        .bind(&codes_json)
        .bind(&auth.user_id)
        .execute(&state.db)
        .await
    {
        tracing::error!("failed to enable MFA for {}: {}", auth.user_id, e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Could not enable two-factor authentication"}))).into_response();
    }

    log_audit(&state.db, "mfa_enable", "security", "info", Some(&auth.user_id), auth.org_id.as_deref(), None, Some("user"), Some(&auth.user_id), "success", Some(&headers)).await;

    (StatusCode::OK, Json(json!({
        "message": "MFA enabled successfully",
        "backup_codes": backup_codes
    }))).into_response()
}

// ── MFA Disable ────────────────────────────────────────────

#[derive(Deserialize)]
pub struct MfaDisableRequest {
    pub password: String,
}

pub async fn mfa_disable(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    headers: HeaderMap,
    Json(body): Json<MfaDisableRequest>,
) -> impl IntoResponse {
    // Require current password to disable MFA
    let row: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT password_hash FROM users WHERE id = $1"
    )
    .bind(&auth.user_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let pw_hash = match row.and_then(|r| r.0) {
        Some(h) => h,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    };

    if !verify_password(&body.password, &pw_hash) {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid password"}))).into_response();
    }

    let _ = sqlx::query(
        "UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL, mfa_backup_codes = NULL, mfa_enabled_at = NULL WHERE id = $1"
    )
    .bind(&auth.user_id)
    .execute(&state.db)
    .await;

    log_audit(&state.db, "mfa_disable", "security", "warning", Some(&auth.user_id), auth.org_id.as_deref(), None, Some("user"), Some(&auth.user_id), "success", Some(&headers)).await;

    Json(json!({"message": "MFA disabled"})).into_response()
}

// ── MFA Status ─────────────────────────────────────────────

pub async fn mfa_status(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    // BUG FIX: `mfa_backup_codes` is jsonb but was decoded into Option<String>,
    // which sqlx rejects at runtime. The error fell into `.unwrap_or(None)`, so
    // this endpoint reported `mfa_enabled: false` for every user, always.
    // Casting to text in SQL keeps the Rust type honest.
    let row: Option<(Option<bool>, Option<String>, Option<serde_json::Value>)> = sqlx::query_as(
        "SELECT mfa_enabled, CAST(mfa_enabled_at AS TEXT), mfa_backup_codes FROM users WHERE id = $1"
    )
    .bind(&auth.user_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    match row {
        Some((enabled, enabled_at, backup_codes_json)) => {
            let backup_codes_remaining = backup_codes_from_json(backup_codes_json.as_ref()).len();
            Json(json!({
                "mfa_enabled": enabled.unwrap_or(false),
                "mfa_enabled_at": enabled_at,
                "backup_codes_remaining": backup_codes_remaining
            }))
        },
        None => Json(json!({"mfa_enabled": false, "backup_codes_remaining": 0})),
    }
}

// ── Forgot Password ────────────────────────────────────────

#[derive(Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
}

pub async fn forgot_password(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<ForgotPasswordRequest>,
) -> impl IntoResponse {
    let ip = crate::services::net::client_ip_or_unknown(&headers);
    if state.rate_limiter.is_limited(&format!("forgot_password:{}", ip), 3, std::time::Duration::from_secs(300)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many requests. Please try again later."}))).into_response();
    }

    let email = body.email.trim().to_lowercase();

    // Always return success to prevent email enumeration
    let success_response = Json(json!({
        "message": "If an account with that email exists, a password reset link has been sent."
    }));

    // Look up user
    let user: Option<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT id, first_name, email FROM users WHERE email = $1 AND is_active = TRUE"
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (user_id, first_name, user_email) = match user {
        Some(u) => u,
        None => return success_response.into_response(),
    };

    // Generate secure reset token
    let reset_token = Uuid::new_v4().to_string();
    let expires = chrono::Utc::now().naive_utc() + chrono::Duration::hours(1);

    // Store the token (hashed for security)
    let token_hash = format!("{:x}", sha2::Sha256::digest(reset_token.as_bytes()));
    if let Err(e) = sqlx::query(
        "UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3"
    )
    .bind(&token_hash)
    .bind(&expires)
    .bind(&user_id)
    .execute(&state.db)
    .await
    {
        tracing::error!("Failed to store reset token: {}", e);
        return success_response.into_response();
    }

    // Send reset email (best-effort; don't reveal failure to client)
    let base_url = std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "https://app.cyber-sec-pro.com".to_string());
    let reset_url = format!("{}/dashboard/reset-password?token={}", base_url, reset_token);
    let name = first_name.as_deref().unwrap_or("there");

    if let Some(cfg) = crate::services::email::EmailConfig::from_env() {
        if let Err(e) = crate::services::email::send_password_reset_email(
            &cfg,
            &user_email.unwrap_or(email),
            name,
            &reset_url,
        ).await {
            tracing::error!("Failed to send reset email: {}", e);
        }
    } else {
        tracing::warn!("SMTP not configured — reset token generated but email not sent");
    }

    log_audit(&state.db, "forgot_password", "auth", "info", Some(&user_id), None, None, Some("user"), Some(&user_id), "success", Some(&headers)).await;

    success_response.into_response()
}

// ── Reset Password ─────────────────────────────────────────

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    pub token: String,
    pub new_password: String,
}

pub async fn reset_password(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<ResetPasswordRequest>,
) -> impl IntoResponse {
    let ip = crate::services::net::client_ip_or_unknown(&headers);
    if state.rate_limiter.is_limited(&format!("reset_password:{}", ip), 5, std::time::Duration::from_secs(300)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many attempts. Please try again later."}))).into_response();
    }

    if body.new_password.len() < 8 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Password must be at least 8 characters"}))).into_response();
    }

    // Hash the submitted token to compare with DB
    let token_hash = format!("{:x}", sha2::Sha256::digest(body.token.as_bytes()));

    // Find user with this reset token that hasn't expired
    let user: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW() AND is_active = TRUE"
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (user_id,) = match user {
        Some(u) => u,
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid or expired reset token"}))).into_response(),
    };

    // Hash the new password
    let pw_hash = match hash_password(&body.new_password) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Password hashing failed"}))).into_response(),
    };

    // Update password and clear reset token atomically
    if let Err(e) = sqlx::query(
        "UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, password_changed_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2"
    )
    .bind(&pw_hash)
    .bind(&user_id)
    .execute(&state.db)
    .await
    {
        tracing::error!("Failed to update password: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Password reset failed"}))).into_response();
    }

    log_audit(&state.db, "password_reset", "auth", "info", Some(&user_id), None, None, Some("user"), Some(&user_id), "success", Some(&headers)).await;

    Json(json!({"message": "Password has been reset successfully. You can now log in with your new password."})).into_response()
}

#[cfg(test)]
mod tests {
    use super::{extract_refresh_token, validate_email};
    use axum::http::{HeaderMap, HeaderValue};

    // ── validate_email ────────────────────────────────────

    #[test]
    fn validate_email_accepts_standard_address() {
        assert!(validate_email("user@example.com"));
    }

    #[test]
    fn validate_email_accepts_subdomain_address() {
        assert!(validate_email("user@mail.example.com"));
    }

    #[test]
    fn validate_email_accepts_plus_alias() {
        assert!(validate_email("user+tag@example.com"));
    }

    #[test]
    fn validate_email_rejects_missing_at_sign() {
        assert!(!validate_email("userexample.com"));
    }

    #[test]
    fn validate_email_rejects_empty_local_part() {
        assert!(!validate_email("@example.com"));
    }

    #[test]
    fn validate_email_rejects_empty_domain() {
        assert!(!validate_email("user@"));
    }

    #[test]
    fn validate_email_rejects_domain_without_dot() {
        assert!(!validate_email("user@localhost"));
    }

    #[test]
    fn validate_email_rejects_email_with_space() {
        assert!(!validate_email("user @example.com"));
    }

    #[test]
    fn validate_email_rejects_too_short() {
        // "a@b.c" = 5 chars, min is 6
        assert!(!validate_email("a@b.c"));
    }

    #[test]
    fn validate_email_accepts_minimum_valid_length() {
        // "a@b.cd" = 6 chars
        assert!(validate_email("a@b.cd"));
    }

    #[test]
    fn validate_email_rejects_exceeding_max_length() {
        // 255-char email: local part fills to push over 254
        let long_local = "a".repeat(243);
        let email = format!("{}@example.com", long_local); // 243+12 = 255 chars
        assert!(!validate_email(&email));
    }

    #[test]
    fn validate_email_accepts_exactly_max_length() {
        // 254 chars: local 242 + "@" + "example.com" 11 = 254
        let long_local = "a".repeat(242);
        let email = format!("{}@example.com", long_local);
        assert_eq!(email.len(), 254);
        assert!(validate_email(&email));
    }

    // ── extract_refresh_token ─────────────────────────────

    #[test]
    fn extract_refresh_token_returns_none_for_empty_headers() {
        let headers = HeaderMap::new();
        assert!(extract_refresh_token(&headers).is_none());
    }

    #[test]
    fn extract_refresh_token_reads_from_cookie() {
        let mut headers = HeaderMap::new();
        headers.insert("cookie", HeaderValue::from_static("refresh_token_cookie=my-token-abc"));
        assert_eq!(extract_refresh_token(&headers).as_deref(), Some("my-token-abc"));
    }

    #[test]
    fn extract_refresh_token_reads_from_multiple_cookies() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "cookie",
            HeaderValue::from_static("session=abc123; refresh_token_cookie=tok-xyz; other=val"),
        );
        assert_eq!(extract_refresh_token(&headers).as_deref(), Some("tok-xyz"));
    }

    #[test]
    fn extract_refresh_token_reads_from_authorization_bearer() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", HeaderValue::from_static("Bearer my-refresh-token"));
        assert_eq!(extract_refresh_token(&headers).as_deref(), Some("my-refresh-token"));
    }

    #[test]
    fn extract_refresh_token_cookie_takes_precedence_over_bearer() {
        let mut headers = HeaderMap::new();
        headers.insert("cookie", HeaderValue::from_static("refresh_token_cookie=cookie-token"));
        headers.insert("authorization", HeaderValue::from_static("Bearer bearer-token"));
        assert_eq!(extract_refresh_token(&headers).as_deref(), Some("cookie-token"));
    }

    #[test]
    fn extract_refresh_token_ignores_non_bearer_authorization() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", HeaderValue::from_static("Basic dXNlcjpwYXNz"));
        assert!(extract_refresh_token(&headers).is_none());
    }

    #[test]
    fn extract_refresh_token_returns_none_when_cookie_absent() {
        let mut headers = HeaderMap::new();
        headers.insert("cookie", HeaderValue::from_static("session=abc; other=xyz"));
        assert!(extract_refresh_token(&headers).is_none());
    }

    #[test]
    fn extract_refresh_token_handles_cookie_with_leading_spaces() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "cookie",
            HeaderValue::from_static("session=abc;  refresh_token_cookie=padded-token"),
        );
        assert_eq!(extract_refresh_token(&headers).as_deref(), Some("padded-token"));
    }
}
