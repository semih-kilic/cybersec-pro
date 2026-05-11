#!/usr/bin/env bash
# CyberSec Pro — Disk doluluğu watchdog
# /etc/cron.hourly/disk-watch (saatte bir çalışır)
# - %85 üstü: WARN (log + opsiyonel webhook)
# - %92 üstü: ACİL temizlik tetikle (cleanup script çağır)
# - %96 üstü: KRİTİK — install scriptlerini öldür (filesystem'i koru)
set -u

LOG="/var/log/cybersec-disk-watch.log"
CLEANUP="/home/cybersec/cybersec-pro/scripts/disk-cleanup.sh"

USAGE=$(df / | awk 'NR==2{ gsub("%",""); print $5 }')
FREE_MB=$(df -BM / | awk 'NR==2{ gsub("M",""); print $4 }')
log() { echo "[$(date '+%F %T')] [%${USAGE}|${FREE_MB}M] $*" >> "$LOG"; }

if [ "$USAGE" -ge 96 ]; then
    log "CRITICAL: install/cargo/pipx süreçleri ÖLDÜRÜLÜYOR"
    pkill -9 -f install-missing 2>/dev/null
    pkill -9 -f "cargo install" 2>/dev/null
    pkill -9 -f "pipx install" 2>/dev/null
    pkill -9 -f "pip install"  2>/dev/null
    [ -x "$CLEANUP" ] && "$CLEANUP" >> "$LOG" 2>&1
    # Slack/webhook eklenebilir
elif [ "$USAGE" -ge 92 ]; then
    log "EMERGENCY: cleanup tetiklendi"
    [ -x "$CLEANUP" ] && "$CLEANUP" >> "$LOG" 2>&1
elif [ "$USAGE" -ge 85 ]; then
    log "WARN: disk %${USAGE} dolu"
fi
