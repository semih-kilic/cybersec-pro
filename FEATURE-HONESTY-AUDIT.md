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
| **SAML 2.0 SSO** | Advertised everywhere but endpoints returned `503` (the old hand-rolled code validated no signature/audience/expiry, so forged responses were accepted → disabled) | **Fully implemented & secure.** Real SP-initiated SAML 2.0 via the vetted `samael` crate (xmlsec XML-DSIG verification): signature verified against the org's IdP cert (SHA-1 rejected), plus Destination/Issuer/Status/InResponseTo/expiry + assertion Conditions (audience, NotBefore/NotOnOrAfter) + Bearer SubjectConfirmation. SP-initiated only, one-time RelayState + AuthnRequest-ID in Redis (replay-safe). Endpoints: `GET /auth/sso/saml/init`, `POST /auth/sso/saml/callback`, `GET /auth/sso/saml/metadata`. SSO tab re-enables the SAML card; marketing re-lists "SAML 2.0". Unit test proves forged/unsigned responses are rejected; verified deployed (metadata + init AuthnRequest live). |

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
  coming soon and point users to Scans / Workflows. *Cleanup DONE:* the
  `ExecutionView` sub-component (with `MOCK_OUTPUT_LINES` + `Math.random`
  step-success), the `view`/`setView` state machine, and the now-unused `useRef`
  import were **deleted** (−171 lines); the mock string is gone from the built
  bundle. saas-frontend rebuilt (exit 0) and live via the `dist/static-v2` mount.

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
  and `/ai/suggest-tools` (the working endpoints). **Backend cleanup DONE:** the
  legacy routes `/ai/suggest` and `/ai/report-summary` now **delegate** to the
  real handlers (`suggest_tools` / `interpret_results`) instead of returning
  "not yet available"; the two stub handler functions were deleted. Backend
  rebuilt + recreated; live-tested both legacy paths return real data (tool
  suggestions and severity-count summaries), zero "not yet available" responses.

---

## D. Compliance / audit claims — **DONE (softened to honest wording)** ✅

The **Trust Center** (`/trust-center`, all locales) stated specific certifications
and named third-party audits that are not held. Per the owner's decision
("soften/remove unverified ones"), every unverifiable claim was reworded to the
truth — no named certification is claimed as *held* any more. Changes (commit on
`hardening/audit-2026-08`):

| Was (false / unverifiable) | Now (honest) |
|---|---|
| SOC 2 Type II — "Annual audit — Ernst & Young" | "SOC 2 controls implemented (Type II audit planned)" |
| ISO 27001:2022 — "Certified — BSI Group" | "Designed to ISO 27001:2022 (certification in progress)" |
| PCI DSS v4.0 — "Level 1 Service Provider" | "PCI DSS v4.0-aligned controls" |
| HIPAA — "BAA available — PHI encryption" | "HIPAA-aligned controls — PHI encryption" |
| "CSA STAR Level 2" — "Cloud Security Alliance Certification" | "CSA STAR" — "Cloud Security Alliance — framework aligned" |
| trustFeatures "SOC 2 Type II Controls" | "SOC 2-Aligned Controls" |
| Homepage hero stat "SOC 2 / Type II Certified" (en only; drift) | realigned to the free-trial stat used by the other 9 locales |
| Pentest history — 4 dated engagements by "Cobalt.io — CREST Certified", "NCC Group", "Bishop Fox", "Mandiant" with downloadable NDA reports | reframed to **internal, continuous** testing by "CyberSec Pro Security Team (internal)", no external-firm names, `reportAvailable: false` (no fake report downloads); section text now says independent third-party pentesting is **planned** |

Additional honesty upgrades made at the same time:
- The compliance grid previously **hard-coded a green "✓ Compliant" badge on every
  framework** (the `compliant` flag only fed the counter, never the badge). It now
  renders per-framework: green "Compliant" only for the 4 legal *alignments*
  (GDPR, NIST CSF 2.0, KVKK, CCPA/CPRA — no external cert body), and an amber
  **"Pending"** badge for the 6 certifications/audits not yet held (SOC 2, ISO
  27001, ISO 27701, PCI DSS, HIPAA, CSA STAR). Counter now honestly reads "4/10".
- The hero cert-badge row (emoji pills) gained a caption: "Frameworks we align
  with or are actively pursuing — see current certification status below."

Left as-is (verified legitimate, not our self-certification):
- **PrivacyPage** "Stripe: PCI DSS Level 1 certified" — true, and about Stripe.
- **DocsPage** "Additional Frameworks" (SOC 2 / HIPAA / GDPR "evidence collection")
  — describes the **compliance-report generator feature** (real:
  `report_handlers::build_compliance_section`), not a self-certification.
- **Sub-processors DPA** table — real vendors (Stripe, AWS, Cloudflare, Vercel,
  Supabase, Twilio, Sentry) that genuinely publish DPAs; standard and accurate.
- KVKK / GDPR / CCPA — legal *alignments*, self-attested, kept as "Compliant".

Marketing frontend rebuilt (`next build`, exit 0, 0 MISSING_MESSAGE, 1143 pages)
and live via the nginx `out/` bind mount; verified the new wording is present in
`out/` for all locales and every old fabricated string is gone.

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
