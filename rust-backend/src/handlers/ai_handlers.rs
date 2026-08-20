/// CyberSec Pro AI — Intelligent Assistant Handlers
///
/// Hybrid architecture:
///   1. Local intent classifier + tool catalog (instant, offline)
///   2. Optional LLM enrichment (OpenAI) when OPENAI_API_KEY is set
///
/// Endpoints:
///   POST /api/v1/ai/suggest-tools      - Recommend tools for a goal
///   POST /api/v1/ai/generate-command   - Build safe command for a tool/target
///   POST /api/v1/ai/playbook           - Multi-step workflow for a use case
///   POST /api/v1/ai/explain            - Plain-language tool/command explanation
///   POST /api/v1/ai/interpret-results  - Summarize scan findings
///   POST /api/v1/ai/validate-command   - Static safety analysis of a command
use axum::{extract::State, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::AppState;

// ══════════════════════════════════════════════════════════
// TOOL CATALOG (compact, kept in sync with frontend KB)
// ══════════════════════════════════════════════════════════

#[derive(Clone)]
struct ToolMeta {
    id: &'static str,
    name: &'static str,
    category: &'static str,
    target_types: &'static [&'static str],
    use_cases: &'static [&'static str],
    keywords: &'static [&'static str],
    example: &'static str,
    danger: u8, // 0=safe, 1=intrusive, 2=destructive
}

const TOOL_CATALOG: &[ToolMeta] = &[
    ToolMeta { id: "nmap", name: "Nmap", category: "Network Discovery",
        target_types: &["ip", "domain", "cidr"],
        use_cases: &["port scan", "service detection", "os fingerprint", "network discovery"],
        keywords: &["port", "scan", "service", "open ports", "tcp", "udp", "network"],
        example: "nmap -sV -sC -p- --min-rate 1000 {target}", danger: 1 },
    ToolMeta { id: "masscan", name: "Masscan", category: "Network Discovery",
        target_types: &["ip", "cidr"],
        use_cases: &["fast port scan", "internet-wide scan"],
        keywords: &["fast", "internet", "port", "scan", "large network"],
        example: "masscan -p1-65535 {target} --rate=10000", danger: 2 },
    ToolMeta { id: "nikto", name: "Nikto", category: "Web Vulnerability",
        target_types: &["url"],
        use_cases: &["web server audit", "common web vulnerabilities", "outdated software"],
        keywords: &["web", "server", "apache", "nginx", "iis", "vulnerability"],
        example: "nikto -h {target}", danger: 1 },
    ToolMeta { id: "nuclei", name: "Nuclei", category: "Web Vulnerability",
        target_types: &["url"],
        use_cases: &["template-based vulnerability scan", "cve check", "misconfiguration"],
        keywords: &["cve", "template", "misconfiguration", "exposed", "yaml"],
        example: "nuclei -u {target} -severity high,critical", danger: 1 },
    ToolMeta { id: "wpscan", name: "WPScan", category: "Web Vulnerability",
        target_types: &["url"],
        use_cases: &["wordpress audit", "wp plugin vulnerabilities", "wp user enumeration"],
        keywords: &["wordpress", "wp", "plugin", "theme"],
        example: "wpscan --url {target} --enumerate vp,u", danger: 1 },
    ToolMeta { id: "sqlmap", name: "SQLMap", category: "Web Exploitation",
        target_types: &["url"],
        use_cases: &["sql injection detection", "database extraction", "boolean blind"],
        keywords: &["sql", "injection", "sqli", "database", "mysql", "postgres"],
        example: "sqlmap -u \"{target}\" --batch --risk=2 --level=3", danger: 2 },
    ToolMeta { id: "gobuster", name: "Gobuster", category: "Content Discovery",
        target_types: &["url"],
        use_cases: &["directory bruteforce", "subdomain bruteforce", "vhost discovery"],
        keywords: &["directory", "bruteforce", "subdomain", "fuzz", "wordlist"],
        example: "gobuster dir -u {target} -w /usr/share/wordlists/dirb/common.txt", danger: 1 },
    ToolMeta { id: "ffuf", name: "ffuf", category: "Content Discovery",
        target_types: &["url"],
        use_cases: &["fast fuzzing", "parameter discovery", "vhost fuzz"],
        keywords: &["fuzz", "fast", "parameter", "directory"],
        example: "ffuf -u {target}/FUZZ -w /usr/share/wordlists/dirb/common.txt", danger: 1 },
    ToolMeta { id: "subfinder", name: "Subfinder", category: "Recon",
        target_types: &["domain"],
        use_cases: &["passive subdomain enumeration", "asset discovery", "bug bounty recon"],
        keywords: &["subdomain", "passive", "recon", "asset"],
        example: "subfinder -d {target} -all", danger: 0 },
    ToolMeta { id: "amass", name: "OWASP Amass", category: "Recon",
        target_types: &["domain"],
        use_cases: &["deep subdomain enumeration", "attack surface mapping"],
        keywords: &["subdomain", "asset", "recon", "intel"],
        example: "amass enum -d {target}", danger: 0 },
    ToolMeta { id: "httpx", name: "httpx", category: "Recon",
        target_types: &["url", "domain"],
        use_cases: &["http probing", "tech detection", "live host check"],
        keywords: &["http", "probe", "alive", "tech", "title"],
        example: "echo {target} | httpx -title -tech-detect -status-code", danger: 0 },
    ToolMeta { id: "sslscan", name: "sslscan", category: "Crypto / TLS",
        target_types: &["url", "domain"],
        use_cases: &["ssl/tls audit", "cipher check", "weak protocols"],
        keywords: &["ssl", "tls", "https", "cipher", "certificate"],
        example: "sslscan {target}", danger: 0 },
    ToolMeta { id: "testssl", name: "testssl.sh", category: "Crypto / TLS",
        target_types: &["url", "domain"],
        use_cases: &["comprehensive tls audit", "vulnerability tls (heartbleed, beast)"],
        keywords: &["tls", "ssl", "heartbleed", "beast", "freak"],
        example: "testssl.sh {target}", danger: 0 },
    ToolMeta { id: "hydra", name: "Hydra", category: "Brute Force",
        target_types: &["ip", "url", "domain"],
        use_cases: &["password bruteforce", "ssh/ftp/http auth attack"],
        keywords: &["bruteforce", "password", "login", "ssh", "ftp", "rdp"],
        example: "hydra -L users.txt -P pass.txt {target} ssh", danger: 2 },
    ToolMeta { id: "metasploit", name: "Metasploit", category: "Exploitation",
        target_types: &["ip", "url", "domain"],
        use_cases: &["exploit framework", "post-exploitation", "payload generation"],
        keywords: &["exploit", "payload", "shell", "cve", "rce"],
        example: "msfconsole -q -x \"use exploit/...; set RHOSTS {target}; run\"", danger: 2 },
    ToolMeta { id: "zap", name: "OWASP ZAP", category: "Web Vulnerability",
        target_types: &["url"],
        use_cases: &["web app dynamic scan", "active scan", "spider crawl"],
        keywords: &["dast", "web", "owasp", "spider", "active scan"],
        example: "zap-cli quick-scan {target}", danger: 1 },
    ToolMeta { id: "burpsuite", name: "Burp Suite", category: "Web Vulnerability",
        target_types: &["url"],
        use_cases: &["web proxy", "manual testing", "request manipulation"],
        keywords: &["proxy", "intercept", "web", "manual"],
        example: "burpsuite (interactive)", danger: 1 },
    ToolMeta { id: "trivy", name: "Trivy", category: "Container Security",
        target_types: &["image", "repository"],
        use_cases: &["container vulnerability scan", "iac misconfig", "secret scan"],
        keywords: &["docker", "container", "image", "kubernetes", "iac"],
        example: "trivy image {target}", danger: 0 },
    ToolMeta { id: "gitleaks", name: "Gitleaks", category: "Secret Scan",
        target_types: &["repository"],
        use_cases: &["leaked secrets in git history", "api key detection"],
        keywords: &["secret", "git", "credential", "leak", "api key"],
        example: "gitleaks detect --source {target}", danger: 0 },
    ToolMeta { id: "trufflehog", name: "TruffleHog", category: "Secret Scan",
        target_types: &["repository", "url"],
        use_cases: &["deep secret scan", "verified secrets"],
        keywords: &["secret", "credential", "verified", "high entropy"],
        example: "trufflehog git {target}", danger: 0 },
    ToolMeta { id: "sherlock", name: "Sherlock", category: "OSINT",
        target_types: &["username"],
        use_cases: &["username enumeration across social networks"],
        keywords: &["osint", "username", "social", "user"],
        example: "sherlock {target}", danger: 0 },
    ToolMeta { id: "theharvester", name: "theHarvester", category: "OSINT",
        target_types: &["domain"],
        use_cases: &["email harvesting", "subdomain osint", "employee enumeration"],
        keywords: &["email", "osint", "domain", "employees"],
        example: "theHarvester -d {target} -b all", danger: 0 },
    ToolMeta { id: "shodan", name: "Shodan CLI", category: "OSINT",
        target_types: &["ip", "domain"],
        use_cases: &["exposed services lookup", "internet asset intel"],
        keywords: &["shodan", "exposed", "internet", "iot"],
        example: "shodan host {target}", danger: 0 },
    ToolMeta { id: "wireshark", name: "Wireshark / tshark", category: "Forensics",
        target_types: &["pcap"],
        use_cases: &["packet analysis", "protocol forensics"],
        keywords: &["pcap", "packet", "network", "forensic"],
        example: "tshark -r {target} -Y http", danger: 0 },
    ToolMeta { id: "volatility", name: "Volatility", category: "Forensics",
        target_types: &["file"],
        use_cases: &["memory forensics", "process analysis", "malware artifact"],
        keywords: &["memory", "ram", "forensic", "malware"],
        example: "volatility -f {target} pslist", danger: 0 },
    ToolMeta { id: "john", name: "John the Ripper", category: "Cracking",
        target_types: &["file"],
        use_cases: &["password hash cracking", "wordlist attack"],
        keywords: &["crack", "hash", "password", "wordlist"],
        example: "john --wordlist=rockyou.txt {target}", danger: 1 },
    ToolMeta { id: "hashcat", name: "Hashcat", category: "Cracking",
        target_types: &["file"],
        use_cases: &["gpu hash cracking", "fast password recovery"],
        keywords: &["hash", "crack", "gpu", "password"],
        example: "hashcat -m 0 {target} rockyou.txt", danger: 1 },
];

