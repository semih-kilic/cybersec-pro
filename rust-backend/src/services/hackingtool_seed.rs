// hackingtool_seed.rs — Z4nzu/hackingtool catalog (~185 tools, 20 categories).
//
// Seeds the `tools` table on startup with the full Z4nzu/hackingtool taxonomy
// so users can run any of them WITHOUT writing commands. Each entry ships with:
//   • install_command  — one-line installer (apt / git+pip / go install / pipx)
//   • command_template — runnable template with {param} placeholders
//   • parameters JSONB — zero-code form spec consumed by the frontend runner
//   • danger_level / target_types / risk_context — UI guard rails
//
// Source taxonomy: https://github.com/Z4nzu/hackingtool README (v2.0)
// All entries use ON CONFLICT (id) DO UPDATE so re-runs are idempotent.

use serde_json::{json, Value};
use sqlx::PgPool;

/// (id, name, business_category, subcategory, description, install_command,
///  command_template, official_url, danger, target_types[], parameters JSON)
type Entry = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static [&'static str],
    fn() -> Value,
);

// ── Parameter form helpers ──────────────────────────────────────────────────

pub(crate) fn p_target() -> Value {
    json!({
        "form": [
            {"name": "target", "label": "Target (host / URL / IP)", "type": "text", "required": true, "placeholder": "example.com"}
        ]
    })
}

pub(crate) fn p_url() -> Value {
    json!({
        "form": [
            {"name": "url", "label": "Target URL", "type": "url", "required": true, "placeholder": "https://example.com"}
        ]
    })
}

pub(crate) fn p_host() -> Value {
    json!({
        "form": [
            {"name": "host", "label": "Host / IP", "type": "text", "required": true, "placeholder": "192.0.2.1"}
        ]
    })
}

pub(crate) fn p_domain() -> Value {
    json!({
        "form": [
            {"name": "domain", "label": "Domain", "type": "text", "required": true, "placeholder": "example.com"}
        ]
    })
}

fn p_iface() -> Value {
    json!({
        "form": [
            {"name": "iface", "label": "Wireless interface (monitor mode)", "type": "text", "required": true, "placeholder": "wlan0mon"}
        ]
    })
}

pub(crate) fn p_file() -> Value {
    json!({
        "form": [
            {"name": "file", "label": "Input file path", "type": "text", "required": true, "placeholder": "/path/to/file"}
        ]
    })
}

#[allow(dead_code)] // Param template for tools added in future seed batches.
pub(crate) fn p_wordlist() -> Value {
    json!({
        "form": [
            {"name": "wordlist", "label": "Wordlist path", "type": "text", "required": true, "placeholder": "/usr/share/wordlists/rockyou.txt"}
        ]
    })
}

fn p_email() -> Value {
    json!({
        "form": [
            {"name": "email", "label": "Email address", "type": "email", "required": true, "placeholder": "user@example.com"}
        ]
    })
}

fn p_username() -> Value {
    json!({
        "form": [
            {"name": "username", "label": "Username", "type": "text", "required": true, "placeholder": "johndoe"}
        ]
    })
}

fn p_url_wordlist() -> Value {
    json!({
        "form": [
            {"name": "url", "label": "Target URL", "type": "url", "required": true},
            {"name": "wordlist", "label": "Wordlist path", "type": "text", "required": true, "default": "/usr/share/wordlists/dirb/common.txt"}
        ]
    })
}

#[allow(dead_code)] // Param template for tools added in future seed batches.
fn p_target_apikey() -> Value {
    json!({
        "form": [
            {"name": "target", "label": "Target", "type": "text", "required": true},
            {"name": "api_key", "label": "API key (optional)", "type": "password", "required": false}
        ]
    })
}

pub(crate) fn p_apk() -> Value {
    json!({
        "form": [
            {"name": "apk", "label": "APK file path", "type": "text", "required": true, "placeholder": "/path/to/app.apk"}
        ]
    })
}

pub(crate) fn p_none() -> Value {
    json!({"form": []})
}

fn p_lhost_lport() -> Value {
    json!({
        "form": [
            {"name": "lhost", "label": "Listener host (LHOST)", "type": "text", "required": true, "placeholder": "10.0.0.1"},
            {"name": "lport", "label": "Listener port (LPORT)", "type": "number", "required": true, "default": 4444},
            {"name": "out", "label": "Output file", "type": "text", "required": true, "placeholder": "shell.exe"}
        ]
    })
}

// ── Catalog ─────────────────────────────────────────────────────────────────

