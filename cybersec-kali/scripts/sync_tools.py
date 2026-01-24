#!/usr/bin/env python3
"""
Script to sync tool installation status with actual system state
"""

import subprocess
import sqlite3
import os

DB_PATH = '/home/sam/APPS/cybersec-kali/backend/instance/cybersec.db'

# Map tool names to their actual binary/package names
TOOL_BINARY_MAP = {
    'Nmap': ['nmap'],
    'Netdiscover': ['netdiscover'],
    'Masscan': ['masscan'],
    'Recon-ng': ['recon-ng'],
    'theHarvester': ['theHarvester', 'theharvester'],
    'Shodan CLI': ['shodan'],
    'Maltego': ['maltego'],
    'SpiderFoot': ['spiderfoot'],
    'Dmitry': ['dmitry'],
    'DNSenum': ['dnsenum'],
    'Nikto': ['nikto'],
    'OpenVAS': ['openvas', 'gvm'],
    'Lynis': ['lynis'],
    'Nessus': ['nessus'],
    'Wapiti': ['wapiti'],
    'Burp Suite': ['burpsuite', 'burp'],
    'OWASP ZAP': ['zaproxy', 'zap'],
    'SQLMap': ['sqlmap'],
    'Commix': ['commix'],
    'WPScan': ['wpscan'],
    'Joomla Scanner': ['joomscan', 'joomla-scanner'],
    'Skipfish': ['skipfish'],
    'Dirb': ['dirb'],
    'Dirbuster': ['dirbuster'],
    'Gobuster': ['gobuster'],
    'SQLNinja': ['sqlninja'],
    'Hexorbase': ['hexorbase'],
    'Hashcat': ['hashcat'],
    'John the Ripper': ['john'],
    'Hydra': ['hydra'],
    'Medusa': ['medusa'],
    'Crunch': ['crunch'],
    'CeWL': ['cewl'],
    'Aircrack-ng': ['aircrack-ng'],
    'Reaver': ['reaver'],
    'Kismet': ['kismet'],
    'Fern Wifi Cracker': ['fern-wifi-cracker'],
    'Wifite': ['wifite'],
    'Radare2': ['radare2', 'r2'],
    'Ghidra': ['ghidra'],
    'GDB': ['gdb'],
    'OllyDbg': ['ollydbg'],
    'IDA Free': ['ida', 'ida64'],
    'Metasploit': ['msfconsole', 'metasploit-framework'],
    'BeEF': ['beef-xss', 'beef'],
    'SET': ['setoolkit'],
    'Armitage': ['armitage'],
    'ExploitDB': ['searchsploit'],
    'Veil': ['veil'],
    'PowerSploit': ['powersploit'],
    'Mimikatz': ['mimikatz'],
    'Empire': ['empire', 'starkiller'],
    'Wireshark': ['wireshark'],
    'Tcpdump': ['tcpdump'],
    'Ettercap': ['ettercap'],
    'Bettercap': ['bettercap'],
    'Dsniff': ['dsniff'],
    'Arpwatch': ['arpwatch'],
    'Responder': ['responder'],
    'MITMf': ['mitmf'],
    'Netcat': ['nc', 'netcat', 'ncat'],
    'Socat': ['socat'],
    'Mimikatz': ['mimikatz'],
    'Empire': ['empire'],
    'PowerSploit': ['powersploit'],
    'Volatility': ['vol', 'volatility', 'volatility3'],
    'Autopsy': ['autopsy'],
    'Sleuthkit': ['mmls', 'fls'],
    'Foremost': ['foremost'],
    'Bulk Extractor': ['bulk_extractor'],
    'Binwalk': ['binwalk'],
    'Dradis': ['dradis'],
    'Faraday': ['faraday'],
    'King Phisher': ['king-phisher'],
    'Ghost Phisher': ['ghost-phisher'],
    'LOIC': ['loic'],
    'HOIC': ['hoic'],
    'Arduino': ['arduino'],
    'Proxmark3': ['proxmark3'],
    'Drozer': ['drozer'],
    'MobSF': ['mobsf'],
    'APKTool': ['apktool'],
    'Frida': ['frida'],
    'Cutter': ['cutter', 'iaito'],
    'Curl': ['curl'],
    'Wget': ['wget'],
    'Ping': ['ping'],
    'Traceroute': ['traceroute'],
    'Dig': ['dig'],
    'Whois': ['whois'],
    'Fierce': ['fierce'],
    'Sublist3r': ['sublist3r'],
    'Amass': ['amass'],
    'FFuF': ['ffuf'],
    'Nuclei': ['nuclei'],
    'Subfinder': ['subfinder'],
    'Httpx': ['httpx'],
    'Naabu': ['naabu'],
    'XSStrike': ['xsstrike'],
    'SQLiScanner': ['sqliscanner'],
    'Enum4linux': ['enum4linux'],
    'SMBClient': ['smbclient'],
    'CrackMapExec': ['crackmapexec', 'cme'],
    'Evil-WinRM': ['evil-winrm'],
    'Impacket': ['impacket-scripts', 'secretsdump.py'],
    'BloodHound': ['bloodhound'],
    'SharpHound': ['sharphound'],
    'Certutil': ['certutil'],
    'PowerShell': ['pwsh', 'powershell'],
    'Docker': ['docker'],
    'Git': ['git'],
    'Python': ['python3', 'python'],
    'Ruby': ['ruby'],
    'Perl': ['perl'],
    'PHP': ['php'],
    'Ncrack': ['ncrack'],
    'Patator': ['patator'],
    'SecLists': ['/usr/share/seclists'],
    'Wordlists': ['/usr/share/wordlists'],
    'SQLite Database Browser': ['sqlitebrowser', 'db-browser-sqlite'],
    'Social Engineering Toolkit': ['setoolkit', 'se-toolkit'],
    'Slowloris': ['slowloris', 'slowhttptest'],
}

