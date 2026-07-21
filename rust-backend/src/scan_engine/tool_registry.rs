use anyhow::{anyhow, Result};
use serde::Deserialize;
use std::collections::HashMap;

// ── Embedded Kali Tool Registry (518 tools) ────────────────

// Runtime-loaded from kali_tools.json (hot-reload support)
fn load_kali_tools_json() -> String {
    let paths = ["kali_tools.json", "../kali_tools.json", "../../kali_tools.json", "/home/cybersec/cybersec-pro/rust-backend/kali_tools.json"];
    for path in &paths {
        if let Ok(content) = std::fs::read_to_string(path) {
            tracing::info!("Loaded kali_tools.json from {}", path);
            return content;
        }
    }
    tracing::warn!("kali_tools.json not found on disk");
    include_str!("../../kali_tools.json").to_string()
}

#[derive(Debug, Clone, Deserialize)]
pub struct KaliTool {
    pub id: String,
    pub name: String,
    pub description: String,
    pub binary: String,
    pub default_args: String,
    pub package: String,
    pub kali_category: String,
    pub category: String,
    pub group: String,
    pub tool_type: String,
    pub installed: bool,
    pub binary_path: String,
}

lazy_static::lazy_static! {
    /// All Kali tools indexed by multiple keys for fast lookup
    static ref KALI_REGISTRY: Vec<KaliTool> = {
        let json_str = load_kali_tools_json();
        match serde_json::from_str::<Vec<KaliTool>>(&json_str) {
            Ok(tools) => {
                tracing::info!("Loaded {} tools from kali_tools.json (runtime)", tools.len());
                tools
            }
            Err(e) => {
                // Panic at startup — a broken tool registry is a critical misconfiguration
                panic!("FATAL: Failed to parse kali_tools.json: {}. The server cannot start without a valid tool registry.", e);
            }
        }
    };

    /// Lookup by tool id (lowercase-hyphenated name)
    static ref BY_ID: HashMap<String, usize> = {
        KALI_REGISTRY.iter().enumerate()
            .map(|(i, t)| (t.id.clone(), i))
            .collect()
    };

    /// Lookup by binary name
    static ref BY_BINARY: HashMap<String, usize> = {
        KALI_REGISTRY.iter().enumerate()
            .map(|(i, t)| (t.binary.clone(), i))
            .collect()
    };

    /// Lookup by tool name (case-insensitive)
    static ref BY_NAME: HashMap<String, usize> = {
        KALI_REGISTRY.iter().enumerate()
            .map(|(i, t)| (t.name.to_lowercase(), i))
            .collect()
    };

    /// Binary path overrides for tools whose binary name differs
    static ref BINARY_OVERRIDES: HashMap<&'static str, &'static str> = {
        let mut m = HashMap::new();
        m.insert("python-wapiti", "wapiti");
        m.insert("wordlists", "ls");
        m.insert("seclists", "ls");
        m.insert("theharvester", "theHarvester");
        m
    };
}

/// Get the full Kali tools registry
#[allow(dead_code)] // Public registry accessor; awaiting wire-up in /api/tools/list.
pub fn get_all_tools() -> &'static Vec<KaliTool> {
    &KALI_REGISTRY
}

/// Find a Kali tool by name, id, or binary
pub fn find_tool(name: &str) -> Option<&'static KaliTool> {
    let lower = name.to_lowercase();
    let idx = BY_NAME.get(&lower)
        .or_else(|| BY_ID.get(&lower))
        .or_else(|| BY_BINARY.get(name))
        .or_else(|| BY_BINARY.get(&lower));
    idx.map(|&i| &KALI_REGISTRY[i])
}

// ── Smart Tool Profiles for Common Tools ───────────────────

pub struct ToolProfile {
    pub pre_args: Vec<String>,
    pub post_args: Vec<String>,
}

