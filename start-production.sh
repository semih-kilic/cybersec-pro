#!/bin/bash
# 🚀 CyberSec Pro - Production Startup Script
# Single Server Deployment

set -e

echo "🛡️ CyberSec Pro - Production Startup"
echo "======================================"

BASEDIR="/home/cybersec/cybersec-pro"
BACKEND_DIR="$BASEDIR/saas-backend"
LOGS_DIR="$BASEDIR/logs"

# Create logs directory
mkdir -p $LOGS_DIR

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

# 1. Start Redis
echo -e "\n${YELLOW}1. Starting Redis...${NC}"
if ! pgrep -x "redis-server" > /dev/null; then
    sudo systemctl start redis-server 2>/dev/null || redis-server --daemonize yes
fi
print_status $? "Redis"

# 2. Kill existing Python processes on our ports
echo -e "\n${YELLOW}2. Stopping existing services...${NC}"
pkill -f "gunicorn.*cybersec" 2>/dev/null || true
pkill -f "celery.*cybersec" 2>/dev/null || true
fuser -k 5001/tcp 2>/dev/null || true
fuser -k 5002/tcp 2>/dev/null || true
sleep 2
print_status 0 "Old processes stopped"

# 3. Start Gunicorn (Main API)
echo -e "\n${YELLOW}3. Starting Gunicorn API Server...${NC}"
cd $BACKEND_DIR
source venv/bin/activate

nohup gunicorn \
    --config gunicorn.conf.py \
    app:app \
    > $LOGS_DIR/gunicorn-stdout.log 2>&1 &

sleep 3
if pgrep -f "gunicorn.*app:app" > /dev/null; then
    print_status 0 "Gunicorn (5 workers, gevent)"
else
    print_status 1 "Gunicorn failed to start"
    cat $LOGS_DIR/gunicorn-stderr.log
fi

# 4. Start Celery Worker
echo -e "\n${YELLOW}4. Starting Celery Worker...${NC}"
cd $BACKEND_DIR
source venv/bin/activate
nohup $BACKEND_DIR/venv/bin/celery -A celery_tasks worker \
    --loglevel=info \
    --concurrency=4 \
    --max-tasks-per-child=50 \
    > $LOGS_DIR/celery-worker.log 2>&1 &

sleep 2
if pgrep -f "celery.*worker" > /dev/null; then
    print_status 0 "Celery Worker (4 concurrent tasks)"
else
    print_status 1 "Celery Worker failed to start"
fi

# 5. Start Sales Backend (optional - if needed)
echo -e "\n${YELLOW}5. Starting Sales Backend...${NC}"
cd $BASEDIR/cybersec-sales/backend
if [ -d "venv" ]; then
    source venv/bin/activate
    nohup python app.py > $LOGS_DIR/sales-backend.log 2>&1 &
    sleep 2
    print_status $? "Sales Backend (Port 5002)"
else
    echo "   Sales backend venv not found, skipping..."
fi

# 6. Reload Nginx
echo -e "\n${YELLOW}6. Reloading Nginx...${NC}"
sudo nginx -t && sudo systemctl reload nginx
print_status $? "Nginx"

# Summary
echo -e "\n======================================"
echo -e "${GREEN}🚀 CyberSec Pro Production Ready!${NC}"
echo "======================================"
echo ""
echo "📊 Server Status:"
echo "   API:     http://localhost:5001"
echo "   Sales:   http://localhost:5002"
echo "   Web:     https://semihkilic.com"
echo ""
echo "📈 Capacity:"
echo "   • API Requests: ~500 concurrent"
echo "   • Scan Tasks:   ~30-50 concurrent"
echo "   • Users:        ~50-100 simultaneous"
echo ""
echo "📁 Logs:"
echo "   • $LOGS_DIR/gunicorn-*.log"
echo "   • $LOGS_DIR/celery-worker.log"
echo ""
echo "🔧 Commands:"
echo "   • Status:  ps aux | grep -E 'gunicorn|celery'"
echo "   • Restart: $BASEDIR/start-production.sh"
echo "   • Stop:    pkill -f gunicorn; pkill -f celery"
