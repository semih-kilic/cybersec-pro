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
    'nmap': 300,
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
        
        # Register cleanup handlers
        atexit.register(self._cleanup_all)
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
        
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
    
    def get_timeout(self, tool_name: str) -> int:
        """Get timeout for a tool"""
        return TOOL_TIMEOUTS.get(tool_name.lower(), TOOL_TIMEOUTS['default'])
    
    def build_nmap_command(self, target: str, params: Dict[str, Any]) -> List[str]:
        """Build proper nmap command with XML output"""
        cmd = ['nmap']
        
        # Always output XML to stdout for parsing
        cmd.extend(['-oX', '-'])
        
        # Timing (default T3)
        timing = params.get('timing', 'T3')
        if not timing.startswith('T'):
            timing = f'T{timing}'
        cmd.append(f'-{timing}')
        
        # Port range
        ports = params.get('ports', '1-1000')
        if ports:
            cmd.extend(['-p', str(ports)])
        
        # Service version detection
        if params.get('service_version', True):
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
            cmd.append(f'-s{scan_type}')
        
        # Target goes last
        cmd.append(target)
        
        return cmd
    
    def build_command(self, tool_name: str, target: str, params: Dict[str, Any]) -> List[str]:
        """Build command for any tool"""
        tool_lower = tool_name.lower()
        
        if tool_lower == 'nmap':
            return self.build_nmap_command(target, params)
        elif tool_lower == 'whois':
            return ['whois', target]
        elif tool_lower == 'dig':
            record_type = params.get('record_type', 'A')
            cmd = ['dig', target, record_type]
            if params.get('short', False):
                cmd.append('+short')
            return cmd
        elif tool_lower == 'host':
            return ['host', target]
        elif tool_lower == 'nslookup':
            return ['nslookup', target]
        elif tool_lower == 'sslscan':
            return ['sslscan', target]
        elif tool_lower == 'whatweb':
            aggression = params.get('aggression', '1')
            return ['whatweb', f'-a{aggression}', target]
        elif tool_lower == 'nikto':
            port = params.get('port', '80')
            cmd = ['nikto', '-h', target, '-p', str(port)]
            if params.get('ssl', False):
                cmd.append('-ssl')
            return cmd
        elif tool_lower == 'gobuster':
            mode = params.get('mode', 'dir')
            wordlist = params.get('wordlist', '/usr/share/wordlists/dirb/common.txt')
            return ['gobuster', mode, '-u', target, '-w', wordlist]
        else:
            # Generic: tool target
            return [tool_name, target]
    
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
        timeout = self.get_timeout(job.tool_name)
        
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
            
            # Parse findings
            findings = []
            if job.tool_name.lower() == 'nmap' and raw_output:
                findings = NmapParser.parse_xml(raw_output, job.target)
                if not findings:
                    findings = NmapParser.parse_text(raw_output, job.target)
            
            # Create result
            result = ScanResult(
                scan_id=scan_id,
                status=job.status if job.status == ScanStatus.TIMEOUT else (
                    ScanStatus.COMPLETED if exit_code == 0 else ScanStatus.FAILED
                ),
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
    if _engine_v3 is None:
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
