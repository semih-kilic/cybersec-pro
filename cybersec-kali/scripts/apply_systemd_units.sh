#!/bin/bash
set -euo pipefail

cat <<'EOF' | sudo tee /etc/systemd/system/cybersec-backend.service
[Unit]
Description=CyberSec Kali Platform - Backend API
After=network.target
Wants=network-online.target
StartLimitIntervalSec=0
StartLimitBurst=0

[Service]
Type=simple
User=sam
Group=sam
WorkingDirectory=/home/sam/APPS/cybersec-kali/backend
ExecStartPre=/bin/bash -c 'PYTHONPYCACHEPREFIX=/tmp /home/sam/APPS/cybersec-kali/backend/venv/bin/python -m py_compile /home/sam/APPS/cybersec-kali/backend/app.py'
ExecStart=/home/sam/APPS/cybersec-kali/backend/venv/bin/gunicorn --bind 0.0.0.0:5001 --workers 2 --threads 4 app:app
ExecStartPost=/bin/bash -c 'sleep 2 && /usr/bin/curl -fsS http://127.0.0.1:5001/api/health >/dev/null'
Restart=always
RestartSec=5
UMask=0077

# Reliability & limits
TimeoutStartSec=30
TimeoutStopSec=30
LimitNOFILE=65535
CPUQuota=80%
MemoryMax=1G
LogsDirectory=cybersec

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=full
ProtectHome=read-only
ProtectHostname=yes
ProtectClock=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
ProtectKernelLogs=yes
RestrictSUIDSGID=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
RestrictRealtime=yes
RestrictNamespaces=yes
ProtectProc=invisible
ProcSubset=pid
SystemCallArchitectures=native
SystemCallFilter=@system-service
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
CapabilityBoundingSet=
AmbientCapabilities=
ReadWritePaths=/var/log/cybersec /home/sam/APPS/cybersec-kali/backend/instance

Environment="FLASK_APP=app.py"
Environment="FLASK_ENV=production"
Environment="FLASK_DEBUG=0"
Environment="PYTHONUNBUFFERED=1"
Environment="PYTHONDONTWRITEBYTECODE=1"
Environment="PYTHONPYCACHEPREFIX=/tmp"
Environment="MONITOR_BANDWIDTH_MBPS=1000"
EnvironmentFile=/etc/cybersec/admin.env

StandardOutput=append:/var/log/cybersec/backend.log
StandardError=append:/var/log/cybersec/backend.log

[Install]
WantedBy=multi-user.target
EOF

cat <<'EOF' | sudo tee /etc/systemd/system/cybersec-admin-token-rotate.service
[Unit]
Description=Rotate CyberSec admin token
Wants=cybersec-backend.service
After=cybersec-backend.service

[Service]
Type=oneshot
User=root
Group=root
UMask=0077
RuntimeDirectory=cybersec
RuntimeDirectoryMode=0750
ExecStart=/home/sam/APPS/cybersec-kali/scripts/rotate_admin_token.sh

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=full
ProtectHome=yes
ProtectHostname=yes
ProtectClock=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
ProtectKernelLogs=yes
RestrictSUIDSGID=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
RestrictRealtime=yes
RestrictNamespaces=yes
ProtectProc=invisible
ProcSubset=pid
SystemCallArchitectures=native
SystemCallFilter=@system-service
RestrictAddressFamilies=AF_UNIX
CapabilityBoundingSet=
AmbientCapabilities=
ReadWritePaths=/etc/cybersec /var/log/cybersec

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl restart cybersec-backend.service
