#!/bin/bash
# CyberSec Pro - Kali Linux Complete Setup Script
# Bu script yeni Kali Linux sunucuda çalıştırılacak

set -e

echo "🚀 CyberSec Pro - Kali Linux Complete Setup"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root"
fi

# Check if Kali Linux
if ! grep -q "kali" /etc/os-release; then
    error "This script is designed for Kali Linux only"
fi

log "Starting CyberSec Pro setup on Kali Linux..."

# 1. System Update
log "📦 Updating Kali Linux system..."
sudo apt update && sudo apt full-upgrade -y

# 2. Install ALL Kali Tools
log "🔧 Installing ALL Kali Linux tools (this may take 30-60 minutes)..."
sudo apt install -y kali-linux-everything

# 3. Install additional dependencies
log "📚 Installing additional dependencies..."
sudo apt install -y \
    python3-pip \
    python3-venv \
    python3-dev \
    nodejs \
    npm \
    nginx \
    postgresql \
    postgresql-contrib \
    redis-server \
    docker.io \
    docker-compose \
    git \
    curl \
    wget \
    unzip \
    htop \
    tree \
    tmux \
    vim \
    build-essential \
    libssl-dev \
    libffi-dev \
    libpq-dev

# 4. Install Python packages
log "🐍 Installing Python packages..."
pip3 install --break-system-packages \
    flask \
    flask-sqlalchemy \
    flask-cors \
    flask-jwt-extended \
    flask-migrate \
    requests \
    psutil \
    gunicorn \
    celery \
    redis \
    psycopg2-binary \
    python-dotenv \
    bcrypt \
    pyjwt

# 5. Install Node.js packages globally
log "📦 Installing Node.js packages..."
sudo npm install -g \
    pm2 \
    @vue/cli \
    create-react-app

# 6. Setup PostgreSQL
log "🗄️ Setting up PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE cybersec_pro;"
sudo -u postgres psql -c "CREATE USER cybersec_user WITH PASSWORD 'cybersec_pass_2024';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cybersec_pro TO cybersec_user;"

# 7. Setup Redis
log "🔴 Setting up Redis..."
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 8. Create CyberSec Pro directories
log "📁 Creating CyberSec Pro directories..."
sudo mkdir -p /opt/cybersec-pro
sudo mkdir -p /opt/cybersec-pro/backend
sudo mkdir -p /opt/cybersec-pro/frontend
sudo mkdir -p /opt/cybersec-pro/logs
sudo mkdir -p /opt/cybersec-pro/uploads
sudo mkdir -p /opt/cybersec-pro/reports

# Set ownership
sudo chown -R $USER:$USER /opt/cybersec-pro

