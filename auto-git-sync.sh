#!/bin/bash
# CyberSec Pro - Otomatik Git Sync Script
cd /home/cybersec/cybersec-pro || exit 1

# Force SSH (cron has no credential helper for HTTPS) and non-interactive auth
SSH_KEY="${GIT_SYNC_SSH_KEY:-$HOME/.ssh/id_ed25519}"
export GIT_SSH_COMMAND="ssh -i ${SSH_KEY} -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
export GIT_TERMINAL_PROMPT=0

# Değişiklik var mı kontrol et
if [[ -n $(git status --porcelain) ]]; then
    git add -A
    git commit -m "🔄 Auto-sync: $(date '+%Y-%m-%d %H:%M:%S')"
    if git push origin main; then
        echo "[$(date)] Auto-sync completed"
    else
        echo "[$(date)] Auto-sync push FAILED" >&2
        exit 2
    fi
else
    echo "[$(date)] No changes to sync"
fi
