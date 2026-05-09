use regex::Regex;
use serde_json::{json, Value as JsonValue};

/// Parse tool output into structured findings.
pub fn parse_output(tool_name: &str, output: &str) -> Option<JsonValue> {
    match tool_name {
        "nmap" => parse_nmap(output),
        "nikto" => parse_nikto(output),
        "sqlmap" => parse_sqlmap(output),
        "nuclei" => parse_nuclei(output),
        "gobuster" | "dirb" | "ffuf" | "feroxbuster" | "wfuzz" | "dirsearch" | "dotdotpwn" | "davtest" | "goldeneye" | "httprint"
            => parse_directory_scan(output),
        "sslscan" | "sslyze" | "tlssled" => parse_sslscan(output),
        "whatweb" => parse_whatweb(output),
        "wpscan" | "joomscan" | "droopescan" | "cmsmap" | "wafw00f" | "cmseek" | "commix" => parse_wpscan(output),
        "amass" | "subfinder" | "dnsrecon" | "fierce" | "dnsenum" | "dnsmap"
            | "assetfinder" | "findomain" | "knockpy" | "sublist3r" | "puredns" | "shuffledns" | "alterx"
            | "altdns" | "anew" | "chaos" | "censys-cli" | "dnstwist" | "dnswalk" | "dnstracer" | "massdns"
            | "finalrecon" | "lazyrecon" | "fang" | "emailharvester" | "email2phonenumber" | "holehe" | "h8mail"
            | "linkedin2username" | "instaloader" | "instaloader-tool" | "maryam"
            => parse_subdomain_enum(output),
        "theharvester" => parse_theharvester(output),
        "masscan" | "rustscan" | "zmap" | "unicornscan" | "naabu"
            | "amap" | "fping" | "hping3" | "arping" | "iputils-arping"
            => parse_masscan(output),
        "hydra" | "medusa" | "ncrack" | "kerbrute"
            | "crowbar" | "brutespray" | "brutespray-pro" | "fcrackzip" | "eapmd5pass" | "asleap"
            | "lsassy" | "kerberoast" | "kerberoast.py" | "gpp-decrypt" | "hashid" | "hash-identifier"
            => parse_brute_force(output),
        "enum4linux" | "smbmap" | "smbclient" | "impacket-smbclient" | "impacket-smbserver" => parse_smb(output),
        "testssl" | "testssl.sh" => parse_testssl(output),
        "wapiti" => parse_wapiti(output),
        "dmitry" => parse_dmitry(output),
        "httpx" | "httpx-toolkit" | "tlsx" | "dnsx" | "asnmap" | "cdncheck" | "mapcidr"
            | "httprobe" | "httpie" | "httrack" | "interactsh" | "gowitness" | "eyewitness"
            => parse_httpx(output),
        "crackmapexec" | "netexec" | "evil-winrm" | "evil_winrm" | "evil-winrm-py"
            | "impacket-psexec" | "impacket-smbexec" | "impacket-secretsdump" | "impacket-mssqlclient"
            | "atexec.py" | "dcomexec.py"
            => parse_cme(output),
        // New verified families
        "trivy" | "grype" | "grype_dir" | "retire" | "bandit" | "semgrep" | "dalfox" | "ike-scan"
            | "lynis" | "chkrootkit" | "clair" | "cargo_audit" | "cvemap" | "garak" | "checksec"
            | "linpeas" | "linux-exploit-suggester" | "androbugs"
            => parse_vuln_findings(output),
        "gitleaks" | "detect_secrets" | "git_secrets" | "gitxray" => parse_secret_findings(output),
        "katana" | "hakrawler" | "gospider" | "gospider-pro" | "gau" | "getallurls"
            | "waybackurls" | "paramspider" | "arjun" | "crlfuzz" | "extended_xss_search"
            | "evilurl" | "goshs"
            => parse_url_list(output),
        "kube-bench" | "kube_bench" | "kics" | "tfsec" | "checkov" | "terrascan" | "kubescape"
            | "scout-suite" | "cloudsploit" | "cloudfox" | "certipy"
            | "dockle" | "dive" | "hadolint" | "docker_bench" | "cloudsplaining" | "cloudbrute"
            | "cartography" | "gcpbucketbrute" | "azurehound" | "cosign" | "defectdojo"
            => parse_iac_findings(output),
        _ => parse_generic(output),
    }
}

