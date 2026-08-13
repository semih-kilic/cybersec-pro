#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
export PATH="$PATH:/usr/local/go/bin:/usr/lib/go/bin"
echo ">>> [pip] flare-capa + maigret"
pip3 install --no-input --break-system-packages -q flare-capa maigret 2>/dev/null || echo "SKIP: capa/maigret"
echo ">>> [pip] prowler (may be heavy)"
pip3 install --no-input --break-system-packages -q prowler 2>/tmp/prowler_err.log || pip3 install --no-input --break-system-packages --ignore-installed -q prowler 2>/dev/null || echo "SKIP: prowler"
echo ">>> [pip] scoutsuite"
pip3 install --no-input --break-system-packages --ignore-installed -q scoutsuite 2>/dev/null || echo "SKIP: scoutsuite"
echo ">>> [pip] done"
