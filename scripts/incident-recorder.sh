#!/bin/bash
# CyberSec Pro — unclean-stop forensics
#
# AUDIT 2026-08-29. The host has stopped dead several times. Everything inside
# the guest was ruled out with evidence:
#
#   * sar, 7 minutes before a stop: CPU 96.4% idle, memory 8.37% used,
#     load 0.17, 0 blocked processes, 0.01% steal.
#   * earlyoom was running the whole time and never had to kill anything,
#     so it was not memory exhaustion.
#   * No OOM, no panic, no oops, no MCE, no disk error, no soft/hard lockup.
#   * No ACPI power-button event and no qemu-guest-agent shutdown command,
#     so the hypervisor never asked the guest to stop.
#   * wtmp holds zero shutdown records: the machine has NEVER shut down
#     cleanly. Every stop was instantaneous.
#
# An idle VM that stops with no signal, logs nothing, and will not restart
# itself is being hard-stopped OUTSIDE the guest (the hypervisor equivalent of
# pulling the plug). That cannot be fixed from in here — but it can be proven.
#
# This script runs at boot. It looks at the boot that just ended, classifies
# it, and appends a line of evidence for the hosting provider.

set -uo pipefail
LOG="/var/log/cybersec-incidents.log"
touch "$LOG" 2>/dev/null || LOG="/tmp/cybersec-incidents.log"

now=$(date '+%F %T %Z')
boot_at=$(uptime -s)

# Did the previous boot end cleanly? systemd logs a shutdown target on a clean
# stop; its absence means the machine was killed.
prev_end=$(journalctl -b -1 -n1 --no-pager -o short-iso 2>/dev/null | awk '{print $1}')
clean=$(journalctl -b -1 --no-pager 2>/dev/null \
          | grep -cE "Reached target .*(Shutdown|Power-Off|Reboot)|systemd-shutdown\[1\]: Powering off" || true)
oom=$(journalctl -b -1 -k --no-pager 2>/dev/null | grep -ciE "Out of memory|oom-kill" || true)
panic=$(journalctl -b -1 -k --no-pager 2>/dev/null | grep -ciE "Kernel panic|hard LOCKUP|soft lockup" || true)
acpi=$(journalctl -b -1 --no-pager 2>/dev/null | grep -ciE "Power key pressed|power button pressed" || true)

if   [ "${clean:-0}" -gt 0 ]; then verdict="CLEAN-SHUTDOWN"
elif [ "${oom:-0}"   -gt 0 ]; then verdict="GUEST-OOM"
elif [ "${panic:-0}" -gt 0 ]; then verdict="KERNEL-PANIC"
elif [ "${acpi:-0}"  -gt 0 ]; then verdict="HYPERVISOR-ACPI-REQUEST"
else                               verdict="EXTERNAL-HARD-STOP"
fi

# Last resource sample before the stop — proves whether the guest was busy.
# Pick the last real sample line (skip headers and "LINUX RESTART" markers).
res=$(sar -u 2>/dev/null | awk '/^[0-9]/ && NF>6 && $0 !~ /RESTART/ {l=$0} END{if(l){n=split(l,f," "); printf "idle=%s%% steal=%s%%", f[n], f[n-1]}}')
mem=$(sar -r 2>/dev/null | awk '/^[0-9]/ && NF>6 && $0 !~ /RESTART/ {l=$0} END{if(l){split(l,f," "); printf "memused=%s%%", f[5]}}')

printf '%s | boot=%s | prev_boot_last_log=%s | verdict=%s | clean=%s oom=%s panic=%s acpi=%s | %s %s\n' \
  "$now" "$boot_at" "${prev_end:-unknown}" "$verdict" \
  "${clean:-0}" "${oom:-0}" "${panic:-0}" "${acpi:-0}" "${res:-n/a}" "${mem:-n/a}" >> "$LOG"

logger -t cybersec-incident "boot recorded: verdict=$verdict prev_end=${prev_end:-unknown}"
