#!/usr/bin/env python3
"""
CyberSec Pro - Ultimate Service Manager & Monitor
Auto-restart, monitoring, alerting - All in one
"""

import os
import socket
import sys
import time
import json
import signal
import subprocess
import threading
import requests
import smtplib
import ssl
import fcntl
import shlex
import random
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from pathlib import Path
import logging
from urllib.parse import urlparse
import shutil
from requests.adapters import HTTPAdapter
try:
    from urllib3.util import Retry
except Exception:
    Retry = None

os.umask(0o077)

_PGREP_PATH = shutil.which('pgrep')
_PKILL_PATH = shutil.which('pkill')
_HTTP_SESSION = requests.Session()
_HTTP_SESSION.headers.update({'User-Agent': 'CyberSecMonitor/1.0'})

def _log_tooling_status() -> None:
    tools = ['pgrep', 'pkill', 'curl', 'python3', 'npm', 'cloudflared']
    for tool in tools:
        if shutil.which(tool):
            logger.info(f"Tool available: {tool}")
        else:
            logger.warning(f"Tool missing: {tool}")

def _load_runtime_config() -> dict:
    skip_external = _bool_env('CYBERSEC_SKIP_EXTERNAL', False)
    log_ok = _bool_env('CYBERSEC_LOG_OK', True)
    verify_tls = _bool_env('CYBERSEC_HTTP_VERIFY', True)
    raw_skip = os.getenv('CYBERSEC_SKIP_SERVICES', '')
    skip_services = {s.strip().lower() for s in raw_skip.split(',') if s.strip()}
    jitter_max = _float_env('CYBERSEC_JITTER_MAX', 0.0, 0.0)
    http_retries = _int_env('CYBERSEC_HTTP_RETRIES', 0, 0)
    http_backoff = _float_env('CYBERSEC_HTTP_BACKOFF', 0.2, 0.0)
    http_pool = _int_env('CYBERSEC_HTTP_POOL', 10, 1)

    interval_override = None
    raw_interval = os.getenv('CYBERSEC_CHECK_INTERVAL')
    if raw_interval is not None:
        try:
            interval_override = int(raw_interval)
        except Exception:
            interval_override = None
        if interval_override is not None and interval_override < 5:
            interval_override = 5

    timeout_override = os.getenv('CYBERSEC_HTTP_TIMEOUT')
    if timeout_override is not None:
        try:
            timeout_value = float(timeout_override)
        except Exception:
            timeout_value = CONFIG['http_timeout']
        if timeout_value <= 0:
            timeout_value = CONFIG['http_timeout']
    else:
        timeout_value = CONFIG['http_timeout']

    return {
        'skip_external': skip_external,
        'log_ok': log_ok,
        'verify_tls': verify_tls,
        'skip_services': skip_services,
        'interval': interval_override,
        'http_timeout': timeout_value,
        'jitter_max': jitter_max,
        'http_retries': http_retries,
        'http_backoff': http_backoff,
        'http_pool': http_pool
    }

# ============================================================================
# CONFIGURATION
# ============================================================================

_raw_interval = os.getenv('CYBERSEC_CHECK_INTERVAL', '30')
try:
    _interval = int(_raw_interval)
except Exception:
    _interval = 30
if _interval < 5:
    _interval = 5

