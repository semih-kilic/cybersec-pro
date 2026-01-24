#!/bin/bash
#
# CyberSec Pro - Tek Komutla Kurulum
# Versiyon: 2.0
# (c) 2026 CyberSec Pro
#

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Banner
echo -e "${CYAN}"
cat << "BANNER"
   ______      __              _____            ____           
  / ____/_  __/ /_  ___  _____/ ___/___  ____  / __ \_________ 
 / /   / / / / __ \/ _ \/ ___/\__ \/ _ \/ __ \/ /_/ / ___/ __ \
/ /___/ /_/ / /_/ /  __/ /   ___/ /  __/ /_/ / ____/ /  / /_/ /
\____/\__, /_.___/\___/_/   /____/\___/\____/_/   /_/   \____/ 
     /____/                                                    
                    Professional Security Platform v2.0
BANNER
echo -e "${NC}"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}          TEK KOMUTLA KURULUM BAŞLIYOR                       ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Root kontrolü
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Bu script root olarak çalıştırılmalıdır!${NC}"
    echo -e "${YELLOW}   Kullanım: sudo ./install.sh${NC}"
    exit 1
fi

# Kali Linux kontrolü
if ! grep -q "kali" /etc/os-release 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Uyarı: Bu sistem Kali Linux değil!${NC}"
    echo -e "${YELLOW}   Bazı araçlar düzgün çalışmayabilir.${NC}"
    read -p "Devam etmek istiyor musunuz? (e/h): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ee]$ ]]; then
        exit 1
    fi
fi

INSTALL_DIR="/opt/cybersec-pro"
CURRENT_DIR=$(pwd)

# Adım 1: Sistem Güncelleme
echo -e "\n${BLUE}[1/6]${NC} 📦 Sistem güncelleniyor..."
apt-get update -qq

# Adım 2: Temel Bağımlılıklar
echo -e "\n${BLUE}[2/6]${NC} 📦 Temel bağımlılıklar kuruluyor..."
apt-get install -y -qq \
    python3 python3-pip python3-venv \
    nodejs npm \
    git curl wget \
    sqlite3 \
    > /dev/null 2>&1

# Adım 3: Uygulama Klasörü
echo -e "\n${BLUE}[3/6]${NC} 📁 Uygulama kuruluyor..."
mkdir -p $INSTALL_DIR
cp -r "$CURRENT_DIR"/* $INSTALL_DIR/

# Servis kullanıcısı
echo -e "${BLUE}    👤 Servis kullanıcısı hazırlanıyor...${NC}"
if ! id -u cybersec >/dev/null 2>&1; then
    useradd --system --home $INSTALL_DIR --shell /usr/sbin/nologin cybersec
fi
chown -R cybersec:cybersec $INSTALL_DIR
mkdir -p /var/log/cybersec
chown -R cybersec:cybersec /var/log/cybersec

# Backend ortam dosyası (varsayılanlar)
if [ ! -f "$INSTALL_DIR/backend/.env" ] && [ -f "$INSTALL_DIR/backend/.env.example" ]; then
    echo -e "${YELLOW}⚠️  .env bulunamadı, örnek dosya oluşturuluyor.${NC}"
    cp "$INSTALL_DIR/backend/.env.example" "$INSTALL_DIR/backend/.env"
    SECRET_KEY=$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)
    JWT_SECRET_KEY=$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)
    sed -i "s/^SECRET_KEY=.*/SECRET_KEY=${SECRET_KEY}/" "$INSTALL_DIR/backend/.env"
    sed -i "s/^JWT_SECRET_KEY=.*/JWT_SECRET_KEY=${JWT_SECRET_KEY}/" "$INSTALL_DIR/backend/.env"
    sed -i "s/^FLASK_ENV=.*/FLASK_ENV=production/" "$INSTALL_DIR/backend/.env"
    sed -i "s/^FLASK_DEBUG=.*/FLASK_DEBUG=0/" "$INSTALL_DIR/backend/.env"
    echo -e "${YELLOW}⚠️  Lütfen $INSTALL_DIR/backend/.env dosyasını kendi değerlerinize göre güncelleyin.${NC}"
fi

# Adım 4: Backend Kurulumu
echo -e "\n${BLUE}[4/6]${NC} 🐍 Backend kuruluyor..."
cd $INSTALL_DIR/backend
python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt 2>/dev/null || pip install flask flask-cors flask-sqlalchemy python-dotenv PyJWT
deactivate

