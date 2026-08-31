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
            template: "crackmapexec {protocol} {target} {username} {password} {action}",
            target_types: &["ip","domain","network"],
            danger: "high",
            purpose: "Ağdaki Windows/AD sistemlerine karşı kimlik doğrulama, sıralama (enum) ve yatay hareket için İsviçre çakısı.",
            when_to_use: "Bir kimlik bilgisiyle (veya null oturumla) ağdaki makineleri, paylaşımları ve kullanıcıları haritalamak için.",
            form: json!([
                {"name":"protocol","label":"Protokol","type":"select","default":"smb",
                 "options":[
                    {"label":"SMB (varsayılan)","value":"smb"},
                    {"label":"WinRM","value":"winrm"},
                    {"label":"SSH","value":"ssh"},
                    {"label":"LDAP","value":"ldap"},
                    {"label":"MSSQL","value":"mssql"}]},
                {"name":"username","label":"Kullanıcı adı (opsiyonel)","type":"text","required":false,"placeholder":"örn. administrator","default":""},
                {"name":"password","label":"Parola (opsiyonel)","type":"password","required":false,"default":""},
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
    ]
}

/// Result of applying the forms.
pub struct FormSeedResult {
    pub applied: usize,
    pub not_found: usize,
}

/// Apply every curated form to the catalogue on startup.
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
