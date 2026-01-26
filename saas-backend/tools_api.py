#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - Extended Tools API
World-class Kali Linux tool documentation and execution system

Features:
- Complete tool documentation like kali.org/tools
- Every parameter documented and executable
- Real-time scan execution
- Professional reporting
"""

from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
import subprocess
import threading
import uuid
import json
import os
from datetime import datetime
from functools import wraps

# Import tool data
from kali_tools_data import KALI_TOOLS_COMPLETE, TOOL_CATEGORIES, build_command, get_tool_by_slug
from kali_tools_additional import ADDITIONAL_TOOLS, merge_all_tools

# Merge all tools
ALL_TOOLS = merge_all_tools(KALI_TOOLS_COMPLETE)

# Create Blueprint
tools_api = Blueprint('tools_api', __name__)

# In-memory scan storage (use Redis/DB in production)
active_scans = {}
scan_results = {}

# ================================
# TOOL DOCUMENTATION ENDPOINTS
# ================================

@tools_api.route('/api/v1/tools/catalog', methods=['GET'])
def get_tools_catalog():
    """Get complete tools catalog with categories"""
    try:
        category = request.args.get('category')
        plan = request.args.get('plan', 'starter')
        search = request.args.get('search', '').lower()
        
        # Plan hierarchy
        plan_levels = {'starter': 1, 'professional': 2, 'enterprise': 3}
        user_level = plan_levels.get(plan, 1)
        
        # Filter tools
        filtered_tools = {}
        for slug, tool in ALL_TOOLS.items():
            tool_level = plan_levels.get(tool.get('plan_required', 'starter'), 1)
            
            # Check plan access
            if tool_level > user_level:
                continue
            
            # Filter by category
            if category and tool.get('category') != category:
                continue
            
            # Search filter
            if search:
                searchable = f"{tool['name']} {tool['description']} {' '.join(tool.get('tags', []))}".lower()
                if search not in searchable:
                    continue
            
            # Add to filtered list
            cat = tool.get('category', 'Other')
            if cat not in filtered_tools:
                filtered_tools[cat] = []
            
            filtered_tools[cat].append({
                'slug': slug,
                'name': tool['name'],
                'description': tool['description'],
                'category': tool['category'],
                'subcategory': tool.get('subcategory'),
                'plan_required': tool.get('plan_required', 'starter'),
                'tags': tool.get('tags', []),
                'version': tool.get('version')
            })
        
        return jsonify({
            'success': True,
            'categories': TOOL_CATEGORIES,
            'tools': filtered_tools,
            'total_tools': sum(len(tools) for tools in filtered_tools.values())
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@tools_api.route('/api/v1/tools/<slug>', methods=['GET'])
def get_tool_details(slug):
    """Get complete tool documentation like kali.org/tools"""
    try:
        tool = ALL_TOOLS.get(slug)
        if not tool:
            return jsonify({'success': False, 'error': 'Tool not found'}), 404
        
        # Group parameters by category
        params_by_category = {}
        for param in tool.get('parameters', []):
            cat = param.get('category', 'general')
            if cat not in params_by_category:
                params_by_category[cat] = []
            params_by_category[cat].append(param)
        
        # Sort parameters within each category
        for cat in params_by_category:
            params_by_category[cat].sort(key=lambda x: x.get('order', 999))
        
        return jsonify({
            'success': True,
            'tool': {
                'slug': slug,
                'name': tool['name'],
                'category': tool['category'],
                'subcategory': tool.get('subcategory'),
                'description': tool['description'],
                'long_description': tool.get('long_description'),
                'author': tool.get('author'),
                'version': tool.get('version'),
                'license': tool.get('license'),
                'homepage': tool.get('homepage'),
                'repository': tool.get('repository'),
                'documentation_url': tool.get('documentation_url'),
                'plan_required': tool.get('plan_required', 'starter'),
                'installation': tool.get('installation'),
                'docker_image': tool.get('docker_image'),
                'command_template': tool.get('command_template'),
                'tags': tool.get('tags', []),
                'parameters': params_by_category,
                'parameter_count': len(tool.get('parameters', [])),
                'presets': tool.get('presets', []),
                'examples': tool.get('examples', []),
                'related_tools': tool.get('related_tools', [])
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@tools_api.route('/api/v1/tools/<slug>/parameters', methods=['GET'])
def get_tool_parameters(slug):
    """Get all parameters for a tool"""
    try:
        tool = ALL_TOOLS.get(slug)
        if not tool:
            return jsonify({'success': False, 'error': 'Tool not found'}), 404
        
        parameters = tool.get('parameters', [])
        
        # Group by category
        by_category = {}
        for param in parameters:
            cat = param.get('category', 'general')
            if cat not in by_category:
                by_category[cat] = {
                    'name': cat.replace('_', ' ').title(),
                    'parameters': []
                }
            by_category[cat]['parameters'].append(param)
        
        return jsonify({
            'success': True,
            'slug': slug,
            'name': tool['name'],
            'parameters': by_category,
            'total_parameters': len(parameters)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@tools_api.route('/api/v1/tools/<slug>/presets', methods=['GET'])
def get_tool_presets(slug):
    """Get predefined parameter presets for a tool"""
    try:
        tool = ALL_TOOLS.get(slug)
        if not tool:
            return jsonify({'success': False, 'error': 'Tool not found'}), 404
        
        presets = tool.get('presets', [])
        
        # Group by difficulty
        by_difficulty = {
            'beginner': [],
            'intermediate': [],
            'advanced': []
        }
        
        for preset in presets:
            diff = preset.get('difficulty', 'beginner')
            by_difficulty[diff].append(preset)
        
        return jsonify({
            'success': True,
            'slug': slug,
            'name': tool['name'],
            'presets': presets,
            'by_difficulty': by_difficulty
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@tools_api.route('/api/v1/tools/<slug>/examples', methods=['GET'])
def get_tool_examples(slug):
    """Get usage examples for a tool"""
    try:
        tool = ALL_TOOLS.get(slug)
        if not tool:
            return jsonify({'success': False, 'error': 'Tool not found'}), 404
        
        return jsonify({
            'success': True,
            'slug': slug,
            'name': tool['name'],
            'examples': tool.get('examples', []),
            'command_template': tool.get('command_template')
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@tools_api.route('/api/v1/tools/<slug>/build-command', methods=['POST'])
def build_tool_command(slug):
    """Build command from parameters"""
    try:
        tool = ALL_TOOLS.get(slug)
        if not tool:
            return jsonify({'success': False, 'error': 'Tool not found'}), 404
        
        data = request.get_json() or {}
        params = data.get('parameters', {})
        
        # Build command
        command = build_command(slug, params)
        
        if not command:
            return jsonify({'success': False, 'error': 'Failed to build command'}), 400
        
        return jsonify({
            'success': True,
            'command': command,
            'parameters_used': params
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ================================
# SCAN EXECUTION ENDPOINTS
# ================================

@tools_api.route('/api/v1/scans/execute', methods=['POST'])
@jwt_required()
def execute_scan():
    """Execute a security scan"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate input
        if not data.get('tool_slug'):
            return jsonify({'success': False, 'error': 'tool_slug is required'}), 400
        if not data.get('target'):
            return jsonify({'success': False, 'error': 'target is required'}), 400
        
        tool = ALL_TOOLS.get(data['tool_slug'])
        if not tool:
            return jsonify({'success': False, 'error': 'Tool not found'}), 404
        
        # Build command
        params = data.get('parameters', {})
        params['target'] = data['target']
        
        command = build_command(data['tool_slug'], params)
        
        # Create scan record
        scan_id = str(uuid.uuid4())
        scan_record = {
            'id': scan_id,
            'user_id': user_id,
            'tool_slug': data['tool_slug'],
            'tool_name': tool['name'],
            'target': data['target'],
            'parameters': params,
            'command': command,
            'status': 'running',
            'output': '',
            'error': None,
            'progress': 0,
            'started_at': datetime.utcnow().isoformat(),
            'completed_at': None
        }
        
        active_scans[scan_id] = scan_record
        
        # Start async execution
        def run_scan():
            try:
                # Execute command (with timeout)
                process = subprocess.Popen(
                    command,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                
                stdout, stderr = process.communicate(timeout=3600)  # 1 hour timeout
                
                active_scans[scan_id]['output'] = stdout
                active_scans[scan_id]['error'] = stderr if stderr else None
                active_scans[scan_id]['status'] = 'completed' if process.returncode == 0 else 'failed'
                active_scans[scan_id]['progress'] = 100
                active_scans[scan_id]['completed_at'] = datetime.utcnow().isoformat()
                active_scans[scan_id]['exit_code'] = process.returncode
                
            except subprocess.TimeoutExpired:
                process.kill()
                active_scans[scan_id]['status'] = 'timeout'
                active_scans[scan_id]['error'] = 'Scan timed out after 1 hour'
            except Exception as e:
                active_scans[scan_id]['status'] = 'failed'
                active_scans[scan_id]['error'] = str(e)
        
        thread = threading.Thread(target=run_scan)
        thread.start()
        
        return jsonify({
            'success': True,
            'scan_id': scan_id,
            'status': 'running',
            'command': command,
            'message': 'Scan started successfully'
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@tools_api.route('/api/v1/scans/<scan_id>/status', methods=['GET'])
@jwt_required()
def get_scan_status(scan_id):
    """Get scan status and results"""
    try:
        scan = active_scans.get(scan_id)
        if not scan:
            return jsonify({'success': False, 'error': 'Scan not found'}), 404
        
        # Check user access
        user_id = get_jwt_identity()
        if scan['user_id'] != user_id:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        return jsonify({
            'success': True,
            'scan': scan
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@tools_api.route('/api/v1/scans/<scan_id>/output', methods=['GET'])
@jwt_required()
def get_scan_output(scan_id):
    """Get scan output (streaming for live scans)"""
    try:
        scan = active_scans.get(scan_id)
        if not scan:
            return jsonify({'success': False, 'error': 'Scan not found'}), 404
        
        return jsonify({
            'success': True,
            'scan_id': scan_id,
            'status': scan['status'],
            'output': scan['output'],
            'error': scan.get('error')
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@tools_api.route('/api/v1/scans/<scan_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_scan(scan_id):
    """Cancel a running scan"""
    try:
        scan = active_scans.get(scan_id)
        if not scan:
            return jsonify({'success': False, 'error': 'Scan not found'}), 404
        
        if scan['status'] != 'running':
            return jsonify({'success': False, 'error': 'Scan is not running'}), 400
        
        scan['status'] = 'cancelled'
        scan['completed_at'] = datetime.utcnow().isoformat()
        
        return jsonify({
            'success': True,
            'message': 'Scan cancelled'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@tools_api.route('/api/v1/scans/history', methods=['GET'])
@jwt_required()
def get_scan_history():
    """Get user's scan history"""
    try:
        user_id = get_jwt_identity()
        
        # Filter scans by user
        user_scans = [
            scan for scan in active_scans.values()
            if scan['user_id'] == user_id
        ]
        
        # Sort by started_at descending
        user_scans.sort(key=lambda x: x.get('started_at', ''), reverse=True)
        
        return jsonify({
            'success': True,
            'scans': user_scans[:50],  # Last 50 scans
            'total': len(user_scans)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ================================
# CATEGORIES & SEARCH
# ================================

@tools_api.route('/api/v1/tools/categories', methods=['GET'])
def get_categories():
    """Get all tool categories"""
    return jsonify({
        'success': True,
        'categories': TOOL_CATEGORIES
    })

@tools_api.route('/api/v1/tools/search', methods=['GET'])
def search_tools():
    """Search tools by name, description, or tags"""
    try:
        query = request.args.get('q', '').lower()
        if not query or len(query) < 2:
            return jsonify({'success': False, 'error': 'Query must be at least 2 characters'}), 400
        
        results = []
        for slug, tool in ALL_TOOLS.items():
            # Search in name, description, and tags
            searchable = f"{tool['name']} {tool['description']} {' '.join(tool.get('tags', []))}".lower()
            
            if query in searchable:
                results.append({
                    'slug': slug,
                    'name': tool['name'],
                    'description': tool['description'],
                    'category': tool['category'],
                    'plan_required': tool.get('plan_required', 'starter')
                })
        
        return jsonify({
            'success': True,
            'query': query,
            'results': results,
            'total': len(results)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@tools_api.route('/api/v1/tools/related/<slug>', methods=['GET'])
def get_related_tools(slug):
    """Get related tools"""
    try:
        tool = ALL_TOOLS.get(slug)
        if not tool:
            return jsonify({'success': False, 'error': 'Tool not found'}), 404
        
        related_slugs = tool.get('related_tools', [])
        related = []
        
        for related_slug in related_slugs:
            related_tool = ALL_TOOLS.get(related_slug)
            if related_tool:
                related.append({
                    'slug': related_slug,
                    'name': related_tool['name'],
                    'description': related_tool['description'],
                    'category': related_tool['category']
                })
        
        return jsonify({
            'success': True,
            'tool': slug,
            'related_tools': related
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ================================
# STATISTICS
# ================================

@tools_api.route('/api/v1/tools/stats', methods=['GET'])
def get_tools_stats():
    """Get tools statistics"""
    try:
        total_tools = len(ALL_TOOLS)
        by_category = {}
        by_plan = {'starter': 0, 'professional': 0, 'enterprise': 0}
        total_params = 0
        total_presets = 0
        
        for tool in ALL_TOOLS.values():
            # Count by category
            cat = tool.get('category', 'Other')
            by_category[cat] = by_category.get(cat, 0) + 1
            
            # Count by plan
            plan = tool.get('plan_required', 'starter')
            by_plan[plan] = by_plan.get(plan, 0) + 1
            
            # Count parameters and presets
            total_params += len(tool.get('parameters', []))
            total_presets += len(tool.get('presets', []))
        
        return jsonify({
            'success': True,
            'stats': {
                'total_tools': total_tools,
                'by_category': by_category,
                'by_plan': by_plan,
                'total_parameters': total_params,
                'total_presets': total_presets,
                'categories_count': len(by_category)
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
