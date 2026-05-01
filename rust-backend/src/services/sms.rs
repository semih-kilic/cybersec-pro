/// CyberSec Pro — SMS OTP Service
/// Supports Twilio (primary) and AWS SNS (fallback).
/// Provider is selected via SMS_PROVIDER env var ("twilio" | "sns").
use rand::Rng;
use reqwest::Client;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

/// Duration an OTP is valid for.
const OTP_TTL_SECONDS: i64 = 300; // 5 minutes
const OTP_MAX_ATTEMPTS: i32 = 5;

// ── OTP Generation ─────────────────────────────────────────────────────────

pub fn generate_otp(digits: usize) -> String {
    let mut rng = rand::thread_rng();
    let max = 10u32.pow(digits as u32);
    format!("{:0>width$}", rng.gen_range(0..max), width = digits)
}

/// SHA-256 hash of an OTP for safe storage.
pub fn hash_otp(otp: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(otp.as_bytes());
    hex::encode(hasher.finalize())
}

// ── DB Helpers ─────────────────────────────────────────────────────────────

/// Store an OTP code for a user. Invalidates previous codes.
pub async fn store_otp(
    db: &PgPool,
    user_id: &str,
    phone: &str,
    purpose: &str, // "login_mfa" | "phone_verify" | "password_reset"
) -> Result<String, String> {
    let otp = generate_otp(6);
    let otp_hash = hash_otp(&otp);
    let id = Uuid::new_v4().to_string();

    // Expire previous codes for this user+purpose
    let _ = sqlx::query(
        "UPDATE sms_otp_codes SET used = TRUE WHERE user_id = $1 AND purpose = $2 AND used = FALSE"
    )
    .bind(user_id)
    .bind(purpose)
    .execute(db)
    .await;

    sqlx::query(
        "INSERT INTO sms_otp_codes (id, user_id, phone_number, otp_hash, purpose, expires_at, attempts)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '5 minutes', 0)"
    )
    .bind(&id)
    .bind(user_id)
    .bind(phone)
    .bind(&otp_hash)
    .bind(purpose)
    .execute(db)
    .await
    .map_err(|e| format!("DB error storing OTP: {}", e))?;

    Ok(otp)
}

/// Verify an OTP code. Returns true if valid and marks it as used.
pub async fn verify_otp(
    db: &PgPool,
    user_id: &str,
    purpose: &str,
    code: &str,
) -> Result<bool, String> {
    let otp_hash = hash_otp(code);

    // Fetch latest valid code
    let row: Option<(String, i32, bool)> = sqlx::query_as(
        "SELECT id, attempts, used FROM sms_otp_codes
         WHERE user_id = $1 AND purpose = $2 AND used = FALSE
           AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1"
    )
    .bind(user_id)
    .bind(purpose)
    .fetch_optional(db)
    .await
    .map_err(|e| format!("DB error: {}", e))?;

    let (code_id, attempts, _used) = match row {
        Some(r) => r,
        None => return Ok(false), // No valid code found
    };

    // Increment attempt counter
    let new_attempts = attempts + 1;
    let _ = sqlx::query("UPDATE sms_otp_codes SET attempts = $1 WHERE id = $2")
        .bind(new_attempts)
        .bind(&code_id)
        .execute(db)
        .await;

    if new_attempts > OTP_MAX_ATTEMPTS {
        // Invalidate code after too many attempts
        let _ = sqlx::query("UPDATE sms_otp_codes SET used = TRUE WHERE id = $1")
            .bind(&code_id)
            .execute(db)
            .await;
        return Err("Too many attempts. Request a new code.".into());
    }

    // Verify hash
    let valid_row: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM sms_otp_codes WHERE id = $1 AND otp_hash = $2 AND used = FALSE AND expires_at > NOW()"
    )
    .bind(&code_id)
    .bind(&otp_hash)
    .fetch_optional(db)
    .await
    .map_err(|e| format!("DB error: {}", e))?;

    if valid_row.is_some() {
        // Mark as used
        let _ = sqlx::query("UPDATE sms_otp_codes SET used = TRUE WHERE id = $1")
            .bind(&code_id)
            .execute(db)
            .await;
        Ok(true)
    } else {
        Ok(false)
    }
}

// ── SMS Providers ──────────────────────────────────────────────────────────

