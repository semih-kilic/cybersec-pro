#!/usr/bin/env python3
"""
Advanced Tools Status Endpoint for CyberSec Pro
"""
from flask import Flask, jsonify
import sys
import os

# Add current directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from tool_detector import AdvancedToolDetector
from models import Tool, db

def get_advanced_tools_status():
    """Get installation status using advanced detection"""
    try:
        detector = AdvancedToolDetector()
        tools = Tool.query.all()
        installed = []
        not_installed = []
        
        for tool in tools:
            # Use advanced detection
            is_installed, version, path, method = detector.detect_tool(tool.name, tool.command)
            
            if is_installed:
                installed.append({
                    'id': tool.id, 
                    'name': tool.name, 
                    'category': tool.category,
                    'version': version,
                    'path': path,
                    'method': method
                })
                tool.installed = True
                tool.version = version
            else:
                not_installed.append({
                    'id': tool.id, 
                    'name': tool.name, 
                    'category': tool.category, 
                    'command': tool.command or tool.name.lower().replace(' ', '-')
                })
                tool.installed = False
                tool.version = None
        
        db.session.commit()
        
        # Get OS info
        os_info = 'Unknown'
        try:
            with open('/etc/os-release') as f:
                for line in f:
                    if line.startswith('PRETTY_NAME='):
                        os_info = line.split('=')[1].strip().strip('"')
                        break
        except:
            pass
        
        return {
            'total': len(tools),
            'installed': len(installed),
            'not_installed': len(not_installed),
            'installed_percentage': round(len(installed) / len(tools) * 100, 1) if tools else 0,
            'os': os_info,
            'installed_tools': installed,
            'missing_tools': not_installed,
            'detection_method': 'advanced'
        }
    except Exception as e:
        return {'error': str(e)}

if __name__ == "__main__":
    # Test the function
    from flask import Flask
    from config import Config
    
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        result = get_advanced_tools_status()
        print(f"Total: {result['total']}")
        print(f"Installed: {result['installed']} ({result['installed_percentage']}%)")
        print(f"Missing: {result['not_installed']}")
        print(f"Detection: {result['detection_method']}")