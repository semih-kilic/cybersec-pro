use std::collections::BTreeMap;
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
    build_command_with_params(tool_name, target, command_template, &BTreeMap::new())
}

/// Build program + argv, filling `{key}` placeholders from `params`.
///
/// Callers must pass user-supplied values HERE rather than pre-substituting
/// them into `command_template`; see `parse_template` for why.
pub fn build_command_with_params(
    tool_name: &str,
    target: &str,
    command_template: Option<&str>,
    params: &BTreeMap<String, String>,
) -> Result<(String, Vec<String>)> {
    let program = resolve_binary(tool_name);

    // 1. Command template from DB or user
    if let Some(template) = command_template {
        if !template.is_empty() {
            return parse_template(&program, template, target, params);
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

/// Rejects a parameter value that would be read as an option flag.
///
/// A value that occupies a whole argv slot and begins with `-` is
/// indistinguishable from a flag once it reaches the tool. `nmap {target}` with
/// target `--script=/tmp/evil.nse` runs the attacker's NSE script; `-oN /path`
/// writes a file. Values are data and must never start a new option.
fn value_looks_like_flag(v: &str) -> bool {
    v.starts_with('-')
}

/// Substitute `{key}` placeholders inside a SINGLE already-tokenised argument.
///
/// This is the heart of the injection fix. The template comes from our own
/// tool catalogue and is trusted; the values come from the request body and are
/// not. Tokenising the trusted template FIRST and only then substituting means
/// an untrusted value can never introduce a new argv entry, however many spaces
/// it contains.
fn substitute_token(token: &str, target: &str, params: &BTreeMap<String, String>) -> Option<String> {
    let re = match regex::Regex::new(r"\{([A-Za-z_][A-Za-z0-9_]*)\}") {
        Ok(r) => r,
        Err(_) => return Some(token.to_string()),
    };
    if !re.is_match(token) {
        return Some(token.to_string());
    }

    // Does this token consist of exactly one placeholder and nothing else?
    // Only then can the substituted value stand alone as an option.
    let standalone = re.find(token).map(|m| m.start() == 0 && m.end() == token.len()).unwrap_or(false);

    let mut rejected = false;
    let out = re.replace_all(token, |caps: &regex::Captures| {
        let key = &caps[1];
        let value = match key {
            "target" | "TARGET" | "host" | "url" | "ip" | "domain" => target.to_string(),
            other => params
                .get(other)
                .cloned()
                .unwrap_or_else(|| placeholder_default(other, target)),
        };
        if standalone && value_looks_like_flag(&value) {
            tracing::warn!("scan parameter '{}' rejected: value would be read as an option flag", key);
            rejected = true;
        }
        value
    });

    if rejected {
        return None;
    }
    Some(out.into_owned())
}

/// Parse a command_template like "nikto -h {target}" into program + args.
///
/// SECURITY — this function used to substitute values into the template string
/// and only then split the result on whitespace. Any value containing a space
/// therefore became several argv entries, which let a caller inject arbitrary
/// flags into the tool (`--script`, `-oN <path>`, `--os-shell`). The order is
/// now inverted: the trusted template is tokenised first, then each token has
/// its placeholders filled, so one placeholder always yields exactly one
/// argument. A value that would stand alone and begins with `-` is refused.
fn parse_template(
    program: &str,
    template: &str,
    target: &str,
    params: &BTreeMap<String, String>,
) -> Result<(String, Vec<String>)> {
    if template.trim().is_empty() {
        return Err(anyhow!("Empty command template"));
    }

    // Tokenise the TRUSTED template before any untrusted value is involved.
    let tokens: Vec<&str> = template.split_whitespace().collect();
    if tokens.is_empty() {
        return Err(anyhow!("Empty command template after parsing"));
    }

    // Skip a leading program name so it is not duplicated.
    let start = if tokens[0] == program || tokens[0].ends_with(&format!("/{}", program)) {
        1
    } else {
        0
    };

    let mut args: Vec<String> = Vec::with_capacity(tokens.len());
    for tok in &tokens[start..] {
        match substitute_token(tok, target, params) {
            Some(a) => args.push(a),
            // A rejected value drops its whole token rather than passing a flag
            // through. The tool then runs without that option, which is the
            // safe failure mode.
            None => continue,
        }
    }

    // If the template never mentioned the target, append it.
    //
    // This must respect the same flag check as substitution: when a
    // flag-shaped `{target}` token is dropped above, blindly appending here
    // would put the flag straight back into argv — which is exactly what the
    // rejection was for.
    if !args.iter().any(|a| a == target) {
        if value_looks_like_flag(target) {
            tracing::warn!("target rejected: value would be read as an option flag");
        } else {
            args.push(target.to_string());
        }
    }

    Ok((program.to_string(), args))
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn params(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    // ── #8 argument injection ─────────────────────────────────────────

    #[test]
    fn parameter_with_spaces_stays_one_argument() {
        // THE bug: values were substituted into the template string and the
        // result was split on whitespace, so this became four argv entries and
        // handed nmap an extra `--script` flag.
        let p = params(&[("wordlist", "/tmp/list.txt --script=/tmp/evil.nse")]);
        let (_, args) = build_command_with_params(
            "ffuf", "example.com", Some("ffuf -w {wordlist} -u {target}"), &p,
        ).unwrap();
        assert!(
            args.contains(&"/tmp/list.txt --script=/tmp/evil.nse".to_string()),
            "the whole value must remain ONE argument: {args:?}"
        );
        assert!(
            !args.iter().any(|a| a == "--script=/tmp/evil.nse"),
            "the value must not become its own flag: {args:?}"
        );
    }

    #[test]
    fn parameter_cannot_add_extra_arguments() {
        let p = params(&[("wordlist", "a b c d e")]);
        let (_, args) = build_command_with_params(
            "ffuf", "t.com", Some("ffuf -w {wordlist}"), &p,
        ).unwrap();
        // -w, the value, and the appended target — nothing more.
        assert_eq!(args.len(), 3, "value must not expand the argv: {args:?}");
        assert_eq!(args[1], "a b c d e");
    }

    #[test]
    fn standalone_parameter_starting_with_dash_is_rejected() {
        let p = params(&[("wordlist", "--script=/tmp/evil.nse")]);
        let (_, args) = build_command_with_params(
            "ffuf", "t.com", Some("ffuf -w {wordlist}"), &p,
        ).unwrap();
        assert!(
            !args.iter().any(|a| a.starts_with("--script")),
            "a flag-shaped value must be dropped: {args:?}"
        );
    }

    #[test]
    fn target_shaped_like_a_flag_is_rejected() {
        // `nmap --script=... ` would run an arbitrary NSE script.
        let (_, args) = build_command_with_params(
            "nmap", "--script=/tmp/evil.nse", Some("nmap {target}"), &BTreeMap::new(),
        ).unwrap();
        assert!(
            !args.iter().any(|a| a.starts_with("--script")),
            "a flag-shaped target must not reach argv: {args:?}"
        );
    }

    #[test]
    fn output_flag_injection_via_target_is_blocked() {
        let (_, args) = build_command_with_params(
            "nmap", "-oN /etc/cron.d/pwn", Some("nmap -sV {target}"), &BTreeMap::new(),
        ).unwrap();
        assert!(!args.iter().any(|a| a.starts_with("-oN")), "argv: {args:?}");
    }

    #[test]
    fn embedded_placeholder_keeps_its_token() {
        // `--url={target}` must stay a single argument.
        let (_, args) = build_command_with_params(
            "httpx", "https://example.com", Some("httpx --url={target}"), &BTreeMap::new(),
        ).unwrap();
        assert!(args.contains(&"--url=https://example.com".to_string()), "argv: {args:?}");
    }

    #[test]
    fn embedded_value_with_spaces_does_not_split() {
        let p = params(&[("q", "one two three")]);
        let (_, args) = build_command_with_params(
            "tool", "t.com", Some("tool --query={q}"), &p,
        ).unwrap();
        assert!(args.contains(&"--query=one two three".to_string()), "argv: {args:?}");
    }

    #[test]
    fn a_leading_dash_inside_a_larger_token_is_allowed() {
        // Only a value that stands alone can become a flag; embedded is fine.
        let p = params(&[("opt", "-v")]);
        let (_, args) = build_command_with_params(
            "tool", "t.com", Some("tool --flag={opt}"), &p,
        ).unwrap();
        assert!(args.contains(&"--flag=-v".to_string()), "argv: {args:?}");
    }

    #[test]
    fn unknown_placeholders_still_get_defaults() {
        let (_, args) = build_command_with_params(
            "gobuster", "t.com", Some("gobuster dir -u {target} -w {wordlist}"), &BTreeMap::new(),
        ).unwrap();
        assert!(!args.iter().any(|a| a.contains('{')), "no literal placeholder may leak: {args:?}");
    }

    #[test]
    fn target_is_appended_when_the_template_omits_it() {
        let (_, args) = build_command_with_params(
            "whatweb", "example.com", Some("whatweb -a 3"), &BTreeMap::new(),
        ).unwrap();
        assert_eq!(args.last().map(String::as_str), Some("example.com"));
    }

    #[test]
    fn program_name_in_template_is_not_duplicated() {
        let (prog, args) = build_command_with_params(
            "nikto", "https://x.com", Some("nikto -h {target}"), &BTreeMap::new(),
        ).unwrap();
        assert_eq!(prog, "nikto");
        assert_eq!(args.iter().filter(|a| *a == "nikto").count(), 0);
    }

    #[test]
    fn empty_template_is_an_error() {
        assert!(build_command_with_params("x", "t", Some("   "), &BTreeMap::new()).is_err()
             || build_command_with_params("x", "t", Some(""), &BTreeMap::new()).is_ok());
    }

    #[test]
    fn value_looks_like_flag_detects_both_dash_forms() {
        assert!(value_looks_like_flag("-oN"));
        assert!(value_looks_like_flag("--script=x"));
        assert!(!value_looks_like_flag("example.com"));
        assert!(!value_looks_like_flag("/tmp/wordlist.txt"));
        assert!(!value_looks_like_flag(""));
    }

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
