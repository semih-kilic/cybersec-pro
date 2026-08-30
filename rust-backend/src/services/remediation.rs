//! Remediation knowledge base — "how do I fix this?" for scan findings.
//!
//! The reports showed *what* was found but never *how to fix it*. This maps a
//! finding to concrete guidance: what it means, why it matters, and the steps
//! to remediate — deterministic, offline, and auditable. When nothing here
//! matches, the caller may fall back to the LLM (and mark the result as
//! AI-generated); this KB is the primary, trusted source.

use serde::Serialize;

/// Remediation guidance for one finding.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Remediation {
    /// One-line statement of the problem in plain language.
    pub summary: String,
    /// Why it matters — the risk if left unfixed.
    pub impact: String,
    /// Ordered, concrete steps to fix it.
    pub steps: Vec<String>,
    /// References (CIS, OWASP, vendor docs) — never fabricated URLs.
    pub references: Vec<String>,
    /// Where this guidance came from, for report provenance.
    pub source: RemediationSource,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RemediationSource {
    /// Matched a curated rule in this knowledge base.
    KnowledgeBase,
    /// Produced by the LLM because no rule matched.
    AiGenerated,
}

/// A finding, reduced to what remediation lookup needs.
pub struct FindingContext<'a> {
    pub title: &'a str,
    pub severity: &'a str,
    pub cve: Option<&'a str>,
    pub port: Option<u16>,
    pub service: Option<&'a str>,
}

/// Resolve remediation for a finding from the knowledge base.
///
/// Returns `None` only when nothing matches — the caller decides whether to
/// invoke the LLM fallback.
pub fn lookup(ctx: &FindingContext) -> Option<Remediation> {
    let hay = format!(
        "{} {} {}",
        ctx.title.to_lowercase(),
        ctx.service.unwrap_or("").to_lowercase(),
        ctx.cve.unwrap_or("")
    );

    // Order matters: most specific first.
    for rule in RULES {
        if (rule.matches)(&hay, ctx) {
            return Some((rule.build)());
        }
    }
    None
}

struct Rule {
    matches: fn(&str, &FindingContext) -> bool,
    build: fn() -> Remediation,
}

fn r(summary: &str, impact: &str, steps: &[&str], refs: &[&str]) -> Remediation {
    Remediation {
        summary: summary.to_string(),
        impact: impact.to_string(),
        steps: steps.iter().map(|s| s.to_string()).collect(),
        references: refs.iter().map(|s| s.to_string()).collect(),
        source: RemediationSource::KnowledgeBase,
    }
}

