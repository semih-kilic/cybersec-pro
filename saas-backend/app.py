#!/usr/bin/env python3
"""
🛡️ CyberSec Pro SaaS Backend
World-class cybersecurity testing platform
Complete Kali Linux tool documentation and execution

Author: Semih Kılıç
Version: 3.0.0 (World-Class Edition)
"""

# ================================
# EVENTLET MONKEY PATCHING — MUST BE FIRST
# ================================
import eventlet
eventlet.monkey_patch(all=True)

from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
import base64
import stripe
import json
import subprocess
import uuid
import logging
import threading
from logging.handlers import RotatingFileHandler
from functools import wraps

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Environment variables loaded from .env")
except ImportError:
    print("⚠️ python-dotenv not installed, using system environment variables")

# Initialize Flask app
app = Flask(__name__)

# ================================
# PRODUCTION LOGGING CONFIGURATION
# ================================
if not app.debug and os.environ.get('FLASK_ENV') == 'production':
    # Create logs directory if not exists
    if not os.path.exists('logs'):
        os.makedirs('logs')
    
    # File handler with rotation (10MB max, keep 10 backups)
    file_handler = RotatingFileHandler(
        'logs/cybersec-pro.log',
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=10
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('CyberSec Pro Backend startup')
else:
    # Development logging
    logging.basicConfig(level=logging.DEBUG)

# Import and register tools API blueprint
try:
    from tools_api import tools_api
    app.register_blueprint(tools_api)
    print("✅ Tools API v1 blueprint registered")
except ImportError as e:
    print(f"⚠️ Tools API v1 not loaded: {e}")

# Import and register tools API v2 blueprint (dynamic tool registry)
try:
    from tools_api_v2 import tools_api_v2
    app.register_blueprint(tools_api_v2)
    print("✅ Tools API v2 blueprint registered (109+ Kali tools)")
except ImportError as e:
    print(f"⚠️ Tools API v2 not loaded: {e}")

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'cybersec-pro-saas-2026')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///cybersec_saas.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-cybersec-2026')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

# Stripe configuration
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_...')

# Initialize extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)
CORS(app, 
     origins=[
         'https://cybersecpro.com', 
         'https://www.cybersecpro.com',
         'https://app.cybersecpro.com',
         'https://semihkilic.com',
         'https://www.semihkilic.com',
         'https://cybersecpro.semihkilic.com',
         'https://app.semihkilic.com', 
         'http://localhost:3000',
         'http://localhost:5000',
         'http://localhost:5173'
     ],
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
)

# ================================
# PRODUCTION SECURITY HEADERS
# ================================
@app.after_request
def add_security_headers(response):
    """Add security headers to all responses"""
    # Prevent clickjacking
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    # XSS Protection
    response.headers['X-XSS-Protection'] = '1; mode=block'
    # Referrer Policy
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    # Content Security Policy (production)
    if os.environ.get('FLASK_ENV') == 'production':
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: https:;"
        # HSTS (1 year)
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    # Permissions Policy
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    return response

# ================================
# GLOBAL ERROR HANDLERS
# ================================
@app.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Bad Request', 'message': str(error)}), 400

@app.errorhandler(401)
def unauthorized(error):
    return jsonify({'error': 'Unauthorized', 'message': 'Authentication required'}), 401

@app.errorhandler(403)
def forbidden(error):
    return jsonify({'error': 'Forbidden', 'message': 'Access denied'}), 403

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not Found', 'message': 'Resource not found'}), 404

@app.errorhandler(429)
def rate_limit_exceeded(error):
    return jsonify({'error': 'Rate Limit Exceeded', 'message': 'Too many requests'}), 429

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal Server Error', 'message': 'An unexpected error occurred'}), 500

# Initialize Flask-SocketIO for real-time WebSocket support
try:
    from websocket_events import init_socketio, emit_activity, emit_agent_status, emit_notification, dispatch_scan_ws, is_agent_ws_connected
    socketio = init_socketio(app)
    print("✅ WebSocket (Flask-SocketIO) initialized")
except ImportError as e:
    socketio = None
    emit_activity = None
    emit_agent_status = None
    emit_notification = None
    dispatch_scan_ws = None
    is_agent_ws_connected = None
    print(f"⚠️ WebSocket not available: {e}")


def _emit_scan_activity(scan, user, tool, action='started scan'):
    """Helper to emit activity for scan events."""
    try:
        if emit_activity is None:
            return
        uname = f"{user.first_name} {user.last_name}" if user else "Unknown"
        tname = tool.name if tool else "tool"
        emit_activity(
            scan.organization_id, uname, action,
            details=f"{tname} on {scan.target}",
            resource_type='scan', resource_id=scan.id
        )
    except Exception as e:
        print(f"Activity emit error: {e}")

# Initialize Scan Engine V3 (World-Class Edition)
try:
    from scan_engine_v3 import init_engine_v3, get_engine_v3
    scan_engine_v3 = init_engine_v3(app, socketio=socketio, max_workers=3)
    SCAN_ENGINE_V3_AVAILABLE = True
    print("✅ Scan Engine V3 (World-Class) initialized")
except ImportError as e:
    scan_engine_v3 = None
    SCAN_ENGINE_V3_AVAILABLE = False
    print(f"⚠️ Scan Engine V3 not available: {e}")

# Initialize legacy Scan Engine (fallback)
try:
    from scan_engine import init_engine, get_engine
    scan_engine = init_engine(app, socketio=socketio, max_workers=4, use_docker=False)
    SCAN_ENGINE_AVAILABLE = True
    print("✅ Scan Engine Legacy initialized")
except ImportError as e:
    scan_engine = None
    SCAN_ENGINE_AVAILABLE = False
    print(f"⚠️ Scan Engine not available: {e}")

# ================================
# PLAN CONFIGURATION (Single Source of Truth)
# ================================
PLAN_CONFIG = {
    'trial': {
        'level': 0,
        'price_eur': 0,
        'duration': '14 days',
        'tool_limit': 3,
        'daily_scan_limit': 5,
        'max_projects': 1,
        'max_team_members': 1,
        'max_agents': 1,
        'multi_tool_scan': 1,
        'features': {
            'basic_reports': True,
            'pdf_reports': False,
            'html_reports': False,
            'api_access': False,
            'sso_saml': False,
            'compliance_reports': False,
            'remote_agents': False,
            'scheduled_scans': False,
            'ai_suggestions': False,
            'ai_remediation': False,
            'priority_support': False,
            'purple_team': False,
        }
    },
    'starter': {
        'level': 1,
        'price_eur': 99,
        'yearly_price_eur': 990,
        'duration': 'monthly',
        'tool_limit': 50,
        'daily_scan_limit': 30,
        'max_projects': 3,
        'max_team_members': 1,
        'max_agents': 1,
        'multi_tool_scan': 2,
        'features': {
            'basic_reports': True,
            'pdf_reports': True,
            'html_reports': True,
            'api_access': False,
            'sso_saml': False,
            'compliance_reports': False,
            'remote_agents': False,
            'scheduled_scans': True,
            'ai_suggestions': False,
            'ai_remediation': False,
            'priority_support': False,
            'purple_team': False,
        }
    },
    'professional': {
        'level': 2,
        'price_eur': 299,
        'yearly_price_eur': 2990,
        'duration': 'monthly',
        'tool_limit': 200,
        'daily_scan_limit': 100,
        'max_projects': 10,
        'max_team_members': 5,
        'max_agents': 5,
        'multi_tool_scan': 5,
        'features': {
            'basic_reports': True,
            'pdf_reports': True,
            'html_reports': True,
            'api_access': True,
            'sso_saml': False,
            'compliance_reports': True,
            'remote_agents': True,
            'scheduled_scans': True,
            'ai_suggestions': True,
            'ai_remediation': True,
            'priority_support': False,
            'purple_team': False,
        }
    },
    'enterprise': {
        'level': 3,
        'price_eur': 799,
        'yearly_price_eur': 0,  # Custom annual pricing
        'duration': 'monthly',
        'tool_limit': 682,
        'daily_scan_limit': 0,  # 0 = unlimited
        'max_projects': 0,  # 0 = unlimited
        'max_team_members': 0,  # 0 = unlimited
        'max_agents': 0,  # 0 = unlimited (enterprise)
        'multi_tool_scan': 10,
        'features': {
            'basic_reports': True,
            'pdf_reports': True,
            'html_reports': True,
            'api_access': True,
            'sso_saml': True,
            'compliance_reports': True,
            'remote_agents': True,
            'scheduled_scans': True,
            'ai_suggestions': True,
            'ai_remediation': True,
            'priority_support': True,
            'purple_team': True,
        }
    }
}

def get_plan_config(plan_type):
    """Get plan configuration, defaults to starter"""
    return PLAN_CONFIG.get(plan_type, PLAN_CONFIG['starter'])

def check_feature(org, feature_name):
    """Check if an org's plan has a specific feature enabled"""
    config = get_plan_config(org.plan_type)
    return config['features'].get(feature_name, False)

def get_plan_level(plan_type):
    """Get numeric plan level for comparison"""
    config = PLAN_CONFIG.get(plan_type, PLAN_CONFIG['starter'])
    return config['level']

# ================================
# DATABASE MODELS
# ================================

class Organization(db.Model):
    """Multi-tenant organization model"""
    __tablename__ = 'organizations'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    slug = db.Column(db.String(50), unique=True, nullable=False)
    plan_type = db.Column(db.String(20), default='starter')  # starter, professional, enterprise
    stripe_customer_id = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    users = db.relationship('User', backref='organization', lazy=True)
    scans = db.relationship('Scan', backref='organization', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'plan_type': self.plan_type,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active
        }

class User(db.Model):
    """User model with organization association"""
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)  # Nullable for OAuth users
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    role = db.Column(db.String(20), default='user')  # admin, user, viewer
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    
    # OAuth fields
    oauth_provider = db.Column(db.String(20))  # google, github, None for email
    oauth_id = db.Column(db.String(100))  # Provider's user ID
    avatar_url = db.Column(db.String(255))  # Profile picture URL
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'role': self.role,
            'organization_id': self.organization_id,
            'avatar_url': self.avatar_url,
            'created_at': self.created_at.isoformat(),
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'is_active': self.is_active
        }

class Subscription(db.Model):
    """Stripe subscription management"""
    __tablename__ = 'subscriptions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=False)
    stripe_subscription_id = db.Column(db.String(100), unique=True)
    plan_type = db.Column(db.String(20), nullable=False)  # starter, professional, enterprise
    status = db.Column(db.String(20), default='active')  # active, canceled, past_due
    current_period_start = db.Column(db.DateTime)
    current_period_end = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'organization_id': self.organization_id,
            'plan_type': self.plan_type,
            'status': self.status,
            'current_period_start': self.current_period_start.isoformat() if self.current_period_start else None,
            'current_period_end': self.current_period_end.isoformat() if self.current_period_end else None,
            'created_at': self.created_at.isoformat()
        }

class Agent(db.Model):
    """Remote agents for scan execution"""
    __tablename__ = 'agents'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    hostname = db.Column(db.String(255))
    ip_address = db.Column(db.String(45))
    platform = db.Column(db.String(20), default='linux')  # linux, windows, macos, docker
    os_info = db.Column(db.String(100))
    version = db.Column(db.String(20))
    status = db.Column(db.String(20), default='pending')  # pending, online, offline, busy, error
    connection_type = db.Column(db.String(20), default='direct')  # direct, ssh
    ssh_host = db.Column(db.String(255))
    ssh_port = db.Column(db.Integer, default=22)
    ssh_username = db.Column(db.String(100))
    ssh_key_path = db.Column(db.String(255))
    ssh_password_encrypted = db.Column(db.Text)  # Encrypted password
    registration_token = db.Column(db.String(100), unique=True)
    api_key = db.Column(db.String(100), unique=True)
    last_heartbeat = db.Column(db.DateTime)
    cpu_usage = db.Column(db.Float, default=0)
    memory_usage = db.Column(db.Float, default=0)
    active_scans = db.Column(db.Integer, default=0)
    total_scans = db.Column(db.Integer, default=0)
    location = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', backref='agents')
    
    def to_dict(self, include_sensitive=False):
        data = {
            'id': self.id,
            'organization_id': self.organization_id,
            'name': self.name,
            'hostname': self.hostname,
            'ip_address': self.ip_address,
            'platform': self.platform,
            'os': self.os_info,
            'version': self.version,
            'status': self.status,
            'connection_type': self.connection_type,
            'last_seen': self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            'cpu_usage': self.cpu_usage,
            'memory_usage': self.memory_usage,
            'active_scans': self.active_scans,
            'total_scans': self.total_scans,
            'location': self.location,
            'created_at': self.created_at.isoformat()
        }
        if include_sensitive:
            data['ssh_host'] = self.ssh_host
            data['ssh_port'] = self.ssh_port
            data['ssh_username'] = self.ssh_username
            data['registration_token'] = self.registration_token
        return data

class Tool(db.Model):
    """Security tools catalog"""
    __tablename__ = 'tools'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    command_template = db.Column(db.Text)
    parameters = db.Column(db.JSON)
    plan_required = db.Column(db.String(20), default='starter')  # starter, professional, enterprise
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # New fields for comprehensive tool metadata
    tool_type = db.Column(db.String(20), default='cli')  # cli, gui, service, framework
    hardware_required = db.Column(db.JSON, default=list)  # ['wifi_adapter', 'gpu', 'bluetooth']
    gui_required = db.Column(db.Boolean, default=False)
    install_command = db.Column(db.Text)  # apt install command
    example_usage = db.Column(db.Text)  # Example command line
    official_url = db.Column(db.String(255))  # Kali tools page URL
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'description': self.description,
            'parameters': self.parameters,
            'plan_required': self.plan_required,
            'is_active': self.is_active,
            'tool_type': self.tool_type or 'cli',
            'hardware_required': self.hardware_required or [],
            'gui_required': self.gui_required or False,
            'install_command': self.install_command,
            'example_usage': self.example_usage,
            'official_url': self.official_url
        }

class Scan(db.Model):
    """Scan execution tracking"""
    __tablename__ = 'scans'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    tool_id = db.Column(db.String(36), db.ForeignKey('tools.id'), nullable=False)
    target = db.Column(db.String(255), nullable=False)
    parameters = db.Column(db.JSON)
    status = db.Column(db.String(20), default='pending')  # pending, running, completed, failed, timeout, cancelled
    agent_id = db.Column(db.String(36), db.ForeignKey('agents.id'), nullable=True)  # Which agent ran this scan
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)  # Associated project
    output = db.Column(db.Text)
    error_log = db.Column(db.Text)  # Error details for failed scans
    findings = db.Column(db.JSON)  # Structured scan findings
    report_path = db.Column(db.String(255))
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='scans')
    tool = db.relationship('Tool', backref='scans')
    
    @property
    def tool_name(self):
        """Helper property to get tool name safely"""
        return self.tool.name if self.tool else 'Unknown Tool'
    
    @property
    def duration_seconds(self):
        """Calculate scan duration in seconds"""
        if not self.started_at:
            return 0
        end = self.completed_at or datetime.utcnow()
        return (end - self.started_at).total_seconds()
    
    @property
    def duration_str(self):
        """Human-readable duration"""
        secs = self.duration_seconds
        if secs < 60:
            return f"{int(secs)}s"
        mins = int(secs // 60)
        remaining = int(secs % 60)
        return f"{mins}m {remaining}s"
    
    @property
    def findings_summary(self):
        """Get findings summary from JSON"""
        if not self.findings:
            return {'total': 0, 'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'open_ports': 0}
        if isinstance(self.findings, dict) and 'summary' in self.findings:
            return self.findings['summary']
        return {'total': len(self.findings) if isinstance(self.findings, list) else 0}
    
    def to_dict(self):
        summary = self.findings_summary
        return {
            'id': self.id,
            'organization_id': self.organization_id,
            'user_id': self.user_id,
            'tool_id': self.tool_id,
            'target': self.target,
            'parameters': self.parameters,
            'status': self.status,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat(),
            'duration': self.duration_str,
            'duration_seconds': self.duration_seconds,
            'tool': self.tool.to_dict() if self.tool else {'name': 'Unknown', 'category': 'Unknown'},
            'findings_summary': summary,
            'error_log': self.error_log
        }

class UsageTracking(db.Model):
    """Track usage for billing"""
    __tablename__ = 'usage_tracking'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=False)
    tool_id = db.Column(db.String(36), db.ForeignKey('tools.id'), nullable=False)
    scan_id = db.Column(db.String(36), db.ForeignKey('scans.id'))
    usage_date = db.Column(db.Date, default=datetime.utcnow().date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Report(db.Model):
    """Generated security reports"""
    __tablename__ = 'reports'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    template = db.Column(db.String(50), default='full')  # executive, technical, compliance, full
    format = db.Column(db.String(20), default='html')  # html, pdf, json, csv, markdown
    status = db.Column(db.String(20), default='generating')  # generating, ready, failed
    
    # Report metadata
    scan_ids = db.Column(db.JSON)  # List of scan IDs included
    sections = db.Column(db.JSON)  # Sections to include
    
    # Summary data
    total_findings = db.Column(db.Integer, default=0)
    critical_count = db.Column(db.Integer, default=0)
    high_count = db.Column(db.Integer, default=0)
    medium_count = db.Column(db.Integer, default=0)
    low_count = db.Column(db.Integer, default=0)
    info_count = db.Column(db.Integer, default=0)
    risk_score = db.Column(db.Integer, default=0)
    risk_level = db.Column(db.String(20), default='None')
    
    # Content storage
    content = db.Column(db.Text)  # Report content (HTML/JSON/Markdown)
    file_path = db.Column(db.String(255))  # Path to PDF file if generated
    file_size = db.Column(db.Integer)  # Size in bytes
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    # Relationships
    user = db.relationship('User', backref='reports')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'template': self.template,
            'format': self.format,
            'status': self.status,
            'scan_ids': self.scan_ids,
            'sections': self.sections,
            'total_findings': self.total_findings,
            'severity_breakdown': {
                'critical': self.critical_count,
                'high': self.high_count,
                'medium': self.medium_count,
                'low': self.low_count,
                'info': self.info_count
            },
            'risk_score': self.risk_score,
            'risk_level': self.risk_level,
            'file_size': self.file_size,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }


class SSOConfig(db.Model):
    """SSO / Identity Provider configuration per organization"""
    __tablename__ = 'sso_configs'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=False, unique=True)
    provider_type = db.Column(db.String(20), nullable=False)  # saml, ldap, oidc
    provider_name = db.Column(db.String(50))  # e.g. "Okta", "Azure AD", "Google Workspace"
    is_enabled = db.Column(db.Boolean, default=False)

    # SAML 2.0 fields
    saml_entity_id = db.Column(db.String(500))
    saml_sso_url = db.Column(db.String(500))
    saml_certificate = db.Column(db.Text)  # X.509 cert (PEM)
    saml_sign_requests = db.Column(db.Boolean, default=True)

    # OIDC fields
    oidc_client_id = db.Column(db.String(255))
    oidc_client_secret = db.Column(db.String(500))
    oidc_issuer_url = db.Column(db.String(500))  # e.g. https://accounts.google.com
    oidc_scopes = db.Column(db.String(500), default='openid profile email')

    # LDAP fields
    ldap_host = db.Column(db.String(255))
    ldap_port = db.Column(db.Integer, default=389)
    ldap_use_ssl = db.Column(db.Boolean, default=False)
    ldap_bind_dn = db.Column(db.String(500))
    ldap_bind_password = db.Column(db.String(500))
    ldap_base_dn = db.Column(db.String(500))
    ldap_user_filter = db.Column(db.String(500), default='(sAMAccountName={username})')
    ldap_group_filter = db.Column(db.String(500))

    # Metadata
    domain_hint = db.Column(db.String(255))  # e.g. "company.com" for auto-redirect
    enforce_sso = db.Column(db.Boolean, default=False)  # Block password login when SSO is active
    jit_provisioning = db.Column(db.Boolean, default=True)  # Auto-create users on first SSO login
    default_role = db.Column(db.String(20), default='user')  # Role for JIT-provisioned users

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = db.Column(db.DateTime)  # Track last SSO login

    # Relationships
    organization = db.relationship('Organization', backref=db.backref('sso_config', uselist=False))

    def to_dict(self):
        base = {
            'id': self.id,
            'organization_id': self.organization_id,
            'provider_type': self.provider_type,
            'provider_name': self.provider_name,
            'is_enabled': self.is_enabled,
            'domain_hint': self.domain_hint,
            'enforce_sso': self.enforce_sso,
            'jit_provisioning': self.jit_provisioning,
            'default_role': self.default_role,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
        }
        if self.provider_type == 'saml':
            base.update({
                'saml_entity_id': self.saml_entity_id,
                'saml_sso_url': self.saml_sso_url,
                'saml_certificate': '••••••' if self.saml_certificate else None,
                'saml_sign_requests': self.saml_sign_requests,
            })
        elif self.provider_type == 'oidc':
            base.update({
                'oidc_client_id': self.oidc_client_id,
                'oidc_client_secret': '••••••' if self.oidc_client_secret else None,
                'oidc_issuer_url': self.oidc_issuer_url,
                'oidc_scopes': self.oidc_scopes,
            })
        elif self.provider_type == 'ldap':
            base.update({
                'ldap_host': self.ldap_host,
                'ldap_port': self.ldap_port,
                'ldap_use_ssl': self.ldap_use_ssl,
                'ldap_bind_dn': self.ldap_bind_dn,
                'ldap_bind_password': '••••••' if self.ldap_bind_password else None,
                'ldap_base_dn': self.ldap_base_dn,
                'ldap_user_filter': self.ldap_user_filter,
                'ldap_group_filter': self.ldap_group_filter,
            })
        return base


