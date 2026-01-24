#!/usr/bin/env python3
"""
CyberSec Pro - Mass Tool Installation
Eksik araçları toplu olarak kurar
"""
import subprocess
import os
import sys

def run_cmd(cmd):
    """Komut çalıştır"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return result.returncode == 0, result.stdout, result.stderr
    except:
        return False, "", "timeout"

def install_tools():
    """Araçları toplu kur"""
    print("🚀 CyberSec Pro - Mass Tool Installation")
    print("=" * 50)
    
    installed = 0
    
    # APT araçları
    apt_tools = [
        'unicornscan', 'zmap', 'rustscan', 'photon', 'osintgram', 'knockpy',
        'paramspider', 'linkfinder', 'secretfinder', 'cmseek', 'joomscan',
        'drupwn', 'cmsmap', 'skipfish', 'uniscan', 'arachni', 'bbqsql',
        'nosqlmap', 'mongoaudit', 'hexorbase', 'padbuster', 'veil', 'empire',
        'psexec', 'wmiexec', 'covenant', 'sliver', 'havoc', 'rainbowcrack',
        'airgeddon', 'wifi-pumpkin', 'fluxion', 'wifipumpkin3', 'stegsolve',
        'cutter', 'jd-gui', 'hopper', 'legion', 'pwncat', 'linpeas', 'winpeas',
        'faraday', 'cutycapt', 'eyewitness', 'king-phisher', 'evilginx2',
        'modlishka', 'proxmark3', 'drozer', 'mobsf', 'maltego', 'shodan',
        'censys', 'zgrab2', 'aquatone'
    ]
    
    print("📦 Installing APT packages...")
    for tool in apt_tools:
        print(f"   Installing {tool}...")
        success, _, _ = run_cmd(f"sudo apt install -y {tool}")
        if success:
            print(f"   ✅ {tool}")
            installed += 1
        else:
            print(f"   ❌ {tool}")
    
    # PIPX araçları
    pipx_tools = [
        'volatility3', 'impacket', 'netexec', 'bloodhound-python',
        'scoutsuite', 'pacu', 'sherlock-project', 'droopescan',
        'arjun', 'xsser', 'linkfinder', 'secretfinder'
    ]
    
    print("\n🐍 Installing PIPX packages...")
    for tool in pipx_tools:
        print(f"   Installing {tool}...")
        success, _, _ = run_cmd(f"pipx install {tool}")
        if success:
            print(f"   ✅ {tool}")
            installed += 1
        else:
            print(f"   ❌ {tool}")
    
    # GO araçları
    go_tools = [
        ('github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest', 'subfinder'),
        ('github.com/projectdiscovery/httpx/cmd/httpx@latest', 'httpx'),
        ('github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest', 'nuclei'),
        ('github.com/hakluke/hakrawler@latest', 'hakrawler'),
        ('github.com/jaeles-project/gospider@latest', 'gospider'),
        ('github.com/hahwul/dalfox/v2@latest', 'dalfox'),
        ('github.com/ffuf/ffuf@latest', 'ffuf'),
        ('github.com/OJ/gobuster/v3@latest', 'gobuster'),
        ('github.com/epi052/feroxbuster@latest', 'feroxbuster'),
        ('github.com/lc/gau/v2/cmd/gau@latest', 'gau'),
        ('github.com/tomnomnom/waybackurls@latest', 'waybackurls'),
        ('github.com/tomnomnom/assetfinder@latest', 'assetfinder')
    ]
    
    print("\n🔧 Installing GO tools...")
    for repo, name in go_tools:
        print(f"   Installing {name}...")
        success, _, _ = run_cmd(f"go install {repo}")
        if success:
            print(f"   ✅ {name}")
            installed += 1
        else:
            print(f"   ❌ {name}")
    
    # Snap araçları
    snap_tools = [
        'ghidra', 'zaproxy', 'trivy', 'kubectl'
    ]
    
    print("\n📦 Installing SNAP packages...")
    for tool in snap_tools:
        print(f"   Installing {tool}...")
        success, _, _ = run_cmd(f"sudo snap install {tool}")
        if success:
            print(f"   ✅ {tool}")
            installed += 1
        else:
            print(f"   ❌ {tool}")
    
    print("\n" + "=" * 50)
    print(f"🎯 Installation completed!")
    print(f"📦 Installed: {installed} tools")
    print("🔄 Updating database...")
    
    # Database güncelle
    run_cmd("python3 quick_status.py")
    
    return installed

if __name__ == "__main__":
    install_tools()