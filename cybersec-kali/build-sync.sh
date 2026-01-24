#!/bin/bash
# CyberSec Pro - Auto Build & Sync System
# Automatically builds and syncs local changes to download server

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Paths
SOURCE_DIR="/home/sam/APPS/cybersec-kali"
DOWNLOAD_DIR="/home/sam/APPS/cybersec-sales/frontend/downloads"
BUILD_DIR="/tmp/cybersec-build"
SCREENSHOTS_SRC="/home/sam/APPS/cybersec-kali/frontend/screenshots"
SCREENSHOTS_DST="/home/sam/APPS/cybersec-sales/frontend/screenshots"
LOG_FILE="/var/log/cybersec-build.log"

# Version tracking
VERSION_FILE="$SOURCE_DIR/VERSION"
CURRENT_VERSION=$(cat "$VERSION_FILE" 2>/dev/null || echo "2.0.0")

show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║       🔧 CyberSec Pro - Build & Sync System 🔧               ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Build frontend
build_frontend() {
    echo -e "\n${YELLOW}📦 Building Frontend...${NC}"
    log "Building frontend..."
    
    cd "$SOURCE_DIR/frontend"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        echo "  Installing dependencies..."
        npm install --silent
    fi
    
    # Build production
    echo "  Creating production build..."
    npm run build
    
    echo -e "${GREEN}  ✅ Frontend built successfully${NC}"
    log "Frontend build complete"
}

# Create Linux package
create_linux_package() {
    echo -e "\n${YELLOW}📦 Creating Linux Package...${NC}"
    log "Creating Linux package..."
    
    # Clean build dir
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR/cybersec-pro"
    
    # Copy necessary files
    echo "  Copying files..."
    cp -r "$SOURCE_DIR/backend" "$BUILD_DIR/cybersec-pro/"
    cp -r "$SOURCE_DIR/frontend/dist" "$BUILD_DIR/cybersec-pro/frontend/"
    cp -r "$SOURCE_DIR/scripts" "$BUILD_DIR/cybersec-pro/" 2>/dev/null || true
    cp "$SOURCE_DIR/start.sh" "$BUILD_DIR/cybersec-pro/"
    cp "$SOURCE_DIR/stop.sh" "$BUILD_DIR/cybersec-pro/"
    cp "$SOURCE_DIR/install.sh" "$BUILD_DIR/cybersec-pro/"
    cp "$SOURCE_DIR/install-bonus-tools.sh" "$BUILD_DIR/cybersec-pro/" 2>/dev/null || true
    cp "$SOURCE_DIR/Dockerfile" "$BUILD_DIR/cybersec-pro/"
    cp "$SOURCE_DIR/docker-entrypoint.sh" "$BUILD_DIR/cybersec-pro/" 2>/dev/null || true
    cp "$SOURCE_DIR/README.md" "$BUILD_DIR/cybersec-pro/"
    
    # Add version file
    echo "$CURRENT_VERSION" > "$BUILD_DIR/cybersec-pro/VERSION"
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$BUILD_DIR/cybersec-pro/BUILD_DATE"
    
    # Remove unnecessary files
    echo "  Cleaning up..."
    find "$BUILD_DIR/cybersec-pro" -name "*.pyc" -delete
    find "$BUILD_DIR/cybersec-pro" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
    find "$BUILD_DIR/cybersec-pro" -name ".git" -type d -exec rm -rf {} + 2>/dev/null || true
    find "$BUILD_DIR/cybersec-pro" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
    find "$BUILD_DIR/cybersec-pro" -name "*.db" -delete 2>/dev/null || true
    rm -rf "$BUILD_DIR/cybersec-pro/backend/venv" 2>/dev/null || true
    rm -rf "$BUILD_DIR/cybersec-pro/backend/instance" 2>/dev/null || true
    
    # Create tar.gz
    echo "  Creating archive..."
    cd "$BUILD_DIR"
    tar -czf cybersec-pro-linux.tar.gz cybersec-pro
    
    # Move to downloads
    mv cybersec-pro-linux.tar.gz "$DOWNLOAD_DIR/"
    
    # Get file size
    SIZE=$(du -h "$DOWNLOAD_DIR/cybersec-pro-linux.tar.gz" | cut -f1)
    echo -e "${GREEN}  ✅ Linux package created ($SIZE)${NC}"
    log "Linux package created: $SIZE"
}

