# CONTEXT.md — CyberSec Pro Domain Language

Shared vocabulary for humans and agents working on this repo. Use these terms
consistently in code, commits, and conversation. Update this file when the
domain model evolves (see `.agents/skills/engineering/domain-modeling/`).

## Two frontends, one backend

| Term | Meaning |
|------|---------|
| **marketing site** | `frontend/` — Next.js static export, served at `cyber-sec-pro.com`. Owns pricing display, blog, trust center. Posts checkouts to relative `/api/*` (nginx proxies to backend). |
| **SaaS app** | `saas-frontend/` — React+Vite SPA served at `app.cyber-sec-pro.com/dashboard/*`. The product itself. |
| **backend** | `rust-backend/` — Axum API on :5001 (container `cybersec-api`). The single source of API truth. |
| **scan engine** | `rust-scan-engine/` — tool execution service on :5002 HTTP / :5003 gRPC (container `cybersec-scan-engine`). Runs inside the Kali tooling image. |
| **agent** | A customer-installed reverse-tunnel worker (`agent_jobs` pipeline), NOT an AI agent. |

## Billing domain

| Term | Meaning |
|------|---------|
| **plan truth** | `organizations.plan_type` — the canonical plan. `subscriptions` only mirrors Stripe state. Never derive plan from anywhere else. |
| **checkout paths** | `auth checkout` = `/api/v1/billing/create-checkout` (logged-in, carries org metadata). `public checkout` = `/api/create-checkout-session` (marketing site, no org — webhook falls back to email/customer matching). |
| **founding member** | 10-spot lifetime deal: $19/mo forever. Gated by `feature_flags` key `founding_member_enabled` (default TRUE) AND claimed count < 10. Claimed = `COUNT(orgs WHERE plan_type='founding_member')`. Cancel frees a spot (webhook resets org to trial). |
| **founding availability probe** | `GET /api/v1/billing/founding-member/status` → `{available}` — deliberately exposes NO counts. |
| **USD era** | Since Aug 2026 all prices are USD. Stripe price IDs live in `rust-backend/.env` as `STRIPE_{PLAN}_PRICE_ID[_YEARLY]` + `STRIPE_FOUNDING_MEMBER_PRICE_ID[_YEARLY]`. |

## Auth domain

| Term | Meaning |
|------|---------|
| **auth tiers** | `AuthUser` → `AdminUser` (admin\|superadmin) → `SuperAdminUser` (God Mode). `AnalystUser` exists but is unwired. |
| **token key** | Frontend stores JWT in `localStorage['token']` — NOT `auth_token` (historic bug). |
| **session revocation** | `users.password_changed_at` (unix secs); refresh rejects tokens with `iat < password_changed_at`. |
| **kill switch** | `feature_flags['platform_kill_switch']` enforced by `middleware/kill_switch.rs` (5s in-memory TTL). Exempt: superadmin routes, login, health, Stripe webhook, docs. |
| **impersonation** | Superadmin-only, never targets superadmins, always audit-logged. |

## Scanning domain

| Term | Meaning |
|------|---------|
| **delegated scan** | Backend dispatches to scan engine (HTTP start → gRPC-first status/output monitoring). Local record inserted atomically with concurrency guard BEFORE dispatch; rolled back on dispatch failure. |
| **agent scan** | Reverse-tunnel: `agent_jobs` row (argv array, 1800s timeout) claimed via SKIP LOCKED; per-scan tokio poller finalizes. |
| **plan gates** | trial 3/day & 1 concurrent; starter 30/mo & 2; professional 250/mo & 5; enterprise 5000/mo & unlimited. Concurrent limit enforced atomically at INSERT. |
| **target authorization** | Self-attestation statement per target; sandbox targets (localhost prefixes) bypass. Metadata IPs (169.254.169.254) always blocked. |

## Theme system (critical UI knowledge)

| Term | Meaning |
|------|---------|
| **light-mode overrides** | `index.css` contains `html.light .text-white { ... !important }` style global overrides that flip dark-designed pages. Any intentionally-dark page must opt out via a scope class (pattern: `register-dark` + `html.light .register-dark ...` re-pins). |
| **marketing landing** | The real landing page is the marketing site. `saas-frontend/src/pages/LandingPage.tsx` is unrouted dead code. |

## Operational invariants

- **Backend must build INSIDE Docker** (`docker compose build rust-backend`). Host builds fail on glibc mismatch (Kali host vs Debian container).
- **Engine needs `CAP_NET_RAW`** (compose cap_add) and runs as root — nmap raw sockets.
- **No docker.sock in the API container** — tool health checks go through engine HTTP `POST /api/v3/tools/check`.
- **stripe_events** table = webhook idempotency; never remove.
- **Two Stripe price generations exist** (EUR legacy inactive, USD active). Never reuse old price IDs.
