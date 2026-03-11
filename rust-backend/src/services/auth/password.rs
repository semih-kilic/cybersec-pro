use anyhow::{anyhow, Result};
use pbkdf2::pbkdf2_hmac_array;
use sha2::Sha256;

/// Hash a password using PBKDF2-SHA256 (werkzeug-compatible format).
/// Output: "pbkdf2:sha256:600000$<salt>$<hash>"
pub fn hash_password(password: &str) -> Result<String> {
    let salt: [u8; 16] = rand::random();
    let salt_hex = hex::encode(salt);
    let iterations: u32 = 600_000;

    let dk = pbkdf2_hmac_array::<Sha256, 32>(
        password.as_bytes(),
        salt_hex.as_bytes(),
        iterations,
    );

    Ok(format!(
        "pbkdf2:sha256:{}${}${}",
        iterations,
        salt_hex,
        hex::encode(dk)
    ))
}

/// Verify a password against a werkzeug-format hash.
/// Supports format: "pbkdf2:sha256:<iterations>$<salt>$<hash>"
pub fn verify_password(password: &str, hash: &str) -> bool {
    verify_werkzeug_password(password, hash).unwrap_or(false)
}

/// Parse and verify werkzeug password hash.
pub fn verify_werkzeug_password(password: &str, stored_hash: &str) -> Result<bool> {
    // Format: "pbkdf2:sha256:<iterations>$<salt>$<hash>"
    // or:     "method$salt$hash"
    let parts: Vec<&str> = stored_hash.splitn(3, '$').collect();
    if parts.len() != 3 {
        return Err(anyhow!("Invalid hash format"));
    }

    let method_part = parts[0]; // "pbkdf2:sha256:600000"
    let salt = parts[1];
    let expected_hash = parts[2];

    // Parse method
    let method_parts: Vec<&str> = method_part.split(':').collect();
    if method_parts.len() < 3 || method_parts[0] != "pbkdf2" || method_parts[1] != "sha256" {
        return Err(anyhow!("Unsupported hash method: {}", method_part));
    }

    let iterations: u32 = method_parts[2]
        .parse()
        .map_err(|_| anyhow!("Invalid iterations"))?;

    let dk = pbkdf2_hmac_array::<Sha256, 32>(
        password.as_bytes(),
        salt.as_bytes(),
        iterations,
    );

    let computed_hash = hex::encode(dk);
    Ok(computed_hash == expected_hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() {
        let password = "TestMFA2026!";
        let hash = hash_password(password).unwrap();
        assert!(hash.starts_with("pbkdf2:sha256:600000$"));
        assert!(verify_password(password, &hash));
        assert!(!verify_password("wrong", &hash));
    }
}
