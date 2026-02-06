#!/usr/bin/env python3
"""
Database migration to add new scan columns and fix stale data
Run this once after updating the code
"""

from app import app, db, Scan, Tool

def migrate():
    with app.app_context():
        print("🔧 Running scan table migration...")
        
        # Add new columns if they don't exist
        from sqlalchemy import text
        
        try:
            db.session.execute(text("ALTER TABLE scans ADD COLUMN findings JSON"))
            print("  ✅ Added 'findings' column")
        except Exception as e:
            if 'duplicate column' in str(e).lower() or 'already exists' in str(e).lower():
                print("  ⏭️ 'findings' column already exists")
            else:
                print(f"  ⚠️ Error adding 'findings': {e}")
        
        try:
            db.session.execute(text("ALTER TABLE scans ADD COLUMN error_log TEXT"))
            print("  ✅ Added 'error_log' column")
        except Exception as e:
            if 'duplicate column' in str(e).lower() or 'already exists' in str(e).lower():
                print("  ⏭️ 'error_log' column already exists")
            else:
                print(f"  ⚠️ Error adding 'error_log': {e}")
        
        db.session.commit()
        print("  ✅ Schema updated")
        
        # Fix stale running scans
        print("\n🔧 Fixing stale scans...")
        stale_scans = Scan.query.filter(Scan.status.in_(['running', 'pending', 'queued'])).all()
        
        fixed = 0
        for scan in stale_scans:
            scan.status = 'failed'
            scan.error_log = 'Scan interrupted by server restart'
            from datetime import datetime
            scan.completed_at = datetime.utcnow()
            fixed += 1
        
        db.session.commit()
        print(f"  ✅ Fixed {fixed} stale scans")
        
        # Fix scans with invalid tool_id (string names instead of UUIDs)
        print("\n🔧 Fixing tool_id references...")
        
        # Get all tools by name
        tools_by_name = {t.name.lower(): t for t in Tool.query.all()}
        
        all_scans = Scan.query.all()
        fixed_tools = 0
        
        for scan in all_scans:
            # Check if tool_id is a valid UUID by trying to find it
            tool = Tool.query.get(scan.tool_id)
            
            if not tool:
                # Try to match by name
                tool_name = scan.tool_id.lower()
                matched_tool = tools_by_name.get(tool_name)
                
                if matched_tool:
                    print(f"  🔗 Fixing scan {scan.id[:8]}: '{scan.tool_id}' → '{matched_tool.id[:8]}' ({matched_tool.name})")
                    scan.tool_id = matched_tool.id
                    fixed_tools += 1
                else:
                    print(f"  ⚠️ Scan {scan.id[:8]} has unknown tool '{scan.tool_id}'")
        
        db.session.commit()
        print(f"  ✅ Fixed {fixed_tools} tool references")
        
        # Summary
        print("\n📊 Database Status:")
        print(f"  Total scans: {Scan.query.count()}")
        print(f"  Completed: {Scan.query.filter_by(status='completed').count()}")
        print(f"  Failed: {Scan.query.filter_by(status='failed').count()}")
        print(f"  Running: {Scan.query.filter_by(status='running').count()}")
        print(f"  Total tools: {Tool.query.count()}")
        
        print("\n✅ Migration complete!")


if __name__ == '__main__':
    migrate()
