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
1. Purple Team endpoints now provide a minimal usable in-memory flow (`chains`, `playbooks`, `mitre`, `dashboard`, `create`, `list`, `detail`), but persistence and production semantics are still pending.
2. Billing/Stripe is still partially stubbed.
3. `rust-scan-engine` integration path is pending.
4. SQLx version mismatch (`0.8` vs `0.7`) remains unresolved.

### Recent Backend Progress (2026-04-21)
- Added static Purple Team chain/playbook catalogs and MITRE matrix response.
- Added in-memory organization-scoped exercise store for create/list/detail/dashboard.
- Added unit tests for purple-team exercise shape and list/detail round-trip in `rust-backend/src/handlers/stub_handlers.rs`.

### Working Conventions
- Scope-based translation workflow for i18n.
- Validate locale integrity immediately after edit batches.
- Keep docs synced to real manifests (`Cargo.toml`, `package.json`, `docker-compose.yml`).
