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
         'https://app.semihkilic.com', 
         'http://localhost:3000',
         'http://localhost:5000'
     ],
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
)

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
    status = db.Column(db.String(20), default='pending')  # pending, running, completed, failed
    output = db.Column(db.Text)
    report_path = db.Column(db.String(255))
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='scans')
    tool = db.relationship('Tool', backref='scans')
    
    def to_dict(self):
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
            'tool': self.tool.to_dict() if self.tool else None
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
            
            plan_hierarchy = {'starter': 1, 'professional': 2, 'enterprise': 3}
            user_plan_level = plan_hierarchy.get(org.plan_type, 0)
            required_plan_level = plan_hierarchy.get(required_plan, 0)
            
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
        
        plan_level = {'trial': 0, 'starter': 1, 'professional': 2, 'team': 3, 'enterprise': 4}
        user_plan_level = plan_level.get(org.plan_type, 0)
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
        plan_hierarchy = {'starter': 1, 'professional': 2, 'enterprise': 3}
        user_plan_level = plan_hierarchy.get(org.plan_type, 0)
        required_plan_level = plan_hierarchy.get(tool.plan_required, 0)
        
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
        
        # Stripe Price IDs from .env
        import os
        STRIPE_PRICES = {
            'starter': os.environ.get('STRIPE_STARTER_PRICE_ID', 'price_1Stbp00ed3IDKXcngS5QHCju'),
            'professional': os.environ.get('STRIPE_PROFESSIONAL_PRICE_ID', 'price_1Stbpv0ed3IDKXcnND1pS9Bj'),
            'team': os.environ.get('STRIPE_PROFESSIONAL_PRICE_ID', 'price_1Stbpv0ed3IDKXcnND1pS9Bj'),  # Use professional price for team
            'enterprise': os.environ.get('STRIPE_ENTERPRISE_PRICE_ID', 'price_1StbqM0ed3IDKXcnEVXJzorf'),
        }
        
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
        
        # Start the actual scan
        result = executor.start_scan(scan_id, tool_id, target, parameters)
        
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
@require_organization
def get_scan_output(scan_id):
    """Get scan output (streaming via SSE)"""
    if not SCAN_EXECUTOR_AVAILABLE:
        return jsonify({'error': 'Scan executor not available'}), 503
    
    from flask import Response
    
    def generate():
        executor = get_executor()
        
        while True:
            line = executor.get_scan_output(scan_id, timeout=1.0)
            
            if line is None:
                # Scan completed
                result = executor.get_scan_result(scan_id)
                if result:
                    yield f"data: {json.dumps({'type': 'complete', 'result': result})}\n\n"
                break
            elif line:
                yield f"data: {json.dumps({'type': 'output', 'line': line})}\n\n"
    
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

