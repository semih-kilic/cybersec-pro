#!/bin/bash
# CyberSec Pro - Startup Script
# Ensures all services start on boot

set -u
set -o pipefail
IFS=$'\n\t'
PATH="/home/sam/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
umask 077

LOG_DIR="/var/log/cybersec"
LOG_FILE="$LOG_DIR/startup.log"

LOCK_FILE="/tmp/cybersec-startup.lock"
if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK_FILE"
    if ! flock -n 9; then
        exit 0
    fi
fi

mkdir -p "$LOG_DIR" 2>/dev/null || true
chmod 700 "$LOG_DIR" 2>/dev/null || true
touch "$LOG_FILE" 2>/dev/null || true
chmod 600 "$LOG_FILE" 2>/dev/null || true

log() {
    echo "$(date): $*" >> "$LOG_FILE"
}

log "========================================"
log "Starting CyberSec services..."

# Wait for network
sleep 5

# 1. Start Cloudflare Tunnel
log "Starting Cloudflare Tunnel..."
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1
if command -v cloudflared >/dev/null 2>&1; then
    cd /home/sam && cloudflared tunnel run 3d58ef29-b086-46ae-a21c-b68ddd11725f &>> "$LOG_DIR/cloudflared.log" &
else
    log "Cloudflared not found in PATH"
fi
sleep 3

# 2. Start Frontend Server (8080)
log "Starting Frontend Server (8080)..."
pkill -f "python.*http.server.*8080" 2>/dev/null || true
sleep 1
if command -v python3 >/dev/null 2>&1; then
    cd /home/sam/APPS/cybersec-sales/frontend && python3 -m http.server 8080 &>> "$LOG_DIR/frontend-8080.log" &
else
    log "python3 not found in PATH"
fi
sleep 2

# 3. Start Sales Backend (5002)
log "Starting Sales Backend (5002)..."
pkill -f "gunicorn.*5002" 2>/dev/null || true
sleep 1
if [ -x "/home/sam/APPS/cybersec-sales/backend/venv/bin/gunicorn" ]; then
    cd /home/sam/APPS/cybersec-sales/backend && source venv/bin/activate && gunicorn -w 2 -b 127.0.0.1:5002 app:app --daemon --pid /tmp/sales-backend.pid --access-logfile "$LOG_DIR/sales-access.log" --error-logfile "$LOG_DIR/sales-error.log"
else
    log "gunicorn not found in sales backend venv"
fi
sleep 2

# 4. Start Main Backend (5001)
log "Starting Main Backend (5001)..."
pkill -f "cybersec-kali/backend/app.py" 2>/dev/null || true
sleep 1
if [ -x "/home/sam/APPS/cybersec-kali/backend/venv/bin/python3" ]; then
    cd /home/sam/APPS/cybersec-kali/backend && source venv/bin/activate && python3 app.py &>> "$LOG_DIR/main-backend.log" &
else
    log "python3 not found in main backend venv"
fi
sleep 2

# 5. Start CyberSec Local Frontend (5173)
log "Starting CyberSec Local (5173)..."
pkill -f "vite.*5173" 2>/dev/null || true
pkill -f "node.*5173" 2>/dev/null || true
sleep 1
if command -v npm >/dev/null 2>&1; then
    cd /home/sam/APPS/cybersec-kali/frontend && npm run dev -- --host 0.0.0.0 --port 5173 &>> "$LOG_DIR/cybersec-local.log" &
else
    log "npm not found in PATH"
fi
sleep 3

# Verify all services
log "Verifying services..."
sleep 5

check_url_ok() {
    local url="$1"
    local attempts=5
    local i=1
    while [ $i -le $attempts ]; do
        if command -v curl >/dev/null 2>&1; then
            code=$(curl -fsS --max-time 3 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || true)
            if [ "$code" = "200" ]; then
                return 0
            fi
        fi
        sleep 1
        i=$((i + 1))
    done
    return 1
}

check_url_status() {
    local url="$1"
    if command -v curl >/dev/null 2>&1; then
        curl -fsS --max-time 3 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000"
        return
    fi
    echo "000"
}

# Check services
SERVICES_OK=0
SERVICES_FAIL=0

if pgrep -f "cloudflared tunnel" > /dev/null; then
    log "✅ Cloudflare Tunnel: Running"
    ((SERVICES_OK++))
else
    log "❌ Cloudflare Tunnel: Failed"
    ((SERVICES_FAIL++))
fi

if check_url_ok "http://127.0.0.1:5002/api/health"; then
    log "✅ Sales API (5002): Running"
    ((SERVICES_OK++))
else
    status=$(check_url_status "http://127.0.0.1:5002/api/health")
    log "❌ Sales API (5002): Failed (HTTP $status)"
    ((SERVICES_FAIL++))
fi

if check_url_ok "http://127.0.0.1:5001/api/health"; then
    log "✅ Main App (5001): Running"
    ((SERVICES_OK++))
else
    status=$(check_url_status "http://127.0.0.1:5001/api/health")
    log "❌ Main App (5001): Failed (HTTP $status)"
    ((SERVICES_FAIL++))
fi

if check_url_ok "http://127.0.0.1:8080"; then
    log "✅ Frontend (8080): Running"
    ((SERVICES_OK++))
else
    status=$(check_url_status "http://127.0.0.1:8080")
    log "❌ Frontend (8080): Failed (HTTP $status)"
    ((SERVICES_FAIL++))
fi

if check_url_ok "http://127.0.0.1:5173"; then
    log "✅ CyberSec Local (5173): Running"
    ((SERVICES_OK++))
else
    status=$(check_url_status "http://127.0.0.1:5173")
    log "❌ CyberSec Local (5173): Failed (HTTP $status)"
    ((SERVICES_FAIL++))
fi

log "Startup complete - $SERVICES_OK OK, $SERVICES_FAIL Failed"
log "========================================"

exit 0
