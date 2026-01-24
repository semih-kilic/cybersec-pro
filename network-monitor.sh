#!/bin/bash
# Network Monitoring Script
# Monitors IP address and restarts networking if needed

LOG_FILE="/var/log/cybersec/network-monitor.log"
IP_EXPECTED="10.0.0.240"

# Create log directory
sudo mkdir -p /var/log/cybersec
sudo chown sam:sam /var/log/cybersec

check_ip() {
    CURRENT_IP=$(ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d'/' -f1)
    
    if [ "$CURRENT_IP" != "$IP_EXPECTED" ]; then
        echo "$(date): ❌ IP LOST! Expected: $IP_EXPECTED, Got: $CURRENT_IP" >> $LOG_FILE
        
        # Try to fix
        echo "$(date): 🔧 Attempting to restore network..." >> $LOG_FILE
        sudo netplan apply
        sleep 5
        
        # Check again
        NEW_IP=$(ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d'/' -f1)
        if [ "$NEW_IP" = "$IP_EXPECTED" ]; then
            echo "$(date): ✅ IP RESTORED: $NEW_IP" >> $LOG_FILE
        else
            echo "$(date): ❌ IP RESTORE FAILED: $NEW_IP" >> $LOG_FILE
        fi
    else
        echo "$(date): ✅ IP OK: $CURRENT_IP" >> $LOG_FILE
    fi
}

check_ip