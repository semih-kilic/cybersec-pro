#!/bin/bash
set -euo pipefail

BASE_DIR="/home/sam/APPS/cybersec-monitor"
MONITOR_UNIT_SRC="$BASE_DIR/cybersec-monitor.service"
STARTUP_UNIT_SRC="$BASE_DIR/cybersec-startup.service"
TS=$(date +%Y%m%d%H%M%S)
MONITOR_ENV_EXAMPLE="$BASE_DIR/monitor.env.example"

if [ ! -f "$MONITOR_UNIT_SRC" ] || [ ! -f "$STARTUP_UNIT_SRC" ]; then
  echo "Missing unit files in $BASE_DIR" >&2
  exit 1
fi

if [ -f /etc/systemd/system/cybersec-monitor.service ]; then
  sudo cp /etc/systemd/system/cybersec-monitor.service "/etc/systemd/system/cybersec-monitor.service.bak.$TS"
fi
if [ -f /etc/systemd/system/cybersec-startup.service ]; then
  sudo cp /etc/systemd/system/cybersec-startup.service "/etc/systemd/system/cybersec-startup.service.bak.$TS"
fi

for base in cybersec-monitor.service.bak. cybersec-startup.service.bak.; do
  find /etc/systemd/system -maxdepth 1 -type f -name "${base}*" -printf '%T@ %p\n' \
    | sort -rn \
    | awk 'NR>5 {print $2}' \
    | xargs -r sudo rm -f
done

sudo cp "$MONITOR_UNIT_SRC" /etc/systemd/system/cybersec-monitor.service
sudo cp "$STARTUP_UNIT_SRC" /etc/systemd/system/cybersec-startup.service

if command -v systemd-analyze >/dev/null 2>&1; then
  VERIFY_OUTPUT=$(systemd-analyze verify /etc/systemd/system/cybersec-monitor.service /etc/systemd/system/cybersec-startup.service 2>&1 || true)
  if [ -n "$VERIFY_OUTPUT" ]; then
    FILTERED=$(echo "$VERIFY_OUTPUT" | grep -E "cybersec-(monitor|startup)\.service" || true)
    if [ -n "$FILTERED" ]; then
      echo "$FILTERED" >&2
      exit 1
    fi
  fi
fi

if [ -f "$MONITOR_ENV_EXAMPLE" ] && [ ! -f /etc/cybersec/monitor.env ]; then
  sudo install -d -m 700 /etc/cybersec
  sudo cp "$MONITOR_ENV_EXAMPLE" /etc/cybersec/monitor.env
  sudo chmod 600 /etc/cybersec/monitor.env
  sudo chown root:root /etc/cybersec/monitor.env
  echo "Created /etc/cybersec/monitor.env from template. Update values securely."
elif [ -f /etc/cybersec/monitor.env ]; then
  sudo chmod 600 /etc/cybersec/monitor.env
  sudo chown root:root /etc/cybersec/monitor.env
fi

sudo systemctl daemon-reload
sudo systemctl restart cybersec-monitor.service cybersec-startup.service
sudo systemctl reset-failed cybersec-monitor.service cybersec-startup.service

if ! systemctl is-active --quiet cybersec-monitor.service; then
  echo "cybersec-monitor.service is not active" >&2
  systemctl status cybersec-monitor.service --no-pager -l || true
fi

if ! systemctl is-active --quiet cybersec-startup.service; then
  echo "cybersec-startup.service is not active" >&2
  systemctl status cybersec-startup.service --no-pager -l || true
fi

echo "✅ systemd units applied and services restarted"
