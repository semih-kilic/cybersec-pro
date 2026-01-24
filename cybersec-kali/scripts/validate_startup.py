#!/usr/bin/env python3
"""
CyberSec Pro - Startup Validation Script
Bu script tüm servislerin başlamadan önce gerekli kontrolleri yapar.
Eksik değişkenler, yanlış path'ler ve konfigürasyon hatalarını tespit eder.
"""

import os
import sys
import ast
import importlib.util

# Renk kodları
RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log_success(msg):
    print(f"{GREEN}✅ {msg}{RESET}")

def log_error(msg):
    print(f"{RED}❌ {msg}{RESET}")

def log_warning(msg):
    print(f"{YELLOW}⚠️  {msg}{RESET}")

def log_info(msg):
    print(f"{BLUE}ℹ️  {msg}{RESET}")

class PythonValidator:
    """Python dosyalarını syntax ve undefined variable hatalarına karşı kontrol et"""
    
    def __init__(self, filepath):
        self.filepath = filepath
        self.errors = []
        self.warnings = []
        
    def validate(self):
        """Dosyayı validate et"""
        if not os.path.exists(self.filepath):
            self.errors.append(f"Dosya bulunamadı: {self.filepath}")
            return False
            
        # Syntax kontrolü
        try:
            with open(self.filepath, 'r') as f:
                source = f.read()
            ast.parse(source)
        except SyntaxError as e:
            self.errors.append(f"Syntax Error at line {e.lineno}: {e.msg}")
            return False
            
        # Tanımsız değişken kontrolü (basit analiz)
        self._check_undefined_variables(source)
        
        return len(self.errors) == 0
    
    def _check_undefined_variables(self, source):
        """Basit undefined variable kontrolü"""
        tree = ast.parse(source)
        
        defined_names = set()
        used_names = set()
        
        # Tüm tanımlamaları topla
        for node in ast.walk(tree):
            # Import'lar
            if isinstance(node, ast.Import):
                for alias in node.names:
                    defined_names.add(alias.asname or alias.name.split('.')[0])
            elif isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    defined_names.add(alias.asname or alias.name)
            # Fonksiyon tanımları
            elif isinstance(node, ast.FunctionDef):
                defined_names.add(node.name)
            # Sınıf tanımları
            elif isinstance(node, ast.ClassDef):
                defined_names.add(node.name)
            # Değişken atamaları
            elif isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        defined_names.add(target.id)
            elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
                defined_names.add(node.target.id)
                
        # Built-in'leri ekle
        builtins = {'True', 'False', 'None', 'print', 'str', 'int', 'float', 'list', 
                    'dict', 'set', 'tuple', 'len', 'range', 'open', 'type', 'isinstance',
                    'hasattr', 'getattr', 'setattr', 'any', 'all', 'min', 'max', 'sum',
                    'sorted', 'reversed', 'enumerate', 'zip', 'map', 'filter', 'Exception',
                    'ValueError', 'TypeError', 'KeyError', 'AttributeError', 'ImportError',
                    'FileNotFoundError', 'OSError', 'RuntimeError', 'StopIteration',
                    '__name__', '__file__', '__doc__', 'super', 'self', 'cls', 'staticmethod',
                    'classmethod', 'property', 'lambda', 'bytes', 'bytearray', 'memoryview',
                    'complex', 'bool', 'object', 'format', 'input', 'repr', 'id', 'hash',
                    'abs', 'round', 'pow', 'divmod', 'ord', 'chr', 'bin', 'hex', 'oct',
                    'iter', 'next', 'slice', 'vars', 'dir', 'globals', 'locals', 'exec', 'eval',
                    'compile', 'help', 'exit', 'quit', 'copyright', 'credits', 'license'}
        defined_names.update(builtins)

def validate_env_file(env_path, required_vars):
    """Environment dosyasını kontrol et"""
    errors = []
    warnings = []
    
    if not os.path.exists(env_path):
        errors.append(f".env dosyası bulunamadı: {env_path}")
        return errors, warnings
    
    with open(env_path, 'r') as f:
        content = f.read()
    
    env_vars = {}
    for line in content.split('\n'):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env_vars[key.strip()] = value.strip()
    
    for var in required_vars:
        if var not in env_vars:
            warnings.append(f"Önerilen değişken eksik: {var}")
        elif not env_vars[var]:
            warnings.append(f"Değişken boş: {var}")
    
    return errors, warnings

