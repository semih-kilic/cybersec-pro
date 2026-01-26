#!/bin/bash
# CyberSec Pro - Complete Setup Script
# This script installs systemd services for continuous operation

set -e

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║     CyberSec Pro - Production Setup               ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Please run: sudo bash $0"
    exit 1
fi

INSTALL_DIR=${CYBERSEC_SALES_ROOT:-/home/sam/APPS/cybersec-sales}
SERVICE_USER=${CYBERSEC_SALES_USER:-${SUDO_USER:-$(whoami)}}
SERVICE_DIR="$INSTALL_DIR/services"
SCRIPT_DIR="$INSTALL_DIR/scripts"

# Make scripts executable
chmod +x "$SCRIPT_DIR"/*.sh

# Copy service files to systemd
echo "📦 Installing systemd services..."
cp "$SERVICE_DIR/cybersec-sales.service" /etc/systemd/system/
cp "$SERVICE_DIR/cybersec-frontend.service" /etc/systemd/system/
cp "$SERVICE_DIR/cybersec-alert@.service" /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable services (start on boot)
echo "🔧 Enabling services..."
systemctl enable cybersec-sales
systemctl enable cybersec-frontend

# Start services
echo "🚀 Starting services..."
systemctl start cybersec-sales
systemctl start cybersec-frontend

# Wait and check status
sleep 3

echo ""
echo "📊 Service Status:"
echo "─────────────────────────────────────────────"
systemctl status cybersec-sales --no-pager -l | head -20
echo ""
systemctl status cybersec-frontend --no-pager -l | head -10

# Setup cron for monitoring (every 5 minutes)
echo ""
echo "⏰ Setting up monitoring cron job..."
CRON_CMD="*/5 * * * * /bin/bash $SCRIPT_DIR/monitor.sh monitor >> /var/log/cybersec-monitor.log 2>&1"
(crontab -u "$SERVICE_USER" -l 2>/dev/null | grep -v "monitor.sh"; echo "$CRON_CMD") | crontab -u "$SERVICE_USER" -

# Create log file
touch /var/log/cybersec-monitor.log
chown "$SERVICE_USER":"$SERVICE_USER" /var/log/cybersec-monitor.log

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║              ✅ Setup Complete!                   ║"
echo "╠════════════════════════════════════════════════════╣"
echo "║                                                    ║"
echo "║  Services Installed:                               ║"
echo "║  • cybersec-sales    (port 5002)                  ║"
echo "║  • cybersec-frontend (port 8080)                  ║"
echo "║                                                    ║"
echo "║  Commands:                                         ║"
echo "║  • sudo systemctl status cybersec-sales           ║"
echo "║  • sudo systemctl restart cybersec-sales          ║"
echo "║  • journalctl -u cybersec-sales -f               ║"
echo "║                                                    ║"
echo "║  Monitoring:                                       ║"
echo "║  • bash $SCRIPT_DIR/monitor.sh status            ║"
echo "║  • Cron runs every 5 minutes                      ║"
echo "║  • Logs: /var/log/cybersec-monitor.log           ║"
echo "║                                                    ║"
echo "║  ⚠️  Email alerts require configuration!          ║"
echo "║  Edit /etc/systemd/system/cybersec-sales.service ║"
echo "║  and set EMAIL_USER, EMAIL_PASS, ALERT_EMAIL     ║"
echo "║                                                    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
