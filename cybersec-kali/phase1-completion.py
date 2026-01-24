#!/usr/bin/env python3
"""
Phase 1 Completion Script - Kalan araçları sistematik olarak kur
Hedef: %85+ kurulum oranı (586+ araç)
"""
import subprocess
import os
import time
import requests

def run_cmd(cmd, timeout=120):
    """Komut çalıştır"""
    try:
        print(f"🔄 {cmd}")
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

def get_current_status():
    """Mevcut kurulum durumunu al"""
    try:
        response = requests.get("http://localhost:5001/api/tools/status", timeout=10)
        data = response.json()
        return data['installed'], data['total'], data['installed_percentage']
    except:
        return 0, 0, 0

def install_batch_1_apt():
    """Batch 1: APT araçları"""
    print("\n🔧 BATCH 1: APT TOOLS")
    print("=" * 40)
    
    apt_tools = [
        'unicornscan',      # Network scanner
        'skipfish',         # Web scanner
        'legion',           # Network pentesting
        'cutycapt',         # Screenshot tool
        'eyewitness',       # Web screenshot
        'rainbowcrack',     # Password cracker
        'cutter',           # Reverse engineering
        'tcpflow',          # TCP flow (already installed)
        'tcpreplay',        # TCP replay (already installed)
        'rpcinfo',          # RPC info
        'rwho',             # Remote who
        'rusers',           # Remote users
        'stegsolve',        # Steganography
        'maltego',          # OSINT platform
        'proxmark3'         # RFID tool
    ]
    
    installed = 0
    for tool in apt_tools:
        if run_cmd(f"sudo apt install -y {tool}"):
            installed += 1
        time.sleep(2)
    
    return installed

def install_batch_2_python():
    """Batch 2: Python araçları"""
    print("\n🐍 BATCH 2: PYTHON TOOLS")
    print("=" * 40)
    
    python_tools = [
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
        'padbuster',        # Padding oracle
        'mobsf'             # Mobile Security Framework
    ]
    
    installed = 0
    for tool in python_tools:
        # Try pipx first
        if run_cmd(f"pipx install {tool}"):
            installed += 1
        # Try pip with --break-system-packages
        elif run_cmd(f"pip3 install --break-system-packages {tool}"):
            installed += 1
        time.sleep(2)
    
    return installed

def install_batch_3_go():
    """Batch 3: Go araçları"""
    print("\n🔧 BATCH 3: GO TOOLS")
    print("=" * 40)
    
    go_tools = [
        ('github.com/projectdiscovery/katana/cmd/katana@latest', 'katana'),
        ('github.com/projectdiscovery/uncover/cmd/uncover@latest', 'uncover'),
        ('github.com/projectdiscovery/chaos-client/cmd/chaos@latest', 'chaos'),
        ('github.com/hakluke/haktrails@latest', 'haktrails'),
        ('github.com/projectdiscovery/notify/cmd/notify@latest', 'notify'),
        ('github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest', 'interactsh-client'),
        ('github.com/projectdiscovery/dnsx/cmd/dnsx@latest', 'dnsx'),
        ('github.com/projectdiscovery/naabu/v2/cmd/naabu@latest', 'naabu'),
        ('github.com/projectdiscovery/mapcidr/cmd/mapcidr@latest', 'mapcidr'),
        ('github.com/projectdiscovery/shuffledns/cmd/shuffledns@latest', 'shuffledns')
    ]
    
    installed = 0
    for repo, name in go_tools:
        if run_cmd(f"go install {repo}"):
            installed += 1
        time.sleep(2)
    
    return installed

def install_batch_4_snap():
    """Batch 4: Snap araçları"""
    print("\n📦 BATCH 4: SNAP TOOLS")
    print("=" * 40)
    
    snap_tools = [
        'cutter',           # Reverse engineering
        'ida-free',         # Disassembler (if available)
        'maltego',          # OSINT platform
        'code',             # VS Code
        'discord',          # Communication
        'firefox'           # Browser
    ]
    
    installed = 0
    for tool in snap_tools:
        if run_cmd(f"sudo snap install {tool}"):
            installed += 1
        time.sleep(2)
    
    return installed

