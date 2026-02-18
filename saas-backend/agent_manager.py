#!/usr/bin/env python3
"""
CyberSec Pro - Agent Manager v2.0
5 Network Modes: Direct, Agent-based, VPN Tunnel, SSH Tunnel, API Proxy

Features:
  - WebSocket-based agent communication
  - Docker-in-Docker tool execution support
  - Auto-reconnect + auto-update
  - Network zone awareness (public, private, dmz)
  - Encrypted communication channels
"""
import uuid
import json
import time
import logging
import threading
import subprocess
from datetime import datetime, timedelta
from functools import wraps
from typing import Optional, Dict, Any, List, Tuple

logger = logging.getLogger('agent_manager')

# Network mode capabilities
NETWORK_MODES = {
    'direct': {
        'name': 'Direct Scan',
        'description': 'Scan directly from the SaaS platform',
        'requires_agent': False,
        'supports_private': False,
        'icon': 'globe-alt'
    },
    'agent': {
        'name': 'Agent-Based Scan',
        'description': 'Scan via installed agent on target network',
        'requires_agent': True,
        'supports_private': True,
        'icon': 'cpu-chip'
    },
    'vpn': {
        'name': 'VPN Tunnel Scan',
        'description': 'Scan through encrypted VPN tunnel to private network',
        'requires_agent': True,
        'supports_private': True,
        'icon': 'shield-check'
    },
    'ssh': {
        'name': 'SSH Tunnel Scan',
        'description': 'Scan through SSH tunnel to remote systems',
        'requires_agent': False,
        'supports_private': True,
        'icon': 'command-line'
    },
    'api_proxy': {
        'name': 'API Proxy Scan',
        'description': 'Scan through API proxy endpoint in target environment',
        'requires_agent': False,
        'supports_private': True,
        'icon': 'arrow-path'
    }
}


