use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use validator::Validate;

/// Scan request from the Flask backend or API
#[derive(Debug, Deserialize, Validate)]
pub struct ScanRequest {
    /// Tool name (e.g., "nmap", "nikto", "sqlmap")
    #[validate(length(min = 1, max = 64))]
    pub tool: String,

    /// Target to scan (IP, domain, URL)
    #[validate(length(min = 1, max = 512))]
    pub target: String,

    /// Tool-specific parameters (validated per tool)
    pub params: Option<serde_json::Value>,

    /// User ID who initiated the scan
    pub user_id: Option<i64>,

    /// Scan profile (quick, standard, deep)
    #[validate(length(max = 32))]
    pub profile: Option<String>,

    /// Timeout in seconds (max 3600)
    #[validate(range(min = 5, max = 3600))]
    pub timeout: Option<u32>,
}

/// Scan status response
#[derive(Debug, Serialize, Clone)]
pub struct ScanStatus {
    pub scan_id: String,
    pub status: ScanState,
    pub tool: String,
    pub target: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub progress: u8, // 0-100
    pub exit_code: Option<i32>,
    pub error: Option<String>,
}

/// Scan state machine
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ScanState {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
    Timeout,
}

/// Allowed tools whitelist — prevents arbitrary command execution
pub const ALLOWED_TOOLS: &[&str] = &[
    "nmap", "nikto", "sqlmap", "gobuster", "dirb", "dirbuster",
    "wpscan", "hydra", "john", "hashcat", "masscan", "amass",
    "subfinder", "httpx", "nuclei", "ffuf", "feroxbuster",
    "whatweb", "wafw00f", "theHarvester", "dnsenum", "dnsrecon",
    "fierce", "whois", "dig", "nslookup", "traceroute",
    "sslscan", "testssl", "sslyze", "enum4linux",
    "smbclient", "rpcclient", "netcat", "socat",
    "searchsploit", "msfconsole", "burpsuite",
    "wireshark", "tshark", "tcpdump",
    "aircrack-ng", "airmon-ng", "airodump-ng",
    "john", "ophcrack", "cewl", "crunch",
    "maltego", "recon-ng", "spiderfoot",
    "beef-xss", "social-engineer-toolkit",
    "autopsy", "volatility", "binwalk",
    "steghide", "stegseek", "exiftool",
    "lynis", "chkrootkit", "rkhunter",
];

/// Dangerous argument patterns that should be rejected
pub const BLOCKED_PATTERNS: &[&str] = &[
    ";", "&&", "||", "|", "`", "$(", "${",
    "../", "/etc/shadow", "/etc/passwd",
    "rm -rf", "mkfs", "dd if=",
    "--script=", // nmap scripts need explicit allowlist
    "-oG -", // grepable output to stdout can be abused
];
