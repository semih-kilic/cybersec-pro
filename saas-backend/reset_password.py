#!/usr/bin/env python3
"""Reset password for semihkilic@semihkilic.com"""
import sqlite3
import sys
sys.path.insert(0, '/home/cybersec/cybersec-pro/saas-backend')

from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = '/home/cybersec/cybersec-pro/saas-backend/instance/cybersec_saas.db'
EMAIL = 'semihkilic@semihkilic.com'
NEW_PASSWORD = '***REDACTED_PG_PASSWORD***'

# Generate hash
new_hash = generate_password_hash(NEW_PASSWORD)
print(f"New hash: {new_hash[:50]}...")

# Verify hash works
assert check_password_hash(new_hash, NEW_PASSWORD), "Hash verification failed!"
print("Hash verification: OK")

# Update DB
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Check user exists
c.execute("SELECT id, email, password_hash, role FROM users WHERE email=?", (EMAIL,))
row = c.fetchone()
if not row:
    print(f"ERROR: User {EMAIL} not found!")
    sys.exit(1)

print(f"Found user: {row[1]}, role: {row[3]}")
print(f"Old hash: {row[2][:50]}...")

# Update password
c.execute("UPDATE users SET password_hash=? WHERE email=?", (new_hash, EMAIL))
conn.commit()

# Verify update
c.execute("SELECT password_hash FROM users WHERE email=?", (EMAIL,))
updated_hash = c.fetchone()[0]
assert check_password_hash(updated_hash, NEW_PASSWORD), "Post-update verification failed!"
print(f"\nPassword reset successful!")
print(f"Email: {EMAIL}")
print(f"Password: {NEW_PASSWORD}")
print(f"Verify: {check_password_hash(updated_hash, NEW_PASSWORD)}")

conn.close()
