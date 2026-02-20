#!/usr/bin/env python3
"""V13 DB Migration: Add email verification columns to users table"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app import app, db, User
from sqlalchemy import inspect, text

with app.app_context():
    inspector = inspect(db.engine)
    columns = [c['name'] for c in inspector.get_columns('users')]
    print('Current columns:', columns)
    
    if 'email_verified' not in columns:
        db.session.execute(text('ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 1'))
        print('Added email_verified')
    else:
        print('email_verified already exists')
    
    if 'verification_token' not in columns:
        db.session.execute(text('ALTER TABLE users ADD COLUMN verification_token VARCHAR(100)'))
        print('Added verification_token')
    else:
        print('verification_token already exists')
    
    if 'verification_sent_at' not in columns:
        db.session.execute(text('ALTER TABLE users ADD COLUMN verification_sent_at DATETIME'))
        print('Added verification_sent_at')
    else:
        print('verification_sent_at already exists')
    
    db.session.commit()
    
    # Mark all existing users as verified
    count = User.query.filter(User.email_verified != True).update({User.email_verified: True})
    db.session.commit()
    print(f'Marked {count} existing users as email_verified=True')
    print('DB migration complete!')
