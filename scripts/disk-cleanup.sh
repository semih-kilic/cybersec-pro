#!/usr/bin/env bash
# CyberSec Pro — Periyodik disk temizleme
# Hedef: build cache / pip cache / journal şişmesini önlemek
# Kurulum: /etc/cron.weekly/cybersec-disk-cleanup -> bu dosyaya symlink
set -u

LOG="/var/log/cybersec-disk-cleanup.log"
USER_HOME="$HOME"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

BEFORE=$(df -BM / | awk 'NR==2{print $4}' | tr -d 'M')
log "=== Cleanup başladı. Boş alan: ${BEFORE} MB ==="

# 1) Go build cache (büyür, regenerate edilir)
sudo -u cybersec rm -rf "$USER_HOME/.cache/go-build" 2>/dev/null && log "go-build cache temizlendi"

# 2) Pip cache
sudo -u cybersec rm -rf "$USER_HOME/.cache/pip" 2>/dev/null && log "pip cache temizlendi"

# 3) Cargo registry cache & git checkouts (registry/index korunur)
sudo -u cybersec rm -rf \
  "$USER_HOME/.cargo/registry/cache"/* \
  "$USER_HOME/.cargo/registry/src"/* \
  "$USER_HOME/.cargo/git/checkouts"/* 2>/dev/null && log "cargo cache temizlendi"

# 4) Rustup tmp
sudo -u cybersec rm -rf "$USER_HOME/.rustup/tmp"/* 2>/dev/null && log "rustup tmp temizlendi"

# 5) Pipx cache + logs (envs DOKUNULMAZ)
sudo -u cybersec rm -rf \
  "$USER_HOME/.cache/pipx/.cache" \
  "$USER_HOME/.cache/pipx/logs" 2>/dev/null && log "pipx cache+logs temizlendi"

# 6) NPM cache
sudo -u cybersec npm cache clean --force >/dev/null 2>&1 && log "npm cache temizlendi"

# 7) APT
apt-get clean >/dev/null 2>&1 && log "apt cache temizlendi"
apt-get autoremove -y >/dev/null 2>&1 && log "apt autoremove tamam"

# 8) Journal (max 200M)
journalctl --vacuum-size=200M >/dev/null 2>&1 && log "journal vacuumed (200M)"

# 9) /tmp eski dosyalar
find /tmp -mtime +1 -type f -delete 2>/dev/null
find /var/tmp -mtime +3 -type f -delete 2>/dev/null
log "/tmp ve /var/tmp eski dosyalar silindi"

# 10) Rust target/debug klasörleri (release korunur)
for d in "$USER_HOME"/cybersec-pro/{rust-agent,rust-scan-engine,rust-service-manager}/target/debug; do
  [ -d "$d" ] && sudo -u cybersec rm -rf "$d" && log "Silindi: $d"
done

AFTER=$(df -BM / | awk 'NR==2{print $4}' | tr -d 'M')
SAVED=$((AFTER - BEFORE))
log "=== Cleanup bitti. Boş alan: ${AFTER} MB (kazanım: ${SAVED} MB) ==="
log ""
