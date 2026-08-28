#!/bin/bash
# CyberSec Pro — Otomatik Git Sync
#
# AUDIT 2026-08-28 — bu script bir veri sizintisinin kok nedeniydi.
#
# Eski hali kosulsuz `git add -A` yapiyordu. Sonucta repoya girenler:
#   * .backup-key                 — yedekleri cozen AES anahtari
#   * backups/*.sql.gz.enc (16)   — sifreli URETIM veritabani yedekleri
#   * scripts/dump-*.sql (4.3 MB) — duz metin uretim dump'i
#   * bin/* (18 MB)               — derlenmis binary'ler
#   * kabuk hatalarindan olusmus ~13 cop dosya
# Anahtar ve sifreli yedekler ayni repoda oldugu icin yedekler pratikte
# sifresizdi. Ayrica commit'ler `master`'a atilirken push `main`'e gidiyordu.
#
# Yeni davranis:
#   1) Sir taramasi — supheli bir sey stage edilmisse commit YAPMA, uyar.
#   2) Push, calisilan branch'e yapilir (branch adi varsayilmaz).
#   3) Repo temiz degilse bile ozet log birakir.

set -uo pipefail
cd /home/cybersec/cybersec-pro || exit 1

SSH_KEY="${GIT_SYNC_SSH_KEY:-$HOME/.ssh/id_ed25519}"
export GIT_SSH_COMMAND="ssh -i ${SSH_KEY} -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
export GIT_TERMINAL_PROMPT=0

log() { echo "[$(date '+%F %T')] $*"; }

if [[ -z $(git status --porcelain) ]]; then
    log "No changes to sync"
    exit 0
fi

git add -A

# ── Sir bekcisi ───────────────────────────────────────────────────────
# .gitignore ilk savunma hatti; bu ikinci hat. Bir sey yine de stage
# edildiyse commit'i durdur — sirri geri almak, hic commit etmemekten
# cok daha zordur.
BLOCK_PATTERNS='(^|/)\.env$|(^|/)\.backup-key$|\.sql\.gz\.enc$|(^|/)dump-.*\.sql$|\.pem$|(^|/)id_rsa|(^|/)id_ed25519$|_rsa$|\.p12$|\.pfx$'
# --diff-filter=d: only look at files being ADDED or MODIFIED. Deleting a
# secret that is already tracked must stay possible — that is the fix, not
# the violation.
OFFENDERS=$(git diff --cached --name-only --diff-filter=d | grep -aE "$BLOCK_PATTERNS" || true)

if [[ -n "$OFFENDERS" ]]; then
    log "ABORT: refusing to commit — secret-like files are staged:"
    printf '  %s\n' $OFFENDERS
    log "Bunlari .gitignore'a ekleyin veya 'git rm --cached <dosya>' ile cikarin."
    git reset --quiet
    exit 3
fi

# Buyuk dosya bekcisi: 5 MB ustu bir sey genelde build ciktisi ya da dump'tir.
LARGE=$(git diff --cached --name-only --diff-filter=d | while IFS= read -r f; do
            [[ -f "$f" ]] && [[ $(stat -c%s "$f" 2>/dev/null || echo 0) -gt 5242880 ]] && echo "$f"
        done)
if [[ -n "$LARGE" ]]; then
    log "ABORT: refusing to commit — files larger than 5 MB are staged:"
    printf '  %s\n' $LARGE
    git reset --quiet
    exit 4
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
git commit -q -m "🔄 Auto-sync: $(date '+%Y-%m-%d %H:%M:%S')"

# Eski script sabit olarak `origin main`'e push ediyordu; depo `master`
# uzerindeydi, yani push ya hedefi sasiyor ya da hata veriyordu.
if git push -q origin "$BRANCH"; then
    log "Auto-sync completed ($BRANCH)"
else
    log "Auto-sync push FAILED ($BRANCH)"
    exit 2
fi
