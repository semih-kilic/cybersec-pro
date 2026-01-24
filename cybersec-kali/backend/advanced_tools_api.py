#!/usr/bin/env python3
"""
Advanced Tools Detection API Endpoint
"""
from flask import Flask, jsonify
from models import db, Tool
from tool_detector import AdvancedToolDetector

def create_advanced_tools_endpoint(app):
    """Add advanced tools detection endpoint to existing app"""
    
    @app.route('/api/tools/status-advanced', methods=['GET'])
    def get_tools_status_advanced():
        """Get installation status using advanced detection"""
        try:
            detector = AdvancedToolDetector()
            
            tools = Tool.query.all()
            installed = []
            not_installed = []
            
            print(f"🔍 Scanning {len(tools)} tools with advanced detection...")
            
            for i, tool in enumerate(tools):
                if i % 50 == 0:
                    print(f"   Progress: {i}/{len(tools)}")
                
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
                else:
                    not_installed.append({
                        'id': tool.id, 
                        'name': tool.name, 
                        'category': tool.category, 
                        'command': tool.command
                    })
                    tool.installed = False
            
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
            
            result = {
                'total': len(tools),
                'installed': len(installed),
                'not_installed': len(not_installed),
                'installed_percentage': round(len(installed) / len(tools) * 100, 1) if tools else 0,
                'os': os_info,
                'installed_tools': installed,
                'missing_tools': not_installed,
                'detection_method': 'advanced'
            }
            
            print(f"✅ Detection complete: {len(installed)}/{len(tools)} ({result['installed_percentage']}%)")
            return jsonify(result)
            
        except Exception as e:
            print(f"❌ Error: {e}")
            return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    # Test the detector
    from config import Config
    
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    create_advanced_tools_endpoint(app)
    
    with app.app_context():
        response = get_tools_status_advanced()
        print(response.get_json())