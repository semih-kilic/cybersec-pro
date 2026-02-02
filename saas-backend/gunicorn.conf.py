"""
🚀 CyberSec Pro - Gunicorn Production Configuration
Optimized for single server deployment (2 CPU, 13GB RAM)
"""

import multiprocessing
import os

# Server Socket
bind = "127.0.0.1:5001"
backlog = 2048

# Worker Processes
# Formula: 2 * CPU cores + 1 = 2 * 2 + 1 = 5 workers
workers = int(os.environ.get('GUNICORN_WORKERS', 5))

# Worker class - gevent for async handling
worker_class = 'gevent'

# Connections per worker
worker_connections = 100

# Threads per worker (for gevent, this is greenlets)
threads = 2

# Max requests before worker restart (prevents memory leaks)
max_requests = 1000
max_requests_jitter = 50

# Timeout settings
timeout = 120  # Longer for scan operations
graceful_timeout = 30
keepalive = 5

# Process naming
proc_name = 'cybersec-pro-api'

# Server mechanics
daemon = False
pidfile = '/tmp/gunicorn-cybersec.pid'
user = None
group = None
tmp_upload_dir = None

# Logging
errorlog = '/home/cybersec/cybersec-pro/logs/gunicorn-error.log'
accesslog = '/home/cybersec/cybersec-pro/logs/gunicorn-access.log'
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Preload app for faster worker spawning
preload_app = True

# Environment
raw_env = [
    'FLASK_ENV=production',
]

def on_starting(server):
    """Called just before the master process is initialized."""
    print("🚀 CyberSec Pro API starting...")
    print(f"   Workers: {workers}")
    print(f"   Worker class: {worker_class}")
    print(f"   Connections per worker: {worker_connections}")

def on_exit(server):
    """Called just before exiting Gunicorn."""
    print("👋 CyberSec Pro API shutting down...")

def worker_int(worker):
    """Called when a worker receives SIGINT or SIGQUIT."""
    print(f"Worker {worker.pid} interrupted")

def worker_abort(worker):
    """Called when a worker receives SIGABRT."""
    print(f"Worker {worker.pid} aborted")

# ================================
# CAPACITY CALCULATION
# ================================
# 5 workers × 100 connections × 2 threads = 1000 theoretical max
# Realistic with scan operations: 30-50 concurrent scans
# API requests (dashboard, etc.): 200-500 concurrent