static RULES: &[Rule] = &[
    // ── Plaintext / weak transport ───────────────────────────────────
    Rule {
        matches: |h, c| c.port == Some(23) || h.contains("telnet"),
        build: || r(
            "Telnet is exposed and transmits credentials in cleartext",
            "Anyone on the network path can capture the login and session, taking full control of the device.",
            &["Disable the Telnet service.",
              "Enable SSH instead and restrict it to known management IPs.",
              "If a device only supports Telnet, place it behind a VPN or management VLAN."],
            &["CIS Controls v8 4.1", "NIST SP 800-52r2"]),
    },
    Rule {
        matches: |h, c| c.port == Some(21) || h.contains("ftp") && !h.contains("sftp"),
        build: || r(
            "FTP is exposed and transmits credentials and data in cleartext",
            "Credentials and transferred files can be intercepted; anonymous FTP may expose files directly.",
            &["Replace FTP with SFTP (over SSH) or FTPS (over TLS).",
              "Disable anonymous access if it is not required.",
              "Restrict access to trusted source addresses."],
            &["OWASP Transport Layer Protection Cheat Sheet"]),
    },
    // ── TLS / SSL ────────────────────────────────────────────────────
    Rule {
        matches: |h, _| h.contains("sslv3") || h.contains("sslv2") || h.contains("poodle"),
        build: || r(
            "An obsolete SSL protocol (SSLv2/SSLv3) is enabled",
            "SSLv3 is broken (POODLE); an attacker can decrypt session data.",
            &["Disable SSLv2 and SSLv3 on the server.",
              "Enable only TLS 1.2 and TLS 1.3.",
              "Re-test with an SSL scanner to confirm the weak protocols are gone."],
            &["RFC 7568 (SSLv3 deprecation)", "Mozilla Server Side TLS"]),
    },
    Rule {
        matches: |h, _| (h.contains("tls 1.0") || h.contains("tlsv1.0") || h.contains("tls 1.1") || h.contains("tlsv1.1")),
        build: || r(
            "A deprecated TLS version (1.0/1.1) is enabled",
            "TLS 1.0/1.1 have known weaknesses and fail PCI-DSS and modern compliance baselines.",
            &["Disable TLS 1.0 and TLS 1.1.",
              "Enable TLS 1.2 and TLS 1.3 only.",
              "Update cipher suites to remove RC4, 3DES and CBC-only suites."],
            &["PCI-DSS v4.0 4.2.1", "Mozilla Server Side TLS"]),
    },
    Rule {
        matches: |h, _| h.contains("expired") && (h.contains("cert") || h.contains("certificate")),
        build: || r(
            "The TLS certificate has expired",
            "Clients see security warnings and may refuse to connect; trust in the service is broken.",
            &["Renew the certificate with your CA (or Let's Encrypt).",
              "Install the full chain, not just the leaf certificate.",
              "Automate renewal so this does not recur (e.g. certbot, ACME)."],
            &["CA/Browser Forum Baseline Requirements"]),
    },
    Rule {
        matches: |h, _| h.contains("self-signed") || h.contains("self signed"),
        build: || r(
            "The TLS certificate is self-signed",
            "Clients cannot verify the server's identity, which enables man-in-the-middle attacks.",
            &["Replace the self-signed certificate with one from a trusted CA.",
              "For internal services, distribute your internal CA to clients instead of self-signing per host."],
            &["NIST SP 800-52r2"]),
    },
    // ── HTTP security headers ────────────────────────────────────────
    Rule {
        matches: |h, _| h.contains("x-frame-options") || h.contains("clickjack"),
        build: || r(
            "The X-Frame-Options / frame-ancestors protection is missing",
            "The page can be framed by a malicious site and used for clickjacking.",
            &["Send `Content-Security-Policy: frame-ancestors 'none'` (or a trusted origin).",
              "For older clients, also send `X-Frame-Options: DENY`."],
            &["OWASP Clickjacking Defense Cheat Sheet"]),
    },
    Rule {
        matches: |h, _| h.contains("strict-transport-security") || h.contains("hsts"),
        build: || r(
            "HTTP Strict Transport Security (HSTS) is not set",
            "Users can be downgraded to plaintext HTTP by an on-path attacker before the redirect to HTTPS.",
            &["Send `Strict-Transport-Security: max-age=31536000; includeSubDomains`.",
              "Only enable after confirming every subdomain serves HTTPS.",
              "Consider HSTS preloading once stable."],
            &["OWASP HSTS Cheat Sheet"]),
    },
    Rule {
        matches: |h, _| h.contains("content-security-policy") && !h.contains("frame-ancestors"),
        build: || r(
            "No Content-Security-Policy is set",
            "Without a CSP, an injected script runs with full page privileges — the main defence against XSS is absent.",
            &["Define a CSP starting from `default-src 'self'`.",
              "Remove inline scripts or allow them with a nonce/hash rather than 'unsafe-inline'.",
              "Deploy in report-only mode first to find violations before enforcing."],
            &["OWASP Content Security Policy Cheat Sheet"]),
    },
    // ── Databases / management exposed ───────────────────────────────
    Rule {
        matches: |h, c| matches!(c.port, Some(3306)|Some(5432)|Some(27017)|Some(6379)|Some(9200)|Some(1433))
                        || h.contains("mysql") || h.contains("postgres") || h.contains("mongodb")
                        || h.contains("redis") || h.contains("elasticsearch"),
        build: || r(
            "A database service is reachable from the scanned network",
            "Databases exposed beyond the application tier are a primary breach vector, especially if unauthenticated.",
            &["Bind the database to localhost or the application subnet only.",
              "Enforce authentication and a strong password.",
              "Put it behind a firewall rule allowing only the application servers.",
              "For Redis/Elasticsearch/MongoDB, verify auth is enabled — several ship open by default."],
            &["CIS Controls v8 4.4", "OWASP Top 10 A05 Security Misconfiguration"]),
    },
    Rule {
        matches: |h, c| c.port == Some(3389) || h.contains("rdp") || h.contains("ms-wbt-server"),
        build: || r(
            "Remote Desktop (RDP) is exposed",
            "RDP is heavily targeted by brute-force and exploit campaigns (e.g. BlueKeep) and is a common ransomware entry point.",
            &["Do not expose RDP to the internet — require a VPN.",
              "Enable Network Level Authentication.",
              "Enforce account lockout and MFA.",
              "Keep the host patched against known RDP CVEs."],
            &["CISA guidance on RDP", "CIS Controls v8 4.6"]),
    },
    Rule {
        matches: |h, c| c.port == Some(445) || h.contains("smb") || h.contains("netbios"),
        build: || r(
            "SMB file sharing is reachable",
            "SMB has a history of wormable vulnerabilities (EternalBlue) and often exposes shares or allows null sessions.",
            &["Block SMB (445/139) at the network perimeter.",
              "Disable SMBv1 entirely.",
              "Require authentication and remove anonymous/guest share access.",
              "Patch against known SMB CVEs."],
            &["CISA: Disable SMBv1", "CIS Controls v8 4.8"]),
    },
];

