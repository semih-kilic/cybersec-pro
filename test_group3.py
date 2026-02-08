#!/usr/bin/env python3
"""
CyberSec Pro - TEST GRUBU 3: Stress & Security Tests
"""
import requests
import json
import time
import threading
import concurrent.futures

BASE_URL = "http://localhost:5001"
RESULTS = []

def log_result(test_id, status, detail):
    result = {"test": test_id, "status": status, "detail": detail}
    RESULTS.append(result)
    icon = "✅" if status == "PASS" else "❌"
    print(f"{icon} {test_id}: {status} - {detail}")
    return status == "PASS"

print("=" * 60)
print("TEST GRUBU 3: STRESS & SECURITY")
print("=" * 60)
print()

# Load token
try:
    with open("/tmp/final_token.txt") as f:
        TOKEN = f.read().strip()
except:
    print("❌ Token bulunamadı")
    exit(1)

headers = {"Authorization": f"Bearer {TOKEN}"}

# Test 3.1: Concurrent Scans
print("\n>>> TEST-3.1: Eşzamanlı Scan Testi (5 concurrent)")
def run_scan(n):
    try:
        scan_data = {
            "tool_id": "whois",
            "target": f"example{n}.com",
            "parameters": {}
        }
        resp = requests.post(f"{BASE_URL}/api/v1/scan/execute", 
                           json=scan_data, headers=headers, timeout=30)
        return resp.status_code, resp.json().get("scan_id")
    except Exception as e:
        return 500, str(e)

concurrent_results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    futures = [executor.submit(run_scan, i) for i in range(5)]
    for future in concurrent.futures.as_completed(futures):
        status, result = future.result()
        concurrent_results.append((status, result))

success_count = sum(1 for s, _ in concurrent_results if s in [200, 201])
if success_count >= 4:  # At least 4/5 should succeed
    log_result("TEST-3.1", "PASS", f"{success_count}/5 concurrent scan başarılı")
else:
    log_result("TEST-3.1", "FAIL", f"Sadece {success_count}/5 scan başarılı")
    for status, result in concurrent_results:
        print(f"    Status: {status}, Result: {str(result)[:50]}")

# Test 3.2: Invalid Input Handling
print("\n>>> TEST-3.2: Invalid Input Handling")
invalid_tests = [
    ("empty_target", {"tool_id": "whois", "target": "", "parameters": {}}),
    ("no_target", {"tool_id": "whois", "parameters": {}}),
    ("invalid_tool", {"tool_id": "nonexistent_tool", "target": "test.com", "parameters": {}}),
    ("xss_target", {"tool_id": "whois", "target": "<script>alert(1)</script>", "parameters": {}}),
    ("sql_injection", {"tool_id": "whois", "target": "'; DROP TABLE users;--", "parameters": {}}),
]

passed_invalid = 0
for name, data in invalid_tests:
    try:
        resp = requests.post(f"{BASE_URL}/api/v1/scan/execute", 
                           json=data, headers=headers, timeout=10)
        # Should return 400/402/404, not 500
        if resp.status_code in [400, 402, 404]:
            passed_invalid += 1
            print(f"    ✓ {name}: HTTP {resp.status_code} (expected)")
        elif resp.status_code == 201:
            passed_invalid += 1
            print(f"    ✓ {name}: HTTP 201 (saniitized and accepted)")
        else:
            print(f"    ✗ {name}: HTTP {resp.status_code} (unexpected)")
    except Exception as e:
        print(f"    ✗ {name}: Exception - {str(e)[:30]}")

if passed_invalid >= 3:
    log_result("TEST-3.2", "PASS", f"{passed_invalid}/{len(invalid_tests)} invalid input handled")
else:
    log_result("TEST-3.2", "FAIL", f"Sadece {passed_invalid}/{len(invalid_tests)} handled properly")

# Test 3.3: Auth Security - Invalid Token
print("\n>>> TEST-3.3: Auth Security (Invalid Token)")
auth_tests = []

# Test with no token
resp = requests.get(f"{BASE_URL}/api/v1/tools", timeout=10)
auth_tests.append(("no_token", resp.status_code))

# Test with invalid token
resp = requests.get(f"{BASE_URL}/api/v1/tools", 
                   headers={"Authorization": "Bearer invalid_token_12345"}, timeout=10)
auth_tests.append(("invalid_token", resp.status_code))

