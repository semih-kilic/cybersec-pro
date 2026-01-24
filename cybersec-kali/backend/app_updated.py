#!/usr/bin/env python3
"""
Updated tools status function with advanced detection
"""

def get_tools_status():
    """Get installation status of all tools using advanced detection"""
    try:
        from tool_detector import AdvancedToolDetector
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
        
        return jsonify({
            'total': len(tools),
            'installed': len(installed),
            'not_installed': len(not_installed),
            'installed_percentage': round(len(installed) / len(tools) * 100, 1) if tools else 0,
            'os': os_info,
            'installed_tools': installed,
            'missing_tools': not_installed,
            'detection_method': 'advanced'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
</text>
</invoke>