fn search_tools(query: &str, target_type: Option<&str>) -> Vec<&'static ToolMeta> {
    // Normalize the query and translate a small set of common Turkish keywords
    // to English so non-English prompts ("ilk olarak hangi araç ile başlamalıyım")
    // can still find matches against the (English) tool keyword vocabulary.
    let q_raw = query.to_lowercase();
    let q = translate_query_to_english(&q_raw);

    let mut scored: Vec<(i32, &ToolMeta)> = TOOL_CATALOG.iter().map(|t| {
        let mut score = 0;
        for kw in t.keywords { if q.contains(*kw) { score += 3; } }
        for uc in t.use_cases { if q.contains(uc) || uc.split_whitespace().any(|w| q.contains(w) && w.len() > 3) { score += 2; } }
        if q.contains(&t.name.to_lowercase()) { score += 5; }
        if q.contains(t.category.split('/').next().unwrap_or("").trim().to_lowercase().as_str()) { score += 1; }
        if let Some(tt) = target_type { if t.target_types.contains(&tt) { score += 2; } }
        (score, t)
    }).collect();
    scored.sort_by(|a, b| b.0.cmp(&a.0));
    let matched: Vec<&ToolMeta> = scored.into_iter().filter(|(s, _)| *s > 0).take(8).map(|(_, t)| t).collect();
    if !matched.is_empty() {
        return matched;
    }

    // Fallback: query had no recognisable keywords (e.g. "ilk olarak hangi
    // araç ile başlamalıyım" / "what should I start with"). Surface a curated
    // "getting started" set so the user isn't left with an empty result.
    let starter_ids = ["subfinder", "httpx", "nmap", "nuclei", "nikto", "ffuf"];
    let mut starters: Vec<&ToolMeta> = starter_ids
        .iter()
        .filter_map(|id| TOOL_CATALOG.iter().find(|t| &t.id == id))
        .collect();
    if let Some(tt) = target_type {
        starters.retain(|t| t.target_types.contains(&tt));
    }
    if starters.is_empty() {
        // Fall back to the first 6 catalog entries if even the starter list
        // got filtered out by an unusual target_type.
        return TOOL_CATALOG.iter().take(6).collect();
    }
    starters
}

