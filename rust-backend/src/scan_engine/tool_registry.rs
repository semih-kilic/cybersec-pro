use anyhow::{anyhow, Result};
use serde::Deserialize;
use std::collections::HashMap;

// ── Embedded Kali Tool Registry (518 tools) ────────────────

const KALI_TOOLS_JSON: &str = include_str!("../../kali_tools.json");

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
        match serde_json::from_str::<Vec<KaliTool>>(KALI_TOOLS_JSON) {
            Ok(tools) => {
                tracing::info!("Loaded {} tools from kali_tools.json", tools.len());
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

/// Parse a command_template like "nikto -h {target}" into program + args.
/// SECURITY: target is always treated as a single atomic argument — never split.
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

    let parts: Vec<&str> = templated.split_whitespace().collect();
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
