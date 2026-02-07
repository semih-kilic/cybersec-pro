#!/usr/bin/env python3
"""Debug scan data to find output/findings issues"""
import requests
import time
import uuid

BASE = 'http://localhost:5001/api/v1'
NMAP_TOOL_ID = '37b372dd-71be-41a1-b5c1-1a5e4fc17e11'

print('🔍 DEBUG: Scan Output/Findings Issue')
print('=' * 60)

# Create user
uid = str(uuid.uuid4())[:8]
reg = requests.post(f'{BASE}/auth/register', json={
    'email': f'debug-{uid}@test.com', 'password': 'test123',
    'full_name': 'Debugger', 'organization_name': f'DebugOrg-{uid}'
})
token = reg.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}
print(f'User: debug-{uid}@test.com')

# Start scan
print('\n📌 Starting scan to scanme.nmap.org...')
payload = {
    'tool_id': NMAP_TOOL_ID,
    'target': 'scanme.nmap.org',
    'options': {'ports': '22,80', 'timing': 'T4'}
}
resp = requests.post(f'{BASE}/scan/start', headers=headers, json=payload)
if resp.status_code not in [200, 201]:
    print(f'   ❌ Failed: {resp.text[:200]}')
    exit(1)

scan_id = resp.json().get('scan_id')
print(f'   Scan ID: {scan_id}')

# Wait for completion
print('\n📌 Waiting for completion...')
start = time.time()
while time.time() - start < 60:
    details = requests.get(f'{BASE}/scan/{scan_id}/details', headers=headers)
    if details.status_code == 200:
        data = details.json().get('scan', {})
        status = data.get('status')
        if status in ['completed', 'failed', 'timeout']:
            elapsed = time.time() - start
            print(f'   Status: {status} ({elapsed:.1f}s)')
            break
    time.sleep(2)

# Now analyze the data
print('\n🔍 ANALYZING RETURNED DATA:')
print('=' * 60)

# Get full details
details = requests.get(f'{BASE}/scan/{scan_id}/details', headers=headers)
data = details.json().get('scan', {})

print(f"\n1. Basic Info:")
print(f"   scan_id: {data.get('id', 'N/A')[:8]}...")
print(f"   status: {data.get('status')}")
print(f"   tool: {data.get('tool', {}).get('name')}")
print(f"   target: {data.get('target')}")
print(f"   duration: {data.get('duration')}")

print(f"\n2. OUTPUT field:")
output = data.get('output', '')
print(f"   Length: {len(output)} chars")
if output:
    print(f"   First 200 chars: {output[:200]}")
else:
    print("   ❌ EMPTY!")

print(f"\n3. FINDINGS field:")
findings_detail = data.get('findings_detail', [])
print(f"   Type: {type(findings_detail)}")
print(f"   Count: {len(findings_detail)}")
if findings_detail:
    for f in findings_detail[:5]:
        print(f"   - Port {f.get('port')}/{f.get('protocol')}: {f.get('service')} ({f.get('state')})")
else:
    print("   ❌ EMPTY!")

print(f"\n4. FINDINGS_SUMMARY field:")
summary = data.get('findings_summary', {})
print(f"   {summary}")

print(f"\n5. Live Data (if any):")
live_data = data.get('live_data')
if live_data:
    print(f"   output_preview: {live_data.get('output_preview', '')[:100]}")
else:
    print("   No live data (scan completed)")

# Check raw scan record
print(f"\n6. Full scan.findings (raw):")
# Get via alternate endpoint
scan_resp = requests.get(f'{BASE}/scans/{scan_id}', headers=headers)
if scan_resp.status_code == 200:
    raw = scan_resp.json().get('scan', {})
    findings_raw = raw.get('findings_summary', {})
    print(f"   findings_summary: {findings_raw}")
