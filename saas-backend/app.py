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

# Initialize Flask app
app = Flask(__name__)

# Import and register tools API blueprint
try:
    from tools_api import tools_api
    app.register_blueprint(tools_api)
    print("✅ Tools API blueprint registered")
except ImportError as e:
    print(f"⚠️ Tools API not loaded: {e}")

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
CORS(app, origins=['https://semihkilic.com', 'https://app.semihkilic.com', 'http://localhost:3000'])

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
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    role = db.Column(db.String(20), default='user')  # admin, user, viewer
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
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
        
        # Filter tools based on plan
        plan_hierarchy = {'starter': 1, 'professional': 2, 'enterprise': 3}
        user_plan_level = plan_hierarchy.get(org.plan_type, 1)
        
        tools = Tool.query.filter(
            Tool.is_active == True,
            Tool.plan_required.in_(['starter'] if user_plan_level >= 1 else [])
        ).all()
        
        if user_plan_level >= 2:
            tools = Tool.query.filter(
                Tool.is_active == True,
                Tool.plan_required.in_(['starter', 'professional'])
            ).all()
        
        if user_plan_level >= 3:
            tools = Tool.query.filter(Tool.is_active == True).all()
        
        # Group by category
        tools_by_category = {}
        for tool in tools:
            if tool.category not in tools_by_category:
                tools_by_category[tool.category] = []
            tools_by_category[tool.category].append(tool.to_dict())
        
        return jsonify({
            'tools': tools_by_category,
            'total_tools': len(tools),
            'user_plan': org.plan_type
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

# ================================
# ADMIN ROUTES
# ================================

@app.route('/api/v1/admin/stats', methods=['GET'])
@jwt_required()
def admin_stats():
    """Get admin statistics"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        stats = {
            'total_organizations': Organization.query.count(),
            'total_users': User.query.count(),
            'total_scans': Scan.query.count(),
            'active_subscriptions': Subscription.query.filter_by(status='active').count(),
            'tools_available': Tool.query.filter_by(is_active=True).count()
        }
        
        return jsonify({'stats': stats})
        
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