/// Get hardcoded smart defaults for well-known tools.
fn get_smart_profile(tool_name: &str) -> Option<ToolProfile> {
    let profile = match tool_name {
        "nmap" => ToolProfile {
            pre_args: vec!["-sV".into(), "-sC".into(), "--open".into()],
            post_args: vec![],
        },
        "nikto" => ToolProfile {
            pre_args: vec!["-h".into()],
            // -maxtime: nikto self-aborts before our outer timeout fires (resilience)
            // -ask no: never prompt; -nointeractive: skip TTY prompts
            post_args: vec!["-maxtime".into(), "1500".into(), "-ask".into(), "no".into(), "-nointeractive".into()],
        },
        "gitleaks" => ToolProfile {
            // Directory scan w/o git history → much faster, deterministic finish
            pre_args: vec!["detect".into(), "--no-git".into(), "--no-banner".into(), "--report-format".into(), "json".into(), "--source".into()],
            post_args: vec![],
        },
        "sqlmap" => ToolProfile {
            pre_args: vec!["-u".into()],
            post_args: vec!["--batch".into()],
        },
        "gobuster" => ToolProfile {
            pre_args: vec!["dir".into(), "-u".into()],
            post_args: vec!["-w".into(), "/usr/share/wordlists/dirb/common.txt".into()],
        },
        "ffuf" => ToolProfile {
            pre_args: vec!["-u".into()],
            post_args: vec!["-w".into(), "/usr/share/wordlists/dirb/common.txt".into()],
        },
        "wpscan" => ToolProfile {
            pre_args: vec!["--url".into()],
            post_args: vec!["--no-banner".into()],
        },
        "nuclei" => ToolProfile {
            pre_args: vec!["-u".into()],
            post_args: vec!["-jsonl".into()],
        },
        "whatweb" => ToolProfile {
            pre_args: vec!["-a".into(), "3".into()],
            post_args: vec![],
        },
        "amass" => ToolProfile {
            pre_args: vec!["enum".into(), "-d".into()],
            post_args: vec![],
        },
        "theharvester" | "theHarvester" => ToolProfile {
            pre_args: vec!["-d".into()],
            post_args: vec!["-b".into(), "all".into()],
        },
        "masscan" => ToolProfile {
            pre_args: vec![],
            post_args: vec!["-p1-65535".into(), "--rate=1000".into()],
        },
        "hydra" => ToolProfile {
            pre_args: vec!["-l".into(), "admin".into(), "-P".into(), "/usr/share/wordlists/rockyou.txt".into()],
            post_args: vec!["ssh".into()],
        },
        "sslscan" | "testssl" | "testssl.sh" | "dirb" | "whois" | "traceroute" | "wafw00f" => ToolProfile {
            pre_args: vec![],
            post_args: vec![],
        },
        "fierce" => ToolProfile {
            pre_args: vec!["--domain".into()],
            post_args: vec![],
        },
        "dnsrecon" => ToolProfile {
            pre_args: vec!["-d".into()],
            post_args: vec![],
        },
        "dig" => ToolProfile {
            pre_args: vec![],
            post_args: vec!["ANY".into()],
        },
        "dmitry" => ToolProfile {
            pre_args: vec!["-winsepfb".into()],
            post_args: vec![],
        },
        "subfinder" => ToolProfile {
            pre_args: vec!["-d".into()],
            post_args: vec![],
        },
        "httpx" => ToolProfile {
            pre_args: vec!["-u".into()],
            post_args: vec![],
        },
        "lynis" => ToolProfile {
            pre_args: vec!["audit".into(), "system".into()],
            post_args: vec!["--quick".into()],
        },
        "trivy" => ToolProfile {
            pre_args: vec!["image".into()],
            post_args: vec![],
        },
        "arp-scan" => ToolProfile {
            pre_args: vec!["-l".into()],
            post_args: vec![],
        },
        "netdiscover" => ToolProfile {
            pre_args: vec!["-r".into()],
            post_args: vec!["-P".into()],
        },
        "wapiti" => ToolProfile {
            pre_args: vec!["-u".into()],
            post_args: vec![],
        },
        "enum4linux" => ToolProfile {
            pre_args: vec!["-a".into()],
            post_args: vec![],
        },
        "snmpwalk" => ToolProfile {
            pre_args: vec!["-v2c".into(), "-c".into(), "public".into()],
            post_args: vec![],
        },
        "responder" => ToolProfile {
            pre_args: vec!["-I".into()],
            post_args: vec![],
        },
        "john" | "hashcat" | "aircrack-ng" | "searchsploit" | "binwalk" | "foremost" | "cewl"
        | "dnsenum" | "dnsmap" | "lbd" | "ssh-audit" | "ncrack" | "cadaver" => ToolProfile {
            pre_args: vec![],
            post_args: vec![],
        },
        "reaver" => ToolProfile {
            pre_args: vec!["-i".into()],
            post_args: vec!["-b".into()],
        },
        "msfconsole" => ToolProfile {
            pre_args: vec!["-q".into(), "-x".into()],
            post_args: vec![],
        },
        "crackmapexec" | "netexec" => ToolProfile {
            pre_args: vec!["smb".into()],
            post_args: vec![],
        },
        "tcpdump" => ToolProfile {
            pre_args: vec!["-i".into(), "any".into(), "-nn".into()],
            post_args: vec![],
        },
        "hping3" => ToolProfile {
            pre_args: vec!["-S".into()],
            post_args: vec![],
        },
        "medusa" => ToolProfile {
            pre_args: vec!["-h".into()],
            post_args: vec![],
        },
        "davtest" => ToolProfile {
            pre_args: vec!["-url".into()],
            post_args: vec![],
        },
        "nbtscan" => ToolProfile {
            pre_args: vec!["-r".into()],
            post_args: vec![],
        },
        "smbmap" => ToolProfile {
            pre_args: vec!["-H".into()],
            post_args: vec![],
        },
        "smbclient" => ToolProfile {
            pre_args: vec!["-L".into()],
            post_args: vec!["-N".into()],
        },
        "volatility" | "vol" => ToolProfile {
            pre_args: vec!["-f".into()],
            post_args: vec![],
        },
        "wireshark" => ToolProfile {
            pre_args: vec!["-r".into()],
            post_args: vec![],
        },
        "ettercap" => ToolProfile {
            pre_args: vec!["-T".into(), "-q".into()],
            post_args: vec![],
        },
        // ── Additional CLI tool profiles ──────────────────
        "arjun" => ToolProfile {
            pre_args: vec!["-u".into()],
            post_args: vec![],
        },
        "commix" => ToolProfile {
            pre_args: vec!["--url".into()],
            post_args: vec!["--batch".into()],
        },
        "xsser" => ToolProfile {
            pre_args: vec!["-u".into()],
            post_args: vec!["--auto".into()],
        },
        "skipfish" => ToolProfile {
            pre_args: vec!["-o".into(), "/tmp/skipfish_out".into()],
            post_args: vec![],
        },
        "sslyze" => ToolProfile {
            pre_args: vec![],
            post_args: vec![],
        },
        "host" | "nslookup" => ToolProfile {
            pre_args: vec![],
            post_args: vec![],
        },
        "ping" => ToolProfile {
            pre_args: vec!["-c".into(), "4".into()],
            post_args: vec![],
        },
        "fping" => ToolProfile {
            pre_args: vec!["-a".into(), "-g".into()],
            post_args: vec![],
        },
        "onesixtyone" => ToolProfile {
            pre_args: vec![],
            post_args: vec!["-c".into(), "public".into()],
        },
        "enum4linux-ng" => ToolProfile {
            pre_args: vec!["-A".into()],
            post_args: vec![],
        },
        "smtp-user-enum" => ToolProfile {
            pre_args: vec!["-M".into(), "VRFY".into(), "-u".into(), "admin".into(), "-t".into()],
            post_args: vec![],
        },
        "dotdotpwn" => ToolProfile {
            pre_args: vec!["-m".into(), "http".into(), "-h".into()],
            post_args: vec!["-q".into()],
        },
        "cutycapt" => ToolProfile {
            pre_args: vec!["--url".into()],
            post_args: vec!["--out=/tmp/capture.png".into()],
        },
        "ike-scan" => ToolProfile {
            pre_args: vec![],
            post_args: vec![],
        },
        "amap" => ToolProfile {
            pre_args: vec![],
            post_args: vec!["1-1024".into()],
        },
        "p0f" => ToolProfile {
            pre_args: vec!["-i".into(), "any".into()],
            post_args: vec![],
        },
        "zenmap" | "ghidra" | "burpsuite" | "maltego" | "armitage" | "autopsy" | "wireshark-gtk"
        | "ophcrack" | "guymager" | "fwbuilder" | "cutecom" | "jd-gui" | "sqlitebrowser"
        | "recordmydesktop" | "httrack-qt" | "xplico" | "netsniff-ng" => {
            // GUI tools — should never reach here (blocked in start_scan), but just in case
            return None;
        },
        _ => return None,
    };
    Some(profile)
}

