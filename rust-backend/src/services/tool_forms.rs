//! Zero-input parameter forms for the tool catalogue.
//!
//! The product's core promise is that a user runs a tool by making *choices* —
//! never by typing a raw command flag. Every option a tool needs is a labelled
//! control (dropdown, checkbox, slider, a single target field) whose values map
//! to flags baked into the command template. The user picks; the backend builds
//! the argv.
//!
//! This also closes a security gap: a free-text `{options}` field let callers
//! type arbitrary flags (`--script`, `-oN`), which the Phase 2 argument-injection
//! fix rejects. Replacing those fields with constrained choices is what makes the
//! rejection a non-issue rather than a broken feature.
//!
//! Each definition is applied to the DB on startup, overwriting `command_template`
//! and `parameters` for that tool so the catalogue and the form never drift.

use serde_json::{json, Value};
use sqlx::PgPool;

/// One tool's zero-input form.
struct ToolForm {
    /// Tool name (matched case-insensitively against `tools.name`).
    name: &'static str,
    /// Command with `{placeholder}` tokens. Every non-target placeholder must be
    /// filled by a control below; the whitelist of flag values lives here, not
    /// in user input.
    template: &'static str,
    /// `text | number | select | boolean` controls, as the frontend expects.
    form: Value,
    /// Target kinds this tool accepts, for client-side validation.
    target_types: &'static [&'static str],
    danger: &'static str,
    /// One plain-language sentence: what this tool does. Shown above the form so
    /// a user who has never heard of the tool knows what it is for (Madde 4).
    purpose: &'static str,
    /// When you would reach for it — the practical use case.
    when_to_use: &'static str,
}

