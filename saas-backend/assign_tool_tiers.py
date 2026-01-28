#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - Tool Plan Assignment Script
Assigns correct plan tiers to all 400+ tools

Author: Semih Kılıç
Version: 1.0.0
"""

import json
import os
from typing import Dict, List

# ================================
# PLAN TIER DEFINITIONS
# ================================

# Starter (Free) - 6 Essential Security Tools
STARTER_TOOLS = {
    'nmap',           # Network scanner - THE essential tool
    'nikto',          # Web vulnerability scanner
    'whatweb',        # Web technology identifier  
    'ncrack',         # Password cracker (basic)
    'tcpdump',        # Packet capture
    'netcat',         # Network utility
    'ncat',           # Improved netcat
}

# Team-only Tools - Require collaboration/coordination
TEAM_TOOLS = {
    # Exploitation Frameworks (require team oversight)
    'metasploit', 'msfconsole', 'msfvenom', 'msfdb',
    'armitage',
    
    # Collaboration & Reporting
    'dradis', 'dradis-stop',
    'faraday',
    
    # Advanced Forensics
    'autopsy',
    
    # Red Team
    'empire', 'starkiller',
    'covenant',
    
    # Cloud Security Auditing
    'prowler', 'scoutsuite', 'pacu',
}

# Enterprise-only Tools - High impact, liability concerns
ENTERPRISE_TOOLS = {
    # Credential Tools
    'mimikatz',
    
    # Active Directory
    'bloodhound', 'sharphound', 'azurehound',
    
    # Impacket Suite (powerful network tools)
    'impacket-smbexec', 'impacket-mssqlclient', 'impacket-smbserver',
    
    # Advanced Exploitation
    'crackmapexec', 'evil-winrm',
    
    # Reverse Engineering (full versions)
    'ghidra', 'cutter', 're.rizin.cutter',
    
    # Dangerous by nature
    'ettercap',  # MITM attacks
    'yersinia',  # Network attacks
}

# Everything else = Professional


def assign_tool_tiers(registry_file: str) -> Dict:
    """
    Read tool registry and assign correct plan tiers.
    
    Logic:
    - If in STARTER_TOOLS -> starter
    - If in TEAM_TOOLS -> team  
    - If in ENTERPRISE_TOOLS -> enterprise
    - Otherwise -> professional
    """
    
    with open(registry_file, 'r') as f:
        registry = json.load(f)
    
    tools = registry.get('tools', {})
    
    counts = {'starter': 0, 'professional': 0, 'team': 0, 'enterprise': 0}
    
    for tool_id, tool in tools.items():
        # Determine tier
        if tool_id in STARTER_TOOLS or tool.get('name', '').lower() in STARTER_TOOLS:
            tier = 'starter'
        elif tool_id in TEAM_TOOLS or tool.get('name', '').lower() in TEAM_TOOLS:
            tier = 'team'
        elif tool_id in ENTERPRISE_TOOLS or tool.get('name', '').lower() in ENTERPRISE_TOOLS:
            tier = 'enterprise'
        else:
            tier = 'professional'
        
        # Update tool
        tool['plan_required'] = tier
        counts[tier] += 1
    
    # Calculate cumulative counts
    cumulative = {
        'starter': counts['starter'],
        'professional': counts['starter'] + counts['professional'],
        'team': counts['starter'] + counts['professional'] + counts['team'],
        'enterprise': counts['starter'] + counts['professional'] + counts['team'] + counts['enterprise']
    }
    
    # Update metadata
    registry['plan_distribution'] = counts
    registry['cumulative_access'] = cumulative
    registry['updated_at'] = __import__('datetime').datetime.now().isoformat()
    
    return registry


def main():
    registry_file = '/home/cybersec/cybersec-pro/saas-backend/full_tool_registry.json'
    
    if not os.path.exists(registry_file):
        print(f"❌ Registry file not found: {registry_file}")
        return
    
    print("🔄 Assigning tool tiers...")
    registry = assign_tool_tiers(registry_file)
    
    # Save updated registry
    with open(registry_file, 'w') as f:
        json.dump(registry, f, indent=2)
    
    print("\n✅ Tool tiers assigned!")
    print("\n📊 Plan Distribution:")
    for plan, count in registry['plan_distribution'].items():
        print(f"   {plan.capitalize()}: {count} tools")
    
    print("\n📈 Cumulative Access (what each plan can use):")
    for plan, count in registry['cumulative_access'].items():
        print(f"   {plan.capitalize()}: {count} tools")


if __name__ == '__main__':
    main()