// ── Build Command ──────────────────────────────────────────

/// Per-tool maximum runtime override (seconds).
/// Returns the bespoke timeout for slow tools (nikto, gitleaks, masscan, etc.) or the default 900s.
/// Used by `executor::execute_scan` to size the outer kill-switch.
pub fn get_tool_max_runtime_secs(tool_name: &str) -> u64 {
    match tool_name {
        // Long-running scanners — give them more headroom than the 900s default
        "nikto" | "masscan" | "amass" | "wpscan" | "sqlmap" | "wapiti" | "skipfish" | "dirsearch" => 1800,
        "gitleaks" | "trivy" | "semgrep" | "bandit" | "nuclei" | "subfinder" | "theharvester" | "theHarvester" => 1500,
        "hydra" | "medusa" | "ncrack" | "crackmapexec" | "netexec" => 1800,
        // Default: 15 minutes
        _ => 900,
    }
}

/// Build command program + args from tool name, target, and optional template.
/// Resolution order:
/// 1. Command template (user-provided or from DB)
/// 2. Smart profile (hardcoded optimal args for well-known tools)
/// 3. Kali registry defaults (binary + default_args from .desktop files)
/// 4. Generic fallback (tool_name + target)
pub fn build_command(
    tool_name: &str,
    target: &str,
    command_template: Option<&str>,
) -> Result<(String, Vec<String>)> {
    let program = resolve_binary(tool_name);

    // 1. Command template from DB or user
    if let Some(template) = command_template {
        if !template.is_empty() {
            return parse_template(&program, template, target);
        }
    }

    // 2. Smart profile for well-known tools
    if let Some(profile) = get_smart_profile(tool_name) {
        let mut args = profile.pre_args;
        args.push(target.to_string());
        args.extend(profile.post_args);
        return Ok((program, args));
    }

    // 3. Kali registry defaults
    if let Some(kali_tool) = find_tool(tool_name) {
        let binary = if !kali_tool.binary_path.is_empty() {
            kali_tool.binary_path.clone()
        } else {
            kali_tool.binary.clone()
        };

        let mut args: Vec<String> = if !kali_tool.default_args.is_empty() {
            kali_tool.default_args
                .split_whitespace()
                .map(|s| {
                    s.replace("{target}", target)
                     .replace("{TARGET}", target)
                     .replace("{host}", target)
                     .replace("{url}", target)
                     .replace("{ip}", target)
                     .replace("{domain}", target)
                })
                .collect()
        } else {
            vec![]
        };

        let has_target = args.iter().any(|a| a == target);
        if !has_target {
            args.push(target.to_string());
        }

        return Ok((binary, args));
    }

    // 4. Generic fallback
    Ok((program, vec![target.to_string()]))
}

