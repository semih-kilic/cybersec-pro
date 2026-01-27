# 🔐 OAuth Kurulum Rehberi - CyberSec Pro

## ✅ Tamamlanan Adımlar

1. **Login/Register Sistemi** - Çalışıyor ✓
2. **Email (Yandex SMTP)** - Çalışıyor ✓
3. **Docker Kurulumu** - Hazır ✓
4. **OAuth Backend Routes** - Hazır ✓
5. **OAuth Frontend** - Hazır ✓
6. **Database Migration** - Tamamlandı ✓

---

## 🔧 OAuth Aktivasyonu için Yapılması Gerekenler

### Google OAuth Kurulumu

1. **Google Cloud Console'a git:** https://console.cloud.google.com/
2. **Yeni proje oluştur** veya mevcut projeyi seç
3. **APIs & Services > Credentials** menüsüne git
4. **"CREATE CREDENTIALS" > "OAuth client ID"** tıkla
5. **Application type:** Web application
6. **Authorized JavaScript origins:** 
   - `https://semihkilic.com`
   - `http://localhost` (test için)
7. **Authorized redirect URIs:**
   - `https://semihkilic.com/login`
8. **Client ID ve Client Secret'ı kopyala**

### GitHub OAuth Kurulumu

1. **GitHub Developer Settings'e git:** https://github.com/settings/developers
2. **"New OAuth App"** tıkla
3. **Application name:** CyberSec Pro
4. **Homepage URL:** `https://semihkilic.com`
5. **Authorization callback URL:** `https://semihkilic.com/auth/github/callback`
6. **"Register application"** tıkla
7. **Client ID ve Client Secret'ı kopyala**

---

## 📝 .env Dosyasını Güncelle

`.env` dosyasını açarak OAuth bilgilerini ekle:

```bash
# /home/cybersec/cybersec-pro/saas-backend/.env

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth  
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

---

## 🚀 Servisi Yeniden Başlat

OAuth bilgilerini ekledikten sonra servisi yeniden başlat:

```bash
sudo systemctl restart cybersec-saas
```

---

## ✅ Test Et

1. https://semihkilic.com/login adresine git
2. "Continue with Google" veya "Continue with GitHub" butonlarını test et
3. Başarılı girişte dashboard'a yönlendirileceksin

---

## 📊 Mevcut Sistem Durumu

| Bileşen | Durum |
|---------|-------|
| cybersec-saas (Port 5001) | ✅ Aktif |
| cybersec-sales (Port 5002) | ✅ Aktif |
| Nginx | ✅ Aktif |
| Docker | ✅ Kurulu (v27.5.1) |
| Kali Tools (165+) | ✅ Yüklü |
| Email (Yandex SMTP) | ✅ Çalışıyor |
| OAuth Backend | ✅ Hazır |
| OAuth Frontend | ✅ Hazır |
| Database | ✅ Güncellendi |

---

## 🐉 Dragon Theme Welcome Email

Yeni kullanıcılar için profesyonel dragon temalı hoşgeldin maili aktif:
- Kali Linux Dragon logosu
- Profesyonel HTML tasarımı
- CTA butonları

---

## 📞 Sonraki Adımlar

1. Google ve GitHub OAuth bilgilerini al
2. `.env` dosyasını güncelle
3. Servisi yeniden başlat
4. Test et

OAuth aktif olunca login sayfasında butonlar otomatik çalışacak!
