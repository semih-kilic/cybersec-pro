#!/usr/bin/env python3
"""
🔓 Emergency Super Admin Unlock Script
Bypasses email verification for founder accounts

Usage: python scripts/unlock_admin.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment
from dotenv import load_dotenv
load_dotenv()

from app import app, db, User

# Super admin emails that should NEVER be locked out
SUPER_ADMIN_EMAILS = [
    'semihkilic@semihkilic.com',
    'semih@semihkilic.com',
    'cybersecpro@semihkilic.com',
    'semihkilictr@gmail.com',
    'admin@cybersecpro.com',
]


def unlock_admin_accounts():
    """Set email_verified=True for all super admin accounts"""
    with app.app_context():
        unlocked = 0
        for email in SUPER_ADMIN_EMAILS:
            user = User.query.filter_by(email=email.lower()).first()
            if user:
                if not user.email_verified:
                    user.email_verified = True
                    user.verification_token = None  # Clear any pending token
                    print(f"✅ UNLOCKED: {user.email}")
                    unlocked += 1
                else:
                    print(f"ℹ️  Already verified: {user.email}")
            else:
                print(f"⚠️  Not found: {email}")
        
        if unlocked > 0:
            db.session.commit()
            print(f"\n🔓 Total accounts unlocked: {unlocked}")
        else:
            print("\n✅ All super admin accounts are already verified!")


def list_all_users():
    """List all users with their verification status"""
    with app.app_context():
        users = User.query.all()
        print(f"\n📋 All Users ({len(users)} total):\n")
        print(f"{'Email':<40} {'Verified':<10} {'Provider':<10} {'Role':<10}")
        print("-" * 70)
        for u in users:
            verified = "✅ Yes" if u.email_verified else "❌ No"
            provider = u.oauth_provider or "email"
            print(f"{u.email:<40} {verified:<10} {provider:<10} {u.role:<10}")


if __name__ == '__main__':
    print("=" * 60)
    print("🔓 CyberSec Pro - Emergency Admin Unlock")
    print("=" * 60)
    
    if len(sys.argv) > 1 and sys.argv[1] == '--list':
        list_all_users()
    else:
        unlock_admin_accounts()
        print("\n💡 Run with --list to see all users")
