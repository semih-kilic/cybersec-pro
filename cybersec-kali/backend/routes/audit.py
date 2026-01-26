import io
import json
from collections import deque

from flask import Blueprint, jsonify, request, current_app

from services.security import (
    admin_ip_required,
    rate_limit_admin,
    get_current_user,
    _audit_log,
    _audit_signing_key,
    _audit_signing_key_prev,
    _audit_hash_payload,
)


audit_bp = Blueprint('audit', __name__)


def _tail_lines(path: str, limit: int = 50) -> list[str]:
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as handle:
            return list(deque(handle, maxlen=limit))
    except Exception:
        return []


@audit_bp.route('/api/audit/logs', methods=['GET'])
@admin_ip_required
@rate_limit_admin(limit=60, window_sec=60)
def audit_logs():
    current_user = get_current_user()
    if current_user and current_user.role != 'admin':
        _audit_log('audit_logs', current_user, status='denied', reason='admin_required')
        return jsonify({'error': 'Admin required'}), 403
    limit = request.args.get('limit', 200, type=int)
    limit = max(1, min(limit, 500))
    lines = _tail_lines('/var/log/cybersec/audit.log', limit)
    entries = []
    for line in lines:
        try:
            entries.append(json.loads(line))
        except Exception:
            continue
    _audit_log('audit_logs', current_user, status='ok', count=len(entries))
    return jsonify({'logs': entries[::-1]})


@audit_bp.route('/api/audit/logs/export', methods=['GET'])
@admin_ip_required
@rate_limit_admin(limit=20, window_sec=60)
def audit_logs_export():
    current_user = get_current_user()
    if current_user and current_user.role != 'admin':
        _audit_log('audit_logs_export', current_user, status='denied', reason='admin_required')
        return jsonify({'error': 'Admin required'}), 403
    export_format = (request.args.get('format') or 'json').lower()
    limit = request.args.get('limit', 500, type=int)
    limit = max(1, min(limit, 1000))
    lines = _tail_lines('/var/log/cybersec/audit.log', limit)
    entries = []
    for line in lines:
        try:
            entries.append(json.loads(line))
        except Exception:
            continue
    entries = entries[::-1]
    _audit_log('audit_logs_export', current_user, status='ok', count=len(entries), format=export_format)

    if export_format == 'csv':
        buffer = io.StringIO()
        fieldnames = ['timestamp', 'action', 'user_id', 'ip', 'status', 'host', 'port', 'error']
        from csv import DictWriter
        writer = DictWriter(buffer, fieldnames=fieldnames)
        writer.writeheader()
        for entry in entries:
            writer.writerow({
                'timestamp': entry.get('timestamp'),
                'action': entry.get('action'),
                'user_id': entry.get('user_id'),
                'ip': entry.get('ip'),
                'status': entry.get('status'),
                'host': entry.get('host'),
                'port': entry.get('port'),
                'error': entry.get('error')
            })
        response = current_app.response_class(buffer.getvalue(), mimetype='text/csv')
        response.headers['Content-Disposition'] = 'attachment; filename="audit-logs.csv"'
        return response

    response = current_app.response_class(json.dumps(entries), mimetype='application/json')
    response.headers['Content-Disposition'] = 'attachment; filename="audit-logs.json"'
    return response


@audit_bp.route('/api/audit/integrity', methods=['GET'])
@admin_ip_required
@rate_limit_admin(limit=30, window_sec=60)
def audit_integrity():
    limit = request.args.get('limit', 500, type=int)
    limit = max(1, min(limit, 2000))
    lines = _tail_lines('/var/log/cybersec/audit.log', limit)
    entries = []
    for line in lines:
        try:
            entries.append(json.loads(line))
        except Exception:
            continue

    current_key = _audit_signing_key()
    prev_key = _audit_signing_key_prev()
    total = 0
    verified = 0
    skipped = 0
    failures = 0
    chain_breaks = 0
    last_hash = None

    for entry in entries:
        if 'hash' not in entry or 'prev_hash' not in entry:
            skipped += 1
            continue
        total += 1
        payload = {k: v for k, v in entry.items() if k != 'hash'}
        expected = None
        if current_key:
            expected = _audit_hash_payload(payload, current_key)
        if expected != entry.get('hash') and prev_key:
            expected = _audit_hash_payload(payload, prev_key)
        if expected == entry.get('hash'):
            verified += 1
        else:
            failures += 1
        if last_hash and entry.get('prev_hash') != last_hash:
            chain_breaks += 1
        last_hash = entry.get('hash')

    status = 'ok' if failures == 0 else 'failed'
    return jsonify({
        'status': status,
        'total': total,
        'verified': verified,
        'skipped': skipped,
        'failures': failures,
        'chain_breaks': chain_breaks
    })
