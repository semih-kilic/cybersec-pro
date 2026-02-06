#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - Advanced Scan Engine
ThreadPoolExecutor-based scan execution with WebSocket real-time updates

Author: Semih Kılıç
Version: 2.0.0 (FAZ 2 - Production Ready)

Features:
- ThreadPoolExecutor for robust thread management
- Thread-safe scan registry with locks
- Configurable timeouts per tool
- WebSocket integration for real-time progress
- Automatic retry and crash recovery
- Memory-efficient output streaming
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
from datetime import datetime
from typing import Optional, Dict, Any, Callable, List
from concurrent.futures import ThreadPoolExecutor, Future
from dataclasses import dataclass, field
from enum import Enum

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('ScanEngine')


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
class ScanJob:
    """Represents a scan job with all metadata"""
    id: str
    tool_id: str
    target: str
    command: List[str]
    parameters: Dict[str, Any]
    status: ScanStatus = ScanStatus.PENDING
    output: str = ''
    error: str = ''
    progress: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    exit_code: Optional[int] = None
    user_id: Optional[str] = None
    organization_id: Optional[str] = None
    
    # Runtime tracking
    process: Optional[subprocess.Popen] = None
    future: Optional[Future] = None
    output_queue: queue.Queue = field(default_factory=queue.Queue)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'tool_id': self.tool_id,
            'target': self.target,
            'command': ' '.join(self.command),
            'parameters': self.parameters,
            'status': self.status.value,
            'output': self.output,
            'error': self.error,
            'progress': self.progress,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat(),
            'exit_code': self.exit_code
        }


# Tool timeout configurations (in seconds)
TOOL_TIMEOUTS = {
    # Quick tools (30 seconds)
    'whois': 30,
    'dig': 30,
    'host': 30,
    
    # Standard tools (2 minutes)
    'nmap-quick': 120,
    'sslscan': 120,
    'whatweb': 120,
    'dnsrecon': 120,
    
    # Medium tools (5 minutes)
    'nmap': 300,
    'nikto': 300,
    'gobuster': 300,
    'dirb': 300,
    'theHarvester': 300,
    'wpscan': 300,
    
    # Intensive tools (15 minutes)
    'masscan': 900,
    'sqlmap': 900,
    'hydra': 900,
    'enum4linux': 900,
    
    # Default timeout
    'default': 300
}


