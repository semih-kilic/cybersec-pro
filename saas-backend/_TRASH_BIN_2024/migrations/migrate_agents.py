#!/usr/bin/env python3
"""Migrate agents table: add 5 network mode columns"""
import sqlite3, os

DB = os.path.join(os.path.dirname(__file__), 'instance', 'cybersec_saas.db')
conn = sqlite3.connect(DB)
cur = conn.cursor()
existing = {row[1] for row in cur.execute('PRAGMA table_info(agents)')}

new_cols = [
    ('vpn_config_path', 'VARCHAR(255)'),
    ('vpn_status', "VARCHAR(20) DEFAULT 'disconnected'"),
    ('vpn_assigned_ip', 'VARCHAR(45)'),
    ('proxy_endpoint', 'VARCHAR(255)'),
    ('proxy_api_key', 'VARCHAR(200)'),
    ('proxy_protocol', "VARCHAR(20) DEFAULT 'https'"),
    ('agent_websocket_id', 'VARCHAR(100)'),
    ('agent_capabilities', 'JSON'),
    ('agent_docker_enabled', 'BOOLEAN DEFAULT FALSE'),
    ('auto_update', 'BOOLEAN DEFAULT TRUE'),
    ('max_concurrent_scans', 'INTEGER DEFAULT 5'),
    ('network_zone', "VARCHAR(50) DEFAULT 'public'"),
]

for col, typ in new_cols:
    if col not in existing:
        cur.execute(f'ALTER TABLE agents ADD COLUMN {col} {typ}')
        print(f'  + Added: {col}')
    else:
        print(f'  = Exists: {col}')

conn.commit()
conn.close()
print('Agent migration done.')
