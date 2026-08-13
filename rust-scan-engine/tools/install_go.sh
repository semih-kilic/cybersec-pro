#!/bin/bash
set -e
export PATH="$PATH:/usr/local/go/bin:/usr/lib/go/bin"
echo ">>> [go] tools"
if command -v go >/dev/null 2>&1; then
  export GOBIN=/usr/local/bin GOPATH=/root/go
  for t in github.com/tomnomnom/waybackurls@latest \
           github.com/BishopFox/cloudfox@latest \
           github.com/projectdiscovery/katana/cmd/katana@latest \
           github.com/projectdiscovery/tlsx/cmd/tlsx@latest \
           github.com/ropnop/kerbrute@latest; do
    echo ">>> [go] install $t"
    go install "$t" 2>/dev/null || echo "SKIP: $t"
  done
else
  echo "SKIP: all go tools (no golang)"
fi
echo ">>> [go] done"
