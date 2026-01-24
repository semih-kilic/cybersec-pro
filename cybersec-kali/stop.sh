#!/bin/bash
#
# CyberSec Pro - Stop Script
#

echo "🛑 Stopping CyberSec Pro..."

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Kill by PID files
if [ -f .backend.pid ]; then
    kill $(cat .backend.pid) 2>/dev/null
    rm -f .backend.pid
fi

if [ -f .frontend.pid ]; then
    kill $(cat .frontend.pid) 2>/dev/null
    rm -f .frontend.pid
fi

# Also kill by process name (backup)
pkill -f "python3 app.py" 2>/dev/null
pkill -f "serve -s dist" 2>/dev/null

echo "✅ All services stopped"