fn catalog() -> Vec<Entry> {
    vec![
        // ──────────────── 1. ANONYMITY ────────────────
        ("ht_anonsurf", "kali-anonsurf", "anonymity", "anonymity",
            "Route all system traffic through Tor.",
            "git clone https://github.com/Und3rf10w/kali-anonsurf && cd kali-anonsurf && sudo ./installer.sh",
            "sudo anonsurf {action}",
            "https://github.com/Und3rf10w/kali-anonsurf",
            "low", &["host"],
            (|| json!({"form":[{"name":"action","label":"Action","type":"select","required":true,"options":["start","stop","status","change","restart"]}]})) as fn() -> Value),
        ("ht_multitor", "multitor", "anonymity", "anonymity",
            "Run multiple Tor instances with HAProxy load-balancing.",
            "git clone https://github.com/trimstray/multitor && cd multitor && sudo ./setup.sh install",
            "multitor --init {count} --user nobody --socks-port 9000 --control-port 9900",
            "https://github.com/trimstray/multitor",
            "low", &["host"],
            (|| json!({"form":[{"name":"count","label":"Tor instance count","type":"number","required":true,"default":3}]})) as fn() -> Value),

        // ──────────────── 2. INFORMATION GATHERING ────────────────
        ("ht_nmap", "nmap", "information_gathering", "network_scan",
            "Network mapper — port scan, OS/service detection.",
            "sudo apt install -y nmap",
            "nmap {flags} {target}",
            "https://github.com/nmap/nmap",
            "medium", &["host","network"],
            (|| json!({"form":[{"name":"target","label":"Target","type":"text","required":true},{"name":"flags","label":"Flags","type":"text","default":"-sV -sC -T4"}]})) as fn() -> Value),
        ("ht_dracnmap", "dracnmap", "information_gathering", "network_scan",
            "Curated nmap scan profiles wrapper.",
            "git clone https://github.com/Screetsec/Dracnmap",
            "cd Dracnmap && sudo bash dracnmap.sh", "https://github.com/Screetsec/Dracnmap",
            "medium", &["host"], p_none),
        ("ht_xerosploit", "xerosploit", "information_gathering", "mitm",
            "MITM penetration testing toolkit.",
            "git clone https://github.com/LionSec/xerosploit && cd xerosploit && sudo python3 install.py",
            "sudo xerosploit", "https://github.com/LionSec/xerosploit",
            "high", &["network"], p_none),
        ("ht_redhawk", "red_hawk", "information_gathering", "web_recon",
            "All-in-one web recon and vulnerability scanner.",
            "git clone https://github.com/Tuhinshubhra/RED_HAWK",
            "php RED_HAWK/rhawk.php", "https://github.com/Tuhinshubhra/RED_HAWK",
            "medium", &["url"], p_none),
        ("ht_reconspider", "reconspider", "information_gathering", "osint",
            "OSINT framework for IPs, emails, domains.",
            "git clone https://github.com/bhavsec/reconspider && cd reconspider && sudo python3 setup.py install",
            "python3 reconspider.py", "https://github.com/bhavsec/reconspider",
            "low", &["domain","email","ip"], p_none),
        ("ht_infoga", "infoga", "information_gathering", "osint_email",
            "Gather email information (provider, country, breach).",
            "git clone https://github.com/m4ll0k/Infoga && cd Infoga && pip3 install -r requirements.txt",
            "python3 infoga.py --domain {domain} --source all", "https://github.com/m4ll0k/Infoga",
            "low", &["domain"], p_domain),
        ("ht_recondog", "recon-dog", "information_gathering", "osint",
            "Compact target reconnaissance toolkit.",
            "git clone https://github.com/s0md3v/ReconDog && cd ReconDog && pip3 install -r requirements.txt",
            "python3 dog -d {target}", "https://github.com/s0md3v/ReconDog",
            "low", &["domain","ip"], p_target),
        ("ht_striker", "striker", "information_gathering", "web_recon",
            "Offensive information & vulnerability scanner.",
            "git clone https://github.com/s0md3v/Striker && cd Striker && pip3 install -r requirements.txt",
            "python3 striker.py {target}", "https://github.com/s0md3v/Striker",
            "medium", &["domain"], p_target),
        ("ht_secretfinder", "secretfinder", "information_gathering", "secrets",
            "Discover sensitive data in JavaScript files.",
            "git clone https://github.com/m4ll0k/SecretFinder && pip3 install -r SecretFinder/requirements.txt",
            "python3 SecretFinder/SecretFinder.py -i {url} -o cli", "https://github.com/m4ll0k/SecretFinder",
            "low", &["url"], p_url),
        ("ht_shodanfy", "shodanfy", "information_gathering", "osint",
            "Get ports, vulnerabilities, info from Shodan.",
            "git clone https://github.com/m4ll0k/Shodanfy.py",
            "python3 Shodanfy.py/shodanfy.py {target}", "https://github.com/m4ll0k/Shodanfy.py",
            "low", &["ip","domain"], p_target),
        ("ht_breacher", "breacher", "information_gathering", "panel_finder",
            "Advanced multi-threaded admin panel finder.",
            "git clone https://github.com/s0md3v/Breacher",
            "python3 Breacher/breacher.py -u {url}", "https://github.com/s0md3v/Breacher",
            "medium", &["url"], p_url),
        ("ht_theharvester", "theharvester", "information_gathering", "osint_email",
            "Email, subdomain & people gathering.",
            "sudo apt install -y theharvester",
            "theHarvester -d {domain} -b all -l 500",
            "https://github.com/laramies/theHarvester",
            "low", &["domain"], p_domain),
        ("ht_amass", "amass", "information_gathering", "subdomain",
            "OWASP Amass — in-depth attack-surface mapping.",
            "go install -v github.com/owasp-amass/amass/v4/...@master",
            "amass enum -d {domain}",
            "https://github.com/owasp-amass/amass",
            "low", &["domain"], p_domain),
        ("ht_masscan", "masscan", "information_gathering", "network_scan",
            "Internet-scale TCP port scanner.",
            "sudo apt install -y masscan",
            "sudo masscan {target} -p1-65535 --rate=1000",
            "https://github.com/robertdavidgraham/masscan",
            "high", &["network"], p_target),
        ("ht_rustscan", "rustscan", "information_gathering", "network_scan",
            "Modern fast port scanner.",
            "cargo install rustscan",
            "rustscan -a {target}",
            "https://github.com/RustScan/RustScan",
            "medium", &["host"], p_target),
        ("ht_holehe", "holehe", "information_gathering", "osint_email",
            "Check if email is used on 120+ sites.",
            "pipx install holehe",
            "holehe {email}",
            "https://github.com/megadose/holehe",
            "low", &["email"], p_email),
        ("ht_maigret", "maigret", "information_gathering", "osint_username",
            "Search a username across 3000+ sites.",
            "pipx install maigret",
            "maigret {username}",
            "https://github.com/soxoj/maigret",
            "low", &["username"], p_username),
        ("ht_httpx", "httpx", "information_gathering", "http_probe",
            "Fast multi-purpose HTTP toolkit (ProjectDiscovery).",
            "go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest",
            "httpx -u {url} -title -tech-detect -status-code",
            "https://github.com/projectdiscovery/httpx",
            "low", &["url"], p_url),
        ("ht_spiderfoot", "spiderfoot", "information_gathering", "osint",
            "Open-source automated OSINT reconnaissance.",
            "pipx install spiderfoot",
            "spiderfoot -s {target} -F",
            "https://github.com/smicallef/spiderfoot",
            "low", &["domain","ip","email"], p_target),
        ("ht_subfinder", "subfinder", "information_gathering", "subdomain",
            "Passive subdomain discovery (ProjectDiscovery).",
            "go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest",
            "subfinder -d {domain} -all -silent",
            "https://github.com/projectdiscovery/subfinder",
            "low", &["domain"], p_domain),
        ("ht_trufflehog", "trufflehog", "information_gathering", "secrets",
            "Find leaked secrets in repos / S3 / GCS / etc.",
            "curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sudo sh -s -- -b /usr/local/bin",
            "trufflehog git {url}",
            "https://github.com/trufflesecurity/trufflehog",
            "low", &["url"], p_url),
        ("ht_gitleaks", "gitleaks", "information_gathering", "secrets",
            "Detect secrets in git repos.",
            "go install github.com/gitleaks/gitleaks/v8@latest",
            "gitleaks detect -s {path}",
            "https://github.com/gitleaks/gitleaks",
            "low", &["path"],
            (|| json!({"form":[{"name":"path","label":"Repo path","type":"text","required":true,"default":"."}]})) as fn() -> Value),

        // ──────────────── 3. WORDLIST GENERATOR ────────────────
        ("ht_cupp", "cupp", "wordlist", "password_profile",
            "Common User Passwords Profiler.",
            "git clone https://github.com/Mebus/cupp",
            "python3 cupp/cupp.py -i", "https://github.com/Mebus/cupp",
            "low", &["target"], p_none),
        ("ht_wlcreator", "wlcreator", "wordlist", "wordlist_gen",
            "Word list creator using char permutations.",
            "git clone https://github.com/Z4nzu/wlcreator",
            "python3 wlcreator/wlcreator.py", "https://github.com/Z4nzu/wlcreator",
            "low", &["target"], p_none),
        ("ht_goblinwordgen", "goblin_wordgenerator", "wordlist", "wordlist_gen",
            "Custom dictionary attack list generator.",
            "git clone https://github.com/UndeadSec/GoblinWordGenerator",
            "python3 GoblinWordGenerator/GoblinWordGenerator.py", "https://github.com/UndeadSec/GoblinWordGenerator",
            "low", &["target"], p_none),
        ("ht_smwyg", "password_list_smwyg", "wordlist", "wordlist_gen",
            "1.4 billion password leak wordlist downloader.",
            "git clone https://github.com/Viralmaniar/SMWYG-Show-Me-What-You-Got",
            "cd SMWYG-Show-Me-What-You-Got && python3 SMWYG.py", "https://github.com/Viralmaniar/SMWYG-Show-Me-What-You-Got",
            "low", &["target"], p_none),
        ("ht_hashcat", "hashcat", "wordlist", "password_crack",
            "World's fastest GPU hash cracker.",
            "sudo apt install -y hashcat",
            "hashcat -m {mode} -a 0 {hashfile} {wordlist}",
            "https://github.com/hashcat/hashcat",
            "high", &["hash"],
            (|| json!({"form":[
                {"name":"mode","label":"Hash mode (-m)","type":"number","required":true,"default":0},
                {"name":"hashfile","label":"Hash file","type":"text","required":true},
                {"name":"wordlist","label":"Wordlist","type":"text","required":true,"default":"/usr/share/wordlists/rockyou.txt"}
            ]})) as fn() -> Value),
        ("ht_johntheripper", "john_the_ripper", "wordlist", "password_crack",
            "John the Ripper password cracker.",
            "sudo apt install -y john",
            "john --wordlist={wordlist} {hashfile}",
            "https://github.com/openwall/john",
            "high", &["hash"],
            (|| json!({"form":[
                {"name":"hashfile","label":"Hash file","type":"text","required":true},
                {"name":"wordlist","label":"Wordlist","type":"text","required":true,"default":"/usr/share/wordlists/rockyou.txt"}
            ]})) as fn() -> Value),
        ("ht_haiti", "haiti", "wordlist", "hash_id",
            "Hash type identifier.",
            "sudo gem install haiti-hash",
            "haiti {hash}",
            "https://github.com/noraj/haiti",
            "low", &["hash"],
            (|| json!({"form":[{"name":"hash","label":"Hash string","type":"text","required":true}]})) as fn() -> Value),

        // ──────────────── 4. WIRELESS ATTACK ────────────────
        ("ht_wifipumpkin3", "wifipumpkin3", "wireless", "rogue_ap",
            "Powerful framework for rogue access point attacks.",
            "sudo apt install -y wifipumpkin3 || pipx install wifipumpkin3",
            "sudo wifipumpkin3", "https://github.com/P0cL4bs/wifipumpkin3",
            "high", &["wireless"], p_none),
        ("ht_pixiewps", "pixiewps", "wireless", "wps",
            "Offline brute-force tool for WPS pin attack.",
            "sudo apt install -y pixiewps",
            "pixiewps -e {pke} -r {pkr} -s {ehash1} -z {ehash2} -a {authkey} -n {enonce}",
            "https://github.com/wiire/pixiewps",
            "high", &["wireless"], p_none),
        ("ht_bluepot", "bluepot", "wireless", "bluetooth",
            "Bluetooth honeypot.",
            "git clone https://github.com/andrewmichaelsmith/bluepot",
            "cd bluepot && java -jar bluepot.jar", "https://github.com/andrewmichaelsmith/bluepot",
            "medium", &["bluetooth"], p_none),
        ("ht_fluxion", "fluxion", "wireless", "evil_twin",
            "Captive-portal evil-twin Wi-Fi attack.",
            "git clone https://github.com/FluxionNetwork/fluxion",
            "sudo bash fluxion/fluxion.sh", "https://github.com/FluxionNetwork/fluxion",
            "high", &["wireless"], p_none),
        ("ht_wifiphisher", "wifiphisher", "wireless", "evil_twin",
            "Rogue AP framework for Wi-Fi phishing.",
            "sudo apt install -y wifiphisher",
            "sudo wifiphisher", "https://github.com/wifiphisher/wifiphisher",
            "high", &["wireless"], p_none),
        ("ht_wifite", "wifite", "wireless", "wpa_crack",
            "Automated wireless attack tool.",
            "sudo apt install -y wifite",
            "sudo wifite", "https://github.com/derv82/wifite2",
            "high", &["wireless"], p_none),
        ("ht_eviltwin_fakeap", "evil_twin", "wireless", "evil_twin",
            "Fake AP creator (Z4nzu/fakeap).",
            "git clone https://github.com/Z4nzu/fakeap",
            "sudo bash fakeap/fakeap.sh", "https://github.com/Z4nzu/fakeap",
            "high", &["wireless"], p_none),
        ("ht_fastssh", "fastssh", "wireless", "ssh",
            "Detect Wi-Fi vulnerabilities & WPS audits.",
            "git clone https://github.com/Z4nzu/fastssh",
            "bash fastssh/fastssh.sh -m multiple", "https://github.com/Z4nzu/fastssh",
            "medium", &["wireless"], p_none),
        ("ht_howmanypeople", "howmanypeople", "wireless", "client_count",
            "Count nearby Wi-Fi devices.",
            "pipx install howmanypeoplearearound",
            "howmanypeoplearearound", "",
            "low", &["wireless"], p_none),
        ("ht_airgeddon", "airgeddon", "wireless", "wpa_crack",
            "Multi-use bash script for Wi-Fi auditing.",
            "git clone https://github.com/v1s1t0r1sh3r3/airgeddon",
            "sudo bash airgeddon/airgeddon.sh", "https://github.com/v1s1t0r1sh3r3/airgeddon",
            "high", &["wireless"], p_none),
        ("ht_hcxdumptool", "hcxdumptool", "wireless", "wpa_capture",
            "Capture WPA/WPA2 PMKID/EAPOL.",
            "sudo apt install -y hcxdumptool",
            "sudo hcxdumptool -i {iface} -o capture.pcapng --enable_status=1",
            "https://github.com/ZerBea/hcxdumptool",
            "high", &["wireless"], p_iface),
        ("ht_hcxtools", "hcxtools", "wireless", "wpa_convert",
            "Convert WPA captures for hashcat.",
            "sudo apt install -y hcxtools",
            "hcxpcapngtool -o hash.hc22000 {file}",
            "https://github.com/ZerBea/hcxtools",
            "medium", &["file"], p_file),
        ("ht_bettercap", "bettercap", "wireless", "mitm",
            "Swiss-army knife for network attacks & monitoring.",
            "sudo apt install -y bettercap",
            "sudo bettercap -iface {iface}",
            "https://github.com/bettercap/bettercap",
            "high", &["wireless","network"], p_iface),

        // ──────────────── 5. SQL INJECTION ────────────────
        ("ht_sqlmap", "sqlmap", "sql_injection", "sqli",
            "Automatic SQL injection & DB takeover tool.",
            "sudo apt install -y sqlmap",
            "sqlmap -u {url} --batch --random-agent --level=3",
            "https://github.com/sqlmapproject/sqlmap",
            "high", &["url"], p_url),
        ("ht_nosqlmap", "nosqlmap", "sql_injection", "nosqli",
            "Automated NoSQL DB enum & web app exploit.",
            "git clone https://github.com/codingo/NoSQLMap && cd NoSQLMap && sudo python3 setup.py install",
            "nosqlmap", "https://github.com/codingo/NoSQLMap",
            "high", &["url"], p_url),
        ("ht_dsss", "dsss", "sql_injection", "sqli",
            "Damn Small SQLi Scanner — minimal sqli tester.",
            "git clone https://github.com/stamparm/DSSS",
            "python3 DSSS/dsss.py -u {url}", "https://github.com/stamparm/DSSS",
            "medium", &["url"], p_url),
        ("ht_explo", "explo", "sql_injection", "sqli",
            "Human and machine-readable web vuln testing.",
            "pipx install explo",
            "explo {file}", "https://github.com/dtag-dev-sec/explo",
            "low", &["file"], p_file),
        ("ht_blisqy", "blisqy", "sql_injection", "sqli_blind",
            "Time-based blind SQLi exploitation.",
            "git clone https://github.com/JohnTroony/Blisqy",
            "python3 Blisqy/Blisqy.py", "https://github.com/JohnTroony/Blisqy",
            "high", &["url"], p_url),
        ("ht_leviathan", "leviathan", "sql_injection", "audit",
            "Wide-range mass audit toolkit.",
            "git clone https://github.com/leviathan-framework/leviathan && cd leviathan && pip3 install -r requirements.txt",
            "python3 leviathan.py", "https://github.com/leviathan-framework/leviathan",
            "high", &["url"], p_none),
        ("ht_sqlscan", "sqlscan", "sql_injection", "sqli",
            "Quick SQLi vulnerable URL scanner.",
            "git clone https://github.com/Cvar1984/sqlscan && cd sqlscan && pip3 install .",
            "sqlscan {url}", "https://github.com/Cvar1984/sqlscan",
            "medium", &["url"], p_url),

        // ──────────────── 6. PHISHING ────────────────
        ("ht_autophisher", "autophisher", "phishing", "phishing_kit",
            "Automated phishing tool.",
            "git clone https://github.com/CodingRanjith/autophisher",
            "bash autophisher/autophisher.sh", "https://github.com/CodingRanjith/autophisher",
            "critical", &["target"], p_none),
        ("ht_pyphisher", "pyphisher", "phishing", "phishing_kit",
            "Easy-to-use Python phishing kit (77 sites).",
            "git clone https://github.com/KasRoudra/PyPhisher && cd PyPhisher && pip3 install -r files/requirements.txt",
            "python3 pyphisher.py", "https://github.com/KasRoudra/PyPhisher",
            "critical", &["target"], p_none),
        ("ht_advphishing", "advphishing", "phishing", "phishing_kit",
            "Advanced phishing tool with OTP bypass.",
            "git clone https://github.com/Ignitetch/AdvPhishing",
            "bash AdvPhishing/setup.sh", "https://github.com/Ignitetch/AdvPhishing",
            "critical", &["target"], p_none),
        ("ht_setoolkit", "setoolkit", "phishing", "social_engineering",
            "Social-Engineer Toolkit (SET).",
            "sudo apt install -y set",
            "sudo setoolkit", "https://github.com/trustedsec/social-engineer-toolkit",
            "critical", &["target"], p_none),
        ("ht_socialfish", "socialfish", "phishing", "phishing_kit",
            "Educational phishing tool with web UI.",
            "git clone https://github.com/UndeadSec/SocialFish && cd SocialFish && pip3 install -r requirements.txt",
            "python3 SocialFish.py {user} {pass}", "https://github.com/UndeadSec/SocialFish",
            "critical", &["target"], p_none),
        ("ht_hiddeneye", "hiddeneye", "phishing", "phishing_kit",
            "Modern phishing tool with advanced features.",
            "git clone https://github.com/Morsmalleo/HiddenEye && cd HiddenEye && pip3 install -r requirements.txt",
            "python3 HiddenEye.py", "https://github.com/Morsmalleo/HiddenEye",
            "critical", &["target"], p_none),
        ("ht_evilginx2", "evilginx2", "phishing", "phishing_kit",
            "Standalone MITM attack framework for 2FA bypass.",
            "go install -v github.com/kgretzky/evilginx2@latest",
            "sudo evilginx2", "https://github.com/kgretzky/evilginx2",
            "critical", &["target"], p_none),
        ("ht_iseeyou", "i_see_you", "phishing", "geolocation",
            "Get exact geolocation via persistent link.",
            "git clone https://github.com/Viralmaniar/I-See-You",
            "bash I-See-You/iseeyou.sh", "https://github.com/Viralmaniar/I-See-You",
            "high", &["target"], p_none),
        ("ht_saycheese", "saycheese", "phishing", "webcam",
            "Take webcam shots from target via phishing link.",
            "git clone https://github.com/hangetzzu/saycheese",
            "bash saycheese/saycheese.sh", "https://github.com/hangetzzu/saycheese",
            "critical", &["target"], p_none),
        ("ht_qrcodejacking", "ohmyqr", "phishing", "qr_jack",
            "QR code jacking — hijack WhatsApp/etc sessions.",
            "git clone https://github.com/cryptedwolf/ohmyqr",
            "bash ohmyqr/ohmyqr.sh", "https://github.com/cryptedwolf/ohmyqr",
            "critical", &["target"], p_none),
        ("ht_blackeye", "blackeye", "phishing", "phishing_kit",
            "Most complete phishing tool — 32 templates.",
            "git clone https://github.com/thelinuxchoice/blackeye",
            "bash blackeye/blackeye.sh", "https://github.com/thelinuxchoice/blackeye",
            "critical", &["target"], p_none),
        ("ht_shellphish", "shellphish", "phishing", "phishing_kit",
            "Phishing tool for 18 social media platforms.",
            "git clone https://github.com/An0nUD4Y/shellphish",
            "bash shellphish/shellphish.sh", "https://github.com/An0nUD4Y/shellphish",
            "critical", &["target"], p_none),
        ("ht_thanos", "thanos", "phishing", "phishing_kit",
            "Hybrid spear phishing tool.",
            "git clone https://github.com/TridevReddy/Thanos",
            "bash Thanos/thanos.sh", "https://github.com/TridevReddy/Thanos",
            "critical", &["target"], p_none),
        ("ht_qrljacking", "qrljacking", "phishing", "qr_jack",
            "OWASP QRLJacking — QR login session hijack.",
            "git clone https://github.com/OWASP/QRLJacking",
            "bash QRLJacking/QRLJacker/install.sh", "https://github.com/OWASP/QRLJacking",
            "critical", &["target"], p_none),
        ("ht_maskphish", "maskphish", "phishing", "url_mask",
            "Mask phishing URLs to look legit.",
            "git clone https://github.com/jaykali/maskphish",
            "bash maskphish/maskphish.sh", "https://github.com/jaykali/maskphish",
            "high", &["url"], p_url),
        ("ht_blackphish", "blackphish", "phishing", "phishing_kit",
            "Beginner-friendly phishing toolkit.",
            "git clone https://github.com/iinc0gnit0/BlackPhish",
            "bash BlackPhish/blackphish.sh", "https://github.com/iinc0gnit0/BlackPhish",
            "critical", &["target"], p_none),
        ("ht_dnstwist", "dnstwist", "phishing", "typosquat",
            "Domain typo-squatting and phishing detection.",
            "pipx install dnstwist",
            "dnstwist {domain}",
            "https://github.com/elceef/dnstwist",
            "low", &["domain"], p_domain),

        // ──────────────── 7. WEB ATTACK ────────────────
        ("ht_web2attack", "web2attack", "web_attack", "exploit",
            "Web hacking framework with exploits & PoCs.",
            "git clone https://github.com/santatic/web2attack",
            "python3 web2attack/w2a.py", "https://github.com/santatic/web2attack",
            "high", &["url"], p_url),
        ("ht_skipfish", "skipfish", "web_attack", "scanner",
            "Active web app security reconnaissance tool.",
            "sudo apt install -y skipfish",
            "skipfish -o output {url}", "",
            "medium", &["url"], p_url),
        ("ht_sublist3r", "sublist3r", "web_attack", "subdomain",
            "Fast subdomain enumeration tool.",
            "pipx install sublist3r",
            "sublist3r -d {domain}", "https://github.com/aboul3la/Sublist3r",
            "low", &["domain"], p_domain),
        ("ht_checkurl", "checkurl", "web_attack", "url_check",
            "Detect malicious / phishing URL via Google SafeBrowsing.",
            "git clone https://github.com/UndeadSec/checkURL",
            "python3 checkURL/checkURL.py {url}", "https://github.com/UndeadSec/checkURL",
            "low", &["url"], p_url),
        ("ht_takeover", "takeover", "web_attack", "subdomain_takeover",
            "Sub-domain takeover detection tool.",
            "go install github.com/edoardottt/takeover@latest",
            "takeover -t {domain}", "https://github.com/edoardottt/takeover",
            "high", &["domain"], p_domain),
        ("ht_dirb", "dirb", "web_attack", "dir_brute",
            "Web content scanner.",
            "sudo apt install -y dirb",
            "dirb {url} {wordlist}", "https://gitlab.com/kalilinux/packages/dirb",
            "medium", &["url"], p_url_wordlist),
        ("ht_nuclei", "nuclei", "web_attack", "scanner",
            "Templates-based vulnerability scanner.",
            "go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest",
            "nuclei -u {url} -severity medium,high,critical",
            "https://github.com/projectdiscovery/nuclei",
            "medium", &["url"], p_url),
        ("ht_ffuf", "ffuf", "web_attack", "fuzzer",
            "Fast web fuzzer written in Go.",
            "go install github.com/ffuf/ffuf/v2@latest",
            "ffuf -u {url}/FUZZ -w {wordlist}",
            "https://github.com/ffuf/ffuf",
            "medium", &["url"], p_url_wordlist),
        ("ht_feroxbuster", "feroxbuster", "web_attack", "dir_brute",
            "Fast Rust-based content discovery tool.",
            "cargo install feroxbuster",
            "feroxbuster -u {url} -w {wordlist}",
            "https://github.com/epi052/feroxbuster",
            "medium", &["url"], p_url_wordlist),
        ("ht_nikto", "nikto", "web_attack", "scanner",
            "Web server scanner.",
            "sudo apt install -y nikto",
            "nikto -h {url}", "https://github.com/sullo/nikto",
            "medium", &["url"], p_url),
        ("ht_wafw00f", "wafw00f", "web_attack", "waf_detect",
            "Web Application Firewall fingerprinting.",
            "pipx install wafw00f",
            "wafw00f {url}", "https://github.com/EnableSecurity/wafw00f",
            "low", &["url"], p_url),
        ("ht_katana", "katana", "web_attack", "crawler",
            "Next-generation crawling and spidering framework.",
            "go install github.com/projectdiscovery/katana/cmd/katana@latest",
            "katana -u {url}", "https://github.com/projectdiscovery/katana",
            "low", &["url"], p_url),
        ("ht_gobuster", "gobuster", "web_attack", "dir_brute",
            "Directory/file/DNS busting tool in Go.",
            "sudo apt install -y gobuster",
            "gobuster dir -u {url} -w {wordlist}", "https://github.com/OJ/gobuster",
            "medium", &["url"], p_url_wordlist),
        ("ht_dirsearch", "dirsearch", "web_attack", "dir_brute",
            "Web path scanner.",
            "pipx install dirsearch",
            "dirsearch -u {url}", "https://github.com/maurosoria/dirsearch",
            "medium", &["url"], p_url),
        ("ht_zaproxy", "owasp_zap", "web_attack", "scanner",
            "OWASP ZAP — full-featured web app scanner.",
            "sudo apt install -y zaproxy",
            "zaproxy -cmd -quickurl {url}", "https://github.com/zaproxy/zaproxy",
            "medium", &["url"], p_url),
        ("ht_testssl", "testssl_sh", "web_attack", "tls_audit",
            "Test TLS/SSL of any service.",
            "git clone https://github.com/drwetter/testssl.sh",
            "testssl.sh/testssl.sh {host}", "https://github.com/drwetter/testssl.sh",
            "low", &["host"], p_host),
        ("ht_arjun", "arjun", "web_attack", "param_discover",
            "HTTP parameter discovery tool.",
            "pipx install arjun",
            "arjun -u {url}", "https://github.com/s0md3v/Arjun",
            "low", &["url"], p_url),
        ("ht_caido", "caido", "web_attack", "proxy",
            "Modern web security audit toolkit.",
            "curl -fsSL https://caido.io/install.sh | bash",
            "caido", "https://github.com/caido/caido",
            "low", &["url"], p_none),
        ("ht_mitmproxy", "mitmproxy", "web_attack", "proxy",
            "Interactive HTTPS proxy.",
            "sudo apt install -y mitmproxy",
            "mitmproxy", "https://github.com/mitmproxy/mitmproxy",
            "high", &["network"], p_none),

        // ──────────────── 8. POST EXPLOITATION ────────────────
        ("ht_vegile", "vegile", "post_exploitation", "persistence",
            "Stealthy persistence and backdoor tool.",
            "git clone https://github.com/Screetsec/Vegile",
            "bash Vegile/Vegile -i", "https://github.com/Screetsec/Vegile",
            "critical", &["host"], p_none),
        ("ht_chromekeylogger", "chrome_keylogger_hera", "post_exploitation", "keylog",
            "HeraKeylogger — Chrome ext keylogger.",
            "git clone https://github.com/UndeadSec/HeraKeylogger",
            "python3 HeraKeylogger/HeraKeylogger.py", "https://github.com/UndeadSec/HeraKeylogger",
            "critical", &["host"], p_none),
        ("ht_pwncat_cs", "pwncat_cs", "post_exploitation", "c2",
            "Modern C2 + post-exploitation platform.",
            "pipx install pwncat-cs",
            "pwncat-cs", "https://github.com/calebstewart/pwncat",
            "critical", &["host"], p_none),
        ("ht_sliver", "sliver", "post_exploitation", "c2",
            "Open-source cross-platform adversary emulation framework.",
            "curl https://sliver.sh/install | sudo bash",
            "sliver-server", "https://github.com/BishopFox/sliver",
            "critical", &["host"], p_none),
        ("ht_havoc", "havoc", "post_exploitation", "c2",
            "Modern and malleable post-exploitation C2 framework.",
            "git clone https://github.com/HavocFramework/Havoc && cd Havoc && make ts-build && make client-build && make teamserver-build",
            "Havoc/havoc client", "https://github.com/HavocFramework/Havoc",
            "critical", &["host"], p_none),
        ("ht_peassng", "peass_ng", "post_exploitation", "privesc",
            "Privilege Escalation Awesome Scripts (LinPEAS, WinPEAS).",
            "git clone https://github.com/peass-ng/PEASS-ng",
            "bash PEASS-ng/linPEAS/linpeas.sh", "https://github.com/peass-ng/PEASS-ng",
            "high", &["host"], p_none),
        ("ht_ligolong", "ligolo_ng", "post_exploitation", "tunneling",
            "Advanced, yet simple, tunneling tool.",
            "go install github.com/nicocha30/ligolo-ng/cmd/proxy@latest",
            "proxy -selfcert", "https://github.com/nicocha30/ligolo-ng",
            "high", &["network"], p_none),
        ("ht_chisel", "chisel", "post_exploitation", "tunneling",
            "Fast TCP/UDP tunnel over HTTP.",
            "go install github.com/jpillora/chisel@latest",
            "chisel server -p 8080 --reverse", "https://github.com/jpillora/chisel",
            "high", &["network"], p_none),
        ("ht_evilwinrm", "evil_winrm", "post_exploitation", "remote_shell",
            "Ultimate WinRM shell for hacking/pentesting.",
            "sudo gem install evil-winrm",
            "evil-winrm -i {host} -u {user} -p {password}", "https://github.com/Hackplayers/evil-winrm",
            "critical", &["host"],
            (|| json!({"form":[
                {"name":"host","label":"Target host","type":"text","required":true},
                {"name":"user","label":"Username","type":"text","required":true},
                {"name":"password","label":"Password","type":"password","required":true}
            ]})) as fn() -> Value),
        ("ht_mythic", "mythic", "post_exploitation", "c2",
            "Multiplayer C2 framework.",
            "git clone https://github.com/its-a-feature/Mythic && cd Mythic && sudo make",
            "sudo ./mythic-cli start", "https://github.com/its-a-feature/Mythic",
            "critical", &["host"], p_none),

        // ──────────────── 9. FORENSICS ────────────────
        ("ht_autopsy", "autopsy", "forensics", "disk_forensics",
            "Digital forensics platform.",
            "sudo apt install -y autopsy",
            "autopsy", "https://www.sleuthkit.org/autopsy/",
            "low", &["file"], p_none),
        ("ht_wireshark", "wireshark", "forensics", "pcap",
            "Network protocol analyzer.",
            "sudo apt install -y wireshark",
            "wireshark", "https://www.wireshark.org/",
            "low", &["network"], p_none),
        ("ht_bulkextractor", "bulk_extractor", "forensics", "carving",
            "Extract features (emails, URLs, CCs) from disk image.",
            "sudo apt install -y bulk-extractor",
            "bulk_extractor -o output {file}",
            "https://github.com/simsong/bulk_extractor",
            "low", &["file"], p_file),
        ("ht_guymager", "guymager", "forensics", "imaging",
            "Forensic imaging tool.",
            "sudo apt install -y guymager",
            "guymager", "https://guymager.sourceforge.io/",
            "low", &["file"], p_none),
        ("ht_toolsley", "toolsley", "forensics", "file_id",
            "Online file identifier (manual).",
            "echo 'Visit https://www.toolsley.com/'",
            "xdg-open https://www.toolsley.com/", "https://www.toolsley.com/",
            "low", &["file"], p_none),
        ("ht_volatility3", "volatility3", "forensics", "memory",
            "Memory forensics framework.",
            "pipx install volatility3",
            "vol -f {memdump} windows.pslist",
            "https://github.com/volatilityfoundation/volatility3",
            "low", &["file"],
            (|| json!({"form":[{"name":"memdump","label":"Memory dump file","type":"text","required":true}]})) as fn() -> Value),
        ("ht_binwalk", "binwalk", "forensics", "firmware",
            "Firmware analysis tool.",
            "sudo apt install -y binwalk",
            "binwalk -e {file}", "https://github.com/ReFirmLabs/binwalk",
            "low", &["file"], p_file),
        ("ht_pspy", "pspy", "forensics", "process_snoop",
            "Process snooping for Linux without root.",
            "wget -O /usr/local/bin/pspy https://github.com/DominicBreuker/pspy/releases/latest/download/pspy64 && chmod +x /usr/local/bin/pspy",
            "pspy", "https://github.com/DominicBreuker/pspy",
            "low", &["host"], p_none),

        // ──────────────── 10. PAYLOAD CREATION ────────────────
        ("ht_thefatrat", "the_fatrat", "payload", "msf_wrapper",
            "Easy tool to generate backdoors and post-exploit payloads.",
            "git clone https://github.com/Screetsec/TheFatRat && cd TheFatRat && sudo bash setup.sh",
            "sudo fatrat", "https://github.com/Screetsec/TheFatRat",
            "critical", &["host"], p_none),
        ("ht_brutal", "brutal", "payload", "hid",
            "Generate a variety of HID attacks.",
            "git clone https://github.com/Screetsec/Brutal",
            "bash Brutal/brutal.sh", "https://github.com/Screetsec/Brutal",
            "critical", &["host"], p_none),
        ("ht_stitch", "stitch", "payload", "rat",
            "Python remote administration tool.",
            "git clone https://github.com/nathanlopez/Stitch && cd Stitch && pip3 install -r lnx_requirements.txt",
            "python3 main.py", "https://nathanlopez.github.io/Stitch",
            "critical", &["host"], p_none),
        ("ht_msfpc", "msfpc", "payload", "msf_wrapper",
            "MSFvenom Payload Creator.",
            "sudo apt install -y msfpc",
            "msfpc {format} {lhost} {lport}", "https://github.com/g0tmi1k/msfpc",
            "critical", &["host"],
            (|| json!({"form":[
                {"name":"format","label":"Payload format","type":"select","required":true,"options":["windows","android","linux","osx","python"]},
                {"name":"lhost","label":"LHOST","type":"text","required":true},
                {"name":"lport","label":"LPORT","type":"number","required":true,"default":4444}
            ]})) as fn() -> Value),
        ("ht_venom", "venom", "payload", "msf_wrapper",
            "Shellcode generator/compiler/listener.",
            "git clone https://github.com/r00t-3xp10it/venom && cd venom && sudo bash setup/setup.sh",
            "sudo venom", "https://github.com/r00t-3xp10it/venom",
            "critical", &["host"], p_none),
        ("ht_spycam", "spycam", "payload", "stealth",
            "Stealth webcam spy.",
            "git clone https://github.com/indexnotfound404/spycam",
            "bash spycam/spycam.sh", "https://github.com/indexnotfound404/spycam",
            "critical", &["host"], p_none),
        ("ht_mobdroid", "mob_droid", "payload", "android",
            "Mobile App Backdoor.",
            "git clone https://github.com/kinghacker0/Mob-Droid",
            "python3 Mob-Droid/mob-droid.py", "https://github.com/kinghacker0/Mob-Droid",
            "critical", &["mobile"], p_lhost_lport),
        ("ht_enigma", "enigma", "payload", "obfuscator",
            "Multi-platform payload dropper.",
            "git clone https://github.com/UndeadSec/Enigma",
            "python3 Enigma/enigma.py", "https://github.com/UndeadSec/Enigma",
            "critical", &["host"], p_none),

        // ──────────────── 11. EXPLOIT FRAMEWORK ────────────────
        ("ht_routersploit", "routersploit", "exploit_framework", "router",
            "Exploitation framework for embedded devices.",
            "git clone https://github.com/threat9/routersploit && cd routersploit && pip3 install -r requirements.txt",
            "python3 rsf.py", "https://github.com/threat9/routersploit",
            "critical", &["host"], p_none),
        ("ht_websploit", "websploit", "exploit_framework", "web",
            "Advanced MITM framework.",
            "git clone https://github.com/The404Hacking/websploit",
            "python3 websploit/websploit", "https://github.com/The404Hacking/websploit",
            "high", &["network"], p_none),
        ("ht_commix", "commix", "exploit_framework", "command_injection",
            "Automated all-in-one OS command injection tool.",
            "sudo apt install -y commix",
            "commix --url={url}", "https://github.com/commixproject/commix",
            "critical", &["url"], p_url),

        // ──────────────── 12. REVERSE ENGINEERING ────────────────
        ("ht_androguard", "androguard", "reverse_engineering", "android",
            "Reverse engineering, malware/goodware analysis of APKs.",
            "pipx install androguard",
            "androguard analyze {apk}", "https://github.com/androguard/androguard",
            "low", &["apk"], p_apk),
        ("ht_apk2gold", "apk2gold", "reverse_engineering", "android",
            "CLI tool for decompiling APKs back to Java source.",
            "git clone https://github.com/lxdvs/apk2gold",
            "bash apk2gold/apk2gold.sh {apk}", "https://github.com/lxdvs/apk2gold",
            "low", &["apk"], p_apk),
        ("ht_jadx", "jadx", "reverse_engineering", "android",
            "Dex to Java decompiler.",
            "sudo apt install -y jadx",
            "jadx {apk}", "https://github.com/skylot/jadx",
            "low", &["apk"], p_apk),
        ("ht_ghidra", "ghidra", "reverse_engineering", "binary",
            "NSA software reverse engineering framework.",
            "sudo apt install -y ghidra || curl -L https://github.com/NationalSecurityAgency/ghidra/releases/latest/download/ghidra.zip -o /tmp/ghidra.zip && sudo unzip /tmp/ghidra.zip -d /opt/",
            "ghidraRun", "https://github.com/NationalSecurityAgency/ghidra",
            "low", &["binary"], p_none),
        ("ht_radare2", "radare2", "reverse_engineering", "binary",
            "Open-source reverse engineering framework.",
            "sudo apt install -y radare2",
            "r2 {binary}", "https://github.com/radareorg/radare2",
            "low", &["binary"],
            (|| json!({"form":[{"name":"binary","label":"Binary file","type":"text","required":true}]})) as fn() -> Value),

        // ──────────────── 13. DDOS ATTACK ────────────────
        ("ht_ddosscript", "ddos_script", "ddos", "flood",
            "Multi-protocol DDoS script.",
            "git clone https://github.com/the-deepnet/ddos",
            "python3 ddos/ddos.py {target}", "https://github.com/the-deepnet/ddos",
            "critical", &["host"], p_target),
        ("ht_slowloris", "slowloris", "ddos", "slow_http",
            "Low-bandwidth HTTP slow-attack tool.",
            "pipx install slowloris",
            "slowloris {host}", "https://github.com/gkbrk/slowloris",
            "critical", &["host"], p_host),
        ("ht_asyncrone", "asyncrone", "ddos", "syn_flood",
            "Multifunction SYN flood DDoS weapon.",
            "git clone https://github.com/fatihsnsy/aSYNcrone && cd aSYNcrone && make",
            "./aSYNcrone {host}", "https://github.com/fatihsnsy/aSYNcrone",
            "critical", &["host"], p_host),
        ("ht_ufonet", "ufonet", "ddos", "botnet",
            "Open redirect / DDoS botnet tool.",
            "git clone https://github.com/epsylon/ufonet && cd ufonet && pip3 install -r requirements.txt",
            "python3 ufonet -i", "https://github.com/epsylon/ufonet",
            "critical", &["url"], p_url),
        ("ht_goldeneye", "goldeneye", "ddos", "http_flood",
            "HTTP DoS test tool.",
            "git clone https://github.com/jseidl/GoldenEye",
            "python3 GoldenEye/goldeneye.py {url}", "https://github.com/jseidl/GoldenEye",
            "critical", &["url"], p_url),

        // ──────────────── 14. RAT ────────────────
        ("ht_pyshell", "pyshell", "rat", "remote_shell",
            "Multiplatform Python WebShell.",
            "git clone https://github.com/knassar702/pyshell",
            "python3 pyshell/pyshell.py", "https://github.com/knassar702/pyshell",
            "critical", &["host"], p_none),

        // ──────────────── 15. XSS ATTACK ────────────────
        ("ht_dalfox", "dalfox", "xss", "scanner",
            "Powerful XSS scanning and parameter analysis.",
            "go install github.com/hahwul/dalfox/v2@latest",
            "dalfox url {url}", "https://github.com/hahwul/dalfox",
            "high", &["url"], p_url),
        ("ht_xssloader", "xss_payload_generator", "xss", "payload_gen",
            "Generate XSS payload polyglots.",
            "git clone https://github.com/capture0x/XSS-LOADER",
            "python3 XSS-LOADER/xssloader.py", "https://github.com/capture0x/XSS-LOADER",
            "medium", &["url"], p_none),
        ("ht_extendedxss", "extended_xss_search", "xss", "scanner",
            "Extended XSS searcher and finder.",
            "git clone https://github.com/Damian89/extended-xss-search",
            "python3 extended-xss-search/extended-xss-search.py {url}", "https://github.com/Damian89/extended-xss-search",
            "medium", &["url"], p_url),
        ("ht_xssfreak", "xss_freak", "xss", "scanner",
            "XSS scanner that crawls all links.",
            "git clone https://github.com/PR0PH3CY33/XSS-Freak",
            "python3 XSS-Freak/XSS-Freak.py", "https://github.com/PR0PH3CY33/XSS-Freak",
            "medium", &["url"], p_url),
        ("ht_xspear", "xspear", "xss", "scanner",
            "Powerful XSS scanning and parameter analysis tool.",
            "sudo gem install XSpear",
            "xspear -u {url}", "https://github.com/hahwul/XSpear",
            "high", &["url"], p_url),
        ("ht_xsscon", "xsscon", "xss", "scanner",
            "Simple Python XSS scanner.",
            "git clone https://github.com/menkrep1337/XSSCon",
            "python3 XSSCon/xsscon.py -u {url}", "https://github.com/menkrep1337/XSSCon",
            "medium", &["url"], p_url),
        ("ht_xanxss", "xanxss", "xss", "scanner",
            "Advanced XSS injection scanner.",
            "git clone https://github.com/Ekultek/XanXSS",
            "python3 XanXSS/xanxss.py -u {url}", "https://github.com/Ekultek/XanXSS",
            "medium", &["url"], p_url),
        ("ht_xsstrike", "xsstrike", "xss", "scanner",
            "Most advanced XSS scanner with engine.",
            "git clone https://github.com/UltimateHackers/XSStrike && pip3 install -r XSStrike/requirements.txt",
            "python3 XSStrike/xsstrike.py -u {url}", "https://github.com/UltimateHackers/XSStrike",
            "high", &["url"], p_url),
        ("ht_rvuln", "rvuln", "xss", "scanner",
            "Web vulnerability scanner.",
            "git clone https://github.com/iinc0gnit0/RVuln",
            "python3 RVuln/RVuln.py -u {url}", "https://github.com/iinc0gnit0/RVuln",
            "medium", &["url"], p_url),

        // ──────────────── 16. STEGANOGRAPHY ────────────────
        ("ht_steganohide", "steganohide", "steganography", "image",
            "Hide files inside images using steghide.",
            "sudo apt install -y steghide",
            "steghide embed -cf {cover} -ef {payload}", "",
            "low", &["file"],
            (|| json!({"form":[
                {"name":"cover","label":"Cover image","type":"text","required":true},
                {"name":"payload","label":"Payload file","type":"text","required":true}
            ]})) as fn() -> Value),
        ("ht_stegocracker", "stegocracker", "steganography", "crack",
            "Steganography brute-force utility.",
            "git clone https://github.com/W1LDN16H7/StegoCracker",
            "bash StegoCracker/stegocracker.sh {file} {wordlist}", "https://github.com/W1LDN16H7/StegoCracker",
            "low", &["file"],
            (|| json!({"form":[
                {"name":"file","label":"Stego file","type":"text","required":true},
                {"name":"wordlist","label":"Wordlist","type":"text","required":true}
            ]})) as fn() -> Value),
        ("ht_whitespace_snow10", "whitespace_snow10", "steganography", "text",
            "Hide messages in whitespace.",
            "git clone https://github.com/beardog108/snow10",
            "snow10/snow -C -m \"{message}\" -p \"{passphrase}\" {infile} {outfile}", "https://github.com/beardog108/snow10",
            "low", &["file"], p_none),

        // ──────────────── 17. ACTIVE DIRECTORY ────────────────
        ("ht_bloodhound", "bloodhound", "active_directory", "ad_audit",
            "Six degrees of Domain Admin — AD attack-path analysis.",
            "sudo apt install -y bloodhound",
            "bloodhound", "https://github.com/BloodHoundAD/BloodHound",
            "high", &["ad"], p_none),
        ("ht_netexec", "netexec", "active_directory", "ad_attack",
            "Network execution swiss-army knife (formerly CME).",
            "pipx install netexec",
            "nxc smb {host} -u {user} -p {password}",
            "https://github.com/Pennyw0rth/NetExec",
            "high", &["host"],
            (|| json!({"form":[
                {"name":"host","label":"Target host/CIDR","type":"text","required":true},
                {"name":"user","label":"Username","type":"text","required":true},
                {"name":"password","label":"Password","type":"password","required":true}
            ]})) as fn() -> Value),
        ("ht_impacket", "impacket", "active_directory", "ad_attack",
            "Collection of Python classes for working with Windows protocols.",
            "pipx install impacket",
            "secretsdump.py {domain}/{user}:{password}@{host}",
            "https://github.com/fortra/impacket",
            "critical", &["ad"],
            (|| json!({"form":[
                {"name":"domain","label":"Domain","type":"text","required":true},
                {"name":"user","label":"Username","type":"text","required":true},
                {"name":"password","label":"Password","type":"password","required":true},
                {"name":"host","label":"DC host","type":"text","required":true}
            ]})) as fn() -> Value),
        ("ht_responder", "responder", "active_directory", "llmnr_poison",
            "LLMNR / NBT-NS / mDNS poisoner.",
            "sudo apt install -y responder",
            "sudo responder -I {iface} -wrf",
            "https://github.com/lgandx/Responder",
            "critical", &["network"], p_iface),
        ("ht_certipy", "certipy", "active_directory", "adcs",
            "AD CS enumeration & abuse.",
            "pipx install certipy-ad",
            "certipy find -u {user}@{domain} -p {password}",
            "https://github.com/ly4k/Certipy",
            "critical", &["ad"], p_none),
        ("ht_kerbrute", "kerbrute", "active_directory", "kerberos",
            "Tool to perform Kerberos pre-auth bruteforcing.",
            "go install github.com/ropnop/kerbrute@latest",
            "kerbrute userenum --dc {dc} -d {domain} {wordlist}",
            "https://github.com/ropnop/kerbrute",
            "high", &["ad"],
            (|| json!({"form":[
                {"name":"dc","label":"Domain controller","type":"text","required":true},
                {"name":"domain","label":"Domain","type":"text","required":true},
                {"name":"wordlist","label":"User wordlist","type":"text","required":true}
            ]})) as fn() -> Value),

        // ──────────────── 18. CLOUD SECURITY ────────────────
        ("ht_prowler", "prowler", "cloud_security", "cspm",
            "AWS/GCP/Azure security best-practices assessment.",
            "pipx install prowler",
            "prowler {provider}",
            "https://github.com/prowler-cloud/prowler",
            "low", &["cloud"],
            (|| json!({"form":[{"name":"provider","label":"Cloud provider","type":"select","required":true,"options":["aws","gcp","azure","kubernetes"]}]})) as fn() -> Value),
        ("ht_scoutsuite", "scoutsuite", "cloud_security", "cspm",
            "Multi-cloud security auditing tool.",
            "pipx install scoutsuite",
            "scout {provider}",
            "https://github.com/nccgroup/ScoutSuite",
            "low", &["cloud"],
            (|| json!({"form":[{"name":"provider","label":"Cloud provider","type":"select","required":true,"options":["aws","gcp","azure"]}]})) as fn() -> Value),
        ("ht_pacu", "pacu", "cloud_security", "aws_offensive",
            "AWS exploitation framework.",
            "pipx install pacu",
            "pacu", "https://github.com/RhinoSecurityLabs/pacu",
            "critical", &["cloud"], p_none),
        ("ht_trivy", "trivy", "cloud_security", "container_scan",
            "Comprehensive vulnerability scanner for containers / IaC.",
            "sudo apt install -y trivy",
            "trivy {target_kind} {target}",
            "https://github.com/aquasecurity/trivy",
            "low", &["container"],
            (|| json!({"form":[
                {"name":"target_kind","label":"Target kind","type":"select","required":true,"options":["image","fs","repo","config"]},
                {"name":"target","label":"Target","type":"text","required":true}
            ]})) as fn() -> Value),

        // ──────────────── 19. MOBILE SECURITY ────────────────
        ("ht_mobsf", "mobsf", "mobile_security", "static_dynamic",
            "Mobile Security Framework — static/dynamic APK/IPA analysis.",
            "docker pull opensecurity/mobile-security-framework-mobsf:latest",
            "docker run -it --rm -p 8000:8000 opensecurity/mobile-security-framework-mobsf",
            "https://github.com/MobSF/Mobile-Security-Framework-MobSF",
            "low", &["mobile"], p_none),
        ("ht_frida", "frida", "mobile_security", "instrumentation",
            "Dynamic instrumentation toolkit.",
            "pipx install frida-tools",
            "frida -U -n {process}", "https://github.com/frida/frida",
            "high", &["mobile"],
            (|| json!({"form":[{"name":"process","label":"Process name","type":"text","required":true}]})) as fn() -> Value),
        ("ht_objection", "objection", "mobile_security", "instrumentation",
            "Runtime mobile exploration toolkit (frida-based).",
            "pipx install objection",
            "objection -g {package} explore", "https://github.com/sensepost/objection",
            "high", &["mobile"],
            (|| json!({"form":[{"name":"package","label":"Package name","type":"text","required":true}]})) as fn() -> Value),

        // ──────────────── 20. OTHER TOOLS ────────────────
        ("ht_brute_force_socialmedia", "brute_force_socialmedia", "other", "social_brute",
            "All-in-one social media bruteforce.",
            "git clone https://github.com/Matrix07ksa/Brute_Force",
            "python3 Brute_Force/Brute_Force.py", "https://github.com/Matrix07ksa/Brute_Force",
            "critical", &["target"], p_none),
        ("ht_underhanded", "underhanded", "other", "app_check",
            "Application checker.",
            "git clone https://github.com/jakuta-tech/underhanded",
            "python3 underhanded/underhanded.py", "https://github.com/jakuta-tech/underhanded",
            "low", &["target"], p_none),
        ("ht_keydroid", "keydroid", "other", "android_keylog",
            "Android keylogger + reverse shell.",
            "git clone https://github.com/F4dl0/keydroid",
            "bash keydroid/keydroid.sh", "https://github.com/F4dl0/keydroid",
            "critical", &["mobile"], p_none),
        ("ht_mysms", "mysms", "other", "android_sms",
            "Android SMS sender via spoofed sender.",
            "git clone https://github.com/papusingh2sms/mysms",
            "bash mysms/mysms.sh", "https://github.com/papusingh2sms/mysms",
            "critical", &["mobile"], p_none),
        ("ht_lockphish", "lockphish", "other", "lockscreen_phish",
            "Phishing for lock-screen credentials.",
            "git clone https://github.com/JasonJerry/lockphish",
            "bash lockphish/lockphish.sh", "https://github.com/JasonJerry/lockphish",
            "critical", &["mobile"], p_none),
        ("ht_wishfish", "wishfish", "other", "android_phish",
            "Phishing tool for Android (DroidCam/WishFish).",
            "git clone https://github.com/kinghacker0/WishFish",
            "bash WishFish/wishfish.sh", "https://github.com/kinghacker0/WishFish",
            "critical", &["mobile"], p_none),
        ("ht_evilapp", "evilapp", "other", "android_app",
            "Hijack session of any non-encrypted Android app.",
            "git clone https://github.com/crypticterminal/EvilApp",
            "bash EvilApp/evilapp.sh", "https://github.com/crypticterminal/EvilApp",
            "critical", &["mobile"], p_none),
        ("ht_evilurl", "evilurl", "other", "idn_homograph",
            "Generate unicode evil-URL domains for IDN homograph attacks.",
            "git clone https://github.com/UndeadSec/EvilURL",
            "python3 EvilURL/evilurl.py", "https://github.com/UndeadSec/EvilURL",
            "high", &["domain"], p_domain),
        ("ht_knockmail", "knockmail", "other", "email_verify",
            "Check if an email address really exists.",
            "git clone https://github.com/4w4k3/KnockMail && cd KnockMail && pip3 install -r requirements.txt",
            "python3 knock.py", "https://github.com/4w4k3/KnockMail",
            "low", &["email"], p_email),
        ("ht_hashbuster", "hash_buster", "other", "hash_lookup",
            "Crack hashes via online APIs.",
            "git clone https://github.com/s0md3v/Hash-Buster && cd Hash-Buster && sudo make install",
            "buster -s {hash}", "https://github.com/s0md3v/Hash-Buster",
            "low", &["hash"],
            (|| json!({"form":[{"name":"hash","label":"Hash","type":"text","required":true}]})) as fn() -> Value),
        ("ht_wifijammer", "wifijammer_ng", "other", "wifi_jam",
            "Continuously deauth all clients of all APs.",
            "git clone https://github.com/MisterBianco/wifijammer-ng && cd wifijammer-ng && sudo python3 setup.py install",
            "sudo wifijammer", "https://github.com/MisterBianco/wifijammer-ng",
            "critical", &["wireless"], p_none),
        ("ht_kawaiideauther", "kawaii_deauther", "other", "wifi_jam",
            "Wi-Fi deauth attack tool.",
            "git clone https://github.com/aryanrtm/KawaiiDeauther",
            "sudo bash KawaiiDeauther/install.sh", "https://github.com/aryanrtm/KawaiiDeauther",
            "critical", &["wireless"], p_none),
        ("ht_socialmapper", "social_mapper", "other", "facial_osint",
            "Find social-media accounts by facial recognition.",
            "git clone https://github.com/Greenwolf/social_mapper",
            "python3 social_mapper.py", "https://github.com/Greenwolf/social_mapper",
            "low", &["target"], p_none),
        ("ht_finduser", "finduser", "other", "username_osint",
            "Find social media accounts by username.",
            "git clone https://github.com/xHak9x/finduser",
            "bash finduser/finduser.sh", "https://github.com/xHak9x/finduser",
            "low", &["username"], p_username),
        ("ht_sherlock", "sherlock", "other", "username_osint",
            "Hunt down social media accounts by username (300+ sites).",
            "pipx install sherlock-project",
            "sherlock {username}", "https://github.com/sherlock-project/sherlock",
            "low", &["username"], p_username),
        ("ht_socialscan", "socialscan", "other", "username_osint",
            "Check email/username availability on online platforms.",
            "pipx install socialscan",
            "socialscan {username}", "https://github.com/iojw/socialscan",
            "low", &["username"], p_username),
        ("ht_debinject", "debinject", "other", "payload_inject",
            "Inject malicious code into .deb packages.",
            "git clone https://github.com/UndeadSec/Debinject",
            "bash Debinject/Debinject.sh", "https://github.com/UndeadSec/Debinject",
            "critical", &["host"], p_none),
        ("ht_pixload", "pixload", "other", "image_payload",
            "Image payload creating/injecting tools.",
            "git clone https://github.com/chinarulezzz/pixload",
            "perl pixload/png.pl", "https://github.com/chinarulezzz/pixload",
            "high", &["file"], p_file),
        ("ht_gospider", "gospider", "other", "crawler",
            "Fast web crawler in Go.",
            "go install github.com/jaeles-project/gospider@latest",
            "gospider -s {url}", "https://github.com/jaeles-project/gospider",
            "low", &["url"], p_url),
        ("ht_tilix", "tilix", "other", "terminal",
            "Tiling terminal emulator.",
            "sudo apt install -y tilix",
            "tilix", "https://github.com/gnunn1/tilix",
            "low", &["host"], p_none),
        ("ht_crivo", "crivo", "other", "wordlist_filter",
            "Wordlist-related filtering tool.",
            "git clone https://github.com/GMDSantana/crivo",
            "python3 crivo/crivo.py", "https://github.com/GMDSantana/crivo",
            "low", &["target"], p_none),
    ]
}

