#!/usr/bin/env python3
"""Check what's actually in the database for latest scans"""
import sqlite3
import json

db_path = '/home/cybersec/cybersec-pro/saas-backend/instance/cybersec_saas.db'

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Latest 5 scans from DB:")
print("=" * 60)

cursor.execute('''
    SELECT id, target, status, 
           LENGTH(output) as output_len,
           findings,
           created_at
    FROM scans 
    ORDER BY created_at DESC 
    LIMIT 5
''')

for row in cursor.fetchall():
    scan_id, target, status, output_len, findings, created_at = row
    print(f"\nScan: {scan_id[:8]}...")
    print(f"  Target: {target}")
    print(f"  Status: {status}")
    print(f"  Output length: {output_len or 0} chars")
    print(f"  Findings type: {type(findings)}")
    
    if findings:
        try:
            # SQLite stores JSON as TEXT, parse it
            if isinstance(findings, str):
                findings_data = json.loads(findings)
            else:
                findings_data = findings
            
            print(f"  Findings keys: {list(findings_data.keys()) if isinstance(findings_data, dict) else 'not a dict'}")
            
            # Check for the 'findings' key inside
            if isinstance(findings_data, dict):
                inner_findings = findings_data.get('findings', [])
                print(f"  Inner findings count: {len(inner_findings)}")
                if inner_findings:
                    print(f"  First finding: {inner_findings[0]}")
                
                summary = findings_data.get('summary', {})
                print(f"  Summary: {summary}")
        except Exception as e:
            print(f"  Parse error: {e}")
            print(f"  Raw: {str(findings)[:200]}")
    else:
        print("  Findings: NULL/EMPTY")

conn.close()
