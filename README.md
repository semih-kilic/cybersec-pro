# CyberSec Pro

CyberSec Pro is a multi-service cybersecurity SaaS platform with Rust APIs, a React/Vite application dashboard, and a Next.js marketing site.

## Repository Status

- Core API runtime: `rust-backend` (Axum, PostgreSQL, Redis)
- Frontend apps: `saas-frontend` (React/Vite), `frontend` (Next.js)
- Infra orchestration: `docker-compose.yml` + Nginx reverse proxy
- Localization parity complete (2026-04-21): `saas-frontend/src/i18n/locales`
- Purple Team backend flow implemented (DB-backed): create, list, detail, chains, playbooks, MITRE
- Purple Team lifecycle progression enabled: pending -> running -> completed (time-based simulation)

Purple Team simulation tuning (optional env vars):

- `PURPLE_TEAM_DETECT_CHAIN_CREDENTIAL` (default `0.55`)
- `PURPLE_TEAM_DETECT_CHAIN_LATERAL` (default `0.62`)
- `PURPLE_TEAM_DETECT_CHAIN_DEFAULT` (default `0.72`)
- `PURPLE_TEAM_DETECT_PROD_PENALTY` (default `0.10`)
- `PURPLE_TEAM_DETECT_DEV_BONUS` (default `0.08`)
- `PURPLE_TEAM_DETECT_MIN` (default `0.25`)
- `PURPLE_TEAM_DETECT_MAX` (default `0.90`)

Optional single-blob override (takes precedence over the env vars above):

- `PURPLE_TEAM_PROFILE_JSON`

Example:

```json
{
  "chains": {
    "credential": 0.45,
    "lateral": 0.58,
    "default": 0.74
  },
  "target": {
    "prod_penalty": 0.12,
    "dev_bonus": 0.06
  },
  "bounds": {
    "min": 0.20,
    "max": 0.92
  }
}
```

Runtime source precedence for detection tuning:

1. Organization-level profile from `/api/v1/settings/purple-team/profile` (admin-only, DB-backed)
2. `PURPLE_TEAM_PROFILE_JSON`
3. Individual `PURPLE_TEAM_DETECT_*` env vars

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
cargo test purple_team_
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

CI-produced i18n reports:

- `saas-frontend/i18n-coverage-report.json`
- `saas-frontend/i18n-residual-report.json`

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

## CI Artifacts

- `i18n-reports` artifact (frontend job):
  - coverage report
  - residual parity report
- `backend-reports` artifact (backend job):
  - `cargo-check.log`
  - `cargo-clippy.log`
  - `cargo-clippy-exit.txt`

## Important Notes

- Do not commit secrets (`.env`, keys, tokens).
- Treat `nginx/nginx.conf` and `docker-compose.yml` as high-risk files.
- Keep schema changes additive in `rust-backend/src/services/db.rs`.