// ── Seeder ──────────────────────────────────────────────────────────────────

/// Upsert all hackingtool entries into the `tools` table.
/// Runs idempotently on every startup; never deletes existing rows.
pub async fn seed_hackingtools(pool: &PgPool) -> Result<(usize, usize), sqlx::Error> {
    let entries = catalog();
    let mut inserted = 0usize;
    let mut updated = 0usize;

    for (id, name, biz_cat, sub, desc, install, cmd, url, danger, target_types, params_fn) in &entries {
        let params = params_fn();
        let danger_text = match *danger {
            "low"      => "Low risk — read-only or self-contained.",
            "medium"   => "Medium risk — may produce noisy traffic.",
            "high"     => "High risk — actively exploits or modifies targets.",
            "critical" => "Critical — destructive / weaponizable. Authorization required.",
            _          => "Unknown risk.",
        };
        let target_types_json = serde_json::to_value(target_types).unwrap_or(json!([]));
        let merged_params = json!({
            "form": params.get("form").cloned().unwrap_or(json!([])),
            "danger_level": danger,
            "target_types": target_types_json,
        });

        // Insert or update. xmax=0 means INSERT, otherwise UPDATE.
        let res: (bool,) = sqlx::query_as(
            r#"
            INSERT INTO tools (
                id, name, category, description, command_template, parameters,
                plan_required, is_active, tool_type, install_command, official_url,
                business_name, business_description, business_category, subcategory,
                risk_context, tool_group, binary_name, kali_package
            ) VALUES (
                $1, $2, 'hackingtool', $3, $4, $5,
                'starter', TRUE, 'cli', $6, $7,
                $2, $3, $8, $9,
                $10, 'hackingtool', $2, ''
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                command_template = EXCLUDED.command_template,
                parameters = EXCLUDED.parameters,
                install_command = EXCLUDED.install_command,
                official_url = EXCLUDED.official_url,
                business_name = EXCLUDED.business_name,
                business_description = EXCLUDED.business_description,
                business_category = EXCLUDED.business_category,
                subcategory = EXCLUDED.subcategory,
                risk_context = EXCLUDED.risk_context,
                tool_group = EXCLUDED.tool_group
                -- NB: deliberately NOT touching is_active on conflict so that
                -- operator-initiated deactivations (e.g. scripts/tool_smoke_test.py)
                -- survive subsequent seeder runs.
            RETURNING (xmax = 0)
            "#,
        )
        .bind(id)
        .bind(name)
        .bind(desc)
        .bind(cmd)
        .bind(&merged_params)
        .bind(install)
        .bind(url)
        .bind(biz_cat)
        .bind(sub)
        .bind(danger_text)
        .fetch_one(pool)
        .await?;

        if res.0 {
            inserted += 1;
        } else {
            updated += 1;
        }
    }

    Ok((inserted, updated))
}