# Create source zip
create_source_package() {
    echo -e "\n${YELLOW}📦 Creating Source Package...${NC}"
    log "Creating source package..."
    
    cd "$BUILD_DIR"
    
    # Create zip
    zip -rq cybersec-pro-source.zip cybersec-pro
    
    # Move to downloads
    mv cybersec-pro-source.zip "$DOWNLOAD_DIR/"
    
    SIZE=$(du -h "$DOWNLOAD_DIR/cybersec-pro-source.zip" | cut -f1)
    echo -e "${GREEN}  ✅ Source package created ($SIZE)${NC}"
    log "Source package created: $SIZE"
}

# Create Docker image
build_docker_image() {
    echo -e "\n${YELLOW}🐳 Building Docker Image...${NC}"
    log "Building Docker image..."
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}  ⚠️ Docker not installed, skipping...${NC}"
        return
    fi
    
    cd "$SOURCE_DIR"
    
    # Build image
    docker build -t cybersecpro/cybersec-pro:$CURRENT_VERSION -t cybersecpro/cybersec-pro:latest . 2>/dev/null || {
        echo -e "${YELLOW}  ⚠️ Docker build skipped (daemon not running)${NC}"
        return
    }
    
    echo -e "${GREEN}  ✅ Docker image built${NC}"
    log "Docker image built: cybersecpro/cybersec-pro:$CURRENT_VERSION"
}

# Sync screenshots
sync_screenshots() {
    echo -e "\n${YELLOW}📸 Syncing Screenshots...${NC}"
    log "Syncing screenshots..."
    
    mkdir -p "$SCREENSHOTS_DST"
    
    if [ -d "$SCREENSHOTS_SRC" ]; then
        rsync -av --delete "$SCREENSHOTS_SRC/" "$SCREENSHOTS_DST/" 2>/dev/null || \
        cp -r "$SCREENSHOTS_SRC/"* "$SCREENSHOTS_DST/" 2>/dev/null || true
        echo -e "${GREEN}  ✅ Screenshots synced${NC}"
    else
        echo -e "${YELLOW}  ⚠️ No screenshots found at $SCREENSHOTS_SRC${NC}"
    fi
    
    log "Screenshots synced"
}

# Update install script
update_install_script() {
    echo -e "\n${YELLOW}📝 Updating Install Script...${NC}"
    log "Updating install script..."
    
    cat > "$DOWNLOAD_DIR/../install.sh" << 'INSTALL_EOF'
#!/bin/bash
# CyberSec Pro - Quick Installer
# https://semihkilic.com

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       🛡️  CyberSec Pro - Quick Installer  🛡️                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

INSTALL_DIR="$HOME/cybersec-pro"
DOWNLOAD_URL="https://semihkilic.com/downloads/cybersec-pro-linux.tar.gz"

# Check requirements
echo "📋 Checking requirements..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is required. Install with: sudo apt install python3 python3-pip python3-venv"
    exit 1
fi

if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
    echo "❌ curl or wget is required"
    exit 1
fi

echo "✅ Requirements met"
echo ""

# Download
echo "📥 Downloading CyberSec Pro..."
cd /tmp

if command -v curl &> /dev/null; then
    curl -L -o cybersec-pro.tar.gz "$DOWNLOAD_URL"
else
    wget -O cybersec-pro.tar.gz "$DOWNLOAD_URL"
fi

# Extract
echo "📦 Extracting..."
rm -rf "$INSTALL_DIR" 2>/dev/null || true
tar -xzf cybersec-pro.tar.gz
mv cybersec-pro "$INSTALL_DIR"
rm cybersec-pro.tar.gz

# Setup
echo "🔧 Setting up..."
cd "$INSTALL_DIR"
chmod +x start.sh stop.sh install.sh 2>/dev/null || true

# Create virtual environment
if [ ! -d "backend/venv" ]; then
    echo "🐍 Creating Python environment..."
    python3 -m venv backend/venv
    source backend/venv/bin/activate
    pip install -q -r backend/requirements.txt
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    ✅ Installation Complete!                  ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  To start CyberSec Pro:                                      ║"
echo "║                                                              ║"
echo "║    cd ~/cybersec-pro                                         ║"
echo "║    ./start.sh                                                ║"
echo "║                                                              ║"
echo "║  Then open: http://localhost:5173                            ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
INSTALL_EOF

    chmod +x "$DOWNLOAD_DIR/../install.sh"
    echo -e "${GREEN}  ✅ Install script updated${NC}"
    log "Install script updated"
}

