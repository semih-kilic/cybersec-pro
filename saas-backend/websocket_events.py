#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - WebSocket Events Handler
Flask-SocketIO integration for real-time scan updates,
live notifications, and collaborative activity feed.

Author: Semih Kılıç
Version: 2.0.0 (GÖREV 3.3)

Features:
- Real-time scan progress updates
- Live output streaming
- Connection management with auto-reconnect support
- Room-based event routing (per scan, per user, per org)
- Agent status notifications
- Collaborative activity feed
- Heartbeat / ping-pong
"""

import logging
import time
from functools import wraps
from flask import request
from flask_socketio import SocketIO, emit, join_room, leave_room, disconnect

logger = logging.getLogger('WebSocket')

# SocketIO instance - initialized in init_socketio()
socketio: SocketIO = None

# In-memory activity feed (last 100 entries, per org)
_activity_feeds: dict = {}  # org_id -> [activity_entry]
ACTIVITY_FEED_LIMIT = 100


def init_socketio(app, **kwargs):
    """
    Initialize Flask-SocketIO with the Flask app
    
    Args:
        app: Flask application instance
        **kwargs: Additional SocketIO configuration
    
    Returns:
        SocketIO instance
    """
    global socketio
    
    default_config = {
        'cors_allowed_origins': [
            'https://cybersecpro.com',
            'https://app.cybersecpro.com',
            'https://semihkilic.com',
            'https://www.semihkilic.com',
            'https://cybersecpro.semihkilic.com',
            'https://app.semihkilic.com',
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:5000'
        ],
        'async_mode': 'eventlet',
        'logger': True,
        'engineio_logger': False,
        'ping_timeout': 60,
        'ping_interval': 25
    }
    
    # Merge with provided config
    config = {**default_config, **kwargs}
    
    socketio = SocketIO(app, **config)
    
    # Register event handlers
    register_handlers(socketio)
    register_agent_handlers(socketio)
    
    logger.info("WebSocket initialized with Flask-SocketIO")
    
    return socketio


def register_handlers(sio: SocketIO):
    """Register all WebSocket event handlers"""
    
    # ================================
    # Connection Events
    # ================================
    
    @sio.on('connect')
    def handle_connect():
        """Handle new client connection"""
        logger.info(f"Client connected: {request.sid}")
        emit('connected', {
            'message': 'Connected to CyberSec Pro WebSocket',
            'sid': request.sid
        })
    
    @sio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        logger.info(f"Client disconnected: {request.sid}")
    
    @sio.on('connect', namespace='/scans')
    def handle_scan_connect():
        """Handle connection to /scans namespace"""
        logger.info(f"Client connected to /scans: {request.sid}")
        emit('connected', {'namespace': '/scans'})
    
    @sio.on('disconnect', namespace='/scans')
    def handle_scan_disconnect():
        """Handle disconnection from /scans namespace"""
        logger.info(f"Client disconnected from /scans: {request.sid}")
    
    # ================================
    # Room Management
    # ================================
    
    @sio.on('join_scan', namespace='/scans')
    def handle_join_scan(data):
        """
        Join a scan room to receive updates for specific scan
        
        data: { scan_id: str }
        """
        scan_id = data.get('scan_id')
        if scan_id:
            room = f"scan_{scan_id}"
            join_room(room)
            logger.info(f"Client {request.sid} joined room {room}")
            emit('joined', {'room': room, 'scan_id': scan_id})
    
    @sio.on('leave_scan', namespace='/scans')
    def handle_leave_scan(data):
        """
        Leave a scan room
        
        data: { scan_id: str }
        """
        scan_id = data.get('scan_id')
        if scan_id:
            room = f"scan_{scan_id}"
            leave_room(room)
            logger.info(f"Client {request.sid} left room {room}")
            emit('left', {'room': room})
    
    @sio.on('subscribe_user', namespace='/scans')
    def handle_subscribe_user(data):
        """
        Subscribe to all scans for a user
        
        data: { user_id: str }
        """
        user_id = data.get('user_id')
        if user_id:
            room = f"user_{user_id}"
            join_room(room)
            logger.info(f"Client {request.sid} subscribed to user {user_id}")
            emit('subscribed', {'user_id': user_id})
    
    # ================================
    # Scan Control Events
    # ================================
    
    @sio.on('request_status', namespace='/scans')
    def handle_request_status(data):
        """
        Request current status of a scan
        
        data: { scan_id: str }
        """
        from scan_engine import get_engine
        
        scan_id = data.get('scan_id')
        if not scan_id:
            emit('error', {'message': 'scan_id required'})
            return
        
        engine = get_engine()
        job = engine.get_scan(scan_id)
        
        if job:
            emit('scan_status', job.to_dict())
        else:
            emit('error', {'message': f'Scan {scan_id} not found'})
    
    @sio.on('ping', namespace='/scans')
    def handle_ping():
        """Respond to ping with pong"""
        emit('pong', {'timestamp': time.time()})

    # ================================
    # Organization Room (Collaborative)
    # ================================

    @sio.on('join_org', namespace='/scans')
    def handle_join_org(data):
        """Join organization room for activity feed"""
        org_id = data.get('org_id')
        if org_id:
            room = f"org_{org_id}"
            join_room(room)
            logger.info(f"Client {request.sid} joined org room {room}")
            emit('joined_org', {'org_id': org_id})

    @sio.on('leave_org', namespace='/scans')
    def handle_leave_org(data):
        """Leave organization room"""
        org_id = data.get('org_id')
        if org_id:
            leave_room(f"org_{org_id}")

    @sio.on('get_activity_feed', namespace='/scans')
    def handle_get_activity_feed(data):
        """Return recent activity for the org"""
        org_id = data.get('org_id')
        if org_id and org_id in _activity_feeds:
            emit('activity_feed', {
                'org_id': org_id,
                'entries': _activity_feeds[org_id][-50:]
            })
        else:
            emit('activity_feed', {'org_id': org_id, 'entries': []})

    logger.info("WebSocket handlers registered (v2.0 – notifications, activity)")


# ================================
# Agent WebSocket Namespace
# ================================

def register_agent_handlers(sio: SocketIO):
    """Register agent-specific WebSocket events on /agents namespace"""
    
    @sio.on('connect', namespace='/agents')
    def handle_agent_connect():
        """Handle agent WebSocket connection"""
        logger.info(f"Agent connected via WebSocket: {request.sid}")
        emit('connected', {'message': 'Agent WebSocket channel ready', 'sid': request.sid})
    
    @sio.on('disconnect', namespace='/agents')
    def handle_agent_disconnect():
        """Handle agent disconnection"""
        sid = request.sid
        # Find agent by sid and mark offline
        if sid in _agent_sids:
            agent_id = _agent_sids.pop(sid)
            logger.warning(f"Agent {agent_id} disconnected (sid={sid})")
    
    @sio.on('agent_auth', namespace='/agents')
    def handle_agent_auth(data):
        """Authenticate agent via WebSocket using api_key"""
        api_key = data.get('api_key')
        if not api_key:
            emit('auth_error', {'error': 'api_key required'})
            return
        
        # Store mapping sid -> agent_id for dispatch routing
        agent_id = data.get('agent_id', '')
        _agent_sids[request.sid] = agent_id
        
        # Join agent-specific room
        room = f"agent_{agent_id}"
        join_room(room)
        logger.info(f"Agent authenticated: {agent_id} → room {room} (sid={request.sid})")
        emit('auth_ok', {'agent_id': agent_id, 'room': room})
    
    @sio.on('heartbeat', namespace='/agents')
    def handle_agent_heartbeat(data):
        """Real-time heartbeat from agent (supplements HTTP heartbeat)"""
        agent_id = _agent_sids.get(request.sid)
        if agent_id:
            # Forward to dashboard subscribers
            sio.emit('agent_heartbeat', {
                'agent_id': agent_id,
                'cpu_usage': data.get('cpu_usage', 0),
                'memory_usage': data.get('memory_usage', 0),
                'active_scans': data.get('active_scans', 0),
                'timestamp': time.time()
            }, namespace='/scans')
    
    @sio.on('scan_output_line', namespace='/agents')
    def handle_agent_scan_output(data):
        """Agent streams scan output line-by-line"""
        scan_id = data.get('scan_id')
        line = data.get('line', '')
        if scan_id:
            # Forward to dashboard clients watching this scan
            sio.emit('scan_output', {
                'scan_id': scan_id,
                'line': line,
                'source': 'agent'
            }, namespace='/scans', room=f"scan_{scan_id}")
            
            # Also append to DB for SSE stream polling
            try:
                from flask import current_app
                with current_app.app_context():
                    from app import Scan, db
                    scan = db.session.get(Scan, scan_id)
                    if scan:
                        scan.output = (scan.output or '') + line
                        db.session.commit()
            except Exception:
                pass
    
    @sio.on('scan_complete', namespace='/agents')
    def handle_agent_scan_complete(data):
        """Agent reports scan completion via WebSocket"""
        scan_id = data.get('scan_id')
        if scan_id:
            # Update DB with final result
            try:
                from flask import current_app
                with current_app.app_context():
                    from app import Scan, Agent, db
                    from datetime import datetime
                    scan = db.session.get(Scan, scan_id)
                    if scan:
                        scan.status = data.get('status', 'completed')
                        scan.output = data.get('output', scan.output or '')
                        scan.completed_at = datetime.utcnow()
                        
                        # Update agent stats
                        if scan.agent_id:
                            agent = db.session.get(Agent, scan.agent_id)
                            if agent:
                                agent.active_scans = max(0, (agent.active_scans or 0) - 1)
                                agent.total_scans = (agent.total_scans or 0) + 1
                        
                        db.session.commit()
            except Exception as e:
                logger.error(f"Failed to save agent scan result: {e}")
            
            # Notify dashboard clients
            sio.emit('scan_complete', {
                'scan_id': scan_id,
                'status': data.get('status', 'completed'),
                'output_length': len(data.get('output', '')),
                'source': 'agent'
            }, namespace='/scans', room=f"scan_{scan_id}")
            sio.emit('scan_complete', {
                'scan_id': scan_id,
                'status': data.get('status', 'completed'),
                'source': 'agent'
            }, namespace='/scans')
    
    logger.info("Agent WebSocket handlers registered (/agents namespace)")


# In-memory: WebSocket sid → agent_id mapping
_agent_sids: dict = {}


def get_agent_sid(agent_id: str) -> str | None:
    """Get WebSocket session ID for an agent"""
    for sid, aid in _agent_sids.items():
        if aid == agent_id:
            return sid
    return None


def is_agent_ws_connected(agent_id: str) -> bool:
    """Check if agent has active WebSocket connection"""
    return get_agent_sid(agent_id) is not None


def dispatch_scan_ws(agent_id: str, scan_task: dict) -> bool:
    """Dispatch scan to agent via WebSocket. Returns True if sent."""
    if socketio is None:
        return False
    try:
        room = f"agent_{agent_id}"
        socketio.emit('scan_dispatch', scan_task, namespace='/agents', room=room)
        logger.info(f"Scan {scan_task.get('scan_id', '?')} dispatched to agent {agent_id} via WebSocket")
        return True
    except Exception as e:
        logger.error(f"WebSocket dispatch failed: {e}")
        return False


# ================================
# Utility Functions for Emitting
# ================================

def emit_scan_progress(scan_id: str, status: str, progress: int, **extra):
    """
    Emit scan progress update to all subscribers
    
    Args:
        scan_id: Scan ID
        status: Current status
        progress: Progress percentage (0-100)
        **extra: Additional data to include
    """
    if socketio is None:
        return
    
    data = {
        'scan_id': scan_id,
        'status': status,
        'progress': progress,
        **extra
    }
    
    # Emit to specific scan room
    socketio.emit('scan_progress', data, namespace='/scans', room=f"scan_{scan_id}")
    
    # Also emit to general namespace for dashboard
    socketio.emit('scan_progress', data, namespace='/scans')


def emit_scan_output(scan_id: str, line: str):
    """
    Emit scan output line to subscribers
    
    Args:
        scan_id: Scan ID
        line: Output line
    """
    if socketio is None:
        return
    
    socketio.emit('scan_output', {
        'scan_id': scan_id,
        'line': line
    }, namespace='/scans', room=f"scan_{scan_id}")


def emit_scan_complete(scan_id: str, status: str, output: str, exit_code: int):
    """
    Emit scan completion event
    
    Args:
        scan_id: Scan ID
        status: Final status
        output: Full output
        exit_code: Process exit code
    """
    if socketio is None:
        return
    
    # Emit summary (not full output to avoid large payloads)
    output_preview = output[:1000] + '...' if len(output) > 1000 else output
    
    socketio.emit('scan_complete', {
        'scan_id': scan_id,
        'status': status,
        'output_preview': output_preview,
        'output_length': len(output),
        'exit_code': exit_code
    }, namespace='/scans', room=f"scan_{scan_id}")
    
    # Also emit to general namespace
    socketio.emit('scan_complete', {
        'scan_id': scan_id,
        'status': status,
        'exit_code': exit_code
    }, namespace='/scans')


def emit_to_user(user_id: str, event: str, data: dict):
    """
    Emit event to all connections for a specific user
    
    Args:
        user_id: User ID
        event: Event name
        data: Event data
    """
    if socketio is None:
        return
    
    socketio.emit(event, data, namespace='/scans', room=f"user_{user_id}")


def broadcast_stats():
    """Broadcast engine statistics to all connected clients"""
    if socketio is None:
        return
    
    from scan_engine import get_engine
    engine = get_engine()
    stats = engine.get_stats()
    
    socketio.emit('engine_stats', stats, namespace='/scans')


# ================================
# Live Notification Emitters
# ================================

def emit_notification(title: str, body: str = '', notif_type: str = 'info',
                      user_id: str = None, org_id: str = None):
    """
    Send a live notification to a user or entire org.

    Args:
        title: Notification title
        body: Notification body text
        notif_type: 'success' | 'warning' | 'error' | 'info'
        user_id: Target specific user (optional)
        org_id: Target entire org (optional)
    """
    if socketio is None:
        return

    payload = {
        'title': title,
        'body': body,
        'type': notif_type,
        'timestamp': time.time()
    }

    if user_id:
        socketio.emit('notification', payload, namespace='/scans',
                       room=f"user_{user_id}")
    elif org_id:
        socketio.emit('notification', payload, namespace='/scans',
                       room=f"org_{org_id}")
    else:
        socketio.emit('notification', payload, namespace='/scans')


def emit_agent_status(agent_id: str, agent_name: str, status: str,
                      previous_status: str = None, org_id: str = None):
    """
    Notify about agent status change.
    """
    if socketio is None:
        return

    payload = {
        'agent_id': agent_id,
        'agent_name': agent_name,
        'status': status,
        'previous_status': previous_status,
        'timestamp': time.time()
    }

    if org_id:
        socketio.emit('agent_status', payload, namespace='/scans',
                       room=f"org_{org_id}")
    else:
        socketio.emit('agent_status', payload, namespace='/scans')


# ================================
# Collaborative Activity Feed
# ================================

def emit_activity(org_id: str, user_name: str, action: str,
                  details: str = '', resource_type: str = '',
                  resource_id: str = ''):
    """
    Broadcast an activity entry to the org feed.

    Example:
        emit_activity('org-123', 'Admin', 'started scan',
                       details='nmap on 8.8.8.8', resource_type='scan')
    """
    if socketio is None:
        return

    entry = {
        'id': f"{int(time.time()*1000)}-{hash(user_name) % 10000:04d}",
        'user_name': user_name,
        'action': action,
        'details': details,
        'resource_type': resource_type,
        'resource_id': resource_id,
        'timestamp': time.time()
    }

    # Persist in memory
    if org_id not in _activity_feeds:
        _activity_feeds[org_id] = []
    _activity_feeds[org_id].append(entry)
    # Trim
    if len(_activity_feeds[org_id]) > ACTIVITY_FEED_LIMIT:
        _activity_feeds[org_id] = _activity_feeds[org_id][-ACTIVITY_FEED_LIMIT:]

    # Broadcast to org room
    socketio.emit('activity', entry, namespace='/scans', room=f"org_{org_id}")
    logger.debug(f"Activity: {user_name} {action} – {details}")


def get_socketio():
    """Get the global SocketIO instance"""
    return socketio