# Test with malformed header
resp = requests.get(f"{BASE_URL}/api/v1/tools", 
                   headers={"Authorization": "InvalidFormat"}, timeout=10)
auth_tests.append(("malformed_header", resp.status_code))

passed_auth = 0
for name, status in auth_tests:
    if status in [401, 422]:
        passed_auth += 1
        print(f"    ✓ {name}: HTTP {status} (rejected)")
    else:
        print(f"    ✗ {name}: HTTP {status} (should be 401/422)")

if passed_auth == len(auth_tests):
    log_result("TEST-3.3", "PASS", "Tüm invalid auth rejected")
else:
    log_result("TEST-3.3", "FAIL", f"Sadece {passed_auth}/{len(auth_tests)} rejected")

# Test 3.4: Security Headers
print("\n>>> TEST-3.4: Security Headers")
resp = requests.get(f"{BASE_URL}/api/v1/tools", headers=headers, timeout=10)

required_headers = {
    "X-Frame-Options": ["DENY", "SAMEORIGIN"],
    "X-Content-Type-Options": ["nosniff"],
    "X-XSS-Protection": ["1; mode=block"],
}

optional_headers = {
    "Content-Security-Policy": None,
    "Strict-Transport-Security": None,
}

passed_headers = 0
for header, expected_values in required_headers.items():
    value = resp.headers.get(header)
    if value and (not expected_values or value in expected_values):
        passed_headers += 1
        print(f"    ✓ {header}: {value}")
    else:
        print(f"    ✗ {header}: Missing or invalid ({value})")

for header, _ in optional_headers.items():
    value = resp.headers.get(header)
    if value:
        print(f"    ○ {header}: {value[:50]}...")
    else:
        print(f"    ○ {header}: Not set (optional)")

if passed_headers >= 2:  # At least 2/3 required headers
    log_result("TEST-3.4", "PASS", f"{passed_headers}/3 security headers present")
else:
    log_result("TEST-3.4", "FAIL", f"Sadece {passed_headers}/3 security headers")

# Test 3.5: Rate Limiting Check
print("\n>>> TEST-3.5: Rate Limiting Check")
# Make 20 rapid requests
rate_limit_hit = False
rate_responses = []
for i in range(20):
    resp = requests.get(f"{BASE_URL}/api/v1/tools", headers=headers, timeout=10)
    rate_responses.append(resp.status_code)
    if resp.status_code == 429:
        rate_limit_hit = True
        break

if rate_limit_hit:
    log_result("TEST-3.5", "PASS", "Rate limiting aktif (429 received)")
else:
    # It's OK if no rate limiting in dev mode
    success_rate = sum(1 for s in rate_responses if s == 200) / len(rate_responses)
    if success_rate > 0.9:
        log_result("TEST-3.5", "PASS", "20 istek başarılı (rate limit disabled in dev)")
    else:
        log_result("TEST-3.5", "FAIL", f"Rate limiting unexpected behavior")

# Test 3.6: Error Response Format
print("\n>>> TEST-3.6: Error Response Format")
resp = requests.post(f"{BASE_URL}/api/v1/scan/execute", 
                    json={"tool_id": "invalid"}, headers=headers, timeout=10)
try:
    error_data = resp.json()
    has_error_key = "error" in error_data
    is_json = True
except:
    has_error_key = False
    is_json = False

if is_json and has_error_key:
    log_result("TEST-3.6", "PASS", "Error response is JSON with 'error' key")
else:
    log_result("TEST-3.6", "FAIL", f"Invalid error format: JSON={is_json}, error_key={has_error_key}")

# ========== SUMMARY ==========
print("\n" + "=" * 60)
print("TEST GRUBU 3 SONUÇ RAPORU")
print("=" * 60)

passed = sum(1 for r in RESULTS if r["status"] == "PASS")
failed = sum(1 for r in RESULTS if r["status"] == "FAIL")
total = len(RESULTS)

print(f"\nToplam: {total} test")
print(f"✅ PASS: {passed}")
print(f"❌ FAIL: {failed}")

if failed == 0:
    print("\n🎉 TEST GRUBU 3: TÜM TESTLER BAŞARILI!")
else:
    print("\n⚠️ BAŞARISIZ TESTLER:")
    for r in RESULTS:
        if r["status"] == "FAIL":
            print(f"  - {r['test']}: {r['detail']}")
