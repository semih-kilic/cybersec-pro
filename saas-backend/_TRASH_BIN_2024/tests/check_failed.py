#!/usr/bin/env python3
from app import app, db, Scan
with app.app_context():
    scans = Scan.query.filter(Scan.status == 'failed').order_by(Scan.created_at.desc()).limit(5).all()
    print('Failed scans:')
    for s in scans:
        print(f'  {s.id[:8]}: target={s.target}, tool_id={s.tool_id}')
        print(f'    started={s.started_at}, completed={s.completed_at}')
        if s.tool:
            print(f'    tool.name: {s.tool.name}')
        else:
            print(f'    tool: MISSING')
