# Compliance Matrix — CyberSec Pro

> Cross-framework mapping of implemented controls
> Last updated: 2026-08-15

Maps each privacy/security regulation requirement to the platform's implemented
control, with the verification status of each.

| Regulation | Requirement | Implemented Control | Verified |
|---|---|---|---|
| **PIPEDA P1** | Accountability | RBAC + audit logs + controller ID | ✔ |
| **PIPEDA P2** | Identifying purposes | Privacy Policy §3 | ✔ |
| **PIPEDA P3** | Consent | `consent_records` + mandatory register consent | ✔ E2E |
| **PIPEDA P4** | Limiting collection | Zero-knowledge credentials | ✔ |
| **PIPEDA P5** | Use/retention limits | Retention engine | ✔ |
| **PIPEDA P6** | Accuracy | Settings rectification | ✔ |
| **PIPEDA P7** | Safeguards | TLS 1.3, AES-256, scrypt, token rotation, api_key hash | ✔ |
| **PIPEDA P8** | Openness | Public Privacy Policy/Terms/Trust Center | ✔ |
| **PIPEDA P9** | Individual access | GDPR export + consent GET | ✔ E2E |
| **PIPEDA P10** | Challenge compliance | DPO contact + OPC path | ✔ |
| **CCPA 1798.100** | Notice at collection | Registration consent text | ✔ |
| **CCPA 1798.110** | Right to know | GDPR export + Privacy Policy §5b | ✔ |
| **CCPA 1798.105** | Right to delete | `gdpr/delete-account` + `consent/withdraw` | ✔ |
| **CCPA 1798.120** | Opt-out of sale | No sale; opt-out path documented | ✔ |
| **CCPA 1798.125** | Non-discrimination | Code review: no discrimination logic | ✔ |
| **CPRA 1798.106** | Right to correct | Settings + policy | ✔ |
| **CPRA 1798.121** | Sensitive PI limits | No sensitive categories collected | ✔ |
| **GDPR Art. 7** | Consent conditions | Consent versioning + withdrawal | ✔ |
| **GDPR Art. 15** | Access | `gdpr/export` full data | ✔ E2E |
| **GDPR Art. 17** | Erasure | Anonymize + revoke sessions | ✔ |
| **GDPR Art. 20** | Portability | JSON export | ✔ |
| **CASL** | Consent for CEM | Unsubscribe endpoint + `marketing_opt_out` | ✔ E2E |
| **CASL** | Identity + unsubscribe | Email footer (identity block + link) | ✔ |
| **SOC 2 CC6.1** | Logical access | JWT rotation, RBAC, api_key hashing | ✔ |
| **SOC 2 CC6.5** | Retention limits | Retention engine | ✔ |
| **SOC 2 A1.3** | Backup/recovery | Encrypted daily backups + restore test | ✔ |

---

## Framework Control Inventory (seeded in DB)

| Framework | Controls Seeded | Notes |
|---|---|---|
| PIPEDA | 10 | Schedule 1 principles |
| CCPA | 5 | Consumer rights + notice |
| CPRA | 5 | Correction, sensitive data, opt-out |
| GDPR | 5 | Controller obligations |
| SOC 2 | 5 | TSC categories |
| ISO 27001 | 10 | Annex A |
| NIST 800-53 | 7 | Security controls |
| NIST CSF | 4 | Functions |
| OWASP | 7 | Application security |
| PCI DSS | 5 | Cardholder data |
| HIPAA | 5 | Healthcare |
| CIS v8.1 | 5 | Critical security controls |
| CCCS | 3 | Canadian Centre for Cyber Security |

Controls are queryable via `GET /api/v1/compliance/frameworks` and
`GET /api/v1/compliance/frameworks/:id` (authenticated).

---

## Audit & Evidence Trail
- `audit_logs` — every login, register, consent, withdraw, delete action
- `consent_records` — consent lifecycle with version + timestamp
- `login_history` — auth events (success/failure, IP)
- Backup encryption + restore verification log