def _int_env(name: str, default: int, min_value: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except Exception:
        return default
    return value if value >= min_value else min_value

def _float_env(name: str, default: float, min_value: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = float(raw)
    except Exception:
        return default
    return value if value >= min_value else min_value

CONFIG = {
    'smtp': {
        'server': os.getenv('CYBERSEC_SMTP_SERVER', ''),
        'port': int(os.getenv('CYBERSEC_SMTP_PORT', '465')),
        'email': os.getenv('CYBERSEC_SMTP_EMAIL', ''),
        'password': os.getenv('CYBERSEC_SMTP_PASSWORD', ''),
        'from_name': os.getenv('CYBERSEC_SMTP_FROM_NAME', 'CyberSec Monitor')
    },
    'alert_email': os.getenv('CYBERSEC_ALERT_EMAIL', ''),
    'check_interval': _interval,  # seconds
    'restart_cooldown': _int_env('CYBERSEC_RESTART_COOLDOWN', 30, 5),  # seconds between restart attempts
    'max_restart_attempts': _int_env('CYBERSEC_MAX_RESTART_ATTEMPTS', 8, 1),
    'failure_threshold': _int_env('CYBERSEC_FAILURE_THRESHOLD', 4, 1),  # failures before alerting
    'alert_cooldown': _int_env('CYBERSEC_ALERT_COOLDOWN', 1200, 60),   # seconds between alerts per service
    'webhook_url': os.getenv('CYBERSEC_ALERT_WEBHOOK', ''),
    'log_file': '/var/log/cybersec/monitor.log',
    'state_file': '/var/lib/cybersec/monitor-state.json',
    'http_timeout': int(os.getenv('CYBERSEC_HTTP_TIMEOUT', '10'))
}

CHECK_INTERVAL = CONFIG['check_interval']

def _bool_env(name: str, default: bool = True) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}

def _ensure_parent_dir(path: str, mode: int = 0o700) -> None:
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        os.chmod(os.path.dirname(path), mode)
    except Exception:
        pass

# Services to manage
SERVICES = {
    'cloudflared': {
        'name': 'Cloudflare Tunnel',
        'type': 'process',
        'check_cmd': 'pgrep -f "cloudflared tunnel"',
        'start_cmd': 'cloudflared tunnel run 3d58ef29-b086-46ae-a21c-b68ddd11725f',
        'start_dir': '/home/sam',
        'critical': True,
        'auto_restart': True
    },
    'sales_backend': {
        'name': 'Sales API (5002)',
        'type': 'http',
        'check_url': 'http://127.0.0.1:5002/api/health',
        'check_cmd': 'pgrep -f "gunicorn.*5002"',
        'start_cmd': 'source venv/bin/activate && gunicorn -w 2 -b 127.0.0.1:5002 app:app --daemon --pid /tmp/sales-backend.pid',
        'start_dir': '/home/sam/APPS/cybersec-sales/backend',
        'critical': True,
        'auto_restart': True
    },
    'main_backend': {
        'name': 'Main App API (5001)',
        'type': 'http',
        'check_url': 'http://127.0.0.1:5001/api/health',
        'check_cmd': 'pgrep -f "cybersec-kali/backend/app.py"',
        'start_cmd': 'source venv/bin/activate && python3 app.py &',
        'start_dir': '/home/sam/APPS/cybersec-kali/backend',
        'critical': True,
        'auto_restart': True
    },
    'frontend_server': {
        'name': 'Frontend Server (8080)',
        'type': 'http',
        'check_url': 'http://127.0.0.1:8080',
        'check_cmd': 'pgrep -f "python.*http.server.*8080"',
        'start_cmd': 'python3 -m http.server 8080 &',
        'start_dir': '/home/sam/APPS/cybersec-sales/frontend',
        'critical': True,
        'auto_restart': True
    },
    'cybersec_local': {
        'name': 'CyberSec Local (5173)',
        'type': 'http',
        'check_url': 'http://127.0.0.1:5173',
        'check_cmd': 'pgrep -f "vite.*5173"',
        'start_cmd': 'npm run dev -- --host 0.0.0.0 --port 5173 &',
        'start_dir': '/home/sam/APPS/cybersec-kali/frontend',
        'critical': True,
        'auto_restart': True
    },
    'website': {
        'name': 'Website (semihkilic.com)',
        'type': 'http_external',
        'check_url': 'https://semihkilic.com',
        'http_timeout': 8,
        'expected_statuses': [200, 301, 302, 307, 308],
        'critical': True,
        'auto_restart': False  # Can't auto-restart external
    }
}

ALLOWED_START_DIRS = {
    '/home/sam',
    '/home/sam/APPS/cybersec-sales/backend',
    '/home/sam/APPS/cybersec-kali/backend',
    '/home/sam/APPS/cybersec-sales/frontend',
    '/home/sam/APPS/cybersec-kali/frontend'
}

ALLOWED_SERVICE_TYPES = {'process', 'http', 'http_external'}

# ============================================================================
# LOGGING SETUP
# ============================================================================

_ensure_parent_dir(CONFIG['log_file'])
_ensure_parent_dir(CONFIG['state_file'])
logger = logging.getLogger('CyberSecMonitor')
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
logger.propagate = False

# ==========================================================================
# SYSTEMD WATCHDOG SUPPORT
# ==========================================================================

def _sd_notify(message: str):
    notify_socket = os.environ.get('NOTIFY_SOCKET')
    if not notify_socket:
        return
    try:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
        if notify_socket.startswith('@'):
            notify_socket = '\0' + notify_socket[1:]
        sock.connect(notify_socket)
        sock.sendall(message.encode())
    except Exception:
        pass
    finally:
        try:
            sock.close()
        except Exception:
            pass

def _watchdog_thread():
    watchdog_usec = os.environ.get('WATCHDOG_USEC')
    if not watchdog_usec:
        return
    try:
        interval = max(1, int(int(watchdog_usec) / 1_000_000 / 2))
    except Exception:
        interval = 15
    _sd_notify('READY=1')
    while True:
        _sd_notify('WATCHDOG=1')
        time.sleep(interval)

threading.Thread(target=_watchdog_thread, daemon=True).start()

# ============================================================================
# STATE MANAGEMENT
# ============================================================================

class StateManager:
    def __init__(self, state_file):
        self.state_file = state_file
        self.state = self.load()
    
    def load(self):
        try:
            if os.path.exists(self.state_file):
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    try:
                        fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                    except Exception:
                        pass
                    try:
                        data = json.load(f)
                    except Exception:
                        try:
                            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                        except Exception:
                            pass
                        ts = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
                        corrupt_path = f"{self.state_file}.corrupt.{ts}"
                        try:
                            os.replace(self.state_file, corrupt_path)
                        except Exception:
                            pass
                        return {'services': {}, 'last_alert': {}}
                    try:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                    except Exception:
                        pass
                    try:
                        os.chmod(self.state_file, 0o600)
                    except Exception:
                        pass
                    return data
        except:
            pass
        return {'services': {}, 'last_alert': {}}
    
    def save(self):
        tmp_path = f"{self.state_file}.tmp"
        _ensure_parent_dir(self.state_file)
        with open(tmp_path, 'w', encoding='utf-8') as f:
            try:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            except Exception:
                pass
            json.dump(self.state, f, indent=2)
            f.flush()
            try:
                os.fsync(f.fileno())
            except Exception:
                pass
            try:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            except Exception:
                pass
        try:
            os.chmod(tmp_path, 0o600)
        except Exception:
            pass
        os.replace(tmp_path, self.state_file)
    
    def get_service(self, name):
        if name not in self.state['services']:
            self.state['services'][name] = {
                'status': 'unknown',
                'last_check': None,
                'restart_count': 0,
                'last_restart': None,
                'consecutive_failures': 0
            }
        return self.state['services'][name]
    
    def update_service(self, name, **kwargs):
        svc = self.get_service(name)
        svc.update(kwargs)
        self.save()

    def get_last_alert(self, name):
        return self.state.get('last_alert', {}).get(name)

    def set_last_alert(self, name, timestamp):
        if 'last_alert' not in self.state:
            self.state['last_alert'] = {}
        self.state['last_alert'][name] = timestamp
        self.save()

state = StateManager(CONFIG['state_file'])

# ============================================================================
# EMAIL ALERTS
# ============================================================================

def send_alert(subject, html_content, urgent=False):
    """Send email alert"""
    try:
        email_sent = False
        webhook_sent = False
        smtp_email = CONFIG['smtp'].get('email')
        smtp_password = CONFIG['smtp'].get('password')
        smtp_server = CONFIG['smtp'].get('server')
        alert_email = CONFIG.get('alert_email')

        if smtp_email and smtp_password and smtp_server and alert_email:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"{'🚨 URGENT: ' if urgent else ''}{subject}"
            msg['From'] = f"{CONFIG['smtp']['from_name']} <{smtp_email}>"
            msg['To'] = alert_email
            msg.attach(MIMEText(html_content, 'html'))

            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(CONFIG['smtp']['server'], CONFIG['smtp']['port'], context=context) as server:
                server.login(smtp_email, smtp_password)
                server.send_message(msg)
            email_sent = True
            logger.info(f"✉️ Alert email sent: {subject}")
        else:
            logger.warning("SMTP or alert email not configured; skipping email alert")

        # Optional webhook alert
        if CONFIG.get('webhook_url'):
            try:
                requests.post(CONFIG['webhook_url'], json={
                    'title': subject,
                    'urgent': urgent,
                    'html': html_content
                }, timeout=10)
                webhook_sent = True
            except Exception as e:
                logger.error(f"Webhook alert failed: {e}")
        return email_sent or webhook_sent
    except Exception as e:
        logger.error(f"Failed to send alert: {e}")
        return False


def create_status_email(title, services_status, is_down=True):
    """Create beautiful status email"""
    now = datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')
    
    if is_down:
        header_bg = 'linear-gradient(135deg,#ef4444,#dc2626)'
        header_icon = '🚨'
        header_text = 'Service Alert'
    else:
        header_bg = 'linear-gradient(135deg,#22c55e,#16a34a)'
        header_icon = '✅'
        header_text = 'Services Recovered'
    
    rows = ""
    for svc_id, info in services_status.items():
        status_color = '#22c55e' if info['status'] == 'up' else '#ef4444'
        status_icon = '🟢' if info['status'] == 'up' else '🔴'
        status_text = 'Online' if info['status'] == 'up' else info.get('error', 'Down')
        
        rows += f'''
        <tr>
            <td style="padding:12px 15px;border-bottom:1px solid rgba(255,255,255,0.1);">
                <span style="color:{status_color};font-weight:bold;">{status_icon} {info['name']}</span>
            </td>
            <td style="padding:12px 15px;border-bottom:1px solid rgba(255,255,255,0.1);color:#8892b0;">
                {status_text}
            </td>
            <td style="padding:12px 15px;border-bottom:1px solid rgba(255,255,255,0.1);color:#8892b0;">
                {info.get('action', '-')}
            </td>
        </tr>'''
    
    return f'''<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a;">
<table style="width:100%"><tr><td align="center" style="padding:40px 20px;">
<table style="width:100%;max-width:650px;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;">

<tr><td style="padding:30px 40px;text-align:center;background:{header_bg};">
<span style="font-size:48px;">{header_icon}</span>
<h1 style="color:#fff;font-size:28px;margin:15px 0 5px;">{header_text}</h1>
<p style="color:rgba(255,255,255,0.9);font-size:16px;margin:0;">{title}</p>
</td></tr>

<tr><td style="padding:30px 40px;">
<table style="width:100%;background:rgba(0,0,0,0.2);border-radius:8px;border-collapse:collapse;">
<tr style="background:rgba(255,255,255,0.05);">
    <th style="padding:12px 15px;text-align:left;color:#ccd6f6;font-weight:600;">Service</th>
    <th style="padding:12px 15px;text-align:left;color:#ccd6f6;font-weight:600;">Status</th>
    <th style="padding:12px 15px;text-align:left;color:#ccd6f6;font-weight:600;">Action</th>
</tr>
{rows}
</table>
</td></tr>

<tr><td style="padding:20px 40px;background:#0a0a0a;text-align:center;">
<p style="color:#4a5568;font-size:12px;margin:0;">CyberSec Pro Service Monitor</p>
<p style="color:#4a5568;font-size:11px;margin:5px 0 0;">{now}</p>
</td></tr>

</table></td></tr></table></body></html>'''

# ============================================================================
# SERVICE CHECKS
# ============================================================================

def check_process(cmd):
    """Check if process is running"""
    try:
        if not cmd or not isinstance(cmd, str) or len(cmd) > 256:
            return False
        if '\n' in cmd or '\r' in cmd:
            return False
        if not cmd.strip().startswith('pgrep '):
            return False
        args = shlex.split(cmd) if isinstance(cmd, str) else cmd
        if args and args[0] == 'pgrep' and _PGREP_PATH:
            args[0] = _PGREP_PATH
        result = subprocess.run(args, capture_output=True, text=True, timeout=5)
        return result.returncode == 0
    except:
        return False

def _safe_pkill_from_check(cmd: str) -> list[str] | None:
    if not cmd or not isinstance(cmd, str):
        return None
    if '\n' in cmd or '\r' in cmd:
        return None
    if not cmd.strip().startswith('pgrep '):
        return None
    try:
        parts = shlex.split(cmd)
    except Exception:
        return None
    if not parts or parts[0] != 'pgrep':
        return None
    cmd = ['pkill'] + parts[1:]
    if cmd and cmd[0] == 'pkill' and _PKILL_PATH:
        cmd[0] = _PKILL_PATH
    return cmd

def _validate_service_config(svc_id: str, svc_config: dict) -> tuple[bool, str]:
    svc_type = svc_config.get('type', 'process')
    if svc_type not in ALLOWED_SERVICE_TYPES:
        return False, 'unsupported service type'

    if svc_type == 'process':
        check_cmd = svc_config.get('check_cmd')
        if not check_cmd or not isinstance(check_cmd, str):
            return False, 'missing process check_cmd'
        if not check_cmd.strip().startswith('pgrep '):
            return False, 'invalid process check_cmd'

    if svc_type in {'http', 'http_external'}:
        check_url = svc_config.get('check_url')
        if not check_url or not isinstance(check_url, str):
            return False, 'missing check_url'
        if len(check_url) > 2048:
            return False, 'check_url too long'
        if 'http_timeout' in svc_config:
            try:
                timeout_value = float(svc_config.get('http_timeout'))
            except Exception:
                return False, 'invalid http_timeout'
            if timeout_value <= 0:
                return False, 'invalid http_timeout'
        if 'expected_statuses' in svc_config:
            statuses = svc_config.get('expected_statuses')
            if not isinstance(statuses, list) or not statuses:
                return False, 'invalid expected_statuses'
            for code in statuses:
                if not isinstance(code, int) or code < 100 or code > 599:
                    return False, 'invalid expected_statuses'
        if 'http_headers' in svc_config:
            headers = svc_config.get('http_headers')
            if not isinstance(headers, dict):
                return False, 'invalid http_headers'
            for key, value in headers.items():
                if not isinstance(key, str) or not isinstance(value, str):
                    return False, 'invalid http_headers'

    if svc_config.get('auto_restart', False):
        start_dir = svc_config.get('start_dir')
        start_cmd = svc_config.get('start_cmd')
        if not start_dir or not isinstance(start_dir, str):
            return False, 'missing start_dir'
        if start_dir not in ALLOWED_START_DIRS:
            return False, 'start_dir not allowed'
        if not start_cmd or not isinstance(start_cmd, str):
            return False, 'missing start_cmd'
        if '\n' in start_cmd or '\r' in start_cmd:
            return False, 'invalid start_cmd'

    return True, ''

def _validated_services(skip_external: bool, skip_services: set[str]) -> dict:
    valid = {}
    for svc_id, svc_config in SERVICES.items():
        if svc_id.lower() in skip_services:
            continue
        if skip_external and svc_config.get('type') == 'http_external':
            continue
        ok, reason = _validate_service_config(svc_id, svc_config)
        if ok:
            valid[svc_id] = svc_config
        else:
            logger.error(f"Skipping service {svc_id}: {reason}")
    return valid

def _configure_http_session(retries: int, backoff: float, pool: int) -> None:
    if Retry is None:
        return
    try:
        retry = Retry(
            total=retries,
            connect=retries,
            read=retries,
            status=retries,
            backoff_factor=backoff,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=frozenset(['GET', 'HEAD']),
            raise_on_status=False
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=pool, pool_maxsize=pool)
        _HTTP_SESSION.mount('http://', adapter)
        _HTTP_SESSION.mount('https://', adapter)
    except Exception:
        pass

def _reload_runtime_config() -> None:
    global RUNTIME, ACTIVE_SERVICES, CHECK_INTERVAL
    RUNTIME = _load_runtime_config()
    CONFIG['http_timeout'] = RUNTIME['http_timeout']
    _configure_http_session(RUNTIME['http_retries'], RUNTIME['http_backoff'], RUNTIME['http_pool'])
    if RUNTIME.get('interval') is not None:
        CHECK_INTERVAL = RUNTIME['interval']
    ACTIVE_SERVICES = _validated_services(RUNTIME['skip_external'], RUNTIME['skip_services'])
    logger.info("Reloaded runtime config")
    logger.info(f"External checks: {'disabled' if RUNTIME['skip_external'] else 'enabled'}")
    logger.info(f"OK logs: {'enabled' if RUNTIME['log_ok'] else 'disabled'}")
    if RUNTIME['skip_services']:
        logger.info(f"Skipping services: {', '.join(sorted(RUNTIME['skip_services']))}")


def check_http(url, timeout=None, headers=None, expected_statuses=None):
    """Check HTTP endpoint"""
    try:
        if not url or len(url) > 2048:
            return False, 'Invalid URL'
        parsed = urlparse(url)
        if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
            return False, 'Invalid URL'
        if timeout is None:
            timeout = CONFIG['http_timeout']
        try:
            timeout = float(timeout)
        except Exception:
            timeout = 10
        if timeout <= 0:
            timeout = 10
        verify_tls = RUNTIME.get('verify_tls', True) if parsed.scheme == 'https' else False
        response = _HTTP_SESSION.get(
            url,
            timeout=timeout,
            verify=verify_tls,
            allow_redirects=False,
            headers=headers
        )
        status_code = response.status_code
        response.close()
        if expected_statuses:
            return status_code in set(expected_statuses), status_code
        return status_code == 200, status_code
    except requests.exceptions.ConnectionError:
        return False, 'Connection refused'
    except requests.exceptions.Timeout:
        return False, 'Timeout'
    except Exception as e:
        return False, str(e)


def check_service(svc_id, svc_config):
    """Check a single service"""
    svc_type = svc_config.get('type', 'process')
    
    if svc_type == 'process':
        is_up = check_process(svc_config['check_cmd'])
        return is_up, None if is_up else 'Process not running'
    
    elif svc_type in ['http', 'http_external']:
        is_up, status = check_http(
            svc_config['check_url'],
            timeout=svc_config.get('http_timeout'),
            headers=svc_config.get('http_headers'),
            expected_statuses=svc_config.get('expected_statuses')
        )
        if svc_type == 'http_external' and isinstance(status, int) and 200 <= status < 400:
            return True, None
        return is_up, None if is_up else str(status)
    
    return False, 'Unknown service type'

# ============================================================================
# SERVICE RESTART
# ============================================================================

def restart_service(svc_id, svc_config):
    """Restart a service"""
    svc_state = state.get_service(svc_id)
    
    # Check cooldown
    if svc_state['last_restart']:
        time_since = time.time() - svc_state['last_restart']
        if time_since < CONFIG['restart_cooldown']:
            logger.warning(f"⏳ {svc_config['name']}: Cooldown active ({int(CONFIG['restart_cooldown'] - time_since)}s remaining)")
            return False, 'Cooldown active'
    
    # Check max attempts
    if svc_state['restart_count'] >= CONFIG['max_restart_attempts']:
        logger.error(f"❌ {svc_config['name']}: Max restart attempts reached")
        return False, 'Max attempts reached'
    
    logger.info(f"🔄 Restarting {svc_config['name']}...")
    
    try:
        start_dir = svc_config.get('start_dir', '/home/sam')
        start_cmd = svc_config.get('start_cmd')

        if not start_dir or not isinstance(start_dir, str) or not os.path.isabs(start_dir):
            return False, 'Invalid start directory'
        if start_dir not in ALLOWED_START_DIRS:
            return False, 'Start directory not allowed'
        if not os.path.isdir(start_dir):
            return False, 'Start directory missing'
        if not start_cmd or not isinstance(start_cmd, str) or len(start_cmd) > 512:
            return False, 'Invalid start command'
        if '\n' in start_cmd or '\r' in start_cmd:
            return False, 'Invalid start command'
        
        # Kill existing process first if check_cmd exists
        if 'check_cmd' in svc_config:
            kill_cmd = _safe_pkill_from_check(svc_config.get('check_cmd', ''))
            if kill_cmd:
                try:
                    subprocess.run(kill_cmd, capture_output=True, timeout=5)
                    time.sleep(2)
                except Exception:
                    pass
        
        # Start the service
        full_cmd = f"cd {start_dir} && {start_cmd}"
        process = subprocess.Popen(
            full_cmd,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True
        )
        
        # Wait a bit and check if it started
        time.sleep(3)
        is_up, error = check_service(svc_id, svc_config)
        
        if is_up:
            logger.info(f"✅ {svc_config['name']}: Restarted successfully")
            state.update_service(svc_id, 
                status='up',
                restart_count=svc_state['restart_count'] + 1,
                last_restart=time.time(),
                consecutive_failures=0
            )
            return True, 'Restarted successfully'
        else:
            logger.error(f"❌ {svc_config['name']}: Restart failed - {error}")
            state.update_service(svc_id,
                restart_count=svc_state['restart_count'] + 1,
                last_restart=time.time()
            )
            return False, f'Restart failed: {error}'
            
    except Exception as e:
        logger.error(f"❌ {svc_config['name']}: Restart exception - {e}")
        return False, str(e)

# ============================================================================
# MAIN MONITOR LOOP
# ============================================================================

def monitor_cycle():
    """Run one monitoring cycle"""
    start_ts = time.monotonic()
    log_ok = RUNTIME.get('log_ok', True)
    logger.info("=" * 50)
    logger.info(f"🔍 Monitoring cycle at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 50)
    
    services_down = {}
    services_recovered = {}
    actions_taken = {}
    
    for svc_id, svc_config in ACTIVE_SERVICES.items():
        svc_state = state.get_service(svc_id)
        was_down = svc_state['status'] == 'down'
        
        is_up, error = check_service(svc_id, svc_config)
        
        if is_up:
            if log_ok:
                logger.info(f"✅ {svc_config['name']}: OK")
            
            if was_down:
                services_recovered[svc_id] = {
                    'name': svc_config['name'],
                    'status': 'up',
                    'action': 'Recovered'
                }
            
            state.update_service(svc_id,
                status='up',
                last_check=time.time(),
                consecutive_failures=0
            )
        else:
            logger.warning(f"❌ {svc_config['name']}: DOWN ({error})")
            
            svc_state['consecutive_failures'] = svc_state.get('consecutive_failures', 0) + 1
            
            action = 'Monitoring'
            
            # Try auto-restart if enabled
            if svc_config.get('auto_restart', False):
                success, result = restart_service(svc_id, svc_config)
                if success:
                    action = 'Auto-restarted ✓'
                    is_up = True
                    services_recovered[svc_id] = {
                        'name': svc_config['name'],
                        'status': 'up',
                        'action': action
                    }
                else:
                    action = f'Restart failed: {result}'
            
            if not is_up:
                # Alert only after threshold + cooldown
                last_alert = state.get_last_alert(svc_id)
                cooldown_ok = True if not last_alert else (time.time() - last_alert) > CONFIG['alert_cooldown']
                if svc_state['consecutive_failures'] >= CONFIG['failure_threshold'] and cooldown_ok:
                    services_down[svc_id] = {
                        'name': svc_config['name'],
                        'status': 'down',
                        'error': error,
                        'action': action,
                        'critical': svc_config.get('critical', False)
                    }
            
            state.update_service(svc_id,
                status='down' if not is_up else 'up',
                last_check=time.time(),
                consecutive_failures=svc_state['consecutive_failures'] if not is_up else 0
            )
    
    # Send alerts
    if services_down:
        critical_count = len([s for s in services_down.values() if s.get('critical')])
        title = f"{len(services_down)} service(s) down"
        if critical_count:
            title = f"CRITICAL: {critical_count} critical service(s) down!"
        
        html = create_status_email(title, services_down, is_down=True)
        send_alert(f"⚠️ {title}", html, urgent=critical_count > 0)
        for svc_id in services_down.keys():
            state.set_last_alert(svc_id, time.time())
    
    if services_recovered and not services_down:
        title = f"{len(services_recovered)} service(s) recovered"
        html = create_status_email(title, services_recovered, is_down=False)
        send_alert(f"✅ {title}", html)
    
    duration = time.monotonic() - start_ts
    if duration > max(5, CHECK_INTERVAL * 0.8):
        logger.warning(f"⏱️ Monitoring cycle slow: {duration:.2f}s")
    else:
        logger.info(f"⏱️ Monitoring cycle completed in {duration:.2f}s")
    return len(services_down) == 0

def log_status_snapshot():
    summary = []
    for svc_id, svc_config in ACTIVE_SERVICES.items():
        logger.info(f"🌐 HTTP retries: {RUNTIME.get('http_retries', 0)} (backoff {RUNTIME.get('http_backoff', 0.2)}s)")
        logger.info(f"🌐 HTTP pool: {RUNTIME.get('http_pool', 10)}")
        if RUNTIME.get('jitter_max', 0) > 0:
            logger.info(f"⏱️  Jitter max: {RUNTIME.get('jitter_max')}s")
        is_up, error = check_service(svc_id, svc_config)
        status = 'OK' if is_up else f"DOWN ({error})"
        summary.append(f"{svc_config['name']}: {status}")
    logger.info("Status snapshot: " + " | ".join(summary))


def reset_restart_counts():
    """Reset restart counts periodically (every hour)"""
    while True:
        time.sleep(3600)
        for svc_id in ACTIVE_SERVICES.keys():
            state.update_service(svc_id, restart_count=0)
        logger.info("🔄 Reset restart counts")


def main():
    """Main entry point"""
    import argparse
    parser = argparse.ArgumentParser(description='CyberSec Pro Service Manager')
    parser.add_argument('--once', action='store_true', help='Run once and exit')
    parser.add_argument('--status', action='store_true', help='Show current status')
    parser.add_argument('--restart', type=str, help='Restart a specific service')
    parser.add_argument('--interval', type=int, default=30, help='Check interval')
    args = parser.parse_args()
    global CHECK_INTERVAL
    CHECK_INTERVAL = args.interval
    
    if args.status:
        print("\n" + "=" * 60)
        print("🛡️  CyberSec Pro Service Status")
        print("=" * 60)
        for svc_id, svc_config in ACTIVE_SERVICES.items():
            is_up, error = check_service(svc_id, svc_config)
            status = "✅ UP" if is_up else f"❌ DOWN ({error})"
            print(f"  {svc_config['name']:30} {status}")
        print("=" * 60)
        return
    
    if args.restart:
        if args.restart in ACTIVE_SERVICES:
            success, msg = restart_service(args.restart, ACTIVE_SERVICES[args.restart])
            print(f"{'✅' if success else '❌'} {msg}")
        else:
            print(f"Unknown service: {args.restart}")
            print(f"Available: {', '.join(ACTIVE_SERVICES.keys())}")
        return
    
    if sys.stdout.isatty():
        print("""
╔══════════════════════════════════════════════════════════════╗
║       🛡️  CyberSec Pro Service Manager & Monitor  🛡️        ║
║                                                              ║
║  Features:                                                   ║
║  • Real-time service monitoring                              ║
║  • Automatic restart on failure                              ║
║  • Email alerts for critical events                          ║
║  • Status tracking and logging                               ║
╚══════════════════════════════════════════════════════════════╝
        """)
    
    _log_tooling_status()
    _reload_runtime_config()
    logger.info(f"📧 Alerts: {CONFIG['alert_email'] or 'disabled'}")
    logger.info(f"⏱️  Interval: {CHECK_INTERVAL}s (min 5s enforced)")
    logger.info(f"🔄 Auto-restart: Enabled")
    logger.info(f"🌐 HTTP timeout: {CONFIG['http_timeout']}s")
    logger.info(f"🔒 HTTP TLS verify: {'enabled' if RUNTIME.get('verify_tls', True) else 'disabled'}")
    
    # Start reset thread
    reset_thread = threading.Thread(target=reset_restart_counts, daemon=True)
    reset_thread.start()
    
    # Signal handler
    def signal_handler(sig, frame):
        logger.info("\n👋 Shutting down monitor...")
        sys.exit(0)

    def reload_handler(sig, frame):
        try:
            _reload_runtime_config()
        except Exception as exc:
            logger.error(f"Config reload failed: {exc}")

    def snapshot_handler(sig, frame):
        try:
            log_status_snapshot()
        except Exception as exc:
            logger.error(f"Snapshot failed: {exc}")
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    if hasattr(signal, 'SIGHUP'):
        signal.signal(signal.SIGHUP, reload_handler)
    if hasattr(signal, 'SIGUSR1'):
        signal.signal(signal.SIGUSR1, snapshot_handler)
    
    # Run once or loop
    if args.once:
        monitor_cycle()
    else:
        while True:
            try:
                cycle_start = time.monotonic()
                monitor_cycle()
                elapsed = time.monotonic() - cycle_start
                sleep_for = max(0, CHECK_INTERVAL - elapsed)
                jitter_max = RUNTIME.get('jitter_max', 0.0)
                if jitter_max:
                    jitter_max = min(jitter_max, max(0.0, CHECK_INTERVAL * 0.5))
                    sleep_for += random.uniform(0, jitter_max)
                time.sleep(sleep_for)
            except Exception as e:
                logger.error(f"Monitor error: {e}")
                time.sleep(CHECK_INTERVAL)


RUNTIME = _load_runtime_config()
ACTIVE_SERVICES = _validated_services(RUNTIME['skip_external'], RUNTIME['skip_services'])

if __name__ == '__main__':
    main()
