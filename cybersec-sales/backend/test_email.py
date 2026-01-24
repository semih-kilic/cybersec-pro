#!/usr/bin/env python3
"""
Test email sending via Yandex SMTP
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Config
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.yandex.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', 465))
SMTP_EMAIL = os.getenv('SMTP_EMAIL', 'cybersecpro@semihkilic.com')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')

print("=" * 60)
print("🧪 CyberSec Pro - Email Test")
print("=" * 60)
print(f"SMTP Server: {SMTP_SERVER}")
print(f"SMTP Port: {SMTP_PORT}")
print(f"From Email: {SMTP_EMAIL}")
print(f"Password: {'*' * len(SMTP_PASSWORD) if SMTP_PASSWORD else 'NOT SET!'}")
print("=" * 60)

if not SMTP_PASSWORD:
    print("❌ ERROR: SMTP_PASSWORD is not set in .env file!")
    sys.exit(1)

# Test recipient - change this to your email
TEST_EMAIL = input("Enter test email address: ").strip()
if not TEST_EMAIL:
    print("❌ No email provided!")
    sys.exit(1)

# Create test email
msg = MIMEMultipart('alternative')
msg['Subject'] = '🧪 CyberSec Pro - SMTP Test Email'
msg['From'] = f"CyberSec Professional <{SMTP_EMAIL}>"
msg['To'] = TEST_EMAIL

html_content = """
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 40px; font-family: Arial, sans-serif; background: #0a0a0a;">
    <div style="max-width: 500px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 16px; padding: 40px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
        <h1 style="color: #00ff88; margin-bottom: 20px;">Email Test Successful!</h1>
        <p style="color: #ccd6f6; font-size: 16px; line-height: 1.6;">
            Your Yandex SMTP configuration is working correctly.
        </p>
        <div style="background: #0a0a0a; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #00ff88;">
            <p style="color: #8892b0; margin: 0 0 10px; font-size: 12px; text-transform: uppercase;">Configuration</p>
            <p style="color: #00d4ff; margin: 0; font-family: monospace;">smtp.yandex.com:465 (SSL)</p>
        </div>
        <p style="color: #4a5568; font-size: 12px; margin-top: 30px;">
            CyberSec Professional © 2026
        </p>
    </div>
</body>
</html>
"""

msg.attach(MIMEText(html_content, 'html'))

print(f"\n📧 Sending test email to {TEST_EMAIL}...")

try:
    context = ssl.create_default_context()
    
    with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
        print("   → Connected to SMTP server")
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        print("   → Authentication successful")
        server.send_message(msg)
        print("   → Email sent!")
    
    print("\n" + "=" * 60)
    print("✅ SUCCESS! Email sent to", TEST_EMAIL)
    print("=" * 60)
    print("\nPlease check your inbox (and spam folder).")
    
except smtplib.SMTPAuthenticationError as e:
    print(f"\n❌ AUTHENTICATION FAILED!")
    print(f"Error: {e}")
    print("\nPlease check:")
    print("  1. Email and password are correct")
    print("  2. Less secure app access is enabled in Yandex")
    print("  3. Or use an App Password if 2FA is enabled")
    
except smtplib.SMTPConnectError as e:
    print(f"\n❌ CONNECTION FAILED!")
    print(f"Error: {e}")
    print("\nPlease check:")
    print("  1. SMTP server and port are correct")
    print("  2. Firewall is not blocking the connection")
    
except Exception as e:
    print(f"\n❌ ERROR: {type(e).__name__}")
    print(f"Details: {e}")
