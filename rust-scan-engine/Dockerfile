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
RUN for pkg in testdisk python3-pip python3-venv pipx golang-go ruby-full ca-certificates curl git wget; do \
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
RUN pip3 install --no-cache-dir --break-system-packages \
        flare-capa maigret objection oletools prowler scoutsuite \
        frida-tools volatility3 || true

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

# 5) Release-only tools (best-effort; a failure must not break the build).
RUN set -e; ARCH=$(dpkg --print-architecture); \
    (curl -fsSL "https://github.com/RustScan/RustScan/releases/latest/download/rustscan_amd64.deb" -o /tmp/rustscan.deb \
        && dpkg -i /tmp/rustscan.deb && rm -f /tmp/rustscan.deb) || echo "rustscan skipped"; \
    (curl -fsSL "https://github.com/BishopFox/sliver/releases/latest/download/sliver-server_linux" -o /usr/local/bin/sliver-server \
        && chmod +x /usr/local/bin/sliver-server) || echo "sliver skipped"

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
