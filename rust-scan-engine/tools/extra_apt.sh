#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
echo ">>> extra apt update"
apt-get update -y >/dev/null 2>&1
mapfile -t PKGS < /tmp/extra_apt.txt
echo ">>> installing ${#PKGS[@]} extra packages in chunks of 20"
ok=0
for ((i=0; i<${#PKGS[@]}; i+=20)); do
  chunk=("${PKGS[@]:i:20}")
  if apt-get install -y --no-install-recommends "${chunk[@]}" >/tmp/apt_extra.log 2>&1; then
    ok=$((ok+${#chunk[@]}))
    echo ">>> extra chunk $((i/20+1)): ${#chunk[@]} ok"
  else
    for pkg in "${chunk[@]}"; do
      if apt-get install -y --no-install-recommends "$pkg" >/dev/null 2>&1; then
        ok=$((ok+1))
      else
        echo "SKIP: $pkg"
      fi
    done
    echo ">>> extra chunk $((i/20+1)): per-package done"
  fi
done
echo ">>> extra result: ok=$ok / ${#PKGS[@]}"
apt-get clean
rm -rf /var/lib/apt/lists/*
