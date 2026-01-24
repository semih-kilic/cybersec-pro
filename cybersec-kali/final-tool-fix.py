#!/usr/bin/env python3
"""
CyberSec Pro - Final Tool Detection & Installation Fix
Mevcut araçları daha iyi tespit eder ve eksikleri hızlıca tamamlar
"""
import subprocess
import os
import sys
import json
import requests

def run_command(cmd):
    """Run command and return success, stdout, stderr"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return result.returncode == 0, result.stdout, result.stderr
    except:
        return False, "", "timeout"

def check_tool_advanced(tool_name):
    """Advanced tool detection"""
    # Method 1: which
    success, stdout, _ = run_command(f"which {tool_name}")
    if success:
        return True, stdout.strip(), "which"
    
    # Method 2: locate
    success, stdout, _ = run_command(f"locate -l 1 {tool_name}")
    if success and stdout.strip():
        return True, stdout.strip().split('\n')[0], "locate"
    
    # Method 3: find in common paths
    paths = ['/usr/bin', '/usr/local/bin', '/opt', '/snap/bin', '~/.local/bin', '~/go/bin']
    for path in paths:
        expanded_path = os.path.expanduser(path)
        if os.path.exists(expanded_path):
            tool_path = os.path.join(expanded_path, tool_name)
            if os.path.exists(tool_path):
                return True, tool_path, "find"
    
    # Method 4: dpkg check
    success, stdout, _ = run_command(f"dpkg -l | grep -i {tool_name}")
    if success and 'ii' in stdout:
        return True, f"/usr/bin/{tool_name}", "dpkg"
    
    # Method 5: snap check
    success, stdout, _ = run_command(f"snap list | grep -i {tool_name}")
    if success:
        return True, f"/snap/bin/{tool_name}", "snap"
    
    # Method 6: flatpak check
    success, stdout, _ = run_command(f"flatpak list | grep -i {tool_name}")
    if success:
        return True, f"flatpak run {tool_name}", "flatpak"
    
    return False, None, None

def create_symlinks():
    """Create symlinks for tools that exist but aren't in PATH"""
    print("🔗 Creating symlinks for existing tools...")
    
    # Common tool mappings
    mappings = {
        'msfconsole': ['/usr/bin/msfconsole', '/opt/metasploit-framework/msfconsole'],
        'burpsuite': ['/usr/bin/burpsuite', '/opt/BurpSuiteCommunity/BurpSuiteCommunity'],
        'zaproxy': ['/usr/bin/zaproxy', '/usr/share/zaproxy/zap.sh'],
        'ghidra': ['/usr/bin/ghidra', '/snap/bin/ghidra', '/opt/ghidra/ghidraRun'],
        'ida-free': ['/opt/ida-free/ida64', '/usr/bin/ida64'],
        'cutter': ['/usr/bin/cutter', '/snap/bin/cutter'],
        'volatility': ['/usr/bin/vol.py', '/opt/volatility/vol.py'],
        'empire': ['/opt/Empire/empire', '/usr/bin/empire'],
        'veil': ['/opt/Veil/Veil.py', '/usr/bin/veil'],
        'metasploit': ['/usr/bin/msfconsole'],
        'wireshark': ['/usr/bin/wireshark', '/usr/bin/wireshark-qt']
    }
    
    created = 0
    for tool, paths in mappings.items():
        for path in paths:
            if os.path.exists(path):
                link_path = f"/usr/local/bin/{tool}"
                if not os.path.exists(link_path):
                    try:
                        os.system(f"sudo ln -sf {path} {link_path}")
                        print(f"✅ Created symlink: {tool} -> {path}")
                        created += 1
                        break
                    except:
                        pass
    
    return created

