#!/usr/bin/env python3
"""
Add all Kali Linux tools to the database
"""

import sqlite3
import subprocess

DB_PATH = '/home/sam/APPS/cybersec-kali/backend/instance/cybersec.db'

# Complete Kali Linux Tools Database
KALI_TOOLS = [
    # Information Gathering
    {'name': 'Nmap', 'category': 'Information Gathering', 'command': 'nmap {target}', 'description': 'Network exploration and security auditing', 'difficulty': 'beginner'},
    {'name': 'Netdiscover', 'category': 'Information Gathering', 'command': 'netdiscover -r {target}', 'description': 'Active/passive network address scanner', 'difficulty': 'beginner'},
    {'name': 'Masscan', 'category': 'Information Gathering', 'command': 'masscan {target} -p1-65535', 'description': 'Fastest port scanner', 'difficulty': 'intermediate'},
    {'name': 'Recon-ng', 'category': 'Information Gathering', 'command': 'recon-ng', 'description': 'Web reconnaissance framework', 'difficulty': 'intermediate'},
    {'name': 'theHarvester', 'category': 'Information Gathering', 'command': 'theHarvester -d {target} -b all', 'description': 'Email and subdomain harvester', 'difficulty': 'beginner'},
    {'name': 'Shodan CLI', 'category': 'Information Gathering', 'command': 'shodan host {target}', 'description': 'Search engine for Internet-connected devices', 'difficulty': 'beginner'},
    {'name': 'Maltego', 'category': 'Information Gathering', 'command': 'maltego', 'description': 'Link analysis and data mining', 'difficulty': 'advanced'},
    {'name': 'SpiderFoot', 'category': 'Information Gathering', 'command': 'spiderfoot -s {target}', 'description': 'Automated OSINT tool', 'difficulty': 'intermediate'},
    {'name': 'Dmitry', 'category': 'Information Gathering', 'command': 'dmitry -winsepbo {target}', 'description': 'Deepmagic Information Gathering Tool', 'difficulty': 'beginner'},
    {'name': 'DNSenum', 'category': 'Information Gathering', 'command': 'dnsenum {target}', 'description': 'DNS enumeration tool', 'difficulty': 'beginner'},
    {'name': 'DNSrecon', 'category': 'Information Gathering', 'command': 'dnsrecon -d {target}', 'description': 'DNS reconnaissance tool', 'difficulty': 'beginner'},
    {'name': 'Fierce', 'category': 'Information Gathering', 'command': 'fierce --domain {target}', 'description': 'DNS reconnaissance tool', 'difficulty': 'beginner'},
    {'name': 'Sublist3r', 'category': 'Information Gathering', 'command': 'sublist3r -d {target}', 'description': 'Subdomain enumeration tool', 'difficulty': 'beginner'},
    {'name': 'Amass', 'category': 'Information Gathering', 'command': 'amass enum -d {target}', 'description': 'In-depth attack surface mapping', 'difficulty': 'intermediate'},
    {'name': 'Subfinder', 'category': 'Information Gathering', 'command': 'subfinder -d {target}', 'description': 'Subdomain discovery tool', 'difficulty': 'beginner'},
    {'name': 'Assetfinder', 'category': 'Information Gathering', 'command': 'assetfinder {target}', 'description': 'Find domains and subdomains', 'difficulty': 'beginner'},
    {'name': 'Knockpy', 'category': 'Information Gathering', 'command': 'knockpy {target}', 'description': 'Subdomain scanner', 'difficulty': 'beginner'},
    {'name': 'Photon', 'category': 'Information Gathering', 'command': 'photon -u {target}', 'description': 'Incredibly fast crawler', 'difficulty': 'beginner'},
    {'name': 'Osintgram', 'category': 'Information Gathering', 'command': 'osintgram', 'description': 'Instagram OSINT tool', 'difficulty': 'beginner'},
    {'name': 'Sherlock', 'category': 'Information Gathering', 'command': 'sherlock {target}', 'description': 'Hunt down social media accounts', 'difficulty': 'beginner'},
    
    # Vulnerability Analysis
    {'name': 'Nikto', 'category': 'Vulnerability Analysis', 'command': 'nikto -h {target}', 'description': 'Web server scanner', 'difficulty': 'beginner'},
    {'name': 'OpenVAS', 'category': 'Vulnerability Analysis', 'command': 'openvas', 'description': 'Comprehensive vulnerability scanner', 'difficulty': 'intermediate'},
    {'name': 'Lynis', 'category': 'Vulnerability Analysis', 'command': 'lynis audit system', 'description': 'Security auditing and hardening tool', 'difficulty': 'intermediate'},
    {'name': 'Wapiti', 'category': 'Vulnerability Analysis', 'command': 'wapiti -u {target}', 'description': 'Web application vulnerability scanner', 'difficulty': 'beginner'},
    {'name': 'Nuclei', 'category': 'Vulnerability Analysis', 'command': 'nuclei -u {target}', 'description': 'Fast vulnerability scanner', 'difficulty': 'beginner'},
    {'name': 'Vulners', 'category': 'Vulnerability Analysis', 'command': 'nmap --script vulners {target}', 'description': 'Vulnerability database scanner', 'difficulty': 'beginner'},
    {'name': 'Vulscan', 'category': 'Vulnerability Analysis', 'command': 'nmap --script vulscan {target}', 'description': 'Vulnerability scanning with nmap', 'difficulty': 'beginner'},
    {'name': 'Legion', 'category': 'Vulnerability Analysis', 'command': 'legion', 'description': 'Network penetration testing framework', 'difficulty': 'intermediate'},
    
    # Web Applications
    {'name': 'Burp Suite', 'category': 'Web Applications', 'command': 'burpsuite', 'description': 'Web application security testing', 'difficulty': 'intermediate'},
    {'name': 'OWASP ZAP', 'category': 'Web Applications', 'command': 'zaproxy', 'description': 'Web application security scanner', 'difficulty': 'beginner'},
    {'name': 'SQLMap', 'category': 'Web Applications', 'command': 'sqlmap -u {target}', 'description': 'Automatic SQL injection tool', 'difficulty': 'intermediate'},
    {'name': 'Commix', 'category': 'Web Applications', 'command': 'commix -u {target}', 'description': 'Command injection exploiter', 'difficulty': 'intermediate'},
    {'name': 'WPScan', 'category': 'Web Applications', 'command': 'wpscan --url {target}', 'description': 'WordPress security scanner', 'difficulty': 'beginner'},
    {'name': 'Joomscan', 'category': 'Web Applications', 'command': 'joomscan -u {target}', 'description': 'Joomla vulnerability scanner', 'difficulty': 'beginner'},
    {'name': 'Dirb', 'category': 'Web Applications', 'command': 'dirb {target}', 'description': 'Web content scanner', 'difficulty': 'beginner'},
    {'name': 'Gobuster', 'category': 'Web Applications', 'command': 'gobuster dir -u {target} -w /usr/share/wordlists/dirb/common.txt', 'description': 'Directory/file bruteforcing tool', 'difficulty': 'beginner'},
    {'name': 'FFuF', 'category': 'Web Applications', 'command': 'ffuf -u {target}/FUZZ -w /usr/share/wordlists/dirb/common.txt', 'description': 'Fast web fuzzer', 'difficulty': 'beginner'},
    {'name': 'Feroxbuster', 'category': 'Web Applications', 'command': 'feroxbuster -u {target}', 'description': 'Fast recursive content discovery', 'difficulty': 'beginner'},
    {'name': 'Wfuzz', 'category': 'Web Applications', 'command': 'wfuzz -c -z file,/usr/share/wordlists/dirb/common.txt {target}/FUZZ', 'description': 'Web application fuzzer', 'difficulty': 'intermediate'},
    {'name': 'Whatweb', 'category': 'Web Applications', 'command': 'whatweb {target}', 'description': 'Web scanner and fingerprinter', 'difficulty': 'beginner'},
    {'name': 'Wafw00f', 'category': 'Web Applications', 'command': 'wafw00f {target}', 'description': 'Web Application Firewall detection', 'difficulty': 'beginner'},
    {'name': 'XSStrike', 'category': 'Web Applications', 'command': 'xsstrike -u {target}', 'description': 'Advanced XSS detection suite', 'difficulty': 'intermediate'},
    {'name': 'Dalfox', 'category': 'Web Applications', 'command': 'dalfox url {target}', 'description': 'XSS scanning and parameter analysis', 'difficulty': 'intermediate'},
    {'name': 'Arjun', 'category': 'Web Applications', 'command': 'arjun -u {target}', 'description': 'HTTP parameter discovery', 'difficulty': 'beginner'},
    {'name': 'ParamSpider', 'category': 'Web Applications', 'command': 'paramspider -d {target}', 'description': 'Mining parameters from dark corners', 'difficulty': 'beginner'},
    {'name': 'Hakrawler', 'category': 'Web Applications', 'command': 'hakrawler -url {target}', 'description': 'Simple web crawler', 'difficulty': 'beginner'},
    {'name': 'Gospider', 'category': 'Web Applications', 'command': 'gospider -s {target}', 'description': 'Fast web spider', 'difficulty': 'beginner'},
    {'name': 'CMSmap', 'category': 'Web Applications', 'command': 'cmsmap {target}', 'description': 'CMS vulnerability scanner', 'difficulty': 'beginner'},
    {'name': 'Droopescan', 'category': 'Web Applications', 'command': 'droopescan scan drupal -u {target}', 'description': 'CMS scanner for Drupal/WordPress', 'difficulty': 'beginner'},
    {'name': 'Arachni', 'category': 'Web Applications', 'command': 'arachni {target}', 'description': 'Web application security scanner', 'difficulty': 'intermediate'},
    
    # Database Assessment
    {'name': 'SQLMap', 'category': 'Database Assessment', 'command': 'sqlmap -u {target} --dbs', 'description': 'SQL injection and database takeover', 'difficulty': 'intermediate'},
    {'name': 'SQLNinja', 'category': 'Database Assessment', 'command': 'sqlninja', 'description': 'SQL Server injection tool', 'difficulty': 'advanced'},
    {'name': 'BBQSQL', 'category': 'Database Assessment', 'command': 'bbqsql', 'description': 'Blind SQL injection exploitation', 'difficulty': 'advanced'},
    {'name': 'NoSQLMap', 'category': 'Database Assessment', 'command': 'nosqlmap', 'description': 'NoSQL injection tool', 'difficulty': 'intermediate'},
    
    # Password Attacks
    {'name': 'Hashcat', 'category': 'Password Attacks', 'command': 'hashcat -m 0 {target} /usr/share/wordlists/rockyou.txt', 'description': 'Advanced password recovery', 'difficulty': 'intermediate'},
    {'name': 'John the Ripper', 'category': 'Password Attacks', 'command': 'john {target}', 'description': 'Password cracker', 'difficulty': 'beginner'},
    {'name': 'Hydra', 'category': 'Password Attacks', 'command': 'hydra -l admin -P /usr/share/wordlists/rockyou.txt {target} ssh', 'description': 'Network logon cracker', 'difficulty': 'intermediate'},
    {'name': 'Medusa', 'category': 'Password Attacks', 'command': 'medusa -h {target} -U users.txt -P passwords.txt -M ssh', 'description': 'Speedy parallel login brute-forcer', 'difficulty': 'intermediate'},
    {'name': 'Ncrack', 'category': 'Password Attacks', 'command': 'ncrack -p 22 {target}', 'description': 'High-speed network authentication cracker', 'difficulty': 'intermediate'},
    {'name': 'Patator', 'category': 'Password Attacks', 'command': 'patator', 'description': 'Multi-purpose brute-forcer', 'difficulty': 'intermediate'},
    {'name': 'Crunch', 'category': 'Password Attacks', 'command': 'crunch 8 8 -o wordlist.txt', 'description': 'Wordlist generator', 'difficulty': 'beginner'},
    {'name': 'CeWL', 'category': 'Password Attacks', 'command': 'cewl {target} -w wordlist.txt', 'description': 'Custom wordlist generator', 'difficulty': 'beginner'},
    {'name': 'Cupp', 'category': 'Password Attacks', 'command': 'cupp -i', 'description': 'Common User Passwords Profiler', 'difficulty': 'beginner'},
    {'name': 'RSMangler', 'category': 'Password Attacks', 'command': 'rsmangler -f wordlist.txt', 'description': 'Wordlist mangling tool', 'difficulty': 'beginner'},
    {'name': 'Hash-identifier', 'category': 'Password Attacks', 'command': 'hash-identifier', 'description': 'Identify hash types', 'difficulty': 'beginner'},
    {'name': 'Hashid', 'category': 'Password Attacks', 'command': 'hashid {target}', 'description': 'Hash identification', 'difficulty': 'beginner'},
    
    # Wireless Attacks
    {'name': 'Aircrack-ng', 'category': 'Wireless Attacks', 'command': 'aircrack-ng', 'description': 'WiFi security auditing tools', 'difficulty': 'intermediate'},
    {'name': 'Airmon-ng', 'category': 'Wireless Attacks', 'command': 'airmon-ng start wlan0', 'description': 'Enable monitor mode', 'difficulty': 'beginner'},
    {'name': 'Airodump-ng', 'category': 'Wireless Attacks', 'command': 'airodump-ng wlan0mon', 'description': 'Packet capture for aircrack', 'difficulty': 'beginner'},
    {'name': 'Aireplay-ng', 'category': 'Wireless Attacks', 'command': 'aireplay-ng', 'description': 'Inject packets into wireless network', 'difficulty': 'intermediate'},
    {'name': 'Reaver', 'category': 'Wireless Attacks', 'command': 'reaver -i wlan0mon -b {target}', 'description': 'WPS brute force attack', 'difficulty': 'intermediate'},
    {'name': 'Bully', 'category': 'Wireless Attacks', 'command': 'bully wlan0mon -b {target}', 'description': 'WPS brute force attack', 'difficulty': 'intermediate'},
    {'name': 'Wifite', 'category': 'Wireless Attacks', 'command': 'wifite', 'description': 'Automated wireless attack tool', 'difficulty': 'beginner'},
    {'name': 'Fern Wifi Cracker', 'category': 'Wireless Attacks', 'command': 'fern-wifi-cracker', 'description': 'GUI wireless security auditing', 'difficulty': 'beginner'},
    {'name': 'Kismet', 'category': 'Wireless Attacks', 'command': 'kismet', 'description': 'Wireless network detector and sniffer', 'difficulty': 'intermediate'},
    {'name': 'Mdk4', 'category': 'Wireless Attacks', 'command': 'mdk4 wlan0mon', 'description': 'Wireless attack tool', 'difficulty': 'advanced'},
    {'name': 'Fluxion', 'category': 'Wireless Attacks', 'command': 'fluxion', 'description': 'Evil twin attack tool', 'difficulty': 'intermediate'},
    {'name': 'Wifipumpkin3', 'category': 'Wireless Attacks', 'command': 'wifipumpkin3', 'description': 'Rogue access point framework', 'difficulty': 'intermediate'},
    {'name': 'Hostapd-wpe', 'category': 'Wireless Attacks', 'command': 'hostapd-wpe', 'description': 'Evil twin with WPA Enterprise', 'difficulty': 'advanced'},
    {'name': 'Bettercap', 'category': 'Wireless Attacks', 'command': 'bettercap', 'description': 'Swiss army knife for network attacks', 'difficulty': 'intermediate'},
    
    # Exploitation Tools
    {'name': 'Metasploit Framework', 'category': 'Exploitation Tools', 'command': 'msfconsole', 'description': 'Penetration testing framework', 'difficulty': 'intermediate'},
    {'name': 'BeEF', 'category': 'Exploitation Tools', 'command': 'beef-xss', 'description': 'Browser Exploitation Framework', 'difficulty': 'intermediate'},
    {'name': 'Armitage', 'category': 'Exploitation Tools', 'command': 'armitage', 'description': 'GUI for Metasploit', 'difficulty': 'intermediate'},
    {'name': 'SearchSploit', 'category': 'Exploitation Tools', 'command': 'searchsploit {target}', 'description': 'Search Exploit-DB', 'difficulty': 'beginner'},
    {'name': 'Crackmapexec', 'category': 'Exploitation Tools', 'command': 'crackmapexec smb {target}', 'description': 'Swiss army knife for pentesting', 'difficulty': 'intermediate'},
    {'name': 'Evil-WinRM', 'category': 'Exploitation Tools', 'command': 'evil-winrm -i {target} -u admin -p password', 'description': 'Windows Remote Management shell', 'difficulty': 'intermediate'},
    {'name': 'Impacket', 'category': 'Exploitation Tools', 'command': 'impacket-psexec', 'description': 'Python network protocols', 'difficulty': 'advanced'},
    {'name': 'Mimikatz', 'category': 'Exploitation Tools', 'command': 'mimikatz', 'description': 'Windows credential extraction', 'difficulty': 'advanced'},
    {'name': 'PowerSploit', 'category': 'Exploitation Tools', 'command': 'powersploit', 'description': 'PowerShell post-exploitation', 'difficulty': 'advanced'},
    {'name': 'Empire', 'category': 'Exploitation Tools', 'command': 'empire', 'description': 'Post-exploitation framework', 'difficulty': 'advanced'},
    {'name': 'Covenant', 'category': 'Exploitation Tools', 'command': 'covenant', 'description': '.NET C2 framework', 'difficulty': 'advanced'},
    {'name': 'Sliver', 'category': 'Exploitation Tools', 'command': 'sliver', 'description': 'Cross-platform C2 framework', 'difficulty': 'advanced'},
    {'name': 'Havoc', 'category': 'Exploitation Tools', 'command': 'havoc', 'description': 'Modern C2 framework', 'difficulty': 'advanced'},
    
    # Sniffing & Spoofing
    {'name': 'Wireshark', 'category': 'Sniffing & Spoofing', 'command': 'wireshark', 'description': 'Network protocol analyzer', 'difficulty': 'beginner'},
    {'name': 'Tcpdump', 'category': 'Sniffing & Spoofing', 'command': 'tcpdump -i eth0', 'description': 'Command-line packet analyzer', 'difficulty': 'beginner'},
    {'name': 'Ettercap', 'category': 'Sniffing & Spoofing', 'command': 'ettercap -G', 'description': 'MITM attack suite', 'difficulty': 'intermediate'},
    {'name': 'Bettercap', 'category': 'Sniffing & Spoofing', 'command': 'bettercap', 'description': 'Network attack and monitoring', 'difficulty': 'intermediate'},
    {'name': 'Dsniff', 'category': 'Sniffing & Spoofing', 'command': 'dsniff', 'description': 'Network auditing tools', 'difficulty': 'intermediate'},
    {'name': 'Arpwatch', 'category': 'Sniffing & Spoofing', 'command': 'arpwatch', 'description': 'Ethernet/FDDI station activity monitor', 'difficulty': 'beginner'},
    {'name': 'Responder', 'category': 'Sniffing & Spoofing', 'command': 'responder -I eth0', 'description': 'LLMNR/NBT-NS/mDNS poisoner', 'difficulty': 'intermediate'},
    {'name': 'Macchanger', 'category': 'Sniffing & Spoofing', 'command': 'macchanger -r eth0', 'description': 'MAC address changer', 'difficulty': 'beginner'},
    {'name': 'Arpspoof', 'category': 'Sniffing & Spoofing', 'command': 'arpspoof -i eth0 -t {target} gateway', 'description': 'ARP spoofing tool', 'difficulty': 'intermediate'},
    {'name': 'SSLstrip', 'category': 'Sniffing & Spoofing', 'command': 'sslstrip -l 8080', 'description': 'HTTPS stripping attack', 'difficulty': 'intermediate'},
    {'name': 'MITMf', 'category': 'Sniffing & Spoofing', 'command': 'mitmf', 'description': 'Man-in-the-Middle framework', 'difficulty': 'intermediate'},
    
    # Post Exploitation
    {'name': 'Netcat', 'category': 'Post Exploitation', 'command': 'nc -lvp 4444', 'description': 'TCP/UDP network tool', 'difficulty': 'beginner'},
    {'name': 'Socat', 'category': 'Post Exploitation', 'command': 'socat', 'description': 'Multipurpose relay', 'difficulty': 'intermediate'},
    {'name': 'Chisel', 'category': 'Post Exploitation', 'command': 'chisel server -p 8000 --reverse', 'description': 'TCP/UDP tunnel over HTTP', 'difficulty': 'intermediate'},
    {'name': 'Pwncat', 'category': 'Post Exploitation', 'command': 'pwncat-cs', 'description': 'Post-exploitation platform', 'difficulty': 'intermediate'},
    {'name': 'LinPEAS', 'category': 'Post Exploitation', 'command': 'linpeas.sh', 'description': 'Linux privilege escalation', 'difficulty': 'beginner'},
    {'name': 'WinPEAS', 'category': 'Post Exploitation', 'command': 'winpeas.exe', 'description': 'Windows privilege escalation', 'difficulty': 'beginner'},
    {'name': 'Linux Exploit Suggester', 'category': 'Post Exploitation', 'command': 'les.sh', 'description': 'Linux kernel exploit suggester', 'difficulty': 'beginner'},
    {'name': 'Windows Exploit Suggester', 'category': 'Post Exploitation', 'command': 'wes.py', 'description': 'Windows exploit suggester', 'difficulty': 'beginner'},
    {'name': 'Bloodhound', 'category': 'Post Exploitation', 'command': 'bloodhound', 'description': 'Active Directory reconnaissance', 'difficulty': 'intermediate'},
    {'name': 'SharpHound', 'category': 'Post Exploitation', 'command': 'sharphound.exe', 'description': 'BloodHound data collector', 'difficulty': 'intermediate'},
    {'name': 'Rubeus', 'category': 'Post Exploitation', 'command': 'rubeus', 'description': 'Kerberos abuse toolkit', 'difficulty': 'advanced'},
    
    # Forensics
    {'name': 'Autopsy', 'category': 'Forensics', 'command': 'autopsy', 'description': 'Digital forensics platform', 'difficulty': 'intermediate'},
    {'name': 'Sleuthkit', 'category': 'Forensics', 'command': 'mmls', 'description': 'Forensic toolkit', 'difficulty': 'intermediate'},
    {'name': 'Volatility', 'category': 'Forensics', 'command': 'volatility', 'description': 'Memory forensics framework', 'difficulty': 'advanced'},
    {'name': 'Foremost', 'category': 'Forensics', 'command': 'foremost -i {target}', 'description': 'File carving tool', 'difficulty': 'beginner'},
    {'name': 'Binwalk', 'category': 'Forensics', 'command': 'binwalk {target}', 'description': 'Firmware analysis tool', 'difficulty': 'beginner'},
    {'name': 'Bulk Extractor', 'category': 'Forensics', 'command': 'bulk_extractor', 'description': 'Extract useful information', 'difficulty': 'intermediate'},
    {'name': 'Scalpel', 'category': 'Forensics', 'command': 'scalpel', 'description': 'Fast file carver', 'difficulty': 'intermediate'},
    {'name': 'Testdisk', 'category': 'Forensics', 'command': 'testdisk', 'description': 'Partition recovery tool', 'difficulty': 'intermediate'},
    {'name': 'Photorec', 'category': 'Forensics', 'command': 'photorec', 'description': 'File recovery tool', 'difficulty': 'beginner'},
    {'name': 'Exiftool', 'category': 'Forensics', 'command': 'exiftool {target}', 'description': 'Metadata extraction', 'difficulty': 'beginner'},
    {'name': 'Strings', 'category': 'Forensics', 'command': 'strings {target}', 'description': 'Extract printable strings', 'difficulty': 'beginner'},
    {'name': 'Steghide', 'category': 'Forensics', 'command': 'steghide extract -sf {target}', 'description': 'Steganography tool', 'difficulty': 'beginner'},
    {'name': 'Stegsolve', 'category': 'Forensics', 'command': 'stegsolve', 'description': 'Image steganography solver', 'difficulty': 'beginner'},
    
    # Reporting Tools
    {'name': 'Dradis', 'category': 'Reporting Tools', 'command': 'dradis', 'description': 'Collaborative reporting platform', 'difficulty': 'intermediate'},
    {'name': 'Faraday', 'category': 'Reporting Tools', 'command': 'faraday', 'description': 'Collaborative penetration test IDE', 'difficulty': 'intermediate'},
    {'name': 'Pipal', 'category': 'Reporting Tools', 'command': 'pipal', 'description': 'Password analyzer', 'difficulty': 'beginner'},
    {'name': 'CherryTree', 'category': 'Reporting Tools', 'command': 'cherrytree', 'description': 'Hierarchical note taking', 'difficulty': 'beginner'},
    {'name': 'Cutycapt', 'category': 'Reporting Tools', 'command': 'cutycapt --url={target} --out=screenshot.png', 'description': 'Webpage screenshots', 'difficulty': 'beginner'},
    {'name': 'Eyewitness', 'category': 'Reporting Tools', 'command': 'eyewitness --web -f urls.txt', 'description': 'Website screenshot tool', 'difficulty': 'beginner'},
    
    # Social Engineering
    {'name': 'Social Engineering Toolkit', 'category': 'Social Engineering', 'command': 'setoolkit', 'description': 'Social engineering attacks', 'difficulty': 'intermediate'},
    {'name': 'Gophish', 'category': 'Social Engineering', 'command': 'gophish', 'description': 'Phishing framework', 'difficulty': 'intermediate'},
    {'name': 'King Phisher', 'category': 'Social Engineering', 'command': 'king-phisher', 'description': 'Phishing campaign toolkit', 'difficulty': 'intermediate'},
    {'name': 'Evilginx2', 'category': 'Social Engineering', 'command': 'evilginx2', 'description': 'Phishing with 2FA bypass', 'difficulty': 'advanced'},
    {'name': 'Modlishka', 'category': 'Social Engineering', 'command': 'modlishka', 'description': 'Reverse proxy phishing', 'difficulty': 'advanced'},
    
    # Reverse Engineering
    {'name': 'Ghidra', 'category': 'Reverse Engineering', 'command': 'ghidra', 'description': 'NSA reverse engineering tool', 'difficulty': 'advanced'},
    {'name': 'Radare2', 'category': 'Reverse Engineering', 'command': 'r2 {target}', 'description': 'Reverse engineering framework', 'difficulty': 'advanced'},
    {'name': 'GDB', 'category': 'Reverse Engineering', 'command': 'gdb {target}', 'description': 'GNU debugger', 'difficulty': 'intermediate'},
    {'name': 'Cutter', 'category': 'Reverse Engineering', 'command': 'cutter', 'description': 'GUI for radare2', 'difficulty': 'intermediate'},
    {'name': 'x64dbg', 'category': 'Reverse Engineering', 'command': 'x64dbg', 'description': 'Windows debugger', 'difficulty': 'intermediate'},
    {'name': 'Hopper', 'category': 'Reverse Engineering', 'command': 'hopper', 'description': 'Disassembler', 'difficulty': 'intermediate'},
    {'name': 'APKTool', 'category': 'Reverse Engineering', 'command': 'apktool d {target}', 'description': 'Android APK reverse engineering', 'difficulty': 'beginner'},
    {'name': 'JADX', 'category': 'Reverse Engineering', 'command': 'jadx {target}', 'description': 'DEX to Java decompiler', 'difficulty': 'beginner'},
    {'name': 'Dex2jar', 'category': 'Reverse Engineering', 'command': 'd2j-dex2jar {target}', 'description': 'DEX to JAR converter', 'difficulty': 'beginner'},
    {'name': 'JD-GUI', 'category': 'Reverse Engineering', 'command': 'jd-gui', 'description': 'Java decompiler', 'difficulty': 'beginner'},
    
    # Mobile Security
    {'name': 'MobSF', 'category': 'Mobile Security', 'command': 'mobsf', 'description': 'Mobile Security Framework', 'difficulty': 'intermediate'},
    {'name': 'Drozer', 'category': 'Mobile Security', 'command': 'drozer', 'description': 'Android security assessment', 'difficulty': 'intermediate'},
    {'name': 'Frida', 'category': 'Mobile Security', 'command': 'frida', 'description': 'Dynamic instrumentation toolkit', 'difficulty': 'advanced'},
    {'name': 'Objection', 'category': 'Mobile Security', 'command': 'objection', 'description': 'Mobile exploration toolkit', 'difficulty': 'intermediate'},
    {'name': 'ADB', 'category': 'Mobile Security', 'command': 'adb shell', 'description': 'Android Debug Bridge', 'difficulty': 'beginner'},
    
    # System Tools
    {'name': 'Curl', 'category': 'System Tools', 'command': 'curl {target}', 'description': 'Transfer data from URLs', 'difficulty': 'beginner'},
    {'name': 'Wget', 'category': 'System Tools', 'command': 'wget {target}', 'description': 'Download files from web', 'difficulty': 'beginner'},
    {'name': 'Proxychains', 'category': 'System Tools', 'command': 'proxychains {command}', 'description': 'Force any connection through proxy', 'difficulty': 'intermediate'},
    {'name': 'Tor', 'category': 'System Tools', 'command': 'tor', 'description': 'Anonymity network', 'difficulty': 'beginner'},
    {'name': 'Tmux', 'category': 'System Tools', 'command': 'tmux', 'description': 'Terminal multiplexer', 'difficulty': 'beginner'},
    {'name': 'Screen', 'category': 'System Tools', 'command': 'screen', 'description': 'Terminal multiplexer', 'difficulty': 'beginner'},
]

