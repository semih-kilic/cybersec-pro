#!/usr/bin/env python3
"""
Reset Tools Database - Clean and reload with proper 230 tools
"""
from flask import Flask
from models import db, Tool
from config import Config

def reset_tools():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        # Delete all existing tools
        Tool.query.delete()
        db.session.commit()
        print("✅ All tools deleted")
        
        # Load fresh 230 tools
        from seed_tools import KALI_TOOLS
        
        # Only take first 230 unique tools
        unique_tools = []
        seen_names = set()
        
        for tool in KALI_TOOLS:
            if tool['name'] not in seen_names and len(unique_tools) < 230:
                unique_tools.append(tool)
                seen_names.add(tool['name'])
        
        print(f"🔄 Loading {len(unique_tools)} unique tools...")
        
        for tool_data in unique_tools:
            tool = Tool(**tool_data)
            db.session.add(tool)
        
        db.session.commit()
        
        final_count = Tool.query.count()
        print(f"✅ Database reset complete: {final_count} tools")
        return final_count

if __name__ == "__main__":
    reset_tools()