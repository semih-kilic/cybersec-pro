from __future__ import annotations

import base64
import csv
import fcntl
import hashlib
import hmac
import ipaddress
import json
import os
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from functools import wraps

import jwt
from flask import jsonify, request, g, current_app

from models import User

_rate_limit_lock = threading.Lock()
_rate_limit_hits: dict[str, deque] = defaultdict(deque)


def get_current_user():
    """Get current user or return default admin user"""
    token = request.headers.get('Authorization')
    if token:
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            user = User.query.get(data['user_id'])
            if user and user.is_active:
                return user
        except Exception:
            pass
    if os.environ.get('ALLOW_ANON_ACCESS', '').strip().lower() in {'1', 'true', 'yes'}:
        admin = User.query.filter_by(role='admin').first()
        if not admin:
            admin = User.query.first()
        return admin
    return None


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        current_user = get_current_user()
        if not current_user:
            _audit_log('auth_required', None, status='denied')
            return jsonify({'error': 'Unauthorized'}), 401
        return f(current_user, *args, **kwargs)
    return decorated


# ==================== RATE LIMITING & AUDIT LOGGING ====================

def _rate_limited(key: str, limit: int, window_sec: int) -> bool:
    now = time.time()
    with _rate_limit_lock:
        hits = _rate_limit_hits[key]
        while hits and (now - hits[0]) > window_sec:
            hits.popleft()
        if len(hits) >= limit:
            return True
        hits.append(now)
    return False


def _client_ip() -> str:
    forwarded = request.headers.get('X-Forwarded-For', '')
    candidate = forwarded.split(',')[0].strip() if forwarded else ''
    if candidate:
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except Exception:
            pass
    remote = request.remote_addr or ''
    if remote:
        try:
            ipaddress.ip_address(remote)
            return remote
        except Exception:
            pass
    return 'unknown'


def _admin_token_valid(token: str | None) -> bool:
    if not token:
        return False
    current = os.environ.get('ADMIN_TOKEN')
    prev = os.environ.get('ADMIN_TOKEN_PREV')
    try:
        if current and hmac.compare_digest(token, current):
            return True
        if prev and hmac.compare_digest(token, prev):
            return True
    except Exception:
        pass
    return False


def _admin_ip_allowed() -> bool:
    allowed = os.environ.get('ADMIN_ALLOWED_IPS', '').strip()
    if not allowed:
        return True
    client_ip = _client_ip()
    entries = [ip.strip() for ip in allowed.split(',') if ip.strip()]
    for entry in entries:
        if '/' in entry:
            try:
                if ipaddress.ip_address(client_ip) in ipaddress.ip_network(entry, strict=False):
                    return True
            except Exception:
                continue
        else:
            if client_ip == entry:
                return True
    return False


def _audit_signing_key() -> bytes | None:
    key = os.environ.get('AUDIT_SIGNING_KEY')
    return key.encode('utf-8') if key else None


def _audit_signing_key_prev() -> bytes | None:
    key = os.environ.get('AUDIT_SIGNING_KEY_PREV')
    return key.encode('utf-8') if key else None


def _audit_hash_payload(payload: dict, key: bytes) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hmac.new(key, encoded, hashlib.sha256).hexdigest()


def _audit_last_hash() -> str:
    path = '/var/log/cybersec/audit.hash'
    try:
        with open(path, 'r', encoding='utf-8') as handle:
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_SH)
            except Exception:
                pass
            value = handle.read().strip()
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            except Exception:
                pass
            return value or 'genesis'
    except Exception:
        return 'genesis'


def _audit_store_last_hash(value: str) -> None:
    path = '/var/log/cybersec/audit.hash'
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as handle:
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            except Exception:
                pass
            handle.write(value)
            handle.flush()
            try:
                os.fsync(handle.fileno())
            except Exception:
                pass
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            except Exception:
                pass
        try:
            os.chmod(path, 0o600)
        except Exception:
            pass
    except Exception:
        pass


def _clamp_text(value: str | None, max_len: int = 512) -> str:
    if not value:
        return ''
    text = str(value)
    return text if len(text) <= max_len else f"{text[:max_len]}..."


def _clamp_lines(lines: list[str], max_lines: int = 200, max_chars: int = 8000) -> tuple[list[str], bool]:
    trimmed = lines[:max_lines]
    combined = '\n'.join(trimmed)
    if len(combined) > max_chars:
        combined = combined[:max_chars] + '...'
        trimmed = combined.splitlines()
        return trimmed, True
    return trimmed, len(lines) > max_lines


def _mask_license_key(value: str | None) -> str:
    if not value:
        return ''
    if len(value) <= 8:
        return '***'
    return f"{value[:4]}...{value[-4:]}"


def _require_json():
    if not request.is_json:
        return jsonify({'error': 'Content-Type must be application/json'}), 415
    return None


def admin_ip_required(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        if not _admin_ip_allowed():
            return jsonify({'error': 'Admin IP not allowed'}), 403
        return func(*args, **kwargs)
    return wrapped


def rate_limit(limit: int = 60, window_sec: int = 60):
    def decorator(func):
        @wraps(func)
        def wrapped(*args, **kwargs):
            ip = _client_ip()
            key = f"{ip}:{request.path}"
            if _rate_limited(key, limit, window_sec):
                return jsonify({'error': 'Too many requests'}), 429
            return func(*args, **kwargs)
        return wrapped
    return decorator


def rate_limit_admin(limit: int = 10, window_sec: int = 60):
    def decorator(func):
        @wraps(func)
        def wrapped(*args, **kwargs):
            ip = _client_ip()
            key = f"admin:{ip}:{request.path}"
            if _rate_limited(key, limit, window_sec):
                _audit_log('admin_rate_limited', None, status='denied', ip=ip, path=request.path)
                return jsonify({'error': 'Too many requests'}), 429
            return func(*args, **kwargs)
        return wrapped
    return decorator


def _audit_log(action: str, current_user=None, **data):
    try:
        log_dir = '/var/log/cybersec'
        os.makedirs(log_dir, exist_ok=True)
        try:
            os.chmod(log_dir, 0o700)
        except Exception:
            pass
        max_len = 512
        sanitized = {}
        for key, value in data.items():
            sanitized[key] = _clamp_text(value, max_len)
        payload = {
            'timestamp': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
            'action': action,
            'user_id': getattr(current_user, 'id', None),
            'ip': _client_ip(),
            'request_id': getattr(g, 'request_id', None),
            'method': request.method,
            'path': _clamp_text(request.path, max_len),
            'user_agent': _clamp_text(request.headers.get('User-Agent'), max_len),
            **sanitized
        }
        signing_key = _audit_signing_key()
        if signing_key:
            prev_hash = _audit_last_hash()
            payload['prev_hash'] = prev_hash
            payload['hash'] = _audit_hash_payload(payload, signing_key)
            _audit_store_last_hash(payload['hash'])
        log_path = os.path.join(log_dir, 'audit.log')
        with open(log_path, 'a', encoding='utf-8') as handle:
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            except Exception:
                pass
            handle.write(json.dumps(payload) + '\n')
            handle.flush()
            try:
                os.fsync(handle.fileno())
            except Exception:
                pass
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            except Exception:
                pass
        try:
            os.chmod(log_path, 0o600)
        except Exception:
            pass
    except Exception:
        pass
