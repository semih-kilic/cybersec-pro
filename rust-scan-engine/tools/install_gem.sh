#!/bin/bash
set -e
echo ">>> [gem] zsteg"
gem install --no-document zsteg 2>/dev/null || echo "SKIP: zsteg"
echo ">>> [gem] done"
