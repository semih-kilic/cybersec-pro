#!/bin/bash
set -e
export PATH="$PATH:/usr/local/go/bin:/usr/lib/go/bin"
export GOBIN=/usr/local/bin GOPATH=/root/go
export GOMAXPROCS=1
echo ">>> [go-d] kerbrute"
command -v go >/dev/null 2>&1 && go install github.com/ropnop/kerbrute@latest 2>/dev/null || echo "SKIP: kerbrute"
echo ">>> [go-d] done"
