# PIPEDA Compliance — CyberSec Pro

> Personal Information Protection and Electronic Documents Act
> Status: Implemented controls mapped to PIPEDA's 10 fair information principles
> Last updated: 2026-08-15

PIPEDA (and its provincial equivalents) governs how Canadian private-sector
organizations collect, use, and disclose personal information. The 10 fair
information principles (Schedule 1 of PIPEDA) are implemented as follows.

---

## Principle 1 — Accountability
**Requirement:** Organization is responsible for personal information under its
control; designates a person accountable.

**Implementation:**
- Data controller identity published in Privacy Policy §2 (CyberSec Pro / Semih Kılıç)
- Accountability enforced via role-based access control in `auth_middleware.rs`
- Audit trail of all admin/user actions in `audit_logs`

## Principle 2 — Identifying Purposes
**Requirement:** Purposes identified at or before collection.

**Implementation:**
- Privacy Policy §3 lists exact data categories collected
- Register form states purposes before consent is requested
- Purpose recorded per consent in `consent_records.purpose`

## Principle 3 — Consent
**Requirement:** Knowledge and consent required for collection, use, disclosure.

**Implementation:**
- **Mandatory** consent checkbox on registration → `CONSENT_REQUIRED` error if absent
- `consent_records` table stores: user_id, purpose, category, status, version, ip, user_agent, recorded_at
- Consent version pinned (`version = '2026-01-01'`) for future policy-change audit
- **Withdrawal:** `POST /api/v1/consent/withdraw` — immediate effect, `withdrawn_at` stamped
- GDPR page exposes consent list + one-click withdraw UI

**E2E verified:** register without consent → 400; withdraw → status `withdrawn`.

## Principle 4 — Limiting Collection
**Requirement:** Collection limited to what is necessary.

**Implementation:**
- Only email, name, org name, credentials required for service
- Zero-knowledge credential handling: SSH keys/passwords/API keys forwarded
  in-memory and discarded at job end (never persisted, never backed up)
- `login_history` retains IP for 12 months then purged (retention engine)

## Principle 5 — Limiting Use, Disclosure, Retention
**Requirement:** Data not used/disclosed beyond identified purposes; retained
only as long as necessary.

**Implementation (retention engine in `scheduler.rs`):**
| Data | Retention |
|---|---|
| Audit logs | 12 months |
| Scan results | 90 days |
| Login history | 12 months |
| Agent jobs | 180 days |
| Password reset tokens | immediate cleanup |

- No data sale or sharing; sub-processors limited to Hetzner, Stripe, Cloudflare, Mailjet

## Principle 6 — Accuracy
**Requirement:** Data accurate, complete, up-to-date.

**Implementation:**
- Users can correct profile data in Settings
- GDPR right to rectification documented; PIPEDA accuracy covered in Privacy Policy §5a

## Principle 7 — Safeguards
**Requirement:** Security safeguards appropriate to sensitivity.

**Implementation:**
- **In transit:** TLS 1.3 everywhere
- **At rest:** AES-256 encrypted backups (per-tenant key)
- **Authentication:** scrypt password hashes, JWT access (1h) + refresh (30d) rotation,
  MFA support, email verification
- **Agent secrets:** API keys stored as SHA-256 hashes only (`api_key_hash`)
- **Rate limiting** on login + newsletter endpoints

## Principle 8 — Openness
**Requirement:** Policies and practices readily available.

**Implementation:**
- Privacy Policy (with PIPEDA section), Terms, Trust Center, GDPR page all public
- `/.well-known/security.txt` for responsible disclosure

## Principle 9 — Individual Access
**Requirement:** Individuals can access and amend their information.

**Implementation:**
- `GET /api/v1/gdpr/export` — full data export (profile, scans, audit logs,
  consent records, login history, preferences, API keys, integrations)
- `GET /api/v1/consent` — consent records
- Settings → profile edit for rectification

## Principle 10 — Challenging Compliance
**Requirement:** Individuals can challenge compliance.

**Implementation:**
- Contact DPO: support@cyber-sec-pro.com (30-day response commitment)
- Escalation path to Office of the Privacy Commissioner of Canada documented
  in Privacy Policy §5a

---

## Cross-Border Considerations (s.4.1.4)
- Data processed in the EU (Hetzner). Canadian customers' data transfers
  outside Canada are protected by contractual clauses requiring equivalent
  safeguards. Documented in Privacy Policy §7.
- CyberSec Pro remains accountable for personal information while processed by
  service providers.

## Breach Notification Readiness
- PIPEDA breach notification (s.10.1): report to OPC + affected individuals for
  real risk of significant harm
- Operational readiness: audit_logs capture user actions; `notify_security_alert`
  email template exists for urgent notifications
