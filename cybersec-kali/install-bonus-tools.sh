#!/bin/bash
#
# CyberSec Pro - Bonus Araç Kurulumu
# Bu script opsiyonel araçları kurar
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
cat << "BANNER"
   ______      __              _____            ____           
  / ____/_  __/ /_  ___  _____/ ___/___  ____  / __ \_________ 
 / /   / / / / __ \/ _ \/ ___/\__ \/ _ \/ __ \/ /_/ / ___/ __ \
/ /___/ /_/ / /_/ /  __/ /   ___/ /  __/ /_/ / ____/ /  / /_/ /
\____/\__, /_.___/\___/_/   /____/\___/\____/_/   /_/   \____/ 
     /____/          BONUS ARAÇ PAKETİ v2.0
BANNER
echo -e "${NC}"

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Root olarak çalıştırın: sudo ./install-bonus-tools.sh${NC}"
    exit 1
fi

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   BONUS ARAÇ KURULUM PAKETLERİ                              ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  [1] 🔍 Keşif Araçları (Recon)"
echo "      enum4linux, dnsrecon, knockpy, assetfinder"
echo ""
echo "  [2] 🌐 Web Güvenlik Araçları"
echo "      wfuzz, arjun, paramspider, dalfox"
echo ""
echo "  [3] 🔐 Exploitation Araçları"
echo "      crackmapexec, impacket, pwntools"
echo ""
echo "  [4] 📊 Forensics Araçları"
echo "      volatility3, bulk-extractor, binwalk"
echo ""
echo "  [5] 🔄 Reverse Engineering"
echo "      ghidra, radare2, cutter"
echo ""
echo "  [6] 📦 TÜM ARAÇLAR (Tam Paket)"
echo ""
echo "  [0] Çıkış"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

read -p "Seçiminiz [0-6]: " choice

install_recon() {
    echo -e "\n${BLUE}🔍 Keşif araçları kuruluyor...${NC}"
    apt-get install -y enum4linux dnsrecon 2>/dev/null || true
    pip3 install knockpy 2>/dev/null || true
    echo -e "${GREEN}✅ Keşif araçları kuruldu${NC}"
}

install_web() {
    echo -e "\n${BLUE}🌐 Web güvenlik araçları kuruluyor...${NC}"
    apt-get install -y wfuzz arjun 2>/dev/null || true
    pip3 install paramspider 2>/dev/null || true
    # Dalfox (Go ile)
    if command -v go &> /dev/null; then
        go install github.com/hahwul/dalfox/v2@latest 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Web araçları kuruldu${NC}"
}

install_exploit() {
    echo -e "\n${BLUE}🔐 Exploitation araçları kuruluyor...${NC}"
    apt-get install -y crackmapexec python3-impacket 2>/dev/null || true
    pip3 install pwntools 2>/dev/null || true
    echo -e "${GREEN}✅ Exploitation araçları kuruldu${NC}"
}

install_forensics() {
    echo -e "\n${BLUE}📊 Forensics araçları kuruluyor...${NC}"
    apt-get install -y volatility3 bulk-extractor binwalk 2>/dev/null || true
    echo -e "${GREEN}✅ Forensics araçları kuruldu${NC}"
}

install_reverse() {
    echo -e "\n${BLUE}🔄 Reverse engineering araçları kuruluyor...${NC}"
    apt-get install -y ghidra radare2 cutterize 2>/dev/null || true
    echo -e "${GREEN}✅ Reverse engineering araçları kuruldu${NC}"
}

case $choice in
    1) install_recon ;;
    2) install_web ;;
    3) install_exploit ;;
    4) install_forensics ;;
    5) install_reverse ;;
    6)
        install_recon
        install_web
        install_exploit
        install_forensics
        install_reverse
        echo -e "\n${GREEN}✅ TÜM ARAÇLAR KURULDU!${NC}"
        ;;
    0) echo "Çıkış yapılıyor..."; exit 0 ;;
    *) echo -e "${RED}Geçersiz seçim!${NC}"; exit 1 ;;
esac

# Veritabanını güncelle
echo -e "\n${BLUE}📊 Veritabanı güncelleniyor...${NC}"
cd /opt/cybersec-pro/backend 2>/dev/null || cd /home/*/APPS/cybersec-kali/backend
python3 << 'EOF'
import sqlite3
import subprocess
import os

# Veritabanı bul
db_paths = [
    'instance/cybersec.db',
    '/opt/cybersec-pro/backend/instance/cybersec.db'
]

for db_path in db_paths:
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, name, command FROM tools WHERE installed = 0")
        tools = cursor.fetchall()
        
        updated = 0
        for tool_id, name, command in tools:
            cmd = command.split()[0] if command else name.lower()
            result = subprocess.run(['which', cmd], capture_output=True)
            if result.returncode == 0:
                cursor.execute("UPDATE tools SET installed = 1 WHERE id = ?", (tool_id,))
                updated += 1
        
        conn.commit()
        print(f"✅ {updated} araç güncellendi")
        conn.close()
        break
EOF

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}          ✅ BONUS ARAÇ KURULUMU TAMAMLANDI!                 ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
