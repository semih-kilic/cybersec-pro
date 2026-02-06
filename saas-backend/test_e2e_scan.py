#!/usr/bin/env python3
"""End-to-end test via backend API"""
import requests
import time
import json

BASE = 'http://localhost:5001/api/v1'

print('🧪 Real Scan E2E Test')

# Step 1: Login
print('\n📌 Step 1: Login...')
login = requests.post(f'{BASE}/auth/login', json={'email': 'newuser@test.com', 'password': 'test123'})
print(f'   Login status: {login.status_code}')
if login.status_code != 200:
    # Try test@example.com
    login = requests.post(f'{BASE}/auth/login', json={'email': 'test@example.com', 'password': 'test123'})
    print(f'   Retry test@example.com: {login.status_code}')

if login.status_code != 200:
    # Register new test user with unique identifiers
    import uuid
    uid = str(uuid.uuid4())[:8]
    print(f'   Creating test user (uid={uid})...')
    reg = requests.post(f'{BASE}/auth/register', json={
        'email': f'scantest-{uid}@test.com',
        'password': 'scantest123',
        'full_name': 'Scan Tester',
        'organization_name': f'Test Org {uid}'
    })
    print(f'   Register: {reg.status_code} - {reg.text[:100] if reg.text else ""}')
    login = requests.post(f'{BASE}/auth/login', json={'email': f'scantest-{uid}@test.com', 'password': 'scantest123'})
    print(f'   Login after register: {login.status_code}')

if login.status_code != 200:
    print(f'❌ Cannot login. Response: {login.text[:200]}')
    exit(1)

token = login.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}
print(f'   ✅ Got token: {token[:20]}...')

# Step 2: Skip tool lookup - use known nmap UUID directly
print('\n📌 Step 2: Using known nmap tool ID...')
NMAP_TOOL_ID = '37b372dd-71be-41a1-b5c1-1a5e4fc17e11'
print(f'   ✅ Using nmap tool: {NMAP_TOOL_ID}')

# Step 3: Start scan
print('\n📌 Step 3: Start nmap scan to 8.8.8.8...')
scan_payload = {
    'tool_id': NMAP_TOOL_ID,
    'target': '8.8.8.8',
    'options': {'ports': '53,80,443', 'timing': 'T4'}
}
print(f'   Payload: {json.dumps(scan_payload)}')

scan_resp = requests.post(f'{BASE}/scan/start', headers=headers, json=scan_payload)
print(f'   Start status: {scan_resp.status_code}')

if scan_resp.status_code not in [200, 201]:
    print(f'   ❌ Failed: {scan_resp.text[:300]}')
    exit(1)

scan_data = scan_resp.json()
scan_id = scan_data.get('scan_id')
print(f'   ✅ Scan started: {scan_id}')

# Step 4: Poll for completion
print('\n📌 Step 4: Polling for completion...')
start_time = time.time()
max_wait = 60  # 60 seconds max
while True:
    elapsed = time.time() - start_time
    if elapsed > max_wait:
        print(f'   ⚠️  Timeout after {max_wait}s')
        break

    details = requests.get(f'{BASE}/scan/details/{scan_id}', headers=headers)
    if details.status_code != 200:
        print(f'   ⚠️  Details error: {details.status_code}')
        time.sleep(2)
        continue
    
    dd = details.json()
    status = dd.get('status')
    print(f'   [{int(elapsed)}s] Status: {status}')
    
    if status in ['completed', 'failed', 'cancelled']:
        print(f'\n📌 Step 5: Final Result')
        print(f'   Status: {status}')
        print(f'   Duration: {dd.get("duration")}s')
        print(f'   Tool: {dd.get("tool", {}).get("name", "?")}')
        findings = dd.get('findings', [])
        print(f'   Findings: {len(findings)}')
        if findings:
            for f in findings[:5]:
                print(f'      - Port {f.get("port")}: {f.get("service")} ({f.get("state")})')
        if dd.get('error_log'):
            print(f'   Error: {dd.get("error_log")[:200]}')
        if dd.get('output'):
            print(f'   Output (first 300 chars): {dd.get("output", "")[:300]}')
        break
    
    time.sleep(2)

print('\n✅ E2E Test Complete!')
