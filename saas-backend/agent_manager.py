#!/usr/bin/env python3
"""
CyberSec Pro - Agent Manager
Server-side agent management: registration, heartbeat tracking, load balancing, scan dispatch
"""
import uuid
import json
import time
import logging
import threading
from datetime import datetime, timedelta
from functools import wraps

logger = logging.getLogger('agent_manager')


class AgentManager:
    """Manages remote Kali Linux agents for distributed scan execution"""
    
    def __init__(self, db, Agent, Scan, socketio=None):
        self.db = db
        self.Agent = Agent
        self.Scan = Scan
        self.socketio = socketio
        self._monitor_thread = None
        self._running = False
        self._app = None
    
    # ── Registration ──────────────────────────────────────────
    
    def generate_registration_token(self, org_id, agent_name, platform='linux'):
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
            connection_type='direct'
        )
        self.db.session.add(agent)
        self.db.session.commit()
        
        return {
            'agent_id': agent.id,
            'token': token,
            'api_key': api_key,
            'install_command': self._get_install_script(token)
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
        
        self.db.session.commit()
        
        # Notify dashboard
        self._emit_agent_update(agent)
        
        logger.info(f"Agent registered: {agent.name} ({agent.hostname}) [{agent.ip_address}]")
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
                last_seen = f"{int(delta)} saniye önce"
            elif delta < 3600:
                last_seen = f"{int(delta/60)} dakika önce"
            else:
                last_seen = f"{int(delta/3600)} saat önce"
        
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
            'connection_type': agent.connection_type,
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
    
    def _get_install_script(self, token):
        """Generate agent installation command"""
        base_url = 'https://cybersecpro.semihkilic.com'
        return f"""# CyberSec Pro Agent Installation
# Run on your Kali Linux machine:

curl -sSL {base_url}/api/v1/agent-script | python3 - --token {token}

# Or download and run manually:
wget -O cybersec-agent.py {base_url}/api/v1/agent-script
python3 cybersec-agent.py --token {token} --server {base_url}"""
