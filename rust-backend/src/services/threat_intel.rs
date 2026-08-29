// Real threat intelligence aggregator — pulls from free public APIs:
//  - CISA KEV (Known Exploited Vulnerabilities) catalog
//  - abuse.ch URLhaus (recent malicious URLs CSV)
//  - abuse.ch ThreatFox (recent IOCs JSON)
// Cached in memory with 30-minute TTL.

use lazy_static::lazy_static;
use serde::Serialize;
use std::sync::RwLock;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize)]
pub struct ThreatFeed {
    pub id: String,
    pub name: String,
    pub feed_type: String,
    pub indicators: i64,
    pub last_update: String, // human readable
    pub status: String,      // active|degraded|offline
    pub severity: String,    // critical|high|medium|low
    pub source_url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Ioc {
    pub ioc_type: String, // IP|Domain|URL|Hash|CVE
    pub value: String,
    pub threat: String,
    pub source: String,
    pub confidence: u8,
    pub first_seen: String,
    pub last_seen: String,
    pub reference: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ThreatIntel {
    pub feeds: Vec<ThreatFeed>,
    pub iocs: Vec<Ioc>,
    pub stats: Stats,
    pub fetched_at: String,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct Stats {
    pub active_threats: i64,
    pub iocs_tracked: i64,
    pub kev_total: i64,
    pub kev_added_30d: i64,
}

struct Cache {
    data: ThreatIntel,
    fetched_at: Instant,
}

lazy_static! {
    static ref CACHE: RwLock<Option<Cache>> = RwLock::new(None);
}

const CACHE_TTL: Duration = Duration::from_secs(30 * 60);

pub async fn get_intel(force: bool) -> ThreatIntel {
    if !force {
        if let Ok(g) = CACHE.read() {
            if let Some(c) = g.as_ref() {
                if c.fetched_at.elapsed() < CACHE_TTL {
                    return c.data.clone();
                }
            }
        }
    }

    let data = fetch_all().await;
    if let Ok(mut g) = CACHE.write() {
        *g = Some(Cache { data: data.clone(), fetched_at: Instant::now() });
    }
    data
}

async fn fetch_all() -> ThreatIntel {
    let client = reqwest::Client::builder()
        .user_agent("CyberSecPro-ThreatIntel/1.0")
        .timeout(Duration::from_secs(20))
        .build()
        .ok();

    let (kev, urlhaus, threatfox) = match client {
        Some(c) => tokio::join!(
            fetch_kev(&c),
            fetch_urlhaus(&c),
            fetch_threatfox(&c),
        ),
        None => (None, None, None),
    };

    let mut feeds: Vec<ThreatFeed> = Vec::new();
    let mut iocs: Vec<Ioc> = Vec::new();
    let mut stats = Stats::default();

    if let Some((count, added_30d, kev_iocs)) = kev {
        stats.kev_total = count;
        stats.kev_added_30d = added_30d;
        stats.active_threats += count;
        feeds.push(ThreatFeed {
            id: "cisa-kev".into(),
            name: "CISA KEV Catalog".into(),
            feed_type: "CVEs".into(),
            indicators: count,
            last_update: "live".into(),
            status: "active".into(),
            severity: "critical".into(),
            source_url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog".into(),
        });
        iocs.extend(kev_iocs);
    }

    if let Some((count, urlhaus_iocs)) = urlhaus {
        stats.iocs_tracked += count;
        feeds.push(ThreatFeed {
            id: "urlhaus".into(),
            name: "abuse.ch URLhaus".into(),
            feed_type: "Malicious URLs".into(),
            indicators: count,
            last_update: "live".into(),
            status: "active".into(),
            severity: "critical".into(),
            source_url: "https://urlhaus.abuse.ch/".into(),
        });
        iocs.extend(urlhaus_iocs);
    }

    if let Some((count, tf_iocs)) = threatfox {
        stats.iocs_tracked += count;
        feeds.push(ThreatFeed {
            id: "threatfox".into(),
            name: "abuse.ch ThreatFox".into(),
            feed_type: "IOCs (mixed)".into(),
            indicators: count,
            last_update: "live".into(),
            status: "active".into(),
            severity: "high".into(),
            source_url: "https://threatfox.abuse.ch/".into(),
        });
        iocs.extend(tf_iocs);
    }

    // Sort IOCs newest first, cap 30
    iocs.sort_by(|a, b| b.last_seen.cmp(&a.last_seen));
    iocs.truncate(30);

    ThreatIntel {
        feeds,
        iocs,
        stats,
        fetched_at: chrono::Utc::now().to_rfc3339(),
    }
}

// ── CISA KEV ─────────────────────────────────────────────
async fn fetch_kev(client: &reqwest::Client) -> Option<(i64, i64, Vec<Ioc>)> {
    let url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
    let body = client.get(url).send().await.ok()?.text().await.ok()?;
    let v: serde_json::Value = serde_json::from_str(&body).ok()?;
    let arr = v.get("vulnerabilities")?.as_array()?;
    let total = arr.len() as i64;

    let cutoff = chrono::Utc::now() - chrono::Duration::days(30);
    let mut added_30d: i64 = 0;
    let mut iocs: Vec<Ioc> = Vec::new();

    // Newest first
    let mut sorted: Vec<&serde_json::Value> = arr.iter().collect();
    sorted.sort_by(|a, b| {
        b.get("dateAdded").and_then(|s| s.as_str()).unwrap_or("")
            .cmp(a.get("dateAdded").and_then(|s| s.as_str()).unwrap_or(""))
    });

    for item in sorted.iter().take(15) {
        let cve = item.get("cveID").and_then(|s| s.as_str()).unwrap_or("").to_string();
        if cve.is_empty() { continue; }
        let vendor = item.get("vendorProject").and_then(|s| s.as_str()).unwrap_or("");
        let product = item.get("product").and_then(|s| s.as_str()).unwrap_or("");
        let name = item.get("vulnerabilityName").and_then(|s| s.as_str()).unwrap_or("");
        let date_added = item.get("dateAdded").and_then(|s| s.as_str()).unwrap_or("").to_string();
        iocs.push(Ioc {
            ioc_type: "CVE".into(),
            value: cve.clone(),
            threat: format!("{} {} — {}", vendor, product, name).trim().to_string(),
            source: "CISA KEV".into(),
            confidence: 100,
            first_seen: date_added.clone(),
            last_seen: date_added.clone(),
            reference: Some(format!("https://nvd.nist.gov/vuln/detail/{}", cve)),
        });
    }

    for item in arr.iter() {
        if let Some(d) = item.get("dateAdded").and_then(|s| s.as_str()) {
            if let Ok(parsed) = chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d") {
                if parsed.and_hms_opt(0,0,0).map(|n| n.and_utc()) >= Some(cutoff) {
                    added_30d += 1;
                }
            }
        }
    }

    Some((total, added_30d, iocs))
}

// ── URLhaus recent (CSV) ─────────────────────────────────
async fn fetch_urlhaus(client: &reqwest::Client) -> Option<(i64, Vec<Ioc>)> {
    let url = "https://urlhaus.abuse.ch/downloads/csv_recent/";
    let body = client.get(url).send().await.ok()?.text().await.ok()?;
    let mut count: i64 = 0;
    let mut iocs: Vec<Ioc> = Vec::new();

    for line in body.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') { continue; }
        // CSV format: "id","dateadded","url","url_status","last_online","threat","tags","urlhaus_link","reporter"
        let fields: Vec<&str> = csv_split(line);
        if fields.len() < 7 { continue; }
        count += 1;
        if iocs.len() < 10 {
            let date = fields[1].to_string();
            let raw_url = fields[2].to_string();
            let safe = defang_url(&raw_url);
            let threat = fields[5].to_string();
            let tags = fields[6].to_string();
            let link = fields.get(7).map(|s| s.to_string());
            iocs.push(Ioc {
                ioc_type: "URL".into(),
                value: safe,
                threat: if tags.is_empty() { threat.clone() } else { format!("{} ({})", threat, tags) },
                source: "URLhaus".into(),
                confidence: 95,
                first_seen: date.clone(),
                last_seen: date,
                reference: link,
            });
        }
    }

    Some((count, iocs))
}

fn csv_split(line: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut start = 0;
    let mut in_quote = false;
    let bytes = line.as_bytes();
    for (i, b) in bytes.iter().enumerate() {
        match *b {
            b'"' => in_quote = !in_quote,
            b',' if !in_quote => {
                out.push(line[start..i].trim_matches('"'));
                start = i + 1;
            }
            _ => {}
        }
    }
    out.push(line[start..].trim_matches('"'));
    out
}

fn defang_url(u: &str) -> String {
    u.replacen("http://", "hxxp://", 1)
        .replacen("https://", "hxxps://", 1)
        .replace('.', "[.]")
}

fn defang_domain(d: &str) -> String {
    d.replace('.', "[.]")
}

// ── ThreatFox recent IOCs ────────────────────────────────
async fn fetch_threatfox(client: &reqwest::Client) -> Option<(i64, Vec<Ioc>)> {
    // ThreatFox requires Auth-Key header (free signup at https://auth.abuse.ch/)
    let api_key = std::env::var("THREATFOX_AUTH_KEY").or_else(|_| std::env::var("ABUSECH_AUTH_KEY")).ok()?;
    let url = "https://threatfox-api.abuse.ch/api/v1/";
    let payload = serde_json::json!({"query": "get_iocs", "days": 1});
    let resp = client.post(url).header("Auth-Key", api_key).json(&payload).send().await.ok()?;
    let body = resp.text().await.ok()?;
    let v: serde_json::Value = serde_json::from_str(&body).ok()?;
    let arr = v.get("data")?.as_array()?;
    let count = arr.len() as i64;
    let mut iocs: Vec<Ioc> = Vec::new();

    for item in arr.iter().take(15) {
        let raw_value = item.get("ioc").and_then(|s| s.as_str()).unwrap_or("");
        if raw_value.is_empty() { continue; }
        let ioc_type_raw = item.get("ioc_type").and_then(|s| s.as_str()).unwrap_or("");
        let malware = item.get("malware_printable").and_then(|s| s.as_str()).unwrap_or("Unknown");
        let conf = item.get("confidence_level").and_then(|s| s.as_i64()).unwrap_or(75) as u8;
        let first = item.get("first_seen").and_then(|s| s.as_str()).unwrap_or("").to_string();
        let last = item.get("last_seen").and_then(|s| s.as_str()).map(String::from)
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| first.clone());
        let id = item.get("id").and_then(|s| s.as_str().map(String::from).or_else(|| s.as_i64().map(|n| n.to_string())));
        let reference = id.map(|i| format!("https://threatfox.abuse.ch/ioc/{}/", i));

        let (kind, safe) = classify_ioc_type(ioc_type_raw, raw_value);

        iocs.push(Ioc {
            ioc_type: kind,
            value: safe,
            threat: malware.to_string(),
            source: "ThreatFox".into(),
            confidence: conf,
            first_seen: first,
            last_seen: last,
            reference,
        });
    }

    Some((count, iocs))
}

fn classify_ioc_type(raw_type: &str, raw_value: &str) -> (String, String) {
    let lt = raw_type.to_lowercase();
    if lt.contains("ip") {
        return ("IP".into(), raw_value.to_string());
    }
    if lt.contains("url") {
        return ("URL".into(), defang_url(raw_value));
    }
    if lt.contains("domain") {
        return ("Domain".into(), defang_domain(raw_value));
    }
    if lt.contains("md5") || lt.contains("sha1") || lt.contains("sha256") || lt.contains("hash") {
        // Show truncated hash
        let v = if raw_value.len() > 24 {
            // Indicator values come from external feeds and are not ASCII-safe.
            format!("{}…", crate::services::net::truncate_bytes(raw_value, 24))
        } else { raw_value.to_string() };
        return ("Hash".into(), v);
    }
    ("Other".into(), raw_value.to_string())
}
