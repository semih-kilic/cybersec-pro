import os
import re
import subprocess
import time
from collections import deque
from datetime import datetime

import psutil
from flask import Blueprint, jsonify, request

from models import db, Scan, Vulnerability, Target
from services.security import admin_ip_required, rate_limit_admin, get_current_user, _audit_log
from urllib.parse import urlparse

monitoring_bp = Blueprint('monitoring', __name__)

_last_net_bytes_recv = None
_last_net_bytes_sent = None
_last_net_ts = None


def _format_uptime(seconds: float) -> str:
    minutes, _ = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    days, hours = divmod(hours, 24)
    return f"{days}d {hours}h {minutes}m"


def _tail_lines(path: str, limit: int = 50) -> list[str]:
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as handle:
            return list(deque(handle, maxlen=limit))
    except Exception:
        return []


def _parse_log_entries(lines: list[str]) -> list[dict]:
    level_map = {
        'CRITICAL': 'critical',
        'ERROR': 'error',
        'WARNING': 'warning',
        'INFO': 'info'
    }
    entries = []
    timestamp_regex = re.compile(r'(\d{4}-\d{2}-\d{2}[^\s]*)')
    for idx, line in enumerate(lines):
        clean = line.strip()
        if not clean:
            continue
        level = 'info'
        for key, val in level_map.items():
            if key in clean:
                level = val
                break
        match = timestamp_regex.search(clean)
        timestamp = match.group(1) if match else datetime.utcnow().isoformat()
        entries.append({
            'id': idx + 1,
            'timestamp': timestamp,
            'level': level,
            'source': 'monitor',
            'message': clean
        })
    return entries[::-1]


def _normalize_target_host(value: str | None) -> str | None:
    if not value:
        return None
    if value.startswith('http://') or value.startswith('https://'):
        parsed = urlparse(value)
        return parsed.hostname
    if '/' in value:
        return None
    return value


@monitoring_bp.route('/api/monitoring/metrics', methods=['GET'])
@admin_ip_required
@rate_limit_admin(limit=30, window_sec=60)
def monitoring_metrics():
    try:
        current_user = get_current_user()
        if current_user and current_user.role != 'admin':
            _audit_log('monitoring_metrics', current_user, status='denied', reason='admin_required')
            return jsonify({'error': 'Admin required'}), 403
        global _last_net_bytes_recv, _last_net_bytes_sent, _last_net_ts
        cpu = 0
        memory = 0
        disk = 0
        net = None
        uptime = 'unknown'
        try:
            cpu = psutil.cpu_percent(interval=0.2)
        except Exception:
            cpu = 0
        try:
            memory = psutil.virtual_memory().percent
        except Exception:
            memory = 0
        try:
            disk = psutil.disk_usage('/').percent
        except Exception:
            disk = 0
        try:
            net = psutil.net_io_counters()
        except Exception:
            net = None
        try:
            uptime = _format_uptime(time.time() - psutil.boot_time())
        except Exception:
            uptime = 'unknown'

        load_avg = None
        try:
            load_avg = psutil.getloadavg()
        except Exception:
            load_avg = None

        try:
            process_count = len(psutil.pids())
        except Exception:
            process_count = 0

        try:
            swap_percent = psutil.swap_memory().percent
        except Exception:
            swap_percent = 0

        try:
            users_count = len(psutil.users())
        except Exception:
            users_count = 0

        now = time.time()
        if net is None:
            net_in_kbps = 0
            net_out_kbps = 0
        elif _last_net_ts is None:
            net_in_kbps = 0
            net_out_kbps = 0
        else:
            delta = max(0.1, now - _last_net_ts)
            net_in_kbps = (net.bytes_recv - _last_net_bytes_recv) / delta / 1024
            net_out_kbps = (net.bytes_sent - _last_net_bytes_sent) / delta / 1024

        if net is not None:
            _last_net_bytes_recv = net.bytes_recv
            _last_net_bytes_sent = net.bytes_sent
            _last_net_ts = now

        max_mbps = float(os.environ.get('MONITOR_BANDWIDTH_MBPS', '100'))
        total_mbps = ((net_in_kbps + net_out_kbps) * 8) / 1024
        bandwidth_usage = min(100, max(0, (total_mbps / max_mbps) * 100))

        try:
            active_connections = len(psutil.net_connections(kind='inet'))
        except Exception:
            active_connections = 0

        log_lines = _tail_lines('/var/log/cybersec/monitor.log', 200)
        blocked_attacks = sum(1 for line in log_lines if 'blocked' in line.lower())

        active_scans = Scan.query.filter_by(status='running').count()
        vulnerabilities_found = Vulnerability.query.count()
        open_ports = db.session.query(Vulnerability.port).filter(Vulnerability.port.isnot(None)).distinct().count()

        _audit_log('monitoring_metrics', current_user, status='ok')
        return jsonify({
            'metrics': {
                'cpu': round(cpu),
                'memory': round(memory),
                'disk': round(disk),
                'network_in': round(net_in_kbps, 2),
                'network_out': round(net_out_kbps, 2),
                'uptime': uptime
            },
            'network': {
                'active_connections': active_connections,
                'packets_in': net.packets_recv if net else 0,
                'packets_out': net.packets_sent if net else 0,
                'bandwidth_usage': round(bandwidth_usage)
            },
            'system': {
                'load_1m': round(load_avg[0], 2) if load_avg else None,
                'load_5m': round(load_avg[1], 2) if load_avg else None,
                'load_15m': round(load_avg[2], 2) if load_avg else None,
                'processes': process_count,
                'swap_percent': round(swap_percent),
                'users': users_count
            },
            'security': {
                'blocked_attacks': blocked_attacks,
                'active_scans': active_scans,
                'vulnerabilities_found': vulnerabilities_found,
                'open_ports': open_ports
            }
        })
    except Exception as e:
        _audit_log('monitoring_metrics', get_current_user(), status='error', error=str(e))
        return jsonify({'error': str(e)}), 500


