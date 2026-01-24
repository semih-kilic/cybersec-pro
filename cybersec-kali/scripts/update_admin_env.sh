#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/etc/cybersec/admin.env"

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (sudo)." >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <comma-separated admin IPs/CIDRs>" >&2
  exit 1
fi

allowed_ips="$1"

mkdir -p "$(dirname "$ENV_FILE")"

if [[ -f "$ENV_FILE" ]]; then
  ts="$(date +%Y%m%d%H%M%S)"
  cp "$ENV_FILE" "${ENV_FILE}.bak.${ts}"
fi

if [[ -f "$ENV_FILE" ]]; then
  tmp_file="$(mktemp)"
  grep -v '^ADMIN_ALLOWED_IPS=' "$ENV_FILE" > "$tmp_file" || true
  echo "ADMIN_ALLOWED_IPS=${allowed_ips}" >> "$tmp_file"
  mv "$tmp_file" "$ENV_FILE"
else
  echo "ADMIN_ALLOWED_IPS=${allowed_ips}" > "$ENV_FILE"
fi

chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "Updated ADMIN_ALLOWED_IPS in $ENV_FILE"