fn parse_nmap(output: &str) -> Option<JsonValue> {
    let mut open_ports = Vec::new();
    let mut services = Vec::new();
    let port_re = Regex::new(r"(\d+)/(tcp|udp)\s+(\w+)\s+(.*)").ok()?;

    for line in output.lines() {
        if let Some(caps) = port_re.captures(line) {
            let port: u16 = caps[1].parse().unwrap_or(0);
            let protocol = &caps[2];
            let state = &caps[3];
            let service = caps[4].trim();

            if state == "open" {
                open_ports.push(port);
                services.push(json!({
                    "port": port,
                    "protocol": protocol,
                    "state": state,
                    "service": service
                }));
            }
        }
    }

    // Check for vulnerabilities
    let mut vulns = Vec::new();
    let vuln_re = Regex::new(r"(?i)(CVE-\d{4}-\d+|VULNERABLE|vuln)").ok()?;
    for line in output.lines() {
        if vuln_re.is_match(line) {
            vulns.push(json!({
                "description": line.trim(),
                "severity": "high"
            }));
        }
    }

    Some(json!({
        "summary": {
            "total": services.len() + vulns.len(),
            "open_ports": open_ports.len(),
            "critical": vulns.iter().filter(|v| v["severity"] == "critical").count(),
            "high": vulns.len(),
            "medium": 0,
            "low": 0
        },
        "open_ports": open_ports,
        "services": services,
        "vulnerabilities": vulns
    }))
}

fn parse_nikto(output: &str) -> Option<JsonValue> {
    let mut findings = Vec::new();
    let finding_re = Regex::new(r"\+\s+(.+)").ok()?;

    for line in output.lines() {
        if let Some(caps) = finding_re.captures(line) {
            let desc = caps[1].trim();
            if !desc.starts_with("Target IP:") && !desc.starts_with("Target Hostname:") && !desc.starts_with("Target Port:") && !desc.starts_with("Start Time:") && !desc.starts_with("End Time:") {
                let severity = if desc.to_lowercase().contains("critical") || desc.to_lowercase().contains("rce") {
                    "critical"
                } else if desc.to_lowercase().contains("xss") || desc.to_lowercase().contains("injection") || desc.to_lowercase().contains("sql") {
                    "high"
                } else if desc.to_lowercase().contains("disclosure") || desc.to_lowercase().contains("information") {
                    "medium"
                } else {
                    "low"
                };

                findings.push(json!({
                    "description": desc,
                    "severity": severity
                }));
            }
        }
    }

    let critical = findings.iter().filter(|f| f["severity"] == "critical").count();
    let high = findings.iter().filter(|f| f["severity"] == "high").count();
    let medium = findings.iter().filter(|f| f["severity"] == "medium").count();
    let low = findings.iter().filter(|f| f["severity"] == "low").count();

    Some(json!({
        "summary": {
            "total": findings.len(),
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "open_ports": 0
        },
        "findings": findings
    }))
}

fn parse_sqlmap(output: &str) -> Option<JsonValue> {
    let mut findings = Vec::new();
    let injectable = output.to_lowercase().contains("injectable");
    let vuln_types: Vec<&str> = vec!["boolean-based", "time-based", "error-based", "union-based", "stacked"];

    for vtype in &vuln_types {
        if output.to_lowercase().contains(vtype) {
            findings.push(json!({
                "type": vtype,
                "severity": "critical",
                "description": format!("SQL Injection: {} technique detected", vtype)
            }));
        }
    }

    // Extract databases
    let mut databases = Vec::new();
    let db_re = Regex::new(r"\[\*\]\s+(\w+)").ok()?;
    let mut in_db_section = false;
    for line in output.lines() {
        if line.contains("available databases") {
            in_db_section = true;
            continue;
        }
        if in_db_section {
            if let Some(caps) = db_re.captures(line) {
                databases.push(caps[1].to_string());
            }
            if line.trim().is_empty() {
                in_db_section = false;
            }
        }
    }

    Some(json!({
        "summary": {
            "total": findings.len(),
            "critical": findings.len(),
            "high": 0,
            "medium": 0,
            "low": 0,
            "open_ports": 0
        },
        "injectable": injectable,
        "findings": findings,
        "databases": databases
    }))
}

