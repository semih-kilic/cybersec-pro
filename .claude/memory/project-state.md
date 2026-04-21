# CyberSec Pro - Project State
Last updated: 2026-04-21

## Active Development Snapshot

### Platform
- Main API: `rust-backend` (Axum, port 5001)
- SaaS app: `saas-frontend` (React + Vite)
- Marketing app: `frontend` (Next.js 16)
- Standalone scan engine exists but is not integrated into compose runtime

### Current i18n Progress (`saas-frontend`)
- Locales: `en`, `de`, `es`, `fr`, `it`
- Completed scopes: 49 / 49
- Remaining keys: 0
- Latest completed scopes: `sso`, `tools`, `toolsCatalog`, `serviceManager`, `landing`, `overview`, `admin`, `integrations`, `team`, `privacy`
- Status: Locale parity pass complete (no same-as-English residuals vs `en` baseline)

### Key Technical Debt
1. Purple Team endpoints now provide a DB-backed minimal flow (`chains`, `playbooks`, `mitre`, `dashboard`, `create`, `list`, `detail`); remaining debt is production-grade execution and telemetry.
2. Billing/Stripe is still partially stubbed.
3. `rust-scan-engine` integration path is pending.
4. SQLx version mismatch (`0.8` vs `0.7`) remains unresolved.

### Recent Backend Progress (2026-04-21)
- Added static Purple Team chain/playbook catalogs and MITRE matrix response.
- Replaced in-memory exercise state with `purple_team_exercises` PostgreSQL persistence and DB-driven dashboard/list/detail.
- Added automatic lifecycle progression in Purple Team reads (`pending -> running -> completed`) with payload/metric sync.
- Enriched completed Purple Team payload simulation with step timeline, blue-team alerts, gap-analysis details, and MITRE coverage-map entries.
- Added chain/target-aware detection profile so completion metrics vary by exercise scenario instead of fixed ratios.
- Added environment-variable controls for Purple Team detection profile tuning without code changes.
- Added `PURPLE_TEAM_PROFILE_JSON` override support (nested/flat keys) with precedence over individual tuning env vars.
- Added unit tests for purple-team exercise payload shape and chain/default builder behavior in `rust-backend/src/handlers/stub_handlers.rs`.

### Working Conventions
- Scope-based translation workflow for i18n.
- Validate locale integrity immediately after edit batches.
- Keep docs synced to real manifests (`Cargo.toml`, `package.json`, `docker-compose.yml`).
