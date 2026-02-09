#!/usr/bin/env python3
"""
🛡️ CyberSec Pro SaaS Backend
World-class cybersecurity testing platform
Complete Kali Linux tool documentation and execution

Author: Semih Kılıç
Version: 3.0.0 (World-Class Edition)
"""

from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
import stripe
import json
import subprocess
import uuid
import logging
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
    from websocket_events import init_socketio
    socketio = init_socketio(app)
    print("✅ WebSocket (Flask-SocketIO) initialized")
except ImportError as e:
    socketio = None
    print(f"⚠️ WebSocket not available: {e}")

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
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'description': self.description,
            'parameters': self.parameters,
            'plan_required': self.plan_required,
            'is_active': self.is_active
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
def health_check():
    """Production health check endpoint for Docker/K8s"""
    health = {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '2.0.0',
        'checks': {}
    }
    
    # Check database connection
    try:
        db.session.execute(db.text('SELECT 1'))
        health['checks']['database'] = 'ok'
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
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password required'}), 400
        
        user = User.query.filter_by(email=data['email']).first()
        
        if not user or not user.check_password(data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not user.is_active:
            return jsonify({'error': 'Account deactivated'}), 403
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Generate JWT token
        access_token = create_access_token(identity=user.id)
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': user.to_dict(),
            'organization': user.organization.to_dict() if user.organization else None
        })
        
    except Exception as e:
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
            domain = os.environ.get('DOMAIN', 'https://semihkilic.com')
            redirect_uri = f"{domain}/auth/callback?provider=google"
            
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
                print(f"Google token exchange error: {token_response.text}")
                return jsonify({'error': 'Failed to exchange Google code'}), 401
            
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
        
        # Plan hierarchy: trial=0, starter=1, professional=2, team=3, enterprise=4
        plan_limits = {
            'trial': 7,
            'starter': 33,
            'professional': 120,
            'team': 200,
            'enterprise': 999  # Unlimited
        }
        
        # Trial users have same level as starter for tool access
        plan_level = {'trial': 1, 'starter': 1, 'professional': 2, 'team': 3, 'enterprise': 4}
        user_plan_level = plan_level.get(org.plan_type, 1)
        tool_limit = plan_limits.get(org.plan_type, 7)
        
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
            'plan_limit': tool_limit
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
        
        # Check daily scan limit for starter/trial
        if org.plan_type in ('starter', 'trial'):
            from datetime import date
            today_scans = Scan.query.filter(
                Scan.organization_id == org.id,
                db.func.date(Scan.created_at) == date.today()
            ).count()
            if today_scans >= 10:
                return jsonify({
                    'error': 'Daily scan limit reached (10/day)',
                    'hint': 'Upgrade to Professional for unlimited scans'
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
        
        # Stripe Price IDs from .env (Updated Feb 2026 - New Pricing)
        # Starter = FREE, Professional = €19, Team = €49, Enterprise = €99
        import os
        STRIPE_PRICES = {
            'professional': os.environ.get('STRIPE_PROFESSIONAL_PRICE_ID', 'price_1Stbp00ed3IDKXcngS5QHCju'),
            'team': os.environ.get('STRIPE_TEAM_PRICE_ID', 'price_1SwUPS0ed3IDKXcnw7yBB9NI'),
            'enterprise': os.environ.get('STRIPE_ENTERPRISE_PRICE_ID', 'price_1SwUQ40ed3IDKXcnduws9J5k'),
        }
        
        # Starter is free, no checkout needed
        if plan == 'starter':
            return jsonify({'error': 'Starter plan is free, no payment required'}), 400
        
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
        
        # Check daily scan limit for starter plan
        if org.plan_type == 'starter':
            from datetime import date
            today_scans = Scan.query.filter(
                Scan.organization_id == org.id,
                db.func.date(Scan.created_at) == date.today()
            ).count()
            
            if today_scans >= 10:
                return jsonify({
                    'error': 'Daily scan limit reached (10/day for Starter plan)',
                    'scans_today': today_scans,
                    'limit': 10
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
    from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
    
    token = request.args.get('token')
    if token:
        # Manually set the token for JWT verification
        request.headers = dict(request.headers)
        request.headers['Authorization'] = f'Bearer {token}'
    
    try:
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
            # No engine available - check database for completed scan
            scan = Scan.query.get(scan_id)
            if scan and scan.output:
                for line in scan.output.split('\n'):
                    yield f"data: {json.dumps({'type': 'output', 'line': line})}\n\n"
                yield f"data: {json.dumps({'type': 'complete', 'result': {'status': scan.status, 'output': scan.output}})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'complete', 'result': {'status': 'failed', 'output': 'No scan engine available'}})}\n\n"
    
    return Response(generate(), mimetype='text/event-stream')


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
        
        # Validate target (basic check)
        import re
        ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
        domain_pattern = r'^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+$'
        
        if not (re.match(ip_pattern, target) or re.match(domain_pattern, target)):
            return jsonify({
                'error': 'Invalid target format',
                'hint': 'Enter a valid IP address (e.g., 8.8.8.8) or domain (e.g., example.com)'
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
        
        # Check daily scan limit for starter/trial plan
        if org.plan_type in ('starter', 'trial'):
            from datetime import date
            today_scans = Scan.query.filter(
                Scan.organization_id == org.id,
                db.func.date(Scan.created_at) == date.today()
            ).count()
            
            if today_scans >= 10:
                return jsonify({
                    'error': 'Daily scan limit reached',
                    'scans_today': today_scans,
                    'limit': 10,
                    'hint': 'Upgrade to Professional or higher for unlimited scans'
                }), 429
        
        # Create scan record with proper tool_id (database UUID)
        scan_id = str(uuid.uuid4())
        scan = Scan(
            id=scan_id,
            organization_id=org.id,
            user_id=user.id,
            tool_id=tool_db.id,  # Use actual database UUID
            target=target,
            parameters=parameters,
            status='running',
            started_at=datetime.utcnow()
        )
        db.session.add(scan)
        db.session.commit()
        
        # Create completion callback
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
        
        # Start scan using V3 engine
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
        
        # Plan limits
        plan_limits = {
            'starter': {'scans_per_day': 10, 'tools': len(STARTER_TOOLS) if SCAN_EXECUTOR_AVAILABLE else 20},
            'professional': {'scans_per_day': -1, 'tools': len(PROFESSIONAL_TOOLS) if SCAN_EXECUTOR_AVAILABLE else 165},
            'enterprise': {'scans_per_day': -1, 'tools': len(ENTERPRISE_TOOLS) if SCAN_EXECUTOR_AVAILABLE else 350}
        }
        
        current_limits = plan_limits.get(org.plan_type, plan_limits['starter'])
        
        return jsonify({
            'usage': {
                'today_scans': today_scans,
                'week_scans': week_scans,
                'total_scans': total_scans,
                'completed_scans': completed_scans,
                'failed_scans': failed_scans
            },
            'limits': current_limits,
            'plan': org.plan_type
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
            content=report_content,
            file_size=len(report_content.encode('utf-8')),
            completed_at=datetime.utcnow()
        )
        db.session.add(report)
        db.session.commit()
        
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
            content = report.content
            filename = f'{report.name.replace(" ", "_")}_{report.created_at.strftime("%Y%m%d")}'
            
            # Set appropriate extension
            ext_map = {'html': 'html', 'json': 'json', 'csv': 'csv', 'markdown': 'md', 'pdf': 'html'}
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
            'description': 'Compliance-focused report for auditors',
            'icon': '📋',
            'sections': ['Compliance Status', 'Control Mappings', 'Gap Analysis', 'Remediation Timeline'],
            'frameworks': ['OWASP Top 10', 'PCI-DSS 4.0', 'NIST CSF', 'CIS Controls v8'],
            'formats': ['html', 'pdf', 'json']
        },
        {
            'id': 'full',
            'name': 'Full Report',
            'description': 'Comprehensive report with all sections',
            'icon': '📑',
            'sections': ['Executive Summary', 'Technical Details', 'Compliance Mapping', 'Remediation Guide', 'Appendix'],
            'formats': ['html', 'pdf', 'json', 'csv', 'markdown']
        }
    ]
    return jsonify({'templates': templates})


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
# SCHEDULES API
# ================================

@app.route('/api/v1/schedules', methods=['GET'])
@require_organization
def get_schedules():
    """Get all scheduled scans for the organization"""
    try:
        # In a full implementation, we'd have a ScheduledScan model
        # For now, return empty list (feature to be implemented)
        return jsonify({
            'schedules': []
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/schedules', methods=['POST'])
@require_organization
def create_schedule():
    """Create a new scheduled scan"""
    try:
        data = request.get_json()
        # In a full implementation, save to ScheduledScan model
        return jsonify({
            'schedule': {
                'id': str(uuid.uuid4()),
                'name': data.get('name'),
                'tool': data.get('tool'),
                'target': data.get('target'),
                'schedule': data.get('schedule'),
                'status': 'active',
                'created_at': datetime.utcnow().isoformat()
            },
            'message': 'Scheduled scan feature coming soon'
        }), 201
    except Exception as e:
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
        from datetime import date
        today_scans = Scan.query.filter(
            Scan.organization_id == org.id,
            db.func.date(Scan.created_at) == date.today()
        ).count()
        
        plan_limits = {'trial': 3, 'starter': 10, 'professional': 50, 'team': 100, 'enterprise': -1}
        daily_limit = plan_limits.get(org.plan_type, 3)
        
        if daily_limit != -1 and today_scans >= daily_limit:
            return jsonify({
                'error': f'Daily scan limit reached ({today_scans}/{daily_limit})',
                'scans_today': today_scans,
                'limit': daily_limit
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
        
        # Check plan - only team and enterprise have agents
        if org.plan_type not in ['team', 'enterprise']:
            return jsonify({
                'agents': [],
                'message': 'Agents feature requires Team or Enterprise plan'
            })
        
        agents = Agent.query.filter_by(organization_id=org.id).all()
        
        # Update status based on last heartbeat
        for agent in agents:
            if agent.last_heartbeat:
                time_since_heartbeat = (datetime.utcnow() - agent.last_heartbeat).total_seconds()
                if time_since_heartbeat > 300:  # 5 minutes
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
        
        # Check plan
        if org.plan_type not in ['team', 'enterprise']:
            return jsonify({'error': 'Agents feature requires Team or Enterprise plan'}), 402
        
        # Check agent limit
        current_agents = Agent.query.filter_by(organization_id=org.id).count()
        max_agents = 1 if org.plan_type == 'team' else 999
        
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
            # In production, encrypt this
            agent.ssh_password_encrypted = data.get('ssh_password')
        
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
        if 'ssh_host' in data:
            agent.ssh_host = data['ssh_host']
            agent.ip_address = data['ssh_host']
        if 'ssh_port' in data:
            agent.ssh_port = data['ssh_port']
        if 'ssh_username' in data:
            agent.ssh_username = data['ssh_username']
        if 'ssh_password' in data and data['ssh_password']:
            agent.ssh_password_encrypted = data['ssh_password']
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


@app.route('/api/v1/agents/heartbeat', methods=['POST'])
def agent_heartbeat():
    """Receive heartbeat from agent (no JWT - uses API key)"""
    try:
        data = request.get_json()
        api_key = data.get('api_key') or request.headers.get('X-Agent-Key')
        
        if not api_key:
            return jsonify({'error': 'API key required'}), 401
        
        agent = Agent.query.filter_by(api_key=api_key).first()
        if not agent:
            return jsonify({'error': 'Invalid API key'}), 401
        
        # Update agent status
        agent.status = 'online'
        agent.last_heartbeat = datetime.utcnow()
        agent.cpu_usage = data.get('cpu_usage', 0)
        agent.memory_usage = data.get('memory_usage', 0)
        agent.active_scans = data.get('active_scans', 0)
        agent.hostname = data.get('hostname', agent.hostname)
        agent.os_info = data.get('os_info', agent.os_info)
        agent.version = data.get('version', agent.version)
        
        db.session.commit()
        
        return jsonify({
            'status': 'ok',
            'next_heartbeat': 60  # seconds
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


if __name__ == '__main__':
    init_database()
    print("🚀 CyberSec Pro SaaS Backend starting...")
    print("🌍 World-class cybersecurity platform ready!")
    print("📟 Terminal API enabled for SSH execution")
    print("🔌 WebSocket enabled for real-time updates")
    
    # Use socketio.run() if available for WebSocket support
    if socketio:
        socketio.run(app, host='0.0.0.0', port=5001, debug=True)
    else:
        app.run(host='0.0.0.0', port=5001, debug=True)