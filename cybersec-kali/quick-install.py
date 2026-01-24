#!/usr/bin/env python3
"""
Quick Install - Hızlı araç kurulumu
Sadece çalışan yöntemlerle kurulum yapar
"""
import subprocess
import os
import requests

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return result.returncode == 0
    except:
        return False

def quick_install():
    print("🚀 QUICK INSTALL - Working Methods Only")
    print("=" * 50)
    
    installed = 0
    
    # Go tools (these work well)
    go_tools = [
        'github.com/projectdiscovery/notify/cmd/notify@latest',
        'github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest',
        'github.com/projectdiscovery/dnsx/cmd/dnsx@latest',
        'github.com/projectdiscovery/naabu/v2/cmd/naabu@latest',
        'github.com/projectdiscovery/mapcidr/cmd/mapcidr@latest',
        'github.com/projectdiscovery/shuffledns/cmd/shuffledns@latest'
    ]
    
    print("🔧 Installing Go tools...")
    for tool in go_tools:
        if run_cmd(f"go install {tool}"):
            print(f"✅ {tool.split('/')[-1].split('@')[0]}")
            installed += 1
        else:
            print(f"❌ {tool.split('/')[-1].split('@')[0]}")
    
    # Manual downloads (reliable)
    manual_tools = [
        ('https://raw.githubusercontent.com/mzet-/linux-exploit-suggester/master/linux-exploit-suggester.sh', 'les.sh'),
        ('https://raw.githubusercontent.com/carlospolop/PEASS-ng/master/linPEAS/linpeas.sh', 'linpeas2.sh'),
        ('https://raw.githubusercontent.com/rebootuser/LinEnum/master/LinEnum.sh', 'linenum.sh')
    ]
    
    print("\n📥 Installing manual tools...")
    for url, name in manual_tools:
        if run_cmd(f"wget -q {url} -O /tmp/{name} && sudo mv /tmp/{name} /usr/local/bin/ && sudo chmod +x /usr/local/bin/{name}"):
            print(f"✅ {name}")
            installed += 1
        else:
            print(f"❌ {name}")
    
    # Snap tools (if available)
    snap_tools = ['cutter', 'code', 'firefox']
    
    print("\n📦 Installing snap tools...")
    for tool in snap_tools:
        if run_cmd(f"sudo snap install {tool}"):
            print(f"✅ {tool}")
            installed += 1
        else:
            print(f"❌ {tool}")
    
    # Create symlinks for existing tools
    symlinks = [
        ('~/go/bin/katana', '/usr/local/bin/katana'),
        ('~/go/bin/uncover', '/usr/local/bin/uncover'),
        ('~/go/bin/chaos', '/usr/local/bin/chaos'),
        ('~/go/bin/notify', '/usr/local/bin/notify'),
        ('~/go/bin/dnsx', '/usr/local/bin/dnsx'),
        ('~/go/bin/naabu', '/usr/local/bin/naabu')
    ]
    
    print("\n🔗 Creating symlinks...")
    for source, target in symlinks:
        source_expanded = os.path.expanduser(source)
        if os.path.exists(source_expanded) and not os.path.exists(target):
            if run_cmd(f"sudo ln -sf {source_expanded} {target}"):
                print(f"✅ {os.path.basename(target)}")
                installed += 1
    
    print(f"\n🎯 Quick install completed: +{installed} tools")
    return installed

if __name__ == "__main__":
    quick_install()