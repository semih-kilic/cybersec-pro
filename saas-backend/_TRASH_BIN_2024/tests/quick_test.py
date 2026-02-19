#!/usr/bin/env python3
"""Quick test for scan engine v3"""

import requests
import time
import sys

BASE_URL = "http://localhost:5001"

# Login
print("Logging in...")
res = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
    "email": "semihkilic@semihkilic.com",
    "password": "CyberSecPro2026!"
})

if res.status_code != 200:
    print(f"Login failed: {res.status_code}")
    print(res.json())
    sys.exit(1)

token = res.json()["access_token"]
print(f"✅ Logged in")

# Start a quick nmap scan
print("\n📡 Starting nmap scan on 8.8.8.8...")
res = requests.post(f"{BASE_URL}/api/v1/scan/start",
    headers={"Authorization": f"Bearer {token}"},
    json={
        "tool": "nmap",
        "target": "8.8.8.8",
        "parameters": {
            "ports": "53,80,443",
            "timing": "T4"
        }
    }
)

print(f"Response ({res.status_code}):")
data = res.json()
print(data)

if res.status_code == 201:
    scan_id = data["scan_id"]
    print(f"\n✅ Scan started: {scan_id}")
    
    # Wait and check status
    for i in range(30):  # Check for 60 seconds
        time.sleep(2)
        res = requests.get(f"{BASE_URL}/api/v1/scan/{scan_id}/details",
            headers={"Authorization": f"Bearer {token}"})
        scan = res.json().get("scan", {})
        status = scan.get("status")
        duration = scan.get("duration")
        findings = scan.get("findings_summary", {})
        print(f"   [{i*2}s] Status: {status}, Duration: {duration}, Findings: {findings}")
        
        if status in ("completed", "failed", "timeout"):
            break
    
    print(f"\n📊 Final Status: {status}")
    
    # Get full details
    if status == "completed":
        print("\n📋 Scan Details:")
        print(f"   Tool: {scan.get('tool', {}).get('name')}")
        print(f"   Target: {scan.get('target')}")
        print(f"   Duration: {duration}")
        print(f"   Findings: {findings}")
else:
    print(f"❌ Failed to start scan")
    sys.exit(1)
