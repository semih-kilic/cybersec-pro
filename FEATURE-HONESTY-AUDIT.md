# Feature Honesty Audit — advertised vs. actually working

Date: 2026-09-06 · Branch: `hardening/audit-2026-08`

Goal: every feature we show or advertise must actually work. This lists everything
found that is **shown/promised but not (fully) real**, with a recommended action:
**REMOVE** the claim, mark **SOON** (disabled "coming soon"), **FIX** (wire to the
real implementation), or **CONFIRM** (business fact only the owner can verify).

---

## A. Fixed in this session ✅

| Item | Was | Now |
|---|---|---|
| **SAML 2.0 SSO** | Advertised everywhere + default in the SSO settings tab, but endpoints return `503` (disabled for security) | Marketing → "SSO / OIDC / LDAP"; SSO tab defaults to OIDC, SAML shown as disabled **"Coming soon"** card. OIDC + LDAP are real & secure. (commit `c79116a`) |

---

## B. Confirmed non-functional / simulated — ACTION NEEDED

### B1. Pipeline Builder (`/dashboard/pipeline-builder`) — **not real**
- **What the user sees:** a prominent sidebar feature to build multi-step scan
  pipelines, "Save", and "Run" with live step progress.
- **Reality:** there is **no backend**. `POST /api/v1/pipelines` is not routed and
  no pipeline handler exists.
  - **Save** falls into `catch { // Backend not available, mock save }` and then
    shows a success toast — nothing is persisted.
  - **Run** is a pure client-side animation: `setTimeout` + `Math.random() > 0.1`
    decides fake success/failure and prints "Step completed successfully."
- **Recommended action:** **SOON** — add a "Soon" badge in the nav + a "Preview:
  saving and execution are not available yet" banner, and disable the fake
  Save/Run; **or REMOVE** it from the sidebar until a real pipeline engine exists.
  (Real multi-step automation already exists as **Workflows** and **Scan
  Templates**, which do have backends.)
- **DONE (this session):** nav shows a **"Soon"** badge; page shows a **Preview**
  banner; Save and Run no longer fake success — they say execution/saving is
  coming soon and point users to Scans / Workflows. *Remaining cleanup:* the
  `ExecutionView` sub-component (with `MOCK_OUTPUT_LINES` + `Math.random`
  step-success) is now **unreachable** (nothing sets the "execute" view anymore)
  but still sits in the bundle as dead code — delete it in a follow-up.

---

## C. Stub API endpoints still advertised — ACTION NEEDED (small)

The public **API Reference** page lists two AI endpoints that are stubs returning
`"... not yet available"`, even though working equivalents exist and the dashboard
uses those:

| Advertised (stub) | Returns | Real equivalent (works) |
|---|---|---|
| `POST /api/v1/ai/suggest` | `{"suggestions": [], "message": "AI suggestions not yet available"}` | `POST /api/v1/ai/suggest-tools` |
| `POST /api/v1/ai/report-summary` | `{"summary": "AI report summary not yet available"}` | `POST /api/v1/ai/interpret-results` |

- **Recommended action:** **FIX** — point the API Reference at the working
  endpoints (`/ai/suggest-tools`, `/ai/interpret-results`) and either delete the
  two stub routes or make them delegate to the real handlers, so an API customer
  never hits a "not yet available" response.
- **DONE (this session):** API Reference now documents `/ai/interpret-results`
  and `/ai/suggest-tools` (the working endpoints). *Remaining low-priority backend
  cleanup:* delete or delegate the now-unadvertised stub routes `/ai/suggest`
  and `/ai/report-summary` (needs a backend rebuild).

---

## D. Compliance / audit claims — **CONFIRM (owner only)** ⚠️ highest risk

The **Trust Center** (`/trust-center`, all locales) states specific
certifications and third-party audits. These cannot be verified from code and are
**legally serious if not literally true.** Please confirm each is real (with a
certificate/report on file) or I will soften/remove it:

- "SOC 2 Type II — **Annual audit — Ernst & Young**"
- "ISO 27001:2022 — **Certified — BSI Group**"
- "ISO 27701 — Privacy Information Management"
- "PCI DSS v4.0 — **Level 1 Service Provider**"
- "HIPAA — BAA available"
- "CSA STAR Level 2"
- **Penetration-test history** — 4 dated engagements "conducted by independent
  third-party security firms", all "Remediated"
- **Sub-processors** table — "All sub-processors have signed a DPA"
- "SOC 2 Type II Controls" / "Isolated Infrastructure — Dedicated instances for
  Enterprise" (SecurityPage)

If any of these is aspirational, the honest options are: mark it "In progress /
targeted" or remove it. (KVKK, GDPR, CCPA are legal *alignments*, lower risk than
a named-auditor *certification* claim.)

---

## E. Already honest — no action ✅
- macOS agent install: "**coming soon**, use Docker"
- CyberSec AI "**Auto-Fix (Beta)**"
- Tool maturity labels: verified / beta / experimental
- Scan execution: "Not available for remote execution" messaging
- Security Hall of Fame: shows an honest empty state

---

## F. Verified real (spot-checked this session) ✅
OIDC + LDAP SSO · AI Assistant (suggest-tools, generate-command, playbook, explain,
interpret-results, validate, generate-patch, cvss) · CyberSec AI autonomous jobs
(worker + jobs API) · Workflows · Scan scheduling · Reports (HTML + PDF via
wkhtmltopdf) · Compliance report frameworks · Slack/Teams/Webhook/Jira/GitHub/
ServiceNow notifications · Billing/Stripe (checkout, webhook, invoices,
subscription) · Community (posts/likes/stats) · Purple Team (intentional,
documented blue-team simulation) · 88 curated tools.
