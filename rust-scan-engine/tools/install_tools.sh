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

# Install in small chunks (30 packages per apt-get) to avoid exhausting
# memory/disk on low-resource hosts during dpkg unpack.
echo ">>> installing in chunks of 30"
ok=0; failed=0; total=0
mapfile -t PKGS < /tmp/installable.txt
for ((i=0; i<${#PKGS[@]}; i+=30)); do
  chunk=("${PKGS[@]:i:30}")
  if apt-get install -y --no-install-recommends "${chunk[@]}" >/tmp/apt_chunk.log 2>&1; then
    ok=$((ok+${#chunk[@]}))
    total=$((total+${#chunk[@]}))
    echo ">>> chunk $((i/30+1)): ${#chunk[@]} ok"
  else
    # one or more packages in this chunk failed; fall back per-package
    for pkg in "${chunk[@]}"; do
      if apt-get install -y --no-install-recommends "$pkg" >/dev/null 2>&1; then
        ok=$((ok+1))
      else
        failed=$((failed+1)); echo "SKIP: $pkg"
      fi
      total=$((total+1))
    done
    echo ">>> chunk $((i/30+1)): per-package done"
  fi
done
echo ">>> result: ok=$ok failed=$failed total=$total"

apt-get clean
rm -rf /var/lib/apt/lists/*
echo ">>> install done"
