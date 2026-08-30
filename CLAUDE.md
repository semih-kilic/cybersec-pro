# CyberSec Pro - CLAUDE.md

This document is the operational map for working safely and quickly in this repository.

## 1) Project Snapshot

CyberSec Pro is a multi-service cybersecurity platform with:
- Rust backend APIs (main platform + scan engine + service manager)
- SaaS dashboard frontend (React + Vite)
- Marketing frontend (Next.js)
- Docker-based infra (Postgres, Redis, Nginx, Kali tools, terminal, WireGuard)

Primary goals:
- secure scan execution (local and remote)
- organization- and plan-aware SaaS workflows
- strong auth + auditability
- multilingual UI (i18n parity completed)

## 2) Verified Repository Layout

- `rust-backend/` - main API (Axum, port 5001)
- `rust-scan-engine/` - standalone scan engine (port 5002, not wired in compose)
- `rust-agent/` - reverse-tunnel agent (there is no `rust-service-manager/` directory; the watchdog lives in `rust-backend/src/services/service_manager.rs`)
- `saas-frontend/` - React/Vite SaaS app
- `frontend/` - Next.js marketing site
- `nginx/` - reverse-proxy config and TLS mount paths
- `scripts/` - DB init and utility scripts
- `cybersec-monitor/`, `cybersec-sales/`, `cloudflare/` - ops/sales/support assets
- `docker-compose.yml` - production-like local stack orchestration

## 3) Stack and Version Source of Truth

Use package manifests as canonical source:
- `rust-backend/Cargo.toml`
- `rust-scan-engine/Cargo.toml`
- `saas-frontend/package.json`
- `frontend/package.json`

Current notable versions (verified from manifests):
- Rust backend: `axum 0.7`, `sqlx 0.8`
- Rust scan engine: `axum 0.7`, `sqlx 0.7` (intentional mismatch to track)
- SaaS frontend: `react 18.2`, `vite 5`, `@tanstack/react-query 5`
- Marketing frontend: `next 16.1.7`, `react 19.2.3`

## 4) Development Commands

### Full stack (Docker)
```bash
cp .env.example .env
docker-compose up -d
docker-compose ps
docker-compose logs -f rust-backend
docker-compose down
```

### Rust services
```bash
cd rust-backend && cargo run --bin cybersec-pro-backend
cd rust-scan-engine && cargo run
cd rust-service-manager && cargo run
```

### Frontends
```bash
cd saas-frontend && npm install && npm run dev
cd frontend && npm install && npm run dev   # npm, not pnpm: CI uses `npm ci` and
                                            # the stale pnpm-lock.yaml was removed 2026-08-29
```

### CI quality commands (local parity with pipeline)
```bash
cd saas-frontend
npm run i18n:check
npm run i18n:residual
npm run type-check
npm run test:purple-flow
npm run build
```

## 5) i18n Workflow (SaaS Frontend)

Locale path:
- `saas-frontend/src/i18n/locales/{en,de,es,fr,it}.json`

Standard translation loop:
1. Locate scope in `en.json`.
2. Read same scope in all locale files.
3. Translate non-technical UI strings in `de/es/fr/it`.
4. Keep technical placeholders and IDs unchanged when needed.
5. Validate with script:
```bash
cd saas-frontend
npm run i18n:check
npm run i18n:residual
```
6. If needed, run targeted Node comparison scripts for same-as-English keys.

Current tracked status:
- Completed: 49 / 49 scopes
- Remaining: 0 keys
- Result: parity achieved across `de/es/fr/it` against `en`

CI artifacts for observability:
- Frontend artifact `i18n-reports`
  - `saas-frontend/i18n-coverage-report.json`
  - `saas-frontend/i18n-residual-report.json`
- Backend artifact `backend-reports`
  - `rust-backend/ci-reports/cargo-check.log`
  - `rust-backend/ci-reports/cargo-clippy.log`
  - `rust-backend/ci-reports/cargo-clippy-exit.txt`

## 6) Safety Rules (Must Follow)

1. Never commit secrets (`.env`, keys, tokens).
2. Treat `nginx/nginx.conf` as high-risk; validate before any reload.
3. Prefer additive DB schema changes in `rust-backend/src/services/db.rs`.
4. Keep auth token handling in header/cookie only.
5. Use rate limiting patterns for public/auth endpoints.
6. Keep scan execution paths secure; avoid shell-injection risk in command building.

## 7) Known Risk Areas

