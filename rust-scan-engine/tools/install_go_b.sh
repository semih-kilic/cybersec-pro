#!/bin/bash
set -e
export PATH="$PATH:/usr/local/go/bin:/usr/lib/go/bin"
export GOBIN=/usr/local/bin GOPATH=/root/go
export GOMAXPROCS=1
echo ">>> [go-b] katana"
command -v go >/dev/null 2>&1 && go install github.com/projectdiscovery/katana/cmd/katana@latest 2>/dev/null || echo "SKIP: katana"
echo ">>> [go-b] done"
