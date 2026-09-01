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
# Stage 2: Tools. All security tools live in a pre-built base image
# (cybersec-scan-tools:base), baked ONCE. We no longer re-run apt/pip/go on
# every build — that stacked a fresh ~2-3GB install layer each time and was
# the source of the 25GB bloat. A code change now only recompiles the Rust
# binary (builder stage) and copies it onto this stable base.
# To refresh the toolset, rebuild the base separately (see scripts).
# ─────────────────────────────────────────────────────────────────────────
FROM cybersec-scan-tools:base AS tools

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