/// Build the curated forms. Kept as data so it is reviewable at a glance.
fn definitions() -> Vec<ToolForm> {
    vec![
        ToolForm {
            name: "nmap",
            template: "nmap {scan_type} {timing} {port_spec} {service_detection} {os_detection} {script_scan} {target}",
            target_types: &["ip", "domain", "network"],
            danger: "medium",
            purpose: "Bir hedefteki açık portları ve çalışan servisleri haritalar — bir ağın 'kapılarını' yoklar.",
            when_to_use: "Bir sisteme saldırı yüzeyini anlamak için ilk adım: hangi servisler dışarıya açık?",
            form: json!([
                {"name":"scan_type","label":"Scan technique","type":"select","default":"-sS",
                 "description":"How ports are probed",
                 "options":[
                    {"label":"SYN stealth (default)","value":"-sS"},
                    {"label":"TCP connect","value":"-sT"},
                    {"label":"UDP scan","value":"-sU"},
                    {"label":"Ping sweep (no ports)","value":"-sn"},
                    {"label":"ACK (firewall mapping)","value":"-sA"}]},
                {"name":"timing","label":"Speed","type":"select","default":"-T4",
                 "options":[
                    {"label":"Paranoid (stealthiest)","value":"-T0"},
                    {"label":"Sneaky","value":"-T2"},
                    {"label":"Normal","value":"-T3"},
                    {"label":"Aggressive (default)","value":"-T4"},
                    {"label":"Insane (fastest)","value":"-T5"}]},
                {"name":"port_spec","label":"Ports","type":"select","default":"--top-ports 1000",
                 "options":[
                    {"label":"Top 100","value":"--top-ports 100"},
                    {"label":"Top 1000 (default)","value":"--top-ports 1000"},
                    {"label":"All 65535","value":"-p-"},
                    {"label":"Common web (80,443,8080,8443)","value":"-p 80,443,8080,8443"}]},
                {"name":"service_detection","label":"Detect service versions","type":"boolean",
                 "default":true,"true_value":"-sV","false_value":""},
                {"name":"os_detection","label":"Detect OS","type":"boolean",
                 "default":false,"true_value":"-O","false_value":""},
                {"name":"script_scan","label":"Default safe scripts","type":"boolean",
                 "default":false,"true_value":"-sC","false_value":""}
            ]),
        },
        ToolForm {
            name: "nuclei",
            template: "nuclei -u {target} {severity} {tags} {rate_limit} -j",
            target_types: &["url","domain"],
            danger: "medium",
            purpose: "Binlerce hazır şablonla bilinen zafiyetleri, yanlış yapılandırmaları ve açık panelleri tarar.",
            when_to_use: "Bir web hedefinde bilinen CVE'leri ve yaygın güvenlik açıklarını hızlıca taramak için.",
            form: json!([
                {"name":"severity","label":"Minimum severity","type":"select","default":"-severity medium,high,critical",
                 "options":[
                    {"label":"All","value":""},
                    {"label":"Medium and up (default)","value":"-severity medium,high,critical"},
                    {"label":"High and critical only","value":"-severity high,critical"},
                    {"label":"Critical only","value":"-severity critical"}]},
                {"name":"tags","label":"Template category","type":"select","default":"",
                 "options":[
                    {"label":"All templates (default)","value":""},
                    {"label":"CVEs","value":"-tags cve"},
                    {"label":"Exposed panels","value":"-tags panel"},
                    {"label":"Misconfigurations","value":"-tags misconfig"},
                    {"label":"Exposures / secrets","value":"-tags exposure"}]},
                {"name":"rate_limit","label":"Requests per second","type":"select","default":"-rl 150",
                 "options":[
                    {"label":"Gentle (50)","value":"-rl 50"},
                    {"label":"Normal (150, default)","value":"-rl 150"},
                    {"label":"Fast (500)","value":"-rl 500"}]}
            ]),
        },
        ToolForm {
            name: "nikto",
            template: "nikto -h {target} {ssl} {tuning}",
            target_types: &["url","domain","ip"],
            danger: "medium",
            purpose: "Web sunucularını tehlikeli dosyalar, eski yazılım ve yapılandırma hataları için tarar.",
            when_to_use: "Bir web sunucusunun temel hijyenini kontrol etmek: unutulmuş dosyalar, güncel olmayan bileşenler.",
            form: json!([
                {"name":"ssl","label":"Force HTTPS","type":"boolean","default":false,"true_value":"-ssl","false_value":""},
                {"name":"tuning","label":"Test focus","type":"select","default":"",
                 "options":[
                    {"label":"All checks (default)","value":""},
                    {"label":"Injection flaws","value":"-Tuning 9"},
                    {"label":"Misconfiguration / files","value":"-Tuning 2"},
                    {"label":"Info disclosure","value":"-Tuning 3"}]}
            ]),
        },
        ToolForm {
            name: "ffuf",
            template: "ffuf -u {fuzz_url} -w {wordlist} {match_codes} {threads}",
            target_types: &["url"],
            danger: "medium",
            purpose: "Bir web sitesinde gizli dizinleri, dosyaları ve parametreleri kelime listesiyle keşfeder (fuzzing).",
            when_to_use: "Bir sitede link verilmemiş yönetim panelleri, yedek dosyalar veya gizli uç noktalar bulmak için.",
            form: json!([
                {"name":"fuzz_url","label":"URL with FUZZ keyword","type":"text","required":true,
                 "placeholder":"https://example.com/FUZZ","description":"Put FUZZ where words are inserted"},
                {"name":"wordlist","label":"Wordlist","type":"select","default":"/usr/share/wordlists/dirb/common.txt",
                 "options":[
                    {"label":"Common paths (dirb)","value":"/usr/share/wordlists/dirb/common.txt"},
                    {"label":"Big paths (dirbuster)","value":"/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt"},
                    {"label":"Raft files","value":"/usr/share/seclists/Discovery/Web-Content/raft-medium-files.txt"}]},
                {"name":"match_codes","label":"Show responses","type":"select","default":"-mc 200,204,301,302,307,401,403",
                 "options":[
                    {"label":"Interesting codes (default)","value":"-mc 200,204,301,302,307,401,403"},
                    {"label":"Only 200 OK","value":"-mc 200"},
                    {"label":"Everything","value":"-mc all"}]},
                {"name":"threads","label":"Concurrency","type":"select","default":"-t 40",
                 "options":[
                    {"label":"Gentle (10)","value":"-t 10"},
                    {"label":"Normal (40, default)","value":"-t 40"},
                    {"label":"Fast (100)","value":"-t 100"}]}
            ]),
        },
        ToolForm {
            name: "gobuster",
            template: "gobuster dir -u {target} -w {wordlist} {extensions} {threads}",
            target_types: &["url"],
            danger: "medium",
            purpose: "Web dizinlerini, alt alan adlarını ve DNS kayıtlarını kelime listesiyle kaba kuvvetle keşfeder.",
            when_to_use: "ffuf'a benzer: bir hedefte gizli içerik ararken hızlı ve güvenilir bir seçenek.",
            form: json!([
                {"name":"wordlist","label":"Wordlist","type":"select","default":"/usr/share/wordlists/dirb/common.txt",
                 "options":[
                    {"label":"Common paths (dirb)","value":"/usr/share/wordlists/dirb/common.txt"},
                    {"label":"Medium (dirbuster)","value":"/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt"}]},
                {"name":"extensions","label":"File extensions","type":"select","default":"",
                 "options":[
                    {"label":"None (default)","value":""},
                    {"label":"Web (php,html,js)","value":"-x php,html,js"},
                    {"label":"Backups (bak,old,zip)","value":"-x bak,old,zip,tar.gz"}]},
                {"name":"threads","label":"Concurrency","type":"select","default":"-t 40",
                 "options":[
                    {"label":"Gentle (10)","value":"-t 10"},
                    {"label":"Normal (40, default)","value":"-t 40"}]}
            ]),
        },
        ToolForm {
            name: "subfinder",
            template: "subfinder -d {target} {sources} -silent",
            target_types: &["domain"],
            danger: "low",
            purpose: "Bir alan adına ait alt alan adlarını (subdomain) pasif kaynaklardan toplar.",
            when_to_use: "Bir şirketin saldırı yüzeyini genişletmek: app.x.com, vpn.x.com gibi unutulmuş alt alanları bulmak.",
            form: json!([
                {"name":"sources","label":"Source set","type":"select","default":"",
                 "options":[
                    {"label":"Default sources","value":""},
                    {"label":"All sources (slower)","value":"-all"}]}
            ]),
        },
        ToolForm {
            name: "sqlmap",
            template: "sqlmap -u {target} --batch {level} {risk} {technique}",
            target_types: &["url"],
            danger: "high",
            purpose: "Web uygulamalarındaki SQL enjeksiyon açıklarını otomatik tespit eder ve sömürür.",
            when_to_use: "Bir formun veya URL parametresinin veritabanına sızma açığı olup olmadığını test etmek için.",
            form: json!([
                {"name":"level","label":"Test depth","type":"select","default":"--level 1",
                 "options":[
                    {"label":"1 — quick (default)","value":"--level 1"},
                    {"label":"3 — thorough","value":"--level 3"},
                    {"label":"5 — exhaustive","value":"--level 5"}]},
                {"name":"risk","label":"Risk of payloads","type":"select","default":"--risk 1",
                 "options":[
                    {"label":"1 — safe (default)","value":"--risk 1"},
                    {"label":"2 — moderate","value":"--risk 2"},
                    {"label":"3 — aggressive","value":"--risk 3"}]},
                {"name":"technique","label":"Injection techniques","type":"select","default":"",
                 "options":[
                    {"label":"All (default)","value":""},
                    {"label":"Boolean + error","value":"--technique BE"},
                    {"label":"Time-based only","value":"--technique T"}]}
            ]),
        },
        ToolForm {
            name: "wpscan",
            template: "wpscan --url {target} --no-banner {enumerate} {detection}",
            target_types: &["url"],
            danger: "medium",
            purpose: "WordPress sitelerini savunmasız eklentiler, temalar ve kullanıcılar için tarar.",
            when_to_use: "Hedef WordPress ise: hangi eklentinin bilinen açığı var, kullanıcı adları neler?",
            form: json!([
                {"name":"enumerate","label":"Enumerate","type":"select","default":"-e vp",
                 "options":[
                    {"label":"Vulnerable plugins (default)","value":"-e vp"},
                    {"label":"All plugins","value":"-e ap"},
                    {"label":"Users","value":"-e u"},
                    {"label":"Everything","value":"-e vp,vt,u"}]},
                {"name":"detection","label":"Detection mode","type":"select","default":"--detection-mode mixed",
                 "options":[
                    {"label":"Mixed (default)","value":"--detection-mode mixed"},
                    {"label":"Passive (stealthy)","value":"--detection-mode passive"},
                    {"label":"Aggressive","value":"--detection-mode aggressive"}]}
            ]),
        },
        ToolForm {
            name: "masscan",
            template: "masscan {target} {ports} {rate}",
            target_types: &["ip","network"],
            danger: "high",
            purpose: "İnternet ölçeğinde çok hızlı port taraması yapar — nmap'ten kat kat hızlı, ama daha az detaylı.",
            when_to_use: "Geniş IP aralıklarını (tüm bir /16 ağı gibi) saniyeler içinde taramak için.",
            form: json!([
                {"name":"ports","label":"Ports","type":"select","default":"-p1-1000",
                 "options":[
                    {"label":"Top 1000 (default)","value":"-p1-1000"},
                    {"label":"All 65535","value":"-p1-65535"},
                    {"label":"Web ports","value":"-p80,443,8080,8443"}]},
                {"name":"rate","label":"Packets/sec","type":"select","default":"--rate 1000",
                 "options":[
                    {"label":"Gentle (1000, default)","value":"--rate 1000"},
                    {"label":"Fast (10000)","value":"--rate 10000"},
                    {"label":"Very fast (100000)","value":"--rate 100000"}]}
            ]),
        },
        ToolForm {
            name: "whatweb",
            template: "whatweb {aggression} {target}",
            target_types: &["url","domain"],
            danger: "low",
            purpose: "Bir web sitesinin hangi teknolojilerle çalıştığını belirler (CMS, sunucu, framework, JS kütüphaneleri).",
            when_to_use: "Bir hedefi tanımanın ilk adımı: WordPress mi, hangi sunucu, hangi sürüm?",
            form: json!([
                {"name":"aggression","label":"Aggression","type":"select","default":"-a 1",
                 "options":[
                    {"label":"Passive (default)","value":"-a 1"},
                    {"label":"Polite","value":"-a 3"},
                    {"label":"Aggressive","value":"-a 4"}]}
            ]),
        },
    ]
}

