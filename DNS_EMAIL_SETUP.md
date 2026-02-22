# DNS & Email Deliverability Configuration
## CyberSec Pro - V16 Emergency Fixes

Bu belge, e-postaların spam klasörüne düşmesini önlemek için gerekli DNS ayarlarını açıklar.

---

## 🔧 Gerekli DNS Kayıtları (semihkilic.com için)

### 1. SPF (Sender Policy Framework)
E-postaların hangi sunuculardan gönderilebileceğini belirtir.

**DNS TXT Kaydı:**
```
Hostname: @ veya semihkilic.com
Type: TXT
Value: v=spf1 include:_spf.yandex.net ~all
```

### 2. DKIM (DomainKeys Identified Mail)
E-postaları dijital olarak imzalar.

**Yandex Mail için DKIM kurulumu:**
1. Yandex Mail admin paneline git: https://mail.yandex.com/for/semihkilic.com/admin
2. "Mail → DKIM" bölümüne git
3. DKIM anahtarını oluştur
4. Verilen TXT kaydını DNS'e ekle

**DNS TXT Kaydı (örnek):**
```
Hostname: mail._domainkey
Type: TXT
Value: (Yandex'ten alınan DKIM değeri)
```

### 3. DMARC (Domain-based Message Authentication)
SPF ve DKIM politikalarını zorlar.

**DNS TXT Kaydı:**
```
Hostname: _dmarc
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@semihkilic.com; pct=100; adkim=s; aspf=s
```

### 4. MX Kayıtları (Yandex Mail)
E-posta alımı için gerekli.

**DNS MX Kayıtları:**
```
Hostname: @
Type: MX
Priority: 10
Value: mx.yandex.net.
```

---

## 📍 DNS Sağlayıcısında Nasıl Eklenir

### Cloudflare kullanıyorsanız:
1. DNS → Records bölümüne git
2. "Add record" tıkla
3. Type: TXT seç
4. Name/Hostname gir
5. Content/Value gir
6. Proxy status: DNS only (gri bulut) seçili olmalı
7. Save

### Namecheap / GoDaddy / diğer:
1. Domain yönetim paneline git
2. DNS / Advanced DNS bölümüne git
3. TXT kayıtları ekle

---

## 🧪 Test Etme

### SPF Test:
```bash
dig TXT semihkilic.com | grep spf
```

### DKIM Test:
```bash
dig TXT mail._domainkey.semihkilic.com
```

### DMARC Test:
```bash
dig TXT _dmarc.semihkilic.com
```

### Online Test Araçları:
- https://mxtoolbox.com/spf.aspx
- https://www.mail-tester.com (e-posta gönderip puan al)
- https://dmarcanalyzer.com/dmarc/dmarc-record-check/

---

## ⚠️ Spam Klasörünü Önlemek İçin Ek İpuçları

1. **E-posta içeriğinde:**
   - Spam tetikleyici kelimelerden kaçın (FREE, BUY NOW, CLICK HERE)
   - Metin/HTML oranı dengeli olsun
   - Tek bir büyük resim yerine metin kullanın

2. **Gönderim alışkanlıkları:**
   - Yeni domain'lerde yavaş başlayın (warm-up)
   - Bounce rate'i düşük tutun
   - Unsubscribe linki ekleyin

3. **IP Reputation:**
   - Yandex'in IP'leri iyi reputasyona sahip
   - Kendi SMTP sunucusu kullanıyorsanız IP warming yapın

---

## 🔐 Stripe Fatura/Tax Değişiklikleri (V16)

Stripe checkout oturumlarına eklenen ayarlar:

```python
checkout_session = stripe.checkout.Session.create(
    # ... diğer parametreler ...
    
    # V16: Otomatik faturalama ve vergi uyumu
    invoice_creation={'enabled': True},      # Her ödeme için otomatik fatura
    automatic_tax={'enabled': True},         # Müşteri lokasyonuna göre vergi
    tax_id_collection={'enabled': True},     # KDV/VAT numarası toplama
)
```

### Stripe Dashboard Ayarları:
1. https://dashboard.stripe.com/settings/tax
2. "Automatic tax" → Enable
3. İşletme adresini ekle (şu an Kanada, sonra Finlandiya)
4. Tax registrations ekle (VAT numarası varsa)

### Fatura Görüntüleme:
- Müşteriler faturalarını Stripe Customer Portal'dan indirebilir
- Admin dashboard'a fatura indirme linki eklenebilir

---

## 📧 E-posta Doğrulama URL'si (V16 Fix)

**ESKİ (HATALI):**
```
https://cybersecpro.com/verify-email?token=xxx
```

**YENİ (DOĞRU):**
```
https://cybersecpro.semihkilic.com/dashboard/verify-email?token=xxx
```

Değişiklik: `saas-backend/email_service.py` → `FRONTEND_URL` değişkeni eklendi.

---

## 🛡️ Super Admin Bypass (V16)

Founder e-postaları email verification gerektirmeden giriş yapabilir:

```python
FOUNDER_EMAILS = [
    'semihkilic@semihkilic.com',
    'semih@semihkilic.com', 
    'cybersecpro@semihkilic.com',
    'admin@cybersecpro.com'
]
```

Değişiklik: `saas-backend/app.py` → login endpoint'inde `is_founder` kontrolü eklendi.

---

## 📝 Sonraki Adımlar

1. [ ] DNS kayıtlarını ekle (SPF, DKIM, DMARC)
2. [ ] 24-48 saat bekle (DNS propagation)
3. [ ] mail-tester.com ile test et
4. [ ] Stripe Tax ayarlarını kontrol et
5. [ ] Test email gönder ve doğrulama linkini test et

---

*Güncelleme: V16 - 2026-01-24*
