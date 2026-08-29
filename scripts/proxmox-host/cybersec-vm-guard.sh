#!/bin/bash
# CyberSec Pro — VM 100 auto-recovery guard
#
# 2026-08-29: the host OOM killer killed VM 100's kvm process seven times
# (Aug 19 x2, 20, 22, 28 x2, 29). `onboot: 1` only starts the VM when the HOST
# boots, so after an OOM kill the VM stayed down until someone opened the
# Proxmox panel by hand. This brings it back within 30 seconds.
set -uo pipefail
VMID=100
LOCK=/run/cybersec-vm-maintenance
LOG=/var/log/cybersec-vm-guard.log
touch "$LOG" 2>/dev/null || LOG=/tmp/cybersec-vm-guard.log

# Honour a maintenance lock, but never trust a stale one: if a planned
# operation died without cleaning up, the VM would otherwise stay down forever.
if [ -e "$LOCK" ]; then
    age=$(( $(date +%s) - $(stat -c %Y "$LOCK" 2>/dev/null || echo 0) ))
    if [ "$age" -lt 600 ]; then
        exit 0
    fi
    printf '%s stale maintenance lock (%ss) - ignoring\n' "$(date '+%F %T')" "$age" >> "$LOG"
    rm -f "$LOCK"
fi

status=$(qm status "$VMID" 2>/dev/null | awk '{print $2}')
[ "$status" = "running" ] && exit 0

# Was it killed, or stopped on purpose? An OOM kill leaves a kernel record.
recent_oom=$(journalctl -k --since "-10 min" --no-pager 2>/dev/null | grep -c "Killed process.*(kvm)" || true)

ts=$(date '+%F %T')
printf '%s VM %s is "%s" (host OOM kills in last 10m: %s) - starting\n' \
       "$ts" "$VMID" "${status:-unknown}" "${recent_oom:-0}" >> "$LOG"
if qm start "$VMID" >>"$LOG" 2>&1; then
    printf '%s VM %s started\n' "$ts" "$VMID" >> "$LOG"
    logger -t cybersec-vm-guard "restarted VM $VMID after unexpected stop"
else
    printf '%s VM %s FAILED to start\n' "$ts" "$VMID" >> "$LOG"
    logger -t cybersec-vm-guard "FAILED to restart VM $VMID"
fi
