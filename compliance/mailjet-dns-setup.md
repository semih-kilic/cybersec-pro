# Mailjet DNS Setup — cyber-sec-pro.com

> Status: ✅ **TAMAMLANDI — doğrulandı** (2026-08-15)
> Mailjet: `DKIMStatus: OK`, `SPFStatus: OK`. E-posta `semihkilic@cyber-sec-pro.com`
> adresinden DKIM imzalı gönderiliyor.

---

## Gerçekleşen kayıtlar (Cloudflare)

| # | Tür | Name | Value | Durum |
|---|---|---|---|---|
| 1 | TXT | `mailjet._0c9cd178` | `0c9cd178f86108b39eef957b3a0c67ee` | ✅ eklenmiş |
| 2 | TXT | `mailjet._domainkey` | `k=rsa; p=MIIBIj...IDAQAB` (DKIM, 255-char Cloudflare otomatik böler) | ✅ eklenmiş |
| 3 | TXT | `@` (SPF) | `v=spf1 include:_spf.mx.cloudflare.net include:spf.mailjet.com ~all` | ✅ güncellenmiş |
| 4 | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:76790b60de854e34ac07bbca9b17041b@dmarc-reports.cloudflare.net` | ✅ mevcuttu, dokunulmadı |
| 5 | MX | `@` | route1-3.mx.cloudflare.net | ✅ mevcuttu, dokunulmadı |

## Mailjet tarafı (API ile yapıldı)

- Sender eklendi: `semihkilic@cyber-sec-pro.com` (DNSID `4759408907`)
- DNS check tetiklendi: **DKIM OK + SPF OK**, `DKIMErrors: []`, `SPFErrors: []`

## Backend

```env
# rust-backend/.env
SMTP_SERVER=in-v3.mailjet.com        # primary (Mailjet)
SMTP_PORT=587
SMTP_EMAIL=<mailjet-api-key>
SMTP_PASSWORD=<mailjet-secret>
SMTP_FROM=semihkilic@cyber-sec-pro.com   # güncellendi

# SMTP fallback (Gmail) — Mailjet kesilirse otomatik devreye girer
SMTP_FALLBACK_SERVER=smtp.gmail.com
SMTP_FALLBACK_PORT=465
SMTP_FALLBACK_EMAIL=<gmail-hesabı>
SMTP_FALLBACK_PASSWORD=<gmail-app-password>
SMTP_FALLBACK_FROM=cyber.sec.pro.email.send@gmail.com  # Gmail başka domain'den FROM kabul etmez
SMTP_FALLBACK_FROM_NAME=CyberSec Pro
```

`SMTP_FROM` değişikliği `docker compose up -d --no-deps rust-backend` ile uygulandı.

## Doğrulama komutları

```bash
# DNS kayıtları
dig +short TXT mailjet._0c9cd178.cyber-sec-pro.com
dig +short TXT mailjet._domainkey.cyber-sec-pro.com
dig +short TXT cyber-sec-pro.com | grep spf

# Gönderim testi (log'da görünür)
docker logs cybersec-api 2>&1 | grep "Email sent via"
```

## Notlar / gelecekte yapılacaklar

- `SMTP_FROM_NAME` env'den geliyor, değişiklik gerekmiyor.
- Sender `Status: Inactive` — ilk gerçek gönderim Mailjet tarafında otomatik
  active olur; panelden kontrol edilebilir.
- Alternatif MX taşıma gerekmedi (gönderim için MX gerekmez, yalnızca alıcı taraf).