fn parse_nuclei(output: &str) -> Option<JsonValue> {
    let mut findings = Vec::new();

    for line in output.lines() {
        // Try JSON lines format
        if line.starts_with('{') {
            if let Ok(obj) = serde_json::from_str::<JsonValue>(line) {
                findings.push(obj);
                continue;
            }
        }
        // Bracket format: [severity] [template-id] description
        let bracket_re = Regex::new(r"\[(critical|high|medium|low|info)\]\s+\[([^\]]+)\]\s+(.+)").ok()?;
        if let Some(caps) = bracket_re.captures(line) {
            findings.push(json!({
                "severity": &caps[1],
                "template_id": &caps[2],
                "description": caps[3].trim()
            }));
        }
    }

    let critical = findings.iter().filter(|f| f.get("info").and_then(|i| i.get("severity")).and_then(|s| s.as_str()).unwrap_or(f.get("severity").and_then(|s| s.as_str()).unwrap_or("")) == "critical").count();
    let high = findings.iter().filter(|f| f.get("severity").and_then(|s| s.as_str()).unwrap_or("") == "high").count();
    let medium = findings.iter().filter(|f| f.get("severity").and_then(|s| s.as_str()).unwrap_or("") == "medium").count();
    let low = findings.iter().filter(|f| f.get("severity").and_then(|s| s.as_str()).unwrap_or("") == "low").count();

    Some(json!({
        "summary": {
            "total": findings.len(),
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "open_ports": 0
        },
        "findings": findings
    }))
}

fn parse_directory_scan(output: &str) -> Option<JsonValue> {
    let mut found_paths = Vec::new();
    let url_re = Regex::new(r"(https?://[^\s]+)\s+.*?(\d{3})").ok()?;

    for line in output.lines() {
        if let Some(caps) = url_re.captures(line) {
            let status: u16 = caps[2].parse().unwrap_or(0);
            if status == 200 || status == 301 || status == 302 || status == 403 {
                found_paths.push(json!({
                    "url": &caps[1],
                    "status_code": status,
                    "severity": if status == 200 { "info" } else { "low" }
                }));
            }
        }
    }

    Some(json!({
        "summary": {
            "total": found_paths.len(),
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": found_paths.len(),
            "open_ports": 0
        },
        "discovered_paths": found_paths
    }))
}

fn parse_sslscan(output: &str) -> Option<JsonValue> {
    let mut findings = Vec::new();

    // Check for weak protocols
    for protocol in &["SSLv2", "SSLv3", "TLSv1.0", "TLSv1.1"] {
        if output.contains(&format!("{} enabled", protocol)) || output.contains(&format!("{}  enabled", protocol)) {
            findings.push(json!({
                "type": "weak_protocol",
                "protocol": protocol,
                "severity": if *protocol == "SSLv2" || *protocol == "SSLv3" { "critical" } else { "high" },
                "description": format!("Weak protocol {} is enabled", protocol)
            }));
        }
    }

    // Check for weak ciphers
    if output.to_lowercase().contains("null") || output.to_lowercase().contains("export") || output.to_lowercase().contains("rc4") {
        findings.push(json!({
            "type": "weak_cipher",
            "severity": "high",
            "description": "Weak cipher suite detected"
        }));
    }

    let critical = findings.iter().filter(|f| f["severity"] == "critical").count();
    let high = findings.iter().filter(|f| f["severity"] == "high").count();

    Some(json!({
        "summary": {
            "total": findings.len(),
            "critical": critical,
            "high": high,
            "medium": 0,
            "low": 0,
            "open_ports": 0
        },
        "findings": findings
    }))
}

fn parse_whatweb(output: &str) -> Option<JsonValue> {
    let mut technologies = Vec::new();
    let tech_re = Regex::new(r"\[([^\]]+)\]").ok()?;

    for caps in tech_re.captures_iter(output) {
        let tech = caps[1].trim().to_string();
        if !tech.is_empty() && tech.len() < 100 {
            technologies.push(tech);
        }
    }

    Some(json!({
        "summary": {
            "total": technologies.len(),
            "critical": 0, "high": 0, "medium": 0, "low": 0, "open_ports": 0
        },
        "technologies": technologies
    }))
}

