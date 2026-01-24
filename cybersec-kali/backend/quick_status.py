#!/usr/bin/env python3
"""
Quick Tools Status Update - Hızlı araç durumu güncelleme
"""
from flask import Flask
from models import db, Tool
from config import Config

def quick_update_tools():
    """Hızlı araç durumu güncelleme"""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        # Bilinen kurulu araçlar
        installed_tools = [
            'nmap', 'nikto', 'sqlmap', 'metasploit', 'burpsuite', 'zaproxy',
            'wireshark', 'john', 'hashcat', 'hydra', 'aircrack-ng', 'reaver',
            'binwalk', 'foremost', 'volatility3', 'radare2', 'ghidra',
            'impacket', 'bloodhound', 'nuclei', 'subfinder', 'httpx',
            'gobuster', 'feroxbuster', 'wfuzz', 'ffuf', 'arjun', 'xsser',
            'enum4linux', 'dnsrecon', 'theharvester', 'sherlock', 'amass',
            'dirb', 'dirbuster', 'whatweb', 'wafw00f', 'droopescan', 'wpscan',
            'searchsploit', 'pwntools', 'ropper', 'ropgadget', 'cupp',
            'hash-identifier', 'pixiewps', 'bully', 'strings', 'file',
            'exiftool', 'steghide', 'testdisk', 'photorec', 'sleuthkit',
            'gdb', 'objdump', 'ltrace', 'strace', 'scoutsuite', 'pacu',
            'tshark', 'tcpdump', 'ettercap', 'dsniff', 'mitmproxy',
            'netdiscover', 'arp-scan', 'nbtscan', 'sslyze', 'sslscan',
            'cadaver', 'davtest', 'hashid', 'fcrackzip', 'pdfcrack',
            'hping3', 'ncat', 'socat', 'proxychains4', 'tor', 'macchanger',
            'ifconfig', 'snmpwalk', 'onesixtyone', 'smtp-user-enum',
            'ike-scan', 'hexdump', 'xxd', 'tcpflow', 'tcpreplay', 'scapy',
            'fierce', 'sublist3r', 'spiderfoot', 'recon-ng', 'masscan'
        ]
        
        # Tüm araçları güncelle
        tools = Tool.query.all()
        updated = 0
        
        for tool in tools:
            tool_name = tool.name.lower().replace(' ', '-')
            command = tool.command.split()[0] if tool.command else tool_name
            
            # Basit kontrol
            if any(installed in command.lower() or installed in tool_name for installed in installed_tools):
                if not tool.installed:
                    tool.installed = True
                    updated += 1
            else:
                if tool.installed:
                    tool.installed = False
                    updated += 1
        
        db.session.commit()
        
        # İstatistikler
        total = len(tools)
        installed_count = Tool.query.filter_by(installed=True).count()
        percentage = round(installed_count / total * 100, 1) if total > 0 else 0
        
        print(f"✅ Güncelleme tamamlandı!")
        print(f"📊 Toplam araç: {total}")
        print(f"🔧 Kurulu araç: {installed_count}")
        print(f"📈 Kurulum oranı: {percentage}%")
        print(f"🔄 Güncellenen: {updated}")
        
        return {
            'total': total,
            'installed': installed_count,
            'percentage': percentage,
            'updated': updated
        }

if __name__ == "__main__":
    quick_update_tools()