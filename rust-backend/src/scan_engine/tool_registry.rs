use anyhow::{anyhow, Result};
use std::collections::HashMap;

/// Build command program + args from tool name, target, and optional template.
/// Returns (program, args_vec).
pub fn build_command(
    tool_name: &str,
    target: &str,
    command_template: Option<&str>,
) -> Result<(String, Vec<String>)> {
    // Check binary overrides
    let program = BINARY_OVERRIDES
        .get(tool_name)
        .copied()
        .unwrap_or(tool_name);

    // If command_template is provided, parse it
    if let Some(template) = command_template {
        if !template.is_empty() {
            return parse_template(program, template, target);
        }
    }

    // Check hardcoded registry
    if let Some(profile) = get_tool_profile(tool_name) {
        let mut args = profile.pre_args.clone();
        args.push(target.to_string());
        args.extend(profile.post_args.clone());
        return Ok((program.to_string(), args));
    }

    // Generic fallback: just pass target
    Ok((program.to_string(), vec![target.to_string()]))
}

/// Parse a command_template like "nikto -h {target}" into program + args.
fn parse_template(program: &str, template: &str, target: &str) -> Result<(String, Vec<String>)> {
    // Replace {target} placeholder
    let filled = template
        .replace("{target}", target)
        .replace("{TARGET}", target)
        .replace("{host}", target)
        .replace("{url}", target)
        .replace("{ip}", target)
        .replace("{domain}", target);

    let parts: Vec<&str> = filled.split_whitespace().collect();
    if parts.is_empty() {
        return Err(anyhow!("Empty command template"));
    }

    // Skip the first token if it matches the tool name (already have program)
    let args: Vec<String> = if parts[0] == program || parts[0].ends_with(&format!("/{}", program)) {
        parts[1..].iter().map(|s| s.to_string()).collect()
    } else {
        parts.iter().map(|s| s.to_string()).collect()
    };

    Ok((program.to_string(), args))
}

// ── Binary Overrides ───────────────────────────────────────

lazy_static::lazy_static! {
    static ref BINARY_OVERRIDES: HashMap<&'static str, &'static str> = {
        let mut m = HashMap::new();
        m.insert("python-wapiti", "wapiti");
        m.insert("wordlists", "ls");
        m.insert("seclists", "ls");
        m.insert("crunch", "crunch");
        m
    };
}

// ── Tool Profiles (Hardcoded Registry) ─────────────────────

pub struct ToolProfile {
    pub pre_args: Vec<String>,
    pub post_args: Vec<String>,
}

fn get_tool_profile(tool_name: &str) -> Option<ToolProfile> {
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
        "sslscan" => ToolProfile {
            pre_args: vec![],
            post_args: vec![],
        },
        "testssl" | "testssl.sh" => ToolProfile {
            pre_args: vec![],
            post_args: vec![],
        },
        "dirb" => ToolProfile {
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
        "whois" => ToolProfile {
            pre_args: vec![],
            post_args: vec![],
        },
        "dig" => ToolProfile {
            pre_args: vec![],
            post_args: vec!["ANY".into()],
        },
        "traceroute" => ToolProfile {
            pre_args: vec![],
            post_args: vec![],
        },
        "wafw00f" => ToolProfile {
            pre_args: vec![],
            post_args: vec![],
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
        _ => return None,
    };
    Some(profile)
}
