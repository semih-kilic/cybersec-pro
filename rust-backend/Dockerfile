# ============================================
# CyberSec Pro — Rust Backend (Multi-stage)
# ============================================

# Stage 1: Build
FROM rust:1.90-bookworm AS builder

WORKDIR /app

# Install system deps for sqlx (PostgreSQL client libs)
RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Cache dependencies — copy manifests first
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
RUN rm -rf src

# Build real app
COPY src/ src/
RUN cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates libssl3 libpq5 curl \
    # Runtime tools available in Debian bookworm
    nmap gobuster whois dnsutils \
    sqlmap hydra john whatweb \
    netcat-openbsd traceroute tcpdump \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/cybersec-pro-backend /app/cybersec-pro-backend

# Non-root user
RUN useradd -r -s /bin/false cybersec && \
    chown -R cybersec:cybersec /app
USER cybersec

ENV RUST_LOG=info
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:5001/api/v1/health || exit 1

ENTRYPOINT ["/app/cybersec-pro-backend"]
