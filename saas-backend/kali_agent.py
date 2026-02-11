#!/usr/bin/env python3
"""
CyberSec Pro - Kali Linux Agent
Runs on remote Kali machines. Handles: registration, heartbeat, scan execution.

Usage:
  python3 kali_agent.py --token TOKEN --server https://cybersecpro.semihkilic.com
  python3 kali_agent.py --api-key API_KEY --server https://cybersecpro.semihkilic.com
"""
import os
import sys
import json
import time
import signal
import socket
import hashlib
import logging
import argparse
import platform
import subprocess
import threading
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# ── Config ────────────────────────────────────────────────────

VERSION = "1.0.0"
CONFIG_DIR = Path.home() / ".cybersec-agent"
CONFIG_FILE = CONFIG_DIR / "config.json"
LOG_FILE = CONFIG_DIR / "agent.log"
SCAN_DIR = CONFIG_DIR / "scans"

HEARTBEAT_INTERVAL = 30  # seconds
MAX_CONCURRENT_SCANS = 3
SCAN_TIMEOUT = 600       # 10 minutes max per scan

# ── Logging ───────────────────────────────────────────────────

CONFIG_DIR.mkdir(parents=True, exist_ok=True)
SCAN_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('cybersec-agent')


class CyberSecAgent:
    """CyberSec Pro Agent - runs on Kali Linux"""
    
    def __init__(self, server_url, api_key=None, token=None):
        self.server_url = server_url.rstrip('/')
        self.api_key = api_key
        self.token = token
        self.agent_id = None
        self.running = False
        self.active_scans = {}
        self.scan_lock = threading.Lock()
        self.total_completed = 0
        
        # System info
        self.hostname = socket.gethostname()
        self.ip_address = self._get_ip()
        self.os_info = self._get_os_info()
        self.platform = self._detect_platform()
    
    # ── Registration ──────────────────────────────────────────
    
    def register(self):
        """Register this agent with the server using the token"""
        if not self.token:
            logger.error("No registration token provided")
            return False
        
        agent_info = {
            'token': self.token,
            'hostname': self.hostname,
            'ip_address': self.ip_address,
            'os_info': self.os_info,
            'platform': self.platform,
            'version': VERSION,
            'cpu_usage': self._get_cpu_usage(),
            'memory_usage': self._get_memory_usage(),
            'tools_installed': self._detect_tools()
        }
        
        resp = self._api_post('/api/v1/agents/register', agent_info)
        if not resp:
            return False
        
        if 'error' in resp:
            logger.error(f"Registration failed: {resp['error']}")
            return False
        
        self.api_key = resp.get('api_key')
        self.agent_id = resp.get('agent_id')
        
        # Save config
        self._save_config()
        
        logger.info(f"✅ Registered as: {resp.get('name', 'unknown')} (ID: {self.agent_id})")
        return True
    
    # ── Heartbeat ─────────────────────────────────────────────
    
    def start(self):
        """Start agent main loop"""
        self.running = True
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        
        logger.info(f"🚀 CyberSec Agent v{VERSION} starting...")
        logger.info(f"   Server: {self.server_url}")
        logger.info(f"   Host: {self.hostname} ({self.ip_address})")
        logger.info(f"   OS: {self.os_info}")
        logger.info(f"   Heartbeat: every {HEARTBEAT_INTERVAL}s")
        
        consecutive_failures = 0
        
        while self.running:
            try:
                result = self._send_heartbeat()
                if result:
                    consecutive_failures = 0
                    # Check for pending scans
                    pending = result.get('pending_scans', [])
                    for scan in pending:
                        self._start_scan(scan)
                else:
                    consecutive_failures += 1
                    if consecutive_failures >= 5:
                        logger.warning(f"⚠️  {consecutive_failures} consecutive heartbeat failures")
                
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                consecutive_failures += 1
            
            # Wait for next heartbeat
            interval = HEARTBEAT_INTERVAL
            if consecutive_failures > 0:
                interval = min(HEARTBEAT_INTERVAL * (2 ** min(consecutive_failures, 4)), 300)
            
            time.sleep(interval)
    
    def _send_heartbeat(self):
        """Send heartbeat to server"""
        data = {
            'api_key': self.api_key,
            'hostname': self.hostname,
            'ip_address': self.ip_address,
            'os_info': self.os_info,
            'cpu_usage': self._get_cpu_usage(),
            'memory_usage': self._get_memory_usage(),
            'active_scans': len(self.active_scans),
            'version': VERSION
        }
        
        resp = self._api_post('/api/v1/agents/heartbeat', data)
        return resp if resp and 'error' not in resp else None
    
    # ── Scan Execution ────────────────────────────────────────
    
    def _start_scan(self, scan_task):
        """Start a scan in a background thread"""
        scan_id = scan_task.get('scan_id')
        
        with self.scan_lock:
            if scan_id in self.active_scans:
                return
            if len(self.active_scans) >= MAX_CONCURRENT_SCANS:
                logger.warning(f"Max concurrent scans reached, queuing {scan_id}")
                return
            self.active_scans[scan_id] = {'status': 'starting', 'started_at': time.time()}
        
        thread = threading.Thread(target=self._execute_scan, args=(scan_task,), daemon=True)
        thread.start()
    
    def _execute_scan(self, scan_task):
        """Execute a scan and report results"""
        scan_id = scan_task['scan_id']
        tool_name = scan_task.get('tool_name', '')
        target = scan_task.get('target', '')
        params = scan_task.get('parameters', {})
        
        logger.info(f"🔍 Starting scan {scan_id}: {tool_name} → {target}")
        
        # Update status
        self._report_scan_status(scan_id, 'running')
        
        try:
            # Build command
            command = self._build_command(tool_name, target, params)
            if not command:
                self._report_scan_result(scan_id, 'failed', '', f'Unknown tool: {tool_name}')
                return
            
            logger.info(f"   Command: {command}")
            
            # Execute with timeout
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=SCAN_TIMEOUT,
                env={**os.environ, 'TERM': 'dumb'}
            )
            
            output = result.stdout or ''
            error = result.stderr or ''
            
            if result.returncode == 0 or output:
                self._report_scan_result(scan_id, 'completed', output, error)
                logger.info(f"✅ Scan {scan_id} completed ({len(output)} bytes)")
            else:
                self._report_scan_result(scan_id, 'failed', output, error)
                logger.warning(f"❌ Scan {scan_id} failed: {error[:200]}")
                
        except subprocess.TimeoutExpired:
            self._report_scan_result(scan_id, 'timeout', '', f'Scan timed out after {SCAN_TIMEOUT}s')
            logger.warning(f"⏰ Scan {scan_id} timed out")
        except Exception as e:
            self._report_scan_result(scan_id, 'failed', '', str(e))
            logger.error(f"💥 Scan {scan_id} error: {e}")
        finally:
            with self.scan_lock:
                self.active_scans.pop(scan_id, None)
                self.total_completed += 1
    
    def _build_command(self, tool_name, target, params):
        """Build the scan command"""
        tool = tool_name.lower().strip()
        
        # Common tool commands
        TOOL_COMMANDS = {
            'nmap': f'nmap -sV -sC {target}',
            'masscan': f'masscan {target} -p 1-1000 --rate 500',
            'rustscan': f'rustscan -a {target} --ulimit 5000',
            'nikto': f'nikto -h {target}',
            'gobuster': f'gobuster dir -u {target} -w /usr/share/wordlists/dirb/common.txt -q',
            'dirb': f'dirb {target} /usr/share/wordlists/dirb/common.txt',
            'dirsearch': f'dirsearch -u {target} -e php,html,js -q',
            'ffuf': f'ffuf -u {target}/FUZZ -w /usr/share/wordlists/dirb/common.txt -mc 200,301,302,403',
            'sqlmap': f'sqlmap -u "{target}" --batch --level 1 --risk 1',
            'whatweb': f'whatweb -a 3 {target}',
            'wpscan': f'wpscan --url {target} --enumerate vp,vt,u --no-banner',
            'whois': f'whois {target}',
            'dig': f'dig {target} ANY +noall +answer',
            'host': f'host -a {target}',
            'nslookup': f'nslookup -type=any {target}',
            'dnsenum': f'dnsenum {target}',
            'dnsrecon': f'dnsrecon -d {target} -t std',
            'fierce': f'fierce --domain {target}',
            'subfinder': f'subfinder -d {target} -silent',
            'amass': f'amass enum -d {target} -passive -timeout 2',
            'theHarvester': f'theHarvester -d {target} -b all -l 200',
            'theharvester': f'theHarvester -d {target} -b all -l 200',
            'nuclei': f'nuclei -u {target} -severity critical,high -silent',
            'sslscan': f'sslscan {target}',
            'sslyze': f'sslyze {target}',
            'testssl': f'testssl.sh {target}',
            'testssl.sh': f'testssl.sh {target}',
            'wafw00f': f'wafw00f {target}',
            'searchsploit': f'searchsploit {target}',
            'traceroute': f'traceroute -m 20 {target}',
            'enum4linux': f'enum4linux -a {target}',
            'smbclient': f'smbclient -L {target} -N',
            'smbmap': f'smbmap -H {target}',
            'hydra': f'hydra -L /usr/share/wordlists/metasploit/default_users_for_services_unhash.txt -P /usr/share/wordlists/metasploit/default_pass_for_services_unhash.txt {target} ssh -t 4',
            'crackmapexec': f'crackmapexec smb {target}',
            'netexec': f'netexec smb {target}',
            'sherlock': f'sherlock {target} --timeout 10',
            'katana': f'katana -u {target} -d 2 -silent',
            'httpx': f'echo {target} | httpx -status-code -title -tech-detect -silent',
            'naabu': f'naabu -host {target} -top-ports 100 -silent',
            'arjun': f'arjun -u {target}',
            'dalfox': f'dalfox url "{target}" --silence',
            'commix': f'commix -u "{target}" --batch --level 1',
            'xsstrike': f'xsstrike -u "{target}" --skip',
            'wapiti': f'wapiti -u {target} --flush-session -m xxe,exec,sql,xss -S aggressive',
            'skipfish': f'skipfish -o /tmp/skipfish_{int(time.time())} {target}',
            'mtr': f'mtr --report --report-cycles 3 {target}',
            'fping': f'fping -g {target}/24 -a 2>/dev/null',
            'netdiscover': f'netdiscover -r {target}/24 -P -N',
            'gitleaks': f'gitleaks detect --source . -v',
            'trufflehog': f'trufflehog git {target}',
            'binwalk': f'binwalk {target}',
            'exiftool': f'exiftool {target}',
            'strings': f'strings {target}',
            'hping3': f'hping3 -S {target} -p 80 -c 5',
            'curl': f'curl -sIL {target}',
            'wget': f'wget --spider -S {target} 2>&1',
        }
        
        cmd = TOOL_COMMANDS.get(tool)
        if cmd:
            return cmd
        
        # Parameterized command
        if params and 'command' in params:
            return params['command']
        
        # Generic fallback
        which = subprocess.run(f'which {tool}', shell=True, capture_output=True, text=True)
        if which.returncode == 0:
            return f'{tool} {target}'
        
        return None
    
    def _report_scan_status(self, scan_id, status):
        """Report scan status to server"""
        self._api_post('/api/v1/agents/scan-status', {
            'api_key': self.api_key,
            'scan_id': scan_id,
            'status': status
        })
    
    def _report_scan_result(self, scan_id, status, output, error=''):
        """Report scan result to server"""
        self._api_post('/api/v1/agents/scan-result', {
            'api_key': self.api_key,
            'scan_id': scan_id,
            'status': status,
            'output': output[:500000],  # Max 500KB
            'error': error[:10000],
            'completed_at': datetime.utcnow().isoformat()
        })
    
    # ── System Info ───────────────────────────────────────────
    
    def _get_ip(self):
        """Get primary IP address"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return '127.0.0.1'
    
    def _get_os_info(self):
        """Get OS information"""
        try:
            result = subprocess.run('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\'',
                shell=True, capture_output=True, text=True, timeout=5)
            if result.stdout.strip():
                return result.stdout.strip()
        except Exception:
            pass
        return f"{platform.system()} {platform.release()}"
    
    def _detect_platform(self):
        """Detect if running in Docker or bare metal"""
        if os.path.exists('/.dockerenv'):
            return 'docker'
        return 'linux'
    
    def _get_cpu_usage(self):
        """Get CPU usage percentage"""
        try:
            result = subprocess.run(
                "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d. -f1",
                shell=True, capture_output=True, text=True, timeout=5
            )
            return float(result.stdout.strip() or 0)
        except Exception:
            return 0.0
    
    def _get_memory_usage(self):
        """Get memory usage percentage"""
        try:
            result = subprocess.run(
                "free | grep Mem | awk '{printf \"%.1f\", $3/$2 * 100}'",
                shell=True, capture_output=True, text=True, timeout=5
            )
            return float(result.stdout.strip() or 0)
        except Exception:
            return 0.0
    
    def _detect_tools(self):
        """Detect installed security tools"""
        tools = ['nmap', 'masscan', 'nikto', 'gobuster', 'sqlmap', 'hydra',
                 'enum4linux', 'whatweb', 'wpscan', 'sslscan', 'nuclei',
                 'ffuf', 'dirsearch', 'amass', 'subfinder', 'theHarvester',
                 'searchsploit', 'crackmapexec', 'netexec', 'wireshark']
        installed = []
        for tool in tools:
            result = subprocess.run(f'which {tool}', shell=True, capture_output=True, text=True)
            if result.returncode == 0:
                installed.append(tool)
        return installed
    
    # ── HTTP Client ───────────────────────────────────────────
    
    def _api_post(self, path, data):
        """Make POST request to server API"""
        url = f"{self.server_url}{path}"
        try:
            body = json.dumps(data).encode('utf-8')
            req = urllib.request.Request(url, data=body, method='POST')
            req.add_header('Content-Type', 'application/json')
            if self.api_key:
                req.add_header('X-Agent-Key', self.api_key)
            
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            try:
                err_body = json.loads(e.read().decode('utf-8'))
                logger.error(f"API error {e.code}: {err_body.get('error', 'unknown')}")
                return err_body
            except Exception:
                logger.error(f"API error {e.code}: {e.reason}")
                return None
        except Exception as e:
            logger.error(f"API request failed ({path}): {e}")
            return None
    
    # ── Config ────────────────────────────────────────────────
    
    def _save_config(self):
        """Save agent config to disk"""
        config = {
            'server_url': self.server_url,
            'api_key': self.api_key,
            'agent_id': self.agent_id,
            'registered_at': datetime.utcnow().isoformat()
        }
        CONFIG_FILE.write_text(json.dumps(config, indent=2))
        logger.info(f"Config saved to {CONFIG_FILE}")
    
    def _load_config(self):
        """Load saved config"""
        if CONFIG_FILE.exists():
            config = json.loads(CONFIG_FILE.read_text())
            self.server_url = config.get('server_url', self.server_url)
            self.api_key = config.get('api_key', self.api_key)
            self.agent_id = config.get('agent_id')
            return True
        return False
    
    def _handle_shutdown(self, sig, frame):
        """Handle graceful shutdown"""
        logger.info("🛑 Shutting down agent...")
        self.running = False
        sys.exit(0)


# ── CLI ───────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='CyberSec Pro Kali Agent')
    parser.add_argument('--server', '-s', default='https://cybersecpro.semihkilic.com',
                        help='CyberSec Pro server URL')
    parser.add_argument('--token', '-t', help='Registration token')
    parser.add_argument('--api-key', '-k', help='API key (if already registered)')
    parser.add_argument('--version', '-v', action='version', version=f'CyberSec Agent v{VERSION}')
    
    args = parser.parse_args()
    
    agent = CyberSecAgent(
        server_url=args.server,
        api_key=args.api_key,
        token=args.token
    )
    
    # Check for saved config
    if not args.api_key and not args.token:
        if agent._load_config() and agent.api_key:
            logger.info(f"Loaded saved config (agent: {agent.agent_id})")
        else:
            logger.error("No API key or token provided. Use --token or --api-key")
            sys.exit(1)
    
    # Register if token provided
    if args.token and not args.api_key:
        if not agent.register():
            logger.error("Registration failed. Check token and server URL.")
            sys.exit(1)
    
    # Start main loop
    agent.start()


if __name__ == '__main__':
    main()
