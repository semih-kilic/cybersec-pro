use anyhow::Result;
use totp_rs::{Algorithm, Secret, TOTP};

/// Generate a new TOTP secret (base32 encoded, 32 chars).
pub fn generate_totp_secret() -> String {
    let secret = Secret::generate_secret();
    secret.to_encoded().to_string()
}

/// Generate a TOTP provisioning URI for QR code.
pub fn generate_totp_uri(secret: &str, email: &str) -> Result<String> {
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        Secret::Encoded(secret.to_string()).to_bytes()?,
    )?;
    Ok(totp.get_url(email, "CyberSec Pro"))
}

/// Verify a TOTP code against a secret.
pub fn verify_totp(secret: &str, code: &str) -> Result<bool> {
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        Secret::Encoded(secret.to_string()).to_bytes()?,
    )?;
    Ok(totp.check_current(code)?)
}

/// Generate backup codes (8 codes, 8 chars each).
pub fn generate_backup_codes() -> Vec<String> {
    (0..8)
        .map(|_| {
            let bytes: [u8; 4] = rand::random();
            hex::encode(bytes)
        })
        .collect()
}

/// Hash a backup code for storage (simple SHA256).
pub fn hash_backup_code(code: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    hex::encode(hasher.finalize())
}

/// Verify a backup code against stored hashed codes.
pub fn verify_backup_code(code: &str, hashed_codes: &[String]) -> Option<usize> {
    let hashed = hash_backup_code(code);
    hashed_codes.iter().position(|c| c == &hashed)
}