fn parse_wpscan(output: &str) -> Option<JsonValue> {
    let mut findings = Vec::new();

    // Find interesting entries
    for line in output.lines() {
        if line.contains("[!]") || line.contains("[+]") {
            let severity = if line.to_lowercase().contains("vulnerability") || line.to_lowercase().contains("exploit") {
                "high"
            } else if line.contains("[!]") {
                "medium"
            } else {
                "info"
            };
            findings.push(json!({
                "description": line.trim().trim_start_matches("[!]").trim_start_matches("[+]").trim(),
                "severity": severity
            }));
        }
    }

    let high = findings.iter().filter(|f| f["severity"] == "high").count();
    let medium = findings.iter().filter(|f| f["severity"] == "medium").count();

    Some(json!({
        "summary": {
            "total": findings.len(),
            "critical": 0,
            "high": high,
            "medium": medium,
            "low": 0,
            "open_ports": 0
        },
        "findings": findings
    }))
}

fn parse_generic(output: &str) -> Option<JsonValue> {
    if output.trim().is_empty() {
        return None;
    }

    let lines: Vec<&str> = output.lines().collect();
    let total = lines.len();

    // Count potential findings by heuristic
    let warning_count = lines.iter().filter(|l| {
        let lower = l.to_lowercase();
        lower.contains("warning") || lower.contains("vuln") || lower.contains("risk") || lower.contains("critical") || lower.contains("error")
    }).count();

    Some(json!({
        "summary": {
            "total": warning_count,
            "critical": 0, "high": 0, "medium": 0,
            "low": warning_count, "open_ports": 0
        },
        "raw_lines": total
    }))
}

// ── New Parsers ────────────────────────────────────────────

fn parse_subdomain_enum(output: &str) -> Option<JsonValue> {
    let mut subdomains: Vec<String> = Vec::new();
    let host_re = Regex::new(r"(?i)([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}").ok()?;
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with('[') { continue; }
        if let Some(m) = host_re.find(line) {
            let host = m.as_str().to_string();
            if !subdomains.contains(&host) { subdomains.push(host); }
        }
    }
    Some(json!({
        "summary": {"total": subdomains.len(), "critical": 0, "high": 0, "medium": 0, "low": subdomains.len(), "open_ports": 0},
        "subdomains": subdomains
    }))
}

fn parse_theharvester(output: &str) -> Option<JsonValue> {
    let mut emails: Vec<String> = Vec::new();
    let mut hosts: Vec<String> = Vec::new();
    let mut ips: Vec<String> = Vec::new();
    let email_re = Regex::new(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}").ok()?;
    let ip_re = Regex::new(r"\b(\d{1,3}\.){3}\d{1,3}\b").ok()?;
    let host_re = Regex::new(r"(?i)([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}").ok()?;
    for line in output.lines() {
        if let Some(m) = email_re.find(line) {
            let e = m.as_str().to_string();
            if !emails.contains(&e) { emails.push(e); }
        } else if let Some(m) = ip_re.find(line) {
            let ip = m.as_str().to_string();
            if !ips.contains(&ip) { ips.push(ip); }
        } else if let Some(m) = host_re.find(line) {
            let h = m.as_str().to_string();
            if !hosts.contains(&h) { hosts.push(h); }
        }
    }
    let total = emails.len() + hosts.len() + ips.len();
    Some(json!({
        "summary": {"total": total, "critical": 0, "high": 0, "medium": 0, "low": total, "open_ports": 0},
        "emails": emails, "hosts": hosts, "ips": ips
    }))
}

fn parse_masscan(output: &str) -> Option<JsonValue> {
    let mut open_ports: Vec<JsonValue> = Vec::new();
    let re = Regex::new(r"Discovered open port (\d+)/(tcp|udp) on ([\d.]+)").ok()?;
    for line in output.lines() {
        if let Some(caps) = re.captures(line) {
            open_ports.push(json!({
                "port": caps[1].parse::<u16>().unwrap_or(0),
                "protocol": &caps[2], "ip": &caps[3], "state": "open"
            }));
        }
    }
    Some(json!({
        "summary": {"total": open_ports.len(), "critical": 0, "high": 0, "medium": 0, "low": open_ports.len(), "open_ports": open_ports.len()},
        "open_ports": open_ports
    }))
}

