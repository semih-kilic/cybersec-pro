#!/usr/bin/env python3
"""
🔄 CyberSec Pro - Celery Task Queue
Background task processing for security scans
"""

from celery import Celery
from celery.signals import task_prerun, task_postrun, task_failure
import subprocess
import json
import os
import time
from datetime import datetime

# Redis configuration
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

# Initialize Celery
celery_app = Celery(
    'cybersec_tasks',
    broker=REDIS_URL,
    backend=REDIS_URL,
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Task execution limits
    task_time_limit=3600,  # 1 hour max per task
    task_soft_time_limit=3300,  # Soft limit 55 min
    
    # Worker settings
    worker_prefetch_multiplier=1,  # One task at a time per worker
    worker_max_tasks_per_child=50,  # Restart after 50 tasks
    
    # Result backend settings
    result_expires=86400,  # Results expire after 24 hours
    
    # Rate limiting (prevent server overload)
    task_default_rate_limit='10/m',  # 10 tasks per minute default
    
    # Retry settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

# Task queues for priority
celery_app.conf.task_routes = {
    'cybersec_tasks.run_scan': {'queue': 'scans'},
    'cybersec_tasks.run_multi_scan': {'queue': 'scans'},
    'cybersec_tasks.quick_scan': {'queue': 'quick'},
    'cybersec_tasks.generate_report': {'queue': 'reports'},
}


# ================================
# SCAN TASKS
# ================================

@celery_app.task(bind=True, name='cybersec_tasks.run_scan', max_retries=2)
def run_scan(self, scan_id: str, tool_name: str, target: str, parameters: dict):
    """
    Execute a single security scan in background
    """
    try:
        print(f"🔍 Starting scan {scan_id}: {tool_name} -> {target}")
        
        # Update scan status to running
        update_scan_status(scan_id, 'running')
        
        # Build and execute command
        result = execute_tool(tool_name, target, parameters)
        
        # Update scan with results
        update_scan_results(scan_id, result)
        
        print(f"✅ Scan {scan_id} completed")
        return {'scan_id': scan_id, 'status': 'completed', 'result': result}
        
    except Exception as e:
        print(f"❌ Scan {scan_id} failed: {str(e)}")
        update_scan_status(scan_id, 'failed', error=str(e))
        raise self.retry(exc=e, countdown=60)


@celery_app.task(bind=True, name='cybersec_tasks.run_multi_scan')
def run_multi_scan(self, multi_scan_id: str, tools: list, target: str, parameters: dict):
    """
    Execute multiple tools on a single target (parallel execution)
    """
    try:
        print(f"🔄 Starting multi-scan {multi_scan_id} with {len(tools)} tools")
        
        results = {}
        for tool in tools:
            # Queue individual scans
            task = run_scan.delay(
                f"{multi_scan_id}-{tool}",
                tool,
                target,
                parameters.get(tool, {})
            )
            results[tool] = task.id
        
        return {
            'multi_scan_id': multi_scan_id,
            'tasks': results,
            'status': 'queued'
        }
        
    except Exception as e:
        print(f"❌ Multi-scan {multi_scan_id} failed: {str(e)}")
        raise


@celery_app.task(name='cybersec_tasks.quick_scan', rate_limit='30/m')
def quick_scan(target: str, scan_type: str = 'basic'):
    """
    Quick reconnaissance scan (higher rate limit)
    """
    quick_tools = {
        'basic': ['ping', 'whois'],
        'ports': ['nmap -F'],
        'web': ['whatweb', 'curl -I'],
    }
    
    tools = quick_tools.get(scan_type, quick_tools['basic'])
    results = {}
    
    for tool in tools:
        try:
            result = subprocess.run(
                f"{tool} {target}",
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            results[tool] = result.stdout
        except Exception as e:
            results[tool] = f"Error: {str(e)}"
    
    return results


@celery_app.task(name='cybersec_tasks.generate_report')
def generate_report(scan_ids: list, format: str = 'pdf'):
    """
    Generate consolidated report from multiple scans
    """
    print(f"📄 Generating {format.upper()} report for {len(scan_ids)} scans")
    
    # TODO: Implement report generation
    return {
        'status': 'completed',
        'format': format,
        'scan_count': len(scan_ids)
    }


# ================================
# HELPER FUNCTIONS
# ================================

def execute_tool(tool_name: str, target: str, parameters: dict) -> dict:
    """Execute security tool and return results"""
    # Tool command mapping
    tool_commands = {
        'nmap': f"nmap {parameters.get('flags', '-sV')} {target}",
        'nikto': f"nikto -h {target}",
        'dirb': f"dirb {target}",
        'whois': f"whois {target}",
        'dig': f"dig {target}",
        'whatweb': f"whatweb {target}",
        'wpscan': f"wpscan --url {target}",
    }
    
    command = tool_commands.get(tool_name)
    if not command:
        return {'error': f'Unknown tool: {tool_name}'}
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=parameters.get('timeout', 300)
        )
        
        return {
            'stdout': result.stdout,
            'stderr': result.stderr,
            'return_code': result.returncode,
            'executed_at': datetime.utcnow().isoformat()
        }
    except subprocess.TimeoutExpired:
        return {'error': 'Scan timeout exceeded'}
    except Exception as e:
        return {'error': str(e)}


def update_scan_status(scan_id: str, status: str, error: str = None):
    """Update scan status in database (placeholder)"""
    # TODO: Integrate with SQLAlchemy models
    print(f"📝 Scan {scan_id} status: {status}")


def update_scan_results(scan_id: str, results: dict):
    """Update scan results in database (placeholder)"""
    # TODO: Integrate with SQLAlchemy models
    print(f"📝 Scan {scan_id} results saved")


# ================================
# SIGNAL HANDLERS
# ================================

@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, **kwargs):
    """Called before task execution"""
    print(f"🚀 Task {task_id} starting: {task.name}")


@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, retval=None, state=None, **kwargs):
    """Called after task execution"""
    print(f"✅ Task {task_id} finished: {state}")


@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, **kwargs):
    """Called when task fails"""
    print(f"❌ Task {task_id} failed: {exception}")


# ================================
# CELERY BEAT SCHEDULE (Periodic Tasks)
# ================================

celery_app.conf.beat_schedule = {
    # Clean up old scan results every hour
    'cleanup-old-scans': {
        'task': 'cybersec_tasks.cleanup_old_scans',
        'schedule': 3600.0,
    },
    # Health check every 5 minutes
    'health-check': {
        'task': 'cybersec_tasks.health_check',
        'schedule': 300.0,
    },
}


@celery_app.task(name='cybersec_tasks.cleanup_old_scans')
def cleanup_old_scans():
    """Clean up scan results older than 30 days"""
    print("🧹 Running cleanup task...")
    # TODO: Implement cleanup logic
    return {'status': 'completed'}


@celery_app.task(name='cybersec_tasks.health_check')
def health_check():
    """Worker health check"""
    return {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'hostname': os.uname().nodename
    }


if __name__ == '__main__':
    celery_app.start()