@app.route('/api/v1/reports', methods=['GET'])
@require_organization
def get_reports():
    """Get all reports for the organization"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # Get completed scans with results as reports
        scans = Scan.query.filter(
            Scan.organization_id == user.organization_id,
            Scan.status == 'completed',
            Scan.result.isnot(None)
        ).order_by(Scan.created_at.desc()).all()
        
        reports = []
        for scan in scans:
            reports.append({
                'id': scan.id,
                'name': f'{scan.tool_name} Report - {scan.target}',
                'scan_id': scan.id,
                'scan_name': f'{scan.tool_name} scan',
                'target': scan.target,
                'created_at': scan.completed_at.isoformat() if scan.completed_at else scan.created_at.isoformat(),
                'format': 'txt',
                'status': 'ready',
                'findings': {
                    'critical': 0,
                    'high': 0,
                    'medium': 0,
                    'low': 0,
                    'info': 0
                }
            })
        
        return jsonify({
            'reports': reports
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/reports', methods=['POST'])
@require_organization
def create_report():
    """Generate a new report from scan results"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        scan_ids = data.get('scan_ids', [])
        report_name = data.get('name', 'Security Assessment Report')
        report_format = data.get('format', 'json')
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
        
        # Generate report content
        report_content = generate_report_content(scans, report_name, template, sections, report_format)
        
        # Create report record
        report_id = str(uuid.uuid4())
        
        return jsonify({
            'success': True,
            'report': {
                'id': report_id,
                'name': report_name,
                'format': report_format,
                'status': 'ready',
                'content': report_content,
                'created_at': datetime.utcnow().isoformat(),
                'scan_count': len(scans)
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def generate_report_content(scans, report_name, template, sections, output_format):
    """Generate actual report content from scan results"""
    from datetime import datetime
    
    # Collect scan data
    all_findings = []
    scan_summaries = []
    
    for scan in scans:
        scan_summaries.append({
            'tool': scan.tool_name,
            'target': scan.target,
            'status': scan.status,
            'started': scan.started_at.isoformat() if scan.started_at else None,
            'completed': scan.completed_at.isoformat() if scan.completed_at else None,
            'result': scan.result[:1000] if scan.result else 'No output'
        })
    
    if output_format == 'json':
        report = {
            'report_name': report_name,
            'generated_at': datetime.utcnow().isoformat(),
            'template': template,
            'sections': sections,
            'summary': {
                'total_scans': len(scans),
                'targets_scanned': list(set(s.target for s in scans)),
                'tools_used': list(set(s.tool_name for s in scans))
            },
            'scans': scan_summaries,
            'executive_summary': 'This report contains the results of security assessments performed using automated scanning tools.',
            'recommendations': [
                'Review all findings and prioritize based on risk',
                'Implement remediation for critical and high severity issues',
                'Schedule follow-up scans to verify fixes'
            ]
        }
        import json
        return json.dumps(report, indent=2)
    
    elif output_format == 'html':
        html = f'''<!DOCTYPE html>
<html>
<head>
    <title>{report_name}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; background: #1a1a2e; color: #e0e0e0; }}
        h1 {{ color: #367bf0; border-bottom: 2px solid #367bf0; padding-bottom: 10px; }}
        h2 {{ color: #00d4ff; margin-top: 30px; }}
        .scan {{ background: #2a2a4e; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #367bf0; }}
        .meta {{ color: #888; font-size: 0.9em; }}
        pre {{ background: #0a0a12; padding: 15px; border-radius: 5px; overflow-x: auto; }}
        .section {{ margin: 30px 0; }}
    </style>
</head>
<body>
    <h1>🔐 {report_name}</h1>
    <p class="meta">Generated: {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")}</p>
    
    <div class="section">
        <h2>📊 Executive Summary</h2>
        <p>This report contains the results of {len(scans)} security scans performed on {len(set(s.target for s in scans))} target(s).</p>
    </div>
    
    <div class="section">
        <h2>🔍 Scan Results</h2>
'''
        for scan in scan_summaries:
            html += f'''
        <div class="scan">
            <h3>🛠️ {scan['tool']} - {scan['target']}</h3>
            <p class="meta">Status: {scan['status']} | Completed: {scan['completed'] or 'N/A'}</p>
            <pre>{scan['result']}</pre>
        </div>
'''
        
        html += '''
    </div>
    
    <div class="section">
        <h2>📋 Recommendations</h2>
        <ul>
            <li>Review all findings and prioritize based on risk level</li>
            <li>Implement remediation for critical and high severity issues first</li>
            <li>Schedule follow-up scans to verify that fixes are effective</li>
            <li>Document all changes made during remediation</li>
        </ul>
    </div>
</body>
</html>'''
        return html
    
    else:  # PDF/TXT format
        content = f'''
================================================================================
                           {report_name.upper()}
================================================================================
Generated: {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")}
Template: {template}

================================================================================
                           EXECUTIVE SUMMARY
================================================================================
This report contains the results of {len(scans)} security scan(s) performed on 
{len(set(s.target for s in scans))} target(s).

Tools Used: {', '.join(set(s.tool_name for s in scans))}
Targets: {', '.join(set(s.target for s in scans))}

================================================================================
                           SCAN RESULTS
================================================================================
'''
        for i, scan in enumerate(scan_summaries, 1):
            content += f'''
--- Scan {i}: {scan['tool']} ---
Target: {scan['target']}
Status: {scan['status']}
Completed: {scan['completed'] or 'N/A'}

Output:
{scan['result']}

'''
        
        content += '''
================================================================================
                           RECOMMENDATIONS
================================================================================
1. Review all findings and prioritize based on risk level
2. Implement remediation for critical and high severity issues first
3. Schedule follow-up scans to verify that fixes are effective
4. Document all changes made during remediation
5. Update security policies based on findings

================================================================================
                           END OF REPORT
================================================================================
'''
        return content

@app.route('/api/v1/reports/<report_id>/download', methods=['GET'])
@require_organization
def download_report(report_id):
    """Download a report"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        scan = Scan.query.filter_by(
            id=report_id,
            organization_id=user.organization_id
        ).first()
        
        if not scan:
            return jsonify({'error': 'Report not found'}), 404
        
        return jsonify({
            'content': scan.result or 'No results available',
            'filename': f'{scan.tool_name}_{scan.target}_{scan.created_at.strftime("%Y%m%d")}.txt'
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

if __name__ == '__main__':
    init_database()
    print("🚀 CyberSec Pro SaaS Backend starting...")
    print("🌍 World-class cybersecurity platform ready!")
    app.run(host='0.0.0.0', port=5001, debug=True)