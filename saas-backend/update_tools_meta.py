#!/usr/bin/env python3
"""Update all 682 tools with tool_type, hardware_required, gui_required metadata."""
import sys, json
sys.path.insert(0, '/home/cybersec/cybersec-pro/saas-backend')
from app import app, db, Tool

# Tool classifications: {name: (type, [hardware], gui_required)}
TOOLS = {
    # === INFORMATION GATHERING - CLI ===
    "nmap": ("cli", [], False), "masscan": ("cli", [], False), "whois": ("cli", [], False),
    "dig": ("cli", [], False), "host": ("cli", [], False), "nslookup": ("cli", [], False),
    "fierce": ("cli", [], False), "dnsrecon": ("cli", [], False), "dnsenum": ("cli", [], False),
    "dnsmap": ("cli", [], False), "dnstracer": ("cli", [], False), "theharvester": ("cli", [], False),
    "amass": ("cli", [], False), "subfinder": ("cli", [], False), "sublist3r": ("cli", [], False),
    "assetfinder": ("cli", [], False), "dmitry": ("cli", [], False), "enum4linux": ("cli", [], False),
    "enum4linux-ng": ("cli", [], False), "nbtscan": ("cli", [], False), "smbclient": ("cli", [], False),
    "smbmap": ("cli", [], False), "rpcclient": ("cli", [], False), "snmpwalk": ("cli", [], False),
    "snmp-check": ("cli", [], False), "onesixtyone": ("cli", [], False), "whatweb": ("cli", [], False),
    "wafw00f": ("cli", [], False), "sslscan": ("cli", [], False), "sslyze": ("cli", [], False),
    "testssl.sh": ("cli", [], False), "arp-scan": ("cli", [], False), "arping": ("cli", [], False),
    "netdiscover": ("cli", [], False), "p0f": ("cli", [], False), "hping3": ("cli", [], False),
    "fping": ("cli", [], False), "unicornscan": ("cli", [], False), "amap": ("cli", [], False),
    "lbd": ("cli", [], False), "recon-ng": ("cli", [], False), "shodan": ("cli", [], False),
    "censys": ("cli", [], False), "traceroute": ("cli", [], False), "mtr": ("cli", [], False),
    "ping": ("cli", [], False), "httprobe": ("cli", [], False), "httpx": ("cli", [], False),
    "nuclei": ("cli", [], False), "eyewitness": ("cli", [], False), "metagoofil": ("cli", [], False),
    "exiftool": ("cli", [], False), "smtp-user-enum": ("cli", [], False), "swaks": ("cli", [], False),
    "ike-scan": ("cli", [], False), "xprobe2": ("cli", [], False),
    # Info Gathering - GUI/Service
    "maltego": ("gui", [], True), "zenmap": ("gui", [], True),
    "spiderfoot": ("service", [], True), "ntopng": ("service", [], True),

    # === VULNERABILITY ANALYSIS - CLI ===
    "nikto": ("cli", [], False), "lynis": ("cli", [], False), "wapiti": ("cli", [], False),
    "skipfish": ("cli", [], False), "unix-privesc-check": ("cli", [], False),
    "linux-exploit-suggester": ("cli", [], False), "vulscan": ("cli", [], False),
    "joomscan": ("cli", [], False), "wpscan": ("cli", [], False), "droopescan": ("cli", [], False),
    "plecost": ("cli", [], False), "doona": ("cli", [], False), "spike": ("cli", [], False),
    "voiphopper": ("cli", [], False),
    # Vuln - GUI/Service
    "openvas": ("service", [], True), "nessus": ("service", [], True), "legion": ("gui", [], True),

    # === WEB APPLICATIONS - CLI ===
    "gobuster": ("cli", [], False), "dirb": ("cli", [], False), "dirsearch": ("cli", [], False),
    "ffuf": ("cli", [], False), "feroxbuster": ("cli", [], False), "sqlmap": ("cli", [], False),
    "commix": ("cli", [], False), "xsser": ("cli", [], False), "dalfox": ("cli", [], False),
    "wfuzz": ("cli", [], False), "cadaver": ("cli", [], False), "davtest": ("cli", [], False),
    "curl": ("cli", [], False), "wget": ("cli", [], False), "arjun": ("cli", [], False),
    "paramspider": ("cli", [], False), "hakrawler": ("cli", [], False), "gospider": ("cli", [], False),
    "katana": ("cli", [], False), "httrack": ("cli", [], False), "cewl": ("cli", [], False),
    "cutycapt": ("cli", [], True),
    # Web - GUI
    "burpsuite": ("gui", [], True), "zaproxy": ("gui", [], True),

    # === EXPLOITATION TOOLS - CLI ===
    "msfvenom": ("cli", [], False), "searchsploit": ("cli", [], False),
    "crackmapexec": ("cli", [], False), "netexec": ("cli", [], False),
    "evil-winrm": ("cli", [], False), "impacket-scripts": ("cli", [], False),
    "shellnoob": ("cli", [], False), "responder": ("cli", [], False),
    "mimikatz": ("cli", [], False), "setoolkit": ("cli", [], False),
    # Exploitation - Framework
    "metasploit-framework": ("framework", [], False), "msfconsole": ("framework", [], False),
    "nishang": ("framework", [], False), "powersploit": ("framework", [], False),
    "empire": ("framework", [], True), "covenant": ("framework", [], True),
    # Exploitation - GUI/Service
    "beef-xss": ("service", [], True), "bloodhound": ("gui", [], True),

    # === PASSWORD ATTACKS - CLI ===
    "hydra": ("cli", [], False), "medusa": ("cli", [], False), "ncrack": ("cli", [], False),
    "patator": ("cli", [], False), "crowbar": ("cli", [], False), "crunch": ("cli", [], False),
    "hash-identifier": ("cli", [], False), "hashid": ("cli", [], False),
    "chntpw": ("cli", [], False), "passing-the-hash": ("cli", [], False),
    "wordlists": ("cli", [], False), "seclists": ("cli", [], False),
    # Password - GPU tools
    "john": ("cli", ["gpu"], False), "hashcat": ("cli", ["gpu"], False),
    "rainbowcrack": ("cli", ["gpu"], False),
    # Password - GUI
    "ophcrack": ("gui", ["gpu"], True),

    # === WIRELESS ATTACKS - WiFi adapter required ===
    "aircrack-ng": ("cli", ["wifi_adapter"], False), "airmon-ng": ("cli", ["wifi_adapter"], False),
    "airodump-ng": ("cli", ["wifi_adapter"], False), "aireplay-ng": ("cli", ["wifi_adapter"], False),
    "wifite": ("cli", ["wifi_adapter"], False), "airgeddon": ("cli", ["wifi_adapter"], False),
    "fluxion": ("cli", ["wifi_adapter"], False), "pixiewps": ("cli", ["wifi_adapter"], False),
    "reaver": ("cli", ["wifi_adapter"], False), "bully": ("cli", ["wifi_adapter"], False),
    "hostapd-wpe": ("cli", ["wifi_adapter"], False), "wifi-honey": ("cli", ["wifi_adapter"], False),
    "mdk3": ("cli", ["wifi_adapter"], False), "mdk4": ("cli", ["wifi_adapter"], False),
    "wifiphisher": ("cli", ["wifi_adapter"], False),
    # Wireless - GUI/Service
    "fern-wifi-cracker": ("gui", ["wifi_adapter"], True),
    "kismet": ("service", ["wifi_adapter"], True),
    "bettercap": ("cli", ["wifi_adapter"], True),
    # Wireless - Bluetooth
    "bluez": ("cli", ["bluetooth"], False), "blueranger": ("cli", ["bluetooth"], False),

    # === SNIFFING & SPOOFING - CLI ===
    "tshark": ("cli", [], False), "tcpdump": ("cli", [], False), "ettercap": ("cli", [], False),
    "dsniff": ("cli", [], False), "macchanger": ("cli", [], False), "mitmproxy": ("cli", [], False),
    "arpspoof": ("cli", [], False), "dnsspoof": ("cli", [], False), "netcat": ("cli", [], False),
    "ncat": ("cli", [], False), "socat": ("cli", [], False), "scapy": ("cli", [], False),
    "yersinia": ("cli", [], False), "sslstrip": ("cli", [], False), "sslsplit": ("cli", [], False),
    "proxychains4": ("cli", [], False), "ngrep": ("cli", [], False),
    # Sniffing - GUI
    "wireshark": ("gui", [], True),

    # === POST EXPLOITATION - CLI ===
    "linpeas": ("cli", [], False), "winpeas": ("cli", [], False), "pspy": ("cli", [], False),
    "weevely": ("cli", [], False), "powershell": ("cli", [], False), "chisel": ("cli", [], False),
    "ligolo-ng": ("cli", [], False), "sshuttle": ("cli", [], False), "pwncat": ("cli", [], False),
    # Post Exploitation - GUI
    "starkiller": ("gui", [], True),

    # === FORENSICS - CLI ===
    "sleuthkit": ("cli", [], False), "volatility3": ("cli", [], False), "binwalk": ("cli", [], False),
    "foremost": ("cli", [], False), "scalpel": ("cli", [], False), "bulk-extractor": ("cli", [], False),
    "strings": ("cli", [], False), "xxd": ("cli", [], False), "hexedit": ("cli", [], False),
    "dc3dd": ("cli", [], False), "pdf-parser": ("cli", [], False), "pdfid": ("cli", [], False),
    "chkrootkit": ("cli", [], False), "rkhunter": ("cli", [], False),
    # Forensics - GUI
    "autopsy": ("gui", [], True), "guymager": ("gui", [], True),

    # === REVERSE ENGINEERING - CLI ===
    "radare2": ("cli", [], False), "gdb": ("cli", [], False), "ltrace": ("cli", [], False),
    "strace": ("cli", [], False), "objdump": ("cli", [], False), "checksec": ("cli", [], False),
    "file": ("cli", [], False), "readelf": ("cli", [], False), "nm": ("cli", [], False),
    "apktool": ("cli", [], False), "dex2jar": ("cli", [], False), "androguard": ("cli", [], False),
    # Rev Eng - GUI
    "ghidra": ("gui", [], True), "cutter": ("gui", [], True),
    "jadx": ("gui", [], True), "jd-gui": ("gui", [], True),

    # === NETWORK UTILITIES - CLI ===
    "proxychains": ("cli", [], False), "openvpn": ("cli", [], False),
    "wireguard": ("cli", [], False), "cryptcat": ("cli", [], False),
    "dns2tcp": ("cli", [], False), "iodine": ("cli", [], False), "ptunnel": ("cli", [], False),
    # Network - Service
    "tor": ("service", [], False), "stunnel": ("service", [], False),

    # === OSINT - CLI ===
    "sherlock": ("cli", [], False), "holehe": ("cli", [], False),
    "phoneinfoga": ("cli", [], False), "twint": ("cli", [], False),
    "photon": ("cli", [], False), "osrframework": ("cli", [], False),

    # === CLOUD SECURITY - CLI ===
    "scout-suite": ("cli", [], False), "prowler": ("cli", [], False),
    "pacu": ("cli", [], False), "cloudsploit": ("cli", [], False),
    "trufflehog": ("cli", [], False), "gitleaks": ("cli", [], False),

    # === SOCIAL ENGINEERING ===
    "evilginx2": ("cli", [], False),
    "gophish": ("service", [], True), "king-phisher": ("gui", [], True),

    # === REPORTING TOOLS ===
    "pipal": ("cli", [], False),
    "faraday": ("service", [], True), "dradis": ("service", [], True),
    "magictree": ("gui", [], True), "cherrytree": ("gui", [], True),
    "recordmydesktop": ("gui", [], True),
}

