import os
import subprocess
from flask import Blueprint, jsonify, request

from services.security import token_required, rate_limit, _require_json, _audit_log, _clamp_lines
from services.servers_store import _load_servers, _save_servers
from services.terminal import (
    _terminal_allowed,
    _decrypt_secret_with_rotation,
    _encrypt_secret,
    _run_local_command,
    _run_ssh_command,
    _run_telnet_command,
    _test_ssh_connection,
    _test_tcp_connection,
    _test_telnet_connection,
)

terminal_bp = Blueprint('terminal', __name__)


@terminal_bp.route('/api/terminal/connect', methods=['POST'])
@token_required
@rate_limit(limit=60, window_sec=60)
def terminal_connect(current_user):
    json_error = _require_json()
    if json_error:
        return json_error
    data = request.get_json() or {}
    protocol = (data.get('protocol') or 'local').lower()
    if protocol not in {'local', 'ssh', 'telnet', 'rdp', 'ftp'}:
        _audit_log('terminal_connect', current_user, protocol=protocol, status='denied', reason='unsupported_protocol')
        return jsonify({'error': 'Unsupported protocol'}), 400
    if protocol == 'local' and not os.environ.get('ALLOW_LOCAL_TERMINAL', '').strip().lower() in {'1', 'true', 'yes'}:
        _audit_log('terminal_connect', current_user, protocol=protocol, status='denied', reason='local_disabled')
        return jsonify({'error': 'Local execution disabled'}), 403
    host = (data.get('host') or '').strip()
    default_ports = {'ssh': 22, 'telnet': 23, 'rdp': 3389, 'ftp': 21, 'local': 0}
    port = int(data.get('port') or default_ports.get(protocol, 0))
    username = (data.get('username') or 'root').strip()
    password = data.get('password') or ''
    ssh_key = data.get('ssh_key') or ''
    ssh_key_passphrase = data.get('ssh_key_passphrase') or ''
    server_id = data.get('server_id')

    if server_id is not None:
        try:
            server_id = int(server_id)
        except Exception:
            return jsonify({'error': 'Invalid server id'}), 400
        servers = _load_servers()
        server = next((s for s in servers if s.get('id') == server_id), None)
        if not server:
            return jsonify({'error': 'Server not found'}), 404
        protocol = (server.get('protocol') or protocol).lower()
        host = (server.get('host') or host).strip()
        port = int(server.get('port') or default_ports.get(protocol, 0))
        username = (server.get('username') or username).strip()
        password, rotated = _decrypt_secret_with_rotation(server.get('password', ''))
        if rotated:
            server['password'] = _encrypt_secret(password)
            _save_servers(servers)

    if protocol in ('ssh', 'telnet', 'rdp', 'ftp') and not host:
        _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='denied', reason='host_required')
        return jsonify({'error': 'Host is required'}), 400

    if len(username) > 64:
        _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='denied', reason='username_too_long')
        return jsonify({'error': 'Username is too long'}), 400
    if len(ssh_key) > 8192:
        _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='denied', reason='ssh_key_too_long')
        return jsonify({'error': 'SSH key is too long'}), 400
    if len(ssh_key_passphrase) > 256:
        _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='denied', reason='ssh_key_passphrase_too_long')
        return jsonify({'error': 'SSH key passphrase is too long'}), 400
    if host and len(host) > 255:
        _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='denied', reason='host_too_long')
        return jsonify({'error': 'Host is too long'}), 400

    if protocol in ('ssh', 'telnet', 'rdp', 'ftp') and not (1 <= port <= 65535):
        _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='denied', reason='invalid_port')
        return jsonify({'error': 'Invalid port'}), 400

    if protocol in ('ssh', 'telnet', 'rdp', 'ftp') and not _terminal_allowed(host):
        _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='denied', reason='host_not_allowed')
        return jsonify({'error': 'Host not allowed'}), 403

    try:
        if protocol == 'local':
            _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='ok')
            return jsonify({'connected': True})
        if protocol == 'ssh':
            _test_ssh_connection(host, port, username, password, ssh_key=ssh_key, ssh_key_passphrase=ssh_key_passphrase)
            _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='ok')
            return jsonify({'connected': True})
        if protocol == 'telnet':
            _test_telnet_connection(host, port)
            _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='ok')
            return jsonify({'connected': True})
        if protocol == 'rdp':
            _test_tcp_connection(host, port)
            _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='ok')
            return jsonify({'connected': True})
        if protocol == 'ftp':
            _test_tcp_connection(host, port)
            _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='ok')
            return jsonify({'connected': True})
        return jsonify({'error': 'Unsupported protocol'}), 400
    except Exception as e:
        _audit_log('terminal_connect', current_user, protocol=protocol, host=host, port=port, status='error', error=str(e))
        return jsonify({'connected': False, 'error': str(e)}), 500


