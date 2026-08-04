#!/bin/bash

# 🚀 CyberSec Pro Infrastructure Setup
# Docker-based deployment — no bare-metal services needed.

set -e

echo "🛡️  CyberSec Pro Infrastructure Setup"
echo "📅 $(date)"

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker "$USER"
    rm get-docker.sh
fi

# Install Docker Compose plugin
echo "🐙 Installing Docker Compose..."
if ! docker compose version &> /dev/null; then
    sudo apt install -y docker-compose-plugin
fi

# Setup firewall — only expose 80/443 for nginx
echo "🔥 Configuring firewall..."
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Internal services are NOT exposed — only nginx reverse proxy

# Create application directories
echo "📁 Creating application directories..."
sudo mkdir -p /var/log/cybersec-pro
sudo chown -R "$USER:$USER" /var/log/cybersec-pro

# Create .env template if missing
if [ ! -f .env ]; then
    echo "⚠️  Creating .env template — EDIT WITH REAL VALUES!"
    cat > .env << 'EOF'
# REQUIRED: Set these before deploying!
DB_PASSWORD=change-me-db-password
REDIS_PASSWORD=change-me-redis-password
JWT_SECRET_KEY=change-me-jwt-secret-at-least-32-chars
API_SECRET=change-me-kali-api-secret
EOF
    chmod 600 .env
fi

echo "✅ Infrastructure setup completed!"
echo "🎯 Next: Edit .env with real secrets, then run: docker compose up -d"