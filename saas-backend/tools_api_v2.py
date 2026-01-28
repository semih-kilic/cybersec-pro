#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - Tools API v2
Dynamic tool discovery and execution - 500+ Kali Linux tools

Author: Semih Kılıç
Version: 3.0.0
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import subprocess
import threading
import uuid
import json
import os
import shlex
import time

# Import tool registry v3
from tool_registry_v3 import ToolRegistry, get_registry, PLAN_HIERARCHY

# Create Blueprint
tools_api_v2 = Blueprint('tools_api_v2', __name__)

# In-memory storage for active scans
active_scans = {}
scan_results = {}

# ================================
# CATEGORY MAPPINGS
# ================================
CATEGORY_INFO = {
    'information_gathering': {
        'name': 'Information Gathering',
        'icon': '🔍',
        'description': 'Tools for reconnaissance and information collection',
        'color': 'blue'
    },
    'vulnerability_analysis': {
        'name': 'Vulnerability Analysis',
        'icon': '🔓',
        'description': 'Tools for finding security vulnerabilities',
        'color': 'red'
    },
    'web_application': {
        'name': 'Web Application Analysis',
        'icon': '🌐',
        'description': 'Tools for web application security testing',
        'color': 'purple'
    },
    'password_attacks': {
        'name': 'Password Attacks',
        'icon': '🔑',
        'description': 'Tools for password cracking and analysis',
        'color': 'orange'
    },
    'wireless_attacks': {
        'name': 'Wireless Attacks',
        'icon': '📡',
        'description': 'Tools for wireless network security testing',
        'color': 'cyan'
    },
    'sniffing_spoofing': {
        'name': 'Sniffing & Spoofing',
        'icon': '👃',
        'description': 'Tools for network traffic analysis and manipulation',
        'color': 'green'
    },
    'exploitation': {
        'name': 'Exploitation Tools',
        'icon': '💥',
        'description': 'Tools for exploiting vulnerabilities',
        'color': 'red'
    },
    'post_exploitation': {
        'name': 'Post Exploitation',
        'icon': '🎯',
        'description': 'Tools for post-exploitation activities',
        'color': 'yellow'
    },
    'forensics': {
        'name': 'Forensics',
        'icon': '🔬',
        'description': 'Tools for digital forensics and analysis',
        'color': 'indigo'
    },
    'reverse_engineering': {
        'name': 'Reverse Engineering',
        'icon': '⚙️',
        'description': 'Tools for reverse engineering software',
        'color': 'gray'
    },
    'reporting': {
        'name': 'Reporting Tools',
        'icon': '📊',
        'description': 'Tools for generating reports',
        'color': 'teal'
    },
    'networking': {
        'name': 'Networking',
        'icon': '🌍',
        'description': 'General networking tools',
        'color': 'blue'
    }
}

# ================================
# HELPER FUNCTIONS
# ================================
def get_user_plan(user_id: str) -> str:
    """Get user's plan from database"""
    try:
        # Import here to avoid circular imports
        from app import User, Organization
        
        user = User.query.get(user_id)
        if user and user.organization_id:
            org = Organization.query.get(user.organization_id)
            if org:
                return org.plan_type or 'starter'
        return 'starter'  # Default plan
    except Exception as e:
        print(f"Error getting user plan: {e}")
        return 'starter'  # Fallback to starter

def validate_target(target: str) -> bool:
    """Validate scan target"""
    import re
    
    # Allow IP addresses
    ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
    if re.match(ip_pattern, target):
        return True
    
    # Allow domain names
    domain_pattern = r'^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
    if re.match(domain_pattern, target):
        return True
    
    # Allow URLs
    url_pattern = r'^https?://[^\s/$.?#].[^\s]*$'
    if re.match(url_pattern, target):
        return True
    
    return False

def sanitize_command_value(value: str) -> str:
    """Sanitize command parameter values"""
    # Remove dangerous characters
    dangerous_chars = [';', '|', '&', '`', '$', '(', ')', '{', '}', '<', '>', '\n', '\r']
    for char in dangerous_chars:
        value = value.replace(char, '')
    return value.strip()

# ================================
# API ENDPOINTS
# ================================

@tools_api_v2.route('/api/v2/tools', methods=['GET'])
def get_tools_list():
    """Get list of all available tools"""
    try:
        plan = request.args.get('plan', 'professional')
        category = request.args.get('category')
        search = request.args.get('search', '').lower()
        
        registry = get_registry()
        
        # Get tools for plan
        if plan:
            tools = registry.get_tools_for_plan(plan)
        else:
            tools = registry.get_installed_tools()
        
        # Format tools for response
        tool_list = []
        for tool_id, tool in tools.items():
            # Filter by category
            if category and tool.get('category') != category:
                continue
            
            # Search filter
            if search:
                searchable = f"{tool_id} {tool.get('name', '')} {tool.get('description', '')} {tool.get('category', '')}".lower()
                if search not in searchable:
                    continue
            
            tool_list.append({
                'id': tool_id,
                'name': tool.get('name'),
                'category': tool.get('category'),
                'subcategory': tool.get('subcategory'),
                'description': tool.get('description'),
                'plan_required': tool.get('plan_required'),
                'installed': tool.get('installed', False),
                'dangerous': tool.get('dangerous', False),
                'requires_root': tool.get('requires_root', False),
                'gui_only': tool.get('gui_only', False),
            })
        
        # Group by category
        grouped = {}
        for tool in tool_list:
            cat = tool['category']
            if cat not in grouped:
                grouped[cat] = {
                    'info': CATEGORY_INFO.get(cat, {'name': cat, 'icon': '🔧', 'description': '', 'color': 'gray'}),
                    'tools': []
                }
            grouped[cat]['tools'].append(tool)
        
        return jsonify({
            'success': True,
            'total_tools': len(tool_list),
            'categories': grouped,
            'category_list': list(grouped.keys())
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@tools_api_v2.route('/api/v2/tools/<tool_id>', methods=['GET'])
def get_tool_detail(tool_id: str):
    """Get detailed information about a specific tool"""
    try:
        tool = get_tool_for_api(tool_id)
        
        if not tool:
            return jsonify({'success': False, 'error': 'Tool not found'}), 404
        
        # Add category info
        tool['category_info'] = CATEGORY_INFO.get(tool.get('category'), {})
        
        return jsonify({
            'success': True,
            'tool': tool
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@tools_api_v2.route('/api/v2/tools/statistics', methods=['GET'])
def get_tools_statistics():
    """Get tool statistics"""
    try:
        registry = get_registry()
        stats = registry.get_statistics()
        
        return jsonify({
            'success': True,
            'statistics': {
                'total_defined': stats['total_defined'],
                'total_installed': stats['total_installed'],
                'by_plan': stats['by_plan'],
                'by_category': stats['by_category'],
                'dangerous_tools': stats['dangerous_tools'],
                'gui_tools': stats['gui_tools'],
                'requires_root': stats['requires_root'],
                'categories': [
                    {
                        'id': cat,
                        **CATEGORY_INFO.get(cat, {'name': cat, 'icon': '🔧', 'description': '', 'color': 'gray'}),
                        'tool_count': count
                    }
                    for cat, count in stats['by_category'].items()
                ]
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@tools_api_v2.route('/api/v2/tools/refresh', methods=['POST'])
@jwt_required()
def refresh_tools():
    """Refresh tool discovery (admin only)"""
    try:
        registry = get_registry()
        registry.refresh()
        
        return jsonify({
            'success': True,
            'message': 'Tools refreshed successfully',
            'statistics': registry.get_statistics()
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@tools_api_v2.route('/api/v2/tools/search', methods=['GET'])
def search_tools():
    """Search tools by name, description, or category"""
    try:
        query = request.args.get('q', '')
        
        if not query or len(query) < 2:
            return jsonify({'success': False, 'error': 'Query must be at least 2 characters'}), 400
        
        registry = get_registry()
        results = registry.search_tools(query)
        
        return jsonify({
            'success': True,
            'query': query,
            'results': results,
            'count': len(results)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@tools_api_v2.route('/api/v2/scan/execute', methods=['POST'])
@jwt_required()
def execute_scan():
    """Execute a security scan"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        tool_id = data.get('tool_id')
        target = data.get('target')
        parameters = data.get('parameters', {})
        
        if not tool_id:
            return jsonify({'success': False, 'error': 'Tool ID is required'}), 400
        
        if not target:
            return jsonify({'success': False, 'error': 'Target is required'}), 400
        
        # Validate target
        if not validate_target(target):
            return jsonify({'success': False, 'error': 'Invalid target format'}), 400
        
        # Get tool info
        registry = get_registry()
        tool = registry.get_tool(tool_id)
        
        if not tool:
            return jsonify({'success': False, 'error': 'Tool not found'}), 404
        
        if not tool.get('installed'):
            return jsonify({'success': False, 'error': 'Tool is not installed'}), 400
        
        # Check if tool is GUI only
        if tool.get('gui_only'):
            return jsonify({'success': False, 'error': 'This tool requires a GUI and cannot be run via API'}), 400
        
        # Check if tool is dangerous - require confirmation
        if tool.get('dangerous'):
            confirm = data.get('confirm_dangerous', False)
            if not confirm:
                return jsonify({
                    'success': False, 
                    'error': 'This is a dangerous tool that may affect target systems. Set confirm_dangerous=true to proceed.',
                    'requires_confirmation': True,
                    'warning': f'{tool.get("name")} is marked as dangerous. Use only on authorized targets.'
                }), 400
        
        # Get user plan
        user_id = get_jwt_identity()
        user_plan = get_user_plan(user_id)
        
        # Check plan access
        if not registry.can_use_tool(tool_id, user_plan):
            return jsonify({'success': False, 'error': f'Tool requires {tool.get("plan_required")} plan or higher'}), 403
        
        # Build command
        command = build_scan_command(tool, target, parameters)
        
        if not command:
            return jsonify({'success': False, 'error': 'Failed to build command'}), 500
        
        # Create scan record
        scan_id = str(uuid.uuid4())
        scan_record = {
            'id': scan_id,
            'tool_id': tool_id,
            'tool_name': tool.get('name'),
            'target': target,
            'parameters': parameters,
            'command': command,
            'status': 'running',
            'started_at': datetime.utcnow().isoformat(),
            'user_id': user_id,
            'output': '',
            'error': None
        }
        
        active_scans[scan_id] = scan_record
        
        # Execute scan in background
        thread = threading.Thread(
            target=run_scan_background,
            args=(scan_id, command, tool.get('requires_root', False))
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'scan_id': scan_id,
            'message': f'Scan started with {tool.get("name")}',
            'status': 'running'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@tools_api_v2.route('/api/v2/scan/<scan_id>/status', methods=['GET'])
@jwt_required()
def get_scan_status(scan_id: str):
    """Get status of a running scan"""
    try:
        if scan_id not in active_scans and scan_id not in scan_results:
            return jsonify({'success': False, 'error': 'Scan not found'}), 404
        
        scan = active_scans.get(scan_id) or scan_results.get(scan_id)
        
        return jsonify({
            'success': True,
            'scan': {
                'id': scan['id'],
                'tool_name': scan['tool_name'],
                'target': scan['target'],
                'status': scan['status'],
                'started_at': scan['started_at'],
                'completed_at': scan.get('completed_at'),
                'output_length': len(scan.get('output', '')),
                'has_error': scan.get('error') is not None
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@tools_api_v2.route('/api/v2/scan/<scan_id>/output', methods=['GET'])
@jwt_required()
def get_scan_output(scan_id: str):
    """Get output of a scan"""
    try:
        if scan_id not in active_scans and scan_id not in scan_results:
            return jsonify({'success': False, 'error': 'Scan not found'}), 404
        
        scan = active_scans.get(scan_id) or scan_results.get(scan_id)
        
        return jsonify({
            'success': True,
            'scan': {
                'id': scan['id'],
                'status': scan['status'],
                'output': scan.get('output', ''),
                'error': scan.get('error')
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@tools_api_v2.route('/api/v2/scan/<scan_id>/stop', methods=['POST'])
@jwt_required()
def stop_scan(scan_id: str):
    """Stop a running scan"""
    try:
        if scan_id not in active_scans:
            return jsonify({'success': False, 'error': 'Scan not found or already completed'}), 404
        
        scan = active_scans[scan_id]
        
        # Kill the process if running
        pid = scan.get('pid')
        if pid:
            try:
                os.kill(pid, 9)
            except:
                pass
        
        # Update status
        scan['status'] = 'stopped'
        scan['completed_at'] = datetime.utcnow().isoformat()
        scan['error'] = 'Scan stopped by user'
        
        # Move to results
        scan_results[scan_id] = scan
        del active_scans[scan_id]
        
        return jsonify({
            'success': True,
            'message': 'Scan stopped',
            'scan_id': scan_id
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ================================
# HELPER FUNCTIONS FOR EXECUTION
# ================================

def build_scan_command(tool: dict, target: str, parameters: dict) -> str:
    """Build command string from tool configuration"""
    try:
        command_parts = [tool.get('command')]
        
        # Add target based on tool type
        tool_params = tool.get('parameters', {})
        
        # Process parameters
        for param_name, param_config in tool_params.items():
            flag = param_config.get('flag', '')
            param_type = param_config.get('type', 'text')
            
            # Skip target parameters - handled separately
            if param_type == 'target':
                continue
            
            # Get value from user input or default
            value = parameters.get(param_name, param_config.get('default'))
            
            if value is None or value == '':
                continue
            
            # Handle boolean flags
            if param_type == 'boolean':
                if value is True or value == 'true':
                    if flag:
                        command_parts.append(flag)
                continue
            
            # Sanitize value
            value = sanitize_command_value(str(value))
            
            # Add flag and value
            if flag:
                if flag.endswith('='):
                    command_parts.append(f"{flag}{value}")
                else:
                    command_parts.append(flag)
                    command_parts.append(value)
            else:
                # For positional arguments like gobuster mode
                command_parts.append(value)
        
        # Add target at appropriate position
        target = sanitize_command_value(target)
        
        # Most tools accept target as last argument or with -h/-u flag
        tool_id = tool.get('command', '')
        
        if tool_id in ['nmap', 'masscan', 'rustscan', 'unicornscan']:
            command_parts.append(target)
        elif tool_id in ['nikto', 'whatweb', 'wafw00f']:
            command_parts.extend(['-h', target])
        elif tool_id in ['gobuster', 'ffuf', 'dirb', 'wfuzz']:
            command_parts.extend(['-u', f"http://{target}"])
        elif tool_id in ['sqlmap', 'commix']:
            command_parts.extend(['-u', target])
        elif tool_id in ['hydra', 'medusa', 'ncrack']:
            command_parts.append(target)
        elif tool_id in ['whois', 'dig', 'host', 'nslookup']:
            command_parts.append(target)
        elif tool_id in ['dnsrecon', 'dnsenum', 'fierce']:
            command_parts.extend(['-d', target])
        elif tool_id in ['theHarvester']:
            command_parts.extend(['-d', target])
        elif tool_id in ['amass']:
            command_parts.extend(['-d', target])
        elif tool_id in ['subfinder', 'sublist3r', 'assetfinder']:
            command_parts.extend(['-d', target])
        elif tool_id in ['sslyze', 'sslscan']:
            command_parts.append(target)
        elif tool_id in ['wpscan', 'joomscan']:
            command_parts.extend(['--url', f"http://{target}"])
        elif tool_id in ['enum4linux', 'enum4linux-ng', 'nbtscan']:
            command_parts.append(target)
        elif tool_id in ['smbclient', 'smbmap']:
            command_parts.extend(['-I', target])
        elif tool_id in ['snmpwalk', 'onesixtyone']:
            command_parts.append(target)
        elif tool_id in ['searchsploit']:
            command_parts.append(target)  # target is search term
        else:
            # Default: add target at end
            command_parts.append(target)
        
        return ' '.join(command_parts)
        
    except Exception as e:
        print(f"Error building command: {e}")
        return None


def run_scan_background(scan_id: str, command: str, requires_root: bool = False):
    """Run scan in background thread"""
    try:
        scan = active_scans.get(scan_id)
        if not scan:
            return
        
        # Add sudo if required (NOPASSWD configured in sudoers)
        if requires_root:
            command = f"sudo -n {command}"
        
        # Add timeout (5 minutes max for safety)
        command = f"timeout 300 {command}"
        
        # Log the command (for debugging)
        print(f"[SCAN {scan_id}] Executing: {command}")
        
        # Run command
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env={**os.environ, 'TERM': 'xterm'}
        )
        
        scan['pid'] = process.pid
        
        # Collect output
        output_lines = []
        for line in process.stdout:
            output_lines.append(line)
            scan['output'] = ''.join(output_lines)
        
        # Wait for completion
        return_code = process.wait()
        
        # Update scan record
        scan['status'] = 'completed' if return_code == 0 else 'failed'
        scan['completed_at'] = datetime.utcnow().isoformat()
        scan['return_code'] = return_code
        
        if return_code != 0:
            scan['error'] = f'Command exited with code {return_code}'
        
        # Move to results
        scan_results[scan_id] = scan
        if scan_id in active_scans:
            del active_scans[scan_id]
            
    except Exception as e:
        if scan_id in active_scans:
            scan = active_scans[scan_id]
            scan['status'] = 'failed'
            scan['error'] = str(e)
            scan['completed_at'] = datetime.utcnow().isoformat()
            scan_results[scan_id] = scan
            del active_scans[scan_id]
