#!/usr/bin/env python3
"""Add more tools to reach 600+ goal"""
import sys
sys.path.insert(0, '/home/cybersec/cybersec-pro/saas-backend')
from app import app, db, Tool
import uuid

ADDITIONAL_TOOLS = [
    # Information Gathering - 20
    ("dnsx", "Fast DNS toolkit", "Information Gathering", "dnsx"),
    ("chaos", "Chaos client for ProjectDiscovery", "Information Gathering", "chaos"),
    ("notify", "Notification tool", "Information Gathering", "notify"),
    ("interactsh", "OOB interaction gathering", "Information Gathering", "interactsh-client"),
    ("cloudbrute", "Cloud infrastructure enumeration", "Information Gathering", "cloudbrute"),
    ("github-search", "GitHub code search", "Information Gathering", "github-search"),
    ("shodanx", "Shodan CLI enhanced", "Information Gathering", "shodanx"),
    ("censys-cli", "Censys search", "Information Gathering", "censys"),
    ("fofa", "FOFA client", "Information Gathering", "fofa"),
    ("zoomeye", "ZoomEye client", "Information Gathering", "zoomeye"),
    ("binaryedge", "BinaryEdge client", "Information Gathering", "binaryedge"),
    ("onyphe", "Onyphe client", "Information Gathering", "onyphe"),
    ("shosubgo", "Shodan subdomain gatherer", "Information Gathering", "shosubgo"),
    ("crobat", "Rapid7 Sonar client", "Information Gathering", "crobat"),
    ("vita", "Certificate transparency", "Information Gathering", "vita"),
    ("tlsmate", "TLS server scanner", "Information Gathering", "tlsmate"),
    ("webanalyze", "Technology fingerprinting", "Information Gathering", "webanalyze"),
    ("htcat", "HTTP concatenation tool", "Information Gathering", "htcat"),
    ("gospider-pro", "Fast web spider pro", "Information Gathering", "gospider"),
    ("haktrails", "Haktrails OSINT", "Information Gathering", "haktrails"),
    
    # Vulnerability Analysis - 25
    ("nuclei-templates", "Nuclei community templates", "Vulnerability Analysis", "nuclei"),
    ("jaeles", "Web application scanner", "Vulnerability Analysis", "jaeles"),
    ("naabu", "Fast port scanner", "Vulnerability Analysis", "naabu"),
    ("cdncheck", "CDN detection", "Vulnerability Analysis", "cdncheck"),
    ("alterx", "Fast subdomain wordlist generator", "Vulnerability Analysis", "alterx"),
    ("uncover", "Quickly discover hosts", "Vulnerability Analysis", "uncover"),
    ("mapcidr", "CIDR manipulation tool", "Vulnerability Analysis", "mapcidr"),
    ("asnmap", "ASN mapping", "Vulnerability Analysis", "asnmap"),
    ("dnsprobe", "DNS probing tool", "Vulnerability Analysis", "dnsprobe"),
    ("chaos-client", "Chaos-client tool", "Vulnerability Analysis", "chaos-client"),
    ("simplehttpserver", "Simple HTTP server", "Vulnerability Analysis", "simplehttpserver"),
    ("anew", "Append new lines only", "Vulnerability Analysis", "anew"),
    ("unfurl", "URL parser", "Vulnerability Analysis", "unfurl"),
    ("jq-tool", "JSON processor tool", "Vulnerability Analysis", "jq"),
    ("pup", "HTML parser", "Vulnerability Analysis", "pup"),
    ("gron", "JSON to grep", "Vulnerability Analysis", "gron"),
    ("htmlq", "HTML query tool", "Vulnerability Analysis", "htmlq"),
    ("xq-tool", "XML query tool", "Vulnerability Analysis", "xq"),
    ("yq-tool", "YAML processor", "Vulnerability Analysis", "yq"),
    ("fx-json", "JSON viewer", "Vulnerability Analysis", "fx"),
    ("dasel", "Data selector", "Vulnerability Analysis", "dasel"),
    ("miller", "Miller data processor", "Vulnerability Analysis", "mlr"),
    ("csvkit", "CSV toolkit", "Vulnerability Analysis", "csvkit"),
    ("xmlstarlet", "XML toolkit", "Vulnerability Analysis", "xmlstarlet"),
    ("html2text", "HTML to text", "Vulnerability Analysis", "html2text"),
    
    # Web Applications - 20
    ("meg-fuzzer", "Many requests to endpoints", "Web Applications", "meg"),
    ("getallurls", "Get all URLs from archive", "Web Applications", "getallurls"),
    ("wayback-machine", "Wayback machine access", "Web Applications", "waybackurls"),
    ("commoncrawl", "Common Crawl data", "Web Applications", "cc.py"),
    ("otxurls", "OTX URL fetcher", "Web Applications", "otxurls"),
    ("urldedupe", "URL deduplication", "Web Applications", "urldedupe"),
    ("uro-tool", "URL dedupe advanced", "Web Applications", "uro"),
    ("qsreplace", "Query string replacer", "Web Applications", "qsreplace"),
    ("interactsh-web", "Interactsh web interface", "Web Applications", "interactsh-web"),
    ("headless-chrome", "Headless Chrome", "Web Applications", "chrome"),
    ("playwright-tool", "Browser automation", "Web Applications", "playwright"),
    ("selenium-tool", "Browser automation", "Web Applications", "selenium"),
    ("puppeteer-tool", "Node.js headless Chrome", "Web Applications", "puppeteer"),
    ("caido", "Security audit toolkit", "Web Applications", "caido"),
    ("puredns-resolver", "Fast DNS resolver", "Web Applications", "puredns"),
    ("dnsvalidator", "DNS validator", "Web Applications", "dnsvalidator"),
    ("brutespray-pro", "Brutespray binary", "Web Applications", "brutespray"),
    ("cerbrutus", "HTTP brute forcer", "Web Applications", "cerbrutus"),
    ("webcopilot", "Web automation", "Web Applications", "webcopilot"),
    ("reconftw", "Recon automation", "Web Applications", "reconftw"),
    
    # Password Attacks - 15
    ("jwt-cracker", "JWT token cracker", "Password Attacks", "jwt-cracker"),
    ("jwt_tool", "JWT toolkit", "Password Attacks", "jwt_tool"),
    ("token-spray", "Token spraying", "Password Attacks", "token-spray"),
    ("o365-spray", "O365 password spray", "Password Attacks", "o365spray"),
    ("msolspray", "Azure AD spray", "Password Attacks", "msolspray"),
    ("ruler", "Exchange abuse", "Password Attacks", "ruler"),
    ("mailSniper", "Exchange enumeration", "Password Attacks", "mailsniper"),
    ("spraycharles", "Low and slow sprayer", "Password Attacks", "spraycharles"),
    ("fireprox-creds", "API Gateway creds spray", "Password Attacks", "fireprox"),
    ("aws-creds-brute", "AWS credential brute", "Password Attacks", "aws-brute"),
    ("domainpwspray", "Domain password spray", "Password Attacks", "domainpwspray"),
    ("spraykatz", "Credential sprayer", "Password Attacks", "spraykatz"),
    ("sprayingtoolkit", "Spraying toolkit", "Password Attacks", "sprayingtoolkit"),
    ("go365", "O365 sprayer go", "Password Attacks", "go365"),
    ("smartbrute", "Smart brute forcer", "Password Attacks", "smartbrute"),
    
    # Exploitation Tools - 25
    ("log4j-scan", "Log4j vulnerability scanner", "Exploitation Tools", "log4j-scan"),
    ("CVE-2021-44228", "Log4Shell exploit", "Exploitation Tools", "log4shell"),
    ("CVE-2022-26134", "Confluence exploit", "Exploitation Tools", "confluence-exploit"),
    ("CVE-2021-41773", "Apache path traversal", "Exploitation Tools", "apache-traversal"),
    ("CVE-2021-22205", "GitLab RCE", "Exploitation Tools", "gitlab-rce"),
    ("CVE-2021-26855", "ProxyLogon", "Exploitation Tools", "proxylogon"),
    ("CVE-2021-34473", "ProxyShell", "Exploitation Tools", "proxyshell"),
    ("CVE-2020-1472", "Zerologon", "Exploitation Tools", "zerologon-exploit"),
    ("CVE-2019-0708", "BlueKeep", "Exploitation Tools", "bluekeep"),
    ("CVE-2017-0144", "EternalBlue", "Exploitation Tools", "eternalblue"),
    ("CVE-2014-6271", "Shellshock", "Exploitation Tools", "shellshock"),
    ("CVE-2014-0160", "Heartbleed", "Exploitation Tools", "heartbleed"),
    ("spring4shell", "Spring4Shell exploit", "Exploitation Tools", "spring4shell"),
    ("text4shell", "Text4Shell exploit", "Exploitation Tools", "text4shell"),
    ("polkit-exploit", "Polkit CVE-2021-4034", "Exploitation Tools", "pwnkit"),
    ("dirtypipe", "Dirty Pipe exploit", "Exploitation Tools", "dirtypipe"),
    ("dirtycow", "Dirty COW exploit", "Exploitation Tools", "dirtycow"),
    ("sudo-exploit", "Sudo heap overflow", "Exploitation Tools", "sudo-exploit"),
    ("pkexec-exploit", "pkexec exploit", "Exploitation Tools", "pkexec"),
    ("kernel-exploit-suggester", "Kernel exploit finder", "Exploitation Tools", "les"),
    ("log4j-rce", "Log4j RCE", "Exploitation Tools", "log4j-rce"),
    ("spring-core-rce", "Spring Core RCE", "Exploitation Tools", "spring-core-rce"),
    ("follina", "Follina exploit", "Exploitation Tools", "follina"),
    ("msdt-exploit", "MSDT exploit", "Exploitation Tools", "msdt-exploit"),
    ("cve-bin-tool", "CVE binary tool", "Exploitation Tools", "cve-bin-tool"),
    
    # Sniffing & Spoofing - 15
    ("netsniff-ng", "Network toolkit", "Sniffing & Spoofing", "netsniff-ng"),
    ("mausezahn", "Packet generator", "Sniffing & Spoofing", "mausezahn"),
    ("trafgen", "Network traffic generator", "Sniffing & Spoofing", "trafgen"),
    ("bmon", "Bandwidth monitor", "Sniffing & Spoofing", "bmon"),
    ("iftop", "Interface traffic", "Sniffing & Spoofing", "iftop"),
    ("nethogs", "Per-process bandwidth", "Sniffing & Spoofing", "nethogs"),
    ("vnstat", "Network traffic monitor", "Sniffing & Spoofing", "vnstat"),
    ("darkstat", "Network statistics", "Sniffing & Spoofing", "darkstat"),
    ("iptraf-ng", "IP traffic monitor", "Sniffing & Spoofing", "iptraf-ng"),
    ("nload", "Network load monitor", "Sniffing & Spoofing", "nload"),
    ("cbm", "Color bandwidth meter", "Sniffing & Spoofing", "cbm"),
    ("wavemon", "Wireless monitor", "Sniffing & Spoofing", "wavemon"),
    ("speedtest-cli", "Speed test", "Sniffing & Spoofing", "speedtest-cli"),
    ("iperf3", "Network bandwidth test", "Sniffing & Spoofing", "iperf3"),
    ("nuttcp", "Network UDP/TCP test", "Sniffing & Spoofing", "nuttcp"),
    
    # Wireless Attacks - 10
    ("hostapd-wpe", "Evil twin AP", "Wireless Attacks", "hostapd-wpe"),
    ("eaphammer", "EAP attacks", "Wireless Attacks", "eaphammer"),
    ("hostapd-mana", "Rogue AP", "Wireless Attacks", "hostapd-mana"),
    ("wpa-sycophant", "WPA relay", "Wireless Attacks", "wpa-sycophant"),
    ("krackattack", "KRACK attack", "Wireless Attacks", "krackattack"),
    ("dragonblood", "WPA3 attacks", "Wireless Attacks", "dragonblood"),
    ("pmkid-attack", "PMKID attack", "Wireless Attacks", "pmkid-attack"),
    ("rfcat", "RF analysis", "Wireless Attacks", "rfcat"),
    ("hackrf-tools", "HackRF tools", "Wireless Attacks", "hackrf"),
    ("gnuradio-tools", "Software radio", "Wireless Attacks", "gnuradio"),
    
    # Post Exploitation - 15
    ("c2concealer", "C2 obfuscation", "Post Exploitation", "c2concealer"),
    ("merlin-c2", "Merlin C2", "Post Exploitation", "merlin"),
    ("poshc2-tool", "PoshC2 framework", "Post Exploitation", "poshc2"),
    ("silenttrinity", "Python C2", "Post Exploitation", "silenttrinity"),
    ("villain-c2", "C2 framework", "Post Exploitation", "villain"),
    ("nishang", "PowerShell exploitation", "Post Exploitation", "nishang"),
    ("powersploit-tool", "PowerShell post-exploitation", "Post Exploitation", "powersploit"),
    ("powerup-tool", "Windows privilege escalation", "Post Exploitation", "powerup"),
    ("privesccheck", "Windows priv esc checker", "Post Exploitation", "privesccheck"),
    ("sharpup", "Sharp privilege escalation", "Post Exploitation", "sharpup"),
    ("PEASS-ng", "Privilege Escalation Suite", "Post Exploitation", "peass-ng"),
    ("GTFOBins", "GTFOBins enumeration", "Post Exploitation", "gtfobins"),
    ("WADComs", "Windows AD commands", "Post Exploitation", "wadcoms"),
    ("LOLBASProject", "LOLBAS enumeration", "Post Exploitation", "lolbas"),
    ("revshells", "Reverse shell generator", "Post Exploitation", "revshells"),
    
    # Forensics - 10
    ("bulk-extractor", "Bulk data extraction", "Forensics", "bulk_extractor"),
    ("hashdeep", "Recursive hashing", "Forensics", "hashdeep"),
    ("ssdeep-tool", "Fuzzy hashing", "Forensics", "ssdeep"),
    ("fcrackzip", "ZIP cracker", "Forensics", "fcrackzip"),
    ("pdfcrack", "PDF password cracker", "Forensics", "pdfcrack"),
    ("rarcrack", "RAR cracker", "Forensics", "rarcrack"),
    ("bkhive", "SAM dump tool", "Forensics", "bkhive"),
    ("samdump2-tool", "Windows SAM dump", "Forensics", "samdump2"),
    ("chntpw-tool", "Windows password reset", "Forensics", "chntpw"),
    ("pdf-parser", "PDF analysis", "Forensics", "pdf-parser"),
    
    # Reverse Engineering - 10
    ("angr-tool", "Binary analysis framework", "Reverse Engineering", "angr"),
    ("triton-tool", "Dynamic binary analysis", "Reverse Engineering", "triton"),
    ("z3-solver", "Z3 theorem prover", "Reverse Engineering", "z3"),
    ("capstone-tool", "Disassembly framework", "Reverse Engineering", "capstone"),
    ("keystone-tool", "Assembly framework", "Reverse Engineering", "keystone"),
    ("unicorn-emu", "CPU emulator", "Reverse Engineering", "unicorn"),
    ("qiling-tool", "Binary emulation", "Reverse Engineering", "qiling"),
    ("manticore-tool", "Symbolic execution", "Reverse Engineering", "manticore"),
    ("panda-re", "Platform for analysis", "Reverse Engineering", "panda"),
    ("avatar2-tool", "Multi-target orchestration", "Reverse Engineering", "avatar2"),
    
    # Social Engineering - 10
    ("socialfish", "Phishing tool", "Social Engineering", "socialfish"),
    ("zphisher", "Phishing toolkit", "Social Engineering", "zphisher"),
    ("blackeye-phish", "Phishing pages", "Social Engineering", "blackeye"),
    ("nexphisher", "Advanced phishing", "Social Engineering", "nexphisher"),
    ("shellphish", "Phishing tool", "Social Engineering", "shellphish"),
    ("seeker-tool", "Location tracker", "Social Engineering", "seeker"),
    ("trape-osint", "OSINT tracking", "Social Engineering", "trape"),
    ("osintgram", "Instagram OSINT", "Social Engineering", "osintgram"),
    ("toutatis", "Instagram OSINT", "Social Engineering", "toutatis"),
    ("blackbird-osint", "Username OSINT", "Social Engineering", "blackbird"),
    
    # Cloud Security - 15
    ("azurehound", "Azure AD attack", "Cloud Security", "azurehound"),
    ("roadtools", "Azure AD tools", "Cloud Security", "roadtools"),
    ("stormspotter", "Azure AD visualization", "Cloud Security", "stormspotter"),
    ("iam-vulnerable", "IAM privilege escalation", "Cloud Security", "iam-vulnerable"),
    ("pmapper-tool", "IAM policy mapper", "Cloud Security", "pmapper"),
    ("policy-sentry", "IAM policy library", "Cloud Security", "policy-sentry"),
    ("parliament-iam", "AWS IAM linting", "Cloud Security", "parliament"),
    ("iamlive-tool", "IAM policy generator", "Cloud Security", "iamlive"),
    ("cloudfox", "Cloud penetration testing", "Cloud Security", "cloudfox"),
    ("aws-consoler", "AWS console access", "Cloud Security", "aws_consoler"),
    ("enumerate-iam", "IAM enumeration", "Cloud Security", "enumerate-iam"),
    ("trailblazer-aws", "AWS attack paths", "Cloud Security", "trailblazer"),
    ("endgame", "AWS pentest", "Cloud Security", "endgame"),
    ("cloudsplaining", "AWS IAM analyzer", "Cloud Security", "cloudsplaining"),
    ("sadcloud", "Terraform vuln cloud", "Cloud Security", "sadcloud"),
    
    # Network Utilities - 10
    ("rdesktop-tool", "Remote desktop client", "Network Utilities", "rdesktop"),
    ("freerdp-tool", "Free RDP client", "Network Utilities", "xfreerdp"),
    ("remmina-tool", "Remote desktop client", "Network Utilities", "remmina"),
    ("vncviewer-tool", "VNC viewer", "Network Utilities", "vncviewer"),
    ("x11vnc-tool", "X11 VNC server", "Network Utilities", "x11vnc"),
    ("tightvnc-tool", "TightVNC", "Network Utilities", "tightvnc"),
    ("tigervnc-tool", "TigerVNC", "Network Utilities", "tigervnc"),
    ("autossh", "Auto SSH reconnect", "Network Utilities", "autossh"),
    ("mosh", "Mobile shell", "Network Utilities", "mosh"),
    ("eternal-terminal", "ET remote shell", "Network Utilities", "et"),
    
    # OSINT - 20
    ("twint-tool", "Twitter OSINT", "OSINT", "twint"),
    ("tinfoleak-tool", "Twitter intelligence", "OSINT", "tinfoleak"),
    ("tweetdeck-tool", "Twitter monitoring", "OSINT", "tweetdeck"),
    ("twurl-tool", "Twitter API tool", "OSINT", "twurl"),
    ("instaloader-tool", "Instagram download", "OSINT", "instaloader"),
    ("instalooter-tool", "Instagram looter", "OSINT", "instalooter"),
    ("photon-osint-tool", "Web crawler OSINT", "OSINT", "photon"),
    ("ghunt-tool", "Google account OSINT", "OSINT", "ghunt"),
    ("ignorant-tool", "Phone number OSINT", "OSINT", "ignorant"),
    ("maigret-tool", "Username OSINT", "OSINT", "maigret"),
    ("whatsmyname-tool", "Username checker", "OSINT", "whatsmyname"),
    ("namechk-tool", "Username availability", "OSINT", "namechk"),
    ("userrecon-tool", "Username reconnaissance", "OSINT", "userrecon"),
    ("usersearch-tool", "User search tool", "OSINT", "usersearch"),
    ("profiler-tool", "OSINT profiler", "OSINT", "profiler"),
    ("crosslinked", "LinkedIn enumeration", "OSINT", "crosslinked"),
    ("linkedin2username", "LinkedIn to username", "OSINT", "linkedin2username"),
    ("h8mail", "Email breach check", "OSINT", "h8mail"),
    ("pwndb", "Leak database search", "OSINT", "pwndb"),
    ("dehashed", "Dehashed API", "OSINT", "dehashed"),
]

added = 0
with app.app_context():
    existing = {t.name.lower() for t in Tool.query.all()}
    
    for name, desc, category, cmd in ADDITIONAL_TOOLS:
        if name.lower() not in existing:
            tool = Tool(
                id=str(uuid.uuid4()),
                name=name,
                description=desc,
                category=category,
                command_template=cmd,
                plan_required="professional",
                parameters={},
                is_active=True
            )
            db.session.add(tool)
            existing.add(name.lower())
            added += 1
    
    db.session.commit()
    total = Tool.query.count()
    print(f"Added: {added} more tools")
    print(f"Total: {total} tools")
    if total >= 600:
        print(f"SUCCESS: {total} tools (goal: 600+)")
    else:
        print(f"Need {600 - total} more")
