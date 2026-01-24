#!/usr/bin/env python3
"""
Restore 165+ Tools - Restore the original 165 working tools
"""
import subprocess
import os
import sys

# Add backend to path
sys.path.append('backend')

from flask import Flask
from models import db, Tool
from config import Config

def get_detected_tools_list():
    """Get list of all detected tools from smart-detect"""
    try:
        result = subprocess.run(['python3', 'smart-detect.py'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            lines = result.stdout.split('\n')
            tools = set()  # Use set to avoid duplicates
            
            # Find the section with numbered tools
            in_tools_section = False
            for line in lines:
                if 'Security tools found:' in line:
                    in_tools_section = True
                    continue
                
                if in_tools_section and line.strip():
                    # Extract tool name from numbered list
                    if '. ' in line and line.strip()[0].isdigit():
                        parts = line.strip().split('. ', 1)
                        if len(parts) > 1:
                            tool_name = parts[1].strip()
                            if tool_name:
                                tools.add(tool_name)
            
            return list(tools)
        else:
            print(f"❌ Smart-detect failed: {result.stderr}")
            return []
    except Exception as e:
        print(f"❌ Error running smart-detect: {e}")
        return []

def check_tool_exists(command):
    """Check if tool exists on system"""
    try:
        # Method 1: which command
        result = subprocess.run(['which', command], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            return True
        
        # Method 2: Check if command responds
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
        
        # Method 3: Check common paths
        common_paths = [
            f'/usr/bin/{command}',
            f'/usr/local/bin/{command}',
            f'/opt/security-tools/{command}',
            f'/snap/bin/{command}',
            f'/home/sam/go/bin/{command}',
            f'/home/sam/.local/bin/{command}'
        ]
        
        for path in common_paths:
            if os.path.exists(path) and os.access(path, os.X_OK):
                return True
        
        return False
        
    except Exception as e:
        return False

def restore_tools():
    """Restore all detected tools to database"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Change to backend directory
    original_dir = os.getcwd()
    os.chdir('backend')
    
    db.init_app(app)
    
    with app.app_context():
        # Get detected tools
        print("🔍 Getting detected tools from smart-detect...")
        detected_tools = get_detected_tools_list()
        print(f"📊 Found {len(detected_tools)} unique tools")
        
        # Get current database tools
        db_tools = Tool.query.all()
        db_tool_commands = {tool.command.lower(): tool for tool in db_tools}
        
        print(f"📊 Database has {len(db_tools)} tools")
        
        updated = 0
        verified_tools = []
        
        print(f"\n🔄 Verifying and updating tools...")
        
        # Update existing tools in database
        for detected_tool in detected_tools:
            tool_command = detected_tool.lower()
            
            if tool_command in db_tool_commands:
                db_tool = db_tool_commands[tool_command]
                
                # Check if tool actually exists
                if check_tool_exists(detected_tool):
                    if not db_tool.installed:
                        db_tool.installed = True
                        updated += 1
                        verified_tools.append(detected_tool)
                        print(f"   ✅ {db_tool.name}: RESTORED")
                    else:
                        verified_tools.append(detected_tool)
                        print(f"   ✓ {db_tool.name}: Already installed")
                else:
                    if db_tool.installed:
                        db_tool.installed = False
                        updated += 1
                        print(f"   ❌ {db_tool.name}: REMOVED (not found)")
        
        db.session.commit()
        
        # Get final stats
        total = Tool.query.count()
        installed = Tool.query.filter_by(installed=True).count()
        percentage = (installed / total * 100) if total > 0 else 0
        
        print(f"\n✅ Tool restoration completed!")
        print(f"📊 Total tools in DB: {total}")
        print(f"🔧 Installed tools: {installed}")
        print(f"📈 Installation rate: {percentage:.1f}%")
        print(f"🔄 Status changes: {updated}")
        print(f"✅ Verified working: {len(verified_tools)}")
        
        # Show some verified tools
        if verified_tools:
            print(f"\n🎉 Sample of working tools:")
            for tool in verified_tools[:20]:
                print(f"   • {tool}")
            if len(verified_tools) > 20:
                print(f"   ... and {len(verified_tools) - 20} more")
        
        # Change back to original directory
        os.chdir(original_dir)
        
        return installed, total, percentage

if __name__ == "__main__":
    restore_tools()