fn parse_brute_force(output: &str) -> Option<JsonValue> {
    let mut credentials: Vec<JsonValue> = Vec::new();
    let hydra_re = Regex::new(r"\[(\d+)\]\[(\w+)\] host: ([\S]+)\s+login: (\S+)\s+password: (\S+)").ok()?;
    let medusa_re = Regex::new(r"ACCOUNT FOUND.*Host: (\S+) User: (\S+) Password: (\S+)").ok()?;
    for line in output.lines() {
        if let Some(caps) = hydra_re.captures(line) {
            credentials.push(json!({"port": &caps[1], "service": &caps[2], "host": &caps[3], "username": &caps[4], "password": &caps[5], "severity": "critical"}));
        } else if let Some(caps) = medusa_re.captures(line) {
            credentials.push(json!({"host": &caps[1], "username": &caps[2], "password": &caps[3], "severity": "critical"}));
        }
    }
    Some(json!({
        "summary": {"total": credentials.len(), "critical": credentials.len(), "high": 0, "medium": 0, "low": 0, "open_ports": 0},
        "credentials_found": credentials
    }))
}

fn parse_smb(output: &str) -> Option<JsonValue> {
    let mut shares: Vec<JsonValue> = Vec::new();
    let mut findings: Vec<JsonValue> = Vec::new();
    let share_re = Regex::new(r"(?i)\s+(\S+)\s+(READ|WRITE|NO ACCESS|READ, WRITE)").ok()?;
    for line in output.lines() {
        if let Some(caps) = share_re.captures(line) {
            let access = &caps[2];
            let severity = if access.contains("WRITE") { "high" } else if access.contains("READ") { "medium" } else { "info" };
            shares.push(json!({"share": &caps[1], "access": access, "severity": severity}));
        }
        if line.contains("[+]") {
            findings.push(json!({"description": line.trim().trim_start_matches("[+]").trim(), "severity": "info"}));
        }
    }
    let high = shares.iter().filter(|s| s["severity"] == "high").count();
    let medium = shares.iter().filter(|s| s["severity"] == "medium").count();
    Some(json!({
        "summary": {"total": shares.len() + findings.len(), "critical": 0, "high": high, "medium": medium, "low": 0, "open_ports": 0},
        "shares": shares, "findings": findings
    }))
}

fn parse_testssl(output: &str) -> Option<JsonValue> {
    let mut findings: Vec<JsonValue> = Vec::new();
    let vuln_re = Regex::new(r"(?i)(VULNERABLE|NOT ok|WARN|CRITICAL)").ok()?;
    let ok_re = Regex::new(r"(?i)(not vulnerable|OK|offered)").ok()?;
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') { continue; }
        if vuln_re.is_match(line) && !ok_re.is_match(line) {
            let severity = if line.to_lowercase().contains("critical") { "critical" }
                else if line.to_lowercase().contains("vulnerable") { "high" }
                else { "medium" };
            findings.push(json!({"description": line, "severity": severity}));
        }
    }
    let critical = findings.iter().filter(|f| f["severity"] == "critical").count();
    let high = findings.iter().filter(|f| f["severity"] == "high").count();
    let medium = findings.iter().filter(|f| f["severity"] == "medium").count();
    Some(json!({
        "summary": {"total": findings.len(), "critical": critical, "high": high, "medium": medium, "low": 0, "open_ports": 0},
        "findings": findings
    }))
}

fn parse_wapiti(output: &str) -> Option<JsonValue> {
    let mut findings: Vec<JsonValue> = Vec::new();
    let section_re = Regex::new(r"---\s+(.+?)\s+---").ok()?;
    let vuln_re = Regex::new(r"(?i)(Found|Vulnerable|Injection|XSS|CSRF|Traversal)").ok()?;
    let mut current_type = String::new();
    for line in output.lines() {
        if let Some(caps) = section_re.captures(line) {
            current_type = caps[1].to_string();
        } else if vuln_re.is_match(line) {
            let severity = if line.to_lowercase().contains("sql") || line.to_lowercase().contains("injection") { "critical" }
                else if line.to_lowercase().contains("xss") { "high" }
                else { "medium" };
            findings.push(json!({"type": current_type.clone(), "description": line.trim(), "severity": severity}));
        }
    }
    let critical = findings.iter().filter(|f| f["severity"] == "critical").count();
    let high = findings.iter().filter(|f| f["severity"] == "high").count();
    Some(json!({
        "summary": {"total": findings.len(), "critical": critical, "high": high, "medium": 0, "low": 0, "open_ports": 0},
        "findings": findings
    }))
}

