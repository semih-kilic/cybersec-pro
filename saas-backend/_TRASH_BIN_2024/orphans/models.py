"""
🛡️ CyberSec Pro SaaS - Enterprise Database Models
World-class cybersecurity platform data models

Author: World's Best Software Engineer
Version: 2.0.0 (Enterprise Edition)
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import uuid
import enum
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, JSON, Enum, ForeignKey, Index, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, validates
from sqlalchemy.dialects.postgresql import UUID
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from flask import current_app

Base = declarative_base()

# Enums
class UserRole(enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"

class PlanType(enum.Enum):
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"

class SubscriptionStatus(enum.Enum):
    ACTIVE = "active"
    CANCELED = "canceled"
    PAST_DUE = "past_due"
    UNPAID = "unpaid"
    TRIALING = "trialing"

class ScanStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"

class ToolCategory(enum.Enum):
    INFORMATION_GATHERING = "information_gathering"
    WEB_APPLICATIONS = "web_applications"
    VULNERABILITY_ANALYSIS = "vulnerability_analysis"
    EXPLOITATION_TOOLS = "exploitation_tools"
    PASSWORD_ATTACKS = "password_attacks"
    WIRELESS_ATTACKS = "wireless_attacks"
    FORENSICS = "forensics"
    REVERSE_ENGINEERING = "reverse_engineering"
    NETWORK_ANALYSIS = "network_analysis"
    SOCIAL_ENGINEERING = "social_engineering"

# Base Model with common fields
class BaseModel(Base):
    __abstract__ = True
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary"""
        result = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            if isinstance(value, datetime):
                result[column.name] = value.isoformat()
            elif isinstance(value, enum.Enum):
                result[column.name] = value.value
            elif isinstance(value, uuid.UUID):
                result[column.name] = str(value)
            else:
                result[column.name] = value
        return result

# Organization Model
class Organization(BaseModel):
    __tablename__ = 'organizations'
    
    name = Column(String(100), nullable=False)
    slug = Column(String(50), unique=True, nullable=False)
    domain = Column(String(100))
    plan_type = Column(Enum(PlanType), default=PlanType.STARTER, nullable=False)
    stripe_customer_id = Column(String(100), unique=True)
    is_active = Column(Boolean, default=True, nullable=False)
    settings = Column(JSON, default=dict)
    
    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="organization", cascade="all, delete-orphan")
    scans = relationship("Scan", back_populates="organization", cascade="all, delete-orphan")
    usage_tracking = relationship("UsageTracking", back_populates="organization", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_org_slug', 'slug'),
        Index('idx_org_stripe_customer', 'stripe_customer_id'),
    )
    
    @validates('slug')
    def validate_slug(self, key, slug):
        """Validate organization slug"""
        if not slug or len(slug) < 3:
            raise ValueError("Slug must be at least 3 characters long")
        return slug.lower()
    
    def get_current_subscription(self) -> Optional['Subscription']:
        """Get current active subscription"""
        return next((sub for sub in self.subscriptions if sub.status == SubscriptionStatus.ACTIVE), None)
    
    def can_create_scan(self) -> bool:
        """Check if organization can create new scan based on plan limits"""
        subscription = self.get_current_subscription()
        if not subscription:
            return False
        
        # Get plan limits
        plan_config = current_app.config['SUBSCRIPTION_PLANS'].get(self.plan_type.value, {})
        max_scans = plan_config.get('features', {}).get('max_scans_per_month', 0)
        
        if max_scans == -1:  # Unlimited
            return True
        
        # Count scans this month
        from sqlalchemy import func, extract
        current_month_scans = len([
            scan for scan in self.scans 
            if scan.created_at.month == datetime.now().month and 
               scan.created_at.year == datetime.now().year
        ])
        
        return current_month_scans < max_scans

# User Model
class User(BaseModel):
    __tablename__ = 'users'
    
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(50))
    last_name = Column(String(50))
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    last_login = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(255))
    reset_token = Column(String(255))
    reset_token_expires = Column(DateTime(timezone=True))
    preferences = Column(JSON, default=dict)
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    scans = relationship("Scan", back_populates="user", cascade="all, delete-orphan")
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_user_email', 'email'),
        Index('idx_user_org', 'organization_id'),
    )
    
    def set_password(self, password: str) -> None:
        """Set user password with secure hashing"""
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256', salt_length=16)
    
    def check_password(self, password: str) -> bool:
        """Check if provided password matches stored hash"""
        return check_password_hash(self.password_hash, password)
    
    def generate_auth_token(self) -> str:
        """Generate JWT authentication token"""
        payload = {
            'user_id': str(self.id),
            'email': self.email,
            'role': self.role.value,
            'org_id': str(self.organization_id),
            'exp': datetime.now(timezone.utc).timestamp() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES'].total_seconds()
        }
        return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')
    
    @staticmethod
    def verify_auth_token(token: str) -> Optional['User']:
        """Verify JWT token and return user"""
        try:
            payload = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            return User.query.get(payload['user_id'])
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    @property
    def full_name(self) -> str:
        """Get user's full name"""
        return f"{self.first_name} {self.last_name}".strip() or self.email
    
    def can_access_tool(self, tool: 'Tool') -> bool:
        """Check if user can access specific tool based on plan"""
        org_plan = self.organization.plan_type.value
        tool_plan = tool.plan_required.value
        
        plan_hierarchy = {'starter': 1, 'professional': 2, 'enterprise': 3}
        return plan_hierarchy.get(org_plan, 0) >= plan_hierarchy.get(tool_plan, 0)

