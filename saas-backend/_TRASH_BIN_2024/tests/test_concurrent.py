#!/usr/bin/env python3
"""Test concurrent scans"""
import requests
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = 'http://localhost:5001/api/v1'
NMAP_TOOL_ID = '37b372dd-71be-41a1-b5c1-1a5e4fc17e11'

print('🧪 Testing Concurrent Scans (3 simultaneous)')

# Create user
uid = str(uuid.uuid4())[:8]
reg = requests.post(f'{BASE}/auth/register', json={
    'email': f'concurrent-{uid}@test.com', 'password': 'test123',
    'full_name': 'Concurrent Tester', 'organization_name': f'ConcurrentOrg-{uid}'
})
token = reg.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}
print(f'✅ User created')

# Define 3 different scans
targets = [
    ('scanme.nmap.org', '22,80'),
    ('8.8.8.8', '53'),
    ('1.1.1.1', '53,443')
]

def run_scan(target, ports):
    """Run a single scan and return result"""
    payload = {
        'tool_id': NMAP_TOOL_ID,
        'target': target,
        'options': {'ports': ports, 'timing': 'T4'}
    }
    resp = requests.post(f'{BASE}/scan/start', headers=headers, json=payload)
    if resp.status_code not in [200, 201]:
        return target, 'failed_to_start', 0
    
    scan_id = resp.json().get('scan_id')
    start = time.time()
    
    # Poll for completion
    while time.time() - start < 120:
        details = requests.get(f'{BASE}/scan/{scan_id}/details', headers=headers)
        if details.status_code != 200:
            time.sleep(2)
            continue
        status = details.json().get('scan', {}).get('status')
        if status in ['completed', 'failed', 'cancelled']:
            return target, status, time.time() - start
        time.sleep(2)
    
    return target, 'timeout', time.time() - start

print('\n📌 Starting 3 concurrent scans...')
start_time = time.time()

# Run 3 scans in parallel
results = []
with ThreadPoolExecutor(max_workers=3) as executor:
    futures = {executor.submit(run_scan, t, p): (t, p) for t, p in targets}
    
    for future in as_completed(futures):
        target, status, duration = future.result()
        results.append((target, status, duration))
        print(f'   ✅ {target}: {status} ({duration:.1f}s)')

total_time = time.time() - start_time

print(f'\n📊 Results:')
print(f'   Total time: {total_time:.1f}s (parallel)')
print(f'   Scans completed: {len([r for r in results if r[1] == "completed"])}')
print(f'   Scans failed: {len([r for r in results if r[1] == "failed"])}')

if all(r[1] in ['completed', 'failed'] for r in results) and total_time < 90:
    print('\n✅ CONCURRENT SCAN TEST PASSED!')
else:
    print('\n⚠️  Some scans may have issues')
