//! Client network identity helpers.
//!
//! AUDIT 2026-08-28 — the codebase read `X-Forwarded-For` three different ways
//! and two of them were attacker-controlled:
//!
//! | call site               | old code                  | effect                        |
//! |------------------------|---------------------------|-------------------------------|
//! | `login`                | whole header string       | rate-limit bucket per request |
//! | `register`             | `.split(',').last()`      | correct                       |
//! | `record_login_history` | `.split(',').next()`      | spoofed IP in the audit trail |
//!
//! Our edge (`nginx.conf`) proxies with `X-Forwarded-For $proxy_add_x_forwarded_for`,
//! which **appends** the real peer address to whatever the client already sent.
//! So the last element is the only one nginx itself wrote — every earlier
//! element is client-supplied and must never be trusted.

use axum::http::HeaderMap;

/// The client address as recorded by our own reverse proxy.
///
/// Returns `None` when no trusted header is present, so callers can decide
/// whether to fall back or to skip an IP-scoped check entirely.
pub fn client_ip(headers: &HeaderMap) -> Option<String> {
    if let Some(xff) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        // Trust ONLY the last hop: nginx appends the real peer address there.
        if let Some(last) = xff.rsplit(',').next() {
            let ip = last.trim();
            if !ip.is_empty() {
                return Some(ip.to_string());
            }
        }
    }
    headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Same as [`client_ip`] but yields a stable placeholder instead of `None`,
/// for contexts (rate-limit keys, log rows) that need a value.
pub fn client_ip_or_unknown(headers: &HeaderMap) -> String {
    client_ip(headers).unwrap_or_else(|| "unknown".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn hdrs(pairs: &[(&'static str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(*k, HeaderValue::from_str(v).unwrap());
        }
        h
    }

    #[test]
    fn client_ip_returns_none_without_headers() {
        assert_eq!(client_ip(&HeaderMap::new()), None);
        assert_eq!(client_ip_or_unknown(&HeaderMap::new()), "unknown");
    }

    #[test]
    fn client_ip_reads_single_value() {
        assert_eq!(
            client_ip(&hdrs(&[("x-forwarded-for", "203.0.113.7")])).as_deref(),
            Some("203.0.113.7")
        );
    }

    #[test]
    fn client_ip_takes_the_last_hop_not_the_first() {
        // nginx appends the real peer; everything before it is client-supplied.
        let h = hdrs(&[("x-forwarded-for", "1.2.3.4, 5.6.7.8, 203.0.113.7")]);
        assert_eq!(client_ip(&h).as_deref(), Some("203.0.113.7"));
    }

    #[test]
    fn client_ip_ignores_spoofed_prefix() {
        // An attacker sending `X-Forwarded-For: 9.9.9.9` cannot control the result.
        let spoofed = hdrs(&[("x-forwarded-for", "9.9.9.9, 198.51.100.42")]);
        assert_eq!(client_ip(&spoofed).as_deref(), Some("198.51.100.42"));
        assert_ne!(client_ip(&spoofed).as_deref(), Some("9.9.9.9"));
    }

    #[test]
    fn client_ip_is_stable_across_spoofed_variations() {
        // Regression for the rate-limit bypass: the same real client must map to
        // the same key no matter what it puts in front of the header.
        let a = client_ip(&hdrs(&[("x-forwarded-for", "aaa, 198.51.100.42")]));
        let b = client_ip(&hdrs(&[("x-forwarded-for", "bbb, 198.51.100.42")]));
        let c = client_ip(&hdrs(&[("x-forwarded-for", "x, y, z, 198.51.100.42")]));
        assert_eq!(a, b);
        assert_eq!(b, c);
    }

    #[test]
    fn client_ip_trims_whitespace() {
        let h = hdrs(&[("x-forwarded-for", "1.2.3.4,   203.0.113.7   ")]);
        assert_eq!(client_ip(&h).as_deref(), Some("203.0.113.7"));
    }

    #[test]
    fn client_ip_falls_back_to_x_real_ip() {
        let h = hdrs(&[("x-real-ip", "198.51.100.9")]);
        assert_eq!(client_ip(&h).as_deref(), Some("198.51.100.9"));
    }

    #[test]
    fn client_ip_prefers_forwarded_for_over_real_ip() {
        let h = hdrs(&[("x-forwarded-for", "203.0.113.7"), ("x-real-ip", "198.51.100.9")]);
        assert_eq!(client_ip(&h).as_deref(), Some("203.0.113.7"));
    }

    #[test]
    fn client_ip_skips_empty_forwarded_for() {
        let h = hdrs(&[("x-forwarded-for", "   "), ("x-real-ip", "198.51.100.9")]);
        assert_eq!(client_ip(&h).as_deref(), Some("198.51.100.9"));
    }
}