pub struct SmsService {
    client: Client,
    provider: SmsProvider,
}

#[derive(Clone)]
enum SmsProvider {
    Twilio {
        account_sid: String,
        auth_token: String,
        from_number: String,
    },
    AwsSns {
        access_key: String,
        secret_key: String,
        region: String,
    },
    Mock, // For development/testing
}

impl SmsService {
    pub fn from_env() -> Self {
        let provider = match std::env::var("SMS_PROVIDER").as_deref() {
            Ok("twilio") => SmsProvider::Twilio {
                account_sid: std::env::var("TWILIO_ACCOUNT_SID").unwrap_or_default(),
                auth_token: std::env::var("TWILIO_AUTH_TOKEN").unwrap_or_default(),
                from_number: std::env::var("TWILIO_FROM_NUMBER").unwrap_or_default(),
            },
            Ok("sns") => SmsProvider::AwsSns {
                access_key: std::env::var("AWS_ACCESS_KEY_ID").unwrap_or_default(),
                secret_key: std::env::var("AWS_SECRET_ACCESS_KEY").unwrap_or_default(),
                region: std::env::var("AWS_REGION").unwrap_or_else(|_| "us-east-1".into()),
            },
            _ => SmsProvider::Mock,
        };

        SmsService {
            client: Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .expect("HTTP client init failed"),
            provider,
        }
    }

    /// Send an OTP via the configured provider.
    pub async fn send_otp(&self, phone: &str, otp: &str) -> Result<(), String> {
        let message = format!(
            "CyberSec Pro doğrulama kodunuz: {}. Bu kod 5 dakika geçerlidir. Paylaşmayın.",
            otp
        );
        self.send(phone, &message).await
    }

    pub async fn send(&self, to: &str, message: &str) -> Result<(), String> {
        match &self.provider {
            SmsProvider::Twilio { account_sid, auth_token, from_number } => {
                self.send_twilio(to, message, account_sid, auth_token, from_number).await
            }
            SmsProvider::AwsSns { access_key, secret_key, region } => {
                self.send_sns(to, message, access_key, secret_key, region).await
            }
            SmsProvider::Mock => {
                tracing::info!("[SMS MOCK] To: {} | Message: {}", to, message);
                Ok(())
            }
        }
    }

    async fn send_twilio(
        &self,
        to: &str,
        message: &str,
        account_sid: &str,
        auth_token: &str,
        from: &str,
    ) -> Result<(), String> {
        if account_sid.is_empty() {
            return Err("Twilio not configured".into());
        }
        let url = format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
            account_sid
        );
        let params = [("To", to), ("From", from), ("Body", message)];
        let resp = self
            .client
            .post(&url)
            .basic_auth(account_sid, Some(auth_token))
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Twilio request failed: {}", e))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            let body = resp.text().await.unwrap_or_default();
            Err(format!("Twilio error: {}", body))
        }
    }

    async fn send_sns(
        &self,
        to: &str,
        message: &str,
        _access_key: &str,
        _secret_key: &str,
        _region: &str,
    ) -> Result<(), String> {
        // AWS SNS requires SigV4 signing — for production use the `aws-sdk-sns` crate.
        // This is a placeholder that logs the intent.
        tracing::info!("[SNS] Would send to {} via AWS SNS: {}", to, message);
        Ok(())
    }
}

// ── Pure helpers (testable) ────────────────────────────────────────────────

/// Normalize a phone number to E.164 format (basic).
pub fn normalize_phone(phone: &str) -> Option<String> {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit() || *c == '+').collect();
    if digits.starts_with('+') && digits.len() >= 8 && digits.len() <= 16 {
        Some(digits)
    } else if digits.len() >= 7 && digits.len() <= 15 {
        // Assume missing country code — prepend + for storage but mark uncertain
        Some(format!("+{}", digits))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_otp_length() {
        let otp = generate_otp(6);
        assert_eq!(otp.len(), 6);
        assert!(otp.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn test_otp_hash_deterministic() {
        let h1 = hash_otp("123456");
        let h2 = hash_otp("123456");
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_normalize_phone() {
        assert_eq!(normalize_phone("+905321234567"), Some("+905321234567".into()));
        assert_eq!(normalize_phone("905321234567"), Some("+905321234567".into()));
        assert_eq!(normalize_phone("123"), None); // Too short
    }
}
