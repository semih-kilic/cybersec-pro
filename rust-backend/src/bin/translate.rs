/// CyberSec Pro — DeepL Auto-Translation CLI (Rust)
/// Replaces Python translate.py
///
/// Usage:
///   cargo run --bin translate -- --help
///   cargo run --bin translate                          # Translate all languages
///   cargo run --bin translate -- --lang de             # German only
///   cargo run --bin translate -- --dry-run             # Preview changes
///   cargo run --bin translate -- --force               # Re-translate all
///   cargo run --bin translate -- --free-api            # Use DeepL Free API
///   cargo run --bin translate -- --export-glossary     # Export glossary JSON
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::time::Instant;
use regex::Regex;

// ── Configuration ──────────────────────────────────────────

const SOURCE_LANG: &str = "EN";

fn target_languages() -> HashMap<&'static str, &'static str> {
    HashMap::from([("de", "DE"), ("fr", "FR"), ("es", "ES"), ("it", "IT")])
}

fn locales_dir() -> PathBuf {
    // relative to workspace: saas-frontend/src/i18n/locales
    let base = std::env::var("WORKSPACE_DIR")
        .unwrap_or_else(|_| "/home/cybersec/cybersec-pro".to_string());
    PathBuf::from(base).join("saas-frontend/src/i18n/locales")
}

// ── Technical Glossary ─────────────────────────────────────

fn technical_terms() -> HashSet<String> {
    let terms = [
        // Product names
        "CyberSec Pro","Kali Linux","Kali","Metasploit","Metasploit Framework",
        "Burp Suite","Nmap","Wireshark","Nessus","OpenVAS","OWASP",
        // Protocols & standards
        "HTTP","HTTPS","SSL","TLS","SSH","FTP","SMTP","DNS","TCP","UDP",
        "ICMP","ARP","DHCP","SNMP","LDAP","SMB","RDP","VPN","WPA","WPA2",
        "WPA3","WEP","SAML","SSO","OAuth","JWT","REST","API","CORS","WebSocket",
        // Security concepts
        "CVE","CVSS","CWE","GDPR","DSGVO","RGPD",
        "XSS","CSRF","SQL Injection","SQLi","RCE","LFI","RFI",
        "SSRF","XXE","IDOR","MITM","DDoS","DoS","APT",
        "Zero-day","Payload","Exploit","Shell","Reverse Shell",
        "Backdoor","Rootkit","Malware","Ransomware","Phishing",
        "Brute Force","Dictionary Attack","Hash","Rainbow Table",
        "Pentest","Pentesting","Penetration Testing","Red Team","Blue Team",
        "Bug Bounty","CTF","OSINT",
        // Technical computing
        "Docker","Kubernetes","Linux","Windows","macOS","Ubuntu","Debian",
        "Python","JavaScript","TypeScript","Node.js","React","Nginx","Rust",
        "JSON","YAML","XML","CSV","PDF","HTML","CSS",
        "Git","GitHub","GitLab","CI/CD","DevOps","DevSecOps",
        "CPU","RAM","SSD","IP","IPv4","IPv6","MAC","BIOS","UEFI",
        "VM","Container","Proxy","Firewall","IDS","IPS","WAF","SIEM",
        "EDR","XDR","SOC","NOC",
        // UI terms
        "Dashboard","Live","Pro","Enterprise","Team","Starter","Professional",
        // Data formats
        "Nmap XML","SARIF","JUnit","STIX","TAXII",
        // Name
        "Semih Kılıç",
    ];
    terms.iter().map(|s| s.to_string()).collect()
}

