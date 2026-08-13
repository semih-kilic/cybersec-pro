#!/bin/bash
# ============================================
# CyberSec Scan Engine — extra tool installs
# pip / gem / go / git based tools
# (runs inside Kali image after apt phase)
# ============================================
set -e
export DEBIAN_FRONTEND=noninteractive
export PATH="$PATH:/usr/local/go/bin:/usr/lib/go/bin"

echo ">>> [extra] pip tools"
pip3 install --no-input --break-system-packages -q \
  flare-capa \
  maigret \
  prowler 2>/tmp/prowler_err.log || { echo ">>> prowler failed (retry ignore-installed)"; pip3 install --no-input --break-system-packages --ignore-installed -q prowler 2>/dev/null || echo "SKIP: prowler"; }
pip3 install --no-input --break-system-packages --ignore-installed -q scoutsuite 2>/dev/null || echo "SKIP: scoutsuite"

echo ">>> [extra] gem tools"
gem install --no-document zsteg 2>/dev/null || echo "SKIP: zsteg"

echo ">>> [extra] go tools"
if command -v go >/dev/null 2>&1; then
  export GOBIN=/usr/local/bin GOPATH=/root/go
  go install github.com/tomnomnom/waybackurls@latest 2>/dev/null || echo "SKIP: waybackurls"
  go install github.com/BishopFox/cloudfox@latest 2>/dev/null || echo "SKIP: cloudfox"
  go install github.com/projectdiscovery/katana/cmd/katana@latest 2>/dev/null || echo "SKIP: katana(go)"
  go install github.com/projectdiscovery/tlsx/cmd/tlsx@latest 2>/dev/null || echo "SKIP: tlsx(go)"
  go install github.com/ropnop/kerbrute@latest 2>/dev/null || echo "SKIP: kerbrute(go)"
else
  echo "SKIP: all go tools (no golang)"
fi

echo ">>> [extra] rustscan from GitHub release"
if ! command -v rustscan >/dev/null 2>&1; then
  curl -sL -o /tmp/rs.zip "https://github.com/bee-san/RustScan/releases/download/2.4.1/x86_64-linux-rustscan.tar.gz.zip" 2>/dev/null && \
  mkdir -p /tmp/rs_x && unzip -oq /tmp/rs.zip -d /tmp/rs_x && \
  tgz=$(find /tmp/rs_x -name "*.tar.gz" | head -1) && \
  mkdir -p /tmp/rs_t && tar xzf "$tgz" -C /tmp/rs_t && \
  bin=$(find /tmp/rs_t -type f -name "rustscan" | head -1) && \
  mv "$bin" /usr/local/bin/rustscan && chmod +x /usr/local/bin/rustscan || echo "SKIP: rustscan"
fi

echo ">>> [extra] git-based tools"
# lazagne
if [ ! -x /usr/local/bin/lazagne ]; then
  git clone --quiet --depth 1 https://github.com/AlessandroZ/LaZagne.git /opt/LaZagne 2>/dev/null || echo "SKIP: lazagne clone"
  if [ -f /opt/LaZagne/Linux/laZagne.py ]; then
    printf '#!/bin/bash\nexec python3 /opt/LaZagne/Linux/laZagne.py "$@"\n' > /usr/local/bin/lazagne
    chmod +x /usr/local/bin/lazagne
  fi
fi
# windows-exploit-suggester
if [ ! -x /usr/local/bin/windows-exploit-suggester ]; then
  git clone --quiet --depth 1 https://github.com/GDSSecurity/windows-exploit-suggester.git /opt/windows-exploit-suggester 2>/dev/null || echo "SKIP: wes clone"
  if [ -f /opt/windows-exploit-suggester/windows-exploit-suggester.py ]; then
    printf '#!/bin/bash\nexec python3 /opt/windows-exploit-suggester/windows-exploit-suggester.py "$@"\n' > /usr/local/bin/windows-exploit-suggester
    chmod +x /usr/local/bin/windows-exploit-suggester
  fi
fi
# zphisher
if [ ! -x /usr/local/bin/zphisher ]; then
  git clone --quiet --depth 1 https://github.com/htr-tech/zphisher.git /opt/zphisher 2>/dev/null || echo "SKIP: zphisher clone"
  [ -f /opt/zphisher/zphisher.sh ] && ln -sf /opt/zphisher/zphisher.sh /usr/local/bin/zphisher && chmod +x /opt/zphisher/zphisher.sh
fi
# crtsh wrapper (pip lib has no CLI)
if [ ! -x /usr/local/bin/crtsh ]; then
cat > /usr/local/bin/crtsh <<'WRAP'
#!/usr/bin/env python3
import sys, json, urllib.request, urllib.parse
def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h','--help'):
        print("usage: crtsh <domain>  -- query crt.sh certificate transparency logs")
        return 0
    url = "https://crt.sh/?q=%25." + urllib.parse.quote(sys.argv[1]) + "&output=json"
    try:
        seen=set()
        for e in json.load(urllib.request.urlopen(url, timeout=30)):
            for n in e.get('name_value','').split('\n'):
                n=n.strip().lower()
                if n and n not in seen: seen.add(n); print(n)
        return 0
    except Exception as ex:
        print("crtsh error:", ex, file=sys.stderr); return 1
if __name__ == '__main__': sys.exit(main())
WRAP
  chmod +x /usr/local/bin/crtsh
fi
# scoutsuite console script alias (pip installs 'scout' binary)
if command -v scout >/dev/null 2>&1 && [ ! -x /usr/local/bin/scoutsuite ]; then
  ln -sf "$(command -v scout)" /usr/local/bin/scoutsuite
fi

echo ">>> [extra] done"