@monitoring_bp.route('/api/monitoring/logs', methods=['GET'])
@admin_ip_required
@rate_limit_admin(limit=30, window_sec=60)
def monitoring_logs():
    current_user = get_current_user()
    if current_user and current_user.role != 'admin':
        _audit_log('monitoring_logs', current_user, status='denied', reason='admin_required')
        return jsonify({'error': 'Admin required'}), 403
    lines = _tail_lines('/var/log/cybersec/monitor.log', 100)
    entries = _parse_log_entries(lines)
    _audit_log('monitoring_logs', current_user, status='ok', count=len(entries))
    return jsonify({'logs': entries})


@monitoring_bp.route('/api/monitoring/services', methods=['GET'])
@admin_ip_required
@rate_limit_admin(limit=30, window_sec=60)
def monitoring_services():
    try:
        limit = request.args.get('limit', 60, type=int)
        limit = max(1, min(limit, 200))
        only_active = request.args.get('active_only', 'false').lower() in {'1', 'true', 'yes'}
        cmd = [
            'systemctl',
            'list-units',
            '--type=service',
            '--all',
            '--no-pager',
            '--no-legend'
        ]
        if only_active:
            cmd.extend(['--state=running'])
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        services = []
        for raw in result.stdout.splitlines():
            line = raw.strip()
            if not line:
                continue
            parts = line.split(None, 4)
            if len(parts) < 5:
                continue
            unit, load, active, sub, description = parts
            services.append({
                'name': unit,
                'load': load,
                'active': active,
                'sub': sub,
                'description': description
            })
        services.sort(key=lambda s: (0 if s['active'] == 'active' else 1, s['name']))
        services = services[:limit]
        _audit_log('monitoring_services', get_current_user(), status='ok', count=len(services))
        return jsonify({'services': services})
    except Exception as e:
        _audit_log('monitoring_services', get_current_user(), status='error', reason=str(e))
        return jsonify({'error': str(e)}), 500


@monitoring_bp.route('/api/monitoring/targets/summary', methods=['GET'])
@admin_ip_required
@rate_limit_admin(limit=30, window_sec=60)
def monitoring_targets_summary():
    try:
        target = Target.query.order_by(Target.created_at.desc()).first()
        if not target:
            return jsonify({'target': None})

        host = _normalize_target_host(target.value)
        online = None
        if host:
            try:
                ping_result = subprocess.run(
                    ['ping', '-c', '1', '-W', '2', host],
                    capture_output=True,
                    timeout=5
                )
                online = ping_result.returncode == 0
            except Exception:
                online = None

        ports = db.session.query(Vulnerability.port)
        ports = ports.filter(Vulnerability.target_id == target.id)
        ports = ports.filter(Vulnerability.port.isnot(None)).distinct().all()
        open_ports = [p[0] for p in ports if p and p[0] is not None]

        last_scan = Scan.query.filter_by(target_id=target.id).order_by(Scan.created_at.desc()).first()

        return jsonify({
            'target': {
                'id': target.id,
                'value': target.value,
                'type': target.type,
                'status': target.status,
                'online': online,
                'open_ports': open_ports,
                'last_scan': last_scan.created_at.isoformat() if last_scan and last_scan.created_at else None,
                'vulnerabilities': Vulnerability.query.filter_by(target_id=target.id).count()
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
