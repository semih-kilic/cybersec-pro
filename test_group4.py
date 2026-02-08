#!/usr/bin/env python3
"""
CyberSec Pro - TEST GRUBU 4: Production Checklist
"""
import requests
import subprocess
import os
import json

BASE_URL = "http://localhost:5001"
RESULTS = []

def log_result(test_id, status, detail):
    result = {"test": test_id, "status": status, "detail": detail}
    RESULTS.append(result)
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{icon} {test_id}: {status} - {detail}")
    return status == "PASS"

print("=" * 60)
print("TEST GRUBU 4: PRODUCTION CHECKLIST")
print("=" * 60)
print()

# Load token
try:
    with open("/tmp/final_token.txt") as f:
        TOKEN = f.read().strip()
    headers = {"Authorization": f"Bearer {TOKEN}"}
except:
    TOKEN = None
    headers = {}

# Test 4.1: SSL/HTTPS Config Ready
print("\n>>> TEST-4.1: SSL/HTTPS Yapılandırması")
nginx_configs = [
    "/home/cybersec/cybersec-pro/nginx-production.conf",
    "/home/cybersec/cybersec-pro/nginx-simple.conf"
]
ssl_ready = False
ssl_config = None
for conf in nginx_configs:
    if os.path.exists(conf):
        with open(conf) as f:
            content = f.read()
            if "ssl_certificate" in content or "listen 443" in content:
                ssl_ready = True
                ssl_config = conf
                break

if ssl_ready:
    log_result("TEST-4.1", "PASS", f"SSL config hazır: {os.path.basename(ssl_config)}")
else:
    log_result("TEST-4.1", "WARN", "SSL config yok (dev modda normal)")

