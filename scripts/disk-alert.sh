#!/bin/bash
USAGE=$(df / | awk 'NR==2{print $5}' | tr -d '%')
if [ "$USAGE" -gt 80 ]; then
    echo "$(date): DISK WARNING: ${USAGE}% used" >> /home/cybersec/cybersec-pro/logs/disk-alert.log
    docker image prune -af 2>/dev/null
    docker builder prune -f 2>/dev/null
    find /home/cybersec/cybersec-pro/logs/ -name "*.log" -mtime +7 -delete 2>/dev/null
fi
