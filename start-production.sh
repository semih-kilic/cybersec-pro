#!/bin/bash
# 🚀 CyberSec Pro - Production Startup Script
# Rust/Axum Backend + React Frontend

set -e

echo "🛡️ CyberSec Pro - Production Startup"
echo "======================================"

BASEDIR="/home/cybersec/cybersec-pro"
RUST_DIR="$BASEDIR/rust-backend"
SCAN_ENGINE_DIR="$BASEDIR/rust-scan-engine"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
    fi
}

# Load environment variables from rust-backend/.env
echo -e "\n${YELLOW}Loading environment variables from .env...${NC}"
if [ -f "$RUST_DIR/.env" ]; then
    set -a
    source "$RUST_DIR/.env"
    set +a
    print_status 0 "Environment loaded"
else
    print_status 1 "Missing .env file in $RUST_DIR"
    exit 1
fi

# 1. Start Redis
echo -e "\n${YELLOW}1. Starting Redis...${NC}"
if ! pgrep -x "redis-server" > /dev/null; then
    sudo systemctl start redis-server 2>/dev/null || redis-server --daemonize yes
fi
print_status $? "Redis"

# 2. Stop existing services
echo -e "\n${YELLOW}2. Stopping existing services...${NC}"
pkill -f "cybersec-pro-backend" 2>/dev/null || true
pkill -f "cybersec-scan-engine" 2>/dev/null || true
fuser -k 5001/tcp 2>/dev/null || true
fuser -k 5002/tcp 2>/dev/null || true
sleep 2
print_status 0 "Old processes stopped"

# 3. Start Rust Scan Engine
echo -e "\n${YELLOW}3. Starting Rust Scan Engine...${NC}"
cd $SCAN_ENGINE_DIR
SCAN_ENGINE_PORT=5002 \
RUST_LOG=info \
nohup ./target/release/cybersec-scan-engine > /tmp/rust-scan-engine.log 2>&1 &

sleep 3
if curl -s http://localhost:5002/health | grep -q "healthy"; then
    print_status 0 "Rust Scan Engine (port 5002)"
else
    print_status 1 "Rust Scan Engine failed to start"
    tail -5 /tmp/rust-scan-engine.log
fi

# 4. Start Rust Backend
echo -e "\n${YELLOW}4. Starting Rust API Backend...${NC}"
cd $RUST_DIR
SCAN_ENGINE_URL='http://127.0.0.1:5002' \
RUST_LOG=info \
nohup ./target/release/cybersec-pro-backend > /tmp/rust-backend.log 2>&1 &

sleep 3
if curl -s http://localhost:5001/health | grep -q "healthy"; then
    print_status 0 "Rust Backend (Axum v4.0.0 on port 5001)"
else
    print_status 1 "Rust Backend failed to start"
    tail -5 /tmp/rust-backend.log
fi

# 5. Ensure Frontend is running
echo -e "\n${YELLOW}5. Checking React Frontend...${NC}"
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    print_status 0 "React Frontend already running (port 3001)"
else
    cd $BASEDIR/saas-frontend
    nohup npm run dev -- --port 3001 > /tmp/frontend.log 2>&1 &
    sleep 5
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        print_status 0 "React Frontend started (port 3001)"
    else
        print_status 1 "React Frontend failed to start"
    fi
fi

# 6. Reload Nginx
echo -e "\n${YELLOW}6. Skipping Nginx Reload in Dev environment...${NC}"
# sudo nginx -t && sudo systemctl reload nginx
# print_status $? "Nginx"

# Summary
echo -e "\n======================================"
echo -e "${GREEN}🚀 CyberSec Pro Production Ready!${NC}"
echo "======================================"
echo ""
echo "📊 Server Status:"
echo "   API:     http://localhost:5001 (Rust/Axum)"
echo "   Engine:  http://localhost:5002 (Rust Scan Engine)"
echo "   Web:     http://localhost:3001 (React/Vite)"
echo "   Site:    https://semihkilic.com"
echo ""
echo "📁 Logs:"
echo "   • /tmp/rust-backend.log"
echo "   • /tmp/rust-scan-engine.log"
echo "   • /tmp/frontend.log"
echo ""
echo "🔧 Commands:"
echo "   • Status:  curl -s http://localhost:5001/health"
echo "   • Restart: $BASEDIR/start-production.sh"
echo "   • Stop:    pkill -f cybersec-pro-backend"
