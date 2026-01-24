# CyberSec Pro - Docker Image
# Kali Linux tabanlı, tüm güvenlik araçları hazır
# Build: docker build -t cybersec-pro .
# Run: docker run -d -p 5173:5173 -p 5001:5001 --name cybersec cybersec-pro

FROM kalilinux/kali-rolling

LABEL maintainer="CyberSec Pro Team"
LABEL version="2.0"
LABEL description="Professional Cybersecurity Testing Platform"

# Sistem güncellemesi ve temel araçlar
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    nodejs npm \
    git curl wget \
    sqlite3 \
    # Temel güvenlik araçları
    nmap masscan netdiscover \
    nikto whatweb wpscan \
    sqlmap gobuster dirb dirbuster \
    hydra john hashcat \
    metasploit-framework \
    burpsuite zaproxy \
    wireshark tcpdump \
    aircrack-ng \
    nuclei subfinder httpx \
    feroxbuster \
    exploitdb searchsploit \
    # Python araçları
    python3-impacket \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Çalışma dizini
WORKDIR /app

# Backend kopyala ve kur
COPY backend/ /app/backend/
RUN cd /app/backend && \
    python3 -m venv venv && \
    . venv/bin/activate && \
    pip install --no-cache-dir flask flask-cors flask-sqlalchemy python-dotenv PyJWT && \
    deactivate

# Frontend kopyala ve derle
COPY frontend/ /app/frontend/
RUN cd /app/frontend && \
    npm install --silent && \
    npm run build

# Başlatma scripti
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Portlar
EXPOSE 5001 5173

# Başlat
ENTRYPOINT ["/app/docker-entrypoint.sh"]
