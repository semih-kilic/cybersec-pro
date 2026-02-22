#!/usr/bin/env python3
"""Verify a specific user's email in the database"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app import app, db, User

TARGET_EMAIL = 'scsa271@hotmail.com'

with app.app_context():
    user = User.query.filter_by(email=TARGET_EMAIL).first()
    if user:
        print(f'User found: {user.email}')
        print(f'  email_verified: {user.email_verified}')
        print(f'  is_active: {user.is_active}')
        print(f'  verification_token: {user.verification_token}')
        print(f'  created: {user.created_at}')
        if not user.email_verified:
            user.email_verified = True
            db.session.commit()
            print('  >>> FIXED: email_verified set to True')
        else:
            print('  Already verified')
    else:
        print(f'User {TARGET_EMAIL} not found in database')
