#!/bin/bash

echo "🔧 CyberSec Pro - Missing Tools Installer"
echo "=========================================="
echo ""
echo "⚠️  DEPRECATED: All security tools run inside Docker containers."
echo "   No bare-metal tool installation needed."
echo ""
echo "   To use Kali tools: docker compose up -d kali-tools"
echo "   To use scan engine: docker compose up -d rust-scan-engine"
echo ""
exit 0
    
    # Post Exploitation
    "bloodhound" "neo4j" "weevely"
    
    # Sniffing & Spoofing
    "arpwatch" "macchanger" "mitmproxy" "sslstrip"
    
    # Stress Testing
    "slowhttptest" "t50"
    
    # Mobile Security
    "apktool" "dex2jar" "adb"
)

INSTALLED=0
FAILED=0
SKIPPED=0

echo ""
echo "📦 Installing ${#APT_TOOLS[@]} APT tools..."
echo ""

for tool in "${APT_TOOLS[@]}"; do
    if which "$tool" > /dev/null 2>&1; then
        echo "✅ $tool (exists)"
        ((SKIPPED++))
    else
        echo -n "📥 $tool... "
        if sudo apt-get install -y "$tool" > /dev/null 2>&1; then
            echo "✅"
            ((INSTALLED++))
        else
            echo "❌"
            ((FAILED++))
        fi
    fi
done

echo ""
echo "📦 Installing Python tools..."

pip3 install --quiet pwntools impacket mitmproxy requests beautifulsoup4 2>/dev/null && echo "✅ Python tools" || echo "❌ Some Python tools failed"

echo ""
echo "📦 Installing Go tools..."

if which go > /dev/null 2>&1; then
    export GOPATH=$HOME/go
    export PATH=$PATH:$GOPATH/bin
    
    go install github.com/tomnomnom/assetfinder@latest 2>/dev/null && echo "✅ assetfinder"
    go install github.com/projectdiscovery/httpx/cmd/httpx@latest 2>/dev/null && echo "✅ httpx"
    go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest 2>/dev/null && echo "✅ nuclei"
    go install github.com/ffuf/ffuf/v2@latest 2>/dev/null && echo "✅ ffuf"
    go install github.com/tomnomnom/waybackurls@latest 2>/dev/null && echo "✅ waybackurls"
    go install github.com/hakluke/hakrawler@latest 2>/dev/null && echo "✅ hakrawler"
    go install github.com/hahwul/dalfox/v2@latest 2>/dev/null && echo "✅ dalfox"
else
    echo "⚠️ Go not installed"
fi

echo ""
echo "=========================================="
echo "📊 Summary: Installed=$INSTALLED, Skipped=$SKIPPED, Failed=$FAILED"
echo "=========================================="
echo "✅ Done!"