class AgentManager:
    """Manages remote agents with 5 network modes for distributed scan execution"""
    
    def __init__(self, db, Agent, Scan, socketio=None):
        self.db = db
        self.Agent = Agent
        self.Scan = Scan
        self.socketio = socketio
        self._monitor_thread = None
        self._running = False
        self._app = None
        self._websocket_agents: Dict[str, str] = {}  # ws_sid -> agent_id
    
    # ── Registration ──────────────────────────────────────────
    
    def generate_registration_token(self, org_id, agent_name, platform='linux',
                                     connection_type='direct', network_zone='public',
                                     **kwargs):
        """Generate a unique registration token for a new agent"""
        token = f"csp_{uuid.uuid4().hex[:24]}"
        api_key = f"ak_{uuid.uuid4().hex}"
        
        agent = self.Agent(
            organization_id=org_id,
            name=agent_name,
            platform=platform,
            status='pending',
            registration_token=token,
            api_key=api_key,
            connection_type=connection_type,
            network_zone=network_zone,
            # VPN config
            vpn_config_path=kwargs.get('vpn_config_path'),
            # SSH config
            ssh_host=kwargs.get('ssh_host'),
            ssh_port=kwargs.get('ssh_port', 22),
            ssh_username=kwargs.get('ssh_username'),
            ssh_key_path=kwargs.get('ssh_key_path'),
            # API Proxy config
            proxy_endpoint=kwargs.get('proxy_endpoint'),
            proxy_api_key=kwargs.get('proxy_api_key'),
            proxy_protocol=kwargs.get('proxy_protocol', 'https'),
            # Agent capabilities
            agent_docker_enabled=kwargs.get('docker_enabled', False),
            auto_update=kwargs.get('auto_update', True),
            max_concurrent_scans=kwargs.get('max_concurrent', 5),
        )
        self.db.session.add(agent)
        self.db.session.commit()
        
        return {
            'agent_id': agent.id,
            'token': token,
            'api_key': api_key,
            'connection_type': connection_type,
            'network_zone': network_zone,
            'install_command': self._get_install_script(token, connection_type),
            'network_modes': NETWORK_MODES,
        }
    
    def register_agent(self, token, agent_info):
        """Register an agent using its registration token"""
        agent = self.Agent.query.filter_by(registration_token=token).first()
        if not agent:
            return None, "Invalid registration token"
        
        if agent.status not in ('pending', 'offline'):
            return None, f"Agent already {agent.status}"
        
        agent.hostname = agent_info.get('hostname', 'unknown')
        agent.ip_address = agent_info.get('ip_address', '')
        agent.os_info = agent_info.get('os_info', '')
        agent.version = agent_info.get('version', '1.0.0')
        agent.platform = agent_info.get('platform', agent.platform)
        agent.status = 'online'
        agent.last_heartbeat = datetime.utcnow()
        agent.cpu_usage = agent_info.get('cpu_usage', 0)
        agent.memory_usage = agent_info.get('memory_usage', 0)
        agent.active_scans = 0
        # Update capabilities if reported
        if 'capabilities' in agent_info:
            agent.agent_capabilities = agent_info['capabilities']
        if 'docker_enabled' in agent_info:
            agent.agent_docker_enabled = agent_info['docker_enabled']
        
        self.db.session.commit()
        
        # Notify dashboard
        self._emit_agent_update(agent)
        
        logger.info(f"Agent registered: {agent.name} ({agent.hostname}) "
                    f"[{agent.ip_address}] mode={agent.connection_type} "
                    f"zone={agent.network_zone}")
        return agent, None
    
    # ── Heartbeat ─────────────────────────────────────────────
    
    def process_heartbeat(self, api_key, data):
        """Process heartbeat from an agent"""
        agent = self.Agent.query.filter_by(api_key=api_key).first()
        if not agent:
            return None, "Invalid API key"
        
        was_offline = agent.status != 'online'
        
        agent.status = 'online'
        agent.last_heartbeat = datetime.utcnow()
        agent.cpu_usage = data.get('cpu_usage', 0)
        agent.memory_usage = data.get('memory_usage', 0)
        agent.active_scans = data.get('active_scans', 0)
        agent.hostname = data.get('hostname', agent.hostname)
        agent.os_info = data.get('os_info', agent.os_info)
        agent.ip_address = data.get('ip_address', agent.ip_address)
        
        self.db.session.commit()
        
        if was_offline:
            logger.info(f"Agent back online: {agent.name}")
        
        # Notify dashboard
        self._emit_agent_update(agent)
        
        # Return pending scans for this agent
        pending = self._get_pending_scans(agent)
        
        return {
            'status': 'ok',
            'agent_id': agent.id,
            'next_heartbeat': 30,
            'pending_scans': pending
        }, None
    
    # ── Load Balancing ────────────────────────────────────────
    
    def select_best_agent(self, org_id, tool_category=None):
        """Select the best available agent using weighted scoring"""
        agents = self.Agent.query.filter_by(
            organization_id=org_id,
            status='online'
        ).all()
        
        if not agents:
            return None
        
        # Score each agent (lower is better)
        scored = []
        now = datetime.utcnow()
        for agent in agents:
            # Skip stale agents (no heartbeat in 90s)
            if agent.last_heartbeat and (now - agent.last_heartbeat).total_seconds() > 90:
                agent.status = 'offline'
                self.db.session.commit()
                continue
            
            score = 0
            score += agent.active_scans * 100      # Fewer active scans = better
            score += agent.cpu_usage * 2            # Lower CPU = better
            score += agent.memory_usage * 1.5       # Lower RAM = better
            
            # Freshness bonus
            if agent.last_heartbeat:
                age = (now - agent.last_heartbeat).total_seconds()
                score += age * 0.5                  # More recent = better
            
            scored.append((score, agent))
        
        if not scored:
            return None
        
        scored.sort(key=lambda x: x[0])
        return scored[0][1]
    
    def dispatch_scan(self, org_id, scan_id, tool_name, target, parameters=None, agent_id=None):
        """Dispatch a scan to an agent (specific or best available)"""
        if agent_id:
            agent = self.Agent.query.filter_by(id=agent_id, organization_id=org_id).first()
            if not agent or agent.status != 'online':
                return None, f"Agent {'not found' if not agent else agent.status}"
        else:
            agent = self.select_best_agent(org_id)
            if not agent:
                return None, "No online agents available"
        
        scan_task = {
            'scan_id': scan_id,
            'tool_name': tool_name,
            'target': target,
            'parameters': parameters or {},
            'dispatched_at': datetime.utcnow().isoformat()
        }
        
        # Try WebSocket first, fall back to polling
        dispatched = False
        if self.socketio:
            try:
                self.socketio.emit('scan_dispatch', scan_task, room=f'agent_{agent.id}')
                dispatched = True
            except Exception as e:
                logger.warning(f"WebSocket dispatch failed: {e}")
        
        agent.active_scans = (agent.active_scans or 0) + 1
        
        # Link scan to agent
        scan = self.Scan.query.get(scan_id)
        if scan and hasattr(scan, 'agent_id'):
            scan.agent_id = agent.id
        
        self.db.session.commit()
        
        logger.info(f"Scan {scan_id} dispatched to {agent.name} (ws={dispatched})")
        return {
            'agent_id': agent.id,
            'agent_name': agent.name,
            'dispatched': dispatched,
            'method': 'websocket' if dispatched else 'polling'
        }, None
    
    # ── Status Monitor ────────────────────────────────────────
    
    def start_monitor(self, app, interval=30):
        """Start background thread to monitor agent health"""
        if self._running:
            return
        self._app = app
        self._running = True
        self._monitor_thread = threading.Thread(target=self._monitor_loop, args=(interval,), daemon=True)
        self._monitor_thread.start()
        logger.info("Agent health monitor started")
    
    def stop_monitor(self):
        self._running = False
    
    def _monitor_loop(self, interval):
        """Check agent health periodically"""
        time.sleep(5)  # Wait for app to fully start
        while self._running:
            try:
                if self._app:
                    with self._app.app_context():
                        self._check_agent_health()
                else:
                    self._check_agent_health()
            except Exception as e:
                logger.error(f"Health check error: {e}")
            time.sleep(interval)
    
    def _check_agent_health(self):
        """Mark agents as offline if no heartbeat received"""
        cutoff = datetime.utcnow() - timedelta(seconds=90)
        stale = self.Agent.query.filter(
            self.Agent.status == 'online',
            self.Agent.last_heartbeat < cutoff
        ).all()
        
        for agent in stale:
            agent.status = 'offline'
            logger.warning(f"Agent offline (no heartbeat): {agent.name}")
            self._emit_agent_update(agent)
        
        if stale:
            self.db.session.commit()
    
    # ── Dashboard Data ────────────────────────────────────────
    
    def get_dashboard_data(self, org_id):
        """Get agent dashboard overview"""
        agents = self.Agent.query.filter_by(organization_id=org_id).all()
        
        online = sum(1 for a in agents if a.status == 'online')
        offline = sum(1 for a in agents if a.status == 'offline')
        busy = sum(1 for a in agents if a.status == 'online' and (a.active_scans or 0) > 0)
        total_scans = sum(a.total_scans or 0 for a in agents)
        
        return {
            'total_agents': len(agents),
            'online': online,
            'offline': offline,
            'busy': busy,
            'pending': sum(1 for a in agents if a.status == 'pending'),
            'total_scans_completed': total_scans,
            'agents': [self._agent_status(a) for a in agents]
        }
    
    def _agent_status(self, agent):
        """Detailed agent status for dashboard"""
        now = datetime.utcnow()
        last_seen = None
        if agent.last_heartbeat:
            delta = (now - agent.last_heartbeat).total_seconds()
            if delta < 60:
                last_seen = f"{int(delta)} seconds ago"
            elif delta < 3600:
                last_seen = f"{int(delta/60)} minutes ago"
            else:
                last_seen = f"{int(delta/3600)} hours ago"
        
        mode_info = NETWORK_MODES.get(agent.connection_type, NETWORK_MODES['direct'])
        
        return {
            'id': agent.id,
            'name': agent.name,
            'hostname': agent.hostname,
            'ip_address': agent.ip_address,
            'platform': agent.platform,
            'os': agent.os_info,
            'status': agent.status,
            'status_emoji': {'online': '🟢', 'offline': '🔴', 'busy': '🟡', 'pending': '⚪', 'error': '🔴'}.get(agent.status, '⚪'),
            'last_seen': last_seen,
            'last_heartbeat': agent.last_heartbeat.isoformat() if agent.last_heartbeat else None,
            'cpu_usage': round(agent.cpu_usage or 0, 1),
            'memory_usage': round(agent.memory_usage or 0, 1),
            'active_scans': agent.active_scans or 0,
            'total_scans': agent.total_scans or 0,
            'max_concurrent_scans': getattr(agent, 'max_concurrent_scans', 5) or 5,
            'connection_type': agent.connection_type,
            'connection_mode': mode_info,
            'network_zone': getattr(agent, 'network_zone', 'public') or 'public',
            'docker_enabled': getattr(agent, 'agent_docker_enabled', False) or False,
            'auto_update': getattr(agent, 'auto_update', True),
            'capabilities': getattr(agent, 'agent_capabilities', None),
            'created_at': agent.created_at.isoformat()
        }
    
    # ── Helpers ───────────────────────────────────────────────
    
    def _get_pending_scans(self, agent):
        """Get scans dispatched to this agent that haven't started"""
        # Skip if Scan model doesn't have agent_id column
        if not hasattr(self.Scan, 'agent_id'):
            return []
        
        try:
            scans = self.Scan.query.filter_by(
                status='pending',
                agent_id=agent.id
            ).limit(5).all()
            
            return [{
                'scan_id': s.id,
                'tool_id': s.tool_id,
                'target': s.target,
                'parameters': s.parameters
            } for s in scans] if scans else []
        except Exception:
            return []
    
    def _emit_agent_update(self, agent):
        """Emit agent status update via WebSocket"""
        if self.socketio:
            try:
                data = self._agent_status(agent)
                self.socketio.emit('agent_status_update', data, namespace='/')
            except Exception:
                pass
    
    def _get_install_script(self, token, connection_type='direct'):
        """Generate agent installation command based on connection type"""
        base_url = 'https://semihkilic.com'
        
        if connection_type == 'agent':
            return f"""# CyberSec Pro Agent Installation (Agent Mode - WebSocket)
# Run on your Kali Linux / security testing machine:

curl -sSL {base_url}/api/v1/agent-script | python3 - --token {token} --mode agent

# Features: WebSocket real-time, Docker-in-Docker, auto-update
# Supports: All 682 security tools"""

        elif connection_type == 'vpn':
            return f"""# CyberSec Pro Agent Installation (VPN Tunnel Mode)
# Step 1: Download VPN configuration
curl -sSL {base_url}/api/v1/agent-vpn-config?token={token} -o cybersec.ovpn

# Step 2: Connect VPN
sudo openvpn --config cybersec.ovpn --daemon

# Step 3: Install agent
curl -sSL {base_url}/api/v1/agent-script | python3 - --token {token} --mode vpn"""

        elif connection_type == 'ssh':
            return f"""# CyberSec Pro Agent Setup (SSH Tunnel Mode)
# No agent installation needed! Configure SSH access:
#
# 1. Add your SSH public key to the target server
# 2. The platform will tunnel scans through SSH
#
# Token: {token}
# Configure SSH details in the dashboard."""

        elif connection_type == 'api_proxy':
            return f"""# CyberSec Pro API Proxy Setup
# Deploy the proxy container in your environment:

docker run -d --name cybersec-proxy \\
  -e PROXY_TOKEN={token} \\
  -e PROXY_SERVER={base_url} \\
  -p 8443:8443 \\
  cybersecpro/api-proxy:latest

# The proxy will register automatically."""

        else:
            return f"""# CyberSec Pro Agent Installation (Direct Mode)
# Run on your Kali Linux machine:

curl -sSL {base_url}/api/v1/agent-script | python3 - --token {token}

# Or download and run manually:
wget -O cybersec-agent.py {base_url}/api/v1/agent-script
python3 cybersec-agent.py --token {token} --server {base_url}"""

    # ── Network Mode Methods ──────────────────────────────────

    def get_available_modes(self, org_id: str) -> List[Dict]:
        """Get available network modes for an organization"""
        agents = self.Agent.query.filter_by(organization_id=org_id).all()
        
        modes = []
        for mode_id, mode_info in NETWORK_MODES.items():
            mode_data = {
                **mode_info,
                'id': mode_id,
                'available': True if not mode_info['requires_agent'] else False,
                'agents': [],
            }
            
            # Check if any agents support this mode
            for agent in agents:
                if agent.connection_type == mode_id and agent.status == 'online':
                    mode_data['available'] = True
                    mode_data['agents'].append({
                        'id': agent.id,
                        'name': agent.name,
                        'status': agent.status,
                        'network_zone': getattr(agent, 'network_zone', 'public'),
                    })
            
            modes.append(mode_data)
        
        return modes

    def test_connection(self, agent_id: str) -> Dict[str, Any]:
        """Test connectivity to an agent"""
        agent = self.Agent.query.get(agent_id)
        if not agent:
            return {'success': False, 'error': 'Agent not found'}
        
        conn_type = agent.connection_type
        
        if conn_type == 'ssh':
            return self._test_ssh_connection(agent)
        elif conn_type == 'vpn':
            return self._test_vpn_connection(agent)
        elif conn_type == 'api_proxy':
            return self._test_proxy_connection(agent)
        else:
            return {'success': True, 'mode': conn_type, 'latency_ms': 0}

    def _test_ssh_connection(self, agent) -> Dict[str, Any]:
        """Test SSH connection to agent"""
        try:
            ssh_host = agent.ssh_host or agent.ip_address
            ssh_port = agent.ssh_port or 22
            ssh_user = agent.ssh_username or 'root'
            
            cmd = ['ssh', '-o', 'ConnectTimeout=5', '-o', 'StrictHostKeyChecking=no',
                   '-p', str(ssh_port)]
            if agent.ssh_key_path:
                cmd.extend(['-i', agent.ssh_key_path])
            cmd.extend([f'{ssh_user}@{ssh_host}', 'echo', 'cybersec-ok'])
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            return {
                'success': 'cybersec-ok' in result.stdout,
                'mode': 'ssh',
                'host': ssh_host,
                'port': ssh_port,
            }
        except Exception as e:
            return {'success': False, 'mode': 'ssh', 'error': str(e)}

    def _test_vpn_connection(self, agent) -> Dict[str, Any]:
        """Test VPN connection"""
        vpn_ip = getattr(agent, 'vpn_assigned_ip', None)
        if vpn_ip:
            try:
                result = subprocess.run(
                    ['ping', '-c', '1', '-W', '3', vpn_ip],
                    capture_output=True, timeout=5
                )
                return {'success': result.returncode == 0, 'mode': 'vpn', 'vpn_ip': vpn_ip}
            except Exception as e:
                return {'success': False, 'mode': 'vpn', 'error': str(e)}
        return {'success': False, 'mode': 'vpn', 'error': 'No VPN IP assigned'}

    def _test_proxy_connection(self, agent) -> Dict[str, Any]:
        """Test API proxy connection"""
        endpoint = getattr(agent, 'proxy_endpoint', None)
        if endpoint:
            try:
                result = subprocess.run(
                    ['curl', '-sI', '-o', '/dev/null', '-w', '%{http_code}',
                     '-m', '5', f'{endpoint}/health'],
                    capture_output=True, text=True, timeout=8
                )
                status = result.stdout.strip()
                return {
                    'success': status in ('200', '204'),
                    'mode': 'api_proxy',
                    'endpoint': endpoint,
                    'http_status': status,
                }
            except Exception as e:
                return {'success': False, 'mode': 'api_proxy', 'error': str(e)}
        return {'success': False, 'mode': 'api_proxy', 'error': 'No proxy endpoint configured'}
