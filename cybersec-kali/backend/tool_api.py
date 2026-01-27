#!/usr/bin/env python3
"""
🐉 CyberSec Pro - Tool Execution API
Executes Kali Linux tools and returns results

Author: CyberSec Pro Team
Version: 2.0.0
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import shlex
import os
import uuid
import time
import threading
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)

# Store running tasks
tasks = {}
task_results = {}

# Allowed tools list (security whitelist)
ALLOWED_TOOLS = {
    # Information Gathering
    'nmap': {'timeout': 300, 'plan': 'starter'},
    'masscan': {'timeout': 300, 'plan': 'starter'},
    'netdiscover': {'timeout': 120, 'plan': 'starter'},
    'dnsenum': {'timeout': 180, 'plan': 'starter'},
    'dnsrecon': {'timeout': 180, 'plan': 'starter'},
    'fierce': {'timeout': 180, 'plan': 'starter'},
    'theHarvester': {'timeout': 180, 'plan': 'starter'},
    'whatweb': {'timeout': 120, 'plan': 'starter'},
    'wafw00f': {'timeout': 60, 'plan': 'starter'},
    
    # Web Testing
    'nikto': {'timeout': 600, 'plan': 'starter'},
    'sqlmap': {'timeout': 600, 'plan': 'professional'},
    'dirb': {'timeout': 300, 'plan': 'starter'},
    'gobuster': {'timeout': 300, 'plan': 'starter'},
    'ffuf': {'timeout': 300, 'plan': 'starter'},
    'wfuzz': {'timeout': 300, 'plan': 'professional'},
    'commix': {'timeout': 300, 'plan': 'professional'},
    
    # Password Attacks
    'john': {'timeout': 1800, 'plan': 'professional'},
    'hashcat': {'timeout': 1800, 'plan': 'professional'},
    'hydra': {'timeout': 600, 'plan': 'professional'},
    'medusa': {'timeout': 600, 'plan': 'professional'},
    'cewl': {'timeout': 180, 'plan': 'starter'},
    
    # Network Analysis
    'tcpdump': {'timeout': 60, 'plan': 'starter'},
    'tshark': {'timeout': 60, 'plan': 'professional'},
    'netcat': {'timeout': 60, 'plan': 'starter'},
    'nc': {'timeout': 60, 'plan': 'starter'},
    
    # Exploitation
    'msfconsole': {'timeout': 3600, 'plan': 'enterprise'},
    'searchsploit': {'timeout': 60, 'plan': 'starter'},
    
    # Enumeration
    'enum4linux': {'timeout': 300, 'plan': 'professional'},
    'smbclient': {'timeout': 120, 'plan': 'professional'},
    'nbtscan': {'timeout': 120, 'plan': 'starter'},
    'snmpwalk': {'timeout': 180, 'plan': 'professional'},
    
    # Utilities
    'curl': {'timeout': 60, 'plan': 'starter'},
    'wget': {'timeout': 120, 'plan': 'starter'},
    'whois': {'timeout': 30, 'plan': 'starter'},
    'dig': {'timeout': 30, 'plan': 'starter'},
    'host': {'timeout': 30, 'plan': 'starter'},
    'ping': {'timeout': 30, 'plan': 'starter'},
    'traceroute': {'timeout': 60, 'plan': 'starter'},
}

# Dangerous patterns to block
BLOCKED_PATTERNS = [
    'rm -rf /',
    'mkfs',
    'dd if=',
    '> /dev/',
    'shutdown',
    'reboot',
    'init 0',
    'halt',
    ':(){:|:&};:',  # Fork bomb
]


def is_command_safe(command):
    """Check if command is safe to execute"""
    command_lower = command.lower()
    for pattern in BLOCKED_PATTERNS:
        if pattern in command_lower:
            return False
    return True


def get_tool_from_command(command):
    """Extract tool name from command"""
    parts = shlex.split(command)
    if parts:
        return parts[0].split('/')[-1]
    return None


def execute_tool(task_id, command, timeout):
    """Execute tool in background"""
    try:
        tasks[task_id]['status'] = 'running'
        tasks[task_id]['started_at'] = datetime.utcnow().isoformat()
        
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        tasks[task_id]['pid'] = process.pid
        
        try:
            stdout, stderr = process.communicate(timeout=timeout)
            
            task_results[task_id] = {
                'stdout': stdout,
                'stderr': stderr,
                'return_code': process.returncode,
                'completed_at': datetime.utcnow().isoformat()
            }
            
            tasks[task_id]['status'] = 'completed' if process.returncode == 0 else 'failed'
            
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            
            task_results[task_id] = {
                'stdout': stdout,
                'stderr': 'Command timed out',
                'return_code': -1,
                'completed_at': datetime.utcnow().isoformat()
            }
            tasks[task_id]['status'] = 'timeout'
            
    except Exception as e:
        tasks[task_id]['status'] = 'error'
        task_results[task_id] = {
            'stdout': '',
            'stderr': str(e),
            'return_code': -1,
            'completed_at': datetime.utcnow().isoformat()
        }


@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'CyberSec Pro Tool API',
        'timestamp': datetime.utcnow().isoformat(),
        'tools_available': len(ALLOWED_TOOLS)
    })


@app.route('/api/tools', methods=['GET'])
def list_tools():
    """List all available tools"""
    tools_list = []
    for tool, config in ALLOWED_TOOLS.items():
        # Check if tool exists
        result = subprocess.run(
            f'which {tool}',
            shell=True,
            capture_output=True,
            text=True
        )
        
        tools_list.append({
            'name': tool,
            'available': result.returncode == 0,
            'timeout': config['timeout'],
            'plan_required': config['plan']
        })
    
    return jsonify({
        'tools': tools_list,
        'total': len(tools_list),
        'available': sum(1 for t in tools_list if t['available'])
    })


@app.route('/api/tools/<tool_name>/info', methods=['GET'])
def tool_info(tool_name):
    """Get information about a specific tool"""
    if tool_name not in ALLOWED_TOOLS:
        return jsonify({'error': 'Tool not allowed'}), 403
    
    # Get tool help
    result = subprocess.run(
        f'{tool_name} --help 2>&1 || {tool_name} -h 2>&1',
        shell=True,
        capture_output=True,
        text=True,
        timeout=10
    )
    
    # Get tool version
    version_result = subprocess.run(
        f'{tool_name} --version 2>&1 || {tool_name} -V 2>&1',
        shell=True,
        capture_output=True,
        text=True,
        timeout=10
    )
    
    return jsonify({
        'name': tool_name,
        'config': ALLOWED_TOOLS[tool_name],
        'help': result.stdout[:5000] if result.stdout else result.stderr[:5000],
        'version': version_result.stdout.split('\n')[0] if version_result.stdout else 'Unknown'
    })


@app.route('/api/execute', methods=['POST'])
def execute():
    """Execute a tool command"""
    data = request.get_json()
    
    if not data or 'command' not in data:
        return jsonify({'error': 'Command required'}), 400
    
    command = data['command']
    user_plan = data.get('plan', 'starter')
    
    # Safety check
    if not is_command_safe(command):
        return jsonify({'error': 'Command blocked for security reasons'}), 403
    
    # Get tool name
    tool = get_tool_from_command(command)
    if not tool:
        return jsonify({'error': 'Invalid command'}), 400
    
    # Check if tool is allowed
    if tool not in ALLOWED_TOOLS:
        return jsonify({'error': f'Tool {tool} is not allowed'}), 403
    
    # Check plan requirements
    tool_config = ALLOWED_TOOLS[tool]
    plan_hierarchy = {'starter': 1, 'professional': 2, 'enterprise': 3}
    
    if plan_hierarchy.get(user_plan, 0) < plan_hierarchy.get(tool_config['plan'], 0):
        return jsonify({
            'error': f'Tool {tool} requires {tool_config["plan"]} plan',
            'required_plan': tool_config['plan']
        }), 402
    
    # Create task
    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        'id': task_id,
        'command': command,
        'tool': tool,
        'status': 'pending',
        'created_at': datetime.utcnow().isoformat()
    }
    
    # Execute in background
    timeout = tool_config['timeout']
    thread = threading.Thread(target=execute_tool, args=(task_id, command, timeout))
    thread.start()
    
    return jsonify({
        'task_id': task_id,
        'status': 'pending',
        'message': f'Task created. Tool: {tool}'
    }), 202


@app.route('/api/tasks/<task_id>', methods=['GET'])
def get_task(task_id):
    """Get task status and results"""
    if task_id not in tasks:
        return jsonify({'error': 'Task not found'}), 404
    
    task = tasks[task_id]
    result = task_results.get(task_id, {})
    
    return jsonify({
        **task,
        'result': result
    })


@app.route('/api/tasks/<task_id>/cancel', methods=['POST'])
def cancel_task(task_id):
    """Cancel a running task"""
    if task_id not in tasks:
        return jsonify({'error': 'Task not found'}), 404
    
    task = tasks[task_id]
    
    if task['status'] != 'running':
        return jsonify({'error': 'Task is not running'}), 400
    
    if 'pid' in task:
        try:
            os.kill(task['pid'], 9)
            task['status'] = 'cancelled'
            return jsonify({'message': 'Task cancelled'})
        except:
            pass
    
    return jsonify({'error': 'Could not cancel task'}), 500


@app.route('/api/tasks', methods=['GET'])
def list_tasks():
    """List all tasks"""
    return jsonify({
        'tasks': list(tasks.values()),
        'total': len(tasks)
    })


if __name__ == '__main__':
    # Create log directory
    os.makedirs('/var/log/supervisor', exist_ok=True)
    
    app.run(host='0.0.0.0', port=5003, debug=False)
