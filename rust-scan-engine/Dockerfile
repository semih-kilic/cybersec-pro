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

# Stage 2: Runtime (base on existing cache image for tools)
FROM cybersec-pro-rust-scan-engine:cache AS runtime

# Copy the newly built binary (replaces old one)
COPY --from=builder /app/rust-scan-engine/target/release/cybersec-scan-engine /usr/local/bin/cybersec-scan-engine

ENV SCAN_ENGINE_PORT=5002

# Run as an unprivileged user (image ships tooling; binary needs no root).
RUN useradd --create-home --shell /usr/sbin/nologin cybersec || true
USER cybersec
EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:5002/health || exit 1

CMD ["cybersec-scan-engine"]
