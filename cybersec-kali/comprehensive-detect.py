#!/usr/bin/env python3
"""
Comprehensive Tool Detection - Detect all 226 tools found by smart-detect
"""
import subprocess
import os
import sys

# Add backend to path
sys.path.append('backend')

from flask import Flask
from models import db, Tool
from config import Config

def get_all_detected_tools():
    """Get all tools detected by smart-detect"""
    try:
        result = subprocess.run(['python3', 'smart-detect.py'], 
                              capture_output=True, text=True, cwd='.')
        
        if result.returncode == 0:
            lines = result.stdout.split('\n')
            tools = []
            
            # Find the section with numbered tools
            in_tools_section = False
            for line in lines:
                if 'Security tools found:' in line:
                    in_tools_section = True
                    continue
                
                if in_tools_section and line.strip():
                    # Extract tool name from numbered list
                    if '. ' in line:
                        parts = line.strip().split('. ', 1)
                        if len(parts) > 1:
                            tool_name = parts[1].strip()
                            if tool_name and tool_name not in tools:
                                tools.append(tool_name)
            
            return tools
        else:
            print(f"❌ Smart-detect failed: {result.stderr}")
            return []
    except Exception as e:
        print(f"❌ Error running smart-detect: {e}")
        return []

def check_tool_installed_advanced(command):
    """Advanced tool installation check"""
    try:
        # Method 1: which command
        result = subprocess.run(['which', command], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            return True, f"which: {result.stdout.strip()}"
        
        # Method 2: command --version
        try:
            result = subprocess.run([command, '--version'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return True, f"version: {result.stdout[:50]}"
        except:
            pass
        
        # Method 3: command -h
        try:
            result = subprocess.run([command, '-h'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return True, f"help: available"
        except:
            pass
        
        # Method 4: command --help
        try:
            result = subprocess.run([command, '--help'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return True, f"help: available"
        except:
            pass
        
        # Method 5: Check common locations
        common_paths = [
            f'/usr/bin/{command}',
            f'/usr/local/bin/{command}',
            f'/opt/{command}',
            f'/snap/bin/{command}',
            f'/home/sam/go/bin/{command}',
            f'/home/sam/.local/bin/{command}'
        ]
        
        for path in common_paths:
            if os.path.exists(path) and os.access(path, os.X_OK):
                return True, f"path: {path}"
        
        return False, "not found"
        
    except Exception as e:
        return False, f"error: {e}"

def comprehensive_update():
    """Comprehensive update of all tools"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Change to backend directory for database access
    original_dir = os.getcwd()
    os.chdir('backend')
    
    db.init_app(app)
    
    with app.app_context():
        # Get detected tools from smart-detect
        print("🔍 Getting tools from smart-detect...")
        detected_tools = get_all_detected_tools()
        print(f"📊 Smart-detect found: {len(detected_tools)} tools")
        
        # Get database tools
        db_tools = Tool.query.all()
        print(f"📊 Database has: {len(db_tools)} tools")
        
        updated = 0
        newly_installed = []
        
        print(f"\n🔄 Checking all database tools...")
        
        for tool in db_tools:
            old_status = tool.installed
            
            # Check if tool is in detected list (case insensitive)
            tool_detected = any(detected.lower() == tool.command.lower() 
                              for detected in detected_tools)
            
            if tool_detected:
                # Do advanced check
                is_installed, details = check_tool_installed_advanced(tool.command)
                
                if old_status != is_installed:
                    tool.installed = is_installed
                    updated += 1
                    
                    if is_installed:
                        newly_installed.append(f"{tool.name} ({details})")
                        print(f"   ✅ {tool.name}: NEWLY INSTALLED - {details}")
                    else:
                        print(f"   ❌ {tool.name}: REMOVED")
                elif is_installed and not old_status:
                    tool.installed = True
                    updated += 1
                    newly_installed.append(f"{tool.name} ({details})")
                    print(f"   ✅ {tool.name}: CONFIRMED INSTALLED - {details}")
        
        db.session.commit()
        
        # Get final stats
        total = Tool.query.count()
        installed = Tool.query.filter_by(installed=True).count()
        percentage = (installed / total * 100) if total > 0 else 0
        
        print(f"\n✅ Comprehensive detection completed!")
        print(f"📊 Total tools: {total}")
        print(f"🔧 Installed tools: {installed}")
        print(f"📈 Installation rate: {percentage:.1f}%")
        print(f"🔄 Status changes: {updated}")
        
        if newly_installed:
            print(f"\n🎉 Newly detected/confirmed tools ({len(newly_installed)}):")
            for tool in newly_installed[:20]:  # Show first 20
                print(f"   • {tool}")
            if len(newly_installed) > 20:
                print(f"   ... and {len(newly_installed) - 20} more")
        
        # Change back to original directory
        os.chdir(original_dir)
        
        return installed, total, percentage

if __name__ == "__main__":
    comprehensive_update()