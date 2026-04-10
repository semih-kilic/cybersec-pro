# CyberSec Pro — Project State
*Last updated: 2026-04-09*

---

## Services: What Exists

| Service | Directory | Port | Status |
|---|---|---|---|
| Main API (Axum) | `rust-backend/` | 5001 | ✅ Running in Docker |
| SaaS Frontend (React/Vite) | `saas-frontend/` | 3000 | ✅ Running in Docker |
| Marketing Frontend (Next.js) | `frontend/` | varies | ✅ Built separately |
| Kali Tools Container | `cybersec-kali/` | 5003, 2222, 7681 | ✅ In Docker |
| PostgreSQL | Docker image | 5432 | ✅ Running |
| Redis | Docker image | 6379 | ✅ Running |
| Nginx Reverse Proxy | Docker image | 80/443 | ✅ Running |
| WireGuard VPN | Docker image | 51820 | ✅ Enterprise only |
| Web Terminal (ttyd) | Docker image | 7682 | ✅ Running |
| Scan Engine | `rust-scan-engine/` | 5002 | ⚠️ Built but NOT in docker-compose |
| Service Manager | `rust-service-manager/` | — | ⚠️ Built but NOT in docker-compose |

---

## What's Working

- **Authentication**: Email/password register + login, JWT access + refresh tokens, Argon2 password hashing
- **GitHub OAuth**: End-to-end implemented in `stub_handlers.rs::social_auth`
- **MFA/TOTP**: Setup flow, verification, backup codes (in auth_handlers)
- **Rate limiting**: In-memory DashMap-based limiter on all public endpoints; cleanup every 5 min
- **Security headers**: Applied globally via `security_headers` middleware
- **Scan execution**: `scan_engine/executor.rs` — subprocess with streaming SSE output, SSH remote dispatch
- **Agent CRUD**: Create, list, get, delete agents (SSH/VPN/proxy connection types)
- **Scan CRUD**: Create, list, get scans with org-scoped filtering, pagination
- **Reports**: Listed in handlers (report_handlers.rs exists)
- **Projects**: CRUD via project_handlers.rs
- **Service watchdog**: `ServiceManager` in AppState — monitors services every 10s, auto-restarts
- **Site monitor**: Checks HTTP endpoints every 60s
- **Audit logging**: `services/audit.rs` — logs all significant actions to audit_logs table
- **Dashboard stats**: `dashboard_handlers.rs` — aggregated metrics
- **Email**: `lettre` SMTP integration in `services/email.rs`

---

## Known Broken / Incomplete

### Critical Stubs (frontend will break / show errors)
- **Google OAuth** (`/api/v1/auth/google`): Returns `"Google OAuth not yet implemented"` — only GitHub works
- **Email verification** (`/api/v1/auth/verify-email`, `/api/v1/auth/resend-verification`): Stubs
- **Stripe/Billing**: `async-stripe` commented out in Cargo.toml. All billing routes return placeholder data
- **Tools catalog** (`/api/v1/tools/catalog`, `/api/v1/tools/:id/config`): Stubs — tools are seeded in DB via init-db.sql but catalog endpoint doesn't serve them
- **SSO/SAML** (`/api/v1/sso/*`): `sso_test` is a stub; config CRUD may be partial

### Partially Implemented
- **Scan variants**: `scan_rerun`, `scan_business_report`, `scan_status` (polling), `scans_execute` are stubs — only the main `POST /api/v1/scans` and `GET /api/v1/scans` work fully
- **Agent operations**: `update_agent` (PUT) is a stub; `test_agent` is a stub
- **Schedules**: All schedule endpoints (`/api/v1/schedules`) are stubs — `scheduled_scans` table exists in schema
- **Analytics** (`/api/v1/analytics/overview`): Stub
- **Admin endpoints** (`/api/v1/admin/*`): `overview`, `impersonate`, `change-plan` are all stubs
- **SSH fingerprint verification**: Code structure exists in executor.rs but `known_hosts` temp file writing is incomplete comment

### Infrastructure Gap
- `rust-scan-engine` (port 5002, v3 API with 8-worker queue) is NOT wired into docker-compose.yml — the main backend uses its own inline `scan_engine/` instead
- `rust-service-manager` is also absent from docker-compose.yml

### Version Inconsistency
- `rust-scan-engine/Cargo.toml` uses `sqlx = "0.7"` while `rust-backend` uses `0.8` — must unify before integrating

---

## TODO Items Found in Code

From source analysis (no explicit `// TODO` comments found — issues detected by stubs):

1. Implement Google OAuth (`stub_handlers.rs::social_auth` provider != "github" branch)
2. Implement Stripe billing — uncomment `async-stripe` and replace billing stubs
3. Implement real `tools_catalog` endpoint (read from DB instead of stub)
4. Implement `scan_business_report` — AI/LLM report generation placeholder
5. Implement email verification flow end-to-end
6. Implement SSO/SAML with real SAML library
7. Add `rust-scan-engine` to docker-compose.yml and route `/api/v3/` through Nginx
8. Upgrade `rust-scan-engine` sqlx from 0.7 → 0.8
9. Fix CORS: add `cybersecpro.com` to allowed origins in `main.rs` (currently only `semihkilic.com`)
10. Complete SSH fingerprint MITM protection in `executor.rs`
11. Implement `admin_impersonate` — super-admin to shadow any user's session
12. Implement scheduled scan runner (cron-style background task)

---

## Architecture Decisions Visible in Code

- **Schema-in-code**: No migration files — schema DDL lives in `rust-backend/src/services/db.rs::SCHEMA_STATEMENTS`. Applied idempotently on every startup. Consequence: no rollback mechanism.
- **TEXT PKs everywhere**: UUIDs stored as TEXT, not PostgreSQL UUID type. Allows simpler Rust interop but no DB-level UUID validation.
- **Broadcast channel for SSE**: Scan output streamed globally via `tokio::sync::broadcast::channel(1024)` — all connected clients receive all scan outputs, filtered client-side by scan_id. Should be per-scan channel long-term.
- **Tools seeded in DB**: Tool catalog is in PostgreSQL (from `scripts/init-db.sql`), not in code. This allows live updates without redeployment.
- **Plan config in Rust code**: Plan limits/features are defined in `services/plan.rs::get_plan_configs()` as a HashMap, not in DB. Changing pricing requires a code deploy.
- **Dual frontend architecture**: `saas-frontend` (React/Vite, the app dashboard) is separate from `frontend` (Next.js, the marketing/landing site). They share the same Nginx and backend but are completely separate builds.
- **Service manager embedded in main API**: `ServiceManager` runs as a background task inside `rust-backend`, not as the standalone `rust-service-manager` crate. Both exist independently.
