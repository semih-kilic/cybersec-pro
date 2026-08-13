#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
echo ">>> apt update"
apt-get update -y >/dev/null 2>&1

echo ">>> ensure python3 (needed for availability filter)"
if ! command -v python3 >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends python3 >/dev/null 2>&1 || echo "WARN: python3 install failed"
fi

readarray -t ALL < /tmp/tools.txt
echo ">>> probing $(wc -l < /tmp/tools.txt) packages via apt-cache policy"
apt-cache policy "${ALL[@]}" 2>/dev/null | python3 /tmp/apt_filter.py > /tmp/installable.txt 2>/tmp/apt_skipped.log

installable=$(wc -l < /tmp/installable.txt)
echo ">>> installable=$installable"
echo ">>> not in apt repos: $(cat /tmp/apt_skipped.log)"

echo ">>> batch install of installable packages"
if apt-get install -y --no-install-recommends $(cat /tmp/installable.txt) >/tmp/apt_batch.log 2>&1; then
  echo ">>> all installable packages installed (batch)"
else
  echo ">>> batch failed, falling back to per-package install (tolerant)"
  ok=0; failed=0
  while IFS= read -r pkg; do
    [ -z "$pkg" ] && continue
    if apt-get install -y --no-install-recommends "$pkg" >/dev/null 2>&1; then
      ok=$((ok+1))
    else
      failed=$((failed+1)); echo "SKIP: $pkg"
    fi
  done < /tmp/installable.txt
  echo ">>> individually ok=$ok failed=$failed"
fi

apt-get clean
rm -rf /var/lib/apt/lists/*
echo ">>> install done"
