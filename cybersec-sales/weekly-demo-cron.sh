#!/bin/bash
# ─────────────────────────────────────────────────────────────
# CyberSec Pro - Weekly Demo Video Pipeline
# Cron: Records new demo, uploads to YouTube, updates landing page
# 
# Install cron:
#   crontab -e
#   0 3 * * 1 /home/cybersec/cybersec-pro/cybersec-sales/weekly-demo-cron.sh >> /var/log/cybersec-demo.log 2>&1
#
# Every Monday at 03:00 AM
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/cybersec-demo-$(date +%Y%m%d).log"
VIDEO_DIR="${SCRIPT_DIR}/demo-videos"
CONFIG_FILE="${SCRIPT_DIR}/demo-video-config.json"

# ── Environment (override with .env file) ──
if [ -f "${SCRIPT_DIR}/.env" ]; then
    source "${SCRIPT_DIR}/.env"
fi

export DEMO_BASE_URL="${DEMO_BASE_URL:-https://cybersecpro.semihkilic.com}"
export DEMO_EMAIL="${DEMO_EMAIL:-demo@semihkilic.com}"
export DEMO_PASSWORD="${DEMO_PASSWORD:-demo123!}"

# ── Logging ──
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "════════════════════════════════════════════"
log "🎬 Weekly Demo Video Pipeline Starting"
log "════════════════════════════════════════════"

# ── Pre-flight checks ──
command -v node >/dev/null 2>&1 || { log "❌ Node.js not found"; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { log "❌ ffmpeg not found"; exit 1; }

# Check npm dependencies
if [ ! -d "${SCRIPT_DIR}/node_modules/puppeteer" ]; then
    log "📦 Installing dependencies..."
    cd "${SCRIPT_DIR}" && npm install
fi

# ── Clean old videos (keep last 4) ──
mkdir -p "${VIDEO_DIR}"
OLD_COUNT=$(find "${VIDEO_DIR}" -name "*.mp4" -mtime +30 | wc -l)
if [ "$OLD_COUNT" -gt 0 ]; then
    log "🧹 Cleaning $OLD_COUNT old videos..."
    find "${VIDEO_DIR}" -name "*.mp4" -mtime +30 -delete
    find "${VIDEO_DIR}" -name "*.png" -mtime +30 -delete
fi

# ── Record Demo ──
log "🔴 Starting demo recording..."
cd "${SCRIPT_DIR}"

UPLOAD_TARGET="none"
if [ -n "${YT_CLIENT_ID:-}" ] && [ -n "${YT_REFRESH_TOKEN:-}" ]; then
    UPLOAD_TARGET="youtube"
    log "📤 Will upload to YouTube"
elif [ -n "${VIMEO_TOKEN:-}" ]; then
    UPLOAD_TARGET="vimeo"
    log "📤 Will upload to Vimeo"
fi

if [ "$UPLOAD_TARGET" != "none" ]; then
    node record-demo-v2.js --upload "$UPLOAD_TARGET" 2>&1 | tee -a "$LOG_FILE"
else
    node record-demo-v2.js 2>&1 | tee -a "$LOG_FILE"
fi

RECORD_STATUS=$?
if [ $RECORD_STATUS -ne 0 ]; then
    log "❌ Recording failed with exit code $RECORD_STATUS"
    exit 1
fi

# ── Update video config for landing page ──
if [ -f "$CONFIG_FILE" ]; then
    LATEST_VIDEO=$(ls -t "${VIDEO_DIR}"/*.mp4 2>/dev/null | head -1)
    if [ -n "$LATEST_VIDEO" ]; then
        # Get video duration
        DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$LATEST_VIDEO" 2>/dev/null | cut -d. -f1)
        SIZE=$(du -h "$LATEST_VIDEO" | cut -f1)
        log "📊 Latest video: ${LATEST_VIDEO} (${DURATION}s, ${SIZE})"
    fi
fi

# ── Copy latest video to static serving directory ──
STATIC_VIDEO_DIR="/home/cybersec/cybersec-pro/saas-backend/static/videos"
mkdir -p "$STATIC_VIDEO_DIR"

LATEST_VIDEO=$(ls -t "${VIDEO_DIR}"/*-final.mp4 2>/dev/null | head -1)
if [ -z "$LATEST_VIDEO" ]; then
    LATEST_VIDEO=$(ls -t "${VIDEO_DIR}"/*.mp4 2>/dev/null | head -1)
fi

if [ -n "$LATEST_VIDEO" ]; then
    cp "$LATEST_VIDEO" "${STATIC_VIDEO_DIR}/demo-latest.mp4"
    log "📁 Copied to: ${STATIC_VIDEO_DIR}/demo-latest.mp4"
fi

LATEST_THUMB=$(ls -t "${VIDEO_DIR}"/thumbnail-*.png 2>/dev/null | head -1)
if [ -n "$LATEST_THUMB" ]; then
    cp "$LATEST_THUMB" "${STATIC_VIDEO_DIR}/demo-thumbnail.png"
    log "🖼️ Thumbnail: ${STATIC_VIDEO_DIR}/demo-thumbnail.png"
fi

log "════════════════════════════════════════════"
log "✅ Weekly demo pipeline complete!"
log "════════════════════════════════════════════"
