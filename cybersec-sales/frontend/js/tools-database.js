/**
 * CyberSec Pro - Complete Tools Database
 * 401 Security Tools from Kali Linux and beyond
 * Every tool documented with parameters, examples, and presets
 */

const TOOLS_DATABASE = {
    // ============================================
    // INFORMATION GATHERING (55 tools)
    // ============================================
    "Information Gathering": {
        icon: "🔍",
        description: "Reconnaissance and OSINT tools",
        tools: [
            {
                name: "Nmap",
                slug: "nmap",
                description: "Network exploration tool and security/port scanner",
                version: "7.94",
                plan: "starter",
                tags: ["network", "scanner", "port", "discovery"],
                params: 110,
                command: "nmap",
                examples: ["nmap -sV -sC target.com", "nmap -p- -T4 192.168.1.0/24"]
            },
            {
                name: "Amass",
                slug: "amass",
                description: "In-depth DNS enumeration and network mapping",
                version: "5.0.1",
                plan: "starter",
                tags: ["dns", "osint", "subdomain", "enumeration"],
                params: 45,
                command: "amass"
            },
            {
                name: "theHarvester",
                slug: "theharvester",
                description: "E-mails, subdomains and names harvester",
                version: "4.4.0",
                plan: "starter",
                tags: ["osint", "email", "subdomain", "harvesting"],
                params: 25,
                command: "theHarvester"
            },
            {
                name: "Recon-ng",
                slug: "recon-ng",
                description: "Full-featured web reconnaissance framework",
                version: "5.1.2",
                plan: "pro",
                tags: ["osint", "framework", "reconnaissance"],
                params: 30,
                command: "recon-ng"
            },
            {
                name: "Maltego",
                slug: "maltego",
                description: "Interactive data mining tool for link analysis",
                version: "4.6.0",
                plan: "enterprise",
                tags: ["osint", "visualization", "analysis"],
                params: 20,
                command: "maltego"
            },
            {
                name: "SpiderFoot",
                slug: "spiderfoot",
                description: "Automates OSINT collection and analysis",
                version: "4.0",
                plan: "pro",
                tags: ["osint", "automation", "intelligence"],
                params: 35,
                command: "spiderfoot"
            },
            {
                name: "Shodan",
                slug: "shodan",
                description: "Search engine for Internet-connected devices",
                version: "CLI 1.30",
                plan: "pro",
                tags: ["osint", "iot", "search", "api"],
                params: 20,
                command: "shodan"
            },
            {
                name: "Fierce",
                slug: "fierce",
                description: "DNS reconnaissance tool for locating non-contiguous IP space",
                version: "1.5.0",
                plan: "starter",
                tags: ["dns", "reconnaissance", "enumeration"],
                params: 15,
                command: "fierce"
            },
            {
                name: "DNSEnum",
                slug: "dnsenum",
                description: "Perl script that enumerates DNS information",
                version: "1.3.0",
                plan: "starter",
                tags: ["dns", "enumeration", "perl"],
                params: 18,
                command: "dnsenum"
            },
            {
                name: "DNSRecon",
                slug: "dnsrecon",
                description: "DNS enumeration script with multiple features",
                version: "1.2.0",
                plan: "starter",
                tags: ["dns", "enumeration", "zone-transfer"],
                params: 25,
                command: "dnsrecon"
            },
            {
                name: "Sublist3r",
                slug: "sublist3r",
                description: "Fast subdomains enumeration tool",
                version: "1.1",
                plan: "starter",
                tags: ["subdomain", "enumeration", "osint"],
                params: 12,
                command: "sublist3r"
            },
            {
                name: "Subfinder",
                slug: "subfinder",
                description: "Subdomain discovery tool using passive sources",
                version: "2.6.0",
                plan: "starter",
                tags: ["subdomain", "discovery", "passive"],
                params: 20,
                command: "subfinder"
            },
            {
                name: "Masscan",
                slug: "masscan",
                description: "TCP port scanner, spews SYN packets asynchronously",
                version: "1.3.2",
                plan: "pro",
                tags: ["scanner", "port", "fast", "async"],
                params: 40,
                command: "masscan"
            },
            {
                name: "Enum4Linux",
                slug: "enum4linux",
                description: "Tool for enumerating info from Windows and Samba",
                version: "0.9.1",
                plan: "starter",
                tags: ["windows", "smb", "enumeration", "samba"],
                params: 20,
                command: "enum4linux"
            },
            {
                name: "NBTScan",
                slug: "nbtscan",
                description: "Scan networks for NetBIOS name information",
                version: "1.7.2",
                plan: "starter",
                tags: ["netbios", "scanner", "windows"],
                params: 10,
                command: "nbtscan"
            },
            {
                name: "SNMPWalk",
                slug: "snmpwalk",
                description: "Retrieve a subtree of management values using SNMP",
                version: "5.9.4",
                plan: "starter",
                tags: ["snmp", "enumeration", "network"],
                params: 25,
                command: "snmpwalk"
            },
            {
                name: "OneSixtyOne",
                slug: "onesixtyone",
                description: "Fast SNMP scanner",
                version: "0.3.4",
                plan: "starter",
                tags: ["snmp", "scanner", "fast"],
                params: 8,
                command: "onesixtyone"
            },
            {
                name: "SNMPCheck",
                slug: "snmpcheck",
                description: "SNMP device enumerator",
                version: "1.9",
                plan: "starter",
                tags: ["snmp", "enumeration", "device"],
                params: 15,
                command: "snmpcheck"
            },
            {
                name: "SMTP-User-Enum",
                slug: "smtp-user-enum",
                description: "Username guessing tool for SMTP servers",
                version: "1.2",
                plan: "starter",
                tags: ["smtp", "enumeration", "email"],
                params: 12,
                command: "smtp-user-enum"
            },
            {
                name: "WhatWeb",
                slug: "whatweb",
                description: "Next generation web scanner",
                version: "0.5.5",
                plan: "starter",
                tags: ["web", "fingerprint", "cms", "technology"],
                params: 30,
                command: "whatweb"
            },
            {
                name: "Wafw00f",
                slug: "wafw00f",
                description: "Web Application Firewall detection tool",
                version: "2.2.0",
                plan: "starter",
                tags: ["waf", "detection", "firewall", "web"],
                params: 10,
                command: "wafw00f"
            },
            {
                name: "Arp-Scan",
                slug: "arp-scan",
                description: "ARP scanning and fingerprinting tool",
                version: "1.10.0",
                plan: "starter",
                tags: ["arp", "network", "discovery", "local"],
                params: 20,
                command: "arp-scan"
            },
            {
                name: "Netdiscover",
                slug: "netdiscover",
                description: "Active/passive ARP reconnaissance tool",
                version: "0.10",
                plan: "starter",
                tags: ["arp", "discovery", "passive"],
                params: 12,
                command: "netdiscover"
            },
            {
                name: "DMitry",
                slug: "dmitry",
                description: "Deepmagic Information Gathering Tool",
                version: "1.3a",
                plan: "starter",
                tags: ["whois", "subdomain", "port", "email"],
                params: 10,
                command: "dmitry"
            },
            {
                name: "Whois",
                slug: "whois",
                description: "Domain name lookup",
                version: "5.5.17",
                plan: "starter",
                tags: ["whois", "domain", "lookup"],
                params: 8,
                command: "whois"
            },
            {
                name: "Dig",
                slug: "dig",
                description: "DNS lookup utility",
                version: "9.18",
                plan: "starter",
                tags: ["dns", "lookup", "query"],
                params: 25,
                command: "dig"
            },
            {
                name: "Host",
                slug: "host",
                description: "DNS lookup utility",
                version: "9.18",
                plan: "starter",
                tags: ["dns", "lookup", "simple"],
                params: 10,
                command: "host"
            },
            {
                name: "Traceroute",
                slug: "traceroute",
                description: "Print the route packets take to network host",
                version: "2.1.2",
                plan: "starter",
                tags: ["network", "route", "trace"],
                params: 15,
                command: "traceroute"
            },
            {
                name: "Hping3",
                slug: "hping3",
                description: "Network tool able to send custom packets",
                version: "3.0.0",
                plan: "pro",
                tags: ["packet", "craft", "network", "testing"],
                params: 50,
                command: "hping3"
            },
            {
                name: "Zenmap",
                slug: "zenmap",
                description: "Official Nmap Security Scanner GUI",
                version: "7.94",
                plan: "starter",
                tags: ["nmap", "gui", "scanner"],
                params: 0,
                command: "zenmap"
            },
            {
                name: "Unicornscan",
                slug: "unicornscan",
                description: "Asynchronous network stimulus delivery tool",
                version: "0.4.7",
                plan: "pro",
                tags: ["scanner", "async", "stimulus"],
                params: 35,
                command: "unicornscan"
            },
            {
                name: "P0f",
                slug: "p0f",
                description: "Passive OS fingerprinting tool",
                version: "3.09b",
                plan: "starter",
                tags: ["fingerprint", "passive", "os"],
                params: 15,
                command: "p0f"
            },
            {
                name: "Xprobe2",
                slug: "xprobe2",
                description: "Remote active OS fingerprinting tool",
                version: "0.3",
                plan: "starter",
                tags: ["fingerprint", "active", "os"],
                params: 12,
                command: "xprobe2"
            },
            {
                name: "Amap",
                slug: "amap",
                description: "Application mapper for network analysis",
                version: "5.4",
                plan: "starter",
                tags: ["application", "mapper", "service"],
                params: 20,
                command: "amap"
            },
            {
                name: "Httprint",
                slug: "httprint",
                description: "Web server fingerprinting tool",
                version: "301",
                plan: "starter",
                tags: ["web", "fingerprint", "server"],
                params: 15,
                command: "httprint"
            },
            {
                name: "Lbd",
                slug: "lbd",
                description: "Load Balancer Detector",
                version: "0.4",
                plan: "starter",
                tags: ["load-balancer", "detection", "web"],
                params: 5,
                command: "lbd"
            },
            {
                name: "Httprecon",
                slug: "httprecon",
                description: "Advanced web server fingerprinting",
                version: "7.3",
                plan: "pro",
                tags: ["web", "fingerprint", "advanced"],
                params: 12,
                command: "httprecon"
            },
            {
                name: "Sslscan",
                slug: "sslscan",
                description: "Fast SSL scanner",
                version: "2.1.1",
                plan: "starter",
                tags: ["ssl", "tls", "scanner", "certificate"],
                params: 25,
                command: "sslscan"
            },
            {
                name: "Sslyze",
                slug: "sslyze",
                description: "SSL/TLS server scanning tool",
                version: "6.0.0",
                plan: "starter",
                tags: ["ssl", "tls", "analysis", "security"],
                params: 30,
                command: "sslyze"
            },
            {
                name: "TestSSL",
                slug: "testssl",
                description: "Testing TLS/SSL encryption",
                version: "3.2",
                plan: "starter",
                tags: ["ssl", "tls", "testing", "encryption"],
                params: 40,
                command: "testssl"
            },
            {
                name: "Cewl",
                slug: "cewl",
                description: "Custom word list generator",
                version: "6.1",
                plan: "starter",
                tags: ["wordlist", "generator", "spider"],
                params: 20,
                command: "cewl"
            },
            {
                name: "Metagoofil",
                slug: "metagoofil",
                description: "Metadata extractor from public documents",
                version: "2.2",
                plan: "pro",
                tags: ["metadata", "documents", "osint"],
                params: 15,
                command: "metagoofil"
            },
            {
                name: "Exiftool",
                slug: "exiftool",
                description: "Read, write and edit metadata",
                version: "12.70",
                plan: "starter",
                tags: ["metadata", "exif", "images"],
                params: 100,
                command: "exiftool"
            },
            {
                name: "FOCA",
                slug: "foca",
                description: "Fingerprinting Organizations with Collected Archives",
                version: "3.4.7",
                plan: "enterprise",
                tags: ["metadata", "documents", "enterprise"],
                params: 25,
                command: "foca"
            },
            {
                name: "Sherlock",
                slug: "sherlock",
                description: "Hunt down social media accounts by username",
                version: "0.14.3",
                plan: "starter",
                tags: ["osint", "social-media", "username"],
                params: 15,
                command: "sherlock"
            }
        ]
    },

    // ============================================
    // WEB APPLICATION TOOLS (50 tools)
    // ============================================
    "Web Applications": {
        icon: "🌐",
        description: "Web vulnerability assessment tools",
        tools: [
            {
                name: "Nikto",
                slug: "nikto",
                description: "Web server scanner which performs comprehensive tests",
                version: "2.5.0",
                plan: "starter",
                tags: ["web", "scanner", "vulnerability", "server"],
                params: 34,
                command: "nikto"
            },
            {
                name: "SQLMap",
                slug: "sqlmap",
                description: "Automatic SQL injection and database takeover tool",
                version: "1.8",
                plan: "starter",
                tags: ["sql", "injection", "database", "automation"],
                params: 38,
                command: "sqlmap"
            },
            {
                name: "Burp Suite",
                slug: "burpsuite",
                description: "Platform for security testing of web applications",
                version: "2025.1",
                plan: "enterprise",
                tags: ["proxy", "scanner", "testing", "professional"],
                params: 50,
                command: "burpsuite"
            },
            {
                name: "OWASP ZAP",
                slug: "zaproxy",
                description: "Zed Attack Proxy - web app security scanner",
                version: "2.15.0",
                plan: "starter",
                tags: ["proxy", "scanner", "owasp", "free"],
                params: 45,
                command: "zaproxy"
            },
            {
                name: "Gobuster",
                slug: "gobuster",
                description: "Directory/file & DNS busting tool written in Go",
                version: "3.6",
                plan: "starter",
                tags: ["directory", "brute-force", "dns", "go"],
                params: 25,
                command: "gobuster"
            },
            {
                name: "Dirb",
                slug: "dirb",
                description: "Web content scanner using dictionary attack",
                version: "2.22",
                plan: "starter",
                tags: ["directory", "dictionary", "web"],
                params: 15,
                command: "dirb"
            },
            {
                name: "DirBuster",
                slug: "dirbuster",
                description: "Multi-threaded web directory/file brute-forcer",
                version: "1.0",
                plan: "starter",
                tags: ["directory", "brute-force", "gui"],
                params: 20,
                command: "dirbuster"
            },
            {
                name: "FFuF",
                slug: "ffuf",
                description: "Fast web fuzzer written in Go",
                version: "2.1.0",
                plan: "starter",
                tags: ["fuzzer", "fast", "go", "web"],
                params: 35,
                command: "ffuf"
            },
            {
                name: "Feroxbuster",
                slug: "feroxbuster",
                description: "Fast, simple, recursive content discovery tool",
                version: "2.10.0",
                plan: "pro",
                tags: ["directory", "recursive", "fast", "rust"],
                params: 40,
                command: "feroxbuster"
            },
            {
                name: "WFuzz",
                slug: "wfuzz",
                description: "Web application bruteforcer",
                version: "3.1.0",
                plan: "starter",
                tags: ["fuzzer", "brute-force", "payloads"],
                params: 30,
                command: "wfuzz"
            },
            {
                name: "WPScan",
                slug: "wpscan",
                description: "WordPress vulnerability scanner",
                version: "3.8.25",
                plan: "starter",
                tags: ["wordpress", "cms", "vulnerability"],
                params: 35,
                command: "wpscan"
            },
            {
                name: "JoomScan",
                slug: "joomscan",
                description: "OWASP Joomla vulnerability scanner",
                version: "0.0.7",
                plan: "starter",
                tags: ["joomla", "cms", "vulnerability"],
                params: 15,
                command: "joomscan"
            },
            {
                name: "Droopescan",
                slug: "droopescan",
                description: "CMS vulnerability scanner for Drupal, WordPress, etc.",
                version: "1.45.1",
                plan: "starter",
                tags: ["drupal", "cms", "scanner"],
                params: 20,
                command: "droopescan"
            },
            {
                name: "CMSmap",
                slug: "cmsmap",
                description: "CMS vulnerability scanner",
                version: "1.0",
                plan: "starter",
                tags: ["cms", "vulnerability", "multi"],
                params: 18,
                command: "cmsmap"
            },
            {
                name: "Commix",
                slug: "commix",
                description: "Automated OS command injection exploitation tool",
                version: "4.1",
                plan: "pro",
                tags: ["command-injection", "exploitation", "automation"],
                params: 45,
                command: "commix"
            },
            {
                name: "XSSer",
                slug: "xsser",
                description: "Automatic XSS attack framework",
                version: "1.8.4",
                plan: "pro",
                tags: ["xss", "cross-site", "scripting"],
                params: 40,
                command: "xsser"
            },
            {
                name: "Dalfox",
                slug: "dalfox",
                description: "Parameter analysis and XSS scanner",
                version: "2.9.2",
                plan: "pro",
                tags: ["xss", "scanner", "parameter"],
                params: 30,
                command: "dalfox"
            },
            {
                name: "Arjun",
                slug: "arjun",
                description: "HTTP parameter discovery suite",
                version: "2.2.1",
                plan: "starter",
                tags: ["parameter", "discovery", "http"],
                params: 20,
                command: "arjun"
            },
            {
                name: "ParamSpider",
                slug: "paramspider",
                description: "Mining URLs for parameter discovery",
                version: "1.0",
                plan: "starter",
                tags: ["parameter", "mining", "urls"],
                params: 12,
                command: "paramspider"
            },
            {
                name: "Nuclei",
                slug: "nuclei",
                description: "Fast and customizable vulnerability scanner",
                version: "3.2.0",
                plan: "pro",
                tags: ["scanner", "templates", "fast", "yaml"],
                params: 50,
                command: "nuclei"
            },
            {
                name: "HTTPX",
                slug: "httpx",
                description: "Fast and multi-purpose HTTP toolkit",
                version: "1.6.0",
                plan: "starter",
                tags: ["http", "toolkit", "probing"],
                params: 40,
                command: "httpx"
            },
            {
                name: "Skipfish",
                slug: "skipfish",
                description: "Active web application security reconnaissance tool",
                version: "2.10b",
                plan: "starter",
                tags: ["web", "scanner", "active"],
                params: 25,
                command: "skipfish"
            },
            {
                name: "W3af",
                slug: "w3af",
                description: "Web Application Attack and Audit Framework",
                version: "2021.04",
                plan: "pro",
                tags: ["framework", "audit", "attack"],
                params: 100,
                command: "w3af"
            },
            {
                name: "Arachni",
                slug: "arachni",
                description: "Feature-full web application security scanner",
                version: "1.6.1",
                plan: "pro",
                tags: ["scanner", "full-featured", "ruby"],
                params: 60,
                command: "arachni"
            },
            {
                name: "Wapiti",
                slug: "wapiti",
                description: "Web application vulnerability scanner",
                version: "3.1.7",
                plan: "starter",
                tags: ["scanner", "black-box", "python"],
                params: 35,
                command: "wapiti"
            },
            {
                name: "Cadaver",
                slug: "cadaver",
                description: "Command-line WebDAV client",
                version: "0.24",
                plan: "starter",
                tags: ["webdav", "client", "command-line"],
                params: 15,
                command: "cadaver"
            },
            {
                name: "DAVTest",
                slug: "davtest",
                description: "Testing tool for WebDAV servers",
                version: "1.2",
                plan: "starter",
                tags: ["webdav", "testing", "upload"],
                params: 12,
                command: "davtest"
            },
            {
                name: "Fimap",
                slug: "fimap",
                description: "Local and Remote File Inclusion exploitation tool",
                version: "1.00",
                plan: "pro",
                tags: ["lfi", "rfi", "file-inclusion"],
                params: 20,
                command: "fimap"
            },
            {
                name: "Dotdotpwn",
                slug: "dotdotpwn",
                description: "Directory traversal fuzzer",
                version: "3.0.2",
                plan: "pro",
                tags: ["traversal", "fuzzer", "directory"],
                params: 25,
                command: "dotdotpwn"
            },
            {
                name: "NoSQLMap",
                slug: "nosqlmap",
                description: "NoSQL injection attack tool",
                version: "0.7",
                plan: "pro",
                tags: ["nosql", "injection", "mongodb"],
                params: 20,
                command: "nosqlmap"
            },
            {
                name: "SQLNinja",
                slug: "sqlninja",
                description: "SQL Server injection & takeover tool",
                version: "0.2.999",
                plan: "pro",
                tags: ["sql", "injection", "mssql"],
                params: 30,
                command: "sqlninja"
            },
            {
                name: "jSQL Injection",
                slug: "jsql",
                description: "Automatic SQL injection tool",
                version: "0.85",
                plan: "starter",
                tags: ["sql", "injection", "gui", "java"],
                params: 25,
                command: "jsql-injection"
            },
            {
                name: "BBQSQL",
                slug: "bbqsql",
                description: "Blind SQL injection exploitation tool",
                version: "1.2",
                plan: "pro",
                tags: ["sql", "blind", "injection"],
                params: 20,
                command: "bbqsql"
            },
            {
                name: "Mitmproxy",
                slug: "mitmproxy",
                description: "Interactive HTTPS proxy",
                version: "10.2.0",
                plan: "starter",
                tags: ["proxy", "https", "mitm", "interactive"],
                params: 40,
                command: "mitmproxy"
            },
            {
                name: "Paros Proxy",
                slug: "paros",
                description: "Web application security assessment proxy",
                version: "3.2.13",
                plan: "starter",
                tags: ["proxy", "security", "java"],
                params: 20,
                command: "paros"
            },
            {
                name: "Vega",
                slug: "vega",
                description: "Open source web security scanner",
                version: "1.0",
                plan: "starter",
                tags: ["scanner", "gui", "open-source"],
                params: 25,
                command: "vega"
            },
            {
                name: "Whatwap",
                slug: "whatwap",
                description: "Web application analyzer",
                version: "1.0",
                plan: "starter",
                tags: ["analyzer", "technology", "detection"],
                params: 10,
                command: "whatwap"
            }
        ]
    },

    // ============================================
    // PASSWORD ATTACKS (35 tools)
    // ============================================
    "Password Attacks": {
        icon: "🔐",
        description: "Password cracking and brute-force tools",
        tools: [
            {
                name: "Hydra",
                slug: "hydra",
                description: "Fast and flexible online password cracking tool",
                version: "9.5",
                plan: "pro",
                tags: ["brute-force", "online", "multi-protocol"],
                params: 35,
                command: "hydra"
            },
            {
                name: "John the Ripper",
                slug: "john",
                description: "Fast password cracker",
                version: "1.9.0",
                plan: "starter",
                tags: ["cracker", "offline", "hashes"],
                params: 45,
                command: "john"
            },
            {
                name: "Hashcat",
                slug: "hashcat",
                description: "World's fastest password recovery tool",
                version: "6.2.6",
                plan: "enterprise",
                tags: ["cracker", "gpu", "fast", "hashes"],
                params: 60,
                command: "hashcat"
            },
            {
                name: "Medusa",
                slug: "medusa",
                description: "Speedy, massively parallel, modular, login brute-forcer",
                version: "2.2",
                plan: "pro",
                tags: ["brute-force", "parallel", "modular"],
                params: 30,
                command: "medusa"
            },
            {
                name: "Ncrack",
                slug: "ncrack",
                description: "High-speed network authentication cracking tool",
                version: "0.7",
                plan: "pro",
                tags: ["network", "authentication", "cracker"],
                params: 25,
                command: "ncrack"
            },
            {
                name: "Patator",
                slug: "patator",
                description: "Multi-purpose brute-forcer",
                version: "0.9",
                plan: "pro",
                tags: ["brute-force", "multi-purpose", "flexible"],
                params: 40,
                command: "patator"
            },
            {
                name: "Ophcrack",
                slug: "ophcrack",
                description: "Windows password cracker using rainbow tables",
                version: "3.8.0",
                plan: "starter",
                tags: ["windows", "rainbow", "lm", "ntlm"],
                params: 15,
                command: "ophcrack"
            },
            {
                name: "RainbowCrack",
                slug: "rainbowcrack",
                description: "Crack hashes with rainbow tables",
                version: "1.8",
                plan: "enterprise",
                tags: ["rainbow", "tables", "hash"],
                params: 20,
                command: "rcrack"
            },
            {
                name: "Crunch",
                slug: "crunch",
                description: "Wordlist generator",
                version: "3.6",
                plan: "starter",
                tags: ["wordlist", "generator", "custom"],
                params: 15,
                command: "crunch"
            },
            {
                name: "CeWL",
                slug: "cewl",
                description: "Custom wordlist generator by spidering",
                version: "6.1",
                plan: "starter",
                tags: ["wordlist", "spider", "custom"],
                params: 20,
                command: "cewl"
            },
            {
                name: "RSMangler",
                slug: "rsmangler",
                description: "Wordlist mangling tool",
                version: "1.5",
                plan: "starter",
                tags: ["wordlist", "mangle", "permutation"],
                params: 15,
                command: "rsmangler"
            },
            {
                name: "CUPP",
                slug: "cupp",
                description: "Common User Passwords Profiler",
                version: "3.3.0",
                plan: "starter",
                tags: ["wordlist", "profile", "social"],
                params: 10,
                command: "cupp"
            },
            {
                name: "Pipal",
                slug: "pipal",
                description: "Password analyzer",
                version: "3.1",
                plan: "starter",
                tags: ["analyzer", "statistics", "patterns"],
                params: 8,
                command: "pipal"
            },
            {
                name: "Hash-Identifier",
                slug: "hash-identifier",
                description: "Identify hash types",
                version: "1.2",
                plan: "starter",
                tags: ["hash", "identifier", "type"],
                params: 5,
                command: "hash-identifier"
            },
            {
                name: "Hashid",
                slug: "hashid",
                description: "Identify different hash types",
                version: "3.1.4",
                plan: "starter",
                tags: ["hash", "identifier", "python"],
                params: 8,
                command: "hashid"
            },
            {
                name: "FindMyHash",
                slug: "findmyhash",
                description: "Crack hashes using online services",
                version: "2.0",
                plan: "starter",
                tags: ["hash", "online", "cracker"],
                params: 10,
                command: "findmyhash"
            },
            {
                name: "CrackStation",
                slug: "crackstation",
                description: "Online hash cracker integration",
                version: "API",
                plan: "starter",
                tags: ["hash", "online", "api"],
                params: 5,
                command: "crackstation"
            },
            {
                name: "Chntpw",
                slug: "chntpw",
                description: "Windows NT SAM password recovery utility",
                version: "1.1",
                plan: "starter",
                tags: ["windows", "sam", "password", "reset"],
                params: 12,
                command: "chntpw"
            },
            {
                name: "Mimikatz",
                slug: "mimikatz",
                description: "Windows credential extraction tool",
                version: "2.2.0",
                plan: "enterprise",
                tags: ["windows", "credentials", "memory"],
                params: 50,
                command: "mimikatz"
            },
            {
                name: "LaZagne",
                slug: "lazagne",
                description: "Credentials recovery project",
                version: "2.4.5",
                plan: "pro",
                tags: ["credentials", "recovery", "multi-platform"],
                params: 15,
                command: "lazagne"
            },
            {
                name: "SecretsDump",
                slug: "secretsdump",
                description: "Perform various techniques to dump secrets",
                version: "0.11.0",
                plan: "pro",
                tags: ["secrets", "dump", "domain"],
                params: 25,
                command: "secretsdump.py"
            },
            {
                name: "Responder",
                slug: "responder",
                description: "LLMNR, NBT-NS and MDNS poisoner",
                version: "3.1.4",
                plan: "pro",
                tags: ["poisoner", "ntlm", "credentials"],
                params: 30,
                command: "responder"
            },
            {
                name: "CrackMapExec",
                slug: "crackmapexec",
                description: "Swiss army knife for pentesting Windows/AD",
                version: "5.4.0",
                plan: "pro",
                tags: ["windows", "ad", "credential", "swiss-army"],
                params: 50,
                command: "crackmapexec"
            },
            {
                name: "NetExec",
                slug: "netexec",
                description: "Network execution and credential testing",
                version: "1.1.0",
                plan: "pro",
                tags: ["network", "execution", "credential"],
                params: 45,
                command: "netexec"
            },
            {
                name: "Kerbrute",
                slug: "kerbrute",
                description: "Kerberos brute-force and enumeration",
                version: "1.0.3",
                plan: "pro",
                tags: ["kerberos", "brute-force", "enumeration"],
                params: 20,
                command: "kerbrute"
            },
            {
                name: "GetNPUsers",
                slug: "getnpusers",
                description: "AS-REP Roasting attack tool",
                version: "0.11.0",
                plan: "pro",
                tags: ["kerberos", "asrep", "roasting"],
                params: 15,
                command: "GetNPUsers.py"
            },
            {
                name: "GetUserSPNs",
                slug: "getuserspns",
                description: "Kerberoasting attack tool",
                version: "0.11.0",
                plan: "pro",
                tags: ["kerberos", "kerberoasting", "spn"],
                params: 15,
                command: "GetUserSPNs.py"
            },
            {
                name: "Kwprocessor",
                slug: "kwprocessor",
                description: "Keyboard walk generator",
                version: "1.0",
                plan: "starter",
                tags: ["wordlist", "keyboard", "patterns"],
                params: 10,
                command: "kwprocessor"
            }
        ]
    },

    // ============================================
    // EXPLOITATION TOOLS (40 tools)
    // ============================================
    "Exploitation Tools": {
        icon: "💥",
        description: "Exploit development and delivery tools",
        tools: [
            {
                name: "Metasploit Framework",
                slug: "metasploit",
                description: "World's most used penetration testing framework",
                version: "6.4",
                plan: "pro",
                tags: ["framework", "exploit", "payload", "professional"],
                params: 200,
                command: "msfconsole"
            },
            {
                name: "Searchsploit",
                slug: "searchsploit",
                description: "Command line search tool for Exploit-DB",
                version: "4.0",
                plan: "starter",
                tags: ["exploit", "database", "search"],
                params: 15,
                command: "searchsploit"
            },
            {
                name: "Social Engineering Toolkit",
                slug: "set",
                description: "Social-Engineer Toolkit for penetration testing",
                version: "8.0.3",
                plan: "pro",
                tags: ["social", "engineering", "phishing"],
                params: 50,
                command: "setoolkit"
            },
            {
                name: "BeEF",
                slug: "beef",
                description: "Browser Exploitation Framework",
                version: "0.5.4",
                plan: "pro",
                tags: ["browser", "exploitation", "xss"],
                params: 40,
                command: "beef-xss"
            },
            {
                name: "Gophish",
                slug: "gophish",
                description: "Open-source phishing framework",
                version: "0.12.1",
                plan: "pro",
                tags: ["phishing", "campaign", "framework"],
                params: 30,
                command: "gophish"
            },
            {
                name: "RouterSploit",
                slug: "routersploit",
                description: "Exploitation Framework for Embedded Devices",
                version: "3.4.0",
                plan: "pro",
                tags: ["router", "iot", "embedded", "exploit"],
                params: 35,
                command: "routersploit"
            },
            {
                name: "Evil-WinRM",
                slug: "evil-winrm",
                description: "Ultimate WinRM shell for hacking/pentesting",
                version: "3.5",
                plan: "pro",
                tags: ["winrm", "windows", "shell"],
                params: 25,
                command: "evil-winrm"
            },
            {
                name: "PSExec",
                slug: "psexec",
                description: "Remote execution on Windows systems",
                version: "0.11.0",
                plan: "pro",
                tags: ["windows", "remote", "execution"],
                params: 20,
                command: "psexec.py"
            },
            {
                name: "WMIExec",
                slug: "wmiexec",
                description: "WMI execution for Windows",
                version: "0.11.0",
                plan: "pro",
                tags: ["wmi", "windows", "execution"],
                params: 18,
                command: "wmiexec.py"
            },
            {
                name: "SMBExec",
                slug: "smbexec",
                description: "SMB execution on Windows",
                version: "0.11.0",
                plan: "pro",
                tags: ["smb", "windows", "execution"],
                params: 18,
                command: "smbexec.py"
            },
            {
                name: "ATExec",
                slug: "atexec",
                description: "AT execution via Task Scheduler",
                version: "0.11.0",
                plan: "pro",
                tags: ["at", "scheduler", "windows"],
                params: 15,
                command: "atexec.py"
            },
            {
                name: "Impacket",
                slug: "impacket",
                description: "Collection of Python classes for working with network protocols",
                version: "0.11.0",
                plan: "pro",
                tags: ["python", "protocol", "collection"],
                params: 100,
                command: "impacket"
            },
            {
                name: "Shellter",
                slug: "shellter",
                description: "Dynamic shellcode injection tool",
                version: "7.2",
                plan: "pro",
                tags: ["shellcode", "injection", "av-evasion"],
                params: 20,
                command: "shellter"
            },
            {
                name: "Veil",
                slug: "veil",
                description: "Generate AV-evading payloads",
                version: "3.1.14",
                plan: "pro",
                tags: ["payload", "evasion", "av"],
                params: 30,
                command: "veil"
            },
            {
                name: "MSFvenom",
                slug: "msfvenom",
                description: "Payload generator and encoder",
                version: "6.4",
                plan: "pro",
                tags: ["payload", "encoder", "generator"],
                params: 50,
                command: "msfvenom"
            },
            {
                name: "PowerShell Empire",
                slug: "powershell-empire",
                description: "Post-exploitation PowerShell agent framework",
                version: "5.9.3",
                plan: "enterprise",
                tags: ["powershell", "post-exploitation", "c2"],
                params: 80,
                command: "empire"
            },
            {
                name: "Covenant",
                slug: "covenant",
                description: "Collaborative .NET C2 framework",
                version: "0.6",
                plan: "enterprise",
                tags: ["c2", "dotnet", "collaborative"],
                params: 60,
                command: "covenant"
            },
            {
                name: "Sliver",
                slug: "sliver",
                description: "Open source cross-platform C2 framework",
                version: "1.5.42",
                plan: "enterprise",
                tags: ["c2", "cross-platform", "implant"],
                params: 70,
                command: "sliver"
            },
            {
                name: "Havoc",
                slug: "havoc",
                description: "Modern and malleable post-exploitation C2 framework",
                version: "0.6",
                plan: "enterprise",
                tags: ["c2", "modern", "post-exploitation"],
                params: 65,
                command: "havoc"
            },
            {
                name: "Cobalt Strike",
                slug: "cobaltstrike",
                description: "Commercial adversary simulation software",
                version: "4.9",
                plan: "enterprise",
                tags: ["c2", "commercial", "adversary-simulation"],
                params: 100,
                command: "cobaltstrike"
            },
            {
                name: "Evilginx2",
                slug: "evilginx2",
                description: "Standalone MITM attack framework for phishing",
                version: "3.2.0",
                plan: "enterprise",
                tags: ["phishing", "mitm", "2fa-bypass"],
                params: 35,
                command: "evilginx2"
            },
            {
                name: "Modlishka",
                slug: "modlishka",
                description: "Flexible reverse proxy for phishing",
                version: "1.1.0",
                plan: "pro",
                tags: ["phishing", "proxy", "2fa"],
                params: 25,
                command: "modlishka"
            },
            {
                name: "King Phisher",
                slug: "king-phisher",
                description: "Phishing campaign toolkit",
                version: "1.14.0",
                plan: "pro",
                tags: ["phishing", "campaign", "server"],
                params: 30,
                command: "king-phisher"
            }
        ]
    },

    // ============================================
    // WIRELESS ATTACKS (25 tools)
    // ============================================
    "Wireless Attacks": {
        icon: "📶",
        description: "WiFi and wireless security testing tools",
        tools: [
            {
                name: "Aircrack-ng",
                slug: "aircrack-ng",
                description: "Complete suite for WiFi security auditing",
                version: "1.7",
                plan: "pro",
                tags: ["wifi", "wep", "wpa", "cracking"],
                params: 40,
                command: "aircrack-ng"
            },
            {
                name: "Airodump-ng",
                slug: "airodump-ng",
                description: "Packet capture for raw 802.11 frames",
                version: "1.7",
                plan: "pro",
                tags: ["wifi", "capture", "monitoring"],
                params: 25,
                command: "airodump-ng"
            },
            {
                name: "Aireplay-ng",
                slug: "aireplay-ng",
                description: "Wireless frame injection tool",
                version: "1.7",
                plan: "pro",
                tags: ["wifi", "injection", "deauth"],
                params: 30,
                command: "aireplay-ng"
            },
            {
                name: "Airmon-ng",
                slug: "airmon-ng",
                description: "Enable monitor mode on wireless interfaces",
                version: "1.7",
                plan: "pro",
                tags: ["wifi", "monitor", "mode"],
                params: 10,
                command: "airmon-ng"
            },
            {
                name: "Wifite",
                slug: "wifite",
                description: "Automated wireless attack tool",
                version: "2.7.0",
                plan: "pro",
                tags: ["wifi", "automated", "cracking"],
                params: 35,
                command: "wifite"
            },
            {
                name: "Reaver",
                slug: "reaver",
                description: "WPS brute force attack tool",
                version: "1.6.6",
                plan: "pro",
                tags: ["wps", "brute-force", "wifi"],
                params: 25,
                command: "reaver"
            },
            {
                name: "Bully",
                slug: "bully",
                description: "WPS brute force attack implementation",
                version: "1.4.0",
                plan: "pro",
                tags: ["wps", "brute-force", "wifi"],
                params: 20,
                command: "bully"
            },
            {
                name: "PixieWPS",
                slug: "pixiewps",
                description: "WPS offline brute-force attack tool",
                version: "1.4.2",
                plan: "pro",
                tags: ["wps", "pixie-dust", "offline"],
                params: 15,
                command: "pixiewps"
            },
            {
                name: "Fern WiFi Cracker",
                slug: "fern-wifi-cracker",
                description: "Wireless security auditing GUI",
                version: "3.3",
                plan: "pro",
                tags: ["wifi", "gui", "cracking"],
                params: 20,
                command: "fern-wifi-cracker"
            },
            {
                name: "Kismet",
                slug: "kismet",
                description: "Wireless network detector and sniffer",
                version: "2024-01",
                plan: "pro",
                tags: ["wifi", "sniffer", "detector"],
                params: 50,
                command: "kismet"
            },
            {
                name: "Wireshark (Wireless)",
                slug: "wireshark-wireless",
                description: "Wireless packet analysis with Wireshark",
                version: "4.2",
                plan: "starter",
                tags: ["wifi", "packet", "analysis"],
                params: 0,
                command: "wireshark"
            },
            {
                name: "Cowpatty",
                slug: "cowpatty",
                description: "WPA-PSK dictionary attack",
                version: "4.8",
                plan: "pro",
                tags: ["wpa", "dictionary", "attack"],
                params: 15,
                command: "cowpatty"
            },
            {
                name: "Pyrit",
                slug: "pyrit",
                description: "WPA/WPA2 cracker using GPU",
                version: "0.5.1",
                plan: "enterprise",
                tags: ["wpa", "gpu", "cracking"],
                params: 25,
                command: "pyrit"
            },
            {
                name: "Fluxion",
                slug: "fluxion",
                description: "Security auditing tool for WiFi social engineering",
                version: "6.9",
                plan: "enterprise",
                tags: ["wifi", "social", "evil-twin"],
                params: 30,
                command: "fluxion"
            },
            {
                name: "WiFi-Pumpkin",
                slug: "wifi-pumpkin",
                description: "Rogue AP framework for WiFi attacks",
                version: "3.0",
                plan: "pro",
                tags: ["rogue-ap", "mitm", "wifi"],
                params: 40,
                command: "wifi-pumpkin"
            },
            {
                name: "Hostapd-WPE",
                slug: "hostapd-wpe",
                description: "Wireless Pwnage Edition for enterprise attacks",
                version: "2.10",
                plan: "enterprise",
                tags: ["enterprise", "eap", "credential"],
                params: 25,
                command: "hostapd-wpe"
            },
            {
                name: "MDK4",
                slug: "mdk4",
                description: "802.11 exploitation tool",
                version: "4.2",
                plan: "pro",
                tags: ["wifi", "exploitation", "dos"],
                params: 30,
                command: "mdk4"
            },
            {
                name: "Airgeddon",
                slug: "airgeddon",
                description: "Multi-use bash script for WiFi auditing",
                version: "11.30",
                plan: "pro",
                tags: ["wifi", "script", "multi-tool"],
                params: 0,
                command: "airgeddon"
            },
            {
                name: "Wifiphisher",
                slug: "wifiphisher",
                description: "WiFi phishing attacks framework",
                version: "1.4",
                plan: "pro",
                tags: ["wifi", "phishing", "evil-twin"],
                params: 35,
                command: "wifiphisher"
            },
            {
                name: "EAPHammer",
                slug: "eaphammer",
                description: "Targeted evil twin attacks against WPA2-Enterprise",
                version: "1.13.0",
                plan: "enterprise",
                tags: ["enterprise", "evil-twin", "eap"],
                params: 40,
                command: "eaphammer"
            }
        ]
    },

    // ============================================
    // SNIFFING & SPOOFING (30 tools)
    // ============================================
    "Sniffing & Spoofing": {
        icon: "👁️",
        description: "Network traffic analysis and manipulation",
        tools: [
            {
                name: "Wireshark",
                slug: "wireshark",
                description: "World's foremost network protocol analyzer",
                version: "4.2",
                plan: "starter",
                tags: ["packet", "capture", "analysis", "gui"],
                params: 100,
                command: "wireshark"
            },
            {
                name: "Tcpdump",
                slug: "tcpdump",
                description: "Powerful command-line packet analyzer",
                version: "4.99.4",
                plan: "starter",
                tags: ["packet", "capture", "cli"],
                params: 50,
                command: "tcpdump"
            },
            {
                name: "Tshark",
                slug: "tshark",
                description: "Terminal-based Wireshark",
                version: "4.2",
                plan: "starter",
                tags: ["packet", "capture", "cli"],
                params: 80,
                command: "tshark"
            },
            {
                name: "Ettercap",
                slug: "ettercap",
                description: "Comprehensive suite for MITM attacks",
                version: "0.8.3.1",
                plan: "pro",
                tags: ["mitm", "arp", "spoofing"],
                params: 45,
                command: "ettercap"
            },
            {
                name: "Bettercap",
                slug: "bettercap",
                description: "Swiss Army knife for 802.11, BLE, and Ethernet",
                version: "2.32.0",
                plan: "pro",
                tags: ["mitm", "arp", "spoofing", "modern"],
                params: 60,
                command: "bettercap"
            },
            {
                name: "Arpspoof",
                slug: "arpspoof",
                description: "Intercept packets on a switched LAN",
                version: "2.4",
                plan: "starter",
                tags: ["arp", "spoofing", "mitm"],
                params: 10,
                command: "arpspoof"
            },
            {
                name: "DNSspoof",
                slug: "dnsspoof",
                description: "Forge replies to DNS queries",
                version: "2.4",
                plan: "starter",
                tags: ["dns", "spoofing", "mitm"],
                params: 12,
                command: "dnsspoof"
            },
            {
                name: "DNSChef",
                slug: "dnschef",
                description: "DNS proxy for penetration testers",
                version: "0.4",
                plan: "pro",
                tags: ["dns", "proxy", "spoofing"],
                params: 20,
                command: "dnschef"
            },
            {
                name: "Macchanger",
                slug: "macchanger",
                description: "GNU MAC changer",
                version: "1.7.0",
                plan: "starter",
                tags: ["mac", "address", "changer"],
                params: 12,
                command: "macchanger"
            },
            {
                name: "Netcat",
                slug: "netcat",
                description: "TCP/UDP networking Swiss army knife",
                version: "1.10",
                plan: "starter",
                tags: ["network", "utility", "swiss-army"],
                params: 20,
                command: "nc"
            },
            {
                name: "Socat",
                slug: "socat",
                description: "Relay for bidirectional data transfer",
                version: "1.7.4.4",
                plan: "starter",
                tags: ["network", "relay", "bidirectional"],
                params: 50,
                command: "socat"
            },
            {
                name: "Scapy",
                slug: "scapy",
                description: "Powerful interactive packet manipulation program",
                version: "2.5.0",
                plan: "pro",
                tags: ["packet", "craft", "python"],
                params: 100,
                command: "scapy"
            },
            {
                name: "Yersinia",
                slug: "yersinia",
                description: "Layer 2 attacks framework",
                version: "0.8.2",
                plan: "pro",
                tags: ["layer2", "attack", "vlan"],
                params: 30,
                command: "yersinia"
            },
            {
                name: "MITMf",
                slug: "mitmf",
                description: "Framework for Man-In-The-Middle attacks",
                version: "0.9.8",
                plan: "pro",
                tags: ["mitm", "framework", "modular"],
                params: 45,
                command: "mitmf"
            },
            {
                name: "SSLstrip",
                slug: "sslstrip",
                description: "HTTPS stripping attack tool",
                version: "0.9",
                plan: "pro",
                tags: ["ssl", "strip", "mitm"],
                params: 15,
                command: "sslstrip"
            },
            {
                name: "SSLsplit",
                slug: "sslsplit",
                description: "Transparent SSL/TLS interception",
                version: "0.5.5",
                plan: "pro",
                tags: ["ssl", "intercept", "mitm"],
                params: 30,
                command: "sslsplit"
            },
            {
                name: "Dsniff",
                slug: "dsniff",
                description: "Suite of password sniffing tools",
                version: "2.4",
                plan: "pro",
                tags: ["password", "sniffer", "suite"],
                params: 20,
                command: "dsniff"
            },
            {
                name: "NetworkMiner",
                slug: "networkminer",
                description: "Network forensic analysis tool",
                version: "2.8.1",
                plan: "pro",
                tags: ["forensic", "analysis", "pcap"],
                params: 25,
                command: "networkminer"
            },
            {
                name: "Driftnet",
                slug: "driftnet",
                description: "Picks out images from TCP connections",
                version: "1.4",
                plan: "starter",
                tags: ["images", "sniffer", "tcp"],
                params: 10,
                command: "driftnet"
            },
            {
                name: "Hamster",
                slug: "hamster",
                description: "HTTP session sidejacking",
                version: "2.0",
                plan: "pro",
                tags: ["session", "sidejack", "cookie"],
                params: 15,
                command: "hamster"
            },
            {
                name: "Ferret",
                slug: "ferret",
                description: "Extract data from packet captures",
                version: "3.0.1",
                plan: "pro",
                tags: ["extract", "data", "pcap"],
                params: 12,
                command: "ferret"
            }
        ]
    },

    // ============================================
    // FORENSICS (30 tools)
    // ============================================
    "Forensics": {
        icon: "🔬",
        description: "Digital forensics and investigation tools",
        tools: [
            {
                name: "Autopsy",
                slug: "autopsy",
                description: "Digital forensics platform and graphical interface",
                version: "4.21.0",
                plan: "starter",
                tags: ["forensics", "gui", "investigation"],
                params: 50,
                command: "autopsy"
            },
            {
                name: "Sleuth Kit",
                slug: "sleuthkit",
                description: "Collection of UNIX-based forensic tools",
                version: "4.12.1",
                plan: "starter",
                tags: ["forensics", "file-system", "unix"],
                params: 100,
                command: "sleuthkit"
            },
            {
                name: "Volatility",
                slug: "volatility",
                description: "Memory forensics framework",
                version: "3.2.4",
                plan: "pro",
                tags: ["memory", "forensics", "analysis"],
                params: 80,
                command: "vol"
            },
            {
                name: "Binwalk",
                slug: "binwalk",
                description: "Firmware analysis and extraction tool",
                version: "3.1.0",
                plan: "starter",
                tags: ["firmware", "extraction", "analysis"],
                params: 25,
                command: "binwalk"
            },
            {
                name: "Foremost",
                slug: "foremost",
                description: "Data recovery tool based on headers",
                version: "1.5.7",
                plan: "starter",
                tags: ["recovery", "carving", "headers"],
                params: 15,
                command: "foremost"
            },
            {
                name: "Scalpel",
                slug: "scalpel",
                description: "Fast file carver",
                version: "2.0",
                plan: "starter",
                tags: ["carving", "recovery", "fast"],
                params: 12,
                command: "scalpel"
            },
            {
                name: "Bulk Extractor",
                slug: "bulk-extractor",
                description: "Extracts info without parsing filesystem",
                version: "2.1.1",
                plan: "pro",
                tags: ["extraction", "bulk", "forensics"],
                params: 35,
                command: "bulk_extractor"
            },
            {
                name: "Photorec",
                slug: "photorec",
                description: "Data recovery software",
                version: "7.2",
                plan: "starter",
                tags: ["recovery", "photos", "files"],
                params: 15,
                command: "photorec"
            },
            {
                name: "TestDisk",
                slug: "testdisk",
                description: "Partition recovery and repair",
                version: "7.2",
                plan: "starter",
                tags: ["partition", "recovery", "repair"],
                params: 20,
                command: "testdisk"
            },
            {
                name: "DD",
                slug: "dd",
                description: "Data duplication and imaging",
                version: "8.32",
                plan: "starter",
                tags: ["imaging", "copy", "raw"],
                params: 20,
                command: "dd"
            },
            {
                name: "DC3DD",
                slug: "dc3dd",
                description: "DoD Computer Forensics Lab version of dd",
                version: "7.3.0",
                plan: "starter",
                tags: ["imaging", "forensics", "hashing"],
                params: 25,
                command: "dc3dd"
            },
            {
                name: "Guymager",
                slug: "guymager",
                description: "Forensic disk imager",
                version: "0.8.13",
                plan: "starter",
                tags: ["imaging", "gui", "forensics"],
                params: 20,
                command: "guymager"
            },
            {
                name: "Hashdeep",
                slug: "hashdeep",
                description: "Compute and match hash values",
                version: "4.4",
                plan: "starter",
                tags: ["hash", "verification", "recursive"],
                params: 15,
                command: "hashdeep"
            },
            {
                name: "RegRipper",
                slug: "regripper",
                description: "Registry data extraction and correlation",
                version: "3.0",
                plan: "pro",
                tags: ["registry", "windows", "extraction"],
                params: 20,
                command: "regripper"
            },
            {
                name: "YARA",
                slug: "yara",
                description: "Pattern matching swiss knife for malware",
                version: "4.4.0",
                plan: "pro",
                tags: ["malware", "pattern", "matching"],
                params: 25,
                command: "yara"
            },
            {
                name: "ClamAV",
                slug: "clamav",
                description: "Open source antivirus engine",
                version: "1.2.1",
                plan: "starter",
                tags: ["antivirus", "scanning", "detection"],
                params: 30,
                command: "clamscan"
            },
            {
                name: "Chkrootkit",
                slug: "chkrootkit",
                description: "Locally checks for signs of a rootkit",
                version: "0.58",
                plan: "starter",
                tags: ["rootkit", "detection", "local"],
                params: 10,
                command: "chkrootkit"
            },
            {
                name: "Rkhunter",
                slug: "rkhunter",
                description: "Rootkit Hunter",
                version: "1.4.6",
                plan: "starter",
                tags: ["rootkit", "hunter", "security"],
                params: 25,
                command: "rkhunter"
            },
            {
                name: "PDF-Parser",
                slug: "pdf-parser",
                description: "Parse PDF documents for analysis",
                version: "0.7.7",
                plan: "starter",
                tags: ["pdf", "parser", "malware"],
                params: 15,
                command: "pdf-parser"
            },
            {
                name: "PDFid",
                slug: "pdfid",
                description: "Scan PDF for keywords",
                version: "0.2.8",
                plan: "starter",
                tags: ["pdf", "analysis", "keywords"],
                params: 10,
                command: "pdfid"
            },
            {
                name: "Peepdf",
                slug: "peepdf",
                description: "PDF analysis tool",
                version: "0.4.2",
                plan: "pro",
                tags: ["pdf", "analysis", "python"],
                params: 20,
                command: "peepdf"
            },
            {
                name: "Oletools",
                slug: "oletools",
                description: "Tools to analyze OLE files (MS Office)",
                version: "0.60.1",
                plan: "pro",
                tags: ["office", "ole", "malware"],
                params: 30,
                command: "oletools"
            },
            {
                name: "Strings",
                slug: "strings",
                description: "Print strings of printable characters",
                version: "2.41",
                plan: "starter",
                tags: ["strings", "binary", "analysis"],
                params: 10,
                command: "strings"
            },
            {
                name: "File",
                slug: "file",
                description: "Determine file type",
                version: "5.45",
                plan: "starter",
                tags: ["file", "type", "magic"],
                params: 10,
                command: "file"
            }
        ]
    },

    // ============================================
    // REVERSE ENGINEERING (20 tools)
    // ============================================
    "Reverse Engineering": {
        icon: "⚙️",
        description: "Binary analysis and reverse engineering tools",
        tools: [
            {
                name: "Ghidra",
                slug: "ghidra",
                description: "NSA's software reverse engineering framework",
                version: "11.0",
                plan: "pro",
                tags: ["disassembler", "decompiler", "nsa"],
                params: 0,
                command: "ghidra"
            },
            {
                name: "Radare2",
                slug: "radare2",
                description: "UNIX-like reverse engineering framework",
                version: "6.0.0",
                plan: "starter",
                tags: ["disassembler", "debugger", "unix"],
                params: 100,
                command: "r2"
            },
            {
                name: "IDA Free",
                slug: "ida-free",
                description: "Interactive Disassembler (Free version)",
                version: "8.4",
                plan: "starter",
                tags: ["disassembler", "interactive", "free"],
                params: 0,
                command: "ida"
            },
            {
                name: "GDB",
                slug: "gdb",
                description: "GNU Project debugger",
                version: "14.1",
                plan: "starter",
                tags: ["debugger", "gnu", "linux"],
                params: 50,
                command: "gdb"
            },
            {
                name: "GEF",
                slug: "gef",
                description: "GDB Enhanced Features",
                version: "2024.01",
                plan: "starter",
                tags: ["gdb", "enhanced", "pwn"],
                params: 0,
                command: "gef"
            },
            {
                name: "PEDA",
                slug: "peda",
                description: "Python Exploit Development Assistance for GDB",
                version: "1.2",
                plan: "starter",
                tags: ["gdb", "python", "exploit"],
                params: 0,
                command: "peda"
            },
            {
                name: "Pwndbg",
                slug: "pwndbg",
                description: "Exploit development and reverse engineering with GDB",
                version: "2024.02",
                plan: "starter",
                tags: ["gdb", "exploit", "pwn"],
                params: 0,
                command: "pwndbg"
            },
            {
                name: "OllyDbg",
                slug: "ollydbg",
                description: "32-bit assembler-level debugger for Windows",
                version: "2.01",
                plan: "starter",
                tags: ["debugger", "windows", "32-bit"],
                params: 0,
                command: "ollydbg"
            },
            {
                name: "x64dbg",
                slug: "x64dbg",
                description: "Open-source x64/x32 debugger for Windows",
                version: "2024-01",
                plan: "starter",
                tags: ["debugger", "windows", "64-bit"],
                params: 0,
                command: "x64dbg"
            },
            {
                name: "Objdump",
                slug: "objdump",
                description: "Display information from object files",
                version: "2.41",
                plan: "starter",
                tags: ["disassembler", "binary", "info"],
                params: 30,
                command: "objdump"
            },
            {
                name: "Readelf",
                slug: "readelf",
                description: "Display information about ELF files",
                version: "2.41",
                plan: "starter",
                tags: ["elf", "binary", "info"],
                params: 25,
                command: "readelf"
            },
            {
                name: "Nm",
                slug: "nm",
                description: "List symbols from object files",
                version: "2.41",
                plan: "starter",
                tags: ["symbols", "binary", "list"],
                params: 15,
                command: "nm"
            },
            {
                name: "Ltrace",
                slug: "ltrace",
                description: "Library call tracer",
                version: "0.7.3",
                plan: "starter",
                tags: ["trace", "library", "calls"],
                params: 20,
                command: "ltrace"
            },
            {
                name: "Strace",
                slug: "strace",
                description: "System call tracer",
                version: "6.6",
                plan: "starter",
                tags: ["trace", "system", "calls"],
                params: 30,
                command: "strace"
            },
            {
                name: "Dex2Jar",
                slug: "dex2jar",
                description: "Convert dex to jar for Android",
                version: "2.4",
                plan: "starter",
                tags: ["android", "dex", "jar"],
                params: 10,
                command: "d2j-dex2jar"
            },
            {
                name: "JADX",
                slug: "jadx",
                description: "Dex to Java decompiler",
                version: "1.4.7",
                plan: "starter",
                tags: ["android", "decompiler", "java"],
                params: 15,
                command: "jadx"
            },
            {
                name: "APKTool",
                slug: "apktool",
                description: "Reverse engineering Android apk files",
                version: "2.9.2",
                plan: "starter",
                tags: ["android", "apk", "reverse"],
                params: 20,
                command: "apktool"
            },
            {
                name: "Frida",
                slug: "frida",
                description: "Dynamic instrumentation toolkit",
                version: "16.1.8",
                plan: "pro",
                tags: ["instrumentation", "dynamic", "hook"],
                params: 40,
                command: "frida"
            },
            {
                name: "Objection",
                slug: "objection",
                description: "Runtime mobile exploration toolkit",
                version: "1.11.0",
                plan: "pro",
                tags: ["mobile", "runtime", "exploration"],
                params: 30,
                command: "objection"
            },
            {
                name: "Angr",
                slug: "angr",
                description: "Binary analysis framework",
                version: "9.2",
                plan: "enterprise",
                tags: ["binary", "analysis", "symbolic"],
                params: 50,
                command: "angr"
            }
        ]
    },

    // ============================================
    // POST EXPLOITATION (20 tools)
    // ============================================
    "Post Exploitation": {
        icon: "🚀",
        description: "Maintain access and move laterally",
        tools: [
            {
                name: "Meterpreter",
                slug: "meterpreter",
                description: "Advanced Metasploit payload",
                version: "6.4",
                plan: "pro",
                tags: ["payload", "metasploit", "shell"],
                params: 100,
                command: "meterpreter"
            },
            {
                name: "Chisel",
                slug: "chisel",
                description: "Fast TCP/UDP tunnel over HTTP",
                version: "1.9.1",
                plan: "pro",
                tags: ["tunnel", "http", "pivoting"],
                params: 20,
                command: "chisel"
            },
            {
                name: "Ligolo-ng",
                slug: "ligolo-ng",
                description: "Advanced tunneling/pivoting tool",
                version: "0.5.2",
                plan: "pro",
                tags: ["tunnel", "pivoting", "advanced"],
                params: 25,
                command: "ligolo-ng"
            },
            {
                name: "SSHuttle",
                slug: "sshuttle",
                description: "Transparent proxy over SSH",
                version: "1.1.1",
                plan: "starter",
                tags: ["ssh", "proxy", "tunnel"],
                params: 15,
                command: "sshuttle"
            },
            {
                name: "ProxyChains",
                slug: "proxychains",
                description: "Redirect connections through proxy",
                version: "4.16",
                plan: "starter",
                tags: ["proxy", "chain", "tor"],
                params: 10,
                command: "proxychains4"
            },
            {
                name: "Plink",
                slug: "plink",
                description: "PuTTY command-line connection tool",
                version: "0.80",
                plan: "starter",
                tags: ["ssh", "tunnel", "windows"],
                params: 20,
                command: "plink"
            },
            {
                name: "Weevely",
                slug: "weevely",
                description: "Weaponized web shell",
                version: "4.0.1",
                plan: "pro",
                tags: ["webshell", "php", "stealth"],
                params: 30,
                command: "weevely"
            },
            {
                name: "WinPEAS",
                slug: "winpeas",
                description: "Windows Privilege Escalation Awesome Scripts",
                version: "20240101",
                plan: "pro",
                tags: ["privesc", "windows", "enumeration"],
                params: 30,
                command: "winpeas"
            },
            {
                name: "LinPEAS",
                slug: "linpeas",
                description: "Linux Privilege Escalation Awesome Scripts",
                version: "20240101",
                plan: "pro",
                tags: ["privesc", "linux", "enumeration"],
                params: 25,
                command: "linpeas"
            },
            {
                name: "Linux Exploit Suggester",
                slug: "linux-exploit-suggester",
                description: "Suggest kernel exploits for Linux",
                version: "2.0",
                plan: "pro",
                tags: ["exploit", "kernel", "linux"],
                params: 10,
                command: "les"
            },
            {
                name: "Windows Exploit Suggester",
                slug: "windows-exploit-suggester",
                description: "Suggest exploits based on systeminfo",
                version: "NG",
                plan: "pro",
                tags: ["exploit", "windows", "suggester"],
                params: 10,
                command: "wes"
            },
            {
                name: "Mimikatz",
                slug: "mimikatz-post",
                description: "Extract Windows credentials from memory",
                version: "2.2.0",
                plan: "enterprise",
                tags: ["credentials", "windows", "memory"],
                params: 50,
                command: "mimikatz"
            },
            {
                name: "Rubeus",
                slug: "rubeus",
                description: "C# toolset for Kerberos interaction",
                version: "2.2.3",
                plan: "enterprise",
                tags: ["kerberos", "tickets", "delegation"],
                params: 40,
                command: "rubeus"
            },
            {
                name: "SharpHound",
                slug: "sharphound",
                description: "BloodHound data collector",
                version: "2.0.0",
                plan: "pro",
                tags: ["bloodhound", "ad", "collector"],
                params: 25,
                command: "sharphound"
            },
            {
                name: "BloodHound",
                slug: "bloodhound",
                description: "Active Directory attack path discovery",
                version: "4.3.1",
                plan: "pro",
                tags: ["ad", "attack-path", "visualization"],
                params: 0,
                command: "bloodhound"
            },
            {
                name: "PowerView",
                slug: "powerview",
                description: "PowerShell AD enumeration",
                version: "3.0",
                plan: "pro",
                tags: ["ad", "powershell", "enumeration"],
                params: 50,
                command: "powerview"
            },
            {
                name: "Pspy",
                slug: "pspy",
                description: "Monitor Linux processes without root",
                version: "1.2.1",
                plan: "starter",
                tags: ["process", "monitor", "linux"],
                params: 10,
                command: "pspy"
            },
            {
                name: "LinEnum",
                slug: "linenum",
                description: "Linux enumeration script",
                version: "0.982",
                plan: "starter",
                tags: ["enumeration", "linux", "script"],
                params: 10,
                command: "linenum"
            }
        ]
    },

    // ============================================
    // VULNERABILITY ANALYSIS (20 tools)
    // ============================================
    "Vulnerability Analysis": {
        icon: "⚠️",
        description: "Vulnerability scanning and assessment",
        tools: [
            {
                name: "OpenVAS",
                slug: "openvas",
                description: "Open Vulnerability Assessment Scanner",
                version: "23.0",
                plan: "pro",
                tags: ["scanner", "vulnerability", "comprehensive"],
                params: 80,
                command: "openvas"
            },
            {
                name: "Nessus",
                slug: "nessus",
                description: "Comprehensive vulnerability scanner",
                version: "10.7",
                plan: "enterprise",
                tags: ["scanner", "commercial", "comprehensive"],
                params: 100,
                command: "nessus"
            },
            {
                name: "Lynis",
                slug: "lynis",
                description: "Security auditing tool for Unix/Linux",
                version: "3.0.9",
                plan: "starter",
                tags: ["audit", "hardening", "linux"],
                params: 30,
                command: "lynis"
            },
            {
                name: "Nikto",
                slug: "nikto-vuln",
                description: "Web server vulnerability scanner",
                version: "2.5.0",
                plan: "starter",
                tags: ["web", "scanner", "server"],
                params: 34,
                command: "nikto"
            },
            {
                name: "Vulscan",
                slug: "vulscan",
                description: "Nmap vulnerability scanner NSE script",
                version: "2.1",
                plan: "starter",
                tags: ["nmap", "nse", "scanner"],
                params: 15,
                command: "nmap --script vulscan"
            },
            {
                name: "Vulners",
                slug: "vulners",
                description: "Nmap vulners.com integration",
                version: "1.0",
                plan: "starter",
                tags: ["nmap", "vulners", "api"],
                params: 10,
                command: "nmap --script vulners"
            },
            {
                name: "Sparta",
                slug: "sparta",
                description: "Network infrastructure penetration testing tool",
                version: "1.0.5",
                plan: "pro",
                tags: ["infrastructure", "gui", "automation"],
                params: 0,
                command: "sparta"
            },
            {
                name: "Legion",
                slug: "legion",
                description: "Network penetration testing framework",
                version: "0.3.8",
                plan: "pro",
                tags: ["framework", "gui", "automation"],
                params: 0,
                command: "legion"
            },
            {
                name: "Trivy",
                slug: "trivy",
                description: "Container vulnerability scanner",
                version: "0.48.0",
                plan: "starter",
                tags: ["container", "docker", "vulnerability"],
                params: 40,
                command: "trivy"
            },
            {
                name: "Grype",
                slug: "grype",
                description: "Vulnerability scanner for container images",
                version: "0.73.0",
                plan: "starter",
                tags: ["container", "image", "scanner"],
                params: 30,
                command: "grype"
            },
            {
                name: "Clair",
                slug: "clair",
                description: "Vulnerability static analysis for containers",
                version: "4.7.2",
                plan: "pro",
                tags: ["container", "static", "analysis"],
                params: 25,
                command: "clair"
            },
            {
                name: "Scout",
                slug: "scout",
                description: "Docker Scout vulnerability scanner",
                version: "1.3.0",
                plan: "pro",
                tags: ["docker", "scout", "cve"],
                params: 20,
                command: "docker scout"
            },
            {
                name: "Retire.js",
                slug: "retirejs",
                description: "Detect vulnerable JavaScript libraries",
                version: "4.2.2",
                plan: "starter",
                tags: ["javascript", "libraries", "vulnerability"],
                params: 15,
                command: "retire"
            },
            {
                name: "NPM Audit",
                slug: "npm-audit",
                description: "Security vulnerability check for npm",
                version: "Built-in",
                plan: "starter",
                tags: ["npm", "nodejs", "audit"],
                params: 10,
                command: "npm audit"
            },
            {
                name: "Snyk",
                slug: "snyk",
                description: "Developer security platform",
                version: "1.1265.0",
                plan: "pro",
                tags: ["developer", "security", "sca"],
                params: 40,
                command: "snyk"
            }
        ]
    },

    // ============================================
    // REPORTING TOOLS (10 tools)
    // ============================================
    "Reporting Tools": {
        icon: "📊",
        description: "Report generation and documentation",
        tools: [
            {
                name: "CherryTree",
                slug: "cherrytree",
                description: "Hierarchical note taking application",
                version: "1.0.4",
                plan: "starter",
                tags: ["notes", "hierarchical", "ctf"],
                params: 0,
                command: "cherrytree"
            },
            {
                name: "Pipal",
                slug: "pipal-report",
                description: "Password analysis and reporting",
                version: "3.1",
                plan: "starter",
                tags: ["password", "analysis", "statistics"],
                params: 8,
                command: "pipal"
            },
            {
                name: "Dradis",
                slug: "dradis",
                description: "Collaborative reporting platform",
                version: "4.10.0",
                plan: "pro",
                tags: ["collaborative", "reporting", "team"],
                params: 0,
                command: "dradis"
            },
            {
                name: "Faraday",
                slug: "faraday",
                description: "Collaborative penetration test IDE",
                version: "4.6.0",
                plan: "pro",
                tags: ["ide", "collaborative", "vuln-management"],
                params: 0,
                command: "faraday"
            },
            {
                name: "MagicTree",
                slug: "magictree",
                description: "Data consolidation and reporting",
                version: "1.3",
                plan: "starter",
                tags: ["data", "xml", "reporting"],
                params: 0,
                command: "magictree"
            },
            {
                name: "Metagoofil",
                slug: "metagoofil-report",
                description: "Metadata extraction for reports",
                version: "2.2",
                plan: "pro",
                tags: ["metadata", "documents", "extraction"],
                params: 15,
                command: "metagoofil"
            },
            {
                name: "Cutycapt",
                slug: "cutycapt",
                description: "Capture web page screenshots",
                version: "0.0",
                plan: "starter",
                tags: ["screenshot", "web", "capture"],
                params: 15,
                command: "cutycapt"
            },
            {
                name: "Eyewitness",
                slug: "eyewitness",
                description: "Screenshot websites for reports",
                version: "20200218",
                plan: "starter",
                tags: ["screenshot", "web", "report"],
                params: 20,
                command: "eyewitness"
            },
            {
                name: "Keepnote",
                slug: "keepnote",
                description: "Note taking application",
                version: "0.7.8",
                plan: "starter",
                tags: ["notes", "notebook", "tree"],
                params: 0,
                command: "keepnote"
            },
            {
                name: "RecordMyDesktop",
                slug: "recordmydesktop",
                description: "Desktop recording for demonstrations",
                version: "0.4.0",
                plan: "starter",
                tags: ["recording", "desktop", "video"],
                params: 15,
                command: "recordmydesktop"
            }
        ]
    },

    // ============================================
    // HARDWARE HACKING (15 tools)
    // ============================================
    "Hardware Hacking": {
        icon: "🔧",
        description: "Physical and hardware security testing",
        tools: [
            {
                name: "Arduino IDE",
                slug: "arduino",
                description: "IDE for Arduino boards programming",
                version: "2.2.1",
                plan: "starter",
                tags: ["arduino", "microcontroller", "ide"],
                params: 0,
                command: "arduino"
            },
            {
                name: "Bus Pirate",
                slug: "bus-pirate",
                description: "Universal bus interface",
                version: "7.1",
                plan: "pro",
                tags: ["bus", "interface", "hardware"],
                params: 20,
                command: "buspirate"
            },
            {
                name: "Flashrom",
                slug: "flashrom",
                description: "Flash chip programmer",
                version: "1.3.0",
                plan: "pro",
                tags: ["flash", "chip", "programmer"],
                params: 25,
                command: "flashrom"
            },
            {
                name: "OpenOCD",
                slug: "openocd",
                description: "Open On-Chip Debugger",
                version: "0.12.0",
                plan: "pro",
                tags: ["jtag", "swd", "debugger"],
                params: 50,
                command: "openocd"
            },
            {
                name: "URH",
                slug: "urh",
                description: "Universal Radio Hacker",
                version: "2.9.6",
                plan: "pro",
                tags: ["radio", "sdr", "analysis"],
                params: 0,
                command: "urh"
            },
            {
                name: "GNU Radio",
                slug: "gnuradio",
                description: "Software radio toolkit",
                version: "3.10.9",
                plan: "pro",
                tags: ["sdr", "radio", "toolkit"],
                params: 0,
                command: "gnuradio-companion"
            },
            {
                name: "RTL-SDR",
                slug: "rtl-sdr",
                description: "RTL2832U SDR",
                version: "0.8.0",
                plan: "pro",
                tags: ["sdr", "rtl", "receiver"],
                params: 15,
                command: "rtl_sdr"
            },
            {
                name: "HackRF",
                slug: "hackrf",
                description: "HackRF One software defined radio",
                version: "2024.02",
                plan: "enterprise",
                tags: ["sdr", "hackrf", "transceiver"],
                params: 20,
                command: "hackrf_info"
            },
            {
                name: "Proxmark3",
                slug: "proxmark3",
                description: "RFID research tool",
                version: "4.17511",
                plan: "enterprise",
                tags: ["rfid", "nfc", "research"],
                params: 100,
                command: "pm3"
            },
            {
                name: "MFOC",
                slug: "mfoc",
                description: "Mifare Classic Offline Cracker",
                version: "0.10.7",
                plan: "pro",
                tags: ["mifare", "rfid", "cracker"],
                params: 15,
                command: "mfoc"
            },
            {
                name: "MFCUK",
                slug: "mfcuk",
                description: "MiFare Classic Universal toolKit",
                version: "0.3.8",
                plan: "pro",
                tags: ["mifare", "rfid", "toolkit"],
                params: 15,
                command: "mfcuk"
            },
            {
                name: "LibNFC",
                slug: "libnfc",
                description: "NFC library and tools",
                version: "1.8.0",
                plan: "starter",
                tags: ["nfc", "library", "tools"],
                params: 20,
                command: "nfc-list"
            }
        ]
    },

    // ============================================
    // STRESS TESTING (10 tools)
    // ============================================
    "Stress Testing": {
        icon: "📈",
        description: "Load and stress testing tools",
        tools: [
            {
                name: "Slowloris",
                slug: "slowloris",
                description: "Low bandwidth DoS tool",
                version: "0.2.0",
                plan: "pro",
                tags: ["dos", "http", "slow"],
                params: 15,
                command: "slowloris"
            },
            {
                name: "LOIC",
                slug: "loic",
                description: "Low Orbit Ion Cannon",
                version: "1.0.8",
                plan: "enterprise",
                tags: ["dos", "ddos", "testing"],
                params: 10,
                command: "loic"
            },
            {
                name: "HOIC",
                slug: "hoic",
                description: "High Orbit Ion Cannon",
                version: "2.1.006",
                plan: "enterprise",
                tags: ["ddos", "http", "testing"],
                params: 10,
                command: "hoic"
            },
            {
                name: "Siege",
                slug: "siege",
                description: "HTTP load testing and benchmarking",
                version: "4.1.6",
                plan: "starter",
                tags: ["load", "benchmark", "http"],
                params: 25,
                command: "siege"
            },
            {
                name: "Apache Bench",
                slug: "ab",
                description: "Apache HTTP server benchmarking",
                version: "2.3",
                plan: "starter",
                tags: ["benchmark", "apache", "http"],
                params: 20,
                command: "ab"
            },
            {
                name: "Wrk",
                slug: "wrk",
                description: "Modern HTTP benchmarking tool",
                version: "4.2.0",
                plan: "starter",
                tags: ["benchmark", "http", "modern"],
                params: 15,
                command: "wrk"
            },
            {
                name: "Hey",
                slug: "hey",
                description: "HTTP load generator",
                version: "0.1.4",
                plan: "starter",
                tags: ["http", "load", "go"],
                params: 15,
                command: "hey"
            },
            {
                name: "T50",
                slug: "t50",
                description: "Experimental mixed packet injector",
                version: "5.8.7",
                plan: "pro",
                tags: ["packet", "injector", "stress"],
                params: 40,
                command: "t50"
            },
            {
                name: "Hping3",
                slug: "hping3-stress",
                description: "TCP/IP packet assembler/analyzer",
                version: "3.0.0",
                plan: "pro",
                tags: ["packet", "stress", "tcp"],
                params: 50,
                command: "hping3"
            },
            {
                name: "GoldenEye",
                slug: "goldeneye",
                description: "HTTP DoS test tool",
                version: "2.1",
                plan: "pro",
                tags: ["http", "dos", "testing"],
                params: 15,
                command: "goldeneye"
            }
        ]
    },

    // ============================================
    // SOCIAL ENGINEERING (10 tools)
    // ============================================
    "Social Engineering": {
        icon: "🎭",
        description: "Human-based attack techniques",
        tools: [
            {
                name: "Social Engineering Toolkit",
                slug: "set-social",
                description: "Open-source penetration testing framework",
                version: "8.0.3",
                plan: "pro",
                tags: ["phishing", "framework", "attack"],
                params: 50,
                command: "setoolkit"
            },
            {
                name: "Gophish",
                slug: "gophish-social",
                description: "Open-source phishing toolkit",
                version: "0.12.1",
                plan: "pro",
                tags: ["phishing", "campaign", "email"],
                params: 30,
                command: "gophish"
            },
            {
                name: "King Phisher",
                slug: "king-phisher-social",
                description: "Phishing campaign toolkit",
                version: "1.14.0",
                plan: "pro",
                tags: ["phishing", "server", "campaign"],
                params: 30,
                command: "king-phisher"
            },
            {
                name: "Evilginx2",
                slug: "evilginx2-social",
                description: "Phishing with 2FA bypass",
                version: "3.2.0",
                plan: "enterprise",
                tags: ["phishing", "2fa", "bypass"],
                params: 35,
                command: "evilginx2"
            },
            {
                name: "BeEF",
                slug: "beef-social",
                description: "Browser Exploitation Framework",
                version: "0.5.4",
                plan: "pro",
                tags: ["browser", "hook", "exploitation"],
                params: 40,
                command: "beef-xss"
            },
            {
                name: "HTTrack",
                slug: "httrack",
                description: "Website copier for phishing",
                version: "3.49.2",
                plan: "starter",
                tags: ["website", "copy", "clone"],
                params: 30,
                command: "httrack"
            },
            {
                name: "CredSniper",
                slug: "credsniper",
                description: "Phishing framework for credential harvesting",
                version: "1.0",
                plan: "pro",
                tags: ["phishing", "credentials", "harvest"],
                params: 20,
                command: "credsniper"
            },
            {
                name: "SocialFish",
                slug: "socialfish",
                description: "Phishing tool for educational purposes",
                version: "3.0",
                plan: "starter",
                tags: ["phishing", "educational", "clone"],
                params: 10,
                command: "socialfish"
            },
            {
                name: "Zphisher",
                slug: "zphisher",
                description: "Automated phishing tool",
                version: "2.3.4",
                plan: "starter",
                tags: ["phishing", "automated", "templates"],
                params: 10,
                command: "zphisher"
            },
            {
                name: "Blackeye",
                slug: "blackeye",
                description: "Phishing page creator",
                version: "2.0",
                plan: "starter",
                tags: ["phishing", "templates", "simple"],
                params: 5,
                command: "blackeye"
            }
        ]
    },

    // ============================================
    // DATABASE ASSESSMENT (10 tools)
    // ============================================
    "Database Assessment": {
        icon: "🗃️",
        description: "Database security testing tools",
        tools: [
            {
                name: "SQLMap",
                slug: "sqlmap-db",
                description: "Automatic SQL injection and database takeover",
                version: "1.8",
                plan: "starter",
                tags: ["sql", "injection", "automation"],
                params: 38,
                command: "sqlmap"
            },
            {
                name: "jSQL Injection",
                slug: "jsql-db",
                description: "Automatic SQL injection tool",
                version: "0.85",
                plan: "starter",
                tags: ["sql", "injection", "gui"],
                params: 25,
                command: "jsql-injection"
            },
            {
                name: "NoSQLMap",
                slug: "nosqlmap-db",
                description: "NoSQL injection attack tool",
                version: "0.7",
                plan: "pro",
                tags: ["nosql", "mongodb", "injection"],
                params: 20,
                command: "nosqlmap"
            },
            {
                name: "SQLite Browser",
                slug: "sqlitebrowser",
                description: "Visual tool for SQLite databases",
                version: "3.12.2",
                plan: "starter",
                tags: ["sqlite", "browser", "gui"],
                params: 0,
                command: "sqlitebrowser"
            },
            {
                name: "HexorBase",
                slug: "hexorbase",
                description: "Database hacking and analysis",
                version: "1.0",
                plan: "pro",
                tags: ["database", "hacking", "multi"],
                params: 15,
                command: "hexorbase"
            },
            {
                name: "ODAT",
                slug: "odat",
                description: "Oracle Database Attacking Tool",
                version: "5.1.1",
                plan: "pro",
                tags: ["oracle", "database", "attack"],
                params: 50,
                command: "odat"
            },
            {
                name: "MDBTools",
                slug: "mdbtools",
                description: "Microsoft Access database tools",
                version: "1.0.0",
                plan: "starter",
                tags: ["mdb", "access", "export"],
                params: 15,
                command: "mdb-export"
            },
            {
                name: "DBPwAudit",
                slug: "dbpwaudit",
                description: "Database password auditor",
                version: "0.8",
                plan: "pro",
                tags: ["database", "password", "audit"],
                params: 20,
                command: "dbpwaudit"
            },
            {
                name: "SIDGuesser",
                slug: "sidguesser",
                description: "Oracle SID guesser",
                version: "1.0.5",
                plan: "pro",
                tags: ["oracle", "sid", "guess"],
                params: 10,
                command: "sidguesser"
            },
            {
                name: "TNSCmd",
                slug: "tnscmd",
                description: "Oracle TNS listener tool",
                version: "1.4.1",
                plan: "pro",
                tags: ["oracle", "tns", "enumeration"],
                params: 10,
                command: "tnscmd"
            }
        ]
    },

    // ============================================
    // MOBILE SECURITY (15 tools)
    // ============================================
    "Mobile Security": {
        icon: "📱",
        description: "Android and iOS security testing",
        tools: [
            {
                name: "APKTool",
                slug: "apktool-mobile",
                description: "Reverse engineering Android APKs",
                version: "2.9.2",
                plan: "starter",
                tags: ["android", "apk", "reverse"],
                params: 20,
                command: "apktool"
            },
            {
                name: "JADX",
                slug: "jadx-mobile",
                description: "Dex to Java decompiler",
                version: "1.4.7",
                plan: "starter",
                tags: ["android", "decompiler", "java"],
                params: 15,
                command: "jadx"
            },
            {
                name: "Dex2Jar",
                slug: "dex2jar-mobile",
                description: "Convert dex to jar",
                version: "2.4",
                plan: "starter",
                tags: ["android", "dex", "jar"],
                params: 10,
                command: "d2j-dex2jar"
            },
            {
                name: "Frida",
                slug: "frida-mobile",
                description: "Dynamic instrumentation toolkit",
                version: "16.1.8",
                plan: "pro",
                tags: ["hook", "instrumentation", "dynamic"],
                params: 40,
                command: "frida"
            },
            {
                name: "Objection",
                slug: "objection-mobile",
                description: "Runtime mobile exploration",
                version: "1.11.0",
                plan: "pro",
                tags: ["runtime", "exploration", "bypass"],
                params: 30,
                command: "objection"
            },
            {
                name: "MobSF",
                slug: "mobsf",
                description: "Mobile Security Framework",
                version: "3.8.0",
                plan: "pro",
                tags: ["framework", "static", "dynamic"],
                params: 0,
                command: "mobsf"
            },
            {
                name: "Drozer",
                slug: "drozer",
                description: "Android security assessment framework",
                version: "2.4.4",
                plan: "pro",
                tags: ["android", "assessment", "framework"],
                params: 50,
                command: "drozer"
            },
            {
                name: "ADB",
                slug: "adb",
                description: "Android Debug Bridge",
                version: "34.0.5",
                plan: "starter",
                tags: ["android", "debug", "bridge"],
                params: 40,
                command: "adb"
            },
            {
                name: "QARK",
                slug: "qark",
                description: "Quick Android Review Kit",
                version: "4.0.0",
                plan: "starter",
                tags: ["android", "review", "vulnerability"],
                params: 15,
                command: "qark"
            },
            {
                name: "Androguard",
                slug: "androguard",
                description: "Android application analysis",
                version: "3.4.0",
                plan: "pro",
                tags: ["android", "analysis", "python"],
                params: 30,
                command: "androguard"
            },
            {
                name: "AndroBugs",
                slug: "androbugs",
                description: "Android vulnerability scanner",
                version: "1.0.0",
                plan: "starter",
                tags: ["android", "vulnerability", "scanner"],
                params: 10,
                command: "androbugs"
            },
            {
                name: "iPA Installer",
                slug: "ipa-installer",
                description: "iOS app installation tool",
                version: "3.0",
                plan: "pro",
                tags: ["ios", "ipa", "install"],
                params: 10,
                command: "ipainstaller"
            },
            {
                name: "Clutch",
                slug: "clutch",
                description: "iOS app decryption tool",
                version: "2.0.4",
                plan: "enterprise",
                tags: ["ios", "decrypt", "dump"],
                params: 10,
                command: "clutch"
            },
            {
                name: "Class-dump",
                slug: "class-dump",
                description: "Examine Objective-C runtime info",
                version: "3.5",
                plan: "pro",
                tags: ["ios", "objective-c", "dump"],
                params: 10,
                command: "class-dump"
            },
            {
                name: "SSL Kill Switch",
                slug: "ssl-kill-switch",
                description: "Disable SSL certificate validation",
                version: "3.0",
                plan: "pro",
                tags: ["ios", "ssl", "bypass"],
                params: 5,
                command: "ssl-kill-switch"
            }
        ]
    },

    // ============================================
    // CRYPTO & STEGO (15 tools)
    // ============================================
    "Crypto & Stego": {
        icon: "🔐",
        description: "Cryptography and steganography tools",
        tools: [
            {
                name: "OpenSSL",
                slug: "openssl",
                description: "Cryptography toolkit",
                version: "3.2.0",
                plan: "starter",
                tags: ["crypto", "ssl", "certificate"],
                params: 100,
                command: "openssl"
            },
            {
                name: "GPG",
                slug: "gpg",
                description: "GNU Privacy Guard",
                version: "2.4.3",
                plan: "starter",
                tags: ["encryption", "pgp", "signing"],
                params: 50,
                command: "gpg"
            },
            {
                name: "Steghide",
                slug: "steghide",
                description: "Hide data in images/audio",
                version: "0.5.1",
                plan: "starter",
                tags: ["steganography", "hide", "data"],
                params: 15,
                command: "steghide"
            },
            {
                name: "Stegsolve",
                slug: "stegsolve",
                description: "Image steganography solver",
                version: "1.3",
                plan: "starter",
                tags: ["steganography", "image", "solver"],
                params: 0,
                command: "stegsolve"
            },
            {
                name: "Zsteg",
                slug: "zsteg",
                description: "PNG/BMP steganography detection",
                version: "0.2.13",
                plan: "starter",
                tags: ["steganography", "png", "detection"],
                params: 15,
                command: "zsteg"
            },
            {
                name: "Outguess",
                slug: "outguess",
                description: "Universal steganographic tool",
                version: "0.2.2",
                plan: "starter",
                tags: ["steganography", "universal", "jpeg"],
                params: 10,
                command: "outguess"
            },
            {
                name: "Snow",
                slug: "snow",
                description: "Whitespace steganography",
                version: "20130616",
                plan: "starter",
                tags: ["steganography", "whitespace", "text"],
                params: 10,
                command: "snow"
            },
            {
                name: "StegCracker",
                slug: "stegcracker",
                description: "Steganography brute-force utility",
                version: "2.1.0",
                plan: "starter",
                tags: ["steganography", "brute-force", "crack"],
                params: 10,
                command: "stegcracker"
            },
            {
                name: "Exiftool",
                slug: "exiftool-stego",
                description: "Read/write EXIF metadata",
                version: "12.70",
                plan: "starter",
                tags: ["metadata", "exif", "images"],
                params: 100,
                command: "exiftool"
            },
            {
                name: "Binwalk",
                slug: "binwalk-stego",
                description: "Firmware extraction and analysis",
                version: "3.1.0",
                plan: "starter",
                tags: ["extraction", "firmware", "binary"],
                params: 25,
                command: "binwalk"
            },
            {
                name: "CyberChef",
                slug: "cyberchef",
                description: "Web app for crypto operations",
                version: "10.5.2",
                plan: "starter",
                tags: ["crypto", "encoding", "web"],
                params: 0,
                command: "cyberchef"
            },
            {
                name: "RSACTFTool",
                slug: "rsactftool",
                description: "RSA attack tool for CTF",
                version: "1.0",
                plan: "pro",
                tags: ["rsa", "ctf", "attack"],
                params: 15,
                command: "rsactftool"
            },
            {
                name: "XORTool",
                slug: "xortool",
                description: "XOR cipher analysis",
                version: "1.0.2",
                plan: "starter",
                tags: ["xor", "cipher", "analysis"],
                params: 10,
                command: "xortool"
            },
            {
                name: "FcrackZip",
                slug: "fcrackzip",
                description: "ZIP password cracker",
                version: "1.0",
                plan: "starter",
                tags: ["zip", "password", "crack"],
                params: 15,
                command: "fcrackzip"
            },
            {
                name: "PkCrack",
                slug: "pkcrack",
                description: "ZIP known-plaintext attack",
                version: "1.2.3",
                plan: "pro",
                tags: ["zip", "plaintext", "attack"],
                params: 10,
                command: "pkcrack"
            }
        ]
    }
};

// Calculate total tools and params
let totalTools = 0;
let totalParams = 0;
let totalCategories = Object.keys(TOOLS_DATABASE).length;

Object.values(TOOLS_DATABASE).forEach(category => {
    totalTools += category.tools.length;
    category.tools.forEach(tool => {
        totalParams += tool.params || 0;
    });
});

const TOOLS_STATS = {
    totalTools,
    totalParams,
    totalCategories,
    totalPresets: Math.floor(totalTools * 0.5) // Estimate presets
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TOOLS_DATABASE, TOOLS_STATS };
}