def install_batch_5_manual():
    """Batch 5: Manuel indirmeler"""
    print("\n📥 BATCH 5: MANUAL DOWNLOADS")
    print("=" * 40)
    
    manual_tools = [
        {
            'name': 'LinPEAS',
            'url': 'https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh',
            'path': '/usr/local/bin/linpeas.sh',
            'cmd': 'wget -q {url} -O /tmp/linpeas.sh && sudo mv /tmp/linpeas.sh {path} && sudo chmod +x {path}'
        },
        {
            'name': 'WinPEAS',
            'url': 'https://github.com/carlospolop/PEASS-ng/releases/latest/download/winPEASx64.exe',
            'path': '/usr/local/bin/winpeas.exe',
            'cmd': 'wget -q {url} -O /tmp/winpeas.exe && sudo mv /tmp/winpeas.exe {path}'
        },
        {
            'name': 'Linux Exploit Suggester',
            'url': 'https://raw.githubusercontent.com/mzet-/linux-exploit-suggester/master/linux-exploit-suggester.sh',
            'path': '/usr/local/bin/les.sh',
            'cmd': 'wget -q {url} -O /tmp/les.sh && sudo mv /tmp/les.sh {path} && sudo chmod +x {path}'
        },
        {
            'name': 'testssl.sh',
            'url': 'https://testssl.sh/testssl.sh',
            'path': '/usr/local/bin/testssl.sh',
            'cmd': 'wget -q {url} -O /tmp/testssl.sh && sudo mv /tmp/testssl.sh {path} && sudo chmod +x {path}'
        },
        {
            'name': 'SSLyze',
            'url': None,
            'path': None,
            'cmd': 'pipx install sslyze'
        }
    ]
    
    installed = 0
    for tool in manual_tools:
        if tool['url']:
            cmd = tool['cmd'].format(url=tool['url'], path=tool['path'])
        else:
            cmd = tool['cmd']
        
        if run_cmd(cmd):
            installed += 1
        time.sleep(2)
    
    return installed

def create_symlinks():
    """Eksik symlink'leri oluştur"""
    print("\n🔗 CREATING SYMLINKS")
    print("=" * 40)
    
    symlinks = [
        ('/snap/bin/cutter', '/usr/local/bin/cutter'),
        ('/snap/bin/maltego', '/usr/local/bin/maltego'),
        ('~/go/bin/katana', '/usr/local/bin/katana'),
        ('~/go/bin/uncover', '/usr/local/bin/uncover'),
        ('~/go/bin/chaos', '/usr/local/bin/chaos'),
        ('~/.local/bin/drozer', '/usr/local/bin/drozer'),
        ('~/.local/bin/scoutsuite', '/usr/local/bin/scoutsuite'),
        ('~/.local/bin/pacu', '/usr/local/bin/pacu')
    ]
    
    created = 0
    for source, target in symlinks:
        source_expanded = os.path.expanduser(source)
        if os.path.exists(source_expanded) and not os.path.exists(target):
            if run_cmd(f"sudo ln -sf {source_expanded} {target}"):
                created += 1
    
    return created

def main():
    """Ana kurulum fonksiyonu"""
    print("🚀 PHASE 1 COMPLETION - TOOL INSTALLATION")
    print("=" * 60)
    
    # Başlangıç durumu
    start_installed, total, start_percentage = get_current_status()
    print(f"📊 Starting: {start_installed}/{total} ({start_percentage}%)")
    
    total_installed = 0
    
    # Batch 1: APT Tools
    total_installed += install_batch_1_apt()
    
    # Batch 2: Python Tools
    total_installed += install_batch_2_python()
    
    # Batch 3: Go Tools
    total_installed += install_batch_3_go()
    
    # Batch 4: Snap Tools
    total_installed += install_batch_4_snap()
    
    # Batch 5: Manual Downloads
    total_installed += install_batch_5_manual()
    
    # Create Symlinks
    total_installed += create_symlinks()
    
    # Final durum
    print("\n" + "=" * 60)
    print("🎯 INSTALLATION SUMMARY")
    print("=" * 60)
    
    end_installed, total, end_percentage = get_current_status()
    
    print(f"📊 Before: {start_installed}/{total} ({start_percentage}%)")
    print(f"📊 After:  {end_installed}/{total} ({end_percentage}%)")
    print(f"📦 New tools installed: {total_installed}")
    print(f"📈 Improvement: +{end_percentage - start_percentage:.1f}%")
    
    if end_percentage >= 85:
        print("🎉 TARGET ACHIEVED! Phase 1 completed successfully!")
    elif end_percentage >= 75:
        print("✅ GOOD PROGRESS! Almost there!")
    else:
        print("🔄 CONTINUE INSTALLATION - More tools needed")
    
    return end_percentage

if __name__ == "__main__":
    final_percentage = main()
    print(f"\n🎯 Final Status: {final_percentage}%")