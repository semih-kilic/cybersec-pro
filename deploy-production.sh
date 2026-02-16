#!/bin/bash

# 🛡️ CyberSec Pro SaaS - Production Deployment Script
# World-class cybersecurity platform - Enterprise deployment

set -e

echo "🛡️ CyberSec Pro SaaS - Production Deployment"
echo "=============================================="
echo "🌍 Deploying world-class cybersecurity platform..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/cybersec/cybersec-pro"
BACKEND_DIR="$PROJECT_DIR/saas-backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
NGINX_CONFIG="$PROJECT_DIR/nginx-production.conf"
CLOUDFLARE_CONFIG="$PROJECT_DIR/cloudflare/config.yml"

# Function to print status
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as correct user
if [ "$USER" != "cybersec" ]; then
    print_error "This script must be run as the 'cybersec' user"
    exit 1
fi

# Change to project directory
cd "$PROJECT_DIR"

print_status "Starting production deployment..."

# 1. Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install required packages
print_status "Installing required packages..."
sudo apt install -y nginx python3-pip python3-venv nodejs npm redis-server postgresql postgresql-contrib

# 3. Setup Python virtual environment
print_status "Setting up Python virtual environment..."
cd "$BACKEND_DIR"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 4. Setup Node.js dependencies
print_status "Installing Node.js dependencies..."
cd "$FRONTEND_DIR"
npm install

# 5. Build React frontend for production
print_status "Building React frontend for production..."
npm run build

# 6. Configure Nginx
print_status "Configuring Nginx..."
sudo cp "$NGINX_CONFIG" /etc/nginx/sites-available/cybersec-production.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/cybersec-production.conf /etc/nginx/sites-enabled/
sudo nginx -t
if [ $? -eq 0 ]; then
    print_success "Nginx configuration is valid"
    sudo systemctl reload nginx
else
    print_error "Nginx configuration is invalid"
    exit 1
fi

# 7. Setup systemd services
print_status "Creating systemd services..."

# Backend service
sudo tee /etc/systemd/system/cybersec-backend.service > /dev/null <<EOF
[Unit]
Description=CyberSec Pro Enterprise Backend
After=network.target

[Service]
Type=simple
User=cybersec
WorkingDirectory=$BACKEND_DIR
Environment=PATH=$BACKEND_DIR/venv/bin
ExecStart=$BACKEND_DIR/venv/bin/python enterprise_app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Frontend service (for development - in production use nginx to serve static files)
sudo tee /etc/systemd/system/cybersec-frontend.service > /dev/null <<EOF
[Unit]
Description=CyberSec Pro React Frontend
After=network.target

[Service]
Type=simple
User=cybersec
WorkingDirectory=$FRONTEND_DIR
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Cloudflare tunnel service
sudo tee /etc/systemd/system/cybersec-tunnel.service > /dev/null <<EOF
[Unit]
Description=CyberSec Pro Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=cybersec
ExecStart=/usr/local/bin/cloudflared tunnel --config $CLOUDFLARE_CONFIG run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 8. Enable and start services
print_status "Enabling and starting services..."
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable cybersec-backend
sudo systemctl enable cybersec-frontend
sudo systemctl enable cybersec-tunnel
sudo systemctl enable nginx
sudo systemctl enable redis-server

# Start services
sudo systemctl start cybersec-backend
sudo systemctl start cybersec-frontend
sudo systemctl start redis-server

# Check service status
print_status "Checking service status..."
sleep 5

if systemctl is-active --quiet cybersec-backend; then
    print_success "Backend service is running"
else
    print_error "Backend service failed to start"
    sudo systemctl status cybersec-backend
fi

if systemctl is-active --quiet cybersec-frontend; then
    print_success "Frontend service is running"
else
    print_error "Frontend service failed to start"
    sudo systemctl status cybersec-frontend
fi

if systemctl is-active --quiet nginx; then
    print_success "Nginx is running"
