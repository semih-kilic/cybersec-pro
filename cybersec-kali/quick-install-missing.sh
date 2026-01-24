#!/bin/bash
"""
CyberSec Pro - Quick Missing Tools Installer
Hızlıca eksik 59 aracı kurar (5-10 dakika)
"""

set -e

echo "🚀 CyberSec Pro - Quick Missing Tools Installer"
echo "==============================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Get missing tools from API
print_status "Getting missing tools list..."
MISSING_TOOLS=$(curl -s "http://localhost:5001/api/tools/status" | jq -r '.missing_tools[].name' | head -20)

echo "📋 Missing tools to install:"
echo "$MISSING_TOOLS"

# Install via different methods
install_count=0

# Method 1: APT packages that exist
print_status "Installing via APT..."
apt_tools="volatility3 ghidra cutter radare2-cutter ida-free burpsuite zaproxy wireshark-qt"
for tool in $apt_tools; do
    if sudo apt install -y $tool 2>/dev/null; then
        print_success "Installed $tool"
        ((install_count++))
    else
        print_warning "Failed to install $tool via APT"
    fi
done

# Method 2: Snap packages
print_status "Installing via Snap..."
snap_tools="ghidra cutter ida-free burpsuite zaproxy"
for tool in $snap_tools; do
    if sudo snap install $tool 2>/dev/null; then
        print_success "Installed $tool"
        ((install_count++))
    else
        print_warning "Failed to install $tool via Snap"
    fi
done

# Method 3: Flatpak packages
print_status "Installing via Flatpak..."
if ! command -v flatpak &> /dev/null; then
    sudo apt install -y flatpak
    flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
fi

flatpak_tools="org.ghidra_sre.Ghidra com.github.radareorg.cutter"
for tool in $flatpak_tools; do
    if flatpak install -y flathub $tool 2>/dev/null; then
        print_success "Installed $tool"
        ((install_count++))
    else
        print_warning "Failed to install $tool via Flatpak"
    fi
done

# Method 4: Direct downloads
print_status "Installing via direct downloads..."

# Burp Suite Community
if [ ! -f "/opt/BurpSuiteCommunity/BurpSuiteCommunity" ]; then
    print_status "Installing Burp Suite Community..."
    wget -q "https://portswigger.net/burp/releases/download?product=community&type=Linux" -O burpsuite.sh
    chmod +x burpsuite.sh
    sudo ./burpsuite.sh -q
    rm burpsuite.sh
    print_success "Burp Suite installed"
    ((install_count++))
fi

# IDA Free
if [ ! -f "/opt/ida-free/ida64" ]; then
    print_status "Installing IDA Free..."
    wget -q "https://out7.hex-rays.com/files/idafree84_linux.run" -O ida-free.run
    chmod +x ida-free.run
    sudo ./ida-free.run --mode unattended --prefix /opt/ida-free
    sudo ln -sf /opt/ida-free/ida64 /usr/local/bin/ida-free
    rm ida-free.run
    print_success "IDA Free installed"
    ((install_count++))
fi

# Method 5: GitHub tools
print_status "Installing from GitHub..."

# Empire
if [ ! -d "/opt/Empire" ]; then
    print_status "Installing Empire..."
    sudo git clone https://github.com/EmpireProject/Empire.git /opt/Empire
    cd /opt/Empire
    sudo ./setup/install.sh
    sudo ln -sf /opt/Empire/empire /usr/local/bin/empire
    print_success "Empire installed"
    ((install_count++))
fi

# Veil
if [ ! -d "/opt/Veil" ]; then
    print_status "Installing Veil..."
    sudo git clone https://github.com/Veil-Framework/Veil.git /opt/Veil
    cd /opt/Veil
    sudo ./config/setup.sh --force --silent
    sudo ln -sf /opt/Veil/Veil.py /usr/local/bin/veil
    print_success "Veil installed"
    ((install_count++))
fi

# Method 6: Python tools with --break-system-packages
print_status "Installing Python tools..."
python_tools="faraday-client king-phisher drozer mobsf pacu scoutsuite bloodhound"
for tool in $python_tools; do
    if pip3 install --break-system-packages $tool 2>/dev/null; then
        print_success "Installed $tool"
        ((install_count++))
    else
        print_warning "Failed to install $tool"
    fi
done

# Method 7: Create symbolic links for existing tools
print_status "Creating symbolic links..."

# Link existing tools that might be installed but not detected
links=(
    "/usr/bin/msfconsole:/usr/local/bin/metasploit"
    "/usr/bin/burpsuite:/usr/local/bin/burp"
    "/usr/bin/zaproxy:/usr/local/bin/zap"
    "/usr/bin/ghidra:/usr/local/bin/ghidra"
    "/snap/bin/ghidra:/usr/local/bin/ghidra"
    "/usr/bin/radare2:/usr/local/bin/r2"
)

for link in "${links[@]}"; do
    src="${link%:*}"
    dst="${link#*:}"
    if [ -f "$src" ] && [ ! -f "$dst" ]; then
        sudo ln -sf "$src" "$dst"
        print_success "Linked $src -> $dst"
        ((install_count++))
    fi
done

# Method 8: Install missing Kali repositories
print_status "Adding Kali repositories for more tools..."
if [ ! -f "/etc/apt/sources.list.d/kali.list" ]; then
    wget -q -O - https://archive.kali.org/archive-key.asc | sudo apt-key add -
    echo "deb http://http.kali.org/kali kali-rolling main contrib non-free" | sudo tee /etc/apt/sources.list.d/kali.list
    sudo apt update -qq
    
    # Install some Kali-specific tools
    kali_tools="exploitdb searchsploit wpscan joomscan drupwn cmsmap skipfish uniscan"
    for tool in $kali_tools; do
        if sudo apt install -y $tool 2>/dev/null; then
            print_success "Installed $tool from Kali repo"
            ((install_count++))
        fi
    done
fi

# Update PATH
echo 'export PATH=$PATH:/opt/Empire:/opt/Veil:/opt/ida-free:/opt/BurpSuiteCommunity' | sudo tee -a /etc/environment

print_success "Quick installation completed!"
print_status "Installed $install_count additional tools"
print_status "Restarting CyberSec Pro backend to detect new tools..."

# Restart backend to detect new tools
cd /home/sam/APPS/cybersec-kali
if pgrep -f "gunicorn.*app:app" > /dev/null; then
    pkill -f "gunicorn.*app:app"
    sleep 2
fi

# Start backend
nohup ./backend/venv/bin/gunicorn --bind 0.0.0.0:5001 --workers 2 --threads 4 app:app > /dev/null 2>&1 &

sleep 5

# Check new status
print_status "Checking updated tool status..."
curl -s "http://localhost:5001/api/tools/status" | jq '{total, installed, installed_percentage}'

echo ""
echo "🎉 Quick installation completed!"
echo "📊 Check results: curl http://localhost:5001/api/tools/status"
echo "🔧 If more tools needed, we can continue with specific installations"