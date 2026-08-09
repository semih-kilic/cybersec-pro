# ============================================
# CyberSec Scan Engine — Kali runtime with tools
# ============================================

# Stage 1: Build the Rust engine binary
FROM rust:1.90-bookworm AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release

# Stage 2: Kali Linux runtime with all security tools pre-installed
FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive
ENV SCAN_ENGINE_PORT=5002

# Tool package list + tolerant installer (missing packages are skipped)
COPY tools/tools.txt /tmp/tools.txt
COPY tools/install_tools.sh /tmp/install_tools.sh
RUN bash /tmp/install_tools.sh

WORKDIR /app
COPY --from=builder /app/target/release/cybersec-scan-engine /usr/local/bin/cybersec-scan-engine

EXPOSE 5002

CMD ["cybersec-scan-engine"]
