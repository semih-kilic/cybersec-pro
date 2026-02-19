"""
🛡️ CyberSec Pro SaaS - Enterprise Configuration
World-class cybersecurity platform configuration management

Author: World's Best Software Engineer
Version: 2.0.0 (Enterprise Edition)
"""

import os
from datetime import timedelta
from typing import Dict, Any

class Config:
    """Base configuration class"""
    
    # Core Application Settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'cybersec-pro-enterprise-2026-' + os.urandom(32).hex()
    
    # Database Configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'postgresql://cybersec_user:cybersec_pass@localhost/cybersec_pro'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 20,
        'pool_recycle': 3600,
        'pool_pre_ping': True,
        'max_overflow': 30
    }
    
    # JWT Configuration
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-enterprise-' + os.urandom(32).hex()
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # Redis Configuration
    REDIS_URL = os.environ.get('REDIS_URL') or 'redis://localhost:6379/0'
    
    # Celery Configuration
    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL') or 'redis://localhost:6379/1'
    CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND') or 'redis://localhost:6379/2'
    
    # Stripe Configuration
    STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY')
    STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY')
    STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
    
    # Email Configuration
    MAIL_SERVER = os.environ.get('MAIL_SERVER') or 'smtp.sendgrid.net'
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 587)
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER') or 'noreply@semihkilic.com'
    
    # Security Configuration
    BCRYPT_LOG_ROUNDS = 13
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = None
    
    # Rate Limiting
    RATELIMIT_STORAGE_URL = os.environ.get('REDIS_URL') or 'redis://localhost:6379/3'
    RATELIMIT_DEFAULT = "1000 per hour"
    
    # File Upload Configuration
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER') or '/var/uploads/cybersec-pro'
    
    # Logging Configuration
    LOG_LEVEL = os.environ.get('LOG_LEVEL') or 'INFO'
    LOG_FILE = os.environ.get('LOG_FILE') or '/var/log/cybersec-pro/app.log'
    
    # Monitoring & Analytics
    SENTRY_DSN = os.environ.get('SENTRY_DSN')
    GOOGLE_ANALYTICS_ID = os.environ.get('GOOGLE_ANALYTICS_ID')
    
    # API Configuration
    API_TITLE = 'CyberSec Pro Enterprise API'
    API_VERSION = 'v2.0'
    OPENAPI_VERSION = '3.0.2'
    OPENAPI_URL_PREFIX = '/api/docs'
    OPENAPI_SWAGGER_UI_PATH = '/swagger'
    OPENAPI_SWAGGER_UI_URL = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist/'
    
    # Security Tools Configuration
    TOOLS_EXECUTION_TIMEOUT = 3600  # 1 hour
    MAX_CONCURRENT_SCANS = 10
    SCAN_RESULTS_RETENTION_DAYS = 90
    
    # Subscription Plans
    SUBSCRIPTION_PLANS = {
        'starter': {
            'name': 'Starter',
            'price': 29,
            'currency': 'usd',
            'interval': 'month',
            'features': {
                'max_scans_per_month': 50,
                'max_users': 1,
                'tools_access': 'basic',
                'support': 'email',
                'api_access': False,
                'custom_reports': False
            }
        },
        'professional': {
            'name': 'Professional',
            'price': 79,
            'currency': 'usd',
            'interval': 'month',
            'features': {
                'max_scans_per_month': 500,
                'max_users': 5,
                'tools_access': 'advanced',
                'support': 'priority',
                'api_access': True,
                'custom_reports': True
            }
        },
        'enterprise': {
            'name': 'Enterprise',
            'price': 199,
            'currency': 'usd',
            'interval': 'month',
            'features': {
                'max_scans_per_month': -1,  # Unlimited
                'max_users': -1,  # Unlimited
                'tools_access': 'full',
                'support': 'dedicated',
                'api_access': True,
                'custom_reports': True,
                'sla': True,
                'custom_integrations': True
            }
        }
    }

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('DEV_DATABASE_URL') or 'sqlite:///cybersec_dev.db'

class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    
    # Enhanced security for production
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Force HTTPS
    PREFERRED_URL_SCHEME = 'https'
    
    # Enhanced logging
    LOG_LEVEL = 'WARNING'

class StagingConfig(Config):
    """Staging configuration"""
    DEBUG = False
    TESTING = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('STAGING_DATABASE_URL')

# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'staging': StagingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

def get_config() -> Config:
    """Get configuration based on environment"""
    env = os.environ.get('FLASK_ENV', 'development')
    return config.get(env, config['default'])