# ============================================
# CyberSec Pro — Rust Backend (Multi-stage)
# ============================================

# Stage 1: Build
FROM rust:1.90-bookworm AS builder

WORKDIR /app

# Install system deps for sqlx (PostgreSQL client libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev libpq-dev protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Cache dependencies — copy manifests first
COPY Cargo.toml Cargo.lock* ./
COPY cybersec-proto/ ./cybersec-proto/
RUN sed -i 's|path = \"../cybersec-proto\"|path = \"./cybersec-proto\"|' Cargo.toml
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
RUN rm -rf src

# Build real app (include_str!("../../kali_tools.json") needs the file in-tree)
COPY src/ src/
COPY kali_tools.json ./
ARG REBUILD=2026-08-17-grpc-v5
# Force a real rebuild of the app package: cargo's mtime-based fingerprint can
# wrongly consider the dummy binary up-to-date (COPY preserves source mtimes),
# and `cargo clean -p` alone did not reliably trigger recompilation.
RUN rm -rf target/release/cybersec-pro-backend target/release/deps/cybersec* \
    && cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates libssl3 libpq5 curl unzip \

    # Runtime tools available in Debian bookworm
    nmap gobuster whois dnsutils \
    sqlmap hydra john whatweb \
    netcat-openbsd traceroute tcpdump \
    docker.io \
    # PDF generation for reports
    wkhtmltopdf \
    fonts-liberation \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/cybersec-pro-backend /app/cybersec-pro-backend

# ── Security tooling for the CyberSec AI pipeline (pinned releases) ──────
ARG SUBFINDER_VERSION=2.16.0
ARG HTTPX_VERSION=1.10.0
ARG NUCLEI_VERSION=3.11.1
RUN curl -sL "https://github.com/projectdiscovery/subfinder/releases/download/v${SUBFINDER_VERSION}/subfinder_${SUBFINDER_VERSION}_linux_amd64.zip" -o /tmp/subfinder.zip \
 && curl -sL "https://github.com/projectdiscovery/httpx/releases/download/v${HTTPX_VERSION}/httpx_${HTTPX_VERSION}_linux_amd64.zip" -o /tmp/httpx.zip \
 && curl -sL "https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_amd64.zip" -o /tmp/nuclei.zip \
 && unzip -o /tmp/subfinder.zip -d /usr/local/bin subfinder \
 && unzip -o /tmp/httpx.zip -d /usr/local/bin httpx \
 && unzip -o /tmp/nuclei.zip -d /usr/local/bin nuclei \
 && chmod +x /usr/local/bin/subfinder /usr/local/bin/httpx /usr/local/bin/nuclei \
 && rm -f /tmp/*.zip

# Non-root user
RUN useradd -r -m -s /bin/false cybersec && \
    chown -R cybersec:cybersec /app /home/cybersec
USER cybersec

# Pre-fetch nuclei templates so first scans don't pay the download cost
RUN HOME=/home/cybersec /usr/local/bin/nuclei -update-templates -silent || true

ENV RUST_LOG=info
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:5001/api/v1/health || exit 1

ENTRYPOINT ["/app/cybersec-pro-backend"]