/// Cheap-and-cheerful keyword translator. We do NOT want to ship a full i18n
/// dictionary — only enough Turkish (and a handful of common European)
/// pentest-vocabulary words to map onto the English keyword catalog.
fn translate_query_to_english(q: &str) -> String {
    const PAIRS: &[(&str, &str)] = &[
        // Turkish → English
        ("başlamalıyım", "start"),
        ("başlangıç", "start"),
        ("başla", "start"),
        ("hangi araç", "tool"),
        ("araç", "tool"),
        ("ilk olarak", "start"),
        ("ilk", "start"),
        ("nasıl", "how"),
        ("tarama", "scan"),
        ("tara", "scan"),
        ("zafiyet", "vulnerability"),
        ("zayıflık", "vulnerability"),
        ("güvenlik", "security"),
        ("açık", "open"),
        ("port", "port"),
        ("alt alan", "subdomain"),
        ("altalan", "subdomain"),
        ("alan adı", "domain"),
        ("parola", "password"),
        ("şifre", "password"),
        ("kırma", "crack"),
        ("kırıcı", "crack"),
        ("brute force", "bruteforce"),
        ("kaba kuvvet", "bruteforce"),
        ("web uygulaması", "web"),
        ("web sitesi", "web"),
        ("site", "web"),
        ("sızma testi", "pentest"),
        ("sızma", "pentest"),
        ("ağ", "network"),
        ("kablosuz", "wireless"),
        ("wifi", "wifi"),
        ("oltalama", "phishing"),
        ("kimlik avı", "phishing"),
        ("sertifika", "certificate"),
        ("ssl", "ssl"),
        ("api", "api"),
        ("bulut", "cloud"),
        ("konteyner", "container"),
        ("mobil", "mobile"),
        ("android", "android"),
        ("ios", "ios"),
        // German / Spanish / French — trivial common nouns
        ("werkzeug", "tool"),
        ("herramienta", "tool"),
        ("outil", "tool"),
        ("scannen", "scan"),
        ("escanear", "scan"),
        ("scanner", "scan"),
    ];
    let mut out = q.to_string();
    for (from, to) in PAIRS {
        if out.contains(from) {
            out.push(' ');
            out.push_str(to);
        }
    }
    out
}

fn tool_to_json(t: &ToolMeta) -> Value {
    json!({
        "id": t.id, "name": t.name, "category": t.category,
        "target_types": t.target_types, "use_cases": t.use_cases,
        "example_command": t.example, "danger_level": t.danger,
    })
}

// ══════════════════════════════════════════════════════════
// COMMAND SAFETY VALIDATOR
// ══════════════════════════════════════════════════════════

const DANGER_PATTERNS: &[(&str, &str)] = &[
    ("rm -rf /", "Recursive root deletion"),
    ("rm -rf /*", "Recursive deletion of root contents"),
    (":(){:|:&};:", "Fork bomb"),
    ("> /dev/sda", "Direct disk write"),
    ("dd if=/dev/zero", "Disk wipe"),
    ("mkfs.", "Filesystem format"),
    ("/etc/passwd", "Sensitive file access"),
    ("/etc/shadow", "Sensitive file access"),
    ("curl | sh", "Remote script execution"),
    ("curl | bash", "Remote script execution"),
    ("wget | sh", "Remote script execution"),
    ("eval $(", "Dynamic code evaluation"),
    ("chmod 777 /", "Insecure permission change"),
    ("$(rm", "Embedded destructive command"),
    ("`rm", "Embedded destructive command"),
    ("--no-preserve-root", "Root protection bypass"),
    ("nc -l", "Listener / backdoor"),
    ("/bin/sh -i", "Interactive shell"),
];

fn validate_command(cmd: &str) -> Value {
    let mut warnings = Vec::new();
    let lower = cmd.to_lowercase();
    for (pat, reason) in DANGER_PATTERNS {
        if lower.contains(&pat.to_lowercase()) {
            warnings.push(json!({"pattern": pat, "reason": reason, "severity": "critical"}));
        }
    }
    let intrusive_kw = ["bruteforce", "exploit", "payload", "reverse shell", "metasploit", "hydra", "sqlmap"];
    for kw in intrusive_kw {
        if lower.contains(kw) {
            warnings.push(json!({"pattern": kw, "reason": "Intrusive / offensive operation", "severity": "warning"}));
        }
    }
    let safe = warnings.iter().all(|w| w.get("severity").and_then(|s| s.as_str()) != Some("critical"));
    json!({
        "command": cmd,
        "safe": safe,
        "warnings": warnings,
        "verdict": if !safe { "blocked" } else if !warnings.is_empty() { "review" } else { "ok" },
    })
}

// ══════════════════════════════════════════════════════════
// LLM (OpenAI) — optional enrichment
// ══════════════════════════════════════════════════════════

async fn llm_enrich(system: &str, user: &str) -> Option<String> {
    let api_key = std::env::var("OPENAI_API_KEY").ok()?;
    if api_key.is_empty() { return None; }
    let model = std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o-mini".into());
    let body = json!({
        "model": model,
        "temperature": 0.3,
        "max_tokens": 800,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    });
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(20)).build().ok()?;
    let resp = client.post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(&api_key)
        .json(&body)
        .send().await.ok()?;
    let v: Value = resp.json().await.ok()?;
    v["choices"][0]["message"]["content"].as_str().map(|s| s.to_string())
}

// ══════════════════════════════════════════════════════════
// HANDLERS
// ══════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct SuggestRequest {
    pub query: String,
    pub target_type: Option<String>,
    #[serde(default)]
    pub use_llm: bool,
}

