use anyhow::{anyhow, Result};
use pbkdf2::pbkdf2_hmac_array;
use sha2::Sha256;

/// Hash a password using scrypt (werkzeug 3.x default format).
/// Output: "scrypt:32768:8:1$<salt>$<hash>"
pub fn hash_password(password: &str) -> Result<String> {
    let salt: [u8; 16] = rand::random();
    let salt_hex = hex::encode(salt);

    // werkzeug 3.x scrypt defaults: n=2^15=32768, r=8, p=1
    let params = scrypt::Params::new(15, 8, 1, 64)
        .map_err(|e| anyhow!("scrypt params error: {}", e))?;
    let mut dk = vec![0u8; 64];
    scrypt::scrypt(
        password.as_bytes(),
        salt_hex.as_bytes(),
        &params,
        &mut dk,
    )
    .map_err(|e| anyhow!("scrypt error: {}", e))?;

    Ok(format!(
        "scrypt:32768:8:1${}${}",
        salt_hex,
        hex::encode(dk)
    ))
}

/// Returns true when the stored value means "this account has no password"
/// (OAuth-only, SSO-only, or never set).
///
/// The column is nullable, but several code paths write an empty string instead
/// of NULL. Callers used to treat `Some("")` as a real hash and ran it through
/// verification, which failed with a misleading "invalid email or password"
/// instead of telling the user to sign in with their identity provider.
pub fn is_passwordless(stored_hash: Option<&str>) -> bool {
    stored_hash.map(|h| h.trim().is_empty()).unwrap_or(true)
}

/// Verify a password against a stored hash.
///
/// Accepted formats:
///   - `scrypt:N:r:p$salt$hash`          (werkzeug 3.x — what we write)
///   - `pbkdf2:sha256:iterations$salt$hash` (werkzeug 2.x — legacy)
///   - `$argon2id$v=19$...`              (PHC — see below)
///
/// Argon2 support exists because `change_password` used to hash with argon2
/// while this function only understood the werkzeug formats. Any account that
/// changed its password was permanently locked out: the new hash could never be
/// verified again. The write path now emits scrypt, and argon2 is still
/// accepted here so already-migrated accounts can log in and be re-hashed.
pub fn verify_password(password: &str, hash: &str) -> bool {
    if hash.trim().is_empty() {
        return false;
    }
    if hash.starts_with("$argon2") {
        return verify_argon2_password(password, hash).unwrap_or(false);
    }
    verify_werkzeug_password(password, hash).unwrap_or(false)
}

