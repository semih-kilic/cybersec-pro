#!/bin/bash
# 🛡️ CyberSec Pro — Automated RAM & Service Health Watchdog
# Runs continuously or via cron/timer to keep RAM low & services 100% healthy.

BASEDIR="/home/cybersec/cybersec-pro"
RUST_DIR="$BASEDIR/rust-backend"
SCAN_ENGINE_DIR="$BASEDIR/rust-scan-engine"
FRONTEND_DIR="$BASEDIR/saas-frontend"
LOGFILE="/tmp/cybersec-watchdog.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOGFILE"
}

# 1. RAM Optimization & Zombie Cleanup
clean_ram() {
    # Kill orphaned Maltego or desktop Java processes if running in background
    if pgrep -f "maltego" >/dev/null 2>&1; then
        pkill -f "maltego" >/dev/null 2>&1
        log "RAM Watchdog: Terminated idle Maltego background process."
    fi

    # Kill stale vite staging or preview servers on non-standard ports
    if pgrep -f "vite.config.staging.ts" >/dev/null 2>&1; then
        pkill -f "vite.config.staging.ts" >/dev/null 2>&1
        log "RAM Watchdog: Terminated stale Vite staging process."
    fi

    # Check available memory
    FREE_MEM_MB=$(free -m | awk '/^Mem:/{print $7}')
    if [ "$FREE_MEM_MB" -lt 1000 ]; then
        log "RAM Watchdog: Low available RAM (${FREE_MEM_MB}MB). Trimming page cache..."
        sync
        sudo sysctl -w vm.drop_caches=3 >/dev/null 2>&1 || true
    fi
}

# 2. Auto-Healing: Check Backend (Port 5001)
check_backend() {
    if ! curl -s http://localhost:5001/health | grep -q "healthy"; then
        log "Auto-Healing: Backend on port 5001 is DOWN. Restarting..."
        pkill -f "cybersec-pro-backend" >/dev/null 2>&1 || true
        sleep 1
        cd "$RUST_DIR"
        if [ -f "$RUST_DIR/.env" ]; then
            set -a; source "$RUST_DIR/.env"; set +a
        fi
        SCAN_ENGINE_URL='http://127.0.0.1:5002' RUST_LOG=info nohup ./target/release/cybersec-pro-backend > /tmp/backend.log 2>&1 &
        log "Auto-Healing: Backend restart triggered."
    fi
}

# 3. Auto-Healing: Check Scan Engine (Port 5002)
check_engine() {
    if ! curl -s http://localhost:5002/health | grep -q "healthy"; then
        log "Auto-Healing: Scan Engine on port 5002 is DOWN. Restarting..."
        pkill -f "cybersec-scan-engine" >/dev/null 2>&1 || true
        sleep 1
        cd "$SCAN_ENGINE_DIR"
        if [ -f "$RUST_DIR/.env" ]; then
            set -a; source "$RUST_DIR/.env"; set +a
        fi
        SCAN_ENGINE_PORT=5002 RUST_LOG=info nohup ./target/release/cybersec-scan-engine > /tmp/engine.log 2>&1 &
        log "Auto-Healing: Scan Engine restart triggered."
    fi
}

# 4. Auto-Healing: Check Frontend (Port 3001)
check_frontend() {
    if ! curl -s http://localhost:3001 >/dev/null 2>&1; then
        log "Auto-Healing: Frontend on port 3001 is DOWN. Restarting..."
        pkill -f "vite --port 3001" >/dev/null 2>&1 || true
        sleep 1
        cd "$FRONTEND_DIR"
        nohup npm run dev -- --port 3001 > /tmp/frontend.log 2>&1 &
        log "Auto-Healing: Frontend restart triggered."
    fi
}

# Run all checks
clean_ram
check_backend
check_engine
check_frontend
