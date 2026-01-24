#!/bin/bash
# CyberSec Pro - Service Health Monitor & Alert System
# Runs as cron job to monitor services and send alerts

# Configuration
ALERT_EMAIL="${ALERT_EMAIL:-semihkilic@gmail.com}"
SMTP_SERVER="${SMTP_SERVER:-smtp.gmail.com}"
SERVICE_NAME="CyberSec Pro"
HEALTH_URL="http://localhost:5002/api/health"
LOG_FILE="/var/log/cybersec-monitor.log"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE" 2>/dev/null || echo "$1"
}

send_email_alert() {
    local subject="$1"
    local body="$2"
    
    # Try using Python for email (more reliable)
    python3 << EOF
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

try:
    email_user = os.environ.get('EMAIL_USER', '')
    email_pass = os.environ.get('EMAIL_PASS', '')
    alert_email = os.environ.get('ALERT_EMAIL', '$ALERT_EMAIL')
    
    if not email_user or not email_pass:
        print("Email not configured - skipping alert")
        exit(0)
    
    msg = MIMEMultipart('alternative')
    msg['Subject'] = "$subject"
    msg['From'] = email_user
    msg['To'] = alert_email
    
    html = """
    <html>
    <body style="font-family: Arial; background: #1a1a2e; color: #fff; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #16213e; border-radius: 16px; padding: 30px;">
            <h2 style="color: #ff4444;">⚠️ $SERVICE_NAME Alert</h2>
            <p>$body</p>
            <hr style="border-color: #333;">
            <p style="color: #888; font-size: 12px;">
                Server: $(hostname)<br>
                Time: $(date '+%Y-%m-%d %H:%M:%S UTC')
            </p>
        </div>
    </body>
    </html>
    """
    
    msg.attach(MIMEText(html, 'html'))
    
    with smtplib.SMTP('$SMTP_SERVER', 587) as server:
        server.starttls()
        server.login(email_user, email_pass)
        server.send_message(msg)
    
    print("Alert email sent successfully")
except Exception as e:
    print(f"Email error: {e}")
EOF
}

check_service() {
    local service_name="$1"
    local port="$2"
    
    # Check if port is listening
    if ! nc -z localhost "$port" 2>/dev/null; then
        log "❌ $service_name is DOWN (port $port not responding)"
        return 1
    fi
    return 0
}

check_health_endpoint() {
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$HEALTH_URL" 2>/dev/null)
    local http_code="${response: -3}"
    
    if [ "$http_code" != "200" ]; then
        log "❌ Health check failed: HTTP $http_code"
        return 1
    fi
    
    # Parse response
    local status=$(cat /tmp/health_response.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null)
    
    if [ "$status" != "healthy" ]; then
        log "⚠️ Service degraded: $status"
        return 2
    fi
    
    return 0
}

