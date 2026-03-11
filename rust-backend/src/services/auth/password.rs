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

/// Verify a password against a werkzeug-format hash (scrypt or pbkdf2).
pub fn verify_password(password: &str, hash: &str) -> bool {
    verify_werkzeug_password(password, hash).unwrap_or(false)
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
        Ok(computed == expected_hash)
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
        Ok(hex::encode(dk) == expected_hash)
    } else {
        Err(anyhow!("Unsupported hash method: {}", method_part))
    }
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
}
