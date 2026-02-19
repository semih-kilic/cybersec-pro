#!/usr/bin/env python3
"""Test scan cancel functionality"""
import requests
import time
import uuid

BASE = 'http://localhost:5001/api/v1'
NMAP_TOOL_ID = '37b372dd-71be-41a1-b5c1-1a5e4fc17e11'

print('🧪 Testing Scan Cancel')

# Create user
uid = str(uuid.uuid4())[:8]
reg = requests.post(f'{BASE}/auth/register', json={
    'email': f'cancel-{uid}@test.com', 'password': 'test123',
    'full_name': 'Cancel Tester', 'organization_name': f'CancelOrg-{uid}'
})
token = reg.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}
print(f'✅ User created')

# Start a long scan (full port range)
print('\n📌 Starting long nmap scan (will take >60s)...')
payload = {
    'tool_id': NMAP_TOOL_ID,
    'target': 'scanme.nmap.org',
    'options': {'ports': '1-10000', 'timing': 'T2'}  # Slow scan
}
resp = requests.post(f'{BASE}/scan/start', headers=headers, json=payload)
scan_id = resp.json().get('scan_id')
print(f'   Scan ID: {scan_id}')

# Wait 5 seconds then cancel
print('\n📌 Waiting 5 seconds before cancel...')
time.sleep(5)

# Check status before cancel
details = requests.get(f'{BASE}/scan/{scan_id}/details', headers=headers)
pre_status = details.json().get('scan', {}).get('status')
print(f'   Status before cancel: {pre_status}')

# Cancel
print('\n📌 Sending cancel request...')
cancel_resp = requests.post(f'{BASE}/scan/{scan_id}/cancel', headers=headers)
print(f'   Cancel response: {cancel_resp.status_code}')
print(f'   {cancel_resp.json()}')

# Check status after cancel
time.sleep(1)
details2 = requests.get(f'{BASE}/scan/{scan_id}/details', headers=headers)
post_status = details2.json().get('scan', {}).get('status')
print(f'   Status after cancel: {post_status}')

if post_status == 'cancelled':
    print('\n✅ CANCEL TEST PASSED!')
else:
    print(f'\n⚠️  Expected "cancelled", got "{post_status}"')
