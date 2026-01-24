"""
Tool Execution Engine
Handles running Kali Linux tools with real-time output
"""
import subprocess
import threading
import queue
import os
import signal
from datetime import datetime
from models import db, Scan
from flask import current_app


class ToolExecutor:
    """Execute security tools and capture output"""
    
    def __init__(self):
        self.running_processes = {}  # {scan_id: process}
        
    def execute_tool(self, scan_id, command, target, user_id):
        """
        Execute a tool command asynchronously
        
        Args:
            scan_id: Database scan ID
            command: Tool command to run
            target: Target IP/domain/URL
            user_id: User executing the scan
        """
        # Build full command
        if "{target}" in command:
            full_command = command.replace("{target}", target)
        else:
            full_command = f"{command} {target}"

        # Apply safe defaults for long-running web tools
        if "gobuster dir" in full_command and "--timeout" not in full_command:
            full_command = f"{full_command} --timeout 20s -t 5"
        if "nikto -h" in full_command and "-maxtime" not in full_command:
            full_command = f"{full_command} -maxtime 2m"
        
        # Start execution in background thread
        thread = threading.Thread(
            target=self._run_command,
            args=(scan_id, full_command),
            daemon=True
        )
        thread.start()
        
        return {"status": "started", "scan_id": scan_id}
    
    def _run_command(self, scan_id, command):
        """Run command and update scan in database"""
        from app import app
        
        with app.app_context():
            scan = Scan.query.get(scan_id)
            if not scan:
                return
            
            try:
                # Update scan status
                scan.status = 'running'
                scan.started_at = datetime.utcnow()
                scan.command = command
                db.session.commit()
                
                # Execute command
                process = subprocess.Popen(
                    command,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )
                
                # Store process for potential cancellation
                self.running_processes[scan_id] = process
                
                # Capture output
                output_lines = []
                error_lines = []
                
                # Read stdout
                for line in process.stdout:
                    output_lines.append(line)
                    # Update progress periodically
                    if len(output_lines) % 10 == 0:
                        scan.output = ''.join(output_lines)
                        scan.progress = min(90, len(output_lines) * 2)
                        db.session.commit()
                
                # Read stderr
                for line in process.stderr:
                    error_lines.append(line)
                
                # Wait for completion
                process.wait()
                
                # Update final status
                scan.status = 'completed' if process.returncode == 0 else 'failed'
                scan.output = ''.join(output_lines)
                scan.error = ''.join(error_lines) if error_lines else None
                scan.completed_at = datetime.utcnow()
                scan.progress = 100
                
                # Parse output for vulnerabilities (basic example)
                if scan.status == 'completed':
                    self._parse_vulnerabilities(scan)
                
                db.session.commit()
                
                # Cleanup
                if scan_id in self.running_processes:
                    del self.running_processes[scan_id]
                
            except Exception as e:
                scan.status = 'failed'
                scan.error = str(e)
                scan.completed_at = datetime.utcnow()
                db.session.commit()
    
    def _parse_vulnerabilities(self, scan):
        """Parse scan output and create vulnerability records"""
        from models import Vulnerability, Target
        
        # Example: Parse Nmap output for open ports
        if 'nmap' in scan.command.lower() and scan.target_id:
            output = scan.output or ''
            
            # Simple parsing - look for open ports
            for line in output.split('\n'):
                if '/tcp' in line and 'open' in line:
                    parts = line.split()
                    if len(parts) >= 3:
                        port_info = parts[0].split('/')[0]
                        service = parts[2] if len(parts) > 2 else 'unknown'
                        
                        try:
                            port = int(port_info)
                            
                            vuln = Vulnerability(
                                target_id=scan.target_id,
                                scan_id=scan.id,
                                name=f"Open Port: {port}",
                                severity='info',
                                description=f"Port {port} is open running {service}",
                                port=port,
                                service=service,
                                remediation="Review if this port should be exposed"
                            )
                            db.session.add(vuln)
                        except ValueError:
                            pass
            
            db.session.commit()
    
    def cancel_scan(self, scan_id):
        """Cancel a running scan"""
        if scan_id in self.running_processes:
            process = self.running_processes[scan_id]
            try:
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                del self.running_processes[scan_id]
                
                from app import app
                with app.app_context():
                    scan = Scan.query.get(scan_id)
                    if scan:
                        scan.status = 'cancelled'
                        scan.completed_at = datetime.utcnow()
                        db.session.commit()
                
                return True
            except Exception as e:
                print(f"Error cancelling scan: {e}")
                return False
        return False
    
    def get_running_scans(self):
        """Get list of currently running scan IDs"""
        return list(self.running_processes.keys())


# Global executor instance
executor = ToolExecutor()