- `rust-backend/src/handlers/stub_handlers.rs` mixes maturity. Purple Team uses DB-backed persistence with **deterministic TTP simulation**: per-chain detection ratios are read from `purple_team_profiles.profile_json` (organization-scoped) with env-var fallback (`PURPLE_TEAM_RATIO_*`), and step results are derived from `purple_team_step_catalog`. This is intentional simulation for blue-team training, not production telemetry; correlation with real scan findings is on the roadmap (link `purple_team_exercises.target` to recent `scans.target` rows of the same org and surface a `linked_scan_ids` array in the payload).
- Billing/Stripe flow remains partially stubbed.
- `rust-scan-engine` is integrated in `docker-compose.yml` (service: `rust-scan-engine`, port 5002, `SCAN_ENGINE_URL` wired in backend). ✅ Resolved.
- SQLx version mismatch resolved: both `rust-backend` and `rust-scan-engine` now use `sqlx 0.8`. ✅ Resolved.

## 8) Best-First Priorities

1. ✅ Expand Purple Team from persistence-only flow to execution telemetry + real detection pipeline updates.
   - Gap analysis thresholds, detection coverage alerts, 15 backend unit tests, frontend alert banners.
2. ✅ Add/expand automated checks (lint, type-check, backend smoke tests).
   - CI runs purple_team, report_handlers, scan engine unit tests; i18n parity checks; frontend vitest.
3. ✅ Keep i18n parity stable with CI checks for locale drift.
   - 49/49 scopes complete; drift detection in pipeline.
4. ⚠️ Align scan engine integration strategy with compose and routing.
   - The engine is wired in compose and the backend delegates to it over `SCAN_ENGINE_URL`.
   - There is **no** `/api/v3/` block in `nginx/nginx.conf` — the engine is reached
     only from the backend on the internal network, never from the edge.
   - Scanner unit tests exist but did **not compile** until 2026-08-29: a test
     called `build_command` as if it returned `Vec<String>` after the signature
     changed to `(String, Vec<String>)`, so `cargo test` failed and the suite had
     never actually run despite CI claiming to.
5. ✅ Expand billing/Stripe flow beyond stub endpoints.
   - `customer.subscription.updated`: updates `organizations.plan_type` + upserts `subscriptions` record with period tracking.
   - `invoice.payment_failed`: marks `subscriptions.status = 'past_due'` with attempt count logging.
   - `/api/v1/billing/portal`: Stripe Customer Portal session creation (returns `portal_url`).
   - Pure helper functions: `resolve_plan_from_price_id`, `extract_price_id_from_subscription`, `parse_stripe_signature` — all unit-tested.
   - 13 unit tests: signature parsing, plan resolution, subscription event shapes, payment_failed event shape.
6. ✅ Wire `purple_team_abort_exercise` to emit telemetry abort event (parity with ingest_telemetry).
   - Abort event appended to `payload->'telemetry_events'` atomically in same UPDATE; response body carries event; 3 unit tests.

## 9) Latest Frontend Stability Notes

- Frontend CI/deploy path for `saas-frontend` is npm-based (`npm ci`, `npm run ...`), aligned to `package-lock.json`.
- Purple Team role/deep-link guard tests are enforced in CI via `npm run test:purple-flow`.
- Dashboard pages with helper subcomponents were stabilized for i18n hook usage (`useTranslation`) and hook-order correctness (`useDocumentTitle` after `t` binding).
- Deprecated, unused terminal UI dependencies were removed from `saas-frontend` (`xterm`, `xterm-addon-fit`, `xterm-addon-web-links`) and stale Vite chunk mapping was removed.

## 10) Tool Catalog & Zero-code Runner (May 2026)

