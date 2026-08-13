#!/bin/bash
set -e
export PATH="$PATH:/usr/local/go/bin:/usr/lib/go/bin"
export GOBIN=/usr/local/bin GOPATH=/root/go
export GOMAXPROCS=1
echo ">>> [go-c] tlsx"
command -v go >/dev/null 2>&1 && go install github.com/projectdiscovery/tlsx/cmd/tlsx@latest 2>/dev/null || echo "SKIP: tlsx"
echo ">>> [go-c] done"
