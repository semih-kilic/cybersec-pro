"""
CyberSec Pro - License Protection System
Handles trial limitations and full activation
"""

import os
import json
import hashlib
import platform
import subprocess
import uuid
from datetime import datetime, timedelta
from pathlib import Path

class LicenseProtection:
    """
    License protection with trial mode and full activation
    
    Trial Mode:
    - 30 tools only
    - 5 scans per day
    - 14 days duration
    - "TRIAL" watermark
    
    Full Mode:
    - 230+ tools
    - Unlimited scans
    - 1 year duration
    - No watermark
    """
    
    LICENSE_FILE = Path.home() / '.cybersec-pro' / 'license.dat'
    TRIAL_FILE = Path.home() / '.cybersec-pro' / 'trial.dat'
    
    # Trial limitations
    TRIAL_TOOLS = 30
    TRIAL_SCANS_PER_DAY = 5
    TRIAL_DAYS = 14
    
    # Plan features
    PLANS = {
        'trial': {
            'tools': 30,
            'scans_per_day': 5,
            'reports': False,
            'api_access': False,
            'watermark': True
        },
        'basic': {
            'tools': 100,
            'scans_per_day': 20,
            'reports': True,
            'api_access': False,
            'watermark': False
        },
        'professional': {
            'tools': -1,  # unlimited
            'scans_per_day': -1,
            'reports': True,
            'api_access': True,
            'watermark': False
        },
        'enterprise': {
            'tools': -1,
            'scans_per_day': -1,
            'reports': True,
            'api_access': True,
            'watermark': False
        }
    }
    
    def __init__(self):
        self.license_data = None
        self.trial_data = None
        self._ensure_dirs()
        self._load_data()
    
    def _ensure_dirs(self):
        """Ensure license directory exists"""
        self.LICENSE_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    def _load_data(self):
        """Load license and trial data"""
        if self.LICENSE_FILE.exists():
            try:
                with open(self.LICENSE_FILE, 'r') as f:
                    self.license_data = json.load(f)
            except:
                self.license_data = None
        
        if self.TRIAL_FILE.exists():
            try:
                with open(self.TRIAL_FILE, 'r') as f:
                    self.trial_data = json.load(f)
            except:
                self.trial_data = None
    
    def _save_license(self):
        """Save license data"""
        with open(self.LICENSE_FILE, 'w') as f:
            json.dump(self.license_data, f)
    
    def _save_trial(self):
        """Save trial data"""
        with open(self.TRIAL_FILE, 'w') as f:
            json.dump(self.trial_data, f)
    
    def get_machine_id(self) -> str:
        """Generate unique machine identifier"""
        identifiers = []
        
        # Platform info
        identifiers.append(platform.node())
        identifiers.append(platform.machine())
        identifiers.append(platform.processor())
        
        # Try to get more hardware info
        try:
            if platform.system() == 'Linux':
                # Machine ID
                if os.path.exists('/etc/machine-id'):
                    with open('/etc/machine-id', 'r') as f:
                        identifiers.append(f.read().strip())
                # MAC address
                result = subprocess.run(['ip', 'link'], capture_output=True, text=True)
                if result.returncode == 0:
                    identifiers.append(result.stdout[:200])
            elif platform.system() == 'Darwin':
                result = subprocess.run(['ioreg', '-rd1', '-c', 'IOPlatformExpertDevice'], 
                                       capture_output=True, text=True)
                if result.returncode == 0:
                    identifiers.append(result.stdout[:200])
            elif platform.system() == 'Windows':
                result = subprocess.run(['wmic', 'csproduct', 'get', 'uuid'], 
                                       capture_output=True, text=True)
                if result.returncode == 0:
                    identifiers.append(result.stdout)
        except:
            pass
        
        # Create hash
        combined = '|'.join(identifiers)
        return hashlib.sha256(combined.encode()).hexdigest()[:32]
    
    def start_trial(self) -> dict:
        """Start or continue trial period"""
        if self.trial_data:
            # Trial already started
            start_date = datetime.fromisoformat(self.trial_data['start_date'])
            days_used = (datetime.utcnow() - start_date).days
            days_left = max(0, self.TRIAL_DAYS - days_used)
            
            return {
                'status': 'trial',
                'days_left': days_left,
                'expired': days_left == 0,
                'scans_today': self.trial_data.get('scans_today', 0),
                'scans_date': self.trial_data.get('scans_date'),
                'features': self.PLANS['trial']
            }
        
        # Start new trial
        self.trial_data = {
            'start_date': datetime.utcnow().isoformat(),
            'machine_id': self.get_machine_id(),
            'scans_today': 0,
            'scans_date': datetime.utcnow().strftime('%Y-%m-%d')
        }
        self._save_trial()
        
        return {
            'status': 'trial',
            'days_left': self.TRIAL_DAYS,
            'expired': False,
            'scans_today': 0,
            'features': self.PLANS['trial']
        }
    
    def can_scan(self) -> tuple[bool, str]:
        """Check if user can perform a scan"""
        status = self.get_status()
        
        if status['status'] == 'active':
            # Full license - check plan limits
            plan = status.get('plan', 'professional')
            limit = self.PLANS[plan]['scans_per_day']
            if limit == -1:
                return True, "Unlimited scans"
            # In production, track daily scans
            return True, f"Scans remaining: {limit}"
        
        elif status['status'] == 'trial':
            if status.get('expired'):
                return False, "Trial expired. Please purchase a license."
            
            # Check daily limit
            today = datetime.utcnow().strftime('%Y-%m-%d')
            if self.trial_data.get('scans_date') != today:
                self.trial_data['scans_date'] = today
                self.trial_data['scans_today'] = 0
                self._save_trial()
            
            if self.trial_data['scans_today'] >= self.TRIAL_SCANS_PER_DAY:
                return False, f"Daily scan limit reached ({self.TRIAL_SCANS_PER_DAY}/day in trial)"
            
            return True, f"Scans remaining today: {self.TRIAL_SCANS_PER_DAY - self.trial_data['scans_today']}"
        
        return False, "No license. Please start trial or purchase."
    
    def record_scan(self):
        """Record a scan (for trial limits)"""
        if self.trial_data:
            today = datetime.utcnow().strftime('%Y-%m-%d')
            if self.trial_data.get('scans_date') != today:
                self.trial_data['scans_date'] = today
                self.trial_data['scans_today'] = 0
            self.trial_data['scans_today'] += 1
            self._save_trial()
    
    def get_available_tools_count(self) -> int:
        """Get number of tools available based on license"""
        status = self.get_status()
        
        if status['status'] == 'active':
            plan = status.get('plan', 'professional')
            return self.PLANS[plan]['tools']
        elif status['status'] == 'trial':
            if status.get('expired'):
                return 0
            return self.TRIAL_TOOLS
        return 0
    
    def get_status(self) -> dict:
        """Get current license/trial status"""
        # Check for active license first
        if self.license_data:
            expires = datetime.fromisoformat(self.license_data['expires_at'])
            if expires > datetime.utcnow():
                return {
                    'status': 'active',
                    'plan': self.license_data['plan'],
                    'expires_at': self.license_data['expires_at'],
                    'days_left': (expires - datetime.utcnow()).days,
                    'features': self.PLANS[self.license_data['plan']]
                }
            else:
                return {
                    'status': 'expired',
                    'plan': self.license_data['plan'],
                    'message': 'License expired. Please renew.'
                }
        
        # Check trial
        if self.trial_data:
            return self.start_trial()
        
        # No license, no trial
        return {
            'status': 'none',
            'message': 'No license found. Start a trial or purchase.'
        }
    
    def activate_license(self, license_key: str, server_url: str = None) -> dict:
        """
        Activate license with online verification
        
        In production, this calls the license server to:
        1. Verify the key is valid
        2. Check it's not already activated elsewhere
        3. Bind to this machine ID
        4. Return plan details and expiry
        """
        import requests
        
        machine_id = self.get_machine_id()
        
        # Default to semihkilic.com
        if not server_url:
            server_url = 'https://semihkilic.com/api/verify'
        
        try:
            response = requests.post(server_url, json={
                'license_key': license_key,
                'machine_id': machine_id
            }, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('valid'):
                    self.license_data = {
                        'key': license_key,
                        'plan': data['plan'],
                        'expires_at': data['expires_at'],
                        'machine_id': machine_id,
                        'activated_at': datetime.utcnow().isoformat()
                    }
                    self._save_license()
                    return {
                        'success': True,
                        'message': 'License activated successfully!',
                        'plan': data['plan'],
                        'expires_at': data['expires_at']
                    }
                else:
                    return {
                        'success': False,
                        'message': data.get('error', 'Invalid license key')
                    }
            else:
                return {
                    'success': False,
                    'message': 'Server error. Please try again.'
                }
        except requests.exceptions.ConnectionError:
            return {
                'success': False,
                'message': 'Cannot connect to license server. Check your internet connection.'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Activation failed: {str(e)}'
            }
    
    def deactivate_license(self) -> dict:
        """Deactivate current license"""
        if self.LICENSE_FILE.exists():
            self.LICENSE_FILE.unlink()
        self.license_data = None
        return {'success': True, 'message': 'License deactivated'}
    
    def show_watermark(self) -> bool:
        """Check if watermark should be shown"""
        status = self.get_status()
        if status['status'] == 'active':
            return self.PLANS[status['plan']].get('watermark', False)
        return True  # Show watermark for trial


# Singleton instance
_protection = None

def get_protection() -> LicenseProtection:
    global _protection
    if _protection is None:
        _protection = LicenseProtection()
    return _protection
