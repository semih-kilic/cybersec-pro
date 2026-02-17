#!/usr/bin/env python3
"""Diagnose auth issues - inspect DB users and password hashing"""
import sqlite3, os, glob

# Find DB files
db_files = glob.glob('/home/cybersec/cybersec-pro/saas-backend/*.db') + \
           glob.glob('/home/cybersec/cybersec-pro/saas-backend/*.sqlite*') + \
           glob.glob('/home/cybersec/cybersec-pro/saas-backend/instance/*.db')

if not db_files:
    # Search deeper
    for root, dirs, files in os.walk('/home/cybersec/cybersec-pro/saas-backend'):
        for f in files:
            if f.endswith('.db') or f.endswith('.sqlite') or f.endswith('.sqlite3'):
                db_files.append(os.path.join(root, f))

print(f"Found DB files: {db_files}")

for dbf in db_files:
    print(f"\n=== DB: {dbf} ===")
    conn = sqlite3.connect(dbf)
    c = conn.cursor()
    
    c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [r[0] for r in c.fetchall()]
    print(f"Tables: {tables}")
    
    for t in tables:
        if 'user' in t.lower():
            c.execute(f'PRAGMA table_info({t})')
            cols = [r[1] for r in c.fetchall()]
            print(f"\n{t} columns: {cols}")
            c.execute(f'SELECT COUNT(*) FROM {t}')
            print(f"{t} total rows: {c.fetchone()[0]}")
            c.execute(f'SELECT * FROM {t} LIMIT 10')
            rows = c.fetchall()
            for row in rows:
                d = dict(zip(cols, row))
                # Truncate long hash values for readability
                for k, v in d.items():
                    if isinstance(v, str) and len(v) > 80:
                        d[k] = v[:40] + '...' + v[-20:]
                print(f"  {d}")
    
    # Check for organizations table too
    for t in tables:
        if 'org' in t.lower():
            c.execute(f'PRAGMA table_info({t})')
            cols = [r[1] for r in c.fetchall()]
            print(f"\n{t} columns: {cols}")
            c.execute(f'SELECT * FROM {t} LIMIT 10')
            rows = c.fetchall()
            for row in rows:
                print(f"  {dict(zip(cols, row))}")
    
    conn.close()
