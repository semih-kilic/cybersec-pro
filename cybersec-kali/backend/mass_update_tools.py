#!/usr/bin/env python3
"""
Mass Update Tools - Update database with detected tools
"""
import subprocess
import os
from flask import Flask
from models import db, Tool
from config import Config

# List of detected tools from smart-detect (removing duplicates)
DETECTED_TOOLS = [
    'aircrack-ng', 'amass', 'aquatone', 'arjun', 'assetfinder', 'aws', 'binwalk', 
    'bloodhound', 'bully', 'burpsuite', 'cadaver', 'cupp', 'dalfox', 'davtest', 
    'dirb', 'dirbuster', 'dnsrecon', 'droopescan', 'dsniff', 'ettercap', 'exiftool', 
    'exploit-db', 'eyewitness', 'fcrackzip', 'feroxbuster', 'ffuf', 'fierce', 'file', 
    'foremost', 'gau', 'gdb', 'ghidra', 'gobuster', 'gospider', 'hakrawler', 
    'hash-identifier', 'hashcat', 'hashid', 'hexdump', 'hping3', 'httpx', 'hydra', 
    'ifconfig', 'ike-scan', 'impacket', 'john', 'ltrace', 'macchanger', 'masscan', 
    'medusa', 'metasploit', 'mitmproxy', 'msfconsole', 'msfvenom', 'nbtscan', 'ncat', 
    'neo4j', 'netdiscover', 'netexec', 'nikto', 'nmap', 'nuclei', 'nxc', 'objdump', 
    'onesixtyone', 'pacu', 'pdfcrack', 'photorec', 'pixiewps', 'proxychains', 
    'proxychains4', 'pwntools', 'r2', 'radare2', 'reaver', 'recon-ng', 'ropgadget', 
    'ropper', 'scapy', 'scout', 'scoutsuite', 'searchsploit', 'sherlock', 'snmpwalk', 
    'socat', 'spiderfoot', 'sqlmap', 'sslscan', 'sslyze', 'steghide', 'strace', 
    'strings', 'subfinder', 'sublist3r', 'tcpdump', 'tcpflow', 'tcpreplay', 'testdisk', 
    'testssl', 'theharvester', 'tor', 'tshark', 'volatility3', 'wafw00f', 'waybackurls', 
    'wfuzz', 'whatweb', 'wireshark', 'wpscan', 'xsser', 'xxd', 'zaproxy',
    # Additional tools from our installations
    'photon', 'xsstrike', 'linkfinder', 'secretfinder', 'cmseek', 'osintgram', 
    'knockpy', 'dnstwist', 'airgeddon', 'fluxion', 'unicornscan', 'zmap', 'rustscan',
    'skipfish', 'arachni', 'uniscan', 'bbqsql', 'hexorbase', 'veil', 'covenant',
    'sliver', 'havoc', 'rainbowcrack', 'wifi-pumpkin', 'volatility', 'stegsolve',
    'faraday', 'king-phisher', 'modlishka', 'proxmark3', 'legion', 'linpeas',
    'winpeas', 'les', 'mongoaudit', 'drozer', 'mobsf', 'maltego', 'shodan', 'censys'
]

def check_tool_installed(command):
    """Quick check if tool is installed"""
    try:
        result = subprocess.run(['which', command], capture_output=True, text=True)
        if result.returncode == 0:
            return True
        
        # Check common locations
        common_paths = [
            f'/usr/bin/{command}',
            f'/usr/local/bin/{command}',
            f'/opt/security-tools/{command}',
            f'/snap/bin/{command}',
            f'/home/sam/go/bin/{command}',
            f'/home/sam/.local/bin/{command}'
        ]
        
        for path in common_paths:
            if os.path.exists(path):
                return True
        
        return False
    except:
        return False

def mass_update():
    """Mass update all detected tools"""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        tools = Tool.query.all()
        updated = 0
        installed_count = 0
        
        print(f"🔄 Checking {len(tools)} database tools against {len(DETECTED_TOOLS)} detected tools...")
        
        for tool in tools:
            old_status = tool.installed
            
            # Check if tool command is in detected list (case insensitive)
            tool_detected = any(detected.lower() == tool.command.lower() 
                              for detected in DETECTED_TOOLS)
            
            if tool_detected:
                # Double check if tool actually exists
                new_status = check_tool_installed(tool.command)
                
                if old_status != new_status:
                    tool.installed = new_status
                    updated += 1
                    
                    if new_status:
                        print(f"   ✅ {tool.name}: INSTALLED")
                        installed_count += 1
                    else:
                        print(f"   ❌ {tool.name}: REMOVED")
                elif new_status:
                    installed_count += 1
                    if not old_status:
                        tool.installed = True
                        updated += 1
                        print(f"   ✅ {tool.name}: CONFIRMED")
            else:
                # Tool not detected, mark as not installed
                if old_status:
                    tool.installed = False
                    updated += 1
                    print(f"   ❌ {tool.name}: NOT DETECTED")
        
        db.session.commit()
        
        # Get final stats
        total = Tool.query.count()
        final_installed = Tool.query.filter_by(installed=True).count()
        percentage = (final_installed / total * 100) if total > 0 else 0
        
        print(f"\n✅ Mass update completed!")
        print(f"📊 Total tools: {total}")
        print(f"🔧 Installed tools: {final_installed}")
        print(f"📈 Installation rate: {percentage:.1f}%")
        print(f"🔄 Status changes: {updated}")
        
        # Show improvement
        if final_installed >= 165:
            print(f"🎉 SUCCESS! Restored to {final_installed} tools (target was 165+)")
        else:
            print(f"🔄 Progress: {final_installed} tools (need {165 - final_installed} more for 165+)")
        
        return final_installed, total, percentage

if __name__ == "__main__":
    mass_update()