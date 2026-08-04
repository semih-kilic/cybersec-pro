#!/bin/bash
# Network Monitoring Script
# Monitors IP address and restarts networking if needed

LOG_FILE="/var/log/cybersec-pro/network-monitor.log"
IP_EXPECTED="${MONITOR_EXPECTED_IP:-}"

# Create log directory
sudo mkdir -p /var/log/cybersec-pro
sudo chown "$USER:$USER" /var/log/cybersec-pro

check_ip() {
    CURRENT_IP=$(ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d'/' -f1)
    
    if [ -z "$IP_EXPECTED" ]; then
        echo "$(date): ℹ️ IP: $CURRENT_IP (no expected IP configured)" >> "$LOG_FILE"
        return 0
    fi
    
    if [ "$CURRENT_IP" != "$IP_EXPECTED" ]; then
        echo "$(date): ❌ IP LOST! Expected: $IP_EXPECTED, Got: $CURRENT_IP" >> "$LOG_FILE"
        
        # Try to fix
        echo "$(date): 🔧 Attempting to restore network..." >> "$LOG_FILE"
        sudo netplan apply
        sleep 5
        
        # Check again
        NEW_IP=$(ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d'/' -f1)
        if [ "$NEW_IP" = "$IP_EXPECTED" ]; then
            echo "$(date): ✅ IP RESTORED: $NEW_IP" >> "$LOG_FILE"
        else
            echo "$(date): ❌ IP RESTORE FAILED: $NEW_IP" >> "$LOG_FILE"
        fi
    else
        echo "$(date): ✅ IP OK: $CURRENT_IP" >> $LOG_FILE
    fi
}

check_ip