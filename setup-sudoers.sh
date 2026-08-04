#!/bin/bash
# CyberSec Pro - Sudoers Configuration Script
# ⚠️ DEPRECATED: This script is NOT safe for production.
# All security tools run inside Docker containers with proper isolation.
# Use docker-compose.yml for all deployments.

echo "⚠️  This script is deprecated. All tools run in Docker containers."
echo "   Use: docker compose up -d"
exit 0
WEBAPP_USER="${WEBAPP_USER:-cybersec}"

echo -e "${YELLOW}📋 Yapılandırma:${NC}"
echo "   Kullanıcı: $WEBAPP_USER"
echo ""

# Sudoers dosyası
SUDOERS_FILE="/etc/sudoers.d/cybersec-tools"

# Güvenlik araçları listesi
SECURITY_TOOLS=(
    # Network scanning & analysis
    "/usr/bin/nmap"
    "/usr/bin/masscan"
    "/usr/bin/hping3"
    "/usr/sbin/tcpdump"
    "/usr/bin/arpspoof"
    "/usr/bin/responder"
    "/usr/bin/yersinia"
    "/usr/bin/sniffjoke"
    "/usr/bin/mdk3"
    
    # Wireless
    "/usr/bin/aircrack-ng"
    "/usr/bin/airgeddon"
    "/usr/bin/sparrow-wifi"
    "/usr/sbin/ohrwurm"
    
    # Exploitation & Post-exploitation
    "/usr/bin/setoolkit"
    "/usr/share/beef-xss/beef"
    "/usr/bin/beef-xss"
    "/usr/bin/beef-xss-stop"
    "/usr/bin/powershell-empire"
    "/usr/bin/legion"
    
    # Forensics
    "/usr/bin/dc3dd"
    "/usr/bin/dcfldd"
    "/usr/bin/dd_rescue"
    "/usr/bin/guymager"
    "/usr/bin/unhide"
    "/usr/bin/tsk_loaddb"
    "/usr/bin/chntpw"
    "/usr/bin/creddump7"
    "/usr/bin/grokevt-addlog"
    "/usr/bin/grokevt-builddb"
    "/usr/bin/xplico-webui"
    "/usr/bin/xplico-webui-stop"
    
    # Vulnerability scanning
    "/usr/bin/gvm-setup"
    "/usr/bin/gvm-start"
    "/usr/bin/gvm-stop"
    "/usr/bin/gvm-check-setup"
    "/usr/sbin/lynis"
)

echo -e "${YELLOW}🔧 Sudoers dosyası oluşturuluyor...${NC}"

# Sudoers içeriği oluştur
cat > "$SUDOERS_FILE" << 'SUDOERS_HEADER'
# CyberSec Pro - Security Tools NOPASSWD Configuration
# Generated automatically - Do not edit manually
#
# Bu dosya web uygulaması kullanıcısının belirli güvenlik
# araçlarını şifre girmeden çalıştırmasına izin verir.
#
# ⚠️ GÜVENLİK UYARISI: Bu yapılandırma sadece güvenli
# ortamlarda kullanılmalıdır!

# Defaults
Defaults:WEBAPP_USER !requiretty
Defaults:WEBAPP_USER env_keep += "PATH"

SUDOERS_HEADER

# WEBAPP_USER placeholder'ı değiştir
sed -i "s/WEBAPP_USER/$WEBAPP_USER/g" "$SUDOERS_FILE"

# Her araç için kural ekle
echo "" >> "$SUDOERS_FILE"
echo "# Security Tools - NOPASSWD rules" >> "$SUDOERS_FILE"

for tool in "${SECURITY_TOOLS[@]}"; do
    # Aracın var olup olmadığını kontrol et
    if [ -f "$tool" ] || which "$(basename $tool)" &>/dev/null; then
        # Tam yolu bul
        full_path="$tool"
        if [ ! -f "$tool" ]; then
            full_path=$(which "$(basename $tool)" 2>/dev/null || echo "$tool")
        fi
        
        if [ -f "$full_path" ]; then
            echo "$WEBAPP_USER ALL=(ALL) NOPASSWD: $full_path" >> "$SUDOERS_FILE"
            echo -e "   ${GREEN}✓${NC} $full_path"
        fi
    fi
done

# Dosya izinlerini ayarla
chmod 0440 "$SUDOERS_FILE"

# Sözdizimi kontrolü
echo ""
echo -e "${YELLOW}🔍 Sözdizimi kontrolü yapılıyor...${NC}"
if visudo -cf "$SUDOERS_FILE"; then
    echo -e "${GREEN}✓ Sudoers dosyası geçerli${NC}"
else
    echo -e "${RED}❌ Sudoers dosyasında hata! Dosya siliniyor...${NC}"
    rm -f "$SUDOERS_FILE"
    exit 1
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ KURULUM TAMAMLANDI                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Sudoers dosyası: ${YELLOW}$SUDOERS_FILE${NC}"
echo ""
echo -e "${YELLOW}📝 Test etmek için:${NC}"
echo "   sudo -u $WEBAPP_USER sudo nmap --version"
echo ""
echo -e "${YELLOW}⚠️ Önemli:${NC}"
echo "   - Bu araçlar artık şifre sormadan çalışacak"
echo "   - Sadece $WEBAPP_USER kullanıcısı için geçerli"
echo "   - Kaldırmak için: sudo rm $SUDOERS_FILE"
