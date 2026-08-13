#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
export PATH="$PATH:/usr/local/go/bin:/usr/lib/go/bin"
echo ">>> [pip] flare-capa + maigret (ignore-installed to bypass RECORD issues)"
pip3 install --no-input --break-system-packages -q flare-capa 2>/dev/null || pip3 install --no-input --break-system-packages --ignore-installed -q flare-capa 2>/dev/null || echo "SKIP: capa"
pip3 install --no-input --break-system-packages --ignore-installed -q maigret 2>/dev/null || echo "SKIP: maigret"
echo ">>> [pip] volatility3"
pip3 install --no-input --break-system-packages -q volatility3 2>/dev/null || echo "SKIP: volatility3"
echo ">>> [pip] prowler (may be heavy)"
pip3 install --no-input --break-system-packages -q prowler 2>/tmp/prowler_err.log || pip3 install --no-input --break-system-packages --ignore-installed -q prowler 2>/dev/null || echo "SKIP: prowler"
echo ">>> [pip] scoutsuite"
pip3 install --no-input --break-system-packages --ignore-installed -q scoutsuite 2>/dev/null || echo "SKIP: scoutsuite"
echo ">>> [pip] done"