fn load_tool_names_from_db() -> HashSet<String> {
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://cybersec:***REDACTED_PG_PASSWORD***@localhost:5432/cybersec_pro".to_string());

    // Use a simple sync approach — this is a CLI tool, not a server
    let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
    rt.block_on(async {
        let pool = match sqlx::PgPool::connect(&db_url).await {
            Ok(p) => p,
            Err(e) => {
                eprintln!("⚠️  Could not connect to DB: {}", e);
                return HashSet::new();
            }
        };

        let rows: Vec<(String,)> =
            sqlx::query_as("SELECT name FROM tools ORDER BY name")
                .fetch_all(&pool)
                .await
                .unwrap_or_default();

        let names: HashSet<String> = rows.into_iter().map(|r| r.0).collect();
        println!("📦 Loaded {} tool names from database", names.len());
        names
    })
}

fn full_glossary() -> HashSet<String> {
    let mut g = technical_terms();
    let tools = load_tool_names_from_db();
    g.extend(tools);
    g
}

// ── Translation Engine ─────────────────────────────────────

struct DeepLTranslator {
    api_key: String,
    base_url: String,
    glossary: HashSet<String>,
    request_count: u64,
    char_count: u64,
    client: reqwest::blocking::Client,
    i18n_re: Regex,
}

impl DeepLTranslator {
    fn new(api_key: &str, free_api: bool, glossary: HashSet<String>) -> Self {
        let base_url = if free_api {
            "https://api-free.deepl.com"
        } else {
            "https://api.deepl.com"
        }
        .to_string();

        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("HTTP client");

        // Verify API key
        let resp = client
            .get(format!("{}/v2/usage", base_url))
            .header("Authorization", format!("DeepL-Auth-Key {}", api_key))
            .send();

        match resp {
            Ok(r) => {
                if r.status().is_success() {
                    if let Ok(usage) = r.json::<serde_json::Value>() {
                        let used = usage.get("character_count").and_then(|v| v.as_u64()).unwrap_or(0);
                        let limit = usage.get("character_limit").and_then(|v| v.as_u64()).unwrap_or(0);
                        println!("🔑 DeepL API connected: {}/{} chars used", used, limit);
                    }
                } else {
                    eprintln!("❌ DeepL API error: {}", r.status());
                    std::process::exit(1);
                }
            }
            Err(e) => {
                eprintln!("❌ DeepL API connection failed: {}", e);
                std::process::exit(1);
            }
        }

        Self {
            api_key: api_key.to_string(),
            base_url,
            glossary,
            request_count: 0,
            char_count: 0,
            client,
            i18n_re: Regex::new(r"\{\{[^}]+\}\}").unwrap(),
        }
    }

    fn protect_terms(&self, text: &str) -> (String, Vec<(String, String)>) {
        let mut protected = text.to_string();
        let mut map: Vec<(String, String)> = Vec::new();
        let mut counter = 0;

        // Protect i18next interpolation {{var}}
        for cap in self.i18n_re.find_iter(text) {
            let ph = format!("⟦VAR{}⟧", counter);
            map.push((ph.clone(), cap.as_str().to_string()));
            protected = protected.replacen(cap.as_str(), &ph, 1);
            counter += 1;
        }

        // Sort glossary terms by length (longest first)
        let mut sorted: Vec<&String> = self.glossary.iter().collect();
        sorted.sort_by(|a, b| b.len().cmp(&a.len()));

        for term in sorted {
            if protected.contains(term.as_str()) {
                let ph = format!("⟦T{}⟧", counter);
                map.push((ph.clone(), term.clone()));
                protected = protected.replace(term.as_str(), &ph);
                counter += 1;
            }
        }

        (protected, map)
    }

    fn restore_terms(&self, text: &str, map: &[(String, String)]) -> String {
        let mut result = text.to_string();
        for (ph, original) in map {
            result = result.replace(ph.as_str(), original);
        }
        result
    }