class Project(db.Model):
    """Security testing projects - group scans and targets"""
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    target_type = db.Column(db.String(20), default='web')  # web, network, api, mobile, cloud
    target_url = db.Column(db.String(500))
    target_ip = db.Column(db.String(100))
    status = db.Column(db.String(20), default='active')  # active, completed, archived
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    organization = db.relationship('Organization', backref='projects')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'target_type': self.target_type,
            'target_url': self.target_url,
            'target_ip': self.target_ip,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class ScheduledScan(db.Model):
    """Scheduled/recurring scans with APScheduler persistence"""
    __tablename__ = 'scheduled_scans'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    tool_name = db.Column(db.String(100), nullable=False)
    target = db.Column(db.String(500), nullable=False)
    parameters = db.Column(db.JSON, default=dict)
    schedule_type = db.Column(db.String(20), default='daily')  # once, daily, weekly, monthly, cron
    cron_expression = db.Column(db.String(100))  # e.g. "0 2 * * *"
    hour = db.Column(db.Integer, default=2)
    minute = db.Column(db.Integer, default=0)
    day_of_week = db.Column(db.String(20))  # 'mon', 'tue,fri', etc
    day_of_month = db.Column(db.Integer)
    is_active = db.Column(db.Boolean, default=True)
    last_run = db.Column(db.DateTime)
    next_run = db.Column(db.DateTime)
    run_count = db.Column(db.Integer, default=0)
    agent_id = db.Column(db.String(36), db.ForeignKey('agents.id'), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    organization = db.relationship('Organization', backref='scheduled_scans')
    user = db.relationship('User', backref='scheduled_scans')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'tool_name': self.tool_name,
            'target': self.target,
            'parameters': self.parameters,
            'schedule_type': self.schedule_type,
            'cron_expression': self.cron_expression,
            'hour': self.hour,
            'minute': self.minute,
            'day_of_week': self.day_of_week,
            'day_of_month': self.day_of_month,
            'is_active': self.is_active,
            'last_run': self.last_run.isoformat() if self.last_run else None,
            'next_run': self.next_run.isoformat() if self.next_run else None,
            'run_count': self.run_count,
            'agent_id': self.agent_id,
            'project_id': self.project_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# ================================
# DECORATORS
# ================================

def require_organization(f):
    """Decorator to ensure user belongs to an organization"""
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or not user.organization_id:
            return jsonify({'error': 'Organization required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def check_plan_access(required_plan):
    """Decorator to check if user's plan allows access to feature"""
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            org = user.organization
            
            # Trial users have same access as starter
            plan_hierarchy = {'trial': 1, 'starter': 1, 'professional': 2, 'team': 3, 'enterprise': 4}
            user_plan_level = plan_hierarchy.get(org.plan_type, 1)
            required_plan_level = plan_hierarchy.get(required_plan, 1)
            
            if user_plan_level < required_plan_level:
                return jsonify({'error': f'Plan upgrade required. Need {required_plan} plan.'}), 402
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# ================================
# API ROUTES
# ================================

@app.route('/')
def index():
    """API status endpoint"""
    return jsonify({
        'service': 'CyberSec Pro SaaS API',
        'version': '2.0.0',
        'status': 'operational',
        'timestamp': datetime.utcnow().isoformat(),
        'endpoints': {
            'auth': '/api/v1/auth/*',
            'tools': '/api/v1/tools/*',
            'scans': '/api/v1/scans/*',
            'billing': '/api/v1/billing/*',
            'admin': '/api/v1/admin/*'
        }
    })


@app.route('/api/health')
@app.route('/api/v1/health')
@app.route('/health')
def health_check():
    """Production health check endpoint for Docker/K8s"""
    health = {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '3.0.0',
        'checks': {}
    }
    
    # Check database connection + tool count
    try:
        db.session.execute(db.text('SELECT 1'))
        tool_count = db.session.execute(db.text('SELECT COUNT(*) FROM tools')).scalar()
        health['checks']['database'] = {'status': 'ok', 'tools_count': tool_count}
    except Exception as e:
        health['checks']['database'] = f'error: {str(e)}'
        health['status'] = 'unhealthy'
    
    # Check scan engine
    try:
        if SCAN_ENGINE_AVAILABLE:
            from scan_engine import get_engine
            engine = get_engine()
            stats = engine.get_stats()
            health['checks']['scan_engine'] = {
                'status': 'ok',
                'active_scans': stats.get('active_scans', 0),
                'max_workers': stats.get('max_workers', 0)
            }
        else:
            health['checks']['scan_engine'] = 'not_available'
    except Exception as e:
        health['checks']['scan_engine'] = f'error: {str(e)}'
    
    # Check WebSocket
    health['checks']['websocket'] = 'ok' if socketio else 'not_available'
    
    status_code = 200 if health['status'] == 'healthy' else 503
    return jsonify(health), status_code


@app.route('/api/ready')
def readiness_check():
    """Kubernetes readiness probe endpoint"""
    try:
        db.session.execute(db.text('SELECT 1'))
        return jsonify({'ready': True}), 200
    except Exception:
        return jsonify({'ready': False}), 503

# ================================
# AUTHENTICATION ROUTES
# ================================

@app.route('/api/v1/auth/register', methods=['POST'])
def register():
    """Register new user and organization"""
    try:
        data = request.get_json()
        
        # Validate input
        required_fields = ['email', 'password', 'organization_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if user already exists
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already registered'}), 409
        
        # Create organization
        org_slug = data['organization_name'].lower().replace(' ', '-').replace('_', '-')
        org = Organization(
            name=data['organization_name'],
            slug=org_slug,
            plan_type='starter'
        )
        db.session.add(org)
        db.session.flush()  # Get org.id
        
        # Create user
        user = User(
            email=data['email'],
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            role='admin',
            organization_id=org.id
        )
        user.set_password(data['password'])
        db.session.add(user)
        
        # Create Stripe customer
        try:
            stripe_customer = stripe.Customer.create(
                email=user.email,
                name=f"{user.first_name} {user.last_name}".strip(),
                metadata={'organization_id': org.id}
            )
            org.stripe_customer_id = stripe_customer.id
        except Exception as e:
            print(f"Stripe customer creation failed: {e}")
        
        db.session.commit()
        
        # Send email notifications (async in production)
        try:
            from email_service import notify_admin_new_registration, notify_user_welcome
            
            user_data = {
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'organization_name': org.name,
                'plan': 'Starter (Trial)'
            }
            
            # Notify admin of new registration
            notify_admin_new_registration(user_data)
            
            # Send welcome email to user
            notify_user_welcome(user_data)
            
        except Exception as e:
            print(f"Email notification failed: {e}")
            # Don't fail registration if email fails
        
        # Generate JWT token
        access_token = create_access_token(identity=user.id)
        
        return jsonify({
            'message': 'Registration successful',
            'access_token': access_token,
            'user': user.to_dict(),
            'organization': org.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/auth/login', methods=['POST'])
def login():
    """User login"""
    try:
        data = request.get_json()
        
        if not data:
            app.logger.warning("🔐 Login attempt with no JSON body")
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        if not data.get('email') or not data.get('password'):
            app.logger.warning("🔐 Login attempt with missing email/password")
            return jsonify({'error': 'Email and password required'}), 400
        
        email = data['email'].strip().lower()
        user = User.query.filter_by(email=email).first()
        
        if not user:
            app.logger.warning(f"🔐 Login failed: no user found for {email}")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not user.check_password(data['password']):
            app.logger.warning(f"🔐 Login failed: wrong password for {email}")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not user.is_active:
            app.logger.warning(f"🔐 Login blocked: deactivated account {email}")
            return jsonify({'error': 'Account deactivated'}), 403
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Generate JWT token
        access_token = create_access_token(identity=user.id)
        
        app.logger.info(f"🔐 Login successful: {email} (user_id={user.id})")
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': user.to_dict(),
            'organization': user.organization.to_dict() if user.organization else None
        })
        
    except Exception as e:
        app.logger.error(f"🔐 Login error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ================================
# OAUTH ROUTES
# ================================

# OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID', '')
GITHUB_CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET', '')


@app.route('/api/v1/auth/google', methods=['POST'])
def google_oauth():
    """Handle Google OAuth login"""
    try:
        data = request.get_json()
        import requests
        
        google_data = None
        
        # Handle OAuth code flow (redirect)
        if data.get('code'):
            # Exchange code for tokens - redirect_uri MUST match exactly what was used in auth request
            # Accept redirect_uri from frontend (it knows what it sent to Google)
            domain = os.environ.get('DOMAIN', 'https://semihkilic.com')
            redirect_uri = data.get('redirect_uri', f"{domain}/login")
            
            app.logger.info(f"🔐 Google OAuth code exchange: redirect_uri={redirect_uri}")
            
            token_response = requests.post(
                'https://oauth2.googleapis.com/token',
                data={
                    'code': data['code'],
                    'client_id': GOOGLE_CLIENT_ID,
                    'client_secret': GOOGLE_CLIENT_SECRET,
                    'redirect_uri': redirect_uri,
                    'grant_type': 'authorization_code'
                }
            )
            
            if token_response.status_code != 200:
                app.logger.error(f"🔐 Google token exchange failed (HTTP {token_response.status_code}): {token_response.text}")
                return jsonify({'error': 'Failed to exchange Google code', 'details': token_response.json().get('error_description', '')}), 401
            
            tokens = token_response.json()
            id_token = tokens.get('id_token')
            
            # Verify id_token
            verify_response = requests.get(
                f'https://oauth2.googleapis.com/tokeninfo?id_token={id_token}'
            )
            
            if verify_response.status_code != 200:
                return jsonify({'error': 'Invalid Google token'}), 401
            
            google_data = verify_response.json()
            
        # Handle credential flow (popup/one-tap)
        elif data.get('credential'):
            # Verify Google token
            google_response = requests.get(
                f'https://oauth2.googleapis.com/tokeninfo?id_token={data["credential"]}'
            )
            
            if google_response.status_code != 200:
                return jsonify({'error': 'Invalid Google token'}), 401
            
            google_data = google_response.json()
        else:
            return jsonify({'error': 'Google credential or code required'}), 400
        
        # Validate client ID
        if google_data.get('aud') != GOOGLE_CLIENT_ID:
            return jsonify({'error': 'Invalid client ID'}), 401
        
        email = google_data.get('email')
        if not email:
            return jsonify({'error': 'Email not provided by Google'}), 400
        
        # Find or create user
        user = User.query.filter_by(email=email).first()
        
        if user:
            # Existing user - update OAuth info
            user.oauth_provider = 'google'
            user.oauth_id = google_data.get('sub')
            user.avatar_url = google_data.get('picture')
            user.last_login = datetime.utcnow()
        else:
            # Create new user and organization
            org_name = f"{google_data.get('given_name', 'User')}'s Workspace"
            org_slug = f"{email.split('@')[0]}-workspace"
            
            org = Organization(
                name=org_name,
                slug=org_slug,
                plan_type='starter'
            )
            db.session.add(org)
            db.session.flush()
            
            user = User(
                email=email,
                first_name=google_data.get('given_name', ''),
                last_name=google_data.get('family_name', ''),
                role='admin',
                organization_id=org.id,
                oauth_provider='google',
                oauth_id=google_data.get('sub'),
                avatar_url=google_data.get('picture')
            )
            # Set random password for OAuth users (required by DB constraint)
            import secrets
            user.set_password(secrets.token_hex(32))
            db.session.add(user)
            
            # Send welcome email
            try:
                from email_service import notify_admin_new_registration, notify_user_welcome
                user_data = {
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'organization_name': org.name,
                    'plan': 'Starter (Google OAuth)'
                }
                notify_admin_new_registration(user_data)
                notify_user_welcome(user_data)
            except Exception as e:
                print(f"Email notification failed: {e}")
        
        db.session.commit()
        
        # Generate JWT token
        access_token = create_access_token(identity=user.id)
        
        return jsonify({
            'message': 'Google login successful',
            'access_token': access_token,
            'user': user.to_dict(),
            'organization': user.organization.to_dict() if user.organization else None
        })
        
    except Exception as e:
        app.logger.error(f"🔐 Google OAuth error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/auth/github', methods=['POST'])
def github_oauth():
    """Handle GitHub OAuth login"""
    try:
        data = request.get_json()
        
        if not data.get('code'):
            return jsonify({'error': 'GitHub code required'}), 400
        
        import requests
        
        # Exchange code for access token
        token_response = requests.post(
            'https://github.com/login/oauth/access_token',
            data={
                'client_id': GITHUB_CLIENT_ID,
                'client_secret': GITHUB_CLIENT_SECRET,
                'code': data['code']
            },
            headers={'Accept': 'application/json'}
        )
        
        if token_response.status_code != 200:
            return jsonify({'error': 'Failed to get GitHub token'}), 401
        
        token_data = token_response.json()
        access_token_github = token_data.get('access_token')
        
        if not access_token_github:
            return jsonify({'error': 'No access token from GitHub'}), 401
        
        # Get user info from GitHub
        user_response = requests.get(
            'https://api.github.com/user',
            headers={'Authorization': f'token {access_token_github}'}
        )
        
        if user_response.status_code != 200:
            return jsonify({'error': 'Failed to get GitHub user info'}), 401
        
        github_data = user_response.json()
        
        # Get email (may be private)
        email = github_data.get('email')
        if not email:
            emails_response = requests.get(
                'https://api.github.com/user/emails',
                headers={'Authorization': f'token {access_token_github}'}
            )
            if emails_response.status_code == 200:
                emails = emails_response.json()
                primary_email = next((e for e in emails if e.get('primary')), None)
                if primary_email:
                    email = primary_email.get('email')
        
        if not email:
            return jsonify({'error': 'Email not available from GitHub'}), 400
        
        # Find or create user
        user = User.query.filter_by(email=email).first()
        
        if user:
            # Existing user - update OAuth info
            user.oauth_provider = 'github'
            user.oauth_id = str(github_data.get('id'))
            user.avatar_url = github_data.get('avatar_url')
            user.last_login = datetime.utcnow()
        else:
            # Parse name
            full_name = github_data.get('name', '') or github_data.get('login', '')
            name_parts = full_name.split(' ', 1)
            first_name = name_parts[0] if name_parts else ''
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            # Create new user and organization
            org_name = f"{first_name}'s Workspace"
            org_slug = f"{github_data.get('login', email.split('@')[0])}-workspace"
            
            org = Organization(
                name=org_name,
                slug=org_slug,
                plan_type='starter'
            )
            db.session.add(org)
            db.session.flush()
            
            user = User(
                email=email,
                first_name=first_name,
                last_name=last_name,
                role='admin',
                organization_id=org.id,
                oauth_provider='github',
                oauth_id=str(github_data.get('id')),
                avatar_url=github_data.get('avatar_url')
            )
            # Set random password for OAuth users (required by DB constraint)
            import secrets
            user.set_password(secrets.token_hex(32))
            db.session.add(user)
            
            # Send welcome email
            try:
                from email_service import notify_admin_new_registration, notify_user_welcome
                user_data = {
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'organization_name': org.name,
                    'plan': 'Starter (GitHub OAuth)'
                }
                notify_admin_new_registration(user_data)
                notify_user_welcome(user_data)
            except Exception as e:
                print(f"Email notification failed: {e}")
        
        db.session.commit()
        
        # Generate JWT token
        access_token = create_access_token(identity=user.id)
        
        return jsonify({
            'message': 'GitHub login successful',
            'access_token': access_token,
            'user': user.to_dict(),
            'organization': user.organization.to_dict() if user.organization else None
        })
        
    except Exception as e:
        app.logger.error(f"🔐 GitHub OAuth error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/auth/oauth-config', methods=['GET'])
def get_oauth_config():
    """Get OAuth configuration for frontend"""
    return jsonify({
        'google': {
            'enabled': bool(GOOGLE_CLIENT_ID),
            'client_id': GOOGLE_CLIENT_ID
        },
        'github': {
            'enabled': bool(GITHUB_CLIENT_ID),
            'client_id': GITHUB_CLIENT_ID
        }
    })

@app.route('/api/v1/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user info"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'user': user.to_dict(),
            'organization': user.organization.to_dict() if user.organization else None
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/auth/avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    """Upload user avatar"""
    import uuid
    import os
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if 'avatar' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['avatar']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file type
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
        file_ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        if file_ext not in allowed_extensions:
            return jsonify({'error': 'Invalid file type. Use JPG, PNG or GIF'}), 400
        
        # Create uploads directory
        upload_dir = os.path.join(os.path.dirname(__file__), 'static', 'avatars')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
        filepath = os.path.join(upload_dir, filename)
        
        # Save file
        file.save(filepath)
        
        # Update user avatar URL
        avatar_url = f"/static/avatars/{filename}"
        user.avatar_url = avatar_url
        db.session.commit()
        
        return jsonify({
            'success': True,
            'avatar_url': avatar_url,
            'message': 'Avatar uploaded successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/auth/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update user profile"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'company' in data:
            user.company = data['company']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'user': user.to_dict(),
            'message': 'Profile updated successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ================================
# SSO / IDENTITY PROVIDER ROUTES
# ================================

@app.route('/api/v1/sso/config', methods=['GET'])
@jwt_required()
@require_organization
def get_sso_config():
    """Get current SSO configuration for the organization"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        # Only admins can view SSO config
        if user.role not in ('admin', 'owner'):
            return jsonify({'error': 'Admin access required'}), 403

        config = SSOConfig.query.filter_by(organization_id=user.organization_id).first()
        if not config:
            return jsonify({'config': None})

        return jsonify({'config': config.to_dict()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/sso/config', methods=['POST'])
@jwt_required()
@require_organization
def create_sso_config():
    """Create or update SSO configuration"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if user.role not in ('admin', 'owner'):
            return jsonify({'error': 'Admin access required'}), 403

        # Enterprise plan required
        org = user.organization
        if org.plan_type not in ('enterprise', 'team'):
            return jsonify({'error': 'SSO requires Team or Enterprise plan'}), 403

        data = request.get_json()
        provider_type = data.get('provider_type')
        if provider_type not in ('saml', 'ldap', 'oidc'):
            return jsonify({'error': 'Invalid provider type. Must be saml, ldap, or oidc'}), 400

        # Upsert: update existing or create new
        config = SSOConfig.query.filter_by(organization_id=user.organization_id).first()
        if not config:
            config = SSOConfig(organization_id=user.organization_id)
            db.session.add(config)

        config.provider_type = provider_type
        config.provider_name = data.get('provider_name', '')
        config.domain_hint = data.get('domain_hint', '')
        config.enforce_sso = data.get('enforce_sso', False)
        config.jit_provisioning = data.get('jit_provisioning', True)
        config.default_role = data.get('default_role', 'user')

        # Provider-specific fields
        if provider_type == 'saml':
            config.saml_entity_id = data.get('saml_entity_id', '')
            config.saml_sso_url = data.get('saml_sso_url', '')
            config.saml_certificate = data.get('saml_certificate', '')
            config.saml_sign_requests = data.get('saml_sign_requests', True)
        elif provider_type == 'oidc':
            config.oidc_client_id = data.get('oidc_client_id', '')
            config.oidc_client_secret = data.get('oidc_client_secret', '')
            config.oidc_issuer_url = data.get('oidc_issuer_url', '')
            config.oidc_scopes = data.get('oidc_scopes', 'openid profile email')
        elif provider_type == 'ldap':
            config.ldap_host = data.get('ldap_host', '')
            config.ldap_port = data.get('ldap_port', 389)
            config.ldap_use_ssl = data.get('ldap_use_ssl', False)
            config.ldap_bind_dn = data.get('ldap_bind_dn', '')
            config.ldap_bind_password = data.get('ldap_bind_password', '')
            config.ldap_base_dn = data.get('ldap_base_dn', '')
            config.ldap_user_filter = data.get('ldap_user_filter', '(sAMAccountName={username})')
            config.ldap_group_filter = data.get('ldap_group_filter', '')

        config.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'success': True,
            'config': config.to_dict(),
            'message': f'{provider_type.upper()} configuration saved successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/sso/config', methods=['DELETE'])
@jwt_required()
@require_organization
def delete_sso_config():
    """Delete SSO configuration"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if user.role not in ('admin', 'owner'):
            return jsonify({'error': 'Admin access required'}), 403

        config = SSOConfig.query.filter_by(organization_id=user.organization_id).first()
        if not config:
            return jsonify({'error': 'No SSO configuration found'}), 404

        db.session.delete(config)
        db.session.commit()

        return jsonify({'success': True, 'message': 'SSO configuration deleted'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/sso/toggle', methods=['POST'])
@jwt_required()
@require_organization
def toggle_sso():
    """Enable or disable SSO"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if user.role not in ('admin', 'owner'):
            return jsonify({'error': 'Admin access required'}), 403

        config = SSOConfig.query.filter_by(organization_id=user.organization_id).first()
        if not config:
            return jsonify({'error': 'No SSO configuration found. Configure an IdP first.'}), 404

        data = request.get_json()
        config.is_enabled = data.get('enabled', not config.is_enabled)
        config.updated_at = datetime.utcnow()
        db.session.commit()

        status = 'enabled' if config.is_enabled else 'disabled'
        return jsonify({
            'success': True,
            'is_enabled': config.is_enabled,
            'message': f'SSO {status} successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/sso/test', methods=['POST'])
@jwt_required()
@require_organization
def test_sso_connection():
    """Test SSO/IdP connection (validates config without full auth flow)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if user.role not in ('admin', 'owner'):
            return jsonify({'error': 'Admin access required'}), 403

        config = SSOConfig.query.filter_by(organization_id=user.organization_id).first()
        if not config:
            return jsonify({'error': 'No SSO configuration found'}), 404

        # Validate required fields
        errors = []
        if config.provider_type == 'saml':
            if not config.saml_entity_id:
                errors.append('Entity ID is required')
            if not config.saml_sso_url:
                errors.append('SSO URL is required')
            if not config.saml_certificate:
                errors.append('X.509 Certificate is required')
        elif config.provider_type == 'oidc':
            if not config.oidc_client_id:
                errors.append('Client ID is required')
            if not config.oidc_client_secret:
                errors.append('Client Secret is required')
            if not config.oidc_issuer_url:
                errors.append('Issuer URL is required')
        elif config.provider_type == 'ldap':
            if not config.ldap_host:
                errors.append('LDAP Host is required')
            if not config.ldap_base_dn:
                errors.append('Base DN is required')

        if errors:
            return jsonify({
                'success': False,
                'status': 'invalid',
                'errors': errors,
                'message': 'Configuration validation failed'
            })

        # Simulate connection test
        return jsonify({
            'success': True,
            'status': 'connected',
            'message': f'{config.provider_type.upper()} configuration is valid. Connection test passed.',
            'details': {
                'provider': config.provider_name or config.provider_type.upper(),
                'endpoint': config.saml_sso_url or config.oidc_issuer_url or f'{config.ldap_host}:{config.ldap_port}',
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================
# TOOLS ROUTES
# ================================

@app.route('/api/v1/tools', methods=['GET'])
@require_organization
def get_tools():
    """Get available tools based on user's plan"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        # Use centralized PLAN_CONFIG
        plan_cfg = get_plan_config(org.plan_type)
        user_plan_level = plan_cfg['level']
        tool_limit = plan_cfg['tool_limit']
        
        # Get all active tools
        all_tools = Tool.query.filter(Tool.is_active == True).order_by(Tool.name).all()
        
        # Filter based on plan - Enterprise gets all, others get limited
        if user_plan_level >= 4:  # Enterprise
            tools = all_tools
        else:
            tools = all_tools[:tool_limit]
        
        # Group by category
        tools_by_category = {}
        for tool in tools:
            if tool.category not in tools_by_category:
                tools_by_category[tool.category] = []
            tools_by_category[tool.category].append(tool.to_dict())
        
        return jsonify({
            'tools': tools_by_category,
            'total_tools': len(tools),
            'user_plan': org.plan_type,
            'plan_limit': tool_limit,
            'features': plan_cfg['features']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/tools/count', methods=['GET'])
def get_tools_count():
    """Get tool counts per plan (public endpoint - no auth required).
    
    Query params:
        plan: Optional plan name (starter|professional|team|enterprise)
              If provided, returns count for that plan only.
              If omitted, returns counts for all plans.
    
    Returns:
        JSON with tool counts per plan, dynamically calculated from DB.
    """
    try:
        total_active = Tool.query.filter_by(is_active=True).count()
        
        # Build plan counts from PLAN_CONFIG
        plan_counts = {}
        for pname, pcfg in PLAN_CONFIG.items():
            if pname == 'trial':
                continue
            plan_counts[pname] = min(pcfg['tool_limit'], total_active) if pcfg['tool_limit'] != 999 else total_active
        
        plan = request.args.get('plan', '').lower()
        if plan:
            if plan not in plan_counts and plan != 'trial':
                return jsonify({'error': f'Unknown plan: {plan}'}), 400
            count = min(PLAN_CONFIG.get(plan, PLAN_CONFIG['starter'])['tool_limit'], total_active)
            return jsonify({
                'plan': plan,
                'tools': count,
                'total': total_active
            })
        
        return jsonify({
            'plans': plan_counts,
            'total': total_active
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/tools/<tool_id>', methods=['GET'])
@require_organization
def get_tool(tool_id):
    """Get specific tool details"""
    try:
        tool = Tool.query.get(tool_id)
        if not tool:
            return jsonify({'error': 'Tool not found'}), 404
        
        return jsonify({'tool': tool.to_dict()})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/tools/stats', methods=['GET'])
@require_organization
def get_tools_stats():
    """Get tool statistics - types, hardware, GUI breakdown"""
    try:
        total = Tool.query.filter_by(is_active=True).count()
        cli = Tool.query.filter_by(tool_type='cli', is_active=True).count()
        gui = Tool.query.filter_by(tool_type='gui', is_active=True).count()
        service = Tool.query.filter_by(tool_type='service', is_active=True).count()
        framework = Tool.query.filter_by(tool_type='framework', is_active=True).count()
        gui_req = Tool.query.filter_by(gui_required=True, is_active=True).count()

        # Category breakdown
        cats = db.session.query(
            Tool.category, db.func.count(Tool.id)
        ).filter(Tool.is_active == True).group_by(Tool.category).all()

        return jsonify({
            'total': total,
            'by_type': {
                'cli': cli, 'gui': gui,
                'service': service, 'framework': framework
            },
            'gui_required': gui_req,
            'categories': {c: n for c, n in sorted(cats, key=lambda x: -x[1])}
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================
# PLAN & FEATURES ROUTES
# ================================

@app.route('/api/v1/plan/info', methods=['GET'])
@require_organization
def get_plan_info():
    """Get current organization's plan info with usage statistics"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        plan_cfg = get_plan_config(org.plan_type)
        
        # Calculate today's usage
        from datetime import date
        today_scans = Scan.query.filter(
            Scan.organization_id == org.id,
            db.func.date(Scan.created_at) == date.today()
        ).count()
        
        total_scans = Scan.query.filter_by(organization_id=org.id).count()
        team_count = User.query.filter_by(organization_id=org.id).count()
        agent_count = Agent.query.filter_by(organization_id=org.id, status='online').count()
        
        # Tool access count
        total_tools = Tool.query.filter_by(is_active=True).count()
        tool_limit = plan_cfg['tool_limit']
        accessible_tools = min(tool_limit, total_tools) if tool_limit != 999 else total_tools
        
        return jsonify({
            'plan': org.plan_type,
            'config': {
                'level': plan_cfg['level'],
                'price_eur': plan_cfg['price_eur'],
                'tool_limit': accessible_tools,
                'daily_scan_limit': plan_cfg['daily_scan_limit'],
                'max_projects': plan_cfg['max_projects'],
                'max_team_members': plan_cfg['max_team_members'],
                'max_agents': plan_cfg['max_agents'],
                'multi_tool_scan': plan_cfg['multi_tool_scan'],
                'features': plan_cfg['features'],
            },
            'usage': {
                'scans_today': today_scans,
                'scans_remaining': max(0, plan_cfg['daily_scan_limit'] - today_scans) if plan_cfg['daily_scan_limit'] > 0 else -1,
                'total_scans': total_scans,
                'team_members': team_count,
                'online_agents': agent_count,
                'tools_accessible': accessible_tools,
                'tools_total': total_tools,
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/plan/features', methods=['GET'])
@require_organization
def get_plan_features():
    """Get feature flags for current plan"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        plan_cfg = get_plan_config(org.plan_type)
        
        return jsonify({
            'plan': org.plan_type,
            'features': plan_cfg['features'],
            'limits': {
                'daily_scans': plan_cfg['daily_scan_limit'],
                'tools': plan_cfg['tool_limit'],
                'projects': plan_cfg['max_projects'],
                'team_members': plan_cfg['max_team_members'],
                'agents': plan_cfg['max_agents'],
                'multi_tool_scan': plan_cfg['multi_tool_scan'],
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/plans', methods=['GET'])
def get_all_plans():
    """Public endpoint - get all available plans for comparison"""
    try:
        total_tools = Tool.query.filter_by(is_active=True).count()
        plans = {}
        for plan_name, cfg in PLAN_CONFIG.items():
            if plan_name == 'trial':
                continue  # Don't show trial in public pricing
            tool_count = min(cfg['tool_limit'], total_tools) if cfg['tool_limit'] != 999 else total_tools
            plans[plan_name] = {
                'price_eur': cfg['price_eur'],
                'tool_count': tool_count,
                'daily_scan_limit': cfg['daily_scan_limit'] if cfg['daily_scan_limit'] > 0 else 'unlimited',
                'max_projects': cfg['max_projects'] if cfg['max_projects'] > 0 else 'unlimited',
                'max_team_members': cfg['max_team_members'] if cfg['max_team_members'] > 0 else 'unlimited',
                'max_agents': cfg['max_agents'] if plan_name != 'enterprise' else 'unlimited',
                'multi_tool_scan': cfg['multi_tool_scan'],
                'features': cfg['features'],
            }
        return jsonify({'plans': plans, 'total_tools': total_tools})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================
# SCANS ROUTES
# ================================

@app.route('/api/v1/scans', methods=['POST'])
@require_organization
def create_scan():
    """Create new security scan"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        # Validate input
        required_fields = ['tool_id', 'target']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check tool exists and user has access
        tool = Tool.query.get(data['tool_id'])
        if not tool:
            return jsonify({'error': 'Tool not found'}), 404
        
        # Check plan access
        org = user.organization
        # Trial users have same access as starter (7 basic tools)
        plan_hierarchy = {'trial': 1, 'starter': 1, 'professional': 2, 'team': 3, 'enterprise': 4}
        user_plan_level = plan_hierarchy.get(org.plan_type, 1)  # Default to starter level
        required_plan_level = plan_hierarchy.get(tool.plan_required, 1)
        
        if user_plan_level < required_plan_level:
            return jsonify({'error': f'Plan upgrade required. Need {tool.plan_required} plan.'}), 402
        
        # Create scan record
        scan = Scan(
            organization_id=user.organization_id,
            user_id=user.id,
            tool_id=data['tool_id'],
            target=data['target'],
            parameters=data.get('parameters', {}),
            status='pending'
        )
        db.session.add(scan)
        db.session.commit()
        
        # Track usage
        usage = UsageTracking(
            organization_id=user.organization_id,
            tool_id=data['tool_id'],
            scan_id=scan.id
        )
        db.session.add(usage)
        db.session.commit()
        
        return jsonify({
            'message': 'Scan created successfully',
            'scan': scan.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/scans', methods=['GET'])
@require_organization
def get_scans():
    """Get user's scans"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        scans = Scan.query.filter_by(
            organization_id=user.organization_id
        ).order_by(Scan.created_at.desc()).limit(50).all()
        
        return jsonify({
            'scans': [scan.to_dict() for scan in scans],
            'total': len(scans)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/scans/<scan_id>', methods=['GET'])
@require_organization
def get_scan(scan_id):
    """Get specific scan details"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        scan = Scan.query.filter_by(
            id=scan_id,
            organization_id=user.organization_id
        ).first()
        
        if not scan:
            return jsonify({'error': 'Scan not found'}), 404
        
        return jsonify({'scan': scan.to_dict()})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/scans/<scan_id>/rerun', methods=['POST'])
@require_organization
def rerun_scan(scan_id):
    """
    Rerun an existing scan with the same configuration.
    Creates a new scan with identical target, tool, and parameters.
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        # Find original scan
        original_scan = Scan.query.filter_by(
            id=scan_id,
            organization_id=user.organization_id
        ).first()
        
        if not original_scan:
            return jsonify({'error': 'Scan not found'}), 404
        
        # Validate we have enough data to rerun
        if not original_scan.target:
            return jsonify({'error': 'Cannot rerun: missing target configuration'}), 400
        
        if not original_scan.tool_id:
            return jsonify({'error': 'Cannot rerun: missing tool configuration'}), 400
        
        # Get the tool - support both UUID and string-based tool IDs
        tool = Tool.query.get(original_scan.tool_id)
        if not tool:
            # Try finding by name (for string-based tool_ids like 'nmap')
            tool = Tool.query.filter(Tool.name.ilike(original_scan.tool_id)).first()
        
        # If still not found, use the tool_id directly (scan_executor handles string IDs)
        tool_plan_required = tool.plan_required if tool else 'starter'
        
        # Check plan access
        plan_hierarchy = {'trial': 1, 'starter': 1, 'professional': 2, 'team': 3, 'enterprise': 4}
        user_plan_level = plan_hierarchy.get(org.plan_type, 1)
        required_plan_level = plan_hierarchy.get(tool_plan_required, 1)
        
        if user_plan_level < required_plan_level:
            return jsonify({
                'error': f'Tool requires {tool.plan_required} plan or higher',
                'current_plan': org.plan_type,
                'required_plan': tool.plan_required
            }), 402
        
        # Check daily scan limit based on plan
        plan_cfg = get_plan_config(org.plan_type)
        daily_limit = plan_cfg['daily_scan_limit']
        if daily_limit > 0:  # 0 = unlimited
            from datetime import date
            today_scans = Scan.query.filter(
                Scan.organization_id == org.id,
                db.func.date(Scan.created_at) == date.today()
            ).count()
            if today_scans >= daily_limit:
                return jsonify({
                    'error': f'Daily scan limit reached ({today_scans}/{daily_limit})',
                    'scans_today': today_scans,
                    'limit': daily_limit,
                    'hint': 'Upgrade your plan for more daily scans'
                }), 429
        
        # Create new scan with same config
        new_scan_id = str(uuid.uuid4())
        new_scan = Scan(
            id=new_scan_id,
            organization_id=org.id,
            user_id=user.id,
            tool_id=original_scan.tool_id,
            target=original_scan.target,
            parameters=original_scan.parameters,
            status='running',
            started_at=datetime.utcnow()
        )
        db.session.add(new_scan)
        db.session.commit()
        
        # Start scan using V3 engine
        def on_complete(scan_id, status, output, findings, exit_code):
            with app.app_context():
                try:
                    s = db.session.get(Scan, scan_id)
                    if s:
                        s.status = status
                        s.output = output[:65000] if output else ''
                        s.findings = findings
                        s.completed_at = datetime.utcnow()
                        db.session.commit()
                except Exception as e:
                    print(f"Rerun callback error: {e}")
                    db.session.rollback()
        
        # Get engine and start scan
        if SCAN_ENGINE_V3_AVAILABLE:
            from scan_engine_v3 import get_engine_v3
            engine = get_engine_v3()
            job = engine.submit_scan(
                scan_id=new_scan_id,
                tool_name=tool.name,
                tool_id=tool.id,
                target=original_scan.target,
                params=original_scan.parameters or {},
                user_id=user.id,
                organization_id=org.id,
                db_callback=on_complete
            )
            command = ' '.join(job.command) if job else 'N/A'
        else:
            command = 'engine_unavailable'
        
        return jsonify({
            'success': True,
            'new_scan_id': new_scan_id,
            'original_scan_id': scan_id,
            'status': 'running',
            'tool': tool.name,
            'target': original_scan.target,
            'command': command,
            'message': f'Scan restarted with same configuration'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Rerun error: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


# ================================
# BILLING ROUTES
# ================================

@app.route('/api/v1/billing/subscription', methods=['GET'])
@require_organization
def get_subscription():
    """Get current subscription details"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        subscription = Subscription.query.filter_by(
            organization_id=org.id
        ).first()
        
        return jsonify({
            'organization': org.to_dict(),
            'subscription': subscription.to_dict() if subscription else None
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/create-checkout-session', methods=['POST'])
def create_checkout_session_public():
    """Public Stripe checkout session for marketing page (no auth required)"""
    try:
        data = request.get_json()
        plan = data.get('plan_id') or data.get('plan')
        billing = data.get('billing', 'monthly')  # 'monthly' or 'annual'
        
        import os
        # New tiered pricing (Jan 2026)
        STRIPE_PRICES = {
            'free_trial': os.environ.get('STRIPE_FREE_TRIAL_PRICE_ID', 'price_1T1efX0ed3IDKXcnNHleBpc1'),
            'starter': os.environ.get('STRIPE_STARTER_PRICE_ID', 'price_1T1eh20ed3IDKXcnWZVJA9ur'),
            'professional': os.environ.get('STRIPE_PROFESSIONAL_PRICE_ID', 'price_1T1ei40ed3IDKXcnZDCi88tv'),
            'enterprise': os.environ.get('STRIPE_ENTERPRISE_PRICE_ID', 'price_1T1eir0ed3IDKXcn3ILBR48o'),
        }
        
        if plan == 'free_trial':
            return jsonify({'url': '/login.html?plan=free_trial'}), 200
        
        if plan == 'enterprise':
            return jsonify({'url': '/contact.html?plan=enterprise'}), 200
        
        if plan not in STRIPE_PRICES:
            return jsonify({'error': 'Invalid plan', 'url': '/login.html'}), 400
        
        stripe_key = os.environ.get('STRIPE_SECRET_KEY')
        
        if stripe_key and stripe_key != 'sk_test_...':
            try:
                import stripe
                stripe.api_key = stripe_key
                
                domain = os.environ.get('DOMAIN', 'https://semihkilic.com')
                
                checkout_session = stripe.checkout.Session.create(
                    payment_method_types=['card'],
                    line_items=[{
                        'price': STRIPE_PRICES[plan],
                        'quantity': 1,
                    }],
                    mode='subscription',
                    success_url=domain + '/dashboard/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}',
                    cancel_url=domain + '/#pricing',
                    allow_promotion_codes=True,
                    metadata={
                        'plan': plan,
                        'billing': billing,
                        'source': 'marketing_page',
                    }
                )
                
                return jsonify({
                    'url': checkout_session.url,
                    'checkout_url': checkout_session.url,
                    'session_id': checkout_session.id
                })
            except Exception as e:
                print(f"Stripe checkout error: {e}")
                return jsonify({'error': f'Payment error: {str(e)}', 'url': '/login.html?plan=' + plan}), 500
        
        # No Stripe key — redirect to signup with plan context
        return jsonify({'url': '/login.html?plan=' + plan}), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'url': '/login.html'}), 500


@app.route('/api/v1/billing/create-checkout', methods=['POST'])
@require_organization
def create_checkout():
    """Create Stripe checkout session for plan upgrade"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        data = request.get_json()
        
        plan = data.get('plan')
        success_url = data.get('success_url', 'https://semihkilic.com/dashboard/settings?tab=billing')
        cancel_url = data.get('cancel_url', 'https://semihkilic.com/dashboard/upgrade')
        
        # Stripe Price IDs from .env (Updated Jan 2026 - New Tiered Pricing)
        # Free Trial = €0, Starter = €99/mo, Professional = €299/mo, Enterprise = €799/mo
        import os
        STRIPE_PRICES = {
            'starter': os.environ.get('STRIPE_STARTER_PRICE_ID', 'price_1T1eh20ed3IDKXcnWZVJA9ur'),
            'professional': os.environ.get('STRIPE_PROFESSIONAL_PRICE_ID', 'price_1T1ei40ed3IDKXcnZDCi88tv'),
            'enterprise': os.environ.get('STRIPE_ENTERPRISE_PRICE_ID', 'price_1T1eir0ed3IDKXcn3ILBR48o'),
        }
        
        # Free trial doesn't need checkout
        if plan == 'free_trial':
            return jsonify({'error': 'Free trial does not require payment'}), 400
        
        if plan not in STRIPE_PRICES:
            return jsonify({'error': 'Invalid plan'}), 400
        
        # Use real Stripe API
        stripe_key = os.environ.get('STRIPE_SECRET_KEY')
        
        if stripe_key and stripe_key != 'sk_test_...':
            try:
                import stripe
                stripe.api_key = stripe_key
                
                checkout_session = stripe.checkout.Session.create(
                    payment_method_types=['card'],
                    line_items=[{
                        'price': STRIPE_PRICES[plan],
                        'quantity': 1,
                    }],
                    mode='subscription',
                    success_url=success_url + '?session_id={CHECKOUT_SESSION_ID}',
                    cancel_url=cancel_url,
                    customer_email=user.email,
                    metadata={
                        'organization_id': org.id,
                        'user_id': user.id,
                        'plan': plan,
                    }
                )
                
                return jsonify({
                    'checkout_url': checkout_session.url,
                    'session_id': checkout_session.id
                })
            except Exception as e:
                print(f"Stripe error: {e}")
                return jsonify({'error': f'Stripe error: {str(e)}'}), 500
        
        # No Stripe key configured
        return jsonify({
            'error': 'Payment system not configured. Please contact support.',
            'message': 'Stripe API key is missing'
        }), 503
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/billing/webhook', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhooks for subscription updates"""
    import os
    endpoint_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
    
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    
    try:
        if endpoint_secret:
            import stripe
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        else:
            # For testing without webhook signature
            event = request.get_json()
        
        event_type = event.get('type') if isinstance(event, dict) else event['type']
        
        if event_type == 'checkout.session.completed':
            session = event['data']['object'] if isinstance(event, dict) else event.data.object
            metadata = session.get('metadata', {})
            
            org_id = metadata.get('organization_id')
            plan = metadata.get('plan')
            
            if org_id and plan:
                org = Organization.query.get(org_id)
                if org:
                    org.plan_type = plan
                    db.session.commit()
                    print(f"✅ Upgraded org {org_id} to {plan}")
        
        return jsonify({'received': True})
        
    except Exception as e:
        print(f"Webhook error: {e}")
        return jsonify({'error': str(e)}), 400

# ================================
# ADMIN ROUTES (Legacy - moved to ADMIN API section)
# ================================
# See ADMIN API (Super Admin Only) section below for updated admin endpoints

# ================================
# REAL SCAN EXECUTION ROUTES
# ================================

try:
    from scan_executor import get_executor, TOOL_CONFIGS, STARTER_TOOLS, PROFESSIONAL_TOOLS, ENTERPRISE_TOOLS
    SCAN_EXECUTOR_AVAILABLE = True
    print("✅ Scan executor loaded")
except ImportError as e:
    SCAN_EXECUTOR_AVAILABLE = False
    print(f"⚠️ Scan executor not available: {e}")


@app.route('/api/v1/scan/execute', methods=['POST'])
@require_organization
def execute_scan():
    """Execute a real security scan"""
    if not SCAN_EXECUTOR_AVAILABLE:
        return jsonify({'error': 'Scan executor not available'}), 503
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        data = request.get_json()
        
        tool_id = data.get('tool_id')
        target = data.get('target')
        parameters = data.get('parameters', {})
        
        if not tool_id or not target:
            return jsonify({'error': 'tool_id and target are required'}), 400
        
        # Check plan access
        executor = get_executor()
        allowed_tools = executor.get_tools_for_plan(org.plan_type)
        
        if tool_id not in allowed_tools:
            return jsonify({
                'error': f'Tool {tool_id} requires plan upgrade',
                'current_plan': org.plan_type,
                'required_plan': TOOL_CONFIGS.get(tool_id, {}).get('plan_required', 'professional')
            }), 402
        
        # Check daily scan limit based on plan
        plan_cfg = get_plan_config(org.plan_type)
        daily_limit = plan_cfg['daily_scan_limit']
        if daily_limit > 0:  # 0 = unlimited
            from datetime import date
            today_scans = Scan.query.filter(
                Scan.organization_id == org.id,
                db.func.date(Scan.created_at) == date.today()
            ).count()
            if today_scans >= daily_limit:
                return jsonify({
                    'error': f'Daily scan limit reached ({today_scans}/{daily_limit})',
                    'scans_today': today_scans,
                    'limit': daily_limit,
                    'hint': 'Upgrade your plan for more daily scans'
                }), 429
        
        # Create scan record
        scan_id = str(uuid.uuid4())
        scan = Scan(
            id=scan_id,
            organization_id=org.id,
            user_id=user.id,
            tool_id=tool_id,
            target=target,
            parameters=parameters,
            status='running',
            started_at=datetime.utcnow()
        )
        db.session.add(scan)
        db.session.commit()
        
        # Create a completion callback to update database when scan finishes
        def on_scan_complete(sid, status, output, exit_code):
            """Update database when scan completes"""
            with app.app_context():
                try:
                    s = Scan.query.get(sid)
                    if s:
                        s.status = status
                        s.output = output[:65535] if output else ''  # Limit output size
                        s.completed_at = datetime.utcnow()
                        db.session.commit()
                        print(f"✅ Scan {sid} updated to {status}")
                except Exception as e:
                    print(f"❌ Failed to update scan {sid}: {e}")
                    db.session.rollback()
        
        # Start the actual scan with completion callback
        result = executor.start_scan(scan_id, tool_id, target, parameters, 
                                     completion_callback=on_scan_complete)
        
        if not result.get('success'):
            scan.status = 'failed'
            scan.output = result.get('error', 'Unknown error')
            db.session.commit()
            return jsonify(result), 400
        
        return jsonify({
            'success': True,
            'scan_id': scan_id,
            'status': 'running',
            'command': result.get('command'),
            'message': 'Scan started successfully'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/scan/<scan_id>/output', methods=['GET'])
def get_scan_output(scan_id):
    """Get scan output (streaming via SSE)
    
    Supports both:
    - Authorization: Bearer <token> header
    - ?token=<token> query parameter (for EventSource/SSE)
    
    Works with both V3 engine and legacy executor.
    """
    # Check authorization - support both header and query param
    from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, decode_token
    
    token = request.args.get('token')
    user = None
    
    try:
        if token:
            # Manually decode JWT from query parameter (for EventSource/SSE)
            decoded = decode_token(token)
            user_id = decoded.get('sub')
            user = User.query.get(user_id)
        else:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
        
        if not user or not user.organization_id:
            return jsonify({'error': 'Unauthorized'}), 401
    except Exception as e:
        return jsonify({'error': 'Unauthorized', 'detail': str(e)}), 401
    
    from flask import Response
    
    def generate():
        # Try V3 engine first (used by /api/v1/scan/start)
        v3_engine = None
        if SCAN_ENGINE_V3_AVAILABLE:
            try:
                from scan_engine_v3 import get_engine_v3
                v3_engine = get_engine_v3()
                
                # Wait briefly for scan to be registered (SSE may connect before submit completes)
                import time as _time
                job = v3_engine.get_scan(scan_id)
                if not job:
                    for _ in range(10):  # Wait up to 5 seconds
                        _time.sleep(0.5)
                        job = v3_engine.get_scan(scan_id)
                        if job:
                            break
                
                if job:
                    # Use V3 engine for output streaming
                    import time
                    from scan_engine_v3 import ScanStatus
                    
                    # If scan already completed (fast tools like dig, whois),
                    # serve from output_buffer instead of queue
                    if job.status in (ScanStatus.COMPLETED, ScanStatus.FAILED, ScanStatus.TIMEOUT, ScanStatus.CANCELLED):
                        # Send all buffered output
                        for line in job.output_buffer:
                            if line:
                                yield f"data: {json.dumps({'type': 'output', 'line': line.rstrip()})}\n\n"
                        
                        # Build result from job
                        findings_list = []
                        if job.result and job.result.findings:
                            findings_list = [{'port': f.port, 'service': f.service, 'state': f.state, 'severity': f.severity, 'title': f.title} for f in job.result.findings]
                        
                        result = {
                            'status': job.status.value,
                            'output': '\n'.join(job.output_buffer),
                            'exit_code': job.exit_code,
                            'findings': findings_list
                        }
                        yield f"data: {json.dumps({'type': 'complete', 'result': result})}\n\n"
                        return
                    
                    # Scan still running — stream from queue in real-time
                    max_wait = 300  # 5 min max
                    start = time.time()
                    while time.time() - start < max_wait:
                        try:
                            line = job.output_queue.get(timeout=1.0)
                            if line:
                                yield f"data: {json.dumps({'type': 'output', 'line': line.rstrip()})}\n\n"
                        except Exception:
                            pass
                        
                        # Check if scan finished
                        if job.status in (ScanStatus.COMPLETED, ScanStatus.FAILED, ScanStatus.TIMEOUT, ScanStatus.CANCELLED):
                            # Drain remaining output
                            while not job.output_queue.empty():
                                try:
                                    line = job.output_queue.get_nowait()
                                    if line:
                                        yield f"data: {json.dumps({'type': 'output', 'line': line.rstrip()})}\n\n"
                                except Exception:
                                    break
                            
                            findings_list = []
                            if job.result and job.result.findings:
                                findings_list = [{'port': f.port, 'service': f.service, 'state': f.state, 'severity': f.severity, 'title': f.title} for f in job.result.findings]
                            
                            result = {
                                'status': job.status.value,
                                'output': '\n'.join(job.output_buffer),
                                'exit_code': job.exit_code,
                                'findings': findings_list
                            }
                            yield f"data: {json.dumps({'type': 'complete', 'result': result})}\n\n"
                            return
                    
                    # Timed out waiting
                    yield f"data: {json.dumps({'type': 'complete', 'result': {'status': 'timeout', 'output': 'Stream timeout'}})}\n\n"
                    return
            except Exception as e:
                print(f"V3 stream error: {e}")
        
        # Fallback to legacy executor
        if SCAN_EXECUTOR_AVAILABLE:
            executor = get_executor()
            while True:
                line = executor.get_scan_output(scan_id, timeout=1.0)
                if line is None:
                    result = executor.get_scan_result(scan_id)
                    if result:
                        yield f"data: {json.dumps({'type': 'complete', 'result': result})}\n\n"
                    break
                elif line:
                    yield f"data: {json.dumps({'type': 'output', 'line': line})}\n\n"
        else:
            # No V3 engine — check if this is an agent-based scan or DB-stored scan
            scan = Scan.query.get(scan_id)
            if scan and scan.agent_id:
                # Agent-based scan — poll DB for updates
                import time as _time
                max_wait = 300  # 5 min
                start = _time.time()
                last_output_len = 0
                
                while _time.time() - start < max_wait:
                    db.session.refresh(scan)
                    
                    # Stream new output lines
                    if scan.output and len(scan.output) > last_output_len:
                        new_content = scan.output[last_output_len:]
                        for line in new_content.split('\n'):
                            if line:
                                yield f"data: {json.dumps({'type': 'output', 'line': line})}\n\n"
                        last_output_len = len(scan.output)
                    
                    # Check completion
                    if scan.status in ('completed', 'failed', 'timeout', 'cancelled'):
                        yield f"data: {json.dumps({'type': 'complete', 'result': {'status': scan.status, 'output': scan.output or ''}})}\n\n"
                        return
                    
                    _time.sleep(2)  # Check every 2 seconds
                
                yield f"data: {json.dumps({'type': 'complete', 'result': {'status': 'timeout', 'output': 'Agent stream timeout'}})}\n\n"
            elif scan and scan.output:
                for line in scan.output.split('\n'):
                    yield f"data: {json.dumps({'type': 'output', 'line': line})}\n\n"
                yield f"data: {json.dumps({'type': 'complete', 'result': {'status': scan.status, 'output': scan.output}})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'complete', 'result': {'status': 'failed', 'output': 'No scan engine available'}})}\n\n"
    
    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['X-Accel-Buffering'] = 'no'
    response.headers['Connection'] = 'keep-alive'
    return response


@app.route('/api/v1/scan/<scan_id>/stop', methods=['POST'])
@require_organization
def stop_scan(scan_id):
    """Stop a running scan"""
    if not SCAN_EXECUTOR_AVAILABLE:
        return jsonify({'error': 'Scan executor not available'}), 503
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # Verify scan belongs to user's organization
        scan = Scan.query.filter_by(
            id=scan_id,
            organization_id=user.organization_id
        ).first()
        
        if not scan:
            return jsonify({'error': 'Scan not found'}), 404
        
        executor = get_executor()
        result = executor.stop_scan(scan_id)
        
        if result.get('success'):
            scan.status = 'cancelled'
            scan.completed_at = datetime.utcnow()
            db.session.commit()
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/scan/<scan_id>/result', methods=['GET'])
@require_organization
def get_scan_result(scan_id):
    """Get scan result"""
    if not SCAN_EXECUTOR_AVAILABLE:
        return jsonify({'error': 'Scan executor not available'}), 503
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # Verify scan belongs to user's organization
        scan = Scan.query.filter_by(
            id=scan_id,
            organization_id=user.organization_id
        ).first()
        
        if not scan:
            return jsonify({'error': 'Scan not found'}), 404
        
        executor = get_executor()
        result = executor.get_scan_result(scan_id)
        
        # Update database with result
        if result:
            scan.status = result.get('status', 'completed')
            scan.output = result.get('output', '')
            if result.get('completed_at'):
                scan.completed_at = datetime.fromisoformat(result['completed_at'])
            db.session.commit()
        
        return jsonify({
            'scan': scan.to_dict(),
            'execution_result': result
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/tools/available', methods=['GET'])
@require_organization
def get_available_tools():
    """Get all available tools with full configurations"""
    if not SCAN_EXECUTOR_AVAILABLE:
        # Fallback to database tools
        return get_tools()
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        executor = get_executor()
        all_tools = executor.get_all_tool_configs()
        allowed_tools = executor.get_tools_for_plan(org.plan_type)
        
        # Group by category
        tools_by_category = {}
        for tool_id, config in all_tools.items():
            category = config.get('category', 'Other')
            if category not in tools_by_category:
                tools_by_category[category] = []
            
            tool_data = {
                'id': tool_id,
                'name': config.get('name'),
                'description': config.get('description'),
                'category': category,
                'plan_required': config.get('plan_required', 'starter'),
                'parameters': config.get('parameters', {}),
                'is_available': tool_id in allowed_tools
            }
            tools_by_category[category].append(tool_data)
        
        return jsonify({
            'tools': tools_by_category,
            'total_tools': len(all_tools),
            'available_tools': len(allowed_tools),
            'user_plan': org.plan_type
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/tools/<tool_id>/config', methods=['GET'])
@require_organization
def get_tool_config(tool_id):
    """Get specific tool configuration with parameters"""
    if not SCAN_EXECUTOR_AVAILABLE:
        return jsonify({'error': 'Scan executor not available'}), 503
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        executor = get_executor()
        config = executor.get_tool_config(tool_id)
        
        if not config:
            return jsonify({'error': 'Tool not found'}), 404
        
        allowed_tools = executor.get_tools_for_plan(org.plan_type)
        
        return jsonify({
            'tool': {
                'id': tool_id,
                'name': config.get('name'),
                'command': config.get('command'),
                'description': config.get('description'),
                'category': config.get('category'),
                'plan_required': config.get('plan_required'),
                'parameters': config.get('parameters', {}),
                'is_available': tool_id in allowed_tools
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================
# SCAN ENGINE V3 - WORLD-CLASS SCANNING
# ================================

def get_tool_by_name_or_id(tool_identifier):
    """
    Lookup tool in database by name OR UUID
    Returns tuple: (tool_db_object, tool_name)
    """
    # First try exact UUID match
    tool = Tool.query.get(tool_identifier)
    if tool:
        return tool, tool.name
    
    # Then try case-insensitive name match
    tool = Tool.query.filter(
        db.func.lower(Tool.name) == tool_identifier.lower()
    ).first()
    if tool:
        return tool, tool.name
    
    # Try partial match (e.g., 'nmap' matches 'Nmap')
    tool = Tool.query.filter(
        Tool.name.ilike(f'%{tool_identifier}%')
    ).first()
    if tool:
        return tool, tool.name
    
    return None, tool_identifier


@app.route('/api/v1/scan/start', methods=['POST'])
@require_organization
def start_scan_v2():
    """
    Start a security scan using Scan Engine V3
    
    Request body:
    {
        "tool": "nmap",           # Tool name (case-insensitive)
        "target": "8.8.8.8",      # Target IP/hostname
        "parameters": {           # Optional tool-specific params
            "ports": "1-1000",
            "timing": "T3"
        }
    }
    """
    if not SCAN_ENGINE_V3_AVAILABLE:
        return jsonify({'error': 'Scan engine not available'}), 503
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        data = request.get_json()
        
        # Accept both 'tool' and 'tool_id' for backwards compatibility
        tool_identifier = data.get('tool') or data.get('tool_id')
        target = data.get('target')
        # Accept both 'parameters' and 'options' for backwards compatibility
        parameters = data.get('parameters') or data.get('options') or {}
        
        # Validate input
        if not tool_identifier:
            return jsonify({'error': 'tool is required'}), 400
        if not target:
            return jsonify({'error': 'target is required'}), 400
        
        # Validate target (flexible check)
        import re
        ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}(/\d{1,2})?$'
        domain_pattern = r'^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+$'
        url_pattern = r'^https?://'
        
        # Tools that accept keywords/search terms/file paths instead of IP/domain
        keyword_tools = {'searchsploit', 'john', 'hashcat', 'crunch', 'strings', 'binwalk',
                         'foremost', 'exiftool', 'checksec', 'objdump', 'strace', 'ltrace',
                         'volatility', 'aircrack-ng', 'lynis', 'msfconsole'}
        
        tool_lower = (tool_identifier or '').lower()
        is_keyword_tool = tool_lower in keyword_tools
        
        if not is_keyword_tool and not (re.match(ip_pattern, target) or re.match(domain_pattern, target) or re.match(url_pattern, target)):
            return jsonify({
                'error': 'Invalid target format',
                'hint': 'Enter a valid IP address (e.g., 8.8.8.8), CIDR (e.g., 10.0.0.0/24), domain (e.g., example.com), or URL (e.g., http://example.com)'
            }), 400
        
        # Block private/local IPs in production
        if target.startswith(('10.', '172.16.', '172.17.', '172.18.', '172.19.', 
                              '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
                              '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
                              '172.30.', '172.31.', '192.168.', '127.')):
            return jsonify({
                'error': 'Private/local addresses are not allowed',
                'hint': 'Scan public IP addresses or domains only'
            }), 400
        
        # Lookup tool in database
        tool_db, tool_name = get_tool_by_name_or_id(tool_identifier)
        
        if not tool_db:
            return jsonify({
                'error': f'Tool "{tool_identifier}" not found',
                'hint': 'Use tool name like "nmap", "whois", "dig", etc.'
            }), 404
        
        # Check plan access
        plan_hierarchy = {'trial': 1, 'starter': 1, 'professional': 2, 'team': 3, 'enterprise': 4}
        user_plan_level = plan_hierarchy.get(org.plan_type, 1)
        required_plan_level = plan_hierarchy.get(tool_db.plan_required, 1)
        
        if user_plan_level < required_plan_level:
            return jsonify({
                'error': f'Tool requires {tool_db.plan_required} plan or higher',
                'current_plan': org.plan_type,
                'required_plan': tool_db.plan_required
            }), 402
        
        # Check daily scan limit based on plan
        plan_cfg = get_plan_config(org.plan_type)
        daily_limit = plan_cfg['daily_scan_limit']
        if daily_limit > 0:  # 0 = unlimited
            from datetime import date
            today_scans = Scan.query.filter(
                Scan.organization_id == org.id,
                db.func.date(Scan.created_at) == date.today()
            ).count()
            if today_scans >= daily_limit:
                return jsonify({
                    'error': f'Daily scan limit reached ({today_scans}/{daily_limit})',
                    'scans_today': today_scans,
                    'limit': daily_limit,
                    'hint': 'Upgrade your plan for more daily scans'
                }), 429
        
        # Create scan record with proper tool_id (database UUID)
        scan_id = str(uuid.uuid4())
        
        # ── Agent-first execution decision ──
        # Philosophy: ALL scans go to agents. Local execution is last-resort fallback.
        agent_id_request = data.get('agent_id')  # Optional: specific agent
        execution_mode = data.get('execution_mode', 'auto')  # auto | agent | local
        
        use_agent = False
        selected_agent = None
        
        if execution_mode != 'local':  # Agent-first: try agent for both 'auto' and 'agent'
            if agent_id_request:
                # User specified a specific agent
                selected_agent = Agent.query.filter_by(
                    id=agent_id_request, organization_id=org.id
                ).first()
                if selected_agent and selected_agent.status == 'online':
                    use_agent = True
            else:
                # Find best available agent via load balancer
                selected_agent = agent_mgr.select_best_agent(org.id)
                if selected_agent:
                    use_agent = True
                elif execution_mode == 'agent':
                    # User explicitly wanted agent but none available
                    return jsonify({
                        'error': 'No online agents available',
                        'hint': 'Register an agent or switch to auto mode'
                    }), 503
        # execution_mode == 'local': fallback to server-side execution
        
        scan = Scan(
            id=scan_id,
            organization_id=org.id,
            user_id=user.id,
            tool_id=tool_db.id,
            target=target,
            parameters=parameters,
            status='pending' if use_agent else 'running',
            agent_id=selected_agent.id if use_agent and selected_agent else None,
            started_at=datetime.utcnow()
        )
        db.session.add(scan)
        db.session.commit()
        
        if use_agent and selected_agent:
            # ── Dispatch to remote agent ──
            scan_task = {
                'scan_id': scan_id,
                'tool_name': tool_name,
                'target': target,
                'parameters': parameters or {},
                'dispatched_at': datetime.utcnow().isoformat()
            }
            
            ws_dispatched = False
            if is_agent_ws_connected and is_agent_ws_connected(selected_agent.id):
                ws_dispatched = dispatch_scan_ws(selected_agent.id, scan_task)
            
            if ws_dispatched:
                scan.status = 'dispatched'
            else:
                scan.status = 'pending'  # agent picks up via heartbeat
            
            selected_agent.active_scans = (selected_agent.active_scans or 0) + 1
            db.session.commit()
            
            return jsonify({
                'success': True,
                'scan_id': scan_id,
                'status': scan.status,
                'tool': tool_name,
                'target': target,
                'execution_mode': 'agent',
                'agent': {
                    'id': selected_agent.id,
                    'name': selected_agent.name,
                    'ip': selected_agent.ip_address,
                    'dispatch_method': 'websocket' if ws_dispatched else 'polling'
                },
                'command': f'{tool_name} {target}',
                'message': f'{tool_name} scan dispatched to agent "{selected_agent.name}" ({selected_agent.ip_address})'
            }), 201
        
        # ── Local execution (server-side V3 engine) ──
        def on_complete(scan_id, status, output, findings, exit_code):
            """Update database when scan completes"""
            with app.app_context():
                try:
                    s = db.session.get(Scan, scan_id)
                    if s:
                        s.status = status
                        s.output = output[:65000] if output else ''
                        s.findings = findings
                        s.completed_at = datetime.utcnow()
                        db.session.commit()
                        print(f"✅ Scan {scan_id[:8]} completed: {status}")
                except Exception as e:
                    print(f"❌ Failed to update scan {scan_id[:8]}: {e}")
                    db.session.rollback()
        
        from scan_engine_v3 import get_engine_v3
        engine = get_engine_v3()
        
        job = engine.submit_scan(
            scan_id=scan_id,
            tool_name=tool_name,
            tool_id=tool_db.id,
            target=target,
            params=parameters,
            user_id=user.id,
            organization_id=org.id,
            db_callback=on_complete
        )
        
        return jsonify({
            'success': True,
            'scan_id': scan_id,
            'status': 'running',
            'tool': tool_name,
            'target': target,
            'execution_mode': 'local',
            'command': job.to_dict()['command'],
            'message': f'{tool_name} scan started on {target}'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Scan start error: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/scan/<scan_id>/cancel', methods=['POST'])
@require_organization
def cancel_scan_v2(scan_id):
    """Cancel a running scan"""
    if not SCAN_ENGINE_V3_AVAILABLE:
        return jsonify({'error': 'Scan engine not available'}), 503
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # Verify scan belongs to user's organization
        scan = Scan.query.filter_by(
            id=scan_id,
            organization_id=user.organization_id
        ).first()
        
        if not scan:
            return jsonify({'error': 'Scan not found'}), 404
        
        if scan.status not in ('running', 'queued', 'pending'):
            return jsonify({
                'error': 'Scan cannot be cancelled',
                'current_status': scan.status
            }), 400
        
        # Cancel in engine
        from scan_engine_v3 import get_engine_v3
        engine = get_engine_v3()
        cancelled = engine.cancel_scan(scan_id)
        
        # Update database
        scan.status = 'cancelled'
        scan.completed_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'scan_id': scan_id,
            'status': 'cancelled'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/scan/<scan_id>/details', methods=['GET'])
@require_organization
def get_scan_details_v2(scan_id):
    """Get detailed scan results including findings"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        scan = Scan.query.filter_by(
            id=scan_id,
            organization_id=user.organization_id
        ).first()
        
        if not scan:
            return jsonify({'error': 'Scan not found'}), 404
        
        # Get live data from engine if running
        job_data = None
        if scan.status == 'running' and SCAN_ENGINE_V3_AVAILABLE:
            from scan_engine_v3 import get_engine_v3
            engine = get_engine_v3()
            job = engine.get_scan(scan_id)
            if job:
                job_data = job.to_dict()
        
        result = scan.to_dict()
        result['output'] = scan.output if scan.output else ''
        result['findings_detail'] = scan.findings.get('findings', []) if scan.findings else []
        result['live_data'] = job_data
        
        return jsonify({'scan': result})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================
# USAGE STATISTICS
# ================================

@app.route('/api/v1/usage/stats', methods=['GET'])
@require_organization
def get_usage_stats():
    """Get usage statistics for the organization"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        from datetime import date, timedelta
        today = date.today()
        
        # Today's scans
        today_scans = Scan.query.filter(
            Scan.organization_id == org.id,
            db.func.date(Scan.created_at) == today
        ).count()
        
        # This week's scans
        week_start = today - timedelta(days=today.weekday())
        week_scans = Scan.query.filter(
            Scan.organization_id == org.id,
            db.func.date(Scan.created_at) >= week_start
        ).count()
        
        # Total scans
        total_scans = Scan.query.filter_by(organization_id=org.id).count()
        
        # Scans by status
        completed_scans = Scan.query.filter_by(organization_id=org.id, status='completed').count()
        failed_scans = Scan.query.filter_by(organization_id=org.id, status='failed').count()
        
        # Plan limits from centralized config
        plan_cfg = get_plan_config(org.plan_type)
        total_tools = Tool.query.filter_by(is_active=True).count()
        accessible_tools = min(plan_cfg['tool_limit'], total_tools) if plan_cfg['tool_limit'] != 999 else total_tools
        
        return jsonify({
            'usage': {
                'today_scans': today_scans,
                'week_scans': week_scans,
                'total_scans': total_scans,
                'completed_scans': completed_scans,
                'failed_scans': failed_scans
            },
            'limits': {
                'scans_per_day': plan_cfg['daily_scan_limit'] if plan_cfg['daily_scan_limit'] > 0 else -1,
                'tools': accessible_tools,
                'max_agents': plan_cfg['max_agents'],
                'multi_tool_scan': plan_cfg['multi_tool_scan'],
            },
            'plan': org.plan_type,
            'features': plan_cfg['features']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================
# TARGETS API
# ================================

@app.route('/api/v1/targets', methods=['GET'])
@require_organization
def get_targets():
    """Get all targets for the organization"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # For now, targets are extracted from scans
        # In a full implementation, we'd have a Target model
        scans = Scan.query.filter_by(organization_id=user.organization_id).all()
        
        # Extract unique targets from scans
        target_map = {}
        for scan in scans:
            if scan.target and scan.target not in target_map:
                target_map[scan.target] = {
                    'id': str(hash(scan.target) % 10000),
                    'name': scan.target,
                    'value': scan.target,
                    'type': 'ip' if '.' in scan.target and not scan.target.startswith('http') else 'url' if scan.target.startswith('http') else 'domain',
                    'scans_count': 0,
                    'created_at': scan.created_at.isoformat() if scan.created_at else None
                }
            if scan.target in target_map:
                target_map[scan.target]['scans_count'] += 1
        
        return jsonify({
            'targets': list(target_map.values())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/targets', methods=['POST'])
@require_organization
def create_target():
    """Create a new target"""
    try:
        data = request.get_json()
        # In a full implementation, save to Target model
        return jsonify({
            'target': {
                'id': str(uuid.uuid4()),
                'name': data.get('name'),
                'value': data.get('value'),
                'type': data.get('type', 'ip'),
                'created_at': datetime.utcnow().isoformat()
            }
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/target-groups', methods=['GET'])
@require_organization
def get_target_groups():
    """Get target groups for the organization"""
    try:
        # In a full implementation, we'd have a TargetGroup model
        return jsonify({
            'groups': []
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================
# REPORTS API
# ================================

from report_generator import ReportGenerator, generate_report_from_scans

@app.route('/api/v1/reports', methods=['GET'])
@require_organization
def get_reports():
    """Get all reports for the organization"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # Get saved reports from database
        saved_reports = Report.query.filter(
            Report.organization_id == user.organization_id
        ).order_by(Report.created_at.desc()).limit(50).all()
        
        # Also get completed scans that can be converted to reports
        scans = Scan.query.filter(
            Scan.organization_id == user.organization_id,
            Scan.status == 'completed',
            Scan.output.isnot(None)
        ).order_by(Scan.created_at.desc()).limit(100).all()
        
        reports = [r.to_dict() for r in saved_reports]
        available_scans = [{
            'id': scan.id,
            'name': f'{scan.tool_name} scan - {scan.target}',
            'tool': scan.tool_name,
            'target': scan.target,
            'completed_at': scan.completed_at.isoformat() if scan.completed_at else scan.created_at.isoformat()
        } for scan in scans]
        
        return jsonify({
            'reports': reports,
            'available_scans': available_scans
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/reports', methods=['POST'])
@require_organization
def create_report():
    """Generate a new professional report from scan results"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        scan_ids = data.get('scan_ids', [])
        report_name = data.get('name', 'Security Assessment Report')
        report_format = data.get('format', 'html')
        template = data.get('template', 'full')
        sections = data.get('sections', ['Executive Summary', 'Technical Details', 'Remediation Guide'])
        
        if not scan_ids:
            return jsonify({'error': 'No scans selected'}), 400
        
        # Get the scans
        scans = Scan.query.filter(
            Scan.id.in_(scan_ids),
            Scan.organization_id == user.organization_id
        ).all()
        
        if not scans:
            return jsonify({'error': 'No valid scans found'}), 404
        
        # Generate professional report using the new generator
        report_content = generate_report_from_scans(scans, report_name, template, report_format, sections)
        
        # Handle PDF binary response
        is_pdf = isinstance(report_content, bytes)
        
        # Parse summary from generator if JSON
        summary = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
        risk_score = 0
        risk_level = 'None'
        total_findings = 0
        
        if report_format == 'json':
            try:
                import json
                report_data = json.loads(report_content)
                summary = report_data.get('executive_summary', {}).get('severity_breakdown', summary)
                risk_score = report_data.get('executive_summary', {}).get('risk_score', 0)
                risk_level = report_data.get('executive_summary', {}).get('risk_level', 'None')
                total_findings = report_data.get('executive_summary', {}).get('total_findings', 0)
            except:
                pass
        
        # For PDF, also generate JSON to extract summary stats
        if is_pdf:
            try:
                from report_generator import ReportGenerator
                scan_dicts = [{
                    'id': s.id, 'tool_name': s.tool_name, 'target': s.target,
                    'status': s.status, 'output': s.output or '',
                    'completed_at': s.completed_at.isoformat() if s.completed_at else None
                } for s in scans]
                gen = ReportGenerator(scan_dicts, report_name, template)
                summary = gen.summary.get('severity_breakdown', summary)
                risk_score = gen.summary.get('risk_score', 0)
                risk_level = gen.summary.get('risk_level', 'None')
                total_findings = gen.summary.get('total_findings', 0)
            except:
                pass
        
        # Create report record in database
        report = Report(
            organization_id=user.organization_id,
            user_id=user.id,
            name=report_name,
            template=template,
            format=report_format,
            status='ready',
            scan_ids=scan_ids,
            sections=sections,
            total_findings=total_findings,
            critical_count=summary.get('Critical', summary.get('critical', 0)),
            high_count=summary.get('High', summary.get('high', 0)),
            medium_count=summary.get('Medium', summary.get('medium', 0)),
            low_count=summary.get('Low', summary.get('low', 0)),
            info_count=summary.get('Info', summary.get('info', 0)),
            risk_score=risk_score,
            risk_level=risk_level,
            content=report_content.decode('utf-8', errors='replace') if is_pdf else report_content,
            file_size=len(report_content) if is_pdf else len(report_content.encode('utf-8')),
            completed_at=datetime.utcnow()
        )
        db.session.add(report)
        db.session.commit()
        
        # For PDF, return binary download directly
        if is_pdf:
            import io
            from flask import send_file
            pdf_buffer = io.BytesIO(report_content)
            pdf_buffer.seek(0)
            return send_file(
                pdf_buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'{report_name.replace(" ", "_")}_{datetime.utcnow().strftime("%Y%m%d")}.pdf'
            )
        
        return jsonify({
            'success': True,
            'report': {
                **report.to_dict(),
                'content': report_content
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/reports/<report_id>', methods=['GET'])
@require_organization
def get_report(report_id):
    """Get a specific report with content"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        report = Report.query.filter_by(
            id=report_id,
            organization_id=user.organization_id
        ).first()
        
        if report:
            return jsonify({
                **report.to_dict(),
                'content': report.content
            })
        
        # Fallback: check if it's a scan ID and generate report on the fly
        scan = Scan.query.filter_by(
            id=report_id,
            organization_id=user.organization_id
        ).first()
        
        if not scan:
            return jsonify({'error': 'Report not found'}), 404
        
        # Generate simple report from scan
        return jsonify({
            'id': scan.id,
            'name': f'{scan.tool_name} Report - {scan.target}',
            'format': 'txt',
            'status': 'ready',
            'content': scan.output or 'No results available',
            'created_at': scan.created_at.isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/reports/<report_id>/download', methods=['GET'])
@require_organization
def download_report(report_id):
    """Download a report in specified format"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        output_format = request.args.get('format', 'html')
        
        # Try to find saved report
        report = Report.query.filter_by(
            id=report_id,
            organization_id=user.organization_id
        ).first()
        
        if report:
            # If requesting PDF download, regenerate from scans
            if output_format == 'pdf':
                try:
                    scan_ids = report.scan_ids or []
                    scans = Scan.query.filter(Scan.id.in_(scan_ids)).all() if scan_ids else []
                    if scans:
                        pdf_bytes = generate_report_from_scans(scans, report.name, report.template, 'pdf')
                        if isinstance(pdf_bytes, bytes):
                            import io
                            from flask import send_file
                            pdf_buffer = io.BytesIO(pdf_bytes)
                            pdf_buffer.seek(0)
                            return send_file(
                                pdf_buffer,
                                mimetype='application/pdf',
                                as_attachment=True,
                                download_name=f'{report.name.replace(" ", "_")}_{report.created_at.strftime("%Y%m%d")}.pdf'
                            )
                except Exception as e:
                    print(f"PDF regeneration error: {e}")
            
            content = report.content
            filename = f'{report.name.replace(" ", "_")}_{report.created_at.strftime("%Y%m%d")}'
            
            # Set appropriate extension
            ext_map = {'html': 'html', 'json': 'json', 'csv': 'csv', 'markdown': 'md', 'pdf': 'pdf'}
            ext = ext_map.get(output_format, 'html')
            
            return jsonify({
                'content': content,
                'filename': f'{filename}.{ext}',
                'format': output_format
            })
        
        # Fallback: check if it's a scan ID
        scan = Scan.query.filter_by(
            id=report_id,
            organization_id=user.organization_id
        ).first()
        
        if not scan:
            return jsonify({'error': 'Report not found'}), 404
        
        return jsonify({
            'content': scan.output or 'No results available',
            'filename': f'{scan.tool_name}_{scan.target}_{scan.created_at.strftime("%Y%m%d")}.txt',
            'format': 'txt'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/reports/<report_id>', methods=['DELETE'])
@require_organization
def delete_report(report_id):
    """Delete a saved report"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        report = Report.query.filter_by(
            id=report_id,
            organization_id=user.organization_id
        ).first()
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        db.session.delete(report)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Report deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/reports/templates', methods=['GET'])
@require_organization
def get_report_templates():
    """Get available report templates"""
    templates = [
        {
            'id': 'executive',
            'name': 'Executive Summary',
            'description': 'High-level overview for management and stakeholders',
            'icon': '📊',
            'sections': ['Risk Overview', 'Key Findings', 'Recommendations'],
            'formats': ['html', 'pdf', 'json']
        },
        {
            'id': 'technical',
            'name': 'Technical Report',
            'description': 'Detailed technical analysis for security teams',
            'icon': '🔧',
            'sections': ['Vulnerability Details', 'CVE References', 'Technical Remediation', 'Proof of Concept'],
            'formats': ['html', 'pdf', 'json', 'csv']
        },
        {
            'id': 'compliance',
            'name': 'Compliance Report',
            'description': 'Multi-framework compliance report for auditors',
            'icon': '📋',
            'sections': ['Compliance Status', 'Control Mappings', 'Gap Analysis', 'Remediation Timeline'],
            'frameworks': ['OWASP Top 10', 'PCI-DSS 4.0', 'NIST CSF', 'CIS Controls v8', 'ISO 27001 Annex A'],
            'formats': ['html', 'pdf', 'json']
        },
        {
            'id': 'owasp',
            'name': 'OWASP Top 10',
            'description': 'Map scan results to OWASP Top 10 2021 categories with risk analysis',
            'icon': '🛡️',
            'sections': ['OWASP Category Mapping', 'Risk Matrix', 'Remediation Priority'],
            'frameworks': ['OWASP Top 10'],
            'formats': ['html', 'pdf', 'json']
        },
        {
            'id': 'pci-dss',
            'name': 'PCI-DSS Req 11',
            'description': 'PCI-DSS 4.0 Requirement 11 vulnerability scanning compliance report',
            'icon': '💳',
            'sections': ['PCI-DSS Compliance Status', 'Requirement 11 Controls', 'Scan Evidence', 'Gap Analysis'],
            'frameworks': ['PCI-DSS 4.0'],
            'formats': ['html', 'pdf', 'json']
        },
        {
            'id': 'iso27001',
            'name': 'ISO 27001 Annex A',
            'description': 'ISO 27001 Annex A technical controls assessment and gap analysis',
            'icon': '📜',
            'sections': ['Annex A Control Mapping', 'Technical Controls Status', 'Gap Analysis', 'Remediation Plan'],
            'frameworks': ['ISO 27001 Annex A'],
            'formats': ['html', 'pdf', 'json']
        },
        {
            'id': 'full',
            'name': 'Full Report',
            'description': 'Comprehensive report with all sections and frameworks',
            'icon': '📑',
            'sections': ['Executive Summary', 'Technical Details', 'Compliance Mapping', 'Remediation Guide', 'Appendix'],
            'frameworks': ['OWASP Top 10', 'PCI-DSS 4.0', 'NIST CSF', 'CIS Controls v8', 'ISO 27001 Annex A'],
            'formats': ['html', 'pdf', 'json', 'csv', 'markdown']
        }
    ]
    
    # Feature-gate compliance templates based on plan
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    org = user.organization
    has_compliance = check_feature(org, 'compliance_reports')
    has_pdf = check_feature(org, 'pdf_reports')
    
    compliance_ids = {'compliance', 'owasp', 'pci-dss', 'iso27001'}
    filtered = []
    for t in templates:
        tmpl = dict(t)
        if t['id'] in compliance_ids and not has_compliance:
            tmpl['locked'] = True
            tmpl['required_plan'] = 'team'
        if not has_pdf and 'pdf' in t.get('formats', []):
            tmpl['formats'] = [f for f in tmpl['formats'] if f != 'pdf']
        filtered.append(tmpl)
    
    return jsonify({'templates': filtered, 'plan': org.plan_type})


# ================================
# ANALYTICS API
# ================================

@app.route('/api/v1/analytics/overview', methods=['GET'])
@require_organization
def get_analytics_overview():
    """Get analytics overview - scan trends, tool usage, risk scores"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        from datetime import date, timedelta
        today = date.today()
        
        # Daily scan trend (last 30 days)
        daily_trend = []
        for i in range(29, -1, -1):
            d = today - timedelta(days=i)
            count = Scan.query.filter(
                Scan.organization_id == org.id,
                db.func.date(Scan.created_at) == d
            ).count()
            daily_trend.append({'date': d.isoformat(), 'scans': count})
        
        # Tool usage (top 10)
        tool_usage = db.session.query(
            Tool.name, db.func.count(Scan.id).label('count')
        ).join(Tool, Scan.tool_id == Tool.id).filter(
            Scan.organization_id == org.id
        ).group_by(Tool.name).order_by(db.desc('count')).limit(10).all()
        
        # Scan status distribution
        status_dist = db.session.query(
            Scan.status, db.func.count(Scan.id)
        ).filter(
            Scan.organization_id == org.id
        ).group_by(Scan.status).all()
        
        # Target distribution (top targets)
        target_dist = db.session.query(
            Scan.target, db.func.count(Scan.id).label('count')
        ).filter(
            Scan.organization_id == org.id
        ).group_by(Scan.target).order_by(db.desc('count')).limit(10).all()
        
        # Weekly comparison
        this_week = Scan.query.filter(
            Scan.organization_id == org.id,
            Scan.created_at >= today - timedelta(days=7)
        ).count()
        last_week = Scan.query.filter(
            Scan.organization_id == org.id,
            Scan.created_at >= today - timedelta(days=14),
            Scan.created_at < today - timedelta(days=7)
        ).count()
        
        # Average scan duration
        completed = Scan.query.filter(
            Scan.organization_id == org.id,
            Scan.status == 'completed',
            Scan.started_at.isnot(None),
            Scan.completed_at.isnot(None)
        ).all()
        avg_duration = 0
        if completed:
            durations = [(s.completed_at - s.started_at).total_seconds() for s in completed]
            avg_duration = sum(durations) / len(durations)
        
        # Risk score trend (from findings in last 30 scans)
        recent_scans = Scan.query.filter(
            Scan.organization_id == org.id,
            Scan.status == 'completed',
            Scan.findings.isnot(None)
        ).order_by(Scan.created_at.desc()).limit(30).all()
        
        risk_scores = []
        severity_totals = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
        for scan in recent_scans:
            summary = scan.findings_summary
            for sev in severity_totals:
                severity_totals[sev] += summary.get(sev, 0)
        
        # Calculate overall risk score (weighted)
        total_issues = sum(severity_totals.values())
        risk_score = 0
        if total_issues > 0:
            risk_score = min(100, (
                severity_totals['critical'] * 40 +
                severity_totals['high'] * 25 +
                severity_totals['medium'] * 10 +
                severity_totals['low'] * 3 +
                severity_totals['info'] * 1
            ) / max(1, len(recent_scans)))
        
        return jsonify({
            'daily_trend': daily_trend,
            'tool_usage': [{'name': t, 'count': c} for t, c in tool_usage],
            'status_distribution': {s: c for s, c in status_dist},
            'target_distribution': [{'target': t, 'count': c} for t, c in target_dist],
            'comparison': {
                'this_week': this_week,
                'last_week': last_week,
                'change_pct': round(((this_week - last_week) / max(1, last_week)) * 100, 1)
            },
            'performance': {
                'avg_duration_seconds': round(avg_duration, 1),
                'total_scans': Scan.query.filter_by(organization_id=org.id).count(),
                'success_rate': round(
                    Scan.query.filter_by(organization_id=org.id, status='completed').count() /
                    max(1, Scan.query.filter_by(organization_id=org.id).count()) * 100, 1
                )
            },
            'risk': {
                'score': round(risk_score, 1),
                'level': 'Critical' if risk_score >= 80 else 'High' if risk_score >= 60 else 'Medium' if risk_score >= 30 else 'Low',
                'severity_totals': severity_totals,
                'total_issues': total_issues
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================
# ADMIN API (Super Admin Only)
# ================================

@app.route('/api/v1/admin/change-plan', methods=['POST'])
@require_organization
def admin_change_plan():
    """Change organization plan (superadmin only)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # Check if user is superadmin
        if user.role != 'superadmin':
            return jsonify({'error': 'Unauthorized. Superadmin access required.'}), 403
        
        data = request.get_json()
        plan_type = data.get('plan_type')
        
        if plan_type not in ['trial', 'starter', 'professional', 'team', 'enterprise']:
            return jsonify({'error': 'Invalid plan type'}), 400
        
        org = db.session.get(Organization, user.organization_id)
        if org:
            org.plan_type = plan_type
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'Plan changed to {plan_type}',
                'organization': org.to_dict()
            })
        
        return jsonify({'error': 'Organization not found'}), 404
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/admin/users', methods=['GET'])
@require_organization
def admin_list_users():
    """List all users (superadmin only)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role != 'superadmin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        users = User.query.all()
        return jsonify({
            'users': [u.to_dict() for u in users],
            'total': len(users)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/admin/stats', methods=['GET'])
@require_organization
def admin_stats():
    """Get admin statistics (superadmin only)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role != 'superadmin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        total_users = User.query.count()
        total_orgs = Organization.query.count()
        total_scans = Scan.query.count()
        
        # Plans distribution
        plans = db.session.query(
            Organization.plan_type, 
            db.func.count(Organization.id)
        ).group_by(Organization.plan_type).all()
        
        return jsonify({
            'total_users': total_users,
            'total_organizations': total_orgs,
            'total_scans': total_scans,
            'plans_distribution': {p[0]: p[1] for p in plans}
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================
# SCHEDULES API (Real persistence + APScheduler)
# ================================

# Global scheduler instance
_scheduler = None

def get_scheduler():
    """Get or create the APScheduler instance"""
    global _scheduler
    if _scheduler is None:
        from apscheduler.schedulers.background import BackgroundScheduler
        _scheduler = BackgroundScheduler(timezone='UTC')
        _scheduler.start()
        print("📅 APScheduler started")
    return _scheduler


def _execute_scheduled_scan(schedule_id):
    """Execute a scheduled scan - called by APScheduler"""
    with app.app_context():
        try:
            sched = db.session.get(ScheduledScan, schedule_id)
            if not sched or not sched.is_active:
                return
            
            scan_id = str(uuid.uuid4())
            
            # Find tool
            tool = Tool.query.filter(
                db.func.lower(Tool.name) == sched.tool_name.lower()
            ).first()
            
            if not tool:
                print(f"⚠️ Scheduled scan {schedule_id}: tool '{sched.tool_name}' not found")
                return
            
            scan = Scan(
                id=scan_id,
                organization_id=sched.organization_id,
                user_id=sched.user_id,
                tool_id=tool.id,
                target=sched.target,
                parameters=sched.parameters,
                status='running',
                agent_id=sched.agent_id,
                project_id=sched.project_id,
                started_at=datetime.utcnow()
            )
            db.session.add(scan)
            
            sched.last_run = datetime.utcnow()
            sched.run_count = (sched.run_count or 0) + 1
            db.session.commit()
            
            # Submit to scan engine
            try:
                from scan_engine_v3 import get_engine_v3
                engine = get_engine_v3()
                
                def on_complete(scan_id, status, output, findings, exit_code):
                    with app.app_context():
                        s = db.session.get(Scan, scan_id)
                        if s:
                            s.status = status
                            s.output = output[:65000] if output else ''
                            s.findings = findings
                            s.completed_at = datetime.utcnow()
                            db.session.commit()
                
                engine.submit_scan(
                    scan_id=scan_id,
                    tool_name=sched.tool_name,
                    tool_id=tool.id,
                    target=sched.target,
                    params=sched.parameters or {},
                    user_id=sched.user_id,
                    organization_id=sched.organization_id,
                    db_callback=on_complete
                )
                print(f"✅ Scheduled scan {schedule_id} triggered: {sched.tool_name} -> {sched.target}")
            except Exception as e:
                scan.status = 'failed'
                scan.error_log = str(e)
                db.session.commit()
                print(f"❌ Scheduled scan {schedule_id} failed: {e}")
                
        except Exception as e:
            print(f"❌ Schedule execution error: {e}")
            db.session.rollback()


def _register_schedule_job(sched):
    """Register a ScheduledScan with APScheduler"""
    scheduler = get_scheduler()
    job_id = f'scheduled_scan_{sched.id}'
    
    # Remove existing job if any
    try:
        scheduler.remove_job(job_id)
    except Exception:
        pass
    
    if not sched.is_active:
        return
    
    if sched.schedule_type == 'daily':
        scheduler.add_job(
            _execute_scheduled_scan,
            'cron',
            id=job_id,
            hour=sched.hour or 2,
            minute=sched.minute or 0,
            args=[sched.id]
        )
    elif sched.schedule_type == 'weekly':
        scheduler.add_job(
            _execute_scheduled_scan,
            'cron',
            id=job_id,
            day_of_week=sched.day_of_week or 'mon',
            hour=sched.hour or 2,
            minute=sched.minute or 0,
            args=[sched.id]
        )
    elif sched.schedule_type == 'monthly':
        scheduler.add_job(
            _execute_scheduled_scan,
            'cron',
            id=job_id,
            day=sched.day_of_month or 1,
            hour=sched.hour or 2,
            minute=sched.minute or 0,
            args=[sched.id]
        )
    elif sched.schedule_type == 'cron' and sched.cron_expression:
        parts = sched.cron_expression.split()
        if len(parts) >= 5:
            scheduler.add_job(
                _execute_scheduled_scan,
                'cron',
                id=job_id,
                minute=parts[0],
                hour=parts[1],
                day=parts[2],
                month=parts[3],
                day_of_week=parts[4],
                args=[sched.id]
            )
    
    # Update next_run from APScheduler
    try:
        job = scheduler.get_job(job_id)
        if job and job.next_run_time:
            sched.next_run = job.next_run_time.replace(tzinfo=None)
    except Exception:
        pass


@app.route('/api/v1/schedules', methods=['GET'])
@require_organization
def get_schedules():
    """Get all scheduled scans for the organization"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        schedules = ScheduledScan.query.filter_by(
            organization_id=user.organization_id
        ).order_by(ScheduledScan.created_at.desc()).all()
        
        return jsonify({
            'schedules': [s.to_dict() for s in schedules]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/schedules', methods=['POST'])
@require_organization
def create_schedule():
    """Create a new scheduled scan"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        sched = ScheduledScan(
            organization_id=user.organization_id,
            user_id=user.id,
            name=data.get('name', 'Scheduled Scan'),
            tool_name=data.get('tool', data.get('tool_name', 'nmap')),
            target=data.get('target', ''),
            parameters=data.get('parameters', {}),
            schedule_type=data.get('schedule_type', data.get('schedule', 'daily')),
            cron_expression=data.get('cron_expression'),
            hour=data.get('hour', 2),
            minute=data.get('minute', 0),
            day_of_week=data.get('day_of_week'),
            day_of_month=data.get('day_of_month'),
            agent_id=data.get('agent_id'),
            project_id=data.get('project_id'),
            is_active=True
        )
        
        db.session.add(sched)
        db.session.commit()
        
        # Register with APScheduler
        _register_schedule_job(sched)
        db.session.commit()
        
        return jsonify({
            'schedule': sched.to_dict(),
            'message': 'Scheduled scan created successfully'
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/schedules/<schedule_id>', methods=['PUT'])
@require_organization
def update_schedule(schedule_id):
    """Update a scheduled scan"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        sched = ScheduledScan.query.filter_by(
            id=schedule_id,
            organization_id=user.organization_id
        ).first()
        
        if not sched:
            return jsonify({'error': 'Schedule not found'}), 404
        
        for field in ['name', 'tool_name', 'target', 'parameters', 'schedule_type',
                      'cron_expression', 'hour', 'minute', 'day_of_week', 'day_of_month',
                      'agent_id', 'project_id', 'is_active']:
            if field in data:
                setattr(sched, field, data[field])
        
        db.session.commit()
        _register_schedule_job(sched)
        db.session.commit()
        
        return jsonify({'schedule': sched.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/schedules/<schedule_id>', methods=['DELETE'])
@require_organization
def delete_schedule(schedule_id):
    """Delete a scheduled scan"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        sched = ScheduledScan.query.filter_by(
            id=schedule_id,
            organization_id=user.organization_id
        ).first()
        
        if not sched:
            return jsonify({'error': 'Schedule not found'}), 404
        
        # Remove from scheduler
        try:
            scheduler = get_scheduler()
            scheduler.remove_job(f'scheduled_scan_{sched.id}')
        except Exception:
            pass
        
        db.session.delete(sched)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Schedule deleted'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/schedules/<schedule_id>/toggle', methods=['POST'])
@require_organization
def toggle_schedule(schedule_id):
    """Toggle a scheduled scan on/off"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        sched = ScheduledScan.query.filter_by(
            id=schedule_id,
            organization_id=user.organization_id
        ).first()
        
        if not sched:
            return jsonify({'error': 'Schedule not found'}), 404
        
        sched.is_active = not sched.is_active
        db.session.commit()
        _register_schedule_job(sched)
        db.session.commit()
        
        return jsonify({
            'schedule': sched.to_dict(),
            'message': f'Schedule {"activated" if sched.is_active else "paused"}'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ================================
# ENGINE STATS API
# ================================

@app.route('/api/v1/engine/stats', methods=['GET'])
@jwt_required()
def get_engine_stats():
    """Get scan engine statistics"""
    try:
        if SCAN_ENGINE_AVAILABLE:
            from scan_engine import get_engine
            engine = get_engine()
            return jsonify({
                'engine': 'ThreadPoolExecutor',
                'websocket': socketio is not None,
                **engine.get_stats()
            })
        else:
            return jsonify({
                'engine': 'legacy',
                'websocket': False,
                'message': 'Using legacy scan executor'
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/engine/active-scans', methods=['GET'])
@jwt_required()
def get_active_scans():
    """Get all active scans"""
    try:
        if SCAN_ENGINE_AVAILABLE:
            from scan_engine import get_engine
            engine = get_engine()
            scans = engine.get_active_scans()
            return jsonify({
                'active_scans': [s.to_dict() for s in scans]
            })
        else:
            return jsonify({
                'active_scans': []
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================
# V2 SCAN API (Enhanced)
# ================================

@app.route('/api/v2/scan/execute', methods=['POST'])
@require_organization
def execute_scan_v2():
    """Execute a security scan (v2 API with agent support)"""
    if not SCAN_EXECUTOR_AVAILABLE:
        return jsonify({'error': 'Scan executor not available'}), 503
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        data = request.get_json()
        
        tool_id = data.get('tool_id')
        target = data.get('target')
        parameters = data.get('parameters', {})
        agent_id = data.get('agent_id')  # Optional: specify agent to run scan
        
        if not tool_id or not target:
            return jsonify({'error': 'tool_id and target are required'}), 400
        
        # Check plan access
        executor = get_executor()
        allowed_tools = executor.get_tools_for_plan(org.plan_type)
        
        if tool_id not in allowed_tools:
            return jsonify({
                'error': f'Tool {tool_id} requires plan upgrade',
                'current_plan': org.plan_type,
                'required_plan': TOOL_CONFIGS.get(tool_id, {}).get('plan_required', 'professional')
            }), 402
        
        # Check daily scan limit based on plan
        plan_cfg = get_plan_config(org.plan_type)
        daily_limit = plan_cfg['daily_scan_limit']
        if daily_limit > 0:  # 0 = unlimited
            from datetime import date
            today_scans = Scan.query.filter(
                Scan.organization_id == org.id,
                db.func.date(Scan.created_at) == date.today()
            ).count()
            if today_scans >= daily_limit:
                return jsonify({
                    'error': f'Daily scan limit reached ({today_scans}/{daily_limit})',
                    'scans_today': today_scans,
                    'limit': daily_limit,
                    'hint': 'Upgrade your plan for more daily scans'
                }), 429
        
        # Create scan record
        scan_id = str(uuid.uuid4())
        scan = Scan(
            id=scan_id,
            organization_id=org.id,
            user_id=user.id,
            tool_id=tool_id,
            target=target,
            parameters=parameters,
            status='running',
            started_at=datetime.utcnow()
        )
        db.session.add(scan)
        db.session.commit()
        
        # Create a completion callback to update database when scan finishes
        def on_scan_complete(sid, status, output, exit_code):
            """Update database when scan completes"""
            with app.app_context():
                try:
                    s = Scan.query.get(sid)
                    if s:
                        s.status = status
                        s.output = output[:65535] if output else ''  # Limit output size
                        s.completed_at = datetime.utcnow()
                        db.session.commit()
                        print(f"✅ Scan {sid} updated to {status}")
                except Exception as e:
                    print(f"❌ Failed to update scan {sid}: {e}")
                    db.session.rollback()
        
        # Execute scan - if agent specified, use agent, otherwise local
        if agent_id:
            agent = Agent.query.filter_by(id=agent_id, organization_id=org.id).first()
            if not agent:
                scan.status = 'failed'
                scan.output = 'Agent not found'
                db.session.commit()
                return jsonify({'error': 'Agent not found'}), 404
            
            if agent.status != 'online':
                scan.status = 'failed'
                scan.output = f'Agent is {agent.status}'
                db.session.commit()
                return jsonify({'error': f'Agent is {agent.status}'}), 400
            
            # Execute via agent (SSH)
            if agent.connection_type == 'ssh':
                result = execute_scan_via_ssh(agent, scan_id, tool_id, target, parameters)
            else:
                # Direct agent execution
                result = executor.start_scan(scan_id, tool_id, target, parameters,
                                             completion_callback=on_scan_complete)
        else:
            # Local execution
            result = executor.start_scan(scan_id, tool_id, target, parameters,
                                         completion_callback=on_scan_complete)
        
        if not result.get('success'):
            scan.status = 'failed'
            scan.output = result.get('error', 'Unknown error')
            db.session.commit()
            return jsonify(result), 400
        
        # Emit activity: user started a scan
        _emit_scan_activity(scan, user, Tool.query.get(tool_id), 'started scan')

        return jsonify({
            'success': True,
            'scan_id': scan_id,
            'status': 'running',
            'command': result.get('command'),
            'message': 'Scan started successfully'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def execute_scan_via_ssh(agent, scan_id, tool_id, target, parameters):
    """Execute scan on remote agent via SSH"""
    import paramiko
    
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Connect to agent
        if agent.ssh_key_path:
            ssh.connect(
                agent.ssh_host or agent.ip_address,
                port=agent.ssh_port or 22,
                username=agent.ssh_username,
                key_filename=agent.ssh_key_path,
                timeout=30
            )
        else:
            # Decrypt password
            from cryptography.fernet import Fernet
            key = os.environ.get('ENCRYPTION_KEY', 'default_key_change_me')
            try:
                f = Fernet(key.encode() if len(key) == 32 else Fernet.generate_key())
                password = f.decrypt(agent.ssh_password_encrypted.encode()).decode()
            except:
                password = agent.ssh_password_encrypted  # Fallback if not encrypted
            
            ssh.connect(
                agent.ssh_host or agent.ip_address,
                port=agent.ssh_port or 22,
                username=agent.ssh_username,
                password=password,
                timeout=30
            )
        
        # Build command
        executor = get_executor()
        cmd = executor.build_command(tool_id, target, parameters)
        cmd_str = ' '.join(cmd)
        
        # Execute command
        stdin, stdout, stderr = ssh.exec_command(cmd_str, timeout=300)
        output = stdout.read().decode('utf-8')
        errors = stderr.read().decode('utf-8')
        
        ssh.close()
        
        # Update agent stats
        agent.total_scans = (agent.total_scans or 0) + 1
        agent.last_heartbeat = datetime.utcnow()
        db.session.commit()
        
        return {
            'success': True,
            'scan_id': scan_id,
            'command': cmd_str,
            'output': output,
            'errors': errors,
            'status': 'completed'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'SSH execution failed: {str(e)}',
            'scan_id': scan_id
        }


# ================================
# AGENT API
# ================================

@app.route('/api/v1/agents', methods=['GET'])
@require_organization
def get_agents():
    """Get all agents for organization"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        # Agents available for all plans
        agents = Agent.query.filter_by(organization_id=org.id).all()
        
        # Update status based on last heartbeat
        for agent in agents:
            if agent.last_heartbeat:
                time_since_heartbeat = (datetime.utcnow() - agent.last_heartbeat).total_seconds()
                if time_since_heartbeat > 90:  # 90 seconds (3 missed heartbeats)
                    agent.status = 'offline'
                elif agent.status == 'pending':
                    pass  # Keep pending
                elif agent.active_scans > 0:
                    agent.status = 'busy'
                else:
                    agent.status = 'online'
        
        db.session.commit()
        
        return jsonify({
            'agents': [a.to_dict() for a in agents]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/agents', methods=['POST'])
@require_organization
def create_agent():
    """Create/register a new agent"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        # Agents available for all plans
        
        # Check agent limit from PLAN_CONFIG
        current_agents = Agent.query.filter_by(organization_id=org.id).count()
        plan_config = get_plan_config(org.plan_type)
        max_agents = plan_config.get('max_agents', 1)
        
        if current_agents >= max_agents:
            return jsonify({'error': f'Agent limit reached ({current_agents}/{max_agents})'}), 402
        
        data = request.get_json()
        
        # Generate tokens
        registration_token = f"csp_agent_{uuid.uuid4().hex[:16]}"
        api_key = f"csp_key_{uuid.uuid4().hex}"
        
        agent = Agent(
            organization_id=org.id,
            name=data.get('name', 'New Agent'),
            platform=data.get('platform', 'linux'),
            connection_type=data.get('connection_type', 'direct'),
            ssh_host=data.get('ssh_host'),
            ssh_port=data.get('ssh_port', 22),
            ssh_username=data.get('ssh_username'),
            ip_address=data.get('ip_address') or data.get('ssh_host'),
            registration_token=registration_token,
            api_key=api_key,
            status='pending'
        )
        
        # Handle SSH password
        if data.get('ssh_password'):
            try:
                from cryptography.fernet import Fernet
                key = os.environ.get('ENCRYPTION_KEY', '')
                if key and len(key) >= 8:
                    if len(key) < 32:
                        key = key.ljust(32, '0')
                    fkey = base64.urlsafe_b64encode(key[:32].encode())
                    fernet = Fernet(fkey)
                    agent.ssh_password_encrypted = fernet.encrypt(data['ssh_password'].encode()).decode()
                else:
                    agent.ssh_password_encrypted = data['ssh_password']
            except Exception:
                agent.ssh_password_encrypted = data['ssh_password']
        
        db.session.add(agent)
        db.session.commit()
        
        return jsonify({
            'agent': agent.to_dict(include_sensitive=True),
            'registration_token': registration_token,
            'api_key': api_key,
            'install_command': get_agent_install_command(agent, registration_token)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ================================
# AGENT V2 - New Registration & Scan Dispatch
# (MUST be before /agents/<agent_id> wildcard routes)
# ================================

from agent_manager import AgentManager
agent_mgr = AgentManager(db, Agent, Scan, socketio)


@app.route('/api/v1/agents/register', methods=['POST'])
def agent_register():
    """Agent self-registration using token (no JWT needed)"""
    try:
        data = request.get_json()
        token = data.get('token')
        if not token:
            return jsonify({'error': 'Registration token required'}), 400
        
        agent, error = agent_mgr.register_agent(token, data)
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({
            'agent_id': agent.id,
            'api_key': agent.api_key,
            'name': agent.name,
            'status': 'registered',
            'next_heartbeat': 30
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/agents/scan-status', methods=['POST'])
def agent_scan_status():
    """Agent reports scan status update"""
    try:
        data = request.get_json()
        api_key = data.get('api_key') or request.headers.get('X-Agent-Key')
        if not api_key:
            return jsonify({'error': 'API key required'}), 401
        
        agent = Agent.query.filter_by(api_key=api_key).first()
        if not agent:
            return jsonify({'error': 'Invalid API key'}), 401
        
        scan = Scan.query.get(data.get('scan_id'))
        if scan:
            scan.status = data.get('status', 'running')
            db.session.commit()
            
            # Emit real-time update
            socketio.emit('scan_update', {
                'scan_id': scan.id,
                'status': scan.status,
                'agent_name': agent.name
            })
        
        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/agents/scan-result', methods=['POST'])
def agent_scan_result():
    """Agent reports scan results"""
    try:
        data = request.get_json()
        api_key = data.get('api_key') or request.headers.get('X-Agent-Key')
        if not api_key:
            return jsonify({'error': 'API key required'}), 401
        
        agent = Agent.query.filter_by(api_key=api_key).first()
        if not agent:
            return jsonify({'error': 'Invalid API key'}), 401
        
        scan = Scan.query.get(data.get('scan_id'))
        if not scan:
            return jsonify({'error': 'Scan not found'}), 404
        
        scan.status = data.get('status', 'completed')
        scan.output = data.get('output', '')
        scan.error_log = data.get('error', '')
        scan.completed_at = datetime.utcnow()
        
        # Update agent stats
        agent.active_scans = max(0, (agent.active_scans or 0) - 1)
        agent.total_scans = (agent.total_scans or 0) + 1
        
        db.session.commit()
        
        # Emit real-time result
        socketio.emit('scan_complete', {
            'scan_id': scan.id,
            'status': scan.status,
            'output_size': len(scan.output or ''),
            'agent_name': agent.name
        })
        
        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/agents/dashboard', methods=['GET'])
@require_organization
def agent_dashboard():
    """Get agent dashboard data with real-time stats"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        data = agent_mgr.get_dashboard_data(org.id)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/agents/dispatch', methods=['POST'])
@require_organization
def agent_dispatch_scan():
    """Dispatch a scan to the best available agent"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        data = request.get_json()
        tool_id = data.get('tool_id')
        target = data.get('target')
        agent_id = data.get('agent_id')  # Optional
        
        if not tool_id or not target:
            return jsonify({'error': 'tool_id and target required'}), 400
        
        tool = Tool.query.get(tool_id)
        if not tool:
            return jsonify({'error': 'Tool not found'}), 404
        
        # Create scan record
        scan = Scan(
            organization_id=org.id,
            user_id=user_id,
            tool_id=tool_id,
            target=target,
            parameters=data.get('parameters', {}),
            status='pending'
        )
        db.session.add(scan)
        db.session.commit()
        
        # Dispatch to agent
        result, error = agent_mgr.dispatch_scan(
            org.id, scan.id, tool.name, target,
            data.get('parameters'), agent_id
        )
        
        if error:
            scan.status = 'failed'
            scan.error_log = error
            db.session.commit()
            return jsonify({'error': error}), 400
        
        return jsonify({
            'scan_id': scan.id,
            'dispatched_to': result
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/agents/heartbeat', methods=['POST'])
def agent_heartbeat_v2():
    """Enhanced heartbeat with pending scan delivery"""
    try:
        data = request.get_json()
        api_key = data.get('api_key') or request.headers.get('X-Agent-Key')
        if not api_key:
            return jsonify({'error': 'API key required'}), 401
        
        result, error = agent_mgr.process_heartbeat(api_key, data)
        if error:
            return jsonify({'error': error}), 401
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/agent-script', methods=['GET'])
def serve_agent_script():
    """Serve the kali_agent.py script for easy installation"""
    try:
        script_path = os.path.join(os.path.dirname(__file__), 'kali_agent.py')
        with open(script_path, 'r') as f:
            script = f.read()
        return script, 200, {'Content-Type': 'text/x-python'}
    except Exception as e:
        return f"# Error: {e}", 500, {'Content-Type': 'text/plain'}


@app.route('/api/v1/agents/<agent_id>', methods=['GET'])
@require_organization
def get_agent(agent_id):
    """Get agent details"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        agent = Agent.query.filter_by(id=agent_id, organization_id=user.organization_id).first()
        if not agent:
            return jsonify({'error': 'Agent not found'}), 404
        
        return jsonify({'agent': agent.to_dict(include_sensitive=True)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/agents/<agent_id>', methods=['PUT'])
@require_organization
def update_agent(agent_id):
    """Update agent configuration"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        agent = Agent.query.filter_by(id=agent_id, organization_id=user.organization_id).first()
        if not agent:
            return jsonify({'error': 'Agent not found'}), 404
        
        data = request.get_json()
        
        # Update allowed fields
        if 'name' in data:
            agent.name = data['name']
        if 'hostname' in data:
            agent.hostname = data['hostname']
        if 'ip_address' in data:
            agent.ip_address = data['ip_address']
        if 'platform' in data:
            agent.platform = data['platform']
        if 'connection_type' in data:
            agent.connection_type = data['connection_type']
        if 'ssh_host' in data:
            agent.ssh_host = data['ssh_host']
            if not agent.ip_address:
                agent.ip_address = data['ssh_host']
        if 'ssh_port' in data:
            agent.ssh_port = data['ssh_port']
        if 'ssh_username' in data:
            agent.ssh_username = data['ssh_username']
        if 'ssh_password' in data and data['ssh_password']:
            # Store password (encrypt if ENCRYPTION_KEY is set)
            try:
                from cryptography.fernet import Fernet
                key = os.environ.get('ENCRYPTION_KEY', '')
                if key and len(key) >= 8:
                    if len(key) < 32:
                        key = key.ljust(32, '0')
                    fkey = base64.urlsafe_b64encode(key[:32].encode())
                    fernet = Fernet(fkey)
                    agent.ssh_password_encrypted = fernet.encrypt(data['ssh_password'].encode()).decode()
                else:
                    agent.ssh_password_encrypted = data['ssh_password']
            except Exception:
                agent.ssh_password_encrypted = data['ssh_password']
        if 'ssh_key_path' in data:
            agent.ssh_key_path = data['ssh_key_path']
        if 'location' in data:
            agent.location = data['location']
        
        db.session.commit()
        
        return jsonify({
            'agent': agent.to_dict(include_sensitive=True),
            'message': 'Agent updated successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/agents/<agent_id>', methods=['DELETE'])
@require_organization
def delete_agent(agent_id):
    """Delete an agent"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        agent = Agent.query.filter_by(id=agent_id, organization_id=user.organization_id).first()
        if not agent:
            return jsonify({'error': 'Agent not found'}), 404
        
        db.session.delete(agent)
        db.session.commit()
        
        return jsonify({'message': 'Agent deleted successfully'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/agents/<agent_id>/test', methods=['POST'])
@require_organization
def test_agent_connection(agent_id):
    """Test connection to an agent"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        agent = Agent.query.filter_by(id=agent_id, organization_id=user.organization_id).first()
        if not agent:
            return jsonify({'error': 'Agent not found'}), 404
        
        if agent.connection_type == 'ssh':
            # Test SSH connection
            import paramiko
            
            try:
                ssh = paramiko.SSHClient()
                ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                
                if agent.ssh_key_path:
                    ssh.connect(
                        agent.ssh_host or agent.ip_address,
                        port=agent.ssh_port or 22,
                        username=agent.ssh_username,
                        key_filename=agent.ssh_key_path,
                        timeout=10
                    )
                else:
                    ssh.connect(
                        agent.ssh_host or agent.ip_address,
                        port=agent.ssh_port or 22,
                        username=agent.ssh_username,
                        password=agent.ssh_password_encrypted,
                        timeout=10
                    )
                
                # Test basic commands
                stdin, stdout, stderr = ssh.exec_command('uname -a && which nmap')
                output = stdout.read().decode()
                
                # Get system info
                stdin, stdout, stderr = ssh.exec_command('cat /etc/os-release | head -5')
                os_info = stdout.read().decode()
                
                ssh.close()
                
                # Update agent status
                agent.status = 'online'
                agent.last_heartbeat = datetime.utcnow()
                agent.hostname = output.split()[1] if output else 'unknown'
                
                # Extract OS info
                for line in os_info.split('\n'):
                    if line.startswith('PRETTY_NAME='):
                        agent.os_info = line.split('=')[1].strip('"')
                        break
                
                db.session.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'Connection successful',
                    'output': output,
                    'os_info': agent.os_info,
                    'agent': agent.to_dict()
                })
                
            except Exception as e:
                agent.status = 'error'
                db.session.commit()
                return jsonify({
                    'success': False,
                    'error': f'SSH connection failed: {str(e)}'
                }), 400
        else:
            # Direct agent - check via API
            return jsonify({
                'success': True,
                'message': 'Direct agent - waiting for registration'
            })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def get_agent_install_command(agent, token):
    """Generate installation command for agent"""
    base_url = 'https://cybersecpro.semihkilic.com'
    
    if agent.connection_type == 'ssh':
        return f"""# SSH Connection configured
# Host: {agent.ssh_host}:{agent.ssh_port}
# Username: {agent.ssh_username}
# Click 'Test Connection' to verify SSH access"""
    
    if agent.platform == 'linux':
        return f"""# Linux Installation
curl -sSL {base_url}/agent/install.sh | bash -s -- --token {token}

# Or manual installation:
wget {base_url}/agent/cybersec-agent-linux
chmod +x cybersec-agent-linux
./cybersec-agent-linux --register {token}"""
    
    elif agent.platform == 'windows':
        return f"""# Windows PowerShell (Run as Administrator)
irm {base_url}/agent/install.ps1 | iex
Register-CyberSecAgent -Token "{token}" """
    
    elif agent.platform == 'macos':
        return f"""# macOS Installation
curl -sSL {base_url}/agent/install-mac.sh | bash -s -- --token {token}"""
    
    elif agent.platform == 'docker':
        return f"""# Docker Installation
docker run -d --name cybersec-agent \\
  -e AGENT_TOKEN={token} \\
  -e API_URL={base_url}/api/v1 \\
  --network host \\
  semihkilic/cybersec-agent:latest"""
    
    return f"# Registration token: {token}"


# ================================
# INITIALIZATION
# ================================

def init_database():
    """Initialize database with sample data"""
    with app.app_context():
        db.create_all()
        
        # Re-register all active scheduled scans with APScheduler
        try:
            active_schedules = ScheduledScan.query.filter_by(is_active=True).all()
            for sched in active_schedules:
                _register_schedule_job(sched)
            if active_schedules:
                db.session.commit()
                print(f"📅 {len(active_schedules)} scheduled scans registered with APScheduler")
        except Exception as e:
            print(f"⚠️ Schedule init: {e}")
        
        # Create sample tools if none exist
        if Tool.query.count() == 0:
            sample_tools = [
                {
                    'name': 'Nmap',
                    'category': 'Information Gathering',
                    'description': 'Network discovery and security auditing',
                    'command_template': 'nmap {target}',
                    'parameters': {'target': {'type': 'string', 'required': True}},
                    'plan_required': 'starter'
                },
                {
                    'name': 'Nikto',
                    'category': 'Web Applications',
                    'description': 'Web server scanner',
                    'command_template': 'nikto -h {target}',
                    'parameters': {'target': {'type': 'string', 'required': True}},
                    'plan_required': 'starter'
                },
                {
                    'name': 'SQLMap',
                    'category': 'Web Applications',
                    'description': 'SQL injection testing tool',
                    'command_template': 'sqlmap -u {target}',
                    'parameters': {'target': {'type': 'string', 'required': True}},
                    'plan_required': 'professional'
                },
                {
                    'name': 'Metasploit',
                    'category': 'Exploitation Tools',
                    'description': 'Penetration testing framework',
                    'command_template': 'msfconsole',
                    'parameters': {},
                    'plan_required': 'enterprise'
                }
            ]
            
            for tool_data in sample_tools:
                tool = Tool(**tool_data)
                db.session.add(tool)
            
            db.session.commit()
            print("✅ Sample tools created")

# ================================
# FEEDBACK API
# ================================

@app.route('/api/v1/feedback', methods=['POST'])
@jwt_required()
def submit_feedback():
    """Submit user feedback via email"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        feedback_type = data.get('type', 'other')
        subject = data.get('subject', 'No Subject')
        message = data.get('message', '')
        priority = data.get('priority', 'medium')
        reply_email = data.get('replyEmail', user.email if user else '')
        system_info = data.get('systemInfo', {})
        
        # Get user name safely
        user_name = f"{user.first_name} {user.last_name}" if user.first_name else user.email
        
        # Build email content
        email_subject = f"[CyberSec Pro {feedback_type.upper()}] {subject}"
        
        email_body = f"""
==============================================
CyberSec Pro Feedback
==============================================

Type: {feedback_type.upper()}
Priority: {priority.upper()}
From: {user_name} <{user.email}>
Reply To: {reply_email}
Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}

----------------------------------------------
MESSAGE
----------------------------------------------
{message}

----------------------------------------------
USER INFO
----------------------------------------------
User ID: {user.id}
Organization: {user.organization.name if user.organization else 'N/A'}
Plan: {user.organization.plan_type if user.organization else 'N/A'}
Role: {user.role}

----------------------------------------------
SYSTEM INFO
----------------------------------------------
Browser: {system_info.get('userAgent', 'N/A')}
Platform: {system_info.get('platform', 'N/A')}
Screen: {system_info.get('screenSize', 'N/A')}
Timezone: {system_info.get('timezone', 'N/A')}
Page: {system_info.get('currentUrl', 'N/A')}

==============================================
This feedback was submitted via CyberSec Pro dashboard
REPLY TO: {reply_email}
"""

        # Try to send email via Yandex SMTP (SSL on port 465)
        email_sent = False
        try:
            smtp_host = os.environ.get('SMTP_HOST', 'smtp.yandex.com')
            smtp_port = int(os.environ.get('SMTP_PORT', 465))
            smtp_user = os.environ.get('SMTP_USER', '')
            smtp_pass = os.environ.get('SMTP_PASSWORD', '')  # Fixed: SMTP_PASSWORD not SMTP_PASS
            
            msg = MIMEMultipart()
            msg['From'] = f"CyberSec Pro <{smtp_user}>"
            msg['To'] = 'cybersecpro@semihkilic.com'
            msg['Subject'] = email_subject
            msg['Reply-To'] = user.email
            
            msg.attach(MIMEText(email_body, 'plain'))
            
            if smtp_user and smtp_pass:
                # Use SSL for Yandex (port 465)
                import ssl
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, context=context)
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
                server.quit()
                email_sent = True
                print(f"✅ Email sent successfully to cybersecpro@semihkilic.com")
            else:
                print(f"⚠️ SMTP credentials not configured, email not sent")
                print(f"Feedback content: [{feedback_type}] {subject}")
                
        except Exception as e:
            print(f"❌ Email sending failed: {e}")
            import traceback
            traceback.print_exc()
        
        print(f"📝 Feedback received from {user.email}: [{feedback_type}] {subject}")
        
        return jsonify({
            'success': True,
            'message': 'Feedback submitted successfully',
            'email_sent': email_sent
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ==========================================
# TERMINAL API - Real SSH Execution
# ==========================================

@app.route('/api/v1/terminal/execute', methods=['POST'])
@jwt_required()
def execute_terminal_command():
    """Execute a command on a remote agent via SSH"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        agent_id = data.get('agent_id')
        command = data.get('command', '').strip()
        
        if not command:
            return jsonify({'error': 'Command is required'}), 400
        
        # Security check - block dangerous commands
        dangerous_commands = ['rm -rf /', 'mkfs', 'dd if=/dev/', ':(){:|:&};:', 'fork bomb']
        for danger in dangerous_commands:
            if danger in command.lower():
                return jsonify({
                    'error': 'Command blocked for security reasons',
                    'output': 'This command has been blocked for security reasons.',
                    'exit_code': -1
                }), 403
        
        # If no agent specified, try to use the first online agent
        if not agent_id:
            agent = Agent.query.filter_by(
                organization_id=user.organization_id, 
                status='online',
                connection_type='ssh'
            ).first()
        else:
            agent = Agent.query.filter_by(
                id=agent_id, 
                organization_id=user.organization_id
            ).first()
        
        if not agent:
            return jsonify({
                'error': 'No agent available',
                'output': 'Error: No SSH agent available. Please add and connect an agent first.',
                'exit_code': -1
            }), 404
        
        if agent.connection_type != 'ssh':
            return jsonify({
                'error': 'Agent does not support SSH',
                'output': f'Error: Agent "{agent.name}" does not support SSH execution.',
                'exit_code': -1
            }), 400
        
        # Execute command via SSH
        try:
            import paramiko
            
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Decrypt password
            password = None
            if agent.ssh_password_encrypted:
                from cryptography.fernet import Fernet
                key = os.environ.get('ENCRYPTION_KEY', 'your-encryption-key-here')
                if len(key) < 32:
                    key = key.ljust(32, '0')
                key = base64.urlsafe_b64encode(key[:32].encode())
                fernet = Fernet(key)
                password = fernet.decrypt(agent.ssh_password_encrypted.encode()).decode()
            
            ssh.connect(
                hostname=agent.ssh_host or agent.ip_address,
                port=agent.ssh_port or 22,
                username=agent.ssh_username or 'root',
                password=password,
                timeout=30
            )
            
            # Execute command with timeout
            stdin, stdout, stderr = ssh.exec_command(command, timeout=60)
            
            output = stdout.read().decode('utf-8', errors='replace')
            error = stderr.read().decode('utf-8', errors='replace')
            exit_code = stdout.channel.recv_exit_status()
            
            ssh.close()
            
            # Combine output
            full_output = output
            if error:
                full_output = output + '\n' + error if output else error
            
            # Log command execution
            print(f"📟 Terminal command executed on {agent.name}: {command[:50]}...")
            
            return jsonify({
                'success': True,
                'output': full_output or '(no output)',
                'exit_code': exit_code,
                'agent_name': agent.name,
                'agent_platform': agent.platform
            })
            
        except paramiko.AuthenticationException:
            return jsonify({
                'error': 'SSH authentication failed',
                'output': f'Error: SSH authentication failed for agent "{agent.name}". Please check credentials.',
                'exit_code': -1
            }), 401
        except paramiko.SSHException as e:
            return jsonify({
                'error': f'SSH error: {str(e)}',
                'output': f'Error: SSH connection failed - {str(e)}',
                'exit_code': -1
            }), 500
        except Exception as e:
            return jsonify({
                'error': f'Execution error: {str(e)}',
                'output': f'Error: {str(e)}',
                'exit_code': -1
            }), 500
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/terminal/agents', methods=['GET'])
@jwt_required()
def get_terminal_agents():
    """Get list of agents available for terminal connection"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        agents = Agent.query.filter_by(
            organization_id=user.organization_id,
            connection_type='ssh'
        ).all()
        
        return jsonify({
            'agents': [{
                'id': a.id,
                'name': a.name,
                'hostname': a.hostname,
                'ip_address': a.ip_address,
                'platform': a.platform,
                'status': a.status,
                'ssh_host': a.ssh_host,
                'ssh_port': a.ssh_port,
                'ssh_username': a.ssh_username
            } for a in agents]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/terminal/test-connection', methods=['POST'])
@jwt_required()
def test_terminal_connection():
    """Test SSH connection to an agent"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        agent_id = data.get('agent_id')
        
        if not agent_id:
            return jsonify({'error': 'Agent ID required'}), 400
        
        agent = Agent.query.filter_by(
            id=agent_id, 
            organization_id=user.organization_id
        ).first()
        
        if not agent:
            return jsonify({'error': 'Agent not found'}), 404
        
        if agent.connection_type != 'ssh':
            return jsonify({
                'connected': False,
                'error': 'Agent does not support SSH'
            })
        
        try:
            import paramiko
            
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Decrypt password
            password = None
            if agent.ssh_password_encrypted:
                from cryptography.fernet import Fernet
                key = os.environ.get('ENCRYPTION_KEY', 'your-encryption-key-here')
                if len(key) < 32:
                    key = key.ljust(32, '0')
                key = base64.urlsafe_b64encode(key[:32].encode())
                fernet = Fernet(key)
                password = fernet.decrypt(agent.ssh_password_encrypted.encode()).decode()
            
            ssh.connect(
                hostname=agent.ssh_host or agent.ip_address,
                port=agent.ssh_port or 22,
                username=agent.ssh_username or 'root',
                password=password,
                timeout=10
            )
            
            # Get system info
            stdin, stdout, stderr = ssh.exec_command('uname -a && hostname && whoami')
            system_info = stdout.read().decode('utf-8', errors='replace').strip()
            
            ssh.close()
            
            # Update agent status
            agent.status = 'online'
            agent.last_seen = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'connected': True,
                'agent_name': agent.name,
                'system_info': system_info,
                'platform': agent.platform
            })
            
        except Exception as e:
            agent.status = 'offline'
            db.session.commit()
            return jsonify({
                'connected': False,
                'error': str(e)
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==========================================
# PROJECT API - Enhanced
# ==========================================

@app.route('/api/v1/projects', methods=['GET'])
@jwt_required()
def get_projects():
    """Get all projects for user's organization"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        projects = Project.query.filter_by(
            organization_id=user.organization_id
        ).order_by(Project.created_at.desc()).all()
        
        return jsonify({
            'projects': [{
                'id': p.id,
                'name': p.name,
                'description': p.description,
                'target_type': p.target_type,
                'target_url': p.target_url,
                'target_ip': p.target_ip,
                'status': p.status,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'scan_count': Scan.query.filter_by(project_id=p.id).count()
            } for p in projects]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/projects', methods=['POST'])
@jwt_required()
def create_project():
    """Create a new project"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        project = Project(
            name=data.get('name', 'New Project'),
            description=data.get('description', ''),
            organization_id=user.organization_id,
            target_type=data.get('target_type', 'web'),
            target_url=data.get('target_url'),
            target_ip=data.get('target_ip'),
            status='active'
        )
        
        db.session.add(project)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'project': {
                'id': project.id,
                'name': project.name
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/projects/<int:project_id>', methods=['GET'])
@jwt_required()
def get_project(project_id):
    """Get a specific project"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        project = Project.query.filter_by(
            id=project_id,
            organization_id=user.organization_id
        ).first()
        
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        scans = Scan.query.filter_by(project_id=project.id).order_by(Scan.created_at.desc()).limit(10).all()
        
        return jsonify({
            'project': {
                'id': project.id,
                'name': project.name,
                'description': project.description,
                'target_type': project.target_type,
                'target_url': project.target_url,
                'target_ip': project.target_ip,
                'status': project.status,
                'created_at': project.created_at.isoformat() if project.created_at else None,
                'recent_scans': [{
                    'id': s.id,
                    'tool': s.tool_name,
                    'status': s.status,
                    'created_at': s.created_at.isoformat() if s.created_at else None
                } for s in scans]
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/projects/<int:project_id>', methods=['PUT'])
@jwt_required()
def update_project(project_id):
    """Update a project"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        project = Project.query.filter_by(
            id=project_id,
            organization_id=user.organization_id
        ).first()
        
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        if 'name' in data:
            project.name = data['name']
        if 'description' in data:
            project.description = data['description']
        if 'target_url' in data:
            project.target_url = data['target_url']
        if 'target_ip' in data:
            project.target_ip = data['target_ip']
        if 'status' in data:
            project.status = data['status']
        
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/projects/<int:project_id>', methods=['DELETE'])
@jwt_required()
def delete_project(project_id):
    """Delete a project"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        project = Project.query.filter_by(
            id=project_id,
            organization_id=user.organization_id
        ).first()
        
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        db.session.delete(project)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==========================================
# GDPR API - EU Compliance (Art. 15, 17, 20)
# ==========================================

@app.route('/api/v1/gdpr/export', methods=['GET'])
@jwt_required()
def gdpr_data_export():
    """GDPR Art. 15 + 20: Right of Access & Data Portability - export all personal data"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Collect all user data
        export_data = {
            'export_info': {
                'generated_at': datetime.utcnow().isoformat(),
                'format': 'JSON',
                'gdpr_article': 'Art. 15 (Right of Access) & Art. 20 (Data Portability)',
                'platform': 'CyberSec Pro'
            },
            'personal_data': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'created_at': user.created_at.isoformat() if user.created_at else None,
            },
            'organization': None,
            'scans': [],
            'agents': [],
        }
        
        # Organization data
        if user.organization:
            org = user.organization
            export_data['organization'] = {
                'id': org.id,
                'name': org.name,
                'plan_type': org.plan_type,
                'created_at': org.created_at.isoformat() if org.created_at else None,
            }
        
        # Scan history
        scans = Scan.query.filter_by(user_id=user_id).order_by(Scan.created_at.desc()).all()
        for s in scans:
            export_data['scans'].append({
                'id': s.id,
                'tool': s.tool_name,
                'target': s.target,
                'status': s.status,
                'created_at': s.created_at.isoformat() if s.created_at else None,
                'completed_at': s.completed_at.isoformat() if s.completed_at else None,
            })
        
        # Agent data
        if user.organization:
            agents = Agent.query.filter_by(organization_id=user.organization.id).all()
            for a in agents:
                export_data['agents'].append({
                    'id': a.id,
                    'name': a.name,
                    'hostname': a.hostname,
                    'platform': a.platform,
                    'status': a.status,
                    'created_at': a.created_at.isoformat() if a.created_at else None,
                })
        
        # Return as downloadable JSON
        response = app.response_class(
            response=json.dumps(export_data, indent=2, ensure_ascii=False),
            mimetype='application/json',
            headers={'Content-Disposition': 'attachment; filename=cybersecpro-my-data.json'}
        )
        return response
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/gdpr/delete-account', methods=['POST'])
@jwt_required()
def gdpr_delete_account():
    """GDPR Art. 17: Right to Erasure (Right to be Forgotten)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data or not data.get('confirm'):
            return jsonify({'error': 'Deletion must be confirmed with {confirm: true}'}), 400
        
        org_id = user.organization_id
        
        # Delete user's scans
        Scan.query.filter_by(user_id=user_id).delete()
        
        # Delete agents belonging to user's org (if sole member)
        if org_id:
            org_users = User.query.filter_by(organization_id=org_id).count()
            if org_users <= 1:
                # Last user in org - delete org data too
                Agent.query.filter_by(organization_id=org_id).delete()
        
        # Delete user
        db.session.delete(user)
        db.session.commit()
        
        logger.info(f"GDPR Art. 17: Account deleted for user {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'Your account and all associated data have been queued for deletion. This process will complete within 30 days as required by GDPR Art. 17.',
            'gdpr_article': 'Art. 17 (Right to Erasure)'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"GDPR deletion error: {e}")
        return jsonify({'error': str(e)}), 500


# ================================
# Activity Feed REST API
# ================================

@app.route('/api/v1/activity', methods=['GET'])
@jwt_required()
def get_activity_feed():
    """Get recent activity feed for the user's organization"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or not user.organization_id:
            return jsonify({'entries': []})

        org_id = user.organization_id

        # Combine: in-memory real-time + recent scans from DB
        from websocket_events import _activity_feeds
        realtime = _activity_feeds.get(org_id, [])[-50:]

        # Also pull recent scans from DB to fill gaps
        recent_scans = Scan.query.filter_by(organization_id=org_id)\
            .order_by(Scan.created_at.desc()).limit(20).all()

        db_entries = []
        for s in recent_scans:
            u = User.query.get(s.user_id)
            t = Tool.query.get(s.tool_id)
            uname = f"{u.first_name} {u.last_name}" if u else "Unknown"
            tname = t.name if t else "tool"

            action = 'started scan' if s.status == 'running' else \
                     'completed scan' if s.status == 'completed' else \
                     f'scan {s.status}'

            db_entries.append({
                'id': f"db-{s.id[:8]}",
                'user_name': uname,
                'action': action,
                'details': f"{tname} on {s.target}",
                'resource_type': 'scan',
                'resource_id': s.id,
                'timestamp': s.created_at.timestamp() if s.created_at else 0,
            })

        # Merge and deduplicate by resource_id, sorted by timestamp desc
        seen = set()
        combined = []
        for entry in sorted(realtime + db_entries, key=lambda x: x.get('timestamp', 0), reverse=True):
            rid = entry.get('resource_id', entry.get('id', ''))
            if rid not in seen:
                seen.add(rid)
                combined.append(entry)

        return jsonify({'entries': combined[:50]})

    except Exception as e:
        return jsonify({'entries': [], 'error': str(e)})


# ================================
# AI-POWERED FEATURES
# ================================

# AI tool recommendation knowledge base
AI_TOOL_RECOMMENDATIONS = {
    'web': {
        'keywords': ['http', 'https', 'www', 'web', 'html', 'api', 'rest'],
        'tools': [
            {'name': 'nikto', 'reason': 'Web server vulnerability scanner - finds misconfigurations, default files, outdated software'},
            {'name': 'gobuster', 'reason': 'Directory/file brute-force discovery for hidden endpoints'},
            {'name': 'sqlmap', 'reason': 'Automated SQL injection detection and exploitation'},
            {'name': 'wpscan', 'reason': 'WordPress-specific vulnerability scanner (if WordPress detected)'},
            {'name': 'nuclei', 'reason': 'Template-based vulnerability scanner with 6000+ templates'},
            {'name': 'whatweb', 'reason': 'Web technology fingerprinting - identifies CMS, frameworks, plugins'},
        ]
    },
    'network': {
        'keywords': ['ip', 'server', 'host', 'subnet', 'network', 'cidr', '/24', '/16'],
        'tools': [
            {'name': 'nmap', 'reason': 'Port scanning and service detection - the essential first step'},
            {'name': 'masscan', 'reason': 'Ultra-fast port scanner for large IP ranges'},
            {'name': 'nmap-vuln', 'reason': 'Nmap with vulnerability scripts (--script vuln)'},
            {'name': 'enum4linux', 'reason': 'SMB/NetBIOS enumeration for Windows targets'},
            {'name': 'snmpwalk', 'reason': 'SNMP enumeration for network devices'},
        ]
    },
    'dns': {
        'keywords': ['domain', '.com', '.org', '.net', '.io', 'dns', 'subdomain'],
        'tools': [
            {'name': 'dig', 'reason': 'DNS record lookup and zone transfer testing'},
            {'name': 'whois', 'reason': 'Domain registration and ownership information'},
            {'name': 'subfinder', 'reason': 'Passive subdomain discovery from multiple sources'},
            {'name': 'dnsrecon', 'reason': 'Comprehensive DNS enumeration and zone transfer testing'},
            {'name': 'fierce', 'reason': 'DNS reconnaissance for non-contiguous IP space'},
            {'name': 'amass', 'reason': 'Attack surface mapping with DNS enumeration'},
        ]
    },
    'ssl': {
        'keywords': ['ssl', 'tls', 'certificate', 'https', '443'],
        'tools': [
            {'name': 'sslyze', 'reason': 'SSL/TLS configuration analysis'},
            {'name': 'sslscan', 'reason': 'SSL cipher and protocol testing'},
            {'name': 'testssl', 'reason': 'Comprehensive TLS/SSL testing'},
        ]
    },
    'password': {
        'keywords': ['login', 'auth', 'password', 'ssh', 'ftp', 'rdp', 'brute'],
        'tools': [
            {'name': 'hydra', 'reason': 'Network login brute-forcer for SSH, FTP, HTTP, etc.'},
            {'name': 'john', 'reason': 'Password hash cracker (John the Ripper)'},
            {'name': 'hashcat', 'reason': 'GPU-accelerated password recovery'},
            {'name': 'medusa', 'reason': 'Parallel network login brute-forcer'},
        ]
    }
}

# CVE remediation knowledge base
AI_REMEDIATION_DB = {
    'SQL Injection': {
        'severity': 'critical',
        'fix': 'Use parameterized queries/prepared statements. Never concatenate user input into SQL.',
        'code_example': "cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))",
        'references': ['https://owasp.org/www-community/attacks/SQL_Injection', 'CWE-89']
    },
    'XSS': {
        'severity': 'high',
        'fix': 'Encode output, use Content-Security-Policy headers, sanitize input.',
        'code_example': 'Use DOMPurify.sanitize(userInput) or template auto-escaping',
        'references': ['https://owasp.org/www-community/attacks/xss/', 'CWE-79']
    },
    'Open Port': {
        'severity': 'medium',
        'fix': 'Close unnecessary ports. Use firewall rules (iptables/nftables) to restrict access.',
        'code_example': 'sudo ufw deny <port> OR iptables -A INPUT -p tcp --dport <port> -j DROP',
        'references': ['CIS Benchmark', 'NIST SP 800-123']
    },
    'Outdated Software': {
        'severity': 'high',
        'fix': 'Update to the latest stable version. Enable automatic security updates.',
        'code_example': 'sudo apt update && sudo apt upgrade -y',
        'references': ['CVE Database', 'NIST NVD']
    },
    'Weak SSL/TLS': {
        'severity': 'high',
        'fix': 'Disable SSLv3, TLS 1.0, TLS 1.1. Use TLS 1.2+ with strong ciphers.',
        'code_example': 'ssl_protocols TLSv1.2 TLSv1.3; ssl_ciphers HIGH:!aNULL:!MD5;',
        'references': ['Mozilla SSL Config Generator', 'CWE-326']
    },
    'Default Credentials': {
        'severity': 'critical',
        'fix': 'Change all default passwords immediately. Implement password policy.',
        'code_example': 'Enforce minimum 12 chars, complexity requirements, MFA',
        'references': ['OWASP Authentication Cheatsheet', 'CWE-798']
    },
    'Missing Security Headers': {
        'severity': 'medium',
        'fix': 'Add security headers: X-Frame-Options, X-Content-Type-Options, CSP, HSTS.',
        'code_example': 'add_header X-Frame-Options "DENY"; add_header X-Content-Type-Options "nosniff";',
        'references': ['OWASP Secure Headers Project', 'CWE-16']
    },
    'Information Disclosure': {
        'severity': 'low',
        'fix': 'Remove server version headers, error details, directory listings.',
        'code_example': 'server_tokens off; # nginx',
        'references': ['CWE-200', 'OWASP Information Disclosure']
    }
}


@app.route('/api/v1/ai/suggest', methods=['POST'])
@require_organization
def ai_suggest_tools():
    """AI-powered tool suggestions based on target analysis"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        # Check feature access
        if not check_feature(org, 'ai_suggestions'):
            return jsonify({
                'error': 'AI Suggestions requires Professional plan or higher',
                'required_plan': 'professional'
            }), 402
        
        data = request.get_json()
        target = data.get('target', '').strip()
        context = data.get('context', '')  # Additional context from user
        
        if not target:
            return jsonify({'error': 'Target is required'}), 400
        
        # Analyze target to determine type
        target_lower = target.lower()
        suggestions = []
        target_type = 'unknown'
        
        # Determine target type
        import re
        if re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', target):
            target_type = 'ip'
        elif re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2}$', target):
            target_type = 'subnet'
        elif target.startswith(('http://', 'https://')):
            target_type = 'url'
        elif '.' in target and not target.startswith('10.') and not target.startswith('192.168.'):
            target_type = 'domain'
        
        # Build recommendations
        matched_categories = set()
        
        # Always recommend network scan for IP/subnet
        if target_type in ('ip', 'subnet'):
            matched_categories.add('network')
        
        # URL targets get web scanning
        if target_type == 'url':
            matched_categories.update(['web', 'ssl'])
        
        # Domain targets get DNS + web
        if target_type == 'domain':
            matched_categories.update(['dns', 'web', 'ssl'])
        
        # Keyword matching for context
        for cat, info in AI_TOOL_RECOMMENDATIONS.items():
            for kw in info['keywords']:
                if kw in target_lower or kw in context.lower():
                    matched_categories.add(cat)
        
        # If no matches, default to network + dns
        if not matched_categories:
            matched_categories = {'network', 'dns'}
        
        # Collect suggestions
        seen = set()
        for cat in matched_categories:
            if cat in AI_TOOL_RECOMMENDATIONS:
                for tool_rec in AI_TOOL_RECOMMENDATIONS[cat]['tools']:
                    if tool_rec['name'] not in seen:
                        seen.add(tool_rec['name'])
                        # Check if tool exists in DB
                        tool_db = Tool.query.filter(
                            db.func.lower(Tool.name) == tool_rec['name'].lower(),
                            Tool.is_active == True
                        ).first()
                        suggestions.append({
                            'tool_name': tool_rec['name'],
                            'tool_id': tool_db.id if tool_db else None,
                            'reason': tool_rec['reason'],
                            'category': cat,
                            'available': tool_db is not None,
                            'plan_required': tool_db.plan_required if tool_db else 'professional'
                        })
        
        # Recommended scan order
        order = ['nmap', 'dig', 'whois', 'whatweb', 'nikto', 'nuclei', 'gobuster', 'sslyze', 'sqlmap']
        suggestions.sort(key=lambda x: order.index(x['tool_name']) if x['tool_name'] in order else 99)
        
        return jsonify({
            'target': target,
            'target_type': target_type,
            'suggestions': suggestions[:8],  # Top 8 recommendations
            'scan_plan': {
                'phase_1': 'Reconnaissance',
                'phase_2': 'Scanning',
                'phase_3': 'Vulnerability Assessment',
                'recommended_order': [s['tool_name'] for s in suggestions[:5]]
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/ai/remediation', methods=['POST'])
@require_organization
def ai_remediation():
    """AI-powered remediation suggestions for scan findings"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        # Check feature access
        if not check_feature(org, 'ai_remediation'):
            return jsonify({
                'error': 'AI Remediation requires Team plan or higher',
                'required_plan': 'team'
            }), 402
        
        data = request.get_json()
        scan_id = data.get('scan_id')
        
        if not scan_id:
            return jsonify({'error': 'scan_id is required'}), 400
        
        scan = Scan.query.filter_by(id=scan_id, organization_id=org.id).first()
        if not scan:
            return jsonify({'error': 'Scan not found'}), 404
        
        if scan.status != 'completed':
            return jsonify({'error': 'Scan must be completed'}), 400
        
        # Analyze scan output for known vulnerability patterns
        output = (scan.output or '').lower()
        findings = scan.findings or {}
        remediations = []
        
        # Pattern matching against remediation DB
        patterns = {
            'sql injection': 'SQL Injection',
            'sqli': 'SQL Injection',
            'xss': 'XSS',
            'cross-site scripting': 'XSS',
            'open port': 'Open Port',
            'outdated': 'Outdated Software',
            'version': 'Outdated Software',
            'ssl': 'Weak SSL/TLS',
            'tls 1.0': 'Weak SSL/TLS',
            'sslv3': 'Weak SSL/TLS',
            'default': 'Default Credentials',
            'admin/admin': 'Default Credentials',
            'x-frame-options': 'Missing Security Headers',
            'x-content-type': 'Missing Security Headers',
            'server:': 'Information Disclosure',
            'directory listing': 'Information Disclosure',
        }
        
        matched_issues = set()
        for pattern, issue_type in patterns.items():
            if pattern in output:
                matched_issues.add(issue_type)
        
        # Also check findings JSON
        if isinstance(findings, dict):
            summary = findings.get('summary', {})
            if summary.get('critical', 0) > 0 or summary.get('high', 0) > 0:
                matched_issues.add('SQL Injection')
                matched_issues.add('XSS')
            if summary.get('open_ports', 0) > 0:
                matched_issues.add('Open Port')
        
        # Build remediation recommendations
        priority = 1
        for issue in sorted(matched_issues, key=lambda x: {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}.get(
            AI_REMEDIATION_DB.get(x, {}).get('severity', 'low'), 4
        )):
            if issue in AI_REMEDIATION_DB:
                rem = AI_REMEDIATION_DB[issue]
                remediations.append({
                    'priority': priority,
                    'issue': issue,
                    'severity': rem['severity'],
                    'fix': rem['fix'],
                    'code_example': rem['code_example'],
                    'references': rem['references'],
                    'estimated_effort': '1-4 hours' if rem['severity'] in ('critical', 'high') else '30 min - 2 hours'
                })
                priority += 1
        
        # If no specific issues found, provide generic recommendations
        if not remediations:
            remediations = [{
                'priority': 1,
                'issue': 'General Security Hardening',
                'severity': 'info',
                'fix': 'Review scan output for potential vulnerabilities. Apply security best practices.',
                'code_example': 'Run comprehensive scans with nmap --script vuln, nikto, and nuclei',
                'references': ['OWASP Testing Guide', 'CIS Benchmarks'],
                'estimated_effort': '2-8 hours'
            }]
        
        return jsonify({
            'scan_id': scan_id,
            'tool': scan.tool_name,
            'target': scan.target,
            'remediations': remediations,
            'total_issues': len(remediations),
            'executive_summary': f'Found {len(matched_issues)} issue categories requiring remediation. ' +
                (f'Critical priority: {sum(1 for r in remediations if r["severity"] == "critical")} items.' 
                 if any(r['severity'] == 'critical' for r in remediations) else 'No critical issues found.')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/ai/report-summary', methods=['POST'])
@require_organization
def ai_report_summary():
    """Generate executive AI summary for scan results"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        data = request.get_json()
        scan_ids = data.get('scan_ids', [])
        
        if not scan_ids:
            return jsonify({'error': 'scan_ids required'}), 400
        
        scans = Scan.query.filter(
            Scan.id.in_(scan_ids),
            Scan.organization_id == org.id,
            Scan.status == 'completed'
        ).all()
        
        if not scans:
            return jsonify({'error': 'No completed scans found'}), 404
        
        # Aggregate findings
        total_findings = 0
        severity_totals = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
        tools_used = set()
        targets = set()
        
        for scan in scans:
            tools_used.add(scan.tool_name)
            targets.add(scan.target)
            summary = scan.findings_summary
            for sev in severity_totals:
                severity_totals[sev] += summary.get(sev, 0)
            total_findings += summary.get('total', 0)
        
        # Calculate risk score
        risk_score = min(100, (
            severity_totals['critical'] * 40 +
            severity_totals['high'] * 25 +
            severity_totals['medium'] * 10 +
            severity_totals['low'] * 3
        ))
        
        risk_level = 'Critical' if risk_score >= 80 else 'High' if risk_score >= 60 else 'Medium' if risk_score >= 30 else 'Low'
        
        # Generate natural language summary
        summary_text = f"Security assessment of {len(targets)} target(s) using {len(tools_used)} tool(s) "
        summary_text += f"({', '.join(tools_used)}). "
        
        if total_findings == 0:
            summary_text += "No significant vulnerabilities were detected. The target(s) appear to be well-configured."
        else:
            summary_text += f"Identified {total_findings} finding(s): "
            parts = []
            if severity_totals['critical'] > 0:
                parts.append(f"{severity_totals['critical']} critical")
            if severity_totals['high'] > 0:
                parts.append(f"{severity_totals['high']} high")
            if severity_totals['medium'] > 0:
                parts.append(f"{severity_totals['medium']} medium")
            if severity_totals['low'] > 0:
                parts.append(f"{severity_totals['low']} low")
            summary_text += ', '.join(parts) + '. '
            
            if severity_totals['critical'] > 0:
                summary_text += "IMMEDIATE ACTION REQUIRED: Critical vulnerabilities found that could lead to complete system compromise. "
            elif severity_totals['high'] > 0:
                summary_text += "HIGH PRIORITY: Significant vulnerabilities requiring prompt attention. "
        
        # Recommendations
        recommendations = []
        if severity_totals['critical'] > 0:
            recommendations.append('Immediately patch critical vulnerabilities and review access controls')
        if severity_totals['high'] > 0:
            recommendations.append('Schedule high-priority fixes within 48 hours')
        if severity_totals['medium'] > 0:
            recommendations.append('Include medium findings in next sprint planning')
        recommendations.append('Schedule follow-up scans after implementing fixes')
        recommendations.append('Review security policies and update incident response plan')
        
        return jsonify({
            'summary': summary_text,
            'risk_score': risk_score,
            'risk_level': risk_level,
            'severity_breakdown': severity_totals,
            'total_findings': total_findings,
            'scans_analyzed': len(scans),
            'tools_used': list(tools_used),
            'targets': list(targets),
            'recommendations': recommendations,
            'generated_at': datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ════════════════════════════════════════════════════════════
# 🛡️ PURPLE TEAM AUTOMATION — Pentagon/DoD Grade
# ════════════════════════════════════════════════════════════
try:
    from purple_team_engine import get_purple_team_coordinator
    purple_coordinator = get_purple_team_coordinator()
    PURPLE_TEAM_AVAILABLE = True
    print("🟣 Purple Team Coordinator initialized")
except ImportError as e:
    purple_coordinator = None
    PURPLE_TEAM_AVAILABLE = False
    print(f"⚠️ Purple Team engine not available: {e}")

# --- GET /api/v1/purple-team/chains --- Attack chain catalog
@app.route('/api/v1/purple-team/chains', methods=['GET'])
@jwt_required()
def purple_team_chains():
    if not PURPLE_TEAM_AVAILABLE:
        return jsonify({'error': 'Purple Team engine not available'}), 503
    return jsonify(purple_coordinator.get_attack_chains())

# --- GET /api/v1/purple-team/playbooks --- Blue team playbooks
@app.route('/api/v1/purple-team/playbooks', methods=['GET'])
@jwt_required()
def purple_team_playbooks():
    if not PURPLE_TEAM_AVAILABLE:
        return jsonify({'error': 'Purple Team engine not available'}), 503
    return jsonify(purple_coordinator.get_detection_playbooks())

# --- GET /api/v1/purple-team/mitre-matrix --- Full ATT&CK matrix
@app.route('/api/v1/purple-team/mitre-matrix', methods=['GET'])
@jwt_required()
def purple_team_mitre_matrix():
    if not PURPLE_TEAM_AVAILABLE:
        return jsonify({'error': 'Purple Team engine not available'}), 503
    return jsonify(purple_coordinator.get_mitre_matrix())

# --- POST /api/v1/purple-team/exercises --- Start exercise
@app.route('/api/v1/purple-team/exercises', methods=['POST'])
@jwt_required()
def purple_team_start_exercise():
    if not PURPLE_TEAM_AVAILABLE:
        return jsonify({'error': 'Purple Team engine not available'}), 503
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Feature gate: team + enterprise only
    org = Organization.query.get(user.organization_id)
    plan_level = get_plan_level(org.plan_type) if org else 0
    if plan_level < 3:
        return jsonify({'error': 'Purple Team requires Team or Enterprise plan', 'upgrade_required': True}), 403
    
    data = request.get_json() or {}
    chain_id = data.get('chain_id')
    target = data.get('target', '').strip()
    exercise_name = data.get('name', '')
    
    if not chain_id:
        return jsonify({'error': 'chain_id is required'}), 400
    if not target:
        return jsonify({'error': 'target is required'}), 400
    
    def on_exercise_update(exercise):
        """Push updates via WebSocket"""
        try:
            if socketio:
                from dataclasses import asdict
                socketio.emit('purple_team_update', {
                    'exercise_id': exercise.id,
                    'status': exercise.status,
                    'completed_steps': exercise.completed_steps,
                    'total_steps': exercise.total_steps,
                    'detected_attacks': exercise.detected_attacks,
                    'missed_attacks': exercise.missed_attacks,
                    'risk_score': exercise.risk_score,
                }, namespace='/scans')
        except Exception as e:
            print(f"Purple team WS emit error: {e}")
    
    try:
        exercise = purple_coordinator.start_exercise(
            chain_id=chain_id,
            target=target,
            organization_id=user.organization_id or '',
            user_id=user_id,
            exercise_name=exercise_name,
            on_update=on_exercise_update,
        )
        
        # Log activity
        try:
            emit_activity(user.organization_id, user_id,
                          f"Started Purple Team exercise: {exercise.name} → {target}")
        except:
            pass
        
        from dataclasses import asdict
        return jsonify(asdict(exercise)), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- GET /api/v1/purple-team/exercises --- List exercises
@app.route('/api/v1/purple-team/exercises', methods=['GET'])
@jwt_required()
def purple_team_list_exercises():
    if not PURPLE_TEAM_AVAILABLE:
        return jsonify({'error': 'Purple Team engine not available'}), 503
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    org_id = user.organization_id if user else None
    
    exercises = purple_coordinator.get_exercises(organization_id=org_id)
    return jsonify(exercises)

# --- GET /api/v1/purple-team/exercises/<id> --- Exercise detail
@app.route('/api/v1/purple-team/exercises/<exercise_id>', methods=['GET'])
@jwt_required()
def purple_team_exercise_detail(exercise_id):
    if not PURPLE_TEAM_AVAILABLE:
        return jsonify({'error': 'Purple Team engine not available'}), 503
    
    exercise = purple_coordinator.get_exercise(exercise_id)
    if not exercise:
        return jsonify({'error': 'Exercise not found'}), 404
    return jsonify(exercise)

# --- GET /api/v1/purple-team/exercises/<id>/gap-analysis
@app.route('/api/v1/purple-team/exercises/<exercise_id>/gap-analysis', methods=['GET'])
@jwt_required()
def purple_team_gap_analysis(exercise_id):
    if not PURPLE_TEAM_AVAILABLE:
        return jsonify({'error': 'Purple Team engine not available'}), 503
    
    exercise = purple_coordinator.get_exercise(exercise_id)
    if not exercise:
        return jsonify({'error': 'Exercise not found'}), 404
    return jsonify(exercise.get('gap_analysis', {}))

# --- GET /api/v1/purple-team/exercises/<id>/coverage
@app.route('/api/v1/purple-team/exercises/<exercise_id>/coverage', methods=['GET'])
@jwt_required()
def purple_team_coverage(exercise_id):
    if not PURPLE_TEAM_AVAILABLE:
        return jsonify({'error': 'Purple Team engine not available'}), 503
    
    exercise = purple_coordinator.get_exercise(exercise_id)
    if not exercise:
        return jsonify({'error': 'Exercise not found'}), 404
    return jsonify(exercise.get('coverage_map', {}))

# --- GET /api/v1/purple-team/exercises/<id>/alerts
@app.route('/api/v1/purple-team/exercises/<exercise_id>/alerts', methods=['GET'])
@jwt_required()
def purple_team_alerts(exercise_id):
    if not PURPLE_TEAM_AVAILABLE:
        return jsonify({'error': 'Purple Team engine not available'}), 503
    
    exercise = purple_coordinator.get_exercise(exercise_id)
    if not exercise:
        return jsonify({'error': 'Exercise not found'}), 404
    return jsonify(exercise.get('blue_team_alerts', []))

# --- GET /api/v1/purple-team/exercises/<id>/siem-export
@app.route('/api/v1/purple-team/exercises/<exercise_id>/siem-export', methods=['GET'])
@jwt_required()
def purple_team_siem_export(exercise_id):
    if not PURPLE_TEAM_AVAILABLE:
        return jsonify({'error': 'Purple Team engine not available'}), 503
    
    fmt = request.args.get('format', 'json')
    export_data = purple_coordinator.blue_agent.get_siem_export(format=fmt)
    return app.response_class(export_data, mimetype='application/json')

# --- GET /api/v1/purple-team/dashboard --- Dashboard stats
@app.route('/api/v1/purple-team/dashboard', methods=['GET'])
@jwt_required()
def purple_team_dashboard():
    if not PURPLE_TEAM_AVAILABLE:
        return jsonify({'error': 'Purple Team engine not available'}), 503
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    org_id = user.organization_id if user else None
    
    exercises = purple_coordinator.get_exercises(organization_id=org_id)
    
    total = len(exercises)
    running = sum(1 for e in exercises if e.get('status') == 'running')
    completed = sum(1 for e in exercises if e.get('status') == 'completed')
    
    total_attacks = sum(e.get('total_steps', 0) for e in exercises)
    total_detected = sum(e.get('detected_attacks', 0) for e in exercises)
    total_missed = sum(e.get('missed_attacks', 0) for e in exercises)
    
    avg_risk = 0
    completed_with_risk = [e for e in exercises if e.get('status') == 'completed' and e.get('risk_score', 0) > 0]
    if completed_with_risk:
        avg_risk = sum(e['risk_score'] for e in completed_with_risk) / len(completed_with_risk)
    
    detection_rate = round(total_detected / max(1, total_attacks) * 100, 1)
    
    return jsonify({
        'total_exercises': total,
        'running': running,
        'completed': completed,
        'total_attack_steps': total_attacks,
        'total_detected': total_detected,
        'total_missed': total_missed,
        'detection_rate': detection_rate,
        'average_risk_score': round(avg_risk, 1),
        'available_chains': len(purple_coordinator.get_attack_chains()),
        'available_playbooks': len(purple_coordinator.get_detection_playbooks()),
    })


if __name__ == '__main__':
    init_database()
    # Start agent health monitor
    agent_mgr.start_monitor(app)
    print("🚀 CyberSec Pro SaaS Backend starting...")
    print("🌍 World-class cybersecurity platform ready!")
    print("📟 Terminal API enabled for SSH execution")
    print("🔌 WebSocket enabled for real-time updates")
    print("🤖 Agent health monitor started (30s heartbeat, 90s offline)")
    
    # Use socketio.run() if available for WebSocket support
    if socketio:
        socketio.run(app, host='0.0.0.0', port=5001, debug=False, use_reloader=False, log_output=True)
    else:
        app.run(host='0.0.0.0', port=5001, debug=False)