# Sistem genelinde güvenlik anahtarları
echo -e "\n${BLUE}[4.1/6]${NC} 🔐 Güvenlik anahtarları hazırlanıyor..."
mkdir -p /etc/cybersec
if [ ! -f "/etc/cybersec/admin.env" ]; then
    ADMIN_TOKEN=$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)
    ADMIN_TOKEN_PREV=$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)
    TERMINAL_SECRET_KEY=$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)
    TERMINAL_SECRET_KEY_PREV=$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)
    AUDIT_SIGNING_KEY=$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)
    AUDIT_SIGNING_KEY_PREV=$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)
    cat > /etc/cybersec/admin.env <<EOF
ADMIN_TOKEN=${ADMIN_TOKEN}
ADMIN_TOKEN_PREV=${ADMIN_TOKEN_PREV}
ADMIN_ALLOWED_IPS=127.0.0.1
TERMINAL_SECRET_KEY=${TERMINAL_SECRET_KEY}
TERMINAL_SECRET_KEY_PREV=${TERMINAL_SECRET_KEY_PREV}
AUDIT_SIGNING_KEY=${AUDIT_SIGNING_KEY}
AUDIT_SIGNING_KEY_PREV=${AUDIT_SIGNING_KEY_PREV}
EOF
    chmod 600 /etc/cybersec/admin.env
    echo -e "${YELLOW}⚠️  /etc/cybersec/admin.env oluşturuldu. ADMIN_ALLOWED_IPS değerini güncellemeniz önerilir.${NC}"
fi

# Adım 5: Frontend Build
echo -e "\n${BLUE}[5/6]${NC} ⚛️  Frontend kuruluyor..."
cd $INSTALL_DIR/frontend
npm install --silent 2>/dev/null
npm run build --silent 2>/dev/null

# Sahiplikleri düzelt
chown -R cybersec:cybersec $INSTALL_DIR

# Adım 6: Systemd Servisleri
echo -e "\n${BLUE}[6/6]${NC} ⚙️  Sistem servisleri oluşturuluyor..."

# Logrotate yapılandırması
cat > /etc/logrotate.d/cybersec << 'LOGROTATE'
/var/log/cybersec/*.log {
    rotate 14
    size 10M
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
LOGROTATE

# tmpfiles.d (secure directories)
cat > /etc/tmpfiles.d/cybersec.conf << 'TMPFILES'
# Type Path               Mode UID     GID     Age Argument
d /var/log/cybersec       0750 cybersec cybersec -   -
d /etc/cybersec           0750 root     root     -   -
TMPFILES

# Backend Service
cat > /etc/systemd/system/cybersec-backend.service << 'SERVICE'
[Unit]
Description=CyberSec Pro Backend
After=network.target

[Service]
Type=simple
User=cybersec
Group=cybersec
WorkingDirectory=/opt/cybersec-pro/backend
Environment=PATH=/opt/cybersec-pro/backend/venv/bin
EnvironmentFile=/etc/cybersec/admin.env
ExecStart=/opt/cybersec-pro/backend/venv/bin/python app.py
Restart=always
RestartSec=3
UMask=0077

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
RestrictNamespaces=yes
SystemCallFilter=@system-service
ReadWritePaths=/var/log/cybersec /opt/cybersec-pro/backend/instance

[Install]
WantedBy=multi-user.target
SERVICE

# Frontend Service
cat > /etc/systemd/system/cybersec-frontend.service << 'SERVICE'
[Unit]
Description=CyberSec Pro Frontend
After=network.target

[Service]
Type=simple
User=cybersec
Group=cybersec
WorkingDirectory=/opt/cybersec-pro/frontend
ExecStart=/usr/bin/npx serve -s dist -l 5173
Restart=always
RestartSec=3
UMask=0077

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
RestrictNamespaces=yes
SystemCallFilter=@system-service

[Install]
WantedBy=multi-user.target
SERVICE

# Servisleri etkinleştir
systemctl daemon-reload
systemctl enable cybersec-backend cybersec-frontend
systemctl start cybersec-backend cybersec-frontend

# IP Adresi
IP_ADDR=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}          ✅ KURULUM TAMAMLANDI!                              ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  🌐 Web Arayüzü: ${CYAN}http://${IP_ADDR}:5173${NC}"
echo -e "  🔧 API Adresi:  ${CYAN}http://${IP_ADDR}:5001${NC}"
echo ""
echo -e "  📋 Servis Komutları:"
echo -e "     ${YELLOW}systemctl status cybersec-backend${NC}"
echo -e "     ${YELLOW}systemctl status cybersec-frontend${NC}"
echo ""
echo -e "  🔄 Yeniden Başlatma:"
echo -e "     ${YELLOW}systemctl restart cybersec-backend cybersec-frontend${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
