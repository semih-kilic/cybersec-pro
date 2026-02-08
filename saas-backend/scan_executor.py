#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - Real Scan Executor
Executes Kali Linux security tools safely with Docker isolation

Author: Semih Kılıç
Version: 1.0.0
"""

import subprocess
import threading
import queue
import os
import json
import shlex
import time
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, Callable

# Tool configurations with real commands
TOOL_CONFIGS = {
    'nmap': {
        'name': 'Nmap',
        'command': 'nmap',
        'category': 'Information Gathering',
        'plan_required': 'starter',
        'description': 'Network exploration and security auditing tool',
        'base_flags': ['-v'],  # Always verbose for real-time streaming
        'parameters': {
            'scan_type': {
                'flag': '-s',
                'type': 'select',
                'options': ['S', 'T', 'U', 'A', 'V', 'N'],
                'default': 'S',
                'description': 'Scan type (S=SYN, T=Connect, U=UDP, A=Aggressive, V=Version, N=Ping)'
            },
            'ports': {
                'flag': '-p',
                'type': 'text',
                'default': '1-1000',
                'description': 'Port range to scan (e.g., 1-1000, 80,443,8080)'
            },
            'timing': {
                'flag': '-T',
                'type': 'select',
                'options': ['0', '1', '2', '3', '4', '5'],
                'default': '3',
                'description': 'Timing template (0=Paranoid to 5=Insane)'
            },
            'os_detection': {
                'flag': '-O',
                'type': 'boolean',
                'default': False,
                'description': 'Enable OS detection'
            },
            'service_version': {
                'flag': '-sV',
                'type': 'boolean',
                'default': False,
                'description': 'Probe open ports for service/version info'
            },
            'script': {
                'flag': '--script',
                'type': 'text',
                'default': '',
                'description': 'NSE scripts to run (e.g., vuln, safe, default)'
            }
            # Removed output_format - XML output breaks real-time streaming
        }
    },
    'nikto': {
        'name': 'Nikto',
        'command': 'nikto',
        'category': 'Web Application Analysis',
        'plan_required': 'starter',
        'description': 'Web server scanner for vulnerabilities',
        'parameters': {
            'host': {
                'flag': '-h',
                'type': 'target',
                'description': 'Target host'
            },
            'port': {
                'flag': '-p',
                'type': 'text',
                'default': '80',
                'description': 'Port to scan'
            },
            'ssl': {
                'flag': '-ssl',
                'type': 'boolean',
                'default': False,
                'description': 'Use SSL'
            },
            'tuning': {
                'flag': '-Tuning',
                'type': 'select',
                'options': ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'x'],
                'default': 'x',
                'description': 'Scan tuning'
            }
        }
    },
    'whatweb': {
        'name': 'WhatWeb',
        'command': 'whatweb',
        'category': 'Information Gathering',
        'plan_required': 'starter',
        'description': 'Web scanner to identify technologies',
        'parameters': {
            'aggression': {
                'flag': '-a',
                'type': 'select',
                'options': ['1', '2', '3', '4'],
                'default': '1',
                'description': 'Aggression level (1=Stealthy to 4=Aggressive)'
            },
            'verbose': {
                'flag': '-v',
                'type': 'boolean',
                'default': False,
                'description': 'Verbose output'
            }
        }
    },
    'gobuster': {
        'name': 'Gobuster',
        'command': 'gobuster',
        'category': 'Web Application Analysis',
        'plan_required': 'professional',
        'description': 'Directory/file & DNS busting tool',
        'parameters': {
            'mode': {
                'flag': '',
                'type': 'select',
                'options': ['dir', 'dns', 'vhost'],
                'default': 'dir',
                'description': 'Brute force mode'
            },
            'wordlist': {
                'flag': '-w',
                'type': 'select',
                'options': [
                    '/usr/share/wordlists/dirb/common.txt',
                    '/usr/share/wordlists/dirb/big.txt',
                    '/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt'
                ],
                'default': '/usr/share/wordlists/dirb/common.txt',
                'description': 'Wordlist to use'
            },
            'threads': {
                'flag': '-t',
                'type': 'number',
                'default': 10,
                'min': 1,
                'max': 50,
                'description': 'Number of threads'
            },
            'extensions': {
                'flag': '-x',
                'type': 'text',
                'default': 'php,html,txt',
                'description': 'File extensions to search for'
            }
        }
    },
    'sqlmap': {
        'name': 'SQLMap',
        'command': 'sqlmap',
        'category': 'Vulnerability Analysis',
        'plan_required': 'professional',
        'description': 'Automatic SQL injection and database takeover tool',
        'parameters': {
            'url': {
                'flag': '-u',
                'type': 'target',
                'description': 'Target URL with parameter'
            },
            'level': {
                'flag': '--level',
                'type': 'select',
                'options': ['1', '2', '3', '4', '5'],
                'default': '1',
                'description': 'Level of tests (1-5)'
            },
            'risk': {
                'flag': '--risk',
                'type': 'select',
                'options': ['1', '2', '3'],
                'default': '1',
                'description': 'Risk of tests (1-3)'
            },
            'dbs': {
                'flag': '--dbs',
                'type': 'boolean',
                'default': False,
                'description': 'Enumerate databases'
            },
            'tables': {
                'flag': '--tables',
                'type': 'boolean',
                'default': False,
                'description': 'Enumerate tables'
            },
            'batch': {
                'flag': '--batch',
                'type': 'boolean',
                'default': True,
                'description': 'Never ask for user input'
            }
        }
    },
    'dirb': {
        'name': 'Dirb',
        'command': 'dirb',
        'category': 'Web Application Analysis',
        'plan_required': 'starter',
        'description': 'Web content scanner',
        'parameters': {
            'wordlist': {
                'flag': '',
                'type': 'select',
                'options': [
                    '/usr/share/dirb/wordlists/common.txt',
                    '/usr/share/dirb/wordlists/big.txt',
                    '/usr/share/dirb/wordlists/small.txt'
                ],
                'default': '/usr/share/dirb/wordlists/common.txt',
                'description': 'Wordlist to use'
            },
            'extensions': {
                'flag': '-X',
                'type': 'text',
                'default': '',
                'description': 'Extensions to search (e.g., .php,.html)'
            },
            'user_agent': {
                'flag': '-a',
                'type': 'text',
                'default': '',
                'description': 'Custom User-Agent'
            }
        }
    },
    'wpscan': {
        'name': 'WPScan',
        'command': 'wpscan',
        'category': 'Web Application Analysis',
        'plan_required': 'professional',
        'description': 'WordPress security scanner',
        'parameters': {
            'url': {
                'flag': '--url',
                'type': 'target',
                'description': 'WordPress URL'
            },
            'enumerate': {
                'flag': '-e',
                'type': 'select',
                'options': ['p', 'vp', 'ap', 't', 'vt', 'at', 'u', 'cb', 'dbe'],
                'default': 'vp',
                'description': 'Enumeration (p=plugins, t=themes, u=users)'
            },
            'api_token': {
                'flag': '--api-token',
                'type': 'text',
                'default': '',
                'description': 'WPScan API token for vulnerability data'
            }
        }
    },
    'hydra': {
        'name': 'Hydra',
        'command': 'hydra',
        'category': 'Password Attacks',
        'plan_required': 'enterprise',
        'description': 'Fast network logon cracker',
        'parameters': {
            'service': {
                'flag': '',
                'type': 'select',
                'options': ['ssh', 'ftp', 'http-get', 'http-post', 'mysql', 'rdp', 'smb'],
                'default': 'ssh',
                'description': 'Service to attack'
            },
            'username': {
                'flag': '-l',
                'type': 'text',
                'default': '',
                'description': 'Single username'
            },
            'password_list': {
                'flag': '-P',
                'type': 'select',
                'options': [
                    '/usr/share/wordlists/rockyou.txt',
                    '/usr/share/wordlists/fasttrack.txt',
                    '/usr/share/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000.txt'
                ],
                'default': '/usr/share/wordlists/fasttrack.txt',
                'description': 'Password wordlist'
            },
            'threads': {
                'flag': '-t',
                'type': 'number',
                'default': 4,
                'min': 1,
                'max': 16,
                'description': 'Number of threads'
            }
        }
    },
    'whois': {
        'name': 'Whois',
        'command': 'whois',
        'category': 'Information Gathering',
        'plan_required': 'starter',
        'description': 'Domain/IP WHOIS lookup',
        'parameters': {}
    },
    'dig': {
        'name': 'Dig',
        'command': 'dig',
        'category': 'Information Gathering',
        'plan_required': 'starter',
        'description': 'DNS lookup utility',
        'parameters': {
            'record_type': {
                'flag': '',
                'type': 'select',
                'options': ['A', 'AAAA', 'MX', 'NS', 'TXT', 'SOA', 'CNAME', 'ANY'],
                'default': 'A',
                'description': 'DNS record type'
            },
            'short': {
                'flag': '+short',
                'type': 'boolean',
                'default': False,
                'description': 'Short output'
            }
        }
    },
    'dnsrecon': {
        'name': 'DNSRecon',
        'command': 'dnsrecon',
        'category': 'Information Gathering',
        'plan_required': 'professional',
        'description': 'DNS enumeration tool',
        'parameters': {
            'domain': {
                'flag': '-d',
                'type': 'target',
                'description': 'Target domain'
            },
            'type': {
                'flag': '-t',
                'type': 'select',
                'options': ['std', 'rvl', 'brt', 'srv', 'axfr', 'zonewalk'],
                'default': 'std',
                'description': 'Enumeration type'
            }
        }
    },
    'theHarvester': {
        'name': 'theHarvester',
        'command': 'theHarvester',
        'category': 'Information Gathering',
        'plan_required': 'professional',
        'description': 'Email, subdomain and people names harvester',
        'parameters': {
            'domain': {
                'flag': '-d',
                'type': 'target',
                'description': 'Target domain'
            },
            'source': {
                'flag': '-b',
                'type': 'select',
                'options': ['all', 'google', 'bing', 'linkedin', 'twitter', 'hackertarget', 'certspotter'],
                'default': 'all',
                'description': 'Data source'
            },
            'limit': {
                'flag': '-l',
                'type': 'number',
                'default': 100,
                'min': 10,
                'max': 500,
                'description': 'Limit results'
            }
        }
    },
    'sslscan': {
        'name': 'SSLScan',
        'command': 'sslscan',
        'category': 'Information Gathering',
        'plan_required': 'starter',
        'description': 'SSL/TLS cipher scanner',
        'parameters': {
            'no_color': {
                'flag': '--no-colour',
                'type': 'boolean',
                'default': True,
                'description': 'Disable colored output'
            }
        }
    },
    'enum4linux': {
        'name': 'Enum4linux',
        'command': 'enum4linux',
        'category': 'Information Gathering',
        'plan_required': 'professional',
        'description': 'Windows/Samba enumeration tool',
        'parameters': {
            'all': {
                'flag': '-a',
                'type': 'boolean',
                'default': True,
                'description': 'Do all simple enumeration'
            }
        }
    },
    'masscan': {
        'name': 'Masscan',
        'command': 'masscan',
        'category': 'Information Gathering',
        'plan_required': 'enterprise',
        'description': 'Fastest Internet port scanner',
        'parameters': {
            'ports': {
                'flag': '-p',
                'type': 'text',
                'default': '1-1000',
                'description': 'Port range'
            },
            'rate': {
                'flag': '--rate',
                'type': 'number',
                'default': 1000,
                'min': 100,
                'max': 10000,
                'description': 'Packets per second'
            }
        }
    }
}

# Starter plan tools (free tier) - Also for Trial users
STARTER_TOOLS = ['nmap', 'nikto', 'whatweb', 'dirb', 'whois', 'dig', 'sslscan']

# Professional plan tools
PROFESSIONAL_TOOLS = STARTER_TOOLS + ['gobuster', 'sqlmap', 'wpscan', 'dnsrecon', 'theHarvester', 'enum4linux']

# Team plan tools (same as professional + more)
TEAM_TOOLS = PROFESSIONAL_TOOLS + ['masscan', 'hydra']

# Enterprise plan tools (all)
ENTERPRISE_TOOLS = list(TOOL_CONFIGS.keys())


class ScanExecutor:
    """Executes security scans with real Kali tools"""
    
    def __init__(self, use_docker: bool = True):
        self.use_docker = use_docker
        self.active_scans: Dict[str, subprocess.Popen] = {}
        self.scan_outputs: Dict[str, queue.Queue] = {}
        self.scan_results: Dict[str, Dict[str, Any]] = {}
        
        # Docker image for sandboxed execution
        self.docker_image = 'kalilinux/kali-rolling'
        
    def get_tools_for_plan(self, plan_type: str) -> list:
        """Get available tools for a subscription plan"""
        if plan_type == 'enterprise':
            return ENTERPRISE_TOOLS
        elif plan_type == 'team':
            return TEAM_TOOLS
        elif plan_type == 'professional':
            return PROFESSIONAL_TOOLS
        else:  # starter, trial, or any other
            return STARTER_TOOLS
    
    def get_tool_config(self, tool_id: str) -> Optional[Dict]:
        """Get tool configuration"""
        return TOOL_CONFIGS.get(tool_id)
    
    def build_command(self, tool_id: str, target: str, parameters: Dict) -> list:
        """Build command line from tool config and parameters"""
        config = TOOL_CONFIGS.get(tool_id)
        if not config:
            raise ValueError(f"Unknown tool: {tool_id}")
        
        cmd = [config['command']]
        
        # Add base flags (e.g., -v for verbose) for real-time streaming
        if config.get('base_flags'):
            cmd.extend(config['base_flags'])
        
        # Special handling for different tools
        if tool_id == 'gobuster':
            mode = parameters.get('mode', 'dir')
            cmd.append(mode)
            cmd.extend(['-u', target])
        elif tool_id == 'dig':
            cmd.append(target)
            if parameters.get('record_type'):
                cmd.append(parameters['record_type'])
            if parameters.get('short'):
                cmd.append('+short')
            return cmd
        elif tool_id == 'whois':
            cmd.append(target)
            return cmd
        elif tool_id == 'dirb':
            cmd.append(target)
            if parameters.get('wordlist'):
                cmd.append(parameters['wordlist'])
        elif tool_id == 'hydra':
            service = parameters.get('service', 'ssh')
            if parameters.get('username'):
                cmd.extend(['-l', parameters['username']])
            if parameters.get('password_list'):
                cmd.extend(['-P', parameters['password_list']])
            if parameters.get('threads'):
                cmd.extend(['-t', str(parameters['threads'])])
            cmd.append(f"{target}")
            cmd.append(service)
            return cmd
        elif tool_id == 'sqlmap':
            cmd.extend(['-u', target])
            cmd.extend(['--batch'])  # Non-interactive
        elif tool_id == 'wpscan':
            cmd.extend(['--url', target])
        elif tool_id == 'sslscan':
            cmd.append('--no-colour')
            cmd.append(target)
            return cmd
        elif tool_id == 'masscan':
            cmd.append(target)
        elif tool_id == 'dnsrecon':
            cmd.extend(['-d', target])
        elif tool_id == 'theHarvester':
            cmd.extend(['-d', target])
        elif tool_id == 'enum4linux':
            pass  # Target added at end
        else:
            # Default: add target at end (nmap, nikto, whatweb, etc.)
            pass
        
        # Process parameters from config
        for param_name, param_value in parameters.items():
            if param_name in ['mode', 'service']:
                continue  # Already handled
            
            param_config = config.get('parameters', {}).get(param_name)
            if not param_config:
                continue
            
            flag = param_config.get('flag', '')
            param_type = param_config.get('type', 'text')
            
            if param_type == 'boolean':
                if param_value and flag:
                    cmd.append(flag)
            elif param_type == 'target':
                continue  # Target handled separately
            elif param_value and flag:
                if flag.endswith('='):
                    cmd.append(f"{flag}{param_value}")
                else:
                    cmd.extend([flag, str(param_value)])
            elif param_value and not flag:
                cmd.append(str(param_value))
        
        # Add target for tools that need it at the end
        if tool_id in ['nmap', 'nikto', 'whatweb', 'masscan', 'enum4linux']:
            if tool_id == 'nikto':
                cmd.extend(['-h', target])
            else:
                cmd.append(target)
        
        return cmd
    
    def validate_target(self, target: str) -> tuple:
        """Validate target is safe to scan"""
        import re
        
        # Block localhost and private IPs (our server can't reach them)
        blocked_patterns = [
            r'^localhost',
            r'^127\.',
            r'^10\.',
            r'^172\.(1[6-9]|2[0-9]|3[01])\.',
            r'^192\.168\.',
            r'^0\.',
            r'^169\.254\.',
        ]
        
        for pattern in blocked_patterns:
            if re.match(pattern, target, re.IGNORECASE):
                return False, (
                    f"Target {target} is a private/internal IP address. "
                    "Our cloud server cannot reach internal networks. "
                    "To scan internal networks, please: "
                    "1) Deploy a Remote Agent in your network (Team/Enterprise plan), or "
                    "2) Use public IP/domain addresses for external testing. "
                    "Try: scanme.nmap.org for demo scanning."
                )
        
        return True, "Target is valid"
    
    def start_scan(self, scan_id: str, tool_id: str, target: str, 
                   parameters: Dict, callback: Optional[Callable] = None,
                   completion_callback: Optional[Callable] = None) -> Dict:
        """Start a new scan
        
        Args:
            scan_id: Unique scan identifier
            tool_id: Tool to use
            target: Target to scan
            parameters: Tool parameters
            callback: Called for each output line (scan_id, line)
            completion_callback: Called when scan completes (scan_id, status, output, exit_code)
        """
        
        # Validate target
        is_valid, message = self.validate_target(target)
        if not is_valid:
            return {
                'success': False,
                'error': message,
                'scan_id': scan_id
            }
        
        try:
            cmd = self.build_command(tool_id, target, parameters)
        except ValueError as e:
            return {
                'success': False,
                'error': str(e),
                'scan_id': scan_id
            }
        
        # Create output queue for streaming
        output_queue = queue.Queue()
        self.scan_outputs[scan_id] = output_queue
        
        # Initialize result
        self.scan_results[scan_id] = {
            'scan_id': scan_id,
            'tool': tool_id,
            'target': target,
            'command': ' '.join(cmd),
            'status': 'running',
            'output': '',
            'started_at': datetime.utcnow().isoformat(),
            'completed_at': None
        }
        
        def run_process():
            try:
                # Add timeout based on tool
                timeout = 300  # 5 minutes default
                if tool_id in ['masscan', 'hydra', 'sqlmap']:
                    timeout = 600  # 10 minutes for intensive tools
                
                if self.use_docker:
                    # Run in Docker container for isolation
                    docker_cmd = [
                        'docker', 'run', '--rm',
                        '--network=host',
                        '--cpus=0.5',
                        '--memory=512m',
                        self.docker_image
                    ] + cmd
                    process = subprocess.Popen(
                        docker_cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        bufsize=1
                    )
                else:
                    # Run directly (for development)
                    process = subprocess.Popen(
                        cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        bufsize=1
                    )
                
                self.active_scans[scan_id] = process
                
                full_output = []
                start_time = time.time()
                
                for line in iter(process.stdout.readline, ''):
                    if time.time() - start_time > timeout:
                        process.kill()
                        output_queue.put(f"\n[TIMEOUT] Scan exceeded {timeout}s limit\n")
                        break
                    
                    full_output.append(line)
                    output_queue.put(line)
                    
                    if callback:
                        callback(scan_id, line)
                
                process.wait()
                
                final_status = 'completed' if process.returncode == 0 else 'failed'
                final_output = ''.join(full_output)
                
                self.scan_results[scan_id]['output'] = final_output
                self.scan_results[scan_id]['status'] = final_status
                self.scan_results[scan_id]['completed_at'] = datetime.utcnow().isoformat()
                self.scan_results[scan_id]['exit_code'] = process.returncode
                
                # Call completion callback to update database
                if completion_callback:
                    try:
                        completion_callback(scan_id, final_status, final_output, process.returncode)
                    except Exception as cb_error:
                        print(f"Completion callback error for {scan_id}: {cb_error}")
                
                output_queue.put(None)  # Signal end
                
            except Exception as e:
                self.scan_results[scan_id]['status'] = 'error'
                self.scan_results[scan_id]['error'] = str(e)
                output_queue.put(f"\n[ERROR] {str(e)}\n")
                
                # Call completion callback with error status
                if completion_callback:
                    try:
                        completion_callback(scan_id, 'failed', str(e), -1)
                    except Exception as cb_error:
                        print(f"Completion callback error for {scan_id}: {cb_error}")
                
                output_queue.put(None)
            
            finally:
                if scan_id in self.active_scans:
                    del self.active_scans[scan_id]
        
        # Start scan in background thread
        thread = threading.Thread(target=run_process, daemon=True)
        thread.start()
        
        return {
            'success': True,
            'scan_id': scan_id,
            'command': ' '.join(cmd),
            'status': 'running'
        }
    
    def stop_scan(self, scan_id: str) -> Dict:
        """Stop a running scan"""
        if scan_id in self.active_scans:
            process = self.active_scans[scan_id]
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            
            self.scan_results[scan_id]['status'] = 'cancelled'
            self.scan_results[scan_id]['completed_at'] = datetime.utcnow().isoformat()
            
            return {'success': True, 'message': 'Scan cancelled'}
        
        return {'success': False, 'error': 'Scan not found or already completed'}
    
    def get_scan_output(self, scan_id: str, timeout: float = 0.1) -> Optional[str]:
        """Get next line of output from a running scan"""
        if scan_id not in self.scan_outputs:
            return None
        
        try:
            line = self.scan_outputs[scan_id].get(timeout=timeout)
            return line
        except queue.Empty:
            return ''
    
    def get_scan_result(self, scan_id: str) -> Optional[Dict]:
        """Get scan result"""
        return self.scan_results.get(scan_id)
    
    def get_all_tool_configs(self) -> Dict:
        """Get all tool configurations"""
        return TOOL_CONFIGS


# Global executor instance
executor = ScanExecutor(use_docker=False)  # Set to True in production


def get_executor() -> ScanExecutor:
    """Get the global scan executor"""
    return executor
