#!/bin/bash
# 🚀 CyberSec Pro - Production Startup Script
# Uses Docker Compose for all services (single deployment model)

set -e

echo "🛡️ CyberSec Pro - Production Startup"
echo "======================================"

BASEDIR="/home/cybersec/cybersec-pro"

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

# Check .env file exists
echo -e "\n${YELLOW}Checking environment configuration...${NC}"
if [ -f "$BASEDIR/.env" ]; then
    print_status 0 ".env file found"
else
    echo -e "${RED}ERROR: Missing .env file in $BASEDIR${NC}"
    echo "Create one with: DB_PASSWORD, REDIS_PASSWORD, JWT_SECRET_KEY, API_SECRET"
    exit 1
fi

# Stop any bare-metal processes that might conflict
echo -e "\n${YELLOW}Stopping any bare-metal processes...${NC}"
pkill -f "cybersec-pro-backend" 2>/dev/null || true
pkill -f "cybersec-scan-engine" 2>/dev/null || true
fuser -k 5001/tcp 2>/dev/null || true
fuser -k 5002/tcp 2>/dev/null || true
sleep 1
print_status 0 "Old processes cleaned"

# Start all services via Docker Compose
echo -e "\n${YELLOW}Starting all services via Docker Compose...${NC}"
cd "$BASEDIR"
docker compose up -d --build
print_status $? "Docker Compose started"

# Wait for health checks
echo -e "\n${YELLOW}Waiting for services to be healthy...${NC}"
sleep 5

# Check each service
check_service() {
    local name=$1
    local url=$2
    if curl -sf "$url" > /dev/null 2>&1; then
        print_status 0 "$name"
    else
        print_status 1 "$name (not ready yet)"
    fi
}

check_service "API Backend" "http://localhost:5001/health"
check_service "Scan Engine" "http://localhost:5002/health"
check_service "Kali Tools" "http://localhost:5003/health"

# Summary
echo -e "\n======================================"
echo -e "${GREEN}🚀 CyberSec Pro Production Ready!${NC}"
echo "======================================"
echo ""
echo "📊 Server Status:"
echo "   API:     http://localhost:5001 (Rust/Axum)"
echo "   Engine:  http://localhost:5002 (Rust Scan Engine)"
echo "   Kali:    http://localhost:5003 (Tool API)"
echo ""
echo "📁 Logs:"
echo "   docker compose logs -f [service-name]"
echo ""
echo "🔧 Commands:"
echo "   • Status:  docker compose ps"
echo "   • Restart: docker compose restart"
echo "   • Stop:    docker compose down"