fn parse_dmitry(output: &str) -> Option<JsonValue> {
    let mut emails: Vec<String> = Vec::new();
    let mut subdomains: Vec<String> = Vec::new();
    let mut ports: Vec<JsonValue> = Vec::new();
    let email_re = Regex::new(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}").ok()?;
    let port_re = Regex::new(r"Port\s+(\d+)\s+tcp\s+open").ok()?;
    for line in output.lines() {
        if let Some(m) = email_re.find(line) {
            let e = m.as_str().to_string();
            if !emails.contains(&e) { emails.push(e); }
        }
        if let Some(caps) = port_re.captures(line) {
            ports.push(json!({"port": caps[1].parse::<u16>().unwrap_or(0), "state": "open"}));
        }
        if line.trim().starts_with("Found:") || (line.contains('.') && !line.contains(' ') && line.len() < 100) {
            let s = line.trim().to_string();
            if !subdomains.contains(&s) { subdomains.push(s); }
        }
    }
    let total = emails.len() + subdomains.len() + ports.len();
    Some(json!({
        "summary": {"total": total, "critical": 0, "high": 0, "medium": 0, "low": total, "open_ports": ports.len()},
        "emails": emails, "subdomains": subdomains, "open_ports": ports
    }))
}

fn parse_httpx(output: &str) -> Option<JsonValue> {
    let mut results: Vec<JsonValue> = Vec::new();
    let re = Regex::new(r"(https?://\S+)\s+\[(\d+)\](.*)").ok()?;
    for line in output.lines() {
        if let Some(caps) = re.captures(line) {
            let status: u16 = caps[2].parse().unwrap_or(0);
            results.push(json!({"url": &caps[1], "status_code": status, "extra": caps[3].trim(), "severity": "info"}));
        }
    }
    Some(json!({
        "summary": {"total": results.len(), "critical": 0, "high": 0, "medium": 0, "low": 0, "open_ports": 0},
        "results": results
    }))
}

fn parse_cme(output: &str) -> Option<JsonValue> {
    let mut findings: Vec<JsonValue> = Vec::new();
    let pwned_re = Regex::new(r"\[\+\].*\(Pwn3d!\)").ok()?;
    let success_re = Regex::new(r"\[\+\]\s+(\S+)\s+\d+\s+\S+\s+(.+)").ok()?;
    for line in output.lines() {
        if pwned_re.is_match(line) {
            findings.push(json!({"description": line.trim(), "severity": "critical"}));
        } else if success_re.is_match(line) && line.contains("[+]") {
            findings.push(json!({"description": line.trim(), "severity": "high"}));
        }
    }
    let critical = findings.iter().filter(|f| f["severity"] == "critical").count();
    let high = findings.iter().filter(|f| f["severity"] == "high").count();
    Some(json!({
        "summary": {"total": findings.len(), "critical": critical, "high": high, "medium": 0, "low": 0, "open_ports": 0},
        "findings": findings
    }))
}

// ── Verified-tier parsers (added) ──────────────────────────

fn sev_bucket(s: &str) -> &'static str {
    let l = s.to_lowercase();
    if l.contains("critical") { "critical" }
    else if l.contains("high") { "high" }
    else if l.contains("medium") || l.contains("moderate") { "medium" }
    else if l.contains("low") || l.contains("info") || l.contains("note") { "low" }
    else { "low" }
}

fn parse_vuln_findings(output: &str) -> Option<JsonValue> {
    // Generic vulnerability/finding extractor for trivy/grype/retire/bandit/semgrep/dalfox/ike-scan.
    let mut findings = Vec::new();
    let cve_re = Regex::new(r"CVE-\d{4}-\d{4,7}").ok()?;
    let sev_re = Regex::new(r"(?i)\b(CRITICAL|HIGH|MEDIUM|MODERATE|LOW|INFO|NOTE)\b").ok()?;
    for line in output.lines() {
        let t = line.trim();
        if t.is_empty() { continue; }
        let cve = cve_re.find(t).map(|m| m.as_str().to_string());
        let sev_match = sev_re.find(t).map(|m| m.as_str().to_string());
        if cve.is_some() || sev_match.is_some() {
            let severity = sev_match.as_deref().map(sev_bucket).unwrap_or("low");
            findings.push(json!({
                "cve": cve,
                "severity": severity,
                "description": t,
            }));
        }
    }
    let critical = findings.iter().filter(|f| f["severity"] == "critical").count();
    let high = findings.iter().filter(|f| f["severity"] == "high").count();
    let medium = findings.iter().filter(|f| f["severity"] == "medium").count();
    let low = findings.iter().filter(|f| f["severity"] == "low").count();
    Some(json!({
        "summary": {"total": findings.len(), "critical": critical, "high": high, "medium": medium, "low": low, "open_ports": 0},
        "findings": findings
    }))
}

