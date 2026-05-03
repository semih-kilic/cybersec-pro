// Real-world security news aggregator. Pulls RSS feeds from major sources,
// caches in memory with TTL, exposes sorted/filtered list to handler.

use chrono::{DateTime, Utc};
use lazy_static::lazy_static;
use regex::Regex;
use serde::Serialize;
use std::sync::RwLock;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize)]
pub struct NewsItem {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub link: String,
    pub source: String,
    pub category: String,
    pub published_at: String, // RFC3339
    pub published_ts: i64,    // unix seconds for sort
    pub tags: Vec<String>,
}

struct Cache {
    items: Vec<NewsItem>,
    fetched_at: Instant,
}

lazy_static! {
    static ref CACHE: RwLock<Option<Cache>> = RwLock::new(None);
}

const CACHE_TTL: Duration = Duration::from_secs(30 * 60);

pub struct FeedSource {
    pub name: &'static str,
    pub url: &'static str,
    pub category: &'static str,
}

const SOURCES: &[FeedSource] = &[
    FeedSource { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", category: "Vulnerabilities" },
    FeedSource { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", category: "Malware" },
    FeedSource { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", category: "Breaches" },
    FeedSource { name: "Dark Reading", url: "https://www.darkreading.com/rss.xml", category: "Research" },
    FeedSource { name: "CISA Alerts", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", category: "Vulnerabilities" },
    FeedSource { name: "SANS ISC", url: "https://isc.sans.edu/rssfeed_full.xml", category: "Research" },
];

pub async fn get_news(force_refresh: bool) -> Vec<NewsItem> {
    if !force_refresh {
        if let Ok(guard) = CACHE.read() {
            if let Some(c) = guard.as_ref() {
                if c.fetched_at.elapsed() < CACHE_TTL {
                    return c.items.clone();
                }
            }
        }
    }

    let items = fetch_all().await;
    if let Ok(mut guard) = CACHE.write() {
        *guard = Some(Cache { items: items.clone(), fetched_at: Instant::now() });
    }
    items
}

async fn fetch_all() -> Vec<NewsItem> {
    let client = reqwest::Client::builder()
        .user_agent("CyberSecPro-NewsAggregator/1.0")
        .timeout(Duration::from_secs(15))
        .build();
    let client = match client {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut tasks = Vec::new();
    for src in SOURCES {
        let client = client.clone();
        tasks.push(tokio::spawn(async move {
            fetch_one(&client, src).await
        }));
    }

    let mut all = Vec::new();
    for t in tasks {
        if let Ok(items) = t.await {
            all.extend(items);
        }
    }

    // Sort newest first
    all.sort_by(|a, b| b.published_ts.cmp(&a.published_ts));
    // Cap to 80 items
    all.truncate(80);
    all
}

async fn fetch_one(client: &reqwest::Client, src: &FeedSource) -> Vec<NewsItem> {
    let body = match client.get(src.url).send().await {
        Ok(r) => match r.text().await {
            Ok(t) => t,
            Err(_) => return Vec::new(),
        },
        Err(e) => {
            tracing::debug!("news fetch failed {}: {}", src.name, e);
            return Vec::new();
        }
    };

    parse_rss(&body, src)
}

lazy_static! {
    static ref ITEM_RE: Regex = Regex::new(r"(?is)<item[^>]*>(.*?)</item>").unwrap();
    static ref ENTRY_RE: Regex = Regex::new(r"(?is)<entry[^>]*>(.*?)</entry>").unwrap();
    static ref TITLE_RE: Regex = Regex::new(r"(?is)<title[^>]*>(.*?)</title>").unwrap();
    static ref LINK_RE: Regex = Regex::new(r#"(?is)<link[^>]*?>(.*?)</link>|<link[^>]*href=["']([^"']+)["']"#).unwrap();
    static ref DESC_RE: Regex = Regex::new(r"(?is)<description[^>]*>(.*?)</description>|<summary[^>]*>(.*?)</summary>|<content[^>]*>(.*?)</content>").unwrap();
    static ref DATE_RE: Regex = Regex::new(r"(?is)<pubDate[^>]*>(.*?)</pubDate>|<updated[^>]*>(.*?)</updated>|<published[^>]*>(.*?)</published>|<dc:date[^>]*>(.*?)</dc:date>").unwrap();
    static ref CAT_RE: Regex = Regex::new(r#"(?is)<category[^>]*>(.*?)</category>|<category[^>]*term=["']([^"']+)["']"#).unwrap();
    static ref TAG_STRIP: Regex = Regex::new(r"<[^>]+>").unwrap();
    static ref CDATA_RE: Regex = Regex::new(r"(?is)<!\[CDATA\[(.*?)\]\]>").unwrap();
    static ref WHITESPACE_RE: Regex = Regex::new(r"\s+").unwrap();
}

fn parse_rss(xml: &str, src: &FeedSource) -> Vec<NewsItem> {
    let mut items = Vec::new();
    // Try RSS 2.0 <item> first, then Atom <entry>
    let captures: Vec<_> = ITEM_RE.captures_iter(xml).collect();
    let captures = if !captures.is_empty() {
        captures
    } else {
        ENTRY_RE.captures_iter(xml).collect()
    };

    for cap in captures.into_iter().take(20) {
        let block = match cap.get(1) { Some(m) => m.as_str(), None => continue };

        let title = TITLE_RE.captures(block)
            .and_then(|c| c.get(1))
            .map(|m| clean_text(m.as_str()))
            .unwrap_or_default();

        if title.is_empty() { continue; }

        let link = LINK_RE.captures(block)
            .and_then(|c| {
                let raw = c.get(1).map(|m| m.as_str().trim().to_string());
                let href = c.get(2).map(|m| m.as_str().trim().to_string());
                href.or(raw)
            })
            .unwrap_or_default();

        let summary = DESC_RE.captures(block)
            .and_then(|c| c.get(1).or_else(|| c.get(2)).or_else(|| c.get(3)))
            .map(|m| clean_text(m.as_str()))
            .unwrap_or_default();
        let summary = truncate_words(&summary, 60);

        let date_raw = DATE_RE.captures(block)
            .and_then(|c| c.get(1).or_else(|| c.get(2)).or_else(|| c.get(3)).or_else(|| c.get(4)))
            .map(|m| m.as_str().trim().to_string())
            .unwrap_or_default();

        let (published_at, published_ts) = parse_date(&date_raw);

        let category_override = CAT_RE.captures(block)
            .and_then(|c| {
                let inner = c.get(1).map(|m| clean_text(m.as_str()));
                let term = c.get(2).map(|m| m.as_str().trim().to_string());
                term.or(inner)
            })
            .filter(|s| !s.is_empty())
            .map(|s| classify_category(&s))
            .unwrap_or_else(|| classify_from_text(&title, &summary, src.category));

        let tags = extract_tags(&title, &summary);

        let id = format!("{}-{}", src.name.to_lowercase().replace(' ', "-"), short_hash(&link));

        items.push(NewsItem {
            id,
            title,
            summary,
            link,
            source: src.name.to_string(),
            category: category_override,
            published_at,
            published_ts,
            tags,
        });
    }

    items
}

fn clean_text(s: &str) -> String {
    let s = CDATA_RE.replace_all(s, "$1").to_string();
    let s = TAG_STRIP.replace_all(&s, " ").to_string();
    let s = s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        .replace("&quot;", "\"").replace("&#39;", "'").replace("&apos;", "'")
        .replace("&nbsp;", " ").replace("&hellip;", "…").replace("&mdash;", "—").replace("&ndash;", "–");
    let s = WHITESPACE_RE.replace_all(s.trim(), " ").to_string();
    s
}

fn truncate_words(s: &str, max_words: usize) -> String {
    let words: Vec<&str> = s.split_whitespace().collect();
    if words.len() <= max_words { return s.to_string(); }
    format!("{}…", words[..max_words].join(" "))
}

fn parse_date(s: &str) -> (String, i64) {
    // Try RFC2822 (RSS pubDate), then RFC3339 (Atom)
    if let Ok(dt) = DateTime::parse_from_rfc2822(s) {
        return (dt.with_timezone(&Utc).to_rfc3339(), dt.timestamp());
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return (dt.with_timezone(&Utc).to_rfc3339(), dt.timestamp());
    }
    let now = Utc::now();
    (now.to_rfc3339(), now.timestamp())
}

fn classify_category(raw: &str) -> String {
    let l = raw.to_lowercase();
    if l.contains("breach") || l.contains("data leak") || l.contains("incident") { return "Breaches".into(); }
    if l.contains("vuln") || l.contains("cve") || l.contains("zero-day") || l.contains("exploit") { return "Vulnerabilities".into(); }
    if l.contains("malware") || l.contains("ransomware") || l.contains("phishing") || l.contains("trojan") || l.contains("botnet") { return "Malware".into(); }
    if l.contains("policy") || l.contains("regulation") || l.contains("compliance") || l.contains("law") || l.contains("gdpr") { return "Policy".into(); }
    if l.contains("research") || l.contains("study") || l.contains("paper") { return "Research".into(); }
    if l.contains("tool") || l.contains("release") || l.contains("update") { return "Tools".into(); }
    "Vulnerabilities".into()
}

fn classify_from_text(title: &str, summary: &str, fallback: &str) -> String {
    let combined = format!("{} {}", title.to_lowercase(), summary.to_lowercase());
    if combined.contains("breach") || combined.contains("data leak") || combined.contains("hacked") || combined.contains("stolen") {
        return "Breaches".into();
    }
    if combined.contains("ransomware") || combined.contains("malware") || combined.contains("phishing") || combined.contains("backdoor") || combined.contains("trojan") || combined.contains("botnet") {
        return "Malware".into();
    }
    if combined.contains("cve-") || combined.contains("zero-day") || combined.contains("zero day") || combined.contains("vulnerab") || combined.contains("rce ") || combined.contains("patch") {
        return "Vulnerabilities".into();
    }
    if combined.contains("regulat") || combined.contains("gdpr") || combined.contains("compliance") || combined.contains("policy") || combined.contains("law") {
        return "Policy".into();
    }
    if combined.contains("released") || combined.contains("new tool") || combined.contains("open-source") || combined.contains("github.com/") {
        return "Tools".into();
    }
    if combined.contains("research") || combined.contains("study finds") || combined.contains("report") {
        return "Research".into();
    }
    fallback.to_string()
}

fn extract_tags(title: &str, summary: &str) -> Vec<String> {
    let combined = format!("{} {}", title, summary);
    let mut tags = Vec::new();
    // CVE IDs
    let cve_re = Regex::new(r"CVE-\d{4}-\d{4,7}").unwrap();
    for c in cve_re.find_iter(&combined) {
        let v = c.as_str().to_string();
        if !tags.contains(&v) { tags.push(v); }
    }
    // Common keywords
    let keywords = [
        "ransomware", "phishing", "zero-day", "RCE", "SQL injection", "XSS",
        "Linux", "Windows", "macOS", "Android", "iOS", "Kubernetes", "Docker",
        "AWS", "Azure", "GCP", "OAuth", "SAML", "LDAP", "VPN", "firmware", "IoT",
        "APT", "supply chain",
    ];
    let lc = combined.to_lowercase();
    for kw in keywords {
        if lc.contains(&kw.to_lowercase()) && !tags.iter().any(|t| t.eq_ignore_ascii_case(kw)) {
            tags.push(kw.to_string());
            if tags.len() >= 6 { break; }
        }
    }
    tags
}

fn short_hash(s: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    s.hash(&mut h);
    format!("{:x}", h.finish())
}
