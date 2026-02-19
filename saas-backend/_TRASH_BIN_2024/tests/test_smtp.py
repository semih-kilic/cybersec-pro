#!/usr/bin/env python3
import os
import smtplib
import ssl
from dotenv import load_dotenv

load_dotenv()

smtp_host = os.environ.get('SMTP_HOST')
smtp_port = int(os.environ.get('SMTP_PORT', 465))
smtp_user = os.environ.get('SMTP_USER')
smtp_pass = os.environ.get('SMTP_PASSWORD')

print(f"SMTP Host: {smtp_host}")
print(f"SMTP Port: {smtp_port}")
print(f"SMTP User: {smtp_user}")
print(f"SMTP Pass: {'*' * len(smtp_pass) if smtp_pass else 'NOT SET'}")

try:
    context = ssl.create_default_context()
    print("\nConnecting to SMTP server...")
    server = smtplib.SMTP_SSL(smtp_host, smtp_port, context=context)
    print("Connected! Logging in...")
    server.login(smtp_user, smtp_pass)
    print("Login successful!")
    
    # Send test email
    from email.mime.text import MIMEText
    msg = MIMEText("Test email from CyberSec Pro feedback system")
    msg['Subject'] = '[TEST] CyberSec Pro Feedback System'
    msg['From'] = smtp_user
    msg['To'] = 'cybersecpro@semihkilic.com'
    
    print("Sending test email...")
    server.send_message(msg)
    print("Test email sent successfully!")
    server.quit()
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
