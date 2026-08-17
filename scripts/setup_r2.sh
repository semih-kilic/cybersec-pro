#!/bin/bash
# Cloudflare R2 off-site backup setup for CyberSec Pro
# Requires: R2 Access Key ID, Secret Access Key, Endpoint, Bucket name
#
# HOW TO GET THESE (5 dakika):
# 1. https://dash.cloudflare.com → sol menü → R2 Object Storage
# 2. "Create Bucket" → isim: cybersec-pro-backups → Location: ENAM (otomatik) → Create
# 3. "Manage R2 API Tokens" → "Create API Token"
# 4. Permissions: Object Read & Write → TTL: No expiration → Create
# 5. Kopyala: Access Key ID + Secret Access Key
# 6. Endpoint: <Account ID>.r2.cloudflarestorage.com (R2 dashboard'da görünür)

set -e

# === KULLANICI GİRDİLERİ ===
# Bu değerleri Cloudflare R2 dashboard'dan alıp buraya yapıştır:
R2_ACCESS_KEY="${R2_ACCESS_KEY:-}"
R2_SECRET_KEY="${R2_SECRET_KEY:-}"
R2_ENDPOINT="${R2_ENDPOINT:-}"      # ör: abc123.r2.cloudflarestorage.com
R2_BUCKET="${R2_BUCKET:-cybersec-pro-backups}"

if [ -z "$R2_ACCESS_KEY" ] || [ -z "$R2_SECRET_KEY" ] ] || [ -z "$R2_ENDPOINT" ]; then
  echo "HATA: R2 credential'ları tanımlı değil."
  echo ""
  echo "Çalıştırma:"
  echo "  R2_ACCESS_KEY=xxx R2_SECRET_KEY=yyy R2_ENDPOINT=zzz.r2.cloudflarestorage.com bash $0"
  echo ""
  echo "Veya .env dosyasına yaz:"
  echo "  R2_ACCESS_KEY=xxx"
  echo "  R2_SECRET_KEY=yyy"
  echo "  R2_ENDPOINT=zzz.r2.cloudflarestorage.com"
  exit 1
fi

echo "=== rclone R2 config oluşturuluyor ==="
mkdir -p ~/.config/rclone

cat > ~/.config/rclone/rclone.conf << EOF
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY}
secret_access_key = ${R2_SECRET_KEY}
endpoint = ${R2_ENDPOINT}
acl = private
EOF

chmod 600 ~/.config/rclone/rclone.conf

echo "=== bucket test ediliyor ==="
/usr/local/bin/rclone lsd r2:${R2_BUCKET} 2>/dev/null && echo "bucket erişilebilir" || {
  echo "bucket oluşturuluyor..."
  /usr/local/bin/rclone mkdir r2:${R2_BUCKET}
}

echo "=== mevcut backup'lar senkronize ediliyor ==="
BACKUP_DIR="/home/cybersec/cybersec-pro/backups"
/usr/local/bin/rclone copy ${BACKUP_DIR} r2:${R2_BUCKET}/backups/ \
  --include "*.enc" --include "*.log" \
  --progress --transfers 4

echo "=== R2'deki dosyalar ==="
/usr/local/bin/rclone ls r2:${R2_BUCKET}/backups/ 2>/dev/null | tail -10

echo "=== tamam ==="
echo "rclone config: ~/.config/rclone/rclone.conf"
echo "bucket: r2:${R2_BUCKET}"