- **Catalog source of truth.** `rust-backend/src/services/hackingtool_seed.rs` (173 entries) and `rust-backend/src/services/hackingtool_seed_modern.rs` (209 entries) both seed on every startup with idempotent UPSERT. IDs prefixed `ht_`. Modern catalog covers cloud_security, container_security, kubernetes_security, supply_chain, secrets_scan, api_security, ai_security, web3_security, mobile_modern, ci_cd_security, threat_intel, malware_analysis, fuzzing, plus the ProjectDiscovery toolchain (chaos, dnsx, asnmap, tlsx, mapcidr, cdncheck, tlsx, uncover, interactsh, cvemap). Total runnable tools in DB: **1543 (382 hackingtool family). Health-baselined May 11 2026: 613 healthy, 554 missing, 345 broken, 23 needs_interactive — see scripts/tool-health-probe.py + scripts/tool-health-report-*.json**.
- **Helper visibility.** Param helpers `p_target/p_url/p_host/p_domain/p_file/p_wordlist/p_apk/p_none` in `hackingtool_seed.rs` are `pub(crate) fn` so the modern catalog can re-use them.
- **Reverse-tunnel job channel (Phase 16/17).** `migrations/004_agent_jobs.sql` adds the queue table. `start_scan` routes RT agents to the queue and spawns a 30-min poller. `cancel_scan` flips queued/running rows to `cancelled`; `finalize_scan` only updates rows still in `('pending','running')` so late agent results cannot resurrect a cancelled scan.
- **Per-row schema.** Each tool row has `command_template` (string with `{placeholder}` tokens) and `parameters` JSONB. For hackingtool entries, `parameters = { form: [{name,label,type,required,placeholder,default,options}], danger_level, target_types }`.
- **Zero-code form rendering.** `saas-frontend/src/pages/dashboard/ToolDetailPage.tsx::getNormalizedParams()` detects the `form` array shape and produces a `ToolParameter[]` automatically. `generateCommand()` substitutes `{key}` placeholders against the live form values for the preview.
- **Backend substitution + guard.** `rust-backend/src/handlers/scan_handlers.rs::start_scan` walks `body.parameters`, strips CR/LF/backticks, rejects shell metachars (`$()`, `&&`, `||`, `;`, `|`) with a warn log, then `t.replace("{key}", &safe)` into the template before spawn.
- **Cancel.** `services/cybersec_ai_worker.rs` polls a cancel flag between phases; UI Stop button typically tears the job down in &lt;5s. Worker `run()` also calls `sweep_orphans(db, true)` on startup (force-finalises any `running`/`cancelling` row with `cancel_reason='orphaned by worker restart'`) and `sweep_orphans(db, false)` per tick (force-cancels any `cancelling > 2 min` with `cancel_reason='force-cancelled after grace period'`). No more stuck "Cancelling…" UI after a backend restart.
- **Multilingual suggest.** `handlers/ai_handlers.rs::search_tools` calls `translate_query_to_english(q)` first — keyword-maps Turkish (başla→start, araç→tool, tarama→scan, zafiyet→vulnerability, kablosuz→wireless, parola→password, oltalama→phishing, sızma→pentest, etc.) plus a few DE/ES/FR pentest nouns onto the English keyword catalog. On zero matches, returns curated starter set `[subfinder, httpx, nmap, nuclei, nikto, ffuf]` filtered by `target_type` instead of an empty list.

## 11) Hybrid Agent Connectivity

- Two transports per device, picked in the Add Device wizard:
  - **SSH** (existing). Outbound from backend; credentials AES-256-GCM at rest.
  - **Reverse-tunnel agent** (new). User installs a small binary; agent dials hub over TLS 1.3 with a one-time enrollment token. No inbound port required.
- Per-OS install one-liners are surfaced for Linux x86_64, macOS universal, Windows x86_64, and Docker (`semihkilic/cybersec-agent:v1`).
- **Enrollment token issuance.** `POST /api/v1/agents/enrollment-token` (auth required) returns an HMAC-SHA256 JWT carrying `{org_id, kind: "agent_enroll", iat, exp}` scoped to the caller's organization with a 24h TTL. Signed with `JWT_SECRET_KEY` (falls back to `JWT_SECRET`). The agent presents this token on first dial-in via `POST /api/v1/agents/enroll`; the SHA-256 hash of the JWT is persisted in `agents.enrollment_token_hash` so the same token cannot enroll twice. After enrollment the agent rotates to a long-lived `api_key` returned in the enroll response. Implementation: `agent_handlers::issue_enrollment_token` (rust-backend/src/handlers/agent_handlers.rs:422).

## 12) Privacy / Zero-knowledge Credentials

- Inputs flagged secret (`f.type === 'password'` OR name matches `pass|secret|token|api[_-]?key|credential`) are rendered masked with an inline 🔒 banner on every tool form.
- Per-scan credentials are forwarded to the executing agent in memory and discarded when the job ends. Not written to DB, logs, backups, or analytics.
- BYO Vault is supported for credential resolution at run time: HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, 1Password Connect.
- Public docs: `/dashboard/privacy` carries the full "Zero-knowledge credential handling" section.