pub async fn suggest_tools(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<SuggestRequest>,
) -> impl IntoResponse {
    let local_tools = search_tools(&req.query, req.target_type.as_deref());

    // DB-augmented suggestions: search the tools table for matches not in the
    // hard-coded catalog (covers the 1500+ seeded tools).
    let q_lower = req.query.to_lowercase();
    let db_rows: Vec<(String, String, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT id, name, category, description, example_usage FROM tools \
         WHERE is_active = TRUE \
           AND (LOWER(name) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(category) LIKE $1 \
                OR LOWER(business_name) LIKE $1 OR LOWER(business_description) LIKE $1) \
           AND ($2 = '' OR target_type IS NULL OR $2 = ANY(STRING_TO_ARRAY(LOWER(target_type), ',')))\
         ORDER BY name ASC LIMIT 20"
    )
    .bind(format!("%{}%", q_lower))
    .bind(req.target_type.as_deref().unwrap_or(""))
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    // Merge: local catalog first (scored), then DB extras not already present
    let local_ids: std::collections::HashSet<&str> = local_tools.iter().map(|t| t.id).collect();
    let mut suggestions: Vec<Value> = local_tools.iter().map(|t| tool_to_json(t)).collect();

    for (id, name, category, description, example) in &db_rows {
        if local_ids.contains(id.as_str()) { continue; }
        suggestions.push(json!({
            "id": id,
            "name": name,
            "category": category,
            "target_types": [],
            "use_cases": description.as_deref().unwrap_or("").split('.').take(2).collect::<Vec<_>>(),
            "example_command": example.as_deref().unwrap_or(""),
            "danger_level": 1,
            "source": "db",
        }));
    }

    let mut llm_explanation: Option<String> = None;
    if req.use_llm && !suggestions.is_empty() {
        let names: Vec<&str> = local_tools.iter().map(|t| t.name).chain(
            db_rows.iter().map(|(_, n, _, _, _)| n.as_str())
        ).take(8).collect();
        let sys = "You are a senior penetration tester. Briefly explain in 2-3 sentences WHY these tools fit the user's goal and how they complement each other.";
        let usr = format!("User goal: {}\nSuggested tools: {}", req.query, names.join(", "));
        llm_explanation = llm_enrich(sys, &usr).await;
    }

    Json(json!({
        "query": req.query,
        "suggestions": suggestions,
        "explanation": llm_explanation,
        "source": if llm_explanation.is_some() { "hybrid" } else if !db_rows.is_empty() { "db+local" } else { "local" },
    })).into_response()
}

#[derive(Deserialize)]
pub struct CommandRequest {
    pub tool_id: String,
    pub target: String,
    #[serde(default)]
    pub options: serde_json::Map<String, Value>,
}

pub async fn generate_command(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CommandRequest>,
) -> impl IntoResponse {
    let tool = TOOL_CATALOG.iter().find(|t| t.id == req.tool_id);
    let Some(t) = tool else {
        return Json(json!({"error": "Unknown tool", "tool_id": req.tool_id})).into_response();
    };
    let cmd = t.example.replace("{target}", &req.target);
    let safety = validate_command(&cmd);
    Json(json!({
        "tool": tool_to_json(t),
        "command": cmd,
        "safety": safety,
        "ready_to_run": safety["verdict"] != "blocked",
    })).into_response()
}

#[derive(Deserialize)]
pub struct PlaybookRequest {
    pub goal: String,
    pub target: String,
    #[serde(default)]
    pub use_llm: bool,
}

pub async fn generate_playbook(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(req): Json<PlaybookRequest>,
) -> impl IntoResponse {
    let goal_l = req.goal.to_lowercase();

    // Hard-coded high-value playbooks — picked by goal keywords
    let steps: Vec<Value> = if goal_l.contains("bug bounty") || goal_l.contains("recon") {
        vec![
            json!({"order": 1, "tool": "subfinder", "purpose": "Passive subdomain enumeration", "command": format!("subfinder -d {} -all -silent", req.target)}),
            json!({"order": 2, "tool": "amass",     "purpose": "Active asset discovery",        "command": format!("amass enum -d {}", req.target)}),
            json!({"order": 3, "tool": "httpx",     "purpose": "Probe live hosts + tech",       "command": format!("httpx -title -tech-detect -status-code")}),
            json!({"order": 4, "tool": "nuclei",    "purpose": "Template-based vuln scan",      "command": format!("nuclei -severity high,critical")}),
            json!({"order": 5, "tool": "ffuf",      "purpose": "Content fuzzing on findings",   "command": format!("ffuf -u FUZZ -w wordlist.txt")}),
        ]
    } else if goal_l.contains("wordpress") || goal_l.contains("wp") {
        vec![
            json!({"order": 1, "tool": "wpscan",  "purpose": "WP version + plugin enum",        "command": format!("wpscan --url {} --enumerate vp,u", req.target)}),
            json!({"order": 2, "tool": "nuclei",  "purpose": "WordPress CVE templates",         "command": format!("nuclei -u {} -tags wordpress", req.target)}),
            json!({"order": 3, "tool": "nikto",   "purpose": "Generic web server audit",        "command": format!("nikto -h {}", req.target)}),
        ]
    } else if goal_l.contains("internal") || goal_l.contains("network") || goal_l.contains("infrastructure") {
        vec![
            json!({"order": 1, "tool": "nmap",     "purpose": "Service & version discovery",   "command": format!("nmap -sV -sC -p- {}", req.target)}),
            json!({"order": 2, "tool": "masscan",  "purpose": "Fast wide-port confirmation",   "command": format!("masscan -p1-65535 {} --rate=5000", req.target)}),
            json!({"order": 3, "tool": "nuclei",   "purpose": "CVE detection on services",     "command": format!("nuclei -severity high,critical")}),
        ]
    } else if goal_l.contains("ssl") || goal_l.contains("tls") || goal_l.contains("certificate") {
        vec![
            json!({"order": 1, "tool": "sslscan", "purpose": "Cipher & protocol overview", "command": format!("sslscan {}", req.target)}),
            json!({"order": 2, "tool": "testssl", "purpose": "Deep TLS vulnerability audit", "command": format!("testssl.sh {}", req.target)}),
        ]
    } else if goal_l.contains("api") {
        vec![
            json!({"order": 1, "tool": "httpx",   "purpose": "API probe + headers",         "command": format!("httpx -u {} -title -tech-detect", req.target)}),
            json!({"order": 2, "tool": "nuclei",  "purpose": "API CVE & misconfig",         "command": format!("nuclei -u {} -tags api", req.target)}),
            json!({"order": 3, "tool": "ffuf",    "purpose": "Endpoint discovery",          "command": format!("ffuf -u {}/FUZZ -w api-wordlist.txt", req.target)}),
        ]
    } else if goal_l.contains("secret") || goal_l.contains("leak") || goal_l.contains("git") {
        vec![
            json!({"order": 1, "tool": "gitleaks",   "purpose": "Git history secret scan",    "command": format!("gitleaks detect --source {}", req.target)}),
            json!({"order": 2, "tool": "trufflehog", "purpose": "Verified secret detection",  "command": format!("trufflehog git {}", req.target)}),
        ]
    } else {
        // Fallback — use top-3 from suggest_tools
        let tools = search_tools(&req.goal, None);
        tools.iter().take(3).enumerate().map(|(i, t)| json!({
            "order": i+1, "tool": t.id, "purpose": t.use_cases.first().unwrap_or(&"general"),
            "command": t.example.replace("{target}", &req.target),
        })).collect()
    };

    let mut llm_summary: Option<String> = None;
    if req.use_llm && !steps.is_empty() {
        let sys = "You are a red team operator. In 2-3 sentences explain why this playbook ordering is effective.";
        let usr = format!("Goal: {}\nTarget: {}\nSteps: {}", req.goal, req.target,
            steps.iter().map(|s| s["tool"].as_str().unwrap_or("")).collect::<Vec<_>>().join(" → "));
        llm_summary = llm_enrich(sys, &usr).await;
    }

    Json(json!({
        "goal": req.goal,
        "target": req.target,
        "steps": steps,
        "rationale": llm_summary,
    })).into_response()
}