else
    print_error "Nginx failed to start"
    sudo systemctl status nginx
fi

# 9. Setup firewall
print_status "Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 10. Setup log rotation
print_status "Setting up log rotation..."
sudo tee /etc/logrotate.d/cybersec-pro > /dev/null <<EOF
/var/log/nginx/cybersec-pro.*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
EOF

# 11. Create monitoring script
print_status "Creating monitoring script..."
tee "$PROJECT_DIR/monitor.sh" > /dev/null <<EOF
#!/bin/bash
# CyberSec Pro Monitoring Script

echo "🛡️ CyberSec Pro SaaS - System Status"
echo "===================================="
echo ""

# Check services
echo "📊 Service Status:"
echo "Backend:  \$(systemctl is-active cybersec-backend)"
echo "Frontend: \$(systemctl is-active cybersec-frontend)"
echo "Nginx:    \$(systemctl is-active nginx)"
echo "Redis:    \$(systemctl is-active redis-server)"
echo ""

# Check API health
echo "🔍 API Health Check:"
curl -s http://localhost/api/v2/tools | head -n 5
echo ""

# Check system resources
echo "💻 System Resources:"
echo "CPU Usage: \$(top -bn1 | grep "Cpu(s)" | awk '{print \$2}' | awk -F'%' '{print \$1}')"
echo "Memory Usage: \$(free | grep Mem | awk '{printf \"%.2f%%\", \$3/\$2 * 100.0}')"
echo "Disk Usage: \$(df -h / | awk 'NR==2{printf \"%s\", \$5}')"
echo ""

# Check network connectivity
echo "🌐 Network Status:"
if ping -c 1 google.com &> /dev/null; then
    echo "Internet: Connected"
else
    echo "Internet: Disconnected"
fi
EOF

chmod +x "$PROJECT_DIR/monitor.sh"

# 12. Setup cron jobs for monitoring
print_status "Setting up monitoring cron jobs..."
(crontab -l 2>/dev/null; echo "*/5 * * * * $PROJECT_DIR/monitor.sh >> /var/log/cybersec-monitor.log 2>&1") | crontab -

# 13. Final health check
print_status "Performing final health check..."
sleep 10

# Test API endpoints
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v2/tools)
if [ "$API_STATUS" = "200" ]; then
    print_success "API is responding correctly"
else
    print_warning "API returned status code: $API_STATUS"
fi

# Test frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
if [ "$FRONTEND_STATUS" = "200" ]; then
    print_success "Frontend is responding correctly"
else
    print_warning "Frontend returned status code: $FRONTEND_STATUS"
fi

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================="
print_success "CyberSec Pro SaaS platform is now running in production mode"
echo ""
echo "📊 Service URLs:"
echo "   • Frontend: http://localhost/"
echo "   • API: http://localhost/api/v2/"
echo "   • Health Check: http://localhost/health"
echo ""
echo "🔧 Management Commands:"
echo "   • Monitor: $PROJECT_DIR/monitor.sh"
echo "   • Restart Backend: sudo systemctl restart cybersec-backend"
echo "   • Restart Frontend: sudo systemctl restart cybersec-frontend"
echo "   • View Logs: sudo journalctl -u cybersec-backend -f"
echo ""
echo "🌍 Next Steps:"
echo "   1. Configure permanent Cloudflare tunnel for semihkilic.com"
echo "   2. Set up SSL certificates"
echo "   3. Configure database backups"
echo "   4. Set up monitoring alerts"
echo ""

# Post-deploy: trigger demo video re-recording (background)
if [ -f "$PROJECT_DIR/cybersec-sales/weekly-demo-cron.sh" ]; then
    print_status "Scheduling demo video re-record (background)..."
    nohup bash "$PROJECT_DIR/cybersec-sales/weekly-demo-cron.sh" > /tmp/demo-record.log 2>&1 &
    print_success "Demo video re-recording started in background"
fi

print_success "World-class cybersecurity platform is ready! 🛡️"