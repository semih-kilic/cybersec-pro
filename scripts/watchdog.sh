#!/bin/bash
COMPOSE_DIR="/home/cybersec/cybersec-pro"
LOG="$COMPOSE_DIR/logs/watchdog.log"
mkdir -p "$COMPOSE_DIR/logs"
for CT in cybersec-api cybersec-scan-engine cybersec-nginx cybersec-db cybersec-redis; do
    STATUS=$(docker inspect --format '{{.State.Status}}' "$CT" 2>/dev/null || echo "missing")
    if [ "$STATUS" != "running" ]; then
        echo "$(date): RESTARTING $CT (was $STATUS)" >> "$LOG"
        cd "$COMPOSE_DIR" && docker compose up -d 2>/dev/null
        sleep 5
    fi
done
HOUR=$(date +%H)
MIN=$(date +%M)
if [ "$HOUR" = "03" ] && [ "$MIN" = "00" ]; then
    echo "$(date): Running daily cleanup" >> "$LOG"
    docker image prune -af --filter "until=72h" >> "$LOG" 2>&1
    docker builder prune -f --filter "until=48h" >> "$LOG" 2>&1
fi
find "$COMPOSE_DIR/logs/" -name "*.log" -mtime +14 -delete 2>/dev/null || true
