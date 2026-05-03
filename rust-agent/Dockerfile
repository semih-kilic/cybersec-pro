# CyberSec Pro reverse-tunnel agent — multi-stage build.
# Build:  docker build -t semihkilic/cybersec-agent:v1 .
# Run:    docker run -d --name cybersec-agent --restart=always \
#           -e CSP_TOKEN=<enrollment-token> \
#           -e CSP_API_URL=https://cybersecpro.semihkilic.com \
#           -v cybersec-agent-state:/var/lib/cybersec-agent \
#           semihkilic/cybersec-agent:v1
#
# The agent persists its enrollment state under /var/lib/cybersec-agent so the
# named volume above keeps the agent_id + api_key across container restarts.

FROM rust:1.86-slim AS builder
WORKDIR /build

# Pre-cache deps via dummy main to leverage Docker layer cache.
COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src && echo 'fn main(){}' > src/main.rs && \
    cargo build --release && \
    rm -rf src target/release/deps/cybersec_agent* target/release/cybersec-agent*

# Real source.
COPY src ./src
RUN cargo build --release && strip target/release/cybersec-agent

# ── Runtime ──────────────────────────────────────────────────────────────
FROM debian:bookworm-slim
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates procps && \
    rm -rf /var/lib/apt/lists/* && \
    useradd --system --no-create-home --uid 10101 cybersec && \
    mkdir -p /var/lib/cybersec-agent && \
    chown cybersec:cybersec /var/lib/cybersec-agent

COPY --from=builder /build/target/release/cybersec-agent /usr/local/bin/cybersec-agent

USER cybersec
ENV CSP_STATE_DIR=/var/lib/cybersec-agent \
    CSP_API_URL=https://cybersecpro.semihkilic.com
VOLUME ["/var/lib/cybersec-agent"]

# Healthcheck: the process must be alive — heartbeats are observable server-side.
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
    CMD pgrep -x cybersec-agent >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/cybersec-agent"]
