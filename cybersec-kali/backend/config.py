"""
Configuration settings for CyberSec Professional Backend
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-me')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-me')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    
    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///cybersec.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False
    
    # CORS
    _cors_env = os.getenv('CORS_ORIGINS', '')
    CORS_ORIGINS = [
        origin.strip() for origin in _cors_env.split(',') if origin.strip()
    ] if _cors_env else [
        'http://localhost:5173',
        'http://127.0.0.1:5173'
    ]
    
    # File uploads
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    
    # Security
    BCRYPT_LOG_ROUNDS = 12
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
