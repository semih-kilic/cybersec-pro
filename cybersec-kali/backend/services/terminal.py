from __future__ import annotations

import base64
import io
import os
import socket
import subprocess
import telnetlib
from hashlib import sha256

from flask import current_app
import ipaddress


def _derive_crypto_key(raw: str) -> bytes:
    digest = sha256(raw.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(digest)


def _get_crypto_key() -> bytes:
    raw = os.environ.get('TERMINAL_SECRET_KEY') or os.environ.get('SECRET_KEY') or current_app.config.get('SECRET_KEY')
    if not raw:
        raw = 'cybersec-default-key'
    return _derive_crypto_key(raw)


def _get_crypto_key_prev() -> bytes | None:
    raw = os.environ.get('TERMINAL_SECRET_KEY_PREV')
    if not raw:
        return None
    return _derive_crypto_key(raw)


def _encrypt_secret(value: str) -> str:
    if not value:
        return ''
    if value.startswith('enc:'):
        return value
    try:
        from cryptography.fernet import Fernet
    except Exception:
        raise RuntimeError('Encryption support is not installed on the server')
    fernet = Fernet(_get_crypto_key())
    token = fernet.encrypt(value.encode('utf-8')).decode('utf-8')
    return f'enc:{token}'


def _decrypt_secret(value: str) -> str:
    if not value:
        return ''
    if not value.startswith('enc:'):
        return value
    try:
        from cryptography.fernet import Fernet
    except Exception:
        raise RuntimeError('Encryption support is not installed on the server')
    token = value[4:]
    fernet = Fernet(_get_crypto_key())
    return fernet.decrypt(token.encode('utf-8')).decode('utf-8')


def _decrypt_secret_with_rotation(value: str) -> tuple[str, bool]:
    if not value:
        return '', False
    if not value.startswith('enc:'):
        return value, False
    try:
        from cryptography.fernet import Fernet
    except Exception:
        raise RuntimeError('Encryption support is not installed on the server')
    token = value[4:]
    current = Fernet(_get_crypto_key())
    try:
        return current.decrypt(token.encode('utf-8')).decode('utf-8'), False
    except Exception:
        prev_key = _get_crypto_key_prev()
        if not prev_key:
            raise
        prev = Fernet(prev_key)
        return prev.decrypt(token.encode('utf-8')).decode('utf-8'), True


def _terminal_allowed(host: str) -> bool:
    allowed = os.environ.get('TERMINAL_ALLOWED_HOSTS', '').strip()
    if not allowed:
        return True
    try:
        host_ip = ipaddress.ip_address(host)
    except Exception:
        host_ip = None
    entries = [h.strip() for h in allowed.split(',') if h.strip()]
    for entry in entries:
        if '/' in entry:
            if not host_ip:
                continue
            try:
                if host_ip in ipaddress.ip_network(entry, strict=False):
                    return True
            except Exception:
                continue
        else:
            if host == entry:
                return True
    return False


def _run_local_command(command: str, timeout: int = 20):
    try:
        completed = subprocess.run(
            ['/bin/bash', '-lc', command],
            capture_output=True,
            text=True,
            timeout=timeout,
            env={},
            cwd='/tmp'
        )
    except Exception:
        completed = subprocess.run(
            ['/bin/bash', '-lc', command],
            capture_output=True,
            text=True,
            timeout=timeout
        )
    output = completed.stdout or ''
    error = completed.stderr or ''
    return completed.returncode, output, error


def _load_paramiko_private_key(paramiko_module, key_data: str, passphrase: str | None):
    key_data = (key_data or '').strip()
    if not key_data:
        return None
    key_stream = io.StringIO(key_data)
    last_error = None
    for key_cls in (paramiko_module.RSAKey, paramiko_module.Ed25519Key, paramiko_module.ECDSAKey, paramiko_module.DSSKey):
        try:
            key_stream.seek(0)
            return key_cls.from_private_key(key_stream, password=passphrase or None)
        except Exception as exc:
            last_error = exc
            continue
    raise RuntimeError('Invalid SSH private key') from last_error


def _run_ssh_command(host: str, port: int, username: str, password: str, command: str, timeout: int = 20, ssh_key: str | None = None, ssh_key_passphrase: str | None = None):
    try:
        import paramiko
    except Exception:
        raise RuntimeError('SSH support is not installed on the server')

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    pkey = _load_paramiko_private_key(paramiko, ssh_key, ssh_key_passphrase) if ssh_key else None
    client.connect(
        hostname=host,
        port=port,
        username=username,
        password=None if pkey else password,
        pkey=pkey,
        timeout=timeout,
        banner_timeout=timeout,
        auth_timeout=timeout,
        look_for_keys=False,
        allow_agent=False
    )
    transport = client.get_transport()
    if transport is None:
        raise RuntimeError('SSH transport not available')
    transport.set_keepalive(10)
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout, get_pty=False)
    output = stdout.read().decode(errors='ignore')
    error = stderr.read().decode(errors='ignore')
    exit_code = stdout.channel.recv_exit_status()
    client.close()
    return exit_code, output, error


def _run_telnet_command(host: str, port: int, username: str, password: str, command: str, timeout: int = 20):
    if not os.environ.get('ALLOW_TELNET', '').strip().lower() in {'1', 'true', 'yes'}:
        raise RuntimeError('Telnet is disabled')
    tn = telnetlib.Telnet(host, port, timeout=timeout)
    if username:
        tn.read_until(b'login: ', timeout=5)
        tn.write(username.encode('utf-8') + b'\n')
    if password:
        tn.read_until(b'Password: ', timeout=5)
        tn.write(password.encode('utf-8') + b'\n')
    tn.write(command.encode('utf-8') + b'\n')
    tn.write(b'exit\n')
    output = tn.read_all().decode(errors='ignore')
    tn.close()
    return 0, output, ''


def _test_ssh_connection(host: str, port: int, username: str, password: str, timeout: int = 8, ssh_key: str | None = None, ssh_key_passphrase: str | None = None) -> None:
    try:
        import paramiko
    except Exception:
        raise RuntimeError('SSH support is not installed on the server')

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    pkey = _load_paramiko_private_key(paramiko, ssh_key, ssh_key_passphrase) if ssh_key else None
    client.connect(
        hostname=host,
        port=port,
        username=username,
        password=None if pkey else password,
        pkey=pkey,
        timeout=timeout,
        banner_timeout=timeout,
        auth_timeout=timeout,
        look_for_keys=False,
        allow_agent=False
    )
    client.close()


def _test_tcp_connection(host: str, port: int, timeout: int = 8) -> None:
    sock = socket.create_connection((host, port), timeout=timeout)
    sock.close()


def _test_telnet_connection(host: str, port: int, timeout: int = 8) -> None:
    if not os.environ.get('ALLOW_TELNET', '').strip().lower() in {'1', 'true', 'yes'}:
        raise RuntimeError('Telnet is disabled')
    tn = telnetlib.Telnet(host, port, timeout=timeout)
    tn.close()