    fn translate_text(&mut self, text: &str, target_lang: &str) -> String {
        if text.trim().is_empty() {
            return text.to_string();
        }

        if self.glossary.contains(text.trim()) {
            return text.to_string();
        }

        let (protected, map) = self.protect_terms(text);

        // Check if anything remains after protection
        let remaining = Regex::new(r"⟦[^⟧]+⟧")
            .unwrap()
            .replace_all(&protected, "");
        if remaining.trim().is_empty() {
            return self.restore_terms(&protected, &map);
        }

        let resp = self
            .client
            .post(format!("{}/v2/translate", self.base_url))
            .header("Authorization", format!("DeepL-Auth-Key {}", self.api_key))
            .form(&[
                ("text", protected.as_str()),
                ("source_lang", SOURCE_LANG),
                ("target_lang", target_lang),
                ("preserve_formatting", "1"),
            ])
            .send();

        match resp {
            Ok(r) => {
                let status = r.status();
                if status.is_success() {
                    self.request_count += 1;
                    self.char_count += text.len() as u64;

                    let body: serde_json::Value = r.json().unwrap_or_default();
                    let translated = body
                        .get("translations")
                        .and_then(|t: &serde_json::Value| t.get(0))
                        .and_then(|t: &serde_json::Value| t.get("text"))
                        .and_then(|t: &serde_json::Value| t.as_str())
                        .unwrap_or(text);

                    self.restore_terms(translated, &map)
                } else if status.as_u16() == 456 {
                    eprintln!("\n❌ DeepL API quota exceeded!");
                    std::process::exit(1);
                } else {
                    eprintln!("⚠️  Translation error ({}): {}", status, text.chars().take(50).collect::<String>());
                    text.to_string()
                }
            }
            Err(e) => {
                eprintln!("⚠️  Request error: {}", e);
                text.to_string()
            }
        }
    }

    fn translate_value(&mut self, value: &serde_json::Value, target_lang: &str, key_path: &str) -> serde_json::Value {
        match value {
            serde_json::Value::String(s) => {
                serde_json::Value::String(self.translate_text(s, target_lang))
            }
            serde_json::Value::Object(map) => {
                let mut result = serde_json::Map::new();
                for (k, v) in map {
                    let path = if key_path.is_empty() {
                        k.clone()
                    } else {
                        format!("{}.{}", key_path, k)
                    };
                    result.insert(k.clone(), self.translate_value(v, target_lang, &path));
                }
                serde_json::Value::Object(result)
            }
            serde_json::Value::Array(arr) => {
                serde_json::Value::Array(
                    arr.iter()
                        .map(|v| self.translate_value(v, target_lang, key_path))
                        .collect(),
                )
            }
            other => other.clone(),
        }
    }

    fn translate_locale(
        &mut self,
        source: &serde_json::Value,
        target_lang: &str,
        existing: Option<&serde_json::Value>,
        force: bool,
    ) -> serde_json::Value {
        if !force {
            if let (Some(src_obj), Some(exist_obj)) = (source.as_object(), existing.and_then(|e| e.as_object())) {
                let mut result = serde_json::Map::new();
                for (section_key, section_data) in src_obj {
                    if let Some(section_obj) = section_data.as_object() {
                        let existing_section = exist_obj.get(section_key).and_then(|e| e.as_object());
                        let mut translated_section = serde_json::Map::new();

                        for (key, value) in section_obj {
                            let full_key = format!("{}.{}", section_key, key);
                            if let Some(existing_val) = existing_section.and_then(|es| es.get(key)) {
                                // Keep existing translation
                                translated_section.insert(key.clone(), existing_val.clone());
                            } else {
                                println!("  🔄 {}", full_key);
                                translated_section.insert(
                                    key.clone(),
                                    self.translate_value(value, target_lang, &full_key),
                                );
                            }
                        }
                        result.insert(section_key.clone(), serde_json::Value::Object(translated_section));
                    } else {
                        result.insert(section_key.clone(), section_data.clone());
                    }
                }
                return serde_json::Value::Object(result);
            }
        }

        self.translate_value(source, target_lang, "")
    }
}

// ── Utilities ──────────────────────────────────────────────

