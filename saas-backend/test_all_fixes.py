#!/usr/bin/env python3
"""
Comprehensive test script for CyberSec Pro bug fixes.
Tests: Nmap, Nikto, Gobuster, Rerun
"""
import requests
import time
import json

BASE_URL = 'http://localhost:5001/api/v1'

# First, create a test user and login
def setup_auth():
    """Get authentication token"""
    # Try to login with existing user
    resp = requests.post(f'{BASE_URL}/auth/login', json={
        'email': 'testfix@test.com',
        'password': 'test123'
    })
    
    if resp.status_code == 200:
        return resp.json().get('access_token')
    
    # Register new user
    resp = requests.post(f'{BASE_URL}/auth/register', json={
        'email': 'testfix@test.com',
        'password': 'test123',
        'organization_name': 'Test Fix Org'
    })
    
    if resp.status_code in [200, 201]:
        return resp.json().get('access_token')
    
    print(f"Auth failed: {resp.text}")
    return None

def run_scan(token, tool, target, params=None):
    """Run a scan and wait for completion"""
    headers = {'Authorization': f'Bearer {token}'}
    
    print(f"\n{'='*60}")
    print(f"Testing: {tool} -> {target}")
    print(f"Params: {params}")
    
    resp = requests.post(f'{BASE_URL}/scan/start', 
        headers=headers,
        json={
            'tool': tool,
            'target': target,
            'parameters': params or {}
        }
    )
    
    if resp.status_code != 201:
        print(f"❌ Failed to start scan: {resp.status_code}")
        print(resp.text)
        return None
    
    data = resp.json()
    scan_id = data.get('scan_id')
    command = data.get('command')
    print(f"✓ Started scan {scan_id[:8]}... ")
    print(f"  Command: {command}")
    
    # Wait for completion
    for i in range(60):  # Max 2 minutes
        time.sleep(2)
        status_resp = requests.get(f'{BASE_URL}/scans/{scan_id}', headers=headers)
        if status_resp.status_code == 200:
            status_data = status_resp.json()
            status = status_data.get('status')
            print(f"  [{i*2}s] Status: {status}")
            
            if status in ['completed', 'failed', 'timeout']:
                output = status_data.get('output', '')
                findings = status_data.get('findings', {})
                
                print(f"\n  RESULT:")
                print(f"  - Output length: {len(output)}")
                if isinstance(findings, dict):
                    inner_findings = findings.get('findings', [])
                    print(f"  - Findings count: {len(inner_findings)}")
                    for f in inner_findings[:5]:  # Show first 5
                        print(f"    • {f.get('title') or f.get('service') or f.get('port')}: {f.get('description', '')[:50]}")
                
                return {
                    'scan_id': scan_id,
                    'status': status,
                    'output_length': len(output),
                    'findings_count': len(inner_findings) if isinstance(findings, dict) else 0
                }
    
    print("  ⚠️ Timeout waiting for scan")
    return None

def test_rerun(token, scan_id):
    """Test rerun functionality"""
    print(f"\n{'='*60}")
    print(f"Testing: RERUN of {scan_id[:8]}...")
    
    headers = {'Authorization': f'Bearer {token}'}
    
    resp = requests.post(f'{BASE_URL}/scans/{scan_id}/rerun', headers=headers)
    
    if resp.status_code != 201:
        print(f"❌ Rerun failed: {resp.status_code}")
        print(resp.text)
        return False
    
    data = resp.json()
    new_scan_id = data.get('new_scan_id')
    print(f"✓ Rerun started! New scan: {new_scan_id[:8]}...")
    print(f"  Target: {data.get('target')}")
    print(f"  Tool: {data.get('tool')}")
    
    # Quick check - don't wait for full completion
    time.sleep(3)
    status_resp = requests.get(f'{BASE_URL}/scans/{new_scan_id}', headers=headers)
    if status_resp.status_code == 200:
        status = status_resp.json().get('status')
        print(f"  New scan status: {status}")
        return status == 'running' or status == 'completed'
    
    return False

def main():
    print("="*60)
    print("CyberSec Pro - Comprehensive Bug Fix Test")
    print("="*60)
    
    # Setup auth
    token = setup_auth()
    if not token:
        print("❌ FAILED: Could not authenticate")
        return
    
    print(f"✓ Authenticated")
    
    results = {}
    
    # Test 1: Nmap with frontend-style params
    result = run_scan(token, 'nmap', 'scanme.nmap.org', {
        'Port Range': '22,80,443',
        'Service Version': True,
        'Timing': 'T4 (Aggressive)'
    })
    results['nmap'] = result
    
    # Test 2: Nikto 
    result = run_scan(token, 'nikto', 'testphp.vulnweb.com', {
        'Port': '80',
        'SSL': False
    })
    results['nikto'] = result
    
    # Test 3: Rerun
    if results.get('nmap') and results['nmap'].get('scan_id'):
        rerun_ok = test_rerun(token, results['nmap']['scan_id'])
        results['rerun'] = {'success': rerun_ok}
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for test_name, result in results.items():
        if result:
            if test_name == 'rerun':
                status = '✓ PASS' if result.get('success') else '❌ FAIL'
            else:
                findings = result.get('findings_count', 0)
                if result.get('status') == 'completed' and (findings > 0 or result.get('output_length', 0) > 100):
                    status = f'✓ PASS ({findings} findings)'
                else:
                    status = f'❌ FAIL (status={result.get("status")}, findings={findings})'
        else:
            status = '❌ FAIL (no result)'
        
        print(f"  {test_name}: {status}")

if __name__ == '__main__':
    main()
