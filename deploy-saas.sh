#!/bin/bash

# 🛡️ CyberSec Pro SaaS Deployment Script
# World-class cybersecurity platform deployment automation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/var/www/cybersec-pro"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
NGINX_CONFIG="/etc/nginx/sites-available/semihkilic.com"
CLOUDFLARE_CONFIG="/home/cybersec/.cloudflared/config.yml"

echo -e "${BLUE}🛡️  CyberSec Pro SaaS Deployment Starting...${NC}"
echo -e "${BLUE}📅 $(date)${NC}"
echo -e "${BLUE}🌍 Deploying world-class cybersecurity platform...${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root for system operations
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        print_warning "Running as root. Some operations will be performed with elevated privileges."
    else
        print_status "Running as user: $(whoami)"
    fi
}

# Create project directories
setup_directories() {
    print_status "Setting up project directories..."
    
    sudo mkdir -p $PROJECT_DIR
    sudo mkdir -p $BACKEND_DIR
    sudo mkdir -p $FRONTEND_DIR
    sudo mkdir -p /var/log/cybersec-pro
    sudo mkdir -p /var/log/cloudflared
    
    # Set ownership
    sudo chown -R $USER:$USER $PROJECT_DIR
    sudo chown -R $USER:$USER /var/log/cybersec-pro
    
    print_status "Project directories created"
}

# Install system dependencies
install_dependencies() {
    print_status "Installing system dependencies..."
    
    # Update package list
    sudo apt update
    
    # Install essential packages
    sudo apt install -y \
        nginx \
        python3 \
        python3-pip \
        python3-venv \
        nodejs \
        npm \
        git \
        curl \
        wget \
        unzip \
        htop \
        ufw \
        postgresql \
        postgresql-contrib \
        redis-server \
        supervisor
    
    # Install Node.js 18+ if needed
    if ! node --version | grep -q "v1[8-9]\|v[2-9][0-9]"; then
        print_status "Installing Node.js 18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Install Cloudflare Tunnel
    if ! command -v cloudflared &> /dev/null; then
        print_status "Installing Cloudflare Tunnel..."
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i cloudflared-linux-amd64.deb
        rm cloudflared-linux-amd64.deb
    fi
    
    print_status "System dependencies installed"
}

