#!/bin/bash

# 🚀 CyberSec Pro SaaS Infrastructure Setup
# World-class cybersecurity platform deployment

set -e

echo "🛡️  CyberSec Pro SaaS Infrastructure Setup Starting..."
echo "📅 $(date)"
echo "🌍 Building world-class cybersecurity platform..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
echo "🔧 Installing essential packages..."
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
    certbot \
    python3-certbot-nginx \
    postgresql \
    postgresql-contrib \
    redis-server

# Install Cloudflare Tunnel
echo "☁️  Installing Cloudflare Tunnel..."
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
rm cloudflared-linux-amd64.deb

# Install Docker (for future containerization)
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
rm get-docker.sh

# Install Docker Compose
echo "🐙 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Setup firewall
echo "🔥 Configuring firewall..."
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# Create application directories
echo "📁 Creating application directories..."
sudo mkdir -p /var/www/cybersec-pro
sudo mkdir -p /var/log/cybersec-pro
sudo chown -R $USER:$USER /var/www/cybersec-pro
sudo chown -R $USER:$USER /var/log/cybersec-pro

# Setup Python virtual environment
echo "🐍 Setting up Python environment..."
python3 -m venv /var/www/cybersec-pro/venv
source /var/www/cybersec-pro/venv/bin/activate

# Install Python packages
pip install --upgrade pip
pip install \
    flask \
    flask-cors \
    flask-sqlalchemy \
    flask-migrate \
    flask-jwt-extended \
    stripe \
    psycopg2-binary \
    redis \
    celery \
    gunicorn \
    requests \
    python-dotenv \
    bcrypt \
    email-validator

# Setup Node.js environment
echo "📦 Setting up Node.js environment..."
sudo npm install -g pm2 yarn

# Start essential services
echo "🚀 Starting essential services..."
sudo systemctl enable nginx
sudo systemctl enable postgresql
sudo systemctl enable redis-server
sudo systemctl start postgresql
sudo systemctl start redis-server

echo "✅ Infrastructure setup completed!"
echo "🎯 Next: Configure Cloudflare Tunnel and deploy application"