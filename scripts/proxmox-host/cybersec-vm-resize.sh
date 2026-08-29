#!/bin/bash
# One-shot: give VM 100 a memory allocation the host can actually honour.
#
# The host has 15868 MB. VM 100 was allocated 16000 MB — more than exists —
# and host services need ~1855 MB on top, a ~2 GB shortfall that the OOM killer
# resolved by killing the VM, seven times.
#
# New settings:
#   memory  12000  ceiling, leaves ~3.8 GB for the host and Ceph
#   balloon  4096  floor, lets the host reclaim the guest's page cache under
#                  pressure instead of killing the VM outright
# The guest was only using 1986 MB of real memory, so 12 GB is ample.
set -uo pipefail
VMID=100
LOG=/var/log/cybersec-vm-resize.log
LOCK=/run/cybersec-vm-maintenance
exec >>"$LOG" 2>&1
echo "═══ $(date '+%F %T') resize start ═══"
touch "$LOCK"
trap 'rm -f "$LOCK"' EXIT

echo "before: $(qm config $VMID | grep -E '^(memory|balloon)')"
echo "shutting down gracefully (up to 180s)…"
if ! qm shutdown "$VMID" --timeout 180; then
    echo "graceful shutdown failed/timed out — forcing stop"
    qm stop "$VMID" || true
fi
for i in $(seq 1 60); do
    [ "$(qm status $VMID | awk '{print $2}')" = "stopped" ] && break
    sleep 2
done
echo "status now: $(qm status $VMID)"

qm set "$VMID" --memory 12000 --balloon 4096
echo "after: $(qm config $VMID | grep -E '^(memory|balloon)')"

echo "starting…"
qm start "$VMID"
sleep 5
echo "status: $(qm status $VMID)"
echo "host memory: $(free -m | awk '/^Mem:/{print $2" MB total, "$7" MB available"}')"
echo "═══ $(date '+%F %T') resize done ═══"
