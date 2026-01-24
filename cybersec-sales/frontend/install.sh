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
if [ -d "cybersec-kali" ]; then
    mv cybersec-kali "$INSTALL_DIR"
else
    mv cybersec-pro "$INSTALL_DIR"
fi
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
