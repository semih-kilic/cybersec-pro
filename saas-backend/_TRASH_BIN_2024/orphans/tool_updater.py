#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - Tool Auto-Update Service
Monitors Kali Linux for new/updated security tools and syncs with the platform

Author: Semih Kılıç
Version: 1.0.0

Features:
- Watches for apt/package changes
- Auto-discovers new tools
- Syncs tool database
- Sends notifications for new tools
"""

import os
import sys
import time
import json
import hashlib
import subprocess
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import threading

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/cybersec/tool_updater.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
CHECK_INTERVAL = 3600  # Check every hour
STATE_FILE = '/var/lib/cybersec/tool_state.json'
KALI_TOOLS_PACKAGE = 'kali-tools-top10'

# Import tool registry
sys.path.insert(0, '/home/cybersec/cybersec-pro/saas-backend')
try:
    from tool_registry import get_registry, TOOL_DEFINITIONS
except ImportError:
    logger.error("Failed to import tool_registry")
    TOOL_DEFINITIONS = {}

def get_installed_packages() -> Dict[str, str]:
    """Get list of installed packages with versions"""
    try:
        result = subprocess.run(
            ['dpkg-query', '-W', '-f=${Package}=${Version}\n'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        packages = {}
        for line in result.stdout.strip().split('\n'):
            if '=' in line:
                pkg, version = line.split('=', 1)
                packages[pkg] = version
        
        return packages
    except Exception as e:
        logger.error(f"Failed to get packages: {e}")
        return {}

def get_kali_tools_packages() -> List[str]:
    """Get list of Kali security tool packages"""
    try:
        result = subprocess.run(
            ['apt-cache', 'depends', 'kali-tools-headless'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        packages = []
        for line in result.stdout.split('\n'):
            if 'Depends:' in line:
                pkg = line.split('Depends:')[1].strip()
                packages.append(pkg)
        
        return packages
    except Exception as e:
        logger.error(f"Failed to get Kali tools packages: {e}")
        return []

def load_state() -> Dict:
    """Load previous state from file"""
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load state: {e}")
    
    return {
        'last_check': None,
        'packages_hash': None,
        'tool_count': 0,
        'last_update': None
    }

def save_state(state: Dict):
    """Save state to file"""
    try:
        os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
        with open(STATE_FILE, 'w') as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save state: {e}")

def compute_packages_hash(packages: Dict[str, str]) -> str:
    """Compute hash of installed packages"""
    sorted_pkgs = sorted(packages.items())
    pkg_str = json.dumps(sorted_pkgs)
    return hashlib.sha256(pkg_str.encode()).hexdigest()[:16]

def check_for_updates() -> Dict:
    """Check for new or updated tools"""
    logger.info("Checking for tool updates...")
    
    state = load_state()
    packages = get_installed_packages()
    current_hash = compute_packages_hash(packages)
    
    changes = {
        'new_tools': [],
        'updated_tools': [],
        'removed_tools': [],
        'changed': current_hash != state.get('packages_hash')
    }
    
    if changes['changed']:
        logger.info("Package changes detected, refreshing tool registry...")
        
        # Refresh tool registry
        registry = get_registry()
        old_tools = set(registry.get_installed_tools().keys())
        registry.refresh()
        new_tools = set(registry.get_installed_tools().keys())
        
        # Detect changes
        changes['new_tools'] = list(new_tools - old_tools)
        changes['removed_tools'] = list(old_tools - new_tools)
        
        if changes['new_tools']:
            logger.info(f"New tools discovered: {changes['new_tools']}")
        
        if changes['removed_tools']:
            logger.info(f"Tools removed: {changes['removed_tools']}")
        
        # Update state
        state['packages_hash'] = current_hash
        state['tool_count'] = len(new_tools)
        state['last_update'] = datetime.utcnow().isoformat()
    
    state['last_check'] = datetime.utcnow().isoformat()
    save_state(state)
    
    return changes

def run_apt_update():
    """Run apt update to get latest package info"""
    try:
        logger.info("Running apt update...")
        result = subprocess.run(
            ['sudo', 'apt', 'update'],
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode == 0:
            logger.info("apt update completed successfully")
        else:
            logger.warning(f"apt update failed: {result.stderr}")
            
    except Exception as e:
        logger.error(f"Failed to run apt update: {e}")

def upgrade_tools():
    """Upgrade security tools"""
    try:
        logger.info("Checking for tool upgrades...")
        
        # Get upgradable security packages
        result = subprocess.run(
            ['apt', 'list', '--upgradable'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        upgradable = []
        for line in result.stdout.split('\n'):
            for tool_name in TOOL_DEFINITIONS.keys():
                if tool_name in line.lower():
                    upgradable.append(line.split('/')[0])
        
        if upgradable:
            logger.info(f"Upgradable tools: {upgradable}")
            
            # Upgrade tools (requires sudo)
            # subprocess.run(['sudo', 'apt', 'upgrade', '-y'] + upgradable)
        else:
            logger.info("All tools are up to date")
            
    except Exception as e:
        logger.error(f"Failed to upgrade tools: {e}")

def send_notification(changes: Dict):
    """Send notification about tool changes"""
    if not changes.get('new_tools') and not changes.get('removed_tools'):
        return
    
    try:
        # In production, send email/slack/webhook notification
        message = []
        
        if changes.get('new_tools'):
            message.append(f"🆕 New tools discovered: {', '.join(changes['new_tools'])}")
        
        if changes.get('removed_tools'):
            message.append(f"🗑️ Tools removed: {', '.join(changes['removed_tools'])}")
        
        notification = '\n'.join(message)
        logger.info(f"Notification: {notification}")
        
        # Could send to webhook
        # requests.post(WEBHOOK_URL, json={'text': notification})
        
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")

def run_service():
    """Main service loop"""
    logger.info("Starting CyberSec Tool Auto-Update Service")
    logger.info(f"Check interval: {CHECK_INTERVAL} seconds")
    
    while True:
        try:
            # Run apt update periodically
            run_apt_update()
            
            # Check for changes
            changes = check_for_updates()
            
            # Send notifications
            if changes['changed']:
                send_notification(changes)
            
            # Sleep until next check
            time.sleep(CHECK_INTERVAL)
            
        except KeyboardInterrupt:
            logger.info("Service stopped by user")
            break
        except Exception as e:
            logger.error(f"Error in service loop: {e}")
            time.sleep(60)  # Wait before retrying

def check_once():
    """Run a single check (for manual triggering)"""
    changes = check_for_updates()
    
    registry = get_registry()
    stats = registry.get_statistics()
    
    print(f"\n{'='*60}")
    print("TOOL UPDATE CHECK RESULTS")
    print(f"{'='*60}")
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    print(f"Total Installed: {stats['total_installed']}")
    print(f"Changes Detected: {changes['changed']}")
    
    if changes.get('new_tools'):
        print(f"\n🆕 New tools: {', '.join(changes['new_tools'])}")
    
    if changes.get('removed_tools'):
        print(f"\n🗑️ Removed tools: {', '.join(changes['removed_tools'])}")
    
    if not changes['changed']:
        print("\n✅ No changes detected")
    
    print(f"\nTools by Plan:")
    for plan, count in stats['by_plan'].items():
        print(f"  {plan}: {count} tools")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='CyberSec Tool Auto-Update Service')
    parser.add_argument('--daemon', action='store_true', help='Run as daemon')
    parser.add_argument('--check', action='store_true', help='Run single check')
    parser.add_argument('--refresh', action='store_true', help='Force refresh tools')
    
    args = parser.parse_args()
    
    if args.daemon:
        run_service()
    elif args.check:
        check_once()
    elif args.refresh:
        logger.info("Force refreshing tool registry...")
        registry = get_registry()
        registry.refresh()
        stats = registry.get_statistics()
        print(f"Tools refreshed: {stats['total_installed']} installed")
    else:
        # Default: run single check
        check_once()
