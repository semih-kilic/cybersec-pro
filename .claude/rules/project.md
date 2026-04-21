# CyberSec Pro - Project Rules

## Core Rule Set

1. Security before speed for auth, scanning, and infrastructure changes.
2. Prefer small, reversible edits over broad rewrites.
3. Keep repository docs aligned with real manifests and scripts.
4. Never leave touched files in syntactically broken state.

## Rust Rules

- Follow existing Axum patterns (`State<Arc<AppState>>`, extractor-based auth).
- Avoid `unwrap()` in request hot paths.
- Use parameterized SQL with `sqlx`.
- Keep schema changes additive in `rust-backend/src/services/db.rs`.

## Frontend Rules

- Keep TypeScript strictness and avoid `any` unless justified.
- Preserve routing/state/query patterns already in use.
- Validate with lint/type-check for touched frontend package.

## i18n Rules

- Source of truth: `en.json`.
- Keep key names and structure identical across locales.
- Translate user text; preserve technical placeholders (`example.com`, URLs, IDs) when useful.
- After editing locales, run:
```bash
cd saas-frontend
npm run i18n:check
```

## Docs Rules

When architecture, scripts, or workflow changes, update at least:
- `CLAUDE.md`
- `.claude/memory/project-state.md`
- `SKILLS.md` (if process or playbooks changed)

## High-Risk Files

- `nginx/nginx.conf`
- `docker-compose.yml`
- `rust-backend/src/services/db.rs`
- locale JSON files under `saas-frontend/src/i18n/locales/`

Require extra validation after editing these.
