#!/usr/bin/env bash
# CyberSec Pro — Disk koruma altyapısını kur
# Bu scripti SADECE bir kez çalıştır: sudo ./install-disk-protection.sh
set -e

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$EUID" -ne 0 ]; then
  echo "HATA: sudo ile çalıştır: sudo $0"
  exit 1
fi

echo "[1/5] Cleanup ve watch scriptlerini executable yap"
chmod +x "$SCRIPTS_DIR/disk-cleanup.sh" "$SCRIPTS_DIR/disk-watch.sh"

echo "[2/5] /etc/cron.weekly ve /etc/cron.hourly hooks"
ln -sf "$SCRIPTS_DIR/disk-cleanup.sh" /etc/cron.weekly/cybersec-disk-cleanup
ln -sf "$SCRIPTS_DIR/disk-watch.sh"   /etc/cron.hourly/cybersec-disk-watch

echo "[3/5] journald'yi sınırla (max 200M)"
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/00-cybersec-limits.conf <<'EOF'
[Journal]
SystemMaxUse=200M
SystemMaxFileSize=50M
SystemKeepFree=2G
RuntimeMaxUse=100M
EOF
systemctl restart systemd-journald

echo "[4/5] Log rotate ek konfigürasyon"
cat > /etc/logrotate.d/cybersec <<'EOF'
/var/log/cybersec-*.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
    copytruncate
}
EOF

echo "[5/5] İlk watch çalıştır"
"$SCRIPTS_DIR/disk-watch.sh"

echo ""
echo "✅ Disk koruma sistemi kuruldu."
echo "   - Haftalık cleanup: /etc/cron.weekly/cybersec-disk-cleanup"
echo "   - Saatlik watchdog: /etc/cron.hourly/cybersec-disk-watch"
echo "   - Log: /var/log/cybersec-disk-{cleanup,watch}.log"
echo "   - journald: max 200M sistem + 100M runtime"
