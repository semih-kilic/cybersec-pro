# Single-stage runtime image. Base is the previously built image which
# already contains ALL apt packages from tools.txt AND the compiled binary
# at /usr/local/bin/cybersec-scan-engine. We only add the EXTRA packages
# (75 delta + GUI tools) and pip/gem/go/git tools on top.
#
# IMPORTANT: no builder stage here — parallel cargo builds + 12GB extract
# used to hang this 2-vCPU host.

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
EXPOSE 5002

CMD ["cybersec-scan-engine"]