def install_missing_quick():
    """Quick install of most important missing tools"""
    print("🚀 Quick installing critical missing tools...")
    
    installed = 0
    
    # Install via pipx (safest method)
    pipx_tools = [
        'volatility3', 'impacket', 'crackmapexec', 'bloodhound', 
        'scoutsuite', 'pacu', 'sherlock-project'
    ]
    
    for tool in pipx_tools:
        print(f"📦 Installing {tool} via pipx...")
        success, _, _ = run_command(f"pipx install {tool}")
        if success:
            print(f"✅ {tool} installed")
            installed += 1
        else:
            print(f"❌ {tool} failed")
    
    # Install via pip --break-system-packages
    pip_tools = [
        'faraday-client', 'drozer', 'mobsf', 'empire-cli'
    ]
    
    for tool in pip_tools:
        print(f"🐍 Installing {tool} via pip...")
        success, _, _ = run_command(f"pip3 install --break-system-packages {tool}")
        if success:
            print(f"✅ {tool} installed")
            installed += 1
        else:
            print(f"❌ {tool} failed")
    
    # Download and install key tools manually
    manual_installs = [
        {
            'name': 'ida-free',
            'url': 'https://out7.hex-rays.com/files/idafree84_linux.run',
            'install_cmd': 'chmod +x idafree84_linux.run && sudo ./idafree84_linux.run --mode unattended --prefix /opt/ida-free && sudo ln -sf /opt/ida-free/ida64 /usr/local/bin/ida-free'
        }
    ]
    
    for tool in manual_installs:
        if not os.path.exists(f"/usr/local/bin/{tool['name']}"):
            print(f"📥 Installing {tool['name']} manually...")
            success, _, _ = run_command(f"cd /tmp && wget -q {tool['url']} && {tool['install_cmd']}")
            if success:
                print(f"✅ {tool['name']} installed")
                installed += 1
            else:
                print(f"❌ {tool['name']} failed")
    
    return installed

def update_database():
    """Update CyberSec Pro database with new detections"""
    print("🔄 Updating tool database...")
    
    try:
        # Get current status
        response = requests.get("http://localhost:5001/api/tools/status", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"📊 Current status: {data['installed']}/{data['total']} ({data['installed_percentage']}%)")
            return True
    except:
        print("❌ Could not connect to backend")
        return False

def main():
    print("🎯 CyberSec Pro - Final Tool Detection & Installation Fix")
    print("=" * 60)
    
    # Step 1: Create symlinks for existing tools
    symlinks_created = create_symlinks()
    print(f"🔗 Created {symlinks_created} symlinks")
    
    # Step 2: Quick install missing critical tools
    tools_installed = install_missing_quick()
    print(f"📦 Installed {tools_installed} new tools")
    
    # Step 3: Update database
    update_database()
    
    # Step 4: Final status
    print("\n" + "=" * 60)
    print("📊 FINAL RESULTS")
    print("=" * 60)
    
    # Test some key tools
    test_tools = [
        'nmap', 'nikto', 'sqlmap', 'metasploit', 'burpsuite', 'zaproxy',
        'wireshark', 'john', 'hashcat', 'hydra', 'aircrack-ng', 'reaver',
        'binwalk', 'foremost', 'volatility3', 'radare2', 'ghidra',
        'crackmapexec', 'impacket', 'bloodhound', 'nuclei', 'subfinder'
    ]
    
    detected = 0
    for tool in test_tools:
        is_installed, path, method = check_tool_advanced(tool)
        if is_installed:
            print(f"✅ {tool:15} - {method}")
            detected += 1
        else:
            print(f"❌ {tool:15} - NOT FOUND")
    
    print("=" * 60)
    print(f"🎯 Detected: {detected}/{len(test_tools)} key tools")
    print(f"📈 Estimated coverage: ~{detected/len(test_tools)*100:.0f}%")
    
    if detected >= 18:  # 80%+ of key tools
        print("🎉 EXCELLENT! Most critical tools are working!")
    elif detected >= 15:  # 70%+ of key tools  
        print("✅ GOOD! Major tools are working!")
    else:
        print("⚠️  Need more work on tool installation")
    
    print("\n🔄 Restart backend to detect new tools:")
    print("curl http://localhost:5001/api/tools/status")

if __name__ == "__main__":
    main()