"""
CyberSec Professional - Flask Backend
Modern REST API for security tools management
"""

import csv
import io
import json
import os
import subprocess
import time
from datetime import datetime, timezone

import jwt
from flask import Flask, jsonify, request
from flask_cors import CORS, cross_origin

from config import Config
from license import license_manager, generate_license_key
from models import db, User, Tool, Scan, Project, Target, Vulnerability, Report
from routes import core_bp, terminal_bp, monitoring_bp, audit_bp
from services import (
    get_current_user,
    token_required,
    admin_ip_required,
    rate_limit,
    rate_limit_admin,
    _admin_ip_allowed,
    _admin_token_valid,
    _audit_log,
    _clamp_lines,
    _clamp_text,
    _mask_license_key,
    _require_json,
)

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, origins=app.config.get('CORS_ORIGINS'))
db.init_app(app)

app.register_blueprint(core_bp)
app.register_blueprint(terminal_bp)
app.register_blueprint(monitoring_bp)
app.register_blueprint(audit_bp)

# ==================== AUTH ====================

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Username and password required'}), 400
        
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        user = User(
            username=data['username'],
            email=data.get('email', f"{data['username']}@local.com"),
            role=data.get('role', 'user')
        )
        user.set_password(data['password'])
        db.session.add(user)
        db.session.commit()
        
        return jsonify({'message': 'User registered successfully', 'user': user.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Username and password required'}), 400
        
        user = User.query.filter_by(username=data['username']).first()
        if not user or not user.check_password(data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not user.is_active:
            return jsonify({'error': 'Account disabled'}), 403
        
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        token = jwt.encode({
            'user_id': user.id,
            'username': user.username,
            'role': user.role,
            'exp': datetime.utcnow().timestamp() + 86400
        }, app.config['JWT_SECRET_KEY'], algorithm='HS256')
        
        return jsonify({'message': 'Login successful', 'token': token, 'user': user.to_dict()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tools', methods=['GET'])
def get_tools():
    try:
        query = Tool.query
        if request.args.get('category'):
            query = query.filter_by(category=request.args['category'])
        if request.args.get('installed'):
            query = query.filter_by(installed=request.args['installed'].lower() == 'true')
        if request.args.get('search'):
            query = query.filter(Tool.name.ilike(f'%{request.args["search"]}%'))
        tools = [t.to_dict() for t in query.all()]
        return jsonify({'tools': tools, 'total': len(tools)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tools/<int:tool_id>', methods=['GET'])
def get_tool(tool_id):
    try:
        tool = Tool.query.get_or_404(tool_id)
        return jsonify(tool.to_dict())
    except:
        return jsonify({'error': 'Not found'}), 404


# Tool presets and detailed information
TOOL_PRESETS = {
    'Nmap': {
        'description_full': '''Nmap ("Network Mapper") is a free and open source utility for network discovery and security auditing. 
        It uses raw IP packets to determine what hosts are available on the network, what services those hosts are offering, 
        what operating systems they are running, what type of packet filters/firewalls are in use, and dozens of other characteristics.''',
        'presets': [
            {
                'name': 'Quick Scan',
                'description': 'Fast scan of top 100 ports - good for quick overview',
                'command': 'nmap -T4 -F {target}',
                'time': '~30 seconds',
                'difficulty': 'beginner'
            },
            {
                'name': 'Full Port Scan',
                'description': 'Scan all 65535 ports - comprehensive but slow',
                'command': 'nmap -p- {target}',
                'time': '~15-30 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Service Version Detection',
                'description': 'Detect service versions on open ports',
                'command': 'nmap -sV {target}',
                'time': '~2-5 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'OS Detection',
                'description': 'Attempt to identify the operating system',
                'command': 'sudo nmap -O {target}',
                'time': '~2-5 minutes',
                'difficulty': 'intermediate',
                'requires_sudo': True
            },
            {
                'name': 'Aggressive Scan',
                'description': 'OS detection, version detection, script scanning, and traceroute',
                'command': 'nmap -A {target}',
                'time': '~5-10 minutes',
                'difficulty': 'intermediate'
            },
            {
                'name': 'Vulnerability Scan',
                'description': 'Run vulnerability detection scripts',
                'command': 'nmap --script vuln {target}',
                'time': '~10-20 minutes',
                'difficulty': 'intermediate'
            },
            {
                'name': 'Stealth SYN Scan',
                'description': 'Stealthy scan that does not complete TCP connections',
                'command': 'sudo nmap -sS {target}',
                'time': '~1-3 minutes',
                'difficulty': 'advanced',
                'requires_sudo': True
            },
            {
                'name': 'UDP Scan',
                'description': 'Scan UDP ports (slower but finds different services)',
                'command': 'sudo nmap -sU --top-ports 100 {target}',
                'time': '~5-15 minutes',
                'difficulty': 'intermediate',
                'requires_sudo': True
            }
        ],
        'parameters': [
            {'name': 'target', 'description': 'IP address, hostname, or CIDR range (e.g., 192.168.1.1, example.com, 10.0.0.0/24)', 'required': True, 'example': '10.0.0.115'},
            {'name': '-p', 'description': 'Port specification (e.g., -p 22, -p 1-1000, -p-)', 'required': False, 'example': '-p 22,80,443'},
            {'name': '-T', 'description': 'Timing template (0-5, higher is faster but noisier)', 'required': False, 'example': '-T4'},
            {'name': '-oN', 'description': 'Output to file in normal format', 'required': False, 'example': '-oN scan_results.txt'}
        ],
        'examples': [
            {'description': 'Scan single host', 'command': 'nmap 192.168.1.1'},
            {'description': 'Scan specific ports', 'command': 'nmap -p 22,80,443 192.168.1.1'},
            {'description': 'Scan entire network', 'command': 'nmap 192.168.1.0/24'},
            {'description': 'Fast scan with version detection', 'command': 'nmap -T4 -sV 192.168.1.1'}
        ]
    },
    'Nikto': {
        'description_full': '''Nikto is an Open Source web server scanner which performs comprehensive tests against web servers for multiple items, 
        including over 6700 potentially dangerous files/programs, checks for outdated versions of over 1250 servers, 
        and version specific problems on over 270 servers.''',
        'presets': [
            {
                'name': 'Basic Web Scan',
                'description': 'Standard web server vulnerability scan',
                'command': 'nikto -h {target}',
                'time': '~5-15 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Full Scan with All Plugins',
                'description': 'Comprehensive scan using all available plugins',
                'command': 'nikto -h {target} -Plugins "@@ALL"',
                'time': '~30-60 minutes',
                'difficulty': 'intermediate'
            },
            {
                'name': 'SSL/HTTPS Scan',
                'description': 'Scan HTTPS websites',
                'command': 'nikto -h {target} -ssl',
                'time': '~5-15 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Specific Port Scan',
                'description': 'Scan web server on specific port',
                'command': 'nikto -h {target} -p {port}',
                'time': '~5-15 minutes',
                'difficulty': 'beginner'
            }
        ],
        'parameters': [
            {'name': 'target', 'description': 'Target URL or IP address', 'required': True, 'example': 'http://10.0.0.115'},
            {'name': '-p', 'description': 'Port to scan', 'required': False, 'example': '-p 8080'},
            {'name': '-ssl', 'description': 'Force SSL mode', 'required': False},
            {'name': '-o', 'description': 'Output file', 'required': False, 'example': '-o report.html'}
        ],
        'examples': [
            {'description': 'Basic scan', 'command': 'nikto -h http://target.com'},
            {'description': 'Scan with output', 'command': 'nikto -h http://target.com -o report.html'}
        ]
    },
    'SQLMap': {
        'description_full': '''sqlmap is an open source penetration testing tool that automates the process of detecting and exploiting 
        SQL injection flaws and taking over database servers. It comes with a powerful detection engine, 
        many niche features for the ultimate penetration tester.''',
        'presets': [
            {
                'name': 'Basic SQL Injection Test',
                'description': 'Test URL for SQL injection vulnerabilities',
                'command': 'sqlmap -u "{target}" --batch',
                'time': '~5-15 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Database Enumeration',
                'description': 'List all databases after finding injection',
                'command': 'sqlmap -u "{target}" --dbs --batch',
                'time': '~10-30 minutes',
                'difficulty': 'intermediate'
            },
            {
                'name': 'Table Enumeration',
                'description': 'List all tables in a database',
                'command': 'sqlmap -u "{target}" -D {database} --tables --batch',
                'time': '~5-20 minutes',
                'difficulty': 'intermediate'
            },
            {
                'name': 'Dump Database',
                'description': 'Extract all data from a table',
                'command': 'sqlmap -u "{target}" -D {database} -T {table} --dump --batch',
                'time': '~10-60 minutes',
                'difficulty': 'advanced'
            },
            {
                'name': 'Form-based Injection',
                'description': 'Test POST forms for SQL injection',
                'command': 'sqlmap -u "{target}" --data="{post_data}" --batch',
                'time': '~5-15 minutes',
                'difficulty': 'intermediate'
            }
        ],
        'parameters': [
            {'name': 'target', 'description': 'URL with parameter (e.g., http://site.com/page?id=1)', 'required': True, 'example': 'http://10.0.0.115/page.php?id=1'},
            {'name': '--dbs', 'description': 'Enumerate databases', 'required': False},
            {'name': '-D', 'description': 'Database name to enumerate', 'required': False, 'example': '-D users'},
            {'name': '--tables', 'description': 'Enumerate tables', 'required': False}
        ],
        'examples': [
            {'description': 'Test URL', 'command': 'sqlmap -u "http://target.com/page?id=1"'},
            {'description': 'Get databases', 'command': 'sqlmap -u "http://target.com/page?id=1" --dbs'}
        ]
    },
    'Hydra': {
        'description_full': '''Hydra is a very fast network logon cracker which supports many different services. 
        It can perform rapid dictionary attacks against more than 50 protocols, including telnet, ftp, http, https, smb, 
        several databases, and much more.''',
        'presets': [
            {
                'name': 'SSH Brute Force',
                'description': 'Attack SSH login with username and password list',
                'command': 'hydra -l {username} -P /usr/share/wordlists/rockyou.txt {target} ssh',
                'time': '~5-60 minutes',
                'difficulty': 'intermediate'
            },
            {
                'name': 'FTP Brute Force',
                'description': 'Attack FTP login',
                'command': 'hydra -l {username} -P /usr/share/wordlists/rockyou.txt {target} ftp',
                'time': '~5-60 minutes',
                'difficulty': 'intermediate'
            },
            {
                'name': 'HTTP Basic Auth',
                'description': 'Attack HTTP Basic Authentication',
                'command': 'hydra -l {username} -P /usr/share/wordlists/rockyou.txt {target} http-get /',
                'time': '~5-30 minutes',
                'difficulty': 'intermediate'
            },
            {
                'name': 'Web Form Attack',
                'description': 'Attack web login forms',
                'command': 'hydra -l {username} -P /usr/share/wordlists/rockyou.txt {target} http-post-form "/login:user=^USER^&pass=^PASS^:Invalid"',
                'time': '~5-60 minutes',
                'difficulty': 'advanced'
            }
        ],
        'parameters': [
            {'name': 'target', 'description': 'Target IP or hostname', 'required': True, 'example': '10.0.0.115'},
            {'name': '-l', 'description': 'Single username', 'required': False, 'example': '-l admin'},
            {'name': '-L', 'description': 'Username list file', 'required': False, 'example': '-L users.txt'},
            {'name': '-P', 'description': 'Password list file', 'required': True, 'example': '-P /usr/share/wordlists/rockyou.txt'}
        ],
        'examples': [
            {'description': 'SSH attack', 'command': 'hydra -l root -P passwords.txt 192.168.1.1 ssh'},
            {'description': 'FTP attack', 'command': 'hydra -L users.txt -P passwords.txt 192.168.1.1 ftp'}
        ]
    },
    'Metasploit Framework': {
        'description_full': '''The Metasploit Framework is an advanced open-source platform for developing, testing, 
        and using exploit code. It provides a robust environment for penetration testing, exploit development, 
        and vulnerability research.''',
        'presets': [
            {
                'name': 'Start Metasploit Console',
                'description': 'Launch the interactive Metasploit console',
                'command': 'msfconsole',
                'time': '~30 seconds startup',
                'difficulty': 'intermediate'
            },
            {
                'name': 'Database Status',
                'description': 'Check Metasploit database connection',
                'command': 'msfconsole -q -x "db_status; exit"',
                'time': '~30 seconds',
                'difficulty': 'beginner'
            },
            {
                'name': 'Search Exploits',
                'description': 'Search for exploits by keyword',
                'command': 'msfconsole -q -x "search {keyword}; exit"',
                'time': '~30 seconds',
                'difficulty': 'beginner'
            }
        ],
        'parameters': [
            {'name': 'keyword', 'description': 'Search term for exploits', 'required': False, 'example': 'apache'},
            {'name': '-q', 'description': 'Quiet mode (no banner)', 'required': False},
            {'name': '-x', 'description': 'Execute command and exit', 'required': False}
        ],
        'examples': [
            {'description': 'Start console', 'command': 'msfconsole'},
            {'description': 'Search for Apache exploits', 'command': 'msfconsole -q -x "search apache"'}
        ]
    },
    'Gobuster': {
        'description_full': '''Gobuster is a tool used to brute-force URIs including directories and files as well as DNS subdomains.
        It's written in Go and is extremely fast compared to similar tools.''',
        'presets': [
            {
                'name': 'Directory Brute Force',
                'description': 'Find hidden directories on web server',
                'command': 'gobuster dir -u {target} -w /usr/share/wordlists/dirb/common.txt',
                'time': '~2-10 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Extended Directory Scan',
                'description': 'Comprehensive directory scan with larger wordlist',
                'command': 'gobuster dir -u {target} -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt',
                'time': '~30-120 minutes',
                'difficulty': 'intermediate'
            },
            {
                'name': 'File Extension Search',
                'description': 'Search for files with specific extensions',
                'command': 'gobuster dir -u {target} -w /usr/share/wordlists/dirb/common.txt -x php,html,txt,bak',
                'time': '~5-20 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'DNS Subdomain Enumeration',
                'description': 'Find subdomains of a domain',
                'command': 'gobuster dns -d {domain} -w /usr/share/wordlists/subdomains.txt',
                'time': '~5-30 minutes',
                'difficulty': 'intermediate'
            }
        ],
        'parameters': [
            {'name': 'target', 'description': 'Target URL', 'required': True, 'example': 'http://10.0.0.115'},
            {'name': '-w', 'description': 'Wordlist file path', 'required': True, 'example': '/usr/share/wordlists/dirb/common.txt'},
            {'name': '-x', 'description': 'File extensions to search', 'required': False, 'example': 'php,html,txt'},
            {'name': '-t', 'description': 'Number of threads', 'required': False, 'example': '-t 50'}
        ],
        'examples': [
            {'description': 'Basic directory scan', 'command': 'gobuster dir -u http://target.com -w /usr/share/wordlists/dirb/common.txt'},
            {'description': 'Find PHP files', 'command': 'gobuster dir -u http://target.com -w wordlist.txt -x php'}
        ]
    },
    'Wireshark': {
        'description_full': '''Wireshark is the world's foremost and widely-used network protocol analyzer. 
        It lets you see what's happening on your network at a microscopic level.''',
        'presets': [
            {
                'name': 'Start Wireshark GUI',
                'description': 'Launch Wireshark graphical interface',
                'command': 'wireshark',
                'time': 'Interactive',
                'difficulty': 'beginner'
            },
            {
                'name': 'Capture on Interface',
                'description': 'Capture packets on specific interface (CLI)',
                'command': 'sudo tshark -i {interface}',
                'time': 'Interactive',
                'difficulty': 'intermediate',
                'requires_sudo': True
            },
            {
                'name': 'Capture to File',
                'description': 'Save captured packets to file',
                'command': 'sudo tshark -i {interface} -w capture.pcap',
                'time': 'Interactive',
                'difficulty': 'intermediate',
                'requires_sudo': True
            }
        ],
        'parameters': [
            {'name': 'interface', 'description': 'Network interface to capture (eth0, wlan0, etc.)', 'required': True, 'example': 'eth0'},
            {'name': '-w', 'description': 'Output file for capture', 'required': False, 'example': '-w output.pcap'},
            {'name': '-f', 'description': 'Capture filter', 'required': False, 'example': '-f "port 80"'}
        ],
        'examples': [
            {'description': 'Start GUI', 'command': 'wireshark'},
            {'description': 'Capture HTTP traffic', 'command': 'sudo tshark -i eth0 -f "port 80"'}
        ]
    },
    'John the Ripper': {
        'description_full': '''John the Ripper is an Open Source password security auditing and password recovery tool 
        available for many operating systems. It is designed to detect weak Unix passwords.''',
        'presets': [
            {
                'name': 'Crack Password Hash',
                'description': 'Attempt to crack password hashes in a file',
                'command': 'john {hashfile}',
                'time': '~minutes to hours',
                'difficulty': 'beginner'
            },
            {
                'name': 'Wordlist Attack',
                'description': 'Use wordlist to crack hashes',
                'command': 'john --wordlist=/usr/share/wordlists/rockyou.txt {hashfile}',
                'time': '~minutes to hours',
                'difficulty': 'beginner'
            },
            {
                'name': 'Show Cracked Passwords',
                'description': 'Display already cracked passwords',
                'command': 'john --show {hashfile}',
                'time': '~seconds',
                'difficulty': 'beginner'
            },
            {
                'name': 'Specify Hash Format',
                'description': 'Crack with specific hash format',
                'command': 'john --format={format} {hashfile}',
                'time': '~minutes to hours',
                'difficulty': 'intermediate'
            }
        ],
        'parameters': [
            {'name': 'hashfile', 'description': 'File containing password hashes', 'required': True, 'example': 'hashes.txt'},
            {'name': '--wordlist', 'description': 'Wordlist file for dictionary attack', 'required': False, 'example': '/usr/share/wordlists/rockyou.txt'},
            {'name': '--format', 'description': 'Hash format (md5, sha1, bcrypt, etc.)', 'required': False, 'example': 'md5'}
        ],
        'examples': [
            {'description': 'Basic crack', 'command': 'john hashes.txt'},
            {'description': 'Wordlist attack', 'command': 'john --wordlist=rockyou.txt hashes.txt'}
        ]
    },
    'Hashcat': {
        'description_full': '''Hashcat is the world's fastest and most advanced password recovery utility, 
        supporting five unique modes of attack for over 300 highly-optimized hashing algorithms.''',
        'presets': [
            {
                'name': 'Dictionary Attack',
                'description': 'Crack hashes using wordlist',
                'command': 'hashcat -m {mode} {hashfile} /usr/share/wordlists/rockyou.txt',
                'time': '~minutes to hours',
                'difficulty': 'intermediate'
            },
            {
                'name': 'Brute Force Attack',
                'description': 'Try all possible combinations',
                'command': 'hashcat -m {mode} -a 3 {hashfile} ?a?a?a?a?a?a',
                'time': '~hours to days',
                'difficulty': 'advanced'
            },
            {
                'name': 'Show Cracked',
                'description': 'Display cracked passwords',
                'command': 'hashcat -m {mode} {hashfile} --show',
                'time': '~seconds',
                'difficulty': 'beginner'
            }
        ],
        'parameters': [
            {'name': 'hashfile', 'description': 'File containing hashes', 'required': True, 'example': 'hashes.txt'},
            {'name': '-m', 'description': 'Hash mode (0=MD5, 100=SHA1, 1000=NTLM, etc.)', 'required': True, 'example': '0'},
            {'name': '-a', 'description': 'Attack mode (0=dict, 3=brute)', 'required': False, 'example': '0'}
        ],
        'examples': [
            {'description': 'Crack MD5', 'command': 'hashcat -m 0 hashes.txt wordlist.txt'},
            {'description': 'Crack NTLM', 'command': 'hashcat -m 1000 hashes.txt wordlist.txt'}
        ]
    },
    'Dirb': {
        'description_full': '''DIRB is a Web Content Scanner. It looks for existing (and/or hidden) Web Objects. 
        It basically works by launching a dictionary based attack against a web server and analyzing the response.''',
        'presets': [
            {
                'name': 'Basic Directory Scan',
                'description': 'Scan for common directories',
                'command': 'dirb {target}',
                'time': '~5-15 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Custom Wordlist',
                'description': 'Scan using specific wordlist',
                'command': 'dirb {target} {wordlist}',
                'time': '~5-60 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Extension Search',
                'description': 'Search for specific file extensions',
                'command': 'dirb {target} -X .php,.html,.txt',
                'time': '~10-30 minutes',
                'difficulty': 'intermediate'
            }
        ],
        'parameters': [
            {'name': 'target', 'description': 'Target URL', 'required': True, 'example': 'http://10.0.0.115'},
            {'name': 'wordlist', 'description': 'Custom wordlist path', 'required': False, 'example': '/usr/share/wordlists/dirb/big.txt'},
            {'name': '-X', 'description': 'Extensions to append', 'required': False, 'example': '.php,.html'}
        ],
        'examples': [
            {'description': 'Basic scan', 'command': 'dirb http://target.com'},
            {'description': 'With extensions', 'command': 'dirb http://target.com -X .php,.html'}
        ]
    },
    'WPScan': {
        'description_full': '''WPScan is a free, for non-commercial use, black box WordPress security scanner written for security professionals and blog maintainers to test the security of their WordPress websites.''',
        'presets': [
            {
                'name': 'Basic WordPress Scan',
                'description': 'Scan WordPress site for vulnerabilities',
                'command': 'wpscan --url {target}',
                'time': '~2-10 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Enumerate Users',
                'description': 'Find WordPress usernames',
                'command': 'wpscan --url {target} -e u',
                'time': '~2-5 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Enumerate Plugins',
                'description': 'Find installed plugins and vulnerabilities',
                'command': 'wpscan --url {target} -e ap',
                'time': '~5-15 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Full Enumeration',
                'description': 'Enumerate users, plugins, themes, and timthumbs',
                'command': 'wpscan --url {target} -e vp,vt,u,tt',
                'time': '~10-30 minutes',
                'difficulty': 'intermediate'
            },
            {
                'name': 'Password Attack',
                'description': 'Brute force WordPress login',
                'command': 'wpscan --url {target} -U {username} -P /usr/share/wordlists/rockyou.txt',
                'time': '~30-120 minutes',
                'difficulty': 'advanced'
            }
        ],
        'parameters': [
            {'name': 'target', 'description': 'WordPress site URL', 'required': True, 'example': 'http://10.0.0.115/wordpress'},
            {'name': '-e', 'description': 'Enumeration mode (u=users, ap=all plugins, vp=vulnerable plugins, vt=vulnerable themes)', 'required': False, 'example': '-e u,ap'},
            {'name': '-U', 'description': 'Username for password attack', 'required': False, 'example': '-U admin'},
            {'name': '-P', 'description': 'Password wordlist', 'required': False, 'example': '-P /usr/share/wordlists/rockyou.txt'}
        ],
        'examples': [
            {'description': 'Basic scan', 'command': 'wpscan --url http://target.com'},
            {'description': 'Enumerate all', 'command': 'wpscan --url http://target.com -e ap,at,u'}
        ]
    },
    'Masscan': {
        'description_full': '''Masscan is the fastest Internet port scanner. It can scan the entire Internet in under 6 minutes, transmitting 10 million packets per second.''',
        'presets': [
            {
                'name': 'Quick Port Scan',
                'description': 'Fast scan of common ports',
                'command': 'sudo masscan {target} -p 80,443,22,21,25 --rate=1000',
                'time': '~30 seconds',
                'difficulty': 'beginner',
                'requires_sudo': True
            },
            {
                'name': 'Top 100 Ports',
                'description': 'Scan top 100 common ports',
                'command': 'sudo masscan {target} --top-ports 100 --rate=1000',
                'time': '~1-2 minutes',
                'difficulty': 'beginner',
                'requires_sudo': True
            },
            {
                'name': 'Full Network Scan',
                'description': 'Scan entire network range',
                'command': 'sudo masscan {target}/24 -p 1-1000 --rate=10000',
                'time': '~5-15 minutes',
                'difficulty': 'intermediate',
                'requires_sudo': True
            },
            {
                'name': 'Web Ports Only',
                'description': 'Scan common web ports',
                'command': 'sudo masscan {target} -p 80,443,8080,8443,8000 --rate=1000',
                'time': '~30 seconds',
                'difficulty': 'beginner',
                'requires_sudo': True
            }
        ],
        'parameters': [
            {'name': 'target', 'description': 'Target IP or CIDR range', 'required': True, 'example': '10.0.0.0/24'},
            {'name': '-p', 'description': 'Ports to scan', 'required': True, 'example': '-p 80,443,22'},
            {'name': '--rate', 'description': 'Packets per second', 'required': False, 'example': '--rate=10000'}
        ],
        'examples': [
            {'description': 'Quick scan', 'command': 'sudo masscan 192.168.1.0/24 -p 80,443 --rate=1000'},
            {'description': 'All ports', 'command': 'sudo masscan 10.0.0.1 -p 1-65535 --rate=10000'}
        ]
    },
    'theHarvester': {
        'description_full': '''theHarvester is a very simple to use, yet powerful and effective tool designed to be used in the early stages of a penetration test to gather email accounts, subdomain names, virtual hosts, open ports/banners, and employee names from different public sources.''',
        'presets': [
            {
                'name': 'Google Search',
                'description': 'Gather information using Google',
                'command': 'theHarvester -d {domain} -b google',
                'time': '~1-5 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'All Sources',
                'description': 'Search all available sources',
                'command': 'theHarvester -d {domain} -b all',
                'time': '~5-15 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'LinkedIn Search',
                'description': 'Find employees on LinkedIn',
                'command': 'theHarvester -d {domain} -b linkedin',
                'time': '~2-5 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Subdomain Enumeration',
                'description': 'Find subdomains using multiple sources',
                'command': 'theHarvester -d {domain} -b bing,google,yahoo,baidu',
                'time': '~5-10 minutes',
                'difficulty': 'intermediate'
            }
        ],
        'parameters': [
            {'name': 'domain', 'description': 'Target domain name', 'required': True, 'example': 'example.com'},
            {'name': '-b', 'description': 'Data source (google, bing, linkedin, all)', 'required': True, 'example': '-b google'},
            {'name': '-l', 'description': 'Limit results', 'required': False, 'example': '-l 500'}
        ],
        'examples': [
            {'description': 'Google search', 'command': 'theHarvester -d example.com -b google'},
            {'description': 'All sources', 'command': 'theHarvester -d example.com -b all'}
        ]
    },
    'Netdiscover': {
        'description_full': '''Netdiscover is an active/passive ARP reconnaissance tool, initially developed to gain information about wireless networks without DHCP servers in wardriving scenarios.''',
        'presets': [
            {
                'name': 'Quick Network Scan',
                'description': 'Discover hosts on local network',
                'command': 'sudo netdiscover -r {target}/24',
                'time': '~1-5 minutes',
                'difficulty': 'beginner',
                'requires_sudo': True
            },
            {
                'name': 'Passive Mode',
                'description': 'Passively sniff ARP packets (stealthy)',
                'command': 'sudo netdiscover -p',
                'time': 'Continuous',
                'difficulty': 'beginner',
                'requires_sudo': True
            },
            {
                'name': 'Specific Interface',
                'description': 'Scan on specific network interface',
                'command': 'sudo netdiscover -i {interface} -r {target}/24',
                'time': '~1-5 minutes',
                'difficulty': 'beginner',
                'requires_sudo': True
            }
        ],
        'parameters': [
            {'name': 'target', 'description': 'Network range to scan', 'required': True, 'example': '192.168.1.0'},
            {'name': '-r', 'description': 'Range in CIDR notation', 'required': True, 'example': '-r 192.168.1.0/24'},
            {'name': '-i', 'description': 'Network interface', 'required': False, 'example': '-i eth0'},
            {'name': '-p', 'description': 'Passive mode', 'required': False}
        ],
        'examples': [
            {'description': 'Scan local network', 'command': 'sudo netdiscover -r 192.168.1.0/24'},
            {'description': 'Passive sniffing', 'command': 'sudo netdiscover -p'}
        ]
    },
    'OWASP ZAP': {
        'description_full': '''OWASP ZAP (Zed Attack Proxy) is one of the world most popular free security tools and is actively maintained by a dedicated international team of volunteers. It can help you automatically find security vulnerabilities in your web applications.''',
        'presets': [
            {
                'name': 'Start ZAP GUI',
                'description': 'Launch ZAP graphical interface',
                'command': 'zaproxy',
                'time': 'Interactive',
                'difficulty': 'beginner'
            },
            {
                'name': 'Quick Scan',
                'description': 'Run automated scan against target',
                'command': 'zap-cli quick-scan {target}',
                'time': '~10-30 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Spider Scan',
                'description': 'Crawl and discover all pages',
                'command': 'zap-cli spider {target}',
                'time': '~5-20 minutes',
                'difficulty': 'intermediate'
            },
            {
                'name': 'Active Scan',
                'description': 'Perform active security testing',
                'command': 'zap-cli active-scan {target}',
                'time': '~30-120 minutes',
                'difficulty': 'intermediate'
            }
        ],
        'parameters': [
            {'name': 'target', 'description': 'Target URL', 'required': True, 'example': 'http://10.0.0.115'},
            {'name': '--spider', 'description': 'Enable spider (crawler)', 'required': False},
            {'name': '--recursive', 'description': 'Scan recursively', 'required': False}
        ],
        'examples': [
            {'description': 'Start GUI', 'command': 'zaproxy'},
            {'description': 'Quick scan', 'command': 'zap-cli quick-scan http://target.com'}
        ]
    },
    'Lynis': {
        'description_full': '''Lynis is a battle-tested security tool for systems running Linux, macOS, or Unix-based operating system. It performs an extensive health scan of your systems to support system hardening and compliance testing.''',
        'presets': [
            {
                'name': 'System Audit',
                'description': 'Full security audit of local system',
                'command': 'sudo lynis audit system',
                'time': '~5-15 minutes',
                'difficulty': 'beginner',
                'requires_sudo': True
            },
            {
                'name': 'Quick Scan',
                'description': 'Fast security check',
                'command': 'sudo lynis audit system --quick',
                'time': '~2-5 minutes',
                'difficulty': 'beginner',
                'requires_sudo': True
            },
            {
                'name': 'Pentest Mode',
                'description': 'Run in penetration testing mode',
                'command': 'sudo lynis audit system --pentest',
                'time': '~5-15 minutes',
                'difficulty': 'intermediate',
                'requires_sudo': True
            }
        ],
        'parameters': [
            {'name': 'audit', 'description': 'Audit type', 'required': True, 'example': 'audit system'},
            {'name': '--quick', 'description': 'Quick mode', 'required': False},
            {'name': '--pentest', 'description': 'Pentest mode', 'required': False}
        ],
        'examples': [
            {'description': 'Full audit', 'command': 'sudo lynis audit system'},
            {'description': 'Quick check', 'command': 'sudo lynis audit system --quick'}
        ]
    },
    'Aircrack-ng': {
        'description_full': '''Aircrack-ng is a complete suite of tools to assess WiFi network security. It focuses on different areas of WiFi security: monitoring, attacking, testing, and cracking.''',
        'presets': [
            {
                'name': 'Start Monitor Mode',
                'description': 'Put wireless interface in monitor mode',
                'command': 'sudo airmon-ng start {interface}',
                'time': '~5 seconds',
                'difficulty': 'intermediate',
                'requires_sudo': True
            },
            {
                'name': 'Scan Networks',
                'description': 'Scan for wireless networks',
                'command': 'sudo airodump-ng {interface}mon',
                'time': 'Continuous',
                'difficulty': 'intermediate',
                'requires_sudo': True
            },
            {
                'name': 'Crack WPA Handshake',
                'description': 'Crack captured WPA handshake',
                'command': 'aircrack-ng -w /usr/share/wordlists/rockyou.txt {capture_file}',
                'time': '~minutes to hours',
                'difficulty': 'advanced'
            }
        ],
        'parameters': [
            {'name': 'interface', 'description': 'Wireless interface', 'required': True, 'example': 'wlan0'},
            {'name': '-w', 'description': 'Wordlist for cracking', 'required': False, 'example': '/usr/share/wordlists/rockyou.txt'},
            {'name': 'capture_file', 'description': 'Captured handshake file', 'required': False, 'example': 'capture-01.cap'}
        ],
        'examples': [
            {'description': 'Start monitor mode', 'command': 'sudo airmon-ng start wlan0'},
            {'description': 'Scan networks', 'command': 'sudo airodump-ng wlan0mon'}
        ]
    },
    'Enum4linux': {
        'description_full': '''Enum4linux is a tool for enumerating information from Windows and Samba systems. It attempts to offer similar functionality to enum.exe formerly available from www.bindview.com.''',
        'presets': [
            {
                'name': 'Full Enumeration',
                'description': 'Complete enumeration of target',
                'command': 'enum4linux -a {target}',
                'time': '~2-10 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'User Enumeration',
                'description': 'Enumerate users only',
                'command': 'enum4linux -U {target}',
                'time': '~1-3 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'Share Enumeration',
                'description': 'Enumerate shares only',
                'command': 'enum4linux -S {target}',
                'time': '~1-3 minutes',
                'difficulty': 'beginner'
            },
            {
                'name': 'OS Information',
                'description': 'Get OS information',
                'command': 'enum4linux -o {target}',
                'time': '~30 seconds',
                'difficulty': 'beginner'
            }
        ],
        'parameters': [
            {'name': 'target', 'description': 'Target IP address', 'required': True, 'example': '10.0.0.115'},
            {'name': '-a', 'description': 'Full enumeration', 'required': False},
            {'name': '-U', 'description': 'User enumeration', 'required': False},
            {'name': '-S', 'description': 'Share enumeration', 'required': False}
        ],
        'examples': [
            {'description': 'Full enum', 'command': 'enum4linux -a 192.168.1.1'},
            {'description': 'Users only', 'command': 'enum4linux -U 192.168.1.1'}
        ]
    },
    'Searchsploit': {
        'description_full': '''SearchSploit is a command line search tool for Exploit-DB that allows you to take a copy of the Exploit Database with you, everywhere you go.''',
        'presets': [
            {
                'name': 'Search Exploits',
                'description': 'Search for exploits by keyword',
                'command': 'searchsploit {keyword}',
                'time': '~5 seconds',
                'difficulty': 'beginner'
            },
            {
                'name': 'Exact Match',
                'description': 'Search with exact title match',
                'command': 'searchsploit -t {keyword}',
                'time': '~5 seconds',
                'difficulty': 'beginner'
            },
            {
                'name': 'Copy Exploit',
                'description': 'Copy exploit to current directory',
                'command': 'searchsploit -m {exploit_id}',
                'time': '~2 seconds',
                'difficulty': 'beginner'
            },
            {
                'name': 'Update Database',
                'description': 'Update the exploit database',
                'command': 'searchsploit -u',
                'time': '~1-5 minutes',
                'difficulty': 'beginner'
            }
        ],
        'parameters': [
            {'name': 'keyword', 'description': 'Search term (e.g., apache, wordpress, ssh)', 'required': True, 'example': 'apache 2.4'},
            {'name': '-t', 'description': 'Search in title only', 'required': False},
            {'name': '-m', 'description': 'Mirror (copy) exploit to current dir', 'required': False},
            {'name': '-u', 'description': 'Update database', 'required': False}
        ],
        'examples': [
            {'description': 'Search Apache', 'command': 'searchsploit apache 2.4'},
            {'description': 'Search WordPress', 'command': 'searchsploit wordpress 5.0'}
        ]
    }
}

# Installation information for tools that are not installed by default
TOOL_INSTALLATION_INFO = {
    'Maltego CE': {
        'reason': 'Community Edition - Free but needs registration',
        'install_command': 'apt install maltego',
        'install_type': 'apt',
        'note': 'Free Community Edition. For OSINT, consider SpiderFoot, Recon-ng or theHarvester (all installed)'
    },
    'Burp Suite CE': {
        'reason': 'Community Edition - Free but limited features',
        'install_command': 'apt install burpsuite',
        'install_type': 'apt',
        'note': 'Free Community Edition. Better alternative: OWASP ZAP (already installed)'
    },
    'Commix': {
        'reason': 'Not installed by default in Kali',
        'install_command': 'apt install commix',
        'install_type': 'apt',
        'note': 'Command injection exploitation tool'
    },
    'Joomla Scanner': {
        'reason': 'Specialized CMS scanner',
        'install_command': 'git clone https://github.com/rezasp/joomscan.git',
        'install_type': 'git',
        'note': 'Joomla-specific vulnerability scanner'
    },
    'Skipfish': {
        'reason': 'Not installed by default',
        'install_command': 'apt install skipfish',
        'install_type': 'apt',
        'note': 'Google web application security scanner'
    },
    'Dirbuster': {
        'reason': 'Replaced by Gobuster in modern Kali',
        'install_command': 'apt install dirbuster',
        'install_type': 'apt',
        'note': 'GUI-based directory brute forcer, Gobuster is faster CLI alternative'
    },
    'SQLNinja': {
        'reason': 'Specialized SQL Server exploitation',
        'install_command': 'apt install sqlninja',
        'install_type': 'apt',
        'note': 'MS SQL Server focused, SQLMap is more versatile'
    },
    'Hexorbase': {
        'reason': 'Database GUI tool',
        'install_command': 'apt install hexorbase',
        'install_type': 'apt',
        'note': 'Multi-database management and bruteforce tool'
    },
    'Kismet': {
        'reason': 'Wireless network detector requiring specific hardware',
        'install_command': 'apt install kismet',
        'install_type': 'apt',
        'note': 'Requires compatible wireless adapter with monitor mode'
    },
    'Fern Wifi Cracker': {
        'reason': 'GUI wireless auditing tool',
        'install_command': 'apt install fern-wifi-cracker',
        'install_type': 'apt',
        'note': 'Requires wireless adapter with injection capability'
    },
    'BeEF': {
        'reason': 'Browser exploitation framework',
        'install_command': 'apt install beef-xss',
        'install_type': 'apt',
        'note': 'Browser Exploitation Framework, requires Ruby'
    },
    'Armitage': {
        'reason': 'Metasploit GUI frontend',
        'install_command': 'apt install armitage',
        'install_type': 'apt',
        'note': 'Graphical cyber attack management for Metasploit'
    },
    'Veil': {
        'reason': 'AV evasion framework',
        'install_command': 'apt install veil',
        'install_type': 'apt',
        'note': 'Generates payloads that bypass antivirus'
    },
    'PowerSploit': {
        'reason': 'Windows PowerShell post-exploitation',
        'install_command': 'apt install powersploit',
        'install_type': 'apt',
        'note': 'PowerShell-based Windows exploitation scripts'
    },
    'Mimikatz': {
        'reason': 'Windows credential extraction tool',
        'install_command': 'apt install mimikatz',
        'install_type': 'apt',
        'note': 'Windows memory credential extraction, requires Windows target'
    },
    'Empire': {
        'reason': 'Post-exploitation framework',
        'install_command': 'apt install powershell-empire',
        'install_type': 'apt',
        'note': 'PowerShell and Python post-exploitation framework'
    },
    'Volatility': {
        'reason': 'Memory forensics framework',
        'install_command': 'apt install volatility3',
        'install_type': 'apt',
        'note': 'RAM dump analysis tool for forensics'
    },
    'Dradis': {
        'reason': 'Collaboration and reporting platform',
        'install_command': 'apt install dradis',
        'install_type': 'apt',
        'note': 'Penetration testing reporting framework'
    },
    'Faraday': {
        'reason': 'Collaborative penetration test platform',
        'install_command': 'apt install faraday',
        'install_type': 'apt',
        'note': 'Integrated multiuser pentest environment'
    }
}


@app.route('/api/tools/<int:tool_id>/details', methods=['GET'])
def get_tool_details(tool_id):
    """Get detailed tool information including presets"""
    try:
        tool = Tool.query.get_or_404(tool_id)
        tool_data = tool.to_dict()
        
        # Add preset data if available
        if tool.name in TOOL_PRESETS:
            preset_data = TOOL_PRESETS[tool.name]
            tool_data['description_full'] = preset_data.get('description_full', tool.description)
            tool_data['presets'] = preset_data.get('presets', [])
            tool_data['parameters'] = preset_data.get('parameters', [])
            tool_data['examples'] = preset_data.get('examples', [])
        else:
            # Default preset
            tool_data['presets'] = [{
                'name': 'Basic Run',
                'description': f'Run {tool.name} with default options',
                'command': tool.command or f'{tool.name.lower()} {{target}}',
                'time': 'Varies',
                'difficulty': tool.difficulty or 'beginner'
            }]
            tool_data['parameters'] = [
                {'name': 'target', 'description': 'Target IP, hostname, or URL', 'required': True, 'example': '10.0.0.115'}
            ]
            tool_data['examples'] = []
        
        # Add installation info for non-installed tools
        if not tool.installed and tool.name in TOOL_INSTALLATION_INFO:
            tool_data['installation_info'] = TOOL_INSTALLATION_INFO[tool.name]
        elif not tool.installed:
            tool_data['installation_info'] = {
                'reason': 'Not installed by default in Kali Linux',
                'install_command': f'apt install {tool.name.lower().replace(" ", "-")}',
                'install_type': 'apt',
                'note': 'Click Install button to automatically install'
            }
        
        return jsonify(tool_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 404


@app.route('/api/tools/categories', methods=['GET'])
def get_categories():
    try:
        categories = db.session.query(Tool.category).distinct().all()
        return jsonify([c[0] for c in categories])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tools/status', methods=['GET'])
def get_tools_status():
    """Get installation status of all tools"""
    import subprocess
    import os
    
    try:
        tools = Tool.query.all()
        installed = []
        not_installed = []
        
        for tool in tools:
            cmd = tool.command.split()[0] if tool.command else tool.name.lower().replace(' ', '-')
            if '{' in cmd or '$' in cmd:
                cmd = tool.name.lower().replace(' ', '-')
            
            # Check if tool exists
            result = subprocess.run(['which', cmd], capture_output=True, text=True)
            if result.returncode == 0:
                installed.append({'id': tool.id, 'name': tool.name, 'category': tool.category})
                tool.installed = True
            else:
                not_installed.append({'id': tool.id, 'name': tool.name, 'category': tool.category, 'command': cmd})
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
            'missing_tools': not_installed
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tools/search', methods=['POST'])
def search_tools():
    """AI-powered natural language tool search"""
    try:
        data = request.get_json()
        query = data.get('query', '').lower()
        
        if not query:
            return jsonify({'error': 'Query required'}), 400
        
        # Search in name, description, ai_prompt, and tags
        tools = Tool.query.filter(
            db.or_(
                Tool.name.ilike(f'%{query}%'),
                Tool.description.ilike(f'%{query}%'),
                Tool.ai_prompt.ilike(f'%{query}%'),
                Tool.category.ilike(f'%{query}%')
            )
        ).all()
        
        # Score and sort by relevance
        results = []
        for tool in tools:
            score = 0
            if query in tool.name.lower():
                score += 10
            if query in tool.description.lower():
                score += 5
            if tool.ai_prompt and query in tool.ai_prompt.lower():
                score += 8
            if any(query in tag.lower() for tag in (tool.tags or [])):
                score += 7
            
            results.append({'tool': tool.to_dict(), 'score': score})
        
        results.sort(key=lambda x: x['score'], reverse=True)
        
        return jsonify({
            'query': query,
            'count': len(results),
            'results': [r['tool'] for r in results[:20]]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tools/recommend', methods=['POST'])
def recommend_tools():
    """AI-powered tool recommendations based on task"""
    try:
        data = request.get_json()
        task = data.get('task', '').lower()
        
        recommendations = []
        
        # Task-based recommendations
        task_mappings = {
            'scan': ['Nmap', 'Masscan', 'Nikto'],
            'web': ['Burp Suite', 'OWASP ZAP', 'SQLMap', 'Nikto'],
            'password': ['John the Ripper', 'Hashcat', 'Hydra'],
            'wireless': ['Aircrack-ng', 'Wifite', 'Reaver'],
            'exploit': ['Metasploit Framework', 'Searchsploit', 'BeEF'],
            'network': ['Wireshark', 'tcpdump', 'Nmap', 'Bettercap'],
            'phishing': ['SET', 'King Phisher'],
            'forensics': ['Autopsy', 'Volatility', 'Binwalk']
        }
        
        for keyword, tool_names in task_mappings.items():
            if keyword in task:
                tools = Tool.query.filter(Tool.name.in_(tool_names)).all()
                recommendations.extend([t.to_dict() for t in tools])
        
        # If no specific match, search by AI prompt
        if not recommendations:
            tools = Tool.query.filter(Tool.ai_prompt.ilike(f'%{task}%')).limit(5).all()
            recommendations = [t.to_dict() for t in tools]
        
        return jsonify({
            'task': task,
            'recommendations': recommendations[:10]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tools/popular', methods=['GET'])
def get_popular_tools():
    """Get most used tools"""
    try:
        tools = Tool.query.order_by(Tool.usage_count.desc()).limit(10).all()
        return jsonify([t.to_dict() for t in tools])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tools/<int:tool_id>/use', methods=['POST'])
def mark_tool_used(tool_id):
    """Mark tool as used - increment usage counter"""
    try:
        tool = Tool.query.get_or_404(tool_id)
        tool.usage_count = (tool.usage_count or 0) + 1
        tool.last_used = datetime.utcnow()
        db.session.commit()
        return jsonify({'message': 'Usage recorded', 'tool': tool.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/translate', methods=['POST'])
def translate_command():
    """Translate natural language to tool command"""
    try:
        data = request.get_json()
        text = data.get('text', '').lower()
        
        # Simple command translation
        translations = {
            'scan': 'nmap -sV -sC',
            'port scan': 'nmap -p-',
            'web scan': 'nikto -h',
            'sql injection': 'sqlmap -u',
            'crack password': 'john --wordlist=',
            'wifi crack': 'aircrack-ng',
            'network sniff': 'wireshark',
            'mitm': 'bettercap',
        }
        
        result = None
        for key, cmd in translations.items():
            if key in text:
                result = cmd
                break
        
        if not result:
            result = 'nmap'  # Default
        
        return jsonify({
            'input': text,
            'command': result,
            'explanation': f'Suggested command for: {text}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/stats', methods=['GET'])
def dashboard_stats():
    """Get dashboard statistics"""
    try:
        stats = {
            'total_tools': Tool.query.count(),
            'installed_tools': Tool.query.filter_by(installed=True).count(),
            'total_users': User.query.count(),
            'total_scans': Scan.query.count(),
            'recent_scans': Scan.query.order_by(Scan.created_at.desc()).limit(5).count(),
            'categories': db.session.query(Tool.category).distinct().count(),
            'popular_tools': [
                {'name': t.name, 'usage': t.usage_count or 0}
                for t in Tool.query.order_by(Tool.usage_count.desc()).limit(5).all()
            ]
        }
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scans', methods=['GET', 'OPTIONS'])
@cross_origin(origins=app.config.get('CORS_ORIGINS'))
@rate_limit_admin(limit=30, window_sec=60)
def get_scans():
    """Get all scans (no auth for testing)"""
    try:
        if not _admin_ip_allowed():
            _audit_log('scans_list', None, status='denied', reason='ip_not_allowed')
            return jsonify({'error': 'Admin IP not allowed'}), 403

        header_token = request.headers.get('X-Admin-Token')
        query_token = request.args.get('admin_key')
        admin_token_ok = _admin_token_valid(header_token) or _admin_token_valid(query_token)
        current_user = get_current_user()
        if not (admin_token_ok or current_user):
            _audit_log('scans_list', None, status='denied', reason='unauthorized')
            return jsonify({'error': 'Unauthorized'}), 403

        limit = request.args.get('limit', 50, type=int)
        if limit < 1:
            limit = 1
        if limit > 200:
            limit = 200
        status = request.args.get('status')
        
        query = Scan.query.order_by(Scan.created_at.desc())
        if current_user and current_user.role != 'admin' and not admin_token_ok:
            query = query.filter_by(user_id=current_user.id)
        if status:
            query = query.filter_by(status=status)
        
        scans = query.limit(limit).all()
        _audit_log('scans_list', None, status='ok', total=len(scans))
        return jsonify({'scans': [s.to_dict() for s in scans], 'total': len(scans)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scans', methods=['POST', 'OPTIONS'])
@cross_origin(origins=app.config.get('CORS_ORIGINS'))
@token_required
def create_scan(current_user):
    try:
        json_error = _require_json()
        if json_error:
            return json_error
        data = request.get_json() or {}
        if not data or not data.get('tool_id') or not data.get('target'):
            return jsonify({'error': 'tool_id and target required'}), 400
        
        scan = Scan(
            name=data.get('name', f"Scan {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"),
            tool_id=data['tool_id'],
            user_id=current_user.id,
            target=data['target'],
            status='pending',
            project_id=data.get('project_id'),
            target_id=data.get('target_id')
        )
        db.session.add(scan)
        db.session.commit()
        _audit_log('scan_create', current_user, status='ok', scan_id=scan.id, tool_id=scan.tool_id)
        return jsonify({'message': 'Scan created', 'scan': scan.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        _audit_log('scan_create', current_user, status='error', error=str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/scans/quick', methods=['POST'])
@rate_limit_admin(limit=10, window_sec=60)
@token_required
def quick_scan_api(current_user):
    """Quick scan (admin only)"""
    try:
        if not _admin_ip_allowed():
            _audit_log('quick_scan', None, status='denied', reason='ip_not_allowed')
            return jsonify({'error': 'Admin IP not allowed'}), 403

        json_error = _require_json()
        if json_error:
            return json_error

        data = request.get_json() or {}
        admin_key = data.get('admin_key')
        header_token = request.headers.get('X-Admin-Token')
        if not (_admin_token_valid(header_token) or _admin_token_valid(admin_key)):
            _audit_log('quick_scan', None, status='denied', reason='invalid_admin_token')
            return jsonify({'error': 'Unauthorized'}), 403

        from executor import executor
        if not data or not data.get('tool_name') or not data.get('target'):
            return jsonify({'error': 'tool_name and target required'}), 400
        
        # Find tool
        tool = Tool.query.filter_by(name=data['tool_name']).first()
        if not tool:
            return jsonify({'error': 'Tool not found'}), 404
        
        # Get admin user (for testing)
        if current_user.role != 'admin':
            _audit_log('quick_scan', current_user, status='denied', reason='admin_required')
            return jsonify({'error': 'Admin required'}), 403

        admin = User.query.filter_by(username='admin').first() or current_user
        
        # Create scan
        scan = Scan(
            name=f"Quick {tool.name} scan",
            tool_id=tool.id,
            user_id=admin.id,
            target=data['target'],
            status='pending'
        )
        db.session.add(scan)
        db.session.commit()
        
        # Execute immediately
        result = executor.execute_tool(scan.id, tool.command, scan.target, admin.id)
        
        _audit_log('quick_scan', current_user, status='ok', tool=tool.name, target=data.get('target'))
        return jsonify({
            'message': 'Scan started',
            'scan': scan.to_dict(),
            'result': result
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/scans/<int:scan_id>', methods=['GET'])
@token_required
def get_scan(current_user, scan_id):
    try:
        scan = Scan.query.get_or_404(scan_id)
        if scan.user_id != current_user.id and current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        return jsonify(scan.to_dict())
    except:
        return jsonify({'error': 'Not found'}), 404

@app.route('/api/scans/<int:scan_id>/execute', methods=['POST'])
@token_required
def execute_scan(current_user, scan_id):
    """Execute a scan"""
    try:
        from executor import executor
        
        scan = Scan.query.get_or_404(scan_id)
        if scan.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        if scan.status == 'running':
            return jsonify({'error': 'Scan already running'}), 400
        
        # Get tool command
        tool = Tool.query.get(scan.tool_id)
        if not tool:
            return jsonify({'error': 'Tool not found'}), 404
        
        # Execute
        result = executor.execute_tool(scan_id, tool.command, scan.target, current_user.id)
        _audit_log('scan_execute', current_user, status='ok', scan_id=scan_id, tool_id=tool.id)
        return jsonify({'message': 'Scan started', 'result': result})
    except Exception as e:
        _audit_log('scan_execute', current_user, status='error', scan_id=scan_id, error=str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/scans/<int:scan_id>/cancel', methods=['POST'])
@token_required
def cancel_scan(current_user, scan_id):
    """Cancel a running scan"""
    try:
        from executor import executor
        
        scan = Scan.query.get_or_404(scan_id)
        if scan.user_id != current_user.id and current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        if executor.cancel_scan(scan_id):
            _audit_log('scan_cancel', current_user, status='ok', scan_id=scan_id)
            return jsonify({'message': 'Scan cancelled'})
        _audit_log('scan_cancel', current_user, status='error', scan_id=scan_id, reason='not_running')
        return jsonify({'error': 'Scan not running or cannot be cancelled'}), 400
    except Exception as e:
        _audit_log('scan_cancel', current_user, status='error', scan_id=scan_id, error=str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/scans/running', methods=['GET'])
@token_required
def get_running_scans(current_user):
    """Get list of running scans"""
    try:
        from executor import executor
        running_ids = executor.get_running_scans()
        scans = Scan.query.filter(Scan.id.in_(running_ids)).all()
        return jsonify({'scans': [s.to_dict() for s in scans]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['GET'])
@token_required
@admin_ip_required
@rate_limit_admin(limit=30, window_sec=60)
def get_users(current_user):
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin required'}), 403
    try:
        _audit_log('admin_list_users', current_user, status='ok')
        return jsonify([u.to_dict() for u in User.query.all()])
    except Exception as e:
        _audit_log('admin_list_users', current_user, status='error', error=str(e))
        return jsonify({'error': str(e)}), 500

# ==================== PROJECT MANAGEMENT ====================

@app.route('/api/projects', methods=['GET', 'OPTIONS'])
@cross_origin(origins=app.config.get('CORS_ORIGINS'))
@admin_ip_required
@token_required
def get_projects_public(current_user):
    """Get all projects for current user"""
    try:
        from models import Project
        projects = Project.query.filter_by(user_id=current_user.id).order_by(Project.updated_at.desc()).all()
        return jsonify({'projects': [p.to_dict() for p in projects]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects', methods=['POST', 'OPTIONS'])
@cross_origin(origins=app.config.get('CORS_ORIGINS'))
@admin_ip_required
@token_required
def create_project_public(current_user):
    """Create new project"""
    try:
        from models import Project, Target
        json_error = _require_json()
        if json_error:
            return json_error
        data = request.get_json() or {}
        if not data or not data.get('name'):
            return jsonify({'error': 'Project name required'}), 400
        
        project = Project(
            name=data['name'],
            description=data.get('description', ''),
            user_id=current_user.id
        )
        db.session.add(project)
        db.session.flush()

        targets = data.get('targets')
        if isinstance(targets, list):
            for raw_value in targets:
                if not isinstance(raw_value, str):
                    continue
                value = raw_value.strip()
                if not value:
                    continue
                target_type = 'domain'
                if value.startswith('http://') or value.startswith('https://'):
                    target_type = 'url'
                elif '/' in value:
                    target_type = 'network'
                else:
                    try:
                        ipaddress.ip_address(value)
                        target_type = 'ip'
                    except Exception:
                        target_type = 'domain'
                db.session.add(Target(
                    project_id=project.id,
                    type=target_type,
                    value=value,
                    status='active'
                ))

        db.session.commit()
        
        return jsonify({'message': 'Project created', 'project': project.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects/<int:project_id>', methods=['GET'])
@admin_ip_required
@token_required
def get_project(current_user, project_id):
    """Get project details"""
    try:
        from models import Project
        project = Project.query.get_or_404(project_id)
        if project.user_id != current_user.id and current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        return jsonify(project.to_dict())
    except:
        return jsonify({'error': 'Not found'}), 404

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
@admin_ip_required
@token_required
def update_project(current_user, project_id):
    """Update project"""
    try:
        from models import Project
        project = Project.query.get_or_404(project_id)
        if project.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        if data.get('name'):
            project.name = data['name']
        if 'description' in data:
            project.description = data['description']
        if data.get('status'):
            project.status = data['status']
        
        project.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Project updated', 'project': project.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
@admin_ip_required
@token_required
def delete_project(current_user, project_id):
    """Delete project"""
    try:
        from models import Project
        project = Project.query.get_or_404(project_id)
        if project.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        db.session.delete(project)
        db.session.commit()
        
        return jsonify({'message': 'Project deleted'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects/<int:project_id>/scans', methods=['GET'])
@admin_ip_required
@token_required
def get_project_scans(current_user, project_id):
    """Get scans for a project"""
    try:
        project = Project.query.get_or_404(project_id)
        if project.user_id != current_user.id and current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        limit = request.args.get('limit', 10, type=int)
        limit = max(1, min(limit, 100))
        scans = Scan.query.filter_by(project_id=project_id).order_by(Scan.created_at.desc()).limit(limit).all()
        return jsonify({'scans': [s.to_dict() for s in scans], 'total': len(scans)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects/<int:project_id>/reports', methods=['GET'])
@admin_ip_required
@token_required
def get_project_reports(current_user, project_id):
    """Get reports for a project"""
    try:
        project = Project.query.get_or_404(project_id)
        if project.user_id != current_user.id and current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        limit = request.args.get('limit', 10, type=int)
        limit = max(1, min(limit, 100))
        reports = Report.query.filter_by(project_id=project_id).order_by(Report.created_at.desc()).limit(limit).all()
        return jsonify({'reports': [r.to_dict() for r in reports], 'total': len(reports)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== TARGET MANAGEMENT ====================

@app.route('/api/projects/<int:project_id>/targets', methods=['GET'])
@admin_ip_required
@token_required
def get_targets(current_user, project_id):
    """Get all targets for a project"""
    try:
        from models import Project, Target
        project = Project.query.get_or_404(project_id)
        if project.user_id != current_user.id and current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        targets = Target.query.filter_by(project_id=project_id).all()
        return jsonify({'targets': [t.to_dict() for t in targets]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects/<int:project_id>/targets', methods=['POST'])
@admin_ip_required
@token_required
def create_target(current_user, project_id):
    """Add target to project"""
    try:
        from models import Project, Target
        project = Project.query.get_or_404(project_id)
        if project.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        if not data or not data.get('type') or not data.get('value'):
            return jsonify({'error': 'type and value required'}), 400
        
        target = Target(
            project_id=project_id,
            type=data['type'],
            value=data['value'],
            name=data.get('name', ''),
            description=data.get('description', ''),
            info=data.get('info', {})
        )
        db.session.add(target)
        db.session.commit()
        
        return jsonify({'message': 'Target added', 'target': target.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/targets/<int:target_id>', methods=['GET'])
@token_required
def get_target(current_user, target_id):
    """Get target details"""
    try:
        from models import Target, Vulnerability
        target = Target.query.get_or_404(target_id)
        if target.project.user_id != current_user.id and current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        result = target.to_dict()
        result['vulnerabilities'] = [v.to_dict() for v in target.vulnerabilities]
        result['scans'] = [s.to_dict() for s in target.scans]
        
        return jsonify(result)
    except:
        return jsonify({'error': 'Not found'}), 404

@app.route('/api/targets/<int:target_id>', methods=['DELETE'])
@token_required
def delete_target(current_user, target_id):
    """Delete target"""
    try:
        from models import Target
        target = Target.query.get_or_404(target_id)
        if target.project.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        db.session.delete(target)
        db.session.commit()
        
        return jsonify({'message': 'Target deleted'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ==================== VULNERABILITY MANAGEMENT ====================

@app.route('/api/projects/<int:project_id>/vulnerabilities', methods=['GET'])
@token_required
def get_vulnerabilities(current_user, project_id):
    """Get all vulnerabilities for a project"""
    try:
        from models import Project, Vulnerability, Target
        project = Project.query.get_or_404(project_id)
        if project.user_id != current_user.id and current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        vulns = db.session.query(Vulnerability).join(Target).filter(Target.project_id == project_id).all()
        return jsonify({'vulnerabilities': [v.to_dict() for v in vulns]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500

# ==================== DIRECT EXECUTION API ====================

@app.route('/api/execute', methods=['POST'])
def execute_command():
    """Execute a tool command directly (for testing/demo)"""
    try:
        import subprocess
        import re
        
        data = request.get_json()
        if not data or not data.get('command'):
            return jsonify({'error': 'Command required'}), 400
        
        command = data['command']
        target = data.get('target', '')
        timeout = data.get('timeout', 60)
        
        # Build command with target
        if target:
            # Replace placeholders
            placeholders = ['{target}', '{TARGET}', '{ip}', '{IP}', '{host}', '{HOST}']
            for ph in placeholders:
                command = command.replace(ph, target)
            # If no placeholder, append target
            if target not in command:
                command = f"{command} {target}"
        
        # Security: Block dangerous commands
        dangerous = ['rm -rf', 'dd if=', 'mkfs', ':(){ :|:', 'fork bomb', '> /dev/sd', 'chmod -R 777 /']
        for d in dangerous:
            if d in command.lower():
                return jsonify({'error': 'Dangerous command blocked'}), 403
        
        try:
            # Execute with timeout
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            # Clean ANSI codes
            ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
            stdout = ansi_escape.sub('', result.stdout)
            stderr = ansi_escape.sub('', result.stderr)
            
            return jsonify({
                'success': result.returncode == 0,
                'output': stdout or stderr or 'Command completed',
                'error': stderr if result.returncode != 0 else None,
                'return_code': result.returncode,
                'command': command
            })
            
        except subprocess.TimeoutExpired:
            return jsonify({
                'success': False,
                'output': f'Command timed out after {timeout} seconds',
                'error': 'Timeout',
                'command': command
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/tools/templates', methods=['GET'])
def get_tool_templates():
    """Get user-friendly tool templates"""
    templates = {
        'nmap': {
            'name': 'Nmap',
            'category': 'Information Gathering',
            'icon': '🔍',
            'description': 'Network scanner - Discover hosts and services',
            'modes': [
                {'id': 'quick', 'name': 'Quick Scan', 'cmd': 'nmap -T4 -F', 'desc': 'Fast scan of top 100 ports'},
                {'id': 'full', 'name': 'Full Port Scan', 'cmd': 'nmap -p-', 'desc': 'Scan all 65535 ports'},
                {'id': 'service', 'name': 'Service Detection', 'cmd': 'nmap -sV -sC', 'desc': 'Detect versions and run scripts'},
                {'id': 'vuln', 'name': 'Vulnerability Scan', 'cmd': 'nmap --script=vuln', 'desc': 'Check for known vulnerabilities'},
                {'id': 'os', 'name': 'OS Detection', 'cmd': 'nmap -O', 'desc': 'Detect operating system'},
                {'id': 'stealth', 'name': 'Stealth Scan', 'cmd': 'nmap -sS', 'desc': 'SYN stealth scan'},
                {'id': 'udp', 'name': 'UDP Scan', 'cmd': 'nmap -sU --top-ports 100', 'desc': 'Scan UDP ports'},
                {'id': 'aggressive', 'name': 'Aggressive Scan', 'cmd': 'nmap -A -T4', 'desc': 'OS, version, script, traceroute'},
            ],
            'inputs': [{'name': 'target', 'label': 'Target IP/Host', 'placeholder': '192.168.1.1 or domain.com', 'required': True}]
        },
        'nikto': {
            'name': 'Nikto',
            'category': 'Web Application Analysis',
            'icon': '🌐',
            'description': 'Web server vulnerability scanner',
            'modes': [
                {'id': 'basic', 'name': 'Basic Scan', 'cmd': 'nikto -h', 'desc': 'Standard web scan'},
                {'id': 'ssl', 'name': 'SSL Scan', 'cmd': 'nikto -h -ssl', 'desc': 'Force SSL/HTTPS'},
                {'id': 'full', 'name': 'Full Scan', 'cmd': 'nikto -h -Tuning x', 'desc': 'All checks enabled'},
            ],
            'inputs': [{'name': 'target', 'label': 'Target URL', 'placeholder': 'http://192.168.1.1', 'required': True}]
        },
        'sqlmap': {
            'name': 'SQLMap',
            'category': 'Web Application Analysis',
            'icon': '💉',
            'description': 'SQL injection detection and exploitation',
            'modes': [
                {'id': 'test', 'name': 'Test for SQLi', 'cmd': 'sqlmap -u --batch', 'desc': 'Test URL for SQL injection'},
                {'id': 'dbs', 'name': 'List Databases', 'cmd': 'sqlmap -u --dbs --batch', 'desc': 'Enumerate databases'},
                {'id': 'tables', 'name': 'List Tables', 'cmd': 'sqlmap -u --tables --batch', 'desc': 'Enumerate tables'},
            ],
            'inputs': [{'name': 'target', 'label': 'Target URL with param', 'placeholder': 'http://site.com/page?id=1', 'required': True}]
        },
        'hydra': {
            'name': 'Hydra',
            'category': 'Password Attacks',
            'icon': '🔐',
            'description': 'Network login cracker',
            'modes': [
                {'id': 'ssh', 'name': 'SSH Brute', 'cmd': 'hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh', 'desc': 'Brute force SSH'},
                {'id': 'ftp', 'name': 'FTP Brute', 'cmd': 'hydra -l admin -P /usr/share/wordlists/rockyou.txt ftp', 'desc': 'Brute force FTP'},
                {'id': 'http', 'name': 'HTTP Brute', 'cmd': 'hydra -l admin -P /usr/share/wordlists/rockyou.txt http-get /', 'desc': 'Brute force HTTP Basic'},
            ],
            'inputs': [{'name': 'target', 'label': 'Target IP', 'placeholder': '192.168.1.1', 'required': True}]
        },
        'gobuster': {
            'name': 'Gobuster',
            'category': 'Web Application Analysis',
            'icon': '📂',
            'description': 'Directory and file brute-forcer',
            'modes': [
                {'id': 'dir', 'name': 'Directory Scan', 'cmd': 'gobuster dir -u -w /usr/share/wordlists/dirb/common.txt', 'desc': 'Find hidden directories'},
                {'id': 'dns', 'name': 'DNS Subdomain', 'cmd': 'gobuster dns -d -w /usr/share/wordlists/subdomains.txt', 'desc': 'Find subdomains'},
            ],
            'inputs': [{'name': 'target', 'label': 'Target URL/Domain', 'placeholder': 'http://target.com', 'required': True}]
        },
        'whois': {
            'name': 'Whois',
            'category': 'Information Gathering',
            'icon': '📋',
            'description': 'Domain registration lookup',
            'modes': [
                {'id': 'lookup', 'name': 'Whois Lookup', 'cmd': 'whois', 'desc': 'Get domain registration info'},
            ],
            'inputs': [{'name': 'target', 'label': 'Domain/IP', 'placeholder': 'google.com', 'required': True}]
        },
        'dig': {
            'name': 'Dig',
            'category': 'Information Gathering',
            'icon': '🔎',
            'description': 'DNS query tool',
            'modes': [
                {'id': 'any', 'name': 'All Records', 'cmd': 'dig ANY', 'desc': 'Get all DNS records'},
                {'id': 'mx', 'name': 'Mail Servers', 'cmd': 'dig MX', 'desc': 'Get mail server records'},
                {'id': 'ns', 'name': 'Name Servers', 'cmd': 'dig NS', 'desc': 'Get name server records'},
            ],
            'inputs': [{'name': 'target', 'label': 'Domain', 'placeholder': 'example.com', 'required': True}]
        },
        'ping': {
            'name': 'Ping',
            'category': 'Information Gathering',
            'icon': '📡',
            'description': 'Network connectivity test',
            'modes': [
                {'id': 'basic', 'name': 'Basic Ping', 'cmd': 'ping -c 4', 'desc': 'Send 4 ping packets'},
                {'id': 'flood', 'name': 'Flood Ping', 'cmd': 'ping -c 10 -i 0.2', 'desc': 'Rapid ping test'},
            ],
            'inputs': [{'name': 'target', 'label': 'Target IP/Host', 'placeholder': '192.168.1.1', 'required': True}]
        },
        'traceroute': {
            'name': 'Traceroute',
            'category': 'Information Gathering',
            'icon': '🗺️',
            'description': 'Network path tracer',
            'modes': [
                {'id': 'basic', 'name': 'Trace Route', 'cmd': 'traceroute', 'desc': 'Trace network path'},
            ],
            'inputs': [{'name': 'target', 'label': 'Target', 'placeholder': '192.168.1.1', 'required': True}]
        },
        'netcat': {
            'name': 'Netcat',
            'category': 'Sniffing & Spoofing',
            'icon': '🐱',
            'description': 'Network utility - TCP/UDP connections',
            'modes': [
                {'id': 'scan', 'name': 'Port Scan', 'cmd': 'nc -zv -w 2', 'desc': 'Quick port check'},
                {'id': 'banner', 'name': 'Banner Grab', 'cmd': 'nc -v -w 2', 'desc': 'Grab service banner'},
            ],
            'inputs': [
                {'name': 'target', 'label': 'Target IP', 'placeholder': '192.168.1.1', 'required': True},
                {'name': 'port', 'label': 'Port', 'placeholder': '80', 'required': False}
            ]
        },
        'curl': {
            'name': 'cURL',
            'category': 'Web Application Analysis',
            'icon': '🌍',
            'description': 'HTTP/HTTPS request tool',
            'modes': [
                {'id': 'get', 'name': 'GET Request', 'cmd': 'curl -I', 'desc': 'Get HTTP headers'},
                {'id': 'full', 'name': 'Full Response', 'cmd': 'curl -v', 'desc': 'Verbose output'},
                {'id': 'follow', 'name': 'Follow Redirects', 'cmd': 'curl -L -I', 'desc': 'Follow redirects'},
            ],
            'inputs': [{'name': 'target', 'label': 'URL', 'placeholder': 'http://target.com', 'required': True}]
        },
        'wpscan': {
            'name': 'WPScan',
            'category': 'Web Application Analysis',
            'icon': '📝',
            'description': 'WordPress vulnerability scanner',
            'modes': [
                {'id': 'enum', 'name': 'Enumerate', 'cmd': 'wpscan --url -e vp,vt,u', 'desc': 'Enumerate plugins, themes, users'},
                {'id': 'plugins', 'name': 'Plugin Scan', 'cmd': 'wpscan --url -e vp', 'desc': 'Find vulnerable plugins'},
            ],
            'inputs': [{'name': 'target', 'label': 'WordPress URL', 'placeholder': 'http://wordpress-site.com', 'required': True}]
        },
        'enum4linux': {
            'name': 'Enum4Linux',
            'category': 'Information Gathering',
            'icon': '🐧',
            'description': 'Windows/Samba enumeration',
            'modes': [
                {'id': 'all', 'name': 'Full Enum', 'cmd': 'enum4linux -a', 'desc': 'All enumeration'},
                {'id': 'users', 'name': 'Users Only', 'cmd': 'enum4linux -U', 'desc': 'Enumerate users'},
            ],
            'inputs': [{'name': 'target', 'label': 'Target IP', 'placeholder': '192.168.1.1', 'required': True}]
        },
        'smbclient': {
            'name': 'SMBClient',
            'category': 'Information Gathering',
            'icon': '📁',
            'description': 'SMB/CIFS file sharing client',
            'modes': [
                {'id': 'list', 'name': 'List Shares', 'cmd': 'smbclient -L -N', 'desc': 'List available shares'},
            ],
            'inputs': [{'name': 'target', 'label': 'Target IP', 'placeholder': '192.168.1.1', 'required': True}]
        },
        'searchsploit': {
            'name': 'SearchSploit',
            'category': 'Exploitation Tools',
            'icon': '💣',
            'description': 'Exploit database search',
            'modes': [
                {'id': 'search', 'name': 'Search', 'cmd': 'searchsploit', 'desc': 'Search for exploits'},
            ],
            'inputs': [{'name': 'target', 'label': 'Search Term', 'placeholder': 'apache 2.4', 'required': True}]
        },
    }
    return jsonify(templates)


@app.route('/api/updates/check', methods=['GET'])
def check_updates():
    """Check for tool updates"""
    try:
        import subprocess
        
        # Check apt updates
        result = subprocess.run(
            ['apt', 'list', '--upgradable'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        updates = []
        for line in result.stdout.split('\n')[1:]:
            if line.strip():
                parts = line.split('/')
                if parts:
                    pkg_name = parts[0]
                    # Check if it's a security tool
                    security_tools = ['nmap', 'metasploit', 'nikto', 'sqlmap', 'hydra', 'aircrack', 'john', 'hashcat', 'wireshark', 'burp']
                    for tool in security_tools:
                        if tool in pkg_name.lower():
                            updates.append({
                                'package': pkg_name,
                                'line': line.strip()
                            })
        
        return jsonify({
            'updates_available': len(updates),
            'updates': updates,
            'last_check': datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/updates/refresh', methods=['POST'])
def refresh_updates():
    """Refresh and check for updates - triggers apt update"""
    try:
        import subprocess
        
        # Run apt update first
        subprocess.run(
            ['sudo', 'apt', 'update'],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        # Check apt updates
        result = subprocess.run(
            ['apt', 'list', '--upgradable'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        updates = []
        tools_with_updates = []
        security_tools = ['nmap', 'metasploit', 'nikto', 'sqlmap', 'hydra', 'aircrack', 'john', 'hashcat', 'wireshark', 'burp', 'gobuster', 'dirb', 'wfuzz', 'nuclei']
        
        for line in result.stdout.split('\n')[1:]:
            if line.strip():
                parts = line.split('/')
                if parts:
                    pkg_name = parts[0]
                    for tool in security_tools:
                        if tool in pkg_name.lower():
                            # Parse version info
                            version_info = line.split(' ')
                            tools_with_updates.append({
                                'id': len(tools_with_updates) + 1,
                                'name': pkg_name,
                                'current_version': 'installed',
                                'new_version': version_info[1] if len(version_info) > 1 else 'latest',
                                'category': 'Security'
                            })
                            updates.append({
                                'package': pkg_name,
                                'line': line.strip()
                            })
        
        return jsonify({
            'success': True,
            'available_updates': len(updates),
            'last_check': datetime.utcnow().isoformat(),
            'system_version': 'Kali Linux 2024.x',
            'tools': tools_with_updates,
            'updates': updates
        })
    except subprocess.TimeoutExpired:
        return jsonify({
            'available_updates': 0,
            'last_check': datetime.utcnow().isoformat(),
            'system_version': 'Kali Linux 2024.x',
            'tools': [],
            'message': 'Update check timed out'
        })
    except Exception as e:
        return jsonify({
            'available_updates': 0,
            'last_check': datetime.utcnow().isoformat(),
            'system_version': 'Kali Linux 2024.x',
            'tools': [],
            'error': str(e)
        })


@app.route('/api/updates/all', methods=['POST'])
def update_all_tools():
    """Update all tools"""
    try:
        import subprocess
        
        # Run apt upgrade
        result = subprocess.run(
            ['sudo', 'apt', 'upgrade', '-y'],
            capture_output=True,
            text=True,
            timeout=600
        )
        
        return jsonify({
            'success': True,
            'message': 'All tools updated successfully',
            'output': result.stdout
        })
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Update timed out'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/updates/apply', methods=['POST'])
@token_required
def apply_updates(current_user):
    """Apply system updates (admin only)"""
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin required'}), 403
    
    try:
        import subprocess
        
        # Run apt update with sudo
        result = subprocess.run(
            ['sudo', 'apt', 'update'],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        # Run apt upgrade with sudo
        upgrade_result = subprocess.run(
            ['sudo', 'apt', 'upgrade', '-y'],
            capture_output=True,
            text=True,
            timeout=600
        )
        
        return jsonify({
            'success': True,
            'message': 'All updates applied successfully',
            'output': result.stdout + '\n' + upgrade_result.stdout
        })
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': False,
            'error': 'Update timed out - try again later'
        }), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/updates/apply/<package>', methods=['POST'])
@token_required
def apply_single_update(current_user, package):
    """Apply update for a single package (admin only)"""
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin required'}), 403
    
    try:
        import subprocess
        
        # Sanitize package name
        safe_package = ''.join(c for c in package if c.isalnum() or c in '-._')
        
        result = subprocess.run(
            ['sudo', 'apt', 'install', '--only-upgrade', '-y', safe_package],
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode == 0:
            return jsonify({
                'success': True,
                'message': f'{safe_package} updated successfully',
                'output': result.stdout
            })
        else:
            return jsonify({
                'success': False,
                'error': result.stderr or 'Update failed',
                'output': result.stdout
            }), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': False,
            'error': f'Update for {package} timed out'
        }), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/tools/install/<int:tool_id>', methods=['POST'])
@token_required
def install_tool(current_user, tool_id):
    """Install a specific tool (admin only)"""
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin required'}), 403
    
    tool = Tool.query.get(tool_id)
    if not tool:
        return jsonify({'error': 'Tool not found'}), 404
    
    try:
        import subprocess
        
        # Get package name (lowercase tool name with dashes)
        package_name = tool.name.lower().replace(' ', '-').replace('_', '-')
        
        result = subprocess.run(
            ['sudo', 'apt', 'install', '-y', package_name],
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode == 0:
            # Update tool status in database
            tool.installed = True
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'{tool.name} installed successfully',
                'output': result.stdout
            })
        else:
            return jsonify({
                'success': False,
                'error': result.stderr or 'Installation failed',
                'output': result.stdout
            }), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': False,
            'error': f'Installation of {tool.name} timed out'
        }), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/tools/install-all', methods=['POST'])
@token_required
def install_all_tools(current_user):
    """Install all uninstalled tools (admin only)"""
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin required'}), 403
    
    try:
        import subprocess
        
        # Get all uninstalled tools
        uninstalled = Tool.query.filter_by(installed=False).all()
        
        if not uninstalled:
            return jsonify({
                'success': True,
                'message': 'All tools are already installed',
                'installed': 0
            })
        
        # Build package list
        packages = []
        for tool in uninstalled:
            pkg_name = tool.name.lower().replace(' ', '-').replace('_', '-')
            packages.append(pkg_name)
        
        # Run apt update first
        subprocess.run(['sudo', 'apt', 'update'], capture_output=True, timeout=120)
        
        # Install all packages
        result = subprocess.run(
            ['sudo', 'apt', 'install', '-y'] + packages,
            capture_output=True,
            text=True,
            timeout=1800  # 30 minutes for all packages
        )
        
        # Update database for successfully installed tools
        installed_count = 0
        for tool in uninstalled:
            pkg_name = tool.name.lower().replace(' ', '-').replace('_', '-')
            # Check if package is now installed
            check = subprocess.run(['which', pkg_name], capture_output=True)
            if check.returncode == 0:
                tool.installed = True
                installed_count += 1
            else:
                # Also check dpkg
                check2 = subprocess.run(['dpkg', '-l', pkg_name], capture_output=True)
                if check2.returncode == 0:
                    tool.installed = True
                    installed_count += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Installed {installed_count} tools',
            'installed': installed_count,
            'total': len(uninstalled),
            'output': result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout
        })
            
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': False,
            'error': 'Installation timed out'
        }), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/servers', methods=['GET'])
@admin_ip_required
@token_required
@rate_limit(limit=60, window_sec=60)
def get_servers(current_user):
    """Get saved servers"""
    servers = _load_servers()
    safe_servers = []
    for server in servers:
        if isinstance(server, dict):
            sanitized = {**server}
            sanitized.pop('password', None)
            safe_servers.append(sanitized)
    return jsonify({'servers': safe_servers})


@app.route('/api/monitoring/stats', methods=['GET'])
@token_required
@admin_ip_required
@rate_limit_admin(limit=30, window_sec=60)
def get_monitoring_stats(current_user):
    """Get system monitoring statistics"""
    try:
        if current_user.role != 'admin':
            _audit_log('monitoring_stats', current_user, status='denied', reason='not_admin')
            return jsonify({'error': 'Unauthorized'}), 403
        import subprocess
        
        # CPU usage
        cpu_result = subprocess.run(['grep', '-c', '^processor', '/proc/cpuinfo'], capture_output=True, text=True)
        cpu_cores = int(cpu_result.stdout.strip()) if cpu_result.returncode == 0 else 1
        
        # Load average
        load_result = subprocess.run(['cat', '/proc/loadavg'], capture_output=True, text=True)
        load_avg = load_result.stdout.split()[:3] if load_result.returncode == 0 else ['0', '0', '0']
        
        # Memory
        mem_result = subprocess.run(['free', '-m'], capture_output=True, text=True)
        mem_lines = mem_result.stdout.split('\n')
        mem_parts = mem_lines[1].split() if len(mem_lines) > 1 else []
        
        total_mem = int(mem_parts[1]) if len(mem_parts) > 1 else 0
        used_mem = int(mem_parts[2]) if len(mem_parts) > 2 else 0
        
        # Disk
        disk_result = subprocess.run(['df', '-h', '/'], capture_output=True, text=True)
        disk_lines = disk_result.stdout.split('\n')
        disk_parts = disk_lines[1].split() if len(disk_lines) > 1 else []
        
        _audit_log('monitoring_stats', current_user, status='ok')
        return jsonify({
            'cpu': {
                'cores': cpu_cores,
                'load_1m': float(load_avg[0]),
                'load_5m': float(load_avg[1]),
                'load_15m': float(load_avg[2]),
            },
            'memory': {
                'total_mb': total_mem,
                'used_mb': used_mem,
                'percent': round((used_mem / total_mem * 100), 1) if total_mem > 0 else 0
            },
            'disk': {
                'total': disk_parts[1] if len(disk_parts) > 1 else 'N/A',
                'used': disk_parts[2] if len(disk_parts) > 2 else 'N/A',
                'available': disk_parts[3] if len(disk_parts) > 3 else 'N/A',
                'percent': disk_parts[4] if len(disk_parts) > 4 else 'N/A'
            },
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        _audit_log('monitoring_stats', current_user, status='error', reason=str(e))
        return jsonify({'error': str(e)}), 500


# ============================================================================
# REPORTS API
# ============================================================================

@app.route('/api/reports', methods=['GET'])
@token_required
def get_reports(current_user):
    """Get user's reports"""
    try:
        reports = Report.query.filter_by(created_by=current_user.id).order_by(Report.created_at.desc()).all()
        return jsonify({
            'reports': [r.to_dict() for r in reports],
            'total': len(reports)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports', methods=['POST'])
@token_required
def create_report(current_user):
    """Generate a new report"""
    try:
        data = request.get_json()
        report_type = data.get('type', 'technical')
        project_id = data.get('project_id')
        
        # Get project and its scans
        project = Project.query.get(project_id) if project_id else None
        scans = Scan.query.filter_by(user_id=current_user.id).order_by(Scan.created_at.desc()).limit(10).all()
        
        # Generate report content
        report_content = {
            'title': f'{report_type.title()} Security Report',
            'generated_at': datetime.utcnow().isoformat(),
            'generated_by': current_user.username,
            'summary': {
                'total_scans': len(scans),
                'tools_used': list(set([s.tool.name for s in scans if s.tool])),
                'targets_scanned': list(set([s.target for s in scans]))
            },
            'scans': [s.to_dict() for s in scans],
            'recommendations': [
                'Regularly update all security tools',
                'Implement network segmentation',
                'Enable multi-factor authentication',
                'Conduct periodic vulnerability assessments'
            ]
        }
        
        # Create report record
        report = Report(
            name=f'{report_type.title()} Report - {datetime.utcnow().strftime("%Y-%m-%d")}',
            type=report_type,
            content=str(report_content),
            created_by=current_user.id,
            project_id=project_id
        )
        db.session.add(report)
        db.session.commit()
        
        return jsonify({
            'message': 'Report generated successfully',
            'report': report.to_dict(),
            'content': report_content
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/<int:report_id>', methods=['GET'])
@token_required
def get_report(current_user, report_id):
    """Get a specific report"""
    try:
        report = Report.query.get_or_404(report_id)
        if report.created_by != current_user.id and current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        return jsonify(report.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@app.route('/api/reports/<int:report_id>/download', methods=['GET'])
@token_required  
def download_report(current_user, report_id):
    """Download report in specified format"""
    try:
        import io
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics.charts.piecharts import Pie
        from reportlab.graphics.charts.barcharts import VerticalBarChart
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics.charts.piecharts import Pie
        from reportlab.graphics.charts.barcharts import VerticalBarChart
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics.charts.piecharts import Pie
        from reportlab.graphics.charts.barcharts import VerticalBarChart
        from flask import send_file
        import ast
        report = Report.query.get_or_404(report_id)
        if report.created_by != current_user.id and current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        # Parse report content
        content = ast.literal_eval(report.content) if report.content else {}
        scans = content.get('scans', [])
        # Create PDF buffer
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor('#00d4aa')
        )
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=12,
            textColor=colors.HexColor('#6366f1')
        )
        elements = []
        # Title
        elements.append(Paragraph(f"🛡️ {content.get('title', 'Security Report')}", title_style))
        elements.append(Paragraph(f"Generated At: {content.get('generated_at', '')}", styles['Normal']))
        elements.append(Paragraph(f"Generated By: {content.get('generated_by', '')}", styles['Normal']))
        elements.append(Spacer(1, 30))
        # Summary
        elements.append(Paragraph("📊 Summary", heading_style))
        summary = content.get('summary', {})
        summary_data = [
            ['Total Scans', str(summary.get('total_scans', ''))],
            ['Tools Used', ', '.join(summary.get('tools_used', []))],
            ['Targets Scanned', ', '.join(summary.get('targets_scanned', []))],
        ]
        summary_table = Table(summary_data, colWidths=[200, 300])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1a1a2e')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#333355')),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 30))

        # Summary Chart
        summary_chart = Drawing(400, 200)
        pie = Pie()
        pie.x = 150
        pie.y = 15
        pie.width = 200
        pie.height = 170
        completed = len([s for s in scans if s.status == 'completed'])
        failed = len([s for s in scans if s.status == 'failed'])
        pending = len([s for s in scans if s.status not in ['completed', 'failed']])
        pie.data = [completed, failed, pending]
        pie.labels = ['Completed', 'Failed', 'Other']
        pie.slices[0].fillColor = colors.HexColor('#22c55e')
        pie.slices[1].fillColor = colors.HexColor('#ef4444')
        pie.slices[2].fillColor = colors.HexColor('#f59e0b')
        summary_chart.add(pie)
        elements.append(Paragraph("📈 Scan Status Distribution", heading_style))
        elements.append(summary_chart)
        elements.append(Spacer(1, 24))
        # Scan Details
        elements.append(Paragraph("🔍 Scan Details", heading_style))
        for scan in scans:
            elements.append(Paragraph(f"<b>{scan.get('name', 'Scan')}</b> - {scan.get('target', '')}", styles['Heading3']))
            elements.append(Paragraph(f"Tool: {scan.get('tool', 'N/A')}", styles['Normal']))
            elements.append(Paragraph(f"Status: {scan.get('status', '')}", styles['Normal']))
            elements.append(Paragraph(f"Date: {scan.get('created_at', '')}", styles['Normal']))
            if scan.get('output'):
                elements.append(Paragraph("Output:", styles['Normal']))
                output_text = scan['output'][:2000] + ('...' if len(scan['output']) > 2000 else '')
                elements.append(Paragraph(f"<pre>{output_text}</pre>", styles['Code']))
            elements.append(Spacer(1, 20))
        # Recommendations
        if content.get('recommendations'):
            elements.append(Paragraph("💡 Recommendations", heading_style))
            for rec in content['recommendations']:
                elements.append(Paragraph(f"- {rec}", styles['Normal']))
            elements.append(Spacer(1, 20))
        # Footer
        elements.append(Spacer(1, 30))
        elements.append(Paragraph("─" * 50, styles['Normal']))
        elements.append(Paragraph("This report was automatically generated by CyberSec Platform.", styles['Normal']))
        elements.append(Paragraph("© 2026 CyberSec Pro - All Rights Reserved", styles['Normal']))
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'cybersec_report_{report_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 404


# ============================================================================
# VULNERABILITY DATABASE API
# ============================================================================

@app.route('/api/vulnerabilities/all', methods=['GET'])
@token_required
def get_all_vulnerabilities(current_user):
    """Get vulnerabilities for user's projects"""
    try:
        project_ids = [p.id for p in Project.query.filter_by(user_id=current_user.id).all()]
        vulns = Vulnerability.query.filter(Vulnerability.project_id.in_(project_ids)).all()
        return jsonify({
            'vulnerabilities': [v.to_dict() for v in vulns],
            'total': len(vulns),
            'by_severity': {
                'critical': len([v for v in vulns if v.severity == 'critical']),
                'high': len([v for v in vulns if v.severity == 'high']),
                'medium': len([v for v in vulns if v.severity == 'medium']),
                'low': len([v for v in vulns if v.severity == 'low'])
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/vulnerabilities/create', methods=['POST'])
@token_required
def create_new_vulnerability(current_user):
    """Create a new vulnerability record"""
    try:
        data = request.get_json()
        
        vuln = Vulnerability(
            name=data.get('name', 'Unknown Vulnerability'),
            description=data.get('description', ''),
            severity=data.get('severity', 'medium'),
            cvss_score=data.get('cvss_score'),
            cve_id=data.get('cve_id'),
            affected_component=data.get('affected_component'),
            remediation=data.get('remediation'),
            project_id=data.get('project_id'),
            target_id=data.get('target_id'),
            status='open'
        )
        db.session.add(vuln)
        db.session.commit()
        
        return jsonify({
            'message': 'Vulnerability created',
            'vulnerability': vuln.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================================================
# COMPLIANCE API
# ============================================================================

@app.route('/api/compliance/owasp', methods=['GET'])
def get_owasp_top10():
    """Get OWASP Top 10 checklist"""
    owasp = [
        {'id': 'A01', 'name': 'Broken Access Control', 'tools': ['Burp Suite', 'OWASP ZAP'], 'severity': 'critical'},
        {'id': 'A02', 'name': 'Cryptographic Failures', 'tools': ['SSLyze', 'testssl.sh'], 'severity': 'critical'},
        {'id': 'A03', 'name': 'Injection', 'tools': ['SQLMap', 'Commix'], 'severity': 'critical'},
        {'id': 'A04', 'name': 'Insecure Design', 'tools': ['Manual Review'], 'severity': 'high'},
        {'id': 'A05', 'name': 'Security Misconfiguration', 'tools': ['Nikto', 'Lynis'], 'severity': 'high'},
        {'id': 'A06', 'name': 'Vulnerable Components', 'tools': ['OWASP Dependency-Check', 'Retire.js'], 'severity': 'high'},
        {'id': 'A07', 'name': 'Auth Failures', 'tools': ['Hydra', 'Medusa'], 'severity': 'critical'},
        {'id': 'A08', 'name': 'Software & Data Integrity', 'tools': ['Sigcheck', 'YARA'], 'severity': 'high'},
        {'id': 'A09', 'name': 'Logging & Monitoring', 'tools': ['ELK Stack', 'Splunk'], 'severity': 'medium'},
        {'id': 'A10', 'name': 'SSRF', 'tools': ['Burp Suite', 'SSRFmap'], 'severity': 'high'}
    ]
    return jsonify({'owasp_top10': owasp, 'version': '2021'})

@app.route('/api/compliance/pci', methods=['GET'])
def get_pci_requirements():
    """Get PCI DSS requirements"""
    pci = [
        {'id': '1', 'name': 'Install firewall configuration', 'category': 'Network Security'},
        {'id': '2', 'name': 'No vendor-supplied defaults', 'category': 'Secure Configuration'},
        {'id': '3', 'name': 'Protect stored cardholder data', 'category': 'Data Protection'},
        {'id': '4', 'name': 'Encrypt transmission', 'category': 'Encryption'},
        {'id': '5', 'name': 'Protect against malware', 'category': 'Malware Protection'},
        {'id': '6', 'name': 'Develop secure systems', 'category': 'Secure Development'},
        {'id': '7', 'name': 'Restrict access', 'category': 'Access Control'},
        {'id': '8', 'name': 'Identify users', 'category': 'Authentication'},
        {'id': '9', 'name': 'Restrict physical access', 'category': 'Physical Security'},
        {'id': '10', 'name': 'Track and monitor access', 'category': 'Logging'},
        {'id': '11', 'name': 'Test security systems', 'category': 'Testing'},
        {'id': '12', 'name': 'Information security policy', 'category': 'Policy'}
    ]
    return jsonify({'pci_dss': pci, 'version': '4.0'})


# =====================================================
# QUICK SCAN ENDPOINTS
# =====================================================

def quick_scan(current_user):
    """Run a quick scan"""
    data = request.get_json()
    target = data.get('target')
    scan_type = data.get('type', 'network')
    
    if not target:
        return jsonify({'error': 'Target required'}), 400
    
    import subprocess
    
    commands = {
        'network': f'nmap -sV -sC -T4 {target}',
        'web': f'nikto -h {target} -maxtime 60',
        'vuln': f'nmap --script vuln -T4 {target}',
        'dns': f'dig +short {target}',
        'whois': f'whois {target}',
        'ssl': f'openssl s_client -connect {target}:443 -brief 2>/dev/null'
    }
    
    command = commands.get(scan_type, commands['network'])
    
    try:
        result = subprocess.run(
            command.split() if scan_type in ['dns', 'whois'] else ['bash', '-c', command],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        # Save scan to database
        scan = Scan(
            user_id=current_user.id,
            target=target,
            scan_type=scan_type,
            status='completed',
            result=result.stdout[:10000] if result.stdout else result.stderr[:10000]
        )
        db.session.add(scan)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'scan_id': scan.id,
            'output': result.stdout or result.stderr,
            'target': target,
            'type': scan_type
        })
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Scan timed out'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =====================================================
# PDF REPORT GENERATION
# =====================================================

@app.route('/api/reports/generate', methods=['GET', 'POST', 'OPTIONS'])
@cross_origin(origins=app.config.get('CORS_ORIGINS'))
@token_required
def generate_pdf_report(current_user):
    """Generate a professional PDF report"""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics.charts.piecharts import Pie
        from reportlab.graphics.charts.barcharts import VerticalBarChart
        import io
        from flask import send_file
        if request.method == 'GET':
            scan_ids_param = request.args.get('scan_ids', '')
            scan_ids = [int(s) for s in scan_ids_param.split(',') if s.isdigit()]
            report_title = request.args.get('title') or request.args.get('report_name') or 'Security Scan Report'
            client_name = request.args.get('client_name') or 'General'
            scope = request.args.get('scope') or 'Network and host security review'
            prepared_for = request.args.get('prepared_for') or client_name
        else:
            data = request.get_json() or {}
            scan_ids = data.get('scan_ids', [])
            report_title = data.get('title') or data.get('report_name') or 'Security Scan Report'
            client_name = data.get('client_name', 'General')
            scope = data.get('scope', 'Network and host security review')
            prepared_for = data.get('prepared_for', client_name)
        # Kullanıcıya ait taramaları getir
        scans = Scan.query.filter(Scan.id.in_(scan_ids), Scan.user_id==current_user.id).all() if scan_ids else Scan.query.filter_by(user_id=current_user.id).order_by(Scan.created_at.desc()).limit(10).all()
        # Create PDF buffer
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor('#00d4aa')
        )
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=12,
            textColor=colors.HexColor('#6366f1')
        )
        elements = []
        # Cover Page
        elements.append(Paragraph(f"🛡️ {report_title}", title_style))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph(f"Prepared for: <b>{prepared_for}</b>", styles['Normal']))
        elements.append(Paragraph(f"Client: <b>{client_name}</b>", styles['Normal']))
        elements.append(Paragraph(f"Scope: <b>{scope}</b>", styles['Normal']))
        generated_at = datetime.now().astimezone().strftime('%Y-%m-%d %H:%M %Z')
        elements.append(Paragraph(f"Generated At: {generated_at}", styles['Normal']))
        elements.append(Spacer(1, 18))
        elements.append(Paragraph(
            "Confidential: This report contains security findings and remediation guidance."
            " Share only with authorized stakeholders.",
            styles['Normal']
        ))
        elements.append(PageBreak())
        # Title
        elements.append(Paragraph(f"🛡️ {report_title}", title_style))
        generated_at = datetime.now().astimezone().strftime('%Y-%m-%d %H:%M %Z')
        elements.append(Paragraph(f"Generated At: {generated_at}", styles['Normal']))
        elements.append(Spacer(1, 30))
        # Summary
        elements.append(Paragraph("📊 Summary", heading_style))
        summary_data = [
            ['Total Scans', str(len(scans))],
            ['Completed', str(len([s for s in scans if s.status == 'completed']))],
            ['Failed', str(len([s for s in scans if s.status == 'failed']))],
        ]
        summary_table = Table(summary_data, colWidths=[200, 100])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1a1a2e')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#333355')),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 18))

        # Summary Chart
        summary_chart = Drawing(500, 260)
        pie = Pie()
        pie.x = 120
        pie.y = 20
        pie.width = 220
        pie.height = 220
        completed = len([s for s in scans if s.status == 'completed'])
        failed = len([s for s in scans if s.status == 'failed'])
        pending = len([s for s in scans if s.status not in ['completed', 'failed']])
        pie.data = [completed or 0, failed or 0, pending or 0]
        pie.labels = [f"Completed ({completed})", f"Failed ({failed})", f"Other ({pending})"]
        pie.slices[0].fillColor = colors.HexColor('#22c55e')
        pie.slices[1].fillColor = colors.HexColor('#ef4444')
        pie.slices[2].fillColor = colors.HexColor('#f59e0b')
        pie.slices[0].strokeColor = colors.white
        pie.slices[1].strokeColor = colors.white
        pie.slices[2].strokeColor = colors.white
        summary_chart.add(pie)
        elements.append(Paragraph("📈 Scan Status Distribution", heading_style))
        elements.append(summary_chart)
        elements.append(Spacer(1, 24))

        # Plain Language Summary
        elements.append(Paragraph("🧩 Plain-Language Summary", heading_style))
        elements.append(Paragraph(
            "This report shows what we checked on your systems and what we found. "
            "If there are security issues, we explain them in simple words and provide steps to fix them. "
            "You can share this report with non-technical users.",
            styles['Normal']
        ))
        elements.append(Spacer(1, 16))

        # Executive Summary (simple)
        elements.append(Paragraph("🏁 Executive Summary", heading_style))
        elements.append(Paragraph(
            "Overall, the scans show the current security posture of the target systems. "
            "Focus on fixing high-impact issues first and confirm improvements by re-scanning.",
            styles['Normal']
        ))
        elements.append(Spacer(1, 16))
        # Scan Details
        elements.append(Paragraph("🔍 Scan Details", heading_style))
        for scan in scans:
            elements.append(Paragraph(f"<b>{scan.name or 'Scan'}</b> - {scan.target}", styles['Heading3']))
            elements.append(Paragraph(f"Tool: {scan.tool.name if scan.tool else 'N/A'}", styles['Normal']))
            elements.append(Paragraph(f"Status: {scan.status}", styles['Normal']))
            elements.append(Paragraph(f"Date: {scan.created_at.strftime('%Y-%m-%d %H:%M') if scan.created_at else 'N/A'}", styles['Normal']))
            if scan.output:
                elements.append(Paragraph("Output Summary:", styles['Normal']))
                output_text = scan.output[:1200] + ('...' if len(scan.output) > 1200 else '')
                elements.append(Paragraph(f"<pre>{output_text}</pre>", styles['Code']))
            elements.append(Spacer(1, 16))

        # Findings & Remediation
        scan_ids_list = [s.id for s in scans]
        vulns = Vulnerability.query.filter(Vulnerability.scan_id.in_(scan_ids_list)).all() if scan_ids_list else []
        elements.append(Paragraph("🛠️ Findings & Remediation (Easy-to-Understand)", heading_style))

        severity_counts = {
            'critical': len([v for v in vulns if v.severity == 'critical']),
            'high': len([v for v in vulns if v.severity == 'high']),
            'medium': len([v for v in vulns if v.severity == 'medium']),
            'low': len([v for v in vulns if v.severity == 'low']),
            'info': len([v for v in vulns if v.severity == 'info'])
        }
        risk_score = (severity_counts['critical'] * 10 + severity_counts['high'] * 7 +
                      severity_counts['medium'] * 4 + severity_counts['low'] * 2)
        risk_level = "Low"
        if risk_score >= 20:
            risk_level = "High"
        elif risk_score >= 10:
            risk_level = "Medium"

        elements.append(Paragraph("🔐 Risk Score", heading_style))
        elements.append(Paragraph(f"Risk Level: <b>{risk_level}</b> (Score: {risk_score})", styles['Normal']))
        elements.append(Spacer(1, 12))

        findings_table = Table([
            ['Critical', str(severity_counts['critical'])],
            ['High', str(severity_counts['high'])],
            ['Medium', str(severity_counts['medium'])],
            ['Low', str(severity_counts['low'])],
            ['Info', str(severity_counts['info'])]
        ], colWidths=[200, 100])
        findings_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#111827')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#333355')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10)
        ]))
        elements.append(findings_table)
        elements.append(Spacer(1, 16))

        # Severity Chart (always show)
        severity_chart = Drawing(520, 240)
        bar = VerticalBarChart()
        bar.x = 50
        bar.y = 40
        bar.height = 160
        bar.width = 400
        bar.data = [[
            severity_counts['critical'],
            severity_counts['high'],
            severity_counts['medium'],
            severity_counts['low'],
            severity_counts['info']
        ]]
        bar.categoryAxis.categoryNames = ['Critical', 'High', 'Medium', 'Low', 'Info']
        bar.valueAxis.valueMin = 0
        bar.valueAxis.valueMax = max(1, max(severity_counts.values()))
        bar.valueAxis.valueStep = max(1, int(max(severity_counts.values()) / 5) or 1)
        bar.bars[0].fillColor = colors.HexColor('#6366f1')
        severity_chart.add(bar)
        elements.append(Paragraph("📊 Vulnerability Severity Breakdown", heading_style))
        elements.append(severity_chart)
        elements.append(Spacer(1, 16))

        # Action Plan (prioritized)
        elements.append(Paragraph("🧭 Action Plan (Prioritized)", heading_style))
        action_items = [
            "P0: Fix Critical issues immediately (same day).",
            "P1: Fix High issues within 7 days.",
            "P2: Fix Medium issues within 30 days.",
            "P3: Fix Low issues during regular maintenance.",
            "P4: Review Info findings and document decisions."
        ]
        for item in action_items:
            elements.append(Paragraph(f"- {item}", styles['Normal']))
        elements.append(Spacer(1, 16))

        # Risk Trend (last 5 scans)
        elements.append(Paragraph("📉 Risk Trend (Last 5 Scans)", heading_style))
        recent_scans = Scan.query.filter_by(user_id=current_user.id).order_by(Scan.created_at.desc()).limit(5).all()
        trend_scores = []
        trend_labels = []
        for rs in reversed(recent_scans):
            rs_vulns = Vulnerability.query.filter_by(scan_id=rs.id).all()
            rs_counts = {
                'critical': len([v for v in rs_vulns if v.severity == 'critical']),
                'high': len([v for v in rs_vulns if v.severity == 'high']),
                'medium': len([v for v in rs_vulns if v.severity == 'medium']),
                'low': len([v for v in rs_vulns if v.severity == 'low']),
                'info': len([v for v in rs_vulns if v.severity == 'info'])
            }
            score = (rs_counts['critical'] * 10 + rs_counts['high'] * 7 + rs_counts['medium'] * 4 + rs_counts['low'] * 2)
            trend_scores.append(score)
            trend_labels.append(rs.created_at.strftime('%m-%d') if rs.created_at else 'N/A')
        trend_chart = Drawing(520, 240)
        trend_bar = VerticalBarChart()
        trend_bar.x = 50
        trend_bar.y = 40
        trend_bar.height = 160
        trend_bar.width = 400
        trend_bar.data = [trend_scores or [0]]
        trend_bar.categoryAxis.categoryNames = trend_labels or ['N/A']
        trend_bar.valueAxis.valueMin = 0
        trend_bar.valueAxis.valueMax = max(1, max(trend_scores) if trend_scores else 1)
        trend_bar.valueAxis.valueStep = max(1, int((max(trend_scores) if trend_scores else 1) / 5) or 1)
        trend_bar.bars[0].fillColor = colors.HexColor('#0ea5e9')
        trend_chart.add(trend_bar)
        elements.append(trend_chart)
        elements.append(Spacer(1, 16))

        # Compliance (OWASP Top 10)
        elements.append(Paragraph("🧩 Compliance Checklist (OWASP Top 10)", heading_style))
        compliance_rows = [
            ['A01: Broken Access Control', 'Not Assessed'],
            ['A02: Cryptographic Failures', 'Not Assessed'],
            ['A03: Injection', 'Not Assessed'],
            ['A04: Insecure Design', 'Not Assessed'],
            ['A05: Security Misconfiguration', 'Not Assessed'],
            ['A06: Vulnerable Components', 'Not Assessed'],
            ['A07: Auth Failures', 'Not Assessed'],
            ['A08: Software & Data Integrity', 'Not Assessed'],
            ['A09: Logging & Monitoring', 'Not Assessed'],
            ['A10: SSRF', 'Not Assessed']
        ]
        compliance_table = Table(compliance_rows, colWidths=[300, 200])
        compliance_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1f2937')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#333355')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8)
        ]))
        elements.append(compliance_table)
        elements.append(Spacer(1, 16))

        # Retest Tracking
        elements.append(Paragraph("🔁 Retest Tracking", heading_style))
        if not vulns:
            elements.append(Paragraph("No findings to retest.", styles['Normal']))
        else:
            retest_rows = [['Finding', 'Severity', 'Status', 'Suggested Retest']]
            for v in vulns:
                retest_rows.append([v.name, v.severity, v.status, '30 days'])
            retest_table = Table(retest_rows, colWidths=[250, 80, 80, 100])
            retest_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#111827')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#333355')),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8)
            ]))
            elements.append(retest_table)
        elements.append(Spacer(1, 16))

        if not vulns:
            elements.append(Paragraph("No structured vulnerabilities were recorded for the selected scans. Consider adding findings to the vulnerability database for richer reports.", styles['Normal']))
        else:
            for v in vulns:
                elements.append(Paragraph(f"<b>{v.name}</b> ({v.severity.upper()})", styles['Heading3']))
                elements.append(Paragraph("What this means (simple):", styles['Normal']))
                simple_desc = v.description or "This issue could allow someone to access or misuse a system feature."
                simple_desc = simple_desc[:400] + ('...' if len(simple_desc) > 400 else '')
                elements.append(Paragraph(simple_desc, styles['Normal']))
                if v.cve_id:
                    elements.append(Paragraph(f"CVE: {v.cve_id}", styles['Normal']))
                if v.cvss_score is not None:
                    elements.append(Paragraph(f"CVSS: {v.cvss_score}", styles['Normal']))
                if v.port or v.service:
                    elements.append(Paragraph(f"Service: {v.service or 'N/A'} | Port: {v.port or 'N/A'}", styles['Normal']))
                if v.description:
                    desc = v.description[:800] + ('...' if len(v.description) > 800 else '')
                    elements.append(Paragraph(f"Description: {desc}", styles['Normal']))
                elements.append(Paragraph("How to fix (step-by-step):", styles['Normal']))
                if v.remediation:
                    remedy = v.remediation[:800] + ('...' if len(v.remediation) > 800 else '')
                    elements.append(Paragraph(remedy, styles['Normal']))
                else:
                    elements.append(Paragraph("1) Update the affected software to the latest version.", styles['Normal']))
                    elements.append(Paragraph("2) Disable unnecessary services or ports.", styles['Normal']))
                    elements.append(Paragraph("3) Apply secure configuration guidelines.", styles['Normal']))
                    elements.append(Paragraph("4) Re-scan to confirm the issue is fixed.", styles['Normal']))
                elements.append(Spacer(1, 12))

        # Appendices
        elements.append(Paragraph("📎 Appendices", heading_style))
        appendix_rows = [['Scan', 'Tool', 'Target', 'Command']]
        for scan in scans:
            appendix_rows.append([
                scan.name or 'Scan',
                scan.tool.name if scan.tool else 'N/A',
                scan.target,
                (scan.command or 'N/A')[:80]
            ])
        appendix_table = Table(appendix_rows, colWidths=[140, 80, 120, 180])
        appendix_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1f2937')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#333355')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6)
        ]))
        elements.append(appendix_table)
        elements.append(Spacer(1, 16))

        # Next Steps
        elements.append(Paragraph("✅ Next Steps", heading_style))
        elements.append(Paragraph("1) Fix the critical and high issues first.", styles['Normal']))
        elements.append(Paragraph("2) Re-run the scan after fixes.", styles['Normal']))
        elements.append(Paragraph("3) Keep systems updated weekly.", styles['Normal']))
        elements.append(Spacer(1, 16))

        # Glossary
        elements.append(Paragraph("📘 Simple Glossary", heading_style))
        elements.append(Paragraph("• Vulnerability: A weakness that could be misused.", styles['Normal']))
        elements.append(Paragraph("• CVE: A public ID for a known security issue.", styles['Normal']))
        elements.append(Paragraph("• CVSS: A score showing how severe a problem is.", styles['Normal']))
        elements.append(Paragraph("• Port/Service: The door and service your system uses to communicate.", styles['Normal']))
        # Footer
        elements.append(Spacer(1, 30))
        elements.append(Paragraph("─" * 50, styles['Normal']))
        elements.append(Paragraph("This report was automatically generated by CyberSec Platform.", styles['Normal']))
        elements.append(Paragraph("© 2026 CyberSec Pro - All Rights Reserved", styles['Normal']))
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'cybersec_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        )
    except Exception as e:
        import traceback
        print('Rapor üretiminde hata:', str(e))
        print(traceback.format_exc())
        return jsonify({'error': f'Rapor üretiminde hata: {str(e)}'}), 500


@app.route('/api/reports', methods=['GET', 'OPTIONS'])
@cross_origin(origins=app.config.get('CORS_ORIGINS'))
@token_required
@admin_ip_required
@rate_limit_admin(limit=30, window_sec=60)
def list_reports(current_user):
    """List all saved reports"""
    try:
        if current_user.role != 'admin':
            _audit_log('reports_list', current_user, status='denied', reason='not_admin')
            return jsonify({'error': 'Unauthorized'}), 403
        reports = Report.query.order_by(Report.created_at.desc()).all()
        _audit_log('reports_list', current_user, status='ok')
        return jsonify({
            'reports': [r.to_dict() for r in reports]
        })
    except Exception as e:
        _audit_log('reports_list', current_user, status='error', reason=str(e))
        return jsonify({'error': str(e)}), 500


# ==================== ADDITIONAL PUBLIC ENDPOINTS ====================

@app.route('/api/servers', methods=['POST'])
@admin_ip_required
@token_required
@rate_limit(limit=30, window_sec=60)
def add_server(current_user):
    """Add a new server"""
    try:
        json_error = _require_json()
        if json_error:
            return json_error
        data = request.get_json() or {}
        name = (data.get('name') or '').strip()
        protocol = (data.get('protocol') or 'ssh').strip().lower()
        host = (data.get('host') or '').strip()
        username = (data.get('username') or 'root').strip()
        tags = data.get('tags', [])
        try:
            port = int(data.get('port', 22))
        except Exception:
            return jsonify({'error': 'Invalid port'}), 400

        allowed_protocols = {'ssh', 'telnet', 'rdp', 'ftp', 'local'}
        if protocol not in allowed_protocols:
            return jsonify({'error': 'Unsupported protocol'}), 400
        if protocol != 'local' and not host:
            return jsonify({'error': 'host required'}), 400
        if len(name) > 128:
            return jsonify({'error': 'name too long'}), 400
        if len(host) > 255:
            return jsonify({'error': 'host too long'}), 400
        if len(username) > 64:
            return jsonify({'error': 'username too long'}), 400
        if protocol != 'local' and not (1 <= port <= 65535):
            return jsonify({'error': 'Invalid port'}), 400
        if protocol != 'local' and host and not _terminal_allowed(host):
            return jsonify({'error': 'Host not allowed'}), 403
        password_value = data.get('password', '') or ''
        if len(password_value) > 2048:
            return jsonify({'error': 'password too long'}), 400
        if tags is None:
            tags = []
        if not isinstance(tags, list):
            return jsonify({'error': 'tags must be a list'}), 400
        if len(tags) > 20 or any(len(str(tag)) > 32 for tag in tags):
            return jsonify({'error': 'tags invalid'}), 400

        servers = _load_servers()
        server = {
            'id': _next_server_id(servers),
            'name': name,
            'host': host,
            'port': port,
            'protocol': protocol,
            'username': username,
            'password': _encrypt_secret(password_value),
            'status': 'offline',
            'last_check': None,
            'os_type': data.get('os_type'),
            'cpu_usage': data.get('cpu_usage'),
            'memory_usage': data.get('memory_usage'),
            'disk_usage': data.get('disk_usage'),
            'tags': tags
        }
        servers.append(server)
        _save_servers(servers)
        sanitized = {**server}
        sanitized.pop('password', None)
        _audit_log('server_add', current_user, server_id=server.get('id'), host=server.get('host'))
        return jsonify(sanitized), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/servers/<int:server_id>', methods=['PUT'])
@admin_ip_required
@token_required
@rate_limit(limit=30, window_sec=60)
def update_server(current_user, server_id):
    """Update a server"""
    try:
        json_error = _require_json()
        if json_error:
            return json_error
        data = request.get_json() or {}
        servers = _load_servers()
        server = next((s for s in servers if s.get('id') == server_id), None)
        if not server:
            return jsonify({'error': 'Server not found'}), 404

        allowed_protocols = {'ssh', 'telnet', 'rdp', 'ftp', 'local'}
        protocol = (server.get('protocol') or 'ssh').strip().lower()
        host = (server.get('host') or '').strip()
        username = (server.get('username') or 'root').strip()
        name = (server.get('name') or '').strip()
        tags = server.get('tags', [])
        try:
            port = int(server.get('port', 22))
        except Exception:
            port = 22

        if 'protocol' in data and data['protocol'] is not None:
            protocol = str(data['protocol']).strip().lower()
        if 'host' in data and data['host'] is not None:
            host = str(data['host']).strip()
        if 'username' in data and data['username'] is not None:
            username = str(data['username']).strip()
        if 'name' in data and data['name'] is not None:
            name = str(data['name']).strip()
        if 'tags' in data and data['tags'] is not None:
            tags = data['tags']
        if 'port' in data and data['port'] is not None:
            try:
                port = int(data['port'])
            except Exception:
                return jsonify({'error': 'Invalid port'}), 400

        if protocol not in allowed_protocols:
            return jsonify({'error': 'Unsupported protocol'}), 400
        if protocol != 'local' and not host:
            return jsonify({'error': 'host required'}), 400
        if len(name) > 128:
            return jsonify({'error': 'name too long'}), 400
        if len(host) > 255:
            return jsonify({'error': 'host too long'}), 400
        if len(username) > 64:
            return jsonify({'error': 'username too long'}), 400
        if protocol != 'local' and not (1 <= port <= 65535):
            return jsonify({'error': 'Invalid port'}), 400
        if protocol != 'local' and host and not _terminal_allowed(host):
            return jsonify({'error': 'Host not allowed'}), 403
        if tags is None:
            tags = []
        if not isinstance(tags, list):
            return jsonify({'error': 'tags must be a list'}), 400
        if len(tags) > 20 or any(len(str(tag)) > 32 for tag in tags):
            return jsonify({'error': 'tags invalid'}), 400

        server['name'] = name
        server['host'] = host
        server['protocol'] = protocol
        server['username'] = username
        server['tags'] = tags
        for field in ('os_type', 'cpu_usage', 'memory_usage', 'disk_usage'):
            if field in data and data[field] is not None:
                server[field] = data[field]

        if 'port' in data and data['port'] is not None:
            server['port'] = port

        if 'password' in data and data['password'] is not None and data['password'] != '':
            if len(str(data['password'])) > 2048:
                return jsonify({'error': 'password too long'}), 400
            server['password'] = _encrypt_secret(data['password'])

        _save_servers(servers)
        sanitized = {**server}
        sanitized.pop('password', None)
        _audit_log('server_update', current_user, server_id=server_id, host=server.get('host'))
        return jsonify(sanitized), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/servers/<int:server_id>/check', methods=['POST'])
@admin_ip_required
@token_required
@rate_limit(limit=30, window_sec=60)
def check_server_status(current_user, server_id):
    """Check server connectivity"""
    try:
        servers = _load_servers()
        server = next((s for s in servers if s.get('id') == server_id), None)
        if not server:
            return jsonify({'error': 'Server not found'}), 404

        host = (server.get('host') or '').strip()
        port = int(server.get('port', 22))
        if not host:
            return jsonify({'error': 'Host not set'}), 400
        if not _terminal_allowed(host):
            _audit_log('server_check', current_user, server_id=server_id, host=host, status='denied', reason='host_not_allowed')
            return jsonify({'error': 'Host not allowed'}), 403

        ping_result = subprocess.run(
            ['ping', '-c', '1', '-W', '2', host],
            capture_output=True,
            timeout=5
        )
        online = ping_result.returncode == 0

        if not online:
            try:
                with socket.create_connection((host, port), timeout=2):
                    online = True
            except Exception:
                online = False

        server['status'] = 'online' if online else 'offline'
        server['last_check'] = datetime.utcnow().isoformat()
        _save_servers(servers)
        _audit_log('server_check', current_user, server_id=server_id, host=host, status='ok', online=online)
        return jsonify({
            'id': server_id,
            'online': online,
            'status': server['status'],
            'last_check': server['last_check']
        })
    except Exception as e:
        _audit_log('server_check', current_user, server_id=server_id, status='error', reason=str(e))
        return jsonify({'error': str(e)}), 500


@app.route('/api/servers/<int:server_id>', methods=['DELETE'])
@admin_ip_required
@token_required
@rate_limit(limit=30, window_sec=60)
def delete_server(current_user, server_id):
    """Delete a server"""
    servers = _load_servers()
    updated = [s for s in servers if s.get('id') != server_id]
    if len(updated) == len(servers):
        return jsonify({'error': 'Server not found'}), 404
    _save_servers(updated)
    _audit_log('server_delete', current_user, server_id=server_id)
    return jsonify({'message': 'Server deleted'}), 200


# ==================== LICENSE ENDPOINTS ====================

@app.route('/api/license/status', methods=['GET'])
def get_license_status():
    """Lisans durumunu döndür"""
    return jsonify(license_manager.get_license_info())

@app.route('/api/license/activate', methods=['POST'])
@rate_limit_admin(limit=10, window_sec=60)
def activate_license():
    """Lisans aktive et"""
    if not _admin_ip_allowed():
        _audit_log('license_activate', None, status='denied', reason='ip_not_allowed')
        return jsonify({'error': 'Admin IP not allowed'}), 403

    json_error = _require_json()
    if json_error:
        return json_error

    data = request.get_json() or {}
    license_key = data.get('license_key')
    admin_key = data.get('admin_key')
    header_token = request.headers.get('X-Admin-Token')

    if not (_admin_token_valid(header_token) or _admin_token_valid(admin_key)):
        _audit_log('license_activate', None, status='denied', reason='invalid_admin_token')
        return jsonify({'error': 'Unauthorized'}), 403
    
    if not license_key:
        return jsonify({'success': False, 'message': 'Lisans anahtarı gerekli'}), 400
    
    result = license_manager.activate_license(license_key)
    _audit_log(
        'license_activate',
        None,
        status='ok' if result.get('success') else 'error',
        license_key=_mask_license_key(license_key)
    )
    return jsonify(result), 200 if result.get('success') else 400

@app.route('/api/license/deactivate', methods=['POST'])
@rate_limit_admin(limit=10, window_sec=60)
def deactivate_license():
    """Lisansı deaktive et"""
    if not _admin_ip_allowed():
        _audit_log('license_deactivate', None, status='denied', reason='ip_not_allowed')
        return jsonify({'error': 'Admin IP not allowed'}), 403

    json_error = _require_json()
    if json_error:
        return json_error

    data = request.get_json() or {}
    admin_key = data.get('admin_key')
    header_token = request.headers.get('X-Admin-Token')

    if not (_admin_token_valid(header_token) or _admin_token_valid(admin_key)):
        _audit_log('license_deactivate', None, status='denied', reason='invalid_admin_token')
        return jsonify({'error': 'Unauthorized'}), 403

    import os
    license_file = os.path.join(os.path.dirname(__file__), 'license.key')
    if os.path.exists(license_file):
        os.remove(license_file)
    license_manager.license_data = None
    license_manager.is_valid = False
    _audit_log('license_deactivate', None, status='ok')
    return jsonify({'success': True, 'message': 'Lisans deaktive edildi'})

@app.route('/api/license/generate', methods=['POST'])
@rate_limit_admin(limit=10, window_sec=60)
def generate_license():
    """Yeni lisans oluştur (sadece admin)"""
    # Bu endpoint gerçek üründe korunmalı!
    if not _admin_ip_allowed():
        _audit_log('admin_generate_license', None, status='denied', reason='ip_not_allowed')
        return jsonify({'error': 'Admin IP not allowed'}), 403

    json_error = _require_json()
    if json_error:
        return json_error

    data = request.get_json() or {}
    admin_key = data.get('admin_key')
    header_token = request.headers.get('X-Admin-Token')

    # Admin token kontrolü (header veya body)
    if not (_admin_token_valid(header_token) or _admin_token_valid(admin_key)):
        _audit_log('admin_generate_license', None, status='denied', reason='invalid_admin_token')
        return jsonify({'error': 'Unauthorized'}), 403
    
    keys = []
    count = data.get('count', 1)
    try:
        count_int = int(count)
    except (TypeError, ValueError):
        count_int = 1
    count_int = max(1, min(count_int, 10))
    for _ in range(count_int):
        keys.append(generate_license_key())
    _audit_log('admin_generate_license', None, status='ok', count=len(keys))
    return jsonify({'keys': keys})

@app.route('/api/license/plans', methods=['GET'])
def get_license_plans():
    """Return available license plans"""
    return jsonify({
        'plans': [
            {
                'id': 'basic',
                'name': 'Basic',
                'price': 49,
                'currency': 'USD',
                'features': ['100 tools', '20 scans/day', 'Email support', 'Basic reports']
            },
            {
                'id': 'professional',
                'name': 'Professional',
                'price': 149,
                'currency': 'USD',
                'features': ['230+ tools', 'Unlimited scans', 'Priority support', 'API access', 'Advanced reports']
            },
            {
                'id': 'enterprise',
                'name': 'Enterprise',
                'price': 499,
                'currency': 'USD',
                'features': ['All features', '24/7 support', 'Custom tool development', 'White-label', 'Multi-user']
            }
        ]
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
