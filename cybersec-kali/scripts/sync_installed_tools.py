#!/usr/bin/env python3
"""
Tool Sync Script - Checks which tools are actually installed on the system
and updates the database accordingly.
"""

import sqlite3
import subprocess
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'backend', 'instance', 'cybersec.db')

def check_tool_installed(command):
    """Check if a tool is installed by trying to find it"""
    if not command:
        return False
    
    # Get the base command (first word)
    base_cmd = command.split()[0].strip()
    
    # Skip if empty
    if not base_cmd:
        return False
    
    # Try 'which' command
    try:
        result = subprocess.run(
            ['which', base_cmd],
            capture_output=True,
            timeout=5
        )
        if result.returncode == 0:
            return True
    except:
        pass
    
    # Try 'command -v'
    try:
        result = subprocess.run(
            ['bash', '-c', f'command -v {base_cmd}'],
            capture_output=True,
            timeout=5
        )
        if result.returncode == 0:
            return True
    except:
        pass
    
    # Check common paths
    common_paths = [
        f'/usr/bin/{base_cmd}',
        f'/usr/sbin/{base_cmd}',
        f'/usr/local/bin/{base_cmd}',
        f'/opt/{base_cmd}',
        f'/snap/bin/{base_cmd}',
    ]
    
    for path in common_paths:
        if os.path.exists(path):
            return True
    
    return False

def sync_tools():
    """Sync database with actual installed tools"""
    print("🔄 Syncing tools with system...")
    
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Get all tools
    cur.execute('SELECT id, name, command FROM tools')
    tools = cur.fetchall()
    
    installed_count = 0
    total = len(tools)
    
    print(f"📦 Checking {total} tools...")
    
    for i, (tool_id, name, command) in enumerate(tools):
        is_installed = check_tool_installed(command or name.lower())
        
        cur.execute('UPDATE tools SET installed = ? WHERE id = ?', (is_installed, tool_id))
        
        if is_installed:
            installed_count += 1
            print(f"  ✅ {name}")
        
        # Progress indicator
        if (i + 1) % 50 == 0:
            print(f"  Progress: {i + 1}/{total}")
    
    conn.commit()
    conn.close()
    
    print(f"\n✨ Sync complete!")
    print(f"📊 Total: {total} tools")
    print(f"✅ Installed: {installed_count} tools")
    print(f"❌ Not installed: {total - installed_count} tools")
    
    return installed_count

if __name__ == '__main__':
    sync_tools()
