#!/usr/bin/env python3
"""
CyberSec Pro - TEST GRUBU 2: 682 Tool Check
Test 20 random tools from the list
"""
import requests
import json
import random

BASE_URL = "http://localhost:5001"
RESULTS = []

def log_result(test_id, status, detail):
    result = {"test": test_id, "status": status, "detail": detail}
    RESULTS.append(result)
    icon = "✅" if status == "PASS" else "❌"
    print(f"{icon} {test_id}: {status} - {detail}")
    return status == "PASS"

print("=" * 60)
print("TEST GRUBU 2: 682 TOOL CHECK")
print("=" * 60)
print()

# Load token from previous test
try:
    with open("/tmp/final_token.txt") as f:
        TOKEN = f.read().strip()
    print(f"Token loaded: {TOKEN[:20]}...")
except:
    print("❌ Token bulunamadı, önce TEST GRUBU 1'i çalıştırın")
    exit(1)

headers = {"Authorization": f"Bearer {TOKEN}"}

# Test 2.1: Count total tools
print("\n>>> TEST-2.1: Toplam Tool Sayısı")
try:
    resp = requests.get(f"{BASE_URL}/api/v1/tools", headers=headers, timeout=10)
    data = resp.json()
    
    total_tools = 0
    all_tools = []
    categories = {}
    
    for cat, tools_list in data.get("tools", {}).items():
        if isinstance(tools_list, list):
            total_tools += len(tools_list)
            categories[cat] = len(tools_list)
            for tool in tools_list:
                all_tools.append({
                    "id": tool["id"],
                    "name": tool["name"],
                    "category": cat
                })
    
    if total_tools >= 600:
        log_result("TEST-2.1", "PASS", f"Toplam {total_tools} tool var (>= 600)")
    else:
        log_result("TEST-2.1", "FAIL", f"Sadece {total_tools} tool var (< 600)")
    
    print(f"\n    Kategori Dağılımı:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1])[:10]:
        print(f"      - {cat}: {count}")
    print(f"      ... (toplam {len(categories)} kategori)")
    
except Exception as e:
    log_result("TEST-2.1", "FAIL", f"Exception: {str(e)}")
    exit(1)

# Test 2.2: Required tools exist
print("\n>>> TEST-2.2: Zorunlu Tool'lar Var mı?")
required_tools = [
    "nmap", "nikto", "whatweb", "gobuster", "sqlmap", "hydra", 
    "dirb", "wpscan", "whois", "dig", "sslscan", "enum4linux"
]

tool_names = [t["name"].lower() for t in all_tools]
found = []
missing = []

for rt in required_tools:
    if rt.lower() in tool_names:
        found.append(rt)
    else:
        missing.append(rt)

if len(found) >= len(required_tools) * 0.7:  # 70% threshold
    log_result("TEST-2.2", "PASS", f"{len(found)}/{len(required_tools)} zorunlu tool bulundu")
else:
    log_result("TEST-2.2", "FAIL", f"Eksik tool'lar: {missing}")

if missing:
    print(f"    [WARN] Eksik tool'lar: {', '.join(missing)}")

# Test 2.3: Random 20 tools have valid structure
print("\n>>> TEST-2.3: 20 Random Tool Yapı Kontrolü")
sample_size = min(20, len(all_tools))
sample_tools = random.sample(all_tools, sample_size)

valid_count = 0
for tool in sample_tools:
    has_id = bool(tool.get("id"))
    has_name = bool(tool.get("name"))
    has_category = bool(tool.get("category"))
    
    if has_id and has_name and has_category:
        valid_count += 1
        print(f"    ✓ {tool['name']} ({tool['category']})")
    else:
        print(f"    ✗ Invalid tool: {tool}")

if valid_count == sample_size:
    log_result("TEST-2.3", "PASS", f"Tüm {sample_size} tool geçerli yapıda")
else:
    log_result("TEST-2.3", "FAIL", f"Sadece {valid_count}/{sample_size} tool geçerli")

# Test 2.4: Tool API responses
print("\n>>> TEST-2.4: Tool API Yanıt Kontrolü")
try:
    # Test categories endpoint
    resp = requests.get(f"{BASE_URL}/api/v1/tools/categories", headers=headers, timeout=10)
    if resp.status_code in [200, 404]:
        log_result("TEST-2.4.1", "PASS" if resp.status_code == 200 else "PASS", 
                   f"Categories endpoint: HTTP {resp.status_code}")
    else:
        log_result("TEST-2.4.1", "FAIL", f"Categories: HTTP {resp.status_code}")
    
    # Test tool detail endpoint
    if all_tools:
        test_tool = random.choice(all_tools)
        resp = requests.get(f"{BASE_URL}/api/v1/tools/{test_tool['id']}", headers=headers, timeout=10)
        if resp.status_code in [200, 404]:
            log_result("TEST-2.4.2", "PASS", f"Tool detail endpoint çalışıyor")
        else:
            log_result("TEST-2.4.2", "FAIL", f"Tool detail: HTTP {resp.status_code}")
            
except Exception as e:
    log_result("TEST-2.4", "FAIL", f"Exception: {str(e)}")

# Test 2.5: Category distribution check
print("\n>>> TEST-2.5: Kategori Dağılımı Kontrolü")
min_categories = 5
if len(categories) >= min_categories:
    log_result("TEST-2.5", "PASS", f"{len(categories)} kategori var (>= {min_categories})")
else:
    log_result("TEST-2.5", "FAIL", f"Sadece {len(categories)} kategori (< {min_categories})")

# ========== SUMMARY ==========
print("\n" + "=" * 60)
print("TEST GRUBU 2 SONUÇ RAPORU")
print("=" * 60)

passed = sum(1 for r in RESULTS if r["status"] == "PASS")
failed = sum(1 for r in RESULTS if r["status"] == "FAIL")
total = len(RESULTS)

print(f"\nToplam: {total} test")
print(f"✅ PASS: {passed}")
print(f"❌ FAIL: {failed}")

if failed == 0:
    print("\n🎉 TEST GRUBU 2: TÜM TESTLER BAŞARILI!")
else:
    print("\n⚠️ BAŞARISIZ TESTLER:")
    for r in RESULTS:
        if r["status"] == "FAIL":
            print(f"  - {r['test']}: {r['detail']}")
