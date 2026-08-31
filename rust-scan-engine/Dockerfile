# ============================================
# CyberSec Pro — Rust Scan Engine (Multi-stage)
# ============================================

# Stage 1: Build Rust binary
FROM rust:1.90-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

COPY cybersec-proto/ ./cybersec-proto/
COPY rust-scan-engine/Cargo.toml rust-scan-engine/Cargo.lock* rust-scan-engine/
RUN cd rust-scan-engine && sed -i 's|path = "../cybersec-proto"|path = "../cybersec-proto"|' Cargo.toml
RUN mkdir -p rust-scan-engine/src && echo "fn main() {}" > rust-scan-engine/src/main.rs
RUN cd rust-scan-engine && cargo build --release 2>/dev/null || true
RUN rm -rf rust-scan-engine/src

COPY rust-scan-engine/src/ rust-scan-engine/src/
ARG REBUILD=2026-08-17-grpc-final
RUN cd rust-scan-engine && rm -rf target/release/cybersec-scan-engine target/release/deps/cybersec* \
    && cargo build --release

# ─────────────────────────────────────────────────────────────────────────
# Stage 2: Tools. Installs the security tools the catalogue advertises.
#
# AUDIT 2026-08-30: the catalogue listed 183 active tools but this image had
# only 86, so 97 failed at execution with "Tool binary not found" — which is
# what produced the 764 "broken" / 471 "missing" rows in tool_health_checks.
# Package lists live in tools.apt (75 from the Kali repo) and inline below for
# the ~20 that ship via pip / go / gem / release.
#
# Based on the pre-existing :cache image so the binaries already present are
# not rebuilt. NB: `docker tag cybersec-pro-rust-scan-engine:latest \
# cybersec-pro-rust-scan-engine:cache` must exist — it was untagged and had
# made this whole image unbuildable.
# ─────────────────────────────────────────────────────────────────────────
FROM cybersec-pro-rust-scan-engine:cache AS tools

# The cache image ends as USER cybersec (uid 1000); apt needs root. Switch back
# and repair the apt state dirs, which the non-root image left unwritable.
USER root
RUN mkdir -p /var/lib/apt/lists/partial /var/cache/apt/archives/partial && \
    chmod -R 755 /var/lib/apt /var/cache/apt

# 1) Kali repo packages, installed one at a time so a single renamed or dropped
#    package cannot abort the whole layer. Skips are logged to
#    /var/log/tool-install-skips.log; the post-build report shows the result.
RUN apt-get update || (sleep 5 && apt-get update)
# Prerequisites first, each tolerant so one missing name cannot abort the layer.
RUN for pkg in testdisk python3-pip python3-venv pipx golang-go ruby-full ca-certificates curl git wget \
              libxml2-dev libxslt1-dev libffi-dev libssl-dev python3-dev build-essential zlib1g-dev; do \
        apt-get install -y --no-install-recommends "$pkg" || echo "SKIP prereq: $pkg" >> /var/log/tool-install-skips.log; \
    done
# Then the tool packages, one by one.
COPY rust-scan-engine/tools.apt /tmp/tools.apt
RUN while IFS= read -r pkg; do \
        case "$pkg" in ''|\#*) continue;; esac; \
        apt-get install -y --no-install-recommends "$pkg" || echo "SKIP apt: $pkg" >> /var/log/tool-install-skips.log; \
    done < /tmp/tools.apt && \
    rm -rf /var/lib/apt/lists/* /tmp/tools.apt

# 2) pip tools (system-wide; --break-system-packages: this is a dedicated
#    scanner image, not a shared host).
RUN for pkg in flare-capa maigret objection oletools prowler scoutsuite frida-tools volatility3; do \
        pip3 install --no-cache-dir --break-system-packages --ignore-installed "$pkg" \
          || echo "SKIP pip: $pkg" >> /var/log/tool-install-skips.log; \
    done

# 3) Go tools -> /usr/local/bin.
ENV GOBIN=/usr/local/bin GOPATH=/root/go
RUN for pkg in \
        github.com/projectdiscovery/katana/cmd/katana@latest \
        github.com/projectdiscovery/tlsx/cmd/tlsx@latest \
        github.com/tomnomnom/waybackurls@latest \
        github.com/BishopFox/cloudfox@latest \
        github.com/ropnop/kerbrute@latest ; do \
        go install "$pkg" || true ; \
    done && rm -rf /root/go/pkg /root/.cache/go-build

# 4) gem tools.
RUN gem install zsteg --no-document || true

# 5) git-clone script tools -> /opt, symlinked into PATH (best-effort).
RUN set +e; \
    git clone --depth 1 https://github.com/AlessandroZ/LaZagne /opt/lazagne 2>/dev/null \
        && printf '#!/bin/sh\nexec python3 /opt/lazagne/Linux/laZagne.py "$@"\n' > /usr/local/bin/lazagne \
        && chmod +x /usr/local/bin/lazagne || echo "SKIP git: lazagne" >> /var/log/tool-install-skips.log; \
    git clone --depth 1 https://github.com/htr-tech/zphisher /opt/zphisher 2>/dev/null \
        && printf '#!/bin/sh\ncd /opt/zphisher && exec bash zphisher.sh "$@"\n' > /usr/local/bin/zphisher \
        && chmod +x /usr/local/bin/zphisher || echo "SKIP git: zphisher" >> /var/log/tool-install-skips.log; \
    git clone --depth 1 https://github.com/AonCyberLabs/Windows-Exploit-Suggester /opt/wes 2>/dev/null \
        && printf '#!/bin/sh\nexec python3 /opt/wes/windows-exploit-suggester.py "$@"\n' > /usr/local/bin/windows-exploit-suggester \
        && chmod +x /usr/local/bin/windows-exploit-suggester || echo "SKIP git: wes" >> /var/log/tool-install-skips.log; \
    printf '#!/bin/sh\nexec curl -s "https://crt.sh/?q=$1&output=json"\n' > /usr/local/bin/crtsh \
        && chmod +x /usr/local/bin/crtsh

# 6) Release binaries with pinned working URLs (best-effort).
RUN set +e; \
    (curl -fsSL "https://github.com/bee-san/RustScan/releases/download/2.4.1/rustscan_2.4.1_amd64.deb" -o /tmp/rustscan.deb \
        && apt-get install -y /tmp/rustscan.deb && rm -f /tmp/rustscan.deb) || echo "SKIP rel: rustscan" >> /var/log/tool-install-skips.log; \
    (curl -fsSL "https://github.com/BishopFox/sliver/releases/latest/download/sliver-server_linux" -o /usr/local/bin/sliver-server \
        && chmod +x /usr/local/bin/sliver-server && /usr/local/bin/sliver-server version >/dev/null 2>&1) \
        || { rm -f /usr/local/bin/sliver-server; echo "SKIP rel: sliver" >> /var/log/tool-install-skips.log; }

# ─────────────────────────────────────────────────────────────────────────
# Stage 3: Runtime.
# ─────────────────────────────────────────────────────────────────────────
FROM tools AS runtime

COPY --from=builder /app/rust-scan-engine/target/release/cybersec-scan-engine /usr/local/bin/cybersec-scan-engine

ENV SCAN_ENGINE_PORT=5002

# NB: the container runs as root via compose (`user: "0"`) because nmap SYN
# scans need NET_RAW and Docker does not put added capabilities in the ambient
# set. The compose file drops all other capabilities and sets
# no-new-privileges, so this is a narrow root, not a broad one.
EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:5002/health || exit 1

CMD ["cybersec-scan-engine"]
