use regex::Regex;
use serde_json::{json, Value as JsonValue};

/// Parse tool output into structured findings.
pub fn parse_output(tool_name: &str, output: &str) -> Option<JsonValue> {
    match tool_name {
        "nmap" => parse_nmap(output),
        "nikto" => parse_nikto(output),
        "sqlmap" => parse_sqlmap(output),
        "nuclei" => parse_nuclei(output),
        "gobuster" | "dirb" | "ffuf" => parse_directory_scan(output),
        "sslscan" => parse_sslscan(output),
        "whatweb" => parse_whatweb(output),
        "wpscan" => parse_wpscan(output),
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
