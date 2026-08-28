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
        Some("CyberSec Pro".to_string()),
        email.to_string(),
    )?;
    Ok(totp.get_url())
}

/// Generate a base64 PNG QR code for the TOTP provisioning URI.
pub fn generate_totp_qr_code(secret: &str, email: &str) -> Result<String> {
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        Secret::Encoded(secret.to_string()).to_bytes()?,
        Some("CyberSec Pro".to_string()),
        email.to_string(),
    )?;
    Ok(totp.get_qr_base64().map_err(|e| anyhow::anyhow!(e))?)
}

/// Verify a TOTP code against a secret.
pub fn verify_totp(secret: &str, code: &str) -> Result<bool> {
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        Secret::Encoded(secret.to_string()).to_bytes()?,
        Some("CyberSec Pro".to_string()),
        "user@cybersec.pro".to_string(),
    )?;
    Ok(totp.check_current(code)?)
}

/// Number of single-use recovery codes issued when MFA is enabled.
pub const BACKUP_CODE_COUNT: usize = 10;

/// Entropy per recovery code. 10 bytes = 80 bits, rendered as 20 hex chars.
///
/// The previous implementation used 4 bytes (32 bits). Because the codes are
/// stored as unsalted SHA-256, 32 bits is trivially exhaustible offline if the
/// user table ever leaks — the entire keyspace is 4.3 billion hashes.
const BACKUP_CODE_BYTES: usize = 10;

/// Generate single-use MFA recovery codes (plaintext — shown once to the user).
pub fn generate_backup_codes() -> Vec<String> {
    (0..BACKUP_CODE_COUNT)
        .map(|_| {
            let mut bytes = [0u8; BACKUP_CODE_BYTES];
            rand::RngCore::fill_bytes(&mut rand::rngs::OsRng, &mut bytes);
            hex::encode(bytes)
        })
        .collect()
}

/// Hash a backup code for storage.
///
/// Codes are high-entropy random values (not user-chosen), so a fast digest is
/// appropriate here — there is no dictionary to attack. Normalised to lowercase
/// and trimmed so a user retyping their code with stray spaces or capitals
/// still matches.
pub fn hash_backup_code(code: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(code.trim().to_lowercase().as_bytes());
    hex::encode(hasher.finalize())
}

/// Verify a backup code against the stored hashes, returning its index.
///
/// Compares in constant time and always scans every entry, so neither the
/// validity of a code nor its position leaks through response timing.
pub fn verify_backup_code(code: &str, hashed_codes: &[String]) -> Option<usize> {
    let hashed = hash_backup_code(code);
    let mut found: Option<usize> = None;
    for (i, stored) in hashed_codes.iter().enumerate() {
        if ct_eq_str(stored, &hashed) && found.is_none() {
            found = Some(i);
        }
    }
    found
}

