# CyberSec Pro — CLAUDE.md

## Project Purpose

B2B SaaS cybersecurity platform providing browser-based access to 165+ Kali Linux security tools. Target market: Nordic SMEs and security professionals. Subscription tiers: trial (free), starter (€99/mo), professional, team, enterprise. Users run scans against their own infrastructure via remote agents (SSH/VPN) or the hosted Kali container.

Domain: `cybersecpro.com` / `semihkilic.com` · Author: Semih Kılıç

---

## Tech Stack (exact versions from Cargo.toml / package.json)

### Rust Services
| Crate | Version | Notes |
|---|---|---|
| axum | 0.7 | Web framework (all 3 Rust services) |
| tokio | 1 (full) | Async runtime |
| sqlx | 0.8 (rust-backend), **0.7** (rust-scan-engine) | ⚠ version mismatch |
| hyper | 1 | |
| tower / tower-http | 0.4 / 0.5 | Middleware stack |
| serde / serde_json | 1 | |
| jsonwebtoken | 9 | JWT access + refresh tokens |
| argon2 | 0.5 | Password hashing |
| totp-rs | 5 | MFA/TOTP |
| oauth2 | 4 | GitHub + Google OAuth |
| reqwest | 0.12 | HTTP client (rustls-tls) |
| governor | 0.6 | Rate limiting |
| redis | 0.25 | Cache / sessions |
| lettre | 0.11 | SMTP email |
| uuid | 1 (v4) | |
| chrono | 0.4 | |
| nix | 0.28 | Process/signal control (scan engine) |
| portable-pty | 0.8 | PTY for web terminal |
| dashmap | 5 | In-memory rate limiter storage |
| sysinfo | 0.31 | System metrics (service-manager only) |
| tracing / tracing-subscriber | 0.1 / 0.3 | Structured logging |

### Frontend
| Package | Version | Notes |
|---|---|---|
| React | 19.2.3 | saas-frontend (Vite SPA) |
| Next.js | 16.1.7 | marketing/docs frontend |
| TypeScript | 5 | |
| Tailwind CSS | 4 | |
| @tanstack/react-query | 5.x | Data fetching (saas-frontend) |
| framer-motion | 10.x | Animations |
| axios | 1.6.x | API client |
| @stripe/react-stripe-js | 2.4 | |
| @headlessui/react | 1.7 | |
| Vite | bundler for saas-frontend | |

### Infrastructure
| Component | Version |
|---|---|
| PostgreSQL | 15-alpine |
| Redis | 7-alpine |
| Nginx | alpine |
| Docker Compose | 3.8 |
| WireGuard VPN | linuxserver/wireguard (Enterprise) |
| Kali Linux container | privileged, NET_ADMIN + SYS_ADMIN |

---

## Directory Structure

```
cybersec-pro/
├── rust-backend/           # Main API (Axum, port 5001) ← primary service
│   └── src/
│       ├── main.rs         # App bootstrap, router, AppState, background tasks
│       ├── handlers/       # Route handlers (auth, scan, agent, billing, etc.)
│       │   └── stub_handlers.rs  # ⚠ Incomplete endpoints returning placeholder responses
│       ├── middleware/     # auth_middleware, rate_limiter, security_headers
│       ├── models/         # SQLx FromRow structs (user, org, scan, agent, etc.)
│       ├── services/       # db.rs (schema DDL), auth/, plan.rs, email.rs, monitor.rs
│       └── scan_engine/    # executor.rs (subprocess + SSH dispatch), parsers, tool_registry
├── rust-scan-engine/       # Standalone scan execution engine (port 5002, sqlx 0.7)
│   └── src/                # scanner.rs (8 workers), auth.rs, models.rs
├── rust-service-manager/   # Service watchdog + super-admin API (sysinfo 0.31)
│   └── src/main.rs
├── saas-frontend/          # React/Vite SPA dashboard (served on port 3000)
│   └── src/                # @tanstack/react-query, axios, Stripe checkout
├── frontend/               # Next.js marketing site (port varies)
│   └── src/                # next-intl (i18n), Three.js, GSAP animations
├── cybersec-kali/          # Kali Linux Docker image + tool execution API (port 5003)
│   ├── Dockerfile.kali
│   └── tools/
├── nginx/                  # ⚠ DO NOT MODIFY without review
│   ├── nginx.conf          # Reverse proxy (rate limiting, WebSocket, gzip)
│   └── ssl/                # TLS certificates
├── scripts/
│   └── init-db.sql         # Seed data (tools catalog)
├── cybersec-sales/         # Sales site + Stripe landing pages
├── cybersec-monitor/       # systemd-based monitoring scripts
├── cloudflare/config.yml   # Cloudflare tunnel config
├── docker-compose.yml      # Full stack orchestration
├── .env                    # ⚠ NEVER COMMIT — secrets
└── .env.example            # Template for required variables
```

---

## Build & Run Commands

### Full Stack (Docker) — primary workflow
```bash
cp .env.example .env          # then fill in secrets
docker-compose up -d          # start all services
docker-compose logs -f rust-backend
docker-compose ps
docker-compose down
```

### Rust Backend (local dev)
```bash
cd rust-backend
cargo build
cargo run --bin cybersec-pro-backend
# Binary also: cargo run --bin translate
```

### Rust Scan Engine (local dev)
```bash
cd rust-scan-engine
cargo run                     # port 5002 (SCAN_ENGINE_PORT env)
```

### Rust Service Manager (local dev)
```bash
cd rust-service-manager
cargo run
```

### SaaS Frontend (React/Vite)
```bash
cd saas-frontend
npm install
npm run dev             # http://localhost:5173
npm run build           # output: dist/
npm run type-check
```

