#!/bin/bash

# CyberSec Pro - Video Recording Script
# Uses FFmpeg to record the screen

OUTPUT_DIR="/home/sam/APPS/cybersec-sales/frontend/videos"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$OUTPUT_DIR/demo_$TIMESTAMP.mp4"

echo "🎬 CyberSec Pro Video Recording"
echo "================================"
echo "Output: $OUTPUT_FILE"
echo ""
echo "Press Ctrl+C to stop recording"
echo ""

# Get screen resolution
RESOLUTION=$(xdpyinfo | grep dimensions | awk '{print $2}')
echo "Screen Resolution: $RESOLUTION"
echo ""

# Start recording
# -f x11grab: capture X11 display
# -framerate 30: 30 FPS
# -video_size: screen size
# -i :0.0: display 0, screen 0
# -c:v libx264: H.264 codec
# -preset ultrafast: fast encoding
# -crf 23: quality (lower = better, 18-28 recommended)

ffmpeg -f x11grab \
    -framerate 30 \
    -video_size "$RESOLUTION" \
    -i :0.0 \
    -c:v libx264 \
    -preset ultrafast \
    -crf 23 \
    -pix_fmt yuv420p \
    "$OUTPUT_FILE"

echo ""
echo "✅ Recording saved to: $OUTPUT_FILE"
