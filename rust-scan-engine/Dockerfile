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

# pip tools (separate RUN so a heavy step can be resumed / cached)
COPY tools/install_pip.sh /tmp/install_pip.sh
RUN ionice -c 3 nice -n 19 bash /tmp/install_pip.sh

# gem tools
COPY tools/install_gem.sh /tmp/install_gem.sh
RUN ionice -c 3 nice -n 19 bash /tmp/install_gem.sh

# go tools
COPY tools/install_go.sh /tmp/install_go.sh
RUN ionice -c 3 nice -n 19 bash /tmp/install_go.sh

# git / release tools
COPY tools/install_git.sh /tmp/install_git.sh
RUN ionice -c 3 nice -n 19 bash /tmp/install_git.sh

WORKDIR /app
EXPOSE 5002

CMD ["cybersec-scan-engine"]
