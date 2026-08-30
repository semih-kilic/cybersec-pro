//! API-key authentication.
//!
//! AUDIT 2026-08-29 — the API-key feature was decorative. Keys were generated,
//! listed, previewed and rotated, and `api_keys.key_hash` was written on
//! creation — but no code path ever read it to authenticate a request. A
//! customer could create a key, see it in the UI, and find that it opened
//! nothing.
//!
//! It could not have worked as built either: `key_hash` is a per-key salted
//! argon2 digest, so identifying the owner of a presented key would require
//! fetching every key in the table and verifying each one in turn.
//!
//! Keys are 256-bit random values, so there is no dictionary to attack and a
//! fast deterministic digest is the right primitive: `key_lookup` is
//! SHA-256(raw key), unique and indexed, giving an O(1) lookup. `key_hash` is
//! kept and still verified, so possession of the database alone is not enough.

use sqlx::PgPool;

/// Prefix every issued key carries. Lets us recognise a key without a lookup.
pub const KEY_PREFIX: &str = "csp_";

/// Who a valid API key belongs to.
#[derive(Debug, Clone)]
pub struct ApiKeyIdentity {
    pub key_id: String,
    pub user_id: String,
    pub organization_id: String,
    pub permissions: Vec<String>,
}

impl ApiKeyIdentity {
    /// True when the key carries a permission (or the `admin` wildcard).
    pub fn allows(&self, needed: &str) -> bool {
        self.permissions.iter().any(|p| p == needed || p == "admin" || p == "*")
    }
}

/// Deterministic, indexable digest of a raw key.
pub fn lookup_hash(raw: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(raw.trim().as_bytes());
    hex::encode(h.finalize())
}

/// Shape check before touching the database.
pub fn looks_like_api_key(raw: &str) -> bool {
    let r = raw.trim();
    // "csp_" + 64 hex characters.
    r.len() == KEY_PREFIX.len() + 64
        && r.starts_with(KEY_PREFIX)
        && r[KEY_PREFIX.len()..].chars().all(|c| c.is_ascii_hexdigit())
}

/// Pull an API key out of the usual header positions.
pub fn extract_api_key(headers: &axum::http::HeaderMap) -> Option<String> {
    if let Some(v) = headers.get("x-api-key").and_then(|v| v.to_str().ok()) {
        let v = v.trim();
        if !v.is_empty() {
            return Some(v.to_string());
        }
    }
    // `Authorization: Bearer csp_…` — distinguishable from a JWT by its prefix.
    if let Some(v) = headers.get("authorization").and_then(|v| v.to_str().ok()) {
        if let Some(tok) = v.strip_prefix("Bearer ") {
            let tok = tok.trim();
            if tok.starts_with(KEY_PREFIX) {
                return Some(tok.to_string());
            }
        }
    }
    None
}

