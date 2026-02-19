#!/usr/bin/env python3
"""Debug script to check scan and tool data"""

from app import app, db, Scan, Tool

with app.app_context():
    print('=== TOOLS TABLE ===')
    tools = Tool.query.limit(5).all()
    for t in tools:
        print(f'  ID: {t.id[:8]}... | Name: {t.name} | Plan: {t.plan_required}')
    
    print(f'  Total tools: {Tool.query.count()}')
    print()
    
    print('=== SCANS TABLE ===')
    scans = Scan.query.order_by(Scan.created_at.desc()).limit(6).all()
    for s in scans:
        tool = Tool.query.get(s.tool_id)
        tool_name = tool.name if tool else f'NOT FOUND: {s.tool_id}'
        print(f'  ID: {s.id[:8]} | Target: {s.target} | Status: {s.status}')
        print(f'       Tool: {tool_name}')
        print(f'       Output: {s.output[:100] if s.output else "None"}...')
        print()
