#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - Full Integration Test Suite
FAZ 4: Complete system validation

Author: Semih Kılıç
Version: 1.0.0

Tests:
1. API Authentication Flow
2. Scan Engine Functionality
3. WebSocket Connectivity
4. Frontend Build Validation
5. Docker Configuration
6. Production Readiness
"""

import os
import sys
import json
import time
import subprocess
from datetime import datetime

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    print(f"\n{Colors.CYAN}{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.CYAN}{Colors.BOLD}{text}{Colors.END}")
    print(f"{Colors.CYAN}{Colors.BOLD}{'='*60}{Colors.END}")

def print_test(name, passed, details=""):
    status = f"{Colors.GREEN}✅ PASS{Colors.END}" if passed else f"{Colors.RED}❌ FAIL{Colors.END}"
    print(f"  {status} {name}")
    if details:
        print(f"       {Colors.YELLOW}{details}{Colors.END}")

def print_section(name):
    print(f"\n{Colors.BLUE}📋 {name}{Colors.END}")

# Test results tracking
results = {
    'passed': 0,
    'failed': 0,
    'warnings': 0,
    'tests': []
}

def record_test(name, passed, details=""):
    results['tests'].append({
        'name': name,
        'passed': passed,
        'details': details,
        'timestamp': datetime.now().isoformat()
    })
    if passed:
        results['passed'] += 1
    else:
        results['failed'] += 1
    print_test(name, passed, details)

# ============================================
# TEST SUITE
# ============================================

print_header("🛡️ CyberSec Pro - FAZ 4 Integration Test")
print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

# ============================================
# 1. BACKEND API TESTS
# ============================================
print_section("1. Backend API Tests")

sys.path.insert(0, '/home/cybersec/cybersec-pro/saas-backend')
os.chdir('/home/cybersec/cybersec-pro/saas-backend')

try:
    from app import app, db
    
    with app.test_client() as client:
        # Test 1.1: Root endpoint
        resp = client.get('/')
        record_test(
            "API Root Endpoint",
            resp.status_code == 200,
            f"Status: {resp.status_code}"
        )
        
        # Test 1.2: Health check
        resp = client.get('/api/health')
        if resp.status_code == 200:
            data = resp.get_json()
            record_test(
                "Health Check",
                data.get('status') == 'healthy',
                f"Status: {data.get('status')}, Checks: {list(data.get('checks', {}).keys())}"
            )
        else:
            record_test("Health Check", False, f"HTTP {resp.status_code}")
        
        # Test 1.3: Readiness probe
        resp = client.get('/api/ready')
        record_test(
            "Readiness Probe",
            resp.status_code in [200, 503],
            f"Status: {resp.status_code}"
        )
        
        # Test 1.4: Auth - Register (validation)
        resp = client.post('/api/v1/auth/register', json={})
        record_test(
            "Auth Register Validation",
            resp.status_code == 400,
            "Empty request returns 400"
        )
        
        # Test 1.5: Auth - Login (validation)
        resp = client.post('/api/v1/auth/login', json={
            'email': 'nonexistent@test.com',
            'password': 'wrong'
        })
        record_test(
            "Auth Login Validation",
            resp.status_code in [401, 404],
            f"Invalid creds return {resp.status_code}"
        )
        
        # Test 1.6: Protected endpoints without token
        resp = client.get('/api/v1/scans')
        record_test(
            "Protected Endpoint (no token)",
            resp.status_code == 401,
            "Returns 401 Unauthorized"
        )
        
        # Test 1.7: Engine stats (protected)
        resp = client.get('/api/v1/engine/stats')
        record_test(
            "Engine Stats Protected",
            resp.status_code == 401,
            "Protected endpoint"
        )

except Exception as e:
    record_test("Backend Import", False, str(e))

# ============================================
# 2. SCAN ENGINE TESTS
# ============================================
print_section("2. Scan Engine Tests")

try:
    from scan_engine import ScanEngine, ScanStatus, TOOL_TIMEOUTS
    
    # Test 2.1: Engine initialization
    engine = ScanEngine(max_workers=2, use_docker=False)
    record_test(
        "Engine Initialization",
        engine is not None,
        f"Workers: {engine.max_workers}"
    )
    
    # Test 2.2: Tool timeouts configured
    record_test(
        "Tool Timeouts Configured",
        len(TOOL_TIMEOUTS) > 5,
        f"Configured for {len(TOOL_TIMEOUTS)} tools"
    )
    
    # Test 2.3: Submit and track scan
    job = engine.submit_scan(
        scan_id='integration-test-1',
        tool_id='test',
        target='test.example.com',
        command=['echo', 'integration-test'],
        parameters={}
    )
    record_test(
        "Scan Submission",
        job is not None and job.id == 'integration-test-1',
        f"Job ID: {job.id if job else 'None'}"
    )
    
    # Test 2.4: Wait for completion
    time.sleep(1)
    result = engine.get_scan('integration-test-1')
    record_test(
        "Scan Completion Tracking",
        result and result.status in [ScanStatus.COMPLETED, ScanStatus.FAILED],
        f"Status: {result.status.value if result else 'None'}"
    )
    
    # Test 2.5: Engine stats
    stats = engine.get_stats()
    record_test(
        "Engine Statistics",
        'total_scans' in stats and 'max_workers' in stats,
        f"Total scans: {stats.get('total_scans', 0)}"
    )
    
    # Test 2.6: Graceful shutdown
    engine.shutdown(wait=True)
    record_test("Engine Shutdown", True, "Graceful shutdown complete")

except Exception as e:
    record_test("Scan Engine Tests", False, str(e))

# ============================================
# 3. WEBSOCKET TESTS
# ============================================
print_section("3. WebSocket Tests")

try:
    from websocket_events import init_socketio, get_socketio, emit_scan_progress
    from flask import Flask
    
    test_app = Flask(__name__)
    test_app.config['SECRET_KEY'] = 'test'
    
    sio = init_socketio(test_app)
    record_test(
        "SocketIO Initialization",
        sio is not None,
        "Flask-SocketIO ready"
    )
    
    sio2 = get_socketio()
    record_test(
        "SocketIO Global Instance",
        sio2 is not None,
        "get_socketio() working"
    )

except Exception as e:
    record_test("WebSocket Tests", False, str(e))

# ============================================
# 4. FRONTEND BUILD TESTS
# ============================================
print_section("4. Frontend Build Tests")

frontend_dir = '/home/cybersec/cybersec-pro/saas-frontend'
os.chdir(frontend_dir)

# Test 4.1: package.json exists
record_test(
    "package.json Exists",
    os.path.exists(f'{frontend_dir}/package.json'),
    ""
)

# Test 4.2: Check dependencies
try:
    with open(f'{frontend_dir}/package.json') as f:
        pkg = json.load(f)
        deps = pkg.get('dependencies', {})
        required = ['react', 'react-dom', 'react-router-dom', 'socket.io-client']
        missing = [d for d in required if d not in deps]
        record_test(
            "Required Dependencies",
            len(missing) == 0,
            f"Missing: {missing}" if missing else "All present"
        )
except Exception as e:
    record_test("package.json Parse", False, str(e))

# Test 4.3: Build output exists (or can build)
dist_dir = f'{frontend_dir}/dist'
if os.path.exists(dist_dir):
    has_index = os.path.exists(f'{dist_dir}/index.html')
    has_assets = os.path.exists(f'{dist_dir}/assets')
    record_test(
        "Build Output",
        has_index and has_assets,
        f"index.html: {has_index}, assets: {has_assets}"
    )
else:
    record_test("Build Output", False, "dist/ not found - run npm run build")
    results['warnings'] += 1

# Test 4.4: Dockerfile exists
record_test(
    "Frontend Dockerfile",
    os.path.exists(f'{frontend_dir}/Dockerfile'),
    ""
)

# Test 4.5: nginx.conf exists
record_test(
    "Frontend nginx.conf",
    os.path.exists(f'{frontend_dir}/nginx.conf'),
    ""
)

# ============================================
# 5. DOCKER CONFIGURATION TESTS
# ============================================
print_section("5. Docker Configuration Tests")

project_dir = '/home/cybersec/cybersec-pro'
os.chdir(project_dir)

# Test 5.1: docker-compose.yml exists
record_test(
    "docker-compose.yml Exists",
    os.path.exists(f'{project_dir}/docker-compose.yml'),
    ""
)

# Test 5.2: Validate docker-compose
result = subprocess.run(
    ['docker', 'compose', 'config', '--quiet'],
    capture_output=True,
    text=True
)
record_test(
    "Docker Compose Valid",
    result.returncode == 0,
    result.stderr[:100] if result.returncode != 0 else ""
)

# Test 5.3: Backend Dockerfile
record_test(
    "Backend Dockerfile",
    os.path.exists(f'{project_dir}/saas-backend/Dockerfile'),
    ""
)

# Test 5.4: .env.example exists
record_test(
    ".env.example Exists",
    os.path.exists(f'{project_dir}/.env.example'),
    ""
)

# Test 5.5: Nginx config
record_test(
    "Nginx Config",
    os.path.exists(f'{project_dir}/nginx/nginx.conf'),
    ""
)

# ============================================
# 6. PRODUCTION READINESS
# ============================================
print_section("6. Production Readiness")

# Test 6.1: Security - no debug in production config
try:
    with open(f'{project_dir}/saas-backend/Dockerfile') as f:
        content = f.read()
        no_debug = 'FLASK_ENV=production' in content
        record_test(
            "Production Mode",
            no_debug,
            "FLASK_ENV=production set"
        )
except:
    record_test("Production Mode Check", False, "Could not read Dockerfile")

# Test 6.2: Health check in Dockerfile
try:
    with open(f'{project_dir}/saas-backend/Dockerfile') as f:
        content = f.read()
        has_healthcheck = 'HEALTHCHECK' in content
        record_test(
            "Docker Health Check",
            has_healthcheck,
            "HEALTHCHECK instruction present"
        )
except:
    record_test("Docker Health Check", False, "Could not read Dockerfile")

# Test 6.3: Non-root user
try:
    with open(f'{project_dir}/saas-backend/Dockerfile') as f:
        content = f.read()
        has_user = 'USER appuser' in content or 'USER 1000' in content
        record_test(
            "Non-root User",
            has_user,
            "Running as non-root user"
        )
except:
    record_test("Non-root User", False, "Could not read Dockerfile")

# Test 6.4: Rate limiting in nginx
try:
    with open(f'{project_dir}/nginx/nginx.conf') as f:
        content = f.read()
        has_rate_limit = 'limit_req_zone' in content
        record_test(
            "Rate Limiting",
            has_rate_limit,
            "nginx rate limiting configured"
        )
except:
    record_test("Rate Limiting", False, "Could not read nginx.conf")

# Test 6.5: SSL ready
ssl_dir = f'{project_dir}/nginx/ssl'
record_test(
    "SSL Directory",
    os.path.isdir(ssl_dir),
    "Ready for certificates"
)

# ============================================
# RESULTS SUMMARY
# ============================================
print_header("📊 Test Results Summary")

total = results['passed'] + results['failed']
pass_rate = (results['passed'] / total * 100) if total > 0 else 0

print(f"\n  {Colors.GREEN}Passed: {results['passed']}{Colors.END}")
print(f"  {Colors.RED}Failed: {results['failed']}{Colors.END}")
print(f"  {Colors.YELLOW}Warnings: {results['warnings']}{Colors.END}")
print(f"\n  Pass Rate: {pass_rate:.1f}%")

if results['failed'] == 0:
    print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED!{Colors.END}")
    print(f"{Colors.GREEN}CyberSec Pro is ready for production deployment.{Colors.END}")
    exit_code = 0
else:
    print(f"\n{Colors.RED}{Colors.BOLD}⚠️ Some tests failed.{Colors.END}")
    print(f"{Colors.RED}Review failed tests before deploying.{Colors.END}")
    exit_code = 1

print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

sys.exit(exit_code)
