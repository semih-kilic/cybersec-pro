#!/usr/bin/env python3
"""Quick audit: count DB tools, registry entries, installed binaries."""
import sys, os, sqlite3, shutil
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tool_configs import TOOL_REGISTRY, bulk_register_from_db, load_tools_from_system

db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'instance', 'cybersec_saas.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT slug, name, binary_name, category FROM tool WHERE is_active=1').fetchall()
conn.close()

print(f"DB active tools: {len(rows)}")

# Collect all binary names from DB
db_binaries = {}
for r in rows:
    bn = r['binary_name'] or r['slug']
    db_binaries[r['slug']] = bn

# Check installed
installed = 0
missing = []
for slug, binary in sorted(db_binaries.items()):
    if shutil.which(binary):
        installed += 1
    else:
        missing.append(f"{slug} ({binary})")

print(f"Installed binaries: {installed}/{len(db_binaries)}")
print(f"Missing: {len(missing)}")

# Load registry
bulk_register_from_db()
load_tools_from_system()
print(f"TOOL_REGISTRY after load: {len(TOOL_REGISTRY)}")

has_default = sum(1 for c in TOOL_REGISTRY.values() if 'default' in c.profiles)
print(f"With default profile: {has_default}")

# Show first 20 missing
if missing:
    print(f"\nFirst 20 missing binaries:")
    for m in missing[:20]:
        print(f"  - {m}")
