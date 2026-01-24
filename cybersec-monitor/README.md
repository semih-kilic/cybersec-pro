# CyberSec Monitor

Service manager and health monitor for the CyberSec stack.

## Apply systemd units

Use the helper script to sync repo unit files into /etc and restart services:
- /home/sam/APPS/cybersec-monitor/apply_systemd_units.sh

Restart monitor only:
- sudo systemctl restart cybersec-monitor.service

View logs:
- csctl logs
- csctl startup-logs
- csctl journal

Snapshot current status (log-only):
- sudo systemctl kill -s SIGUSR1 cybersec-monitor.service

Reload monitor config:
- csctl reload

## Environment

Optional runtime settings live in /etc/cybersec/monitor.env (600 root:root).
See monitor.env.example for available keys (HTTP retries/backoff/pool and jitter included).

## Logs

- /var/log/cybersec/monitor.log
- /var/log/cybersec/startup.log
