# Proxmox host files (node: proxmox01)

These live on the **hypervisor**, not in the guest. Kept here so they are
versioned and reviewable; deploy them to `/usr/local/sbin/` and
`/etc/systemd/system/`.

## Why they exist

The guest VM was hard-stopped seven times. Everything inside the guest was
ruled out with evidence (96% idle CPU, 8% memory used, earlyoom never fired,
no OOM/panic/MCE/disk error, no ACPI event, zero clean shutdowns in wtmp).

The host's kernel log had the answer:

```
Out of memory: Killed process 2719897 (kvm) total-vm:17498552kB anon-rss:15011192kB
task_memcg=/qemu.slice/100.scope
```

Seven kills, matching the guest's last log line every time to within 14–72s.

**Cause:** VM 100 was allocated **16000 MB** on a host with **15868 MB** of
physical RAM, while host services need ~1855 MB — a ~2 GB shortfall. The guest
only *used* ~2 GB, but its page cache (9+ GB) counts against the kvm process's
RSS on the host, so the host filled up and the OOM killer took the largest
process: the VM.

## The files

| file | purpose |
|---|---|
| `cybersec-vm-resize.sh` | one-shot: `memory 12000` + `balloon 4096`, so the allocation fits the host and the guest can hand page cache back under pressure |
| `cybersec-vm-guard.sh` | restarts VM 100 within 30s if it stops unexpectedly (`onboot: 1` only covers a *host* boot). Respects a maintenance lock, and ignores a stale one so a failed operation cannot leave the VM down forever |
| `cybersec-vm-guard.{service,timer}` | runs the guard every 30 seconds |

Also applied on the host: swap raised from 2 GB to 10 GB
(`/var/lib/swap/cybersec-swapfile`, in `/etc/fstab`).
