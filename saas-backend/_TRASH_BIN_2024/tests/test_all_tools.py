#!/usr/bin/env python3
"""
🧪 CyberSec Pro - Tool Verification Script
Tests all 404 installed tools to ensure they are working

Author: Semih Kılıç
"""

import subprocess
import json
import sys
from datetime import datetime

# Load tool registry
with open('/home/cybersec/cybersec-pro/saas-backend/full_tool_registry.json', 'r') as f:
    registry = json.load(f)

def test_tool(tool_id, tool_info):
    """Test if a tool is properly installed and executable"""
    name = tool_info.get('name', tool_id)
    installed = tool_info.get('installed', False)
    gui_only = tool_info.get('gui_only', False)
    
    if not installed:
        return {'status': 'not_installed', 'message': 'Not installed'}
    
    if gui_only:
        return {'status': 'gui_only', 'message': 'GUI tool - requires desktop'}
    
    # Try to find the command
    command = tool_info.get('command', tool_id)
    
    # Common test commands
    test_commands = [
        [command, '--version'],
        [command, '-v'],
        [command, '--help'],
        [command, '-h'],
        ['which', command],
    ]
    
    for test_cmd in test_commands:
        try:
            result = subprocess.run(
                test_cmd,
                capture_output=True,
                timeout=5,
                text=True
            )
            if result.returncode == 0 or result.stdout or result.stderr:
                return {
                    'status': 'working',
                    'message': f'Command works: {" ".join(test_cmd)}',
                    'output': (result.stdout or result.stderr)[:100]
                }
        except subprocess.TimeoutExpired:
            return {'status': 'timeout', 'message': 'Command timed out'}
        except FileNotFoundError:
            continue
        except Exception as e:
            continue
    
    return {'status': 'not_found', 'message': f'Command not found: {command}'}

def main():
    print("=" * 60)
    print("🧪 CyberSec Pro - Tool Verification")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()
    
    results = {
        'working': [],
        'gui_only': [],
        'not_installed': [],
        'not_found': [],
        'timeout': [],
        'error': []
    }
    
    tools = registry.get('tools', {})
    total = len(tools)
    
    print(f"Testing {total} tools...\n")
    
    for i, (tool_id, tool_info) in enumerate(tools.items(), 1):
        name = tool_info.get('name', tool_id)
        result = test_tool(tool_id, tool_info)
        status = result['status']
        
        if status == 'working':
            results['working'].append(name)
            status_icon = '✅'
        elif status == 'gui_only':
            results['gui_only'].append(name)
            status_icon = '🖥️'
        elif status == 'not_installed':
            results['not_installed'].append(name)
            status_icon = '⬜'
        elif status == 'not_found':
            results['not_found'].append(name)
            status_icon = '❌'
        elif status == 'timeout':
            results['timeout'].append(name)
            status_icon = '⏱️'
        else:
            results['error'].append(name)
            status_icon = '⚠️'
        
        # Progress
        if i % 50 == 0 or i == total:
            print(f"Progress: {i}/{total} ({i*100//total}%)")
    
    print("\n" + "=" * 60)
    print("📊 RESULTS SUMMARY")
    print("=" * 60)
    print(f"✅ Working:       {len(results['working'])}")
    print(f"🖥️ GUI Only:      {len(results['gui_only'])}")
    print(f"⬜ Not Installed: {len(results['not_installed'])}")
    print(f"❌ Not Found:     {len(results['not_found'])}")
    print(f"⏱️ Timeout:       {len(results['timeout'])}")
    print(f"⚠️ Error:         {len(results['error'])}")
    print("=" * 60)
    
    total_usable = len(results['working']) + len(results['gui_only'])
    print(f"\n🎯 Total Usable Tools: {total_usable}")
    print(f"   - CLI Tools (web): {len(results['working'])}")
    print(f"   - GUI Tools (desktop): {len(results['gui_only'])}")
    
    if results['not_found']:
        print(f"\n❌ Tools not found ({len(results['not_found'])}):")
        for tool in results['not_found'][:20]:
            print(f"   - {tool}")
        if len(results['not_found']) > 20:
            print(f"   ... and {len(results['not_found']) - 20} more")
    
    # Save results
    with open('/tmp/tool_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📁 Full results saved to: /tmp/tool_test_results.json")
    
    return len(results['not_found']) == 0

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
