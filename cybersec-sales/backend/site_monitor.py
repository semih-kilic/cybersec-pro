#!/usr/bin/env python3
"""
CyberSec Pro - Site Monitor
Monitors website and services, sends alerts when down
"""

import os
import sys
import time
import requests
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
import subprocess
import json

# Configuration
SMTP_SERVER = 'smtp.yandex.com'
SMTP_PORT = 465
SMTP_EMAIL = 'cybersecpro@semihkilic.com'
SMTP_PASSWORD = 'wxmhohhouucskrbq'
ALERT_EMAIL = 'scsa271@gmail.com'

# Services to monitor
SERVICES = [
    {
        'name': 'Sales Website',
        'url': 'https://semihkilic.com',
        'type': 'http',
        'critical': True
    },
    {
        'name': 'Sales API',
        'url': 'http://127.0.0.1:5002/api/health',
        'type': 'http',
        'critical': True
    },
    {
        'name': 'Main App API',
        'url': 'http://127.0.0.1:5001/api/health',
        'type': 'http',
        'critical': True
    },
    {
        'name': 'Frontend Dev Server',
        'url': 'http://127.0.0.1:8080',
        'type': 'http',
        'critical': False
    }
]

# Track service states
service_states = {}
STATE_FILE = '/tmp/monitor_states.json'


def load_states():
    """Load previous service states"""
    global service_states
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r') as f:
                service_states = json.load(f)
    except:
        service_states = {}


def save_states():
    """Save current service states"""
    with open(STATE_FILE, 'w') as f:
        json.dump(service_states, f)


def check_http_service(url, timeout=10):
    """Check if HTTP service is responding"""
    try:
        response = requests.get(url, timeout=timeout, verify=False)
        return response.status_code == 200, response.status_code
    except requests.exceptions.ConnectionError:
        return False, 'Connection Error'
    except requests.exceptions.Timeout:
        return False, 'Timeout'
    except Exception as e:
        return False, str(e)


def check_process(name):
    """Check if a process is running"""
    try:
        result = subprocess.run(['pgrep', '-f', name], capture_output=True, text=True)
        return result.returncode == 0
    except:
        return False


def check_cloudflare_tunnel():
    """Check if Cloudflare tunnel is running"""
    return check_process('cloudflared')


def send_alert(subject, services_down, services_up=None):
    """Send alert email"""
    now = datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')
    
    down_rows = ""
    for svc in services_down:
        down_rows += f'''
        <tr>
            <td style="padding:12px 15px;border-bottom:1px solid rgba(255,255,255,0.1);">
                <span style="color:#ef4444;font-weight:bold;">🔴 {svc['name']}</span>
            </td>
            <td style="padding:12px 15px;border-bottom:1px solid rgba(255,255,255,0.1);color:#8892b0;">
                {svc.get('error', 'Unknown')}
            </td>
        </tr>'''
    
    up_rows = ""
    if services_up:
        for svc in services_up:
            up_rows += f'''
            <tr>
                <td style="padding:12px 15px;border-bottom:1px solid rgba(255,255,255,0.1);">
                    <span style="color:#22c55e;font-weight:bold;">🟢 {svc['name']}</span>
                </td>
                <td style="padding:12px 15px;border-bottom:1px solid rgba(255,255,255,0.1);color:#8892b0;">
                    Back Online
                </td>
            </tr>'''
    
    html = f'''<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a;">
<table style="width:100%"><tr><td align="center" style="padding:40px 20px;">
<table style="width:100%;max-width:600px;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;">

<tr><td style="padding:30px 40px;text-align:center;background:linear-gradient(135deg,#ef4444,#dc2626);">
<span style="font-size:48px;">⚠️</span>
<h1 style="color:#fff;font-size:28px;margin:15px 0 5px;">Service Alert!</h1>
<p style="color:rgba(255,255,255,0.9);font-size:16px;margin:0;">CyberSec Pro Monitoring</p>
</td></tr>

<tr><td style="padding:30px 40px;">
<h3 style="color:#ef4444;margin:0 0 15px;">🔴 Services Down:</h3>
<table style="width:100%;background:rgba(0,0,0,0.2);border-radius:8px;">
<tr style="background:rgba(239,68,68,0.1);">
    <th style="padding:12px 15px;text-align:left;color:#ccd6f6;">Service</th>
    <th style="padding:12px 15px;text-align:left;color:#ccd6f6;">Status</th>
</tr>
{down_rows}
</table>
</td></tr>

{f'''<tr><td style="padding:0 40px 30px;">
<h3 style="color:#22c55e;margin:0 0 15px;">🟢 Services Recovered:</h3>
<table style="width:100%;background:rgba(0,0,0,0.2);border-radius:8px;">
{up_rows}
</table>
</td></tr>''' if up_rows else ''}

<tr><td style="padding:20px 40px;background:#0a0a0a;text-align:center;">
<p style="color:#4a5568;font-size:12px;margin:0;">CyberSec Pro Site Monitor</p>
<p style="color:#4a5568;font-size:11px;margin:5px 0 0;">{now}</p>
</td></tr>

</table></td></tr></table></body></html>'''
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f'CyberSec Monitor <{SMTP_EMAIL}>'
        msg['To'] = ALERT_EMAIL
        msg.attach(MIMEText(html, 'html'))
        
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        
        print(f"✅ Alert sent to {ALERT_EMAIL}")
        return True
    except Exception as e:
        print(f"❌ Failed to send alert: {e}")
        return False


