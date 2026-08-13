# Single-stage runtime image. Base = previously built image (all tools.txt
# apt packages + compiled binary already inside). We add the 75 delta +
# GUI packages in 4 small chunks and pip/gem/go/git tools on top.
#
# Low priority (ionice nice) + small chunks to avoid hanging the 2-vCPU host.

FROM cybersec-pro-rust-scan-engine:cache

ENV DEBIAN_FRONTEND=noninteractive
ENV SCAN_ENGINE_PORT=5002

# Chunk 1/4
COPY tools/extra_apt.1.txt /tmp/extra_apt.1.txt
RUN apt-get update -y && ionice -c 3 nice -n 19 bash -c 'xargs -a /tmp/extra_apt.1.txt -r apt-get install -y --no-install-recommends' && rm -rf /var/lib/apt/lists/*

# Chunk 2/4
COPY tools/extra_apt.2.txt /tmp/extra_apt.2.txt
RUN apt-get update -y && ionice -c 3 nice -n 19 bash -c 'xargs -a /tmp/extra_apt.2.txt -r apt-get install -y --no-install-recommends' && rm -rf /var/lib/apt/lists/*

# Chunk 3/4
COPY tools/extra_apt.3.txt /tmp/extra_apt.3.txt
RUN apt-get update -y && ionice -c 3 nice -n 19 bash -c 'xargs -a /tmp/extra_apt.3.txt -r apt-get install -y --no-install-recommends' && rm -rf /var/lib/apt/lists/*

# Chunk 4/4
COPY tools/extra_apt.4.txt /tmp/extra_apt.4.txt
RUN apt-get update -y && ionice -c 3 nice -n 19 bash -c 'xargs -a /tmp/extra_apt.4.txt -r apt-get install -y --no-install-recommends' && rm -rf /var/lib/apt/lists/*

# pip / gem / go / git based tools (tolerant installs, low priority)
COPY tools/install_extra.sh /tmp/install_extra.sh
RUN ionice -c 3 nice -n 19 bash /tmp/install_extra.sh

WORKDIR /app
EXPOSE 5002

CMD ["cybersec-scan-engine"]
