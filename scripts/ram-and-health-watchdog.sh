#!/bin/bash
# 🛡️ CyberSec Pro — Service Health Watchdog (Docker-aware)
#
# AUDIT 2026-08-28 — bu script host'un kilitlenmesine katkida bulunuyordu.
# Duzeltilen uc hata:
#
#  1) check_frontend() prod'da her 5 dakikada `npm run dev` (Vite) baslatiyordu.
#     Prod'da dashboard nginx tarafindan /srv/saas-frontend/dist'ten statik
#     servis ediliyor; 3001'de hicbir sey dinlememeli. Vite dev server ayrica
#     *:3001 (tum arayuzler) uzerinde acikti ve surekli RAM/CPU yiyordu.
#     -> Tamamen kaldirildi; sadece WATCHDOG_DEV_MODE=1 ile opt-in.
#
#  2) check_engine() `pkill -f cybersec-scan-engine` calistiriyordu. Docker
#     konteyner surecleri host PID namespace'inde GORUNUR oldugu icin bu komut
#     konteynerin ICINDEKI motoru olduruyordu; ardindan 5002'ye bind edemeyen
#     bare-metal bir kopya baslatmaya calisiyor, Docker restart:always ile
#     yarisiyor ve servis flap ediyordu.
#     -> Docker-aware saglik kontrolu ile degistirildi; pkill yok.
#
#  3) clean_ram() bellek dusukken `sysctl -w vm.drop_caches=3` yapiyordu. Bu
#     page cache'i atar, "available" bellegi anlamli sekilde artirmaz ve I/O
#     performansini bozar. Artik earlyoom (v1.9) gercek OOM korumasini sagliyor.
#     -> drop_caches kaldirildi; sadece raporlama birakildi.

set -uo pipefail

BASEDIR="/home/cybersec/cybersec-pro"
LOGFILE="/var/log/cybersec-watchdog.log"
[ -w "$(dirname "$LOGFILE")" ] || LOGFILE="/tmp/cybersec-watchdog.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOGFILE"; }

# ── 1. Bellek raporu (mudahale yok; OOM korumasi earlyoom'da) ──────────
report_ram() {
    local avail
    avail=$(awk '/^MemAvailable:/{print int($2/1024)}' /proc/meminfo)
    if [ "${avail:-9999}" -lt 1000 ]; then
        log "WARN: dusuk kullanilabilir RAM (${avail}MB). earlyoom devrede; en cok bellek kullananlar:"
        ps -eo rss,comm --sort=-rss --no-headers 2>/dev/null | head -5 \
            | awk '{printf "         %6.0f MB  %s\n", $1/1024, $2}' >> "$LOGFILE"
    fi
}

# ── 2. Konteyner sagligi — Docker-aware, pkill YOK ────────────────────
# Saglikli olmayan konteyneri compose ile yerinde yeniden baslatir.
check_container() {
    local name="$1" svc="$2" status health
    status=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo missing)
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || echo none)

    # "starting" gecici bir durum; mudahale etme (restart dongusune sokar).
    if [ "$health" = "starting" ]; then
        return 0
    fi
    if [ "$status" != "running" ] || { [ "$health" != "none" ] && [ "$health" != "healthy" ]; }; then
        log "Auto-Healing: $name status=$status health=$health -> yeniden baslatiliyor"
        ( cd "$BASEDIR" && docker compose up -d "$svc" >/dev/null 2>&1 ) \
            || docker restart "$name" >/dev/null 2>&1 \
            || log "Auto-Healing: $name yeniden baslatilamadi"
    fi
}

# ── 3. Dev-only: yerel gelistirme makinesinde Vite ayakta tutulur ──────
# Prod'da ASLA calismaz. Acmak icin: WATCHDOG_DEV_MODE=1
check_frontend_dev() {
    [ "${WATCHDOG_DEV_MODE:-0}" = "1" ] || return 0
    curl -sf -o /dev/null --max-time 3 http://127.0.0.1:3001 && return 0
    log "DEV: Vite (3001) kapali, baslatiliyor"
    ( cd "$BASEDIR/saas-frontend" && nohup npm run dev -- --port 3001 --host 127.0.0.1 \
        > /tmp/frontend-dev.log 2>&1 & )
}

report_ram
check_container cybersec-api          rust-backend
check_container cybersec-scan-engine  rust-scan-engine
check_container cybersec-db           postgres
check_container cybersec-redis        redis
check_container cybersec-nginx        nginx
check_frontend_dev
