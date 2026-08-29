use axum::http::HeaderMap;
use serde_json::{json, Value as JsonValue};
use sqlx::PgPool;

use crate::services::audit::log_audit;

/// Bump this whenever the confirmation statement or its semantics change.
/// Existing confirmations no longer match and clients must re-confirm.
pub const SCOPE_STATEMENT_VERSION: &str = "2026.08.11.1";

/// Canonical statement a user must confirm before any scan targets a host.
/// The server builds this from the exact target so clients can never confirm a
/// different (shorter/looser) statement. The exact string is stored in the
/// audit log together with a timestamp for legal traceability.
pub fn canonical_statement(target: &str) -> String {
    format!(
        "I confirm that I own, or have been granted written authorization to test, the target '{target}'. \
         I understand that testing systems without authorization may violate laws and my agreements, and \
         that I am solely responsible for this activity. This confirmation is recorded in the audit log with a timestamp."
    )
}

/// Ownership/permission confirmation submitted by the client for a scan request.
#[derive(Debug, Clone)]
pub struct AuthConfirmation {
    pub confirmed: bool,
    pub scope_statement: String,
}

/// How the target string is classified (drives the authorization record).
#[derive(Debug, Clone, PartialEq)]
pub enum TargetType {
    Ip,
    Subnet,
    Domain,
    Url,
    Sandbox,
}

impl TargetType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TargetType::Ip => "ip",
            TargetType::Subnet => "subnet",
            TargetType::Domain => "domain",
            TargetType::Url => "url",
            TargetType::Sandbox => "sandbox",
        }
    }
}

/// Well-known public/sandbox targets that do not require explicit
/// authorization. These are public, intentionally-vulnerable, or loopback
/// targets used for learning and demonstration.
const SANDBOX_HOSTS: &[&str] = &[
    "scanme.nmap.org",
    "testphp.vulnweb.com",
    "example.com",
    "example.org",
    "example.net",
    "localhost",
];

/// Loopback / unspecified addresses that need no authorization.
const SANDBOX_IPS: &[&str] = &["127.0.0.1", "0.0.0.0", "::1"];

/// Returns true when `target` is a known sandbox target.
///
/// SECURITY — this used to match with `starts_with`, which let an attacker
/// walk straight past the authorization gate:
///
///   example.com.attacker.net  starts_with "example.com"  -> "sandbox"
///   192.168.1.100             starts_with "192.168.1.1"  -> "sandbox"
///   127.0.0.15                starts_with "127.0.0.1"    -> "sandbox"
///   localhost.evil.com        starts_with "localhost"    -> "sandbox"
///
/// Any of those would be scanned with no recorded ownership confirmation,
/// which is the one thing the gate exists to prevent. Matching is now exact
/// for hosts and IPs, with true subdomains of the sandbox domains allowed.
pub fn is_sandbox_target(target: &str) -> bool {
    let t = target.trim().to_lowercase();
    if t.is_empty() {
        return false;
    }

    // Strip a URL scheme, credentials, port, path and brackets so the check
    // sees the bare host. `http://example.com:8080/x` must resolve the same
    // way as `example.com`.
    let host = extract_host(&t);
    if host.is_empty() {
        return false;
    }

    // Loopback and unspecified addresses, compared numerically so that
    // 127.0.0.15 does not pass as 127.0.0.1.
    if let Ok(ip) = host.parse::<std::net::IpAddr>() {
        if ip.is_loopback() || ip.is_unspecified() {
            return true;
        }
        return SANDBOX_IPS
            .iter()
            .filter_map(|s| s.parse::<std::net::IpAddr>().ok())
            .any(|s| s == ip);
    }

    // Hostnames: exact match, or a genuine subdomain of a sandbox domain.
    SANDBOX_HOSTS.iter().any(|h| host == *h || host.ends_with(&format!(".{h}")))
}

