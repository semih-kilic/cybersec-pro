"""
CyberSec Professional - Email Service
Sends professional HTML emails for license delivery
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# SMTP Configuration
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.yandex.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', 465))
SMTP_EMAIL = os.getenv('SMTP_EMAIL', 'cybersecpro@semihkilic.com')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'CyberSec Professional')


def get_license_email_template(customer_name, customer_email, license_key, plan_name, expiry_date):
    """Generate professional HTML email template for license delivery"""
    
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your CyberSec Professional License</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 255, 136, 0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid rgba(0, 255, 136, 0.2);">
                            <div style="display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #00ff88 0%, #00d4ff 100%); border-radius: 50px; margin-bottom: 20px;">
                                <span style="font-size: 28px; font-weight: bold; color: #0a0a0a; letter-spacing: 2px;">🛡️ CYBERSEC PRO</span>
                            </div>
                            <h1 style="color: #ffffff; font-size: 28px; margin: 20px 0 10px; font-weight: 600;">Welcome to CyberSec Professional!</h1>
                            <p style="color: #8892b0; font-size: 16px; margin: 0;">Your license has been activated successfully</p>
                        </td>
                    </tr>
                    
                    <!-- Greeting -->
                    <tr>
                        <td style="padding: 30px 40px 20px;">
                            <p style="color: #ccd6f6; font-size: 16px; line-height: 1.6; margin: 0;">
                                Dear <strong style="color: #00ff88;">{customer_name}</strong>,
                            </p>
                            <p style="color: #8892b0; font-size: 15px; line-height: 1.8; margin: 15px 0 0;">
                                Thank you for purchasing <strong style="color: #00d4ff;">{plan_name}</strong>! 
                                Your professional security toolkit is now ready to use.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- License Key Box -->
                    <tr>
                        <td style="padding: 20px 40px;">
                            <div style="background: linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(0, 212, 255, 0.1) 100%); border: 2px solid rgba(0, 255, 136, 0.3); border-radius: 12px; padding: 30px; text-align: center;">
                                <p style="color: #8892b0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 15px;">Your License Key</p>
                                <div style="background: #0a0a0a; border-radius: 8px; padding: 20px; border: 1px solid rgba(0, 255, 136, 0.2);">
                                    <code style="font-size: 24px; font-weight: bold; color: #00ff88; letter-spacing: 3px; font-family: 'Courier New', monospace;">{license_key}</code>
                                </div>
                                <p style="color: #ff6b6b; font-size: 12px; margin: 15px 0 0;">
                                    ⚠️ Keep this key secure. Do not share it with anyone.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- License Details -->
                    <tr>
                        <td style="padding: 20px 40px;">
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 15px; background: rgba(0, 255, 136, 0.05); border-radius: 8px 0 0 8px; border-left: 3px solid #00ff88;">
                                        <p style="color: #8892b0; font-size: 12px; margin: 0 0 5px; text-transform: uppercase;">Plan</p>
                                        <p style="color: #ccd6f6; font-size: 16px; font-weight: 600; margin: 0;">{plan_name}</p>
                                    </td>
                                    <td style="padding: 15px; background: rgba(0, 212, 255, 0.05); border-radius: 0 8px 8px 0; border-right: 3px solid #00d4ff;">
                                        <p style="color: #8892b0; font-size: 12px; margin: 0 0 5px; text-transform: uppercase;">Valid Until</p>
                                        <p style="color: #ccd6f6; font-size: 16px; font-weight: 600; margin: 0;">{expiry_date}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Features -->
                    <tr>
                        <td style="padding: 20px 40px;">
                            <h3 style="color: #ccd6f6; font-size: 18px; margin: 0 0 20px; border-bottom: 1px solid rgba(0, 255, 136, 0.2); padding-bottom: 10px;">
                                🚀 What's Included
                            </h3>
                            <table role="presentation" style="width: 100%;">
                                <tr>
                                    <td style="padding: 8px 0; color: #8892b0; font-size: 14px;">
                                        <span style="color: #00ff88; margin-right: 10px;">✓</span> 230+ Professional Security Tools
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #8892b0; font-size: 14px;">
                                        <span style="color: #00ff88; margin-right: 10px;">✓</span> Real-time Vulnerability Scanning
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #8892b0; font-size: 14px;">
                                        <span style="color: #00ff88; margin-right: 10px;">✓</span> Automated Penetration Testing
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #8892b0; font-size: 14px;">
                                        <span style="color: #00ff88; margin-right: 10px;">✓</span> Professional PDF Reports
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #8892b0; font-size: 14px;">
                                        <span style="color: #00ff88; margin-right: 10px;">✓</span> Priority Support & Updates
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                        <td style="padding: 20px 40px 30px; text-align: center;">
                            <a href="https://cybersec.semihkilic.com/activate" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #00ff88 0%, #00d4ff 100%); color: #0a0a0a; text-decoration: none; font-weight: bold; font-size: 16px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">
                                Activate Now →
                            </a>
                        </td>
                    </tr>
                    
                    <!-- Quick Start Guide -->
                    <tr>
                        <td style="padding: 30px 40px; background: rgba(0, 0, 0, 0.3);">
                            <h3 style="color: #ccd6f6; font-size: 16px; margin: 0 0 15px;">
                                📖 Quick Start Guide
                            </h3>
                            <ol style="color: #8892b0; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">
                                <li>Download and install CyberSec Professional</li>
                                <li>Open the application and go to Settings → License</li>
                                <li>Enter your license key and click "Activate"</li>
                                <li>Start scanning and securing your systems!</li>
                            </ol>
                        </td>
                    </tr>
                    
                    <!-- Support -->
                    <tr>
                        <td style="padding: 30px 40px; text-align: center; border-top: 1px solid rgba(0, 255, 136, 0.1);">
                            <p style="color: #8892b0; font-size: 14px; margin: 0 0 10px;">
                                Need help? Our support team is here for you.
                            </p>
                            <a href="mailto:support@semihkilic.com" style="color: #00d4ff; text-decoration: none; font-size: 14px;">
                                support@semihkilic.com
                            </a>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px; background: #0a0a0a; text-align: center;">
                            <p style="color: #4a5568; font-size: 12px; margin: 0 0 10px;">
                                © 2026 CyberSec Professional. All rights reserved.
                            </p>
                            <p style="color: #4a5568; font-size: 11px; margin: 0;">
                                This email was sent to {customer_email}
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def get_welcome_email_template(customer_name):
    """Generate welcome email template"""
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0a0a0a;">
    <table style="width: 100%; max-width: 600px; margin: 0 auto; background: #1a1a2e; border-radius: 12px;">
        <tr>
            <td style="padding: 40px; text-align: center;">
                <h1 style="color: #00ff88; margin-bottom: 20px;">🛡️ Welcome, {customer_name}!</h1>
                <p style="color: #ccd6f6; font-size: 16px; line-height: 1.6;">
                    Thank you for joining CyberSec Professional. 
                    Your journey to professional security starts now!
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def send_license_email(customer_email, customer_name, license_key, plan_name, expiry_date):
    """Send license key email to customer"""
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = f"🔐 Your CyberSec Professional License Key - {plan_name}"
        message["From"] = f"{SMTP_FROM_NAME} <{SMTP_EMAIL}>"
        message["To"] = customer_email
        
        # Plain text version
        text_content = f"""