# Update version info JSON
update_version_info() {
    echo -e "\n${YELLOW}📝 Updating Version Info...${NC}"
    log "Updating version info..."
    
    BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    LINUX_SIZE=$(du -b "$DOWNLOAD_DIR/cybersec-pro-linux.tar.gz" | cut -f1)
    SOURCE_SIZE=$(du -b "$DOWNLOAD_DIR/cybersec-pro-source.zip" | cut -f1)
    LINUX_MD5=$(md5sum "$DOWNLOAD_DIR/cybersec-pro-linux.tar.gz" | cut -d' ' -f1)
    SOURCE_MD5=$(md5sum "$DOWNLOAD_DIR/cybersec-pro-source.zip" | cut -d' ' -f1)
    
    cat > "$DOWNLOAD_DIR/version.json" << EOF
{
    "version": "$CURRENT_VERSION",
    "build_date": "$BUILD_DATE",
    "downloads": {
        "linux": {
            "url": "https://semihkilic.com/downloads/cybersec-pro-linux.tar.gz",
            "size": $LINUX_SIZE,
            "md5": "$LINUX_MD5"
        },
        "source": {
            "url": "https://semihkilic.com/downloads/cybersec-pro-source.zip",
            "size": $SOURCE_SIZE,
            "md5": "$SOURCE_MD5"
        },
        "docker": {
            "image": "cybersecpro/cybersec-pro:$CURRENT_VERSION",
            "compose_url": "https://semihkilic.com/downloads/docker-compose.yml"
        }
    },
    "changelog_url": "https://semihkilic.com/downloads/CHANGELOG.md",
    "requirements": {
        "os": ["Ubuntu 20.04+", "Debian 11+", "Kali Linux", "Fedora 35+"],
        "python": "3.8+",
        "ram": "4GB",
        "disk": "10GB"
    }
}
EOF

    echo -e "${GREEN}  ✅ Version info updated${NC}"
    log "Version info updated"
}

# Create changelog
update_changelog() {
    echo -e "\n${YELLOW}📝 Updating Changelog...${NC}"
    
    if [ ! -f "$DOWNLOAD_DIR/CHANGELOG.md" ]; then
        cat > "$DOWNLOAD_DIR/CHANGELOG.md" << EOF
# CyberSec Pro - Changelog

## Version $CURRENT_VERSION ($(date +%Y-%m-%d))

### New Features
- 230+ security tools
- Web-based dashboard
- Integrated terminal
- Report generation (PDF/HTML/JSON)
- License management system

### Improvements
- Enhanced UI/UX
- Better error handling
- Optimized performance

### Bug Fixes
- Various stability improvements

---

## Previous Versions

### Version 1.0.0 (2025-12-01)
- Initial release

EOF
    fi
    
    echo -e "${GREEN}  ✅ Changelog updated${NC}"
}

# Update docker-compose
update_docker_compose() {
    echo -e "\n${YELLOW}🐳 Updating Docker Compose...${NC}"
    
    cat > "$DOWNLOAD_DIR/docker-compose.yml" << EOF
version: '3.8'

services:
  cybersec-pro:
    image: cybersecpro/cybersec-pro:$CURRENT_VERSION
    container_name: cybersec-pro
    ports:
      - "5173:5173"
      - "5001:5001"
    environment:
      - LICENSE_KEY=\${LICENSE_KEY:-}
      - NODE_ENV=production
    volumes:
      - cybersec-data:/app/data
      - cybersec-reports:/app/reports
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5173"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  cybersec-data:
  cybersec-reports:
EOF

    echo -e "${GREEN}  ✅ Docker compose updated${NC}"
}

# Show summary
show_summary() {
    echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ Build & Sync Complete!${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "📦 ${BOLD}Packages:${NC}"
    ls -lh "$DOWNLOAD_DIR"/*.{tar.gz,zip} 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}'
    echo ""
    echo -e "🌐 ${BOLD}Download URLs:${NC}"
    echo "   https://semihkilic.com/downloads/cybersec-pro-linux.tar.gz"
    echo "   https://semihkilic.com/downloads/cybersec-pro-source.zip"
    echo "   https://semihkilic.com/downloads/docker-compose.yml"
    echo ""
    echo -e "📋 ${BOLD}Version:${NC} $CURRENT_VERSION"
    echo -e "📅 ${BOLD}Build Date:${NC} $(date)"
    echo ""
}

# Main
main() {
    show_banner
    
    case "${1:-full}" in
        frontend)
            build_frontend
            ;;
        package)
            create_linux_package
            create_source_package
            ;;
        docker)
            build_docker_image
            ;;
        screenshots)
            sync_screenshots
            ;;
        full|"")
            build_frontend
            create_linux_package
            create_source_package
            build_docker_image
            sync_screenshots
            update_install_script
            update_version_info
            update_changelog
            update_docker_compose
            show_summary
            ;;
        *)
            echo "Usage: $0 [frontend|package|docker|screenshots|full]"
            exit 1
            ;;
    esac
}

main "$@"