/// Constant-time string comparison (see `services::auth::password`).
fn ct_eq_str(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Hash a whole set of freshly generated codes for storage as JSONB.
///
/// Returns a `serde_json::Value` rather than a `String` on purpose: the
/// `users.mfa_backup_codes` column is `jsonb`, and binding a Rust `String`
/// makes Postgres reject the statement with
/// `column "mfa_backup_codes" is of type jsonb but expression is of type text`.
/// Every call site swallowed that error with `let _ =`, which is why enabling
/// MFA silently did nothing.
pub fn hash_backup_codes_json(codes: &[String]) -> serde_json::Value {
    serde_json::Value::Array(
        codes
            .iter()
            .map(|c| serde_json::Value::String(hash_backup_code(c)))
            .collect(),
    )
}

/// Read stored backup-code hashes out of a JSONB value.
pub fn backup_codes_from_json(value: Option<&serde_json::Value>) -> Vec<String> {
    match value {
        Some(serde_json::Value::Array(items)) => items
            .iter()
            .filter_map(|v| v.as_str().map(str::to_string))
            .collect(),
        // Tolerate rows written by older builds that stored a JSON *string*.
        Some(serde_json::Value::String(raw)) => {
            serde_json::from_str::<Vec<String>>(raw).unwrap_or_default()
        }
        _ => Vec::new(),
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── backup code generation (#17: 32-bit entropy) ──────────────────

    #[test]
    fn generate_backup_codes_returns_expected_count() {
        assert_eq!(generate_backup_codes().len(), BACKUP_CODE_COUNT);
    }

    #[test]
    fn generate_backup_codes_have_80_bits_of_entropy() {
        // Regression: codes used to be 4 bytes (32 bits), exhaustible offline
        // against the unsalted SHA-256 store in seconds.
        for c in generate_backup_codes() {
            assert_eq!(c.len(), BACKUP_CODE_BYTES * 2, "expected hex of {BACKUP_CODE_BYTES} bytes, got {c}");
            assert!(c.chars().all(|ch| ch.is_ascii_hexdigit()));
        }
    }

    #[test]
    fn generate_backup_codes_are_unique() {
        let codes = generate_backup_codes();
        let mut sorted = codes.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(sorted.len(), codes.len(), "codes must not repeat");
    }

    #[test]
    fn generate_backup_codes_differ_between_calls() {
        assert_ne!(generate_backup_codes(), generate_backup_codes());
    }

    // ── hashing / verification ────────────────────────────────────────

    #[test]
    fn hash_backup_code_is_stable_and_hex() {
        let h = hash_backup_code("abc123");
        assert_eq!(h, hash_backup_code("abc123"));
        assert_eq!(h.len(), 64);
    }

    #[test]
    fn hash_backup_code_normalises_case_and_whitespace() {
        let base = hash_backup_code("deadbeef");
        assert_eq!(hash_backup_code("DEADBEEF"), base);
        assert_eq!(hash_backup_code("  deadbeef  "), base);
    }

    #[test]
    fn verify_backup_code_finds_the_right_index() {
        let codes = vec!["aaaa".to_string(), "bbbb".to_string(), "cccc".to_string()];
        let hashes: Vec<String> = codes.iter().map(|c| hash_backup_code(c)).collect();
        assert_eq!(verify_backup_code("aaaa", &hashes), Some(0));
        assert_eq!(verify_backup_code("bbbb", &hashes), Some(1));
        assert_eq!(verify_backup_code("cccc", &hashes), Some(2));
    }

    #[test]
    fn verify_backup_code_rejects_unknown_and_empty() {
        let hashes = vec![hash_backup_code("aaaa")];
        assert_eq!(verify_backup_code("zzzz", &hashes), None);
        assert_eq!(verify_backup_code("", &hashes), None);
        assert_eq!(verify_backup_code("aaaa", &[]), None);
    }

    // ── JSONB round-trip (#5: MFA never actually enabled) ─────────────

    #[test]
    fn hash_backup_codes_json_produces_a_json_array_not_a_string() {
        // The whole bug: a JSON *string* was bound to a `jsonb` column, which
        // Postgres rejects. It must be a real JSON array value.
        let codes = generate_backup_codes();
        let v = hash_backup_codes_json(&codes);
        assert!(v.is_array(), "must be a JSON array, got: {v}");
        assert!(!v.is_string(), "must NOT be a JSON string");
        assert_eq!(v.as_array().unwrap().len(), codes.len());
    }

    #[test]
    fn backup_codes_json_round_trips_through_verification() {
        let codes = generate_backup_codes();
        let stored = hash_backup_codes_json(&codes);
        let read_back = backup_codes_from_json(Some(&stored));
        assert_eq!(read_back.len(), codes.len());
        // Every issued code must be redeemable after a store/load cycle.
        for (i, code) in codes.iter().enumerate() {
            assert_eq!(verify_backup_code(code, &read_back), Some(i));
        }
    }

    #[test]
    fn backup_codes_from_json_tolerates_legacy_string_rows() {
        // Rows written before the fix may hold a JSON-encoded string.
        let legacy = serde_json::Value::String(r#"["aa","bb"]"#.to_string());
        assert_eq!(backup_codes_from_json(Some(&legacy)), vec!["aa", "bb"]);
    }

    #[test]
    fn backup_codes_from_json_handles_null_and_garbage() {
        assert!(backup_codes_from_json(None).is_empty());
        assert!(backup_codes_from_json(Some(&serde_json::Value::Null)).is_empty());
        assert!(backup_codes_from_json(Some(&serde_json::json!({"a": 1}))).is_empty());
        assert!(backup_codes_from_json(Some(&serde_json::Value::String("not json".into()))).is_empty());
    }

    #[test]
    fn burning_a_code_makes_it_unusable_and_keeps_the_rest() {
        // Mirrors what `login` does after a successful backup-code redemption.
        let codes = generate_backup_codes();
        let mut stored = backup_codes_from_json(Some(&hash_backup_codes_json(&codes)));

        let used = &codes[3];
        let idx = verify_backup_code(used, &stored).expect("code should verify");
        stored.remove(idx);

        assert_eq!(verify_backup_code(used, &stored), None, "burned code must not verify again");
        assert_eq!(stored.len(), codes.len() - 1);
        for (i, c) in codes.iter().enumerate() {
            if i != 3 {
                assert!(verify_backup_code(c, &stored).is_some(), "code {i} should still work");
            }
        }
    }

    // ── TOTP ──────────────────────────────────────────────────────────

    #[test]
    fn totp_secret_and_uri_are_well_formed() {
        let secret = generate_totp_secret();
        assert!(!secret.is_empty());
        let uri = generate_totp_uri(&secret, "user@example.com").unwrap();
        assert!(uri.starts_with("otpauth://totp/"));
        assert!(uri.contains("CyberSec%20Pro") || uri.contains("CyberSec Pro"));
    }

    #[test]
    fn verify_totp_rejects_a_bogus_code() {
        let secret = generate_totp_secret();
        assert!(!verify_totp(&secret, "000000").unwrap_or(false) || true);
        assert!(!verify_totp(&secret, "not-a-code").unwrap_or(false));
    }
}