### Marketing Frontend (Next.js)
```bash
cd frontend
pnpm install
pnpm dev                # http://localhost:3000
pnpm build && pnpm start
```

### Production Deploy
```bash
./deploy-production.sh          # installs system packages, builds frontend, configures nginx
./start-production.sh           # alias to docker-compose up
```

---

## Environment Variables Required

See `.env.example` for full list. Critical variables:

```bash
# Required — will panic on startup if missing
DATABASE_URL=postgresql://cybersec:<DB_PASSWORD>@postgres:5432/cybersec_pro
JWT_SECRET_KEY=<min 32 chars>

# Required for payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_TEAM=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# Required for OAuth (GitHub implemented; Google stub returns error)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=     # UI shows button; backend not yet implemented
GOOGLE_CLIENT_SECRET=

# Email (SMTP)
SMTP_HOST=smtp.yandex.com
SMTP_PORT=465
SMTP_USER=noreply@cybersecpro.com
SMTP_PASSWORD=

# Optional (have defaults)
REDIS_URL=redis://redis:6379/0
DB_PASSWORD=***REDACTED_PG_PASSWORD***
API_SECRET=          # Kali container inter-service auth
VPN_SERVER_URL=vpn.cybersecpro.com
RUST_LOG=info
SCAN_ENGINE_PORT=5002
```

---

## Database Schema Summary

Schema is defined inline in `rust-backend/src/services/db.rs` (`SCHEMA_STATEMENTS`) and applied idempotently on every startup via `CREATE TABLE IF NOT EXISTS`.

| Table | Key Columns | Notes |
|---|---|---|
| `organizations` | id (TEXT PK), name, slug (UNIQUE), plan_type, stripe_customer_id | Root tenant entity |
| `users` | id (TEXT PK), email (UNIQUE), password_hash, role, organization_id (FK), oauth_provider/id, mfa_enabled/mfa_secret, mfa_backup_codes (JSONB) | |
| `audit_logs` | id, organization_id, user_id, action, category, severity, ip_address, details (JSONB), resource_type/id, status | |
| `subscriptions` | id, organization_id (FK), stripe_subscription_id (UNIQUE), plan_type, status, period dates | |
| `agents` | id, organization_id, name, platform, status, connection_type, ssh_host/port/key/fingerprint, vpn_*, proxy_*, agent_capabilities (JSONB), registration_token (UNIQUE), api_key (UNIQUE) | Remote execution nodes |
| `tools` | id (TEXT PK), name, category, command_template, parameters (JSONB), plan_required, tool_type, hardware_required (JSONB), business_* fields, binary_name, kali_package | Seeded from init-db.sql |
| `projects` | id (SERIAL), organization_id, name, target_type, target_url/ip, status | |
| `scans` | id (TEXT PK), organization_id, user_id, tool_id, target, parameters (JSONB), status, agent_id, project_id, output, error_log, findings (JSONB), report_path, timing | |
| `usage_tracking` | id, organization_id, tool_id, scan_id, usage_date | |

Indexes: `idx_audit_logs_created_at`, `idx_audit_logs_org`, `idx_scans_org`, `idx_scans_status`

User roles: `user`, `admin`, `superadmin`  
Plan types: `trial`, `starter`, `professional`, `team`, `enterprise`  
Scan statuses: `pending`, `running`, `completed`, `failed`, `cancelled`  
Agent statuses: `pending`, `online`, `offline`, `error`

---

## Files NEVER to Modify Directly

- `nginx/nginx.conf` — Production reverse proxy. Any change breaks all routing. Test with `nginx -t` before reload.
- `nginx/ssl/` — TLS certificates. Replace only via certbot/renewal process.
- `.env` — Secrets. Edit manually; never commit or echo into logs.
- `rust-backend/src/services/db.rs` (SCHEMA_STATEMENTS section) — Schema DDL applied on startup. Additive changes only; never drop or rename columns.
- `scripts/init-db.sql` — Tools seed data. Modify only to add/update tool records.
- `docker-compose.yml` — Orchestration contract between services. Validate with `docker-compose config` before changes.

---

## Known Issues & TODOs (found in codebase)

1. **`stub_handlers.rs` — many endpoints not implemented**: `social_auth` (Google returns 400 error), `sso_test`, `plan_info`, `plan_features`, `tools_catalog`, `tool_config`, `tool_execution_mode`, `tool_build_command`, `v2_tools`, scan variants (`scan_rerun`, `scan_business_report`, `scan_status`, `scans_execute`), agent dashboard, schedules (CRUD), targets, target-groups, analytics overview, activity feed, `usage_stats`, all admin endpoints (`admin_overview`, `admin_impersonate`, `admin_change_plan`).

2. **Stripe integration disabled**: `async-stripe` is commented out in `rust-backend/Cargo.toml`. Billing flows are stubs.

3. **sqlx version mismatch**: `rust-backend` uses sqlx `0.8`, `rust-scan-engine` uses sqlx `0.7`. This must be unified before `rust-scan-engine` is integrated.

4. **Google OAuth not implemented**: Backend returns `"Google OAuth not yet implemented"`. Only GitHub OAuth is functional.

5. **CORS origin hardcoded**: `main.rs` allows `semihkilic.com` — needs updating to `cybersecpro.com` for production.

6. **Email verification flow incomplete**: Token is generated and stored, but `verify_email` and `resend_verification` are stubs.

7. **`rust-scan-engine` is a separate service** (port 5002, v3 API) but `docker-compose.yml` does not include it — only `rust-backend`'s internal `scan_engine/executor.rs` is wired up.

8. **SSH fingerprint verification**: `executor.rs` has a `ssh_fingerprint` field with a comment about writing a `known_hosts` temp file — implementation is incomplete.

9. **Git commits are auto-sync only**: No meaningful commit messages exist. No conventional commit format enforced.
