# Stage 1: Rust builder (unchanged)
FROM rust:latest AS builder
WORKDIR /app
COPY rust-scan-engine/Cargo.toml ./
COPY rust-scan-engine/src ./src
RUN cargo build --release

# Stage 2: runtime — base is the previously built image (already has all
# apt packages from tools.txt installed, 12.4GB layer). Only install the
# EXTRA packages + pip/gem/go/git tools on top.
FROM cybersec-pro-rust-scan-engine:cache

ENV DEBIAN_FRONTEND=noninteractive
ENV SCAN_ENGINE_PORT=5002

# Extra packages (chunked installer to stay gentle on low-resource hosts)
COPY tools/extra_apt.txt /tmp/extra_apt.txt
COPY tools/extra_apt.sh /tmp/extra_apt.sh
RUN bash /tmp/extra_apt.sh

# pip / gem / go / git based tools (tolerant installs)
COPY tools/install_extra.sh /tmp/install_extra.sh
RUN bash /tmp/install_extra.sh

WORKDIR /app
COPY --from=builder /app/target/release/cybersec-scan-engine /usr/local/bin/cybersec-scan-engine

EXPOSE 5002

CMD ["cybersec-scan-engine"]