/// A generic remediation keyed only on severity, for findings with no specific
/// rule. Never returns `None`, so a report always has *something* actionable.
pub fn generic_by_severity(severity: &str) -> Remediation {
    match severity.to_lowercase().as_str() {
        "critical" | "high" => r(
            "A high-severity issue was reported that needs manual review",
            "High-severity findings can lead to compromise; treat as a priority.",
            &["Confirm the finding is not a false positive against the affected host.",
              "Identify the responsible software and apply the latest security update.",
              "If no patch exists, restrict access to the service and monitor it.",
              "Re-scan to confirm the issue is resolved."],
            &["OWASP Testing Guide"]),
        _ => r(
            "An issue was reported for review",
            "Lower-severity findings still reduce your attack surface when addressed.",
            &["Review the finding against the affected host.",
              "Apply configuration hardening or updates as appropriate.",
              "Re-scan to confirm."],
            &["CIS Benchmarks"]),
    }
}

/// Enrich a scan's `findings` array in place, adding a `remediation` object to
/// each finding that lacks one. Used by report generation so every listed
/// finding carries "how to fix it" — the reports showed what was found but
/// never how to remediate it.
///
/// `allow_ai` controls whether unmatched findings get a generic KB answer only
/// (false) or may be sent to the LLM by the caller (true — the caller does the
/// async LLM call; this function only tags what needs it).
pub fn enrich_findings(findings: &mut serde_json::Value) -> usize {
    let arr = match findings.as_array_mut() {
        Some(a) => a,
        None => {
            // Findings often arrive as { summary, findings: [...] }.
            if let Some(inner) = findings.get_mut("findings").and_then(|f| f.as_array_mut()) {
                return enrich_array(inner);
            }
            return 0;
        }
    };
    enrich_array(arr)
}