@terminal_bp.route('/api/terminal/execute', methods=['POST'])
@token_required
@rate_limit(limit=120, window_sec=60)
def terminal_execute(current_user):
    json_error = _require_json()
    if json_error:
        return json_error
    data = request.get_json() or {}
    command = (data.get('command') or '').strip()
    protocol = (data.get('protocol') or 'local').lower()
    if protocol not in {'local', 'ssh', 'telnet', 'rdp', 'ftp'}:
        _audit_log('terminal_execute', current_user, protocol=protocol, status='denied', reason='unsupported_protocol')
        return jsonify({'error': 'Unsupported protocol'}), 400
    if protocol == 'local' and not os.environ.get('ALLOW_LOCAL_TERMINAL', '').strip().lower() in {'1', 'true', 'yes'}:
        _audit_log('terminal_execute', current_user, protocol=protocol, status='denied', reason='local_disabled')
        return jsonify({'error': 'Local execution disabled'}), 403
    host = (data.get('host') or '').strip()
    default_ports = {'ssh': 22, 'telnet': 23, 'rdp': 3389, 'ftp': 21, 'local': 0}
    port = int(data.get('port') or default_ports.get(protocol, 0))
    username = (data.get('username') or 'root').strip()
    password = data.get('password') or ''
    ssh_key = data.get('ssh_key') or ''
    ssh_key_passphrase = data.get('ssh_key_passphrase') or ''
    server_id = data.get('server_id')

    if server_id is not None:
        try:
            server_id = int(server_id)
        except Exception:
            return jsonify({'error': 'Invalid server id'}), 400
        servers = _load_servers()
        server = next((s for s in servers if s.get('id') == server_id), None)
        if not server:
            return jsonify({'error': 'Server not found'}), 404
        protocol = (server.get('protocol') or protocol).lower()
        host = (server.get('host') or host).strip()
        port = int(server.get('port') or default_ports.get(protocol, 0))
        username = (server.get('username') or username).strip()
        password, rotated = _decrypt_secret_with_rotation(server.get('password', ''))
        if rotated:
            server['password'] = _encrypt_secret(password)
            _save_servers(servers)

    if not command:
        _audit_log('terminal_execute', current_user, protocol=protocol, host=host, port=port, status='denied', reason='command_required')
        return jsonify({'error': 'Command is required'}), 400
    if len(command) > 2000:
        _audit_log('terminal_execute', current_user, protocol=protocol, host=host, port=port, status='denied', reason='command_too_long')
        return jsonify({'error': 'Command is too long'}), 400
    if any(ch in command for ch in ['\x00', '\r']):
        _audit_log('terminal_execute', current_user, protocol=protocol, host=host, port=port, status='denied', reason='invalid_command_chars')
        return jsonify({'error': 'Invalid command'}), 400

    if protocol in ('ssh', 'telnet', 'rdp', 'ftp') and not host:
        _audit_log('terminal_execute', current_user, protocol=protocol, host=host, port=port, status='denied', reason='host_required')
        return jsonify({'error': 'Host is required'}), 400

    if len(username) > 64:
        _audit_log('terminal_execute', current_user, protocol=protocol, host=host, port=port, status='denied', reason='username_too_long')
        return jsonify({'error': 'Username is too long'}), 400
    if len(ssh_key) > 8192:
        _audit_log('terminal_execute', current_user, protocol=protocol, host=host, port=port, status='denied', reason='ssh_key_too_long')
        return jsonify({'error': 'SSH key is too long'}), 400
    if len(ssh_key_passphrase) > 256:
        _audit_log('terminal_execute', current_user, protocol=protocol, host=host, port=port, status='denied', reason='ssh_key_passphrase_too_long')
        return jsonify({'error': 'SSH key passphrase is too long'}), 400
    if host and len(host) > 255:
        _audit_log('terminal_execute', current_user, protocol=protocol, host=host, port=port, status='denied', reason='host_too_long')
        return jsonify({'error': 'Host is too long'}), 400

    if protocol in ('ssh', 'telnet', 'rdp', 'ftp') and not (1 <= port <= 65535):
        _audit_log('terminal_execute', current_user, protocol=protocol, host=host, port=port, status='denied', reason='invalid_port')
        return jsonify({'error': 'Invalid port'}), 400

    if protocol in ('ssh', 'telnet', 'rdp', 'ftp') and not _terminal_allowed(host):
        _audit_log('terminal_execute', current_user, protocol=protocol, host=host, port=port, status='denied', reason='host_not_allowed')
        return jsonify({'error': 'Host not allowed'}), 403

    try:
        if protocol == 'local':
            exit_code, output, error = _run_local_command(command)
        elif protocol == 'ssh':
            exit_code, output, error = _run_ssh_command(host, port, username, password, command, ssh_key=ssh_key, ssh_key_passphrase=ssh_key_passphrase)
        elif protocol == 'telnet':
            exit_code, output, error = _run_telnet_command(host, port, username, password, command)
        elif protocol == 'rdp':
            return jsonify({'error': 'RDP does not support command execution'}), 400
        elif protocol == 'ftp':
            return jsonify({'error': 'FTP does not support command execution'}), 400
        else:
            return jsonify({'error': 'Unsupported protocol'}), 400

        output_lines = (output or '').splitlines() or ['']
        error_lines = (error or '').splitlines()
        if error_lines:
            output_lines += [''] + error_lines

        output_lines, truncated = _clamp_lines(output_lines)
        _audit_log(
            'terminal_execute',
            current_user,
            protocol=protocol,
            host=host,
            port=port,
            status='ok',
            exit_code=exit_code,
            truncated=truncated
        )
        return jsonify({
            'output': output_lines,
            'exit_code': exit_code,
            'truncated': truncated
        })
    except subprocess.TimeoutExpired:
        _audit_log('terminal_execute', current_user, protocol=protocol, host=host, port=port, status='timeout')
        return jsonify({'error': 'Command timed out'}), 504
    except Exception as e:
        _audit_log('terminal_execute', current_user, protocol=protocol, host=host, port=port, status='error', error=str(e))
        return jsonify({'error': str(e)}), 500