# Setup Python backend
setup_backend() {
    print_status "Setting up Python backend..."
    
    # Copy backend files
    cp -r saas-backend/* $BACKEND_DIR/
    
    # Create virtual environment
    python3 -m venv $BACKEND_DIR/venv
    source $BACKEND_DIR/venv/bin/activate
    
    # Install Python dependencies
    pip install --upgrade pip
    pip install -r $BACKEND_DIR/requirements.txt
    
    # Create environment file
    cat > $BACKEND_DIR/.env << EOF
# CyberSec Pro SaaS Environment Configuration
SECRET_KEY=cybersec-pro-saas-$(openssl rand -hex 32)
JWT_SECRET_KEY=jwt-secret-$(openssl rand -hex 32)
DATABASE_URL=sqlite:///$BACKEND_DIR/cybersec_saas.db
STRIPE_SECRET_KEY=sk_test_your_stripe_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key_here
FLASK_ENV=production
FLASK_DEBUG=False
EOF
    
    # Initialize database
    cd $BACKEND_DIR
    python app.py &
    BACKEND_PID=$!
    sleep 5
    kill $BACKEND_PID
    
    print_status "Backend setup completed"
}

# Setup React frontend
setup_frontend() {
    print_status "Setting up React frontend..."
    
    # Copy frontend files
    cp -r saas-frontend/* $FRONTEND_DIR/
    
    # Install dependencies
    cd $FRONTEND_DIR
    npm install
    
    # Create environment file
    cat > $FRONTEND_DIR/.env << EOF
# CyberSec Pro SaaS Frontend Environment
VITE_API_URL=https://semihkilic.com/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key_here
VITE_APP_NAME=CyberSec Pro
VITE_APP_VERSION=2.0.0
EOF
    
    # Build for production
    npm run build
    
    print_status "Frontend setup completed"
}

# Configure Nginx
setup_nginx() {
    print_status "Configuring Nginx..."
    
    # Copy Nginx configuration
    sudo cp nginx/semihkilic.com.conf $NGINX_CONFIG
    
    # Enable site
    sudo ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/semihkilic.com
    
    # Remove default site
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    sudo nginx -t
    
    # Reload Nginx
    sudo systemctl reload nginx
    sudo systemctl enable nginx
    
    print_status "Nginx configured"
}

# Setup Cloudflare Tunnel
setup_cloudflare() {
    print_status "Setting up Cloudflare Tunnel..."
    
    # Create cloudflared directory
    mkdir -p /home/$USER/.cloudflared
    
    # Copy configuration
    cp cloudflare/config.yml $CLOUDFLARE_CONFIG
    
    print_warning "Manual step required:"
    print_warning "1. Run: cloudflared tunnel login"
    print_warning "2. Run: cloudflared tunnel create cybersec-pro-saas"
    print_warning "3. Copy the credentials file to ~/.cloudflared/"
    print_warning "4. Update DNS records in Cloudflare dashboard"
    
    print_status "Cloudflare Tunnel configuration ready"
}

# Setup systemd services
setup_services() {
    print_status "Setting up systemd services..."
    
    # Backend service
    sudo tee /etc/systemd/system/cybersec-backend.service > /dev/null << EOF
[Unit]
Description=CyberSec Pro SaaS Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$BACKEND_DIR
Environment=PATH=$BACKEND_DIR/venv/bin
ExecStart=$BACKEND_DIR/venv/bin/python app.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Cloudflare Tunnel service
    sudo tee /etc/systemd/system/cloudflared.service > /dev/null << EOF
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/local/bin/cloudflared tunnel --config $CLOUDFLARE_CONFIG run
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    sudo systemctl daemon-reload
    
    # Enable services
    sudo systemctl enable cybersec-backend.service
    sudo systemctl enable cloudflared.service
    
    print_status "Systemd services configured"
}

# Setup firewall
setup_firewall() {
    print_status "Configuring firewall..."
    
    # Enable UFW
    sudo ufw --force enable
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow HTTP/HTTPS
    sudo ufw allow 80
    sudo ufw allow 443
    
    # Allow specific ports for development
    sudo ufw allow 5001  # Backend API
    sudo ufw allow 3000  # Frontend dev server
    
    print_status "Firewall configured"
}

# Start services
start_services() {
    print_status "Starting services..."
    
    # Start database services
    sudo systemctl start postgresql
    sudo systemctl start redis-server
    
    # Start web services
    sudo systemctl start nginx
    
    # Start application services
    sudo systemctl start cybersec-backend
    
    print_status "Services started"
}

# Health check
health_check() {
    print_status "Performing health check..."
    
    # Check Nginx
    if sudo systemctl is-active --quiet nginx; then
        print_status "Nginx is running"
    else
        print_error "Nginx is not running"
    fi
    
    # Check backend
    if sudo systemctl is-active --quiet cybersec-backend; then
        print_status "Backend is running"
    else
        print_error "Backend is not running"
    fi
    
    # Check API endpoint
    if curl -f http://localhost:5001/ > /dev/null 2>&1; then
        print_status "Backend API is responding"
    else
        print_warning "Backend API is not responding"
    fi
    
    print_status "Health check completed"
}

# Display final information
show_completion_info() {
    echo ""
    echo -e "${GREEN}🎉 CyberSec Pro SaaS Deployment Completed!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Configure Cloudflare Tunnel:"
    echo "   cloudflared tunnel login"
    echo "   cloudflared tunnel create cybersec-pro-saas"
    echo ""
    echo "2. Update DNS records in Cloudflare:"
    echo "   semihkilic.com -> CNAME -> tunnel-id.cfargotunnel.com"
    echo ""
    echo "3. Configure Stripe keys in:"
    echo "   $BACKEND_DIR/.env"
    echo "   $FRONTEND_DIR/.env"
    echo ""
    echo "4. Start Cloudflare Tunnel:"
    echo "   sudo systemctl start cloudflared"
    echo ""
    echo -e "${BLUE}🔗 URLs:${NC}"
    echo "Website: https://semihkilic.com"
    echo "API: https://semihkilic.com/api"
    echo "Backend (local): http://localhost:5001"
    echo ""
    echo -e "${BLUE}📊 Service Status:${NC}"
    echo "sudo systemctl status cybersec-backend"
    echo "sudo systemctl status nginx"
    echo "sudo systemctl status cloudflared"
    echo ""
    echo -e "${GREEN}🛡️  CyberSec Pro SaaS is ready for the world!${NC}"
}

# Main deployment flow
main() {
    check_permissions
    setup_directories
    install_dependencies
    setup_backend
    setup_frontend
    setup_nginx
    setup_cloudflare
    setup_services
    setup_firewall
    start_services
    health_check
    show_completion_info
}

# Run deployment
main "$@"