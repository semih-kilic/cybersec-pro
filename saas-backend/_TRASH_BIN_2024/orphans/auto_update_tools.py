#!/usr/bin/env python3
"""
🔄 Kali Linux Tools Auto-Update System
Automatically checks for and applies Kali tool updates daily

Author: CyberSec Pro Team  
Version: 1.0.0

This script should be run as a cron job:
0 3 * * * /path/to/auto_update_tools.py >> /var/log/kali-updates.log 2>&1
"""

import os
import sys
import subprocess
import json
import logging
from datetime import datetime
from pathlib import Path
import requests

# Configure logging
LOG_DIR = Path('/var/log/cybersec-pro')
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'tool-updates.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
UPDATE_STATE_FILE = Path('/var/lib/cybersec-pro/update-state.json')
KALI_TOOLS_REPO = 'https://gitlab.com/kalilinux/packages'
NOTIFY_WEBHOOK = os.environ.get('UPDATE_WEBHOOK_URL', '')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'cybersecpro@semihkilic.com')

# Core tools to monitor for updates
CRITICAL_TOOLS = [
    'nmap', 'metasploit-framework', 'burpsuite', 'sqlmap', 'nikto',
    'john', 'hashcat', 'hydra', 'aircrack-ng', 'wireshark',
    'gobuster', 'dirb', 'wpscan', 'masscan', 'netcat-openbsd',
    'wfuzz', 'whatweb', 'dnsenum', 'fierce', 'recon-ng',
    'maltego', 'theharvester', 'set', 'autopsy', 'volatility3',
    'binwalk', 'foremost', 'steghide', 'exiftool', 'ncrack'
]


