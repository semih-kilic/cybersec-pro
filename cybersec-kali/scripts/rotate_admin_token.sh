#!/bin/bash
set -euo pipefail

ENV_FILE=/etc/cybersec/admin.env
LOG_FILE=/var/log/cybersec/audit.log
LOCK_FILE=/run/cybersec/admin-token-rotate.lock

if [ ! -f "$ENV_FILE" ]; then
  echo "Admin env file not found: $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another rotation is already running." >&2
  exit 0
fi

chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"

current=$(grep '^ADMIN_TOKEN=' "$ENV_FILE" | cut -d= -f2- || true)
prev=$(grep '^ADMIN_TOKEN_PREV=' "$ENV_FILE" | cut -d= -f2- || true)
allowed=$(grep '^ADMIN_ALLOWED_IPS=' "$ENV_FILE" | cut -d= -f2- || true)

new_token=$(openssl rand -hex 32)
new_prev=${current:-$prev}

umask 077
tmp_file=$(mktemp /etc/cybersec/admin.env.tmp.XXXXXX)
found_admin=0
found_prev=0
found_allowed=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ADMIN_TOKEN=*)
      echo "ADMIN_TOKEN=${new_token}" >> "$tmp_file"
      found_admin=1
      ;;
    ADMIN_TOKEN_PREV=*)
      echo "ADMIN_TOKEN_PREV=${new_prev}" >> "$tmp_file"
      found_prev=1
      ;;
    ADMIN_ALLOWED_IPS=*)
      echo "ADMIN_ALLOWED_IPS=${allowed}" >> "$tmp_file"
      found_allowed=1
      ;;
    *)
      echo "$line" >> "$tmp_file"
      ;;
  esac
done < "$ENV_FILE"

if [ "$found_admin" -eq 0 ]; then
  echo "ADMIN_TOKEN=${new_token}" >> "$tmp_file"
fi
if [ "$found_prev" -eq 0 ]; then
  echo "ADMIN_TOKEN_PREV=${new_prev}" >> "$tmp_file"
fi
if [ "$found_allowed" -eq 0 ]; then
  echo "ADMIN_ALLOWED_IPS=${allowed}" >> "$tmp_file"
fi

chown root:root "$tmp_file"
chmod 600 "$tmp_file"
mv "$tmp_file" "$ENV_FILE"

systemctl restart cybersec-backend.service

mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"
chown root:root "$LOG_FILE"
chmod 600 "$LOG_FILE"

printf '{"timestamp":"%s","action":"admin_token_rotate","status":"ok"}\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$LOG_FILE"
