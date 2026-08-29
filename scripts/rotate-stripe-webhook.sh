#!/bin/bash
# Stripe webhook signing secret rotation
#
# AUDIT 2026-08-28: STRIPE_WEBHOOK_SECRET was committed to git in
# rust-backend/.env.staging and was still the live value. Anyone with repo
# history could forge Stripe webhooks — granting themselves an enterprise plan
# or marking invoices paid. Roll it in the Stripe Dashboard, then run this.
#
# Usage:  ./scripts/rotate-stripe-webhook.sh
# The new secret is read without echoing and never appears in shell history.

set -euo pipefail
ENV_FILE="/home/cybersec/cybersec-pro/rust-backend/.env"
BACKUP_DIR="/home/cybersec/.secrets"

[ -f "$ENV_FILE" ] || { echo "env dosyasi yok: $ENV_FILE" >&2; exit 1; }

printf 'Stripe Dashboard > Developers > Webhooks > endpoint > Signing secret\n'
printf 'Yeni secret (whsec_... ile baslar, ekranda gorunmez): '
read -rs NEW
echo

case "$NEW" in
  whsec_*) ;;
  *) echo "HATA: secret 'whsec_' ile baslamali. Iptal edildi." >&2; exit 2 ;;
esac
[ ${#NEW} -ge 32 ] || { echo "HATA: secret cok kisa (${#NEW} karakter). Iptal edildi." >&2; exit 2; }

mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
BK="$BACKUP_DIR/rust-backend.env.bak-$(date +%Y%m%d-%H%M%S)"
cp "$ENV_FILE" "$BK"; chmod 600 "$BK"
echo "Yedek: $BK"

# Satiri yerinde degistir (yoksa ekle)
if grep -q '^STRIPE_WEBHOOK_SECRET=' "$ENV_FILE"; then
    python3 - "$ENV_FILE" "$NEW" <<'PY'
import sys
path, new = sys.argv[1], sys.argv[2]
lines = open(path).read().splitlines(keepends=True)
out = []
for ln in lines:
    if ln.startswith('STRIPE_WEBHOOK_SECRET='):
        out.append(f'STRIPE_WEBHOOK_SECRET={new}\n')
    else:
        out.append(ln)
open(path, 'w').write(''.join(out))
PY
else
    printf 'STRIPE_WEBHOOK_SECRET=%s\n' "$NEW" >> "$ENV_FILE"
fi
unset NEW

echo "Backend yeniden baslatiliyor..."
cd /home/cybersec/cybersec-pro
docker compose up -d --force-recreate rust-backend >/dev/null 2>&1

for _ in $(seq 1 30); do
    [ "$(docker inspect cybersec-api --format '{{.State.Health.Status}}' 2>/dev/null)" = healthy ] && break
    sleep 2
done

echo
echo "--- dogrulama ---"
health=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5001/api/health)
echo "  /api/health            -> HTTP $health"
sig=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:5001/api/v1/billing/webhook \
        -H 'Content-Type: application/json' -d '{"type":"ping"}')
echo "  imzasiz webhook        -> HTTP $sig (400 = imza dogrulama aktif)"
bad=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:5001/api/v1/billing/webhook \
        -H 'Content-Type: application/json' -H 'stripe-signature: t=1,v1=deadbeef' -d '{"type":"ping"}')
echo "  gecersiz imzali        -> HTTP $bad (400 = sahte imza reddediliyor)"
echo
[ "$health" = 200 ] && [ "$sig" = 400 ] && [ "$bad" = 400 ] \
  && echo "TAMAM. Son adim: Stripe Dashboard > Webhooks > 'Send test webhook' ile canli dogrulama yapin." \
  || echo "UYARI: beklenmeyen yanit. Geri almak icin: cp $BK $ENV_FILE && docker compose up -d --force-recreate rust-backend"
