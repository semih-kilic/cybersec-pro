#!/usr/bin/env python3
"""
Reset and Initialize CyberSec Database
"""
from flask import Flask
from models import db, User, Tool
from seed_tools import KALI_TOOLS
from config import Config

def main():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        print("🔄 Creating database tables...")
        db.create_all()
        
        print("👤 Creating admin user...")
        if User.query.filter_by(username='admin').first() is None:
            admin = User(username='admin', email='admin@cybersec.local', role='admin')
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()
        else:
            print("   ⚠️  Admin user already exists")
        
        print(f"🛠️  Loading {len(KALI_TOOLS)} Kali Linux tools...")
        for tool_data in KALI_TOOLS:
            tool = Tool(**tool_data)
            db.session.add(tool)
        
        db.session.commit()
        
        print("\n✅ Database initialized successfully!")
        print(f"   📦 Total Tools: {Tool.query.count()}")
        print(f"   👥 Total Users: {User.query.count()}")
        print(f"   🔐 Admin Login: admin / admin123")
        print(f"   🌐 API: http://10.0.0.240:5001/api")

if __name__ == '__main__':
    main()