#[derive(Deserialize)]
pub struct ExplainRequest {
    pub tool_id: Option<String>,
    pub command: Option<String>,
    #[serde(default)]
    pub use_llm: bool,
}

pub async fn explain(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(req): Json<ExplainRequest>,
) -> impl IntoResponse {
    if let Some(tid) = &req.tool_id {
        if let Some(t) = TOOL_CATALOG.iter().find(|x| x.id == *tid) {
            let mut llm_text: Option<String> = None;
            if req.use_llm {
                let sys = "You are a security tools expert. Explain the tool clearly in 3-5 sentences: what it does, when to use it, when NOT to use it, and a typical caveat.";
                let usr = format!("Tool: {} ({})\nCategory: {}\nUse cases: {}", t.name, t.id, t.category, t.use_cases.join(", "));
                llm_text = llm_enrich(sys, &usr).await;
            }
            return Json(json!({
                "tool": tool_to_json(t),
                "summary": format!("{} — {}. Best for: {}.", t.name, t.category, t.use_cases.join(", ")),
                "deep_explanation": llm_text,
            })).into_response();
        }
    }
    if let Some(cmd) = &req.command {
        let safety = validate_command(cmd);
        let mut llm_text: Option<String> = None;
        if req.use_llm {
            let sys = "You are a Linux security expert. Explain this shell command in plain English, listing each flag and any side effects.";
            llm_text = llm_enrich(sys, cmd).await;
        }
        return Json(json!({
            "command": cmd,
            "safety": safety,
            "explanation": llm_text.unwrap_or_else(|| "Local explanation: run validate-command for static analysis. Enable use_llm=true for full breakdown.".into()),
        })).into_response();
    }
    Json(json!({"error": "Provide tool_id or command"})).into_response()
}

#[derive(Deserialize)]
pub struct InterpretRequest {
    pub findings: Value,
    #[serde(default)]
    pub use_llm: bool,
}

pub async fn interpret_results(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(req): Json<InterpretRequest>,
) -> impl IntoResponse {
    // Local: count by severity if findings is an array
    let mut counts = serde_json::Map::new();
    let mut total = 0u64;
    if let Some(arr) = req.findings.as_array() {
        total = arr.len() as u64;
        for f in arr {
            let sev = f.get("severity").and_then(|v| v.as_str()).unwrap_or("info").to_lowercase();
            *counts.entry(sev).or_insert(json!(0)) = json!(counts.get(&{
                let s = f.get("severity").and_then(|v| v.as_str()).unwrap_or("info").to_lowercase();
                s
            }).and_then(|v| v.as_u64()).unwrap_or(0) + 1);
        }
    }

    let mut llm_summary: Option<String> = None;
    if req.use_llm {
        let sys = "You are a senior security analyst. Summarize these scan findings in 4-6 sentences: highest risk items, common patterns, suggested remediation priority.";
        let usr = serde_json::to_string(&req.findings).unwrap_or_default();
        let usr = if usr.len() > 6000 { format!("{}…(truncated)", &usr[..6000]) } else { usr };
        llm_summary = llm_enrich(sys, &usr).await;
    }

    Json(json!({
        "total_findings": total,
        "severity_counts": counts,
        "summary": llm_summary.unwrap_or_else(|| {
            format!("Local summary: {} finding(s). Enable use_llm=true for analyst-grade interpretation.", total)
        }),
    })).into_response()
}

#[derive(Deserialize)]
pub struct ValidateRequest {
    pub command: String,
}

pub async fn validate(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(req): Json<ValidateRequest>,
) -> impl IntoResponse {
    Json(validate_command(&req.command)).into_response()
}

// Tool catalog read endpoint (for frontend bootstrap if KB JSON missing)
pub async fn list_tools(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let tools: Vec<Value> = TOOL_CATALOG.iter().map(tool_to_json).collect();
    Json(json!({"tools": tools, "total": tools.len()})).into_response()
}


// ══════════════════════════════════════════════════════════
// P6: AI Code Patch Generator
// ══════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct PatchRequest {
    pub vulnerability_type: String,
    pub language: String,
    pub code_snippet: Option<String>,
}

