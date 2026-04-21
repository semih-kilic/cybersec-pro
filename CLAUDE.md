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

## 6) Safety Rules (Must Follow)

1. Never commit secrets (`.env`, keys, tokens).
2. Treat `nginx/nginx.conf` as high-risk; validate before any reload.
3. Prefer additive DB schema changes in `rust-backend/src/services/db.rs`.
4. Keep auth token handling in header/cookie only.
5. Use rate limiting patterns for public/auth endpoints.
6. Keep scan execution paths secure; avoid shell-injection risk in command building.

## 7) Known Risk Areas

- `rust-backend/src/handlers/stub_handlers.rs` still contains incomplete endpoints.
- Billing/Stripe flow remains partially stubbed.
- `rust-scan-engine` is not integrated in `docker-compose.yml`.
- SQLx version mismatch between backend and scan engine should be resolved before deeper integration.

## 8) Best-First Priorities

1. Convert high-impact stubs in `stub_handlers.rs` into production-grade handlers.
2. Add/expand automated checks (lint, type-check, backend smoke tests).
3. Keep i18n parity stable with CI checks for locale drift.
4. Align scan engine integration strategy with compose and routing.

