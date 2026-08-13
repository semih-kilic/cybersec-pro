#!/bin/bash
set -e
export PATH="$PATH:/usr/local/go/bin:/usr/lib/go/bin"
export GOBIN=/usr/local/bin GOPATH=/root/go
echo ">>> [go-a] waybackurls"
command -v go >/dev/null 2>&1 && go install github.com/tomnomnom/waybackurls@latest 2>/dev/null || echo "SKIP: waybackurls"
echo ">>> [go-a] cloudfox"
command -v go >/dev/null 2>&1 && go install github.com/BishopFox/cloudfox@latest 2>/dev/null || echo "SKIP: cloudfox"
echo ">>> [go-a] done"
