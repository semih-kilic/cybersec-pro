use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::{self, Read};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Finding {
    pub id: String,
    pub title: String,
    pub severity: String, // "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"
    pub description: String,
    pub tool_source: String,
    pub host_or_target: String,
    pub port_or_service: Option<String>,
    pub cvss_score: Option<f32>,
    pub cve_id: Option<String>,
    pub recommendation: Option<String>,
    pub raw_evidence: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NormalizedReport {
    pub tool: String,
    pub target: String,
    pub total_findings: usize,
    pub critical_count: usize,
    pub high_count: usize,
    pub medium_count: usize,
    pub low_count: usize,
    pub info_count: usize,
    pub findings: Vec<Finding>,
    pub parsed_at: String,
}

pub fn parse_nmap_text(content: &str, target: &str) -> Vec<Finding> {
    let mut findings = Vec::new();
    let port_re = regex::Regex::new(r"(\d+)/(tcp|udp)\s+(\w+)\s+(.+)").unwrap();

    for line in content.lines() {
        if let Some(caps) = port_re.captures(line) {
            let port = caps.get(1).map_or("", |m| m.as_str());
            let proto = caps.get(2).map_or("", |m| m.as_str());
            let state = caps.get(3).map_or("", |m| m.as_str());
            let service = caps.get(4).map_or("", |m| m.as_str());

            if state == "open" {
                findings.push(Finding {
                    id: format!("NMAP-{}-{}", port, proto),
                    title: format!("Open Port: {}/{} ({})", port, proto, service),
                    severity: "INFO".to_string(),
                    description: format!("Discovered open port {}/{} running service {}", port, proto, service),
                    tool_source: "nmap".to_string(),
                    host_or_target: target.to_string(),
                    port_or_service: Some(format!("{}/{}", port, proto)),
                    cvss_score: None,
                    cve_id: None,
                    recommendation: Some("Ensure this service is intended to be publicly exposed and patched.".to_string()),
                    raw_evidence: Some(line.to_string()),
                    timestamp: Utc::now().to_rfc3339(),
                });
            }
        }
    }

    findings
}

pub fn parse_generic_output(content: &str, tool: &str, target: &str) -> Vec<Finding> {
    let mut findings = Vec::new();
    let mut finding_idx = 1;

    for line in content.lines() {
        let line_lower = line.to_lowercase();
        let (severity, is_match) = if line_lower.contains("critical") || line_lower.contains("vulnerable") || line_lower.contains("rce") {
            ("CRITICAL", true)
        } else if line_lower.contains("high") || line_lower.contains("sqli") || line_lower.contains("xss") {
            ("HIGH", true)
        } else if line_lower.contains("medium") || line_lower.contains("warning") || line_lower.contains("deprecated") {
            ("MEDIUM", true)
        } else if line_lower.contains("low") || line_lower.contains("header missing") {
            ("LOW", true)
        } else {
            ("", false)
        };

        if is_match {
            findings.push(Finding {
                id: format!("{}-FINDING-{}", tool.to_uppercase(), finding_idx),
                title: format!("{} Issue: {}", tool.to_uppercase(), line.chars().take(80).collect::<String>()),
                severity: severity.to_string(),
                description: line.to_string(),
                tool_source: tool.to_string(),
                host_or_target: target.to_string(),
                port_or_service: None,
                cvss_score: None,
                cve_id: None,
                recommendation: Some("Review findings and apply vendor security patches or hardening guidelines.".to_string()),
                raw_evidence: Some(line.to_string()),
                timestamp: Utc::now().to_rfc3339(),
            });
            finding_idx += 1;
        }
    }

    findings
}

pub fn normalize_findings(tool: &str, target: &str, findings: Vec<Finding>) -> NormalizedReport {
    let mut crit = 0;
    let mut high = 0;
    let mut med = 0;
    let mut low = 0;
    let mut info = 0;

    for f in &findings {
        match f.severity.as_str() {
            "CRITICAL" => crit += 1,
            "HIGH" => high += 1,
            "MEDIUM" => med += 1,
            "LOW" => low += 1,
            _ => info += 1,
        }
    }

    NormalizedReport {
        tool: tool.to_string(),
        target: target.to_string(),
        total_findings: findings.len(),
        critical_count: crit,
        high_count: high,
        medium_count: med,
        low_count: low,
        info_count: info,
        findings,
        parsed_at: Utc::now().to_rfc3339(),
    }
}

fn main() -> io::Result<()> {
    let args: Vec<String> = env::args().collect();
    let mut tool = "generic";
    let mut target = "target.local";
    let mut file_path: Option<String> = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--tool" => {
                if i + 1 < args.len() { tool = &args[i + 1]; i += 1; }
            }
            "--target" => {
                if i + 1 < args.len() { target = &args[i + 1]; i += 1; }
            }
            "--file" => {
                if i + 1 < args.len() { file_path = Some(args[i + 1].clone()); i += 1; }
            }
            _ => {}
        }
        i += 1;
    }

    let input_data = if let Some(path) = file_path {
        fs::read_to_string(Path::new(&path))?
    } else {
        let mut buffer = String::new();
        io::stdin().read_to_string(&mut buffer)?;
        buffer
    };

    let findings = match tool {
        "nmap" => parse_nmap_text(&input_data, target),
        _ => parse_generic_output(&input_data, tool, target),
    };

    let report = normalize_findings(tool, target, findings);
    let json_output = serde_json::to_string_pretty(&report).unwrap();
    println!("{}", json_output);

    Ok(())
}