# Main monitoring function
monitor() {
    local issues=""
    local all_ok=true
    
    echo -e "${YELLOW}🔍 Checking CyberSec Pro Services...${NC}"
    
    # Check Sales API (port 5002)
    if check_service "Sales API" 5002; then
        echo -e "  ${GREEN}✓${NC} Sales API (5002): Running"
        
        # Check health endpoint
        if check_health_endpoint; then
            echo -e "  ${GREEN}✓${NC} Health Check: Healthy"
        else
            echo -e "  ${RED}✗${NC} Health Check: Failed"
            issues+="Sales API health check failed\n"
            all_ok=false
        fi
    else
        echo -e "  ${RED}✗${NC} Sales API (5002): DOWN"
        issues+="Sales API is not running on port 5002\n"
        all_ok=false
        
        # Try to restart
        echo -e "  ${YELLOW}↻${NC} Attempting restart..."
        sudo systemctl restart cybersec-sales 2>/dev/null || \
            (cd /home/sam/APPS/cybersec-sales/backend && nohup python3 app.py > /tmp/sales-backend.log 2>&1 &)
        sleep 3
        
        if check_service "Sales API" 5002; then
            echo -e "  ${GREEN}✓${NC} Sales API restarted successfully"
            issues+="Sales API was restarted automatically\n"
        else
            echo -e "  ${RED}✗${NC} Failed to restart Sales API"
            issues+="CRITICAL: Failed to restart Sales API\n"
        fi
    fi
    
    # Check Frontend (port 8080)
    if check_service "Frontend" 8080; then
        echo -e "  ${GREEN}✓${NC} Frontend (8080): Running"
    else
        echo -e "  ${RED}✗${NC} Frontend (8080): DOWN"
        issues+="Frontend is not running on port 8080\n"
        all_ok=false
        
        # Try to restart
        echo -e "  ${YELLOW}↻${NC} Attempting restart..."
        sudo systemctl restart cybersec-frontend 2>/dev/null || \
            (cd /home/sam/APPS/cybersec-sales/frontend && nohup python3 -m http.server 8080 > /tmp/frontend.log 2>&1 &)
        sleep 2
        
        if check_service "Frontend" 8080; then
            echo -e "  ${GREEN}✓${NC} Frontend restarted successfully"
        fi
    fi
    
    # Check Main CyberSec App (port 5001)
    if check_service "CyberSec App" 5001; then
        echo -e "  ${GREEN}✓${NC} Main App (5001): Running"
    else
        echo -e "  ${YELLOW}⚠${NC} Main App (5001): Not running (optional)"
    fi
    
    # Check Cloudflare Tunnel
    if pgrep -f "cloudflared" > /dev/null; then
        echo -e "  ${GREEN}✓${NC} Cloudflare Tunnel: Running"
    else
        echo -e "  ${RED}✗${NC} Cloudflare Tunnel: DOWN"
        issues+="Cloudflare Tunnel is not running\n"
        all_ok=false
        
        # Try to restart tunnel
        echo -e "  ${YELLOW}↻${NC} Attempting tunnel restart..."
        cloudflared tunnel run cybersec-tunnel &>/dev/null &
        sleep 3
    fi
    
    # Send alert if there were issues
    if [ "$all_ok" = false ]; then
        log "Issues detected: $issues"
        send_email_alert "🚨 Service Alert" "$issues"
        echo -e "\n${RED}⚠️  Issues detected - alert sent${NC}"
        return 1
    else
        echo -e "\n${GREEN}✅ All services healthy${NC}"
        return 0
    fi
}

# Status display
status() {
    echo ""
    echo "╔════════════════════════════════════════════╗"
    echo "║       CyberSec Pro - Service Status        ║"
    echo "╠════════════════════════════════════════════╣"
    
    # Sales API
    if nc -z localhost 5002 2>/dev/null; then
        echo "║  ✅ Sales API (5002)     : RUNNING        ║"
    else
        echo "║  ❌ Sales API (5002)     : DOWN           ║"
    fi
    
    # Frontend
    if nc -z localhost 8080 2>/dev/null; then
        echo "║  ✅ Frontend (8080)      : RUNNING        ║"
    else
        echo "║  ❌ Frontend (8080)      : DOWN           ║"
    fi
    
    # Main App
    if nc -z localhost 5001 2>/dev/null; then
        echo "║  ✅ Main App (5001)      : RUNNING        ║"
    else
        echo "║  ⚪ Main App (5001)      : NOT RUNNING    ║"
    fi
    
    # Cloudflare
    if pgrep -f "cloudflared" > /dev/null; then
        echo "║  ✅ Cloudflare Tunnel    : RUNNING        ║"
    else
        echo "║  ❌ Cloudflare Tunnel    : DOWN           ║"
    fi
    
    echo "╚════════════════════════════════════════════╝"
    echo ""
}

# Command line arguments
case "${1:-monitor}" in
    monitor)
        monitor
        ;;
    status)
        status
        ;;
    alert)
        send_email_alert "Test Alert" "This is a test alert from CyberSec Pro monitoring system."
        ;;
    *)
        echo "Usage: $0 {monitor|status|alert}"
        exit 1
        ;;
esac
