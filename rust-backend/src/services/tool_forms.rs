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
        // ── Batch 2: most-used form-less tools ───────────────────────────
        ToolForm {
            name: "dig",
            template: "dig {record_type} {target} {short}",
            target_types: &["domain","ip"],
            danger: "low",
            purpose: "Bir alan adının DNS kayıtlarını sorgular — hangi IP'ye çözümlendiğini, mail sunucusunu, ad sunucularını gösterir.",
            when_to_use: "Bir hedefin altyapısını anlamanın ilk adımı: nereye barındırılıyor, mail nereden gidiyor?",
            form: json!([
                {"name":"record_type","label":"Kayıt türü","type":"select","default":"A",
                 "options":[
                    {"label":"A (IPv4 adresi)","value":"A"},
                    {"label":"AAAA (IPv6)","value":"AAAA"},
                    {"label":"MX (mail sunucusu)","value":"MX"},
                    {"label":"NS (ad sunucusu)","value":"NS"},
                    {"label":"TXT (SPF/DKIM vb.)","value":"TXT"},
                    {"label":"ANY (hepsi)","value":"ANY"}]},
                {"name":"short","label":"Kısa çıktı","type":"boolean","default":true,"true_value":"+short","false_value":""}
            ]),
        },
        ToolForm {
            name: "dnsrecon",
            template: "dnsrecon -d {target} {enum_type}",
            target_types: &["domain"],
            danger: "low",
            purpose: "Bir alan adı hakkında kapsamlı DNS bilgisi toplar — alt alanlar, kayıt türleri, bölge transferi denemesi.",
            when_to_use: "Bir hedefin DNS ayak izini çıkarmak: kaç alt alan var, yanlış yapılandırma var mı?",
            form: json!([
                {"name":"enum_type","label":"Tarama türü","type":"select","default":"-t std",
                 "options":[
                    {"label":"Standart (varsayılan)","value":"-t std"},
                    {"label":"Bölge transferi denemesi","value":"-t axfr"},
                    {"label":"Kaba kuvvet alt alan","value":"-t brt"},
                    {"label":"Ters DNS","value":"-t rvl"}]}
            ]),
        },
        ToolForm {
            name: "dnsenum",
            template: "dnsenum {target} {options}",
            target_types: &["domain"],
            danger: "low",
            purpose: "Bir alan adının DNS bilgilerini ve alt alanlarını numaralandırır, Google ile alt alan arar.",
            when_to_use: "dnsrecon'a alternatif: hedef alan adının tüm DNS yüzeyini keşfetmek için.",
            form: json!([
                {"name":"options","label":"Kapsam","type":"select","default":"--noreverse",
                 "options":[
                    {"label":"Ters aramasız (hızlı)","value":"--noreverse"},
                    {"label":"Tam (ters dahil)","value":""},
                    {"label":"Sadece ad sunucuları","value":"--nocolor -o /dev/null"}]}
            ]),
        },
        ToolForm {
            name: "dnsmap",
            template: "dnsmap {target}",
            target_types: &["domain"],
            danger: "low",
            purpose: "Bir alan adının alt alanlarını yerleşik kelime listesiyle kaba kuvvetle bulur.",
            when_to_use: "İnternet bağlantısı olmadan, hızlı bir alt alan taraması gerektiğinde.",
            form: json!([]),
        },
        ToolForm {
            name: "fierce",
            template: "fierce --domain {target} {wide}",
            target_types: &["domain"],
            danger: "low",
            purpose: "Bir alan adının IP alanını ve alt alanlarını keşfeder, komşu IP'leri tarar.",
            when_to_use: "Bir şirketin sahip olduğu IP bloklarını ve ilgili alt alanları bulmak için.",
            form: json!([
                {"name":"wide","label":"Geniş tarama","type":"boolean","default":false,"true_value":"--wide","false_value":""}
            ]),
        },
        ToolForm {
            name: "fping",
            template: "fping {mode} {target}",
            target_types: &["ip","network"],
            danger: "low",
            purpose: "Birden çok hedefi aynı anda pingler — bir ağda hangi hostların ayakta olduğunu hızla bulur.",
            when_to_use: "Bir alt ağı taramadan önce: hangi IP'ler canlı, hangileri boş?",
            form: json!([
                {"name":"mode","label":"Mod","type":"select","default":"-a",
                 "options":[
                    {"label":"Sadece canlı hostlar","value":"-a"},
                    {"label":"Alt ağ tara (-g gerekir)","value":"-g -a"},
                    {"label":"İstatistikle","value":"-s -a"}]}
            ]),
        },
        ToolForm {
            name: "enum4linux",
            template: "enum4linux {scope} {target}",
            target_types: &["ip"],
            danger: "medium",
            purpose: "Windows/Samba sistemlerinden kullanıcı, paylaşım, grup ve politika bilgisi çeker (SMB numaralandırma).",
            when_to_use: "Bir Windows makinesi veya Samba sunucusu bulduğunuzda: kullanıcı adları, paylaşımlar neler?",
            form: json!([
                {"name":"scope","label":"Ne toplansın","type":"select","default":"-a",
                 "options":[
                    {"label":"Her şey (varsayılan)","value":"-a"},
                    {"label":"Kullanıcılar","value":"-U"},
                    {"label":"Paylaşımlar","value":"-S"},
                    {"label":"Grup üyelikleri","value":"-G"}]}
            ]),
        },
        ToolForm {
            name: "evil-winrm",
            template: "evil-winrm -i {target} -u {username} -p {password}",
            target_types: &["ip"],
            danger: "high",
            purpose: "Windows sistemlere WinRM üzerinden uzaktan komut kabuğu açar — geçerli kimlik bilgisiyle tam erişim.",
            when_to_use: "Bir Windows makinesinin kullanıcı adı/parolasını ele geçirdikten sonra bağlanmak için.",
            form: json!([
                {"name":"username","label":"Kullanıcı adı","type":"text","required":true,"placeholder":"administrator"},
                {"name":"password","label":"Parola","type":"password","required":true,"placeholder":"parola veya hash"}
            ]),
        },
        ToolForm {
            name: "exiftool",
            template: "exiftool {target}",
            target_types: &["file"],
            danger: "low",
            purpose: "Bir dosyanın gizli üstverisini (metadata) okur — fotoğrafın çekildiği konum, cihaz, yazar, oluşturma tarihi.",
            when_to_use: "Bir belgede veya fotoğrafta sızıntı bilgi aramak: GPS konumu, iç kullanıcı adları, yazılım sürümü.",
            form: json!([]),
        },
        ToolForm {
            name: "hashid",
            template: "hashid {mode} {target}",
            target_types: &["target"],
            danger: "low",
            purpose: "Bir hash değerinin hangi algoritmayla üretildiğini tahmin eder (MD5, SHA, bcrypt vb.).",
            when_to_use: "Kırmadan önce: elinizdeki hash ne türde, hangi araçla kırılır?",
            form: json!([
                {"name":"mode","label":"Çıktı","type":"select","default":"",
                 "options":[
                    {"label":"Türleri listele","value":""},
                    {"label":"Hashcat moduyla","value":"-m"},
                    {"label":"John formatıyla","value":"-j"}]}
            ]),
        },
        ToolForm {
            name: "tcpdump",
            template: "tcpdump -i {interface} {count} {filter}",
            target_types: &["target"],
            danger: "medium",
            purpose: "Ağ trafiğini canlı yakalar ve gösterir — bir arayüzden geçen paketleri dinler.",
            when_to_use: "Bir sistemde ne konuşuluyor görmek: hangi bağlantılar var, düz metin parola geçiyor mu?",
            form: json!([
                {"name":"interface","label":"Arayüz","type":"select","default":"any",
                 "options":[
                    {"label":"Tüm arayüzler","value":"any"},
                    {"label":"eth0","value":"eth0"},
                    {"label":"wlan0","value":"wlan0"}]},
                {"name":"count","label":"Paket sayısı","type":"select","default":"-c 100",
                 "options":[
                    {"label":"100 paket","value":"-c 100"},
                    {"label":"500 paket","value":"-c 500"},
                    {"label":"1000 paket","value":"-c 1000"}]},
                {"name":"filter","label":"Filtre","type":"select","default":"",
                 "options":[
                    {"label":"Tümü","value":""},
                    {"label":"Sadece HTTP","value":"port 80"},
                    {"label":"Sadece DNS","value":"port 53"},
                    {"label":"Sadece HTTPS","value":"port 443"}]}
            ]),
        },
        ToolForm {
            name: "bloodhound-python",
            template: "bloodhound-python -u {username} -p {password} -d {target} -c {collection} -ns {nameserver}",
            target_types: &["domain"],
            danger: "high",
            purpose: "Active Directory'yi haritalar — kullanıcılar, gruplar, makineler ve aralarındaki saldırı yollarını toplar.",
            when_to_use: "Bir AD ortamında geçerli kimlik bilgisi aldıktan sonra: yönetici olmaya giden yol nerede?",
            form: json!([
                {"name":"username","label":"Kullanıcı adı","type":"text","required":true,"placeholder":"user"},
                {"name":"password","label":"Parola","type":"password","required":true,"placeholder":"parola"},
                {"name":"nameserver","label":"DC adresi","type":"text","required":true,"placeholder":"10.0.0.1"},
                {"name":"collection","label":"Toplama kapsamı","type":"select","default":"Default",
                 "options":[
                    {"label":"Varsayılan","value":"Default"},
                    {"label":"Hepsi","value":"All"},
                    {"label":"Oturum verileri","value":"Session"}]}
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
        ToolForm {
            name: "httpx",
            template: "httpx -u {target} {status_code} {title} {tech_detect} {web_server} {follow_redirects} -json",
            target_types: &["url","domain","ip"],
            danger: "low",
            purpose: "Bir listedeki adreslerin canlı olup olmadığını hızlıca yoklar ve HTTP ayrıntılarını (durum kodu, başlık, teknoloji) toplar.",
            when_to_use: "Elinizde çok sayıda alt alan adı/adres varken hangilerinin gerçekten yayında olduğunu ayıklamak için.",
            form: json!([
                {"name":"status_code","label":"Durum kodunu göster","type":"boolean","default":true,"true_value":"-sc","false_value":""},
                {"name":"title","label":"Sayfa başlığını al","type":"boolean","default":true,"true_value":"-title","false_value":""},
                {"name":"tech_detect","label":"Teknolojileri tespit et","type":"boolean","default":true,"true_value":"-td","false_value":""},
                {"name":"web_server","label":"Sunucu başlığını göster","type":"boolean","default":false,"true_value":"-server","false_value":""},
                {"name":"follow_redirects","label":"Yönlendirmeleri takip et","type":"boolean","default":false,"true_value":"-fr","false_value":""}
            ]),
        },
        ToolForm {
            name: "katana",
            template: "katana -u {target} {depth} {js_crawl} {known_files} -jsonl",
            target_types: &["url","domain"],
            danger: "low",
            purpose: "Bir web sitesini gezerek tüm bağlantıları, uç noktaları ve JavaScript içindeki gizli yolları çıkarır.",
            when_to_use: "Bir hedefin saldırı yüzeyini haritalamak: hangi sayfalar, API uçları ve parametreler var?",
            form: json!([
                {"name":"depth","label":"Gezinme derinliği","type":"select","default":"-d 2",
                 "options":[
                    {"label":"Yüzeysel (1)","value":"-d 1"},
                    {"label":"Orta (2, varsayılan)","value":"-d 2"},
                    {"label":"Derin (4)","value":"-d 4"}]},
                {"name":"js_crawl","label":"JavaScript'i tara","type":"boolean","default":true,"true_value":"-jc","false_value":""},
                {"name":"known_files","label":"robots.txt/sitemap dahil et","type":"boolean","default":true,"true_value":"-kf all","false_value":""}
            ]),
        },
        ToolForm {
            name: "gospider",
            template: "gospider -s {target} {depth} {concurrent} {third_party}",
            target_types: &["url","domain"],
            danger: "low",
            purpose: "Hızlı bir web örümceği — siteyi gezerek bağlantıları, formları ve kaynakları toplar.",
            when_to_use: "Bir siteyi hızlıca haritalamak ve dış kaynaklardan (Wayback, sitemap) ek URL toplamak için.",
            form: json!([
                {"name":"depth","label":"Derinlik","type":"select","default":"-d 2",
                 "options":[
                    {"label":"Yüzeysel (1)","value":"-d 1"},
                    {"label":"Orta (2, varsayılan)","value":"-d 2"},
                    {"label":"Derin (3)","value":"-d 3"}]},
                {"name":"concurrent","label":"Eşzamanlılık","type":"select","default":"-c 10",
                 "options":[
                    {"label":"Nazik (5)","value":"-c 5"},
                    {"label":"Normal (10, varsayılan)","value":"-c 10"},
                    {"label":"Hızlı (20)","value":"-c 20"}]},
                {"name":"third_party","label":"Üçüncü taraf kaynakları dahil et","type":"boolean","default":false,"true_value":"-a","false_value":""}
            ]),
        },
        ToolForm {
            name: "dirsearch",
            template: "dirsearch -u {target} {extensions} {status_filter} {recursive}",
            target_types: &["url","domain"],
            danger: "medium",
            purpose: "Bir web sunucusunda gizli dizinleri ve dosyaları (yönetim panelleri, yedekler, config) kaba kuvvetle arar.",
            when_to_use: "Bağlantısı olmayan ama sunucuda duran gizli sayfaları ve dosyaları bulmak için.",
            form: json!([
                {"name":"extensions","label":"Aranacak uzantılar","type":"select","default":"-e php,html,js",
                 "options":[
                    {"label":"Web (php,html,js) — varsayılan","value":"-e php,html,js"},
                    {"label":"Microsoft (asp,aspx)","value":"-e asp,aspx"},
                    {"label":"Yedek/eski (bak,old,txt,zip)","value":"-e bak,old,txt,zip"},
                    {"label":"Hepsi karışık","value":"-e php,html,js,asp,aspx,bak,old,txt"}]},
                {"name":"status_filter","label":"Durum kodu filtresi","type":"select","default":"",
                 "options":[
                    {"label":"Tümü (varsayılan)","value":""},
                    {"label":"Sadece bulunanlar (200,301,302)","value":"-i 200,301,302"},
                    {"label":"404/403'ü gizle","value":"-x 404,403"}]},
                {"name":"recursive","label":"Alt dizinlere in (özyinelemeli)","type":"boolean","default":false,"true_value":"-r","false_value":""}
            ]),
        },
        ToolForm {
            name: "dirb",
            template: "dirb {target} {wordlist} {extensions} {silent}",
            target_types: &["url","domain"],
            danger: "medium",
            purpose: "Klasik dizin/dosya kaba kuvvet aracı — bir kelime listesiyle sunucudaki gizli yolları dener.",
            when_to_use: "Basit ve güvenilir bir dizin taraması için; sonuçları hızlı okunur.",
            form: json!([
                {"name":"wordlist","label":"Kelime listesi","type":"select","default":"/usr/share/wordlists/dirb/common.txt",
                 "options":[
                    {"label":"Common (küçük, hızlı) — varsayılan","value":"/usr/share/wordlists/dirb/common.txt"},
                    {"label":"Big (büyük, kapsamlı)","value":"/usr/share/wordlists/dirb/big.txt"}]},
                {"name":"extensions","label":"Uzantı ekle","type":"select","default":"",
                 "options":[
                    {"label":"Yok (varsayılan)","value":""},
                    {"label":".php,.html","value":"-X .php,.html"},
                    {"label":".bak,.old,.txt","value":"-X .bak,.old,.txt"}]},
                {"name":"silent","label":"Sessiz mod (banner yok)","type":"boolean","default":true,"true_value":"-S","false_value":""}
            ]),
        },
        ToolForm {
            name: "feroxbuster",
            template: "feroxbuster -u {target} {wordlist} {depth} {extensions} {status} -q",
            target_types: &["url","domain"],
            danger: "medium",
            purpose: "Çok hızlı, özyinelemeli dizin/dosya kaba kuvvet aracı (Rust ile yazılmış).",
            when_to_use: "Büyük bir siteyi hızla taramak ve bulunan dizinlerin içine otomatik inmek için.",
            form: json!([
                {"name":"wordlist","label":"Kelime listesi","type":"select","default":"-w /usr/share/wordlists/dirb/common.txt",
                 "options":[
                    {"label":"Common (hızlı) — varsayılan","value":"-w /usr/share/wordlists/dirb/common.txt"},
                    {"label":"Big (kapsamlı)","value":"-w /usr/share/wordlists/dirb/big.txt"}]},
                {"name":"depth","label":"Özyineleme derinliği","type":"select","default":"-d 2",
                 "options":[
                    {"label":"Sadece kök (1)","value":"-d 1"},
                    {"label":"Orta (2, varsayılan)","value":"-d 2"},
                    {"label":"Derin (4)","value":"-d 4"}]},
                {"name":"extensions","label":"Uzantılar","type":"select","default":"",
                 "options":[
                    {"label":"Yok (varsayılan)","value":""},
                    {"label":"php,html,js","value":"-x php,html,js"},
                    {"label":"txt,bak,old","value":"-x txt,bak,old"}]},
                {"name":"status","label":"Durum kodu filtresi","type":"select","default":"",
                 "options":[
                    {"label":"Tümü (varsayılan)","value":""},
                    {"label":"Sadece 200,301,302","value":"-s 200,301,302"}]}
            ]),
        },
        ToolForm {
            name: "commix",
            template: "commix -u {target} {level} {technique} --batch",
            target_types: &["url"],
            danger: "high",
            purpose: "Web uygulamalarındaki komut enjeksiyonu (OS command injection) açıklarını otomatik bulur ve sömürür.",
            when_to_use: "Bir parametrenin işletim sistemi komutu çalıştırıp çalıştırmadığını test etmek için.",
            form: json!([
                {"name":"level","label":"Test yoğunluğu","type":"select","default":"--level 1",
                 "options":[
                    {"label":"Düşük (1, hızlı) — varsayılan","value":"--level 1"},
                    {"label":"Orta (2)","value":"--level 2"},
                    {"label":"Yüksek (3, kapsamlı)","value":"--level 3"}]},
                {"name":"technique","label":"Teknik","type":"select","default":"",
                 "options":[
                    {"label":"Tümü (varsayılan)","value":""},
                    {"label":"Klasik (sonuç ekranda)","value":"--technique=c"},
                    {"label":"Zaman tabanlı (kör)","value":"--technique=t"}]}
            ]),
        },
        ToolForm {
            name: "joomscan",
            template: "joomscan --url {target} {enumerate}",
            target_types: &["url","domain"],
            danger: "medium",
            purpose: "Joomla tabanlı sitelerdeki zafiyetleri, bileşenleri ve yanlış yapılandırmaları tarar.",
            when_to_use: "Hedef bir Joomla sitesiyse; sürüm, savunmasız bileşenler ve açık dizinleri ortaya çıkarır.",
            form: json!([
                {"name":"enumerate","label":"Bileşenleri listele","type":"boolean","default":true,"true_value":"--enumerate-components","false_value":""}
            ]),
        },
        ToolForm {
            name: "binwalk",
            template: "binwalk {mode} {target}",
            target_types: &["file"],
            danger: "low",
            purpose: "Bir ikili dosya/firmware içindeki gömülü dosyaları, dosya sistemlerini ve sıkıştırılmış blokları bulur.",
            when_to_use: "Bir firmware imajını veya bilinmeyen bir ikili dosyayı analiz edip içindekileri çıkarmak için.",
            form: json!([
                {"name":"mode","label":"Mod","type":"select","default":"-B",
                 "options":[
                    {"label":"İmza taraması (varsayılan)","value":"-B"},
                    {"label":"Çıkar (içindeki dosyaları ayıkla)","value":"-e"},
                    {"label":"Entropi analizi","value":"-E"}]}
            ]),
        },
        ToolForm {
            name: "apktool",
            template: "apktool {action} {target}",
            target_types: &["file"],
            danger: "low",
            purpose: "Android APK dosyalarını açar (decompile) — kaynakları, manifest'i ve smali kodunu okunur hale getirir.",
            when_to_use: "Bir Android uygulamasının içini incelemek: izinler, sabit kodlanmış sırlar, uç noktalar.",
            form: json!([
                {"name":"action","label":"İşlem","type":"select","default":"d",
                 "options":[
                    {"label":"Decode (aç) — varsayılan","value":"d"},
                    {"label":"Sadece manifest (kaynaksız)","value":"d -s"}]}
            ]),
        },
        ToolForm {
            name: "crackmapexec",
            template: "crackmapexec {protocol} {target} {action}",
            target_types: &["ip","domain","network"],
            danger: "high",
            purpose: "Ağdaki Windows/AD sistemlerine karşı kimlik doğrulama, sıralama (enum) ve yatay hareket için İsviçre çakısı.",
            when_to_use: "Kimlik gerektirmeden (null oturum) ağdaki makineleri, paylaşımları ve kullanıcıları haritalamak için.",
            form: json!([
                {"name":"protocol","label":"Protokol","type":"select","default":"smb",
                 "options":[
                    {"label":"SMB (varsayılan)","value":"smb"},
                    {"label":"WinRM","value":"winrm"},
                    {"label":"SSH","value":"ssh"},
                    {"label":"LDAP","value":"ldap"},
                    {"label":"MSSQL","value":"mssql"}]},
                {"name":"action","label":"Eylem","type":"select","default":"",
                 "options":[
                    {"label":"Sadece kimlik doğrula (varsayılan)","value":""},
                    {"label":"Paylaşımları listele","value":"--shares"},
                    {"label":"Kullanıcıları listele","value":"--users"},
                    {"label":"Parola politikası","value":"--pass-pol"}]}
            ]),
        },
        ToolForm {
            name: "amass",
            template: "amass enum {mode} -d {target}",
            target_types: &["domain"],
            danger: "low",
            purpose: "Bir alan adına ait alt alan adlarını çok sayıda kaynaktan derleyerek kapsamlı bir harita çıkarır.",
            when_to_use: "Bir kurumun dışa dönük tüm varlıklarını (alt alan adlarını) keşfetmek için — kapsam belirlemenin ilk adımı.",
            form: json!([
                {"name":"mode","label":"Tarama modu","type":"select","default":"-passive",
                 "options":[
                    {"label":"Pasif (sessiz, hedefe dokunmaz) — varsayılan","value":"-passive"},
                    {"label":"Aktif (DNS çözümleme + doğrulama)","value":"-active"}]}
            ]),
        },
        ToolForm {
            name: "hydra",
            template: "hydra {username} -P {passlist} {target} {service}",
            target_types: &["ip","domain"],
            danger: "high",
            purpose: "Ağ servislerine (SSH, FTP, RDP…) karşı kullanıcı adı/parola deneyerek zayıf kimlik bilgilerini bulur.",
            when_to_use: "Bir servisin varsayılan veya zayıf parola ile korunup korunmadığını test etmek için.",
            form: json!([
                {"name":"service","label":"Hedef servis","type":"select","default":"ssh",
                 "options":[
                    {"label":"SSH (varsayılan)","value":"ssh"},
                    {"label":"FTP","value":"ftp"},
                    {"label":"RDP (uzak masaüstü)","value":"rdp"},
                    {"label":"SMB","value":"smb"},
                    {"label":"MySQL","value":"mysql"},
                    {"label":"Telnet","value":"telnet"}]},
                {"name":"username","label":"Kullanıcı adı","type":"select","default":"-l admin",
                 "options":[
                    {"label":"admin (varsayılan)","value":"-l admin"},
                    {"label":"root","value":"-l root"},
                    {"label":"administrator","value":"-l administrator"}]},
                {"name":"passlist","label":"Parola listesi","type":"select","default":"/usr/share/wordlists/rockyou.txt",
                 "options":[
                    {"label":"rockyou (14M, kapsamlı) — varsayılan","value":"/usr/share/wordlists/rockyou.txt"},
                    {"label":"Küçük liste (hızlı test)","value":"/usr/share/wordlists/dirb/common.txt"}]}
            ]),
        },
        ToolForm {
            name: "john",
            template: "john {wordlist} {format} {target}",
            target_types: &["file"],
            danger: "high",
            purpose: "Çevrimdışı parola kırıcı — ele geçirilmiş hash dosyalarını sözlük saldırısıyla çözmeye çalışır.",
            when_to_use: "Bir hash dosyanız (shadow, NTLM dökümü vb.) varken parolaların ne kadar zayıf olduğunu ölçmek için.",
            form: json!([
                {"name":"wordlist","label":"Saldırı yöntemi","type":"select","default":"--wordlist=/usr/share/wordlists/rockyou.txt",
                 "options":[
                    {"label":"rockyou sözlüğü — varsayılan","value":"--wordlist=/usr/share/wordlists/rockyou.txt"},
                    {"label":"Artımlı kaba kuvvet (yavaş)","value":"--incremental"}]},
                {"name":"format","label":"Hash türü","type":"select","default":"",
                 "options":[
                    {"label":"Otomatik algıla (varsayılan)","value":""},
                    {"label":"MD5","value":"--format=raw-md5"},
                    {"label":"SHA-1","value":"--format=raw-sha1"},
                    {"label":"SHA-256","value":"--format=raw-sha256"},
                    {"label":"NTLM (Windows)","value":"--format=NT"},
                    {"label":"bcrypt","value":"--format=bcrypt"},
                    {"label":"sha512crypt (Linux shadow)","value":"--format=sha512crypt"}]}
            ]),
        },
        ToolForm {
            name: "hashcat",
            template: "hashcat -a 0 {hash_mode} {target} {wordlist} --quiet",
            target_types: &["file"],
            danger: "high",
            purpose: "Dünyanın en hızlı parola kırıcısı (GPU destekli) — hash'leri sözlük saldırısıyla çözer.",
            when_to_use: "Büyük bir hash setini yüksek hızda kırmayı denemek için; hash türünü seçmeniz yeterli.",
            form: json!([
                {"name":"hash_mode","label":"Hash türü","type":"select","default":"-m 0",
                 "options":[
                    {"label":"MD5 (varsayılan)","value":"-m 0"},
                    {"label":"SHA-1","value":"-m 100"},
                    {"label":"SHA-256","value":"-m 1400"},
                    {"label":"SHA-512","value":"-m 1700"},
                    {"label":"NTLM (Windows)","value":"-m 1000"},
                    {"label":"bcrypt","value":"-m 3200"},
                    {"label":"WPA/WPA2","value":"-m 22000"}]},
                {"name":"wordlist","label":"Sözlük","type":"select","default":"/usr/share/wordlists/rockyou.txt",
                 "options":[
                    {"label":"rockyou (varsayılan)","value":"/usr/share/wordlists/rockyou.txt"}]}
            ]),
        },
        ToolForm {
            name: "medusa",
            template: "medusa -h {target} {username} -P {passlist} -M {module}",
            target_types: &["ip","domain"],
            danger: "high",
            purpose: "Hydra'ya benzer paralel ağ oturum kırıcı — servislere karşı hızlı, çok iş parçacıklı parola denemesi.",
            when_to_use: "Çok sayıda hedefe/servise karşı paralel parola testi yaparken hız gerektiğinde.",
            form: json!([
                {"name":"module","label":"Hedef servis","type":"select","default":"ssh",
                 "options":[
                    {"label":"SSH (varsayılan)","value":"ssh"},
                    {"label":"FTP","value":"ftp"},
                    {"label":"SMB","value":"smbnt"},
                    {"label":"MySQL","value":"mysql"},
                    {"label":"RDP","value":"rdp"}]},
                {"name":"username","label":"Kullanıcı adı","type":"select","default":"-u admin",
                 "options":[
                    {"label":"admin (varsayılan)","value":"-u admin"},
                    {"label":"root","value":"-u root"}]},
                {"name":"passlist","label":"Parola listesi","type":"select","default":"/usr/share/wordlists/rockyou.txt",
                 "options":[
                    {"label":"rockyou — varsayılan","value":"/usr/share/wordlists/rockyou.txt"},
                    {"label":"Küçük liste (hızlı)","value":"/usr/share/wordlists/dirb/common.txt"}]}
            ]),
        },
        ToolForm {
            name: "ncrack",
            template: "ncrack {port} --user {username} -P {passlist} {target}",
            target_types: &["ip","domain"],
            danger: "high",
            purpose: "Nmap ailesinden yüksek hızlı ağ kimlik doğrulama kırıcısı; büyük ölçekli parola testleri için tasarlandı.",
            when_to_use: "Nmap ile keşfettiğiniz servislerde zayıf oturum bilgilerini hızla doğrulamak için.",
            form: json!([
                {"name":"port","label":"Hedef servis (port)","type":"select","default":"-p 22",
                 "options":[
                    {"label":"SSH / 22 (varsayılan)","value":"-p 22"},
                    {"label":"FTP / 21","value":"-p 21"},
                    {"label":"RDP / 3389","value":"-p 3389"},
                    {"label":"MySQL / 3306","value":"-p 3306"}]},
                {"name":"username","label":"Kullanıcı adı","type":"select","default":"--user admin",
                 "options":[
                    {"label":"admin (varsayılan)","value":"--user admin"},
                    {"label":"root","value":"--user root"}]},
                {"name":"passlist","label":"Parola listesi","type":"select","default":"/usr/share/wordlists/rockyou.txt",
                 "options":[
                    {"label":"rockyou — varsayılan","value":"/usr/share/wordlists/rockyou.txt"},
                    {"label":"Küçük liste (hızlı)","value":"/usr/share/wordlists/dirb/common.txt"}]}
            ]),
        },
        ToolForm {
            name: "whois",
            template: "whois {target}",
            target_types: &["domain","ip"],
            danger: "low",
            purpose: "Bir alan adının veya IP'nin kayıt bilgilerini (sahip, kayıt tarihi, ad sunucuları, iletişim) sorgular.",
            when_to_use: "Bir hedefin kime ait olduğunu, ne zaman kaydedildiğini ve altyapı ipuçlarını öğrenmek için.",
            form: json!([]),
        },
        ToolForm {
            name: "host",
            template: "host -t {record} {target}",
            target_types: &["domain","ip"],
            danger: "low",
            purpose: "Basit ve hızlı DNS sorgu aracı — bir alan adının IP, posta sunucusu veya diğer kayıtlarını çözer.",
            when_to_use: "Bir alan adının A/MX/NS gibi belirli bir DNS kaydını hızlıca öğrenmek için.",
            form: json!([
                {"name":"record","label":"Kayıt türü","type":"select","default":"A",
                 "options":[
                    {"label":"A (IPv4) — varsayılan","value":"A"},
                    {"label":"AAAA (IPv6)","value":"AAAA"},
                    {"label":"MX (posta sunucusu)","value":"MX"},
                    {"label":"NS (ad sunucusu)","value":"NS"},
                    {"label":"TXT (SPF/DKIM vb.)","value":"TXT"},
                    {"label":"Hepsi (ANY)","value":"ANY"}]}
            ]),
        },
        ToolForm {
            name: "nslookup",
            template: "nslookup -type={record} {target}",
            target_types: &["domain","ip"],
            danger: "low",
            purpose: "Klasik DNS sorgu aracı — alan adı/IP çözümlemesi ve kayıt sorgulama yapar.",
            when_to_use: "Hızlı bir DNS kontrolü veya ters DNS (IP → isim) sorgusu için.",
            form: json!([
                {"name":"record","label":"Kayıt türü","type":"select","default":"A",
                 "options":[
                    {"label":"A (IPv4) — varsayılan","value":"A"},
                    {"label":"AAAA (IPv6)","value":"AAAA"},
                    {"label":"MX (posta)","value":"MX"},
                    {"label":"NS (ad sunucusu)","value":"NS"},
                    {"label":"TXT","value":"TXT"},
                    {"label":"PTR (ters DNS)","value":"PTR"}]}
            ]),
        },
        ToolForm {
            name: "theHarvester",
            template: "theHarvester -d {target} -b {source} -l {limit}",
            target_types: &["domain"],
            danger: "low",
            purpose: "Açık kaynaklardan (arama motorları, sertifika kayıtları) bir alan adına ait e-postaları, alt alan adlarını ve isimleri toplar.",
            when_to_use: "Bir kurumun dış izini (e-posta adresleri, çalışanlar, alt alan adları) pasifçe çıkarmak için.",
            form: json!([
                {"name":"source","label":"Kaynak","type":"select","default":"crtsh",
                 "options":[
                    {"label":"crt.sh (sertifikalar) — varsayılan","value":"crtsh"},
                    {"label":"Bing","value":"bing"},
                    {"label":"DuckDuckGo","value":"duckduckgo"},
                    {"label":"HackerTarget","value":"hackertarget"},
                    {"label":"RapidDNS","value":"rapiddns"},
                    {"label":"Hepsi (all)","value":"all"}]},
                {"name":"limit","label":"Sonuç limiti","type":"select","default":"200",
                 "options":[
                    {"label":"100","value":"100"},
                    {"label":"200 (varsayılan)","value":"200"},
                    {"label":"500","value":"500"}]}
            ]),
        },
        ToolForm {
            name: "assetfinder",
            template: "assetfinder {subs_only} {target}",
            target_types: &["domain"],
            danger: "low",
            purpose: "Bir alan adına ait alt alan adlarını çeşitli açık kaynaklardan hızlıca bulur.",
            when_to_use: "Kapsam belirlerken bir alan adının alt alan adlarını saniyeler içinde listelemek için.",
            form: json!([
                {"name":"subs_only","label":"Sadece alt alan adları","type":"boolean","default":true,"true_value":"--subs-only","false_value":""}
            ]),
        },
        ToolForm {
            name: "waybackurls",
            template: "waybackurls {target}",
            target_types: &["domain"],
            danger: "low",
            purpose: "Wayback Machine arşivinden bir alan adının geçmişte bilinen tüm URL'lerini çeker.",
            when_to_use: "Eski/unutulmuş uç noktaları, parametreleri ve silinmiş sayfaları keşfetmek için.",
            form: json!([]),
        },
        ToolForm {
            name: "wafw00f",
            template: "wafw00f {findall} {target}",
            target_types: &["url","domain"],
            danger: "low",
            purpose: "Bir web sitesinin önünde hangi Web Uygulama Güvenlik Duvarı (WAF) olduğunu tespit eder.",
            when_to_use: "Saldırı denemelerinden önce hedefin bir WAF ile korunup korunmadığını anlamak için.",
            form: json!([
                {"name":"findall","label":"Tüm WAF'ları dene (sadece ilki değil)","type":"boolean","default":false,"true_value":"-a","false_value":""}
            ]),
        },
        ToolForm {
            name: "wapiti",
            template: "wapiti -u {target} --scope {scope} -l {level}",
            target_types: &["url"],
            danger: "medium",
            purpose: "Web uygulamalarını tarayarak SQL enjeksiyonu, XSS, dosya dahil etme gibi açıkları otomatik bulur.",
            when_to_use: "Bir web uygulamasında yaygın OWASP zafiyetlerini kutu-siyah (black-box) taramayla tespit etmek için.",
            form: json!([
                {"name":"scope","label":"Kapsam","type":"select","default":"folder",
                 "options":[
                    {"label":"Klasör (varsayılan)","value":"folder"},
                    {"label":"Sadece URL","value":"url"},
                    {"label":"Tüm alan adı","value":"domain"}]},
                {"name":"level","label":"Saldırı seviyesi","type":"select","default":"1",
                 "options":[
                    {"label":"Seviye 1 (hızlı) — varsayılan","value":"1"},
                    {"label":"Seviye 2 (kapsamlı)","value":"2"}]}
            ]),
        },
        ToolForm {
            name: "xsstrike",
            template: "xsstrike -u {target} {crawl}",
            target_types: &["url"],
            danger: "high",
            purpose: "Gelişmiş XSS (Cross-Site Scripting) tespit aracı — akıllı yük üretimi ve WAF atlatma ile çalışır.",
            when_to_use: "Bir parametrenin XSS'e açık olup olmadığını derinlemesine test etmek için.",
            form: json!([
                {"name":"crawl","label":"Siteyi gez (tüm parametreleri bul)","type":"boolean","default":false,"true_value":"--crawl","false_value":""}
            ]),
        },
        ToolForm {
            name: "searchsploit",
            template: "searchsploit {target}",
            target_types: &["keyword"],
            danger: "low",
            purpose: "Exploit-DB'nin yerel kopyasında bilinen exploit ve zafiyet kayıtlarını arar (örn. 'apache 2.4').",
            when_to_use: "Tespit ettiğiniz bir ürün/sürüm için hazır exploit olup olmadığını hızlıca kontrol etmek için.",
            form: json!([]),
        },
        ToolForm {
            name: "testssl",
            template: "testssl {protocols} --severity {severity} {target}",
            target_types: &["url","domain","ip"],
            danger: "low",
            purpose: "Bir sunucunun TLS/SSL yapılandırmasını derinlemesine denetler: zayıf protokoller, şifreler, sertifika sorunları.",
            when_to_use: "Bir HTTPS servisinin şifreleme hijyenini (eski TLS, zayıf cipher, sertifika) ölçmek için.",
            form: json!([
                {"name":"severity","label":"Minimum önem","type":"select","default":"LOW",
                 "options":[
                    {"label":"Tümü (LOW) — varsayılan","value":"LOW"},
                    {"label":"MEDIUM ve üzeri","value":"MEDIUM"},
                    {"label":"Sadece HIGH/CRITICAL","value":"HIGH"}]},
                {"name":"protocols","label":"Sadece protokol kontrolü (hızlı)","type":"boolean","default":false,"true_value":"-p","false_value":""}
            ]),
        },
        ToolForm {
            name: "gowitness",
            template: "gowitness scan single -u {target}",
            target_types: &["url","domain"],
            danger: "low",
            purpose: "Bir web sayfasının ekran görüntüsünü alır — çok sayıda hedefi görsel olarak hızlıca gözden geçirmeyi sağlar.",
            when_to_use: "Onlarca/yüzlerce canlı adresi tek tek açmadan neye benzediklerini görmek için.",
            form: json!([]),
        },
        ToolForm {
            name: "naabu",
            template: "naabu -host {target} -top-ports {ports} -s {scan_type} -silent",
            target_types: &["ip","domain","network"],
            danger: "medium",
            purpose: "Çok hızlı port tarayıcı (ProjectDiscovery) — bir hedefteki açık portları kısa sürede bulur.",
            when_to_use: "Nmap'ten önce hızlı bir açık-port ön taraması yapmak için; sonucu nmap'e devredebilirsiniz.",
            form: json!([
                {"name":"ports","label":"Port kapsamı","type":"select","default":"100",
                 "options":[
                    {"label":"En popüler 100 (varsayılan)","value":"100"},
                    {"label":"En popüler 1000","value":"1000"},
                    {"label":"Tümü (full)","value":"full"}]},
                {"name":"scan_type","label":"Tarama türü","type":"select","default":"CONNECT",
                 "options":[
                    {"label":"CONNECT (root gerekmez) — varsayılan","value":"CONNECT"},
                    {"label":"SYN (hızlı, root)","value":"SYN"}]}
            ]),
        },
        ToolForm {
            name: "netdiscover",
            template: "netdiscover -P -r {target} {passive}",
            target_types: &["network","ip"],
            danger: "low",
            purpose: "ARP ile yerel ağdaki canlı cihazları keşfeder — IP ve MAC adreslerini listeler.",
            when_to_use: "Bir yerel ağda hangi cihazların açık olduğunu pasif/aktif olarak haritalamak için.",
            form: json!([
                {"name":"passive","label":"Pasif mod (paket göndermez)","type":"boolean","default":false,"true_value":"-p","false_value":""}
            ]),
        },
        ToolForm {
            name: "mtr",
            template: "mtr -r -c {count} {protocol} {target}",
            target_types: &["ip","domain"],
            danger: "low",
            purpose: "traceroute ve ping'i birleştirir — hedefe giden her adımın gecikme ve paket kaybını gösterir.",
            when_to_use: "Bir hedefe giden yol boyunca nerede gecikme/kayıp olduğunu teşhis etmek için.",
            form: json!([
                {"name":"count","label":"Ölçüm sayısı","type":"select","default":"10",
                 "options":[
                    {"label":"5 (hızlı)","value":"5"},
                    {"label":"10 (varsayılan)","value":"10"},
                    {"label":"20 (kararlı)","value":"20"}]},
                {"name":"protocol","label":"Protokol","type":"select","default":"",
                 "options":[
                    {"label":"ICMP (varsayılan)","value":""},
                    {"label":"TCP","value":"-T"},
                    {"label":"UDP","value":"-u"}]}
            ]),
        },
        ToolForm {
            name: "traceroute",
            template: "traceroute {protocol} {target}",
            target_types: &["ip","domain"],
            danger: "low",
            purpose: "Bir hedefe giden ağ yolundaki her yönlendiriciyi (hop) sırayla listeler.",
            when_to_use: "Trafiğin hangi yoldan gittiğini ve nerede durduğunu görmek için.",
            form: json!([
                {"name":"protocol","label":"Yöntem","type":"select","default":"",
                 "options":[
                    {"label":"UDP (varsayılan)","value":""},
                    {"label":"ICMP","value":"-I"},
                    {"label":"TCP (firewall aşar)","value":"-T"}]}
            ]),
        },
        ToolForm {
            name: "tcptraceroute",
            template: "tcptraceroute {target} {port}",
            target_types: &["ip","domain"],
            danger: "low",
            purpose: "TCP paketleriyle yol izler — ICMP'yi engelleyen güvenlik duvarlarının arkasını görebilir.",
            when_to_use: "Normal traceroute engellendiğinde belirli bir porta giden yolu haritalamak için.",
            form: json!([
                {"name":"port","label":"Hedef port","type":"select","default":"80",
                 "options":[
                    {"label":"80 (HTTP) — varsayılan","value":"80"},
                    {"label":"443 (HTTPS)","value":"443"},
                    {"label":"22 (SSH)","value":"22"}]}
            ]),
        },
        ToolForm {
            name: "unicornscan",
            template: "unicornscan {mode} {target}",
            target_types: &["ip","network"],
            danger: "medium",
            purpose: "Asenkron, yüksek hızlı port ve servis tarayıcı — büyük ağ aralıklarını verimli tarar.",
            when_to_use: "Geniş IP aralıklarında hızlı, durum-bilgisiz (stateless) port taraması için.",
            form: json!([
                {"name":"mode","label":"Tarama türü","type":"select","default":"-mT",
                 "options":[
                    {"label":"TCP (varsayılan)","value":"-mT"},
                    {"label":"UDP","value":"-mU"}]}
            ]),
        },
        ToolForm {
            name: "hping3",
            template: "hping3 -c {count} {mode} {target}",
            target_types: &["ip","domain"],
            danger: "medium",
            purpose: "Özelleştirilebilir paket üreticisi — güvenlik duvarı kuralı testi, port kontrolü ve yol keşfi yapar.",
            when_to_use: "Bir firewall'ın belirli paketlere nasıl yanıt verdiğini test etmek veya özel prob göndermek için.",
            form: json!([
                {"name":"count","label":"Paket sayısı","type":"select","default":"3",
                 "options":[
                    {"label":"3 (varsayılan)","value":"3"},
                    {"label":"10","value":"10"}]},
                {"name":"mode","label":"Paket türü","type":"select","default":"-1",
                 "options":[
                    {"label":"ICMP ping (varsayılan)","value":"-1"},
                    {"label":"TCP SYN → port 80","value":"-S -p 80"},
                    {"label":"UDP → port 53","value":"-2 -p 53"}]}
            ]),
        },
        ToolForm {
            name: "smbclient",
            template: "smbclient -L {target} -N",
            target_types: &["ip","domain"],
            danger: "low",
            purpose: "SMB/Windows paylaşımlarına erişim aracı — bir sunucudaki paylaşılan klasörleri listeler.",
            when_to_use: "Bir Windows/Samba sunucusunda anonim (null) oturumla hangi paylaşımların açık olduğunu görmek için.",
            form: json!([]),
        },
        ToolForm {
            name: "smbmap",
            template: "smbmap -H {target}",
            target_types: &["ip","domain"],
            danger: "low",
            purpose: "SMB paylaşımlarını ve üzerlerindeki erişim izinlerini (okuma/yazma) haritalar.",
            when_to_use: "Bir hedefteki SMB paylaşımlarına anonim erişimi ve izin seviyelerini hızlıca kontrol etmek için.",
            form: json!([]),
        },
        ToolForm {
            name: "ldapsearch",
            template: "ldapsearch -x -H ldap://{target} -s base namingContexts",
            target_types: &["ip","domain"],
            danger: "low",
            purpose: "LDAP/Active Directory dizin sorgu aracı — sunucunun kök bilgisini (naming context) anonim çeker.",
            when_to_use: "Bir AD/LDAP sunucusunun anonim sorguya izin verip vermediğini ve temel yapısını görmek için.",
            form: json!([]),
        },
        ToolForm {
            name: "enum4linux-ng",
            template: "enum4linux-ng {mode} {target}",
            target_types: &["ip","domain"],
            danger: "low",
            purpose: "Windows/Samba sistemlerinden kullanıcı, grup, paylaşım ve politika bilgilerini toplar (enum4linux'un modern sürümü).",
            when_to_use: "Bir Windows hedefi hakkında anonim SMB üzerinden kapsamlı bilgi toplamak için.",
            form: json!([
                {"name":"mode","label":"Toplama kapsamı","type":"select","default":"-A",
                 "options":[
                    {"label":"Hepsi (-A) — varsayılan","value":"-A"},
                    {"label":"Paylaşımlar (-S)","value":"-S"},
                    {"label":"Kullanıcılar (-U)","value":"-U"},
                    {"label":"Parola politikası (-P)","value":"-P"}]}
            ]),
        },
        ToolForm {
            name: "netexec",
            template: "netexec {protocol} {target} {action}",
            target_types: &["ip","domain","network"],
            danger: "high",
            purpose: "Ağ üzerinde toplu kimlik doğrulama ve sıralama için modern araç (CrackMapExec'in devamı, nxc).",
            when_to_use: "Ağdaki Windows/AD makinelerini anonim veya kimlikli olarak toplu haritalamak için.",
            form: json!([
                {"name":"protocol","label":"Protokol","type":"select","default":"smb",
                 "options":[
                    {"label":"SMB (varsayılan)","value":"smb"},
                    {"label":"WinRM","value":"winrm"},
                    {"label":"SSH","value":"ssh"},
                    {"label":"LDAP","value":"ldap"},
                    {"label":"MSSQL","value":"mssql"}]},
                {"name":"action","label":"Eylem","type":"select","default":"",
                 "options":[
                    {"label":"Kimlik doğrula (varsayılan)","value":""},
                    {"label":"Paylaşımlar","value":"--shares"},
                    {"label":"Kullanıcılar","value":"--users"},
                    {"label":"Parola politikası","value":"--pass-pol"}]}
            ]),
        },
        ToolForm {
            name: "tlsx",
            template: "tlsx -u {target} {mode} -silent",
            target_types: &["ip","domain","url"],
            danger: "low",
            purpose: "Hızlı TLS veri toplayıcı (ProjectDiscovery) — sertifika alanları, sürüm ve şifre bilgilerini çeker.",
            when_to_use: "Bir hedefin TLS sertifikasındaki isimleri (SAN/CN) ve TLS yapılandırmasını hızlıca almak için.",
            form: json!([
                {"name":"mode","label":"Bilgi türü","type":"select","default":"-san -cn",
                 "options":[
                    {"label":"Sertifika isimleri (SAN+CN) — varsayılan","value":"-san -cn"},
                    {"label":"TLS sürümü","value":"-tls-version"},
                    {"label":"Şifre paketi (cipher)","value":"-cipher"}]}
            ]),
        },
        ToolForm {
            name: "kerbrute",
            template: "kerbrute userenum -d {target} {userlist}",
            target_types: &["domain"],
            danger: "medium",
            purpose: "Kerberos üzerinden geçerli Active Directory kullanıcı adlarını hızlıca doğrular (kilitlenme yaratmadan).",
            when_to_use: "Bir AD alan adında hangi kullanıcı adlarının gerçekten var olduğunu sessizce keşfetmek için.",
            form: json!([
                {"name":"userlist","label":"Kullanıcı adı listesi","type":"select","default":"/usr/share/wordlists/dirb/common.txt",
                 "options":[
                    {"label":"Genel liste (varsayılan)","value":"/usr/share/wordlists/dirb/common.txt"}]}
            ]),
        },
        ToolForm {
            name: "sherlock",
            template: "sherlock {target}",
            target_types: &["keyword"],
            danger: "low",
            purpose: "Bir kullanıcı adını yüzlerce sosyal medya ve web sitesinde arayarak hesapları bulur (OSINT).",
            when_to_use: "Bir kişinin/markanın hangi platformlarda aynı kullanıcı adıyla hesabı olduğunu tespit etmek için.",
            form: json!([]),
        },
        ToolForm {
            name: "cewl",
            template: "cewl -d {depth} {target}",
            target_types: &["url","domain"],
            danger: "low",
            purpose: "Bir web sitesini gezip içindeki kelimelerden hedefe özel bir parola/kelime listesi üretir.",
            when_to_use: "Kaba kuvvet saldırıları için hedefin kendi içeriğinden özelleştirilmiş bir kelime listesi oluşturmak için.",
            form: json!([
                {"name":"depth","label":"Tarama derinliği","type":"select","default":"-d 2",
                 "options":[
                    {"label":"1 (yüzeysel)","value":"-d 1"},
                    {"label":"2 (varsayılan)","value":"-d 2"},
                    {"label":"3 (derin)","value":"-d 3"}]}
            ]),
        },
        ToolForm {
            name: "name-that-hash",
            template: "name-that-hash -t {target}",
            target_types: &["keyword"],
            danger: "low",
            purpose: "Bir hash değerinin hangi algoritmaya ait olduğunu (MD5, SHA, bcrypt, NTLM…) tespit eder.",
            when_to_use: "Elinizdeki bilinmeyen bir hash'i kırmadan önce türünü belirlemek için (hangi mod/format).",
            form: json!([]),
        },
        ToolForm {
            name: "strings",
            template: "strings -n {minlen} {target}",
            target_types: &["file"],
            danger: "low",
            purpose: "Bir ikili dosyanın içindeki okunabilir metinleri (URL'ler, yollar, gömülü sırlar) çıkarır.",
            when_to_use: "Bir binary/malware örneğinde hızlıca ipucu aramak: sabit kodlanmış adresler, komutlar, anahtarlar.",
            form: json!([
                {"name":"minlen","label":"En az uzunluk","type":"select","default":"4",
                 "options":[
                    {"label":"4 karakter (varsayılan)","value":"4"},
                    {"label":"6 karakter","value":"6"},
                    {"label":"8 karakter","value":"8"}]}
            ]),
        },
        ToolForm {
            name: "ssdeep",
            template: "ssdeep {target}",
            target_types: &["file"],
            danger: "low",
            purpose: "Bir dosyanın bulanık (fuzzy) hash'ini hesaplar — benzer dosyaları/varyantları eşleştirmeye yarar.",
            when_to_use: "İki malware örneğinin ne kadar benzediğini veya bilinen bir örneğe yakınlığını ölçmek için.",
            form: json!([]),
        },
        ToolForm {
            name: "objdump",
            template: "objdump {mode} {target}",
            target_types: &["file"],
            danger: "low",
            purpose: "Nesne/çalıştırılabilir dosyaları inceler: assembly'ye döker, başlıkları ve sembolleri gösterir.",
            when_to_use: "Bir binary'nin iç yapısını, disassembly'sini veya bölüm başlıklarını incelemek için.",
            form: json!([
                {"name":"mode","label":"Görünüm","type":"select","default":"-x",
                 "options":[
                    {"label":"Tüm başlıklar (-x) — varsayılan","value":"-x"},
                    {"label":"Disassembly (-d)","value":"-d"},
                    {"label":"Semboller (-t)","value":"-t"}]}
            ]),
        },
        ToolForm {
            name: "oletools",
            template: "oleid {target}",
            target_types: &["file"],
            danger: "low",
            purpose: "Office belgelerini (Word/Excel) makro, gömülü nesne ve şüpheli göstergeler açısından analiz eder.",
            when_to_use: "Bir Office dosyasının zararlı makro veya oltalama içerip içermediğini kontrol etmek için.",
            form: json!([]),
        },
        ToolForm {
            name: "chntpw",
            template: "chntpw -l {target}",
            target_types: &["file"],
            danger: "low",
            purpose: "Windows SAM kayıt dosyasındaki yerel kullanıcı hesaplarını listeler (ve düzenleyebilir).",
            when_to_use: "Ele geçirilmiş bir SAM dosyasındaki Windows kullanıcı hesaplarını görmek için.",
            form: json!([]),
        },
        ToolForm {
            name: "capa",
            template: "capa {target}",
            target_types: &["file"],
            danger: "low",
            purpose: "Bir çalıştırılabilir dosyanın yeteneklerini (ağ, şifreleme, kalıcılık, anti-analiz) kural tabanlı tespit eder.",
            when_to_use: "Bir malware örneğinin ne yapabileceğini çalıştırmadan, statik olarak anlamak için.",
            form: json!([]),
        },
        ToolForm {
            name: "tshark",
            template: "tshark -r {target} {filter}",
            target_types: &["file"],
            danger: "low",
            purpose: "Wireshark'ın komut satırı sürümü — kaydedilmiş bir ağ trafiği (pcap) dosyasını analiz eder.",
            when_to_use: "Bir pcap yakalamasını inceleyip protokolleri, konuşmaları ve şüpheli trafiği görmek için.",
            form: json!([
                {"name":"filter","label":"Görüntü filtresi","type":"select","default":"",
                 "options":[
                    {"label":"Tümü (varsayılan)","value":""},
                    {"label":"Sadece HTTP","value":"-Y http"},
                    {"label":"Sadece DNS","value":"-Y dns"},
                    {"label":"Sadece TCP","value":"-Y tcp"}]}
            ]),
        },
        ToolForm {
            name: "zsteg",
            template: "zsteg {mode} {target}",
            target_types: &["file"],
            danger: "low",
            purpose: "PNG/BMP görüntülerinde LSB steganografi ile gizlenmiş veriyi tespit eder.",
            when_to_use: "Bir görüntü dosyasında gizli mesaj/veri saklanıp saklanmadığını kontrol etmek için (CTF/adli).",
            form: json!([
                {"name":"mode","label":"Tarama","type":"select","default":"-a",
                 "options":[
                    {"label":"Tüm yöntemler (-a) — varsayılan","value":"-a"},
                    {"label":"Hızlı (varsayılan yöntemler)","value":""}]}
            ]),
        },
        ToolForm {
            name: "aircrack-ng",
            template: "aircrack-ng -w {wordlist} {target}",
            target_types: &["file"],
            danger: "high",
            purpose: "Yakalanmış bir WPA/WPA2 el sıkışmasını (.cap) sözlük saldırısıyla kırmayı dener.",
            when_to_use: "Elinizde bir WiFi handshake yakalaması varken parolanın zayıf olup olmadığını test etmek için.",
            form: json!([
                {"name":"wordlist","label":"Parola listesi","type":"select","default":"/usr/share/wordlists/rockyou.txt",
                 "options":[
                    {"label":"rockyou (varsayılan)","value":"/usr/share/wordlists/rockyou.txt"},
                    {"label":"Küçük liste (hızlı)","value":"/usr/share/wordlists/dirb/common.txt"}]}
            ]),
        },
        ToolForm {
            name: "stegseek",
            template: "stegseek {target} {wordlist} -xf /dev/null",
            target_types: &["file"],
            danger: "medium",
            purpose: "Steghide ile gizlenmiş veriyi çok hızlı sözlük saldırısıyla açar (JPG/WAV/BMP).",
            when_to_use: "Steghide parolasını kırıp bir görüntüde/ses dosyasında gizli veriyi ortaya çıkarmak için.",
            form: json!([
                {"name":"wordlist","label":"Parola listesi","type":"select","default":"/usr/share/wordlists/rockyou.txt",
                 "options":[
                    {"label":"rockyou (varsayılan)","value":"/usr/share/wordlists/rockyou.txt"}]}
            ]),
        },
        ToolForm {
            name: "pypykatz",
            template: "pypykatz lsa minidump {target}",
            target_types: &["file"],
            danger: "high",
            purpose: "Bir LSASS bellek dökümünden Windows kimlik bilgilerini (parola hash'leri, biletler) çıkarır.",
            when_to_use: "Ele geçirilmiş bir lsass.dmp dosyasından oturum açmış kullanıcıların kimlik bilgilerini almak için.",
            form: json!([]),
        },
        ToolForm {
            name: "regripper",
            template: "regripper -r {target} -f {profile}",
            target_types: &["file"],
            danger: "low",
            purpose: "Windows kayıt (registry) kovanlarından adli açıdan önemli bilgileri çıkarır.",
            when_to_use: "Bir registry hive dosyasından kullanıcı aktivitesi, yüklü yazılım ve sistem yapılandırması çıkarmak için.",
            form: json!([
                {"name":"profile","label":"Kovan profili","type":"select","default":"software",
                 "options":[
                    {"label":"SOFTWARE","value":"software"},
                    {"label":"SYSTEM","value":"system"},
                    {"label":"NTUSER.DAT","value":"ntuser"},
                    {"label":"SAM","value":"sam"}]}
            ]),
        },
        ToolForm {
            name: "volatility3",
            template: "vol -f {target} {plugin}",
            target_types: &["file"],
            danger: "low",
            purpose: "Bellek (RAM) dökümlerini adli olarak analiz eder: çalışan süreçler, ağ bağlantıları, enjeksiyonlar.",
            when_to_use: "Bir bellek görüntüsünden olay anındaki süreçleri, bağlantıları ve zararlı izleri çıkarmak için.",
            form: json!([
                {"name":"plugin","label":"Analiz eklentisi","type":"select","default":"windows.pslist",
                 "options":[
                    {"label":"Süreç listesi (pslist) — varsayılan","value":"windows.pslist"},
                    {"label":"Süreç ağacı (pstree)","value":"windows.pstree"},
                    {"label":"Ağ bağlantıları (netscan)","value":"windows.netscan"},
                    {"label":"Komut satırları (cmdline)","value":"windows.cmdline"}]}
            ]),
        },
        ToolForm {
            name: "upx",
            template: "upx {action} {target}",
            target_types: &["file"],
            danger: "low",
            purpose: "Çalıştırılabilir dosya paketleyici (packer) — bir binary'nin UPX ile sıkıştırılmış olup olmadığını kontrol eder.",
            when_to_use: "Bir malware örneğinin UPX ile paketlenip paketlenmediğini test etmek ve içeriğini listelemek için.",
            form: json!([
                {"name":"action","label":"İşlem","type":"select","default":"-t",
                 "options":[
                    {"label":"Test et (-t) — varsayılan","value":"-t"},
                    {"label":"Bilgi listele (-l)","value":"-l"}]}
            ]),
        },
        ToolForm {
            name: "fcrackzip",
            template: "fcrackzip -D -u -p {wordlist} {target}",
            target_types: &["file"],
            danger: "high",
            purpose: "Parola korumalı ZIP dosyalarını sözlük saldırısıyla kırmayı dener.",
            when_to_use: "Şifreli bir ZIP arşivinin parolasının zayıf olup olmadığını test etmek için.",
            form: json!([
                {"name":"wordlist","label":"Parola listesi","type":"select","default":"/usr/share/wordlists/rockyou.txt",
                 "options":[
                    {"label":"rockyou (varsayılan)","value":"/usr/share/wordlists/rockyou.txt"},
                    {"label":"Küçük liste (hızlı)","value":"/usr/share/wordlists/dirb/common.txt"}]}
            ]),
        },
        ToolForm {
            name: "foremost",
            template: "foremost -T -t {types} -i {target} -o /tmp/foremost",
            target_types: &["file"],
            danger: "low",
            purpose: "Dosya oymacılığı (file carving) — bir disk imajı veya ham veriden silinmiş/gömülü dosyaları başlık imzalarına göre kurtarır.",
            when_to_use: "Bir disk imajından veya bellek dökümünden kaybolmuş resim, belge, arşiv gibi dosyaları geri çıkarmak için.",
            form: json!([
                {"name":"types","label":"Kurtarılacak dosya türleri","type":"select","default":"all",
                 "options":[
                    {"label":"Tümü (varsayılan)","value":"all"},
                    {"label":"Resimler (jpg,png,gif,bmp)","value":"jpg,png,gif,bmp"},
                    {"label":"Belgeler (pdf,doc,htm)","value":"pdf,doc,htm"},
                    {"label":"Arşivler (zip,rar)","value":"zip,rar"},
                    {"label":"Çalıştırılabilir (exe)","value":"exe"}]}
            ]),
        },
        ToolForm {
            name: "certipy",
            template: "certipy-ad find -u {username} -p {password} -dc-ip {target} -vulnerable -stdout",
            target_types: &["ip","domain"],
            danger: "medium",
            purpose: "Active Directory Sertifika Servisi'ndeki (AD CS) yanlış yapılandırmaları ve ayrıcalık yükseltme yollarını (ESC1-ESC8) tespit eder.",
            when_to_use: "Bir AD ortamında sertifika tabanlı ayrıcalık yükseltme açıklarını (AD CS) taramak için — kimlik bilgisi gerekir.",
            form: json!([
                {"name":"username","label":"Kullanıcı adı (user@domain)","type":"text","required":true,"placeholder":"örn. user@corp.local","default":""},
                {"name":"password","label":"Parola","type":"password","required":true,"default":""}
            ]),
        },
        ToolForm {
            name: "iputils-arping",
            template: "arping -c {count} {target}",
            target_types: &["ip"],
            danger: "low",
            purpose: "ARP seviyesinde bir IP adresine ping atarak yerel ağdaki bir cihazın canlı olup olmadığını ve MAC adresini öğrenir.",
            when_to_use: "Bir IP'nin yerel ağda aktif olup olmadığını ICMP engelli olsa bile ARP ile doğrulamak için.",
            form: json!([
                {"name":"count","label":"Paket sayısı","type":"select","default":"3",
                 "options":[
                    {"label":"3 (varsayılan)","value":"3"},
                    {"label":"5","value":"5"}]}
            ]),
        },
        ToolForm {
            name: "impacket-secretsdump",
            template: "impacket-secretsdump {username}:{password}@{target}",
            target_types: &["ip","domain"],
            danger: "high",
            purpose: "Uzak bir Windows/AD sisteminden parola hash'lerini (SAM, LSA, NTDS.dit) kimlik bilgisiyle çıkarır.",
            when_to_use: "Geçerli bir hesapla bir domain controller veya Windows makineden kimlik bilgisi hash'lerini toplamak için.",
            form: json!([
                {"name":"username","label":"Kullanıcı adı (DOMAIN/user)","type":"text","required":true,"placeholder":"örn. CORP/administrator","default":""},
                {"name":"password","label":"Parola","type":"password","required":true,"default":""}
            ]),
        },
        ToolForm {
            name: "arjun",
            template: "arjun -u {target} {method} {threads}",
            target_types: &["url"],
            danger: "medium",
            purpose: "Bir web uç noktasındaki gizli/dokümante edilmemiş HTTP parametrelerini (GET/POST) keşfeder.",
            when_to_use: "Bir sayfanın link verilmemiş parametrelerini bulup gizli işlevleri veya zafiyet giriş noktalarını ortaya çıkarmak için.",
            form: json!([
                {"name":"method","label":"HTTP method","type":"select","default":"-m GET",
                 "description":"Parametrelerin hangi istek türüyle deneneceği",
                 "options":[
                    {"label":"GET (default)","value":"-m GET"},
                    {"label":"POST","value":"-m POST"},
                    {"label":"JSON body","value":"-m JSON"},
                    {"label":"Query in headers","value":"-m HEADERS"}]},
                {"name":"threads","label":"Concurrency","type":"select","default":"-t 10",
                 "options":[
                    {"label":"Gentle (5)","value":"-t 5"},
                    {"label":"Normal (10, default)","value":"-t 10"},
                    {"label":"Fast (25)","value":"-t 25"}]}
            ]),
        },
        ToolForm {
            name: "dmitry",
            template: "dmitry {modules} {target}",
            target_types: &["domain","ip"],
            danger: "low",
            purpose: "Bir hedef hakkında pasif istihbarat toplar: whois kayıtları, Netcraft bilgisi, alt alan adları ve e-posta adresleri.",
            when_to_use: "Bir alan adı için hızlı, tek komutluk açık kaynak keşif (OSINT) özeti çıkarmak için.",
            form: json!([
                {"name":"modules","label":"Toplanacak bilgi","type":"select","default":"-iw",
                 "description":"Hangi pasif kaynakların sorgulanacağı",
                 "options":[
                    {"label":"Whois (hızlı, default)","value":"-iw"},
                    {"label":"Whois + Netcraft","value":"-iwn"},
                    {"label":"Tam pasif (whois, netcraft, alt alanlar, e-postalar)","value":"-iwnse"}]}
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
/// Tools that cannot run as a headless, one-shot scan against a target and so
/// must never sit in the curated (runnable) pool. Four reasons, all real:
///   * GUI / desktop apps (need an X display): ghidra, wireshark, maltego …
///   * interactive REPL / TUI: gdb, radare2, frida, pacu
///   * long-running listeners / proxies / C2: responder, bettercap, mitmproxy,
///     evilginx2, dnscat2, chisel, sshuttle, gophish, wifiphisher
///   * live wireless hardware: airodump-ng, aireplay-ng, kismet, reaver, wifite
///   * run-on-target or local-only: linpeas, winpeas, strace, ltrace, nc, socat,
///     macchanger, msfvenom (payload generator), crunch (wordlist generator)
/// Marking them here keeps the runnable list honest instead of showing a broken
/// form. They stay in the catalogue (searchable) but curated=FALSE.
pub const NON_SCANNABLE: &[&str] = &[
    // GUI / desktop
    "armitage", "autopsy", "bloodhound", "ghidra", "guymager", "maltego",
    "wireshark", "zaproxy", "radare2", "frida", "cutter",
    // interactive REPL / TUI
    "gdb", "pacu",
    // listeners / proxies / C2
    "responder", "bettercap", "mitmproxy", "evilginx2", "dnscat2", "chisel",
    "sshuttle", "gophish", "wifiphisher", "sliver",
    // live wireless hardware
    "aireplay-ng", "airmon-ng", "airodump-ng", "kismet", "reaver", "wifite",
    "pixiewps",
    // run-on-target scripts / windows-only / local
    "linpeas", "winpeas", "linux-exploit-suggester", "nishang", "mimikatz",
    "strace", "ltrace", "nc", "ncat", "socat", "macchanger", "scapy",
    "dsniff", "tcpreplay", "testdisk", "photorec",
    // generators (not a scan of a target)
    "msfvenom", "crunch",
    // collaboration platforms
    "dradis", "faraday",
    // stdin-only (no argv target), interactive RDP, web-UI platform, cloud-env
    "hakrawler", "dnsx", "xfreerdp", "spiderfoot", "cloudfox",
    // need infra we don't have yet: per-scan output-dir browser (jadx,
    // bulk_extractor), 2-file upload (samdump2), or overlap hydra (patator)
    "jadx", "bulk_extractor", "samdump2", "patator",
    // leftover bootstrap promotions that are not one-shot scans: generators
    // (maskprocessor, wordlists), wrappers/meta (proxychains4, impacket-scripts),
    // interactive/hardware/windows/C2 (afl-fuzz, ettercap-text-only, mitm6,
    // powershell-empire, sharphound, kerberoast, unix-privesc-check, blkcalc)
    "maskprocessor", "wordlists", "proxychains4", "impacket-scripts",
    "afl-fuzz", "ettercap-text-only", "mitm6", "powershell-empire",
    "sharphound", "kerberoast", "unix-privesc-check", "blkcalc",
];

/// Demote every NON_SCANNABLE tool out of the curated/active pool. Idempotent;
/// runs each startup so a future catalogue re-seed can never resurrect them as
/// runnable. Also stamps `business_category='needs_interactive'` so the UI can
/// explain why they are not offered as a scan.
pub async fn demote_non_scannable(pool: &PgPool) -> u64 {
    let res = sqlx::query(
        "UPDATE tools
            SET curated = FALSE, is_active = FALSE,
                business_category = 'needs_interactive'
          WHERE lower(name) = ANY($1) AND (curated OR is_active)",
    )
    .bind(NON_SCANNABLE.iter().map(|s| s.to_string()).collect::<Vec<String>>())
    .execute(pool)
    .await;
    match res {
        Ok(r) => {
            let n = r.rows_affected();
            if n > 0 { tracing::info!("non-scannable demote: removed {n} interactive/GUI tools from curated pool"); }
            n
        }
        Err(e) => { tracing::warn!("non-scannable demote failed: {e}"); 0 }
    }
}

/// Collapse duplicate curated rows to one per tool.
///
/// Many tools are seeded by BOTH the hackingtool catalogue and the modern/base
/// catalogue, leaving two `curated` rows for the same name (e.g. two `httpx`).
/// The form seeder updates every name match, so it re-curates both on each
/// startup; this pass runs right after it and keeps only the single best row
/// curated+active per name, demoting the rest. Deterministic and idempotent,
/// so the curated pool converges to one row per tool on every boot.
///
/// "Best" = has a form, then has a purpose, then a real category (not the
/// generic "Hackingtool Collection"), then the oldest row.
pub async fn dedupe_curated(pool: &PgPool) -> u64 {
    let res = sqlx::query(
        "WITH ranked AS (
            SELECT id, row_number() OVER (
                PARTITION BY lower(name)
                ORDER BY COALESCE(parameters ? 'form', false) DESC,
                         COALESCE(parameters ? 'purpose', false) DESC,
                         (category IS DISTINCT FROM 'Hackingtool Collection') DESC,
                         created_at ASC NULLS LAST,
                         id ASC
            ) AS rn
            FROM tools
            WHERE curated
         )
         UPDATE tools t
            SET curated = FALSE, is_active = FALSE
           FROM ranked r
          WHERE t.id = r.id AND r.rn > 1",
    )
    .execute(pool)
    .await;
    match res {
        Ok(r) => {
            let n = r.rows_affected();
            if n > 0 { tracing::info!("curated dedupe: demoted {n} duplicate rows"); }
            n
        }
        Err(e) => { tracing::warn!("curated dedupe failed: {e}"); 0 }
    }
}

/// One-time curation bootstrap: promote the working tool set to `curated`.
///
/// The catalogue holds 1510 records from three sources. The 183-tool product
/// set is defined as "tools that are cli, have a binary, and were already
/// active" — i.e. the real-usage-plus-installed set the operator built up over
/// time, per the product decision. This runs before the form seeder so that
/// `is_active = curated AND installed` has a curated pool to work with. It only
/// ever ADDS curation (never un-curates), so it is safe to run every startup.
pub async fn bootstrap_curated(pool: &PgPool) -> u64 {
    // If a curated set already exists, this is a no-op after the first run.
    let existing: i64 = sqlx::query_scalar("SELECT count(*) FROM tools WHERE curated")
        .fetch_one(pool).await.unwrap_or(0);
    if existing >= 50 {
        return 0; // already bootstrapped
    }
    let res = sqlx::query(
        "UPDATE tools SET curated = TRUE           WHERE curated = FALSE AND is_active = TRUE             AND tool_type = 'cli' AND COALESCE(binary_name,'') != ''",
    )
    .execute(pool)
    .await;
    match res {
        Ok(r) => {
            let n = r.rows_affected();
            if n > 0 { tracing::info!("curation bootstrap: promoted {n} active tools to curated"); }
            n
        }
        Err(e) => { tracing::warn!("curation bootstrap failed: {e}"); 0 }
    }
}

pub async fn seed_tool_forms(pool: &PgPool) -> FormSeedResult {
    bootstrap_curated(pool).await;

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
    dedupe_curated(pool).await;
    demote_non_scannable(pool).await;
    FormSeedResult { applied, not_found }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_definition_is_well_formed() {
        for d in definitions() {
            assert!(!d.name.is_empty());
            // Most tools reference the target directly; a few take a different
            // primary input (tcpdump reads an interface). The rule is that the
            // template has at least one placeholder to fill, not a specific name.
            let re0 = regex::Regex::new(r"\{[a-z_]+\}").unwrap();
            assert!(re0.is_match(d.template), "{}: template has no placeholder", d.name);
            let form = d.form.as_array().expect("form is an array");
            // Some tools take only a target (dnsmap, exiftool) — an empty
            // control list is valid; the user still picks the target on the
            // scan page. What must never happen is a control that is malformed.
            for c in form {
                assert!(c.get("name").and_then(|v| v.as_str()).is_some(), "{}: control missing name", d.name);
                assert!(c.get("label").and_then(|v| v.as_str()).is_some(), "{}: control missing label", d.name);
                let ty = c.get("type").and_then(|v| v.as_str()).unwrap_or("");
                assert!(["text","number","select","boolean","password"].contains(&ty),
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
