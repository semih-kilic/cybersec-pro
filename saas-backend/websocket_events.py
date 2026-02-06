#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - WebSocket Events Handler
Flask-SocketIO integration for real-time scan updates

Author: Semih Kılıç
Version: 1.0.0 (FAZ 2)

Features:
- Real-time scan progress updates
- Live output streaming
- Connection management with auto-reconnect support
- Room-based event routing (per scan, per user)
"""

import logging
from functools import wraps
from flask import request
from flask_socketio import SocketIO, emit, join_room, leave_room, disconnect

logger = logging.getLogger('WebSocket')

# SocketIO instance - initialized in init_socketio()
socketio: SocketIO = None


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
        emit('pong', {'timestamp': __import__('time').time()})
    
    logger.info("WebSocket handlers registered")


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


def get_socketio():
    """Get the global SocketIO instance"""
    return socketio
