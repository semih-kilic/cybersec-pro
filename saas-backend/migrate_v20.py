#!/usr/bin/env python3
"""V20 Database Migration: Add MFA columns + Audit Logs table"""
import sqlite3

conn = sqlite3.connect('instance/cybersec_saas.db')
c = conn.cursor()

# Add MFA columns to users table
for col_name, col_def in [
    ('mfa_enabled', 'BOOLEAN DEFAULT 0'),
    ('mfa_secret', 'VARCHAR(32)'),
    ('mfa_backup_codes', 'JSON'),
    ('mfa_enabled_at', 'DATETIME'),
]:
    try:
        c.execute(f'ALTER TABLE users ADD COLUMN {col_name} {col_def}')
        print(f'  Added users.{col_name}')
    except Exception as e:
        print(f'  users.{col_name} already exists')

# Create audit_logs table
c.execute('''CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36),
    user_id VARCHAR(36),
    action VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'system',
    severity VARCHAR(20) DEFAULT 'info',
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    details JSON,
    resource_type VARCHAR(50),
    resource_id VARCHAR(36),
    status VARCHAR(20) DEFAULT 'success',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)''')
print('  audit_logs table created/exists')

c.execute('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)')
c.execute('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)')
c.execute('CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)')
print('  audit_logs indexes created')

conn.commit()
conn.close()
print('V20 Migration complete')
