# Vendor DPA Register — CyberSec Pro

> SOC 2 CC9.1 gap closure: third-party risk management
> Status: Register v1 — DPA request tracking
> Last updated: 2026-08-15

---

## 1. Sub-Processors & Personal Data

| Vendor | Service | Data Processed | Location | DPA Status |
|---|---|---|---|---|
| **Hetzner** | Infrastructure hosting | All hosted data (DB, Redis, app, backups) | EU (Hetzner Finland) | ⬜ Requested |
| **Cloudflare** | CDN, DNS, Tunnel, Email Routing, DDoS | IP addresses, email routing, edge traffic | Global | ⬜ Requested |
| **Stripe** | Payment processing | Cardholder data (PCI DSS), billing info | EU (Ireland) | ✅ Standard DPA (Stripe.com/legal/dpa) |
| **Mailjet** | Transactional email (SMTP) | Recipient emails, sender identity | EU | ⬜ Requested |
| **Google (Gmail)** | SMTP fallback | Recipient emails | Global | ⬜ Requested |
| **GitHub** | Code repository (source only) | Source code (no personal data) | Global | ⬜ Not required (no PI) |

## 2. Required DPA Elements (per PIPEDA s.4.1.4 / GDPR Art.28)
Each DPA must cover:
1. Purpose limitation — processor only acts on documented instructions
2. Security controls — technical/organizational measures commensurate to risk
3. Sub-processing authorization — prior consent for onward transfers
4. Breach notification — processor reports to CyberSec Pro without undue delay
5. Data subject rights assistance
6. Deletion/return on contract end
7. Audit rights

## 3. Request Process (how to obtain)
| Vendor | Portal / Method | Timeframe |
|---|---|---|
| **Hetzner** | Hetzner cloud console → account → Data Processing Agreement (DPSA); auto-accepted in console | Instant (digital) |
| **Cloudflare** | Cloudflare dashboard → "DPA" via account settings; enterprise or click-through | Instant (digital) |
| **Stripe** | Standard DPA in Stripe dashboard (Settings → Legal) | Instant |
| **Mailjet** | Mailjet support ticket → request signed DPA | 1–5 business days |
| **Gmail/Google** | Google Workspace terms include DPA; Gmail SMTP under Google's DPA | Refer to Google DPA (online) |

## 4. Tracking
- ⬜ = requested but not yet filed in `compliance/dpas/`
- ✅ = signed/counter-signed copy filed
- Each DPA file: `compliance/dpas/<vendor>-dpa.pdf` + summary page

## 5. Annual Review
- Re-confirm DPA validity + processor list against actual sub-processors
- Add any new processor before onboarding (change management step)
- Update this register + Trust Center sub-processor list

## 6. Current Trust Center Disclosure
Trust Center lists: Hetzner (EU), Cloudflare, Stripe (EU), Mailjet (EU).
Matches this register — keep in sync.
