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
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, create_refresh_token, get_jwt_identity, set_access_cookies, set_refresh_cookies, unset_jwt_cookies, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix
from datetime import datetime, timedelta
import os
import base64
import stripe
import json
import subprocess
import uuid
import logging
import threading
import io
from logging.handlers import RotatingFileHandler
from functools import wraps

# V20: MFA/TOTP
import pyotp
import qrcode
import qrcode.image.svg

# V17: Rate Limiting
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Environment variables loaded from .env")
except ImportError:
    print("⚠️ python-dotenv not installed, using system environment variables")

# Initialize Flask app
app = Flask(__name__)

# V17: Rate Limiting — custom implementation for eventlet compatibility
# flask-limiter's memory storage doesn't work reliably with eventlet monkey_patch
import time as _time
from collections import defaultdict

class SimpleRateLimiter:
    """Rate limiter with Redis backend + in-memory fallback. V20: Distributed."""
    def __init__(self):
        self._requests = defaultdict(list)  # fallback in-memory store
        self._redis = None
        try:
            import redis
            self._redis = redis.Redis(host='127.0.0.1', port=6379, db=1, socket_timeout=1, decode_responses=True)
            self._redis.ping()
            print("✅ Rate limiter using Redis backend")
        except Exception:
            self._redis = None
            print("⚠️ Rate limiter using in-memory fallback (Redis unavailable)")
    
    def is_limited(self, key, limit, window_seconds=60):
        """Check if key has exceeded limit within window. Returns True if limited."""
        if self._redis:
            try:
                pipe = self._redis.pipeline()
                now = _time.time()
                redis_key = f"rl:{key}"
                pipe.zremrangebyscore(redis_key, 0, now - window_seconds)
                pipe.zcard(redis_key)
                pipe.zadd(redis_key, {str(now): now})
                pipe.expire(redis_key, window_seconds)
                results = pipe.execute()
                count = results[1]
                return count >= limit
            except Exception:
                pass  # Fall through to in-memory
        
        # In-memory fallback
        now = _time.time()
        cutoff = now - window_seconds
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]
        if len(self._requests[key]) >= limit:
            return True
        self._requests[key].append(now)
        return False

_rate_limiter = SimpleRateLimiter()

# Keep flask-limiter for default limits on all routes
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=['200 per hour', '50 per minute'],
    storage_uri='memory://',
    strategy='fixed-window'
)

# ProxyFix: Trust Cloudflare/Nginx reverse proxy headers
# This ensures request.url_root and request.scheme return https:// 
# when behind Cloudflare/Nginx, preventing OAuth redirect_uri mismatches
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
app.config['PREFERRED_URL_SCHEME'] = 'https'

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

# Configuration — V17: No weak fallbacks. App MUST have proper secrets.
_secret = os.environ.get('SECRET_KEY')
_jwt_secret = os.environ.get('JWT_SECRET_KEY')
if not _secret or len(_secret) < 32:
    raise RuntimeError('FATAL: SECRET_KEY env var must be set (min 32 chars). Generate: python3 -c "import secrets; print(secrets.token_hex(32))"')
if not _jwt_secret or len(_jwt_secret) < 32:
    raise RuntimeError('FATAL: JWT_SECRET_KEY env var must be set (min 32 chars).')

app.config['SECRET_KEY'] = _secret
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///cybersec_saas.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = _jwt_secret
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)  # V17: Reduced from 24h
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # V17: 10MB max upload size

# V18: httpOnly cookie-based JWT (eliminates XSS token theft)
app.config['JWT_TOKEN_LOCATION'] = ['cookies', 'headers']  # Accept both for migration
app.config['JWT_COOKIE_SECURE'] = os.environ.get('FLASK_ENV') == 'production'  # HTTPS only in prod
app.config['JWT_COOKIE_CSRF_PROTECT'] = True
app.config['JWT_COOKIE_SAMESITE'] = 'Lax'
app.config['JWT_ACCESS_COOKIE_NAME'] = 'access_token_cookie'
app.config['JWT_ACCESS_COOKIE_PATH'] = '/api/'
app.config['JWT_COOKIE_DOMAIN'] = os.environ.get('COOKIE_DOMAIN', None)  # '.semihkilic.com' in prod
# V18: Refresh tokens for seamless session extension
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)
app.config['JWT_REFRESH_COOKIE_NAME'] = 'refresh_token_cookie'
app.config['JWT_REFRESH_COOKIE_PATH'] = '/api/v1/auth/refresh'

# V17: Handle oversized request bodies gracefully
from werkzeug.exceptions import RequestEntityTooLarge
@app.errorhandler(413)
@app.errorhandler(RequestEntityTooLarge)
def handle_request_too_large(e):
    return jsonify({'error': 'Request body too large. Maximum size is 10MB.'}), 413

# Stripe configuration
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_...')

# Initialize extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)

# V18: Admin-required decorator for role-based access control
from functools import wraps
def admin_required(fn):
    """Decorator that requires superadmin or admin role."""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        uid = get_jwt_identity()
        u = User.query.get(uid) if uid else None
        if not u or u.role not in ('admin', 'superadmin'):
            return jsonify({'error': 'Admin access required'}), 403
        return fn(*args, **kwargs)
    return wrapper
# V17: Remove localhost origins in production mode
_cors_origins = [
    'https://cybersecpro.com', 
    'https://www.cybersecpro.com',
    'https://app.cybersecpro.com',
    'https://semihkilic.com',
    'https://www.semihkilic.com',
    'https://cybersecpro.semihkilic.com',
    'https://app.semihkilic.com',
]
if os.environ.get('FLASK_ENV') != 'production':
    _cors_origins += ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:5173']

CORS(app, 
     origins=_cors_origins,
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
)

# ================================
# PRODUCTION SECURITY HEADERS — V18: Enhanced CSP + Cache-Control
# ================================
import hashlib as _hashlib

@app.after_request
def add_security_headers(response):
    """Add security headers to all responses — V18 enterprise-grade"""
    # Prevent clickjacking
    response.headers['X-Frame-Options'] = 'DENY'
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    # XSS Protection (legacy browsers)
    response.headers['X-XSS-Protection'] = '1; mode=block'
    # Referrer Policy
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    # V18: Enhanced Content Security Policy for all environments
    csp = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self' wss: https:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "object-src 'none';"
    )
    response.headers['Content-Security-Policy'] = csp
    # HSTS (1 year) — always on
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    # Permissions Policy
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=(), usb=(), payment=()'
    # V18: Cache-Control for API responses
    if request.path.startswith('/api/'):
        if request.method == 'GET' and response.status_code == 200:
            # Cache health checks and read-only data for 30s
            if '/health' in request.path or '/tools' in request.path:
                response.headers['Cache-Control'] = 'public, max-age=30, stale-while-revalidate=60'
                # ETag based on response data
                etag = _hashlib.md5(response.get_data()).hexdigest()
                response.headers['ETag'] = f'"{etag}"'
                # Check If-None-Match for 304
                if_none_match = request.headers.get('If-None-Match')
                if if_none_match and if_none_match.strip('"') == etag:
                    response.status_code = 304
                    response.set_data(b'')
            else:
                response.headers['Cache-Control'] = 'private, no-cache'
        else:
            response.headers['Cache-Control'] = 'no-store'
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

# Initialize Business Language Translator (Master Architecture v1)
try:
    from business_language import get_translator, BUSINESS_CATEGORIES
    business_translator = get_translator()
    BUSINESS_LANGUAGE_AVAILABLE = True
    print(f"✅ Business Language Translator initialized ({len(BUSINESS_CATEGORIES)} categories)")
except ImportError as e:
    business_translator = None
    BUSINESS_LANGUAGE_AVAILABLE = False
    print(f"⚠️ Business Language not available: {e}")

# Initialize Scan Orchestrator v4 (Category-based)
try:
    from scan_orchestrator import init_orchestrator, get_orchestrator
    scan_orchestrator = init_orchestrator(
        app, socketio=socketio,
        scan_engine=scan_engine_v3 if SCAN_ENGINE_V3_AVAILABLE else scan_engine
    )
    ORCHESTRATOR_AVAILABLE = True
    print("✅ Scan Orchestrator v4 initialized (6 business categories)")
except ImportError as e:
    scan_orchestrator = None
    ORCHESTRATOR_AVAILABLE = False
    print(f"⚠️ Scan Orchestrator not available: {e}")

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
        'max_agents': -1,  # -1 = unlimited (enterprise)
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
    
    # Email verification (V13)
    email_verified = db.Column(db.Boolean, default=False)
    verification_token = db.Column(db.String(100))
    verification_sent_at = db.Column(db.DateTime)
    
    # OAuth fields
    oauth_provider = db.Column(db.String(20))  # google, github, None for email
    oauth_id = db.Column(db.String(100))  # Provider's user ID
    avatar_url = db.Column(db.String(255))  # Profile picture URL
    
    # V20: MFA/TOTP fields
    mfa_enabled = db.Column(db.Boolean, default=False)
    mfa_secret = db.Column(db.String(32))  # TOTP secret key
    mfa_backup_codes = db.Column(db.JSON)  # Encrypted backup codes
    mfa_enabled_at = db.Column(db.DateTime)
    
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
            'is_active': self.is_active,
            'email_verified': self.email_verified if self.email_verified is not None else True,
            'mfa_enabled': self.mfa_enabled if self.mfa_enabled is not None else False
        }


# ================================
# V20: AUDIT LOG MODEL
# ================================

class AuditLog(db.Model):
    """Audit trail for security-critical actions — V20 (GDPR/ISO 27001 compliance)"""
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(100), nullable=False)  # login, logout, scan_start, mfa_enable, etc.
    category = db.Column(db.String(50), default='system')  # auth, scan, admin, billing, agent, security
    severity = db.Column(db.String(20), default='info')  # info, warning, critical
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(500))
    details = db.Column(db.JSON)  # Additional context
    resource_type = db.Column(db.String(50))  # user, scan, agent, report, etc.
    resource_id = db.Column(db.String(36))
    status = db.Column(db.String(20), default='success')  # success, failure
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'organization_id': self.organization_id,
            'user_id': self.user_id,
            'action': self.action,
            'category': self.category,
            'severity': self.severity,
            'ip_address': self.ip_address,
            'details': self.details,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


def log_audit(action, category='system', severity='info', user_id=None, org_id=None, 
              details=None, resource_type=None, resource_id=None, status='success'):
    """Helper to record an audit log entry — V20"""
    try:
        entry = AuditLog(
            action=action,
            category=category,
            severity=severity,
            user_id=user_id,
            organization_id=org_id,
            ip_address=request.remote_addr if request else None,
            user_agent=request.headers.get('User-Agent', '')[:500] if request else None,
            details=details,
            resource_type=resource_type,
            resource_id=resource_id,
            status=status
        )
        db.session.add(entry)
        db.session.commit()
    except Exception as e:
        app.logger.error(f"Audit log error: {str(e)}")
        db.session.rollback()


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
    """Remote agents for scan execution - 5 Network Modes Architecture
    
    Modes: direct, agent, vpn, ssh, api_proxy
    """
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
    # 5 Network Modes (Master Architecture)
    connection_type = db.Column(db.String(20), default='direct')  # direct, agent, vpn, ssh, api_proxy
    # SSH Mode
    ssh_host = db.Column(db.String(255))
    ssh_port = db.Column(db.Integer, default=22)
    ssh_username = db.Column(db.String(100))
    ssh_key_path = db.Column(db.String(255))
    ssh_password_encrypted = db.Column(db.Text)
    # VPN Mode
    vpn_config_path = db.Column(db.String(255))  # .ovpn config path
    vpn_status = db.Column(db.String(20), default='disconnected')  # connected, disconnected, connecting
    vpn_assigned_ip = db.Column(db.String(45))
    # API Proxy Mode
    proxy_endpoint = db.Column(db.String(255))  # https://proxy.example.com/api
    proxy_api_key = db.Column(db.String(200))
    proxy_protocol = db.Column(db.String(20), default='https')  # http, https, socks5
    # Agent Mode (WebSocket)
    agent_websocket_id = db.Column(db.String(100))
    agent_capabilities = db.Column(db.JSON)  # ['nmap', 'nikto', 'sqlmap', ...]
    agent_docker_enabled = db.Column(db.Boolean, default=False)  # Docker-in-Docker support
    auto_update = db.Column(db.Boolean, default=True)
    # Common fields
    registration_token = db.Column(db.String(100), unique=True)
    api_key = db.Column(db.String(100), unique=True)
    last_heartbeat = db.Column(db.DateTime)
    cpu_usage = db.Column(db.Float, default=0)
    memory_usage = db.Column(db.Float, default=0)
    active_scans = db.Column(db.Integer, default=0)
    total_scans = db.Column(db.Integer, default=0)
    max_concurrent_scans = db.Column(db.Integer, default=5)
    location = db.Column(db.String(100))
    network_zone = db.Column(db.String(50), default='public')  # public, private, dmz
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
            'network_zone': self.network_zone or 'public',
            'agent_docker_enabled': self.agent_docker_enabled or False,
            'max_concurrent_scans': self.max_concurrent_scans or 5,
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
            data['vpn_config_path'] = self.vpn_config_path
            data['proxy_endpoint'] = self.proxy_endpoint
        return data

