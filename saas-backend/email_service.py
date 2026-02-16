#!/usr/bin/env python3
"""
📧 Email Notification Service for CyberSec Pro
Sends email notifications for user registrations, alerts, and updates

Author: CyberSec Pro Team
Version: 1.0.0
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Email configuration - Yandex SMTP
SMTP_HOST = 'smtp.yandex.com'
SMTP_PORT = 465  # SSL port for Yandex
SMTP_USER = 'cybersecpro@semihkilic.com'
SMTP_PASSWORD = 'jkmjddzxcsjjfohl'
ADMIN_EMAIL = 'cybersecpro@semihkilic.com'
FROM_EMAIL = 'cybersecpro@semihkilic.com'


def send_email(to_email: str, subject: str, html_body: str, text_body: str = None) -> bool:
    """
    Send an email using SMTP
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_body: HTML content of the email
        text_body: Plain text content (optional)
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured. Email not sent.")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = FROM_EMAIL
        msg['To'] = to_email
        
        # Attach text and HTML parts
        if text_body:
            part1 = MIMEText(text_body, 'plain')
            msg.attach(part1)
        
        part2 = MIMEText(html_body, 'html')
        msg.attach(part2)
        
        # Send email - Use SSL for Yandex (port 465)
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def notify_admin_new_registration(user_data: dict) -> bool:
    """
    Notify admin when a new user registers
    
    Args:
        user_data: Dictionary containing user information
    
    Returns:
        bool: True if notification sent successfully
    """
    subject = "🎉 New CyberSec Pro Registration!"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, sans-serif; background: #0a0a12; color: #fff; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #1a1a2e; border-radius: 12px; padding: 30px; border: 1px solid #367bf0; }}
            h1 {{ color: #367bf0; margin-bottom: 20px; }}
            .info {{ background: #0a0a12; padding: 15px; border-radius: 8px; margin: 10px 0; }}
            .label {{ color: #888; font-size: 12px; text-transform: uppercase; }}
            .value {{ color: #fff; font-size: 16px; margin-top: 5px; }}
            .highlight {{ color: #2ecc71; }}
            .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🐉 New Registration Alert</h1>
            <p>A new user has registered on CyberSec Pro!</p>
            
            <div class="info">
                <div class="label">Email</div>
                <div class="value highlight">{user_data.get('email', 'N/A')}</div>
            </div>
            
            <div class="info">
                <div class="label">Name</div>
                <div class="value">{user_data.get('first_name', '')} {user_data.get('last_name', '')}</div>
            </div>
            
            <div class="info">
                <div class="label">Organization</div>
                <div class="value">{user_data.get('organization_name', 'N/A')}</div>
            </div>
            
            <div class="info">
                <div class="label">Plan</div>
                <div class="value">{user_data.get('plan', 'Starter (Trial)')}</div>
            </div>
            
            <div class="info">
                <div class="label">Registration Time</div>
                <div class="value">{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</div>
            </div>
            
            <div class="footer">
                <p>This is an automated notification from CyberSec Pro.</p>
                <p>View all users at <a href="https://app.cybersecpro.com/admin" style="color: #367bf0;">Admin Dashboard</a></p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_body = f"""
    New CyberSec Pro Registration!
    
    Email: {user_data.get('email', 'N/A')}
    Name: {user_data.get('first_name', '')} {user_data.get('last_name', '')}
    Organization: {user_data.get('organization_name', 'N/A')}
    Plan: {user_data.get('plan', 'Starter (Trial)')}
    Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC
    """
    
    return send_email(ADMIN_EMAIL, subject, html_body, text_body)


def notify_user_welcome(user_data: dict) -> bool:
    """
    Send welcome email to new user
    
    Args:
        user_data: Dictionary containing user information
    
    Returns:
        bool: True if email sent successfully
    """
    first_name = user_data.get('first_name', 'Cyber Warrior')
    subject = "🐉 Welcome to CyberSec Pro - Your Journey Begins"
    
    html_body = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to CyberSec Pro</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a12;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, #0a0a12 0%, #1a1a2e 100%); padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 50%, #0d0d1a 100%); border-radius: 16px; border: 1px solid #2ecc71; box-shadow: 0 0 40px rgba(46, 204, 113, 0.15);">
                        
                        <!-- Header with Dragon -->
                        <tr>
                            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid rgba(46, 204, 113, 0.2);">
                                <div style="font-size: 64px; margin-bottom: 10px;">🐉</div>
                                <h1 style="margin: 0; font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #2ecc71, #27ae60, #00ff88); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: 1px;">
                                    CYBERSEC PRO
                                </h1>
                                <p style="margin: 8px 0 0 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 3px;">
                                    Kali Dragon Security Platform
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Welcome Message -->
                        <tr>
                            <td style="padding: 40px;">
                                <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                                    Welcome, {first_name}! 🎉
                                </h2>
                                
                                <p style="margin: 0 0 20px 0; color: #b0b0b0; font-size: 16px; line-height: 1.7;">
                                    Your account has been successfully created. You now have access to the most powerful cloud-based cybersecurity platform with <strong style="color: #2ecc71;">682 professional security tools</strong> at your fingertips.
                                </p>
                                
                                <p style="margin: 0 0 30px 0; color: #b0b0b0; font-size: 16px; line-height: 1.7;">
                                    No installations. No configurations. Just pure hacking power, ready when you are.
                                </p>
                                
                                <!-- CTA Button -->
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td align="center">
                                            <a href="https://cybersecpro.com/app/" style="display: inline-block; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); color: #0a0a12; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(46, 204, 113, 0.4);">
                                                🚀 Launch Your Dashboard
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Features Section -->
                        <tr>
                            <td style="padding: 0 40px 40px 40px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(46, 204, 113, 0.05); border-radius: 12px; border: 1px solid rgba(46, 204, 113, 0.15);">
                                    <tr>
                                        <td style="padding: 25px;">
                                            <h3 style="margin: 0 0 20px 0; color: #2ecc71; font-size: 16px; text-transform: uppercase; letter-spacing: 2px;">
                                                ⚡ What You Can Do
                                            </h3>
                                            
                                            <!-- Feature 1 -->
                                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 15px;">
                                                <tr>
                                                    <td width="40" style="vertical-align: top;">
                                                        <span style="font-size: 20px;">🔍</span>
                                                    </td>
                                                    <td style="color: #d0d0d0; font-size: 14px; line-height: 1.5;">
                                                        <strong style="color: #fff;">Network Reconnaissance</strong><br>
                                                        Nmap, Masscan, Netdiscover, ARP-scan
                                                    </td>
                                                </tr>
                                            </table>
                                            
                                            <!-- Feature 2 -->
                                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 15px;">
                                                <tr>
                                                    <td width="40" style="vertical-align: top;">
                                                        <span style="font-size: 20px;">🌐</span>
                                                    </td>
                                                    <td style="color: #d0d0d0; font-size: 14px; line-height: 1.5;">
                                                        <strong style="color: #fff;">Web Application Testing</strong><br>
                                                        Burp Suite, SQLMap, Nikto, Dirb, Gobuster
                                                    </td>
                                                </tr>
                                            </table>
                                            
                                            <!-- Feature 3 -->
                                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 15px;">
                                                <tr>
                                                    <td width="40" style="vertical-align: top;">
                                                        <span style="font-size: 20px;">🔑</span>
                                                    </td>
                                                    <td style="color: #d0d0d0; font-size: 14px; line-height: 1.5;">
                                                        <strong style="color: #fff;">Password Auditing</strong><br>
                                                        Hashcat, John the Ripper, Hydra, Medusa
                                                    </td>
                                                </tr>
                                            </table>
                                            
                                            <!-- Feature 4 -->
                                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                                <tr>
                                                    <td width="40" style="vertical-align: top;">
                                                        <span style="font-size: 20px;">📡</span>
                                                    </td>
                                                    <td style="color: #d0d0d0; font-size: 14px; line-height: 1.5;">
                                                        <strong style="color: #fff;">Wireless Security</strong><br>
                                                        Aircrack-ng, Reaver, Wifite, Fern WiFi Cracker
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Trial Notice -->
                        <tr>
                            <td style="padding: 0 40px 40px 40px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, rgba(241, 196, 15, 0.1) 0%, rgba(243, 156, 18, 0.1) 100%); border-radius: 12px; border: 1px solid rgba(241, 196, 15, 0.3);">
                                    <tr>
                                        <td style="padding: 20px; text-align: center;">
                                            <span style="font-size: 24px;">⏱️</span>
                                            <p style="margin: 10px 0 0 0; color: #f1c40f; font-size: 16px; font-weight: 600;">
                                                Your 14-Day Free Trial Starts Now!
                                            </p>
                                            <p style="margin: 5px 0 0 0; color: #b0b0b0; font-size: 13px;">
                                                Full access to all tools. No credit card required.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Quick Links -->
                        <tr>
                            <td style="padding: 0 40px 40px 40px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td width="33%" style="text-align: center; padding: 15px;">
                                            <a href="https://cybersecpro.com/docs" style="text-decoration: none;">
                                                <div style="font-size: 28px; margin-bottom: 8px;">📚</div>
                                                <div style="color: #2ecc71; font-size: 12px; font-weight: 600; text-transform: uppercase;">Docs</div>
                                            </a>
                                        </td>
                                        <td width="33%" style="text-align: center; padding: 15px; border-left: 1px solid #333; border-right: 1px solid #333;">
                                            <a href="https://cybersecpro.com/tools" style="text-decoration: none;">
                                                <div style="font-size: 28px; margin-bottom: 8px;">🛠️</div>
                                                <div style="color: #2ecc71; font-size: 12px; font-weight: 600; text-transform: uppercase;">Tools</div>
                                            </a>
                                        </td>
                                        <td width="33%" style="text-align: center; padding: 15px;">
                                            <a href="https://cybersecpro.com/contact" style="text-decoration: none;">
                                                <div style="font-size: 28px; margin-bottom: 8px;">💬</div>
                                                <div style="color: #2ecc71; font-size: 12px; font-weight: 600; text-transform: uppercase;">Support</div>
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 30px 40px; background: rgba(0, 0, 0, 0.3); border-radius: 0 0 16px 16px; border-top: 1px solid rgba(46, 204, 113, 0.1);">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="text-align: center;">
                                            <p style="margin: 0 0 10px 0; color: #666; font-size: 12px;">
                                                Questions? Just reply to this email - we're here to help.
                                            </p>
                                            <p style="margin: 0; color: #444; font-size: 11px;">
                                                © 2026 CyberSec Pro by Semih Kılıç | 
                                                <a href="https://cybersecpro.com" style="color: #2ecc71; text-decoration: none;">cybersecpro.com</a>
                                            </p>
                                            <p style="margin: 10px 0 0 0; color: #333; font-size: 10px;">
                                                You're receiving this email because you signed up for CyberSec Pro.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    text_body = f"""
    ═══════════════════════════════════════════════════
    🐉 CYBERSEC PRO - Welcome, {first_name}!
    ═══════════════════════════════════════════════════
    
    Your account has been successfully created!
    
    You now have access to 682 professional security tools:
    
    🔍 Network Reconnaissance - Nmap, Masscan, Netdiscover
    🌐 Web App Testing - Burp Suite, SQLMap, Nikto
    🔑 Password Auditing - Hashcat, John the Ripper, Hydra
    📡 Wireless Security - Aircrack-ng, Reaver, Wifite
    
    ⏱️ Your 14-Day Free Trial Starts Now!
    Full access to all tools. No credit card required.
    
    🚀 Launch Your Dashboard:
    https://cybersecpro.com/app/
    
    ───────────────────────────────────────────────────
    📚 Documentation: https://cybersecpro.com/docs
    🛠️ Tools Library: https://cybersecpro.com/tools
    💬 Support: https://cybersecpro.com/contact
    ───────────────────────────────────────────────────
    
    Questions? Just reply to this email.
    
    © 2026 CyberSec Pro by Semih Kılıç
    https://cybersecpro.com
    """
    
    return send_email(user_data.get('email'), subject, html_body, text_body)


def notify_trial_expiring(user_data: dict, days_left: int) -> bool:
    """
    Notify user that their trial is expiring
    
    Args:
        user_data: Dictionary containing user information
        days_left: Number of days until trial expires
    
    Returns:
        bool: True if email sent successfully
    """
    subject = f"⏰ Your CyberSec Pro trial expires in {days_left} days"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, sans-serif; background: #0a0a12; color: #fff; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #1a1a2e; border-radius: 12px; padding: 30px; border: 1px solid #f39c12; }}
            h1 {{ color: #f39c12; margin-bottom: 20px; }}
            .btn {{ display: inline-block; background: linear-gradient(135deg, #367bf0, #9b59b6); color: #fff; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }}
            .pricing {{ background: #0a0a12; padding: 20px; border-radius: 8px; margin: 20px 0; }}
            .price {{ font-size: 32px; color: #367bf0; font-weight: bold; }}
            .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Your Trial is Ending Soon</h1>
            <p>Hi {user_data.get('first_name', 'there')},</p>
            <p>Your CyberSec Pro trial will expire in <strong>{days_left} days</strong>. Don't lose access to your security tools!</p>
            
            <div class="pricing">
                <p style="margin: 0; color: #888;">Professional Plan</p>
                <div class="price">€29/month</div>
                <p style="margin: 10px 0 0 0; color: #ccc;">Full access to 682 tools, API, and priority support</p>
            </div>
            
            <a href="https://app.cybersecpro.com/billing" class="btn">Upgrade Now →</a>
            
            <div class="footer">
                <p>Questions? Contact us at cybersecpro@semihkilic.com</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(user_data.get('email'), subject, html_body)


# Test function
if __name__ == '__main__':
    # Test email notification
    test_user = {
        'email': 'test@example.com',
        'first_name': 'Test',
        'last_name': 'User',
        'organization_name': 'Test Company',
        'plan': 'Starter (Trial)'
    }
    
    print("Testing admin notification...")
    notify_admin_new_registration(test_user)
    
    print("Testing welcome email...")
    notify_user_welcome(test_user)
