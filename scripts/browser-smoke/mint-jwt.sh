#!/usr/bin/env bash
# Mint a short-lived access token for the browser smoke test.
#
# Reads JWT_SECRET_KEY straight out of the running API container, so the secret
# never lands in a file or in shell history. Prints the token on stdout.
#
#   SMOKE_JWT="$(scripts/browser-smoke/mint-jwt.sh)" node scripts/browser-smoke/dashboard.mjs
#
# Override SMOKE_USER / SMOKE_ORG to test as a different account.
set -euo pipefail

USER_ID="${SMOKE_USER:-ad2247bf-b974-409d-8a07-00620e124b51}"
ORG_ID="${SMOKE_ORG:-a7c9c30f-9bac-4101-b043-bf511f956356}"
ROLE="${SMOKE_ROLE:-superadmin}"
TTL="${SMOKE_TTL:-3600}"

SECRET="$(docker exec cybersec-api printenv JWT_SECRET_KEY 2>/dev/null || true)"
[ -n "$SECRET" ] || SECRET="$(docker exec cybersec-api printenv JWT_SECRET 2>/dev/null || true)"
if [ -z "$SECRET" ]; then
  echo "could not read JWT_SECRET_KEY from the cybersec-api container" >&2
  exit 1
fi

python3 - "$SECRET" "$USER_ID" "$ORG_ID" "$ROLE" "$TTL" <<'PY'
import sys, time, uuid, jwt
secret, user, org, role, ttl = sys.argv[1:6]
now = int(time.time())
print(jwt.encode({
    "sub": user, "org": org, "role": role,
    "exp": now + int(ttl), "iat": now,
    "token_type": "access", "fresh": True, "jti": str(uuid.uuid4()),
}, secret, algorithm="HS256"))
PY