# Subscription Model
class Subscription(BaseModel):
    __tablename__ = 'subscriptions'
    
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    stripe_subscription_id = Column(String(100), unique=True)
    plan_type = Column(Enum(PlanType), nullable=False)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.TRIALING, nullable=False)
    current_period_start = Column(DateTime(timezone=True))
    current_period_end = Column(DateTime(timezone=True))
    trial_end = Column(DateTime(timezone=True))
    canceled_at = Column(DateTime(timezone=True))
    extra_data = Column(JSON, default=dict)
    
    # Relationships
    organization = relationship("Organization", back_populates="subscriptions")
    
    # Indexes
    __table_args__ = (
        Index('idx_sub_org', 'organization_id'),
        Index('idx_sub_stripe', 'stripe_subscription_id'),
        Index('idx_sub_status', 'status'),
    )
    
    @property
    def is_active(self) -> bool:
        """Check if subscription is currently active"""
        return self.status in [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]
    
    @property
    def days_until_renewal(self) -> int:
        """Get days until next renewal"""
        if not self.current_period_end:
            return 0
        delta = self.current_period_end - datetime.now(timezone.utc)
        return max(0, delta.days)

# Tool Model
class Tool(BaseModel):
    __tablename__ = 'tools'
    
    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True)
    category = Column(Enum(ToolCategory), nullable=False)
    description = Column(Text)
    long_description = Column(Text)
    command_template = Column(Text, nullable=False)
    parameters_schema = Column(JSON, default=dict)
    plan_required = Column(Enum(PlanType), default=PlanType.STARTER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    execution_timeout = Column(Integer, default=3600)  # seconds
    docker_image = Column(String(200))
    version = Column(String(50))
    documentation_url = Column(String(500))
    tags = Column(JSON, default=list)
    
    # Relationships
    scans = relationship("Scan", back_populates="tool")
    
    # Indexes
    __table_args__ = (
        Index('idx_tool_category', 'category'),
        Index('idx_tool_plan', 'plan_required'),
        Index('idx_tool_active', 'is_active'),
    )
    
    @validates('slug')
    def validate_slug(self, key, slug):
        """Validate tool slug"""
        if not slug:
            slug = self.name.lower().replace(' ', '-').replace('_', '-')
        return slug.lower()

# Scan Model
class Scan(BaseModel):
    __tablename__ = 'scans'
    
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    tool_id = Column(UUID(as_uuid=True), ForeignKey('tools.id'), nullable=False)
    name = Column(String(200))
    target = Column(String(500), nullable=False)
    parameters = Column(JSON, default=dict)
    status = Column(Enum(ScanStatus), default=ScanStatus.PENDING, nullable=False)
    output = Column(Text)
    error_message = Column(Text)
    report_path = Column(String(500))
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    execution_time = Column(Integer)  # seconds
    extra_data = Column(JSON, default=dict)
    
    # Relationships
    organization = relationship("Organization", back_populates="scans")
    user = relationship("User", back_populates="scans")
    tool = relationship("Tool", back_populates="scans")
    
    # Indexes
    __table_args__ = (
        Index('idx_scan_org', 'organization_id'),
        Index('idx_scan_user', 'user_id'),
        Index('idx_scan_tool', 'tool_id'),
        Index('idx_scan_status', 'status'),
        Index('idx_scan_created', 'created_at'),
    )
    
    @property
    def duration(self) -> Optional[int]:
        """Get scan duration in seconds"""
        if self.started_at and self.completed_at:
            return int((self.completed_at - self.started_at).total_seconds())
        return None
    
    def can_be_canceled(self) -> bool:
        """Check if scan can be canceled"""
        return self.status in [ScanStatus.PENDING, ScanStatus.RUNNING]

# Usage Tracking Model
class UsageTracking(BaseModel):
    __tablename__ = 'usage_tracking'
    
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    tool_id = Column(UUID(as_uuid=True), ForeignKey('tools.id'), nullable=False)
    scan_id = Column(UUID(as_uuid=True), ForeignKey('scans.id'))
    usage_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    execution_time = Column(Integer)  # seconds
    extra_data = Column(JSON, default=dict)
    
    # Relationships
    organization = relationship("Organization", back_populates="usage_tracking")
    
    # Indexes
    __table_args__ = (
        Index('idx_usage_org_date', 'organization_id', 'usage_date'),
        Index('idx_usage_tool', 'tool_id'),
    )

# API Key Model
class APIKey(BaseModel):
    __tablename__ = 'api_keys'
    
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    name = Column(String(100), nullable=False)
    key_hash = Column(String(255), nullable=False, unique=True)
    prefix = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_used = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    permissions = Column(JSON, default=list)
    
    # Relationships
    user = relationship("User", back_populates="api_keys")
    
    # Indexes
    __table_args__ = (
        Index('idx_apikey_user', 'user_id'),
        Index('idx_apikey_prefix', 'prefix'),
    )

# Audit Log Model
class AuditLog(BaseModel):
    __tablename__ = 'audit_logs'
    
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'))
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50))
    resource_id = Column(String(100))
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    details = Column(JSON, default=dict)
    
    # Indexes
    __table_args__ = (
        Index('idx_audit_org', 'organization_id'),
        Index('idx_audit_user', 'user_id'),
        Index('idx_audit_action', 'action'),
        Index('idx_audit_created', 'created_at'),
    )

# System Health Model
class SystemHealth(BaseModel):
    __tablename__ = 'system_health'
    
    service_name = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False)  # healthy, degraded, down
    response_time = Column(Integer)  # milliseconds
    error_rate = Column(Integer)  # percentage
    metrics = Column(JSON, default=dict)
    
    # Indexes
    __table_args__ = (
        Index('idx_health_service', 'service_name'),
        Index('idx_health_status', 'status'),
        Index('idx_health_created', 'created_at'),
    )