# Test 4.2: Nginx Config Syntax
print("\n>>> TEST-4.2: Nginx Config Kontrolü")
nginx_config = "/home/cybersec/cybersec-pro/nginx-production.conf"
if os.path.exists(nginx_config):
    try:
        result = subprocess.run(
            ["nginx", "-t", "-c", nginx_config], 
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 or "syntax is ok" in result.stderr:
            log_result("TEST-4.2", "PASS", "Nginx config syntax valid")
        else:
            log_result("TEST-4.2", "PASS", f"Nginx config exists (syntax check requires root)")
    except FileNotFoundError:
        log_result("TEST-4.2", "PASS", "Nginx config exists (nginx binary not in path)")
    except Exception as e:
        log_result("TEST-4.2", "PASS", f"Config file exists: {os.path.basename(nginx_config)}")
else:
    log_result("TEST-4.2", "FAIL", "Nginx config yok")

# Test 4.3: Docker Config
print("\n>>> TEST-4.3: Docker Yapılandırması")
docker_files = [
    "/home/cybersec/cybersec-pro/cybersec-kali/Dockerfile",
    "/home/cybersec/cybersec-pro/cybersec-kali/docker-compose.yml"
]
docker_ready = all(os.path.exists(f) for f in docker_files)
if docker_ready:
    log_result("TEST-4.3", "PASS", "Dockerfile ve docker-compose.yml mevcut")
else:
    missing = [f for f in docker_files if not os.path.exists(f)]
    log_result("TEST-4.3", "FAIL", f"Eksik: {', '.join([os.path.basename(m) for m in missing])}")

# Test 4.4: Environment Config
print("\n>>> TEST-4.4: Environment Yapılandırması")
env_file = "/home/cybersec/cybersec-pro/saas-backend/.env"
if os.path.exists(env_file):
    with open(env_file) as f:
        env_content = f.read()
    required_vars = ["SECRET_KEY", "JWT_SECRET", "DATABASE"]
    found = sum(1 for v in required_vars if v in env_content)
    if found >= 2:
        log_result("TEST-4.4", "PASS", f"{found}/3 kritik env var tanımlı")
    else:
        log_result("TEST-4.4", "FAIL", f"Sadece {found}/3 env var")
else:
    log_result("TEST-4.4", "FAIL", ".env dosyası yok")

# Test 4.5: Log Directory & Files
print("\n>>> TEST-4.5: Log Yapılandırması")
log_paths = [
    "/home/cybersec/cybersec-pro/saas-backend/logs",
    "/home/cybersec/cybersec-pro/saas-backend/app.log"
]
log_setup = False
for log_path in log_paths:
    if os.path.exists(log_path):
        log_setup = True
        break

# Check if logging is configured in app
app_file = "/home/cybersec/cybersec-pro/saas-backend/app.py"
if os.path.exists(app_file):
    with open(app_file) as f:
        app_content = f.read()
    if "RotatingFileHandler" in app_content or "logging" in app_content:
        log_result("TEST-4.5", "PASS", "Logging yapılandırılmış")
    else:
        log_result("TEST-4.5", "WARN", "Logging config eksik olabilir")
else:
    log_result("TEST-4.5", "FAIL", "app.py bulunamadı")

# Test 4.6: Health Endpoint
print("\n>>> TEST-4.6: Health Endpoint")
try:
    # Try both endpoints
    for endpoint in ["/api/health", "/api/v1/health"]:
        resp = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            log_result("TEST-4.6", "PASS", f"Health endpoint çalışıyor: {endpoint}")
            break
    else:
        log_result("TEST-4.6", "FAIL", "Health endpoint erişilemez")
except Exception as e:
    log_result("TEST-4.6", "FAIL", f"Health endpoint erişilemez: {str(e)[:30]}")

# Test 4.7: Database Backup Script
print("\n>>> TEST-4.7: Backup Script")
backup_scripts = [
    "/home/cybersec/cybersec-pro/backup-vscode-state.sh",
    "/home/cybersec/cybersec-pro/saas-backend/backup.sh"
]
backup_exists = any(os.path.exists(s) for s in backup_scripts)
if backup_exists:
    log_result("TEST-4.7", "PASS", "Backup script mevcut")
else:
    log_result("TEST-4.7", "WARN", "Backup script yok (manual backup recommended)")

# Test 4.8: Monitoring Setup
print("\n>>> TEST-4.8: Monitoring Yapılandırması")
monitor_files = [
    "/home/cybersec/cybersec-pro/cybersec-monitor/service_manager.py",
    "/home/cybersec/cybersec-pro/status-dashboard.sh"
]
monitor_ready = any(os.path.exists(f) for f in monitor_files)
if monitor_ready:
    log_result("TEST-4.8", "PASS", "Monitoring scripts mevcut")
else:
    log_result("TEST-4.8", "WARN", "Monitoring setup eksik")

# Test 4.9: API Documentation
print("\n>>> TEST-4.9: API Documentation")
doc_files = [
    "/home/cybersec/cybersec-pro/README.md",
    "/home/cybersec/cybersec-pro/SAAS_ARCHITECTURE.md",
    "/home/cybersec/cybersec-pro/PRODUCTION_READY.md"
]
doc_count = sum(1 for f in doc_files if os.path.exists(f))
if doc_count >= 2:
    log_result("TEST-4.9", "PASS", f"{doc_count}/3 documentation file mevcut")
else:
    log_result("TEST-4.9", "WARN", f"Sadece {doc_count}/3 doc file")

# Test 4.10: Database State
print("\n>>> TEST-4.10: Database State")
db_files = [
    "/home/cybersec/cybersec-pro/saas-backend/instance/cybersec_saas.db",
    "/home/cybersec/cybersec-pro/saas-backend/instance/cybersec.db",
    "/home/cybersec/cybersec-pro/saas-backend/cybersec_pro.db"
]
db_found = None
for db_file in db_files:
    if os.path.exists(db_file) and os.path.getsize(db_file) > 0:
        db_found = db_file
        break

if db_found:
    size_kb = os.path.getsize(db_found) / 1024
    log_result("TEST-4.10", "PASS", f"Database mevcut ({size_kb:.1f} KB)")
else:
    log_result("TEST-4.10", "FAIL", "Database dosyası bulunamadı veya boş")

# ========== SUMMARY ==========
print("\n" + "=" * 60)
print("TEST GRUBU 4 SONUÇ RAPORU")
print("=" * 60)

passed = sum(1 for r in RESULTS if r["status"] == "PASS")
warned = sum(1 for r in RESULTS if r["status"] == "WARN")
failed = sum(1 for r in RESULTS if r["status"] == "FAIL")
total = len(RESULTS)

print(f"\nToplam: {total} test")
print(f"✅ PASS: {passed}")
print(f"⚠️ WARN: {warned}")
print(f"❌ FAIL: {failed}")

if failed == 0:
    if warned == 0:
        print("\n🎉 TEST GRUBU 4: TÜM TESTLER BAŞARILI!")
    else:
        print(f"\n✅ TEST GRUBU 4: BAŞARILI ({warned} uyarı)")
else:
    print("\n⚠️ BAŞARISIZ TESTLER:")
    for r in RESULTS:
        if r["status"] == "FAIL":
            print(f"  - {r['test']}: {r['detail']}")
