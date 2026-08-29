#!/bin/bash
# Produce the evidence package for the hosting provider.
#
# Every stop of this VM has been instantaneous and unlogged. This report
# gathers what the guest recorded on either side of each stop so the provider
# can look up what their control plane did at those timestamps.

set -uo pipefail
echo "CyberSec Pro — VM stop evidence"
echo "Generated: $(date '+%F %T %Z')"
echo "Host: $(hostname)  Virt: $(systemd-detect-virt 2>/dev/null)  Uptime since: $(uptime -s)"
echo "=================================================================="
echo
echo "## Boot history (a gap between LAST ENTRY and the next FIRST ENTRY"
echo "## is a period where the VM was powered off)"
journalctl --list-boots 2>/dev/null | tail -12
echo
echo "## How each boot ended"
for b in -5 -4 -3 -2 -1; do
    first=$(journalctl -b "$b" -n1 --no-pager -o short-iso 2>/dev/null | awk '{print $1}')
    [ -z "$first" ] && continue
    last=$(journalctl -b "$b" -n1 --no-pager -o short-iso --reverse 2>/dev/null | head -1 | awk '{print $1}')
    clean=$(journalctl -b "$b" --no-pager 2>/dev/null | grep -cE "Reached target .*(Shutdown|Power-Off)" || true)
    oom=$(journalctl -b "$b" -k --no-pager 2>/dev/null | grep -ciE "Out of memory|oom-kill" || true)
    panic=$(journalctl -b "$b" -k --no-pager 2>/dev/null | grep -ciE "Kernel panic|hard LOCKUP" || true)
    acpi=$(journalctl -b "$b" --no-pager 2>/dev/null | grep -ciE "Power key pressed" || true)
    if [ "${clean:-0}" -gt 0 ]; then v="clean shutdown"
    elif [ "${oom:-0}" -gt 0 ]; then v="guest out-of-memory"
    elif [ "${panic:-0}" -gt 0 ]; then v="kernel panic"
    elif [ "${acpi:-0}" -gt 0 ]; then v="ACPI shutdown request from hypervisor"
    else v="*** EXTERNAL HARD STOP — no signal reached the guest ***"; fi
    printf '  boot %-3s last log %-27s -> %s\n' "$b" "${last:-?}" "$v"
done
echo
echo "## Guest health immediately before the stops"
echo "   (if these are low, the guest was NOT the cause)"
for f in /var/log/sysstat/sa*; do
    [ -f "$f" ] || continue
    echo "  --- $(basename "$f") ---"
    sar -u -f "$f" 2>/dev/null | grep -E "^Average" | awk '{printf "      cpu: idle=%s%% steal=%s%%\n", $NF, $(NF-1)}'
    sar -r -f "$f" 2>/dev/null | grep -E "^Average" | awk '{printf "      mem: used=%s%%\n", $5}'
done
echo
echo "## Ruled out inside the guest"
printf '  %-34s %s\n' "clean shutdown records (wtmp):" "$(last -x 2>/dev/null | grep -c shutdown | head -1)"
printf '  %-34s %s\n' "OOM kills (all boots):" "$(journalctl -k --no-pager 2>/dev/null | grep -ciE 'Out of memory|oom-kill' | head -1)"
printf '  %-34s %s\n' "kernel panics / lockups:" "$(journalctl -k --no-pager 2>/dev/null | grep -ciE 'Kernel panic|hard LOCKUP|soft lockup' | head -1)"
printf '  %-34s %s\n' "machine check / hardware errors:" "$(journalctl -k --no-pager 2>/dev/null | grep -ciE 'machine check|mce:|Hardware Error' | head -1)"
printf '  %-34s %s\n' "disk / filesystem errors:" "$(journalctl -k --no-pager 2>/dev/null | grep -ciE 'I/O error|EXT4-fs error|blk_update_request' | head -1)"
printf '  %-34s %s\n' "ACPI power-button events:" "$(journalctl --no-pager 2>/dev/null | grep -ciE 'Power key pressed|power button pressed' | head -1)"
printf '  %-34s %s\n' "guest-agent shutdown commands:" "$(journalctl --no-pager 2>/dev/null | grep -ciE 'guest-shutdown|guest-suspend' | head -1)"
printf '  %-34s %s\n' "earlyoom interventions:" "$(journalctl -u earlyoom --no-pager 2>/dev/null | grep -cE 'sending SIG(TERM|KILL) to process [0-9]+|Killing process [0-9]+' | head -1)"
echo
echo "## Recorded incidents"
tail -20 /var/log/cybersec-incidents.log 2>/dev/null || echo "  (none yet)"
echo
echo "=================================================================="
echo "Ask the provider: what stopped instance '$(hostname)' at the"
echo "timestamps above? Their control-plane / power-event log will show"
echo "whether it was billing enforcement, an abuse suspension, host"
echo "maintenance, a live-migration failure, or a panel/API action."
