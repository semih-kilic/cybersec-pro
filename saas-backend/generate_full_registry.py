#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - Full Kali Linux Tool Registry Generator
Automatically discovers and registers ALL Kali Linux tools

Author: Semih Kılıç
Version: 3.0.0
"""

import subprocess
import shutil
import os
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Category mappings based on Kali menu structure
CATEGORY_MAPPINGS = {
    # Information Gathering
    'information_gathering': [
        'nmap', 'masscan', 'rustscan', 'unicornscan', 'zenmap',
        'dmitry', 'dnsenum', 'dnsmap', 'dnsrecon', 'dnswalk', 'fierce',
        'host', 'dig', 'whois', 'nslookup', 'theHarvester', 'theharvester',
        'recon-ng', 'maltego', 'spiderfoot', 'osrframework',
        'metagoofil', 'exiftool', 'foca', 'creepy',
        'amass', 'subfinder', 'assetfinder', 'sublist3r', 'massdns', 'shuffledns',
        'gobuster', 'ffuf', 'feroxbuster', 'dirsearch', 'dirb', 'dirbuster',
        'wfuzz', 'arjun', 'paramspider', 'gau', 'waybackurls', 'hakrawler',
        'httpx', 'httprobe', 'aquatone', 'eyewitness', 'gowitness',
        'whatweb', 'wafw00f', 'wappalyzer', 'builtwith', 'webanalyze',
        'shodan', 'censys', 'zoomeye', 'fofa',
        'enum4linux', 'enum4linux-ng', 'ldapsearch', 'rpcclient', 'smbclient', 'smbmap',
        'snmpwalk', 'snmp-check', 'onesixtyone', 'braa',
        'netdiscover', 'arp-scan', 'fping', 'hping3', 'arping',
        'p0f', 'prads', 'traceroute', 'mtr', 'lbd',
        'xplico', 'networkminer', 'wireshark', 'tshark', 'tcpdump',
        'nbtscan', 'sslscan', 'sslyze', 'testssl', 'tlssled',
        'smtp-user-enum', 'swaks', 'ismtp',
        'ike-scan', 'psk-crack',
        'amap', 'ident-user-enum', 'copy-router-config',
        'miranda', 'upnp-inspector',
        'hping', 'lbd', 'wafw00f', 'parsero', 'cutycapt',
        'urlcrazy', 'dnstwist',
        'wig', 'cmsmap', 'droopescan', 'joomscan', 'wpscan', 'plecost',
        'uniscan', 'blindelephant', 'davtest', 'cadaver',
        'smtp-user-enum', 'swaks',
        'sparta', 'legion', 'autorecon',
        'responder', 'inveigh', 'mitm6',
        'bloodhound', 'bloodhound-python', 'azurehound', 'sharphound',
        'ldapdomaindump', 'windapsearch', 'adidnsdump',
        'kerbrute', 'GetNPUsers', 'GetUserSPNs',
        'ntlmrecon', 'webclientservicescanner',
        '0trace', 'above', 'affcat', 'apache-users',
    ],
    
    # Vulnerability Analysis
    'vulnerability_analysis': [
        'nikto', 'wapiti', 'skipfish', 'vega', 'arachni',
        'openvas', 'gvm', 'nessus', 'nexpose',
        'lynis', 'unix-privesc-check', 'linux-exploit-suggester',
        'nuclei', 'jaeles', 'tsunami',
        'nmap-vulners', 'searchsploit', 'exploitdb',
        'jexboss', 'struts-pwn',
        'clusterd', 'cmsexplorer', 'plecost',
        'golismero', 'owasp-zap', 'zaproxy', 'burpsuite',
        'bed', 'doona', 'sfuzz', 'spike',
        'powerfuzzer', 'wfuzz', 'ffuf',
        'fierce', 'dnsenum', 'dnsrecon',
        'smbenum', 'snmpenum',
        'exploitdb', 'getsploit', 'sploitctl',
        'httrack', 'parsero', 'paros',
        'w3af', 'webscarab', 'ratproxy', 'grabber',
        'dotdotpwn', 'fimap', 'kadimus',
        'commix', 'tplmap',
        'testssl.sh', 'sslscan', 'sslyze',
        'oscanner', 'sidguesser', 'tnscmd10g',
        'polenum', 'acccheck', 'smb-nat',
        'whatweb', 'blindelephant', 'plecost',
        'cge', 'cisco-auditing-tool', 'cisco-ocs', 'cisco-torch',
        'yersinia', 'cdp', 'dhcpig',
        'bugs',
    ],
    
    # Web Application Analysis
    'web_application': [
        'burpsuite', 'zaproxy', 'owasp-zap', 'mitmproxy', 'proxychains',
        'sqlmap', 'sqlninja', 'bbqsql', 'jsql-injection', 'nosqlmap',
        'xsser', 'xsstrike', 'dalfox', 'kxss',
        'wpscan', 'droopescan', 'joomscan', 'cmsmap', 'cmseek',
        'nikto', 'wapiti', 'skipfish', 'arachni',
        'dirb', 'dirbuster', 'gobuster', 'ffuf', 'feroxbuster', 'dirsearch',
        'wfuzz', 'arjun', 'paramspider',
        'whatweb', 'webanalyze', 'httprint', 'httprecon',
        'commix', 'tplmap',
        'weevely', 'webacoo',
        'fimap', 'kadimus', 'lfimap',
        'wpscan', 'plecost', 'wordpress-exploit-framework',
        'cewl', 'cupp', 'crunch',
        'padbuster', 'padding-oracle-attacker',
        'jwt-tool', 'jwt-cracker',
        'subzy', 'subjack', 'can-i-take-over-xyz',
        'waybackurls', 'gau', 'hakrawler',
        'gospider', 'photon', 'katana',
        'linkfinder', 'secretfinder', 'jsparser',
        'graphqlmap', 'clairvoyance',
        'sstimap', 'ssti', 'tplmap',
        'crlfuzz', 'crlfsuite',
        'http-prompt', 'httpie', 'curlie',
        'smuggler', 'http-smuggling',
        'webshells', 'laudanum', 'webshell',
    ],
    
    # Password Attacks
    'password_attacks': [
        'john', 'johntheripper', 'hashcat', 'ophcrack', 'rainbowcrack',
        'hydra', 'medusa', 'ncrack', 'patator', 'crowbar',
        'cewl', 'crunch', 'cupp', 'rsmangler', 'mentalist',
        'hashid', 'hash-identifier', 'haiti', 'name-that-hash',
        'fcrackzip', 'pdfcrack', 'rarcrack', 'truecrack',
        'aircrack-ng', 'cowpatty', 'pyrit', 'asleap',
        'chntpw', 'samdump2', 'pwdump', 'mimikatz', 'pypykatz',
        'impacket-secretsdump', 'secretsdump',
        'keepass2john', 'ssh2john', 'zip2john', 'rar2john',
        'pdf2john', 'office2john', 'bitlocker2john',
        'hashcat-utils', 'princeprocessor', 'kwprocessor',
        'responder', 'inveigh', 'ntlmrelayx',
        'crackmapexec', 'netexec', 'nxc',
        'kerbrute', 'rubeus', 'kerberoast',
        'ldapsearch', 'windapsearch',
        'spray', 'trevorspray', 'sprayingtoolkit',
        'o365spray', 'msolspray',
        'default-credentials', 'changeme', 'brutespray',
        'pack', 'statsgen', 'maskgen',
        'pipal', 'pcap2john',
        'htpasswd', 'mkpasswd',
        'ccrypt', 'gpg',
        'bopscrk', 'wordlister',
    ],
    
    # Wireless Attacks
    'wireless_attacks': [
        'aircrack-ng', 'airmon-ng', 'airodump-ng', 'aireplay-ng', 'airbase-ng',
        'airgeddon', 'wifite', 'fluxion', 'wifiphisher', 'eaphammer',
        'bettercap', 'ettercap', 'mdk3', 'mdk4',
        'kismet', 'giskismet', 'horst',
        'reaver', 'bully', 'pixiewps',
        'fern-wifi-cracker', 'wifipumpkin3',
        'asleap', 'cowpatty', 'pyrit', 'hashcat',
        'hcxdumptool', 'hcxpcaptool', 'hcxtools',
        'wpaclean', 'cap2hccapx', 'hccap2john',
        'macchanger', 'ifconfig', 'iw', 'iwconfig',
        'rfkill', 'wavemon', 'linssid',
        'crackle', 'btlejack', 'ubertooth',
        'bluez', 'bluez-tools', 'bluesnarfer', 'blueranger',
        'spooftooph', 'redfang', 'bluelog', 'btscanner',
        'hackrf', 'gqrx', 'gnuradio', 'sdr',
        'rtl-sdr', 'rtlsdr-scanner',
        'wifi-honey',
        'hostapd', 'hostapd-wpe',
        'freeradius', 'freeradius-wpe',
        'chirp',
    ],
    
    # Sniffing & Spoofing
    'sniffing_spoofing': [
        'wireshark', 'tshark', 'tcpdump', 'tcpflow', 'ngrep',
        'ettercap', 'bettercap', 'mitmproxy', 'mitmf',
        'arpspoof', 'dnsspoof', 'macof', 'tcpreplay',
        'dsniff', 'filesnarf', 'mailsnarf', 'urlsnarf', 'webspy',
        'responder', 'inveigh', 'ntlmrelayx', 'impacket',
        'sslstrip', 'sslsplit',
        'scapy', 'hping3', 'nping', 'yersinia',
        'netsniff-ng', 'tcpreplay', 'bittwist',
        'driftnet', 'tcpick', 'tcpxtract',
        'sniffer', 'hexinject', 'tcpspy',
        'p0f', 'prads', 'satoroean',
        'sniffjoke', 'fragroute', 'fragrouter',
        'nemesis', 'packit', 'packeth',
        'macchanger', 'arpmitm',
        'dnschef', 'dnsproxy',
        'rebind', 'dnsspoof',
        'xerosploit', 'morpheus',
        'hamster', 'ferret',
        'sslcaudit', 'ssldump',
        'voiphopper', 'iaxflood', 'inviteflood',
        'darkstat', 'iftop', 'nethogs', 'bmon',
    ],
    
    # Exploitation Tools
    'exploitation': [
        'metasploit-framework', 'msfconsole', 'msfvenom', 'msfdb',
        'armitage', 'cobalt-strike', 'covenant',
        'exploitdb', 'searchsploit', 'getsploit',
        'beef-xss', 'xsser', 'xsstrike',
        'sqlmap', 'sqlninja', 'bbqsql',
        'commix', 'fimap', 'kadimus',
        'shellnoob', 'shellter', 'veil', 'veil-evasion',
        'unicorn', 'msfpc', 'msfvenom',
        'empire', 'starkiller', 'powershell-empire',
        'covenant', 'merlin', 'pupy', 'silenttrinity',
        'pwncat', 'villain', 'hoaxshell',
        'crackmapexec', 'netexec', 'impacket',
        'evil-winrm', 'wmiexec', 'psexec', 'smbexec', 'atexec',
        'mimikatz', 'pypykatz', 'lsassy',
        'rubeus', 'certify', 'certipy',
        'bloodhound', 'sharphound', 'azurehound',
        'powersploit', 'nishang', 'powercat',
        'routersploit', 'autosploit',
        'social-engineer-toolkit', 'set', 'setoolkit',
        'gophish', 'king-phisher', 'evilginx2',
        'beef', 'browser-exploitation-framework',
        'backdoor-factory', 'cymothoa', 'shellcodeexec',
    ],
    
    # Post Exploitation
    'post_exploitation': [
        'mimikatz', 'pypykatz', 'lsassy', 'secretsdump',
        'crackmapexec', 'netexec', 'impacket',
        'evil-winrm', 'winrm', 'psexec', 'wmiexec',
        'powersploit', 'nishang', 'powercat', 'powershell',
        'bloodhound', 'sharphound', 'azurehound',
        'empire', 'starkiller',
        'merlin', 'covenant', 'pupy', 'silenttrinity',
        'pwncat', 'villain',
        'chisel', 'ligolo', 'gost', 'ssf',
        'socat', 'netcat', 'ncat', 'nc',
        'proxychains', 'proxychains4', 'redsocks',
        'sshuttle', 'chisel', 'rpivot',
        'metasploit', 'meterpreter', 'msfvenom',
        'linpeas', 'winpeas', 'linenum', 'linux-exploit-suggester',
        'pspy', 'linuxprivchecker',
        'seatbelt', 'sharpup', 'powerup',
        'wesng', 'windows-exploit-suggester',
        'rubeus', 'certify', 'certipy',
        'dnscat2', 'iodine', 'dns2tcp',
        'icmpsh', 'ptunnel', 'udptunnel',
        'webshells', 'weevely', 'webacoo',
        'cymothoa', 'backdoor-factory',
        'creddump7', 'creddump',
    ],
    
    # Forensics
    'forensics': [
        'autopsy', 'sleuthkit', 'foremost', 'scalpel', 'photorec', 'testdisk',
        'volatility', 'volatility3', 'rekall',
        'binwalk', 'firmware-mod-kit',
        'bulk_extractor', 'dc3dd', 'dcfldd', 'dd_rescue',
        'guymager', 'ewfacquire', 'afflib',
        'hashdeep', 'md5deep', 'ssdeep',
        'exiftool', 'exiv2', 'metacam',
        'steghide', 'stegseek', 'stegcracker', 'zsteg', 'stegsolve',
        'outguess', 'openstego',
        'pdfparser', 'pdf-parser', 'pdfid', 'peepdf',
        'oletools', 'olevba', 'mraptor', 'rtfobj',
        'yara', 'clamav', 'chkrootkit', 'rkhunter',
        'unhide', 'osquery',
        'magicrescue', 'recoverjpeg', 'safecopy',
        'xplico', 'networkminer', 'capanalysis',
        'tcpflow', 'tcpxtract', 'tcpreplay',
        'wireshark', 'tshark', 'editcap', 'mergecap',
        'regripper', 'reglookup', 'hivex',
        'plaso', 'log2timeline', 'timesketch',
        'blkcalc', 'blkcat', 'blkls', 'blkstat',
        'fls', 'fsstat', 'icat', 'ifind', 'ils', 'istat',
        'mmcat', 'mmls', 'mmstat',
        'srch_strings', 'sigfind', 'img_stat',
        'chkrootkit', 'rkhunter', 'unhide',
    ],
    
    # Reverse Engineering
    'reverse_engineering': [
        'ghidra', 'ida', 'ida-free', 'binary-ninja', 'cutter', 'radare2', 'r2',
        'gdb', 'peda', 'gef', 'pwndbg', 'edb', 'ollydbg', 'x64dbg',
        'objdump', 'readelf', 'nm', 'strings', 'file', 'hexdump', 'xxd',
        'ltrace', 'strace', 'dtrace',
        'apktool', 'jadx', 'dex2jar', 'jd-gui', 'bytecode-viewer',
        'androguard', 'frida', 'objection',
        'dnspy', 'ilspy', 'dotpeek', 'de4dot',
        'upx', 'unp', 'die', 'detect-it-easy',
        'yara', 'yarac', 'clamav',
        'pefile', 'pyew', 'pescanner',
        'capstone', 'keystone', 'unicorn',
        'binwalk', 'firmware-mod-kit',
        'angr', 'manticore', 'triton',
        'ropper', 'ropgadget', 'mona',
        'pwntools', 'ropeme',
        'afl', 'afl-fuzz', 'libfuzzer', 'honggfuzz',
        'valgrind', 'asan', 'msan', 'tsan',
        'cstool', 'rp++',
    ],
    
    # Reporting Tools
    'reporting': [
        'dradis', 'faraday', 'magictree',
        'cutycapt', 'eyewitness', 'gowitness', 'aquatone',
        'pipal', 'recong', 'metagoofil',
        'cherrytree', 'keepnote', 'zim',
        'maltego', 'casefile',
        'defectdojo',
    ],
    
    # Social Engineering
    'social_engineering': [
        'social-engineer-toolkit', 'set', 'setoolkit',
        'gophish', 'king-phisher', 'evilginx2',
        'beef-xss', 'beef',
        'wifiphisher', 'fluxion',
        'maltego', 'creepy', 'metagoofil',
        'theharvester', 'recon-ng', 'osrframework',
        'urlcrazy', 'dnstwist', 'catphish',
        'swaks', 'smtp-user-enum',
    ],
    
    # Networking
    'networking': [
        'netcat', 'nc', 'ncat', 'socat',
        'ssh', 'sshpass', 'proxytunnel',
        'proxychains', 'proxychains4', 'redsocks',
        'tor', 'torsocks', 'privoxy',
        'openvpn', 'wireguard', 'ipsec',
        'iptables', 'nftables', 'ufw',
        'tcpdump', 'wireshark', 'tshark',
        'nmap', 'masscan', 'zmap',
        'curl', 'wget', 'httpie', 'http-prompt',
        'dig', 'host', 'nslookup', 'whois',
        'netstat', 'ss', 'lsof', 'fuser',
        'route', 'ip', 'ifconfig', 'iwconfig',
        'ping', 'traceroute', 'mtr', 'tracepath',
        'telnet', 'ftp', 'sftp', 'scp', 'rsync',
        'smbclient', 'rpcclient', 'mount.cifs',
        'rdesktop', 'xfreerdp', 'remmina',
        'vnc', 'tigervnc', 'x11vnc',
    ],
}

# Plan requirements based on tool danger level and complexity
PLAN_REQUIREMENTS = {
    # Trial tools (0) - none
    'trial': [],
    
    # Starter tools (basic reconnaissance)
    'starter': [
        'nmap', 'dig', 'host', 'whois', 'ping', 'traceroute',
        'curl', 'wget', 'netcat', 'nc', 'telnet',
        'whatweb', 'httpie', 'file', 'strings', 'xxd',
        'base64', 'md5sum', 'sha256sum',
        'tcpdump',
    ],
    
    # Professional tools (most tools)
    'professional': [
        'nikto', 'gobuster', 'ffuf', 'dirb', 'dirsearch',
        'sqlmap', 'wpscan', 'nuclei', 'burpsuite',
        'hydra', 'john', 'hashcat', 'medusa',
        'wireshark', 'tshark', 'ettercap',
        'searchsploit', 'exploitdb',
        'volatility', 'foremost', 'binwalk',
        'ghidra', 'radare2', 'gdb',
        'amass', 'subfinder', 'theharvester',
        'responder', 'crackmapexec',
        # ... most tools go here
    ],
    
    # Team tools (advanced)
    'team': [
        'metasploit', 'msfconsole', 'armitage',
        'bettercap', 'mitmproxy',
        'bloodhound', 'mimikatz',
        'aircrack-ng', 'wifite',
        'set', 'beef-xss',
        'empire', 'covenant',
        # ... advanced tools
    ],
    
    # Enterprise tools (dangerous/all)
    'enterprise': [
        'cobalt-strike', 'veil', 'shellter',
        'openvas', 'nessus',
        'maltego',
        # ... all remaining tools
    ],
}

def get_desktop_info(desktop_file: str) -> dict:
    """Parse .desktop file for tool info"""
    info = {'name': '', 'exec': '', 'comment': '', 'categories': '', 'icon': ''}
    try:
        with open(desktop_file, 'r', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if line.startswith('Name='):
                    info['name'] = line[5:]
                elif line.startswith('Exec='):
                    info['exec'] = line[5:]
                elif line.startswith('Comment='):
                    info['comment'] = line[8:]
                elif line.startswith('Categories='):
                    info['categories'] = line[11:]
                elif line.startswith('Icon='):
                    info['icon'] = line[5:]
    except Exception as e:
        pass
    return info

def determine_category(tool_name: str, desktop_categories: str = '') -> str:
    """Determine tool category based on name and desktop categories"""
    tool_lower = tool_name.lower()
    
    # Check desktop categories first
    if desktop_categories:
        cats_lower = desktop_categories.lower()
        if 'information' in cats_lower or 'gather' in cats_lower or 'recon' in cats_lower:
            return 'information_gathering'
        elif 'vuln' in cats_lower or 'analysis' in cats_lower:
            return 'vulnerability_analysis'
        elif 'web' in cats_lower:
            return 'web_application'
        elif 'password' in cats_lower or 'crack' in cats_lower:
            return 'password_attacks'
        elif 'wireless' in cats_lower or '802' in cats_lower:
            return 'wireless_attacks'
        elif 'sniff' in cats_lower or 'spoof' in cats_lower:
            return 'sniffing_spoofing'
        elif 'exploit' in cats_lower:
            return 'exploitation'
        elif 'post' in cats_lower:
            return 'post_exploitation'
        elif 'forensic' in cats_lower or 'recover' in cats_lower:
            return 'forensics'
        elif 'reverse' in cats_lower or 'debug' in cats_lower:
            return 'reverse_engineering'
        elif 'report' in cats_lower:
            return 'reporting'
        elif 'social' in cats_lower:
            return 'social_engineering'
    
    # Check against our category mappings
    for category, tools in CATEGORY_MAPPINGS.items():
        for t in tools:
            if t.lower() == tool_lower or tool_lower.startswith(t.lower()):
                return category
    
    # Default based on name patterns
    if any(x in tool_lower for x in ['scan', 'enum', 'recon', 'gather', 'discover', 'find']):
        return 'information_gathering'
    elif any(x in tool_lower for x in ['vuln', 'audit', 'check']):
        return 'vulnerability_analysis'
    elif any(x in tool_lower for x in ['web', 'http', 'sql', 'xss', 'inject']):
        return 'web_application'
    elif any(x in tool_lower for x in ['crack', 'hash', 'pass', 'brute']):
        return 'password_attacks'
    elif any(x in tool_lower for x in ['wifi', 'wireless', 'air', 'blue']):
        return 'wireless_attacks'
    elif any(x in tool_lower for x in ['sniff', 'spoof', 'mitm', 'arp']):
        return 'sniffing_spoofing'
    elif any(x in tool_lower for x in ['exploit', 'pwn', 'shell', 'payload']):
        return 'exploitation'
    elif any(x in tool_lower for x in ['forensic', 'carv', 'recov', 'steg']):
        return 'forensics'
    elif any(x in tool_lower for x in ['debug', 'reverse', 'disasm', 'decompil']):
        return 'reverse_engineering'
    
    return 'information_gathering'  # Default category

def determine_plan(tool_name: str, category: str, is_dangerous: bool) -> str:
    """Determine minimum plan required for tool"""
    tool_lower = tool_name.lower()
    
    # Check explicit plan requirements
    for plan, tools in PLAN_REQUIREMENTS.items():
        for t in tools:
            if t.lower() == tool_lower or tool_lower.startswith(t.lower()):
                return plan
    
    # Enterprise for dangerous tools
    if is_dangerous:
        return 'enterprise'
    
    # Team for exploitation and post-exploitation
    if category in ['exploitation', 'post_exploitation', 'social_engineering']:
        return 'team'
    
    # Professional for most security tools
    if category in ['vulnerability_analysis', 'web_application', 'password_attacks', 
                    'wireless_attacks', 'sniffing_spoofing', 'forensics', 'reverse_engineering']:
        return 'professional'
    
    # Starter for basic recon
    if category == 'information_gathering':
        return 'professional'
    
    return 'professional'

def is_dangerous_tool(tool_name: str, exec_cmd: str = '') -> bool:
    """Determine if tool is dangerous"""
    dangerous_patterns = [
        'metasploit', 'msfconsole', 'msfvenom', 'armitage',
        'exploit', 'payload', 'shellcode',
        'empire', 'covenant', 'cobalt',
        'mimikatz', 'secretsdump', 'lsassy',
        'evil-winrm', 'psexec', 'wmiexec',
        'beef', 'set', 'social-engineer',
        'backdoor', 'rootkit', 'trojan',
        'veil', 'shellter', 'msfpc',
        'crackmapexec', 'netexec',
        'responder', 'ntlmrelay', 'inveigh',
        'aircrack', 'wifite', 'fluxion',
        'bettercap', 'ettercap', 'mitmproxy',
    ]
    tool_lower = tool_name.lower()
    return any(p in tool_lower for p in dangerous_patterns)

def requires_root(tool_name: str, exec_cmd: str = '') -> bool:
    """Determine if tool requires root"""
    root_patterns = [
        'nmap', 'masscan', 'tcpdump', 'wireshark',
        'aircrack', 'airmon', 'airodump', 'aireplay',
        'ettercap', 'bettercap', 'arpspoof',
        'metasploit', 'msfconsole',
        'hping', 'nping',
        'responder', 'inveigh',
        'chntpw', 'mount', 'dd',
        'iptables', 'nftables',
    ]
    if exec_cmd and ('sudo' in exec_cmd or 'pkexec' in exec_cmd):
        return True
    tool_lower = tool_name.lower()
    return any(p in tool_lower for p in root_patterns)

def is_gui_tool(exec_cmd: str, desktop_categories: str = '') -> bool:
    """Determine if tool requires GUI"""
    gui_patterns = [
        'burpsuite', 'wireshark', 'zaproxy', 'maltego',
        'armitage', 'ghidra', 'ida', 'cutter',
        'autopsy', 'dradis', 'faraday',
        'ettercap', 'zenmap', 'fern',
    ]
    if 'NoDisplay=true' in desktop_categories:
        return False
    if any(p in exec_cmd.lower() for p in gui_patterns):
        return True
    if any(x in desktop_categories.lower() for x in ['x-', 'gtk', 'qt', 'gui']):
        return True
    return False

def find_command(tool_name: str, exec_cmd: str = '') -> Tuple[str, Optional[str]]:
    """Find the actual command/binary for a tool"""
    # Extract command from exec
    if exec_cmd:
        # Remove terminal wrappers
        cmd = exec_cmd.replace('x-terminal-emulator -e', '').strip()
        cmd = cmd.replace('qterminal -e', '').strip()
        cmd = cmd.replace('xterm -e', '').strip()
        # Get first word (command)
        cmd = cmd.split()[0] if cmd else tool_name
        cmd = cmd.replace('"', '').replace("'", '')
        # Handle full paths
        if '/' in cmd:
            cmd = os.path.basename(cmd)
    else:
        cmd = tool_name
    
    # Try to find the binary
    path = shutil.which(cmd)
    if path:
        return cmd, path
    
    # Try common variations
    variations = [
        tool_name,
        tool_name.lower(),
        tool_name.replace('-', ''),
        tool_name.replace('_', '-'),
        tool_name.replace('.sh', ''),
        tool_name.replace('.py', ''),
    ]
    
    for var in variations:
        path = shutil.which(var)
        if path:
            return var, path
    
    return cmd, None

def generate_registry():
    """Generate full tool registry from Kali menu"""
    kali_menu_dir = '/usr/share/kali-menu/applications/'
    
    if not os.path.exists(kali_menu_dir):
        print("ERROR: Kali menu directory not found!")
        return
    
    tools = {}
    
    # Process all .desktop files
    for filename in os.listdir(kali_menu_dir):
        if not filename.endswith('.desktop'):
            continue
        
        filepath = os.path.join(kali_menu_dir, filename)
        info = get_desktop_info(filepath)
        
        # Get tool ID from filename
        tool_id = filename.replace('.desktop', '')
        tool_id = tool_id.replace('kali-', '')  # Remove kali- prefix
        
        # Skip duplicates and non-tools
        if not info['name'] or tool_id in tools:
            continue
        
        # Find command and check if installed
        command, path = find_command(tool_id, info['exec'])
        
        # Determine properties
        category = determine_category(tool_id, info['categories'])
        dangerous = is_dangerous_tool(tool_id, info['exec'])
        plan = determine_plan(tool_id, category, dangerous)
        root_required = requires_root(tool_id, info['exec'])
        gui_required = is_gui_tool(info['exec'], info['categories'])
        
        tools[tool_id] = {
            'name': info['name'] or tool_id.replace('-', ' ').title(),
            'category': category,
            'description': info['comment'] or f"{info['name']} security tool",
            'plan_required': plan,
            'command': command,
            'dangerous': dangerous,
            'requires_root': root_required,
            'gui_only': gui_required,
            'installed': path is not None,
            'path': path,
            'parameters': {},
        }
    
    # Also scan common tool directories for tools not in menu
    additional_dirs = ['/usr/bin', '/usr/sbin', '/usr/local/bin']
    known_tools = [
        'nmap', 'nikto', 'sqlmap', 'hydra', 'john', 'hashcat',
        'gobuster', 'ffuf', 'dirb', 'dirsearch', 'feroxbuster',
        'amass', 'subfinder', 'nuclei', 'httpx', 'httprobe',
        'responder', 'crackmapexec', 'netexec', 'impacket',
        'chisel', 'ligolo', 'socat', 'netcat',
        'volatility', 'binwalk', 'foremost', 'steghide',
        'ghidra', 'radare2', 'gdb', 'ltrace', 'strace',
    ]
    
    for tool in known_tools:
        if tool not in tools:
            path = shutil.which(tool)
            if path:
                category = determine_category(tool)
                dangerous = is_dangerous_tool(tool)
                tools[tool] = {
                    'name': tool.replace('-', ' ').title(),
                    'category': category,
                    'description': f"{tool} security tool",
                    'plan_required': determine_plan(tool, category, dangerous),
                    'command': tool,
                    'dangerous': dangerous,
                    'requires_root': requires_root(tool),
                    'gui_only': False,
                    'installed': True,
                    'path': path,
                    'parameters': {},
                }
    
    return tools

def main():
    print("🔧 Generating Full Kali Linux Tool Registry...")
    print()
    
    tools = generate_registry()
    
    # Statistics
    total = len(tools)
    installed = len([t for t in tools.values() if t['installed']])
    
    by_category = {}
    by_plan = {'trial': 0, 'starter': 0, 'professional': 0, 'team': 0, 'enterprise': 0}
    dangerous_count = 0
    gui_count = 0
    root_count = 0
    
    for tool in tools.values():
        cat = tool['category']
        by_category[cat] = by_category.get(cat, 0) + 1
        
        if tool['installed']:
            plan = tool['plan_required']
            for p in ['starter', 'professional', 'team', 'enterprise']:
                if PLAN_REQUIREMENTS.get(p) is None or plan in ['trial', 'starter', 'professional', 'team', 'enterprise'][:['trial', 'starter', 'professional', 'team', 'enterprise'].index(p)+1]:
                    by_plan[p] += 1
        
        if tool['dangerous']:
            dangerous_count += 1
        if tool['gui_only']:
            gui_count += 1
        if tool['requires_root']:
            root_count += 1
    
    print(f"📊 Total Tools: {total}")
    print(f"✅ Installed: {installed}")
    print(f"❌ Not Installed: {total - installed}")
    print()
    print("📦 By Category:")
    for cat, count in sorted(by_category.items(), key=lambda x: -x[1]):
        print(f"   {cat}: {count}")
    print()
    print(f"⚠️ Dangerous: {dangerous_count}")
    print(f"🖥️ GUI Only: {gui_count}")
    print(f"🔐 Root Required: {root_count}")
    
    # Save to file
    output = {
        'tools': tools,
        'statistics': {
            'total': total,
            'installed': installed,
            'by_category': by_category,
            'by_plan': by_plan,
            'dangerous': dangerous_count,
            'gui_only': gui_count,
            'root_required': root_count,
        }
    }
    
    with open('/home/cybersec/cybersec-pro/saas-backend/full_tool_registry.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print()
    print("✅ Registry saved to full_tool_registry.json")
    
    return output

if __name__ == '__main__':
    main()
