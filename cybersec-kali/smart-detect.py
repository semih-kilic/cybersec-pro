#!/usr/bin/env python3
"""
Smart Tool Detection - Akıllı araç tespiti
Mevcut araçları daha iyi tespit eder
"""
import subprocess
import os
import glob
from pathlib import Path

def find_tools():
    """Sistemdeki araçları akıllıca bul"""
    print("🔍 Smart Tool Detection")
    print("=" * 40)
    
    found_tools = set()
    
    # 1. PATH'teki tüm executable'ları tara
    print("📂 Scanning PATH directories...")
    path_dirs = os.environ.get('PATH', '').split(':')
    for path_dir in path_dirs:
        if os.path.exists(path_dir):
            try:
                for file in os.listdir(path_dir):
                    if os.access(os.path.join(path_dir, file), os.X_OK):
                        found_tools.add(file)
            except:
                pass
    
    # 2. Snap packages
    print("📦 Scanning snap packages...")
    try:
        result = subprocess.run(['snap', 'list'], capture_output=True, text=True)
        if result.returncode == 0:
            for line in result.stdout.split('\n')[1:]:
                if line.strip():
                    snap_name = line.split()[0]
                    found_tools.add(snap_name)
    except:
        pass
    
    # 3. Python packages
    print("🐍 Scanning Python packages...")
    try:
        result = subprocess.run(['pip', 'list'], capture_output=True, text=True)
        if result.returncode == 0:
            for line in result.stdout.split('\n')[2:]:
                if line.strip():
                    pkg_name = line.split()[0].lower()
                    found_tools.add(pkg_name)
    except:
        pass
    
    # 4. Go binaries
    print("🔧 Scanning Go binaries...")
    go_bin = os.path.expanduser('~/go/bin')
    if os.path.exists(go_bin):
        for file in os.listdir(go_bin):
            if os.access(os.path.join(go_bin, file), os.X_OK):
                found_tools.add(file)
    
    # 5. Local binaries
    print("🏠 Scanning local binaries...")
    local_bin = os.path.expanduser('~/.local/bin')
    if os.path.exists(local_bin):
        for file in os.listdir(local_bin):
            if os.access(os.path.join(local_bin, file), os.X_OK):
                found_tools.add(file)
    
    # 6. Common tool locations
    print("📍 Scanning common locations...")
    common_locations = [
        '/opt/*/bin/*',
        '/opt/*/*',
        '/usr/share/*/bin/*',
        '/usr/share/*/*'
    ]
    
    for pattern in common_locations:
        for path in glob.glob(pattern):
            if os.path.isfile(path) and os.access(path, os.X_OK):
                tool_name = os.path.basename(path)
                found_tools.add(tool_name)
    
    print(f"\n🎯 Found {len(found_tools)} potential tools")
    
    # Security tools mapping
    security_tools = {
        'nmap', 'nikto', 'sqlmap', 'metasploit', 'msfconsole', 'msfvenom',
        'burpsuite', 'zaproxy', 'wireshark', 'tshark', 'john', 'hashcat',
        'hydra', 'medusa', 'aircrack-ng', 'reaver', 'binwalk', 'foremost',
        'volatility', 'volatility3', 'radare2', 'r2', 'ghidra', 'gdb',
        'objdump', 'strings', 'ltrace', 'strace', 'nuclei', 'subfinder',
        'httpx', 'gobuster', 'feroxbuster', 'wfuzz', 'ffuf', 'arjun',
        'xsser', 'crackmapexec', 'netexec', 'nxc', 'cme', 'impacket',
        'enum4linux', 'bloodhound', 'neo4j', 'dnsrecon', 'theharvester',
        'sherlock', 'amass', 'dirb', 'dirbuster', 'whatweb', 'wafw00f',
        'droopescan', 'wpscan', 'searchsploit', 'exploit-db', 'pwntools',
        'ropper', 'ropgadget', 'cupp', 'hash-identifier', 'hashid',
        'pixiewps', 'bully', 'file', 'exiftool', 'steghide', 'testdisk',
        'photorec', 'sleuthkit', 'tcpdump', 'ettercap', 'dsniff',
        'mitmproxy', 'netdiscover', 'arp-scan', 'nbtscan', 'sslyze',
        'sslscan', 'testssl', 'cadaver', 'davtest', 'fcrackzip',
        'pdfcrack', 'hping3', 'ncat', 'socat', 'proxychains', 'proxychains4',
        'tor', 'macchanger', 'ifconfig', 'snmpwalk', 'onesixtyone',
        'smtp-user-enum', 'ike-scan', 'hexdump', 'xxd', 'tcpflow',
        'tcpreplay', 'scapy', 'fierce', 'sublist3r', 'spiderfoot',
        'recon-ng', 'masscan', 'hakrawler', 'gospider', 'dalfox',
        'assetfinder', 'gau', 'waybackurls', 'aquatone', 'eyewitness',
        'scoutsuite', 'scout', 'pacu', 'aws', 'legion'
    }
    
    # Match found tools with security tools
    matched_tools = []
    for tool in security_tools:
        if tool in found_tools:
            matched_tools.append(tool)
        # Check variations
        variations = [
            tool.replace('-', ''),
            tool.replace('_', ''),
            tool.replace('-', '_'),
            tool + '.py',
            tool + '.sh'
        ]
        for var in variations:
            if var in found_tools:
                matched_tools.append(tool)
                break
    
    print(f"🔧 Security tools found: {len(matched_tools)}")
    
    # Print found security tools
    for i, tool in enumerate(sorted(matched_tools), 1):
        print(f"  {i:3d}. {tool}")
    
    return matched_tools

if __name__ == "__main__":
    tools = find_tools()
    print(f"\n✅ Total security tools detected: {len(tools)}")