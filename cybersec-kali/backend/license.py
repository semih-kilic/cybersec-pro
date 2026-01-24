"""
CyberSec Pro - Lisans Sistemi
Ticari satış için lisans doğrulama modülü
"""

import hashlib
import json
import os
import uuid
import requests
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify

# Lisans dosyası konumu
LICENSE_FILE = os.path.join(os.path.dirname(__file__), 'license.key')
LICENSE_SERVER = "https://license.cybersec-pro.com/api/verify"  # Kendi sunucunuz

class LicenseManager:
    def __init__(self):
        self.license_data = None
        self.is_valid = False
        self.load_license()
    
    def generate_machine_id(self):
        """Benzersiz makine kimliği oluştur"""
        # MAC adresi + hostname kombinasyonu
        import socket
        try:
            hostname = socket.gethostname()
            # Basit hash
            machine_string = f"{hostname}-{uuid.getnode()}"
            return hashlib.sha256(machine_string.encode()).hexdigest()[:32]
        except:
            return "unknown-machine"
    
    def load_license(self):
        """Lisans dosyasını yükle"""
        if os.path.exists(LICENSE_FILE):
            try:
                with open(LICENSE_FILE, 'r') as f:
                    self.license_data = json.load(f)
                self.validate_license()
            except:
                self.license_data = None
                self.is_valid = False
    
    def save_license(self, license_key, license_data):
        """Lisansı kaydet"""
        data = {
            'key': license_key,
            'activated_at': datetime.now().isoformat(),
            'machine_id': self.generate_machine_id(),
            **license_data
        }
        with open(LICENSE_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        self.license_data = data
        self.is_valid = True
    
    def validate_license(self):
        """Lisansı doğrula"""
        if not self.license_data:
            self.is_valid = False
            return False
        
        # Süre kontrolü
        if 'expires_at' in self.license_data:
            expires = datetime.fromisoformat(self.license_data['expires_at'])
            if datetime.now() > expires:
                self.is_valid = False
                return False
        
        # Makine kontrolü (opsiyonel - tek cihaz lisansı için)
        if self.license_data.get('single_machine'):
            if self.license_data.get('machine_id') != self.generate_machine_id():
                self.is_valid = False
                return False
        
        self.is_valid = True
        return True
    
    def activate_license(self, license_key):
        """Lisansı aktive et"""
        # Offline aktivasyon (basit)
        if self.validate_offline_key(license_key):
            self.save_license(license_key, {
                'type': 'lifetime',
                'plan': 'professional',
                'expires_at': (datetime.now() + timedelta(days=365)).isoformat()
            })
            return {'success': True, 'message': 'Lisans aktive edildi!'}
        
        # Online aktivasyon (sunucu varsa)
        try:
            response = requests.post(LICENSE_SERVER, json={
                'key': license_key,
                'machine_id': self.generate_machine_id()
            }, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('valid'):
                    self.save_license(license_key, data)
                    return {'success': True, 'message': 'Lisans aktive edildi!'}
                else:
                    return {'success': False, 'message': data.get('error', 'Geçersiz lisans')}
        except requests.exceptions.RequestException:
            # Sunucuya ulaşılamadı, offline dene
            pass
        
        return {'success': False, 'message': 'Lisans doğrulanamadı'}
    
    def validate_offline_key(self, key):
        """Offline lisans doğrulama"""
        # Format: CSEC-XXXX-XXXX-XXXX-XXXX
        if not key.startswith('CSEC-'):
            return False
        
        parts = key.split('-')
        if len(parts) != 5:
            return False
        
        # Basit checksum kontrolü
        # Gerçek üründe daha güçlü algoritma kullanın!
        key_data = ''.join(parts[1:4])
        checksum = parts[4]
        
        expected_checksum = hashlib.md5(key_data.encode()).hexdigest()[:4].upper()
        return checksum == expected_checksum
    
    def get_license_info(self):
        """Lisans bilgilerini döndür"""
        if not self.license_data:
            return {
                'status': 'not_activated',
                'message': 'Lisans aktive edilmemiş'
            }
        
        if not self.is_valid:
            return {
                'status': 'expired',
                'message': 'Lisans süresi dolmuş'
            }
        
        return {
            'status': 'active',
            'plan': self.license_data.get('plan', 'basic'),
            'expires_at': self.license_data.get('expires_at'),
            'features': self.get_features()
        }
    
    def get_features(self):
        """Plan'a göre özellikleri döndür"""
        plan = self.license_data.get('plan', 'basic') if self.license_data else 'trial'
        
        features = {
            'trial': {
                'tools': 50,
                'scans_per_day': 5,
                'reports': False,
                'api_access': False,
                'support': 'community'
            },
            'basic': {
                'tools': 100,
                'scans_per_day': 20,
                'reports': True,
                'api_access': False,
                'support': 'email'
            },
            'professional': {
                'tools': 230,
                'scans_per_day': -1,  # Unlimited
                'reports': True,
                'api_access': True,
                'support': 'priority'
            },
            'enterprise': {
                'tools': 230,
                'scans_per_day': -1,
                'reports': True,
                'api_access': True,
                'support': '24/7',
                'custom_tools': True,
                'white_label': True
            }
        }
        
        return features.get(plan, features['trial'])


# Global instance
license_manager = LicenseManager()


def require_license(f):
    """Lisans gerektiren endpoint'ler için decorator"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not license_manager.is_valid:
            return jsonify({
                'error': 'License required',
                'message': 'Bu özelliği kullanmak için geçerli bir lisans gerekli',
                'activation_url': '/api/license/activate'
            }), 403
        return f(*args, **kwargs)
    return decorated_function


def require_feature(feature):
    """Belirli bir özellik gerektiren endpoint'ler için decorator"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not license_manager.is_valid:
                return jsonify({'error': 'License required'}), 403
            
            features = license_manager.get_features()
            if not features.get(feature):
                return jsonify({
                    'error': 'Feature not available',
                    'message': f'Bu özellik ({feature}) mevcut planınızda yok',
                    'upgrade_url': '/api/license/upgrade'
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# Lisans key generator (sadece admin için)
def generate_license_key():
    """Yeni lisans anahtarı oluştur"""
    import random
    import string
    
    parts = []
    for _ in range(3):
        part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        parts.append(part)
    
    key_data = ''.join(parts)
    checksum = hashlib.md5(key_data.encode()).hexdigest()[:4].upper()
    
    return f"CSEC-{parts[0]}-{parts[1]}-{parts[2]}-{checksum}"


if __name__ == '__main__':
    # Test
    print("=== Lisans Key Generator ===")
    for i in range(5):
        key = generate_license_key()
        print(f"  {key}")
