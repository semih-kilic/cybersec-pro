#!/bin/bash
# rclone-offsite-sync.sh — Daily off-site backup to Cloudflare R2
# Called by cron: 0 3 * * * /home/cybersec/cybersec-pro/scripts/rclone-offsite-sync.sh
# Also called after each pg_dump (hook in backup-db.sh)

set -euo pipefail

BACKUP_DIR="/home/cybersec/cybersec-pro/backups"
LOG_FILE="${BACKUP_DIR}/offsite-sync.log"
R2_BUCKET="r2:cybersec-pro-backups"
RCLONE="/usr/local/bin/rclone"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# Check rclone config exists
if [ ! -f ~/.config/rclone/rclone.conf ]; then
  log "ERROR: rclone config not found at ~/.config/rclone/rclone.conf"
  exit 1
fi

log "=== off-site sync started ==="

# Sync only encrypted backups (not logs, not temp files)
${RCLONE} copy "${BACKUP_DIR}" "${R2_BUCKET}/backups/" \
  --include "*.enc" \
  --transfers 4 \
  --checkers 8 \
  --fast-list \
  --log-file="${LOG_FILE}" \
  --log-level INFO 2>&1

SYNC_EXIT=$?

if [ $SYNC_EXIT -eq 0 ]; then
  # Count synced files
  COUNT=$(${RCLONE} ls "${R2_BUCKET}/backups/" 2>/dev/null | wc -l)
  SIZE=$(${RCLONE} size "${R2_BUCKET}/backups/" 2>/dev/null | grep "Total" | head -1)
  log "OK: ${COUNT} files synced to R2 — ${SIZE}"
else
  log "ERROR: rclone sync failed (exit ${SYNC_EXIT})"
fi

# Prune local backups older than 30 days (already handled by retention engine,
# but belt-and-suspenders for disk space)
find "${BACKUP_DIR}" -name "*.enc" -mtime +30 -delete 2>/dev/null

log "=== off-site sync completed ==="