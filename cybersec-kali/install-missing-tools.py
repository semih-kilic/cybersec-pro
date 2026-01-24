#!/usr/bin/env python3
"""
Install Missing Critical Tools - Eksik kritik araçları kur
"""
import subprocess
import os
import time

def run_cmd(cmd, timeout=60):
    """Komut çalıştır"""
    try:
        print(f"🔄 Running: {cmd}")
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        success = result.returncode == 0
        if success:
            print(f"✅ Success")
        else:
            print(f"❌ Failed: {result.stderr[:100]}")
        return success
    except subprocess.TimeoutExpired:
        print(f"⏰ Timeout")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def install_missing_tools():
    """Eksik araçları kur"""
    print("🚀 Installing Missing Critical Tools")
    print("=" * 50)
    
    installed = 0
    
    # 1. APT araçları (kolay kurulum)
    print("\n1️⃣ APT Tools Installation")
    print("-" * 30)
    
    apt_tools = [
        'unicornscan',      # Network scanner
        'skipfish',         # Web scanner  
        'legion',           # Network pentesting
        'cutycapt',         # Screenshot tool
        'eyewitness',       # Web screenshot
        'proxmark3',        # RFID tool
        'rainbowcrack',     # Password cracker
        'stegsolve',        # Steganography
        'cutter',           # Reverse engineering
        'rpcinfo',          # RPC info
        'rwho',             # Remote who
        'rusers',           # Remote users
        'tcpflow',          # TCP flow
        'tcpreplay'         # TCP replay
    ]
    
    for tool in apt_tools:
        if run_cmd(f"sudo apt install -y {tool}"):
            installed += 1
        time.sleep(1)
    
    # 2. Python araçları (pipx ile)
    print("\n2️⃣ Python Tools Installation")
    print("-" * 30)
    
    python_tools = [
        'drozer',           # Android security
        'photon',           # Web crawler
        'osintgram',        # Instagram OSINT
        'knockpy',          # Subdomain scanner
        'paramspider',      # Parameter finder
        'linkfinder',       # Endpoint finder
        'secretfinder',     # Secret finder
        'cmseek',           # CMS scanner
        'joomscan',         # Joomla scanner
        'drupwn',           # Drupal scanner
        'cmsmap',           # CMS mapper
        'nosqlmap',         # NoSQL injection
        'mongoaudit',       # MongoDB audit
        'hexorbase',        # Database assessment
        'bbqsql',           # Blind SQL injection
        'padbuster'         # Padding oracle
    ]
    
    for tool in python_tools:
        if run_cmd(f"pipx install {tool}"):
            installed += 1
        time.sleep(1)
    
    # 3. Go araçları
    print("\n3️⃣ Go Tools Installation")
    print("-" * 30)
    
    go_tools = [
        ('github.com/tomnomnom/gau/v2/cmd/gau@latest', 'gau'),
        ('github.com/tomnomnom/waybackurls@latest', 'waybackurls'),
        ('github.com/projectdiscovery/chaos-client/cmd/chaos@latest', 'chaos'),
        ('github.com/hakluke/haktrails@latest', 'haktrails'),
        ('github.com/projectdiscovery/katana/cmd/katana@latest', 'katana'),
        ('github.com/projectdiscovery/uncover/cmd/uncover@latest', 'uncover')
    ]
    
    for repo, name in go_tools:
        if run_cmd(f"go install {repo}"):
            installed += 1
        time.sleep(1)
    
    # 4. Snap araçları
    print("\n4️⃣ Snap Tools Installation")
    print("-" * 30)
    
    snap_tools = [
        'cutter',           # Reverse engineering
        'ida-free',         # Disassembler (if available)
        'maltego'           # OSINT platform
    ]
    
    for tool in snap_tools:
        if run_cmd(f"sudo snap install {tool}"):
            installed += 1
        time.sleep(1)
    
    # 5. Manuel indirmeler
    print("\n5️⃣ Manual Downloads")
    print("-" * 30)
    
    # LinPEAS ve WinPEAS
    if run_cmd("wget -q https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh -O /tmp/linpeas.sh"):
        if run_cmd("sudo mv /tmp/linpeas.sh /usr/local/bin/ && sudo chmod +x /usr/local/bin/linpeas.sh"):
            installed += 1
    
    if run_cmd("wget -q https://github.com/carlospolop/PEASS-ng/releases/latest/download/winPEASx64.exe -O /tmp/winpeas.exe"):
        if run_cmd("sudo mv /tmp/winpeas.exe /usr/local/bin/"):
            installed += 1
    
    # Linux Exploit Suggester
    if run_cmd("wget -q https://raw.githubusercontent.com/mzet-/linux-exploit-suggester/master/linux-exploit-suggester.sh -O /tmp/les.sh"):
        if run_cmd("sudo mv /tmp/les.sh /usr/local/bin/ && sudo chmod +x /usr/local/bin/les.sh"):
            installed += 1
    
    # Testssl.sh
    if run_cmd("wget -q https://testssl.sh/testssl.sh -O /tmp/testssl.sh"):
        if run_cmd("sudo mv /tmp/testssl.sh /usr/local/bin/ && sudo chmod +x /usr/local/bin/testssl.sh"):
            installed += 1
    
    print("\n" + "=" * 50)
    print(f"🎯 Installation Summary")
    print("=" * 50)
    print(f"📦 Tools installed: {installed}")
    print(f"⏱️  Time taken: ~{installed * 2} seconds")
    
    # Database güncelle
    print("\n🔄 Updating database...")
    run_cmd("python3 backend/update_from_detection.py")
    
    return installed

if __name__ == "__main__":
    installed = install_missing_tools()
    print(f"\n✅ Installation completed! {installed} tools added.")
    print("🔄 Restart backend to see updated statistics.")
    print("curl http://localhost:5002/api/tools/status")