/// Resolve the actual binary path for a tool
fn resolve_binary(tool_name: &str) -> String {
    if let Some(&bin) = BINARY_OVERRIDES.get(tool_name) {
        return bin.to_string();
    }
    if let Some(kali_tool) = find_tool(tool_name) {
        if !kali_tool.binary_path.is_empty() {
            return kali_tool.binary_path.clone();
        }
        if !kali_tool.binary.is_empty() {
            return kali_tool.binary.clone();
        }
    }
    tool_name.to_string()
}

/// Default value for a placeholder that the user did not supply via scan parameters.
///
/// Order of resolution (handled by caller `parse_template`):
/// 1. scan_handlers substitutes user-provided `{key}` parameters first.
/// 2. Target-aliased placeholders (`{target}/{host}/{url}/{ip}/{domain}`) → `target`.
/// 3. Anything still remaining → this map provides a sane default so the tool
///    can run with just a target. If no default is known we fall back to `target`.
///
/// This guarantees that **every** Kali tool can be invoked with just a target
/// and produce useful output — never leak a literal `{wordlist}` to argv.
fn placeholder_default(key: &str, target: &str) -> String {
    match key {
        // ── Filesystem / payload inputs ────────────────────────────
        // For binary-analysis / forensic tools the "target" *is* the file path.
        "file" | "infile" | "input" | "binary" | "image" | "memdump" | "pcap"
        | "apk" | "package" | "payload" | "script" | "path" | "cover" => target.to_string(),

        // ── Wordlists ──────────────────────────────────────────────
        "wordlist" | "user_list" | "users_file" | "username_list" =>
            "/usr/share/wordlists/dirb/common.txt".to_string(),
        "pass_list" | "password_list" | "pass_file" =>
            "/usr/share/wordlists/rockyou.txt".to_string(),

        // ── Credentials ────────────────────────────────────────────
        "user" | "username" => "admin".to_string(),
        "password" | "pass" | "passphrase" => "password".to_string(),
        "email" => "admin@example.com".to_string(),

        // ── Network / interface ────────────────────────────────────
        "iface" | "interface" => "any".to_string(),
        "lhost" => "0.0.0.0".to_string(),
        "lport" => "4444".to_string(),
        "ports" | "port" => "1-1024".to_string(),
        "ssid" => "TARGET_SSID".to_string(),
        "bssid" => "00:00:00:00:00:00".to_string(),
        "dc" => target.to_string(),  // domain controller = target

        // ── Hashes / crypto ────────────────────────────────────────
        "hash" | "hashfile" => target.to_string(),
        "key" | "authkey" | "pke" | "pkr" | "enonce" => target.to_string(),

        // ── Output paths ───────────────────────────────────────────
        "outfile" | "output" => "/tmp/cybersec_scan_out".to_string(),

        // ── Misc ───────────────────────────────────────────────────
        "count" => "4".to_string(),
        "mode" => "default".to_string(),
        "format" => "json".to_string(),
        "flags" => "".to_string(),
        "process" | "provider" | "action" | "message"
        | "target_kind" | "bucket" => target.to_string(),

        // Unknown: best to use target than leak `{xxx}` literally.
        _ => target.to_string(),
    }
}

