#!/bin/bash
#
# 🐉 CyberSec Pro - Setup Auto-Update Cron Job
# This script configures daily automatic updates for Kali Linux tools
#

set -e

echo "🐉 CyberSec Pro - Auto-Update Setup"
echo "===================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (sudo)"
    exit 1
fi

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPDATE_SCRIPT="$SCRIPT_DIR/auto_update_tools.py"
LOG_DIR="/var/log/cybersec-pro"
STATE_DIR="/var/lib/cybersec-pro"
CRON_FILE="/etc/cron.d/cybersec-auto-update"
VENV_DIR="$SCRIPT_DIR/venv"

echo ""
echo "📁 Creating directories..."
mkdir -p "$LOG_DIR"
mkdir -p "$STATE_DIR"

echo "📦 Checking dependencies..."
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
pip install -q requests

echo ""
echo "📝 Creating cron job..."

# Create cron job file
cat > "$CRON_FILE" << EOF
# CyberSec Pro - Automatic Tool Updates
# Runs daily at 3:00 AM UTC
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Admin email for notifications
MAILTO=cybersecpro@semihkilic.com

# Daily tool update check at 3 AM
0 3 * * * root $VENV_DIR/bin/python3 $UPDATE_SCRIPT >> $LOG_DIR/auto-update.log 2>&1
EOF

chmod 644 "$CRON_FILE"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Configuration:"
echo "   - Update script: $UPDATE_SCRIPT"
echo "   - Log directory: $LOG_DIR"
echo "   - State file: $STATE_DIR/update-state.json"
echo "   - Cron file: $CRON_FILE"
echo "   - Schedule: Daily at 3:00 AM UTC"
echo ""
echo "📧 Email notifications will be sent to: cybersecpro@semihkilic.com"
echo ""
echo "🔧 To run manually:"
echo "   sudo python3 $UPDATE_SCRIPT"
echo ""
echo "📊 To check logs:"
echo "   tail -f $LOG_DIR/auto-update.log"
echo ""
