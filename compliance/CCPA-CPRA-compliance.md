# CCPA / CPRA Compliance — CyberSec Pro

> California Consumer Privacy Act (2020) as amended by the
> California Privacy Rights Act (2023)
> Status: Consumer rights implemented + documented
> Last updated: 2026-08-15

---

## Business Profile
- **Business:** CyberSec Pro (Semih Kılıç)
- **Service:** Cloud-hosted security scanning platform (SaaS)
- **Data subject categories:** California consumers who register for the platform
- **Do we sell personal information?** **No.**
- **Do we share for cross-context behavioral advertising?** **No.**
- **Sensitive PI processed:** Only what users submit as scan targets/configs;
  no sensitive categories (SSN, health, etc.) collected

## Right-to-Know Mapping (CCPA s.1798.110 / CPRA s.1798.106)
| Request | Endpoint / Mechanism |
|---|---|
| Categories of PI collected | Privacy Policy §5b (Notice of Collection) |
| Specific PI held about consumer | `GET /api/v1/gdpr/export` |
| Categories of sources | Privacy Policy §3 |
| Business purpose of collection | Privacy Policy §4 |
| Categories of third parties | Trust Center sub-processors |
| Access response time | Within 45 days (extendable +45 with notice) |

## Right-to-Delete (CCPA s.1798.105)
| Mechanism | Endpoint |
|---|---|
| Account deletion request | `POST /api/v1/gdpr/delete-account` (immediate anonymization) |
| Consent record withdrawal | `POST /api/v1/consent/withdraw` |
| Retention limits (auto-delete) | Retention engine (scans 90d, logs 12mo, jobs 180d) |

## Right-to-Correct (CPRA s.1798.106)
- Profile rectification in Settings
- PIPEDA/CCPA documentation in Privacy Policy §5a/5b

## Right-to-Opt-Out of Sale/Sharing (CCPA s.1798.120)
- **Current status:** No sale or sharing of personal information
- **If future sale begins:** `Do Not Sell` link will be added (per CCPA link
  requirements), honoring opt-out requests
- **Notice:** Privacy Policy §5b and GDPR page include "CCPA Opt-Out" contact path
- **Authorized agents:** Verifiable requests accepted from authorized agents

## Right-to-Limit Use of Sensitive PI (CPRA s.1798.121)
- Sensitive PI not collected beyond service purpose
- No profiling that would trigger the "limit" requirement

## Right-to-Non-Discrimination (CCPA s.1798.125)
- Equal service quality and pricing regardless of rights exercised
- Verified in code review: no discrimination logic exists

---

## Operational Controls

### Verifiable Consumer Requests
1. Consumer (or authorized agent) emails support@cyber-sec-pro.com or uses
   in-app Data Rights page
2. Identity verified via authenticated session (for in-app) or account email
   confirmation (for email)
3. Response within 45 days

### Recordkeeping
- Every consent event logged in `consent_records` (timestamp, purpose, version,
  IP, user-agent)
- Every withdraw/delete event logged in `audit_logs`
- Exportable via GDPR export endpoint for compliance evidence

### Notices
- Notice-at-collection: registration page states consent terms before submission
- Privacy Policy §5b contains the "Notice of Collection" with all five categories:
  identifiers, commercial info, internet activity, geolocation, inferences (none)

---

## Sub-Processors (CCPA disclosure)
| Vendor | Purpose | Location |
|---|---|---|
| Hetzner | Infrastructure hosting | EU |
| Stripe | Payment processing | Ireland (EU) |
| Cloudflare | CDN & DDoS protection | Global |
| Mailjet | Transactional email | EU |
