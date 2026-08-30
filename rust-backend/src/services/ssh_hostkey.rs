//! SSH host-key pinning for agent connections.
//!
//! AUDIT 2026-08-29 — `agents.ssh_fingerprint` is read by the executor and
//! refused when absent, but NOTHING in the codebase ever writes it. It is NULL
//! on every row, so remote execution over SSH always failed with "Agent has no
//! stored SSH fingerprint. Re-register the agent" — and re-registering did not
//! store one either, because no code path exists to do so.
//!
//! Even had it been populated, the executor wrote it into known_hosts as
//! `[host]:port <fingerprint>`. A known_hosts line is `<host> <keytype>
//! <base64-key>`; a fingerprint is a digest OF that key and can never appear
//! there. OpenSSH would have rejected the file.
//!
//! The fix is to pin the host's actual public key, captured on first contact,
//! and write a genuine known_hosts line from it.

use anyhow::{anyhow, Result};

/// A pinned SSH host key: the algorithm and the base64 key material.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostKey {
    pub key_type: String,
    pub key_b64: String,
}

impl HostKey {
    /// Render as a known_hosts entry for the given host and port.
    ///
    /// OpenSSH brackets the host whenever a non-default port is used, and the
    /// bracketed form is also accepted for port 22, so it is always used here.
    pub fn known_hosts_line(&self, host: &str, port: i32) -> String {
        format!("[{}]:{} {} {}\n", host, port, self.key_type, self.key_b64)
    }

    /// The value stored in the database: exactly what ssh-keyscan emits
    /// after the host column.
    pub fn to_stored(&self) -> String {
        format!("{} {}", self.key_type, self.key_b64)
    }
}

/// Parse a stored `"<keytype> <base64>"` value.
pub fn parse_stored(stored: &str) -> Option<HostKey> {
    let mut parts = stored.split_whitespace();
    let key_type = parts.next()?.to_string();
    let key_b64 = parts.next()?.to_string();
    if !key_type.starts_with("ssh-") && !key_type.starts_with("ecdsa-") {
        return None;
    }
    if key_b64.len() < 20 {
        return None;
    }
    Some(HostKey { key_type, key_b64 })
}

/// Pick the strongest key from ssh-keyscan output.
///
/// ssh-keyscan prints one line per algorithm the host offers. Ed25519 is
/// preferred, then ECDSA, then RSA — matching OpenSSH's own default order.
pub fn best_from_keyscan(output: &str) -> Option<HostKey> {
    let mut candidates: Vec<HostKey> = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        // "<host> <keytype> <base64>"
        let mut p = line.split_whitespace();
        let _host = p.next();
        let key_type = match p.next() {
            Some(t) => t.to_string(),
            None => continue,
        };
        let key_b64 = match p.next() {
            Some(k) => k.to_string(),
            None => continue,
        };
        if key_b64.len() < 20 {
            continue;
        }
        candidates.push(HostKey { key_type, key_b64 });
    }

    let rank = |t: &str| match t {
        "ssh-ed25519" => 0,
        t if t.starts_with("ecdsa-") => 1,
        "ssh-rsa" => 2,
        _ => 3,
    };
    candidates.sort_by_key(|k| rank(&k.key_type));
    candidates.into_iter().next()
}

/// Fetch a host's public key with `ssh-keyscan`.
///
/// This is trust-on-first-use: whatever the host presents now is pinned, and
/// every later connection must match it. That is the same guarantee a human
/// gets when accepting a fingerprint once, and strictly better than the
/// previous behaviour, which could not connect at all.
pub async fn scan_host_key(host: &str, port: i32) -> Result<HostKey> {
    if host.trim().is_empty() {
        return Err(anyhow!("empty host"));
    }
    let out = tokio::process::Command::new("ssh-keyscan")
        .arg("-T")
        .arg("10")
        .arg("-p")
        .arg(port.to_string())
        .arg(host)
        .output()
        .await
        .map_err(|e| anyhow!("ssh-keyscan failed to run: {e}"))?;

    let text = String::from_utf8_lossy(&out.stdout);
    best_from_keyscan(&text)
        .ok_or_else(|| anyhow!("no usable host key returned by ssh-keyscan for {host}:{port}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    const ED: &str = "AAAAC3NzaC1lZDI1NTE5AAAAIExampleKeyMaterialHere0123456789abcdef";
    const RSA: &str = "AAAAB3NzaC1yc2EAAAADAQABAAABgQExampleRsaKeyMaterial0123456789xyz";

    #[test]
    fn known_hosts_line_has_the_shape_openssh_expects() {
        let k = HostKey { key_type: "ssh-ed25519".into(), key_b64: ED.into() };
        let line = k.known_hosts_line("10.0.0.5", 22);
        assert_eq!(line, format!("[10.0.0.5]:22 ssh-ed25519 {ED}\n"));
        // Three fields, which is what a known_hosts parser requires — the old
        // code wrote only two ("[host]:port <fingerprint>").
        assert_eq!(line.trim().split_whitespace().count(), 3);
    }

    #[test]
    fn known_hosts_line_brackets_non_default_ports() {
        let k = HostKey { key_type: "ssh-rsa".into(), key_b64: RSA.into() };
        assert!(k.known_hosts_line("host.example", 2222).starts_with("[host.example]:2222 "));
    }

    #[test]
    fn a_fingerprint_is_not_a_valid_stored_key() {
        // What the old code would have written, had anything written it.
        assert!(parse_stored("SHA256:abcdef0123456789abcdef0123456789abcdef01").is_none());
    }

    #[test]
    fn parse_stored_round_trips() {
        let k = HostKey { key_type: "ssh-ed25519".into(), key_b64: ED.into() };
        assert_eq!(parse_stored(&k.to_stored()), Some(k));
    }

    #[test]
    fn parse_stored_rejects_junk() {
        for bad in ["", "ssh-ed25519", "notakeytype AAAAB3Nz...", "ssh-rsa short"] {
            assert!(parse_stored(bad).is_none(), "{bad:?} must not parse");
        }
    }

    #[test]
    fn keyscan_prefers_ed25519_over_rsa() {
        let out = format!(
            "# host SSH-2.0\n\
             host.example ssh-rsa {RSA}\n\
             host.example ssh-ed25519 {ED}\n"
        );
        assert_eq!(best_from_keyscan(&out).unwrap().key_type, "ssh-ed25519");
    }

    #[test]
    fn keyscan_falls_back_through_the_preference_order() {
        let ecdsa = format!("h ecdsa-sha2-nistp256 {RSA}");
        assert_eq!(best_from_keyscan(&ecdsa).unwrap().key_type, "ecdsa-sha2-nistp256");
        let rsa_only = format!("h ssh-rsa {RSA}");
        assert_eq!(best_from_keyscan(&rsa_only).unwrap().key_type, "ssh-rsa");
    }

    #[test]
    fn keyscan_ignores_comments_and_blank_lines() {
        let out = format!("# comment\n\n   \nhost ssh-ed25519 {ED}\n");
        assert_eq!(best_from_keyscan(&out).unwrap().key_b64, ED);
    }

    #[test]
    fn keyscan_returns_none_for_empty_or_malformed_output() {
        assert!(best_from_keyscan("").is_none());
        assert!(best_from_keyscan("# only a comment").is_none());
        assert!(best_from_keyscan("host ssh-ed25519").is_none(), "missing key material");
        assert!(best_from_keyscan("host ssh-ed25519 tooshort").is_none());
    }
}
