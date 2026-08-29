#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# CyberSec Pro — Proxmox HOST diagnostics  (READ-ONLY)
#
# Run this ON THE PROXMOX HOST, as root:
#     bash pve-host-diagnose.sh
#
# It changes nothing. It only reads logs and status to explain why the guest
# VM keeps being hard-stopped.
#
# Why we are looking at the host at all: inside the guest every possible cause
# was ruled out with evidence — the VM was 96% idle with 8% memory used when it
# died, earlyoom never fired, there was no OOM, panic, MCE or disk error, no
# ACPI power event, no guest-agent shutdown command, and wtmp holds zero clean
# shutdowns. A guest cannot log its own power being cut, so the answer is here.
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

GUEST_IP="${GUEST_IP:-10.0.0.241}"
# Stop times seen from inside the guest, in UTC.
TIMES_UTC=("2026-08-23 01:40" "2026-08-28 22:07" "2026-08-29 16:35")

hr() { printf '\n─── %s %s\n' "$1" "$(printf '─%.0s' $(seq 1 $((60 - ${#1}))))"; }

echo "Proxmox host diagnostics — $(date '+%F %T %Z')"
echo "Host: $(hostname)   PVE: $(pveversion 2>/dev/null | head -1)"
echo "Host uptime since: $(uptime -s 2>/dev/null)"

hr "1. WHICH VM IS THE GUEST"
VMID=""
for id in $(qm list 2>/dev/null | awk 'NR>1{print $1}'); do
    if qm config "$id" 2>/dev/null | grep -q "$GUEST_IP" || \
       qm guest cmd "$id" network-get-interfaces 2>/dev/null | grep -q "$GUEST_IP"; then
        VMID="$id"; break
    fi
done
[ -z "$VMID" ] && VMID=$(qm list 2>/dev/null | awk 'NR==2{print $1}')
echo "  VMID guess: ${VMID:-<none>}"
qm list 2>/dev/null | head -10

hr "2. *** HOST OOM — did the host kill the VM's kvm process? ***"
echo "  (this is the top hypothesis: an over-committed host kills the biggest"
echo "   process, which is the VM, and the guest sees an instant power cut)"
journalctl -k --no-pager 2>/dev/null | grep -iE "out of memory|oom-kill|oom_reaper" | tail -20
dmesg -T 2>/dev/null | grep -iE "out of memory|oom-kill|killed process" | tail -10
echo "  --- kvm processes killed ---"
journalctl --no-pager 2>/dev/null | grep -iE "Killed process.*kvm|oom-kill.*kvm" | tail -10
echo "  (empty above = host OOM ruled out)"

hr "3. HOST MEMORY / OVERCOMMIT"
free -h 2>/dev/null
echo "  --- allocated vs physical ---"
TOTAL_MB=$(free -m | awk '/^Mem:/{print $2}')
ALLOC=$(qm list 2>/dev/null | awk 'NR>1{s+=$4} END{print s+0}')
echo "  host RAM: ${TOTAL_MB} MB | sum of VM maxmem: ${ALLOC} MB"
[ "${ALLOC:-0}" -gt "${TOTAL_MB:-1}" ] && echo "  *** OVERCOMMITTED — VMs are promised more RAM than the host has ***"
echo "  swap: $(swapon --show=NAME,SIZE,USED --noheadings 2>/dev/null | tr '\n' ' ')"
echo "  ksm: $(cat /sys/kernel/mm/ksm/run 2>/dev/null)  pages_shared=$(cat /sys/kernel/mm/ksm/pages_shared 2>/dev/null)"

hr "4. *** PROXMOX TASK LOG — who stopped the VM? ***"
echo "  (records every qmstop/qmstart/vzdump with timestamp AND the user"
echo "   that issued it — a manual or scripted stop shows up here)"
if [ -f /var/log/pve/tasks/index ]; then
    grep -iE "qmstop|qmshutdown|qmreset|qmdestroy|vzdump|qmstart" /var/log/pve/tasks/index 2>/dev/null | tail -30
else
    echo "  /var/log/pve/tasks/index not found"
fi

hr "5. EVENTS AROUND EACH STOP"
for t in "${TIMES_UTC[@]}"; do
    echo "  ══ $t UTC ══"
    journalctl --since "$t:00" --until "$(date -u -d "$t UTC +4 minutes" '+%Y-%m-%d %H:%M' 2>/dev/null):00" \
        --no-pager 2>/dev/null | grep -viE "pvestatd|pve-firewall|cron\[|systemd\[1\]: Started Session" | tail -25
    echo
done

hr "6. HIGH AVAILABILITY / FENCING"
ha-manager status 2>/dev/null || echo "  ha-manager not configured"
pvecm status 2>/dev/null | grep -iE "quorum|nodes|expected" || echo "  not in a cluster"
echo "  watchdog: $(systemctl is-active watchdog-mux 2>/dev/null)"
journalctl -u watchdog-mux --no-pager 2>/dev/null | tail -5

hr "7. BACKUP JOBS (stop-mode vzdump stops the VM)"
cat /etc/pve/jobs.cfg 2>/dev/null | grep -A6 vzdump || echo "  no jobs.cfg"
grep -rhiE "^\s*(mode|starttime|schedule)" /etc/vzdump.conf /etc/pve/vzdump.cron 2>/dev/null
ls -t /var/log/pve/tasks/ 2>/dev/null | head -5

hr "8. STORAGE HEALTH"
zpool status -x 2>/dev/null || echo "  no ZFS"
pvesm status 2>/dev/null | head -12
df -h / /var/lib/vz 2>/dev/null | tail -3
journalctl -k --no-pager 2>/dev/null | grep -ciE "I/O error|EXT4-fs error|blk_update_request" | xargs echo "  host disk errors:"

hr "9. HOST STABILITY"
echo "  did the HOST itself reboot? (that takes all VMs down)"
journalctl --list-boots 2>/dev/null | tail -6
echo "  host MCE / hardware:"
journalctl -k --no-pager 2>/dev/null | grep -ciE "machine check|mce:|Hardware Error|thermal" | xargs echo "   count:"
command -v sensors >/dev/null && sensors 2>/dev/null | grep -iE "Core|temp" | head -5

hr "10. VM CONFIG"
[ -n "$VMID" ] && qm config "$VMID" 2>/dev/null

echo
echo "═══════════════════════════════════════════════════════════════════════"
echo "Most likely answers, in order:"
echo "  section 2 non-empty -> HOST OOM killed the VM  (fix: reduce"
echo "     overcommit, add swap on the host, disable ballooning, or cap VMs)"
echo "  section 4 shows qmstop -> something/someone issued a stop"
echo "  section 6 shows fencing -> HA lost quorum and fenced the VM"
echo "  section 7 shows stop-mode backup -> vzdump stops the guest"
echo "  section 9 shows a host reboot -> the host went down, not the VM"
echo "═══════════════════════════════════════════════════════════════════════"