# Install commands & example usage for key tools
EXTRA = {
    "nmap": ("apt install nmap", "nmap -sV -sC -p 1-1000 <target>"),
    "masscan": ("apt install masscan", "masscan <target> -p1-65535 --rate=1000"),
    "whois": ("apt install whois", "whois <domain>"),
    "fierce": ("apt install fierce", "fierce --domain <domain>"),
    "dnsrecon": ("apt install dnsrecon", "dnsrecon -d <domain> -t std"),
    "theharvester": ("apt install theharvester", "theHarvester -d <domain> -b all"),
    "amass": ("apt install amass", "amass enum -d <domain>"),
    "subfinder": ("apt install subfinder", "subfinder -d <domain> -silent"),
    "enum4linux": ("apt install enum4linux", "enum4linux -a <target>"),
    "whatweb": ("apt install whatweb", "whatweb -a3 <target>"),
    "wafw00f": ("apt install wafw00f", "wafw00f <url>"),
    "sslscan": ("apt install sslscan", "sslscan <target>"),
    "nikto": ("apt install nikto", "nikto -h <target>"),
    "wpscan": ("apt install wpscan", "wpscan --url <url> --enumerate vp"),
    "gobuster": ("apt install gobuster", "gobuster dir -u <url> -w /usr/share/wordlists/dirb/common.txt"),
    "dirb": ("apt install dirb", "dirb <url>"),
    "ffuf": ("apt install ffuf", "ffuf -u <url>/FUZZ -w wordlist.txt"),
    "sqlmap": ("apt install sqlmap", "sqlmap -u '<url>?id=1' --batch --dbs"),
    "searchsploit": ("apt install exploitdb", "searchsploit <query>"),
    "metasploit-framework": ("apt install metasploit-framework", "msfconsole -q"),
    "hydra": ("apt install hydra", "hydra -L users.txt -P pass.txt <target> ssh"),
    "john": ("apt install john", "john --wordlist=/usr/share/wordlists/rockyou.txt <hashfile>"),
    "hashcat": ("apt install hashcat", "hashcat -m 0 -a 0 <hashfile> wordlist.txt"),
    "aircrack-ng": ("apt install aircrack-ng", "aircrack-ng -w wordlist.txt capture.cap"),
    "wireshark": ("apt install wireshark", "wireshark"),
    "tcpdump": ("apt install tcpdump", "tcpdump -i eth0 -c 100 host <target>"),
    "burpsuite": ("apt install burpsuite", "burpsuite"),
    "ghidra": ("apt install ghidra", "ghidra"),
    "radare2": ("apt install radare2", "r2 -A <binary>"),
    "autopsy": ("apt install autopsy", "autopsy"),
    "volatility3": ("apt install python3-volatility3", "vol3 -f <memdump> windows.info"),
    "binwalk": ("apt install binwalk", "binwalk <firmware>"),
    "traceroute": ("apt install traceroute", "traceroute <target>"),
    "mtr": ("apt install mtr", "mtr --report <target>"),
    "dirsearch": ("apt install dirsearch", "dirsearch -u <url>"),
    "feroxbuster": ("apt install feroxbuster", "feroxbuster -u <url>"),
    "commix": ("apt install commix", "commix --url '<url>?param=test' --batch"),
    "crackmapexec": ("apt install crackmapexec", "crackmapexec smb <target> -u user -p pass"),
    "responder": ("apt install responder", "responder -I eth0 -wrf"),
    "evil-winrm": ("apt install evil-winrm", "evil-winrm -i <target> -u user -p pass"),
    "bloodhound": ("apt install bloodhound", "bloodhound"),
    "nishang": ("apt install nishang", "ls /usr/share/nishang/"),
    "sherlock": ("pip install sherlock-project", "sherlock <username>"),
    "nuclei": ("apt install nuclei", "nuclei -u <url> -severity critical,high"),
    "httpx": ("apt install httpx-toolkit", "echo <domain> | httpx -silent"),
    "wifite": ("apt install wifite", "wifite"),
    "bettercap": ("apt install bettercap", "bettercap -iface wlan0"),
    "mitmproxy": ("apt install mitmproxy", "mitmproxy -p 8080"),
    "chisel": ("apt install chisel", "chisel server -p 8080 --reverse"),
    "tor": ("apt install tor", "service tor start"),
    "openvpn": ("apt install openvpn", "openvpn --config client.ovpn"),
    "gitleaks": ("apt install gitleaks", "gitleaks detect -s <path>"),
}