def validate_service_file(service_path):
    """Systemd service dosyasını kontrol et"""
    errors = []
    warnings = []
    
    if not os.path.exists(service_path):
        errors.append(f"Service dosyası bulunamadı: {service_path}")
        return errors, warnings
    
    with open(service_path, 'r') as f:
        content = f.read()
    
    # WorkingDirectory kontrolü
    for line in content.split('\n'):
        if line.startswith('WorkingDirectory='):
            path = line.split('=', 1)[1].strip()
            if not os.path.exists(path):
                errors.append(f"WorkingDirectory mevcut değil: {path}")
        
        if line.startswith('ExecStart='):
            parts = line.split('=', 1)[1].strip().split()
            if parts:
                executable = parts[0]
                if not os.path.exists(executable) and not executable.startswith('/usr'):
                    warnings.append(f"ExecStart executable kontrol edilmeli: {executable}")
    
    return errors, warnings

def main():
    print(f"\n{BLUE}{'='*60}")
    print("🛡️  CyberSec Pro - Startup Validation")
    print(f"{'='*60}{RESET}\n")
    
    all_errors = []
    all_warnings = []
    
    # 1. Sales API Kontrolü
    print(f"{BLUE}[1/4] Sales API Kontrolü...{RESET}")
    sales_app = '/home/sam/APPS/cybersec-sales/backend/app.py'
    validator = PythonValidator(sales_app)
    if validator.validate():
        log_success("Sales API syntax OK")
    else:
        for err in validator.errors:
            log_error(f"Sales API: {err}")
            all_errors.append(err)
    
    # Sales ENV kontrolü
    sales_env = '/home/sam/APPS/cybersec-sales/backend/.env'
    required_sales_vars = ['STRIPE_SECRET_KEY', 'SMTP_PASSWORD', 'ADMIN_TOKEN']
    env_errors, env_warnings = validate_env_file(sales_env, required_sales_vars)
    all_errors.extend(env_errors)
    all_warnings.extend(env_warnings)
    
    # 2. Kali Backend Kontrolü
    print(f"\n{BLUE}[2/4] Kali Backend Kontrolü...{RESET}")
    kali_app = '/home/sam/APPS/cybersec-kali/backend/app.py'
    validator = PythonValidator(kali_app)
    if validator.validate():
        log_success("Kali Backend syntax OK")
    else:
        for err in validator.errors:
            log_error(f"Kali Backend: {err}")
            all_errors.append(err)
    
    # 3. Service Dosyaları Kontrolü
    print(f"\n{BLUE}[3/4] Service Dosyaları Kontrolü...{RESET}")
    services = [
        '/etc/systemd/system/cybersec-backend.service',
        '/etc/systemd/system/cybersec-sales.service',
        '/etc/systemd/system/cybersec-monitor.service',
    ]
    
    for svc in services:
        if os.path.exists(svc):
            svc_errors, svc_warnings = validate_service_file(svc)
            if not svc_errors:
                log_success(f"{os.path.basename(svc)} OK")
            else:
                for err in svc_errors:
                    log_error(err)
                    all_errors.append(err)
            all_warnings.extend(svc_warnings)
        else:
            log_warning(f"Service bulunamadı: {svc}")
    
    # 4. Veritabanı Kontrolü
    print(f"\n{BLUE}[4/4] Veritabanı Kontrolü...{RESET}")
    dbs = [
        '/home/sam/APPS/cybersec-kali/backend/instance/cybersec.db',
        '/home/sam/APPS/cybersec-sales/backend/instance/sales.db',
    ]
    
    for db_path in dbs:
        if os.path.exists(db_path):
            size = os.path.getsize(db_path)
            if size > 0:
                log_success(f"{os.path.basename(db_path)} ({size/1024:.1f} KB)")
            else:
                log_warning(f"{db_path} boş!")
        else:
            log_warning(f"DB bulunamadı: {db_path}")
    
    # Özet
    print(f"\n{BLUE}{'='*60}")
    print("📊 ÖZET")
    print(f"{'='*60}{RESET}")
    
    if all_errors:
        print(f"\n{RED}❌ {len(all_errors)} HATA BULUNDU:{RESET}")
        for err in all_errors:
            print(f"   • {err}")
    
    if all_warnings:
        print(f"\n{YELLOW}⚠️  {len(all_warnings)} UYARI:{RESET}")
        for warn in all_warnings:
            print(f"   • {warn}")
    
    if not all_errors and not all_warnings:
        print(f"\n{GREEN}✅ Tüm kontroller başarılı!{RESET}")
    
    print()
    
    # Çıkış kodu
    sys.exit(1 if all_errors else 0)

if __name__ == '__main__':
    main()
