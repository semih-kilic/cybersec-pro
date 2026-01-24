#!/bin/bash
# Send alert when a service fails
SERVICE_NAME="$1"
ALERT_EMAIL="${ALERT_EMAIL:-semihkilic@gmail.com}"

echo "⚠️ Service failed: $SERVICE_NAME"

# Send email using Python
python3 << EOF
import smtplib
from email.mime.text import MIMEText
import os

email_user = os.environ.get('EMAIL_USER', '')
email_pass = os.environ.get('EMAIL_PASS', '')

if not email_user or not email_pass:
    print("Email not configured")
    exit(0)

msg = MIMEText(f"""
CyberSec Pro Service Alert

Service: $SERVICE_NAME
Status: FAILED
Time: $(date)
Server: $(hostname)

The service has failed and systemd is attempting to restart it.
Please check the logs: journalctl -u $SERVICE_NAME

---
CyberSec Pro Monitoring
""")

msg['Subject'] = f"🚨 CRITICAL: $SERVICE_NAME Failed"
msg['From'] = email_user
msg['To'] = '$ALERT_EMAIL'

try:
    with smtplib.SMTP('smtp.gmail.com', 587) as server:
        server.starttls()
        server.login(email_user, email_pass)
        server.send_message(msg)
    print("Alert sent")
except Exception as e:
    print(f"Email error: {e}")
EOF
