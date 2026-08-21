#!/bin/bash
# Safe Docker build - prevents server crash
set -e
cd /home/cybersec/cybersec-pro

echo "[$(date)] Starting safe build..."

# Step 1: Clean old images FIRST to free disk
echo "[1/5] Cleaning old images..."
docker image prune -af --filter "until=48h" 2>/dev/null || true
docker builder prune -f --filter "until=24h" 2>/dev/null || true

# Step 2: Stop backend to free RAM during build
echo "[2/5] Stopping backend temporarily..."
docker compose stop rust-backend

# Step 3: Build with limited docker parallelism
echo "[3/5] Building new image..."
docker compose build rust-backend 2>&1 | tee -a logs/build.log

# Step 4: Restart
echo "[4/5] Restarting backend..."
docker compose up -d rust-backend

# Step 5: Verify health
echo "[5/5] Waiting for health check..."
for i in $(seq 1 30); do
    sleep 5
    STATUS=$(docker inspect cybersec-api --format '{{.State.Health.Status}}' 2>/dev/null || echo "starting")
    if [ "$STATUS" = "healthy" ]; then
        echo "[$(date)] Build SUCCESS - backend healthy!"
        exit 0
    fi
done
echo "[$(date)] WARNING: backend not healthy after 150s"
exit 1
