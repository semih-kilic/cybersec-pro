#!/bin/bash
# CyberSec Pro - Otomatik Git Sync Script
cd /home/cybersec/cybersec-pro

# Değişiklik var mı kontrol et
if [[ -n $(git status --porcelain) ]]; then
    git add -A
    git commit -m "🔄 Auto-sync: $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin master
    echo "[$(date)] Auto-sync completed"
else
    echo "[$(date)] No changes to sync"
fi
