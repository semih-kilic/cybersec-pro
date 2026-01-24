#!/usr/bin/env python3
"""
Update database from smart detection results
"""
from flask import Flask
from models import db, Tool
from config import Config

def update_tools():
    """Update tools based on detection"""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    # Detected tools list
    detected_tools = [
        'aircrack-ng', 'amass', 'arjun', 'assetfinder', 'aws', 'binwalk',
        'bloodhound', 'bully', 'burpsuite', 'cadaver', 'cupp', 'dalfox',
        'davtest', 'dirb', 'dirbuster', 'dnsrecon', 'droopescan', 'dsniff',
        'ettercap', 'exiftool', 'exploit-db', 'fcrackzip', 'feroxbuster',
        'ffuf', 'fierce', 'file', 'foremost', 'gdb', 'ghidra', 'gobuster',
        'gospider', 'hakrawler', 'hash-identifier', 'hashcat', 'hashid',
        'hexdump', 'hping3', 'httpx', 'hydra', 'ifconfig', 'ike-scan',
        'impacket', 'john', 'ltrace', 'macchanger', 'masscan', 'medusa',
        'metasploit', 'mitmproxy', 'msfconsole', 'msfvenom', 'nbtscan',
        'ncat', 'neo4j', 'netdiscover', 'netexec', 'nikto', 'nmap',
        'nuclei', 'nxc', 'objdump', 'onesixtyone', 'pacu', 'pdfcrack',
        'photorec', 'pixiewps', 'proxychains', 'proxychains4', 'pwntools',
        'r2', 'radare2', 'reaver', 'recon-ng', 'ropgadget', 'ropper',
        'scapy', 'scout', 'scoutsuite', 'searchsploit', 'sherlock',
        'snmpwalk', 'socat', 'spiderfoot', 'sqlmap', 'sslscan', 'steghide',
        'strace', 'strings', 'subfinder', 'sublist3r', 'tcpdump', 'testdisk',
        'theharvester', 'tor', 'tshark', 'volatility3', 'wafw00f', 'wfuzz',
        'whatweb', 'wireshark', 'wpscan', 'xsser', 'xxd', 'zaproxy'
    ]
    
    with app.app_context():
        tools = Tool.query.all()
        updated = 0
        
        for tool in tools:
            tool_name = tool.name.lower().replace(' ', '-')
            command = tool.command.split()[0] if tool.command else tool_name
            
            # Check if detected
            is_detected = any(
                detected in tool_name or 
                detected in command.lower() or
                tool_name in detected or
                command.lower() in detected
                for detected in detected_tools
            )
            
            if is_detected and not tool.installed:
                tool.installed = True
                updated += 1
                print(f"✅ {tool.name}")
        
        db.session.commit()
        
        # Stats
        total = len(tools)
        installed = Tool.query.filter_by(installed=True).count()
        percentage = round(installed / total * 100, 1)
        
        print(f"\n📊 Update completed!")
        print(f"Total: {total}, Installed: {installed} ({percentage}%)")
        print(f"Updated: {updated}")

if __name__ == "__main__":
    update_tools()