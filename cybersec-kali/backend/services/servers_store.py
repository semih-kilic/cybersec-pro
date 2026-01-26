from __future__ import annotations

import fcntl
import json
import os
import threading

_servers_lock = threading.Lock()
_servers_store_path = os.environ.get(
    'SERVERS_STORE_PATH',
    '/home/sam/APPS/cybersec-kali/backend/instance/servers.json'
)


def _load_servers() -> list:
    try:
        if not os.path.exists(_servers_store_path):
            return []
        with _servers_lock, open(_servers_store_path, 'r', encoding='utf-8') as handle:
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_SH)
            except Exception:
                pass
            data = json.load(handle)
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            except Exception:
                pass
            return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_servers(servers: list) -> None:
    store_dir = os.path.dirname(_servers_store_path)
    os.makedirs(store_dir, exist_ok=True)
    try:
        os.chmod(store_dir, 0o700)
    except Exception:
        pass
    tmp_path = f"{_servers_store_path}.tmp"
    with _servers_lock, open(tmp_path, 'w', encoding='utf-8') as handle:
        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        except Exception:
            pass
        json.dump(servers, handle, indent=2)
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
        os.chmod(tmp_path, 0o600)
    except Exception:
        pass
    os.replace(tmp_path, _servers_store_path)


def _next_server_id(servers: list) -> int:
    existing = [s.get('id', 0) for s in servers if isinstance(s, dict)]
    return (max(existing) if existing else 0) + 1
