#!/usr/bin/env python3
"""Clean E2E test using only HTTP requests"""
import requests
import time
import json
import uuid

BASE = 'http://localhost:5001/api/v1'
NMAP_TOOL_ID = '37b372dd-71be-41a1-b5c1-1a5e4fc17e11'

print('🧪 Clean E2E Scan Test')

# Create unique user
uid = str(uuid.uuid4())[:8]
email = f'test-{uid}@e2e.com'
password = 'test123'

print(f'\n📌 Step 1: Register user ({email})...')
reg = requests.post(f'{BASE}/auth/register', json={
    'email': email,
    'password': password,
    'full_name': 'E2E Tester',
    'organization_name': f'TestOrg-{uid}'
})
print(f'   Register: {reg.status_code}')

if reg.status_code != 201:
    print(f'   ❌ Register failed: {reg.text[:100]}')
    exit(1)

token = reg.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}
print(f'   ✅ Token: {token[:30]}...')

print(f'\n📌 Step 2: Start nmap scan...')
payload = {
    'tool_id': NMAP_TOOL_ID,
    'target': '8.8.8.8',
    'options': {'ports': '53,80,443', 'timing': 'T4'}
}
scan = requests.post(f'{BASE}/scan/start', headers=headers, json=payload)
print(f'   Status: {scan.status_code}')
print(f'   Response: {scan.text[:200]}')

if scan.status_code not in [200, 201]:
    print(f'   ❌ Scan start failed!')
    exit(1)

scan_data = scan.json()
scan_id = scan_data.get('scan_id')
print(f'   ✅ Scan started: {scan_id}')
print(f'   Command: {scan_data.get("command")}')

print(f'\n📌 Step 3: Polling (max 90s)...')
start_time = time.time()
max_wait = 90
final_status = None

while True:
    elapsed = time.time() - start_time
    if elapsed > max_wait:
        print(f'   ⏰ Timeout after {max_wait}s')
        break

    details = requests.get(f'{BASE}/scan/{scan_id}/details', headers=headers)
    if details.status_code != 200:
        print(f'   ⚠️  Details error: {details.status_code} - {details.text[:100]}')
        time.sleep(3)
        continue
    
    dd = details.json()
    if 'scan' in dd:
        dd = dd['scan']  # Unwrap scan object
    status = dd.get('status')
    
    if status != final_status:
        final_status = status
        print(f'   [{int(elapsed)}s] Status: {status}')
    
    if status in ['completed', 'failed', 'cancelled']:
        print(f'\n📊 Final Result:')
        print(f'   Status: {status}')
        print(f'   Duration: {dd.get("duration")}s')
        print(f'   Tool: {dd.get("tool", {}).get("name") if dd.get("tool") else "N/A"}')
        
        findings = dd.get('findings', [])
        print(f'   Findings: {len(findings)}')
        for f in findings[:5]:
            print(f'      - Port {f.get("port")}/{f.get("protocol")}: {f.get("service")} ({f.get("state")})')
        
        if dd.get('error_log'):
            print(f'   Error: {dd.get("error_log")[:200]}')
        
        output = dd.get('output', '')
        if output:
            print(f'   Output preview: {output[:300]}...')
        
        if status == 'completed' and len(findings) > 0:
            print('\n✅ SUCCESS! Scan completed with findings!')
        elif status == 'completed':
            print('\n⚠️  Scan completed but no findings parsed')
        else:
            print(f'\n⚠️  Scan ended with status: {status}')
        break
    
    time.sleep(2)

print('\n📌 Test Complete!')
