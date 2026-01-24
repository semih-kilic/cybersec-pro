#!/bin/bash

# CyberSec Pro Docker Entrypoint
echo "🚀 CyberSec Pro başlatılıyor..."

# Backend başlat
cd /app/backend
source venv/bin/activate
python app.py &
BACKEND_PID=$!
echo "✅ Backend başlatıldı (PID: $BACKEND_PID)"

# Frontend başlat
cd /app/frontend
npx serve -s dist -l 5173 &
FRONTEND_PID=$!
echo "✅ Frontend başlatıldı (PID: $FRONTEND_PID)"

# IP göster
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌐 CyberSec Pro hazır!"
echo "  📍 Web: http://${IP:-localhost}:5173"
echo "  📍 API: http://${IP:-localhost}:5001"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Servisleri canlı tut
wait $BACKEND_PID $FRONTEND_PID
