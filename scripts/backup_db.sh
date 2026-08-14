#!/bin/bash
# CyberSec Pro — PostgreSQL backup script
# pg_dump -> gzip -> openssl AES-256-CBC encrypt -> local dir
# Keeps 30 daily backups, then prunes.
set -euo pipefail

DB_USER="${DB_USER:-cybersec}"
DB_NAME="${DB_NAME:-cybersec_pro}"
BACKUP_DIR="${BACKUP_DIR:-/home/cybersec/cybersec-pro/backups}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
KEEP_DAYS="${KEEP_DAYS:-30}"

if [ -z "$ENCRYPTION_KEY" ]; then
  echo "[backup] BACKUP_ENCRYPTION_KEY not set — refusing to run unencrypted" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS=$(date -u +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/cybersec_pro-$TS.sql.gz.enc"
TMP="$BACKUP_DIR/cybersec_pro-$TS.sql.gz"

echo "[backup] starting dump at $(date -u +%FT%TZ)"
docker exec cybersec-db pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom > /tmp/cybersec_dump.dump 2>>"$BACKUP_DIR/backup.log"
gzip -c /tmp/cybersec_dump.dump > "$TMP"
rm -f /tmp/cybersec_dump.dump

echo -n "$ENCRYPTION_KEY" | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$TMP" -out "$OUT"
rm -f "$TMP"

SIZE=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT")
echo "[backup] OK: $OUT ($SIZE bytes)"
echo "[backup] completed at $(date -u +%FT%TZ)"

# Prune old backups (keep KEEP_DAYS)
find "$BACKUP_DIR" -name 'cybersec_pro-*.sql.gz.enc' -mtime +"$KEEP_DAYS" -delete
echo "[backup] pruned backups older than ${KEEP_DAYS}d; remaining:"
ls -1 "$BACKUP_DIR"/cybersec_pro-*.sql.gz.enc 2>/dev/null | wc -l