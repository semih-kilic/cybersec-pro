#!/bin/bash
set -e
export PATH="$PATH:/usr/local/go/bin:/usr/lib/go/bin"
export GOBIN=/usr/local/bin GOPATH=/root/go
echo ">>> [go-a] waybackurls"
command -v go >/dev/null 2>&1 && go install github.com/tomnomnom/waybackurls@latest 2>/dev/null || echo "SKIP: waybackurls"
echo ">>> [go-a] cloudfox (release, avoids heavy compile)"
curl -sL -o /tmp/cf.zip https://github.com/BishopFox/cloudfox/releases/download/v2.0.5/cloudfox-linux-amd64.zip \
  && unzip -o /tmp/cf.zip -d /tmp/cfx >/dev/null 2>&1 \
  && cp -r /tmp/cfx/cloudfox/cloudfox /usr/local/bin/cloudfox \
  && chmod +x /usr/local/bin/cloudfox \
  && rm -f /tmp/cf.zip \
  && echo "cloudfox OK" || echo "SKIP: cloudfox"
echo ">>> [go-a] done"
