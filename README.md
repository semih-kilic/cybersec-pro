# CyberSec Pro

CyberSec Pro is a multi-service cybersecurity SaaS platform with Rust APIs, a React/Vite application dashboard, and a Next.js marketing site.

## Repository Status

- Core API runtime: `rust-backend` (Axum, PostgreSQL, Redis)
- Frontend apps: `saas-frontend` (React/Vite), `frontend` (Next.js)
- Infra orchestration: `docker-compose.yml` + Nginx reverse proxy
- Localization parity complete (2026-04-21): `saas-frontend/src/i18n/locales`

## Quick Start

```bash
git clone https://github.com/semih-kilic/cybersec-pro.git
cd cybersec-pro
cp .env.example .env
docker-compose up -d
docker-compose ps
```

## Local Development

### Rust backend

```bash
cd rust-backend
cargo run --bin cybersec-pro-backend
```

### SaaS frontend

```bash
cd saas-frontend
npm install
npm run dev
```

### Marketing frontend

```bash
cd frontend
pnpm install
pnpm dev
```

## i18n Commands

```bash
cd saas-frontend
npm run i18n:check
npm run i18n:residual
```

Current localization status:

- Locales: `en`, `de`, `es`, `fr`, `it`
- Scopes checked: `49`
- Same-as-English residual keys: `0`

Localization files live in:

- `saas-frontend/src/i18n/locales/en.json`
- `saas-frontend/src/i18n/locales/de.json`
- `saas-frontend/src/i18n/locales/es.json`
- `saas-frontend/src/i18n/locales/fr.json`
- `saas-frontend/src/i18n/locales/it.json`

## Key Documentation

- `CLAUDE.md` - operational context and guardrails
- `SKILLS.md` - repeatable implementation playbooks
- `ARCHITECTURE.md` - service topology and routing map
- `.claude/rules/project.md` - project execution rules
- `.claude/memory/project-state.md` - current development state

## Important Notes

- Do not commit secrets (`.env`, keys, tokens).
- Treat `nginx/nginx.conf` and `docker-compose.yml` as high-risk files.
- Keep schema changes additive in `rust-backend/src/services/db.rs`.