#!/bin/bash
#
# CyberSec Pro - Start Script
#

echo "🚀 Starting CyberSec Pro..."

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}')

# Start backend
echo "   Starting Backend API..."
cd backend
if [ ! -d venv ]; then
	python3 -m venv venv
	source venv/bin/activate
	pip install -q -r requirements.txt
	deactivate
fi
source venv/bin/activate
nohup python3 app.py > /dev/null 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 2

# Start frontend
echo "   Starting Frontend..."
cd frontend
if [ ! -d node_modules ]; then
	npm install --silent
fi
if [ ! -d dist ]; then
	npm run build --silent
fi
nohup npx serve -s dist -l 5173 > /dev/null 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend
sleep 3

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║          ✅ CyberSec Pro is running!                      ║"
echo "║                                                           ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║                                                           ║"
echo "║   🌐 Web Interface:                                       ║"
echo "║      Local:   http://localhost:5173                       ║"
echo "║      Network: http://${LOCAL_IP}:5173                       ║"
echo "║                                                           ║"
echo "║   🔌 API Server:                                          ║"
echo "║      http://localhost:5001                                ║"
echo "║                                                           ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║                                                           ║"
echo "║   To stop: ./stop.sh                                      ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Save PIDs
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid
