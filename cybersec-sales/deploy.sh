#!/bin/bash
# CyberSec Pro - Production Deployment Script
# semihkilic.com

set -e

echo "🚀 CyberSec Pro - Deploying to semihkilic.com"
echo "=============================================="

# Resolve install root
SALES_ROOT=${CYBERSEC_SALES_ROOT:-/home/sam/APPS/cybersec-sales}
SALES_USER=${CYBERSEC_SALES_USER:-${SUDO_USER:-$(whoami)}}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Check if running as root for some commands
check_sudo() {
    if ! sudo -n true 2>/dev/null; then
        echo -e "${YELLOW}Some commands require sudo. You may be prompted for password.${NC}"
    fi
}

# 2. Setup Nginx
setup_nginx() {
    echo -e "\n${GREEN}[1/5] Setting up Nginx...${NC}"
    sudo cp "$SALES_ROOT/nginx-cybersec.conf" /etc/nginx/sites-available/cybersec
    sudo sed -i "s|/home/sam/APPS/cybersec-sales|$SALES_ROOT|g" /etc/nginx/sites-available/cybersec
    sudo ln -sf /etc/nginx/sites-available/cybersec /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    echo "✅ Nginx configured"
}

# 3. Setup SSL with Let's Encrypt
setup_ssl() {
    echo -e "\n${GREEN}[2/5] Setting up SSL...${NC}"
    if ! command -v certbot &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx
    fi
    
    echo -e "${YELLOW}Running certbot for semihkilic.com...${NC}"
    sudo certbot --nginx -d semihkilic.com -d www.semihkilic.com --non-interactive --agree-tos --email admin@semihkilic.com || {
        echo "⚠️  SSL setup failed. Make sure DNS is pointing to this server."
        echo "You can run manually: sudo certbot --nginx -d semihkilic.com"
    }
}

# 4. Setup Systemd Service
setup_service() {
    echo -e "\n${GREEN}[3/5] Setting up backend service...${NC}"
    sudo cp "$SALES_ROOT/services/cybersec-sales.service" /etc/systemd/system/
    sudo sed -i "s|/home/sam/APPS/cybersec-sales|$SALES_ROOT|g" /etc/systemd/system/cybersec-sales.service
    sudo sed -i "s|^User=sam$|User=$SALES_USER|" /etc/systemd/system/cybersec-sales.service
    sudo systemctl daemon-reload
    sudo systemctl enable cybersec-sales
    sudo systemctl restart cybersec-sales
    echo "✅ Backend service started"
}

# 5. Initialize Database
init_db() {
    echo -e "\n${GREEN}[4/5] Initializing database...${NC}"
    cd "$SALES_ROOT/backend"
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install --upgrade pip >/dev/null
    if [ -f requirements.txt ]; then
        pip install -r requirements.txt
    fi
    python -c "from app import init_db; init_db(); print('Database ready')"
    echo "✅ Database initialized"
}

# 6. Final checks
final_checks() {
    echo -e "\n${GREEN}[5/5] Running final checks...${NC}"
    sleep 3
    
    # Check if service is running
    if systemctl is-active --quiet cybersec-sales; then
        echo "✅ Backend service: Running"
    else
        echo "❌ Backend service: Not running"
        sudo journalctl -u cybersec-sales -n 20
    fi
    
    # Check nginx
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx: Running"
    else
        echo "❌ Nginx: Not running"
    fi
    
    # Test API
    if curl -s http://127.0.0.1:5002/api/plans > /dev/null; then
        echo "✅ API: Responding"
    else
        echo "❌ API: Not responding"
    fi
}

# Main
check_sudo
setup_nginx
setup_ssl
setup_service
init_db
final_checks

echo ""
echo "=============================================="
echo "🎉 Deployment Complete!"
echo ""
echo "📍 Website: https://semihkilic.com"
echo "📍 Admin: https://semihkilic.com/admin.html"
echo ""
echo "⚠️  Make sure your DNS is configured:"
echo "   A Record: semihkilic.com → $(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo "   CNAME: www.semihkilic.com → semihkilic.com"
echo ""
echo "🔧 Useful commands:"
echo "   sudo systemctl status cybersec-sales  # Check service"
echo "   sudo journalctl -u cybersec-sales -f  # View logs"
echo "   sudo nginx -t && sudo systemctl reload nginx  # Reload nginx"
