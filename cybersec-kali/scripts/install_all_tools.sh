#!/bin/bash
# Kali Linux Security Tools Installation Script
# This script installs all missing security tools

# Don't exit on error, continue with next package
# set -e

echo "============================================"
echo "  Kali Linux Security Tools Installer"
echo "============================================"
echo ""

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
INSTALLED=0
FAILED=0
SKIPPED=0

# Function to install package
install_pkg() {
    local pkg_name="$1"
    local display_name="$2"
    
    echo -n "Installing $display_name ($pkg_name)... "
    
    if dpkg -l "$pkg_name" &>/dev/null 2>&1; then
        echo -e "${YELLOW}ALREADY INSTALLED${NC}"
        ((SKIPPED++))
        return 0
    fi
    
    if sudo apt-get install -y "$pkg_name" &>/dev/null; then
        echo -e "${GREEN}SUCCESS${NC}"
        ((INSTALLED++))
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        ((FAILED++))
        return 1
    fi
}

# Update package lists first
echo "Updating package lists..."
sudo apt-get update -qq

echo ""
echo "Starting installation..."
echo ""

# Information Gathering Tools
install_pkg "maltego" "Maltego"
install_pkg "spiderfoot" "SpiderFoot"

# Vulnerability Analysis
install_pkg "openvas" "OpenVAS"
install_pkg "lynis" "Lynis"

# Web Application Tools
install_pkg "burpsuite" "Burp Suite"
install_pkg "skipfish" "Skipfish"
install_pkg "dirbuster" "Dirbuster"
install_pkg "joomscan" "Joomla Scanner"
install_pkg "cmsmap" "CMSmap"
install_pkg "arachni" "Arachni"
install_pkg "davtest" "DAVTest"
install_pkg "padbuster" "Padbuster"
install_pkg "xsser" "XSSer"

# Database Tools
install_pkg "sqlninja" "SQLNinja"
install_pkg "hexorbase" "Hexorbase"
install_pkg "bbqsql" "BBQSQL"

# Wireless Tools
install_pkg "kismet" "Kismet"
install_pkg "fern-wifi-cracker" "Fern Wifi Cracker"
install_pkg "mdk3" "Mdk3"
install_pkg "mdk4" "Mdk4"
install_pkg "airgeddon" "Airgeddon"
install_pkg "wifipumpkin3" "WiFi-Pumpkin"

# Exploitation Tools
install_pkg "beef-xss" "BeEF"
install_pkg "armitage" "Armitage"
install_pkg "veil" "Veil"
install_pkg "powersploit" "PowerSploit"
install_pkg "mimikatz" "Mimikatz"
install_pkg "empire-powershell" "Empire"
install_pkg "crackmapexec" "CrackMapExec"
install_pkg "evil-winrm" "Evil-WinRM"
install_pkg "impacket-scripts" "Impacket Scripts"

# Forensics
install_pkg "volatility3" "Volatility"
install_pkg "bulk-extractor" "Bulk Extractor"
install_pkg "foremost" "Foremost"
install_pkg "binwalk" "Binwalk"

# Reporting
install_pkg "dradis" "Dradis"
install_pkg "faraday" "Faraday"
install_pkg "pipal" "Pipal"

# Social Engineering
install_pkg "king-phisher" "King Phisher"
install_pkg "ghost-phisher" "Ghost Phisher"

# Reverse Engineering
install_pkg "radare2" "Radare2"
install_pkg "ghidra" "Ghidra"
install_pkg "cutter" "Cutter"
install_pkg "apktool" "APKTool"
install_pkg "jadx" "JADX"
install_pkg "dex2jar" "Dex2jar"
install_pkg "jd-gui" "JD-GUI"

# Mobile Security
install_pkg "drozer" "Drozer"
install_pkg "mobsf" "MobSF"
install_pkg "frida-tools" "Frida"
install_pkg "objection" "Objection"

# Network/Sniffing
install_pkg "mitmf" "MITMf"
install_pkg "sslstrip" "SSLStrip"
install_pkg "responder" "Responder"
install_pkg "bettercap" "Bettercap"
install_pkg "unicornscan" "Unicornscan"

# Cloud Security
install_pkg "scoutsuite" "ScoutSuite"
install_pkg "pacu" "Pacu"
install_pkg "prowler" "Prowler"
install_pkg "azure-cli" "Azure CLI"

# Password Tools
install_pkg "rainbowcrack" "Rainbowcrack"
install_pkg "hashid" "Hash-ID"
install_pkg "hash-identifier" "Hash Identifier"

# Hardware
install_pkg "proxmark3" "Proxmark3"
install_pkg "arduino" "Arduino"

# Other useful tools not in original list
install_pkg "exploitdb" "ExploitDB"
install_pkg "seclists" "SecLists"
install_pkg "wordlists" "Wordlists"
install_pkg "payloadsallthethings" "PayloadsAllTheThings"
install_pkg "webshells" "Web Shells"

echo ""
echo "============================================"
echo "  Installation Complete!"
echo "============================================"
echo ""
echo -e "  ${GREEN}Installed:${NC} $INSTALLED packages"
echo -e "  ${YELLOW}Skipped:${NC} $SKIPPED packages (already installed)"
echo -e "  ${RED}Failed:${NC} $FAILED packages"
echo ""
echo "Total tools processed: $((INSTALLED + SKIPPED + FAILED))"
