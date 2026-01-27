#!/bin/bash
# Health check script for Kali container

# Check if tool API is running
curl -sf http://localhost:5003/health > /dev/null 2>&1
if [ $? -ne 0 ]; then
    exit 1
fi

# Check if SSH is running
pgrep sshd > /dev/null 2>&1
if [ $? -ne 0 ]; then
    exit 1
fi

exit 0