fn generate_sql_injection_fix(lang: &str) -> Value {
    match lang.to_lowercase().as_str() {
        "python" => json!({
            "patch": "# BEFORE (vulnerable):\nquery = f\"SELECT * FROM users WHERE name = '{user_input}'\"\n\n# AFTER (safe - parameterized query):\nquery = \"SELECT * FROM users WHERE name = %s\"\ncursor.execute(query, (user_input,))",
            "explanation": "Use parameterized queries (%s placeholders with tuple arguments) instead of string interpolation. This prevents SQL injection by separating SQL logic from data.",
            "severity": "critical"
        }),
        "javascript" | "nodejs" | "node" | "typescript" => json!({
            "patch": "// BEFORE (vulnerable):\nconst query = `SELECT * FROM users WHERE name = '${userInput}'`;\n\n// AFTER (safe - parameterized query):\nconst query = 'SELECT * FROM users WHERE name = ?';\ndb.execute(query, [userInput]);",
            "explanation": "Use parameterized queries with ? placeholders and array arguments. Never interpolate user input into SQL strings.",
            "severity": "critical"
        }),
        "php" => json!({
            "patch": "// BEFORE (vulnerable):\n$query = \"SELECT * FROM users WHERE name = '$user_input'\";\n\n// AFTER (safe - prepared statement):\n$stmt = $pdo->prepare('SELECT * FROM users WHERE name = :name');\n$stmt->execute(['name' => $user_input]);",
            "explanation": "Use PDO prepared statements with named parameters. Never concatenate user input into SQL queries.",
            "severity": "critical"
        }),
        "go" => json!({
            "patch": "// BEFORE (vulnerable):\nquery := fmt.Sprintf(\"SELECT * FROM users WHERE name = '%s'\", userInput)\n\n// AFTER (safe - parameterized query):\nquery := \"SELECT * FROM users WHERE name = $1\"\nrow := db.QueryRow(query, userInput)",
            "explanation": "Use parameterized queries with $1, $2 placeholders and db.QueryRow/Query arguments.",
            "severity": "critical"
        }),
        "java" => json!({
            "patch": "// BEFORE (vulnerable):\nString query = \"SELECT * FROM users WHERE name = '\" + userInput + \"'\";\n\n// AFTER (safe - PreparedStatement):\nPreparedStatement stmt = conn.prepareStatement(\"SELECT * FROM users WHERE name = ?\");\nstmt.setString(1, userInput);",
            "explanation": "Use PreparedStatement with ? placeholders and setXxx() methods for each parameter.",
            "severity": "critical"
        }),
        _ => json!({
            "patch": "Use parameterized queries or prepared statements for all database interactions. Never interpolate user input directly into SQL strings.",
            "explanation": "SQL Injection is prevented by separating SQL logic from user-supplied data using parameterized queries.",
            "severity": "critical"
        }),
    }
}

fn generate_xss_fix(lang: &str) -> Value {
    match lang.to_lowercase().as_str() {
        "python" => json!({
            "patch": "# BEFORE (vulnerable):\nreturn f\"<div>{user_input}</div>\"\n\n# AFTER (safe - escaping):\nimport html\nsafe = html.escape(user_input)\nreturn f\"<div>{safe}</div>\"",
            "explanation": "HTML-escape all user input before rendering. Use html.escape() in Python, or template engines with auto-escaping enabled.",
            "severity": "high"
        }),
        "javascript" | "nodejs" | "node" | "typescript" => json!({
            "patch": "// BEFORE (vulnerable):\nelement.innerHTML = userInput;\n\n// AFTER (safe - use textContent or DOMPurify):\nelement.textContent = userInput;\n// Or for HTML: element.innerHTML = DOMPurify.sanitize(userInput);",
            "explanation": "Use textContent instead of innerHTML. If HTML is needed, sanitize with DOMPurify. Frameworks like React/Next.js auto-escape by default.",
            "severity": "high"
        }),
        "php" => json!({
            "patch": "<?php\n// BEFORE (vulnerable):\necho \"<div>$user_input</div>\";\n\n// AFTER (safe - htmlspecialchars):\necho \"<div>\" . htmlspecialchars($user_input, ENT_QUOTES, 'UTF-8') . \"</div>\";",
            "explanation": "Use htmlspecialchars() with ENT_QUOTES and UTF-8 encoding to escape all HTML entities.",
            "severity": "high"
        }),
        _ => json!({
            "patch": "Escape all user input before rendering in HTML. Use HTML entity encoding for attribute and element contexts.",
            "explanation": "XSS is prevented by encoding user input as text rather than HTML before rendering in the browser.",
            "severity": "high"
        }),
    }
}

fn generate_ssrf_fix(lang: &str) -> Value {
    match lang.to_lowercase().as_str() {
        "python" => json!({
            "patch": "# BEFORE (vulnerable):\nresponse = requests.get(user_url)\n\n# AFTER (safe - URL validation):\nfrom urllib.parse import urlparse\nimport ipaddress\n\ndef is_safe_url(url, allowed_hosts=None):\n    parsed = urlparse(url)\n    if parsed.scheme not in ('http', 'https'):\n        return False\n    if allowed_hosts and parsed.hostname not in allowed_hosts:\n        return False\n    # Block internal IPs\n    try:\n        ip = ipaddress.ip_address(parsed.hostname)\n        if ip.is_private or ip.is_loopback or ip.is_reserved:\n            return False\n    except ValueError:\n        pass\n    return True\n\nif is_safe_url(user_url):\n    response = requests.get(user_url, timeout=10)",
            "explanation": "Validate URLs against an allowlist of permitted hosts. Block private/internal IP ranges (10.x, 192.168.x, 127.x, etc.) and restrict to http/https schemes.",
            "severity": "critical"
        }),
        _ => json!({
            "patch": "Implement URL validation: 1) Restrict to http/https schemes, 2) Validate against allowed hostnames, 3) Block internal/private IP ranges, 4) Set connection timeouts.",
            "explanation": "SSRF is prevented by validating and restricting which URLs the server will fetch, blocking access to internal resources.",
            "severity": "critical"
        }),
    }
}

fn generate_path_traversal_fix(lang: &str) -> Value {
    match lang.to_lowercase().as_str() {
        "python" => json!({
            "patch": "# BEFORE (vulnerable):\nwith open(f'/uploads/{user_filename}') as f:\n    data = f.read()\n\n# AFTER (safe - path normalization):\nimport os\nsafe_dir = '/uploads'\nfilename = os.path.basename(user_filename)  # strip directory components\nsafe_path = os.path.normpath(os.path.join(safe_dir, filename))\nif not safe_path.startswith(safe_dir):\n    raise ValueError('Invalid path')\nwith open(safe_path) as f:\n    data = f.read()",
            "explanation": "Use os.path.basename() to strip directory components, os.path.normpath() to resolve ../ sequences, and verify the resulting path starts with the allowed directory.",
            "severity": "high"
        }),
        _ => json!({
            "patch": "Normalize the path with path.resolve(), verify it starts with the allowed base directory, and strip directory separators from user input.",
            "explanation": "Path traversal is prevented by validating that the resolved file path remains within the intended directory.",
            "severity": "high"
        }),
    }
}

