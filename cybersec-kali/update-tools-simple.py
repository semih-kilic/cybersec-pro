#!/usr/bin/env python3
"""
Simple Tool Update - Update database with detected tools
"""
import subprocess
import os
import sys

# Add backend to path
sys.path.append('backend')

from flask import Flask
from models import db, Tool
from config import Config

def check_tool_installed(command):
    """Check if a tool is installed"""
    try:
        # Try which command first
        result = subprocess.run(['which', command], capture_output=True, text=True)
        if result.returncode == 0:
            return True
        
        # Try command --version
        result = subprocess.run([command, '--version'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return True
            
        # Try command -h
        result = subprocess.run([command, '-h'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return True
            
        return False
    except:
        return False

def update_tool_status():
    """Update tool installation status"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Ensure we're in the right directory
    os.chdir('backend')
    
    db.init_app(app)
    
    with app.app_context():
        tools = Tool.query.all()
        updated = 0
        
        print(f"🔄 Checking {len(tools)} tools...")
        
        for tool in tools:
            old_status = tool.installed
            new_status = check_tool_installed(tool.command)
            
            if old_status != new_status:
                tool.installed = new_status
                updated += 1
                status = "✅ INSTALLED" if new_status else "❌ REMOVED"
                print(f"   {tool.name}: {status}")
        
        db.session.commit()
        
        # Get final stats
        total = Tool.query.count()
        installed = Tool.query.filter_by(installed=True).count()
        percentage = (installed / total * 100) if total > 0 else 0
        
        print(f"\n✅ Update completed!")
        print(f"📊 Total tools: {total}")
        print(f"🔧 Installed tools: {installed}")
        print(f"📈 Installation rate: {percentage:.1f}%")
        print(f"🔄 Updated: {updated}")
        
        return installed, total, percentage

if __name__ == "__main__":
    update_tool_status()