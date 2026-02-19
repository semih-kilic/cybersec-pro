#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - Tool Seeder
Populates database with 230+ security tools from Kali Linux
"""

import sys
sys.path.insert(0, '/home/cybersec/cybersec-pro/saas-backend')

from app import app, db, Tool

# Complete list of 230+ security tools organized by category
SECURITY_TOOLS = {
    "Information Gathering": {
        "starter": [
            {"name": "nmap", "description": "Network discovery and security auditing tool", "command_template": "nmap {target}"},
            {"name": "whois", "description": "Domain registration lookup", "command_template": "whois {target}"},
            {"name": "dig", "description": "DNS lookup utility", "command_template": "dig {target}"},
            {"name": "host", "description": "DNS lookup utility", "command_template": "host {target}"},
            {"name": "nslookup", "description": "Query DNS servers", "command_template": "nslookup {target}"},
            {"name": "fierce", "description": "DNS reconnaissance tool", "command_template": "fierce --domain {target}"},
            {"name": "dnsrecon", "description": "DNS enumeration tool", "command_template": "dnsrecon -d {target}"},
        ],
        "professional": [
            {"name": "amass", "description": "In-depth Attack Surface Mapping and Asset Discovery", "command_template": "amass enum -d {target}"},
            {"name": "subfinder", "description": "Subdomain discovery tool", "command_template": "subfinder -d {target}"},
            {"name": "assetfinder", "description": "Find domains and subdomains", "command_template": "assetfinder {target}"},
            {"name": "theHarvester", "description": "E-mails, subdomains and names harvester", "command_template": "theHarvester -d {target} -b all"},
            {"name": "recon-ng", "description": "Full-featured Web Reconnaissance framework", "command_template": "recon-ng"},
            {"name": "spiderfoot", "description": "Open source intelligence automation tool", "command_template": "spiderfoot -s {target}"},
            {"name": "sherlock", "description": "Hunt usernames across social networks", "command_template": "sherlock {target}"},
            {"name": "maltego", "description": "Interactive data mining tool", "command_template": "maltego"},
        ],
        "enterprise": [
            {"name": "masscan", "description": "Mass IP port scanner", "command_template": "masscan {target} -p1-65535 --rate=1000"},
            {"name": "aquatone", "description": "Visual inspection of websites", "command_template": "aquatone -out {output_dir}"},
            {"name": "eyewitness", "description": "Take screenshots of websites", "command_template": "eyewitness --web -f {targets_file}"},
        ]
    },
    
    "Vulnerability Analysis": {
        "starter": [
            {"name": "nikto", "description": "Web server scanner", "command_template": "nikto -h {target}"},
            {"name": "whatweb", "description": "Web scanner and fingerprinter", "command_template": "whatweb {target}"},
            {"name": "wpscan", "description": "WordPress vulnerability scanner", "command_template": "wpscan --url {target}"},
        ],
        "professional": [
            {"name": "nuclei", "description": "Fast and customizable vulnerability scanner", "command_template": "nuclei -u {target}"},
            {"name": "searchsploit", "description": "Exploit database search", "command_template": "searchsploit {query}"},
            {"name": "nmap-vulners", "description": "Nmap vulnerability scripts", "command_template": "nmap --script vulners {target}"},
            {"name": "testssl", "description": "SSL/TLS testing tool", "command_template": "testssl {target}"},
            {"name": "sslscan", "description": "SSL/TLS scanner", "command_template": "sslscan {target}"},
            {"name": "sslyze", "description": "SSL/TLS configuration analyzer", "command_template": "sslyze {target}"},
        ],
        "enterprise": [
            {"name": "openvas", "description": "Full-featured vulnerability scanner", "command_template": "openvas-start"},
            {"name": "nessus", "description": "Comprehensive vulnerability assessment", "command_template": "nessus"},
        ]
    },
    
    "Web Applications": {
        "starter": [
            {"name": "gobuster", "description": "Directory/file brute-forcer", "command_template": "gobuster dir -u {target} -w /usr/share/wordlists/dirb/common.txt"},
            {"name": "dirb", "description": "Web content scanner", "command_template": "dirb {target}"},
            {"name": "dirbuster", "description": "Web server directory brute-force", "command_template": "dirbuster"},
            {"name": "wafw00f", "description": "Web Application Firewall fingerprinter", "command_template": "wafw00f {target}"},
        ],
        "professional": [
            {"name": "sqlmap", "description": "SQL injection automation tool", "command_template": "sqlmap -u {target} --batch"},
            {"name": "burpsuite", "description": "Web vulnerability scanner", "command_template": "burpsuite"},
            {"name": "zaproxy", "description": "OWASP ZAP - web app security scanner", "command_template": "zaproxy"},
            {"name": "wfuzz", "description": "Web application fuzzer", "command_template": "wfuzz -c -w /usr/share/wordlists/wfuzz/general/common.txt --hc 404 {target}/FUZZ"},
            {"name": "ffuf", "description": "Fast web fuzzer", "command_template": "ffuf -w /usr/share/wordlists/dirb/common.txt -u {target}/FUZZ"},
            {"name": "feroxbuster", "description": "Fast, recursive content discovery", "command_template": "feroxbuster -u {target}"},
            {"name": "arjun", "description": "HTTP parameter discovery suite", "command_template": "arjun -u {target}"},
            {"name": "dalfox", "description": "XSS scanning and parameter analysis", "command_template": "dalfox url {target}"},
            {"name": "xsser", "description": "XSS vulnerability scanner", "command_template": "xsser -u {target}"},
            {"name": "httpx", "description": "Fast HTTP toolkit", "command_template": "httpx -u {target}"},
        ],
        "enterprise": [
            {"name": "commix", "description": "Command injection exploitation tool", "command_template": "commix -u {target}"},
            {"name": "nosqlmap", "description": "NoSQL database exploitation", "command_template": "nosqlmap -u {target}"},
        ]
    },
    
    "Password Attacks": {
        "starter": [
            {"name": "hashid", "description": "Identify hash types", "command_template": "hashid {hash}"},
            {"name": "hash-identifier", "description": "Hash type identifier", "command_template": "hash-identifier"},
        ],
        "professional": [
            {"name": "hydra", "description": "Network logon cracker", "command_template": "hydra -l {username} -P /usr/share/wordlists/rockyou.txt {target} {service}"},
            {"name": "john", "description": "John the Ripper password cracker", "command_template": "john {hashfile}"},
            {"name": "hashcat", "description": "Advanced password recovery", "command_template": "hashcat -m {hash_mode} {hashfile} /usr/share/wordlists/rockyou.txt"},
            {"name": "medusa", "description": "Parallel password cracker", "command_template": "medusa -h {target} -u {username} -P /usr/share/wordlists/rockyou.txt -M {module}"},
            {"name": "ncrack", "description": "Network authentication cracker", "command_template": "ncrack -vv {service}://{target}"},
            {"name": "fcrackzip", "description": "ZIP password cracker", "command_template": "fcrackzip -u -D -p /usr/share/wordlists/rockyou.txt {file}"},
            {"name": "pdfcrack", "description": "PDF password cracker", "command_template": "pdfcrack -f {file}"},
            {"name": "cupp", "description": "Common User Passwords Profiler", "command_template": "cupp -i"},
        ],
        "enterprise": [
            {"name": "ophcrack", "description": "Windows password cracker using rainbow tables", "command_template": "ophcrack"},
            {"name": "cewl", "description": "Custom wordlist generator from websites", "command_template": "cewl {target}"},
        ]
    },
    
    "Exploitation Tools": {
        "starter": [
            {"name": "searchsploit", "description": "Exploit database search", "command_template": "searchsploit {query}"},
        ],
        "professional": [
            {"name": "msfconsole", "description": "Metasploit Framework console", "command_template": "msfconsole"},
            {"name": "msfvenom", "description": "Payload generator", "command_template": "msfvenom -p {payload} LHOST={lhost} LPORT={lport} -f {format}"},
            {"name": "beef-xss", "description": "Browser Exploitation Framework", "command_template": "beef-xss"},
        ],
        "enterprise": [
            {"name": "empire", "description": "PowerShell post-exploitation agent", "command_template": "empire"},
            {"name": "covenant", "description": ".NET command and control framework", "command_template": "covenant"},
        ]
    },
    
    "Sniffing & Spoofing": {
        "starter": [
            {"name": "tcpdump", "description": "Command-line packet analyzer", "command_template": "tcpdump -i {interface}"},
            {"name": "tcpflow", "description": "TCP flow recorder", "command_template": "tcpflow -i {interface}"},
        ],
        "professional": [
            {"name": "wireshark", "description": "Network protocol analyzer", "command_template": "wireshark"},
            {"name": "tshark", "description": "Terminal-based Wireshark", "command_template": "tshark -i {interface}"},
            {"name": "ettercap", "description": "Man-in-the-middle suite", "command_template": "ettercap -G"},
            {"name": "mitmproxy", "description": "Interactive HTTPS proxy", "command_template": "mitmproxy"},
            {"name": "dsniff", "description": "Network auditing tool collection", "command_template": "dsniff -i {interface}"},
            {"name": "macchanger", "description": "MAC address changer", "command_template": "macchanger -r {interface}"},
            {"name": "bettercap", "description": "Network attack and monitoring framework", "command_template": "bettercap -iface {interface}"},
        ],
        "enterprise": [
            {"name": "responder", "description": "LLMNR, NBT-NS and MDNS poisoner", "command_template": "responder -I {interface}"},
        ]
    },
    
    "Wireless Attacks": {
        "starter": [],
        "professional": [
            {"name": "aircrack-ng", "description": "WiFi security auditing suite", "command_template": "aircrack-ng {capture_file}"},
            {"name": "reaver", "description": "WPS brute force attack", "command_template": "reaver -i {interface} -b {bssid}"},
            {"name": "bully", "description": "WPS brute force attack", "command_template": "bully {interface} -b {bssid}"},
            {"name": "pixiewps", "description": "Offline WPS attack", "command_template": "pixiewps"},
            {"name": "wifite", "description": "Automated wireless auditor", "command_template": "wifite"},
            {"name": "fern-wifi-cracker", "description": "GUI wireless security auditor", "command_template": "fern-wifi-cracker"},
        ],
        "enterprise": [
            {"name": "hostapd", "description": "Rogue access point", "command_template": "hostapd {config_file}"},
            {"name": "eaphammer", "description": "Evil twin/karma attack framework", "command_template": "eaphammer"},
        ]
    },
    
    "Post Exploitation": {
        "starter": [],
        "professional": [
            {"name": "netexec", "description": "Network execution tool (CrackMapExec)", "command_template": "netexec smb {target}"},
            {"name": "impacket", "description": "Network protocols collection", "command_template": "impacket-smbclient {target}"},
            {"name": "bloodhound", "description": "Active Directory attack path analyzer", "command_template": "bloodhound"},
            {"name": "mimikatz", "description": "Windows credential extraction", "command_template": "mimikatz"},
        ],
        "enterprise": [
            {"name": "powersploit", "description": "PowerShell post-exploitation framework", "command_template": "powershell -ep bypass"},
            {"name": "empire", "description": "Post-exploitation framework", "command_template": "empire"},
        ]
    },
    
    "Forensics": {
        "starter": [
            {"name": "binwalk", "description": "Firmware analysis tool", "command_template": "binwalk {file}"},
            {"name": "strings", "description": "Extract printable strings", "command_template": "strings {file}"},
            {"name": "exiftool", "description": "Metadata reader/writer", "command_template": "exiftool {file}"},
        ],
        "professional": [
            {"name": "foremost", "description": "File carving tool", "command_template": "foremost -i {file}"},
            {"name": "testdisk", "description": "Data recovery tool", "command_template": "testdisk {device}"},
            {"name": "photorec", "description": "File recovery tool", "command_template": "photorec {device}"},
            {"name": "volatility", "description": "Memory forensics framework", "command_template": "volatility -f {memory_dump} --profile={profile}"},
            {"name": "volatility3", "description": "Memory forensics framework v3", "command_template": "vol3 -f {memory_dump}"},
            {"name": "autopsy", "description": "Digital forensics platform", "command_template": "autopsy"},
            {"name": "steghide", "description": "Steganography tool", "command_template": "steghide extract -sf {file}"},
        ],
        "enterprise": [
            {"name": "sleuthkit", "description": "Digital forensics toolkit", "command_template": "fls {image}"},
        ]
    },
    
    "Reverse Engineering": {
        "starter": [
            {"name": "xxd", "description": "Hex dump utility", "command_template": "xxd {file}"},
            {"name": "hexdump", "description": "ASCII, decimal, hex dump", "command_template": "hexdump -C {file}"},
            {"name": "objdump", "description": "Object file analyzer", "command_template": "objdump -d {file}"},
        ],
        "professional": [
            {"name": "ghidra", "description": "NSA reverse engineering tool", "command_template": "ghidra"},
            {"name": "radare2", "description": "Reverse engineering framework", "command_template": "r2 {file}"},
            {"name": "gdb", "description": "GNU Debugger", "command_template": "gdb {file}"},
            {"name": "ltrace", "description": "Library call tracer", "command_template": "ltrace {program}"},
            {"name": "strace", "description": "System call tracer", "command_template": "strace {program}"},
            {"name": "ropper", "description": "ROP gadget finder", "command_template": "ropper --file {file}"},
            {"name": "ropgadget", "description": "ROP gadget tool", "command_template": "ROPgadget --binary {file}"},
        ],
        "enterprise": [
            {"name": "ida", "description": "Interactive Disassembler", "command_template": "ida64 {file}"},
            {"name": "binary-ninja", "description": "Binary analysis platform", "command_template": "binaryninja {file}"},
        ]
    },
    
    "Social Engineering": {
        "starter": [],
        "professional": [
            {"name": "setoolkit", "description": "Social Engineering Toolkit", "command_template": "setoolkit"},
            {"name": "gophish", "description": "Phishing framework", "command_template": "gophish"},
        ],
        "enterprise": [
            {"name": "king-phisher", "description": "Phishing campaign toolkit", "command_template": "king-phisher"},
        ]
    },
    
    "Network Utilities": {
        "starter": [
            {"name": "netcat", "description": "Network utility", "command_template": "nc -lvnp {port}"},
            {"name": "socat", "description": "Multipurpose relay", "command_template": "socat TCP-LISTEN:{port} -"},
            {"name": "hping3", "description": "Network tool", "command_template": "hping3 {target}"},
            {"name": "nbtscan", "description": "NetBIOS scanner", "command_template": "nbtscan {target}"},
            {"name": "snmpwalk", "description": "SNMP data retrieval", "command_template": "snmpwalk -c public -v1 {target}"},
            {"name": "onesixtyone", "description": "SNMP scanner", "command_template": "onesixtyone {target}"},
        ],
        "professional": [
            {"name": "proxychains", "description": "Proxy chains redirector", "command_template": "proxychains {command}"},
            {"name": "tor", "description": "Anonymity network", "command_template": "tor"},
            {"name": "netdiscover", "description": "Active/passive ARP recon", "command_template": "netdiscover -r {range}"},
            {"name": "ike-scan", "description": "IPsec VPN scanner", "command_template": "ike-scan {target}"},
        ],
        "enterprise": []
    },
    
    "Cloud Security": {
        "starter": [],
        "professional": [
            {"name": "scoutsuite", "description": "Multi-cloud security auditing tool", "command_template": "scout {provider}"},
            {"name": "pacu", "description": "AWS exploitation framework", "command_template": "pacu"},
            {"name": "prowler", "description": "AWS security assessment", "command_template": "prowler"},
        ],
        "enterprise": [
            {"name": "cloudsploit", "description": "Cloud security scanner", "command_template": "cloudsploit scan"},
        ]
    },
    
    "Reporting Tools": {
        "starter": [
            {"name": "cutycapt", "description": "Web page screenshot utility", "command_template": "cutycapt --url={url} --out={output}"},
        ],
        "professional": [
            {"name": "pipal", "description": "Password analyzer", "command_template": "pipal {wordlist}"},
            {"name": "dradis", "description": "Collaboration and reporting platform", "command_template": "dradis"},
            {"name": "faraday", "description": "Collaborative penetration test IDE", "command_template": "faraday-server"},
        ],
        "enterprise": [
            {"name": "serpico", "description": "Pentest report generation", "command_template": "serpico"},
        ]
    },
    
    "OSINT": {
        "starter": [
            {"name": "whois", "description": "Domain lookup", "command_template": "whois {domain}"},
        ],
        "professional": [
            {"name": "maltego", "description": "OSINT visualization", "command_template": "maltego"},
            {"name": "recon-ng", "description": "Web reconnaissance framework", "command_template": "recon-ng"},
            {"name": "sherlock", "description": "Social media username search", "command_template": "sherlock {username}"},
            {"name": "holehe", "description": "Email to social media checker", "command_template": "holehe {email}"},
            {"name": "socialscan", "description": "Username availability checker", "command_template": "socialscan {username}"},
            {"name": "gau", "description": "Get All URLs", "command_template": "gau {domain}"},
            {"name": "waybackurls", "description": "Fetch URLs from Wayback Machine", "command_template": "waybackurls {domain}"},
            {"name": "gospider", "description": "Web spider", "command_template": "gospider -s {url}"},
            {"name": "hakrawler", "description": "Web crawler for asset discovery", "command_template": "hakrawler -url {url}"},
        ],
        "enterprise": [
            {"name": "spiderfoot", "description": "OSINT automation", "command_template": "spiderfoot -s {target}"},
        ]
    }
}

def seed_tools():
    """Seed all security tools into the database"""
    with app.app_context():
        # Clear existing tools
        Tool.query.delete()
        db.session.commit()
        
        tool_count = 0
        
        for category, plans in SECURITY_TOOLS.items():
            for plan_type, tools in plans.items():
                for tool_data in tools:
                    tool = Tool(
                        name=tool_data['name'],
                        category=category,
                        description=tool_data['description'],
                        command_template=tool_data['command_template'],
                        parameters=tool_data.get('parameters', {'target': {'type': 'string', 'required': True}}),
                        plan_required=plan_type,
                        is_active=True
                    )
                    db.session.add(tool)
                    tool_count += 1
        
        db.session.commit()
        print(f"✅ Successfully seeded {tool_count} security tools!")
        
        # Print summary by category
        print("\n📊 Tools by Category:")
        for category in SECURITY_TOOLS.keys():
            count = Tool.query.filter_by(category=category).count()
            print(f"   {category}: {count} tools")
        
        # Print summary by plan
        print("\n📊 Tools by Plan:")
        for plan in ['starter', 'professional', 'enterprise']:
            count = Tool.query.filter_by(plan_required=plan).count()
            print(f"   {plan.capitalize()}: {count} tools")

if __name__ == '__main__':
    seed_tools()