def load_update_state() -> dict:
    """Load the previous update state"""
    try:
        if UPDATE_STATE_FILE.exists():
            with open(UPDATE_STATE_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.warning(f"Could not load update state: {e}")
    
    return {
        'last_check': None,
        'last_update': None,
        'tool_versions': {},
        'update_history': []
    }


def save_update_state(state: dict):
    """Save the update state"""
    try:
        UPDATE_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(UPDATE_STATE_FILE, 'w') as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        logger.error(f"Could not save update state: {e}")


def get_installed_version(package: str) -> str:
    """Get the installed version of a package"""
    try:
        result = subprocess.run(
            ['dpkg-query', '-W', '-f=${Version}', package],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception as e:
        logger.debug(f"Could not get version for {package}: {e}")
    return None


def get_available_version(package: str) -> str:
    """Get the available version from apt cache"""
    try:
        result = subprocess.run(
            ['apt-cache', 'policy', package],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            for line in result.stdout.split('\n'):
                if 'Candidate:' in line:
                    return line.split('Candidate:')[1].strip()
    except Exception as e:
        logger.debug(f"Could not get available version for {package}: {e}")
    return None


def check_for_updates() -> list:
    """Check which tools have updates available"""
    logger.info("🔍 Checking for tool updates...")
    
    updates_available = []
    
    for tool in CRITICAL_TOOLS:
        installed = get_installed_version(tool)
        available = get_available_version(tool)
        
        if installed and available and installed != available:
            updates_available.append({
                'tool': tool,
                'current_version': installed,
                'new_version': available
            })
            logger.info(f"  📦 {tool}: {installed} → {available}")
    
    if not updates_available:
        logger.info("  ✅ All tools are up to date!")
    else:
        logger.info(f"  📋 {len(updates_available)} updates available")
    
    return updates_available


def update_apt_cache() -> bool:
    """Update the apt package cache"""
    logger.info("🔄 Updating package cache...")
    try:
        result = subprocess.run(
            ['apt-get', 'update'],
            capture_output=True,
            text=True,
            timeout=300
        )
        return result.returncode == 0
    except Exception as e:
        logger.error(f"Failed to update apt cache: {e}")
        return False


def apply_updates(updates: list, dry_run: bool = False) -> list:
    """Apply pending updates"""
    if not updates:
        return []
    
    logger.info(f"🚀 Applying {len(updates)} updates...")
    
    successful_updates = []
    
    for update in updates:
        tool = update['tool']
        logger.info(f"  📥 Updating {tool}...")
        
        if dry_run:
            logger.info(f"    [DRY RUN] Would update {tool}")
            successful_updates.append(update)
            continue
        
        try:
            result = subprocess.run(
                ['apt-get', 'install', '-y', '--only-upgrade', tool],
                capture_output=True,
                text=True,
                timeout=600
            )
            
            if result.returncode == 0:
                logger.info(f"    ✅ {tool} updated successfully")
                successful_updates.append(update)
            else:
                logger.warning(f"    ⚠️ Failed to update {tool}: {result.stderr}")
                
        except Exception as e:
            logger.error(f"    ❌ Error updating {tool}: {e}")
    
    return successful_updates


def send_notification(updates: list, successful: list):
    """Send notification about updates"""
    if not updates:
        return
    
    # Log summary
    logger.info("=" * 50)
    logger.info("📊 UPDATE SUMMARY")
    logger.info(f"  Total updates available: {len(updates)}")
    logger.info(f"  Successfully applied: {len(successful)}")
    logger.info(f"  Failed: {len(updates) - len(successful)}")
    logger.info("=" * 50)
    
    # Send webhook notification if configured
    if NOTIFY_WEBHOOK:
        try:
            payload = {
                'text': f"🔄 CyberSec Pro Tool Update Report",
                'blocks': [
                    {
                        'type': 'section',
                        'text': {
                            'type': 'mrkdwn',
                            'text': f"*Kali Tool Update Report*\n\n"
                                   f"📦 Updates available: {len(updates)}\n"
                                   f"✅ Successfully applied: {len(successful)}\n"
                                   f"❌ Failed: {len(updates) - len(successful)}"
                        }
                    }
                ]
            }
            
            requests.post(NOTIFY_WEBHOOK, json=payload, timeout=10)
            logger.info("📤 Webhook notification sent")
            
        except Exception as e:
            logger.warning(f"Could not send webhook notification: {e}")
    
    # Send email notification
    try:
        from email_service import send_email
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: #0a0a12; color: #fff; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #1a1a2e; padding: 20px; border-radius: 12px;">
                <h2 style="color: #367bf0;">🔄 Kali Tool Update Report</h2>
                <p>Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
                
                <table style="width: 100%; margin: 20px 0;">
                    <tr>
                        <td style="padding: 10px; background: #0a0a12; border-radius: 8px;">
                            <div style="color: #888; font-size: 12px;">Updates Available</div>
                            <div style="color: #367bf0; font-size: 24px; font-weight: bold;">{len(updates)}</div>
                        </td>
                        <td style="padding: 10px; background: #0a0a12; border-radius: 8px;">
                            <div style="color: #888; font-size: 12px;">Applied</div>
                            <div style="color: #2ecc71; font-size: 24px; font-weight: bold;">{len(successful)}</div>
                        </td>
                    </tr>
                </table>
                
                <h3 style="color: #fff;">Updated Tools:</h3>
                <ul style="color: #ccc;">
                    {''.join(f"<li>{u['tool']}: {u['current_version']} → {u['new_version']}</li>" for u in successful)}
                </ul>
            </div>
        </body>
        </html>
        """
        
        send_email(
            ADMIN_EMAIL,
            f"🔄 Kali Tools Update: {len(successful)}/{len(updates)} updated",
            html_body
        )
        logger.info("📧 Email notification sent")
        
    except Exception as e:
        logger.warning(f"Could not send email notification: {e}")


def main():
    """Main update function"""
    logger.info("=" * 50)
    logger.info("🐉 CyberSec Pro Auto-Update System")
    logger.info(f"   Started at: {datetime.utcnow().isoformat()}")
    logger.info("=" * 50)
    
    # Load state
    state = load_update_state()
    
    # Check if we're running as root
    if os.geteuid() != 0:
        logger.warning("⚠️ Not running as root. Updates will be simulated (dry run).")
        dry_run = True
    else:
        dry_run = False
    
    # Update apt cache
    if not dry_run:
        if not update_apt_cache():
            logger.error("Failed to update apt cache. Exiting.")
            sys.exit(1)
    
    # Check for updates
    updates = check_for_updates()
    
    # Record current versions
    for tool in CRITICAL_TOOLS:
        version = get_installed_version(tool)
        if version:
            state['tool_versions'][tool] = version
    
    # Apply updates
    successful = apply_updates(updates, dry_run=dry_run)
    
    # Update state
    state['last_check'] = datetime.utcnow().isoformat()
    if successful:
        state['last_update'] = datetime.utcnow().isoformat()
        state['update_history'].append({
            'date': datetime.utcnow().isoformat(),
            'updates': successful
        })
        # Keep only last 30 days of history
        state['update_history'] = state['update_history'][-30:]
    
    save_update_state(state)
    
    # Send notifications
    send_notification(updates, successful)
    
    logger.info(f"🏁 Update check completed at {datetime.utcnow().isoformat()}")
    
    return 0 if not updates or len(successful) == len(updates) else 1


if __name__ == '__main__':
    sys.exit(main())
