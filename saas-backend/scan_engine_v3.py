#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - World-Class Scan Engine v3.0
Complete rewrite with bulletproof execution

Author: Semih Kılıç
Version: 3.0.0 (Production Hardened)

FIXES:
✅ Thread-safe subprocess execution with proper timeouts
✅ Tool ID → Tool Name mapping (fixes empty tool column)
✅ Nmap XML parser for structured findings
✅ Real-time WebSocket progress (0% → 100%)
✅ Zombie process cleanup
✅ Cancel functionality that actually works
✅ Error handling with user-friendly messages
"""

import subprocess
import threading
import queue
import os
import json
import time
import uuid
import signal
import logging
import atexit
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Callable, List, Tuple
from concurrent.futures import ThreadPoolExecutor, Future, TimeoutError as FuturesTimeoutError
from dataclasses import dataclass, field
from enum import Enum

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('ScanEngineV3')


class ScanStatus(Enum):
    """Scan status enumeration"""
    PENDING = 'pending'
    QUEUED = 'queued'
    RUNNING = 'running'
    COMPLETED = 'completed'
    FAILED = 'failed'
    TIMEOUT = 'timeout'
    CANCELLED = 'cancelled'


@dataclass
class ScanFinding:
    """Individual scan finding (port, vulnerability, etc.)"""
    host: str
    port: Optional[int] = None
    protocol: str = 'tcp'
    state: str = 'open'
    service: str = ''
    version: str = ''
    banner: str = ''
    severity: str = 'info'  # critical, high, medium, low, info
    cve: Optional[str] = None
    title: str = ''  # For nikto/gobuster findings
    description: str = ''  # Detailed description
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict:
        return {
            'host': self.host,
            'port': self.port,
            'protocol': self.protocol,
            'state': self.state,
            'service': self.service,
            'version': self.version,
            'banner': self.banner,
            'severity': self.severity,
            'cve': self.cve,
            'title': self.title,
            'description': self.description,
            'timestamp': self.timestamp.isoformat()
        }


@dataclass
class ScanResult:
    """Complete scan result with parsed data"""
    scan_id: str
    status: ScanStatus
    raw_output: str
    error_log: str = ''
    findings: List[ScanFinding] = field(default_factory=list)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: float = 0
    exit_code: int = -1
    
    # Summary counts
    open_ports: int = 0
    critical_findings: int = 0
    high_findings: int = 0
    medium_findings: int = 0
    low_findings: int = 0
    
    def calculate_summary(self):
        """Calculate summary from findings"""
        self.open_ports = len([f for f in self.findings if f.state == 'open'])
        self.critical_findings = len([f for f in self.findings if f.severity == 'critical'])
        self.high_findings = len([f for f in self.findings if f.severity == 'high'])
        self.medium_findings = len([f for f in self.findings if f.severity == 'medium'])
        self.low_findings = len([f for f in self.findings if f.severity == 'low'])
    
    def to_dict(self) -> Dict:
        self.calculate_summary()
        return {
            'scan_id': self.scan_id,
            'status': self.status.value,
            'raw_output': self.raw_output,
            'error_log': self.error_log,
            'findings': [f.to_dict() for f in self.findings],
            'summary': {
                'open_ports': self.open_ports,
                'critical': self.critical_findings,
                'high': self.high_findings,
                'medium': self.medium_findings,
                'low': self.low_findings,
                'total_findings': len(self.findings)
            },
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'duration_seconds': self.duration_seconds,
            'exit_code': self.exit_code
        }


@dataclass
class ScanJob:
    """Active scan job with process tracking"""
    id: str
    tool_name: str  # Human-readable: 'nmap', 'nikto', etc.
    tool_id: str    # Database UUID (for foreign key)
    target: str
    command: List[str]
    parameters: Dict[str, Any]
    status: ScanStatus = ScanStatus.PENDING
    progress: int = 0
    current_phase: str = ''
    user_id: Optional[str] = None
    organization_id: Optional[str] = None
    
    # Process tracking
    process: Optional[subprocess.Popen] = None
    pid: Optional[int] = None
    
    # Output
    output_buffer: List[str] = field(default_factory=list)
    error_buffer: List[str] = field(default_factory=list)
    output_queue: queue.Queue = field(default_factory=queue.Queue)
    
    # Timing
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Result
    result: Optional[ScanResult] = None
    exit_code: Optional[int] = None
    
    def get_duration(self) -> float:
        """Get scan duration in seconds"""
        if not self.started_at:
            return 0
        end = self.completed_at or datetime.utcnow()
        return (end - self.started_at).total_seconds()
    
    def get_duration_str(self) -> str:
        """Get human-readable duration"""
        secs = self.get_duration()
        if secs < 60:
            return f"{int(secs)}s"
        mins = int(secs // 60)
        remaining_secs = int(secs % 60)
        return f"{mins}m {remaining_secs}s"
    
    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'tool_name': self.tool_name,
            'tool_id': self.tool_id,
            'target': self.target,
            'command': ' '.join(self.command),
            'parameters': self.parameters,
            'status': self.status.value,
            'progress': self.progress,
            'current_phase': self.current_phase,
            'duration': self.get_duration_str(),
            'duration_seconds': self.get_duration(),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat(),
            'exit_code': self.exit_code,
            'output_preview': ''.join(self.output_buffer[-20:]) if self.output_buffer else '',
            'result': self.result.to_dict() if self.result else None
        }


# Tool timeout configurations (in seconds)
TOOL_TIMEOUTS = {
    # Quick tools (30 seconds)
    'whois': 30,
    'dig': 30,
    'host': 30,
    'nslookup': 30,
    
    # Standard tools (2 minutes)
    'sslscan': 120,
    'whatweb': 120,
    'dnsrecon': 120,
    
    # Medium tools (5 minutes)
    'nmap': 600,
    'nikto': 300,
    'gobuster': 300,
    'dirb': 300,
    'theharvester': 300,
    'wpscan': 300,
    
    # Intensive tools (15 minutes)
    'masscan': 900,
    'sqlmap': 900,
    'hydra': 900,
    'enum4linux': 900,
    
    # Default timeout
    'default': 300
}


class NmapParser:
    """Parse nmap XML output into structured findings"""
    
    @staticmethod
    def parse_xml(xml_content: str, target: str) -> List[ScanFinding]:
        """Parse nmap XML output"""
        findings = []
        
        try:
            root = ET.fromstring(xml_content)
            
            for host in root.findall('.//host'):
                # Get host address
                addr_elem = host.find('address')
                host_ip = addr_elem.get('addr', target) if addr_elem is not None else target
                
                # Get hostname if available
                hostname_elem = host.find('.//hostname')
                hostname = hostname_elem.get('name', '') if hostname_elem is not None else ''
                
                # Parse ports
                for port in host.findall('.//port'):
                    port_id = int(port.get('portid', 0))
                    protocol = port.get('protocol', 'tcp')
                    
                    # Get state
                    state_elem = port.find('state')
                    state = state_elem.get('state', 'unknown') if state_elem is not None else 'unknown'
                    
                    # Get service info
                    service_elem = port.find('service')
                    if service_elem is not None:
                        service_name = service_elem.get('name', '')
                        product = service_elem.get('product', '')
                        version = service_elem.get('version', '')
                        extra_info = service_elem.get('extrainfo', '')
                        
                        version_str = f"{product} {version}".strip()
                        banner = extra_info
                    else:
                        service_name = ''
                        version_str = ''
                        banner = ''
                    
                    # Determine severity based on service
                    severity = NmapParser._assess_severity(service_name, port_id)
                    
                    finding = ScanFinding(
                        host=host_ip,
                        port=port_id,
                        protocol=protocol,
                        state=state,
                        service=service_name,
                        version=version_str,
                        banner=banner,
                        severity=severity
                    )
                    findings.append(finding)
                    
        except ET.ParseError as e:
            logger.warning(f"XML parse error: {e}")
            # Fall back to regex parsing
            findings = NmapParser.parse_text(xml_content, target)
            
        return findings
    
    @staticmethod
    def parse_text(output: str, target: str) -> List[ScanFinding]:
        """Parse nmap text output (fallback)"""
        findings = []
        
        # Regex for port lines: 22/tcp open ssh OpenSSH 8.4
        port_pattern = re.compile(
            r'(\d+)/(tcp|udp)\s+(open|closed|filtered)\s+(\S+)(?:\s+(.*))?'
        )
        
        for line in output.split('\n'):
            match = port_pattern.search(line)
            if match:
                port = int(match.group(1))
                protocol = match.group(2)
                state = match.group(3)
                service = match.group(4)
                version = match.group(5) or ''
                
                severity = NmapParser._assess_severity(service, port)
                
                finding = ScanFinding(
                    host=target,
                    port=port,
                    protocol=protocol,
                    state=state,
                    service=service,
                    version=version.strip(),
                    severity=severity
                )
                findings.append(finding)
        
        return findings
    
    @staticmethod
    def _assess_severity(service: str, port: int) -> str:
        """Assess severity based on service type"""
        # Critical services (should not be exposed)
        critical_services = ['telnet', 'ftp', 'mysql', 'postgres', 'mssql', 'oracle', 'redis', 'mongodb', 'memcached']
        high_services = ['ssh', 'rdp', 'vnc', 'smb', 'netbios', 'ldap']
        medium_services = ['http', 'https', 'smtp', 'pop3', 'imap']
        
        service_lower = service.lower()
        
        if any(s in service_lower for s in critical_services):
            return 'critical'
        elif any(s in service_lower for s in high_services):
            return 'high'
        elif any(s in service_lower for s in medium_services):
            return 'medium'
        elif port in [21, 23, 3306, 5432, 1433, 27017, 6379]:  # Well-known risky ports
            return 'high'
        
        return 'info'


class NiktoParser:
    """Parse nikto output into structured findings"""
    
    @staticmethod
    def parse_output(output: str, target: str) -> List[ScanFinding]:
        """Parse nikto text output"""
        findings = []
        
        # Common nikto patterns
        # + OSVDB-12184: /index.php?=PHPE9568F35-D428-11d2-A769-00AA001ACF42: PHP reveals...
        # + /admin/: Directory indexing found.
        vuln_pattern = re.compile(
            r'\+\s+(?:OSVDB-\d+:\s+)?([^:]+):\s+(.+)',
            re.IGNORECASE
        )
        
        for line in output.split('\n'):
            line = line.strip()
            if line.startswith('+') and not line.startswith('+ Target') and not line.startswith('+ Server'):
                match = vuln_pattern.match(line)
                if match:
                    path = match.group(1).strip()
                    description = match.group(2).strip()
                    
                    # Determine severity based on keywords
                    severity = 'info'
                    desc_lower = description.lower()
                    if any(w in desc_lower for w in ['xss', 'injection', 'sql', 'rce', 'command', 'exec']):
                        severity = 'critical'
                    elif any(w in desc_lower for w in ['vuln', 'exploit', 'shell', 'upload', 'bypass']):
                        severity = 'high'
                    elif any(w in desc_lower for w in ['directory', 'index', 'listing', 'disclosure', 'default']):
                        severity = 'medium'
                    elif any(w in desc_lower for w in ['outdated', 'version', 'header', 'cookie']):
                        severity = 'low'
                    
                    finding = ScanFinding(
                        host=target,
                        port=80,  # Default, could be parsed from target
                        protocol='tcp',
                        state='open',
                        service='http',
                        title=f"Nikto: {path}",
                        description=description,
                        severity=severity
                    )
                    findings.append(finding)
        
        return findings


class GobusterParser:
    """Parse gobuster output into structured findings"""
    
    @staticmethod
    def parse_output(output: str, target: str) -> List[ScanFinding]:
        """Parse gobuster text output"""
        findings = []
        
        # Gobuster output patterns:
        # /admin                 (Status: 301) [Size: 0]
        # /images               (Status: 200) [Size: 1234]
        path_pattern = re.compile(
            r'^(/[^\s]+)\s+\(Status:\s*(\d+)\)',
            re.MULTILINE
        )
        
        for match in path_pattern.finditer(output):
            path = match.group(1)
            status = int(match.group(2))
            
            # Skip 404s (shouldn't appear but just in case)
            if status == 404:
                continue
            
            # Determine severity based on path and status
            severity = 'info'
            path_lower = path.lower()
            if any(w in path_lower for w in ['admin', 'backup', 'config', 'database', 'db', 'sql']):
                severity = 'high'
            elif any(w in path_lower for w in ['upload', 'api', 'shell', 'cmd', 'exec']):
                severity = 'high'
            elif any(w in path_lower for w in ['login', 'auth', 'panel', 'dashboard', 'manage']):
                severity = 'medium'
            elif status in [200, 301, 302]:
                severity = 'low'
            
            finding = ScanFinding(
                host=target,
                port=80,  # Default
                protocol='tcp',
                state='open',
                service='http',
                title=f"Directory: {path}",
                description=f"Found path {path} with status {status}",
                severity=severity
            )
            findings.append(finding)
        
        return findings


class ScanEngineV3:
    """
    World-class scan execution engine v3.0
    
    Features:
    ✅ ThreadPoolExecutor with proper cleanup
    ✅ Thread-safe scan registry
    ✅ Real-time WebSocket progress
    ✅ Nmap XML parsing for findings
    ✅ Proper timeout and cancellation
    ✅ Zombie process prevention
    ✅ Database sync on completion
    """
    
    def __init__(
        self,
        max_workers: int = 3,
        socketio=None,
        app=None
    ):
        self.max_workers = max_workers
        self.socketio = socketio
        self.app = app
        
        # Thread pool
        self.executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix='ScanWorkerV3'
        )
        
        # Thread-safe registry
        self._scans: Dict[str, ScanJob] = {}
        self._lock = threading.RLock()
        
        # Shutdown flag
        self._shutdown = False
        
        # Track active processes for cleanup
        self._active_pids: set = set()
        
        # Register cleanup handler (no signal handlers - conflicts with eventlet)
        atexit.register(self._cleanup_all)
        
        logger.info(f"ScanEngineV3 initialized with {max_workers} workers")
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, shutting down...")
        self.shutdown()
    
    def _cleanup_all(self):
        """Clean up all processes on exit"""
        for pid in list(self._active_pids):
            try:
                os.killpg(os.getpgid(pid), signal.SIGKILL)
            except (OSError, ProcessLookupError):
                pass
        self._active_pids.clear()
    
    def get_timeout(self, tool_name: str, params: Dict[str, Any] = None) -> int:
        """Get timeout for a tool, scaling for intensive params"""
        base = TOOL_TIMEOUTS.get(tool_name.lower(), TOOL_TIMEOUTS['default'])
        # Scale nmap timeout if full port range requested
        if tool_name.lower() == 'nmap' and params:
            ports = params.get('ports', '') or params.get('Port Range', '')
            if ports and ('65535' in str(ports) or str(ports).strip() == '-'):
                base = max(base, 1800)  # 30 min for full port scans
            top_ports = params.get('top_ports', '') or params.get('Top Ports', '')
            if top_ports and int(str(top_ports)) > 5000:
                base = max(base, 900)  # 15 min for >5k ports
        return base
    
    def normalize_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize frontend param names to backend expected keys"""
        normalized = {}
        key_map = {
            # Nmap
            'Timing': 'timing',
            'Port Range': 'ports',
            'Ports': 'ports',
            'Service Version': 'service_version',
            'OS Detection': 'os_detection',
            'Scan Type': 'scan_type',
            'Scripts': 'script',
            'Script': 'script',
            'Top Ports': 'top_ports',
            'Output Format': 'output_format',
            'Verbose': 'verbose',
            'No DNS': 'no_dns',
            'Aggressive': 'aggressive',
            # Nikto
            'Target Host': 'target_host',
            'Port': 'port',
            'SSL': 'ssl',
            'Tuning': 'tuning',
            'Plugins': 'plugins',
            'Format': 'format',
            'Timeout': 'timeout',
            'No 404': 'no404',
            'User Agent': 'user_agent',
            # Gobuster
            'Mode': 'mode',
            'Target URL': 'target_url',
            'Wordlist': 'wordlist',
            'Extensions': 'extensions',
            'Threads': 'threads',
            'Status Codes': 'status_codes',
            'No TLS Verify': 'no_tls_verify',
            'Follow Redirect': 'follow_redirect',
            'Cookie': 'cookie',
            # SQLMap
            'Level': 'level',
            'Risk': 'risk',
            'Database': 'database',
            'Tables': 'tables',
            'Dump': 'dump',
            'Batch': 'batch',
            # Hydra
            'Service': 'service',
            'Username': 'username',
            'Password': 'password',
            'Username List': 'username_list',
            'Password List': 'password_list',
        }
        
        for key, value in params.items():
            # Map the key
            new_key = key_map.get(key, key.lower().replace(' ', '_'))
            
            # Clean up select values like "S (SYN)" -> "S"
            if isinstance(value, str):
                # Extract just the first part before any description in parentheses
                if ' (' in value:
                    value = value.split(' (')[0].strip()
                # Remove T prefix if it's timing (backend adds it)
                if new_key == 'timing' and value.startswith('T'):
                    value = value[1:]  # 'T3' -> '3' (backend adds T prefix)
            
            normalized[new_key] = value
        
        return normalized
    
    def build_nmap_command(self, target: str, params: Dict[str, Any]) -> List[str]:
        """Build proper nmap command with XML output"""
        # Normalize params first
        params = self.normalize_params(params)
        
        cmd = ['nmap']
        
        # Always output XML to stdout for parsing
        cmd.extend(['-oX', '-'])
        
        # Timing — SAFETY: force minimum T3, never allow T1/T2 (too slow)
        timing = params.get('timing', 'T3')
        if not timing.startswith('T'):
            timing = f'T{timing}'
        # Block T0, T1, T2 — they cause scans to hang
        timing_num = int(timing[1]) if len(timing) > 1 and timing[1].isdigit() else 3
        if timing_num < 3:
            logger.warning(f"Blocked slow timing {timing}, forcing T3")
            timing = 'T3'
        cmd.append(f'-{timing}')
        
        # Port range — SAFETY OVERRIDE: never allow 1-65535 full scan
        ports = params.get('ports', '')
        top_ports = params.get('top_ports', '')
        
        # EMERGENCY FIX: Intercept full-range port scans and replace with --top-ports
        if ports and ('65535' in str(ports) or str(ports).strip() in ('-', '1-65535', '0-65535')):
            logger.warning(f"Blocked full port range '{ports}', using --top-ports 10000 instead")
            ports = ''  # Clear dangerous port range
            top_ports = '10000'  # Use top 10000 instead
        
        if ports:
            cmd.extend(['-p', str(ports)])
        elif top_ports:
            cmd.extend(['--top-ports', str(int(top_ports))])
        else:
            # Default: top 1000 ports (faster than 1-1000 sequential, same coverage)
            cmd.extend(['--top-ports', '1000'])
        
        # Service version detection (skip if scan_type already includes sV)
        scan_type_raw = params.get('scan_type', 'S')
        if params.get('service_version', True) and 'sV' not in scan_type_raw and 'V' not in scan_type_raw:
            cmd.append('-sV')
        
        # OS detection (requires root)
        if params.get('os_detection', False):
            cmd.append('-O')
        
        # Scripts
        script = params.get('script', '')
        if script:
            cmd.extend(['--script', script])
        
        # Scan type
        scan_type = params.get('scan_type', 'S')
        if scan_type:
            # Handle both formats: '-sV', 'sV', 'S', '-sS'
            scan_type = scan_type.lstrip('-')
            if scan_type.startswith('s'):
                cmd.append(f'-{scan_type}')
            else:
                cmd.append(f'-s{scan_type}')
        
        # Target goes last
        cmd.append(target)
        
        return cmd
    
    # Tools that are NOT CLI scanners - they're frameworks, GUIs, or script collections
    # These need special handling or emulation
    NON_SCANNER_TOOLS = {
        'nishang', 'powersploit', 'empire', 'starkiller', 'covenant',
        'burpsuite', 'wireshark', 'maltego', 'armitage', 'cobalt-strike',
        'metasploit', 'autopsy', 'ghidra', 'binary-ninja', 'cutter', 'ida',
        'radare2', 'bloodhound', 'faraday', 'dradis', 'magictree',
        'cherrytree', 'keepnote', 'serpico', 'recordmydesktop',
        'king-phisher', 'gophish', 'beef-xss', 'evilginx2',
        'social-engineering-toolkit', 'set', 'httrack',
        'GTFOBins', 'LOLBASProject', 'WADComs', 'PEASS-ng',
        'airgeddon', 'wifite', 'fluxion', 'linpeas', 'winpeas',
    }

    # Tools that accept a target as first argument: tool <target>
    SIMPLE_TARGET_TOOLS = {
        'whois', 'host', 'nslookup', 'sslscan', 'ping',
        'traceroute', 'arping', 'nbtscan', 'onesixtyone',
        'swaks', 'smtp-user-enum', 'amap', 'xprobe2',
    }
    
    # Tools that use -h/-host for target
    DASH_H_TARGET_TOOLS = {
        'nikto', 'fierce',
    }
    
    # Tools that use -u/-url for target
    DASH_U_TARGET_TOOLS = {
        'sqlmap', 'wpscan', 'commix', 'xsser', 'arjun',
        'paramspider', 'hakrawler',
    }

    def build_command(self, tool_name: str, target: str, params: Dict[str, Any]) -> List[str]:
        """Build command for any Kali tool with intelligent parameter handling"""
        tool_lower = tool_name.lower().replace('-', '_')
        tool_original = tool_name.lower()
        # Normalize params for all tools
        params = self.normalize_params(params)
        
        if tool_lower == 'nmap':
            return self.build_nmap_command(target, params)
        elif tool_original == 'whois':
            return ['whois', target]
        elif tool_original == 'dig':
            record_type = params.get('record_type', 'A')
            cmd = ['dig', target, record_type]
            if params.get('short', False):
                cmd.append('+short')
            return cmd
        elif tool_original == 'host':
            return ['host', target]
        elif tool_original == 'nslookup':
            return ['nslookup', target]
        elif tool_original == 'sslscan':
            return ['sslscan', target]
        elif tool_original == 'whatweb':
            aggression = params.get('aggression', '1')
            return ['whatweb', f'-a{aggression}', target]
        
        # --- INFORMATION GATHERING ---
        elif tool_original in ('dnsrecon', 'dns-recon'):
            cmd = ['dnsrecon', '-d', target]
            scan_type = params.get('type', 'std')
            if scan_type:
                cmd.extend(['-t', scan_type])
            return cmd
        elif tool_original == 'dnsenum':
            return ['dnsenum', target]
        elif tool_original == 'fierce':
            return ['fierce', '--domain', target]
        elif tool_original == 'theharvester':
            source = params.get('source', 'all')
            limit = params.get('limit', '100')
            return ['theHarvester', '-d', target, '-b', source, '-l', str(limit)]
        elif tool_original == 'amass':
            mode = params.get('mode', 'enum')
            cmd = ['amass', mode, '-d', target]
            if params.get('passive', False):
                cmd.append('-passive')
            return cmd
        elif tool_original == 'subfinder':
            return ['subfinder', '-d', target, '-silent']
        elif tool_original == 'assetfinder':
            return ['assetfinder', '--subs-only', target]
        elif tool_original == 'sublist3r':
            return ['sublist3r', '-d', target]
        elif tool_original == 'masscan':
            ports = params.get('ports', '1-1000')
            rate = params.get('rate', '1000')
            return ['masscan', target, '-p', str(ports), '--rate', str(rate)]
        elif tool_original == 'httpx':
            return ['echo', target, '|', 'httpx', '-silent']
        elif tool_original == 'nuclei':
            cmd = ['nuclei', '-u', target]
            templates = params.get('templates', '')
            if templates:
                cmd.extend(['-t', templates])
            severity = params.get('severity', '')
            if severity:
                cmd.extend(['-severity', severity])
            return cmd
        elif tool_original == 'wafw00f':
            return ['wafw00f', target]
        elif tool_original == 'censys-cli':
            return ['censys', 'search', target]
        elif tool_original == 'shodan':
            return ['shodan', 'host', target]
        elif tool_original == 'dmitry':
            return ['dmitry', '-winsepfb', target]
        elif tool_original == 'enum4linux':
            return ['enum4linux', '-a', target]
        elif tool_original == 'snmpwalk':
            community = params.get('community', 'public')
            return ['snmpwalk', '-v2c', '-c', community, target]
        elif tool_original == 'snmp-check':
            return ['snmp-check', target]
        elif tool_original == 'nbtscan':
            return ['nbtscan', target]
        elif tool_original == 'arp-scan':
            return ['arp-scan', target]
        
        # --- WEB APPLICATION TOOLS ---
        elif tool_original == 'nikto':
            cmd = ['nikto', '-h', target]
            port = params.get('port', '80')
            if port:
                cmd.extend(['-p', str(port)])
            if params.get('ssl', False):
                cmd.append('-ssl')
            tuning = params.get('tuning', '')
            if tuning:
                cmd.extend(['-Tuning', tuning])
            return cmd
        elif tool_original == 'gobuster':
            mode = params.get('mode', 'dir')
            cmd = ['gobuster', mode]
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            cmd.extend(['-u', url])
            wordlist = params.get('wordlist', '/usr/share/wordlists/dirb/common.txt')
            cmd.extend(['-w', wordlist])
            extensions = params.get('extensions', '')
            if extensions:
                cmd.extend(['-x', extensions])
            threads = params.get('threads', '')
            if threads:
                cmd.extend(['-t', str(threads)])
            return cmd
        elif tool_original == 'dirb':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            wordlist = params.get('wordlist', '/usr/share/wordlists/dirb/common.txt')
            return ['dirb', url, wordlist]
        elif tool_original == 'dirsearch':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            return ['dirsearch', '-u', url, '-e', params.get('extensions', 'php,html,js')]
        elif tool_original == 'ffuf':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            wordlist = params.get('wordlist', '/usr/share/wordlists/dirb/common.txt')
            return ['ffuf', '-u', f'{url}/FUZZ', '-w', wordlist]
        elif tool_original == 'wpscan':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            cmd = ['wpscan', '--url', url]
            if params.get('enumerate', ''):
                cmd.extend(['--enumerate', params['enumerate']])
            cmd.append('--no-banner')
            return cmd
        elif tool_original == 'sqlmap':
            cmd = ['sqlmap', '-u', target, '--batch']
            level = params.get('level', '')
            if level:
                cmd.extend(['--level', str(level)])
            risk = params.get('risk', '')
            if risk:
                cmd.extend(['--risk', str(risk)])
            if params.get('dbs', False):
                cmd.append('--dbs')
            return cmd
        elif tool_original == 'commix':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            return ['commix', '--url', url, '--batch']
        elif tool_original == 'xsser':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            return ['xsser', '-u', url, '--auto']
        elif tool_original == 'arjun':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            return ['arjun', '-u', url]
        elif tool_original == 'curl':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            cmd = ['curl', '-sIL', url]
            return cmd
        elif tool_original == 'wget':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            return ['wget', '--spider', '-S', url]

        # --- VULNERABILITY ANALYSIS ---
        elif tool_original == 'openvas':
            return ['gvm-cli', 'socket', '--xml', f'<create_target><name>{target}</name><hosts>{target}</hosts></create_target>']
        elif tool_original == 'lynis':
            return ['lynis', 'audit', 'system', '--quick']
        elif tool_original == 'skipfish':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            return ['skipfish', '-o', '/tmp/skipfish-out', url]
        elif tool_original == 'wapiti':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            return ['wapiti', '-u', url, '-f', 'txt']
        elif tool_original == 'arachni':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            return ['arachni', url]
        
        # --- PASSWORD ATTACKS ---
        elif tool_original == 'hydra':
            service = params.get('service', 'ssh')
            userlist = params.get('userlist', '/usr/share/wordlists/metasploit/unix_users.txt')
            passlist = params.get('passlist', '/usr/share/wordlists/rockyou.txt')
            cmd = ['hydra', '-L', userlist, '-P', passlist, target, service]
            port = params.get('port', '')
            if port:
                cmd.extend(['-s', str(port)])
            threads = params.get('threads', '4')
            cmd.extend(['-t', str(threads)])
            return cmd
        elif tool_original == 'john':
            hashfile = params.get('hashfile', target)
            cmd = ['john', hashfile]
            wordlist = params.get('wordlist', '')
            if wordlist:
                cmd.extend(['--wordlist', wordlist])
            return cmd
        elif tool_original == 'hashcat':
            hashfile = params.get('hashfile', target)
            mode = params.get('mode', '0')
            cmd = ['hashcat', '-m', str(mode), hashfile]
            wordlist = params.get('wordlist', '')
            if wordlist:
                cmd.append(wordlist)
            return cmd
        elif tool_original == 'medusa':
            service = params.get('service', 'ssh')
            return ['medusa', '-h', target, '-M', service, '-u', 'admin', '-P', '/usr/share/wordlists/rockyou.txt']
        elif tool_original == 'cewl':
            url = target if target.startswith(('http://', 'https://')) else f'http://{target}'
            depth = params.get('depth', '2')
            return ['cewl', '-d', str(depth), url]
        elif tool_original == 'crunch':
            min_len = params.get('min', '4')
            max_len = params.get('max', '8')
            charset = params.get('charset', 'abcdefghijklmnopqrstuvwxyz0123456789')
            return ['crunch', str(min_len), str(max_len), charset]

        # --- SNIFFING & SPOOFING ---
        elif tool_original == 'tcpdump':
            interface = params.get('interface', 'any')
            count = params.get('count', '100')
            return ['tcpdump', '-i', interface, '-c', count, 'host', target]
        elif tool_original == 'tshark':
            count = params.get('count', '100')
            return ['tshark', '-c', count, '-f', f'host {target}']
        elif tool_original == 'bettercap':
            return ['bettercap', '-eval', f'net.probe on; set arp.spoof.targets {target}; arp.spoof on; sleep 5; quit']
        elif tool_original == 'ettercap':
            return ['ettercap', '-T', '-q', '-i', params.get('interface', 'eth0'), f'/{target}//', '-w', '/tmp/ettercap.pcap']
        elif tool_original in ('netcat', 'nc', 'ncat'):
            port = params.get('port', '80')
            return ['nc', '-zv', target, str(port)]

        # --- NETWORK UTILITIES ---
        elif tool_original == 'ping':
            count = params.get('count', '4')
            return ['ping', '-c', str(count), target]
        elif tool_original == 'traceroute':
            return ['traceroute', target]
        elif tool_original == 'hping3':
            port = params.get('port', '80')
            return ['hping3', '-S', target, '-p', str(port), '-c', '5']
        elif tool_original == 'mtr':
            return ['mtr', '--report', '--report-cycles', '5', target]
        elif tool_original == 'ike-scan':
            return ['ike-scan', target]
        elif tool_original == 'socat':
            port = params.get('port', '80')
            return ['socat', '-', f'TCP:{target}:{port}']
        
        # --- EXPLOITATION ---
        elif tool_original == 'msfconsole':
            module = params.get('module', 'auxiliary/scanner/portscan/tcp')
            return ['msfconsole', '-q', '-x', f'use {module}; set RHOSTS {target}; run; exit']
        elif tool_original == 'searchsploit':
            return ['searchsploit', target]
        
        # --- FORENSICS ---
        elif tool_original == 'exiftool':
            return ['exiftool', target]
        elif tool_original == 'binwalk':
            return ['binwalk', target]
        elif tool_original == 'strings':
            return ['strings', target]
        elif tool_original == 'foremost':
            return ['foremost', '-i', target]
        elif tool_original == 'volatility':
            return ['vol', '-f', target, 'imageinfo']
        
        # --- WIRELESS ---
        elif tool_original == 'aircrack-ng':
            return ['aircrack-ng', target]
        elif tool_original == 'airmon-ng':
            return ['airmon-ng', 'start', params.get('interface', 'wlan0')]
        elif tool_original == 'airodump-ng':
            return ['airodump-ng', params.get('interface', 'wlan0mon')]
        
        # --- REVERSE ENGINEERING ---
        elif tool_original == 'checksec':
            return ['checksec', '--file', target]
        elif tool_original == 'objdump':
            return ['objdump', '-d', target]
        elif tool_original == 'strace':
            return ['strace', '-c', target]
        elif tool_original == 'ltrace':
            return ['ltrace', '-c', target]
        
        # --- NON-SCANNER TOOLS: provide useful info instead of failing silently ---
        elif tool_original in self.NON_SCANNER_TOOLS:
            # For tools that are frameworks/GUIs/script collections,
            # run --help or display their usage info
            return ['sh', '-c', f'{tool_original} --help 2>&1 || {tool_original} -h 2>&1 || echo "{tool_original} is a framework/GUI tool that requires interactive usage. It cannot run as a command-line scanner against a target."']
        
        else:
            # Smart generic fallback: try the tool with target,
            # but also capture stderr and handle missing tools
            return ['sh', '-c', f'command -v {tool_original} > /dev/null 2>&1 && {tool_original} {target} 2>&1 || echo "Tool \\"{tool_original}\\" is not available as a CLI scanner. It may be a GUI application, framework, or requires specific parameters."']
    
    def submit_scan(
        self,
        scan_id: str,
        tool_name: str,
        tool_id: str,
        target: str,
        params: Dict[str, Any],
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        db_callback: Optional[Callable] = None
    ) -> ScanJob:
        """Submit a new scan for execution"""
        if self._shutdown:
            raise RuntimeError("ScanEngine is shutting down")
        
        # Build command
        command = self.build_command(tool_name, target, params)
        
        # Create job
        job = ScanJob(
            id=scan_id,
            tool_name=tool_name,
            tool_id=tool_id,
            target=target,
            command=command,
            parameters=params,
            status=ScanStatus.QUEUED,
            user_id=user_id,
            organization_id=organization_id
        )
        
        # Register
        with self._lock:
            self._scans[scan_id] = job
        
        # Submit to thread pool
        future = self.executor.submit(
            self._execute_scan,
            job,
            db_callback
        )
        
        # Handle exceptions
        def handle_exception(f):
            try:
                f.result()
            except Exception as e:
                logger.error(f"Scan {scan_id} crashed: {e}")
                self._mark_failed(job, str(e), db_callback)
        
        future.add_done_callback(handle_exception)
        
        logger.info(f"Scan {scan_id} submitted: {tool_name} -> {target}")
        self._emit_progress(job)
        
        return job
    
    def _execute_scan(
        self,
        job: ScanJob,
        db_callback: Optional[Callable]
    ):
        """Execute scan in worker thread"""
        scan_id = job.id
        timeout = self.get_timeout(job.tool_name, job.params)
        
        try:
            # Update status
            with self._lock:
                job.status = ScanStatus.RUNNING
                job.started_at = datetime.utcnow()
                job.current_phase = 'Initializing'
            
            self._emit_progress(job)
            
            logger.info(f"Executing: {' '.join(job.command)}")
            
            # Start process in new process group
            process = subprocess.Popen(
                job.command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                preexec_fn=os.setsid
            )
            
            with self._lock:
                job.process = process
                job.pid = process.pid
                self._active_pids.add(process.pid)
            
            # Stream output with timeout
            output_lines = []
            error_lines = []
            start_time = time.time()
            
            # Non-blocking read using select
            import select
            
            while process.poll() is None:
                elapsed = time.time() - start_time
                
                # Check timeout
                if elapsed > timeout:
                    logger.warning(f"Scan {scan_id} timed out after {timeout}s")
                    self._kill_process(process)
                    with self._lock:
                        job.status = ScanStatus.TIMEOUT
                        job.error_buffer.append(f"Scan exceeded {timeout}s timeout limit")
                    break
                
                # Check shutdown
                if self._shutdown:
                    self._kill_process(process)
                    break
                
                # Calculate progress (based on time elapsed vs expected)
                progress = min(95, int((elapsed / timeout) * 100))
                job.progress = progress
                
                # Update phase based on progress
                if progress < 20:
                    job.current_phase = 'Host Discovery'
                elif progress < 50:
                    job.current_phase = 'Port Scanning'
                elif progress < 80:
                    job.current_phase = 'Service Detection'
                else:
                    job.current_phase = 'Finalizing'
                
                # Read available output
                ready = select.select([process.stdout, process.stderr], [], [], 0.5)
                
                for stream in ready[0]:
                    line = stream.readline()
                    if line:
                        if stream == process.stdout:
                            output_lines.append(line)
                            job.output_buffer.append(line)
                            job.output_queue.put(line)
                        else:
                            error_lines.append(line)
                            job.error_buffer.append(line)
                
                # Emit progress status lines to keep SSE stream alive
                # nmap XML mode (-oX -) buffers all output until the end,
                # so we emit phase updates as synthetic lines
                if int(elapsed) % 5 == 0 and int(elapsed) > 0:
                    phase = job.current_phase
                    pct = job.progress
                    status_line = f"[{phase}] {pct}% complete... ({int(elapsed)}s elapsed)"
                    # Only emit status updates, don't add to output_buffer (not real tool output)
                    try:
                        job.output_queue.put(status_line)
                    except Exception:
                        pass
                
                # Emit progress every 2 seconds
                if int(elapsed) % 2 == 0:
                    self._emit_progress(job)
            
            # Read ALL remaining output - critical for nmap XML which outputs at end
            # Use read() instead of communicate() after partial readline() consumption
            try:
                # Drain stdout completely
                remaining_out = process.stdout.read() if process.stdout else ''
                if remaining_out:
                    output_lines.append(remaining_out)
                    job.output_buffer.append(remaining_out)
                    logger.debug(f"Scan {scan_id} drained {len(remaining_out)} chars from stdout")
            except Exception as e:
                logger.warning(f"Scan {scan_id} stdout drain error: {e}")
            
            try:
                # Drain stderr completely
                remaining_err = process.stderr.read() if process.stderr else ''
                if remaining_err:
                    error_lines.append(remaining_err)
                    job.error_buffer.append(remaining_err)
            except Exception as e:
                logger.warning(f"Scan {scan_id} stderr drain error: {e}")
            
            # Ensure process is fully terminated
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._kill_process(process)
            
            # Get exit code
            exit_code = process.returncode
            
            # Finalize
            raw_output = ''.join(output_lines)
            error_output = ''.join(error_lines)
            
            # Parse findings based on tool type
            findings = []
            tool_lower = job.tool_name.lower()
            
            if tool_lower == 'nmap' and raw_output:
                findings = NmapParser.parse_xml(raw_output, job.target)
                if not findings:
                    findings = NmapParser.parse_text(raw_output, job.target)
            elif tool_lower == 'nikto' and raw_output:
                findings = NiktoParser.parse_output(raw_output, job.target)
            elif tool_lower == 'gobuster' and raw_output:
                findings = GobusterParser.parse_output(raw_output, job.target)
            elif raw_output:
                # Generic parser for other tools - extract any port/service info
                findings = NmapParser.parse_text(raw_output, job.target)
            
            # Determine status: if we have findings, it's a success even with non-zero exit
            # Some tools (nikto, gobuster) return non-zero but still produce valid results
            if job.status == ScanStatus.TIMEOUT:
                final_status = ScanStatus.TIMEOUT
            elif len(findings) > 0 or exit_code == 0:
                final_status = ScanStatus.COMPLETED
            else:
                final_status = ScanStatus.FAILED
            
            # Create result
            result = ScanResult(
                scan_id=scan_id,
                status=final_status,
                raw_output=raw_output,
                error_log=error_output,
                findings=findings,
                started_at=job.started_at,
                completed_at=datetime.utcnow(),
                duration_seconds=job.get_duration(),
                exit_code=exit_code
            )
            result.calculate_summary()
            
            with self._lock:
                job.result = result
                job.exit_code = exit_code
                job.completed_at = datetime.utcnow()
                job.progress = 100
                job.current_phase = 'Complete'
                
                if job.status == ScanStatus.RUNNING:
                    job.status = result.status
            
            logger.info(f"Scan {scan_id} completed: {result.status.value}, {len(findings)} findings")
            
            # Call database callback
            if db_callback:
                try:
                    db_callback(
                        scan_id=scan_id,
                        status=job.status.value,
                        output=raw_output[:65000],
                        findings=result.to_dict(),
                        exit_code=exit_code
                    )
                except Exception as e:
                    logger.error(f"DB callback error: {e}")
            
        except Exception as e:
            logger.error(f"Scan {scan_id} error: {e}", exc_info=True)
            self._mark_failed(job, str(e), db_callback)
        
        finally:
            # Cleanup
            with self._lock:
                if job.pid in self._active_pids:
                    self._active_pids.discard(job.pid)
                job.process = None
            
            # Final emit
            self._emit_progress(job)
            self._emit_complete(job)
    
    def _mark_failed(self, job: ScanJob, error: str, db_callback: Optional[Callable]):
        """Mark scan as failed"""
        with self._lock:
            job.status = ScanStatus.FAILED
            job.error_buffer.append(error)
            job.completed_at = datetime.utcnow()
        
        if db_callback:
            try:
                db_callback(
                    scan_id=job.id,
                    status='failed',
                    output=error,
                    findings=None,
                    exit_code=-1
                )
            except Exception as e:
                logger.error(f"DB callback error: {e}")
    
    def _kill_process(self, process: subprocess.Popen):
        """Kill process and all children"""
        try:
            pid = process.pid
            os.killpg(os.getpgid(pid), signal.SIGTERM)
            time.sleep(0.5)
            try:
                os.killpg(os.getpgid(pid), signal.SIGKILL)
            except (OSError, ProcessLookupError):
                pass
            self._active_pids.discard(pid)
        except Exception as e:
            logger.warning(f"Error killing process: {e}")
    
    def _emit_progress(self, job: ScanJob):
        """Emit progress via WebSocket"""
        if not self.socketio:
            return
        
        try:
            self.socketio.emit('scan_progress', {
                'scan_id': job.id,
                'status': job.status.value,
                'progress': job.progress,
                'phase': job.current_phase,
                'duration': job.get_duration_str(),
                'tool_name': job.tool_name,
                'target': job.target
            }, namespace='/scans')
        except Exception as e:
            logger.debug(f"WebSocket emit error: {e}")
    
    def _emit_complete(self, job: ScanJob):
        """Emit completion via WebSocket"""
        if not self.socketio:
            return
        
        try:
            result_summary = None
            if job.result:
                result_summary = job.result.to_dict()
            
            self.socketio.emit('scan_complete', {
                'scan_id': job.id,
                'status': job.status.value,
                'duration': job.get_duration_str(),
                'findings_count': len(job.result.findings) if job.result else 0,
                'result': result_summary
            }, namespace='/scans')
        except Exception as e:
            logger.debug(f"WebSocket emit error: {e}")
    
    def cancel_scan(self, scan_id: str) -> bool:
        """Cancel a running scan"""
        with self._lock:
            job = self._scans.get(scan_id)
            if not job:
                return False
            
            if job.status not in (ScanStatus.RUNNING, ScanStatus.QUEUED):
                return False
            
            job.status = ScanStatus.CANCELLED
            job.completed_at = datetime.utcnow()
            
            if job.process:
                self._kill_process(job.process)
        
        logger.info(f"Scan {scan_id} cancelled")
        self._emit_progress(job)
        return True
    
    def get_scan(self, scan_id: str) -> Optional[ScanJob]:
        """Get scan by ID"""
        with self._lock:
            return self._scans.get(scan_id)
    
    def get_scan_output(self, scan_id: str, timeout: float = 0.1) -> Optional[str]:
        """Get next output line from running scan"""
        with self._lock:
            job = self._scans.get(scan_id)
            if not job:
                return None
        
        try:
            return job.output_queue.get(timeout=timeout)
        except queue.Empty:
            return ''
    
    def get_stats(self) -> Dict[str, Any]:
        """Get engine statistics"""
        with self._lock:
            scans = list(self._scans.values())
        
        return {
            'total_scans': len(scans),
            'active_scans': len([s for s in scans if s.status == ScanStatus.RUNNING]),
            'queued_scans': len([s for s in scans if s.status == ScanStatus.QUEUED]),
            'completed_scans': len([s for s in scans if s.status == ScanStatus.COMPLETED]),
            'failed_scans': len([s for s in scans if s.status in (ScanStatus.FAILED, ScanStatus.TIMEOUT)]),
            'max_workers': self.max_workers,
            'active_pids': len(self._active_pids)
        }
    
    def cleanup_stale_scans(self):
        """Mark stale running scans as failed (for recovery after restart)"""
        with self._lock:
            for scan_id, job in self._scans.items():
                if job.status == ScanStatus.RUNNING and job.process is None:
                    job.status = ScanStatus.FAILED
                    job.error_buffer.append("Scan interrupted by server restart")
                    job.completed_at = datetime.utcnow()
    
    def shutdown(self, wait: bool = True):
        """Gracefully shutdown"""
        if self._shutdown:
            return
        
        self._shutdown = True
        logger.info("Shutting down ScanEngineV3...")
        
        # Cancel all active scans
        with self._lock:
            for scan_id in list(self._scans.keys()):
                self.cancel_scan(scan_id)
        
        # Cleanup processes
        self._cleanup_all()
        
        # Shutdown executor
        self.executor.shutdown(wait=wait, cancel_futures=True)
        
        logger.info("ScanEngineV3 shutdown complete")


# Global instance
_engine_v3: Optional[ScanEngineV3] = None


def get_engine_v3(socketio=None, app=None) -> ScanEngineV3:
    """Get or create global engine instance"""
    global _engine_v3
    if _engine_v3 is None or _engine_v3._shutdown:
        _engine_v3 = ScanEngineV3(max_workers=3, socketio=socketio, app=app)
    elif socketio and _engine_v3.socketio is None:
        _engine_v3.socketio = socketio
    elif app and _engine_v3.app is None:
        _engine_v3.app = app
    return _engine_v3


def init_engine_v3(app, socketio=None, **kwargs) -> ScanEngineV3:
    """Initialize engine with Flask app"""
    global _engine_v3
    _engine_v3 = ScanEngineV3(socketio=socketio, app=app, **kwargs)
    return _engine_v3