fn parse_secret_findings(output: &str) -> Option<JsonValue> {
    // gitleaks-style: lines like "RuleID: ... File: path Line: N Secret: ..."
    let mut findings = Vec::new();
    let path_re = Regex::new(r"(?i)(File|Path)[:=]\s*([^\s,]+)").ok()?;
    let line_re = Regex::new(r"(?i)Line[:=]\s*(\d+)").ok()?;
    let rule_re = Regex::new(r"(?i)(RuleID|Rule|Description|Detector)[:=]\s*([^\n]+)").ok()?;
    for chunk in output.split("\n\n") {
        let has_secret = chunk.to_lowercase().contains("secret")
            || chunk.to_lowercase().contains("token")
            || chunk.to_lowercase().contains("api_key")
            || chunk.to_lowercase().contains("password");
        if !has_secret { continue; }
        let path = path_re.captures(chunk).map(|c| c[2].to_string());
        let line = line_re.captures(chunk).and_then(|c| c[1].parse::<u32>().ok());
        let rule = rule_re.captures(chunk).map(|c| c[2].trim().to_string());
        if path.is_some() || rule.is_some() {
            findings.push(json!({
                "severity": "high",
                "rule": rule,
                "file": path,
                "line": line,
                "description": chunk.lines().next().unwrap_or("").trim(),
            }));
        }
    }
    Some(json!({
        "summary": {"total": findings.len(), "critical": 0, "high": findings.len(), "medium": 0, "low": 0, "open_ports": 0},
        "findings": findings
    }))
}

fn parse_url_list(output: &str) -> Option<JsonValue> {
    // katana/hakrawler/gospider/gau/waybackurls/paramspider/arjun: one URL per line (or noisy text containing URLs)
    let mut urls: Vec<String> = Vec::new();
    let url_re = Regex::new(r"https?://\S+").ok()?;
    for line in output.lines() {
        for m in url_re.find_iter(line) {
            let u = m.as_str().trim_end_matches(&[',', ')', ']', '.', ';'][..]).to_string();
            if !urls.contains(&u) { urls.push(u); }
        }
    }
    Some(json!({
        "summary": {"total": urls.len(), "critical": 0, "high": 0, "medium": 0, "low": urls.len(), "open_ports": 0},
        "urls": urls
    }))
}

fn parse_iac_findings(output: &str) -> Option<JsonValue> {
    // kube-bench/kics/tfsec/checkov/terrascan/kubescape/scout-suite/cloudsploit/cloudfox/certipy
    let mut findings = Vec::new();
    let sev_re = Regex::new(r"(?i)\b(CRITICAL|HIGH|MEDIUM|LOW|INFO|PASS|FAIL|WARN)\b").ok()?;
    let id_re = Regex::new(r"(?i)\b([A-Z]{2,5}[-_]\d{2,5}|[A-Z]{2,4}\.[A-Z]{2,4}\.\d+)\b").ok()?;
    for line in output.lines() {
        let t = line.trim();
        if t.is_empty() { continue; }
        let sev = sev_re.find(t).map(|m| m.as_str().to_string());
        let id = id_re.find(t).map(|m| m.as_str().to_string());
        if sev.is_none() && id.is_none() { continue; }
        let raw = sev.as_deref().unwrap_or("");
        let severity = if raw.eq_ignore_ascii_case("FAIL") || raw.eq_ignore_ascii_case("WARN") {
            "medium"
        } else if raw.eq_ignore_ascii_case("PASS") {
            continue;
        } else {
            sev_bucket(raw)
        };
        findings.push(json!({
            "id": id,
            "severity": severity,
            "description": t,
        }));
    }
    let critical = findings.iter().filter(|f| f["severity"] == "critical").count();
    let high = findings.iter().filter(|f| f["severity"] == "high").count();
    let medium = findings.iter().filter(|f| f["severity"] == "medium").count();
    let low = findings.iter().filter(|f| f["severity"] == "low").count();
    Some(json!({
        "summary": {"total": findings.len(), "critical": critical, "high": high, "medium": medium, "low": low, "open_ports": 0},
        "findings": findings
    }))
}