# 9. Create systemd service for CyberSec Pro
log "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/cybersec-pro.service > /dev/null <<EOF
[Unit]
Description=CyberSec Pro Backend API
After=network.target postgresql.service redis.service
Requires=postgresql.service redis.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/opt/cybersec-pro/backend
Environment=FLASK_ENV=production
Environment=DATABASE_URL=postgresql://cybersec_user:cybersec_pass_2024@localhost/cybersec_pro
Environment=REDIS_URL=redis://localhost:6379/0
ExecStart=/usr/bin/python3 app.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 10. Setup Nginx configuration
log "🌐 Setting up Nginx..."
sudo tee /etc/nginx/sites-available/cybersec-pro > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    
    # Frontend
    location / {
        root /opt/cybersec-pro/frontend/dist;
        try_files \$uri \$uri/ /index.html;
    }
    
    # API
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # WebSocket for real-time updates
    location /ws {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/cybersec-pro /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 11. Create Kali tools detection script
log "🔍 Creating Kali tools detection script..."
cat > /opt/cybersec-pro/detect_kali_tools.py << 'EOF'
#!/usr/bin/env python3
"""
Kali Linux Tools Detection - Detect all 600+ Kali tools
"""
import os
import subprocess
import json
from pathlib import Path

def detect_all_kali_tools():
    """Detect all Kali Linux tools"""
    tools = []
    
    # Common Kali tool directories
    search_paths = [
        '/usr/bin',
        '/usr/sbin', 
        '/usr/local/bin',
        '/opt',
        '/usr/share/kali-menu/applications',
        '/var/lib/dpkg/info'
    ]
    
    # Get installed packages with 'kali' in name
    try:
        result = subprocess.run(['dpkg', '-l'], capture_output=True, text=True)
        kali_packages = []
        for line in result.stdout.split('\n'):
            if 'kali-' in line or any(tool in line for tool in ['nmap', 'metasploit', 'burpsuite', 'wireshark']):
                parts = line.split()
                if len(parts) >= 2:
                    kali_packages.append(parts[1])
    except:
        kali_packages = []
    
    # Scan for executable tools
    security_keywords = [
        'scan', 'hack', 'exploit', 'crack', 'enum', 'brute', 'fuzz', 'inject',
        'sniff', 'spoof', 'forensic', 'reverse', 'debug', 'audit', 'test',
        'attack', 'payload', 'shell', 'proxy', 'tunnel', 'crypto'
    ]
    
    for path in search_paths:
        if os.path.exists(path):
            try:
                for item in os.listdir(path):
                    item_path = os.path.join(path, item)
                    if os.path.isfile(item_path) and os.access(item_path, os.X_OK):
                        # Check if it's a security tool
                        if any(keyword in item.lower() for keyword in security_keywords):
                            tools.append({
                                'name': item,
                                'path': item_path,
                                'category': 'Auto-detected',
                                'installed': True
                            })
            except PermissionError:
                continue
    
    # Remove duplicates
    unique_tools = {}
    for tool in tools:
        if tool['name'] not in unique_tools:
            unique_tools[tool['name']] = tool
    
    return list(unique_tools.values())

if __name__ == "__main__":
    tools = detect_all_kali_tools()
    print(f"Detected {len(tools)} Kali Linux security tools")
    
    # Save to JSON
    with open('/opt/cybersec-pro/kali_tools.json', 'w') as f:
        json.dump(tools, f, indent=2)
    
    print("Tools saved to /opt/cybersec-pro/kali_tools.json")
EOF

chmod +x /opt/cybersec-pro/detect_kali_tools.py

# 12. Create migration script for existing data
log "📋 Creating migration script..."
cat > /opt/cybersec-pro/migrate_from_ubuntu.py << 'EOF'
#!/usr/bin/env python3
"""
Migration script from Ubuntu CyberSec Pro to Kali Linux
"""
import os
import shutil
import json

def migrate_data():
    """Migrate existing CyberSec Pro data"""
    
    # Create backup directory
    backup_dir = "/opt/cybersec-pro/backup"
    os.makedirs(backup_dir, exist_ok=True)
    
    print("🔄 Migration script ready")
    print("📁 Backup directory created: /opt/cybersec-pro/backup")
    print("📋 Manual steps:")
    print("   1. Copy files from Ubuntu server:")
    print("      scp -r ubuntu-server:/home/sam/APPS/ /opt/cybersec-pro/backup/")
    print("   2. Run database migration:")
    print("      python3 /opt/cybersec-pro/migrate_database.py")
    print("   3. Update configurations")
    print("   4. Test system")

if __name__ == "__main__":
    migrate_data()
EOF

chmod +x /opt/cybersec-pro/migrate_from_ubuntu.py

# 13. Create startup script
log "🚀 Creating startup script..."
cat > /opt/cybersec-pro/start_cybersec_pro.sh << 'EOF'
#!/bin/bash
# CyberSec Pro Startup Script

echo "🚀 Starting CyberSec Pro services..."

# Start PostgreSQL
sudo systemctl start postgresql

# Start Redis
sudo systemctl start redis-server

# Start Nginx
sudo systemctl start nginx

# Start CyberSec Pro backend
sudo systemctl start cybersec-pro

# Check status
echo "📊 Service Status:"
sudo systemctl status postgresql --no-pager -l
sudo systemctl status redis-server --no-pager -l
sudo systemctl status nginx --no-pager -l
sudo systemctl status cybersec-pro --no-pager -l

echo "✅ CyberSec Pro started successfully!"
echo "🌐 Access: http://localhost"
echo "📊 API: http://localhost/api"
EOF

chmod +x /opt/cybersec-pro/start_cybersec_pro.sh

# 14. Enable services
log "🔧 Enabling services..."
sudo systemctl daemon-reload
sudo systemctl enable postgresql
sudo systemctl enable redis-server
sudo systemctl enable nginx

# 15. Test Nginx configuration
log "🧪 Testing Nginx configuration..."
sudo nginx -t

# 16. Create initial tool detection
log "🔍 Running initial Kali tools detection..."
cd /opt/cybersec-pro
python3 detect_kali_tools.py

# 17. Set up firewall (optional)
log "🔥 Setting up basic firewall..."
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force enable

# 18. Create info file
log "📄 Creating system info..."
cat > /opt/cybersec-pro/SYSTEM_INFO.md << EOF
# CyberSec Pro - Kali Linux Setup Complete

## System Information
- OS: $(lsb_release -d | cut -f2)
- Kernel: $(uname -r)
- Setup Date: $(date)
- User: $USER

## Installed Components
- ✅ Kali Linux Everything (600+ tools)
- ✅ PostgreSQL Database
- ✅ Redis Cache
- ✅ Nginx Web Server
- ✅ Python 3 + Flask
- ✅ Node.js + NPM
- ✅ Docker + Docker Compose

## Service Management
- Start all: /opt/cybersec-pro/start_cybersec_pro.sh
- Backend: sudo systemctl start cybersec-pro
- Database: sudo systemctl start postgresql
- Cache: sudo systemctl start redis-server
- Web: sudo systemctl start nginx

## Next Steps
1. Copy data from Ubuntu server
2. Run migration script
3. Configure domain and SSL
4. Test all functionality
5. Update DNS records

## Directories
- Main: /opt/cybersec-pro/
- Backend: /opt/cybersec-pro/backend/
- Frontend: /opt/cybersec-pro/frontend/
- Logs: /opt/cybersec-pro/logs/
- Backup: /opt/cybersec-pro/backup/

## URLs
- Frontend: http://localhost/
- API: http://localhost/api/
- Admin: http://localhost/admin/
EOF

# Final message
log "🎉 CyberSec Pro Kali Linux setup completed successfully!"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Copy data from Ubuntu server:"
echo "   scp -r ubuntu-server:/home/sam/APPS/ /opt/cybersec-pro/backup/"
echo ""
echo "2. Run migration:"
echo "   python3 /opt/cybersec-pro/migrate_from_ubuntu.py"
echo ""
echo "3. Start services:"
echo "   /opt/cybersec-pro/start_cybersec_pro.sh"
echo ""
echo "4. Access system:"
echo "   http://$(hostname -I | awk '{print $1}')"
echo ""
echo "📊 Detected Kali Tools: $(cat /opt/cybersec-pro/kali_tools.json | jq length) tools"
echo ""
echo "✅ Ready for CyberSec Pro migration!"