class ScanEngine:
    """
    Production-ready scan execution engine using ThreadPoolExecutor
    
    Provides:
    - Thread-safe scan management
    - Configurable worker pool
    - Real-time output streaming via WebSocket
    - Timeout handling and crash recovery
    - Graceful shutdown
    """
    
    def __init__(
        self,
        max_workers: int = 4,
        use_docker: bool = False,
        docker_image: str = 'kalilinux/kali-rolling',
        socketio=None
    ):
        """
        Initialize scan engine
        
        Args:
            max_workers: Maximum concurrent scans
            use_docker: Run commands in Docker container
            docker_image: Docker image to use
            socketio: Flask-SocketIO instance for real-time updates
        """
        self.max_workers = max_workers
        self.use_docker = use_docker
        self.docker_image = docker_image
        self.socketio = socketio
        
        # Thread pool for scan execution
        self.executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix='ScanWorker'
        )
        
        # Thread-safe scan registry
        self._scans: Dict[str, ScanJob] = {}
        self._lock = threading.RLock()
        
        # Shutdown flag
        self._shutdown = False
        
        # Register cleanup on exit
        atexit.register(self.shutdown)
        
        logger.info(f"ScanEngine initialized with {max_workers} workers")
    
    def get_timeout(self, tool_id: str) -> int:
        """Get timeout for a specific tool"""
        return TOOL_TIMEOUTS.get(tool_id, TOOL_TIMEOUTS['default'])
    
    def submit_scan(
        self,
        scan_id: str,
        tool_id: str,
        target: str,
        command: List[str],
        parameters: Dict[str, Any],
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        callback: Optional[Callable] = None,
        completion_callback: Optional[Callable] = None
    ) -> ScanJob:
        """
        Submit a new scan for execution
        
        Args:
            scan_id: Unique scan identifier
            tool_id: Tool being used
            target: Target to scan
            command: Full command to execute
            parameters: Tool parameters
            user_id: User who initiated scan
            organization_id: Organization ID
            callback: Called for each output line
            completion_callback: Called when scan completes
        
        Returns:
            ScanJob instance
        """
        if self._shutdown:
            raise RuntimeError("ScanEngine is shutting down")
        
        # Create scan job
        job = ScanJob(
            id=scan_id,
            tool_id=tool_id,
            target=target,
            command=command,
            parameters=parameters,
            user_id=user_id,
            organization_id=organization_id,
            status=ScanStatus.QUEUED
        )
        
        # Register scan
        with self._lock:
            self._scans[scan_id] = job
        
        # Submit to thread pool
        future = self.executor.submit(
            self._execute_scan,
            job,
            callback,
            completion_callback
        )
        job.future = future
        
        # Handle exceptions from thread
        def handle_exception(f):
            try:
                f.result()
            except Exception as e:
                logger.error(f"Scan {scan_id} crashed: {e}")
                with self._lock:
                    if scan_id in self._scans:
                        self._scans[scan_id].status = ScanStatus.FAILED
                        self._scans[scan_id].error = str(e)
        
        future.add_done_callback(handle_exception)
        
        logger.info(f"Scan {scan_id} submitted for {tool_id} on {target}")
        
        # Emit WebSocket event
        self._emit_progress(job)
        
        return job
    
    def _execute_scan(
        self,
        job: ScanJob,
        callback: Optional[Callable],
        completion_callback: Optional[Callable]
    ):
        """Execute scan in worker thread"""
        scan_id = job.id
        timeout = self.get_timeout(job.tool_id)
        
        try:
            # Update status
            with self._lock:
                job.status = ScanStatus.RUNNING
                job.started_at = datetime.utcnow()
            
            self._emit_progress(job)
            
            # Build command
            cmd = job.command
            if self.use_docker:
                cmd = [
                    'docker', 'run', '--rm',
                    '--network=host',
                    '--cpus=0.5',
                    '--memory=512m',
                    self.docker_image
                ] + cmd
            
            logger.info(f"Executing: {' '.join(cmd)}")
            
            # Start process
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                preexec_fn=os.setsid if os.name != 'nt' else None
            )
            
            with self._lock:
                job.process = process
            
            # Stream output with timeout
            output_lines = []
            start_time = time.time()
            
            try:
                for line in iter(process.stdout.readline, ''):
                    # Check timeout
                    elapsed = time.time() - start_time
                    if elapsed > timeout:
                        logger.warning(f"Scan {scan_id} timed out after {timeout}s")
                        self._kill_process(process)
                        output_lines.append(f"\n[TIMEOUT] Scan exceeded {timeout}s limit\n")
                        with self._lock:
                            job.status = ScanStatus.TIMEOUT
                        break
                    
                    # Check shutdown
                    if self._shutdown:
                        self._kill_process(process)
                        break
                    
                    # Store and stream output
                    output_lines.append(line)
                    job.output_queue.put(line)
                    
                    # Calculate progress (rough estimate)
                    progress = min(95, int((elapsed / timeout) * 100))
                    job.progress = progress
                    
                    # Callback for each line
                    if callback:
                        try:
                            callback(scan_id, line)
                        except Exception as e:
                            logger.warning(f"Callback error: {e}")
                    
                    # Emit real-time update (throttled)
                    if len(output_lines) % 10 == 0:
                        self._emit_output(job, line)
                
                # Wait for process to complete
                exit_code = process.wait(timeout=10)
                
            except subprocess.TimeoutExpired:
                self._kill_process(process)
                exit_code = -1
            
            # Finalize
            final_output = ''.join(output_lines)
            
            with self._lock:
                job.output = final_output
                job.exit_code = exit_code
                job.completed_at = datetime.utcnow()
                job.progress = 100
                
                if job.status == ScanStatus.RUNNING:
                    job.status = ScanStatus.COMPLETED if exit_code == 0 else ScanStatus.FAILED
            
            job.output_queue.put(None)  # Signal end
            
            logger.info(f"Scan {scan_id} completed with exit code {exit_code}")
            
        except Exception as e:
            logger.error(f"Scan {scan_id} error: {e}", exc_info=True)
            
            with self._lock:
                job.status = ScanStatus.FAILED
                job.error = str(e)
                job.completed_at = datetime.utcnow()
        
        finally:
            # Always call completion callback
            if completion_callback:
                try:
                    completion_callback(
                        scan_id,
                        job.status.value,
                        job.output,
                        job.exit_code or -1
                    )
                except Exception as e:
                    logger.error(f"Completion callback error: {e}")
            
            # Emit final status
            self._emit_progress(job)
            
            # Clean up process reference
            with self._lock:
                job.process = None
    
    def _kill_process(self, process: subprocess.Popen):
        """Kill a process and all children"""
        try:
            if os.name != 'nt':
                # Kill process group on Unix
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                time.sleep(1)
                try:
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                except OSError:
                    pass
            else:
                process.terminate()
                process.kill()
        except Exception as e:
            logger.warning(f"Error killing process: {e}")
    
    def _emit_progress(self, job: ScanJob):
        """Emit scan progress via WebSocket"""
        if self.socketio:
            try:
                self.socketio.emit('scan_progress', {
                    'scan_id': job.id,
                    'status': job.status.value,
                    'progress': job.progress,
                    'started_at': job.started_at.isoformat() if job.started_at else None
                }, namespace='/scans')
            except Exception as e:
                logger.debug(f"WebSocket emit error: {e}")
    
    def _emit_output(self, job: ScanJob, line: str):
        """Emit scan output line via WebSocket"""
        if self.socketio:
            try:
                self.socketio.emit('scan_output', {
                    'scan_id': job.id,
                    'line': line
                }, namespace='/scans')
            except Exception as e:
                logger.debug(f"WebSocket emit error: {e}")
    
    def get_scan(self, scan_id: str) -> Optional[ScanJob]:
        """Get scan by ID"""
        with self._lock:
            return self._scans.get(scan_id)
    
    def get_scan_output(self, scan_id: str, timeout: float = 0.1) -> Optional[str]:
        """Get next line of output from a running scan"""
        with self._lock:
            job = self._scans.get(scan_id)
            if not job:
                return None
        
        try:
            return job.output_queue.get(timeout=timeout)
        except queue.Empty:
            return ''
    
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
            
            if job.future:
                job.future.cancel()
        
        logger.info(f"Scan {scan_id} cancelled")
        self._emit_progress(job)
        return True
    
    def get_active_scans(self) -> List[ScanJob]:
        """Get all active scans"""
        with self._lock:
            return [
                job for job in self._scans.values()
                if job.status in (ScanStatus.RUNNING, ScanStatus.QUEUED)
            ]
    
    def get_all_scans(self) -> List[ScanJob]:
        """Get all scans"""
        with self._lock:
            return list(self._scans.values())
    
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
            'max_workers': self.max_workers
        }
    
    def cleanup_old_scans(self, max_age_hours: int = 24):
        """Remove old completed scans from memory"""
        cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
        
        with self._lock:
            old_ids = [
                scan_id for scan_id, job in self._scans.items()
                if job.completed_at and job.completed_at < cutoff
            ]
            
            for scan_id in old_ids:
                del self._scans[scan_id]
        
        if old_ids:
            logger.info(f"Cleaned up {len(old_ids)} old scans")
    
    def shutdown(self, wait: bool = True):
        """Gracefully shutdown the engine"""
        if self._shutdown:
            return
        
        self._shutdown = True
        logger.info("Shutting down ScanEngine...")
        
        # Cancel all running scans
        for job in self.get_active_scans():
            self.cancel_scan(job.id)
        
        # Shutdown executor
        self.executor.shutdown(wait=wait, cancel_futures=True)
        
        logger.info("ScanEngine shutdown complete")


# Import timedelta for cleanup
from datetime import timedelta

# Global engine instance
_engine: Optional[ScanEngine] = None


def get_engine(socketio=None) -> ScanEngine:
    """Get or create global scan engine instance"""
    global _engine
    if _engine is None:
        _engine = ScanEngine(
            max_workers=4,
            use_docker=False,  # Set True in production
            socketio=socketio
        )
    elif socketio and _engine.socketio is None:
        _engine.socketio = socketio
    return _engine


def init_engine(app, socketio=None, **kwargs) -> ScanEngine:
    """Initialize scan engine with Flask app context"""
    global _engine
    _engine = ScanEngine(socketio=socketio, **kwargs)
    return _engine