## 13) Phase 40 + SSE Reliability (May 2026)

- **Scan output stream is replay-safe.** `handlers/scan_handlers.rs::scan_output_stream` now subscribes to `state.scan_output_tx` **before** the DB lookup, then prepends a replay segment built from `scans.output` (one SSE event per output line + a terminal `complete` event when the scan is already in `completed`/`failed`/`cancelled`). For terminal scans the live broadcast tail is dropped entirely — replay is the full story. This fixes the "Stream disconnected unexpectedly" / empty-stream bug for fast tools (e.g. local nmap) that finished before the browser opened the SSE.
- **AppState pool field is `db`, not `pool`.** All handlers use `&state.db` (PgPool). Any new handler copy-pasted from older code must be migrated to `state.db` or it will not compile.
- **Phase 40 (May 4) cleanup.** Removed `_archived_python/` (sales backend, monitor, translate, email — all replaced by Rust services). Upgraded `redis` crate to `0.27`. 7 Rust files received compile fixes (handlers/community, handlers/billing, handlers/scan, scan_engine wiring). `.gitignore` now excludes nested `**/target/` so `rust-agent` etc. no longer leak build artifacts.
- **Backend listens on `0.0.0.0:5001`.** Health endpoint: `GET /api/health` → `{"engine":"rust-axum","status":"healthy","version":"4.0.0"}`. Frontend dev server is `vite --port 3001`. Nginx is in front for production routing.




## 14) Security Audit — 2026-08-29

A full audit ran over the whole repository. What changed, and what to know:

### Host stability
The VM was being hard-stopped repeatedly. It was **not** a guest problem: the
Proxmox host's OOM killer was killing the VM's `kvm` process, seven times over
eleven days, because VM 100 was allocated **16000 MB on a host with 15868 MB**.
The guest only used ~2 GB, but its page cache counts toward the kvm process's
RSS. Fixed by resizing to `memory 12000` / `balloon 4096`, raising host swap
2 GB → 10 GB, and adding a guard timer that restarts the VM within 30s.
See `scripts/proxmox-host/`.

### Secrets
`.backup-key`, 16 encrypted production database backups, a 4.3 MB plaintext dump
and `rust-backend/.env.staging` (23 live values) were all in git history — and
the key and the ciphertext were in the *same repository*. `JWT_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `GITHUB_CLIENT_SECRET` and `GOOGLE_CLIENT_SECRET` were
still the production values. History was purged, the repo recreated, and the
JWT and Stripe webhook secrets rotated. Secrets now live in `~/.secrets/`.

`auto-git-sync.sh` was the root cause (unconditional `git add -A`); it now
refuses to commit secret-shaped or oversized files.

### Things that looked implemented but did nothing
  * **API keys** authenticated nothing — no code read `key_hash`, and its
    per-key argon2 salt made lookup impossible. Now works via `key_lookup`.
  * **MFA** never enabled: a Rust `String` was bound to a `jsonb` column and the
    error was swallowed by `let _ =`.
  * **SSH agents** never ran: the executor requires a pinned host key and
    nothing ever wrote one.
  * **Role hierarchy** was decorative — `viewer` could do everything.
  * **GDPR retention purge** was never scheduled (now opt-in via
    `DATA_RETENTION_ENABLED`).
  * **Refresh tokens**: the backend never set the cookie the frontend read, so
    sessions died after 60 minutes; logout revoked nothing.
  * **Saving an SSO config** deleted the existing one and stored nothing
    (`is_enabled` bound as integer `0` into a boolean column).

### Standing conventions after the audit
  * `ENCRYPTION_KEY` encrypts secrets at rest and is **separate** from
    `JWT_SECRET_KEY`. Never merge them: the signing key gets rotated.
  * Timestamps: `subscriptions` and `users.locked_until` mix `TIMESTAMP` and
    `TIMESTAMPTZ`. sqlx only type-checks a column when the value is non-NULL, so
    a mismatch appears to work until the first non-null row. Cast to text in SQL
    when the column type is uncertain.
  * Never bind a Rust `String` to a `jsonb` column — bind `serde_json::Value`.
  * Command templates are tokenised **before** user values are substituted, so a
    value can never introduce a new argv entry. Values starting with `-` are
    refused.
  * `services::net::truncate_bytes` for any user-influenced truncation; a byte
    slice panics on a multi-byte boundary.
  * Rate limiting is a global middleware with cost tiers, not per-handler calls.