/// Reduce a target string to its bare host for comparison.
fn extract_host(target: &str) -> String {
    let mut t = target.trim();

    // scheme://
    if let Some(pos) = t.find("://") {
        t = &t[pos + 3..];
    }
    // user:pass@
    if let Some(pos) = t.rfind('@') {
        t = &t[pos + 1..];
    }
    // path / query / fragment
    t = t.split(['/', '?', '#']).next().unwrap_or(t);

    // [::1]:8080 or [::1]
    if let Some(rest) = t.strip_prefix('[') {
        if let Some(end) = rest.find(']') {
            return rest[..end].to_string();
        }
    }

    // host:port — only strip when what follows is entirely digits, so an
    // unbracketed IPv6 address is not mangled.
    if let Some(pos) = t.rfind(':') {
        let (h, p) = t.split_at(pos);
        let p = &p[1..];
        if !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()) && !h.contains(':') {
            return h.to_string();
        }
    }

    t.to_string()
}

pub fn classify_target(target: &str) -> TargetType {
    let t = target.trim().to_lowercase();
    if is_sandbox_target(&t) {
        return TargetType::Sandbox;
    }
    if t.parse::<std::net::IpAddr>().is_ok() {
        return TargetType::Ip;
    }
    if let Some((net, prefix)) = t.split_once('/') {
        let ip_ok = net.parse::<std::net::IpAddr>().is_ok();
        let prefix_ok = prefix.parse::<u32>().map(|p| p <= 128).unwrap_or(false);
        if ip_ok && prefix_ok {
            return TargetType::Subnet;
        }
    }
    if t.starts_with("http://") || t.starts_with("https://") {
        return TargetType::Url;
    }
    TargetType::Domain
}

/// Authorization gate. For sandbox/public targets, authorization is skipped
/// because these are known public/learning targets. For all other targets,
/// the user must confirm ownership/permission. Must run BEFORE any scan record
/// is created or job spawned. Persists the confirmation (upserted per org+target)
/// and writes a timestamped audit entry. Returns (authorization_id, statement, version).
pub async fn authorize_and_check(
    pool: &PgPool,
    org_id: &str,
    user_id: &str,
    target: &str,
    confirmation: Option<&AuthConfirmation>,
    headers: Option<&HeaderMap>,
) -> Result<(String, String, String), String> {
    let target = target.trim();
    let target_type = classify_target(target);

    // Sandbox/public targets bypass explicit authorization — they are known
    // safe targets for learning and demonstration.
    if target_type == TargetType::Sandbox {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now();
        let _ = sqlx::query(
            "INSERT INTO target_authorizations (id, organization_id, user_id, target, target_type, scope_statement, statement_version, confirmed_at, last_used_at)
             VALUES ($1, $2, $3, $4, 'sandbox', $5, $6, $7, $7) ON CONFLICT (organization_id, target) DO NOTHING",
        )
        .bind(&id)
        .bind(org_id)
        .bind(user_id)
        .bind(target)
        .bind(canonical_statement(target))
        .bind(SCOPE_STATEMENT_VERSION)
        .bind(now)
        .execute(pool)
        .await;

        // Fetch the actual authorization ID (either the one we just inserted or the existing one)
        let actual_id: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM target_authorizations WHERE organization_id = $1 AND target = $2"
        )
        .bind(org_id)
        .bind(target)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Authorization check failed: {}", e))?;

        let authz_id = actual_id.map(|(id,)| id).unwrap_or(id.clone());

        log_audit(
            pool,
            "target_authorization_sandbox",
            "target",
            "info",
            Some(user_id),
            Some(org_id),
            Some(serde_json::json!({
                "target": target,
                "target_type": "sandbox",
                "statement": canonical_statement(target),
                "statement_version": SCOPE_STATEMENT_VERSION,
                "confirmed": true,
                "sandbox_bypass": true,
            })),
            Some("target_authorization"),
            Some(&id),
            "success",
            headers,
        )
        .await;

        return Ok((authz_id, canonical_statement(target), SCOPE_STATEMENT_VERSION.to_string()));
    }

    let statement = canonical_statement(target);

    let confirmation = match confirmation {
        Some(c) => c,
        None => {
            return Err(
                "Target authorization required. Confirm that you own or have permission to test this target before starting a scan.".to_string(),
            );
        }
    };
    if !confirmation.confirmed {
        return Err(
            "Target authorization required: the ownership/permission confirmation must be checked.".to_string(),
        );
    }
    if confirmation.scope_statement.trim() != statement {
        return Err(
            "Target authorization statement does not match the current confirmation. Please refresh and re-confirm.".to_string(),
        );
    }

    let target_type = classify_target(target);
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now();

    let row: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM target_authorizations WHERE organization_id = $1 AND target = $2",
    )
    .bind(org_id)
    .bind(target)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Authorization check failed: {}", e))?;

    let authz_id = match row {
        Some((existing_id,)) => {
            sqlx::query(
                "UPDATE target_authorizations \
                 SET user_id = $1, scope_statement = $2, statement_version = $3, \
                     confirmed_at = $4, expires_at = NULL, revoked_at = NULL, last_used_at = $4 \
                 WHERE id = $5",
            )
            .bind(user_id)
            .bind(&statement)
            .bind(SCOPE_STATEMENT_VERSION)
            .bind(now)
            .bind(&existing_id)
            .execute(pool)
            .await
            .map_err(|e| format!("Authorization check failed: {}", e))?;
            existing_id
        }
        None => {
            sqlx::query(
                "INSERT INTO target_authorizations \
                 (id, organization_id, user_id, target, target_type, scope_statement, statement_version, confirmed_at, last_used_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)",
            )
            .bind(&id)
            .bind(org_id)
            .bind(user_id)
            .bind(target)
            .bind(target_type.as_str())
            .bind(&statement)
            .bind(SCOPE_STATEMENT_VERSION)
            .bind(now)
            .execute(pool)
            .await
            .map_err(|e| format!("Authorization check failed: {}", e))?;
            id
        }
    };

    log_audit(
        pool,
        "target_authorization",
        "target",
        "info",
        Some(user_id),
        Some(org_id),
        Some(json!({
            "target": target,
            "target_type": target_type.as_str(),
            "statement": statement,
            "statement_version": SCOPE_STATEMENT_VERSION,
            "confirmed": true,
        })),
        Some("target_authorization"),
        Some(&authz_id),
        "success",
        headers,
    )
    .await;

    Ok((authz_id, statement, SCOPE_STATEMENT_VERSION.to_string()))
}

