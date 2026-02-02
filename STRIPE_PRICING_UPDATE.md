# 🛒 Stripe Fiyat Güncelleme Rehberi

## Yeni Fiyatlandırma (Şubat 2026)

| Plan | Eski Fiyat | Yeni Fiyat | Stripe Price ID |
|------|-----------|------------|-----------------|
| Starter | €0 (Free) | €0 (Free) | `price_starter_free` |
| Professional | €29/ay | **€19/ay** | Yeni oluşturulmalı |
| Team | €79/ay | **€49/ay** | Yeni oluşturulmalı |
| Enterprise | €149/ay | **€99/ay** | Yeni oluşturulmalı |

## Stripe Dashboard'da Yapılması Gerekenler

### 1. Yeni Price'lar Oluştur

Stripe Dashboard > Products > Fiyatlar

**Professional Plan:**
- Ürün: CyberSec Pro Professional
- Fiyat: €19.00 EUR
- Fatura Periyodu: Aylık (Monthly)
- Price ID'yi kopyala

**Team Plan:**
- Ürün: CyberSec Pro Team
- Fiyat: €49.00 EUR
- Fatura Periyodu: Aylık (Monthly)
- Price ID'yi kopyala

**Enterprise Plan:**
- Ürün: CyberSec Pro Enterprise
- Fiyat: €99.00 EUR
- Fatura Periyodu: Aylık (Monthly)
- Price ID'yi kopyala

### 2. Environment Variables Güncelle

```bash
# /home/cybersec/cybersec-pro/saas-backend/.env
STRIPE_PROFESSIONAL_PRICE_ID=price_xxxxx  # Yeni €19 price ID
STRIPE_TEAM_PRICE_ID=price_xxxxx          # Yeni €49 price ID
STRIPE_ENTERPRISE_PRICE_ID=price_xxxxx    # Yeni €99 price ID

# /home/cybersec/cybersec-pro/cybersec-sales/backend/.env
STRIPE_PROFESSIONAL_PRICE_ID=price_xxxxx  # Yeni €19 price ID
STRIPE_TEAM_PRICE_ID=price_xxxxx          # Yeni €49 price ID
STRIPE_ENTERPRISE_PRICE_ID=price_xxxxx    # Yeni €99 price ID
```

### 3. Backend'leri Yeniden Başlat

```bash
# SaaS Backend
pkill -f gunicorn
cd ~/cybersec-pro/saas-backend && gunicorn -c gunicorn.conf.py app:app &

# Sales Backend
pkill -f "python.*sales"
cd ~/cybersec-pro/cybersec-sales/backend && python app.py &
```

### 4. Mevcut Aboneleri Yönetme

Mevcut abone varsa:
- Eski fiyattan devam edebilirler (grandfathering)
- Veya yeni fiyata geçiş yapabilirler (avantaj!)
- Stripe Dashboard'dan subscription'ları güncelle

## Test Etme

```bash
# Test checkout session oluştur
curl -X POST https://semihkilic.com/api/create-checkout-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"plan": "professional"}'
```

## Launch Kampanyası Önerileri

### 🚀 Lansman İndirimi
- İlk 100 kullanıcı için ek %20 indirim
- Promo kod: `LAUNCH20`

### 📅 Yıllık Plan
- Yıllık ödeme = 2 ay ücretsiz
- Professional: €19 x 10 = **€190/yıl** (€228 yerine)
- Team: €49 x 10 = **€490/yıl** (€588 yerine)
- Enterprise: €99 x 10 = **€990/yıl** (€1188 yerine)

---
Güncelleme: 2 Şubat 2026
