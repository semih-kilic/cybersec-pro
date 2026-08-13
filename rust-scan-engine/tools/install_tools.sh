#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
echo ">>> apt update"
apt-get update -y >/dev/null 2>&1
echo ">>> batch install attempt"
if apt-get install -y --no-install-recommends $(cat /tmp/tools.txt) >/tmp/apt_batch.log 2>&1; then
  echo ">>> all packages installed (batch)"
else
  echo ">>> batch failed, installing individually (skipping broken packages)"
  ok=0; failed=0
  while IFS= read -r pkg; do
    [ -z "$pkg" ] && continue
    if apt-get install -y --no-install-recommends "$pkg" >/dev/null 2>&1; then
      ok=$((ok+1))
    else
      failed=$((failed+1)); echo "SKIP: $pkg"
    fi
  done < /tmp/tools.txt
  echo ">>> individually ok=$ok failed=$failed"
fi
apt-get clean
rm -rf /var/lib/apt/lists/*
echo ">>> install done"