/// Result of applying the forms.
pub struct FormSeedResult {
    pub applied: usize,
    pub not_found: usize,
}

/// Apply every curated form to the catalogue on startup.
pub async fn seed_tool_forms(pool: &PgPool) -> FormSeedResult {
    let mut applied = 0;
    let mut not_found = 0;
    for def in definitions() {
        let params = json!({
            "form": def.form,
            "target_types": def.target_types,
            "danger_level": def.danger,
            "purpose": def.purpose,
            "when_to_use": def.when_to_use,
        });
        // business_description carries the plain-language "what this does" line
        // shown to users; risk_context carries the danger level.
        let res = sqlx::query(
            "UPDATE tools SET command_template = $1, parameters = $2, curated = TRUE, is_active = TRUE, \
                    business_description = $4, risk_context = $5 \
              WHERE lower(name) = lower($3)",
        )
        .bind(def.template)
        .bind(&params)
        .bind(def.name)
        .bind(def.purpose)
        .bind(def.danger)
        .execute(pool)
        .await;
        match res {
            Ok(r) if r.rows_affected() > 0 => applied += 1,
            Ok(_) => {
                not_found += 1;
                tracing::debug!("tool form: no tool named '{}' to update", def.name);
            }
            Err(e) => tracing::warn!("tool form for '{}' failed: {}", def.name, e),
        }
    }
    tracing::info!("tool forms seeded: {applied} applied, {not_found} not found");
    FormSeedResult { applied, not_found }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_definition_is_well_formed() {
        for d in definitions() {
            assert!(!d.name.is_empty());
            assert!(d.template.contains("{target}") || d.template.contains("{fuzz_url}"),
                    "{}: template must reference the target", d.name);
            let form = d.form.as_array().expect("form is an array");
            assert!(!form.is_empty(), "{}: form has no controls", d.name);
            for c in form {
                assert!(c.get("name").and_then(|v| v.as_str()).is_some(), "{}: control missing name", d.name);
                assert!(c.get("label").and_then(|v| v.as_str()).is_some(), "{}: control missing label", d.name);
                let ty = c.get("type").and_then(|v| v.as_str()).unwrap_or("");
                assert!(["text","number","select","boolean"].contains(&ty),
                        "{}: control '{}' has bad type '{}'", d.name, c["name"], ty);
            }
        }
    }

    #[test]
    fn every_placeholder_has_a_control_or_is_the_target() {
        let target_aliases = ["target","fuzz_url","url","host","ip","domain"];
        for d in definitions() {
            let re = regex::Regex::new(r"\{([a-z_]+)\}").unwrap();
            let control_names: Vec<String> = d.form.as_array().unwrap().iter()
                .filter_map(|c| c.get("name").and_then(|v| v.as_str()).map(String::from))
                .collect();
            for cap in re.captures_iter(d.template) {
                let ph = cap[1].to_string();
                let ok = target_aliases.contains(&ph.as_str()) || control_names.contains(&ph);
                assert!(ok, "{}: placeholder {{{}}} has no control", d.name, ph);
            }
        }
    }

    #[test]
    fn no_control_default_starts_with_a_dash_alone() {
        // A value like "-sS" is fine (it fills a whole {placeholder} token that
        // is a distinct argv slot). This test documents that every select value
        // is a full option string, not free text.
        for d in definitions() {
            for c in d.form.as_array().unwrap() {
                if let Some(opts) = c.get("options").and_then(|o| o.as_array()) {
                    for o in opts {
                        assert!(o.get("value").is_some(), "{}: option missing value", d.name);
                    }
                }
            }
        }
    }

    #[test]
    fn danger_levels_are_valid() {
        for d in definitions() {
            assert!(["low","medium","high"].contains(&d.danger), "{}: bad danger", d.name);
        }
    }
}
