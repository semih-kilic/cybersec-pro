#!/usr/bin/env python3
"""
Advanced Detection - Find all possible tool variations
"""
import subprocess
import os
from flask import Flask
from models import db, Tool
from config import Config

def check_tool_variations(tool_name, tool_command):
    """Check multiple variations of a tool"""
    variations = [
        tool_command,
        tool_command.lower(),
        tool_command.replace('-', ''),
        tool_command.replace('_', '-'),
        tool_command.replace('-', '_'),
        f"{tool_command}.py",
        f"{tool_command}.sh",
        f"{tool_command}-ng",
        f"{tool_command}2",
        f"{tool_command}3"
    ]
    
    # Add common alternative names
    alternatives = {
        'enum4linux': ['enum4linux-ng'],
        'impacket': ['impacket-psexec', 'impacket-smbexec', 'impacket-wmiexec'],
        'volatility3': ['vol3', 'volatility'],
        'testssl.sh': ['testssl'],
        'linpeas': ['linpeas.sh'],
        'winpeas': ['winpeas.exe'],
        'les': ['les.sh', 'linux-exploit-suggester'],
        'pwntools': ['pwn'],
        'ropgadget': ['ROPgadget'],
        'crackmapexec': ['cme', 'netexec', 'nxc'],
        'sleuthkit': ['tsk'],
        'arp-scan': ['arp-scan'],
        'smtp-user-enum': ['smtp-user-enum.pl']
    }
    
    if tool_command in alternatives:
        variations.extend(alternatives[tool_command])
    
    for variation in variations:
        if check_single_tool(variation):
            return True, variation
    
    return False, None

def check_single_tool(command):
    """Check if a single tool exists"""
    try:
        # Method 1: which command
        result = subprocess.run(['which', command], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            return True
        
        # Method 2: Check common paths
        common_paths = [
            f'/usr/bin/{command}',
            f'/usr/local/bin/{command}',
            f'/usr/sbin/{command}',
            f'/sbin/{command}',
            f'/opt/security-tools/{command}',
            f'/opt/{command}',
            f'/snap/bin/{command}',
            f'/home/sam/go/bin/{command}',
            f'/home/sam/.local/bin/{command}',
            f'/home/sam/.cargo/bin/{command}',
            f'/usr/share/{command}',
            f'/opt/security-tools/{command}/{command}',
            f'/opt/security-tools/{command}/{command}.py',
            f'/opt/security-tools/{command}/{command}.sh'
        ]
        
        for path in common_paths:
            if os.path.exists(path) and os.access(path, os.X_OK):
                return True
        
        # Method 3: Try to execute with --version or -h
        try:
            result = subprocess.run([command, '--version'], capture_output=True, text=True, timeout=3)
            if result.returncode == 0:
                return True
        except:
            pass
        
        try:
            result = subprocess.run([command, '-h'], capture_output=True, text=True, timeout=3)
            if result.returncode == 0:
                return True
        except:
            pass
        
        return False
    except:
        return False

def advanced_detection():
    """Advanced detection of all tools"""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        tools = Tool.query.all()
        updated = 0
        found_tools = []
        
        print(f"🔍 Advanced detection for {len(tools)} tools...")
        
        for tool in tools:
            old_status = tool.installed
            
            # Check tool variations
            is_installed, found_variation = check_tool_variations(tool.name, tool.command)
            
            if old_status != is_installed:
                tool.installed = is_installed
                updated += 1
                
                if is_installed:
                    found_tools.append(f"{tool.name} (as {found_variation})")
                    print(f"   ✅ {tool.name}: FOUND as {found_variation}")
                else:
                    print(f"   ❌ {tool.name}: NOT FOUND")
            elif is_installed and found_variation:
                found_tools.append(f"{tool.name} (as {found_variation})")
                print(f"   ✓ {tool.name}: Already found as {found_variation}")
        
        db.session.commit()
        
        # Get final stats
        total = Tool.query.count()
        installed = Tool.query.filter_by(installed=True).count()
        percentage = (installed / total * 100) if total > 0 else 0
        
        print(f"\n✅ Advanced detection completed!")
        print(f"📊 Total tools: {total}")
        print(f"🔧 Installed tools: {installed}")
        print(f"📈 Installation rate: {percentage:.1f}%")
        print(f"🔄 Status changes: {updated}")
        
        if installed >= 165:
            print(f"🎉 SUCCESS! Found {installed} tools (exceeded 165+ target)")
        else:
            print(f"🔄 Progress: {installed} tools (need {165 - installed} more for 165+)")
        
        # Show some found tools
        if found_tools:
            print(f"\n🎯 Sample of detected tools:")
            for tool in found_tools[:15]:
                print(f"   • {tool}")
            if len(found_tools) > 15:
                print(f"   ... and {len(found_tools) - 15} more")
        
        return installed, total, percentage

if __name__ == "__main__":
    advanced_detection()