fn generate_command_injection_fix(lang: &str) -> Value {
    match lang.to_lowercase().as_str() {
        "python" => json!({
            "patch": "# BEFORE (vulnerable):\nos.system(f'ping {user_input}')\n\n# AFTER (safe - use subprocess with list args):\nimport subprocess\nresult = subprocess.run(['ping', '-c', '1', user_input], capture_output=True, text=True, timeout=10)\n# NEVER use shell=True with user input\n\n# If shell is needed, use shlex.quote():\nimport shlex\nos.system(f'ping -c 1 {shlex.quote(user_input)}')",
            "explanation": "Use subprocess.run() with a list of arguments instead of shell=True. If shell syntax is required, use shlex.quote() to escape special characters.",
            "severity": "critical"
        }),
        _ => json!({
            "patch": "Never pass user input to shell commands. Use language-native process execution with argument arrays. If shell execution is unavoidable, properly escape all special characters.",
            "explanation": "Command injection is prevented by never passing unsanitized user input to shell interpreters.",
            "severity": "critical"
        }),
    }
}

fn generate_csrf_fix(lang: &str) -> Value {
    match lang.to_lowercase().as_str() {
        "javascript" | "nodejs" | "node" | "typescript" | "python" | "php" => json!({
            "patch": "// CSRF Token Implementation:\n// 1. Generate a random token per session\n// 2. Include it as a hidden field in forms\n// 3. Validate on server before processing\n\n// Frontend (HTML form):\n// <input type=\"hidden\" name=\"_csrf\" value=\"{session.csrfToken}\">\n\n// Backend validation:\n// if (req.body._csrf !== req.session.csrfToken) throw new Error('CSRF');\n\n// Or use SameSite cookie attribute:\n// Set-Cookie: session=...; SameSite=Strict; Secure; HttpOnly",
            "explanation": "Implement CSRF tokens (one-time-use tokens embedded in forms and validated server-side) or use SameSite=Strict cookie attribute to prevent cross-site request forgery.",
            "severity": "medium"
        }),
        _ => json!({
            "patch": "Add CSRF tokens to all state-changing forms and validate server-side. Use SameSite=Strict cookies for session management.",
            "explanation": "CSRF is prevented by requiring a unique token in each request that can only be obtained from the legitimate site.",
            "severity": "medium"
        }),
    }
}

fn generate_hardcoded_secrets_fix(lang: &str) -> Value {
    match lang.to_lowercase().as_str() {
        "python" | "javascript" | "nodejs" | "node" | "typescript" | "php" | "go" | "java" => json!({
            "patch": "# BEFORE (vulnerable - hardcoded secret):\nAPI_KEY = \"sk-abc123def456\"\nDB_PASSWORD = \"supersecret\"\n\n# AFTER (safe - environment variables):\nimport os\nAPI_KEY = os.environ.get('API_KEY')\nDB_PASSWORD = os.environ.get('DB_PASSWORD')\n\n# With validation:\nif not API_KEY:\n    raise ValueError('API_KEY environment variable is required')",
            "explanation": "Never hardcode secrets in source code. Use environment variables or a secrets manager (AWS Secrets Manager, HashiCorp Vault). Add .env to .gitignore and use dotenv for local development.",
            "severity": "high"
        }),
        _ => json!({
            "patch": "Move all secrets to environment variables or a secrets manager. Never commit secrets to version control.",
            "explanation": "Hardcoded secrets are a critical risk because they are visible in source code, version history, and can be easily extracted by attackers.",
            "severity": "high"
        }),
    }
}

#[derive(Serialize)]
pub struct PatchResponseData {
    pub patch: String,
    pub explanation: String,
    pub severity: String,
    pub vulnerability_type: String,
    pub language: String,
}

pub async fn generate_patch_handler(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<PatchRequest>,
) -> impl IntoResponse {
    let vuln = req.vulnerability_type.to_lowercase();
    let lang = req.language.to_lowercase();

    let result = match vuln.as_str() {
        "sql_injection" | "sqli" => generate_sql_injection_fix(&lang),
        "xss" | "cross_site_scripting" | "reflected_xss" | "stored_xss" => generate_xss_fix(&lang),
        "ssrf" | "server_side_request_forgery" => generate_ssrf_fix(&lang),
        "path_traversal" | "directory_traversal" | "lfi" | "rfi" => generate_path_traversal_fix(&lang),
        "command_injection" | "rce" | "remote_code_execution" => generate_command_injection_fix(&lang),
        "csrf" | "cross_site_request_forgery" => generate_csrf_fix(&lang),
        "hardcoded_secrets" | "hardcoded_credentials" | "exposed_secrets" => generate_hardcoded_secrets_fix(&lang),
        _ => json!({
            "patch": format!("No specific template for '{}' vulnerability. General advice: Follow OWASP Top 10 guidelines for {} and apply defense-in-depth principles.", vuln, vuln),
            "explanation": "Consult OWASP guidelines for best practices on this vulnerability type.",
            "severity": "medium"
        }),
    };

    Json(json!({
        "success": true,
        "data": {
            "patch": result["patch"],
            "explanation": result["explanation"],
            "severity": result["severity"],
            "vulnerability_type": req.vulnerability_type,
            "language": req.language,
        }
    }))
}

// ══════════════════════════════════════════════════════════
// P7: AI CVSS 4.0 Scoring
// ══════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct CvssRequest {
    pub attack_vector: Option<String>,
    pub attack_complexity: Option<String>,
    pub privileges_required: Option<String>,
    pub user_interaction: Option<String>,
    pub scope: Option<String>,
    pub confidentiality: Option<String>,
    pub integrity: Option<String>,
    pub availability: Option<String>,
    pub vulnerability_type: Option<String>,
}

fn cvss_av_metric(val: &str) -> f64 {
    match val.to_lowercase().as_str() {
        "n" | "network" => 0.85,
        "a" | "adjacent" => 0.62,
        "l" | "local" => 0.55,
        "p" | "physical" => 0.20,
        _ => 0.85,
    }
}

fn cvss_ac_metric(val: &str) -> f64 {
    match val.to_lowercase().as_str() {
        "l" | "low" => 0.77,
        "h" | "high" => 0.44,
        _ => 0.77,
    }
}

fn cvss_pr_metric(val: &str, scope_changed: bool) -> f64 {
    let v = val.to_lowercase();
    if scope_changed {
        match v.as_str() {
            "n" | "none" => 0.85,
            "l" | "low" => 0.68,
            "h" | "high" => 0.50,
            _ => 0.85,
        }
    } else {
        match v.as_str() {
            "n" | "none" => 0.85,
            "l" | "low" => 0.62,
            "h" | "high" => 0.27,
            _ => 0.85,
        }
    }
}

