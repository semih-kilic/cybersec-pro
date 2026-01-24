#!/bin/bash
#
# CyberSec Pro - Service Health Monitor
# Tüm servislerin durumunu kontrol eder ve sorunları otomatik düzeltir
#

LOG_FILE="/var/log/cybersec/health-monitor.log"
ALERT_EMAIL="scsa271@gmail.com"

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log fonksiyonu
log() {
    local level=$1
    local msg=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${msg}" | tee -a "$LOG_FILE"
}

# Servis durumunu kontrol et
check_service() {
    local service=$1
    local port=$2
    
    if systemctl is-active --quiet "$service"; then
        if [ -n "$port" ]; then
            if curl -s "http://localhost:$port/api/health" > /dev/null 2>&1; then
                echo -e "${GREEN}✅${NC} $service (port $port) - ÇALIŞIYOR"
                return 0
            else
                echo -e "${YELLOW}⚠️${NC} $service - Servis aktif ama API yanıt vermiyor"
                return 1
            fi
        else
            echo -e "${GREEN}✅${NC} $service - ÇALIŞIYOR"
            return 0
        fi
    else
        echo -e "${RED}❌${NC} $service - DURMUŞ"
        return 2
    fi
}

# Servisi yeniden başlat
restart_service() {
    local service=$1
    log "WARN" "Servis yeniden başlatılıyor: $service"
    sudo systemctl restart "$service"
    sleep 3
    
    if systemctl is-active --quiet "$service"; then
        log "INFO" "Servis başarıyla yeniden başlatıldı: $service"
        return 0
    else
        log "ERROR" "Servis başlatılamadı: $service"
        return 1
    fi
}

# API endpoint'ini test et
test_api() {
    local name=$1
    local url=$2
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅${NC} $name - OK"
        return 0
    else
        echo -e "${RED}❌${NC} $name - HTTP $response"
        return 1
    fi
}

# Python syntax kontrolü
validate_python() {
    local file=$1
    
    if python3 -m py_compile "$file" 2>/dev/null; then
        echo -e "${GREEN}✅${NC} $(basename $file) - Syntax OK"
        return 0
    else
        echo -e "${RED}❌${NC} $(basename $file) - Syntax HATA!"
        return 1
    fi
}

# Ana fonksiyon
main() {
    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║        🛡️  CyberSec Pro - Health Monitor                  ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"
    
    local errors=0
    
    # 1. Servis Durumları
    echo -e "${BLUE}[1] Servis Durumları${NC}"
    echo "----------------------------------------"
    
    check_service "cybersec-backend" "5001" || ((errors++))
    check_service "cybersec-sales" "5002" || ((errors++))
    check_service "cybersec-monitor" "" || ((errors++))
    check_service "nginx" "" || ((errors++))
    
    echo ""
    
    # 2. API Health Check
    echo -e "${BLUE}[2] API Health Check${NC}"
    echo "----------------------------------------"
    
    test_api "Kali Backend" "http://localhost:5001/api/health"
    test_api "Sales API" "http://localhost:5002/api/health"
    test_api "Frontend (Vite)" "http://localhost:5173"
    test_api "Nginx (Public)" "http://localhost:80"
    
    echo ""
    
    # 3. Python Syntax Kontrolü
    echo -e "${BLUE}[3] Python Syntax Kontrolü${NC}"
    echo "----------------------------------------"
    
    validate_python "/home/sam/APPS/cybersec-kali/backend/app.py" || ((errors++))
    validate_python "/home/sam/APPS/cybersec-sales/backend/app.py" || ((errors++))
    
    echo ""
    
    # 4. Disk Kullanımı
    echo -e "${BLUE}[4] Disk Kullanımı${NC}"
    echo "----------------------------------------"
    
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
    if [ "$disk_usage" -lt 80 ]; then
        echo -e "${GREEN}✅${NC} Disk: ${disk_usage}% kullanımda"
    elif [ "$disk_usage" -lt 90 ]; then
        echo -e "${YELLOW}⚠️${NC} Disk: ${disk_usage}% kullanımda (UYARI)"
    else
        echo -e "${RED}❌${NC} Disk: ${disk_usage}% kullanımda (KRİTİK!)"
        ((errors++))
    fi
    
    echo ""
    
    # 5. Bellek Kullanımı
    echo -e "${BLUE}[5] Bellek Kullanımı${NC}"
    echo "----------------------------------------"
    
    local mem_usage=$(free | awk '/Mem:/ {printf "%.0f", $3/$2 * 100}')
    if [ "$mem_usage" -lt 80 ]; then
        echo -e "${GREEN}✅${NC} RAM: ${mem_usage}% kullanımda"
    elif [ "$mem_usage" -lt 90 ]; then
        echo -e "${YELLOW}⚠️${NC} RAM: ${mem_usage}% kullanımda (UYARI)"
    else
        echo -e "${RED}❌${NC} RAM: ${mem_usage}% kullanımda (KRİTİK!)"
    fi
    
    echo ""
    
    # Özet
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    if [ "$errors" -eq 0 ]; then
        echo -e "${BLUE}║${NC}  ${GREEN}✅ Tüm sistemler normal çalışıyor!${NC}                       ${BLUE}║${NC}"
    else
        echo -e "${BLUE}║${NC}  ${RED}❌ $errors sorun tespit edildi!${NC}                             ${BLUE}║${NC}"
    fi
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"
    
    return $errors
}

# Eğer --auto-fix parametresi verilmişse sorunları otomatik düzelt
if [ "$1" = "--auto-fix" ]; then
    echo "🔧 Auto-fix modu aktif..."
    
    # Durmuş servisleri başlat
    for service in cybersec-backend cybersec-sales cybersec-monitor nginx; do
        if ! systemctl is-active --quiet "$service"; then
            echo "Başlatılıyor: $service"
            sudo systemctl start "$service"
        fi
    done
fi

# Log dizinini oluştur
sudo mkdir -p /var/log/cybersec

main