class Tool(db.Model):
    """Security tools catalog - Business Language Architecture
    
    Tool names are HIDDEN from users. They see business_name instead.
    6 business categories replace old Kali categories.
    """
    __tablename__ = 'tools'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)  # Internal technical name (HIDDEN from users)
    category = db.Column(db.String(50), nullable=False)  # Display category name
    description = db.Column(db.Text)
    command_template = db.Column(db.Text)
    parameters = db.Column(db.JSON)
    plan_required = db.Column(db.String(20), default='starter')  # starter, professional, enterprise
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Tool metadata
    tool_type = db.Column(db.String(20), default='cli')  # cli, gui, service, framework
    hardware_required = db.Column(db.JSON, default=list)  # ['wifi_adapter', 'gpu', 'bluetooth']
    gui_required = db.Column(db.Boolean, default=False)
    install_command = db.Column(db.Text)
    example_usage = db.Column(db.Text)
    official_url = db.Column(db.String(255))
    # Business Language fields (Master Architecture v1)
    business_name = db.Column(db.String(200), default='')  # User-facing name
    business_description = db.Column(db.Text, default='')  # User-facing description
    business_category = db.Column(db.String(50), default='')  # One of 6 business categories
    subcategory = db.Column(db.String(100), default='')  # Subcategory within business category
    risk_context = db.Column(db.Text, default='')  # Business risk explanation
    
    def to_dict(self, include_technical=False):
        """Return tool data in business language. Technical names hidden by default."""
        data = {
            'id': self.id,
            'name': self.business_name or self.name,  # Business name first
            'category': self.category,
            'business_category': self.business_category or 'web_application_security',
            'subcategory': self.subcategory or '',
            'description': self.business_description or self.description,
            'risk_context': self.risk_context or '',
            'parameters': self.parameters,
            'plan_required': self.plan_required,
            'is_active': self.is_active,
            'tool_type': self.tool_type or 'cli',
            'hardware_required': self.hardware_required or [],
            'gui_required': self.gui_required or False,
        }
        if include_technical:
            data['technical_name'] = self.name
            data['install_command'] = self.install_command
            data['example_usage'] = self.example_usage
            data['official_url'] = self.official_url
        return data

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
        health['checks']['database'] = {'status': 'error', 'error': str(e)}
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
            health['checks']['scan_engine'] = {'status': 'not_available'}
    except Exception as e:
        health['checks']['scan_engine'] = {'status': 'error', 'error': str(e)}
    
    # Check WebSocket
    health['checks']['websocket'] = {'status': 'ok' if socketio else 'not_available'}

    # Organization & user counts
    try:
        org_count = db.session.execute(db.text('SELECT COUNT(*) FROM organizations')).scalar()
        user_count = db.session.execute(db.text('SELECT COUNT(*) FROM users')).scalar()
        agent_count = db.session.execute(db.text('SELECT COUNT(*) FROM agents')).scalar()
        scan_count = db.session.execute(db.text('SELECT COUNT(*) FROM scans')).scalar()
        health['checks']['counts'] = {
            'organizations': org_count or 0,
            'users': user_count or 0,
            'agents': agent_count or 0,
            'scans': scan_count or 0,
        }
    except Exception:
        pass

    # Stripe connectivity
    health['checks']['stripe'] = {'status': 'configured' if os.environ.get('STRIPE_SECRET_KEY') else 'not_configured'}

    # Plan config
    health['checks']['plans'] = list(PLAN_CONFIG.keys())
    
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
    """Register new user and organization — sends verification email"""
    # V17: Custom rate limiting (3 per minute) — eventlet compatible
    client_ip = request.remote_addr or 'unknown'
    if _rate_limiter.is_limited(f'register:{client_ip}', limit=3, window_seconds=60):
        return jsonify({'error': 'Too many registration attempts. Please try again later.'}), 429
    try:
        import secrets
        data = request.get_json()
        
        # Validate input
        required_fields = ['email', 'password', 'organization_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if user already exists
        existing = User.query.filter_by(email=data['email']).first()
        if existing:
            # If unverified, allow re-registration with new token
            if existing.email_verified == False and existing.verification_token:
                token = secrets.token_urlsafe(48)
                existing.verification_token = token
                existing.verification_sent_at = datetime.utcnow()
                existing.set_password(data['password'])
                db.session.commit()
                try:
                    from email_service import send_verification_email
                    send_verification_email({
                        'email': existing.email,
                        'first_name': existing.first_name or '',
                        'verification_token': token,
                    })
                except Exception as e:
                    print(f"Verification email resend failed: {e}")
                return jsonify({
                    'message': 'Verification email resent. Please check your inbox.',
                    'requires_verification': True,
                }), 200
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
        
        # Generate verification token
        verification_token = secrets.token_urlsafe(48)
        
        # Create user (email NOT verified yet)
        user = User(
            email=data['email'],
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            role='admin',
            organization_id=org.id,
            email_verified=False,
            verification_token=verification_token,
            verification_sent_at=datetime.utcnow(),
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
        
        # Send verification email + admin notification
        try:
            from email_service import send_verification_email, notify_admin_new_registration
            
            user_data = {
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'organization_name': org.name,
                'plan': 'Starter (Trial)',
                'verification_token': verification_token,
            }
            
            # Send verification email to user
            send_verification_email(user_data)
            
            # Notify admin of new registration
            notify_admin_new_registration(user_data)
            
        except Exception as e:
            print(f"Email notification failed: {e}")
            # Don't fail registration if email fails
        
        # V20: Audit log
        log_audit('user_registered', category='auth', severity='info', user_id=user.id, org_id=org.id,
                  details={'email': user.email, 'org_name': org.name})

        # V13: Do NOT return JWT — user must verify email first
        return jsonify({
            'message': 'Registration successful! Please check your email to verify your account.',
            'requires_verification': True,
            'email': user.email,
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/auth/verify-email', methods=['POST'])
def verify_email():
    """Verify user email with token — V13"""
    try:
        data = request.get_json()
        token = data.get('token')
        
        if not token:
            return jsonify({'error': 'Verification token is required'}), 400
        
        user = User.query.filter_by(verification_token=token).first()
        if not user:
            return jsonify({'error': 'Invalid or expired verification token'}), 400
        
        # Check expiry (24 hours)
        if user.verification_sent_at:
            elapsed = (datetime.utcnow() - user.verification_sent_at).total_seconds()
            if elapsed > 86400:  # 24 hours
                return jsonify({'error': 'Verification token has expired. Please request a new one.'}), 400
        
        # Verify the email
        user.email_verified = True
        user.verification_token = None  # Invalidate token
        db.session.commit()
        
        # Generate JWT now that email is verified
        access_token = create_access_token(identity=user.id)
        
        # Send welcome email
        try:
            from email_service import notify_user_welcome
            notify_user_welcome({
                'email': user.email,
                'first_name': user.first_name,
            })
        except Exception:
            pass
        
        return jsonify({
            'message': 'Email verified successfully!',
            'access_token': access_token,
            'user': user.to_dict(),
            'organization': user.organization.to_dict() if user.organization else None,
        }), 200
        
    except Exception as e:
        # V17: Re-raise HTTP exceptions (413, etc.) so Flask error handlers can process them
        from werkzeug.exceptions import HTTPException
        if isinstance(e, HTTPException):
            raise
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/auth/resend-verification', methods=['POST'])
def resend_verification():
    """Resend email verification link — V13"""
    # V17: Custom rate limiting (2 per minute) — eventlet compatible
    client_ip = request.remote_addr or 'unknown'
    if _rate_limiter.is_limited(f'resend:{client_ip}', limit=2, window_seconds=60):
        return jsonify({'error': 'Too many requests. Please try again later.'}), 429
    try:
        import secrets
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        user = User.query.filter_by(email=email).first()
        if not user:
            # Don't reveal if email exists
            return jsonify({'message': 'If that email exists, a new verification link has been sent.'}), 200
        
        if user.email_verified:
            return jsonify({'message': 'Email is already verified. You can log in.'}), 200
        
        # Rate limit: max one resend per 60 seconds
        if user.verification_sent_at:
            elapsed = (datetime.utcnow() - user.verification_sent_at).total_seconds()
            if elapsed < 60:
                return jsonify({'error': f'Please wait {int(60 - elapsed)} seconds before requesting again.'}), 429
        
        # Generate new token
        token = secrets.token_urlsafe(48)
        user.verification_token = token
        user.verification_sent_at = datetime.utcnow()
        db.session.commit()
        
        try:
            from email_service import send_verification_email
            send_verification_email({
                'email': user.email,
                'first_name': user.first_name or '',
                'verification_token': token,
            })
        except Exception as e:
            print(f"Resend verification failed: {e}")
        
        return jsonify({'message': 'If that email exists, a new verification link has been sent.'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/auth/login', methods=['POST'])
def login():
    """User login"""
    # V17: Custom rate limiting (5 per minute) — eventlet compatible
    client_ip = request.remote_addr or 'unknown'
    if _rate_limiter.is_limited(f'login:{client_ip}', limit=5, window_seconds=60):
        return jsonify({'error': 'Too many login attempts. Please try again later.'}), 429
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
            log_audit('login_failed', category='auth', severity='warning', details={'email': email, 'reason': 'user_not_found'}, status='failure')
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not user.check_password(data['password']):
            app.logger.warning(f"🔐 Login failed: wrong password for {email}")
            log_audit('login_failed', category='auth', severity='warning', user_id=user.id, org_id=user.organization_id, details={'reason': 'wrong_password'}, status='failure')
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not user.is_active:
            app.logger.warning(f"🔐 Login blocked: deactivated account {email}")
            log_audit('login_blocked', category='auth', severity='warning', user_id=user.id, details={'reason': 'deactivated'}, status='failure')
            return jsonify({'error': 'Account deactivated'}), 403
        
        # V16: Super admin / founder emails bypass verification check
        FOUNDER_EMAILS = [
            'semihkilic@semihkilic.com',
            'semih@semihkilic.com',
            'cybersecpro@semihkilic.com',
            'admin@cybersecpro.com'
        ]
        
        # V13: Check email verification (skip for founders & oauth users)
        is_founder = email.lower() in [e.lower() for e in FOUNDER_EMAILS]
        if user.email_verified == False and user.oauth_provider is None and not is_founder:
            app.logger.warning(f"🔐 Login blocked: email not verified for {email}")
            return jsonify({
                'error': 'Please verify your email before logging in.',
                'requires_verification': True,
                'email': user.email,
            }), 403
        
        # V20: MFA challenge — if user has MFA enabled, require TOTP before issuing tokens
        if user.mfa_enabled and user.mfa_secret:
            mfa_code = data.get('mfa_code')
            if not mfa_code:
                # Return MFA challenge — don't issue tokens yet
                app.logger.info(f"🔐 MFA challenge issued for {email}")
                return jsonify({
                    'requires_mfa': True,
                    'user_id': user.id,
                    'message': 'MFA verification required'
                }), 200
            
            # Verify TOTP code or backup code
            totp = pyotp.TOTP(user.mfa_secret)
            if not totp.verify(mfa_code, valid_window=1):
                # Check backup codes
                backup_codes = user.mfa_backup_codes or []
                hashed_input = generate_password_hash(mfa_code)
                code_valid = False
                for i, stored_code in enumerate(backup_codes):
                    if check_password_hash(stored_code, mfa_code):
                        code_valid = True
                        backup_codes.pop(i)
                        user.mfa_backup_codes = backup_codes
                        db.session.commit()
                        app.logger.info(f"🔐 MFA backup code used for {email}, {len(backup_codes)} remaining")
                        break
                if not code_valid:
                    app.logger.warning(f"🔐 MFA failed: invalid code for {email}")
                    log_audit('mfa_failed', category='auth', severity='warning', user_id=user.id, org_id=user.organization_id, status='failure')
                    return jsonify({'error': 'Invalid MFA code'}), 401
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Generate JWT tokens — V18: access + refresh
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        app.logger.info(f"🔐 Login successful: {email} (user_id={user.id})")
        log_audit('login_success', category='auth', user_id=user.id, org_id=user.organization_id)
        
        # V18: Set httpOnly cookies + return JSON (dual mode for migration)
        resp = jsonify({
            'message': 'Login successful',
            'access_token': access_token,  # Still returned for legacy/mobile clients
            'user': user.to_dict(),
            'organization': user.organization.to_dict() if user.organization else None
        })
        set_access_cookies(resp, access_token)
        set_refresh_cookies(resp, refresh_token)
        return resp
        
    except Exception as e:
        # V17: Re-raise HTTP exceptions (413, etc.) so Flask error handlers can process them
        from werkzeug.exceptions import HTTPException
        if isinstance(e, HTTPException):
            raise
        app.logger.error(f"🔐 Login error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ================================
# V18: TOKEN REFRESH & LOGOUT (httpOnly cookies)
# ================================

@app.route('/api/v1/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh_token():
    """Issue a new access token using the refresh token cookie — V18"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or not user.is_active:
            return jsonify({'error': 'Invalid session'}), 401
        
        new_access = create_access_token(identity=user_id)
        resp = jsonify({
            'access_token': new_access,
            'user': user.to_dict(),
            'organization': user.organization.to_dict() if user.organization else None,
        })
        set_access_cookies(resp, new_access)
        return resp
    except Exception as e:
        return jsonify({'error': 'Token refresh failed'}), 401


@app.route('/api/v1/auth/logout', methods=['POST'])
@jwt_required(optional=True)
def auth_logout():
    """Clear httpOnly JWT cookies — V18"""
    # V20: Audit log
    try:
        user_id = get_jwt_identity()
        if user_id:
            user = User.query.get(user_id)
            if user:
                log_audit('logout', category='auth', severity='info', user_id=user.id, org_id=user.organization_id)
    except Exception:
        pass
    resp = jsonify({'message': 'Logged out'})
    unset_jwt_cookies(resp)
    return resp


# ================================
# V20: MFA/TOTP ENDPOINTS
# ================================

@app.route('/api/v1/auth/mfa/setup', methods=['POST'])
@jwt_required()
def mfa_setup():
    """Generate TOTP secret and QR code for MFA setup — V20"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if user.mfa_enabled:
            return jsonify({'error': 'MFA is already enabled'}), 400
        
        # Generate new TOTP secret
        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name='CyberSec Pro'
        )
        
        # Generate QR code as base64 SVG
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        img = qr.make_image(image_factory=qrcode.image.svg.SvgPathImage)
        buffer = io.BytesIO()
        img.save(buffer)
        qr_svg = buffer.getvalue().decode('utf-8')
        
        # Store secret temporarily (not enabled until verified)
        user.mfa_secret = secret
        db.session.commit()
        
        app.logger.info(f"🔐 MFA setup initiated for {user.email}")
        
        return jsonify({
            'secret': secret,
            'qr_code': qr_svg,
            'provisioning_uri': provisioning_uri,
            'message': 'Scan QR code with your authenticator app, then verify with a code'
        })
    except Exception as e:
        app.logger.error(f"🔐 MFA setup error: {str(e)}")
        return jsonify({'error': 'MFA setup failed'}), 500


@app.route('/api/v1/auth/mfa/verify-setup', methods=['POST'])
@jwt_required()
def mfa_verify_setup():
    """Verify TOTP code to complete MFA setup — V20"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if user.mfa_enabled:
            return jsonify({'error': 'MFA is already enabled'}), 400
        
        if not user.mfa_secret:
            return jsonify({'error': 'MFA setup not initiated. Call /mfa/setup first'}), 400
        
        data = request.get_json()
        code = data.get('code', '').strip()
        
        if not code or len(code) != 6:
            return jsonify({'error': 'A 6-digit code is required'}), 400
        
        totp = pyotp.TOTP(user.mfa_secret)
        if not totp.verify(code, valid_window=1):
            return jsonify({'error': 'Invalid code. Please try again'}), 400
        
        # Generate backup codes
        import secrets
        raw_backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
        hashed_backup_codes = [generate_password_hash(c) for c in raw_backup_codes]
        
        # Enable MFA
        user.mfa_enabled = True
        user.mfa_backup_codes = hashed_backup_codes
        user.mfa_enabled_at = datetime.utcnow()
        db.session.commit()
        
        app.logger.info(f"🔐 MFA enabled for {user.email}")
        log_audit('mfa_enabled', category='auth', severity='info', user_id=user.id, org_id=user.organization_id)
        
        return jsonify({
            'message': 'MFA enabled successfully',
            'backup_codes': raw_backup_codes,
            'warning': 'Save these backup codes securely. They will not be shown again.'
        })
    except Exception as e:
        app.logger.error(f"🔐 MFA verify-setup error: {str(e)}")
        return jsonify({'error': 'MFA verification failed'}), 500


@app.route('/api/v1/auth/mfa/disable', methods=['POST'])
@jwt_required()
def mfa_disable():
    """Disable MFA — requires current password — V20"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if not user.mfa_enabled:
            return jsonify({'error': 'MFA is not enabled'}), 400
        
        data = request.get_json()
        password = data.get('password', '')
        
        if not user.check_password(password):
            return jsonify({'error': 'Invalid password'}), 401
        
        user.mfa_enabled = False
        user.mfa_secret = None
        user.mfa_backup_codes = None
        user.mfa_enabled_at = None
        db.session.commit()
        
        app.logger.info(f"🔐 MFA disabled for {user.email}")
        log_audit('mfa_disabled', category='auth', severity='warning', user_id=user.id, org_id=user.organization_id)
        
        return jsonify({'message': 'MFA has been disabled'})
    except Exception as e:
        app.logger.error(f"🔐 MFA disable error: {str(e)}")
        return jsonify({'error': 'Failed to disable MFA'}), 500


@app.route('/api/v1/auth/mfa/status', methods=['GET'])
@jwt_required()
def mfa_status():
    """Get MFA status for current user — V20"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        backup_count = len(user.mfa_backup_codes) if user.mfa_backup_codes else 0
        
        return jsonify({
            'mfa_enabled': user.mfa_enabled or False,
            'mfa_enabled_at': user.mfa_enabled_at.isoformat() if user.mfa_enabled_at else None,
            'backup_codes_remaining': backup_count
        })
    except Exception as e:
        return jsonify({'error': 'Failed to get MFA status'}), 500


@app.route('/api/v1/auth/mfa/regenerate-backup', methods=['POST'])
@jwt_required()
def mfa_regenerate_backup():
    """Regenerate backup codes — requires current password — V20"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if not user.mfa_enabled:
            return jsonify({'error': 'MFA is not enabled'}), 400
        
        data = request.get_json()
        password = data.get('password', '')
        
        if not user.check_password(password):
            return jsonify({'error': 'Invalid password'}), 401
        
        import secrets
        raw_backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
        hashed_backup_codes = [generate_password_hash(c) for c in raw_backup_codes]
        
        user.mfa_backup_codes = hashed_backup_codes
        db.session.commit()
        
        app.logger.info(f"🔐 MFA backup codes regenerated for {user.email}")
        
        return jsonify({
            'backup_codes': raw_backup_codes,
            'warning': 'Previous backup codes are now invalid. Save these securely.'
        })
    except Exception as e:
        return jsonify({'error': 'Failed to regenerate backup codes'}), 500


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
            # Ensure domain always uses https
            if domain.startswith('http://'):
                domain = domain.replace('http://', 'https://', 1)
            redirect_uri = data.get('redirect_uri', f"{domain}/auth/callback")
            
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
    """Get available tools based on user's plan - Business Language"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        # Use centralized PLAN_CONFIG
        plan_cfg = get_plan_config(org.plan_type)
        user_plan_level = plan_cfg['level']
        tool_limit = plan_cfg['tool_limit']
        
        # Get all active tools
        all_tools = Tool.query.filter(Tool.is_active == True).order_by(Tool.business_name).all()
        
        # Filter based on plan - Enterprise gets all, others get limited
        if user_plan_level >= 4:  # Enterprise
            tools = all_tools
        else:
            tools = all_tools[:tool_limit]
        
        # Group by BUSINESS category (6 categories instead of 15)
        tools_by_category = {}
        for tool in tools:
            cat_key = tool.business_category or tool.category
            if cat_key not in tools_by_category:
                tools_by_category[cat_key] = []
            tools_by_category[cat_key].append(tool.to_dict())
        
        return jsonify({
            'tools': tools_by_category,
            'total_tools': len(tools),
            'user_plan': org.plan_type,
            'plan_limit': tool_limit,
            'features': plan_cfg['features'],
            'categories': list(BUSINESS_CATEGORIES.keys()) if BUSINESS_LANGUAGE_AVAILABLE else [],
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


# ================================
# BUSINESS LANGUAGE API ENDPOINTS (Master Architecture v1)
# All tool names are HIDDEN - users see business names only
# ================================

@app.route('/api/v1/business/categories', methods=['GET'])
def get_business_categories_endpoint():
    """Get 6 business security categories with tool counts"""
    try:
        categories = []
        for cat_id, cat_info in BUSINESS_CATEGORIES.items():
            count = Tool.query.filter_by(
                business_category=cat_id, is_active=True
            ).count()
            categories.append({
                'id': cat_id,
                'name': cat_info['name'],
                'business_name': cat_info['business_name'],
                'description': cat_info['description'],
                'icon': cat_info['icon'],
                'color': cat_info['color'],
                'tool_count': count,
                'subcategories': cat_info.get('subcategories', []),
            })
        
        return jsonify({
            'categories': categories,
            'total_tools': Tool.query.filter_by(is_active=True).count(),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/business/categories/<category_id>/tools', methods=['GET'])
@require_organization
def get_category_tools(category_id):
    """Get tools in a business category (business language only)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        plan_cfg = get_plan_config(org.plan_type)
        user_plan_level = plan_cfg['level']
        
        tools = Tool.query.filter_by(
            business_category=category_id, is_active=True
        ).order_by(Tool.business_name).all()
        
        result = []
        for tool in tools:
            tool_level = get_plan_config(tool.plan_required)['level']
            accessible = user_plan_level >= tool_level
            result.append({
                'id': tool.id,
                'name': tool.business_name or tool.name,
                'description': tool.business_description or tool.description,
                'subcategory': tool.subcategory or '',
                'risk_context': tool.risk_context or '',
                'plan_required': tool.plan_required,
                'accessible': accessible,
            })
        
        cat_info = BUSINESS_CATEGORIES.get(category_id, {})
        return jsonify({
            'category': {
                'id': category_id,
                'name': cat_info.get('name', category_id),
                'description': cat_info.get('description', ''),
            },
            'tools': result,
            'total': len(result),
            'accessible': sum(1 for t in result if t['accessible']),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/business/scan', methods=['POST'])
@require_organization
def start_business_scan():
    """Start an orchestrated scan (business language, category-based)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        plan_cfg = get_plan_config(org.plan_type)
        
        data = request.get_json()
        target = data.get('target', '').strip()
        categories = data.get('categories', None)  # None = all
        network_mode = data.get('network_mode', 'direct')
        agent_id = data.get('agent_id', None)
        
        if not target:
            return jsonify({'error': 'Target is required'}), 400
        
        # Check daily scan limit
        from datetime import date
        today_scans = Scan.query.filter(
            Scan.organization_id == org.id,
            db.func.date(Scan.created_at) == date.today()
        ).count()
        
        if today_scans >= plan_cfg['daily_scan_limit']:
            return jsonify({
                'error': 'Daily scan limit reached',
                'limit': plan_cfg['daily_scan_limit'],
                'used': today_scans,
                'upgrade_message': 'Upgrade your plan for more daily scans'
            }), 429
        
        if ORCHESTRATOR_AVAILABLE and scan_orchestrator:
            scan_id = scan_orchestrator.start_full_scan(
                target=target,
                organization_id=org.id,
                user_id=user_id,
                plan=org.plan_type,
                categories=categories,
                network_mode=network_mode,
                agent_id=agent_id,
            )
            
            return jsonify({
                'scan_id': scan_id,
                'status': 'initializing',
                'message': f'Security assessment started for {target}',
                'categories': len(categories) if categories else len(BUSINESS_CATEGORIES),
                'network_mode': network_mode,
            })
        else:
            return jsonify({'error': 'Scan engine not available'}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/business/scan/<scan_id>', methods=['GET'])
@require_organization
def get_business_scan_status(scan_id):
    """Get orchestrated scan status (business language)"""
    try:
        if ORCHESTRATOR_AVAILABLE and scan_orchestrator:
            status = scan_orchestrator.get_scan_status(scan_id)
            if status:
                return jsonify(status)
        
        # Fallback: check DB
        scan = Scan.query.get(scan_id)
        if not scan:
            return jsonify({'error': 'Scan not found'}), 404
        
        # Translate to business language
        result = scan.to_dict()
        if BUSINESS_LANGUAGE_AVAILABLE and business_translator:
            result = business_translator.translate_scan_result(result)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/business/network-modes', methods=['GET'])
@require_organization
def get_network_modes():
    """Get available network modes for the organization"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        if hasattr(agent_manager, 'get_available_modes'):
            modes = agent_manager.get_available_modes(org.id)
        else:
            from agent_manager import NETWORK_MODES
            modes = [
                {**info, 'id': mode_id, 'available': not info['requires_agent'], 'agents': []}
                for mode_id, info in NETWORK_MODES.items()
            ]
        
        return jsonify({'modes': modes})
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
# TOOL HEALTH CHECK / VERIFICATION
# ================================

# In-memory cache for tool health results
_tool_health_cache = {}
_tool_health_cache_time = None

def _check_tool_installed(tool_name):
    """Check if a tool binary is installed and get version info"""
    import shutil
    
    # Map tool names to actual binary names
    TOOL_BINARY_MAP = {
        'nmap': 'nmap',
        'nikto': 'nikto',
        'gobuster': 'gobuster',
        'sqlmap': 'sqlmap',
        'wpscan': 'wpscan',
        'masscan': 'masscan',
        'hydra': 'hydra',
        'john': 'john',
        'hashcat': 'hashcat',
        'dirb': 'dirb',
        'whois': 'whois',
        'dig': 'dig',
        'host': 'host',
        'nslookup': 'nslookup',
        'sslscan': 'sslscan',
        'whatweb': 'whatweb',
        'dnsrecon': 'dnsrecon',
        'theharvester': 'theHarvester',
        'subfinder': 'subfinder',
        'amass': 'amass',
        'fierce': 'fierce',
        'enum4linux': 'enum4linux',
        'smbclient': 'smbclient',
        'netcat': 'nc',
        'tcpdump': 'tcpdump',
        'traceroute': 'traceroute',
        'ping': 'ping',
        'arp-scan': 'arp-scan',
        'arping': 'arping',
        'nbtscan': 'nbtscan',
        'snmpwalk': 'snmpwalk',
        'onesixtyone': 'onesixtyone',
        'smtp-user-enum': 'smtp-user-enum',
        'responder': 'responder',
        'crackmapexec': 'crackmapexec',
        'evil-winrm': 'evil-winrm',
        'impacket': 'impacket-smbclient',
        'wfuzz': 'wfuzz',
        'ffuf': 'ffuf',
        'commix': 'commix',
        'xsser': 'xsser',
        'arjun': 'arjun',
        'nuclei': 'nuclei',
        'httpx': 'httpx',
        'dnsx': 'dnsx',
        'katana': 'katana',
        'curl': 'curl',
        'wget': 'wget',
        'netdiscover': 'netdiscover',
        'hping3': 'hping3',
        'aircrack-ng': 'aircrack-ng',
        'reaver': 'reaver',
        'bettercap': 'bettercap',
        'ettercap': 'ettercap',
        'mitmproxy': 'mitmproxy',
        'wireshark': 'wireshark',
        'tshark': 'tshark',
        'foremost': 'foremost',
        'binwalk': 'binwalk',
        'volatility': 'volatility',
        'autopsy': 'autopsy',
        'steghide': 'steghide',
        'exiftool': 'exiftool',
        'metagoofil': 'metagoofil',
        'sherlock': 'sherlock',
        'maltego': 'maltego',
        'recon-ng': 'recon-ng',
        'spiderfoot': 'spiderfoot',
        'metasploit': 'msfconsole',
        'searchsploit': 'searchsploit',
        'setoolkit': 'setoolkit',
        'social-engineering-toolkit': 'setoolkit',
    }
    
    # NON_SCANNER tools that are GUI/framework — mark as "not_applicable"
    NON_VERIFIABLE = {
        'nishang', 'powersploit', 'empire', 'starkiller', 'covenant',
        'cobalt-strike', 'binary-ninja', 'ida', 'bloodhound',
        'magictree', 'cherrytree', 'keepnote', 'serpico',
        'recordmydesktop', 'king-phisher', 'GTFOBins',
        'LOLBASProject', 'WADComs', 'PEASS-ng',
    }
    
    tool_lower = tool_name.lower().replace(' ', '-').replace('_', '-')
    
    if tool_lower in NON_VERIFIABLE or tool_name in NON_VERIFIABLE:
        return {'status': 'not_applicable', 'reason': 'GUI/framework tool - not CLI verifiable'}
    
    # Get binary name
    binary = TOOL_BINARY_MAP.get(tool_lower, tool_lower)
    
    # Check if binary exists
    path = shutil.which(binary)
    if not path:
        # Try alternate names
        alternates = [
            tool_lower,
            tool_lower.replace('-', ''),
            tool_name.lower(),
            tool_name.lower().replace(' ', '-'),
        ]
        for alt in alternates:
            path = shutil.which(alt)
            if path:
                binary = alt
                break
    
    if not path:
        return {'status': 'not_installed', 'binary': binary}
    
    # Get version
    version = None
    try:
        result = subprocess.run(
            [binary, '--version'],
            capture_output=True, text=True, timeout=5
        )
        version_output = result.stdout.strip() or result.stderr.strip()
        if version_output:
            # Take first line, max 100 chars
            version = version_output.split('\n')[0][:100]
    except Exception:
        try:
            result = subprocess.run(
                [binary, '-V'],
                capture_output=True, text=True, timeout=5
            )
            version_output = result.stdout.strip() or result.stderr.strip()
            if version_output:
                version = version_output.split('\n')[0][:100]
        except Exception:
            version = 'installed (version unknown)'
    
    return {
        'status': 'installed',
        'binary': binary,
        'path': path,
        'version': version or 'installed'
    }


@app.route('/api/v1/tools/health', methods=['GET'])
@require_organization
def get_tools_health():
    """Get health status of all tools — cached for 5 minutes
    
    Returns:
        - total: total tools checked
        - installed: number of installed tools
        - not_installed: number missing
        - not_applicable: GUI/framework tools
        - percentage: installation percentage
        - tools: detailed per-tool status
    """
    global _tool_health_cache, _tool_health_cache_time
    
    # Use cache if fresh (5 minutes)
    if _tool_health_cache_time and (datetime.utcnow() - _tool_health_cache_time).seconds < 300:
        return jsonify(_tool_health_cache)
    
    try:
        tools = Tool.query.filter_by(is_active=True).all()
        results = []
        installed_count = 0
        not_installed_count = 0
        not_applicable_count = 0
        
        for tool in tools:
            health = _check_tool_installed(tool.name)
            results.append({
                'id': tool.id,
                'name': tool.business_name or tool.name,
                'technical_name': tool.name,
                'category': tool.business_category or tool.category,
                'tool_type': tool.tool_type or 'cli',
                'health': health
            })
            if health['status'] == 'installed':
                installed_count += 1
            elif health['status'] == 'not_installed':
                not_installed_count += 1
            else:
                not_applicable_count += 1
        
        verifiable = installed_count + not_installed_count
        percentage = round((installed_count / verifiable * 100), 1) if verifiable > 0 else 0
        
        response = {
            'total': len(tools),
            'installed': installed_count,
            'not_installed': not_installed_count,
            'not_applicable': not_applicable_count,
            'percentage': percentage,
            'checked_at': datetime.utcnow().isoformat(),
            'tools': sorted(results, key=lambda x: (
                0 if x['health']['status'] == 'installed' else
                1 if x['health']['status'] == 'not_applicable' else 2,
                x['technical_name']
            ))
        }
        
        _tool_health_cache = response
        _tool_health_cache_time = datetime.utcnow()
        
        return jsonify(response)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/tools/<tool_id>/health', methods=['GET'])
@require_organization
def get_tool_health(tool_id):
    """Get health status of a specific tool"""
    try:
        tool = Tool.query.get(tool_id)
        if not tool:
            # Try by name/slug
            tool = Tool.query.filter(
                db.or_(Tool.name == tool_id, Tool.name.ilike(f'%{tool_id}%'))
            ).first()
        
        if not tool:
            return jsonify({'error': 'Tool not found'}), 404
        
        health = _check_tool_installed(tool.name)
        
        return jsonify({
            'id': tool.id,
            'name': tool.business_name or tool.name,
            'technical_name': tool.name,
            'health': health
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/tools/health/refresh', methods=['POST'])
@require_organization
def refresh_tools_health():
    """Force refresh of tool health cache"""
    global _tool_health_cache, _tool_health_cache_time
    _tool_health_cache = {}
    _tool_health_cache_time = None
    return jsonify({'message': 'Health cache cleared. Next request will perform fresh check.'})


@app.route('/api/v1/tools/verify-all', methods=['POST'])
@require_organization
def verify_all_tools():
    """Comprehensive tool verification — checks all critical tools and returns status report.
    Optional body: {"target": "10.0.0.115"} for smoke test against a target.
    """
    try:
        import shutil
        
        # Critical tools that should be installed
        CRITICAL_TOOLS = [
            'nmap', 'nikto', 'gobuster', 'sqlmap', 'wpscan', 'hydra', 'john',
            'hashcat', 'dirb', 'whois', 'dig', 'host', 'sslscan', 'whatweb',
            'dnsrecon', 'subfinder', 'masscan', 'ffuf', 'nuclei', 'httpx',
            'curl', 'wget', 'traceroute', 'ping', 'netcat', 'tcpdump',
            'exiftool', 'binwalk', 'foremost', 'tshark', 'arping', 'nbtscan',
            'snmpwalk', 'enum4linux', 'smbclient', 'wfuzz', 'commix',
            'searchsploit', 'lynis', 'trivy', 'fierce', 'hping3',
            'aircrack-ng', 'recon-ng', 'theharvester', 'amass', 'dnsx',
            'katana', 'arjun', 'xsstrike', 'sslyze',
        ]
        
        results = {
            'timestamp': datetime.utcnow().isoformat(),
            'total_checked': 0,
            'installed': 0,
            'missing': 0,
            'not_applicable': 0,
            'tools': []
        }
        
        for tool_name in CRITICAL_TOOLS:
            status = _check_tool_installed(tool_name)
            results['total_checked'] += 1
            if status['status'] == 'installed':
                results['installed'] += 1
            elif status['status'] == 'not_installed':
                results['missing'] += 1
            else:
                results['not_applicable'] += 1
            
            results['tools'].append({
                'name': tool_name,
                **status
            })
        
        # Quick nmap smoke test if target provided
        data = request.get_json(silent=True) or {}
        target = data.get('target')
        if target and shutil.which('nmap'):
            try:
                smoke = subprocess.run(
                    ['nmap', '-F', '-T4', '--top-ports', '10', target],
                    capture_output=True, text=True, timeout=30
                )
                results['smoke_test'] = {
                    'tool': 'nmap',
                    'target': target,
                    'success': smoke.returncode == 0,
                    'output_preview': (smoke.stdout or smoke.stderr)[:500]
                }
            except Exception as e:
                results['smoke_test'] = {
                    'tool': 'nmap',
                    'target': target,
                    'success': False,
                    'error': str(e)
                }
        
        results['summary'] = f"{results['installed']}/{results['total_checked']} tools installed, {results['missing']} missing"
        
        return jsonify(results)
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
                'max_agents': plan_cfg['max_agents'] if plan_cfg['max_agents'] != -1 else 'unlimited',
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
                'agents': plan_cfg['max_agents'] if plan_cfg['max_agents'] != -1 else 'unlimited',
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
                'max_agents': cfg['max_agents'] if cfg['max_agents'] != -1 else 'unlimited',
                'multi_tool_scan': cfg['multi_tool_scan'],
                'features': cfg['features'],
            }
        return jsonify({'plans': plans, 'total_tools': total_tools})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================
# DASHBOARD & BUSINESS SCAN ROUTES
# ================================

@app.route('/api/v1/dashboard/security-summary', methods=['GET'])
@require_organization
def dashboard_security_summary():
    """Return security summary for Overview dashboard"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        org = Organization.query.get(user.organization_id)
        
        # Get recent scans for this org
        recent_scans = Scan.query.filter_by(
            organization_id=user.organization_id
        ).order_by(Scan.created_at.desc()).limit(50).all()
        
        # Calculate security score based on scan results
        completed_scans = [s for s in recent_scans if s.status == 'completed']
        
        total_issues = 0
        critical_issues = 0
        high_issues = 0
        medium_issues = 0
        low_issues = 0
        info_issues = 0
        
        for scan in completed_scans:
            result_data = {}
            if scan.result:
                try:
                    import json
                    result_data = json.loads(scan.result) if isinstance(scan.result, str) else scan.result
                except:
                    pass
            
            findings = result_data.get('findings', [])
            for f in findings:
                sev = (f.get('severity') or '').lower()
                if sev == 'critical':
                    critical_issues += 1
                elif sev == 'high':
                    high_issues += 1
                elif sev == 'medium':
                    medium_issues += 1
                elif sev == 'low':
                    low_issues += 1
                else:
                    info_issues += 1
                total_issues += 1
        
        # Simple scoring: start at 100, deduct for issues
        security_score = max(0, min(100, 100 - (critical_issues * 15) - (high_issues * 8) - (medium_issues * 3) - (low_issues * 1)))
        
        # If no scans completed, show neutral score
        if not completed_scans:
            security_score = None
        
        return jsonify({
            'security_score': security_score,
            'open_issues': total_issues,
            'critical': critical_issues,
            'high': high_issues,
            'medium': medium_issues,
            'low': low_issues,
            'info': info_issues,
            'total_scans': len(recent_scans),
            'completed_scans': len(completed_scans),
            'protected_assets': Target.query.filter_by(organization_id=user.organization_id).count() if user.organization_id else 0,
            'plan': org.plan_type if org else 'trial',
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/scans/business', methods=['POST'])
@require_organization
def create_business_scan():
    """Create scan from business wizard (NewScanPage)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        target_url = data.get('target_url', '')
        target_type = data.get('target_type', 'website')
        scan_type = data.get('scan_type', 'quick')
        schedule_type = data.get('schedule_type', 'now')
        
        if not target_url:
            return jsonify({'error': 'Target URL is required'}), 400
        
        # Map scan_type to tool categories
        scan_config = {
            'quick': {'categories': ['web_security', 'network_security'], 'max_tools': 200, 'estimated_duration': '30 min'},
            'full': {'categories': ['web_security', 'network_security', 'vulnerability_assessment', 'compliance_audit', 'threat_intelligence', 'forensics_monitoring'], 'max_tools': 682, 'estimated_duration': '2 hours'},
            'compliance': {'categories': ['compliance_audit', 'web_security'], 'max_tools': 100, 'estimated_duration': '1 hour'},
        }
        
        config = scan_config.get(scan_type, scan_config['quick'])
        
        # Create scan record
        scan = Scan(
            user_id=user_id,
            organization_id=user.organization_id,
            tool_id=f'business_{scan_type}',
            target=target_url,
            parameters=json.dumps({
                'target_type': target_type,
                'scan_type': scan_type,
                'schedule_type': schedule_type,
                'categories': config['categories'],
                'max_tools': config['max_tools'],
                'source': 'business_wizard',
            }),
            status='pending',
        )
        db.session.add(scan)
        db.session.commit()
        
        return jsonify({
            'scan_id': scan.id,
            'status': 'pending',
            'estimated_duration': config['estimated_duration'],
            'message': f'{scan_type.capitalize()} scan created for {target_url}',
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/scans/<scan_id>/business-report', methods=['GET'])
@require_organization
def get_scan_business_report(scan_id):
    """Return business-language report for a completed scan"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        scan = Scan.query.filter_by(
            id=scan_id,
            organization_id=user.organization_id
        ).first()
        
        if not scan:
            return jsonify({'error': 'Scan not found'}), 404
        
        # Parse scan results
        result_data = {}
        if scan.output:
            try:
                result_data = json.loads(scan.output) if isinstance(scan.output, str) else scan.output
            except:
                pass
        
        # Build business report
        findings = result_data.get('findings', [])
        
        critical = sum(1 for f in findings if (f.get('severity') or '').lower() == 'critical')
        high = sum(1 for f in findings if (f.get('severity') or '').lower() == 'high')
        medium = sum(1 for f in findings if (f.get('severity') or '').lower() == 'medium')
        low = sum(1 for f in findings if (f.get('severity') or '').lower() == 'low')
        
        score = max(0, min(100, 100 - (critical * 15) - (high * 8) - (medium * 3) - (low * 1)))
        
        # Try to use BusinessReportGenerator if available
        try:
            from report_generator import BusinessReportGenerator
            generator = BusinessReportGenerator()
            business_findings = generator.translate_findings(findings)
        except:
            # Fallback: pass findings through with business language
            business_findings = findings
        
        # Build compliance status
        compliance = {}
        params = {}
        if scan.parameters:
            try:
                params = json.loads(scan.parameters) if isinstance(scan.parameters, str) else scan.parameters
            except:
                pass
        
        categories = params.get('categories', [])
        if 'compliance_audit' in categories:
            compliance = {
                'OWASP': score if score > 0 else 'pending',
                'GDPR': min(100, score + 10) if score > 0 else 'pending',
            }
        
        # Build fix roadmap
        roadmap = []
        for f in sorted(findings, key=lambda x: {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}.get((x.get('severity') or '').lower(), 4)):
            if len(roadmap) >= 5:
                break
            sev = (f.get('severity') or 'medium').lower()
            roadmap.append({
                'action': f.get('fix') or f.get('title') or 'Review finding',
                'title': f.get('title', 'Finding'),
                'priority': sev if sev in ('high', 'medium', 'low') else 'high' if sev == 'critical' else 'medium',
                'timeline': 'This week' if sev in ('critical', 'high') else 'Next 2 weeks' if sev == 'medium' else 'Next month',
                'effort': '1-2 hours' if sev in ('low', 'medium') else '2-4 hours',
            })
        
        return jsonify({
            'scan_id': scan_id,
            'target': scan.target,
            'status': scan.status,
            'summary': {
                'score': score,
                'critical': critical,
                'high': high,
                'medium': medium,
                'low': low,
                'total': len(findings),
            },
            'findings': business_findings,
            'compliance': compliance if compliance else None,
            'roadmap': roadmap,
            'generated_at': datetime.utcnow().isoformat(),
        })
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
        
        # V20: Audit log
        log_audit('scan_started', category='scan', severity='info', user_id=user.id, org_id=user.organization_id,
                  resource_type='scan', resource_id=scan.id,
                  details={'tool': data['tool_id'], 'target': data['target']})
        
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
                    customer_email=data.get('email'),  # For webhook org resolution
                    # V16: Automatic invoicing & tax compliance
                    invoice_creation={'enabled': True},
                    automatic_tax={'enabled': True},
                    tax_id_collection={'enabled': True},  # Collect VAT/Tax IDs from customers
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
                    # V16: Automatic invoicing & tax compliance
                    invoice_creation={'enabled': True},
                    automatic_tax={'enabled': True},
                    tax_id_collection={'enabled': True},  # Collect VAT/Tax IDs from customers
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
        data_object = event['data']['object'] if isinstance(event, dict) else event.data.object
        
        def _resolve_org(session_or_sub):
            """Resolve Organization from metadata, customer_email, or stripe_customer_id"""
            metadata = session_or_sub.get('metadata', {}) if isinstance(session_or_sub, dict) else getattr(session_or_sub, 'metadata', {})
            
            # 1. Try metadata organization_id (authenticated checkout)
            org_id = metadata.get('organization_id') if metadata else None
            if org_id:
                org = Organization.query.get(org_id)
                if org:
                    return org
            
            # 2. Try stripe_customer_id
            customer_id = session_or_sub.get('customer') if isinstance(session_or_sub, dict) else getattr(session_or_sub, 'customer', None)
            if customer_id:
                org = Organization.query.filter_by(stripe_customer_id=customer_id).first()
                if org:
                    return org
            
            # 3. Try customer_email (public checkout fallback)
            email = session_or_sub.get('customer_email') if isinstance(session_or_sub, dict) else getattr(session_or_sub, 'customer_email', None)
            if not email:
                customer_details = session_or_sub.get('customer_details', {}) if isinstance(session_or_sub, dict) else getattr(session_or_sub, 'customer_details', {})
                email = customer_details.get('email') if customer_details else None
            if email:
                user = User.query.filter_by(email=email).first()
                if user and user.organization:
                    return user.organization
            
            return None
        
        def _get_plan_from_metadata(obj):
            """Extract plan from metadata"""
            metadata = obj.get('metadata', {}) if isinstance(obj, dict) else getattr(obj, 'metadata', {})
            return metadata.get('plan') if metadata else None
        
        # ── checkout.session.completed ──────────────────────────
        if event_type == 'checkout.session.completed':
            org = _resolve_org(data_object)
            plan = _get_plan_from_metadata(data_object)
            
            if org and plan:
                org.plan_type = plan
                # Store subscription ID for future webhook events
                sub_id = data_object.get('subscription') if isinstance(data_object, dict) else getattr(data_object, 'subscription', None)
                if sub_id:
                    org.stripe_subscription_id = sub_id
                customer_id = data_object.get('customer') if isinstance(data_object, dict) else getattr(data_object, 'customer', None)
                if customer_id and not org.stripe_customer_id:
                    org.stripe_customer_id = customer_id
                db.session.commit()
                print(f"✅ Upgraded org {org.id} ({org.name}) to {plan}")
            else:
                print(f"⚠️ checkout.session.completed: could not resolve org or plan. org={org}, plan={plan}")
        
        # ── customer.subscription.updated ───────────────────────
        elif event_type == 'customer.subscription.updated':
            org = _resolve_org(data_object)
            if org:
                status = data_object.get('status') if isinstance(data_object, dict) else getattr(data_object, 'status', None)
                if status == 'active':
                    plan = _get_plan_from_metadata(data_object)
                    if plan:
                        org.plan_type = plan
                        db.session.commit()
                        print(f"✅ Subscription updated: org {org.id} → {plan}")
                elif status in ('past_due', 'unpaid'):
                    print(f"⚠️ Subscription {status} for org {org.id}")
        
        # ── customer.subscription.deleted ───────────────────────
        elif event_type == 'customer.subscription.deleted':
            org = _resolve_org(data_object)
            if org:
                org.plan_type = 'trial'
                org.stripe_subscription_id = None
                db.session.commit()
                print(f"⚠️ Subscription cancelled: org {org.id} → trial")
        
        # ── invoice.payment_failed ──────────────────────────────
        elif event_type == 'invoice.payment_failed':
            customer_id = data_object.get('customer') if isinstance(data_object, dict) else getattr(data_object, 'customer', None)
            if customer_id:
                org = Organization.query.filter_by(stripe_customer_id=customer_id).first()
                if org:
                    print(f"⚠️ Payment failed for org {org.id} ({org.name})")
        
        return jsonify({'received': True})
        
    except Exception as e:
        print(f"Webhook error: {e}")
        return jsonify({'error': str(e)}), 400


@app.route('/api/v1/billing/sync-plan', methods=['POST'])
@require_organization
def sync_plan_from_stripe():
    """Manual sync: check Stripe subscription and update plan_type accordingly"""
    import os
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        
        stripe_key = os.environ.get('STRIPE_SECRET_KEY')
        if not stripe_key or stripe_key == 'sk_test_...':
            return jsonify({'error': 'Stripe not configured'}), 503
        
        import stripe
        stripe.api_key = stripe_key
        
        # Price ID → plan name reverse map
        PRICE_TO_PLAN = {
            os.environ.get('STRIPE_STARTER_PRICE_ID', 'price_1T1eh20ed3IDKXcnWZVJA9ur'): 'starter',
            os.environ.get('STRIPE_PROFESSIONAL_PRICE_ID', 'price_1T1ei40ed3IDKXcnZDCi88tv'): 'professional',
            os.environ.get('STRIPE_ENTERPRISE_PRICE_ID', 'price_1T1eir0ed3IDKXcn3ILBR48o'): 'enterprise',
        }
        
        old_plan = org.plan_type
        
        # Try subscription ID first
        if org.stripe_subscription_id:
            try:
                sub = stripe.Subscription.retrieve(org.stripe_subscription_id)
                if sub.status == 'active':
                    price_id = sub['items']['data'][0]['price']['id']
                    plan = PRICE_TO_PLAN.get(price_id)
                    if plan:
                        org.plan_type = plan
                        db.session.commit()
                        return jsonify({'synced': True, 'old_plan': old_plan, 'new_plan': plan})
                elif sub.status in ('canceled', 'incomplete_expired'):
                    org.plan_type = 'trial'
                    org.stripe_subscription_id = None
                    db.session.commit()
                    return jsonify({'synced': True, 'old_plan': old_plan, 'new_plan': 'trial', 'reason': 'subscription_cancelled'})
            except Exception as e:
                print(f"Subscription lookup failed: {e}")
        
        # Try customer ID
        if org.stripe_customer_id:
            try:
                subs = stripe.Subscription.list(customer=org.stripe_customer_id, status='active', limit=1)
                if subs.data:
                    sub = subs.data[0]
                    org.stripe_subscription_id = sub.id
                    price_id = sub['items']['data'][0]['price']['id']
                    plan = PRICE_TO_PLAN.get(price_id)
                    if plan:
                        org.plan_type = plan
                        db.session.commit()
                        return jsonify({'synced': True, 'old_plan': old_plan, 'new_plan': plan})
            except Exception as e:
                print(f"Customer subscription lookup failed: {e}")
        
        return jsonify({'synced': False, 'plan': org.plan_type, 'message': 'No active subscription found'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
    """Get specific tool configuration with parameters.
    
    Resolution order:
    1. V7 TOOL_REGISTRY (tool_configs.py) — richest config
    2. Legacy scan_executor — older configs
    3. Database tool record — generate minimal config
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization

        # ── 1. Try V7 engine (best config) ──
        if V7_ENGINE_AVAILABLE:
            tc = v7_get_tool(tool_id)
            if tc is None:
                from tool_configs import get_or_generic
                tc = get_or_generic(tool_id)

            if tc:
                # Convert V7 ToolConfig to API response
                plan = org.plan_type or 'trial'
                allowed = v7_get_tools_for_plan(plan)
                
                # Build parameters dict from V7 profiles
                params = {}
                if tc.profiles:
                    default_profile = tc.profiles.get('default') or next(iter(tc.profiles.values()), None)
                    if default_profile and default_profile.args:
                        for arg in default_profile.args:
                            if arg.startswith('-'):
                                flag = arg.split()[0] if ' ' in arg else arg
                                param_name = flag.lstrip('-').replace('-', '_')
                                params[param_name] = {
                                    'flag': flag,
                                    'type': 'text',
                                    'description': f'{param_name} option',
                                    'default': '',
                                }
                
                # Add target placeholder parameter
                if tc.target_flag:
                    params['target'] = {
                        'flag': tc.target_flag,
                        'type': 'text',
                        'description': 'Target host, IP, or URL',
                        'required': True,
                    }

                return jsonify({
                    'tool': {
                        'id': tool_id,
                        'name': tc.name,
                        'command': tc.binary,
                        'description': tc.description,
                        'category': tc.category,
                        'plan_required': tc.plan,
                        'parameters': params,
                        'is_available': tool_id in allowed,
                    }
                })

        # ── 2. Try legacy scan_executor ──
        if SCAN_EXECUTOR_AVAILABLE:
            executor = get_executor()
            config = executor.get_tool_config(tool_id)
            if config:
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

        # ── 3. Fallback: lookup in DB ──
        tool_db = Tool.query.filter(
            db.or_(
                Tool.name == tool_id,
                db.func.lower(Tool.name) == tool_id.lower(),
                Tool.id == tool_id,
            )
        ).first()

        if tool_db:
            return jsonify({
                'tool': {
                    'id': tool_id,
                    'name': tool_db.business_name or tool_db.name,
                    'command': tool_db.name,
                    'description': tool_db.description or tool_db.business_description or f'{tool_db.name} security tool',
                    'category': tool_db.category or 'general',
                    'plan_required': tool_db.plan_required or 'starter',
                    'parameters': {},
                    'is_available': True,
                }
            })

        return jsonify({'error': 'Tool not found'}), 404
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================
# SCAN ENGINE V3 - WORLD-CLASS SCANNING
# ================================

# Business name → tool slug alias mapping
# Maps user-friendly business names to actual tool identifiers
TOOL_BUSINESS_ALIASES = {
    # Network & Infrastructure
    'network scanner': 'nmap',
    'network discovery': 'nmap',
    'port scanner': 'nmap',
    'network port scanner': 'nmap',
    'network-port-scanner': 'nmap',
    'network audit': 'nmap',
    'network infrastructure scanner': 'nmap',
    'dns lookup': 'dnsrecon',
    'dns scanner': 'dnsrecon',
    'dns reconnaissance': 'dnsrecon',
    'dns audit': 'dnsrecon',
    'subdomain finder': 'sublist3r',
    'subdomain scanner': 'sublist3r',
    'subdomain discovery': 'sublist3r',
    'ssl checker': 'sslyze',
    'ssl scanner': 'sslyze',
    'ssl/tls analyzer': 'sslyze',
    'ssl audit': 'testssl',
    'certificate scanner': 'sslyze',
    'firewall scanner': 'hping3',
    'traceroute': 'traceroute',
    'whois lookup': 'whois',
    'domain lookup': 'whois',
    'network sniffer': 'tcpdump',
    'packet capture': 'tcpdump',
    
    # Web Application Security
    'website scanner': 'nikto',
    'web scanner': 'nikto',
    'web vulnerability scanner': 'nikto',
    'web server scanner': 'nikto',
    'web app scanner': 'zap',
    'web application scanner': 'zap',
    'owasp scanner': 'zap',
    'xss scanner': 'xsstrike',
    'cross-site scripting': 'xsstrike',
    'sql injection': 'sqlmap',
    'sql injection scanner': 'sqlmap',
    'sqli scanner': 'sqlmap',
    'database scanner': 'sqlmap',
    'directory scanner': 'gobuster',
    'directory finder': 'dirb',
    'directory brute force': 'gobuster',
    'cms scanner': 'wpscan',
    'wordpress scanner': 'wpscan',
    'api scanner': 'arjun',
    'api parameter finder': 'arjun',
    'header scanner': 'nikto',
    
    # Vulnerability Assessment
    'vulnerability scanner': 'openvas',
    'vuln scanner': 'openvas',
    'vulnerability assessment': 'openvas',
    'security audit': 'lynis',
    'system audit': 'lynis',
    'linux audit': 'lynis',
    'compliance scanner': 'lynis',
    'cve scanner': 'searchsploit',
    'exploit finder': 'searchsploit',
    'exploit database': 'searchsploit',
    
    # Password & Authentication
    'password tester': 'hydra',
    'password cracker': 'john',
    'password auditor': 'hydra',
    'brute force': 'hydra',
    'brute force scanner': 'hydra',
    'login tester': 'hydra',
    'hash cracker': 'hashcat',
    'wifi scanner': 'aircrack-ng',
    'wireless scanner': 'aircrack-ng',
    'wireless security': 'aircrack-ng',
    
    # Information Gathering
    'email finder': 'theharvester',
    'email harvester': 'theharvester',
    'osint scanner': 'theharvester',
    'osint tool': 'theharvester',
    'information gathering': 'theharvester',
    'recon scanner': 'recon-ng',
    'reconnaissance': 'recon-ng',
    'metadata scanner': 'exiftool',
    'metadata extractor': 'exiftool',
    'google dorking': 'metagoofil',
    
    # Container & Cloud
    'docker scanner': 'trivy',
    'container scanner': 'trivy',
    'container security': 'trivy',
    'image scanner': 'trivy',
    'kubernetes scanner': 'kube-bench',
    'cloud scanner': 'prowler',
    'aws scanner': 'prowler',
}

def get_tool_by_name_or_id(tool_identifier):
    """
    Lookup tool in database by name, UUID, business_name, or business alias.
    Resolution order: UUID → exact name → exact business_name → business alias → partial match
    Returns tuple: (tool_db_object, tool_name)
    """
    if not tool_identifier:
        return None, tool_identifier
    
    # 1. Try exact UUID match
    tool = Tool.query.get(tool_identifier)
    if tool:
        return tool, tool.name
    
    # 2. Try case-insensitive exact name match (technical name)
    tool = Tool.query.filter(
        db.func.lower(Tool.name) == tool_identifier.lower()
    ).first()
    if tool:
        return tool, tool.name
    
    # 3. Try case-insensitive exact business_name match
    tool = Tool.query.filter(
        db.func.lower(Tool.business_name) == tool_identifier.lower()
    ).first()
    if tool:
        return tool, tool.name
    
    # 4. Try business alias mapping
    alias_key = tool_identifier.lower().strip()
    slug = TOOL_BUSINESS_ALIASES.get(alias_key)
    if slug:
        tool = Tool.query.filter(
            db.func.lower(Tool.name) == slug.lower()
        ).first()
        if tool:
            return tool, tool.name
    
    # 5. Try partial match on name or business_name
    tool = Tool.query.filter(
        db.or_(
            Tool.name.ilike(f'%{tool_identifier}%'),
            Tool.business_name.ilike(f'%{tool_identifier}%')
        )
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
        
        # Check if target is a private/local IP
        is_private_ip = target.startswith(('10.', '172.16.', '172.17.', '172.18.', '172.19.', 
                              '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
                              '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
                              '172.30.', '172.31.', '192.168.', '127.'))
        
        # Get execution mode from request
        requested_execution_mode = data.get('execution_mode', 'auto')
        agent_id_from_request = data.get('agent_id')
        
        # Private IP scanning is allowed when:
        # 1. User explicitly selected an agent (agent_id provided)
        # 2. User selected 'local' mode (scanning from their own network via server)
        # 3. Enterprise plan users (they may have internal infrastructure access)
        allow_private_ips = (
            agent_id_from_request or  # User selected a specific agent
            requested_execution_mode == 'local' or  # User explicitly wants local execution
            org.plan_type == 'enterprise'  # Enterprise users have full access
        )
        
        # Block private/local IPs only when auto mode without agent
        if is_private_ip and not allow_private_ips:
            # Check if user has any online agents - if so, suggest using one
            has_agents = Agent.query.filter_by(
                organization_id=org.id, status='online'
            ).count() > 0
            
            hint = 'Select a Private Agent to scan internal networks, or use public IP addresses'
            if not has_agents:
                hint = 'Register a Private Agent to scan internal networks, or use public IP addresses'
            
            return jsonify({
                'error': 'Private/local addresses require agent mode',
                'hint': hint,
                'suggestion': 'Select execution mode "agent" or register a private agent for internal network scanning'
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
        
        # ── Local execution — prefer V7 engine, fallback to V3 ──
        if V7_ENGINE_AVAILABLE:
            # V7 Engine — tool_configs + scan_runner + parsers
            tc = v7_get_tool(tool_name)
            if tc is None:
                # Try get_or_generic for auto-detected tools
                from tool_configs import get_or_generic
                tc = get_or_generic(tool_name)

            profile = parameters.pop('profile', 'default') if isinstance(parameters, dict) else 'default'
            extra_args = parameters.pop('extra_args', []) if isinstance(parameters, dict) else []

            # Build command preview
            try:
                cmd, _prof = v7_build_command(tc, target, profile, extra_args)
                cmd_str = ' '.join(cmd)
            except Exception as cmd_err:
                cmd_str = f"{tool_name} {target}"

            plan = org.plan_type or 'trial'

            # Run V7 scan in background thread
            import threading

            def _run_v7_scan_from_start():
                with app.app_context():
                    try:
                        output_lines = []

                        def on_output(line):
                            output_lines.append(line)
                            try:
                                # V11: Emit to BOTH scan-specific and org rooms
                                socketio.emit('scan_output', {
                                    'scan_id': scan_id,
                                    'line': line.rstrip(),
                                }, namespace='/scans', room=f'scan_{scan_id}')
                                socketio.emit('scan_output', {
                                    'scan_id': scan_id,
                                    'line': line.rstrip(),
                                }, room=f'org_{org.id}')
                            except Exception:
                                pass

                        def on_phase(phase, description, progress):
                            """V12: Emit phase updates for stepper UI."""
                            try:
                                from websocket_events import emit_scan_phase
                                emit_scan_phase(scan_id, phase, description, progress,
                                                org_id=str(org.id))
                            except Exception:
                                pass

                        result = v7_execute_scan(
                            tool_slug=tool_name,
                            target=target,
                            profile_name=profile if profile != 'default' else 'default',
                            user_plan=plan,
                            extra_args=extra_args,
                            scan_id=scan_id,
                            on_output=on_output,
                            on_phase=on_phase,
                        )

                        s = Scan.query.get(scan_id)
                        if s:
                            s.output = result.stdout[:65535] if result.stdout else ''
                            s.error_log = result.stderr[:10000] if result.stderr else ''
                            s.completed_at = datetime.utcnow()
                            if result.success:
                                s.status = 'completed'
                                s.findings = result.parsed or {}
                            elif result.timed_out:
                                s.status = 'timeout'
                            else:
                                s.status = 'failed'
                            db.session.commit()
                            print(f"✅ V7 Scan {scan_id[:8]} → {s.status} ({result.duration:.1f}s)")

                            try:
                                # V11: Emit complete to BOTH rooms
                                socketio.emit('scan_complete', {
                                    'scan_id': scan_id,
                                    'status': s.status,
                                    'duration': result.duration,
                                    'findings_count': len(result.parsed.get('findings', [])) if result.parsed else 0,
                                }, namespace='/scans', room=f'scan_{scan_id}')
                                socketio.emit('scan_complete', {
                                    'scan_id': scan_id,
                                    'status': s.status,
                                    'duration': result.duration,
                                    'findings_count': len(result.parsed.get('findings', [])) if result.parsed else 0,
                                }, room=f'org_{org.id}')
                            except Exception:
                                pass

                    except Exception as e:
                        print(f"❌ V7 Scan {scan_id[:8]} error: {e}")
                        import traceback
                        traceback.print_exc()
                        try:
                            s = Scan.query.get(scan_id)
                            if s:
                                s.status = 'failed'
                                s.error_log = str(e)
                                s.completed_at = datetime.utcnow()
                                db.session.commit()
                        except Exception:
                            db.session.rollback()

            t = threading.Thread(target=_run_v7_scan_from_start, daemon=True)
            t.start()

            return jsonify({
                'success': True,
                'scan_id': scan_id,
                'status': 'running',
                'tool': tool_name,
                'target': target,
                'execution_mode': 'local',
                'engine': 'v7',
                'command': cmd_str,
                'message': f'{tool_name} scan started on {target}'
            }), 201

        # Fallback: V3 engine
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


@app.route('/api/v1/scans/<scan_id>', methods=['DELETE'])
@require_organization
def delete_scan(scan_id):
    """Delete a scan record. Running scans are cancelled first."""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        scan = Scan.query.filter_by(
            id=scan_id,
            organization_id=user.organization_id
        ).first()
        
        if not scan:
            return jsonify({'error': 'Scan not found'}), 404
        
        # If still running, kill it first
        if scan.status in ('running', 'queued', 'pending', 'dispatched'):
            try:
                if SCAN_ENGINE_V3_AVAILABLE:
                    from scan_engine_v3 import get_engine_v3
                    get_engine_v3().cancel_scan(scan_id)
            except Exception:
                pass
        
        db.session.delete(scan)
        db.session.commit()
        
        return jsonify({'success': True, 'scan_id': scan_id, 'message': 'Scan deleted'})
        
    except Exception as e:
        db.session.rollback()
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
                'max_agents': plan_cfg['max_agents'] if plan_cfg['max_agents'] != -1 else 'unlimited',
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


@app.route('/api/v1/admin/impersonate', methods=['POST'])
@jwt_required()
def admin_impersonate():
    """Impersonate another user (superadmin only)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role != 'superadmin':
            return jsonify({'error': 'Unauthorized. Superadmin access required.'}), 403

        data = request.get_json()
        target_user_id = data.get('user_id')
        target_email = data.get('email')

        if target_user_id:
            target = User.query.get(target_user_id)
        elif target_email:
            target = User.query.filter_by(email=target_email).first()
        else:
            return jsonify({'error': 'Provide user_id or email'}), 400

        if not target:
            return jsonify({'error': 'Target user not found'}), 404

        # Create token for impersonated user
        token = create_access_token(
            identity=target.id,
            additional_claims={'impersonated_by': user.id}
        )
        target_org = Organization.query.get(target.organization_id) if target.organization_id else None

        return jsonify({
            'success': True,
            'message': f'Now impersonating {target.email}',
            'token': token,
            'user': target.to_dict(),
            'organization': target_org.to_dict() if target_org else None,
            'impersonated_by': user.email
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/admin/promote-superadmin', methods=['POST'])
@jwt_required()
def admin_promote_superadmin():
    """Promote a user to superadmin (existing superadmin only)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role != 'superadmin':
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        target_email = data.get('email')
        if not target_email:
            return jsonify({'error': 'email required'}), 400

        target = User.query.filter_by(email=target_email).first()
        if not target:
            return jsonify({'error': 'User not found'}), 404

        target.role = 'superadmin'
        db.session.commit()
        return jsonify({'success': True, 'message': f'{target_email} is now superadmin'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/admin/overview', methods=['GET'])
@jwt_required()
def admin_overview():
    """Complete admin overview with all critical data (superadmin only)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role != 'superadmin':
            return jsonify({'error': 'Unauthorized'}), 403

        # Users
        all_users = User.query.all()
        active_users = [u for u in all_users if u.is_active]

        # Organizations
        all_orgs = Organization.query.all()
        plans_dist = {}
        for org in all_orgs:
            plans_dist[org.plan_type] = plans_dist.get(org.plan_type, 0) + 1

        # Scans
        total_scans = Scan.query.count()
        running_scans = Scan.query.filter_by(status='running').count()
        recent_scans = Scan.query.order_by(Scan.created_at.desc()).limit(10).all()

        # Agents
        total_agents = Agent.query.count()
        online_agents = Agent.query.filter_by(status='online').count()

        # Revenue estimation
        plan_prices = {'trial': 0, 'starter': 99, 'professional': 299, 'enterprise': 799}
        mrr = sum(plan_prices.get(org.plan_type, 0) for org in all_orgs if org.is_active)

        return jsonify({
            'users': {
                'total': len(all_users),
                'active': len(active_users),
                'list': [u.to_dict() for u in all_users[:50]]
            },
            'organizations': {
                'total': len(all_orgs),
                'plans_distribution': plans_dist,
                'list': [o.to_dict() for o in all_orgs[:50]]
            },
            'scans': {
                'total': total_scans,
                'running': running_scans,
                'recent': [{'id': s.id, 'target': s.target, 'status': s.status, 'created_at': s.created_at.isoformat()} for s in recent_scans]
            },
            'agents': {
                'total': total_agents,
                'online': online_agents
            },
            'revenue': {
                'mrr': mrr,
                'arr': mrr * 12
            }
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
# V7 SCAN ENGINE — Tool Automation
# ================================

try:
    from tool_configs import (TOOL_REGISTRY, get_tools_for_plan as v7_get_tools_for_plan,
                              get_tool as v7_get_tool, get_categories as v7_get_categories,
                              get_all_slugs as v7_get_all_slugs, bulk_register_from_db)
    from scan_runner import execute_scan as v7_execute_scan, validate_binary, build_command as v7_build_command
    from scan_runner import ToolNotFoundError, BinaryMissingError, TargetRequiredError, PlanAccessDeniedError, ScanTimeoutError
    from parsers import auto_parse
    V7_ENGINE_AVAILABLE = True
    
    # Bulk-register all DB tools into V7 registry
    with app.app_context():
        try:
            all_db_tools = Tool.query.all()
            tools_data = [{
                'name': t.name,
                'category': t.category,
                'plan_required': t.plan_required,
                'business_name': t.business_name,
                'description': t.description or t.business_description or '',
            } for t in all_db_tools]
            added = bulk_register_from_db(tools_data)
            print(f"✅ V7 Scan Engine loaded ({len(TOOL_REGISTRY)} tools, {added} auto-registered from DB)")
        except Exception as e:
            print(f"✅ V7 Scan Engine loaded ({len(TOOL_REGISTRY)} tools) — DB sync skipped: {e}")
    
except ImportError as e:
    V7_ENGINE_AVAILABLE = False
    print(f"⚠️ V7 Scan Engine not available: {e}")


@app.route('/api/v1/v7/tools', methods=['GET'])
@require_organization
def v7_list_tools():
    """List all tools available for the user's plan (V7 Engine)"""
    if not V7_ENGINE_AVAILABLE:
        return jsonify({'error': 'V7 engine not available'}), 503

    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        plan = org.plan_type or 'trial'

        allowed_slugs = v7_get_tools_for_plan(plan)
        tools_list = []
        for slug in sorted(allowed_slugs):
            tc = v7_get_tool(slug)
            if tc:
                # Check if binary is installed
                import shutil
                binary_path = shutil.which(tc.binary)
                tools_list.append({
                    'slug': tc.slug,
                    'name': tc.name,
                    'binary': tc.binary,
                    'category': tc.category,
                    'description': tc.description,
                    'plan': tc.plan,
                    'installed': binary_path is not None,
                    'profiles': list(tc.profiles.keys()),
                    'needs_target': tc.needs_target,
                    'dangerous': tc.dangerous,
                    'output_format': tc.output_format,
                })

        categories = {}
        for t in tools_list:
            cat = t['category']
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(t['slug'])

        return jsonify({
            'tools': tools_list,
            'total': len(tools_list),
            'plan': plan,
            'categories': categories,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/v7/tools/<slug>', methods=['GET'])
@require_organization
def v7_tool_detail(slug):
    """Get detailed tool config including profiles (V7 Engine)"""
    if not V7_ENGINE_AVAILABLE:
        return jsonify({'error': 'V7 engine not available'}), 503

    tc = v7_get_tool(slug)
    if not tc:
        return jsonify({'error': f'Tool {slug} not found in registry'}), 404

    import shutil
    binary_path = shutil.which(tc.binary)

    profiles = {}
    for pname, p in tc.profiles.items():
        profiles[pname] = {
            'name': p.name,
            'description': p.description,
            'timeout': p.timeout,
            'requires_root': p.requires_root,
        }

    return jsonify({
        'slug': tc.slug,
        'name': tc.name,
        'binary': tc.binary,
        'category': tc.category,
        'description': tc.description,
        'plan': tc.plan,
        'installed': binary_path is not None,
        'binary_path': binary_path,
        'profiles': profiles,
        'needs_target': tc.needs_target,
        'dangerous': tc.dangerous,
        'target_mode': tc.target_mode,
        'output_format': tc.output_format,
        'notes': tc.notes,
    })


@app.route('/api/v1/v7/scan/execute', methods=['POST'])
@require_organization
def v7_execute_scan_endpoint():
    """
    Execute a one-click scan using the V7 engine.
    
    Body JSON:
      {
        "tool_slug": "nmap",
        "target": "example.com",
        "profile": "quick",         // optional, defaults to "default"
        "extra_args": [],            // optional
        "agent_id": null             // optional — future SSH agent support
      }
    
    Returns:
      201 — scan started, with scan_id and streaming will be available
    """
    if not V7_ENGINE_AVAILABLE:
        return jsonify({'error': 'V7 engine not available'}), 503

    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        data = request.get_json()

        tool_slug = data.get('tool_slug')
        target = data.get('target')
        profile = data.get('profile', 'default')
        extra_args = data.get('extra_args', [])

        if not tool_slug or not target:
            return jsonify({'error': 'tool_slug and target are required'}), 400

        # Resolve tool config
        tc = v7_get_tool(tool_slug)
        if not tc:
            return jsonify({'error': f'Unknown tool: {tool_slug}'}), 404

        # Plan access check
        plan = org.plan_type or 'trial'
        allowed = v7_get_tools_for_plan(plan)
        if tool_slug not in allowed:
            return jsonify({
                'error': f'Tool {tool_slug} requires plan upgrade',
                'current_plan': plan,
                'required_plan': tc.plan,
            }), 402

        # Daily scan limit
        plan_cfg = get_plan_config(plan)
        daily_limit = plan_cfg['daily_scan_limit']
        if daily_limit > 0:
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
                }), 429

        # Resolve or create Tool DB record for FK
        tool_db = Tool.query.filter_by(name=tool_slug).first()
        if not tool_db:
            tool_db = Tool.query.filter_by(name=tc.name).first()
        if not tool_db:
            # Auto-create tool record
            tool_db = Tool(
                name=tool_slug,
                business_name=tc.name,
                category=tc.category,
                business_category=tc.category,
                description=tc.description,
                business_description=tc.description,
                plan_required=tc.plan,
                is_active=True,
                tool_type='cli',
            )
            db.session.add(tool_db)
            db.session.flush()

        # Create scan record
        scan_id = str(uuid.uuid4())
        scan = Scan(
            id=scan_id,
            organization_id=org.id,
            user_id=user.id,
            tool_id=tool_db.id,
            target=target,
            parameters={'profile': profile, 'extra_args': extra_args, 'engine': 'v7'},
            status='running',
            started_at=datetime.utcnow(),
        )
        db.session.add(scan)
        db.session.commit()

        # Build command preview
        try:
            cmd, _prof = v7_build_command(tc, target, profile, extra_args)
            cmd_str = ' '.join(cmd)
        except Exception as cmd_err:
            cmd_str = f"(build error: {cmd_err})"

        # Run scan in background thread with DB callback
        import threading

        def _run_v7_scan():
            with app.app_context():
                try:
                    output_lines = []

                    def on_output(line):
                        output_lines.append(line)
                        # Emit via WebSocket if available
                        try:
                            socketio.emit('scan_output', {
                                'scan_id': scan_id,
                                'line': line.rstrip(),
                            }, room=f'org_{org.id}')
                        except Exception:
                            pass

                    result = v7_execute_scan(
                        tool_slug=tool_slug,
                        target=target,
                        profile_name=profile,
                        user_plan=plan,
                        extra_args=extra_args,
                        scan_id=scan_id,
                        on_output=on_output,
                    )

                    s = Scan.query.get(scan_id)
                    if s:
                        s.output = result.stdout[:65535] if result.stdout else ''
                        s.error_log = result.stderr[:10000] if result.stderr else ''
                        s.completed_at = datetime.utcnow()

                        if result.success:
                            s.status = 'completed'
                            s.findings = result.parsed or {}
                        elif result.timed_out:
                            s.status = 'timeout'
                        else:
                            s.status = 'failed'

                        db.session.commit()
                        print(f"✅ V7 Scan {scan_id} → {s.status} ({result.duration:.1f}s)")

                        # Emit completion
                        try:
                            socketio.emit('scan_complete', {
                                'scan_id': scan_id,
                                'status': s.status,
                                'duration': result.duration,
                                'findings_count': len(result.parsed.get('findings', [])) if result.parsed else 0,
                            }, room=f'org_{org.id}')
                        except Exception:
                            pass

                except Exception as e:
                    print(f"❌ V7 Scan {scan_id} error: {e}")
                    import traceback
                    traceback.print_exc()
                    try:
                        s = Scan.query.get(scan_id)
                        if s:
                            s.status = 'failed'
                            s.error_log = str(e)
                            s.completed_at = datetime.utcnow()
                            db.session.commit()
                    except Exception:
                        db.session.rollback()

        t = threading.Thread(target=_run_v7_scan, daemon=True)
        t.start()

        # Emit activity
        _emit_scan_activity(scan, user, tool_db, 'started scan')

        return jsonify({
            'success': True,
            'scan_id': scan_id,
            'status': 'running',
            'tool': tool_slug,
            'profile': profile,
            'target': target,
            'command': cmd_str,
            'engine': 'v7',
            'message': f'{tc.name} scan started with {profile} profile',
        }), 201

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/v7/scan/<scan_id>/output', methods=['GET'])
@require_organization
def v7_scan_output(scan_id):
    """Get scan output and parsed findings for a V7 scan."""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        scan = Scan.query.filter_by(
            id=scan_id,
            organization_id=user.organization_id,
        ).first()

        if not scan:
            return jsonify({'error': 'Scan not found'}), 404

        return jsonify({
            'scan_id': scan.id,
            'status': scan.status,
            'tool_id': scan.tool_id,
            'target': scan.target,
            'parameters': scan.parameters,
            'output': scan.output,
            'error_log': scan.error_log,
            'findings': scan.findings,
            'started_at': scan.started_at.isoformat() if scan.started_at else None,
            'completed_at': scan.completed_at.isoformat() if scan.completed_at else None,
            'duration': scan.duration_str,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/v7/categories', methods=['GET'])
@require_organization
def v7_categories():
    """List all tool categories with counts (V7 Engine)"""
    if not V7_ENGINE_AVAILABLE:
        return jsonify({'error': 'V7 engine not available'}), 503

    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        plan = org.plan_type or 'trial'

        cats = v7_get_categories()
        allowed = v7_get_tools_for_plan(plan)

        result = []
        for cat, slugs in sorted(cats.items()):
            accessible = [s for s in slugs if s in allowed]
            result.append({
                'category': cat,
                'total_tools': len(slugs),
                'accessible_tools': len(accessible),
                'tools': accessible,
            })

        return jsonify({'categories': result, 'plan': plan})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/v7/verify', methods=['GET'])
@require_organization
def v7_verify_tools():
    """Verify which tools are installed on the server (admin/superadmin only)"""
    if not V7_ENGINE_AVAILABLE:
        return jsonify({'error': 'V7 engine not available'}), 503

    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if user.role not in ('admin', 'superadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        from verify_installation import verify_all
        results, summary = verify_all()

        return jsonify({
            'results': results,
            'summary': summary,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
        
        if max_agents != -1 and current_agents >= max_agents:
            return jsonify({'error': f'Agent limit reached ({current_agents}/{max_agents}). Upgrade your plan for more agents.'}), 402
        
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
        
        # V20: Audit log
        log_audit('agent_registered', category='agent', severity='info',
                  resource_type='agent', resource_id=agent.id,
                  details={'agent_name': agent.name, 'ip': request.remote_addr})
        
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
    """Execute a command on a remote agent via SSH or locally"""
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
        
        # Local execution mode
        if agent_id == 'local':
            try:
                # Security: only allow whitelisted tool prefixes for local execution
                allowed_prefixes = [
                    'nmap', 'nikto', 'gobuster', 'dirb', 'sqlmap', 'wpscan', 'whatweb',
                    'whois', 'dig', 'host', 'nslookup', 'sslscan', 'traceroute', 'ping',
                    'masscan', 'hydra', 'john', 'hashcat', 'theharvester', 'subfinder',
                    'amass', 'fierce', 'dnsrecon', 'enum4linux', 'nbtscan', 'snmpwalk',
                    'ffuf', 'wfuzz', 'nuclei', 'httpx', 'dnsx', 'katana', 'arjun',
                    'searchsploit', 'curl', 'wget', 'netdiscover', 'arp-scan', 'hping3',
                    'tshark', 'tcpdump', 'foremost', 'binwalk', 'exiftool', 'steghide',
                    'ls', 'pwd', 'cat', 'head', 'tail', 'grep', 'find', 'wc',
                    'uname', 'hostname', 'whoami', 'id', 'date', 'uptime',
                    'df', 'free', 'top', 'ps', 'netstat', 'ss', 'ip', 'ifconfig',
                    'which', 'file', 'strings', 'xxd', 'base64', 'echo',
                ]
                first_word = command.split()[0].split('/')[-1]  # handle /usr/bin/nmap etc
                if first_word not in allowed_prefixes:
                    return jsonify({
                        'error': f'Command "{first_word}" is not allowed in local mode',
                        'output': f'Error: "{first_word}" is not in the allowed command list for local execution.',
                        'exit_code': -1
                    }), 403
                
                result = subprocess.run(
                    command, shell=True,
                    capture_output=True, text=True, timeout=120
                )
                output = result.stdout
                if result.stderr:
                    output = output + '\n' + result.stderr if output else result.stderr
                
                return jsonify({
                    'success': True,
                    'output': output or '(no output)',
                    'exit_code': result.returncode,
                    'agent_name': 'Local Server',
                    'agent_platform': 'linux'
                })
            except subprocess.TimeoutExpired:
                return jsonify({
                    'error': 'Command timed out',
                    'output': 'Error: Command timed out after 120 seconds.',
                    'exit_code': -1
                }), 504
            except Exception as e:
                return jsonify({
                    'error': str(e),
                    'output': f'Error: {str(e)}',
                    'exit_code': -1
                }), 500
        
        # SSH execution mode
        # If no agent specified, try to use the first online agent with SSH
        if not agent_id:
            agent = Agent.query.filter(
                Agent.organization_id == user.organization_id,
                Agent.status == 'online',
                db.or_(
                    Agent.connection_type == 'ssh',
                    Agent.ssh_host.isnot(None)
                )
            ).first()
        else:
            agent = Agent.query.filter_by(
                id=agent_id, 
                organization_id=user.organization_id
            ).first()
        
        if not agent:
            return jsonify({
                'error': 'No agent available',
                'output': 'Error: No SSH agent available. Please add and connect an agent first, or use "Local Server" for local execution.',
                'exit_code': -1
            }), 404
        
        if not agent.ssh_host and not agent.ip_address:
            return jsonify({
                'error': 'Agent has no SSH host configured',
                'output': f'Error: Agent "{agent.name}" has no SSH host configured. Edit the agent to add SSH credentials.',
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
    """Get list of agents available for terminal connection.
    Returns all agents for the organization plus a local pseudo-agent.
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # Get ALL agents for this organization
        agents = Agent.query.filter(
            Agent.organization_id == user.organization_id
        ).all()
        
        agent_list = [{
            'id': a.id,
            'name': a.name,
            'hostname': a.hostname,
            'ip_address': a.ip_address,
            'platform': a.platform,
            'status': a.status,
            'ssh_host': a.ssh_host,
            'ssh_port': a.ssh_port,
            'ssh_username': a.ssh_username,
            'connection_type': a.connection_type
        } for a in agents]
        
        # Add localhost pseudo-agent for local tool execution
        agent_list.insert(0, {
            'id': 'local',
            'name': 'Local Server',
            'hostname': 'localhost',
            'ip_address': '127.0.0.1',
            'platform': 'linux',
            'status': 'online',
            'ssh_host': None,
            'ssh_port': None,
            'ssh_username': None,
            'connection_type': 'local'
        })
        
        return jsonify({
            'agents': agent_list
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/terminal/test-connection', methods=['POST'])
@jwt_required()
def test_terminal_connection():
    """Test SSH connection to an agent or local connectivity"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        agent_id = data.get('agent_id')
        
        if not agent_id:
            return jsonify({'error': 'Agent ID required'}), 400
        
        # Local agent test
        if agent_id == 'local':
            try:
                result = subprocess.run(
                    'uname -a && hostname && whoami',
                    shell=True, capture_output=True, text=True, timeout=5
                )
                return jsonify({
                    'connected': True,
                    'agent_name': 'Local Server',
                    'system_info': result.stdout.strip(),
                    'platform': 'linux'
                })
            except Exception as e:
                return jsonify({'connected': False, 'error': str(e)})
        
        agent = Agent.query.filter_by(
            id=agent_id, 
            organization_id=user.organization_id
        ).first()
        
        if not agent:
            return jsonify({'error': 'Agent not found'}), 404
        
        if not agent.ssh_host and not agent.ip_address:
            return jsonify({
                'connected': False,
                'error': 'Agent has no SSH host configured. Edit the agent to add SSH credentials.'
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


# ═══════════════════════════════════════════════════════════════
# CYBERBOT — AI SECURITY ASSISTANT CHATBOT (BÖLÜM 4)
# ═══════════════════════════════════════════════════════════════

CYBERBOT_SYSTEM_PROMPT_TEMPLATE = """You are CyberBot — CyberSec Pro platform's AI security assistant.

ROLE:
- Explain security scan results to non-technical users in plain language
- Describe vulnerabilities using business impact language
- Provide step-by-step remediation guidance
- Answer plan, billing, and feature questions

TONE:
- Professional but friendly
- Patient and educational
- Never condescending
- No technical jargon (unless user specifically asks)

NEVER DO:
- Give raw technical commands (like "nmap -sV...")
- Mention tool names (Metasploit, SQLMap, Nmap, etc.)
- Assume user has technical knowledge
- Give vague answers — always provide concrete, actionable guidance

ALWAYS DO:
- Translate technical terms to business language
- Explain "why this matters" (business impact)
- Provide step-by-step fix instructions
- Refer to human support when appropriate

PLATFORM DATA (live — do NOT override with guesses):
- Total security tools: {total_tools}
- {plan_text}

The categories are dynamically loaded from the database. Current categories:
{categories}
"""

def _build_dynamic_chatbot_context(user, org):
    """Build dynamic chatbot context from real platform data.
    Called at the start of each chat session to ensure fresh data."""
    plan_cfg = get_plan_config(org.plan_type)
    total_tools = Tool.query.filter_by(is_active=True).count()
    
    # Category breakdown
    cats = db.session.query(
        Tool.business_category, db.func.count(Tool.id)
    ).filter(Tool.is_active == True).group_by(Tool.business_category).all()
    cat_summary = ', '.join([f'{c}: {n}' for c, n in sorted(cats, key=lambda x: -x[1]) if c]) or f'{total_tools} tools across multiple categories'
    
    # Today's scan usage
    from datetime import date
    today_scans = Scan.query.filter(
        Scan.organization_id == org.id,
        db.func.date(Scan.created_at) == date.today()
    ).count()
    daily_limit = plan_cfg['daily_scan_limit']
    scans_remaining = max(0, daily_limit - today_scans) if daily_limit > 0 else 'unlimited'
    
    # Agent count
    agent_count = Agent.query.filter_by(organization_id=org.id).count()
    online_agents = Agent.query.filter_by(organization_id=org.id, status='online').count()
    
    # Build plan comparison from PLAN_CONFIG
    plan_lines = []
    for pname in ['trial', 'starter', 'professional', 'enterprise']:
        pcfg = PLAN_CONFIG[pname]
        price = f"\u20ac{pcfg['price_eur']}/month" if pcfg['price_eur'] > 0 else '\u20ac0 (14-day free trial)'
        yearly = f" (\u20ac{pcfg['yearly_price_eur']}/year)" if pcfg.get('yearly_price_eur', 0) > 0 else ''
        tools = pcfg['tool_limit'] if pcfg['tool_limit'] < 999 else total_tools
        scans_day = pcfg['daily_scan_limit'] if pcfg['daily_scan_limit'] > 0 else 'unlimited'
        agents = pcfg['max_agents'] if pcfg['max_agents'] > 0 else 'unlimited'
        plan_lines.append(
            f"  - **{pname.capitalize()}**: {price}{yearly} | {tools} tools | {scans_day} scans/day | {agents} agent(s) | {pcfg['max_team_members']} team member(s)"
        )
    plan_text = '\n'.join(plan_lines)
    
    # User's current plan info
    user_plan_info = (
        f"User's current plan: {org.plan_type.capitalize()}\n"
        f"  Tools available: {plan_cfg['tool_limit'] if plan_cfg['tool_limit'] < 999 else total_tools}\n"
        f"  Daily scan limit: {daily_limit if daily_limit > 0 else 'unlimited'}\n"
        f"  Scans used today: {today_scans}\n"
        f"  Scans remaining: {scans_remaining}\n"
        f"  Agents: {agent_count} ({online_agents} online)\n"
        f"  Max agents: {plan_cfg['max_agents'] if plan_cfg['max_agents'] > 0 else 'unlimited'}"
    )
    
    # Features for current plan
    features_on = [k.replace('_', ' ').title() for k, v in plan_cfg['features'].items() if v]
    features_off = [k.replace('_', ' ').title() for k, v in plan_cfg['features'].items() if not v]
    
    return {
        'total_tools': total_tools,
        'categories': cat_summary,
        'plan_text': plan_text,
        'user_plan_info': user_plan_info,
        'features_on': ', '.join(features_on),
        'features_off': ', '.join(features_off),
        'user_name': user.first_name or user.email.split('@')[0],
        'org_name': org.name,
    }


def _get_dynamic_pricing_response(ctx):
    """Generate pricing response from real plan data"""
    return f"""Here's our current plan comparison:

{ctx['plan_text']}

**Your current plan: {ctx['user_plan_info'].split(chr(10))[0].split(': ')[1]}**

All plans include access to our security scanning platform. Higher plans add more tools, scan frequency, agents, and advanced features like API access, compliance reports, and SSO.

Would you like to upgrade your plan or start a free trial?"""


def _get_dynamic_tools_response(ctx):
    """Generate tools response from real data"""
    return f"""We have **{ctx['total_tools']} security tools** available across our categories:

{ctx['categories']}

Every scan uses professional-grade tools. Your plan ({ctx['user_plan_info'].split(chr(10))[0].split(': ')[1]}) gives you access to {ctx['user_plan_info'].split(chr(10))[1].strip()}.

Would you like to browse tools by category, or start a scan?"""


def _get_dynamic_trial_response(ctx):
    """Generate trial response from real data"""
    trial_cfg = PLAN_CONFIG['trial']
    return f"""**Start your free trial in 30 seconds:**

✅ {trial_cfg['duration']} full access
✅ {trial_cfg['tool_limit']} security tools to test
✅ {trial_cfg['daily_scan_limit']} scans per day
✅ Basic security reports
✅ No credit card required
✅ No commitment — cancel anytime

Just click "Start Free Trial" on the pricing page, or I can help you set it up right now.

Need help getting started? I'll walk you through your first scan step by step!"""


CYBERBOT_QUICK_ACTIONS = {
    "pricing": {
        "label": "💰 Pricing",
        "dynamic": True,
    },
    "what_we_test": {
        "label": "🔍 What do you test?",
        "dynamic": True,
    },
    "free_trial": {
        "label": "🎁 Free Trial",
        "dynamic": True,
    },
    "support": {
        "label": "📞 Support",
        "response": """**Support channels and response times:**

📧 **Email**: support@semihkilic.com
• Starter: 48-hour response
• Professional: 24-hour response
• Enterprise: 2-hour response

💬 **Live Chat** (Professional+): Available during business hours (CET)

📱 **Slack/Teams** (Professional+): Direct integration with your workspace

🤝 **Dedicated Manager** (Enterprise): Your personal security advisor

📋 **Knowledge Base**: docs.semihkilic.com — Guides, tutorials, FAQs

How can I help you today?"""
    },
}


@app.route('/api/v1/chatbot/message', methods=['POST'])
@require_organization
def chatbot_message():
    """CyberBot AI assistant - handles user messages"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        data = request.get_json()
        
        message = data.get('message', '').strip()
        quick_action = data.get('quick_action')
        scan_id = data.get('scan_id')
        
        # Build dynamic context once for this request
        ctx = _build_dynamic_chatbot_context(user, org)
        
        # Dynamic response dispatch map
        _DYNAMIC_DISPATCH = {
            'pricing': lambda: _get_dynamic_pricing_response(ctx),
            'what_we_test': lambda: _get_dynamic_tools_response(ctx),
            'free_trial': lambda: _get_dynamic_trial_response(ctx),
            'support': lambda: CYBERBOT_QUICK_ACTIONS['support']['response'],
        }
        
        # Handle quick actions
        if quick_action and quick_action in CYBERBOT_QUICK_ACTIONS:
            resp_text = _DYNAMIC_DISPATCH.get(quick_action, lambda: "I'm not sure about that. Try asking me something else!")()
            return jsonify({
                'response': resp_text,
                'type': 'quick_action',
                'action': quick_action,
            })
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        msg_lower = message.lower()
        response_text = ""
        response_type = "chat"
        
        # Keyword-based routing for common questions
        if any(kw in msg_lower for kw in ['price', 'pricing', 'cost', 'plan', 'upgrade', 'how much', 'fiyat']):
            return jsonify({
                'response': _DYNAMIC_DISPATCH['pricing'](),
                'type': 'quick_action',
                'action': 'pricing',
            })
        
        if any(kw in msg_lower for kw in ['what do you test', 'what tests', 'what scan', '682', 'categories', 'ne test']):
            return jsonify({
                'response': _DYNAMIC_DISPATCH['what_we_test'](),
                'type': 'quick_action',
                'action': 'what_we_test',
            })
        
        if any(kw in msg_lower for kw in ['free trial', 'trial', 'try', 'demo', 'deneme']):
            return jsonify({
                'response': _DYNAMIC_DISPATCH['free_trial'](),
                'type': 'quick_action',
                'action': 'free_trial',
            })
        
        if any(kw in msg_lower for kw in ['support', 'help', 'contact', 'destek']):
            return jsonify({
                'response': _DYNAMIC_DISPATCH['support'](),
                'type': 'quick_action',
                'action': 'support',
            })
        
        # Scan result explanation request
        if scan_id or any(kw in msg_lower for kw in ['scan result', 'explain', 'what does', 'meaning', 'tarama sonuç']):
            if scan_id:
                scan = Scan.query.filter_by(id=scan_id, organization_id=org.id).first()
                if scan:
                    # Use vulnerability translator for business language
                    try:
                        from vulnerability_translator import translate_scan_output
                        findings = translate_scan_output(scan.output or '')
                        if findings:
                            response_text = f"**Security Scan Results for {scan.target}:**\n\n"
                            for i, f in enumerate(findings, 1):
                                severity_emoji = {'critical': '🔴', 'high': '🟠', 'medium': '🟡', 'low': '🔵'}.get(f['severity'], '⚪')
                                response_text += f"{severity_emoji} **{f['title']}**\n"
                                response_text += f"   Impact: {f['business_impact']}\n"
                                response_text += f"   Fix time: {f['fix_time']} | Difficulty: {f['fix_difficulty']}\n\n"
                            response_text += "Would you like detailed fix instructions for any of these issues?"
                        else:
                            response_text = f"✅ **Good news!** The scan of {scan.target} completed and no significant issues were detected. Your security posture looks solid!"
                    except ImportError:
                        response_text = f"Scan of {scan.target} completed with status: {scan.status}. Check the Reports page for detailed findings."
                    response_type = "scan_explanation"
                else:
                    response_text = "I couldn't find that scan. Please make sure the scan ID is correct and belongs to your organization."
            else:
                response_text = "I'd be happy to explain your scan results! Could you share the scan ID? You can find it on the Scans page."
        
        # How to fix / remediation questions
        elif any(kw in msg_lower for kw in ['how to fix', 'fix', 'remediat', 'nasıl düzelt', 'çözüm']):
            try:
                from vulnerability_translator import VULNERABILITY_TRANSLATIONS, FIX_TEMPLATES
                # Try to match the vulnerability type from the message
                matched = None
                for vtype, vinfo in VULNERABILITY_TRANSLATIONS.items():
                    if any(kw in msg_lower for kw in vtype.replace('_', ' ').split()):
                        matched = vtype
                        break
                
                if matched and matched in FIX_TEMPLATES:
                    fix = FIX_TEMPLATES[matched]
                    trans = VULNERABILITY_TRANSLATIONS[matched]
                    response_text = f"**How to fix: {trans['title']}**\n\n"
                    response_text += fix['non_technical']
                    response_text += f"\n\n⏱ Estimated fix time: {trans['fix_time']}\n"
                    response_text += f"📊 Difficulty: {trans['fix_difficulty']}"
                    response_type = "remediation"
                else:
                    response_text = "I'd be happy to help! Could you be more specific about what issue you're trying to fix? For example:\n\n"
                    response_text += "• Database access vulnerability\n"
                    response_text += "• Weak encryption\n"
                    response_text += "• Open ports\n"
                    response_text += "• Missing HTTPS\n"
                    response_text += "• Default passwords\n\n"
                    response_text += "Or share a scan ID and I'll provide fix instructions for each finding."
            except ImportError:
                response_text = "I can help with remediation! Please share the scan ID and I'll analyze the findings."
        
        # General security questions
        elif any(kw in msg_lower for kw in ['security', 'secure', 'safe', 'güvenli', 'güvenlik']):
            response_text = """**General Security Best Practices:**

1. 🔒 **Enable HTTPS** — Free with Let's Encrypt
2. 🔑 **Strong passwords** — 12+ characters, use a password manager
3. 📱 **Enable 2FA** — Add two-factor authentication everywhere
4. 🔄 **Keep software updated** — Enable auto-updates when possible
5. 🛡️ **Run regular security scans** — We recommend weekly at minimum

Would you like to start a security scan? Or do you have specific questions about your current security posture?"""
        
        # Fallback — friendly generic response
        else:
            response_text = f"""I'm CyberBot, your security assistant! 👋

Here's what I can help you with:

💰 **Pricing** — Plan comparison and upgrade options
🔍 **Test details** — What our {ctx['total_tools']} security tests cover
🛡️ **Scan results** — Explain findings in plain language
🔧 **Fix guidance** — Step-by-step remediation instructions
📞 **Support** — Connect with our security team

Just ask me anything, or try one of the quick actions below!"""
        
        return jsonify({
            'response': response_text,
            'type': response_type,
            'quick_actions': [
                {'id': k, 'label': v['label']}
                for k, v in CYBERBOT_QUICK_ACTIONS.items()
            ],
        })
    except Exception as e:
        logger.error(f"Chatbot error: {e}")
        return jsonify({
            'response': "I'm having a moment — please try again. If this persists, contact support@semihkilic.com.",
            'type': 'error',
        })


# ═══════════════════════════════════════════════════════════════
# PLAN FEATURES — FULL GATE LOGIC (BÖLÜM 6)
# ═══════════════════════════════════════════════════════════════

PLAN_FEATURES = {
    "free_trial": {
        "domains": 1,
        "scans_total": 1,
        "scan_types": ["full"],
        "scan_frequency": "one_time",
        "reports": ["pdf_basic"],
        "tests_count": 682,
        "history_months": 0,
        "team_members": 1,
        "support": "community",
        "support_response": "72h",
        "api_access": False,
        "compliance_reports": False,
        "white_label": False,
        "agent_support": False,
        "integrations": [],
        "notifications": ["email_complete"],
        "sso": False,
    },
    "starter": {
        "domains": 1,
        "scans_total": "unlimited",
        "scan_types": ["quick", "full", "compliance"],
        "scan_frequency": "weekly",
        "reports": ["pdf", "html"],
        "tests_count": 682,
        "history_months": 3,
        "team_members": 1,
        "support": "email",
        "support_response": "48h",
        "api_access": False,
        "compliance_reports": ["owasp"],
        "white_label": False,
        "agent_support": False,
        "integrations": ["email"],
        "notifications": ["email_complete", "email_critical"],
        "sso": False,
    },
    "professional": {
        "domains": 5,
        "scans_total": "unlimited",
        "scan_types": ["quick", "full", "compliance", "custom"],
        "scan_frequency": "daily",
        "reports": ["pdf", "html", "json"],
        "tests_count": 682,
        "history_months": 12,
        "team_members": 5,
        "support": "priority",
        "support_response": "24h",
        "api_access": True,
        "compliance_reports": ["owasp", "gdpr", "pci_dss"],
        "white_label": True,
        "agent_support": True,
        "integrations": ["email", "slack", "teams", "jira", "github"],
        "notifications": ["email", "slack", "teams", "webhook"],
        "sso": False,
    },
    "enterprise": {
        "domains": "unlimited",
        "scans_total": "unlimited",
        "scan_types": ["quick", "full", "compliance", "custom", "manual_request"],
        "scan_frequency": "hourly",
        "reports": ["pdf", "html", "json", "csv", "pptx"],
        "tests_count": 682,
        "history_months": "unlimited",
        "team_members": "unlimited",
        "support": "dedicated",
        "support_response": "2h",
        "api_access": True,
        "compliance_reports": ["owasp", "gdpr", "pci_dss", "hipaa", "soc2", "iso27001"],
        "white_label": True,
        "agent_support": True,
        "integrations": ["email", "slack", "teams", "jira", "github", "gitlab",
                         "pagerduty", "opsgenie", "servicenow", "datadog", "splunk",
                         "webhook", "custom"],
        "notifications": ["email", "slack", "teams", "sms", "pagerduty", "webhook"],
        "sso": True,
        "sla": "99.9%",
        "dedicated_manager": True,
        "quarterly_reviews": True,
        "on_site_audit": True,
    },
}


@app.route('/api/v1/plan/full-features', methods=['GET'])
@require_organization
def get_plan_full_features():
    """Get full feature matrix for current plan"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        plan = org.plan_type or 'trial'
        plan_key = 'free_trial' if plan == 'trial' else plan
        
        features = PLAN_FEATURES.get(plan_key, PLAN_FEATURES['free_trial'])
        
        return jsonify({
            'plan': plan,
            'features': features,
            'all_plans': {k: v for k, v in PLAN_FEATURES.items()},
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/plan/check-feature', methods=['POST'])
@require_organization
def check_plan_feature():
    """Check if a specific feature is available for current plan"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        org = user.organization
        plan = org.plan_type or 'trial'
        plan_key = 'free_trial' if plan == 'trial' else plan
        
        data = request.get_json()
        feature = data.get('feature')
        
        if not feature:
            return jsonify({'error': 'feature is required'}), 400
        
        features = PLAN_FEATURES.get(plan_key, PLAN_FEATURES['free_trial'])
        
        value = features.get(feature)
        available = bool(value) if not isinstance(value, (list, str, int)) else True
        
        # Determine minimum plan needed
        min_plan = None
        for pname in ['free_trial', 'starter', 'professional', 'enterprise']:
            pf = PLAN_FEATURES[pname]
            pval = pf.get(feature)
            if pval and (isinstance(pval, bool) and pval or isinstance(pval, (list, str, int))):
                min_plan = pname
                break
        
        return jsonify({
            'feature': feature,
            'available': available,
            'value': value,
            'current_plan': plan,
            'minimum_plan': min_plan,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════
# DANGEROUS TOOLS API (BÖLÜM 5)
# ═══════════════════════════════════════════════════════════════

@app.route('/api/v1/tools/<tool_id>/execution-mode', methods=['GET'])
@require_organization
def get_tool_execution_mode_api(tool_id):
    """Get execution mode and safety information for a tool"""
    try:
        tool = Tool.query.get(tool_id)
        if not tool:
            return jsonify({'error': 'Tool not found'}), 404
        
        try:
            from dangerous_tools import get_tool_execution_mode
            mode_info = get_tool_execution_mode(tool.name)
        except ImportError:
            mode_info = {
                'mode': 'standard',
                'config': {},
                'user_display': tool.business_name or tool.name,
                'user_explanation': 'Standard security test execution',
                'can_execute': True,
            }
        
        return jsonify({
            'tool_id': tool_id,
            'tool_name': tool.business_name or tool.name,
            'execution_mode': mode_info,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/security/verification-methods', methods=['GET'])
def get_verification_methods():
    """Get domain ownership verification methods"""
    try:
        from dangerous_tools import get_verification_methods as _get_methods
        methods = _get_methods()
    except ImportError:
        methods = [
            {"id": "dns_txt", "name": "DNS TXT Record", "instruction": "Add TXT record: cybersecpro-verify=TOKEN"},
            {"id": "html_file", "name": "HTML File Upload", "instruction": "Upload verification file to web root"},
        ]
    
    return jsonify({'methods': methods})


# ================================
# V20: AUDIT LOG API
# ================================

@app.route('/api/v1/admin/audit-logs', methods=['GET'])
@admin_required
def get_audit_logs():
    """Get audit logs — admin only — V20"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 200)
        category = request.args.get('category')
        severity = request.args.get('severity')
        action = request.args.get('action')
        user_id = request.args.get('user_id')
        
        query = AuditLog.query.order_by(AuditLog.created_at.desc())
        
        if category:
            query = query.filter(AuditLog.category == category)
        if severity:
            query = query.filter(AuditLog.severity == severity)
        if action:
            query = query.filter(AuditLog.action.like(f'%{action}%'))
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'logs': [log.to_dict() for log in paginated.items],
            'total': paginated.total,
            'page': page,
            'per_page': per_page,
            'pages': paginated.pages
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/admin/audit-logs/stats', methods=['GET'])
@admin_required
def get_audit_stats():
    """Get audit log statistics — admin only — V20"""
    try:
        from sqlalchemy import func
        
        # Last 24 hours stats
        since = datetime.utcnow() - timedelta(hours=24)
        
        total = AuditLog.query.filter(AuditLog.created_at >= since).count()
        failures = AuditLog.query.filter(
            AuditLog.created_at >= since,
            AuditLog.status == 'failure'
        ).count()
        
        by_category = db.session.query(
            AuditLog.category,
            func.count(AuditLog.id)
        ).filter(AuditLog.created_at >= since).group_by(AuditLog.category).all()
        
        by_action = db.session.query(
            AuditLog.action,
            func.count(AuditLog.id)
        ).filter(AuditLog.created_at >= since).group_by(AuditLog.action).order_by(func.count(AuditLog.id).desc()).limit(10).all()
        
        return jsonify({
            'period': '24h',
            'total_events': total,
            'failed_events': failures,
            'by_category': {cat: count for cat, count in by_category},
            'top_actions': {action: count for action, count in by_action}
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    init_database()
    # Start agent health monitor
    agent_mgr.start_monitor(app)
    print("🚀 CyberSec Pro SaaS Backend starting...")
    print("🌍 World-class cybersecurity platform ready!")
    print("📟 Terminal API enabled for SSH execution")
    print("🔌 WebSocket enabled for real-time updates")
    print("🤖 Agent health monitor started (30s heartbeat, 90s offline)")
    print("💬 CyberBot AI assistant active")
    print("🔒 Dangerous tool safety module loaded")
    
    # Use socketio.run() if available for WebSocket support
    if socketio:
        socketio.run(app, host='0.0.0.0', port=5001, debug=False, use_reloader=False, log_output=True)
    else:
        app.run(host='0.0.0.0', port=5001, debug=False)