fn cvss_ui_metric(val: &str) -> f64 {
    match val.to_lowercase().as_str() {
        "n" | "none" => 0.85,
        "p" | "passive" => 0.62,
        "a" | "active" => 0.62,
        _ => 0.85,
    }
}

fn cvss_cia_metric(val: &str) -> f64 {
    match val.to_lowercase().as_str() {
        "h" | "high" => 0.56,
        "l" | "low" => 0.22,
        "n" | "none" => 0.0,
        _ => 0.0,
    }
}

fn abbreviate_metric(val: &str) -> String {
    let v = val.to_lowercase();
    match v.as_str() {
        "network" => "N".into(),
        "adjacent" => "A".into(),
        "local" => "L".into(),
        "physical" => "P".into(),
        "low" => "L".into(),
        "high" => "H".into(),
        "none" => "N".into(),
        "passive" => "P".into(),
        "active" => "A".into(),
        "changed" => "C".into(),
        "unchanged" => "U".into(),
        "n" | "a" | "l" | "p" | "h" | "c" | "u" => v.to_uppercase(),
        _ => v.chars().next().unwrap_or('X').to_uppercase().to_string(),
    }
}

fn severity_from_cvss(score: f64) -> &'static str {
    if score >= 9.0 { "critical" }
    else if score >= 7.0 { "high" }
    else if score >= 4.0 { "medium" }
    else if score > 0.0 { "low" }
    else { "none" }
}

fn calculate_cvss_score(
    av: &str, ac: &str, pr: &str, ui: &str,
    scope: &str, c: &str, i: &str, a: &str,
) -> (f64, String, String) {
    let scope_changed = scope.to_lowercase().starts_with('c');
    let av_w = cvss_av_metric(av);
    let ac_w = cvss_ac_metric(ac);
    let pr_w = cvss_pr_metric(pr, scope_changed);
    let ui_w = cvss_ui_metric(ui);
    let c_w = cvss_cia_metric(c);
    let i_w = cvss_cia_metric(i);
    let a_w = cvss_cia_metric(a);

    let iss = 1.0 - ((1.0 - c_w) * (1.0 - i_w) * (1.0 - a_w));
    let impact = if scope_changed {
        7.52 * (iss - 0.029) - 3.25 * ((iss - 0.02).powi(15))
    } else {
        6.42 * iss
    };

    let exploitability = 8.22 * av_w * ac_w * pr_w * ui_w;

    let score = if impact <= 0.0 {
        0.0
    } else if scope_changed {
        let raw = (impact + exploitability).min(10.0);
        (raw * 10.0).ceil() / 10.0
    } else {
        let raw = (impact + exploitability).min(10.0);
        (raw * 10.0).ceil() / 10.0
    };

    let score = (score * 10.0).ceil() / 10.0;

    let vector = format!(
        "CVSS:4.0/AV:{}/AC:{}/PR:{}/UI:{}/S:{}/C:{}/I:{}/A:{}",
        abbreviate_metric(av), abbreviate_metric(ac),
        abbreviate_metric(pr), abbreviate_metric(ui),
        abbreviate_metric(scope), abbreviate_metric(c),
        abbreviate_metric(i), abbreviate_metric(a),
    );

    (score, severity_from_cvss(score).to_string(), vector)
}

pub async fn cvss_score_handler(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CvssRequest>,
) -> impl IntoResponse {
    let av = req.attack_vector.as_deref().unwrap_or("network");
    let ac = req.attack_complexity.as_deref().unwrap_or("low");
    let pr = req.privileges_required.as_deref().unwrap_or("none");
    let ui = req.user_interaction.as_deref().unwrap_or("none");
    let scope = req.scope.as_deref().unwrap_or("unchanged");
    let c = req.confidentiality.as_deref().unwrap_or("none");
    let i = req.integrity.as_deref().unwrap_or("none");
    let a = req.availability.as_deref().unwrap_or("none");

    let (score, severity, vector) = calculate_cvss_score(av, ac, pr, ui, scope, c, i, a);

    Json(json!({
        "success": true,
        "data": {
            "score": score,
            "severity": severity,
            "vector_string": vector
        }
    }))
}

pub async fn auto_cvss_handler(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<serde_json::Value>,
) -> impl IntoResponse {
    let vuln_type = req["vulnerability_type"].as_str().unwrap_or("unknown");

    let (av, ac, pr, ui, scope, c, i, a) = match vuln_type.to_lowercase().as_str() {
        "sql_injection" | "sqli" => ("network","low","none","none","changed","high","high","high"),
        "xss" | "cross_site_scripting" => ("network","low","none","passive","changed","low","low","none"),
        "ssrf" => ("network","low","none","none","changed","high","none","low"),
        "rce" | "command_injection" | "remote_code_execution" => ("network","low","none","none","changed","high","high","high"),
        "path_traversal" | "lfi" => ("network","low","none","none","unchanged","high","none","none"),
        "csrf" => ("network","low","none","passive","changed","none","low","none"),
        "hardcoded_secrets" => ("network","low","none","none","unchanged","high","high","high"),
        "idor" | "insecure_direct_object_reference" => ("network","low","none","active","changed","high","none","none"),
        "xxe" | "xml_external_entity" => ("network","low","none","none","changed","high","high","high"),
        "open_redirect" => ("network","low","none","passive","unchanged","low","none","none"),
        "insecure_deserialization" => ("network","low","none","none","changed","high","high","high"),
        "broken_access_control" => ("network","low","none","active","changed","high","high","high"),
        _ => ("network","low","none","none","unchanged","none","none","low"),
    };

    let (score, severity, vector) = calculate_cvss_score(av, ac, pr, ui, scope, c, i, a);

    Json(json!({
        "success": true,
        "data": {
            "vulnerability_type": vuln_type,
            "score": score,
            "severity": severity,
            "vector_string": vector
        }
    }))
}

pub fn configure_ai_routes(router: axum::Router<Arc<AppState>>) -> axum::Router<Arc<AppState>> {
    router
        .route("/api/v1/ai/generate-patch", axum::routing::post(generate_patch_handler))
        .route("/api/v1/ai/cvss-score", axum::routing::post(cvss_score_handler))
        .route("/api/v1/ai/auto-cvss", axum::routing::post(auto_cvss_handler))
}

