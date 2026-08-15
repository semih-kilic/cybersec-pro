# Mailjet DNS Setup — cyber-sec-pro.com

> Bu kayıtlar Cloudflare dashboard'undan (cyber-sec-pro.com → DNS → Records)
> eklenecek. Değerler Mailjet hesabına özeldir; aşağıdakiler standardıdır.
> Mailjet → "Sender domains & authentication" bölümünden domain doğrulama
> sürecini başlatınca Mailjet size tam değerleri verir. Aşağıdaki reçete
> doğrulama süreci boyunca gereken kayıtları gösterir.

## Adım 1 — Sender domain ekle (Mailjet paneli)
1. app.mailjet.com → **Account settings** → **Sender domains & authentication**
2. `cyber-sec-pro.com` ekle → "Add and verify" 
3. Mailjet size 3 kayıt verecek:

| Tip | Hostname | Değer |
|---|---|---|
| TXT | cyber-sec-pro.com (veya Mailjet'in verdiği) | Mailjet'in verdiği doğrulama TXT'si (dashboard'dan kopyalanır) |
| CNAME | mj1._domainkey.cyber-sec-pro.com | dkim.mailjet.com |
| CNAME | mj2._domainkey.cyber-sec-pro.com | dkim.mailjet.com |

*(Not: Bazı Mailjet hesaplarında DKIM CNAME hostname'leri farklı olabilir —
  s1._domainkey / s2._domainkey — dashboard'daki tam değeri kullanın.)*

## Adım 2 — SPF'i Mailjet dahil edecek şekilde güncelle
Mevcut: `v=spf1 include:_spf.mx.cloudflare.net ~all`
Yeni:   `v=spf1 include:_spf.mx.cloudflare.net include:spf.mailjet.com ~all`

> ⚠️ SPF güncellemesi TXT kaydını DEĞİŞTİRİR (düzeltir), yeni kayıt EKLEMEZ.
> Cloudflare'da mevcut `TXT _spf` kaydını düzenleyin — iki ayrı SPF TXT kaydı
> geçersiz olur.

## Adım 3 — MX dokunma
Mevcut MX (Cloudflare Email Routing) aynen kalıyor:
- route1.mx.cloudflare.net
- route2.mx.cloudflare.net
- route3.mx.cloudflare.net

## Adım 4 — SMTP_FROM güncelle
Doğrulama tamamlanınca `rust-backend/.env` içinde:
```
SMTP_FROM=semihkilic@cyber-sec-pro.com
```
Fallback Gmail'de FROM ayrı olarak `SMTP_FALLBACK_FROM` — bu Gmail hesabı
üzerinden gönderileceği için `SMTP_FALLBACK_FROM` değerini gmail adresinde
tutmak gerekir (Gmail, başka domain'den FROM kabul etmez).

## Adım 5 — Doğrulama (DNS yayıldıktan sonra)
```bash
dig +short TXT cyber-sec-pro.com | grep mailjet
dig +short CNAME mj1._domainkey.cyber-sec-pro.com
```
Sonra Mailjet panelinde "Check again" → status "Verified" olunca:
backend rebuild + restart → `docker compose up -d --no-deps rust-backend`

---

## Alternatif: E-posta yönlendirme yoksa MX'i Mailjet'e taşıma
Mailjet, gönderim için MX gerektirmez (yalnızca alıcı taraf). MX'i olduğu gibi
bırakın — Cloudflare Email Routing ile gelen mailler zaten yönlendiriliyor.
