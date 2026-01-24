#!/bin/bash
# CyberSec Pro - File Watcher for Auto Sync
# Watches for file changes and automatically rebuilds/syncs

SOURCE_DIR="/home/sam/APPS/cybersec-kali"
BUILD_SCRIPT="$SOURCE_DIR/build-sync.sh"
LOG_FILE="/var/log/cybersec-watcher.log"

# Debounce - wait 5 seconds after last change before building
DEBOUNCE_DELAY=5
LAST_BUILD=0

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

build_if_needed() {
    CURRENT_TIME=$(date +%s)
    TIME_SINCE_BUILD=$((CURRENT_TIME - LAST_BUILD))
    
    if [ $TIME_SINCE_BUILD -ge $DEBOUNCE_DELAY ]; then
        log "🔨 Changes detected, starting build..."
        $BUILD_SCRIPT full >> "$LOG_FILE" 2>&1
        LAST_BUILD=$(date +%s)
        log "✅ Build complete"
    fi
}

# Check if inotifywait is installed
if ! command -v inotifywait &> /dev/null; then
    echo "Installing inotify-tools..."
    sudo apt-get install -y inotify-tools
fi

log "👀 Starting file watcher for CyberSec Pro..."
log "Watching: $SOURCE_DIR"

# Watch for changes
inotifywait -m -r \
    --exclude '(node_modules|\.git|__pycache__|\.pyc|venv|dist|build)' \
    -e modify,create,delete,move \
    "$SOURCE_DIR/backend" "$SOURCE_DIR/frontend/src" "$SOURCE_DIR/scripts" 2>/dev/null | \
while read path action file; do
    log "📝 Change detected: $action $path$file"
    build_if_needed
done
