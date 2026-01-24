# 🚀 Kali Linux Migration Plan - CyberSec Pro v3.0

**Hedef**: Yeni Kali Linux sunucusuna tam sistem taşıma  
**Sonuç**: 600+ araçla tam donanımlı CyberSec Pro  
**Timeline**: 1-2 hafta

---

## 🎯 NEDEN KALI LINUX'A TAŞIMALIYIZ?

### ✅ Büyük Avantajlar

1. **600+ Araç Hazır**: Kali Linux'ta tüm araçlar önceden kurulu
2. **%100 Uyumluluk**: Tüm güvenlik araçları optimize edilmiş
3. **Sürekli Güncellemeler**: Otomatik araç güncellemeleri
4. **Profesyonel İmaj**: Sektör standardı platform
5. **Daha Az Maintenance**: Araç kurulum sorunu yok

### 📊 Mevcut vs Hedef Karşılaştırma

```
MEVCUT (Ubuntu):           HEDEF (Kali Linux):
- 165/227 araç (72.7%)    - 600+ araç (100%)
- Manuel kurulumlar        - Hazır araçlar
- Uyumluluk sorunları      - Optimize edilmiş
- Sürekli maintenance      - Minimal maintenance
```

---

## 🏗️ MİGRASYON STRATEJİSİ

### Phase 1: Yeni Kali Sunucu Kurulumu (1-2 gün)

**Sunucu Özellikleri:**
- **OS**: Kali Linux 2024.4 (latest)
- **RAM**: 16GB+ (araç performansı için)
- **Disk**: 500GB+ SSD (tüm araçlar için)
- **CPU**: 8+ cores (paralel taramalar için)
- **Network**: Gigabit (hızlı veri transferi)

**Kurulum Adımları:**
1. Kali Linux ISO download ve kurulum
2. Temel sistem konfigürasyonu
3. SSH ve remote access ayarları
4. Firewall ve güvenlik konfigürasyonu

### Phase 2: CyberSec Pro Sistem Taşıma (2-3 gün)

**Taşınacak Bileşenler:**
- Flask backend uygulaması
- React frontend (eğer varsa)
- SQLite veritabanı
- Nginx konfigürasyonu
- SSL sertifikaları
- Cloudflare tunnel ayarları

**Migration Script:**
```bash
# Mevcut sistemden backup
rsync -avz /home/sam/APPS/ backup/
pg_dump cybersec_db > cybersec_backup.sql

# Yeni sisteme transfer
scp -r backup/ kali-server:/opt/cybersec-pro/
```

### Phase 3: Kali Araçları Entegrasyonu (3-5 gün)

**Araç Tespit ve Kataloglama:**
- Tüm Kali araçlarını otomatik tespit
- Kategorilere ayırma
- Veritabanına kaydetme
- Web arayüzüne entegrasyon

---

## 🔧 TEKNİK İMPLEMENTASYON

### 1. Kali Linux Kurulum Script'i

<function_calls>
<invoke name="fsWrite">
<parameter name="path">APPS/cybersec-kali/kali-setup.shbash
# Kali Linux CyberSec Pro Setup Script

echo "🚀 CyberSec Pro - Kali Linux Setup"
echo "=================================="

# Update system
echo "📦 Updating Kali Linux..."
sudo apt update && sudo apt upgrade -y

# Install additional packages
echo "🔧 Installing additional packages..."
sudo apt install -y \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    nginx \
    postgresql \
    redis-server \
    docker.io \
    docker-compose \
    git \
    curl \
    wget \
    unzip \
    htop \
    tree

# Install Python packages
echo "🐍 Installing Python packages..."
pip3 install --break-system-packages \
    flask \
    flask-sqlalchemy \
    flask-cors \
    flask-jwt-extended \
    requests \
    psutil \
    gunicorn

# Create CyberSec Pro directory
echo "📁 Creating directories..."
sudo mkdir -p /opt/cybersec-pro
sudo chown $USER:$USER /opt/cybersec-pro

# Clone or copy CyberSec Pro
echo "📥 Setting up CyberSec Pro..."
cd /opt/cybersec-pro

# Setup systemd services
echo "⚙️ Setting up services..."
sudo tee /etc/systemd/system/cybersec-pro.service > /dev/null <<EOF
[Unit]
Description=CyberSec Pro Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/cybersec-pro/backend
ExecStart=/usr/bin/python3 app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable cybersec-pro

echo "✅ Kali Linux setup completed!"
echo "🔄 Ready for CyberSec Pro migration"