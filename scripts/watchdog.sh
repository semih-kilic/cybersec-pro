#!/bin/bash
COMPOSE_DIR="/home/cybersec/cybersec-pro"
cd "$COMPOSE_DIR"
for CONTAINER in cybersec-api cybersec-scan-engine cybersec-nginx cybersec-db cybersec-redis; do
    STATUS=$(docker inspect --format '{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo "missing")
    if [ "$STATUS" != "running" ]; then
        echo "$(date): $CONTAINER is $STATUS - restarting..." >> /home/cybersec/cybersec-pro/logs/watchdog.log
        docker compose up -d 2>/dev/null
    fi
done
docker builder prune -f --filter "until=24h" 2>/dev/null || true
find /home/cybersec/cybersec-pro/logs/ -name "*.log" -mtime +7 -delete 2>/dev/null || true