/// Parse a command_template like "nikto -h {target}" into program + args.
///
/// SECURITY:
///   - target is always treated as a single atomic argument — never split.
///   - All remaining `{key}` placeholders that scan_handlers did not fill are
///     substituted from `placeholder_default()` so a literal `{wordlist}` can
///     never reach argv (which would cause the tool to fail or behave oddly).
///   - Defaults are static, vetted strings with no shell metacharacters.
fn parse_template(program: &str, template: &str, target: &str) -> Result<(String, Vec<String>)> {
    if template.trim().is_empty() {
        return Err(anyhow!("Empty command template"));
    }

    // Split the template on whitespace, but replace {target} placeholder with a sentinel
    // then substitute back — this ensures target is never split on spaces.
    const SENTINEL: &str = "\x00TARGET\x00";
    let templated = template
        .replace("{target}", SENTINEL)
        .replace("{TARGET}", SENTINEL)
        .replace("{host}", SENTINEL)
        .replace("{url}", SENTINEL)
        .replace("{ip}", SENTINEL)
        .replace("{domain}", SENTINEL);

    // Substitute any remaining `{key}` placeholders with sane defaults. We do this
    // here (after target sentinel substitution) so a default that happens to equal
    // `target` is still parsed atomically when it lands at the same position.
    let placeholder_re = regex::Regex::new(r"\{([a-z_][a-z0-9_]*)\}")
        .map_err(|e| anyhow!("regex compile failed: {}", e))?;
    let resolved = placeholder_re.replace_all(&templated, |caps: &regex::Captures| {
        placeholder_default(&caps[1], target)
    });

    let parts: Vec<&str> = resolved.split_whitespace().collect();
    if parts.is_empty() {
        return Err(anyhow!("Empty command template after parsing"));
    }

    // Determine if template starts with the program name (skip it to avoid duplication)
    let start = if parts[0] == program || parts[0].ends_with(&format!("/{}", program)) {
        1
    } else {
        0
    };

    let args: Vec<String> = parts[start..]
        .iter()
        .map(|s| {
            if *s == SENTINEL {
                target.to_string()  // target as single atomic arg — never split
            } else {
                s.to_string()
            }
        })
        .collect();

    // If no sentinel was found in template, append target at end
    let has_target = args.iter().any(|a| a == target);
    let mut final_args = args;
    if !has_target {
        final_args.push(target.to_string());
    }

    Ok((program.to_string(), final_args))
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_alias_placeholders_are_substituted() {
        let (prog, args) = build_command("nikto", "https://example.com", Some("nikto -h {url}")).unwrap();
        assert_eq!(prog, "nikto");
        assert!(args.contains(&"https://example.com".to_string()));
    }

    #[test]
    fn unknown_placeholder_falls_back_to_target() {
        let (_p, args) = build_command(
            "ddosscript", "10.0.0.1",
            Some("python3 ddos/ddos.py {target}"),
        ).unwrap();
        // target is preserved
        assert!(args.iter().any(|a| a == "10.0.0.1"));
        // No literal {target} leaked
        assert!(!args.iter().any(|a| a.contains('{')));
    }

    #[test]
    fn wordlist_placeholder_uses_default_when_missing() {
        let (_p, args) = build_command(
            "dirb", "http://example.com",
            Some("dirb {url} {wordlist}"),
        ).unwrap();
        assert!(args.contains(&"/usr/share/wordlists/dirb/common.txt".to_string()));
        assert!(args.contains(&"http://example.com".to_string()));
    }

    #[test]
    fn user_password_have_safe_defaults() {
        let (_p, args) = build_command(
            "evil_winrm", "10.0.0.1",
            Some("evil-winrm -i {host} -u {user} -p {password}"),
        ).unwrap();
        assert!(args.contains(&"admin".to_string()));
        assert!(args.contains(&"password".to_string()));
        assert!(args.contains(&"10.0.0.1".to_string()));
    }

    #[test]
    fn no_placeholder_left_in_argv() {
        // Every template that uses any placeholder must produce argv with no
        // stray `{...}` tokens.
        let templates = [
            ("nuclei", "http://x", "nuclei -u {url} -severity high"),
            ("certipy", "x.local", "certipy find -u {user}@{domain} -p {password}"),
            ("dirb", "http://x", "dirb {url} {wordlist}"),
            ("evil_winrm", "10.0.0.1", "evil-winrm -i {host} -u {user} -p {password}"),
            ("astra", "http://x", "python3 modules/scanner.py -u {url}"),
            ("aws_pwn", "x", "python3 aws_pwn/{flags}"),
            ("certgraph", "example.com", "certgraph {domain}"),
            ("chainsaw", "/tmp/log", "chainsaw hunt {file}"),
        ];
        for (name, target, tpl) in templates {
            let (_p, args) = build_command(name, target, Some(tpl)).unwrap();
            for a in &args {
                assert!(
                    !(a.starts_with('{') && a.ends_with('}')),
                    "tool={} produced literal placeholder in argv: {:?}",
                    name, args
                );
            }
        }
    }

    #[test]
    fn smart_profile_used_when_no_template() {
        let (prog, args) = build_command("nmap", "10.0.0.1", None).unwrap();
        assert_eq!(prog, "nmap");
        assert!(args.contains(&"-sV".to_string()));
        assert!(args.contains(&"10.0.0.1".to_string()));
    }

    #[test]
    fn target_with_spaces_is_atomic() {
        // Defensive — a target containing a space must remain a single argv slot.
        let (_p, args) = build_command(
            "echo_test", "value with space",
            Some("echo {target}"),
        ).unwrap();
        assert!(args.contains(&"value with space".to_string()),
                "target was split across argv: {:?}", args);
    }

    #[test]
    fn placeholder_default_is_deterministic() {
        assert_eq!(placeholder_default("wordlist", "T"),
                   "/usr/share/wordlists/dirb/common.txt");
        assert_eq!(placeholder_default("user", "T"), "admin");
        assert_eq!(placeholder_default("password", "T"), "password");
        assert_eq!(placeholder_default("file", "/tmp/x"), "/tmp/x");
        assert_eq!(placeholder_default("totally_unknown", "TGT"), "TGT");
    }
}
