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
- `rust-service-manager/` - watchdog/super-admin utility service
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
cd frontend && pnpm install && pnpm dev
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

- `rust-backend/src/handlers/stub_handlers.rs` still contains mixed maturity endpoints; Purple Team now has DB-backed persistence with time-based lifecycle simulation, while real execution telemetry is still placeholder.
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
4. ✅ Align scan engine integration strategy with compose and routing.
   - Nginx /api/v3/ routing (600s timeouts); 16 scanner unit tests (injection, whitelist, build_command); CI step added.
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