/// Resolve a presented key to its owner, or `None` if it is not usable.
///
/// Checks, in order: shape, an active non-revoked unexpired row, and finally
/// the argon2 digest. Records usage on success.
pub async fn authenticate(pool: &PgPool, raw: &str) -> Option<ApiKeyIdentity> {
    if !looks_like_api_key(raw) {
        return None;
    }

    let row: Option<(String, String, String, Option<String>, Option<String>, Option<bool>, Option<chrono::DateTime<chrono::Utc>>)> =
        sqlx::query_as(
            "SELECT id, user_id, organization_id, key_hash, \
                    COALESCE(permissions::text, '[\"read\"]'), is_active, revoked_at \
               FROM api_keys \
              WHERE key_lookup = $1 \
                AND COALESCE(is_active, TRUE) \
                AND revoked_at IS NULL \
                AND (expires_at IS NULL OR expires_at > NOW()) \
              LIMIT 1",
        )
        .bind(lookup_hash(raw))
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

    let (key_id, user_id, organization_id, key_hash, perms_json, _active, _revoked) = row?;

    // Verify the stored digest too, so a leaked database of lookup hashes is
    // not on its own enough to mint access.
    if let Some(stored) = key_hash.as_deref() {
        if stored.starts_with("$argon2") {
            use argon2::password_hash::{PasswordHash, PasswordVerifier};
            let ok = PasswordHash::new(stored)
                .ok()
                .map(|parsed| argon2::Argon2::default().verify_password(raw.as_bytes(), &parsed).is_ok())
                .unwrap_or(false);
            if !ok {
                tracing::warn!("api key {} matched lookup but failed digest verification", key_id);
                return None;
            }
        }
    }

    let permissions: Vec<String> = perms_json
        .and_then(|j| serde_json::from_str::<Vec<String>>(&j).ok())
        .unwrap_or_else(|| vec!["read".to_string()]);

    // Best-effort usage accounting; never fail the request over it.
    let _ = sqlx::query(
        "UPDATE api_keys SET last_used_at = NOW(), \
                             usage_count = COALESCE(usage_count, 0) + 1, \
                             request_count = COALESCE(request_count, 0) + 1 \
          WHERE id = $1",
    )
    .bind(&key_id)
    .execute(pool)
    .await;

    Some(ApiKeyIdentity { key_id, user_id, organization_id, permissions })
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};

    fn key() -> String {
        format!("{KEY_PREFIX}{}", "a1b2c3d4".repeat(8))
    }

    #[test]
    fn lookup_hash_is_deterministic_and_hex() {
        let k = key();
        assert_eq!(lookup_hash(&k), lookup_hash(&k));
        assert_eq!(lookup_hash(&k).len(), 64);
        assert_ne!(lookup_hash(&k), lookup_hash("csp_different"));
    }

    #[test]
    fn lookup_hash_ignores_surrounding_whitespace() {
        let k = key();
        assert_eq!(lookup_hash(&k), lookup_hash(&format!("  {k}  ")));
    }

    #[test]
    fn shape_check_accepts_a_real_key() {
        assert!(looks_like_api_key(&key()));
    }

    #[test]
    fn shape_check_rejects_everything_else() {
        for bad in [
            "",
            "csp_",
            "csp_short",
            "nope_a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
            // right length, wrong alphabet
            &format!("{KEY_PREFIX}{}", "z".repeat(64)),
            // a JWT must not be mistaken for a key
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.abc",
        ] {
            assert!(!looks_like_api_key(bad), "{bad:?} must not look like an API key");
        }
    }

    #[test]
    fn extract_reads_the_x_api_key_header() {
        let mut h = HeaderMap::new();
        h.insert("x-api-key", HeaderValue::from_str(&key()).unwrap());
        assert_eq!(extract_api_key(&h).as_deref(), Some(key().as_str()));
    }

    #[test]
    fn extract_reads_a_bearer_api_key() {
        let mut h = HeaderMap::new();
        h.insert("authorization", HeaderValue::from_str(&format!("Bearer {}", key())).unwrap());
        assert_eq!(extract_api_key(&h).as_deref(), Some(key().as_str()));
    }

    #[test]
    fn extract_ignores_a_bearer_jwt() {
        // A JWT in the same header position must fall through to JWT auth.
        let mut h = HeaderMap::new();
        h.insert("authorization", HeaderValue::from_static("Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig"));
        assert_eq!(extract_api_key(&h), None);
    }

    #[test]
    fn extract_returns_none_without_headers() {
        assert_eq!(extract_api_key(&HeaderMap::new()), None);
    }

    #[test]
    fn permissions_gate_reads_and_wildcards() {
        let id = |p: Vec<&str>| ApiKeyIdentity {
            key_id: "k".into(), user_id: "u".into(), organization_id: "o".into(),
            permissions: p.into_iter().map(String::from).collect(),
        };
        assert!(id(vec!["read"]).allows("read"));
        assert!(!id(vec!["read"]).allows("write"));
        assert!(id(vec!["read", "write"]).allows("write"));
        assert!(id(vec!["admin"]).allows("write"), "admin is a wildcard");
        assert!(id(vec!["*"]).allows("anything"));
        assert!(!id(vec![]).allows("read"));
    }
}
