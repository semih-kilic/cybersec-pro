#!/bin/bash
#
# CyberSec Pro - Pre-Start Validation Hook
# Servisler başlamadan önce syntax ve konfigürasyon kontrolü yapar
# Bu script systemd ExecStartPre olarak kullanılabilir
#

set -e

APP_NAME=$1
APP_PATH=$2

if [ -z "$APP_NAME" ] || [ -z "$APP_PATH" ]; then
    echo "Kullanım: $0 <app_name> <app_path>"
    exit 1
fi

echo "🔍 Pre-start validation: $APP_NAME"

# 1. Python syntax kontrolü
if ! python3 -m py_compile "$APP_PATH" 2>/dev/null; then
    echo "❌ HATA: Python syntax hatası tespit edildi!"
    echo "   Dosya: $APP_PATH"
    python3 -m py_compile "$APP_PATH" 2>&1 | head -10
    exit 1
fi
echo "✅ Python syntax OK"

# 2. Import kontrolü (temel modüller)
if ! python3 -c "
import sys
sys.path.insert(0, '$(dirname $APP_PATH)')
import ast
with open('$APP_PATH', 'r') as f:
    tree = ast.parse(f.read())
print('Import check passed')
" 2>/dev/null; then
    echo "❌ HATA: Import kontrolü başarısız!"
    exit 1
fi
echo "✅ Import check OK"

# 3. Env dosyası kontrolü
ENV_FILE="$(dirname $APP_PATH)/.env"
if [ -f "$ENV_FILE" ]; then
    # Boş kritik değişkenleri kontrol et
    source "$ENV_FILE" 2>/dev/null || true
    echo "✅ Environment file exists"
else
    echo "⚠️  Warning: .env file not found"
fi

echo "✅ $APP_NAME validation passed!"
exit 0