/// Return the id of the currently-valid authorization for a target, or None.
/// Used by non-interactive launchers (scheduler) which cannot prompt the user.
pub async fn current_authorization_id(pool: &PgPool, org_id: &str, target: &str) -> Option<String> {
    sqlx::query_as(
        "SELECT id FROM target_authorizations \
         WHERE organization_id = $1 AND target = $2 AND revoked_at IS NULL \
           AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1",
    )
    .bind(org_id)
    .bind(target.trim())
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(id,): (String,)| id)
}

pub async fn list_authorizations(pool: &PgPool, org_id: &str) -> Result<Vec<JsonValue>, String> {
    let rows: Vec<(
        String,
        String,
        String,
        String,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT id, target, target_type, scope_statement, confirmed_at::text, revoked_at::text \
         FROM target_authorizations WHERE organization_id = $1 ORDER BY confirmed_at DESC",
    )
    .bind(org_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to load authorizations: {}", e))?;

    Ok(rows
        .into_iter()
        .map(|(id, target, target_type, statement, confirmed_at, revoked_at)| {
            json!({
                "id": id,
                "target": target,
                "target_type": target_type,
                "scope_statement": statement,
                "confirmed_at": confirmed_at,
                "revoked_at": revoked_at,
            })
        })
        .collect())
}

pub async fn revoke_authorization(
    pool: &PgPool,
    org_id: &str,
    user_id: &str,
    authz_id: &str,
) -> Result<(), String> {
    let res = sqlx::query(
        "UPDATE target_authorizations SET revoked_at = NOW() \
         WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL",
    )
    .bind(authz_id)
    .bind(org_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to revoke authorization: {}", e))?;

    if res.rows_affected() == 0 {
        return Err("Authorization not found or already revoked".to_string());
    }

    log_audit(
        pool,
        "target_authorization_revoked",
        "target",
        "warning",
        Some(user_id),
        Some(org_id),
        Some(json!({"authorization_id": authz_id})),
        Some("target_authorization"),
        Some(authz_id),
        "success",
        None,
    )
    .await;

    Ok(())
}

#[cfg(test)]
mod sandbox_tests {
    use super::*;

    // ── #11 the prefix bypass ─────────────────────────────────────────

    #[test]
    fn genuine_sandbox_targets_are_recognised() {
        for t in ["scanme.nmap.org", "example.com", "example.org",
                  "testphp.vulnweb.com", "localhost", "127.0.0.1", "0.0.0.0", "::1"] {
            assert!(is_sandbox_target(t), "{t} should be sandbox");
        }
    }

    #[test]
    fn lookalike_domains_are_not_sandbox() {
        // The whole point: `starts_with` let these through with no
        // ownership confirmation recorded.
        for t in ["example.com.attacker.net", "example.comevil.tld",
                  "localhost.evil.com", "scanme.nmap.org.attacker.net",
                  "example.org.co", "testphp.vulnweb.com.evil.net"] {
            assert!(!is_sandbox_target(t), "{t} must NOT be treated as sandbox");
        }
    }

    #[test]
    fn neighbouring_ips_are_not_sandbox() {
        // The old list contained bare private addresses (10.0.0.1, 192.168.1.1,
        // 172.16.0.1) and `starts_with` turned each into a whole /24 of free
        // scanning. Those are somebody's LAN, not a sandbox — they need an
        // ownership confirmation like any other host.
        for t in ["10.0.0.1", "10.0.0.100", "192.168.1.1", "192.168.1.100",
                  "192.168.1.10", "172.16.0.1", "172.16.0.100", "0.0.0.01"] {
            assert!(!is_sandbox_target(t), "{t} must NOT be treated as sandbox");
        }
    }

    #[test]
    fn the_whole_loopback_range_is_sandbox() {
        // 127.0.0.0/8 is this machine, so scanning it needs no third-party
        // authorization. Unlike the old prefix match, this is a real numeric
        // range check rather than a string coincidence.
        for t in ["127.0.0.1", "127.0.0.10", "127.0.0.15", "127.1.2.3"] {
            assert!(is_sandbox_target(t), "{t} is loopback and should be sandbox");
        }
    }

    #[test]
    fn all_loopback_addresses_are_sandbox() {
        for t in ["127.0.0.1", "127.1.2.3", "::1"] {
            assert!(is_sandbox_target(t), "{t} is loopback and should be sandbox");
        }
    }

    #[test]
    fn real_subdomains_of_sandbox_domains_are_allowed() {
        for t in ["www.example.com", "a.b.example.org", "sub.scanme.nmap.org"] {
            assert!(is_sandbox_target(t), "{t} is a true subdomain and should be sandbox");
        }
    }

    #[test]
    fn urls_and_ports_resolve_to_the_same_verdict() {
        assert!(is_sandbox_target("http://example.com"));
        assert!(is_sandbox_target("https://example.com:8443/path?q=1"));
        assert!(is_sandbox_target("http://user:pw@example.com/x"));
        assert!(is_sandbox_target("http://127.0.0.1:5001/health"));
        assert!(is_sandbox_target("[::1]:8080"));
        // …and the bypasses stay closed through a URL too.
        assert!(!is_sandbox_target("http://example.com.attacker.net/"));
        assert!(!is_sandbox_target("https://localhost.evil.com:443/"));
    }

    #[test]
    fn empty_and_junk_targets_are_not_sandbox() {
        for t in ["", "   ", "://", "@", "..."] {
            assert!(!is_sandbox_target(t), "{t:?} must not be sandbox");
        }
    }

    #[test]
    fn case_and_whitespace_do_not_change_the_verdict() {
        assert!(is_sandbox_target("  EXAMPLE.COM  "));
        assert!(!is_sandbox_target("  EXAMPLE.COM.ATTACKER.NET  "));
    }

    #[test]
    fn a_real_customer_domain_still_needs_authorization() {
        for t in ["cyber-sec-pro.com", "google.com", "8.8.8.8", "203.0.113.7"] {
            assert!(!is_sandbox_target(t), "{t} must require explicit authorization");
        }
    }

    // ── extract_host ──────────────────────────────────────────────────

    #[test]
    fn extract_host_strips_every_url_part() {
        assert_eq!(extract_host("https://user:pw@example.com:8443/p?q=1#f"), "example.com");
        assert_eq!(extract_host("example.com"), "example.com");
        assert_eq!(extract_host("[2001:db8::1]:443"), "2001:db8::1");
        assert_eq!(extract_host("2001:db8::1"), "2001:db8::1");
        assert_eq!(extract_host("10.0.0.5:22"), "10.0.0.5");
    }
}
