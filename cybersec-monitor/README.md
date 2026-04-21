# CyberSec Monitor

Operational monitor and startup orchestration helpers for CyberSec services.

## Contents

- `csctl` helper script
- systemd unit files:
	- `cybersec-monitor.service`
	- `cybersec-startup.service`
- `apply_systemd_units.sh` deployment helper
- `monitor.env.example` runtime configuration template

## Apply/Refresh systemd Units

From repository root:

```bash
cd cybersec-monitor
sudo ./apply_systemd_units.sh
```

## Common Operations

```bash
sudo systemctl restart cybersec-monitor.service
sudo systemctl status cybersec-monitor.service
```

Using helper:

```bash
csctl logs
csctl startup-logs
csctl journal
csctl reload
```

## Environment

Optional runtime overrides are loaded from:

- `/etc/cybersec/monitor.env`

Use `monitor.env.example` as reference.

## Logs

- `/var/log/cybersec/monitor.log`
- `/var/log/cybersec/startup.log`