/// Verify a PHC-format argon2 hash.
fn verify_argon2_password(password: &str, stored_hash: &str) -> Result<bool> {
    use argon2::password_hash::{PasswordHash, PasswordVerifier};
    let parsed = PasswordHash::new(stored_hash)
        .map_err(|e| anyhow!("invalid argon2 hash: {}", e))?;
    Ok(argon2::Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

/// Returns true when `hash` is not in our canonical format and the account
/// should be transparently re-hashed on the next successful login.
pub fn needs_rehash(hash: &str) -> bool {
    !hash.starts_with("scrypt:")
}

/// Parse and verify werkzeug password hash.
/// Supports:
///   - "scrypt:N:r:p$salt$hash" (werkzeug 3.x default)
///   - "pbkdf2:sha256:iterations$salt$hash" (werkzeug 2.x)
pub fn verify_werkzeug_password(password: &str, stored_hash: &str) -> Result<bool> {
    let parts: Vec<&str> = stored_hash.splitn(3, '$').collect();
    if parts.len() != 3 {
        return Err(anyhow!("Invalid hash format"));
    }

    let method_part = parts[0];
    let salt = parts[1];
    let expected_hash = parts[2];

    let method_parts: Vec<&str> = method_part.split(':').collect();

    if method_parts.first() == Some(&"scrypt") {
        // scrypt:N:r:p
        if method_parts.len() < 4 {
            return Err(anyhow!("Invalid scrypt params"));
        }
        let n: u64 = method_parts[1].parse().map_err(|_| anyhow!("Invalid N"))?;
        let r: u32 = method_parts[2].parse().map_err(|_| anyhow!("Invalid r"))?;
        let p: u32 = method_parts[3].parse().map_err(|_| anyhow!("Invalid p"))?;

        let log_n = (n as f64).log2() as u8;
        let dk_len = expected_hash.len() / 2; // hex

        let params = scrypt::Params::new(log_n, r, p, dk_len)
            .map_err(|e| anyhow!("scrypt params error: {}", e))?;
        let mut dk = vec![0u8; dk_len];
        scrypt::scrypt(password.as_bytes(), salt.as_bytes(), &params, &mut dk)
            .map_err(|e| anyhow!("scrypt error: {}", e))?;

        let computed = hex::encode(dk);
        // Constant-time: a byte-wise `==` on the hex digest leaks how many
        // leading characters matched, which is an online timing oracle.
        Ok(ct_eq_str(&computed, expected_hash))
    } else if method_parts.first() == Some(&"pbkdf2") {
        // pbkdf2:sha256:iterations
        if method_parts.len() < 3 || method_parts[1] != "sha256" {
            return Err(anyhow!("Unsupported pbkdf2 variant"));
        }
        let iterations: u32 = method_parts[2].parse()
            .map_err(|_| anyhow!("Invalid iterations"))?;
        let dk = pbkdf2_hmac_array::<Sha256, 32>(
            password.as_bytes(),
            salt.as_bytes(),
            iterations,
        );
        Ok(ct_eq_str(&hex::encode(dk), expected_hash))
    } else {
        Err(anyhow!("Unsupported hash method: {}", method_part))
    }
}

/// Constant-time string comparison for digest values.
///
/// A plain `==` on the hex digest short-circuits at the first differing byte,
/// which leaks how many leading characters an attacker guessed correctly.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() {
        let password = "TestMFA2026!";
        let hash = hash_password(password).unwrap();
        assert!(hash.starts_with("scrypt:32768:8:1$"));
        assert!(verify_password(password, &hash));
        assert!(!verify_password("wrong", &hash));
    }

    // ── argon2 interop (#4: change_password lockout) ──────────────────

    /// Builds an argon2 hash the way `change_password` used to.
    fn legacy_argon2_hash(password: &str) -> String {
        use argon2::password_hash::{PasswordHasher, SaltString};
        let salt = SaltString::from_b64("cGVwcGVyc2FsdHNhbHQ").unwrap();
        argon2::Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .unwrap()
            .to_string()
    }

    #[test]
    fn verify_password_accepts_legacy_argon2_hashes() {
        // Regression: accounts whose password was changed by the old
        // `change_password` got an argon2 hash that `verify_password` could not
        // parse, locking them out of their own account forever.
        let hash = legacy_argon2_hash("CorrectHorse1!");
        assert!(hash.starts_with("$argon2"), "fixture must be argon2: {hash}");
        assert!(verify_password("CorrectHorse1!", &hash));
    }

    #[test]
    fn verify_password_rejects_wrong_password_against_argon2() {
        let hash = legacy_argon2_hash("CorrectHorse1!");
        assert!(!verify_password("WrongHorse1!", &hash));
    }

    #[test]
    fn verify_password_rejects_malformed_argon2() {
        assert!(!verify_password("x", "$argon2id$not-a-real-hash"));
    }

    // ── empty / missing hashes ────────────────────────────────────────

    #[test]
    fn verify_password_rejects_empty_hash() {
        // Two live rows store "" rather than NULL for OAuth-only accounts.
        assert!(!verify_password("anything", ""));
        assert!(!verify_password("", ""));
        assert!(!verify_password("anything", "   "));
    }

    #[test]
    fn is_passwordless_detects_all_no_password_spellings() {
        assert!(is_passwordless(None));
        assert!(is_passwordless(Some("")));
        assert!(is_passwordless(Some("   ")));
    }

    #[test]
    fn is_passwordless_is_false_for_a_real_hash() {
        let hash = hash_password("pw").unwrap();
        assert!(!is_passwordless(Some(&hash)));
    }

    // ── needs_rehash ──────────────────────────────────────────────────

    #[test]
    fn needs_rehash_flags_non_canonical_formats() {
        assert!(needs_rehash(&legacy_argon2_hash("pw")));
        assert!(needs_rehash("pbkdf2:sha256:600000$salt$deadbeef"));
        assert!(!needs_rehash(&hash_password("pw").unwrap()));
    }

    // ── pbkdf2 (werkzeug 2.x legacy) ──────────────────────────────────

    #[test]
    fn verify_password_supports_legacy_pbkdf2() {
        use pbkdf2::pbkdf2_hmac_array;
        use sha2::Sha256 as S;
        let (salt, iters) = ("abcdefgh", 1000u32);
        let dk = pbkdf2_hmac_array::<S, 32>(b"hunter2", salt.as_bytes(), iters);
        let stored = format!("pbkdf2:sha256:{}${}${}", iters, salt, hex::encode(dk));
        assert!(verify_password("hunter2", &stored));
        assert!(!verify_password("hunter3", &stored));
    }

    // ── constant-time comparison ──────────────────────────────────────

    #[test]
    fn ct_eq_str_matches_equality_semantics() {
        assert!(ct_eq_str("abc", "abc"));
        assert!(!ct_eq_str("abc", "abd"));
        assert!(!ct_eq_str("abc", "abcd"), "length mismatch must not match");
        assert!(!ct_eq_str("", "a"));
        assert!(ct_eq_str("", ""));
    }

    #[test]
    fn ct_eq_str_rejects_shared_prefixes() {
        // The old `==` short-circuited here, leaking prefix length via timing.
        assert!(!ct_eq_str("deadbeefdeadbeef", "deadbeefdeadbee0"));
        assert!(!ct_eq_str("deadbeefdeadbeef", "0eadbeefdeadbeef"));
    }
}
