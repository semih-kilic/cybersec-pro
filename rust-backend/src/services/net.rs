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

// ── Safe truncation ────────────────────────────────────────────────────

/// Truncate `s` to at most `max_bytes`, never splitting a UTF-8 character.
///
/// PANIC FIX: several call sites did `&s[..N]`. Slicing a `String` by byte
/// index panics when the boundary falls inside a multi-byte character, and
/// every one of those sites was fed attacker-influenced text — scan output, a
/// JSON body, a threat-intel indicator. A request containing one emoji at the
/// wrong offset was enough to take the handler down.
pub fn truncate_bytes(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    // Walk back to the nearest character boundary at or below max_bytes.
    let mut end = max_bytes;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

/// [`truncate_bytes`] plus a marker, for text shown to a human.
pub fn truncate_with_notice(s: &str, max_bytes: usize, notice: &str) -> String {
    if s.len() <= max_bytes {
        return s.to_string();
    }
    format!("{}{}", truncate_bytes(s, max_bytes), notice)
}

#[cfg(test)]
mod truncate_tests {
    use super::*;

    #[test]
    fn short_strings_pass_through() {
        assert_eq!(truncate_bytes("hello", 100), "hello");
        assert_eq!(truncate_bytes("", 10), "");
    }

    #[test]
    fn ascii_truncates_exactly() {
        assert_eq!(truncate_bytes("abcdefgh", 3), "abc");
    }

    #[test]
    fn never_panics_on_a_multibyte_boundary() {
        // "é" is 2 bytes; cutting at 1 byte would panic with `&s[..1]`.
        let s = "é".repeat(50);
        for n in 0..s.len() {
            let out = truncate_bytes(&s, n);
            assert!(out.len() <= n);
            assert!(std::str::from_utf8(out.as_bytes()).is_ok());
        }
    }

    #[test]
    fn never_panics_on_emoji() {
        // 4-byte characters are the worst case.
        let s = "🔥".repeat(30);
        for n in 0..s.len() {
            let out = truncate_bytes(&s, n);
            assert!(out.len() <= n);
            assert!(out.chars().all(|c| c == '🔥'));
        }
    }

    #[test]
    fn handles_mixed_scripts() {
        let s = "abcтест日本語🔥done";
        for n in 0..=s.len() {
            let _ = truncate_bytes(s, n); // must not panic
        }
        assert_eq!(truncate_bytes(s, 3), "abc");
    }

    #[test]
    fn truncate_with_notice_only_marks_when_it_cut() {
        assert_eq!(truncate_with_notice("hi", 10, "…"), "hi");
        assert_eq!(truncate_with_notice("abcdef", 3, "…"), "abc…");
    }

    #[test]
    fn truncate_with_notice_is_panic_free_on_multibyte() {
        let s = "日本語".repeat(20);
        for n in 0..s.len() {
            let _ = truncate_with_notice(&s, n, "…(truncated)");
        }
    }
}