CyberSec Professional - License Delivery

Dear {customer_name},

Thank you for purchasing {plan_name}!

Your License Key: {license_key}

Valid Until: {expiry_date}

Quick Start:
1. Download and install CyberSec Professional
2. Go to Settings → License
3. Enter your license key
4. Start scanning!

Need help? Contact: support@semihkilic.com

© 2026 CyberSec Professional
"""
        
        # HTML version
        html_content = get_license_email_template(
            customer_name, customer_email, license_key, plan_name, expiry_date
        )
        
        # Attach both versions
        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        message.attach(part1)
        message.attach(part2)
        
        # Create SSL context
        context = ssl.create_default_context()
        
        # Send email via Yandex SMTP
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, customer_email, message.as_string())
        
        print(f"✅ License email sent to {customer_email}")
        return True, "Email sent successfully"
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ SMTP Auth Error: {e}")
        return False, f"Authentication failed: {e}"
    except Exception as e:
        print(f"❌ Email Error: {e}")
        return False, str(e)


def send_payment_confirmation(customer_email, customer_name, amount, plan_name):
    """Send payment confirmation email"""
    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = f"✅ Payment Confirmed - CyberSec Professional"
        message["From"] = f"{SMTP_FROM_NAME} <{SMTP_EMAIL}>"
        message["To"] = customer_email
        
        html_content = f"""
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0a0a0a;">
    <table style="width: 100%; max-width: 600px; margin: 0 auto; background: #1a1a2e; border-radius: 12px; padding: 40px;">
        <tr>
            <td style="text-align: center;">
                <div style="font-size: 60px; margin-bottom: 20px;">✅</div>
                <h1 style="color: #00ff88;">Payment Successful!</h1>
                <p style="color: #ccd6f6; font-size: 16px;">
                    Dear {customer_name},<br><br>
                    Your payment of <strong style="color: #00d4ff;">${amount}</strong> for <strong>{plan_name}</strong> has been confirmed.
                </p>
                <p style="color: #8892b0; font-size: 14px;">
                    Your license key will be sent in a separate email shortly.
                </p>
                <hr style="border: 1px solid #2d3748; margin: 30px 0;">
                <p style="color: #4a5568; font-size: 12px;">
                    © 2026 CyberSec Professional
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
"""
        
        message.attach(MIMEText(html_content, "html"))
        
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, customer_email, message.as_string())
        
        return True, "Payment confirmation sent"
        
    except Exception as e:
        return False, str(e)


# Test function
if __name__ == "__main__":
    # Test email sending
    success, msg = send_license_email(
        customer_email="test@example.com",
        customer_name="Test User",
        license_key="CSPRO-XXXX-XXXX-XXXX-XXXX",
        plan_name="Professional Annual",
        expiry_date="January 4, 2027"
    )
    print(f"Test result: {success} - {msg}")