fn flatten_keys(value: &serde_json::Value, prefix: &str) -> Vec<String> {
    let mut keys = Vec::new();
    if let Some(obj) = value.as_object() {
        for (k, v) in obj {
            let full = if prefix.is_empty() {
                k.clone()
            } else {
                format!("{}.{}", prefix, k)
            };
            if v.is_object() {
                keys.extend(flatten_keys(v, &full));
            } else {
                keys.push(full);
            }
        }
    }
    keys
}

fn key_exists(data: &serde_json::Value, key_path: &str) -> bool {
    let parts: Vec<&str> = key_path.split('.').collect();
    let mut current = data;
    for part in parts {
        match current.get(part) {
            Some(v) => current = v,
            None => return false,
        }
    }
    true
}

// ── CLI ────────────────────────────────────────────────────

fn main() {
    let args: Vec<String> = std::env::args().collect();

    let mut lang_filter: Option<String> = None;
    let mut force = false;
    let mut dry_run = false;
    let mut free_api = false;
    let mut export_glossary = false;
    let mut api_key_arg: Option<String> = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--lang" => {
                i += 1;
                if i < args.len() {
                    lang_filter = Some(args[i].clone());
                }
            }
            "--force" => force = true,
            "--dry-run" => dry_run = true,
            "--free-api" => free_api = true,
            "--export-glossary" => export_glossary = true,
            "--api-key" => {
                i += 1;
                if i < args.len() {
                    api_key_arg = Some(args[i].clone());
                }
            }
            "--help" | "-h" => {
                println!("CyberSec Pro — DeepL Auto-Translation CLI (Rust)");
                println!();
                println!("Usage:");
                println!("  translate [OPTIONS]");
                println!();
                println!("Options:");
                println!("  --lang <LANG>       Translate specific language (de, fr, es, it)");
                println!("  --force             Force re-translate all (ignore existing)");
                println!("  --dry-run           Preview what would be translated");
                println!("  --free-api          Use DeepL Free API endpoint");
                println!("  --export-glossary   Export glossary to JSON file");
                println!("  --api-key <KEY>     DeepL API key (or set DEEPL_API_KEY)");
                println!("  --help              Show this help message");
                return;
            }
            _ => {
                eprintln!("Unknown argument: {}", args[i]);
                std::process::exit(1);
            }
        }
        i += 1;
    }

    let dir = locales_dir();

    // Export glossary
    if export_glossary {
        let glossary = full_glossary();
        let mut sorted: Vec<&String> = glossary.iter().collect();
        sorted.sort();
        let output = serde_json::json!({
            "description": "Technical terms that should NOT be translated",
            "total": glossary.len(),
            "terms": sorted,
        });
        let glossary_file = dir.parent().unwrap().join("glossary.json");
        std::fs::write(&glossary_file, serde_json::to_string_pretty(&output).unwrap())
            .expect("Write glossary file");
        println!("📝 Exported {} glossary terms to {:?}", glossary.len(), glossary_file);
        return;
    }

    // Load source locale
    let source_file = dir.join("en.json");
    if !source_file.exists() {
        eprintln!("❌ Source file not found: {:?}", source_file);
        std::process::exit(1);
    }
    let source_text = std::fs::read_to_string(&source_file).expect("Read en.json");
    let source: serde_json::Value = serde_json::from_str(&source_text).expect("Parse en.json");
    let all_keys = flatten_keys(&source, "");
    println!("📄 Source: en.json ({} keys)", all_keys.len());

    // Targets
    let all_targets = target_languages();
    let targets: HashMap<&str, &str> = if let Some(ref lang) = lang_filter {
        match all_targets.get(lang.as_str()) {
            Some(&code) => HashMap::from([(lang.as_str(), code)]),
            None => {
                eprintln!("❌ Invalid language: {}. Use: de, fr, es, it", lang);
                std::process::exit(1);
            }
        }
    } else {
        all_targets
    };

    // Dry run
    if dry_run {
        println!("\n🔍 DRY RUN — Would translate to: {:?}", targets.keys().collect::<Vec<_>>());
        for (lang_code, _) in &targets {
            let target_file = dir.join(format!("{}.json", lang_code));
            let existing: Option<serde_json::Value> = if target_file.exists() && !force {
                Some(serde_json::from_str(&std::fs::read_to_string(&target_file).unwrap()).unwrap())
            } else {
                None
            };

            let mut new_keys = Vec::new();
            for key in &all_keys {
                if force || existing.as_ref().map(|e| !key_exists(e, key)).unwrap_or(true) {
                    new_keys.push(key.as_str());
                }
            }

            println!("\n  {}: {}/{} keys to translate", lang_code.to_uppercase(), new_keys.len(), all_keys.len());
            for key in new_keys.iter().take(10) {
                println!("    + {}", key);
            }
            if new_keys.len() > 10 {
                println!("    ... and {} more", new_keys.len() - 10);
            }
        }
        return;
    }

    // Get API key
    let api_key = api_key_arg
        .or_else(|| std::env::var("DEEPL_API_KEY").ok())
        .unwrap_or_else(|| {
            eprintln!("❌ No DeepL API key found!");
            eprintln!("  Set: export DEEPL_API_KEY='your-key-here'");
            eprintln!("  Or: --api-key <KEY>");
            eprintln!("  Get free key: https://www.deepl.com/pro-api");
            std::process::exit(1);
        });

    let glossary = full_glossary();
    println!("\n🌐 Translating to: {:?}", targets.keys().collect::<Vec<_>>());
    println!("📚 Glossary: {} protected terms", glossary.len());
    println!("{}", "=".repeat(60));

    let mut translator = DeepLTranslator::new(&api_key, free_api, glossary);
    let total_start = Instant::now();

    for (lang_code, deepl_code) in &targets {
        let target_file = dir.join(format!("{}.json", lang_code));

        let existing: Option<serde_json::Value> = if target_file.exists() && !force {
            Some(serde_json::from_str(&std::fs::read_to_string(&target_file).unwrap()).unwrap())
        } else {
            None
        };

        println!("\n🇪🇺 Translating → {}", lang_code.to_uppercase());
        let lang_start = Instant::now();

        let translated = translator.translate_locale(&source, deepl_code, existing.as_ref(), force);

        let output = serde_json::to_string_pretty(&translated).unwrap() + "\n";
        std::fs::write(&target_file, output).expect("Write translated file");

        let elapsed = lang_start.elapsed();
        println!("  ✅ {}.json saved ({:.1}s)", lang_code, elapsed.as_secs_f64());
    }

    let total_time = total_start.elapsed();
    println!("\n{}", "=".repeat(60));
    println!("✅ Translation complete!");
    println!("   Languages: {}", targets.len());
    println!("   API requests: {}", translator.request_count);
    println!("   Characters: {}", translator.char_count);
    println!("   Time: {:.1}s", total_time.as_secs_f64());

    // Validate
    println!("\n🔍 Validating JSON files...");
    for (lang_code, _) in &targets {
        let target_file = dir.join(format!("{}.json", lang_code));
        match std::fs::read_to_string(&target_file) {
            Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(data) => {
                    let target_keys = flatten_keys(&data, "");
                    let source_set: HashSet<String> = all_keys.iter().cloned().collect();
                    let target_set: HashSet<String> = target_keys.into_iter().collect();
                    let missing: Vec<_> = source_set.difference(&target_set).collect();
                    if missing.is_empty() {
                        println!("  ✅ {}.json: {} keys OK", lang_code, target_set.len());
                    } else {
                        println!("  ⚠️  {}.json: {} missing keys", lang_code, missing.len());
                    }
                }
                Err(e) => println!("  ❌ {}.json: Invalid JSON - {}", lang_code, e),
            },
            Err(e) => println!("  ❌ {}.json: Read error - {}", lang_code, e),
        }
    }
}