fn enrich_array(arr: &mut [serde_json::Value]) -> usize {
    let mut n = 0;
    for f in arr.iter_mut() {
        if f.get("remediation").is_some() { continue; }
        let title = f.get("title").and_then(|v| v.as_str())
            .or_else(|| f.get("description").and_then(|v| v.as_str()))
            .or_else(|| f.get("name").and_then(|v| v.as_str()))
            .unwrap_or("");
        let severity = f.get("severity").and_then(|v| v.as_str()).unwrap_or("medium");
        let cve = f.get("cve").and_then(|v| v.as_str());
        let service = f.get("service").and_then(|v| v.as_str());
        let port = f.get("port").and_then(|v| v.as_u64()).map(|p| p as u16);

        let ctx = FindingContext { title, severity, cve, port, service };
        let rem = lookup(&ctx).unwrap_or_else(|| generic_by_severity(severity));

        f["remediation"] = serde_json::json!({
            "summary": rem.summary,
            "impact": rem.impact,
            "steps": rem.steps,
            "references": rem.references,
            "source": match rem.source {
                RemediationSource::KnowledgeBase => "knowledge_base",
                RemediationSource::AiGenerated => "ai_generated",
            }
        });
        n += 1;
    }
    n
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx<'a>(title: &'a str, port: Option<u16>, service: Option<&'a str>) -> FindingContext<'a> {
        FindingContext { title, severity: "medium", cve: None, port, service }
    }

    #[test]
    fn telnet_is_matched_by_port_and_by_name() {
        assert!(lookup(&ctx("open port", Some(23), None)).is_some());
        let by_name = lookup(&ctx("Telnet service detected", None, Some("telnet"))).unwrap();
        assert!(by_name.summary.to_lowercase().contains("telnet"));
        assert_eq!(by_name.source, RemediationSource::KnowledgeBase);
        assert!(!by_name.steps.is_empty());
    }

    #[test]
    fn databases_are_matched() {
        for (port, svc) in [(3306,"mysql"),(5432,"postgres"),(27017,"mongodb"),(6379,"redis")] {
            assert!(lookup(&ctx("service", Some(port), Some(svc))).is_some(), "{svc} not matched");
        }
    }

    #[test]
    fn obsolete_tls_is_matched() {
        assert!(lookup(&ctx("SSLv3 supported (POODLE)", None, None)).is_some());
        assert!(lookup(&ctx("Server accepts TLS 1.0 connections", None, None)).is_some());
    }

    #[test]
    fn missing_security_headers_are_matched() {
        assert!(lookup(&ctx("Missing Strict-Transport-Security header", None, None)).is_some());
        assert!(lookup(&ctx("X-Frame-Options not set", None, None)).is_some());
    }

    #[test]
    fn rdp_and_smb_are_matched() {
        assert!(lookup(&ctx("port open", Some(3389), None)).is_some());
        assert!(lookup(&ctx("port open", Some(445), None)).is_some());
    }

    #[test]
    fn unknown_findings_return_none_from_lookup() {
        assert!(lookup(&ctx("something entirely novel", Some(12345), Some("weird"))).is_none());
    }

    #[test]
    fn generic_fallback_always_gives_steps() {
        for sev in ["critical","high","medium","low","info"] {
            let g = generic_by_severity(sev);
            assert!(!g.steps.is_empty(), "{sev} produced no steps");
            assert_eq!(g.source, RemediationSource::KnowledgeBase);
        }
    }

    #[test]
    fn enrich_findings_adds_remediation_to_each() {
        let mut findings = serde_json::json!([
            {"title":"Telnet detected","severity":"high","port":23},
            {"title":"Some novel thing","severity":"low"}
        ]);
        let n = enrich_findings(&mut findings);
        assert_eq!(n, 2);
        for f in findings.as_array().unwrap() {
            let rem = &f["remediation"];
            assert!(rem["steps"].as_array().map(|a| !a.is_empty()).unwrap_or(false));
            assert!(rem["source"].is_string());
        }
        // Telnet matched a rule; the novel one fell back to generic.
        assert_eq!(findings[0]["remediation"]["source"], "knowledge_base");
    }

    #[test]
    fn enrich_findings_handles_wrapped_shape() {
        let mut wrapped = serde_json::json!({"summary":{"total":1},"findings":[{"title":"FTP","port":21}]});
        assert_eq!(enrich_findings(&mut wrapped), 1);
        assert!(wrapped["findings"][0]["remediation"]["steps"].as_array().unwrap().len() > 0);
    }

    #[test]
    fn enrich_findings_is_idempotent() {
        let mut findings = serde_json::json!([{"title":"Telnet","port":23}]);
        assert_eq!(enrich_findings(&mut findings), 1);
        assert_eq!(enrich_findings(&mut findings), 0, "already-enriched findings are skipped");
    }

    #[test]
    fn every_rule_produces_non_empty_guidance() {
        // Exercise each rule's builder directly.
        for rule in RULES {
            let rem = (rule.build)();
            assert!(!rem.summary.is_empty());
            assert!(!rem.impact.is_empty());
            assert!(!rem.steps.is_empty());
            assert!(!rem.references.is_empty(), "guidance must cite a reference");
        }
    }
}