# Map tool names to pip package names
TOOL_PIP_MAP = {
    'Commix': 'commix',
    'Droopescan': 'droopescan',
    'AWS CLI': 'awscli',
    'Impacket': 'impacket',
    'Pwntools': 'pwntools',
    'Ropper': 'ropper',
    'ROPgadget': 'ROPGadget',
    'XSSer': 'xsser',
}

def check_pip_installed(package_name):
    """Check if a pip package is installed"""
    try:
        result = subprocess.run(['pip3', 'show', package_name], capture_output=True, text=True)
        return result.returncode == 0
    except:
        return False

def check_tool_installed(tool_name):
    """Check if a tool is installed on the system"""
    
    # First check if it's a pip package
    if tool_name in TOOL_PIP_MAP:
        if check_pip_installed(TOOL_PIP_MAP[tool_name]):
            return True
    
    binaries = TOOL_BINARY_MAP.get(tool_name, [tool_name.lower().replace(' ', '-')])
    
    for binary in binaries:
        # Check if it's a file path
        if binary.startswith('/'):
            if os.path.exists(binary):
                return True
            continue
            
        # Check using which
        try:
            result = subprocess.run(['which', binary], capture_output=True, text=True)
            if result.returncode == 0:
                return True
        except:
            pass
        
        # Check using dpkg
        try:
            result = subprocess.run(['dpkg', '-l', binary], capture_output=True, text=True)
            if result.returncode == 0 and 'ii' in result.stdout:
                return True
        except:
            pass
        
        # Check using command -v
        try:
            result = subprocess.run(['bash', '-c', f'command -v {binary}'], capture_output=True, text=True)
            if result.returncode == 0:
                return True
        except:
            pass
    
    return False

def sync_database():
    """Sync tool installation status with actual system state"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get all tools
    cursor.execute('SELECT id, name, installed FROM tools')
    tools = cursor.fetchall()
    
    updated = 0
    installed_count = 0
    not_installed_count = 0
    
    print("=" * 60)
    print("  Tool Installation Status Sync")
    print("=" * 60)
    print()
    
    for tool_id, name, current_status in tools:
        is_installed = check_tool_installed(name)
        
        if is_installed:
            installed_count += 1
        else:
            not_installed_count += 1
        
        if is_installed != bool(current_status):
            status_text = "✅ INSTALLED" if is_installed else "❌ NOT INSTALLED"
            print(f"  {name}: {status_text} (was: {'installed' if current_status else 'not installed'})")
            
            cursor.execute('UPDATE tools SET installed = ? WHERE id = ?', (is_installed, tool_id))
            updated += 1
    
    conn.commit()
    conn.close()
    
    print()
    print("=" * 60)
    print(f"  Summary:")
    print(f"    Total tools: {len(tools)}")
    print(f"    Installed: {installed_count}")
    print(f"    Not installed: {not_installed_count}")
    print(f"    Database updated: {updated} records")
    print("=" * 60)

if __name__ == '__main__':
    sync_database()