def send_recovery_alert(services_recovered):
    """Send recovery notification"""
    now = datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')
    
    rows = ""
    for svc in services_recovered:
        rows += f'''
        <tr>
            <td style="padding:12px 15px;border-bottom:1px solid rgba(255,255,255,0.1);">
                <span style="color:#22c55e;font-weight:bold;">🟢 {svc['name']}</span>
            </td>
            <td style="padding:12px 15px;border-bottom:1px solid rgba(255,255,255,0.1);color:#22c55e;">
                Back Online ✓
            </td>
        </tr>'''
    
    html = f'''<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a;">
<table style="width:100%"><tr><td align="center" style="padding:40px 20px;">
<table style="width:100%;max-width:600px;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;">

<tr><td style="padding:30px 40px;text-align:center;background:linear-gradient(135deg,#22c55e,#16a34a);">
<span style="font-size:48px;">✅</span>
<h1 style="color:#fff;font-size:28px;margin:15px 0 5px;">Services Recovered!</h1>
<p style="color:rgba(255,255,255,0.9);font-size:16px;margin:0;">All systems back online</p>
</td></tr>

<tr><td style="padding:30px 40px;">
<table style="width:100%;background:rgba(0,0,0,0.2);border-radius:8px;">
<tr style="background:rgba(34,197,94,0.1);">
    <th style="padding:12px 15px;text-align:left;color:#ccd6f6;">Service</th>
    <th style="padding:12px 15px;text-align:left;color:#ccd6f6;">Status</th>
</tr>
{rows}
</table>
</td></tr>

<tr><td style="padding:20px 40px;background:#0a0a0a;text-align:center;">
<p style="color:#4a5568;font-size:12px;margin:0;">CyberSec Pro Site Monitor</p>
<p style="color:#4a5568;font-size:11px;margin:5px 0 0;">{now}</p>
</td></tr>

</table></td></tr></table></body></html>'''
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'✅ Services Recovered - {", ".join([s["name"] for s in services_recovered])}'
        msg['From'] = f'CyberSec Monitor <{SMTP_EMAIL}>'
        msg['To'] = ALERT_EMAIL
        msg.attach(MIMEText(html, 'html'))
        
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        
        print(f"✅ Recovery alert sent to {ALERT_EMAIL}")
        return True
    except Exception as e:
        print(f"❌ Failed to send recovery alert: {e}")
        return False


def monitor_once():
    """Run one monitoring cycle"""
    load_states()
    
    services_down = []
    services_recovered = []
    
    print(f"\n{'='*50}")
    print(f"🔍 Monitoring at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}")
    
    # Check Cloudflare Tunnel
    tunnel_up = check_cloudflare_tunnel()
    tunnel_name = 'Cloudflare Tunnel'
    was_down = service_states.get(tunnel_name, {}).get('down', False)
    
    if tunnel_up:
        print(f"✅ {tunnel_name}: RUNNING")
        if was_down:
            services_recovered.append({'name': tunnel_name})
        service_states[tunnel_name] = {'down': False, 'last_check': time.time()}
    else:
        print(f"❌ {tunnel_name}: DOWN")
        if not was_down:
            services_down.append({'name': tunnel_name, 'error': 'Process not running', 'critical': True})
        service_states[tunnel_name] = {'down': True, 'last_check': time.time()}
    
    # Check HTTP services
    for service in SERVICES:
        name = service['name']
        was_down = service_states.get(name, {}).get('down', False)
        
        if service['type'] == 'http':
            is_up, status = check_http_service(service['url'])
            
            if is_up:
                print(f"✅ {name}: OK")
                if was_down:
                    services_recovered.append({'name': name})
                service_states[name] = {'down': False, 'last_check': time.time()}
            else:
                print(f"❌ {name}: DOWN ({status})")
                if not was_down:
                    services_down.append({
                        'name': name, 
                        'error': str(status),
                        'critical': service.get('critical', False)
                    })
                service_states[name] = {'down': True, 'last_check': time.time(), 'error': str(status)}
    
    # Send alerts
    if services_down:
        critical_down = [s for s in services_down if s.get('critical')]
        subject = f"🚨 {'CRITICAL: ' if critical_down else ''}{len(services_down)} Service(s) DOWN"
        send_alert(subject, services_down)
    
    if services_recovered:
        send_recovery_alert(services_recovered)
    
    save_states()
    
    return len(services_down) == 0


def monitor_loop(interval=60):
    """Continuous monitoring loop"""
    print(f"\n🛡️ CyberSec Pro Site Monitor Started")
    print(f"📧 Alerts will be sent to: {ALERT_EMAIL}")
    print(f"⏱️  Check interval: {interval} seconds")
    
    while True:
        try:
            monitor_once()
            time.sleep(interval)
        except KeyboardInterrupt:
            print("\n👋 Monitor stopped")
            break
        except Exception as e:
            print(f"❌ Monitor error: {e}")
            time.sleep(interval)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='CyberSec Pro Site Monitor')
    parser.add_argument('--once', action='store_true', help='Run once and exit')
    parser.add_argument('--interval', type=int, default=60, help='Check interval in seconds')
    args = parser.parse_args()
    
    if args.once:
        monitor_once()
    else:
        monitor_loop(args.interval)