def check_installed(tool_name):
    """Check if tool is installed"""
    binary = tool_name.lower().replace(' ', '-').replace('_', '-')
    alternatives = [binary, binary.replace('-', ''), tool_name.lower().split()[0]]
    
    for b in alternatives:
        try:
            result = subprocess.run(['which', b], capture_output=True)
            if result.returncode == 0:
                return True
        except:
            pass
    return False

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get existing tools
    cursor.execute('SELECT name FROM tools')
    existing = {row[0] for row in cursor.fetchall()}
    
    added = 0
    updated = 0
    
    for tool in KALI_TOOLS:
        installed = check_installed(tool['name'])
        
        if tool['name'] in existing:
            # Update existing
            cursor.execute('''
                UPDATE tools SET 
                    category = ?,
                    command = ?,
                    description = ?,
                    difficulty = ?,
                    installed = ?
                WHERE name = ?
            ''', (
                tool['category'],
                tool['command'],
                tool['description'],
                tool.get('difficulty', 'beginner'),
                installed,
                tool['name']
            ))
            updated += 1
        else:
            # Insert new
            cursor.execute('''
                INSERT INTO tools (name, category, command, description, difficulty, installed, requires_sudo, usage_count)
                VALUES (?, ?, ?, ?, ?, ?, 0, 0)
            ''', (
                tool['name'],
                tool['category'],
                tool['command'],
                tool['description'],
                tool.get('difficulty', 'beginner'),
                installed
            ))
            added += 1
    
    conn.commit()
    conn.close()
    
    print(f"✅ Database updated!")
    print(f"   Added: {added} new tools")
    print(f"   Updated: {updated} existing tools")
    print(f"   Total: {len(KALI_TOOLS)} tools in database")

if __name__ == '__main__':
    main()
