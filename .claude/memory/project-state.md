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
- Completed scopes: 26 / 42
- Remaining keys: 378 across 23 scopes
- Latest completed scopes: `login`, `oauth`, `billing`
- Next high-priority scopes: `sso`, `integrations`, `landing`, `profile`

### Key Technical Debt
1. Multiple endpoints in `stub_handlers.rs` remain incomplete.
2. Billing/Stripe is still partially stubbed.
3. `rust-scan-engine` integration path is pending.
4. SQLx version mismatch (`0.8` vs `0.7`) remains unresolved.

### Working Conventions
- Scope-based translation workflow for i18n.
- Validate locale integrity immediately after edit batches.
- Keep docs synced to real manifests (`Cargo.toml`, `package.json`, `docker-compose.yml`).