with app.app_context():
    updated = 0
    not_found = []

    for tname, (ttype, hw, gui) in TOOLS.items():
        tool = Tool.query.filter(db.func.lower(Tool.name) == tname.lower()).first()
        if tool:
            tool.tool_type = ttype
            tool.hardware_required = json.dumps(hw)
            tool.gui_required = gui
            if tname in EXTRA:
                tool.install_command = EXTRA[tname][0]
                tool.example_usage = EXTRA[tname][1]
            updated += 1
        else:
            not_found.append(tname)

    # Set remaining NULL tools to 'cli' default
    remaining = Tool.query.filter(Tool.tool_type.is_(None)).all()
    for t in remaining:
        t.tool_type = 'cli'
        t.hardware_required = '[]'
        t.gui_required = False

    db.session.commit()

    total = Tool.query.count()
    cli_c = Tool.query.filter_by(tool_type='cli').count()
    gui_c = Tool.query.filter_by(tool_type='gui').count()
    svc_c = Tool.query.filter_by(tool_type='service').count()
    fw_c = Tool.query.filter_by(tool_type='framework').count()

    print(f"\n{'='*50}")
    print(f"KALI TOOLS METADATA UPDATE COMPLETE")
    print(f"{'='*50}")
    print(f"Total tools in DB: {total}")
    print(f"Updated with metadata: {updated}")
    print(f"Set to CLI default: {len(remaining)}")
    print(f"Not found in DB: {len(not_found)}")
    if not_found:
        print(f"  Missing: {not_found[:15]}")
    print(f"\n--- Tool Types ---")
    print(f"CLI tools:       {cli_c}")
    print(f"GUI tools:       {gui_c}")
    print(f"Service tools:   {svc_c}")
    print(f"Framework tools: {fw_c}")
    print(f"{'='*50}")
